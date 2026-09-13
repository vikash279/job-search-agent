# Harbor — AI Job Application Copilot

A production-oriented job application copilot. It turns a CV into a candidate profile, discovers jobs from **permitted** sources, scores matches, prepares an application package, and tracks status.

**Nothing is submitted without explicit approval.** The system will not bypass CAPTCHA, OTP, MFA, rate limits, or anti-bot protections. Job descriptions and CV text are treated as untrusted data.

---

## Architecture assessment (existing repo)

The repository was a greenfield git project (README only). There was no existing backend, frontend, ORM, or queue to extend.

| Decision | Choice | Why |
| --- | --- | --- |
| Runtime | Node.js 20+ / TypeScript | Spec examples and strong typing |
| API | Express 4 modular monolith | Thin routes, services, Prisma data access |
| Database | Prisma + SQLite | Runs locally without Docker; schema is portable |
| Auth | JWT + bcrypt | User-owned resources are isolated |
| Queue | Durable `QueueJob` table | Retries/backoff without requiring Redis |
| Files | Local `uploads/` | S3 env vars reserved, not required |
| AI | OpenAI-compatible + heuristic fallback | Works with or without `AI_API_KEY` |
| First job source | Remotive public API + fixtures | Permitted JSON API, no scraping |
| UI | React 19 + Vite (`Harbor`) | Profile, resumes, preferences, jobs, matches, review, tracker |

Reusable modules live under `src/modules/*`. Portal-specific logic stays in `job-source-adapters`. Application execution lives in `application-execution` with a **local fixture adapter** plus an assisted-URL fallback. Playwright is **not** used: no permitted employer portal has been tested.

---

## Quick start

```bash
npm install
npm --prefix client install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

- API: http://localhost:4000/health
- UI: http://localhost:5173
- Demo login: `demo@example.com` / `demo12345`

Copy `.env.example` to `.env` before changing secrets. In production, `JWT_SECRET` must be a unique 32+ character value.

More detail: [API](docs/API.md) · [Deployment](docs/DEPLOYMENT.md)

### Database

SQLite file: `prisma/dev.db`.

```bash
npx prisma db push      # apply schema (recommended locally)
npx prisma generate     # regenerate client
npx prisma studio       # inspect data
```

Prisma uses the **binary** query engine so the app also runs on Windows ARM64 (Node cannot load the x64 `.node` engine).

### Background worker

The API process starts the in-process worker by default. To run it separately:

```bash
# terminal 1
$env:WORKER_SEPARATE="1"
npm run dev:server

# terminal 2
npm run dev:worker
```

### Tests

```bash
npm test
npm run test:e2e
```

Tests use fixtures and mocks only. They do not call live job portals.

---

## API

All application routes except `/api/v1/auth/*` and `/health` require `Authorization: Bearer <token>`.

### Auth

```http
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

### Profile and resumes

```http
POST   /api/v1/profile/parse-resume
GET    /api/v1/profile
PATCH  /api/v1/profile
POST   /api/v1/resumes
GET    /api/v1/resumes
GET    /api/v1/resumes/:id
PATCH  /api/v1/resumes/:id
DELETE /api/v1/resumes/:id
POST   /api/v1/resumes/:id/tailor
```

### Preferences, jobs, applications

```http
GET    /api/v1/preferences
PUT    /api/v1/preferences
POST   /api/v1/preferences/search-preview
POST   /api/v1/jobs/search
GET    /api/v1/jobs
GET    /api/v1/jobs/:id
POST   /api/v1/jobs/:id/match
POST   /api/v1/jobs/bulk-match
POST   /api/v1/jobs/:id/save
DELETE /api/v1/jobs/:id/save
POST   /api/v1/applications/prepare
GET    /api/v1/applications
GET    /api/v1/applications/:id
PATCH  /api/v1/applications/:id
POST   /api/v1/applications/:id/approve
POST   /api/v1/applications/:id/reject
POST   /api/v1/applications/:id/start
POST   /api/v1/applications/:id/continue
POST   /api/v1/applications/:id/retry
POST   /api/v1/applications/:id/confirm-submit
POST   /api/v1/applications/:id/cancel
GET    /api/v1/applications/:id/events
POST   /api/v1/applications/:id/status
GET    /api/v1/tracking/summary
```

### Example requests

```bash
# Register / login
curl -X POST http://localhost:4000/api/v1/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"demo@example.com\",\"password\":\"demo12345\"}"

# Search permitted sources (fixture or Remotive public API)
curl -X POST http://localhost:4000/api/v1/jobs/search ^
  -H "Authorization: Bearer TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"source\":\"fixture\",\"keywords\":[\"typescript\"]}"

# Prepare an application package (does not submit)
curl -X POST http://localhost:4000/api/v1/applications/prepare ^
  -H "Authorization: Bearer TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"jobId\":\"JOB_ID\"}"
```

---

## Environment variables

See `.env.example`. Added keys:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite path, default `file:./dev.db` |
| `JWT_SECRET` | Token signing secret (32+ unique chars required in production) |
| `AI_TIMEOUT_MS` | LLM request timeout, default 20000 |
| `QUEUE_STALE_LOCK_MS` | Re-queue worker jobs stuck `active`, default 300000 |
| `AI_API_KEY` / `AI_MODEL` / `AI_BASE_URL` | Optional LLM; heuristic fallback if empty |
| `STORAGE_DIR` | Local CV storage |
| `APPLICATION_MAX_PER_DAY` | Assisted-apply daily cap |
| `APPLICATION_MAX_EXECUTION_ATTEMPTS` | Max assisted-apply retries per application |
| `JOB_SEARCH_INTERVAL_HOURS` | Scheduled search cadence |
| `REDIS_URL` | Reserved; not required for the built-in queue |

Never hardcode secrets. Passwords, OTPs, cookies, and tokens are redacted from logs.

---

## Compliance rules implemented

1. No CAPTCHA / OTP / MFA / anti-bot bypass
2. No fabricated skills, employers, salary, or notice period
3. No application submission without approval
4. Ambiguous/legal/salary/sponsorship answers require review
5. Execution maps verified fields only, pauses on CAPTCHA/OTP/MFA/login, and never auto-submits
6. Job sources use permitted public APIs or local fixtures
7. Unique `(userId, jobId)` applications and `(sourceId, externalId)` jobs
8. Rate limits on API, uploads, and daily applies
9. Audit events for search, prepare, approve, and status changes

Application states: `DRAFT` → `PENDING_APPROVAL` → `APPROVED` → `IN_PROGRESS` → `REQUIRES_USER_ACTION` / `SUBMITTED` / `FAILED` / `REJECTED` / `WITHDRAWN`.

---

## Known limitations

- Assisted apply only: local fixture mapping plus employer URL. No real portal integration is claimed.
- Playwright is not installed; a session manager exists in memory and never stores cookies or tokens
- Remotive is the first live source; additional portals need new adapters
- Without `AI_API_KEY`, CV parse/match/cover letters use deterministic heuristics
- SQLite is the default store (fine for a single-user copilot; use PostgreSQL for multi-instance production)
- Local disk storage, not S3
- Scheduled search uses the in-process worker, not Redis/BullMQ

## Next recommended steps

1. Add more permitted adapters (Adzuna, Arbeitnow, company ATS APIs)
2. Plug in an LLM key for richer parsing and scoring
3. Optional S3 storage for CVs
4. Optional Redis + BullMQ when running multiple API instances
5. Isolated Playwright adapter **only** for portals that explicitly permit assisted filling
6. PostgreSQL + Docker Compose for a shared production database
