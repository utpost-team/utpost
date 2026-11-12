import { Router, type Request, type Response } from 'express';
import type { Guide, ApiError } from '@utpost/shared';
import { pool } from '../db/client.js';
import { wrap } from '../lib/wrap.js';
import { validate } from '../lib/validate.js';
import { searchSchema } from '../lib/schemas.js';

export const guidesRouter = Router();

// Response<Guide[]> är kontraktet: skickar vi något annat säger tsc ifrån innan klienten ser det.
guidesRouter.get(
  '/',
  wrap(async (req: Request, res: Response<Guide[]>) => {
    const result = await pool.query<Guide>('select * from guides order by updated_at desc');
    res.json(result.rows);
  }),
);

guidesRouter.get(
  '/regions',
  wrap(async (req: Request, res: Response<string[]>) => {
    const result = await pool.query<{ region: string }>('select distinct region from guides order by region');
    res.json(result.rows.map((r) => r.region));
  }),
);

guidesRouter.get(
  '/popular',
  wrap(async (req: Request, res: Response<Guide[]>) => {
    const result = await pool.query<Guide>('select * from guides where published = true order by id desc limit 6');
    res.json(result.rows);
  }),
);

// Sökningen i api/src/routes/guides.ts. req.query går inte att skriva över i Express 4, så validate lägger det validerade värdet i req.validQuery:
guidesRouter.get(
  '/search',
  validate(searchSchema, 'query'),
  wrap(async (req: Request, res: Response<Guide[]>) => {
    const { q } = (req as Request & { validQuery: { q: string } }).validQuery;
    const result = await pool.query<Guide>(
      'select * from guides where title ilike $1 or region ilike $1 order by updated_at desc',
      [`%${q}%`],
    );
    res.json(result.rows);
  }),
);

guidesRouter.get(
  '/:slug',
  wrap(async (req: Request, res: Response<Guide | ApiError>) => {
    const result = await pool.query<Guide>('select * from guides where slug = $1', [req.params.slug]);
    if (!result.rows[0]) return res.status(404).json({ error: 'hittades inte' });
    res.json(result.rows[0]);
  }),
);

guidesRouter.put(
  '/:id',
  wrap(async (req: Request, res: Response<Guide>) => {
    const { title, region, difficulty, lengthKm, bodyHtml, published } = req.body;
    const result = await pool.query<Guide>(
      `update guides set title=$1, region=$2, difficulty=$3, length_km=$4, body_html=$5,
       published=$6, updated_at=now() where id=$7 returning *`,
      [title, region, difficulty, lengthKm, bodyHtml, published, req.params.id],
    );
    res.json(result.rows[0]);
  }),
);
