# PostgreSQL foundation

The repository now contains the first relational schema migration in `db/migrations/001_core_schema.sql`.

## Local setup

1. Start PostgreSQL from the repository root:

```powershell
docker compose up -d postgres
```

2. Copy the environment template and set the database URL:

```powershell
Copy-Item backend\.env.example backend\.env
```

Use:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/manufacturing_erp
```

3. Install backend dependencies and run migrations:

```powershell
cd backend
npm install
npm run db:check
npm run db:migrate
```

The current API still uses the JSON repository so existing screens remain stable. The next migration slice should move products, work centers, suppliers, and purchase orders to PostgreSQL repositories, then remove their JSON model imports after parity tests pass.
