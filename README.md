# Keel

Delivery desk for the project manager who runs the IT roster. It covers projects, a kanban, a timeline with dependencies, a task list, and workload for all 20 people.

One person updates everything. Sign-in is Google, limited to an email allowlist. The desk is stored in Cloudflare D1 so it is the same on every device. The app runs on Cloudflare Workers through `@opennextjs/cloudflare`.

## Run locally

```bash
npm install
cp .env.example .env.local
# Fill AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET
npm run d1:migrate:local
npm run dev -- --port 43123
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

The dev server listens on `0.0.0.0`. A first visit, with nothing stored on the server, loads the 20-person IT roster (including Ahmed Salam, CTO) and starts with no projects and no tasks. If this browser still has `keel.desk.v2` in localStorage and the server desk is empty, Keel offers to import it.

`next dev` uses a local D1 (SQLite under `.wrangler/`) because `next.config.ts` calls `initOpenNextCloudflareForDev()`. To preview the Worker runtime instead:

```bash
npm run preview
```

```bash
npm test
npm run build
```

`npm run build` is the Next.js production build (`next build --webpack`). Webpack is required so `next/font/google` resolves on Cloudflare; Turbopack fails with `@vercel/turbopack-next/internal/font/google/font`. `npm run deploy` runs that build through OpenNext, then `wrangler deploy`.

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

None of these are committed. Local `next dev` reads `.env.local`. Production reads Cloudflare Worker secrets (and the `AUTH_TRUST_HOST` var in `wrangler.jsonc`).

| Name | Required | What it is |
| --- | --- | --- |
| `AUTH_SECRET` | Yes | Auth.js cookie encryption secret. At least 32 random characters. `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | Yes | Google OAuth 2.0 Web client ID. |
| `AUTH_GOOGLE_SECRET` | Yes | Google OAuth 2.0 Web client secret. |
| `ALLOWED_EMAILS` | No | Comma-separated Google emails that may read or write. Default: `salle.kma@gmail.com`. |
| `AUTH_URL` | No | Canonical site URL if the host cannot be inferred. Set this to the workers.dev (or custom) URL after the first deploy. |
| `AUTH_TRUST_HOST` | No | Set to `true` so Auth.js trusts `X-Forwarded-Host`. `wrangler.jsonc` already sets this for the Worker. |
| `CLOUDFLARE_API_TOKEN` | For deploy | API token with Workers Scripts, D1, and Account read. Used by Wrangler; do not put it in the Worker. |
| `CLOUDFLARE_ACCOUNT_ID` | For deploy | Cloudflare account id. Used by Wrangler. |

D1 is not a connection string. The Worker binding is **`DB`**, the database name is **`keel`**, configured in `wrangler.jsonc`.

## Cloudflare Workers + D1 + Google OAuth setup

OpenNext deploys Keel as a **Worker** (not Pages). After the first deploy the URL is:

`https://keel.<your-workers-subdomain>.workers.dev`

`<your-workers-subdomain>` is the workers.dev subdomain on the Cloudflare account (Account Home → Workers & Pages). Wrangler prints the exact URL at the end of `npm run deploy`.

### 1. Token and account

1. Create an API token: [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token**.
2. Use a token that can edit Workers, edit D1, and read the account. Account API Tokens with **Workers Scripts:Edit**, **D1:Edit**, and **Account Settings:Read** are enough.
3. Copy the account id from the dashboard URL or **Workers & Pages**.
4. Export them in the shell that will run Wrangler (non-interactive):

```bash
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
```

### 2. Create D1 and apply migrations

```bash
npm run d1:ensure
# writes the real database_id into wrangler.jsonc; commit that change
CI=1 npm run d1:migrate
```

`d1:ensure` runs `wrangler d1 create keel` only if that database does not already exist, then patches `database_id` in `wrangler.jsonc`. `d1:migrate` applies `migrations/*.sql` to the remote `keel` database. `CI=1` skips the Wrangler confirmation prompt.

The first migration creates `keel_desk` (`id`, `data` JSON text, `updated_at`).

Local D1 (for `next dev` / `npm run preview`):

```bash
npm run d1:migrate:local
```

### 3. Put Auth.js secrets on the Worker

These must exist **before or after** the first deploy. `printf` keeps `wrangler secret put` non-interactive:

```bash
printf '%s' "$AUTH_SECRET" | npx wrangler secret put AUTH_SECRET
printf '%s' "$AUTH_GOOGLE_ID" | npx wrangler secret put AUTH_GOOGLE_ID
printf '%s' "$AUTH_GOOGLE_SECRET" | npx wrangler secret put AUTH_GOOGLE_SECRET
printf '%s' "salle.kma@gmail.com" | npx wrangler secret put ALLOWED_EMAILS
```

After you know the workers.dev host:

```bash
printf '%s' "https://keel.<your-workers-subdomain>.workers.dev" | npx wrangler secret put AUTH_URL
```

`npm run deploy` uses `wrangler deploy --keep-vars` so these secrets and the `AUTH_TRUST_HOST` var are not wiped.

### 4. Deploy

```bash
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
npm run deploy
```

That runs `opennextjs-cloudflare build` (which calls `next build --webpack`) and then `wrangler deploy --keep-vars`. No Wrangler login prompt. Preview URLs are off (`preview_urls: false`); `workers.dev` stays on.

### 5. Google OAuth client

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → the project that should own Keel sign-in (or create one).
2. **APIs & Services** → **OAuth consent screen**. User type can be External. App name `Keel`. Add the allowlisted emails as test users while the consent screen is in Testing.
3. **Credentials** → **Create credentials** → **OAuth client ID** → application type **Web application**.
4. Authorized JavaScript origins:
   - `https://keel.<your-workers-subdomain>.workers.dev`
   - `http://127.0.0.1:43123`
   - `http://localhost:43123`
5. Authorized redirect URIs:
   - `https://keel.<your-workers-subdomain>.workers.dev/api/auth/callback/google`
   - `http://127.0.0.1:43123/api/auth/callback/google`
   - `http://localhost:43123/api/auth/callback/google`
6. If you later attach a custom domain, add that origin and `https://<custom-domain>/api/auth/callback/google` as well.
7. Copy the client ID and secret into `.env.local` and into the Worker secrets above.

If you instead publish through Cloudflare Pages, the host is `https://<project>.pages.dev` and the redirect URI is `https://<project>.pages.dev/api/auth/callback/google`. This repo deploys with Wrangler as a Worker, so use the workers.dev URL unless you change that.

### 6. What the APIs do

- `GET /api/auth/*` and `POST /api/auth/*` — Auth.js (Google sign-in, session, sign-out).
- `GET /api/desk` — load the desk. **401** with no session. **403** if the signed-in email is not allowlisted.
- `PUT /api/desk` — save the desk after every edit. Same 401/403 rules.

Pages other than `/login` redirect to Google sign-in when there is no session. Data APIs never redirect; they return 401 so a missing cookie cannot be mistaken for an empty desk.
