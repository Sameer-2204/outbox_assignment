# Outbox — Email Scheduler Service & Dashboard

A mini ReachInbox: a reliable email scheduler with a Next.js dashboard. Users log in with Google, upload leads, and schedule emails to go out at specific times with throttling. Emails are sent through Ethereal (fake SMTP). The system survives restarts without losing or duplicating anything.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Next.js App   │────▶│   Express API    │────▶│  PostgreSQL  │
│   (Frontend)    │     │   (Backend)      │     │  (Prisma)    │
└─────────────────┘     │                  │     └─────────────┘
                        │  ┌────────────┐  │     ┌─────────────┐
                        │  │ Bull Board │  │────▶│    Redis     │
                        │  └────────────┘  │     │  (BullMQ)   │
                        │                  │     └─────────────┘
                        └──────┬───────────┘     ┌───────────────┐
                               │                 │ Elasticsearch  │
                        ┌──────▼───────────┐     └───────────────┘
                        │  BullMQ Worker   │
                        │  (send emails)   │────▶ Ethereal SMTP
                        │  (rate limit)    │────▶ Slack Webhook
                        └──────────────────┘
```

### How Scheduling Works

1. User submits a schedule request with recipients, subject, body, start time, and delay between emails.
2. The API creates one row per email in Postgres (`status: SCHEDULED`) and one BullMQ delayed job per email.
3. Each job's delay is computed as: `startTime + (index × delayBetweenSeconds)`.
4. The BullMQ worker picks up jobs when their delay expires and sends the email via Ethereal SMTP.
5. After a successful send, the worker updates the DB status to `SENT` and updates Elasticsearch.

### How Persistence Across Restarts Works

- **Redis AOF**: Docker Compose starts Redis with `--appendonly yes --appendfsync everysec`. This means BullMQ delayed jobs are persisted to disk every second. On restart, Redis replays the AOF log, and all pending jobs resume at their correct scheduled times.
- **`jobId = emailId`**: Each BullMQ job uses the Postgres email ID as its job ID. This prevents the same email from being queued twice if the scheduling endpoint is called again.
- **Idempotency check**: Before sending, the worker queries the DB. If `status === 'SENT'`, it skips the job. This handles the case where a job is retried after a crash.

### Crash Window Trade-off

There is a small window between "SMTP success" and "DB update marked as SENT". If the process crashes in this window:
- The email **was sent** via SMTP.
- The DB still shows `SCHEDULED`.
- BullMQ may retry the job (depending on whether it acknowledged completion before the crash).
- The idempotency check in the worker would still see `SCHEDULED` and send again → **possible duplicate**.

**Mitigation**: This is a fundamental at-least-once delivery trade-off. True exactly-once would require transactional outbox pattern with SMTP (not possible with standard SMTP). In practice, the window is microseconds (DB update immediately follows SMTP send), and Ethereal is a test service. For production, you would add a unique message-ID check or use an idempotent email service API.

### Rate Limiting Implementation

- **Redis atomic counters**: Key format `ratelimit:{sender}:{hourWindow}` where `hourWindow = floor(timestamp / 3600000)`.
- Uses `INCR` + `EXPIRE` (2-hour TTL for safety).
- Multi-worker safe: each worker atomically increments before sending.
- **When limit is hit**: the job is NOT dropped or failed. Instead, the worker finds the next available hour window (scans ahead up to 24 hours) and creates a new delayed BullMQ job for that time.
- **Per-request override**: The compose form's "hourly limit" value is passed with the schedule request and stored per-job. It takes precedence over the global `MAX_EMAILS_PER_HOUR_PER_SENDER` env var. The per-request value wins because it's stored in the job data and passed to the rate limiter at send time.

### What Happens with 1000+ Emails at the Same Time

With `MAX_EMAILS_PER_HOUR_PER_SENDER=5`:
1. First 5 emails send successfully in the current hour window.
2. Email #6 triggers a rate-limit event → Slack notification sent (once per sender per hour).
3. Emails 6-10 are re-scheduled to the next hour window.
4. This cascades: each hour window absorbs 5 more emails.
5. 1000 emails with limit=5 would take 200 hours to fully deliver.

Run the simulation: `cd backend && npm run simulate`

### Concurrency

- `WORKER_CONCURRENCY` (default: 3) controls how many jobs process in parallel.
- `MIN_SEND_DELAY_MS` (default: 2000ms) adds a sleep after each send to throttle SMTP connections.
- Rate limiting is Redis-based and safe with multiple concurrent workers or even multiple worker processes.

---

## How to Run

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- A Google Cloud project with OAuth 2.0 credentials
- Ethereal email accounts
- (Optional) A Slack app for notifications

### 1. Start Infrastructure

```bash
docker-compose up -d
```

This starts Redis (with AOF persistence), PostgreSQL, and Elasticsearch.

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials (see below)
npm install
npx prisma db push
npm run dev        # Starts Express server on port 4000
```

In a second terminal:
```bash
cd backend
npm run worker     # Starts BullMQ worker
```

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env
# Edit .env with API URL
npm install
npm run dev        # Starts Next.js on port 3000
```

### 4. Access

- **Dashboard**: http://localhost:3000
- **Bull Board**: http://localhost:4000/admin/queues
- **API Health**: http://localhost:4000/health

---

## Environment Variables

### How to Obtain Each Value

#### Google OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select existing)
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client IDs**
5. Application type: **Web application**
6. Add authorized redirect URI: `http://localhost:4000/auth/google/callback`
7. Copy the Client ID and Client Secret

#### Ethereal SMTP (`ETHEREAL_ACCOUNTS`)
1. Go to https://ethereal.email/create
2. Click "Create Account" to generate a test mailbox
3. Copy the email and password
4. Format: `email:password` (comma-separated for multiple accounts)
5. Example: `john.doe@ethereal.email:abc123,jane.doe@ethereal.email:xyz456`
6. You can view sent emails at https://ethereal.email → Messages (login with the account)

#### Slack App (`SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`)
1. Go to [Slack API](https://api.slack.com/apps)
2. Click **Create New App → From scratch**
3. Name it "Outbox Notifications", pick a workspace
4. Go to **OAuth & Permissions**
5. Add redirect URL: `http://localhost:4000/api/slack/callback`
6. Go to **Basic Information** → copy Client ID and Client Secret
7. Under **Incoming Webhooks**, toggle it **ON**

#### Other Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://outbox:outbox_pass@localhost:5432/outbox_db` |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `ELASTICSEARCH_URL` | ES endpoint | `http://localhost:9200` |
| `SESSION_SECRET` | Random string for session | (generate with `openssl rand -base64 32`) |
| `JWT_SECRET` | Random string for JWT signing | (generate with `openssl rand -base64 32`) |
| `PORT` | Backend port | `4000` |
| `FRONTEND_URL` | Frontend URL for CORS & redirects | `http://localhost:3000` |
| `WORKER_CONCURRENCY` | Parallel job processing | `3` |
| `MIN_SEND_DELAY_MS` | Minimum delay between sends | `2000` (2 seconds) |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Global hourly rate limit per sender | `50` |
| `NEXT_PUBLIC_API_URL` | Backend URL (frontend) | `http://localhost:4000` |

---

## Feature Checklist

### Backend
- [x] **Scheduling API** — POST endpoint accepts subject, body, recipients, startTime, delayBetweenSeconds, hourlyLimit, sender
- [x] **Persistence** — Each email persisted in Postgres with status tracking (SCHEDULED/SENT/FAILED)
- [x] **BullMQ delayed jobs** — One job per email, delay = startTime + index × delay
- [x] **Idempotency** — `jobId = emailId` prevents duplicate queueing; worker checks DB status before sending
- [x] **Restart resilience** — Redis AOF persistence; jobs survive restart at correct times
- [x] **Worker concurrency** — Configurable via `WORKER_CONCURRENCY` env var
- [x] **Minimum send delay** — Configurable via `MIN_SEND_DELAY_MS` env var (default 2s)
- [x] **Multiple senders** — Configured via `ETHEREAL_ACCOUNTS` env var; round-robin assignment
- [x] **Hourly rate limit** — Redis atomic counters per sender per hour window
- [x] **Rate limit rollover** — Delayed jobs moved to next available hour window, not dropped
- [x] **Slack notifications** — Real OAuth v2 with incoming-webhook scope; webhook stored per user
- [x] **Slack deduplication** — At most one notification per sender per hour window
- [x] **Slack disconnect** — Remove webhook from DB; notifications stop immediately
- [x] **Elasticsearch** — Index all emails; update on status change; full-text search endpoint
- [x] **Bull Board** — Mounted at `/admin/queues`
- [x] **Auth** — JWT-based; Google OAuth via Passport; token in Authorization header
- [x] **Load simulation** — Script schedules 100 emails with limit=5

### Frontend
- [x] **Google OAuth login** — Real OAuth flow, redirects to Google
- [x] **Dashboard** — Sidebar with Scheduled/Sent tabs and counts
- [x] **Compose** — Full-page form with all fields: from, to (chips + CSV upload), subject, body, delay, hourly limit, start time
- [x] **Scheduled Emails list** — Shows recipient, scheduled time, subject, body preview; loading and empty states
- [x] **Sent Emails list** — Shows recipient, status badge, subject, body preview; loading and empty states
- [x] **Search** — Full-text search via Elasticsearch
- [x] **Slack control** — Connect/Disconnect with status display
- [x] **Reusable components** — Button, Input, TextArea, Modal, Tabs, Toast, EmailList
- [x] **Type safety** — Typed API responses and component props
- [x] **Error handling** — Toast notifications for all error states
- [x] **Auto-refresh** — Dashboard refreshes every 10 seconds

---

## Assumptions, Shortcuts, and Trade-offs

1. **No email/password login**: The Figma shows email/password fields, but the requirement specifies Google OAuth only. The fields are rendered as disabled with a note.

2. **Email detail view**: The Figma shows an email detail view with rich content. This is not implemented as it's not in the requirements list. The dashboard shows email list rows with body previews.

3. **Rich text editor**: The compose form has a visual toolbar but it's decorative. The body field is a plain textarea. A full rich text editor (Tiptap, Slate) would add significant complexity beyond scope.

4. **Attachments**: The Figma shows file attachments. Not implemented as it's not in the requirements.

5. **Multiple sender selection**: When multiple Ethereal accounts are configured, emails are assigned to senders in round-robin. The compose form shows a sender dropdown.

6. **Rate limit per-request vs global**: Per-request hourly limit wins. It's stored in the BullMQ job data and passed to the rate limiter at processing time.

7. **Timezone**: The compose form uses the browser's local timezone. The "Send Later" panel shows the detected timezone.

8. **Elasticsearch availability**: If ES is down, the app still works. ES operations fail silently (logged to console). Search returns an error toast.

9. **No pagination**: Email lists are capped at 200 rows. For production, you'd add cursor-based pagination.

10. **Bull Board is unauthenticated**: Mounted at `/admin/queues` with no auth for simplicity. In production, add basic auth or IP restriction.
