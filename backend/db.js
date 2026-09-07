import "dotenv/config";
import { pool, query, withTransaction } from "./db/pool.js";

export { pool, query, withTransaction };

export async function closeDatabase() {
  await pool.end();
}

export async function databaseHealth() {
  const result = await query("SELECT NOW() AS server_time");
  return result.rows[0];
}
