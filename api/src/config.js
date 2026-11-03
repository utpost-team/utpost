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
  uploadDir: "./uploads",
};
