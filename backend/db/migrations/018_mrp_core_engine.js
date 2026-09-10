export async function up(client) {
  await client.query(`
    ALTER TABLE inventory
      ADD COLUMN IF NOT EXISTS available_stock NUMERIC(14,4),
      ADD COLUMN IF NOT EXISTS allocated_stock NUMERIC(14,4) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS on_order NUMERIC(14,4) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS safety_stock NUMERIC(14,4) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS preferred_vendor_id BIGINT REFERENCES suppliers(id),
      ADD COLUMN IF NOT EXISTS next_expected_receipt_at DATE
  `);

  await client.query(`
    UPDATE inventory
    SET available_stock = COALESCE(available_stock, quantity, 0),
        safety_stock = CASE WHEN safety_stock = 0 THEN COALESCE(reorder_point, 0) ELSE safety_stock END,
        preferred_vendor_id = COALESCE(preferred_vendor_id, supplier_id)
  `);

  await client.query(`
    ALTER TABLE mrp_procurement_demands
      ALTER COLUMN gross_requirement TYPE NUMERIC(14,4) USING gross_requirement::numeric,
      ALTER COLUMN on_hand TYPE NUMERIC(14,4) USING on_hand::numeric,
      ALTER COLUMN net_deficiency TYPE NUMERIC(14,4) USING net_deficiency::numeric,
      ALTER COLUMN suggested_order_qty TYPE NUMERIC(14,4) USING suggested_order_qty::numeric
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS mrp_runs (
      id BIGSERIAL PRIMARY KEY,
      run_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('preview', 'completed', 'failed')),
      active_work_order_count INTEGER NOT NULL DEFAULT 0,
      active_sales_order_count INTEGER NOT NULL DEFAULT 0,
      parts_analyzed INTEGER NOT NULL DEFAULT 0,
      shortages_found INTEGER NOT NULL DEFAULT 0,
      diagnostics JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_by BIGINT REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS mrp_purchase_order_queue (
      id BIGSERIAL PRIMARY KEY,
      run_id TEXT NOT NULL,
      preferred_vendor_id BIGINT REFERENCES suppliers(id),
      part_number TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      gross_requirement NUMERIC(14,4) NOT NULL,
      available_stock NUMERIC(14,4) NOT NULL,
      allocated_stock NUMERIC(14,4) NOT NULL DEFAULT 0,
      on_order NUMERIC(14,4) NOT NULL DEFAULT 0,
      safety_stock NUMERIC(14,4) NOT NULL DEFAULT 0,
      net_requirement NUMERIC(14,4) NOT NULL,
      suggested_order_qty NUMERIC(14,4) NOT NULL,
      estimated_unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0,
      estimated_total_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
      lead_time_days INTEGER NOT NULL DEFAULT 0,
      required_by DATE,
      estimated_arrival_date DATE,
      priority TEXT NOT NULL DEFAULT 'standard' CHECK (priority IN ('standard', 'expedite', 'critical')),
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'released', 'cancelled', 'superseded')),
      source_work_orders JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS mrp_reschedule_signals (
      id BIGSERIAL PRIMARY KEY,
      run_id TEXT NOT NULL,
      work_order_id BIGINT REFERENCES work_orders(id) ON DELETE CASCADE,
      part_number TEXT NOT NULL,
      current_due_date DATE,
      estimated_material_arrival DATE,
      projected_start_date DATE,
      risk_level TEXT NOT NULL CHECK (risk_level IN ('info', 'warning', 'critical')),
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_inventory_mrp_plan ON inventory(part_number, preferred_vendor_id, lead_time_days)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_mrp_po_queue_run_vendor ON mrp_purchase_order_queue(run_id, preferred_vendor_id, status)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_mrp_po_queue_part ON mrp_purchase_order_queue(part_number, status)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_mrp_reschedule_work_order ON mrp_reschedule_signals(work_order_id, status)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_mrp_runs_created ON mrp_runs(created_at DESC)`);
}

export async function down(client) {
  await client.query(`DROP TABLE IF EXISTS mrp_reschedule_signals CASCADE`);
  await client.query(`DROP TABLE IF EXISTS mrp_purchase_order_queue CASCADE`);
  await client.query(`DROP TABLE IF EXISTS mrp_runs CASCADE`);
  await client.query(`
    ALTER TABLE inventory
      DROP COLUMN IF EXISTS next_expected_receipt_at,
      DROP COLUMN IF EXISTS preferred_vendor_id,
      DROP COLUMN IF EXISTS safety_stock,
      DROP COLUMN IF EXISTS on_order,
      DROP COLUMN IF EXISTS allocated_stock,
      DROP COLUMN IF EXISTS available_stock
  `);
}
