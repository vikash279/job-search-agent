# Deployment

## What to run

| Process | Command | Role |
| --- | --- | --- |
| API + in-process worker | `npm start` | Default single-instance setup |
| API only | `WORKER_SEPARATE=1 npm start` | Scale the HTTP process |
| Worker | `npm run start:worker` | Queue consumer |
| UI | `npm --prefix client run build` then serve `client/dist`, or let the API serve it when `NODE_ENV=production` |

`tsx` is a runtime dependency so `npm start` works after `npm ci`.

## Required environment

Copy `.env.example`. In production:

1. Set `NODE_ENV=production`.
2. Set `JWT_SECRET` to a unique value of at least 32 characters. The process refuses to start on the development default.
3. Set `CLIENT_ORIGIN` to the real UI origin(s), comma-separated.
4. Point `DATABASE_URL` at SQLite for a single node, or PostgreSQL for multiple API instances.
5. Keep `STORAGE_DIR` on a persistent volume if you use local files.
6. Leave `AI_API_KEY` empty unless you want LLM parse/match/prep. Heuristics still run.

Do not commit `.env`. Passwords, OTPs, cookies, and tokens are redacted from logs and audit metadata.

## Database

Local / single user:

```bash
npx prisma generate
npx prisma migrate deploy
npm run db:seed   # optional demo user
```

Migrations live in `prisma/migrations`. Prisma is configured with `engineType = "binary"` so Windows ARM64 can run the query engine.

For PostgreSQL, change `provider` in `prisma/schema.prisma` and `DATABASE_URL`, then create a new migration. `docker-compose.yml` starts Postgres 16 and Redis as optional infrastructure; Redis is reserved and not required for the built-in queue.

## Files

Uploads are written under `{STORAGE_DIR}/{userId}/{date}/{uuid}.pdf|docx`. Keys are rejected if they contain `..` or escape the storage root. Download routes check ownership before streaming.

## Queue

Jobs are rows in `QueueJob` with backoff and a stale-lock reclaim (`QUEUE_STALE_LOCK_MS`). Enqueue is idempotent while a job with the same `idempotencyKey` is `pending`, `retry`, or `active`.

Do not run multiple workers against SQLite. Use PostgreSQL before you add a second worker or API instance.

## Security checklist

- HTTPS in front of the API
- Unique `JWT_SECRET`
- Restricted `CLIENT_ORIGIN`
- Do not publish Postgres/Redis ports on the public internet
- Daily apply cap: `APPLICATION_MAX_PER_DAY`
- Auth and upload rate limits are enabled outside `NODE_ENV=test`
- No real employer-portal automation is enabled

## Health

`GET /health` returns 200 when the database answers `SELECT 1`, otherwise 503.

## Docker

```bash
docker compose up -d postgres   # optional
npm ci
npx prisma migrate deploy
NODE_ENV=production JWT_SECRET="replace-with-32-plus-chars------" npm start
```

A sample `Dockerfile` builds the API image. Mount `STORAGE_DIR` and the SQLite file (or use Postgres) as persistent volumes.
