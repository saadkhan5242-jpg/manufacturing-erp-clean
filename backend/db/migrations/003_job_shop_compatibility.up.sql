ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS order_number TEXT;
UPDATE work_orders SET order_number = 'WO-' || id WHERE order_number IS NULL OR order_number = '';
ALTER TABLE work_orders ALTER COLUMN order_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_orders_order_number ON work_orders(order_number);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS part_number TEXT NOT NULL DEFAULT '';
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
