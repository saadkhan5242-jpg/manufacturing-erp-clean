// Migration 004: Create AP Invoices, Inventory, and Router Operations tables for three-layer feature integration

export async function up(client) {
  // Create ap_invoices table for Layer 2: AP Supervisor Audit Ledger
  await client.query(`
    CREATE TABLE IF NOT EXISTS ap_invoices (
      id SERIAL PRIMARY KEY,
      vendor_name VARCHAR(255) NOT NULL,
      invoice_number VARCHAR(50) NOT NULL UNIQUE,
      invoice_date DATE NOT NULL,
      total_amount DECIMAL(12,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create unique index on invoice_number for fast lookups
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ap_invoices_number ON ap_invoices(invoice_number)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_ap_invoices_vendor ON ap_invoices(vendor_name)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_ap_invoices_date ON ap_invoices(invoice_date)
  `);

  // Create inventory table for Layer 1: Automated Invoice Inventory Injections
  // (Distinct from the ERP inventory_items table, which is keyed by part_id/sku
  // and does not carry unit_price — this table tracks invoice-injected receipts.)
  await client.query(`
    CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      part_number VARCHAR(50) NOT NULL UNIQUE,
      description VARCHAR(255),
      quantity INTEGER DEFAULT 0,
      unit_price DECIMAL(10,2),
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for inventory queries
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_part_number ON inventory(part_number)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory(quantity)
  `);

  // Note: router_operations and shop_floor_labor_logs already exist from
  // migration 002 with all columns required for Layer 3 variance analytics
  // (router_operations.work_center, router_operations.estimated_run_time_hours,
  // shop_floor_labor_logs.clock_in_time / clock_out_time / parts_produced).

  console.log("Migration 004: Created ap_invoices and inventory tables");
}

export async function down(client) {
  await client.query(`DROP INDEX IF EXISTS idx_ap_invoices_date CASCADE`);
  await client.query(`DROP INDEX IF EXISTS idx_ap_invoices_vendor CASCADE`);
  await client.query(`DROP INDEX IF EXISTS idx_ap_invoices_number CASCADE`);
  await client.query(`DROP TABLE IF EXISTS ap_invoices CASCADE`);

  await client.query(`DROP INDEX IF EXISTS idx_inventory_quantity CASCADE`);
  await client.query(`DROP INDEX IF EXISTS idx_inventory_part_number CASCADE`);
  await client.query(`DROP TABLE IF EXISTS inventory CASCADE`);

  console.log("Migration 004: Rolled back ap_invoices and inventory tables");
}
