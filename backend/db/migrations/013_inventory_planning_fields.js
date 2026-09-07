// Migration 013: planning and supplier fields for the active inventory ledger.

export async function up(client) {
  await client.query(`
    ALTER TABLE inventory
      ADD COLUMN IF NOT EXISTS reorder_point NUMERIC(14,4) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS unit VARCHAR(20) NOT NULL DEFAULT 'EA',
      ADD COLUMN IF NOT EXISTS location VARCHAR(120) NOT NULL DEFAULT 'MAIN',
      ADD COLUMN IF NOT EXISTS supplier_id BIGINT REFERENCES suppliers(id),
      ADD COLUMN IF NOT EXISTS lead_time_days INTEGER NOT NULL DEFAULT 0
  `);

  await client.query(`
    INSERT INTO inventory (part_number, description, quantity, reorder_point, unit, location, unit_price)
    VALUES
      ('MAT-STEEL-001', 'Steel Sheet', 120, 40, 'LBS', 'Raw Materials A', 2.50),
      ('HW-BOLT-M8', 'M8 Hex Bolt', 850, 250, 'EA', 'Hardware Bin 12', 0.25)
    ON CONFLICT (part_number) DO NOTHING
  `);
}

export async function down(client) {
  await client.query(`
    ALTER TABLE inventory
      DROP COLUMN IF EXISTS lead_time_days,
      DROP COLUMN IF EXISTS supplier_id,
      DROP COLUMN IF EXISTS location,
      DROP COLUMN IF EXISTS unit,
      DROP COLUMN IF EXISTS reorder_point
  `);
}
