# Skuldinventering

Denna lista är resultatet av att gemensamt läsa igenom `api/` och `web/`
före M0. Rangordningen är efter risk (vad gör mest skada om det ligger
kvar ett halvår till), inte efter vad som stör mest att läsa.

> **M6:** `web/` är borttagen. Sökvägarna under `web/` nedan pekar på filer som inte
> längre finns – de står kvar som historik över hur skulden såg ut. Vyerna lever vidare i
> `client/` (Profile och TourDetail portades i M6). Skuld 20 (Profile filtrerar alla turer
> i klienten) följde med till `client/src/views/ProfileView.vue`.

**Allvar:** Hög = kan ge dataläckor, avbrott eller fel data. Medel =
bromsar varje ändring. Låg = stör men kostar lite.

| # | Vad | Var | Varför det är ett problem | Allvar |
|---|-----|-----|---------------------------|--------|
| 1 | `GET /api/tours` skickar med hela `users`-raden, inklusive lösenordshash, för varje tur | `api/src/routes/tours.js` rad 12 och 18 (`user: user.rows[0]`) | Endpointen kräver ingen inloggning. Vem som helst som anropar `/api/tours` får ut alla lösenordshashar för alla turägare. | Hög |
| 2 | Lösenord lagras och jämförs i klartext | `api/src/routes/auth.js` rad 9–12 (login), rad 20–22 (register): värdet som sparas är bokstavligen `` `plaintext:${password}` `` | Ingen hashning (bcrypt/argon2) alls. Ett dump av databasen ger ut alla användares riktiga lösenord direkt. | Hög |
| 3 | SQL-injektion i guide-sök | `api/src/routes/guides.js` rad 24 | `q` interpoleras rakt in i SQL-strängen (`ilike '%${q}%'`) istället för att skickas som parameter. Ett sökord som `%' OR '1'='1` går rakt igenom. | Hög |
| 4 | Hemligheter committade i klartext | `api/src/config.js` rad 3–4 | `jwtSecret` och hela databasens connection string (inklusive lösenord) ligger hårdkodade i repot. Alla med läsåtkomst till koden kan förfalska JWT-tokens och koppla upp sig mot databasen. | Hög |
| 5 | Login/register skickar tillbaka hela användarraden till klienten | `api/src/routes/auth.js` rad 15 och 24 (`res.json({ token, user })` där `user` är hela DB-raden) | Svaret innehåller `password_hash`, som sedan sparas rakt av i `localStorage` (`web/src/pages/Login.jsx` rad 19). Onödig exponering ovanpå punkt 2. | Hög |
| 6 | `DELETE /api/tours/:id` saknar auth-koll | `api/src/routes/tours.js` rad 47–51 | `requireUser` används på `POST /` (rad 37) men inte på `DELETE /:id`. Vem som helst, inloggad eller inte, kan radera vilken tur som helst. | Hög |
| 7 | Redaktionell HTML från databasen renderas orenad i frontend | Lagras: `api/src/db/schema.js` rad 21–22 (`bodyHtml`). Renderas: `web/src/components/GuideCard.jsx` rad 9 och `web/src/pages/GuideDetail.jsx` rad 20 (`dangerouslySetInnerHTML`) | Ingen sanering vare sig vid lagring eller rendering. Om `bodyHtml` någonsin kommer från en mindre betrodd källa än redaktionen är det lagrad XSS mot alla besökare. | Hög |
| 8 | `GET /api/tours` gör seriella N+1-queries i en loop istället för en join | `api/src/routes/tours.js` rad 7–22 | För var och en av upp till 50 turer görs fyra separata `await`-queries (user, guide, photos, logs) i tur och ordning. Borde vara en join eller batchad Drizzle-query. Växer linjärt med antalet turer och blockerar sidladdningen. | Medel |
| 9 | `tour_logs` saknar index på `tour_id` trots att den växer snabbast | `api/src/db/schema.js` rad 40–49 (~300 rader per tur enligt kommentaren på rad 39) | Varje uppslag av loggar för en tur (t.ex. `TourDetail`) blir en full tabellskanning när datan väl växer till sig. | Medel |
| 10 | Inga foreign keys mellan tabellerna | `api/src/db/schema.js` rad 31–32 (`tours.userId`, `tours.guideId`), rad 42 (`tourLogs.tourId`), rad 53 (`photos.tourId`) | Fälten är vanliga `integer()`, inte `.references()`. Databasen stoppar inte orphanade rader, t.ex. `tour_logs` som blir kvar efter att en tur raderats (se punkt 6). | Medel |
| 11 | Drizzle är beroende men används inte som klient | `api/src/db/client.js` rad 9 exporterar `db`, men samtliga routes (`auth.js`, `guides.js`, `tours.js`, `photos.js`) importerar `pool` och kör rå SQL | Ingen typkontroll eller query builder trots att paketet redan är installerat och konfigurerat. Två sätt att prata med databasen underhålls i praktiken inte alls. | Medel |
| 12 | Tabeller skapas med rå SQL istället för Drizzle-migrationer | `api/src/db/migrate.js` (hela filen) vs. `api/src/db/schema.js` | Schema och faktisk tabelldefinition är två separata källor som måste hållas i synk för hand. En ändring i den ena utan den andra ger tyst drift mellan kod och databas. | Medel |
| 13 | Ingen felhantering i något API-anrop | Genomgående i `api/src/routes/*.js`; sväljs sedan av `api/src/index.js` rad 27–29 (`process.on('unhandledRejection', ...)` loggar bara) | Ett fel i en query (trasigt id, DB nere, constraint-brott) kastar inuti en async-handler, blir en unhandled rejection, och klienten får aldrig något svar alls — inte ens ett felmeddelande. | Medel |
| 14 | Ingen validering av request body på någon skrivande endpoint | `api/src/routes/auth.js` rad 8, `api/src/routes/guides.js` rad 36, `api/src/routes/tours.js` rad 38, `api/src/routes/photos.js` rad 39 | Saknade eller felformade fält går rakt igenom till SQL/JWT och ger förvirrande 500-fel istället för tydliga 400-svar. | Medel |
| 15 | Bildskalning körs synkront i request-handlern | `api/src/routes/photos.js` rad 10–27 (pixel-loop) och rad 46–49 (körs per upload) | CPU-tung loop blockerar Node:s enda event loop-tråd för varje uppladdning. Dessutom skalas ingen riktig bild — rad 41–43 genererar platshållarpixlar, så funktionen gör jobbet utan att lösa uppgiften. | Medel |
| 16 | Body-gränsen satt till 50 mb för ett rent JSON-API | `api/src/index.js` rad 12 (`express.json({ limit: '50mb' })`) | Ingen endpoint tar emot filuppladdningar än (se punkt 15). Onödigt stor gräns ökar ytan för minnesuttömmande requests utan att motsvara ett faktiskt behov. | Medel |
| 17 | Tre olika sätt att hämta data i frontend | Direkt `fetch` med hårdkodad URL: `web/src/pages/Guides.jsx` rad 9 och 15, `web/src/pages/GuideDetail.jsx` rad 9, `web/src/pages/TourDetail.jsx` rad 9, `web/src/pages/Profile.jsx` rad 9. Via helper: `web/src/pages/Home.jsx` och `web/src/pages/Tours.jsx` använder `get()`/`post()` från `web/src/api.js` | `API_URL` (`web/src/api.js` rad 1) går inte att ändra på ett ställe eftersom hälften av sidorna hårdkodar `http://localhost:4000` själva. De hårdkodade anropen missar dessutom all framtida delad felhantering i `api.js`. | Medel |
| 18 | Auth-token sparas i `localStorage` | `web/src/pages/Login.jsx` rad 18–19 (sätts), `web/src/App.jsx` rad 11 och `web/src/pages/Profile.jsx` rad 6 (läses) | Läsbart för vilken injicerad skript-kod som helst — ingen httpOnly-cookie. I kombination med XSS-risken i punkt 7 blir detta en väg till fullt sessionskapande. | Medel |
| 19 | `requireUser` appliceras inkonsekvent, utan tydlig regel | `api/src/lib/auth.js` rad 7 (kommentar: "Används på vissa routes. Inte alla än.") | Bekräftas av punkt 6 — vilka routes som skyddas avgörs ad hoc per endpoint istället för en genomtänkt policy. | Medel |
| 20 | `Profile`-sidan hämtar alla turer och filtrerar fram användarens egna i klienten | `web/src/pages/Profile.jsx` rad 9–11 | All data för alla användares turer skickas till klienten oavsett vem som är inloggad, och filtreringen sker i frontend. Både ett prestanda- och ett dataexponeringsproblem ovanpå punkt 1. | Medel |
| 21 | Två separata knapp-komponenter för samma sak | `web/src/components/Button.jsx` (funktionell, inline style) och `web/src/components/PrimaryButton.jsx` (klass-komponent, `btn-primary`-CSS) | Inget gemensamt mönster för knappar. `PrimaryButton` är dessutom en klass-komponent utan anledning i en i övrigt funktionell kodbas. | Låg |
| 22 | `express` är en major-version efter | `api/package.json` rad 14 (`"express": "^4.21.2"`, senaste är 5.x) | Ingen akut sårbarhet känd, men uppgraderingen blir bara dyrare ju längre den skjuts upp. | Låg |
| 23 | Upprepade magiska värden i CSS istället för delade tokens | `web/src/style.css`, t.ex. `box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08)` upprepat på rad 21, 30, 34, 45, 50 | Kosmetiskt, men varje visuell justering (t.ex. skuggans styrka) kräver sök-och-ersätt över hela filen istället för att ändras på ett ställe. | Låg |
| 24 | Hela kodbasen är JavaScript, ingen TypeScript | Genomgående i `api/` och `web/` | Ingen kompileringstidskontroll av formen på objekt som skickas mellan lager (t.ex. `user`, `guide`, `tour`), vilket gör punkter som 1, 5 och 20 lättare att missa i granskning. | Låg |
| 25 | Turloggarna finns i två databaser (tillkom i M5) | `tour_logs` i Postgres (läses av `api/src/routes/tours.js`) och collectionen `tours` i MongoDB (läses av GraphQL, `api/src/graphql/loaders.js`), synkade av `npm run migrate:logs` | Postgres är källan och Mongo en spegel. Skrivs mätpunkter till Postgres syns de inte i GraphQL förrän skriptet körts igen. Tabellen kan tas bort först när REST-routerna för turer läser Mongo (punkt 4–5 i `docs/decisions/databas.md`). | Medel |

## Mest brådskande

Punkt 1 (lösenordshashar läcker okrypterat till vem som helst via
`/api/tours`) väger tyngst: den kräver ingen autentisering, drabbar
samtliga användare på en gång, och kombinerat med punkt 2 (klartextlösenord)
innebär den att en enda oskyddad endpoint räcker för att kompromettera
alla konton i systemet.
