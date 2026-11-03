# Utpost

Plattform för friluftsdestinationer. Redaktionella guider, användarnas egna turer och bilder.

## Branchstrategi

GitHub Flow: `main` är alltid deploybar, feature-branches hålls korta och går
via PR innan de mergas tillbaka. `main` har en aktiv branch-ruleset som
blockerar direktpush, så PR är redan ett tekniskt krav och kräver minst 1
review. Codeowner fil är på plats i `.github/CODEOWNERS`. Just nu kan alla
medlemmar godkänna alla PRs men filen kommer att fyllas på under projektets
gång.

Vi väljer GitHub Flow för enkelhetens skull just nu. Git Flows extra grenar
(develop/release) löser problem vi inte har. Vi är ett litet team som kommer att
committa och deploya ofta och Git Flow är väl lämplig för det. Vi avser dock utforska feature flags och röra oss mot trunk-based som ett lärande inom projektet.

## Working agreement

- **Pushfrekvens**: Minst en gång per arbetsdag / vid slutet av varje arbetspass.
- **Godkänna en PR**: 1 godkännande från en annan utvecklare krävs. När CI-pipelinen landar (väntas nästa vecka) läggs krav på grön pipeline till.
- **Hur vi når varandra**: Discord.
- **När någon fastnar**: Timeboxa ~30 min egen diagnos. Fortfarande fast → sammanställ nuläget till en tydlig kontext + fråga, posta i Discord och tagga @alla.

*Det här avsnittet kommer att uppdateras under projektets gång.*

---

## Kom igång

Det finns två sätt. Båda kräver Docker.

### A. Allt i Docker

Kräver bara Docker, inte Node.

```bash
docker compose up --build -d
docker compose exec api npm run seed
docker compose exec api npm run migrate:logs
```

Har du Node installerat gör `npm start` samma sak som första raden och `npm stop`
samma sak som `docker compose down` (med podman om Docker saknas).

Compose startar fyra tjänster i bakgrunden: `postgres`, `mongo`, `api` och `client`.
Vue-klienten (nginx) ligger på http://localhost:3001. API:et har ingen egen publicerad port utan nås
via nginx-proxyn i klienten: http://localhost:3001/api/health och GraphiQL på http://localhost:3001/graphql.
Seeden och migreringen behövs bara första gången, eftersom datan ligger kvar i volymerna. Följ
loggarna med `docker compose logs -f`. Stoppa med `docker compose down` (lägg till
`-v` för att tömma databaserna).

### Docker-images och storlek (M4)

Klienten byggs med multi-stage build (`client/Dockerfile`) där steg 1 bygger med Node och steg 2 serverar `dist/` via `nginx:1.27-alpine`:

| Image | Bas / Metod | DISK USAGE | CONTENT SIZE |
| --- | --- | --- | --- |
| `client` (före M4) | `node:22-alpine` + Vite preview + node_modules | ~369 MB (539 MB) | ~131 MB |
| `client` (efter M4) | `nginx:1.27-alpine` multi-stage | **~74 MB** | **21 MB** |

Client-imagen minskade med ~80 % och ligger väl under gränsen på 100 MB.

### B. Databaserna i Docker, appen på din dator

Kräver **Node 22.18 eller senare**. API:et är delvis skrivet i TypeScript och körs
direkt av Node, som tar bort typerna själv (inget byggsteg). CI kör Node 24.

```bash
npm install
npm run db:up      # docker compose up -d postgres mongo
npm run seed
npm run migrate:logs # turloggarna till MongoDB (M5), kör igen efter varje seed
npm run dev
```

`npm run dev` startar databaserna (om de inte redan kör) och sen API:et och
Vue-klienten samtidigt med omladdning vid ändringar. Klienten ligger sen på
http://localhost:3001 och API:et på http://localhost:4000. Var för sig:
`npm run dev:api` och `npm run dev:client`. Stoppa databaserna
med `npm run db:down`.

API:et når databaserna på `localhost:5433` och `localhost:27017`, som är de portar
compose publicerar på värden. Inne i compose (A) heter de i stället `postgres:5432`
och `mongo:27017`.

## Kommandon

Körs från roten. Alla fem körs även i CI (se [`docs/pipeline.md`](docs/pipeline.md)).

| Kommando | Gör |
| --- | --- |
| `npm run lint` | ESLint på `client/` |
| `npm run format:check` | Prettier kollar formateringen i `client/src/` (ändrar inget) |
| `npm run typecheck` | Codegen skriver `client/src/gql/` ur schemat, sen typkontroll: `vue-tsc` i `client/` och `tsc --noEmit` i `api/` |
| `npm test` | Vitest kör testerna i `client/` en gång och avslutar |
| `npm run build` | Vite bygger `client/` till `client/dist` |

Formatera koden lokalt med `npm run format --workspace=client`.

## Struktur

- `api/` – Express + Postgres (Drizzle) + MongoDB (driver). REST under `/api` och GraphQL (graphql-yoga) på `/graphql`, med GraphiQL i webbläsaren på `GET /graphql` i utveckling (`api/src/graphql/`)
- `client/` – Vue 3 + Vue Router + Pinia + Vite (port 3001). Multi-stage build med Nginx serverar statiska filer och proxar `/api` och `/graphql` till `api:4000`.
- `shared/` – `@utpost/shared`, API-kontraktet: typerna för det som går mellan `api/` och `client/`. Ren TypeScript, inget bygge. Ändras ett API-svar ändras typen här i samma PR.

## Mätning före/efter (M5)

### N+1 i GraphQL

Den tyngsta frågan är turlistan med exakt de fält som turlistan i klienten visar (`ToursView`):

```graphql
query Turer {
  tours {
    id
    title
    distanceM
    startedAt
    user { displayName }
    guide { title slug }
    photos { id }
  }
}
```

Mätt före DataLoader, med API:et startat från `main` mot seedad Postgres och frågan skickad med namn.
Siffran kommer ur API-loggen (`graphql Turer: 135 databasfrågor`).

| Fråga   | Databasfrågor före | Efter |
| ------- | ------------------ | ----- |
| `Turer` | 135                | 4     |

135 = 1 (turerna) + 50 (`user`, en per tur) + 34 (`guide`, en per tur som har en guide) + 50 (`photos`, en per tur).
Seeden slumpar om en tur har en guide (ca 75 %), så före-siffran varierar lite mellan databaser – formeln är densamma.

4 = 1 (turerna) + 1 per relation (`user`, `guide`, `photos`), med DataLoader i `api/src/graphql/loaders.js`.
Efter-siffran står i svaret under `extensions.databasfragor` (GraphiQL, nätverksfliken) och i API-loggen
(`graphql Turer: 4 databasfrågor`). Den är densamma oavsett hur många turer som har en guide.

### Integrationstesterna mot API:et

`npm run test:api` kör 6 tester i `api/src/graphql/server.test.js` mot riktiga Postgres och MongoDB
(antal och tid i [`docs/testing.md`](docs/testing.md)). Regressionstestet för N+1 heter
**`Turer kostar en databasfråga per relation, inte per tur`** och kräver exakt `databasfragor === 4`.
Med loadern för `Tour.user` bortkopplad (en fråga per tur igen) blev det rött:

```
AssertionError: expected 53 to be 4
```

53 = 1 (turerna) + 50 (`user`, en per tur) + 1 (`guide`) + 1 (`photos`).

### Migreringen av turloggarna

`npm run migrate:logs` skriver ett dokument per tur i MongoDB med mätpunkterna inbäddade i `logs`,
och räknar efteråt. `Tour.logs` i GraphQL läser sedan Mongo via loadern. Mongo-anropet räknas i
`extensions.databasfragor` precis som en Postgres-fråga (`tours { id logs { recordedAt } }` kostar 2).

Första körningen:

```
Postgres: 200 turer, 5909 mätpunkter i tour_logs
MongoDB:  200 skapade, 0 ersatta, 0 borttagna föräldralösa
Kontroll: dokument 200/200, mätpunkter 5909/5909, stats.points 5909/5909
Verifierat
```

Andra körningen – inget nytt skapas:

```
Postgres: 200 turer, 5909 mätpunkter i tour_logs
MongoDB:  0 skapade, 200 ersatta, 0 borttagna föräldralösa
Kontroll: dokument 200/200, mätpunkter 5909/5909, stats.points 5909/5909
Verifierat
```

### urql och dokumentcachen

Nätverksfliken, med Vue-klienten mot API:et lokalt: första besöket på startsidan ger 1 `POST /graphql`
(`Home`) och första besöket på Turer ger 1 (`Turer`). Går man sedan till startsidan och tillbaka till
Turer blir det **0** nya `POST /graphql` – båda svaren kommer ur urqls `cacheExchange`. API-loggen
visade samma sak: en rad per fråga och sidladdning, ingen när man klickade fram och tillbaka.
En omladdning av sidan tömmer cachen.

### Codegen stoppar ett borttaget fält

Provat på en branch som slängdes efteråt. `displayName` togs bort ur `type User` i
`api/src/graphql/schema.js`, och `npm run typecheck` (som kör codegen först) stannade med:

```
Error 0: Cannot query field "displayName" on type "User".
  at client/src/views/ToursView.vue:9:9
```

Andra brottet i kedjan: `distanceM` togs bort ur frågan `Turer` men inte ur mallen. Då stannar `vue-tsc`:

```
src/views/ToursView.vue(55,34): error TS2339: Property 'distanceM' does not exist on type '{ id: string; title: string; startedAt: string; ... }'.
```

Testdatan i `ToursView.test.ts` är typad efter den genererade `TurerQuery`, så samma ändring gav också
ett fel i testet (`TS2353 … 'distanceM' does not exist`).

### Vyerna via useQuery

| Vy | Fråga | Test |
| --- | --- | --- |
| `HomeView` (startsidan) | `Home` | `HomeView.test.ts`, 2 tester |
| `ToursView` (turlistan) | `Turer` – samma fråga som mäts ovan | `ToursView.test.ts`, 4 tester |

Båda mockar `useQuery` från `@urql/vue`. `npm test`:

```
 Test Files  8 passed (8)
      Tests  19 passed (19)
```

## Deploy

Fråga Marcus. TODO: update
