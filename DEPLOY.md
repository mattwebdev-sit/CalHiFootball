# Deploying CalHiFootball

The site is a Next.js app backed by Prisma. In production it uses **Turso**
(hosted libSQL, i.e. serverless SQLite) so the database works on serverless
hosts like **Vercel**. Locally it keeps using the plain `prisma/dev.db` file —
no code changes needed to switch between them; it's controlled by env vars.

The Prisma client (`lib/db.ts`) uses Turso whenever `TURSO_DATABASE_URL` is set,
and otherwise falls back to the local `DATABASE_URL` file. That means the same
`npm run ingest` / `npm run rate` scripts can update either the local DB (dev)
or the live Turso DB (prod), just by toggling env vars.

## One-time setup

### 1. Turso database — ALREADY PROVISIONED ✅

The production database is already created and loaded with all current data
(12 sections, 236 leagues, 1,298 teams, 5,986 games, 1,298 rating snapshots),
in the `aws-us-west-2` (Oregon) region.

- `TURSO_DATABASE_URL` = `libsql://calhifootball-mattwebdev-sit.aws-us-west-2.turso.io`
- `TURSO_AUTH_TOKEN` = saved locally in `.env.turso.local` (gitignored)

To re-load from your local DB later (rarely needed):

```powershell
cmd /c "sqlite3 prisma\dev.db .dump > turso-seed.sql"
npm run load:turso        # reads TURSO_* from your environment
```

### 2. Put the project in git and deploy to Vercel

```powershell
git init
git add -A
git commit -m "Initial commit"
```

Then either:

- **Vercel CLI** (no GitHub needed):

  ```powershell
  npm i -g vercel
  vercel            # follow prompts to link/create the project
  vercel --prod
  ```

- **or** push to a GitHub repo and click "Import Project" at vercel.com.

### 3. Set environment variables in Vercel

In the Vercel project → Settings → Environment Variables, add (Production +
Preview):

| Name                 | Value                                             |
| -------------------- | ------------------------------------------------- |
| `TURSO_DATABASE_URL` | the `libsql://...` URL from step 1                |
| `TURSO_AUTH_TOKEN`   | the token from step 1                             |
| `DATABASE_URL`       | `file:./dev.db` (placeholder; `prisma generate` needs it set) |

Redeploy after adding them (`vercel --prod`, or push a commit). The build runs
`prisma generate` automatically via the `postinstall` script.

You'll get a temporary URL like `calhifootball.vercel.app`. Add the real domain
later in Vercel → Settings → Domains.

## Publishing new scores after launch

Ingest writes to whichever DB the env vars point at. To update the **live**
site, run the ingest with the Turso vars set, e.g.:

```powershell
$env:TURSO_DATABASE_URL = "libsql://...";
$env:TURSO_AUTH_TOKEN   = "...";
npm run ingest -- sbl-range 2026-09-11 2026-09-14 --refresh
```

Because the pages are dynamic, the site reflects the new scores immediately — no
redeploy required. (Unset the vars, or open a new shell, to go back to updating
your local dev database.)

> Tip: you can automate this on a schedule with a GitHub Action that runs the
> ingest with the Turso secrets, so scores refresh without you doing anything.
