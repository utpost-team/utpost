# Beslutsdokument: databasval

*Ett av teamets sex beslutsdokument. Skrivs i M3, hålls levande. Samma mall som `docs/testing.md`. Fyll i varje rubrik – en sida räcker, men varje påstående ska gå att försvara muntligt på onsdag.*

**Datum:** 2026-10-13
**Beslut:** Turer flyttar till MongoDB som ett dokument per tur, med mätpunkterna (`tour_logs`) och fotona inbäddade och summeringarna förberäknade. Användare och guider stannar i Postgres. Gränsen: det som bara tillhör en tur ligger i turdokumentet, och det som delas av många turer stannar i Postgres. Mongo refererar till Postgres (`user_id`, `guide_id`), men Postgres refererar aldrig till Mongo.

## Bakgrund
Vi ärvde en app där allt ligger i Postgres. Mätpunkterna är en rad per punkt i `tour_logs`, utan index på `tour_id` (debt #9) och utan främmande nycklar (debt #10). Beslutet är första halvan av kursens skuld 4 (*allt ligger i Postgres*). Migreringen görs i M5.

Uppmätt 2026-10-08 med `scripts/measure-tours.sh` på seeddatan (logg: `docs/decisions/matningar/tours-20261008-121340.log`):

| Mått | Värde |
|---|---|
| Rader i `tours` / `tour_logs` / `photos` | 200 / 6 053 / 266 |
| Punkter per tur | min 20 · snitt 30,3 · max 39 (tur 17) |
| `GET /api/tours`: storlek | 286 kB för 50 turer, varav 84 % är `logs` (45 kB utan) |
| `GET /api/tours`: databasfrågor | 186 (1 + 3 × 50 + 35 guider), seriellt (debt #8) |
| Största turen som Mongo-dokument | 3,4 kB (`mongo:smoke 17`) |

Det är listan som är problemet: den skickar 1 523 mätpunkter som `ToursView` aldrig visar, och den ställer en fråga per tur och relation. `tour_logs` är den tabell som växer snabbast. Med riktiga inspelningar (en punkt per sekund) blir det tusentals rader per tur i stället för ~30.

## Dokumentmodellen för turer

En tur blir ett dokument i collectionen `tours`. Mätpunkterna och fotona bäddas in i turen. Användare och guider refereras och stannar i Postgres.

```json
{
  "_id": "ObjectId(...)",
  "tour_id": 1,
  "user_id": 4,
  "guide_id": 12,
  "title": "Kebnekaise västra leden",
  "started_at": "2026-08-14T06:30:00Z",
  "distance_m": 18400,
  "notes": "Dimma efter fjällstationen",
  "stats": {
    "points": 300,
    "duration_s": 25200,
    "elevation_gain_m": 1840,
    "max_hr": 172,
    "avg_hr": 128,
    "photo_count": 2
  },
  "logs": [
    { "t": "2026-08-14T06:30:00Z", "lat": 67.85, "lon": 18.60, "elevation_m": 690, "heart_rate": 96, "note": null }
  ],
  "photos": [
    { "filename": "toppen.jpg", "width": 4032, "height": 3024, "created_at": "2026-08-14T13:02:00Z" }
  ]
}
```

**Inbäddat: `logs`.** Mätpunkterna läses alltid tillsammans med sin tur, tillhör bara den turen och ändras aldrig efter att de spelats in. Det är fallet dokumentmodellen är gjord för: allt som läses ihop ligger ihop, och en tur blir en läsning i stället för en fråga mot `tours` plus en mot `tour_logs`.

**Inbäddat: `photos`.** Fotona har samma form som loggarna. De finns bara som en del av en tur, läses bara med den (`/photos/tour/:tourId` och antalet i listan) och är få (0–3 per tur). Det som bäddas in är bara metadata, själva filerna ligger i `uploads/`. Låg fotona kvar i Postgres skulle `photos.tour_id` peka på ett dokument i en annan databas, och den referensen kan ingenting kontrollera. Inbäddningen rättar också en bugg: i dag tar `DELETE /tours/:id` bort loggarna och turen men lämnar fotona kvar som föräldralösa rader.

**Refererat: `user_id`, `guide_id`.** Användare och guider delas av många turer och ändras oberoende av dem. Kopierar vi in namnet i varje tur måste vi uppdatera alla turer när någon byter namn.

**Förberäknat: `stats`.** Loggarna skrivs en gång och läses många gånger, så summeringarna räknas ut när turen sparas, inte vid varje läsning. `elevation_gain_m` räknas i dag i klienten (`client/src/lib/elevation.ts`) och flyttar till skrivningen. Eftersom loggarna aldrig ändras kan `stats` inte bli inaktuell. `photo_count` ändras när foton läggs till eller tas bort. Det sker med `$push`/`$pull` på `photos` och `$inc` på `stats.photo_count` i samma `updateOne`, som är atomisk inom ett dokument. Förberäkningen är det som gör att listan kan utesluta `logs` och ändå visa summeringarna.

**`tour_id`** är Postgres-id:t. Det följer med tills migreringen är verifierad (M5), så att vi kan jämföra tur för tur. Därefter tas det bort.

**Storlek och gräns.** Den största turen har i dag *39* mätpunkter (seeden: 20–39 per tur, en var 5:e minut), vilket blir *3,4 kB* per dokument (mätt med `mongo:smoke`), ungefär 0,09 kB per punkt. Gränsen 16 MB motsvarar då ungefär *188 000* punkter, alltså en tur med en punkt per sekund i *52* timmar. Foton påverkar knappt storleken (ett par hundra byte styck). Vi är långt från gränsen. Om den någon gång närmar sig delar vi loggarna i bitar (bucket-mönstret, t.ex. ett dokument per timme i en egen collection), men det bygger vi inte nu.

**Listan hämtar inte loggarna.** `GET /api/tours` frågar med en projektion som bara tar med de fält listvyn visar: `{ title: 1, user_id: 1, guide_id: 1, distance_m: 1, started_at: 1, stats: 1 }`. Vi listar fälten i stället för att skriva `{ logs: 0 }`, av samma skäl som man skriver kolumnnamn i stället för `select *`: ett stort fält som läggs till senare ska inte följa med av sig självt. Projektionen körs i Mongo, så loggarna lämnar aldrig databasen. Det här betalar av skulden: i dag skickar listan alla mätpunkter för 50 turer (84 % av ett svar på 286 kB) och ställer 186 frågor (1 + 3 per tur + 1 per tur med guide).

**Index**, utifrån de frågor klienten ställer:

| Index | Fråga |
|---|---|
| `{ tour_id: 1 }` unikt | Uppslag och verifiering under migreringen |
| `{ started_at: -1 }` | `/api/tours` och `/api/tours/latest` – senaste först |
| `{ user_id: 1, started_at: -1 }` | En användares turer, senaste först |

`/api/tours/:id` använder `_id`, som alltid har ett index.

**Öppen fråga till teamet**
1. **Användare och guide i listan.** `ToursView` visar `user.display_name` och `guide.title`. Förslag: hämta dem ur Postgres i *en* fråga per tabell (`where id = any($1)`) för alla turer i listan, så att det blir 1 Mongo-fråga och 2 Postgres-frågor i stället för 186. Alternativet är att kopiera in namnen i dokumentet. Det ger färre frågor, men namnen blir inaktuella när någon byter namn. Skiss: `docs/databas/projektion.md`.

*(Tidigare öppen fråga om `stats.photo_count` är löst: när fotona bäddas in i turen uppdateras antalet i samma atomiska `updateOne`, och inget problem mellan två databaser finns kvar.)*

## Vad som stannar i Postgres
Regeln ovan avgör tabell för tabell:

| Tabell | Var | Varför |
|---|---|---|
| `users` | **Postgres** | Inloggningen slår upp på e-post, som måste vara unik. Datan är säkerhetskritisk och refereras från både guider (`author_id`) och turer. Delad, konsekvent data är det en relationsdatabas är gjord för. |
| `guides` | **Postgres** | `/search` filtrerar på två kolumner, `/regions` använder `distinct`, `/:slug` slår upp på slug och `/popular` filtrerar på `published`. Det är vanlig SQL. 40 rader och inget uppmätt problem, så det finns inget att vinna på att flytta. |
| `tours` | Mongo | Se dokumentmodellen. |
| `tour_logs` | Mongo, inbäddat | Tabellen tas bort efter verifieringen i M5. |
| `photos` | Mongo, inbäddat | Tabellen tas bort efter verifieringen i M5. |

**Svagheter i det här argumentet:** Schemat har i dag inga främmande nycklar och ingen `unique` på `users.email` eller `guides.slug` (debt #10), och appen använder inga transaktioner. "Relationer och transaktioner" är alltså ett argument för det vi *ska* ha, inte för det vi har. Constraints läggs till i M5. Sökningen i `/search` är öppen för SQL-injektion (debt #3). Den skulden finns oavsett databasval och rättas separat.

## Så här ska migreringen gå till (genomförs i M5)
1. **Gemensam beräkning.** Flytta `elevationGain` från `client/src/lib/elevation.ts` till `shared/` så att API:et och migreringen räknar `stats` på samma sätt som klienten gör i dag.
2. **Skript `api/src/db/migrate-tours.js`** (`npm run mongo:migrate`), byggt vidare på `mongo-smoke.js`:
   - Skapa de tre indexen (`createIndex` gör inget om de redan finns).
   - För varje tur i `tours`, i id-ordning: läs turen, dess loggar (`order by recorded_at`) och foton. Bygg dokumentet enligt modellen och räkna ut `stats`.
   - Skriv med `replaceOne({ tour_id }, doc, { upsert: true })`. Då kan skriptet köras om utan att det blir dubbletter, t.ex. om det avbryts halvvägs.
   - Skriv till slut ut antal turer, punkter och foton som skrivits.
3. **Verifiering**, i samma skript med `--verify` (en körning som bara läser):
   - Antal: `count(*) from tours` = `countDocuments()`. Summan av `stats.points` = `count(*) from tour_logs` (6 053 i dag). Summan av `stats.photo_count` = `count(*) from photos`.
   - Per tur: `stats.points` = `logs.length`, och `stats` räknas om från `logs` och jämförs med det sparade värdet.
   - Stickprov: 10 slumpade `tour_id` plus största och minsta turen. Jämför fält för fält (första och sista punkten, titel, foton) mellan Postgres och Mongo.
   - Skriptet avslutar med felkod om något skiljer sig, så att det går att köra i pipelinen.
4. **Byt källa i API:et.** `routes/tours.js` och `routes/photos.js` läser och skriver mot `toursCollection()`. Listan använder projektionen och svaret på den öppna frågan. `POST /tours` räknar `stats` vid skrivning. `/api/tours/:id` slår upp `_id` (klienten får det nya id:t). Svarsformen hålls oförändrad mot `@utpost/shared`, så typkontrollen i CI fångar om något fältnamn glider. Allt sker i en PR, så att bytet går att backa genom att reverta den.
5. **Efteråt.** `tours`, `tour_logs` och `photos` ligger kvar i Postgres men skrivs inte längre, tills ändringen har gått en vecka på `main` utan fel. Därefter tas de bort med en migrering (`drop table tour_logs, photos, tours`). `tour_id` tas bort ur dokumenten med `updateMany({}, { $unset: { tour_id: "" } })`, och indexet `{ tour_id: 1 }` tas bort.

## Alternativ vi jämförde
**A. Behålla allt i Postgres och anpassa queryn.** En join för användare och guide, `count(*)` för foton, inga loggar i listan, och index på `tour_logs.tour_id`. *För:* en databas, inga nya beroenden, och det löser det mesta av de 186 frågorna och 286 kB. Det är det ärligaste motargumentet. *Emot:* `tour_logs` blir kvar som den tabell som växer snabbast, en rad per punkt, och att läsa en tur kräver fortfarande en join över tusentals rader. Uppgiften är dessutom att få MongoDB på plats för turerna, och vi vill lära oss när en dokumentmodell passar.

**B. Postgres med en `jsonb`-kolumn för loggarna.** `tours.logs jsonb` i stället för tabellen `tour_logs`. *För:* samma dokumentform per tur, en databas, och transaktioner tillsammans med användare och foton. *Emot:* Postgres skriver om hela värdet vid varje uppdatering, värden över ~2 kB lagras separat (TOAST), och frågor in i arrayen blir svårlästa jämfört med Mongos projektion och `$slice`. Det är rimligt, men vi skulle bygga en dokumentdatabas inne i en relationsdatabas.

**C. Allt till MongoDB.** *För:* en databas, inga referenser mellan två system. *Emot:* användare och guider är delad, relationell data. E-post och slug ska vara unika, guiderna söks och filtreras med SQL, och vår Mongo kör fristående (inte som replica set) och klarar därför inte transaktioner över flera dokument. Vi skulle flytta det som fungerar för att det ska se enhetligt ut.

**Valt: MongoDB för turerna, Postgres för resten**, eftersom det är den enda varianten där varje sorts data ligger där frågorna mot den är enklast.

## Konsekvenser
- **Två databaser att drifta och backa upp.** `pg_dump` och `mongodump` var för sig, och de är inte konsistenta med varandra: en tur kan referera till en användare som skapats efter Postgres-backupen. Vi accepterar det eftersom referensen bara går åt ett håll.
- **Två anslutningssträngar** i miljön: `DATABASE_URL` och `MONGO_URL`. `config.js` läser båda med localhost som standardvärde. Mongo-adressen kräver `?authSource=admin`.
- **Compose** har fyra tjänster med healthcheck på båda databaserna, och `api` väntar på båda (`condition: service_healthy`). Inne i nätverket heter databaserna `postgres:5432` och `mongo:27017`. På värden publiceras Postgres på 5433 så att den inte krockar med en lokal Postgres. Vi kör `mongo:8.2` i stället för `mongo:8`, eftersom `mongo:8` inte startar på nyare Linux-kärnor.
- **`/api/health`** rapporterar båda databaserna. API:et kan svara men vara trasigt för turer om bara Mongo är nere.
- **Pipelinen** behöver inga databaser i dag (testerna mockar API:et). I M5 behöver verifieringsskriptet och eventuella integrationstester båda som service-containrar i Actions.
- **Ingen transaktion över databaserna.** Tas en användare bort i Postgres blir hens turer kvar i Mongo. Det kräver ett städsteg i koden, eftersom ingen främmande nyckel kan göra det.
- **Molnet i M6:** två hanterade databaser (t.ex. Postgres hos molnleverantören och MongoDB Atlas), eller två containrar med beständiga volymer. Två hemligheter att rotera. Lösenorden som i dag står i `config.js` och `compose.yml` (kursens skuld 7) flyttas till molnets hemlighetshantering.

## Läget efter M5: loggarna är flyttade, resten av planen väntar

M5 genomför den första delen av migreringen ovan, avgränsad till mätpunkterna:

- **Gjort:** `npm run migrate:logs` (`api/src/db/migrate-logs.js`) skriver ett dokument per tur i `tours` med `logs` inbäddat och `stats.points`, med `replaceOne` + upsert på `tour_id` (unikt index). Skriptet verifierar själv genom att räkna (dokument mot turer, summan av mätpunkterna mot `tour_logs`) och avslutar med felkod om något inte stämmer. Dokument vars tur inte längre finns i Postgres tas bort, så att skriptet tål en ny seed.
- **GraphQL läser Mongo:** `Tour.logs` går via en DataLoader mot `tours` i MongoDB. Allt annat i GraphQL läser fortfarande Postgres.
- **`tour_logs` ligger kvar i Postgres och är källan.** MongoDB är en spegel som skrivs av `npm run migrate:logs`. REST-routerna (`/api/tours`, `/api/tours/:id`) och den gamla klienten i `web/` läser fortfarande tabellen, och migreringen behöver den som källa och för att verifiera. Läggs mätpunkter till i Postgres syns de i GraphQL först när skriptet körts igen – det går bra så länge inget skriver mätpunkter (ingen route gör det i dag).
- **M6: `tour_logs` behålls.** Klienten som läste den via REST (`web/`) är borttagen, men tabellen är fortfarande källan för `npm run migrate:logs` (som körs vid varje seed, även i `boot.js`) och det Integration verifierar mot. Den tas bort tillsammans med REST-routerna för turer, enligt punkten nedan.
- **Inte gjort än, ur planen ovan:** fotona inbäddade, resten av `stats` (punkt 1), REST-routerna mot Mongo (punkt 4), indexen på `started_at` och `user_id`, och att ta bort tabellerna (punkt 5). `tour_logs` tas bort först när REST-routerna för turer läser Mongo. Det förs upp i `docs/debt.md`.

**Skrivet av:** Joakim och Andreas. Avsnittet om M5: Mirko. 
