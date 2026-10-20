# Keel

Delivery desk for the project manager who runs the IT roster. It covers projects, a kanban, a timeline with dependencies, a task list, and workload for all 20 people.

One person updates everything. Sign-in is Google, limited to an email allowlist. The desk is stored in Neon Postgres so it is the same on every device.

## Run locally

```bash
npm install
cp .env.example .env.local
# Fill DATABASE_URL, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET
npm run dev -- --port 43123
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

The dev server listens on `0.0.0.0`. A first visit, with nothing stored on the server, loads the 20-person IT roster (including Ahmed Salam, CTO) and starts with no projects and no tasks. If this browser still has `keel.desk.v2` in localStorage and the server desk is empty, Keel offers to import it.

```bash
npm test
npm run build
```

## Roster

People come from the IT staff list. Each record has a stable id, name, designation, department, and email. Departments are Software Engineering, Data Services, Cloud & Security, and IT.

Project owners and task assignees are chosen from that full list, by name, with department shown so teams are easy to tell apart. Assignments store the person id, not the email, so Google sign-in can match the address without moving work.

## Status

Keel does not ask you to type "on track."

- **On hold** when the project is on hold. A past due date does not call it late.
- **Done** when the project is marked done, or every task is done. Progress shows 100% when there are tasks.
- **Off track** when the due date is before today, or the share of tasks finished is more than 20 points behind the share of time between start and due.
- **On track** otherwise.

Progress is done tasks divided by all tasks, or 0 when a project has none. A task that is not done and whose due date is before today is overdue.

Workload treats open work as anything not done. Comfortable is two or fewer open tasks and nothing overdue. Busy is three or four open, or one overdue. Overloaded is five or more open, or two or more overdue.

## Environment variables and secrets

Set these in `.env.local` for development and in the Vercel project for production. None of them are committed.

| Name | Required | What it is |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon Postgres connection string (pooled is fine). Created by the Vercel Neon integration. |
| `AUTH_SECRET` | Yes | Auth.js cookie encryption secret. At least 32 random characters. `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | Yes | Google OAuth 2.0 Web client ID. Auth.js also accepts this as the inferred `AUTH_GOOGLE_ID`. |
| `AUTH_GOOGLE_SECRET` | Yes | Google OAuth 2.0 Web client secret. |
| `ALLOWED_EMAILS` | No | Comma-separated Google emails that may read or write. Default: `salle.kma@gmail.com`. |
| `AUTH_URL` | No | Canonical site URL if the host cannot be inferred. Production: `https://keel-zeta-five.vercel.app`. |
| `AUTH_TRUST_HOST` | No | Set to `true` if Auth.js should trust `X-Forwarded-Host`. Vercel already sets `VERCEL=1`, which Auth.js treats as trusted. |

## Vercel + Neon + Google OAuth setup

Production URL: [https://keel-zeta-five.vercel.app](https://keel-zeta-five.vercel.app).

### 1. Neon database (Vercel Marketplace)

1. Open the Keel project in Vercel → **Storage** (or **Integrations** / **Marketplace**).
2. Create a **Neon** Postgres database on the free tier. The Vercel integration writes `DATABASE_URL` (and usually `DATABASE_URL_UNPOOLED`) onto the project.
3. Redeploy after the env vars appear so production can reach Neon.
4. The app creates a `keel_desk` table on first authenticated request. No manual SQL is required.

### 2. Auth.js secret on Vercel

1. Generate a secret: `openssl rand -base64 32`
2. Vercel → Keel → **Settings** → **Environment Variables**
3. Add `AUTH_SECRET` for Production, Preview, and Development.

### 3. Google OAuth client

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → the project that should own Keel sign-in (or create one).
2. **APIs & Services** → **OAuth consent screen**. User type can be External. App name `Keel`. Add the allowlisted emails as test users while the consent screen is in Testing.
3. **Credentials** → **Create credentials** → **OAuth client ID** → application type **Web application**.
4. Authorized JavaScript origins:
   - `https://keel-zeta-five.vercel.app`
   - `http://127.0.0.1:43123`
   - `http://localhost:43123`
5. Authorized redirect URIs:
   - `https://keel-zeta-five.vercel.app/api/auth/callback/google`
   - `http://127.0.0.1:43123/api/auth/callback/google`
   - `http://localhost:43123/api/auth/callback/google`
6. Copy the client ID and secret into Vercel (and `.env.local`) as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
7. Optional: set `AUTH_URL=https://keel-zeta-five.vercel.app` on Vercel Production.
8. Optional: set `ALLOWED_EMAILS=salle.kma@gmail.com` (or a comma-separated list). If unset, only `salle.kma@gmail.com` can sign in.

After env vars change, redeploy the Vercel project.

### 4. What the APIs do

- `GET /api/auth/*` and `POST /api/auth/*` — Auth.js (Google sign-in, session, sign-out).
- `GET /api/desk` — load the desk. **401** with no session. **403** if the signed-in email is not allowlisted.
- `PUT /api/desk` — save the desk after every edit. Same 401/403 rules.

Pages other than `/login` redirect to Google sign-in when there is no session. Data APIs never redirect; they return 401 so a missing cookie cannot be mistaken for an empty desk.
