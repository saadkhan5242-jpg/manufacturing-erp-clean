// Migration 008: Restore router_operations (job-shop BOM routing map) after DB reset.
// Provides the router_operations relation that shopFloorRouter (variance-analytics,
// clock-in/out), mrpRouter, and bomRouter depend on. Idempotent + guarded seed.

export async function up(client) {
  // Parent routing header (bomRouter references bom_routers.id)
  await client.query(`
    CREATE TABLE IF NOT EXISTS bom_routers (
      id BIGSERIAL PRIMARY KEY,
      product_id BIGINT,
      revision_number TEXT NOT NULL DEFAULT 'Rev A',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Core routing operations map consumed by SFC + MRP
  await client.query(`
    CREATE TABLE IF NOT EXISTS router_operations (
      id BIGSERIAL PRIMARY KEY,
      bom_router_id BIGINT REFERENCES bom_routers(id) ON DELETE CASCADE,
      sequence_number INTEGER NOT NULL,
      work_center TEXT NOT NULL,
      setup_time_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      estimated_run_time_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      required_materials JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_router_operations_router ON router_operations(bom_router_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_router_operations_center ON router_operations(work_center)`);

  // Shop floor labor punch log (SFC) — consumed by variance analytics + MRP
  await client.query(`
    CREATE TABLE IF NOT EXISTS shop_floor_labor_logs (
      id BIGSERIAL PRIMARY KEY,
      employee_id TEXT,
      work_order_id BIGINT,
      router_operation_id BIGINT,
      job_status TEXT NOT NULL DEFAULT 'RUNNING',
      clock_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      clock_out_time TIMESTAMPTZ,
      parts_produced INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_sfll_wo ON shop_floor_labor_logs(work_order_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_sfll_op ON shop_floor_labor_logs(router_operation_id)`);

  // Guarded seed: one parent router + the demo CNC_MILL operation (id 10) that the
  // shop floor terminal, MRP engine, and variance analytics operate against.
  const routerSeed = await client.query("SELECT COUNT(*)::int AS n FROM bom_routers");
  if (routerSeed.rows[0].n === 0) {
    await client.query(`INSERT INTO bom_routers (id, product_id, revision_number) VALUES (1, NULL, 'Rev A') ON CONFLICT (id) DO NOTHING`);
  }

  const opSeed = await client.query("SELECT COUNT(*)::int AS n FROM router_operations WHERE id = 10");
  if (opSeed.rows[0].n === 0) {
    await client.query(`
      INSERT INTO router_operations (id, bom_router_id, sequence_number, work_center, setup_time_hours, estimated_run_time_hours, required_materials)
      VALUES (10, 1, 10, 'CNC_MILL', 0.50, 4.25, '[{"partNumber":"MAT-STEEL-01","quantity":15},{"partNumber":"MAT-ALUM-05","quantity":6}]'::jsonb)
      ON CONFLICT (id) DO NOTHING
    `);
    // Keep the sequence ahead of the explicit id seed
    await client.query(`SELECT setval(pg_get_serial_sequence('router_operations', 'id'), (SELECT COALESCE(MAX(id), 1) FROM router_operations))`);
  }

  // Guarantee one open production job exists so MRP + variance analytics have data
  const openJob = await client.query("SELECT COUNT(*)::int AS n FROM shop_floor_labor_logs WHERE clock_out_time IS NULL");
  if (openJob.rows[0].n === 0) {
    await client.query(`
      INSERT INTO shop_floor_labor_logs (employee_id, work_order_id, router_operation_id, job_status, clock_in_time, parts_produced)
      VALUES ('SEED-OP', 5002, 10, 'RUNNING', NOW() - INTERVAL '1 hour', 0)
    `);
  }

  console.log("Migration 008: router_operations + bom_routers + shop_floor_labor_logs restored with CNC_MILL demo op");
}

export async function down(client) {
  await client.query(`DROP TABLE IF EXISTS shop_floor_labor_logs CASCADE`);
  await client.query(`DROP TABLE IF EXISTS router_operations CASCADE`);
  await client.query(`DROP TABLE IF EXISTS bom_routers CASCADE`);
  console.log("Migration 008: Rolled back router_operations + bom_routers + shop_floor_labor_logs");
}
