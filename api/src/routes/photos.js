import { Router } from "express";
import { pool } from "../db/client.js";
import { config } from "../config.js";

export const photosRouter = Router();

// M7: bildarbetet (omskalning + bildsignatur) ligger i funktionen process-image (functions/).
// API:et sparar raden, anropar funktionen och skickar vidare svaret. Ingen bildkod här, inte
// ens som fallback: svarar inte funktionen blir det 502.
photosRouter.post("/", async (req, res) => {
  const { tourId, filename, width, height } = req.body;
  const started = Date.now();

  const result = await pool.query(
    "insert into photos (tour_id, filename, width, height) values ($1,$2,$3,$4) returning *",
    [tourId, filename, width, height],
  );

  const headers = { "content-type": "application/json" };
  if (config.imageFunctionKey)
    headers["x-functions-key"] = config.imageFunctionKey;

  let processed;
  try {
    const response = await fetch(config.imageFunctionUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ filename, width, height }),
    });
    if (!response.ok)
      throw new Error(`process-image svarade ${response.status}`);
    processed = await response.json();
  } catch (err) {
    console.error("process-image:", err.message);
    return res.status(502).json({ error: "bildfunktionen svarar inte" });
  }

  const { variants, processingMs, coldStart, instance } = processed;
  res.json({
    ...result.rows[0],
    variants,
    processingMs,
    coldStart,
    instance,
    apiMs: Date.now() - started,
  });
});

photosRouter.get("/tour/:tourId", async (req, res) => {
  const result = await pool.query("select * from photos where tour_id = $1", [
    req.params.tourId,
  ]);
  res.json(result.rows);
});
