-- Rollback Migration 004: Remove AP Invoices, Inventory, and Router Operations tables

DROP INDEX IF EXISTS idx_ap_invoices_date CASCADE;
DROP INDEX IF EXISTS idx_ap_invoices_vendor CASCADE;
DROP INDEX IF EXISTS idx_ap_invoices_number CASCADE;
DROP TABLE IF EXISTS ap_invoices CASCADE;

DROP INDEX IF EXISTS idx_inventory_quantity CASCADE;
DROP INDEX IF EXISTS idx_inventory_part_number CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;

DROP INDEX IF EXISTS idx_router_operations_work_center CASCADE;
DROP TABLE IF EXISTS router_operations CASCADE;

-- Note: shop_floor_labor_logs columns are not dropped to maintain compatibility
