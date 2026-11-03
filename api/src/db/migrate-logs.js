// M5: flyttar turloggarna från Postgres till MongoDB – ett dokument per tur, med mätpunkterna
// inbäddade i `logs` (samma form som mongo-smoke.js provade i M3).
// Kör:  npm run migrate:logs   (Postgres måste vara seedad, Mongo måste köra)
//
// Tål att köras om: replaceOne med upsert på tour_id (unikt index) ersätter dokumentet om det
// finns och skapar det annars. Postgres är källan – dokument vars tur inte längre finns där
// (t.ex. efter en ny seed) tas bort.
// Verifierar till sist genom att räkna, och avslutar med felkod om något inte stämmer.
import { pathToFileURL } from "node:url";
import { pool } from "./client.js";
import { mongo, toursCollection } from "./mongo.js";

const toDoc = (tour, logs) => ({
  tour_id: tour.id, // Postgres-id:t – det GraphQL slår upp på (Tour.logs)
  user_id: tour.user_id,
  guide_id: tour.guide_id,
  title: tour.title,
  started_at: tour.started_at,
  distance_m: tour.distance_m,
  notes: tour.notes,
  logs: logs.map((l) => ({
    t: l.recorded_at,
    lat: l.lat,
    lon: l.lon,
    elevation_m: l.elevation_m,
    heart_rate: l.heart_rate,
    note: l.note,
  })),
  stats: { points: logs.length },
});

// M6: exporteras så att boot.js kan köra migreringen vid start i molnet. Kastar om antalen inte
// stämmer. Körs filen direkt (npm run migrate:logs) stängs anslutningarna efteråt.
export const migrateLogs = async () => {
  // Två frågor för allt: turerna och alla mätpunkter, grupperade per tur i minnet.
  const tours = (await pool.query("select * from tours order by id")).rows;
  const logs = (
    await pool.query("select * from tour_logs order by tour_id, recorded_at")
  ).rows;
  const logsByTour = new Map();
  for (const log of logs) {
    if (!logsByTour.has(log.tour_id)) logsByTour.set(log.tour_id, []);
    logsByTour.get(log.tour_id).push(log);
  }

  await mongo.connect();
  const collection = toursCollection();
  await collection.createIndex({ tour_id: 1 }, { unique: true });

  const written = tours.length
    ? await collection.bulkWrite(
        tours.map((tour) => ({
          replaceOne: {
            filter: { tour_id: tour.id },
            replacement: toDoc(tour, logsByTour.get(tour.id) ?? []),
            upsert: true,
          },
        })),
      )
    : { upsertedCount: 0, matchedCount: 0 };
  const removed = await collection.deleteMany({
    tour_id: { $nin: tours.map((t) => t.id) },
  });

  console.log(
    `Postgres: ${tours.length} turer, ${logs.length} mätpunkter i tour_logs`,
  );
  console.log(
    `MongoDB:  ${written.upsertedCount} skapade, ${written.matchedCount} ersatta, ${removed.deletedCount} borttagna föräldralösa`,
  );

  // Verifieringen: räknat, inte antaget.
  const docs = await collection.countDocuments();
  const [sum] = await collection
    .aggregate([
      {
        $group: {
          _id: null,
          points: { $sum: { $size: "$logs" } },
          stats: { $sum: "$stats.points" },
        },
      },
    ])
    .toArray();
  const points = sum?.points ?? 0;
  const statsPoints = sum?.stats ?? 0;

  const ok =
    docs === tours.length &&
    points === logs.length &&
    statsPoints === logs.length;
  console.log(
    `Kontroll: dokument ${docs}/${tours.length}, mätpunkter ${points}/${logs.length}, stats.points ${statsPoints}/${logs.length}`,
  );
  if (!ok) throw new Error("FEL: MongoDB stämmer inte med Postgres");
  console.log("Verifierat");
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrateLogs()
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongo.close();
      await pool.end();
    });
}
