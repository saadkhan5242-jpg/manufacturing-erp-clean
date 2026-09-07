import pg from "pg";

const { Pool } = pg;

const isSslRequired =
  process.env.DATABASE_SSL === "true" ||
  process.env.NODE_ENV === "production" ||
  (process.env.DATABASE_URL && /sslmode=|neon\.tech|render\.com|aws\.neon/i.test(process.env.DATABASE_URL));

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: isSslRequired ? { rejectUnauthorized: false } : undefined
});

export async function query(text, values) {
  return pool.query(text, values);
}

export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
