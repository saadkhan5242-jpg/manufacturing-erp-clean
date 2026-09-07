# Cloud Database Migration — Local → Managed PostgreSQL (Supabase / Neon)

This project executes raw parameterized SQL via `backend/db/pool.js` (the `pg`
driver) using versioned migrations in `backend/db/migrations/`. The
`backend/prisma/schema.prisma` file is the canonical relational reference. All
cloud migration steps below keep the exact same table/column contract.

---

## Step 1 — Provision a managed PostgreSQL instance
- **Neon.tech**: Create a project → copy the **pooled connection string**:
  `postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require`
- **Supabase**: Project Settings → Database → use the **Connection Pooling** string (port 6543):
  `postgresql://postgres.PROJECT:PASSWORD@HOST.pooler.supabase.com:6543/postgres?sslmode=require`

## Step 2 — Point the backend at the cloud database
Edit `backend/.env` (never commit real credentials):
```
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
DATABASE_SSL=true
DATABASE_POOL_MAX=10
```
`backend/db/pool.js` already reads `DATABASE_URL` and enables TLS when
`DATABASE_SSL === "true"`. No code change is required — only env values.

## Step 3 — Update the Prisma datasource reference (optional, schema parity)
`backend/prisma/schema.prisma` already reads the connection from the environment:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
No edit needed — it inherits the same cloud `DATABASE_URL`. If you later adopt the
Prisma Client, run `npx prisma generate` (and `npx prisma db pull` to introspect).

## Step 4 — Apply the full schema to the cloud instance
From `backend/` (on Node ≥ 20):
```powershell
$env:Path = "C:\Users\saadk\AppData\Local\nvm\v20.20.2;" + $env:Path
node scripts/migrate.js
```
Migrations 001→009 replay idempotently (`CREATE TABLE IF NOT EXISTS`, guarded seeds),
building core schema + WIP engine + MRP + BOM + closed-loop WIP/GL tables remotely.

## Step 5 — Verify connectivity
```powershell
node scripts/checkDatabase.js
```
Expected: `PostgreSQL connected at <timestamp>` against the cloud host.

---

## Frontend / Desktop client → cloud backend
The desktop client never talks to the DB directly — it calls the Express API.
Set the deployed API origin via `frontend/.env.production`:
```
VITE_API_URL=https://your-deployed-api.example.com
```
`frontend/src/config.js` picks `VITE_API_URL` in production builds, and the
`frontend/src/utils/api.js` fetch shim rewrites every `localhost:4000` / relative
`/api`,`/ai` call to that origin automatically. Rebuild the desktop app:
```powershell
cd frontend
npm run electron:build
```
The packaged client now routes all data calls to the cloud backend over HTTPS.
