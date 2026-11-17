# Beslutsdokument: serverless

*Ett av teamets beslutsdokument. Skrivs i M7, hålls levande. Samma mall som `hosting.md`, `api-stil.md` och `databas.md`. Det här dokumentet examinerar Cloud 2 (redogöra för Serverless Framework) och är underlaget för kunskapsloggens post Cloud 2.*

**Datum:** 2026-11-17
**Beslut:** Bildbearbetningen (omskalning till fyra varianter) flyttades ut ur API:et till HTTP-funktionen `process-image` i Azure Functions (Flex Consumption, Node 22, appen `utpost-team-fn`). Appen skapades en gång med `infra/azure/skapa-funktion.sh` (az CLI + Core Tools), och jobbet *Deploy → Azure Functions* i `ci.yml` lägger upp ny kod vid varje push till `main`.

## Bakgrund

Skuld 8, "timeouts vid last": före M7 gjorde `POST /api/photos` hela bildarbetet själv, alltså sparade raden, skalade om bilden till fyra storlekar och räknade fram en signatur, och det i samma Node-tråd som svarar på alla andra anrop. Node har en tråd för vår JavaScript. Den kan vänta på databasen och nätet och svara andra under tiden, men medan den *räknar* gör den inget annat. Tio samtidiga uppladdningar fick därför `/api/health`, som nästan inget gör, att vänta i kö bakom bildarbetet: **health max 983 ms** (≈ 1 s) under last.

## Alternativ vi jämförde

| Alternativ | Vad ändras i repot | Kostnad | För | Emot |
|---|---|---|---|---|
| **Azure Functions med Core Tools + `az`** (valt) | `functions/`, `skapa-funktion.sh`, ett jobb i `ci.yml`. API:et anropar med `fetch` | Ryms i Flex Consumptions gratiskvot (100 000 GB-s + 250 000 körningar/mån) | Samma prenumeration, resursgrupp och OIDC-identitet som staging från M6. Skalar ut per anrop och till noll | Azure-specifik trigger, deploy och nyckelhantering. Kallstart |
| **Serverless Framework** | `serverless.yml` i stället för skriptet och deploysteget | Ramverket är gratis för små team (v4 kräver licens för företag över 2 MUSD i omsättning) + molnets pris | Ett deklarativt format för hela tjänsten och ett kommando för deploy | **Stöder inte Azure i v4** (se nedan) |
| **Kö + worker i API-containern** (`worker_threads` eller en egen process) | En kö (t.ex. Postgres-tabell eller Azure Storage Queue) och en worker. Klienten pollar på resultatet | 0 kr extra, men containern behöver mer CPU | Ingen ny plattform, ingen kallstart | Ingen elastisk skalning: alla bilder delar staging-containerns CPU. Mer egen kod |

**Vad Serverless Framework är:** ett CLI-verktyg (`npm i -g serverless`) där hela tjänsten beskrivs i en fil, `serverless.yml`: `service` (namnet), `provider` (moln, runtime, region), `functions` (varje funktion och dess handler) och `events` under varje funktion (det som triggar den, t.ex. `httpApi: POST /process-image`). `sls deploy` paketerar koden och skapar molnresurserna (på AWS via CloudFormation). Det var verktyget som gav området sitt namn.

**Varför det inte går här:** Serverless Framework v4 stöder bara AWS Lambda. Stödet för Azure fanns som ett plugin, `serverless-azure-functions`, till v3. Pluginet är arkiverat och v3 får inga uppdateringar längre. Kursens moln är Azure, så ramverket kan inte deploya till vår prenumeration. Att lägga det som "valt" vore fel.

**När det hade passat:** om Utpost hade kört på AWS, med flera Lambda-funktioner och triggers (HTTP, S3-uppladdningar, köer) som teamet vill beskriva i en fil och deploya med ett kommando.

## Motivering

Azure Functions räcker för Utpost: vi har en funktion med en HTTP-trigger och några få bilder i minuten, och staging, identiteten och pipelinen finns redan i samma Azure-prenumeration. Mätningen visar att flytten löser skulden, och gratiskvoten gör att det kostar 0 kr. Vi hade bytt om (1) kallstarten blir ett problem för användarna och always-ready kostar mer än en worker i containern, (2) teamet flyttar till AWS, då är Lambda med Serverless Framework eller SAM det naturliga, eller (3) bilderna blir så många att en kö med batchbearbetning blir billigare än en körning per bild.

## Mätning före/efter

`node scripts/mat-upload.mjs`, lokalt, N = 10 samtidiga uppladdningar à 4000x3000 (tillräckligt många för att tråden ska vara upptagen hela mätningen). Rådata: `docs/decisions/matningar/serverless.md`.

**health max: ≈ 1 s före (983 ms), ≈ 10 ms efter (8 ms).**

Det som blev snabbare är *allt annat*: API:et väntar bara på `fetch` (I/O) och svarar andra under tiden. Själva uppladdningen blev **inte** snabbare (≈ 1,1 s → ≈ 1,0 s). Bilden tar lika lång tid att skala om var den än skalas om, och lokalt kör `func start` de tio anropen efter varandra i en process. I Azure skalar plattformen ut till en instans per samtidigt anrop.

## Kallstart

Mätt 2026-11-17 med `curl -w '%{time_total}'` direkt mot funktionen i Azure. Det senaste anropet före det var röktestet i deployjobbet 12/11, alltså efter **≈ 5 dygns paus** och inte direkt efter en deploy.

**Första anropet efter 5 dygn: ungefär 1,4 s** (`coldStart: true`, `processingMs` 89). **Varmt anrop: ungefär 0,2 s.**

Själva bildarbetet tar under 0,1 s. Resten av kallstarten är att plattformen startar en instans, hämtar paketet och startar Node. Eftersom `skapa-funktion.sh` sätter ett samtidigt anrop per instans startade Flex också nya instanser för de flesta anropen direkt efteråt (≈ 1,3 s, `coldStart: true`, nytt `instance`). Bara ett av nio landade på en varm instans.

**Duger det?** Ja, för Utpost. En människa som laddar upp en bild väntar redan på överföringen, och 1–1,5 s med en tydlig markering i klienten känns inte trasigt. Vi lägger inte pengar på *always ready* (ungefär 20 USD/mån för en instans på 2 GB dygnet runt) i en delad kursprenumeration. Blir det ett problem är nästa steg att höja `HTTP_CONCURRENCY` så att varma instanser återanvänds, eller att lägga bilderna i en kö så att ingen behöver vänta på svaret.

## Var koden bor och vad som låser

- **Portabelt:** `functions/src/image.js` är ren JavaScript utan ett enda Azure-beroende. API:ets `photos.js` känner bara till en URL och en header, och klienten känner bara till `/api/photos`.
- **Låser (Azure):** `process-image.js` (`app.http` ur `@azure/functions`), `host.json`, `local.settings.json`, `infra/azure/skapa-funktion.sh`, jobbet *Deploy → Azure Functions* (`Azure/functions-action`, `az functionapp keys list`) och headern `x-functions-key`.
- **Flytt till AWS Lambda eller Cloud Run functions:** `image.js` följer med oförändrad. Vi skriver om handlern (ca 30 rader), ersätter `host.json` och skriptet med `serverless.yml`/SAM eller `gcloud functions deploy`, byter deploysteget och nyckeln, och sätter en ny `IMAGE_FUNCTION_URL`.

## Konsekvenser

- **Kostnad:** Flex Consumption tar betalt per körning och per GB-s minne medan funktionen kör. Gratiskvoten (100 000 GB-s och 250 000 körningar per månad och prenumeration) räcker gott, så det blir 0 kr i staging. `MAX_INSTANCES=10` sätter ett tak för vad en bugg eller en last kan kosta. Application Insights och Log Analytics (30 dagar) lades till för loggarna. De kostar nästan inget vid vår volym, men det är två resurser till att hålla reda på.
- **Nyckeln:** funktionsnyckeln finns i Azure (function-appens nycklar) och som secret `image-function-key` i staging-appen, som api-containern refererar med `secretRef`. Deployjobbet läser den med `az` vid körning och maskerar den. Den finns aldrig i repot, i `staging.yaml`, i GitHub eller i klienten. Rotation: skapa en ny nyckel med `az functionapp keys set`, kör `skapa-funktion.sh` igen (som skriver secreten och sätter variablerna, och det ger en ny revision) och ta sedan bort den gamla nyckeln.
- **Två deployjobb:** *Deploy → Azure staging* (≈ 110 s) och *Deploy → Azure Functions* (≈ 40 s) körs parallellt vid push till `main`. Funktionen och API:et kan därför en kort stund köra olika versioner, så kontraktet mellan dem (`{ filename, width, height }` → `variants`, `processingMs`, `coldStart`) måste vara bakåtkompatibelt.
- **Åtkomst:** function-appen ligger i resursgruppen `utpost-andreas-stratmann-rg`. Resten av teamet når den genom pipelinen (OIDC-identiteten `utpost-github`, Contributor på bara den gruppen), inte genom portalen.

**Skrivet av:** Andreas Stratmann
