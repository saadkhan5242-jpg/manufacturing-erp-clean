// Migration 012: ForgeLogic AI — machine-shop engineering fields + QuickBooks sync queue
// Extends the fl_ schema with spindle/feed/tool/cycle machining parameters and a
// reliable QuickBooks Online sync queue. Idempotent (IF NOT EXISTS / guarded).

export async function up(client) {
  // 1. Machining engineering parameters on routing steps
  await client.query(`
    ALTER TABLE fl_routing_steps
      ADD COLUMN IF NOT EXISTS spindle_speed_rpm INTEGER,
      ADD COLUMN IF NOT EXISTS feed_rate NUMERIC(10,3),
      ADD COLUMN IF NOT EXISTS tool_number TEXT,
      ADD COLUMN IF NOT EXISTS cycle_time_minutes NUMERIC(10,2),
      ADD COLUMN IF NOT EXISTS material_removal_rate NUMERIC(10,3),
      ADD COLUMN IF NOT EXISTS outside_process_type TEXT
  `);

  // 2. Machine assignments (which machine runs which step, scheduled window)
  await client.query(`
    CREATE TABLE IF NOT EXISTS fl_machine_assignments (
      id BIGSERIAL PRIMARY KEY,
      routing_step_id BIGINT NOT NULL REFERENCES fl_routing_steps(id) ON DELETE CASCADE,
      machine_id BIGINT NOT NULL REFERENCES fl_machines(id) ON DELETE CASCADE,
      job_id BIGINT NOT NULL REFERENCES fl_jobs(id) ON DELETE CASCADE,
      scheduled_start TIMESTAMPTZ,
      scheduled_end TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','complete','cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_fl_assign_machine ON fl_machine_assignments(machine_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_fl_assign_job ON fl_machine_assignments(job_id)`);

  // 3. Outside processes (dedicated tracking with cost + status)
  await client.query(`
    CREATE TABLE IF NOT EXISTS fl_outside_processes (
      id BIGSERIAL PRIMARY KEY,
      job_id BIGINT NOT NULL REFERENCES fl_jobs(id) ON DELETE CASCADE,
      routing_step_id BIGINT REFERENCES fl_routing_steps(id) ON DELETE SET NULL,
      vendor_id BIGINT REFERENCES fl_vendors(id) ON DELETE SET NULL,
      process_type TEXT NOT NULL, -- heat_treat, plating, anodize, grinding, etc.
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','in_process','received','complete')),
      cost NUMERIC(12,2) DEFAULT 0,
      sent_date DATE,
      expected_return DATE,
      received_date DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_fl_osp_job ON fl_outside_processes(job_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_fl_osp_vendor ON fl_outside_processes(vendor_id)`);

  // 4. Inventory ledger (stock movements with valuation)
  await client.query(`
    CREATE TABLE IF NOT EXISTS fl_inventory_ledger (
      id BIGSERIAL PRIMARY KEY,
      material_id BIGINT REFERENCES fl_material_stock(id) ON DELETE SET NULL,
      part_number TEXT,
      transaction_type TEXT NOT NULL, -- receipt, issue, adjustment, return
      quantity NUMERIC(14,4) NOT NULL,
      unit_cost NUMERIC(14,2) DEFAULT 0,
      total_value NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
      reference TEXT,
      job_id BIGINT REFERENCES fl_jobs(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_fl_inv_ledger_part ON fl_inventory_ledger(part_number)`);

  // 5. QuickBooks Online — OAuth tokens + reliable sync queue
  await client.query(`
    CREATE TABLE IF NOT EXISTS fl_quickbooks_auth (
      id BIGSERIAL PRIMARY KEY,
      realm_id TEXT,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at TIMESTAMPTZ,
      connected BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS fl_quickbooks_sync_queue (
      id BIGSERIAL PRIMARY KEY,
      entity_type TEXT NOT NULL, -- customer, vendor, purchase_order, bill, invoice, payment, job_costing, inventory
      operation TEXT NOT NULL DEFAULT 'create', -- create, update, delete
      local_id BIGINT,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','synced','failed')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      qb_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      synced_at TIMESTAMPTZ
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_fl_qb_queue_status ON fl_quickbooks_sync_queue(status)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_fl_qb_queue_entity ON fl_quickbooks_sync_queue(entity_type)`);

  console.log("Migration 012: machine-shop engineering fields + QuickBooks sync queue created");
}

export async function down(client) {
  await client.query(`DROP TABLE IF EXISTS fl_quickbooks_sync_queue CASCADE`);
  await client.query(`DROP TABLE IF EXISTS fl_quickbooks_auth CASCADE`);
  await client.query(`DROP TABLE IF EXISTS fl_inventory_ledger CASCADE`);
  await client.query(`DROP TABLE IF EXISTS fl_outside_processes CASCADE`);
  await client.query(`DROP TABLE IF EXISTS fl_machine_assignments CASCADE`);
  console.log("Migration 012: rolled back");
}
