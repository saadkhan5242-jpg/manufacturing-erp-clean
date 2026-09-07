// Migration 006: WIP tracking engine — job_routing, labor_transactions, shipments,
// and work_orders column alignment for the Live Job / Daily Shipment dashboards.
// All ALTERs are idempotent (IF NOT EXISTS) against the 002 baseline schema.

export async function up(client) {
  // 1. Align work_orders with the dashboard contract
  await client.query(`
    ALTER TABLE work_orders
      ADD COLUMN IF NOT EXISTS item_id BIGINT REFERENCES products(id),
      ADD COLUMN IF NOT EXISTS quantity_ordered NUMERIC(14,4) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS quantity_completed NUMERIC(14,4) NOT NULL DEFAULT 0
  `);

  // 2. job_routing: per-work-order routing steps bound to work centers
  await client.query(`
    CREATE TABLE IF NOT EXISTS job_routing (
      id BIGSERIAL PRIMARY KEY,
      work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      work_center_code TEXT NOT NULL,
      sequence_number INTEGER NOT NULL,
      estimated_hours NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (estimated_hours >= 0),
      actual_hours NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (actual_hours >= 0),
      status TEXT NOT NULL DEFAULT 'Pending',
      UNIQUE (work_order_id, sequence_number)
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_job_routing_wo ON job_routing(work_order_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_job_routing_center ON job_routing(work_center_code)`);

  // 3. labor_transactions: real-time clock-in / clock-out punches
  await client.query(`
    CREATE TABLE IF NOT EXISTS labor_transactions (
      id BIGSERIAL PRIMARY KEY,
      employee_id TEXT NOT NULL,
      work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      routing_step_id BIGINT NOT NULL REFERENCES job_routing(id) ON DELETE CASCADE,
      start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      end_time TIMESTAMPTZ,
      pieces_produced INTEGER NOT NULL DEFAULT 0 CHECK (pieces_produced >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_labor_tx_wo ON labor_transactions(work_order_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_labor_tx_step ON labor_transactions(routing_step_id)`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_labor_tx_open ON labor_transactions(employee_id) WHERE end_time IS NULL`);

  // 4. shipments: scheduled vs actual shipment performance
  await client.query(`
    CREATE TABLE IF NOT EXISTS shipments (
      id BIGSERIAL PRIMARY KEY,
      customer_id TEXT NOT NULL,
      work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      target_ship_date DATE NOT NULL,
      actual_ship_date DATE,
      quantity_shipped NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (quantity_shipped >= 0),
      carrier TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Scheduled',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_shipments_target ON shipments(target_ship_date)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_shipments_wo ON shipments(work_order_id)`);

  // 5. Guarded demo seed — only populates when the new tables are empty,
  //    so dashboards render immediately but production data is never disturbed.
  const seeded = await client.query("SELECT COUNT(*)::int AS n FROM job_routing");
  if (seeded.rows[0].n === 0) {
    await client.query(`
      INSERT INTO work_orders (order_number, part_number, quantity, status, due_date, item_id, quantity_ordered, quantity_completed)
      VALUES
        ('WO-7001', 'BRACKET-ASSY', 25, 'in-progress', CURRENT_DATE + 2, NULL, 25, 12),
        ('WO-7002', 'HOUSING-CNC', 10, 'in-progress', CURRENT_DATE + 5, NULL, 10, 0),
        ('WO-7003', 'SHAFT-DRIVE', 40, 'completed', CURRENT_DATE, NULL, 40, 40)
      ON CONFLICT (order_number) DO NOTHING
    `);

    await client.query(`
      INSERT INTO job_routing (work_order_id, work_center_code, sequence_number, estimated_hours, actual_hours, status)
      SELECT wo.id, jr.work_center_code, jr.sequence_number, jr.estimated_hours, jr.actual_hours, jr.status
      FROM work_orders wo
      JOIN (VALUES
        ('WO-7001', 'CNC_MILL', 10, 6.00, 7.50, 'In-Progress'),
        ('WO-7001', 'ASSEMBLY', 20, 4.00, 0.00, 'Pending'),
        ('WO-7001', 'QUALITY', 30, 1.50, 0.00, 'Pending'),
        ('WO-7002', 'CNC_MILL', 10, 8.00, 3.25, 'In-Progress'),
        ('WO-7002', 'QUALITY', 20, 2.00, 0.00, 'Pending'),
        ('WO-7003', 'CNC_MILL', 10, 5.00, 4.75, 'Completed'),
        ('WO-7003', 'ASSEMBLY', 20, 6.00, 6.20, 'Completed'),
        ('WO-7003', 'QUALITY', 30, 1.00, 0.90, 'Completed')
      ) AS jr(order_number, work_center_code, sequence_number, estimated_hours, actual_hours, status)
        ON jr.order_number = wo.order_number
    `);

    await client.query(`
      INSERT INTO labor_transactions (employee_id, work_order_id, routing_step_id, start_time, pieces_produced)
      SELECT 'EMP-104', wo.id, jr.id, NOW() - INTERVAL '2 hours', 4
      FROM work_orders wo
      JOIN job_routing jr ON jr.work_order_id = wo.id AND jr.sequence_number = 10
      WHERE wo.order_number = 'WO-7001'
    `);

    await client.query(`
      INSERT INTO shipments (customer_id, work_order_id, target_ship_date, actual_ship_date, quantity_shipped, carrier, status)
      SELECT sc.customer_id, wo.id, sc.target_ship_date, sc.actual_ship_date, sc.quantity_shipped, sc.carrier, sc.status
      FROM work_orders wo
      JOIN (VALUES
        ('CUST-NORTHSTAR', 'WO-7003', CURRENT_DATE, CURRENT_DATE, 40.0, 'FedEx Freight', 'Shipped'),
        ('CUST-APEXFAB',   'WO-7003', CURRENT_DATE, NULL, 0.0, 'UPS Ground', 'Scheduled'),
        ('CUST-NORTHSTAR', 'WO-7001', CURRENT_DATE, NULL, 0.0, 'DHL', 'Scheduled'),
        ('CUST-METALWORKS','WO-7002', CURRENT_DATE - 1, NULL, 0.0, 'FedEx Freight', 'Scheduled')
      ) AS sc(customer_id, order_number, target_ship_date, actual_ship_date, quantity_shipped, carrier, status)
        ON sc.order_number = wo.order_number
    `);
  }

  console.log("Migration 006: job_routing, labor_transactions, shipments created; work_orders aligned");
}

export async function down(client) {
  await client.query(`DROP TABLE IF EXISTS shipments CASCADE`);
  await client.query(`DROP TABLE IF EXISTS labor_transactions CASCADE`);
  await client.query(`DROP TABLE IF EXISTS job_routing CASCADE`);
  await client.query(`ALTER TABLE work_orders DROP COLUMN IF EXISTS item_id, DROP COLUMN IF EXISTS quantity_ordered, DROP COLUMN IF EXISTS quantity_completed`);
  console.log("Migration 006: Rolled back WIP tracking engine tables");
}
