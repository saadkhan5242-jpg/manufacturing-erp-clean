DROP INDEX IF EXISTS idx_work_orders_order_number;
ALTER TABLE work_orders DROP COLUMN IF EXISTS order_number;
