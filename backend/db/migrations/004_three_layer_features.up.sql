-- Migration 004: Create AP Invoices, Inventory, and Router Operations tables for three-layer feature integration

-- Create ap_invoices table for Layer 2: AP Supervisor Audit Ledger
CREATE TABLE IF NOT EXISTS ap_invoices (
  id SERIAL PRIMARY KEY,
  vendor_name VARCHAR(255) NOT NULL,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  invoice_date DATE NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index on invoice_number for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_ap_invoices_number ON ap_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_vendor ON ap_invoices(vendor_name);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_date ON ap_invoices(invoice_date);

-- Create inventory table for Layer 1: Automated Inventory Injections
CREATE TABLE IF NOT EXISTS inventory (
  id SERIAL PRIMARY KEY,
  part_number VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  quantity INTEGER DEFAULT 0,
  unit_price DECIMAL(10,2),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for inventory queries
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_part_number ON inventory(part_number);
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory(quantity);

-- Create router_operations table if it doesn't exist
CREATE TABLE IF NOT EXISTS router_operations (
  id SERIAL PRIMARY KEY,
  work_center_code VARCHAR(50),
  estimated_run_hours DECIMAL(10,2),
  standard_setup_hours DECIMAL(10,2) DEFAULT 0,
  sequence_number INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for router_operations
CREATE INDEX IF NOT EXISTS idx_router_operations_work_center ON router_operations(work_center_code);

-- Verify shop_floor_labor_logs table has required columns for Layer 3
-- These columns should already exist, but we ensure they're present
ALTER TABLE IF EXISTS shop_floor_labor_logs 
  ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS work_order_id INTEGER,
  ADD COLUMN IF NOT EXISTS router_operation_id INTEGER,
  ADD COLUMN IF NOT EXISTS job_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS clock_in_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS clock_out_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS parts_produced INTEGER DEFAULT 0;
