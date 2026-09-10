import pg from "pg";

const { Pool } = pg;

const isSslRequired =
  process.env.DATABASE_SSL === "true" ||
  process.env.NODE_ENV === "production" ||
  (process.env.DATABASE_URL && /sslmode=|neon\.tech|render\.com|aws\.neon/i.test(process.env.DATABASE_URL));

export function isDatabaseError(error) {
  return Boolean(
    error &&
    (error.code || /database|connection|pool|timeout|ECONN|ENOTFOUND|ETIMEDOUT|terminating connection/i.test(error.message || ""))
  );
}

function decorateDatabaseError(error) {
  if (!isDatabaseError(error)) return error;
  error.statusCode = error.statusCode || 503;
  error.isDatabaseUnavailable = true;
  error.publicMessage = "Database temporarily unavailable. The API is starting up or reconnecting.";
  error.retryable = true;
  return error;
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_MAX || 5),
  idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS || 8000),
  ssl: isSslRequired ? { rejectUnauthorized: false } : undefined
});

pool.on("error", (error) => {
  console.error("Database pool connection error:", error.message);
});

export async function query(text, values) {
  try {
    return await pool.query(text, values);
  } catch (error) {
    throw decorateDatabaseError(error);
  }
}

export async function withTransaction(callback) {
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    throw decorateDatabaseError(error);
  } finally {
    if (client) client.release();
  }
}
