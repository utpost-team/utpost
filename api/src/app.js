import express from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { config } from './config.js';
import { pool } from './db/client.js';
import { mongo } from './db/mongo.js';
import { authRouter } from './routes/auth.js';
import { guidesRouter } from './routes/guides.ts';
import { toursRouter } from './routes/tours.js';
import { photosRouter } from './routes/photos.js';
import { yoga } from './graphql/server.js';

// Appen byggs här och startas i index.js – så går den att anropa i ett test utan att lyssna
// på en fast port.
export const app = express();

app.use(cors());

// GraphQL (M4): en endpoint bredvid REST-routerna. Ligger före express.json() – yoga läser sin egen body.
app.use(yoga.graphqlEndpoint, yoga);

// Express JSON limit sätts till 1mb för att förhindra för stora requests.
app.use(express.json({ limit: '1mb' }));

// Svarar med om databaserna nås. Compose och molnet frågar hit för att veta om API:et lever.
// M6: `sha` är commiten imagen byggdes från – pipelinen väntar på att molnet svarar med rätt sha.
app.get('/api/health', async (req, res) => {
  const check = async (fn) => {
    try {
      await fn();
      return 'ok';
    } catch (err) {
      return `fel: ${err.message}`;
    }
  };
  const postgres = await check(() => pool.query('select 1'));
  const mongodb = await check(async () => {
    await mongo.connect(); // gör inget om klienten redan är ansluten
    await mongo.db().command({ ping: 1 });
  });
  const ok = postgres === 'ok' && mongodb === 'ok';
  res.status(ok ? 200 : 503).json({
    ok,
    version: '1.4.2',
    sha: config.gitSha,
    postgres,
    mongodb,
  });
});

app.use('/api/auth', authRouter);
app.use('/api/guides', guidesRouter);
app.use('/api/tours', toursRouter);
app.use('/api/photos', photosRouter);

// Felhanteraren sist i app.js
app.use((err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'ogiltig indata',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'ogiltig JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'för stor request' });
  console.error(`${req.method} ${req.originalUrl}: ${err.message}`);
  res.status(500).json({ error: 'internt fel' });
});
