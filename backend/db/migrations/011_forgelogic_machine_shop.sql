-- ============================================================
-- ForgeLogic AI — Machine Job Shop Core Schema
-- Optimized for CNC lathe / mill / live-tooling job shops.
-- Covers: contract review, quoting, purchasing, outside processing,
-- routing, QC, shipping, job costing, WIP, live tracking, vendors.
-- ============================================================

-- 1. CUSTOMERS (CRM / contract review)
CREATE TABLE IF NOT EXISTS fl_customers (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  payment_terms TEXT DEFAULT 'NET30',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. VENDORS (raw material + outside process)
CREATE TABLE IF NOT EXISTS fl_vendors (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  vendor_type TEXT NOT NULL DEFAULT 'material' CHECK (vendor_type IN ('material','outside_process','both')),
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  lead_time_days INTEGER NOT NULL DEFAULT 7,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. VENDOR PERFORMANCE TRACKING
CREATE TABLE IF NOT EXISTS fl_vendor_performance (
  id BIGSERIAL PRIMARY KEY,
  vendor_id BIGINT NOT NULL REFERENCES fl_vendors(id) ON DELETE CASCADE,
  po_reference TEXT,
  promised_date DATE,
  delivered_date DATE,
  quality_rating NUMERIC(3,1) CHECK (quality_rating BETWEEN 0 AND 5),
  on_time BOOLEAN,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fl_vendor_perf_vendor ON fl_vendor_performance(vendor_id);

-- 4. QUOTES (estimating & quoting)
CREATE TABLE IF NOT EXISTS fl_quotes (
  id BIGSERIAL PRIMARY KEY,
  quote_number TEXT NOT NULL UNIQUE,
  customer_id BIGINT REFERENCES fl_customers(id) ON DELETE SET NULL,
  part_number TEXT NOT NULL,
  part_name TEXT,
  quantity NUMERIC(14,4) NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','won','lost','expired')),
  material_cost NUMERIC(14,2) DEFAULT 0,
  labor_cost NUMERIC(14,2) DEFAULT 0,
  overhead_cost NUMERIC(14,2) DEFAULT 0,
  outside_process_cost NUMERIC(14,2) DEFAULT 0,
  margin_percent NUMERIC(6,2) DEFAULT 30,
  unit_price NUMERIC(14,2) DEFAULT 0,
  total_price NUMERIC(14,2) DEFAULT 0,
  ai_estimated BOOLEAN DEFAULT FALSE,
  notes TEXT,
  valid_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fl_quotes_customer ON fl_quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_fl_quotes_status ON fl_quotes(status);

-- 5. JOBS (work orders — the central job-shop entity)
CREATE TABLE IF NOT EXISTS fl_jobs (
  id BIGSERIAL PRIMARY KEY,
  job_number TEXT NOT NULL UNIQUE,
  quote_id BIGINT REFERENCES fl_quotes(id) ON DELETE SET NULL,
  customer_id BIGINT REFERENCES fl_customers(id) ON DELETE SET NULL,
  part_number TEXT NOT NULL,
  part_name TEXT,
  quantity_ordered NUMERIC(14,4) NOT NULL DEFAULT 1,
  quantity_completed NUMERIC(14,4) NOT NULL DEFAULT 0,
  quantity_scrapped NUMERIC(14,4) NOT NULL DEFAULT 0,
  material_spec TEXT,
  material_form TEXT, -- bar, plate, casting, forging
  status TEXT NOT NULL DEFAULT 'contract_review' CHECK (status IN ('contract_review','estimating','quoted','released','in_progress','qc','outside_process','ready_to_ship','shipped','closed','on_hold')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','rush')),
  order_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  promised_date DATE,
  -- cost rollups (job costing)
  material_cost NUMERIC(14,2) DEFAULT 0,
  labor_cost NUMERIC(14,2) DEFAULT 0,
  overhead_cost NUMERIC(14,2) DEFAULT 0,
  outside_process_cost NUMERIC(14,2) DEFAULT 0,
  total_cost NUMERIC(14,2) GENERATED ALWAYS AS (material_cost + labor_cost + overhead_cost + outside_process_cost) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fl_jobs_status ON fl_jobs(status);
CREATE INDEX IF NOT EXISTS idx_fl_jobs_customer ON fl_jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_fl_jobs_due ON fl_jobs(due_date);

-- 6. MACHINES (CNC lathe / mill / live tooling work centers)
CREATE TABLE IF NOT EXISTS fl_machines (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  machine_type TEXT NOT NULL CHECK (machine_type IN ('cnc_lathe','cnc_mill','live_tooling','swiss','grinding','manual','inspection','other')),
  controller TEXT, -- Fanuc, Haas, Mazak, etc.
  labor_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  overhead_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  machine_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  daily_capacity_hours NUMERIC(10,2) NOT NULL DEFAULT 16,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. ROUTING STEPS (per job; includes outside-process steps)
CREATE TABLE IF NOT EXISTS fl_routing_steps (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES fl_jobs(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  operation_type TEXT NOT NULL DEFAULT 'machining' CHECK (operation_type IN ('machining','setup','inspection','outside_process','deburr','wash','assembly','packaging')),
  machine_id BIGINT REFERENCES fl_machines(id) ON DELETE SET NULL,
  work_center_code TEXT, -- fallback label
  description TEXT NOT NULL DEFAULT '',
  -- outside processing linkage
  is_outside_process BOOLEAN NOT NULL DEFAULT FALSE,
  outside_vendor_id BIGINT REFERENCES fl_vendors(id) ON DELETE SET NULL,
  outside_process_name TEXT, -- heat treat, plating, anodize, grinding
  outside_cost NUMERIC(12,2) DEFAULT 0,
  outside_lead_days INTEGER DEFAULT 0,
  -- time standards
  setup_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  run_hours_per_piece NUMERIC(10,4) NOT NULL DEFAULT 0,
  estimated_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  actual_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','in_progress','complete','skipped')),
  pieces_completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, sequence_number)
);
CREATE INDEX IF NOT EXISTS idx_fl_routing_job ON fl_routing_steps(job_id);
CREATE INDEX IF NOT EXISTS idx_fl_routing_machine ON fl_routing_steps(machine_id);

-- 8. LABOR / MACHINE PUNCH LOG (live job tracking)
CREATE TABLE IF NOT EXISTS fl_labor_logs (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES fl_jobs(id) ON DELETE CASCADE,
  routing_step_id BIGINT REFERENCES fl_routing_steps(id) ON DELETE SET NULL,
  employee_id TEXT NOT NULL,
  machine_id BIGINT REFERENCES fl_machines(id) ON DELETE SET NULL,
  clock_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out TIMESTAMPTZ,
  pieces_produced INTEGER NOT NULL DEFAULT 0,
  pieces_scrapped INTEGER NOT NULL DEFAULT 0,
  labor_cost NUMERIC(12,2) DEFAULT 0,
  overhead_cost NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fl_labor_job ON fl_labor_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_fl_labor_open ON fl_labor_logs(employee_id) WHERE clock_out IS NULL;

-- 9. QC CHECKPOINTS (in-process + final)
CREATE TABLE IF NOT EXISTS fl_qc_checks (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES fl_jobs(id) ON DELETE CASCADE,
  routing_step_id BIGINT REFERENCES fl_routing_steps(id) ON DELETE SET NULL,
  check_type TEXT NOT NULL DEFAULT 'in_process' CHECK (check_type IN ('first_article','in_process','final','receiving')),
  inspector TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('pending','pass','fail','rework')),
  measurements JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fl_qc_job ON fl_qc_checks(job_id);

-- 10. RAW MATERIAL PURCHASE ORDERS
CREATE TABLE IF NOT EXISTS fl_purchase_orders (
  id BIGSERIAL PRIMARY KEY,
  po_number TEXT NOT NULL UNIQUE,
  vendor_id BIGINT REFERENCES fl_vendors(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','confirmed','received','partial','cancelled')),
  order_date DATE DEFAULT CURRENT_DATE,
  expected_date DATE,
  received_date DATE,
  total_cost NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fl_po_vendor ON fl_purchase_orders(vendor_id);

CREATE TABLE IF NOT EXISTS fl_purchase_order_lines (
  id BIGSERIAL PRIMARY KEY,
  po_id BIGINT NOT NULL REFERENCES fl_purchase_orders(id) ON DELETE CASCADE,
  job_id BIGINT REFERENCES fl_jobs(id) ON DELETE SET NULL, -- buy-to-job
  part_number TEXT,
  material_spec TEXT,
  description TEXT,
  quantity NUMERIC(14,4) NOT NULL,
  unit TEXT DEFAULT 'each',
  unit_cost NUMERIC(14,2) DEFAULT 0,
  received_qty NUMERIC(14,4) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fl_po_lines_po ON fl_purchase_order_lines(po_id);

-- 11. RAW MATERIAL STOCK
CREATE TABLE IF NOT EXISTS fl_material_stock (
  id BIGSERIAL PRIMARY KEY,
  material_spec TEXT NOT NULL,
  form TEXT, -- bar, plate, sheet
  dimensions TEXT,
  part_number TEXT,
  quantity NUMERIC(14,4) NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'each',
  unit_cost NUMERIC(14,2) DEFAULT 0,
  location TEXT,
  lot_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fl_material_part ON fl_material_stock(part_number);

-- 12. SHIPMENTS (customer documentation + dispatch)
CREATE TABLE IF NOT EXISTS fl_shipments (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES fl_jobs(id) ON DELETE CASCADE,
  customer_id BIGINT REFERENCES fl_customers(id) ON DELETE SET NULL,
  ship_date DATE,
  quantity_shipped NUMERIC(14,4) DEFAULT 0,
  carrier TEXT,
  tracking_number TEXT,
  packing_slip TEXT,
  cert_included BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','shipped','delivered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fl_shipments_job ON fl_shipments(job_id);

-- 13. CAD FILES (upload + attach to jobs/quotes/travelers)
CREATE TABLE IF NOT EXISTS fl_cad_files (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT REFERENCES fl_jobs(id) ON DELETE CASCADE,
  quote_id BIGINT REFERENCES fl_quotes(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_type TEXT, -- step, dxf, dwg, stl
  storage_path TEXT,
  file_size BIGINT,
  -- AI-extracted metadata
  extracted_features JSONB DEFAULT '{}'::jsonb,
  machining_notes TEXT,
  estimated_cycle_minutes NUMERIC(10,2),
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fl_cad_job ON fl_cad_files(job_id);

-- 14. AI DECISION LOG (audit trail for AI-assisted actions)
CREATE TABLE IF NOT EXISTS fl_ai_decisions (
  id BIGSERIAL PRIMARY KEY,
  module TEXT NOT NULL, -- estimating, scheduling, purchasing, qc, routing
  job_id BIGINT REFERENCES fl_jobs(id) ON DELETE SET NULL,
  input JSONB,
  output JSONB,
  confidence TEXT,
  approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fl_ai_module ON fl_ai_decisions(module);

-- ============================================================
-- SEED: machine shop work centers (lathe, mill, live tooling)
-- ============================================================
INSERT INTO fl_machines (code, name, machine_type, controller, labor_rate, overhead_rate, machine_rate, daily_capacity_hours, active)
VALUES
  ('LATHE-01', 'CNC Lathe — Okuma LB3000', 'cnc_lathe', 'Okuma OSP', 38.00, 18.00, 95.00, 16, TRUE),
  ('MILL-01', 'CNC Mill — Haas VF-2SS', 'cnc_mill', 'Haas', 35.00, 15.00, 85.00, 16, TRUE),
  ('MILL-02', 'CNC Mill — DMG MORI', 'cnc_mill', 'Siemens', 35.00, 15.00, 90.00, 16, TRUE),
  ('LIVETOOL-01', 'Live Tooling — Mazak Integrex', 'live_tooling', 'Mazatrol', 42.00, 20.00, 110.00, 16, TRUE),
  ('QC-01', 'Inspection — CMM', 'inspection', 'Zeiss', 30.00, 10.00, 40.00, 8, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Seed vendors (material + outside process)
INSERT INTO fl_vendors (code, name, vendor_type, lead_time_days, active)
VALUES
  ('VND-STEEL', 'Ryerson Steel Supply', 'material', 5, TRUE),
  ('VND-ALUM', 'Alro Metals', 'material', 3, TRUE),
  ('VND-HEAT', 'Precision Heat Treat Co', 'outside_process', 7, TRUE),
  ('VND-PLATE', 'Apex Plating & Anodize', 'outside_process', 5, TRUE),
  ('VND-GRIND', 'Superior Grinding Services', 'outside_process', 4, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Seed a demo customer
INSERT INTO fl_customers (code, name, contact_name, email, payment_terms, active)
VALUES
  ('CUST-NORTHSTAR', 'Northstar Fabrication', 'Ops Manager', 'ops@northstar.example', 'NET30', TRUE),
  ('CUST-APEXFAB', 'Apex Fabrication', 'Buyer', 'buy@apex.example', 'NET45', TRUE)
ON CONFLICT (code) DO NOTHING;
