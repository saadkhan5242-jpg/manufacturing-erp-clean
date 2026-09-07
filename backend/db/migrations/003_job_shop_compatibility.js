export async function up(client) {
  await client.query("ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS order_number TEXT");
  await client.query("UPDATE work_orders SET order_number = 'WO-' || id WHERE order_number IS NULL OR order_number = ''");
  await client.query("ALTER TABLE work_orders ALTER COLUMN order_number SET NOT NULL");
  await client.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_work_orders_order_number ON work_orders(order_number)");
  await client.query("ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS part_number TEXT NOT NULL DEFAULT ''");
  await client.query("ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await client.query("ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()");
}

export async function down(client) {
  await client.query("DROP INDEX IF EXISTS idx_work_orders_order_number");
  await client.query("ALTER TABLE work_orders DROP COLUMN IF EXISTS order_number");
}
