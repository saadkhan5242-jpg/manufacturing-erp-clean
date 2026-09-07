// Migration 015: human review metadata for AI recommendations.

export async function up(client) {
  await client.query(`
    ALTER TABLE fl_ai_decisions
      ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
      ADD COLUMN IF NOT EXISTS review_notes TEXT,
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ
  `);
}

export async function down(client) {
  await client.query(`
    ALTER TABLE fl_ai_decisions
      DROP COLUMN IF EXISTS reviewed_at,
      DROP COLUMN IF EXISTS review_notes,
      DROP COLUMN IF EXISTS reviewed_by
  `);
}
