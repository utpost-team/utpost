# Säkerhet – Utpost

Genomgång enligt OWASP Top 10 (2025), gjord i M8. Varje lagat hål har ett test i `api/src/routes/routes.test.js` som var rött före fixen. Testerna körs i jobbet Integration på varje PR.

**Datum:** 2026-11-17
**Hotbilden i en mening:** Det som står på spel är medlemmarnas konton och turer och redaktionens guider. Angriparen är oftast ett skript som provar öppna endpoints, kända sårbarheter och läckta lösenord – inte en person som riktar in sig på oss.

## Autentiseringen (M8)

- **Lösenord:** lagras som `scrypt:<salt>:<hash>` med ett slumpat salt per användare (`node:crypto`, inget paket) och jämförs med `timingSafeEqual` (`api/src/lib/password.js`). Login kör `verifyPassword` även när e-posten inte finns, så okänd e-post och fel lösenord ger samma svar (`401 fel e-post eller lösenord`) och tar ungefär lika lång tid. Svaret innehåller bara de publika fälten (`publicUser` i `api/src/lib/auth.js`), aldrig `password_hash`. Seeden hashar `hemligt123` en gång (`api/src/db/seed.js`).
- **Token:** en JWT med `id`, `email` och `role`, signerad med HS256 och giltig i **en timme**. `jwt.verify` godtar bara `HS256`. Hemligheten kommer ur miljön: i staging är det en Container Apps-secret skapad med `openssl rand` (M6), och den har aldrig legat i repot. I klienten ligger token **bara i minnet** (`client/src/lib/token.ts`), aldrig i `localStorage`. En omladdning loggar alltså ut.
- **Skyddade routes:** kontrollen sitter i **API:et**. Klientens guard (`requiresAuth` i `client/src/router/index.js`, som skickar till `/logga-in?till=…`) är bara UX.

  | Anrop | Kräver |
  |---|---|
  | `POST /api/tours`, `POST /api/photos`, GraphQL `createTour` | token (annars 401) |
  | `DELETE /api/tours/:id`, `POST /api/photos` | token, och att turen är din eller att du är redaktör. Kontrolleras mot raden i databasen (annars 403, 404 om turen saknas). |
  | `PUT /api/guides/:id` | token och rollen `editor` (annars 403) |
  | `GET` på guider och turer, `POST /api/auth/login`, `POST /api/auth/register` | ingenting (publikt) |

## OWASP Top 10 – genomgång

| # | Risk | Gäller oss? | Vad vi hittade (fil, endpoint) | Vad vi gjorde (PR) | Kontroll (testet som var rött före fixen, eller curl) |
|---|---|---|---|---|---|
| A01 | Broken Access Control | **ja** | `DELETE /api/tours/:id` och `POST /api/photos` hade ingen inloggning eller ägarkontroll (`api/src/routes/tours.js`, `photos.js`). `PUT /api/guides/:id` tog emot vad som helst från vem som helst (`api/src/routes/guides.ts`, "auth kommer sen"). | `requireUser` på allt som skriver, plus ägarkontroll mot raden i databasen ([#85](https://github.com/utpost-team/utpost/pull/85)). `requireUser` + `requireRole('editor')` + `guideUpdateSchema` på `PUT /api/guides/:id` ([#88](https://github.com/utpost-team/utpost/pull/88)). | *DELETE /api/tours/:id utan token ger 401 och turen finns kvar*, *en medlem kan inte ta bort någon annans tur (403)*, *POST /api/photos utan token ger 401 – uppladdning kräver inloggning* ([röd](https://github.com/utpost-team/utpost/actions/runs/43198041747) → [grön](https://github.com/utpost-team/utpost/actions/runs/43232241869)). *PUT /api/guides/:id utan token ger 401 och guiden är orörd*, *en medlem får inte ändra guider (403) – bara rollen editor* ([röd](https://github.com/utpost-team/utpost/actions/runs/44060708060) → [grön](https://github.com/utpost-team/utpost/actions/runs/44061088248)). |
| A02 | Security Misconfiguration | **ja** | `app.use(cors())` svarade `Access-Control-Allow-Origin: *` (`api/src/app.js`). nginx skickade inga säkerhetsheaders och visade sin version (ZAP 10020, 10021, 10036, 10038). `api/Dockerfile` körde som root (Trivy DS-0002). | `cors()` bort, eftersom klienten når API:et på samma origin ([#88](https://github.com/utpost-team/utpost/pull/88)). `client/security-headers.conf` i varje location, `server_tokens off`, `USER node` i `api/Dockerfile` ([#89](https://github.com/utpost-team/utpost/pull/89)). | *API:et skickar ingen Access-Control-Allow-Origin – ingen annan sajt får läsa svaren* ([röd](https://github.com/utpost-team/utpost/actions/runs/44060708060) → [grön](https://github.com/utpost-team/utpost/actions/runs/44061088248)). ZAP-reglerna 10020, 10021, 10036 och 10038 är FAIL i `.zap/rules.tsv`. `curl -I` mot staging visar CSP och `nosniff`, se *Headers*. |
| A03 | Software Supply Chain Failures | **ja** | `npm audit --omit=dev` gav 6 sårbarheter (1 critical, 4 high) i produktionsberoendena. `drizzle-orm` 0.36 behövde en major för att bli fri. | `npm audit fix` och `drizzle-orm` 0.45 för hand, med testerna gröna efteråt. Nu 0 sårbarheter. Jobbet *Säkerhet* kör `npm audit` och Trivy på varje PR ([#89](https://github.com/utpost-team/utpost/pull/89)). | Jobbet *Säkerhet* är grönt på `main` ([körning](https://github.com/utpost-team/utpost/actions/runs/44081921128/job/134034392512)). [#90](https://github.com/utpost-team/utpost/pull/90) med `express` 4.17.1 blev [rött på npm audit](https://github.com/utpost-team/utpost/actions/runs/44082554299/job/134036569603) och stängdes utan merge. |
| A04 | Cryptographic Failures | **ja** | Lösenorden låg i klartext (`plaintext:<lösenord>`) i `users.password_hash`, och login skickade tillbaka hela raden. JWT-hemligheten låg i koden fram till M6. | scrypt med salt och `timingSafeEqual` ([#85](https://github.com/utpost-team/utpost/pull/85)). Hemligheten ur miljön och roterad (M6, [#75](https://github.com/utpost-team/utpost/pull/75)). Staging har https via Azure. | *lösenordet i databasen är hashat, inte klartext* ([röd](https://github.com/utpost-team/utpost/actions/runs/43198041747) → [grön](https://github.com/utpost-team/utpost/actions/runs/43232241869)) |
| A05 | Injection | **ja** | Sökningen byggde SQL med strängkonkatenering: `ilike '%${q}%'` i `GET /api/guides/search` (`api/src/routes/guides.ts`). Ett citattecken i sökrutan blev en del av frågan, och anropet hängde. | Parametriserad fråga (`$1`), och `searchSchema` validerar `q` före routen ([#85](https://github.com/utpost-team/utpost/pull/85)). Övriga frågor var redan parametriserade. | *ett citattecken i sökordet ger 200 och en tom lista, inte 500* ([röd, timeout](https://github.com/utpost-team/utpost/actions/runs/43198041747) → [grön](https://github.com/utpost-team/utpost/actions/runs/43232241869)) |
| A06 | Insecure Design | delvis | Inloggningen har ingen broms (rate limiting), så lösenord kan gissas i snabb takt. Profilen hämtar alla turer och filtrerar fram användarens egna i klienten (skuld 20). Det är bara publik data, men designen är fel. | Inget i M8, se *Kända brister*. Validering och åtkomst sitter på servern, inte i klienten. | – |
| A07 | Authentication Failures | **ja** | Login svarade med hela användarraden, inklusive lösenordet. Registreringen tog emot vilket lösenord som helst. Token gällde i 30 dagar, och `jwt.verify` saknade `algorithms`. | `publicUser` i svaret, minst 8 tecken i `registerSchema`, token på en timme, `algorithms: ['HS256']` ([#85](https://github.com/utpost-team/utpost/pull/85)). Token bara i minnet i klienten ([#86](https://github.com/utpost-team/utpost/pull/86)). | *svaret på en lyckad inloggning innehåller token och användaren – men aldrig password_hash*, *registrering med för kort lösenord ger 400 med vad som var fel* ([röd](https://github.com/utpost-team/utpost/actions/runs/43198041747) → [grön](https://github.com/utpost-team/utpost/actions/runs/43232241869)). *fel lösenord och okänd e-post ger samma svar* var grönt redan före fixen, så det bevisar inget hål. |
| A08 | Software or Data Integrity Failures | delvis | Pipelinen bygger imagen en gång per commit (`sha-`tagg i GHCR) och deployar exakt den. Inloggningen till Azure sker med OIDC, utan lagrade nycklar. `npm ci` installerar efter lockfilen. Imagerna signeras inte, och actions är låsta på version, inte på commit-sha. | Inget nytt i M8 utöver Trivy på imagen ([#89](https://github.com/utpost-team/utpost/pull/89)). | Trivy `image` på `utpost-api` i jobbet *Säkerhet* |
| A09 | Security Logging & Alerting Failures | **ja** (kvar) | Säkerhetshändelser loggas inte: misslyckade inloggningar, 401 och 403 syns ingenstans. Felhanteraren loggar bara 500-fel (metod, adress, meddelande) till stdout. Ingen larmar. | Medvetet kvar, se *Kända brister*. | – |
| A10 | Mishandling of Exceptional Conditions | **ja** | Express 4 fångar inte fel i async-handlers. Ett id som inte var ett tal fick anropet att hänga, och trasig JSON gav ingen ordentlig 400. `process.on('unhandledRejection')` dolde felen, och `express.json` tog emot 50 MB. | `wrap` runt varje async-route, en felhanterare sist i `app.js` (400 med `issues`, 413, 500 utan detaljer), `idParam` på id och `express.json({ limit: '1mb' })` ([#85](https://github.com/utpost-team/utpost/pull/85)). | *ett id som inte är ett tal ger 400, inte ett ohanterat fel* (timeout före), *trasig JSON ger 400 med ett svar – inte ett anrop som hänger*, *en bild med orimliga mått stoppas med 400 innan något sparas* ([röd](https://github.com/utpost-team/utpost/actions/runs/43198041747) → [grön](https://github.com/utpost-team/utpost/actions/runs/43232241869)) |

## Validering av indata

Valideringen sitter **på servern, före routen**. `validate(schema)` (`api/src/lib/validate.js`) kör schemat och byter ut `req.body` mot det validerade värdet, med rätt typer och utan okända fält. För query-strängen hamnar värdet i `req.validQuery`, eftersom `req.query` inte går att skriva över i Express 4.

| Schema (`api/src/lib/schemas.js`) | Används på | Medvetna gränser |
|---|---|---|
| `loginSchema` | `POST /api/auth/login` | e-post högst 254 tecken |
| `registerSchema` | `POST /api/auth/register` | lösenord minst 8 tecken, namn högst 80 |
| `createTourSchema` | `POST /api/tours` | titel högst 120 tecken, anteckning högst 2000 |
| `photoUploadSchema` | `POST /api/photos` | högst 20 000 px per sida, samma tak som bildfunktionen (M7) |
| `searchSchema` (query) | `GET /api/guides/search` | `q` högst 100 tecken |
| `guideUpdateSchema` | `PUT /api/guides/:id` | titel högst 120, region högst 60, svårighet `lätt`/`medel`/`svår`, text högst 50 000 |
| `idParam` | `:id` i tours och guides | positivt heltal |

Ogiltig indata ger **400** med `{ error: 'ogiltig indata', issues: [{ path, message }] }` från felhanteraren i `api/src/app.js`. Trasig JSON ger 400 `ogiltig JSON`, en body över 1 MB ger 413, och allt annat ger 500 utan detaljer (detaljerna går till loggen).

Kontroll mot en lokal compose-stack: `curl -X POST /api/auth/register` med `"password":"kort"` ger 400 och `issues` med `path: "password"`, `message: "minst 8 tecken"`.

## Headers vi sätter (nginx)

Headrarna står i `client/security-headers.conf` och inkluderas i **varje** `location` i `client/nginx.conf.template`. nginx ärver inte `add_header` från server-blocket så fort en location har en egen, som `/assets/` med `Cache-Control`.

- `Content-Security-Policy`: bara egna skript och stilar, inga inline-skript, `frame-ancestors 'none'`, `object-src 'none'`. Ett skript som slinker in via guidernas HTML (`v-html`, skuld 10) körs inte.
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

Dessutom `server_tokens off`, så att `Server: nginx` inte visar versionen, och `Cache-Control: no-store` på `/api` och `/graphql`.

Kontroll med `curl -I` mot staging den 2026-11-17, när staging körde `320e826`: `/` svarar med `content-security-policy`, `x-content-type-options: nosniff` och `x-frame-options: DENY`. `/api/health` svarar med samma headers plus `cache-control: no-store`.

## Skanning i pipelinen

Jobbet *Säkerhet* i `.github/workflows/ci.yml` körs på varje PR och push, parallellt med Quality och billigast först. Blir ett steg rött står resten som *skipped*. Jobbet krävs av rulesetet på `main` och tar ungefär 2,5 minuter (145 s på `main`). Tiderna står i `docs/pipeline.md`.

| Steg | Verktyg | Hittar | Rött när |
|---|---|---|---|
| Beroenden | `npm audit --omit=dev --audit-level=high` | kända sårbarheter i produktionsberoendena i lockfilen (SCA) | minst en high eller critical |
| Repot | Trivy `fs` (vuln, secret, misconfig) | sårbara beroenden, hemligheter som råkat committas, Dockerfiles som kör som root | HIGH/CRITICAL som inte står i `.trivyignore` |
| Imagen | Trivy `image` på `utpost-api` | det som faktiskt ligger i imagen: Alpine-paket och basimagens npm, som lockfilen aldrig ser | HIGH/CRITICAL |
| Appen | ZAP baseline mot `localhost:3001` (nginx), efter `docker compose up --build --wait` | vad den körande appen svarar: saknade säkerhetsheaders, en läckt serverversion | en FAIL-regel i `.zap/rules.tsv` (WARN gör inte jobbet rött) |

**Undantagen:** `.trivyignore` undantar `DS-0002` för `client/Dockerfile`. nginx startar som root för att binda port 80 och byter själv till användaren `nginx` för arbetsprocesserna. `.zap/rules.tsv` säger vilka ZAP-regler som är FAIL, WARN eller IGNORE, med en kommentar per rad.

**Rött första gången** (fredagens labb mot samma kod): `npm audit` (se A03), Trivy DS-0002 i `api/Dockerfile`, och ZAP 10020, 10021, 10036 och 10038 (se A02).

## Kända brister (medvetet kvar)

- **En omladdning loggar ut.** Token ligger bara i minnet. Nästa steg är en refresh-token i en httpOnly-cookie, men den är inte byggd.
- **Inloggningen saknar broms.** Det finns ingen rate limiting på `POST /api/auth/login`, så ett skript kan gissa lösenord i den takt API:et svarar (scrypt bromsar lite). (A06)
- **Säkerhetshändelser loggas inte.** Misslyckade inloggningar, 401 och 403 syns ingenstans, och inget larmar. (A09)
- **En token går inte att återkalla.** En stulen token gäller tills den går ut, alltså högst en timme. Det finns ingen spärrlista och ingen utloggning på serversidan.
- **GraphiQL och introspection är på i staging.** `GET /graphql` visar GraphiQL och schemat går att läsa. Datan är densamma som de publika REST-anropen, och den enda mutationen (`createTour`) kräver token. Ska stängas av före produktion. GraphQL-indata valideras av GraphQL-typerna, inte av Zod som REST.
- **nginx-containern startar som root** (DS-0002, undantagen ovan). Alternativet är `nginx-unprivileged` på port 8080.
- **Ingen HSTS.** Staging får https av Azure, men headern sätts inte förrän allt är https.
- **Guidernas HTML renderas med `v-html`** (skuld 10). Bara redaktörer kan skriva den (A01), och CSP:n stoppar inline-skript, men HTML:en saneras inte.
- **Registreringen är öppen.** Vem som helst kan skapa ett medlemskonto, utan e-postverifiering.
- **Imagerna signeras inte**, och actions i pipelinen är låsta på version, inte på commit. (A08)
