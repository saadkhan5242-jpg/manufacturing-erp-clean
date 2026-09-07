// Migration 010: Central auto-sequencing counters for WORK_ORDER / SALES_ORDER / PURCHASE_ORDER
// Idempotent — safe to replay. Seeds the three counters at a baseline of 1000.

export async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS sequence_counters (
      sequence_type TEXT PRIMARY KEY,
      prefix TEXT NOT NULL,
      current_value INTEGER NOT NULL DEFAULT 1000
    )
  `);

  await client.query(`
    INSERT INTO sequence_counters (sequence_type, prefix, current_value)
    VALUES
      ('WORK_ORDER', 'WO', 1001),
      ('SALES_ORDER', 'SO', 9000),
      ('PURCHASE_ORDER', 'PO', 5000)
    ON CONFLICT (sequence_type) DO NOTHING
  `);

  console.log("Migration 010: sequence_counters table created and seeded");
}

export async function down(client) {
  await client.query(`DROP TABLE IF EXISTS sequence_counters CASCADE`);
  console.log("Migration 010: Rolled back sequence_counters");
}
