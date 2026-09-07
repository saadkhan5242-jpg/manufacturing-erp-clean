import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../db/pool.js";

const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");

async function migrate() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to run migrations");
  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  const applied = new Set((await pool.query("SELECT version FROM schema_migrations")).rows.map((row) => row.version));
  const files = (await readdir(migrationsDirectory)).filter((file) => (file.endsWith(".sql") && !file.endsWith(".up.sql") && !file.endsWith(".down.sql")) || file.endsWith(".js")).sort();

  for (const file of files) {
    const version = basename(file, ".sql");
    if (applied.has(version)) continue;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (file.endsWith(".js")) {
        const migration = await import(new URL(`../db/migrations/${file}`, import.meta.url));
        await migration.up(client);
      } else {
        await client.query(await readFile(join(migrationsDirectory, file), "utf8"));
      }
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      await client.query("COMMIT");
      console.log(`Applied migration ${version}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  console.log("Database migrations are up to date.");
}

migrate().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
