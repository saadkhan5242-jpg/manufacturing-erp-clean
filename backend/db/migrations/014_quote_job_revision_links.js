// Migration 014: revision and BOM linkage for quote-to-job conversion.

export async function up(client) {
  await client.query(`
    ALTER TABLE fl_quotes
      ADD COLUMN IF NOT EXISTS revision TEXT NOT NULL DEFAULT 'Rev A',
      ADD COLUMN IF NOT EXISTS bom_id BIGINT REFERENCES boms(id) ON DELETE SET NULL
  `);
  await client.query(`
    ALTER TABLE fl_jobs
      ADD COLUMN IF NOT EXISTS revision TEXT NOT NULL DEFAULT 'Rev A',
      ADD COLUMN IF NOT EXISTS bom_id BIGINT REFERENCES boms(id) ON DELETE SET NULL
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_fl_quotes_bom ON fl_quotes(bom_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_fl_jobs_bom ON fl_jobs(bom_id)`);
}

export async function down(client) {
  await client.query(`ALTER TABLE fl_jobs DROP COLUMN IF EXISTS bom_id, DROP COLUMN IF EXISTS revision`);
  await client.query(`ALTER TABLE fl_quotes DROP COLUMN IF EXISTS bom_id, DROP COLUMN IF EXISTS revision`);
}
