// TODO: flytta ut det här nån gång. /marcus 2021-03-11
// M3: adresserna läses från miljön när den finns (compose sätter dem), annars gäller de gamla
// localhost-värdena.
// M6 (skuld 7): JWT-hemligheten ligger inte längre i koden. Lokalt gäller ett utvecklingsvärde,
// i molnet kommer värdet från plattformens secret store (se .env.example och infra/azure/).
export const config = {
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://utpost:utpost@localhost:5433/utpost",
  mongoUrl:
    process.env.MONGO_URL ??
    "mongodb://utpost:utpost@localhost:27017/utpost?authSource=admin",
  jwtSecret: process.env.JWT_SECRET ?? "utpost-dev-secret-byt-i-molnet",
  // M6: commiten imagen byggdes från (api/Dockerfile, build-args i CI). Syns i /api/health.
  gitSha: process.env.GIT_SHA ?? "dev",
  port: Number(process.env.PORT ?? 4000),
  // M7: bildfunktionen (functions/). Lokalt func start på 7071, i Azure sätter skapa-funktion.sh
  // URL:en och nyckeln (nyckeln som secret). Lokalt behövs ingen nyckel.
  imageFunctionUrl:
    process.env.IMAGE_FUNCTION_URL ?? "http://localhost:7071/api/process-image",
  imageFunctionKey: process.env.IMAGE_FUNCTION_KEY,
  // M9 (skuld 10): redaktionens innehåll hämtas från ett headless CMS (cms/contentful.js). Space-id:t är
  // ingen hemlighet, de två nycklarna är det. Saknas de är CMS:et avstängt och appen kör utan notiser.
  cmsSpaceId: process.env.CONTENTFUL_SPACE_ID ?? '',
  cmsEnvironment: process.env.CONTENTFUL_ENVIRONMENT ?? 'master',
  cmsDeliveryToken: process.env.CONTENTFUL_DELIVERY_TOKEN ?? '',
  cmsPreviewToken: process.env.CONTENTFUL_PREVIEW_TOKEN ?? '',
  cmsCacheSeconds: Number(process.env.CMS_CACHE_SECONDS ?? 60),
  uploadDir: "./uploads",
};
