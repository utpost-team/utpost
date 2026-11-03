# Beslutsdokument: hostingval

*Ett av teamets sex beslutsdokument. Skrivs i M6, hålls levande. Samma mall som `api-stil.md`, `databas.md` och `testing.md`. Det här dokumentet examinerar Cloud 1 (redogöra för hostinglösningar som AWS, Azure, Google Cloud) – skriv så att en läsare utan Azure-konto förstår valet.*

**Datum:** 2026-11-03
**Beslut:** Staging kör i Azure Container Apps (Consumption, Sweden Central) som en app med fyra containrar – client, api, Postgres och MongoDB – som skalar till noll och seedar sina tomma databaser vid varje start. Produktion kör samma två images på samma plattform, men med managed databaser, minst en replica som alltid är vaken och egen domän. Det som skiljer dem är databaserna och skalningen, inte koden eller pipelinen.

## Bakgrund

När M5 var klar hade vi två images i GHCR (`utpost-api` och `utpost-client`) taggade `sha-<7 tecken>`, en pipeline som bygger och testar dem, och `compose.yml` som startar allt lokalt. Men imagerna hade aldrig kört någon annanstans än på våra datorer. Ingen utanför teamet kunde öppna appen, och ingen visste vilken commit som körde var.

M6 kräver tre saker: en publik URL, automatisk deploy till staging vid varje merge till `main`, och hemligheter ur koden. Kursen ger oss en Azure-prenumeration där varje student har en egen resursgrupp, och gratiskvoten för Container Apps delas av hela klassen. Därför valde vi en plattform som tar en färdig image, skalar till noll och inte kostar något när ingen använder den.

## Vad vi faktiskt hyr

Värdena kommer från `az containerapp show -n utpost-team -g utpost-andreas-stratmann-rg` (2026-11-03).

| Del | Tjänst | Nivå | Vem sköter uppdateringar/skalning | Vad det kostar oss i staging |
|---|---|---|---|---|
| Klient + API | Azure Container Apps, arbetsprofil **Consumption**, appen `utpost-team` i miljön `utpost-env`, **Sweden Central**. `client` (nginx, **0,25 vCPU / 0,5 GiB**) är den enda med ingress (port 80, bara HTTPS). `api` (**0,5 vCPU / 1 GiB**) är sidecar och nås på `localhost:4000`. Skalning **0–1 replica**, nedskalning efter 300 s utan trafik | Serverless containrar (PaaS). Vi lämnar en image, Azure kör den | Azure sköter OS, värdmaskiner, TLS-certifikat och skalning 0 → 1 vid trafik. Vi sköter imagen och vilken sha som kör (jobbet Deploy) | **0 kr.** Cost Management (`ActualCost`, MonthToDate, resursgruppen) har inga kostnadsrader alls. Appen skapades 3/11, så det är hela dess livstid. Vaken drar appen 1,75 vCPU + 3,5 GiB. Gratiskvoten (180 000 vCPU-s + 360 000 GiB-s per månad och prenumeration) räcker till 180 000 / 1,75 ≈ 102 900 s ≈ **28,6 h vaken app per månad**, för hela klassen tillsammans |
| Postgres | `postgres:16` som sidecar i samma app (0,5 vCPU / 1 GiB) | IaaS-liknande: vi kör databasen själva i en container, fast på en serverless plattform | Vi sköter version, backup och data. Ingen volym: databasen töms vid varje kallstart, ny revision och omstart, och seedas om (`SEED_ON_START=1`) | Ingår i appens förbrukning ovan |
| MongoDB | `mongo:8.2` som sidecar i samma app (0,5 vCPU / 1 GiB) | Som Postgres | Som Postgres. `boot.js` kör `migrate:logs` efter seed | Ingår i appens förbrukning ovan |
| Images | GHCR, paketen `utpost-team/utpost-api` och `utpost-team/utpost-client`, publika | SaaS (container-registry) | GitHub. Vi bestämmer bara vad som pushas (jobbet *Image*, taggen `sha-<7>`) | 0 kr, publika paket är gratis |
| Deploy | GitHub Actions → Azure (OIDC-inloggning, `az containerapp update`) | SaaS (CI/CD) | GitHub sköter runners, vi sköter `ci.yml`. Azure-identiteten `utpost-github` (app registration + federerad identitet, Contributor på bara vår resursgrupp) skapades en gång med `identitet.sh` | 0 kr, publikt repo. Jobbet tog **91 s** på `main` (`12f3155`) |

## Alternativ vi jämförde

Kostnaden är för vår staging (1,75 vCPU / 3,5 GiB för alla fyra containrar), ungefärliga listpriser i november 2026.

| Alternativ | Vad ändras i repot | Kostnad (staging) | För | Emot |
|---|---|---|---|---|
| **Azure Container Apps** (valt) | – | 0 kr inom gratiskvoten | Kör våra images som de är. Sidecars med delad localhost, så fyra containrar blir en app. Skalar till noll. HTTPS och URL ingår. Kursen har redan prenumerationen | Kallstart ~28 s. Kvoten delas av hela klassen. Revisioner och `--revision-suffix` är Azure-specifika begrepp |
| **Azure App Service for Containers** (Linux, sidecars) | `infra/azure/` skrivs om till en App Service-plan + webbapp. Deploy-jobbet byter `az containerapp update` mot `az webapp config container set`. Samma leverantör, så OIDC-identiteten kan återanvändas | Ingen skalning till noll: planen kostar dygnet runt. B1 (1 kärna / 1,75 GB) räcker inte för fyra containrar med databaser, B2–B3 ca 25–50 USD/mån | Mogen tjänst, deployment slots för att byta staging ↔ prod utan driftstopp, alltid varm (ingen kallstart) | Betalar när ingen använder den, vilket inte går med en delad kursprenumeration. Den gamla Docker Compose-varianten är på väg bort, så sidecars är det som gäller |
| **Google Cloud Run** (multi-container) | `infra/azure/` byts mot en `service.yaml` för Cloud Run (den är nästan samma som `staging.yaml`: containrar, sidecars på localhost, secrets ur Secret Manager). Deploy-jobbet: `google-github-actions/auth` med Workload Identity Federation (också OIDC) och `gcloud run deploy`. Images kan ligga kvar i GHCR via en remote repository i Artifact Registry | Ungefär 0 kr: samma typ av gratiskvot (180 000 vCPU-s, 360 000 GiB-s, 2 miljoner anrop per månad) | Närmast vår lösning: skalar till noll, sidecars, OIDC utan lösenord. Snabb kallstart för små containrar | Kräver eget Google-konto med betalkort, kursen ger oss inget. En till leverantör och en till inloggning för teamet |
| **AWS ECS på Fargate** | `infra/azure/` byts mot en task definition (fyra containrar i samma task delar localhost i `awsvpc`), en ECS-service, en Application Load Balancer och en IAM-roll för GitHubs OIDC. Deploy-jobbet: `aws-actions/configure-aws-credentials` + `aws ecs update-service` | Fargate skalar inte till noll: 1,75 vCPU + 3,5 GB dygnet runt ca 65 USD/mån, plus lastbalanserare ca 18 USD/mån. Totalt ca 80 USD/mån | Fullständig kontroll över nätverk och skalning. Störst marknad, och det mest jobbannonserna nämner | Mest att sätta upp: VPC, subnät, säkerhetsgrupper, ALB och IAM. Dyrast för en staging som står stilla det mesta av dygnet. (AWS App Runner tar inte emot nya kunder, så det var inget alternativ) |
| **En VM med `docker compose`** (IaaS, t.ex. Azure B2s) | Nästan inget i appen: `compose.yml` används som den är, med `.env` på servern. Deploy-jobbet blir `ssh` + `docker compose pull && up -d`, med en SSH-nyckel som **secret** i GitHub. Nytt: HTTPS (Caddy eller certbot) och uppdateringar av OS | Azure B2s (2 vCPU / 4 GB) ca 30–35 USD/mån, dygnet runt | Enklast att förstå: samma compose som lokalt. Volymer gör att datan överlever omstarter. Ingen kallstart | Vi sköter allt själva: OS-patchar, brandvägg, certifikat, diskar. En SSH-nyckel i GitHub är en riktig hemlighet att rotera, till skillnad från OIDC. Ingen skalning |

**Varför Container Apps:** det är det enda alternativet som både kostar 0 kr när ingen använder appen *och* finns i den prenumeration kursen redan gett oss. Cloud Run är tekniskt lika bra (och `staging.yaml` hade nästan kunnat översättas rad för rad), men kräver ett eget konto med betalkort. App Service och Fargate är alltid igång och kostar då pengar varje timme. VM:en är billigast att förstå men dyrast att sköta.

## Staging och produktion är inte samma sak

`SEED_ON_START=1` är rätt för staging: datan är testdata, och appen ska kunna skala till noll utan volym. En tom databas vid varje kallstart är priset, och `boot.js` betalar det genom att vänta på Postgres, seeda om `users` är tom, köra `migrate:logs` och sedan starta servern. Ingen förlorar något på att staging glömmer allt.

I produktion är det tvärtom: datan är användarnas, och en omstart får aldrig tömma den. Det här skulle vi byta:

| Del | Staging i dag | Produktion |
|---|---|---|
| Postgres | Sidecar utan volym | **Azure Database for PostgreSQL – Flexible Server**, Burstable B1ms (ca 15–25 USD/mån), med automatisk backup och point-in-time restore (7 dagar som standard) |
| MongoDB | Sidecar utan volym | **Azure Cosmos DB for MongoDB** (vCore har en gratisnivå), eller MongoDB Atlas på Azure |
| Seed och migrering | `SEED_ON_START=1` vid varje start | `SEED_ON_START=0`. Ingen seed alls. Migreringar körs en gång per deploy, som ett Container Apps-jobb eller ett steg i pipelinen, inte i varje replica som startar |
| Skalning | 0–1 replica, kallstart ~28 s | `minReplicas: 1` (minst), fler vid last. Går inte i kursprenumerationen – det äter den delade kvoten |
| Adress | `*.azurecontainerapps.io` | Egen domän med managed certifikat i Container Apps |
| Loggar | `az containerapp logs show`, försvinner med replican | Log Analytics med retention, larm på 5xx och på att `/api/health` inte svarar |
| Deploy | Automatiskt vid varje merge | Egen GitHub-miljö `azure-production` med krav på godkännande, och en egen identitet med Contributor på bara prod-gruppen |

Det som **inte** byts: imagerna (samma `sha-<7>` som testades i staging deployas till prod), Dockerfilerna, nginx-mallen, `api/src/` och jobben Quality, Build, Integration och Image. Prod får bara andra värden på samma variabler i `.env.example` – `DATABASE_URL` och `MONGO_URL` pekar på de managed databaserna i stället för `localhost`.

## Inlåsning

Ingenting i imagerna vet att de kör i Azure. Det som låser oss är tre filer, ett jobb och några värden. Det är dem vi byter om vi flyttar till Cloud Run, ECS eller en VM.

**Finns bara för Azure (byts vid flytt):**
- `infra/azure/staging.yaml` – appen som fyra sidecars, secrets, skalning 0–1
- `infra/azure/skapa-staging.sh` – skapar miljön och appen, slumpar fram hemligheterna med `openssl rand`
- `infra/azure/identitet.sh` – app registration, federerad identitet, rollen Contributor
- jobbet `deploy` i `.github/workflows/ci.yml` – `azure/login` och `az containerapp update`
- GitHub-miljön `azure-staging` och dess sex variabler (ligger i GitHub, inte i repot)

**Likadant i alla moln (byts inte):**
- `api/Dockerfile` och `client/Dockerfile` – och imagerna i GHCR
- `client/nginx.conf.template` – adressen till API:t kommer från `API_UPSTREAM`
- `.env.example` – samma variabelnamn överallt
- `api/src/` – koden läser bara miljövariabler (`config.js`), `boot.js` vet inte var den kör
- `compose.yml` – lokalt
- jobben Quality, Build, Integration och Image i `ci.yml`

**Värdena som skiljer compose från Azure:**

| Variabel | Compose | Azure staging |
|---|---|---|
| `API_UPSTREAM` | `api:4000` (egen container, eget namn) | `localhost:4000` (sidecar, delad localhost) |
| `DATABASE_URL` | `…@postgres:5432/utpost` | `…@localhost:5432/utpost`, som secret `database-url` |
| `MONGO_URL` | `…@mongo:27017/…` | `…@localhost:27017/…`, som secret `mongo-url` |
| `JWT_SECRET` | dev-värde i `compose.yml` | slumpat av `skapa-staging.sh`, finns bara som secret `jwt-secret` i Azure |
| `SEED_ON_START` | `1` (seedar bara om volymen är tom, alltså efter `down -v`) | `1` (ingen volym – tom databas vid varje kallstart) |

Det är också argumentet för att bygga images i vår egen pipeline i stället för plattformens byggverktyg (som `az containerapp up --source`): då är det bara deploysteget som är Azure-specifikt.

## Konsekvenser

- **Kallstarten:** 28 s från första anropet till att `/api/health` svarar `"ok":true`, uppmätt 2026-11-03 med `time curl` när `utpost-team` stod på 0 replicas. Tiden är fyra containrar som startar, API:t som väntar på Postgres och seedar om båda databaserna. Första besökaren efter en paus (5 min utan trafik) väntar alltså en halv minut. Samma sak syns i Deploy-jobbet: första försöket i väntesteget fick inget svar medan den nya revisionen startade.
- **Pengar och kvot:** 0 kr hittills. Gratiskvoten räcker till ungefär 28 timmar vaken app per månad, men den delas av hela klassen. Därför `maxReplicas: 1` och aldrig `minReplicas: 1`.
- **Hemligheter på två ställen:** lokalt dev-värden i `compose.yml` (och eventuell `.env`, som är gitignorerad), i Azure secrets i appen. Ingen hemlighet finns i GitHub – Deploy loggar in med OIDC. Rotation: `az containerapp secret set -n utpost-team -g utpost-andreas-stratmann-rg --secrets jwt-secret=<nytt värde>` och sedan `az containerapp revision restart`, eftersom en ändrad secret inte ger någon ny revision. Alla inloggade blir utloggade, eftersom deras JWT signerades med den gamla nyckeln.
- **Databaserna lever inte länge:** en ny revision (varje deploy) ger tomma databaser. Turer som skapas i staging finns kvar tills nästa merge eller kallstart.
- **Vem har tillgång:** resursgruppen `utpost-andreas-stratmann-rg` ägs av Andreas (Contributor + RBAC-administratör), plus pipelinens identitet `utpost-github` och kursens lärare. Teamet kan inte skapa en egen grupp. Andreas kan ge de andra Contributor på gruppen om de behöver portalen.
- **Två revisioner per deploy:** `az containerapp update --container-name` tar en container per anrop. Under några sekunder kör ny api med gammal client. Väntesteget väntar därför både på rätt sha i `/api/health` och på att den sista revisionen (`…--sha-<7>`) är klar.

**Skrivet av:** Andreas Stratmann
