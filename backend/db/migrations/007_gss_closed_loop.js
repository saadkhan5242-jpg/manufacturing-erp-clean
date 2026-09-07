// Migration 007: GSS Closed-Loop — SalesOrder (OE), WipLedger (GL), labor financial
// extension (SFC), ShipmentLine (shipping). Links Order Entry -> Shop Floor -> GL.
// Idempotent: safe to run against the 002/006 baseline.

export async function up(client) {
  // 1. SalesOrder (Order Entry module) — custom items, qty, pricing, required delivery
  await client.query(`
    CREATE TABLE IF NOT EXISTS sales_orders (
      id BIGSERIAL PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      customer_id TEXT NOT NULL,
      product_id BIGINT REFERENCES products(id),
      quantity_ordered NUMERIC(14,4) NOT NULL CHECK (quantity_ordered > 0),
      unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
      required_date DATE,
      status TEXT NOT NULL DEFAULT 'Open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_orders_required ON sales_orders(required_date)`);

  // 2. Link WorkOrder (SFC) to its originating SalesOrder (OE)
  await client.query(`
    ALTER TABLE work_orders
      ADD COLUMN IF NOT EXISTS sales_order_id BIGINT REFERENCES sales_orders(id) ON DELETE SET NULL
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_work_orders_so ON work_orders(sales_order_id)`);

  // 3. WipLedger (General Ledger module) — auto debit/credit rows for Material/Labor/Overhead WIP
  await client.query(`
    CREATE TABLE IF NOT EXISTS wip_ledger (
      id BIGSERIAL PRIMARY KEY,
      work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      entry_type TEXT NOT NULL CHECK (entry_type IN ('Material WIP', 'Labor WIP', 'Overhead WIP')),
      debit NUMERIC(14,2) NOT NULL DEFAULT 0,
      credit NUMERIC(14,2) NOT NULL DEFAULT 0,
      reference TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_wip_ledger_wo ON wip_ledger(work_order_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_wip_ledger_type ON wip_ledger(entry_type)`);

  // 4. Extend labor_transactions with setup/runtime split + scrapped pieces + cost rollups
  await client.query(`
    ALTER TABLE labor_transactions
      ADD COLUMN IF NOT EXISTS setup_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS run_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pieces_scrapped INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS labor_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS overhead_cost NUMERIC(12,2) NOT NULL DEFAULT 0
  `);

  // 5. Seed work centers (needed for labor-rate valuation) — only if empty
  const wcCount = await client.query("SELECT COUNT(*)::int AS n FROM work_centers");
  if (wcCount.rows[0].n === 0) {
    await client.query(`
      INSERT INTO work_centers (code, name, daily_capacity_hours, labor_rate, machine_rate, overhead_rate, active)
      VALUES
        ('CNC_MILL', 'CNC Milling Center', 16, 85.00, 120.00, 45.00, TRUE),
        ('ASSEMBLY', 'Final Assembly', 16, 55.00, 20.00, 25.00, TRUE),
        ('QUALITY', 'Quality & Inspection', 8, 65.00, 5.00, 30.00, TRUE)
      ON CONFLICT (code) DO NOTHING
    `);
  }

  // 6. Seed demo SalesOrders + link existing WorkOrders + ShipmentLines — guarded, only if empty
  const soCount = await client.query("SELECT COUNT(*)::int AS n FROM sales_orders");
  if (soCount.rows[0].n === 0) {
    await client.query(`
      INSERT INTO sales_orders (order_number, customer_id, product_id, quantity_ordered, unit_price, required_date, status)
      VALUES
        ('SO-9001', 'CUST-NORTHSTAR', NULL, 25, 412.50, CURRENT_DATE, 'Released'),
        ('SO-9002', 'CUST-METALWORKS', NULL, 10, 985.00, CURRENT_DATE - 1, 'Released'),
        ('SO-9003', 'CUST-APEXFAB', NULL, 40, 128.75, CURRENT_DATE, 'Closed')
      ON CONFLICT (order_number) DO NOTHING
    `);

    await client.query(`
      UPDATE work_orders wo SET sales_order_id = so.id
      FROM sales_orders so
      WHERE so.order_number = 'SO-9001' AND wo.order_number = 'WO-7001' AND wo.sales_order_id IS NULL
    `);
    await client.query(`
      UPDATE work_orders wo SET sales_order_id = so.id
      FROM sales_orders so
      WHERE so.order_number = 'SO-9002' AND wo.order_number = 'WO-7002' AND wo.sales_order_id IS NULL
    `);
    await client.query(`
      UPDATE work_orders wo SET sales_order_id = so.id
      FROM sales_orders so
      WHERE so.order_number = 'SO-9003' AND wo.order_number = 'WO-7003' AND wo.sales_order_id IS NULL
    `);
  }

  // 7. ShipmentLine relational view — joins OE sales order + customer into each dispatch row
  await client.query(`
    CREATE OR REPLACE VIEW shipment_lines AS
    SELECT s.id,
           s.customer_id,
           s.work_order_id,
           wo.order_number,
           wo.part_number,
           wo.sales_order_id,
           so.order_number AS sales_order_number,
           so.customer_id AS so_customer_id,
           s.target_ship_date,
           s.actual_ship_date,
           s.quantity_shipped,
           s.carrier,
           s.status,
           s.created_at
    FROM shipments s
    JOIN work_orders wo ON wo.id = s.work_order_id
    LEFT JOIN sales_orders so ON so.id = wo.sales_order_id
  `);

  console.log("Migration 007: sales_orders, wip_ledger, labor financials, shipment_lines view created");
}

export async function down(client) {
  await client.query(`DROP VIEW IF EXISTS shipment_lines`);
  await client.query(`ALTER TABLE labor_transactions DROP COLUMN IF EXISTS setup_hours, DROP COLUMN IF EXISTS run_hours, DROP COLUMN IF EXISTS pieces_scrapped, DROP COLUMN IF EXISTS labor_cost, DROP COLUMN IF EXISTS overhead_cost`);
  await client.query(`DROP TABLE IF EXISTS wip_ledger CASCADE`);
  await client.query(`ALTER TABLE work_orders DROP COLUMN IF EXISTS sales_order_id`);
  await client.query(`DROP TABLE IF EXISTS sales_orders CASCADE`);
  console.log("Migration 007: Rolled back closed-loop WIP/GL schema");
}
