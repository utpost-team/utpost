import { describe, it, expect, afterAll } from "vitest";
import { yoga } from "./server.js";
import { pool } from "../db/client.js";
import { mongo } from "../db/mongo.js";
import { sign } from "../lib/auth.js";

// Integrationstester (M5): hela kedjan fråga → schema → resolvers → databas, mot riktiga
// Postgres och MongoDB. Ingen port behövs: yoga är en fetch-handler, så vi anropar den direkt
// med samma request som browsern skulle skicka. Adressen spelar ingen roll – bara sökvägen.
// Kräver seedad Postgres och att npm run migrate:logs har körts (lokalt och i jobbet Integration).
const graphql = async (query, { variables, token } = {}) => {
  const res = await yoga.fetch("http://utpost/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  return { status: res.status, ...(await res.json()) };
};

afterAll(async () => {
  await pool.end();
  await mongo.close();
});

describe("GraphQL-API:et mot riktig databas", () => {
  // Regressionstestet för N+1. Samma fråga som ToursView ställer och som mäts i README:
  // 135 databasfrågor i M4 (en per tur och relation), 4 med DataLoader (en för listan + en per
  // relation). Exakt 4, inte "högst": kopplas loadern bort för VILKEN relation som helst blir det rött.
  it("Turer kostar en databasfråga per relation, inte per tur", async () => {
    const { data, errors, extensions } = await graphql(/* GraphQL */ `
      query Turer {
        tours {
          id
          title
          distanceM
          startedAt
          user {
            displayName
          }
          guide {
            title
            slug
          }
          photos {
            id
          }
        }
      }
    `);
    expect(errors).toBeUndefined();
    expect(data.tours).toHaveLength(50);
    for (const tour of data.tours)
      expect(tour.user.displayName).toEqual(expect.any(String));
    expect(extensions.databasfragor).toBe(4);
  });

  it("mätpunkterna kommer från MongoDB och är lika många som i Postgres", async () => {
    const { rows } = await pool.query(
      "select count(*)::int as n from tour_logs where tour_id = 1",
    );
    const { data, errors, extensions } = await graphql(/* GraphQL */ `
      query Tur {
        tour(id: 1) {
          logs {
            recordedAt
            lat
          }
        }
      }
    `);
    expect(errors).toBeUndefined();
    expect(data.tour.logs).toHaveLength(rows[0].n); // migreringen tappade inget
    expect(extensions.databasfragor).toBe(2); // en i Postgres (turen), en i Mongo (dokumentet)
  });

  it("guide(slug) som inte finns är null – inte ett fel", async () => {
    const { data, errors } = await graphql(/* GraphQL */ `
      query Saknas {
        guide(slug: "finns-inte") {
          title
        }
      }
    `);
    expect(errors).toBeUndefined();
    expect(data.guide).toBeNull();
  });

  it("ett fält som inte finns ger errors – med statuskod 200", async () => {
    const { status, data, errors } = await graphql("{ guides { titel } }");
    expect(status).toBe(200);
    expect(data).toBeUndefined();
    expect(errors[0].message).toContain('Cannot query field "titel"');
  });

  it("createTour utan token nekas med koden UNAUTHENTICATED", async () => {
    const before = (
      await pool.query("select count(*)::int as n from tours")
    ).rows[0].n;
    const { data, errors } = await graphql(/* GraphQL */ `
      mutation NyTur {
        createTour(
          input: {
            title: "Testtur"
            startedAt: "2026-10-23T09:00:00Z"
            distanceM: 1000
          }
        ) {
          id
        }
      }
    `);
    expect(data).toBeNull();
    expect(errors[0].extensions.code).toBe("UNAUTHENTICATED");
    const after = (await pool.query("select count(*)::int as n from tours"))
      .rows[0].n;
    expect(after).toBe(before); // nekad = ingen rad skapad
  });

  it("createTour med token skapar turen i den inloggades namn", async () => {
    // Samma JWT som REST-inloggningen ger. Användare 1 finns alltid efter npm run seed.
    const user = (
      await pool.query(
        "select id, email, role, display_name from users where id = 1",
      )
    ).rows[0];
    const { data, errors } = await graphql(
      /* GraphQL */ `
        mutation NyTur($input: CreateTourInput!) {
          createTour(input: $input) {
            id
            title
            user {
              displayName
            }
          }
        }
      `,
      {
        variables: {
          input: {
            title: "Testtur",
            startedAt: "2026-10-23T09:00:00Z",
            distanceM: 1000,
          },
        },
        token: sign(user),
      },
    );
    try {
      expect(errors).toBeUndefined();
      expect(data.createTour.title).toBe("Testtur");
      expect(data.createTour.user.displayName).toBe(user.display_name);
    } finally {
      // Städa även om ett expect ovan misslyckades: testet lämnar inget efter sig i databasen.
      if (data?.createTour?.id)
        await pool.query("delete from tours where id = $1", [
          data.createTour.id,
        ]);
    }
  });

  // M9: notiserna kommer ur CMS:et. I testerna är CMS:et avstängt (inga nycklar i pipelinen),
  // så listan är tom – men frågan ska fungera, och rollkontrollen ska gälla ändå.
  it("notices: fungerar utan CMS, och utkast kräver rollen editor", async () => {
    const utan = await graphql(
      "{ notices { title } guides { slug notices { title } } }",
    );
    expect(utan.errors).toBeUndefined();
    expect(utan.data.notices).toEqual([]);
    expect(utan.data.guides[0].notices).toEqual([]);

    const anonym = await graphql("{ notices(preview: true) { title } }");
    expect(anonym.errors[0].extensions.code).toBe("FORBIDDEN");

    const medlem = sign({
      id: 2,
      email: "medlem@utpost.se",
      role: "member",
    });
    const somMedlem = await graphql("{ notices(preview: true) { title } }", {
      token: medlem,
    });
    expect(somMedlem.errors[0].extensions.code).toBe("FORBIDDEN");
  });
});
