# Mätningar M7 – `node scripts/mat-upload.mjs` (N = 10, 4000x3000, lokalt)

## Före – bildkoden i API:et

| Vad | p50 | max | |
|---|---|---|---|
| Uppladdning (POST /api/photos) | 1129 ms | 1132 ms | 10/10 ok |
| Health (GET /api/health) | 505 ms | 983 ms | 11 anrop |
| processingMs (bildarbetet) | 80 ms | 87 ms |  |
| apiMs (API:ets totala tid) | – | – | saknas i svaret (före) |

## Efter – API:et anropar process-image (func start)

| Vad | p50 | max | |
|---|---|---|---|
| Uppladdning (POST /api/photos) | 1029 ms | 1034 ms | 10/10 ok |
| Health (GET /api/health) | 4 ms | 8 ms | 10 anrop |
| processingMs (bildarbetet) | 76 ms | 85 ms |  |
| apiMs (API:ets totala tid) | 1008 ms | 1013 ms |  |

Total tid: 1040 ms · kallstarter i svaren: 0
