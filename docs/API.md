# Harbor API

Base URL: `http://localhost:4000`

Authenticated routes expect `Authorization: Bearer <token>`. Every response includes `x-correlation-id`. Send the same header to tie client logs to server logs.

Error shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid request" } }
```

## Public

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | `{ ok, service, db }` — 503 if the database is down |
| POST | `/api/v1/auth/register` | `{ email, name, password }` → `{ user, token }` |
| POST | `/api/v1/auth/login` | `{ email, password }` → `{ user, token }` |
| GET | `/api/v1/auth/me` | Current user |

Auth routes are rate-limited separately from the general API limiter.

## Profile and resumes

| Method | Path |
| --- | --- |
| GET / PATCH | `/api/v1/profile` |
| POST | `/api/v1/profile/parse-resume` | multipart `file` |
| POST / GET | `/api/v1/resumes` |
| GET / PATCH / DELETE | `/api/v1/resumes/:id` |
| GET | `/api/v1/resumes/:id/file` |
| POST | `/api/v1/resumes/:id/tailor` | `{ jobId }` |
| GET | `/api/v1/files/*` | owner-only, path-checked |

Only PDF and DOCX are accepted. Content is checked against file magic bytes. Original files are never overwritten.

## Jobs and preferences

| Method | Path |
| --- | --- |
| GET / PUT | `/api/v1/preferences` |
| POST | `/api/v1/preferences/search-preview` |
| POST | `/api/v1/jobs/search` | `{ source?, keywords?, async? }` |
| GET | `/api/v1/jobs` `/api/v1/jobs/sources` `/api/v1/jobs/:id` |
| POST | `/api/v1/jobs/:id/match` `/api/v1/jobs/bulk-match` |
| POST / DELETE | `/api/v1/jobs/:id/save` |

Sources: `fixture` (local) and `remotive` (public JSON API). Portal HTML scraping is not implemented.

## Applications

Nothing is submitted to an employer by these endpoints.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/v1/applications/prepare` | `{ jobId, resumeVersionId? }` |
| GET | `/api/v1/applications` `/api/v1/applications/:id` |
| PATCH | `/api/v1/applications/:id` | Edit cover letter, draft, answers |
| POST | `/api/v1/applications/:id/approve` | Requires filled review fields |
| POST | `/api/v1/applications/:id/reject` `/cancel` |
| POST | `/api/v1/applications/:id/start` | Assisted apply; often `REQUIRES_USER_ACTION` |
| POST | `/api/v1/applications/:id/continue` | `{ completedCheckpoints }` — user-reported only |
| POST | `/api/v1/applications/:id/retry` | From `FAILED` |
| POST | `/api/v1/applications/:id/confirm-submit` | User confirms they submitted |
| GET | `/api/v1/applications/:id/events` |
| POST | `/api/v1/applications/:id/status` | `{ status, applicationUrl?, errorMessage? }` |
| GET | `/api/v1/tracking/summary` |

Valid statuses include `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `IN_PROGRESS`, `REQUIRES_USER_ACTION`, `READY_FOR_SUBMISSION`, `SUBMITTED`, `FAILED`, `REJECTED`, `WITHDRAWN`. Illegal transitions return 400.

## Other

| Method | Path |
| --- | --- |
| GET | `/api/v1/notifications` |
| POST | `/api/v1/notifications/:id/read` |
| GET | `/api/v1/settings` |

Settings lists job sources and execution adapters. `testedAgainstPortal` is `false` unless a portal has actually been tested.
