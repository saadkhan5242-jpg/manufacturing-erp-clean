import "dotenv/config";
import { pool } from "../db/pool.js";

try {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  const result = await pool.query("SELECT NOW() AS server_time");
  console.log(`PostgreSQL connected at ${result.rows[0].server_time.toISOString()}`);
} catch (error) {
  console.error(`PostgreSQL check failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
