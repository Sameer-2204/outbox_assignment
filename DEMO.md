# DEMO Script — Outbox Email Scheduler (< 5 minutes)

This script walks through the core features. Have two terminal windows ready.

---

## Setup (do once before recording)

```bash
# Start infra
docker-compose up -d

# Terminal 1: Backend
cd backend
cp .env.example .env   # Edit with your real credentials
npm install
npx prisma db push
npm run dev

# Terminal 2: Worker
cd backend
npm run worker

# Terminal 3: Frontend
cd frontend
cp .env.example .env   # Set NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev
```

Ensure Ethereal accounts are set in `.env` and Google OAuth is configured.

---

## Demo Steps

### 1. Login (30s)
1. Open http://localhost:3000 — you're redirected to `/login`.
2. Click **"Login with Google"**.
3. Complete Google OAuth.
4. You land on the dashboard. Note the sidebar: your name, email, avatar, and the "ONB" logo.

### 2. Schedule Emails (60s)
1. Click **"Compose"** in the sidebar.
2. The full compose page opens. Note the "Send Later" panel on the right.
3. **From**: Select a sender (your Ethereal account).
4. **To**: Type `alice@example.com`, press Enter. Type `bob@example.com`, press Enter.
5. **Upload a CSV**: Click "Upload List" and select a CSV with emails (one per line or comma-separated). Notice the recipient count updates.
6. **Subject**: Type `Meeting Follow-up`.
7. **Body**: Type `Hi, just wanted to follow up on our meeting...`.
8. **Delay between emails**: Set to `5` seconds.
9. **Hourly Limit**: Set to `50`.
10. **Start time**: Pick a time ~1 minute from now.
11. Notice the "Schedule preview" on the right showing staggered times.
12. Click **"Save"**. Toast confirms scheduling.

### 3. View Scheduled Tab (20s)
1. You're back on the dashboard. The **Scheduled** tab is active.
2. See the emails listed with orange time badges and body previews.
3. Note the count badge on the "Scheduled" tab in the sidebar.

### 4. Watch Emails Send (30s)
1. Wait for the start time to arrive.
2. Watch the **worker terminal** — it logs each email being processed and sent.
3. Click the **refresh icon** (↻) in the dashboard.
4. Emails move from Scheduled to Sent.
5. Switch to the **Sent** tab — see the green "Sent" badges.

### 5. View Bull Board (20s)
1. Open http://localhost:4000/admin/queues in a new tab.
2. Show the `email-send` queue.
3. Point out completed jobs, delayed jobs, and any failed jobs.

### 6. Restart Resilience (60s)
1. Schedule a batch of 5 emails with start time ~2 minutes from now.
2. Verify they appear in the Scheduled tab.
3. **Stop the worker** (Ctrl+C in Terminal 2).
4. **Stop the backend** (Ctrl+C in Terminal 1).
5. Wait 10 seconds.
6. **Restart backend**: `npm run dev`
7. **Restart worker**: `npm run worker`
8. Wait for the scheduled time to arrive.
9. **Result**: The emails still send at the correct time! The worker picks up delayed jobs from Redis (AOF-persisted).
10. Refresh the dashboard — they show in the Sent tab.

### 7. Rate Limiting (60s)
1. Click **Compose**.
2. Add 10 recipients (e.g., `test1@example.com` through `test10@example.com`).
3. Set **Hourly Limit** to `3`.
4. Set **Delay** to `1` second.
5. Set start time to ~30 seconds from now.
6. Click **Save**.
7. Watch the worker terminal:
   - First 3 emails send.
   - Email #4 logs: "Rate limit hit for sender..."
   - Email #4+ are re-scheduled to the next hour window.
8. If Slack is connected, check your Slack channel — you'll see the rate-limit notification.

### 8. Slack Integration (30s)
1. In the dashboard, find the Slack bar below the search box.
2. Click **"Connect Slack"**.
3. Complete the Slack OAuth flow (authorize incoming webhook).
4. You're redirected back with a success toast.
5. The bar now shows "Slack connected to [workspace] (#channel)".
6. Trigger a rate limit (schedule emails with low limit) to see the Slack notification.
7. Click **"Disconnect"** to remove the connection.

### 9. Search (15s)
1. Type a keyword in the search box (e.g., "Meeting" or a recipient name).
2. Results filter in real-time via Elasticsearch.
3. Clear the search to return to the normal view.

---

## Load Test (optional, not in video)

```bash
cd backend
npm run simulate
```

This schedules 100 emails with hourly limit of 5. Watch the worker logs to see rate limiting cascade emails across hour windows.

---

## Tips for Recording
- Use a clean browser profile (no extensions visible).
- Have Ethereal open in another tab to show received emails.
- Keep both terminal windows visible to show server and worker logs.
- Use a 1920×1080 resolution.
