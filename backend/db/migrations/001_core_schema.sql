CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role_id BIGINT REFERENCES roles(id),
  role TEXT NOT NULL DEFAULT 'viewer',
  password_hash TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE REFERENCES users(id),
  employee_number TEXT UNIQUE,
  name TEXT NOT NULL,
  labor_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  overtime_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_centers (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  daily_capacity_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  labor_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  machine_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  overhead_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parts (
  id BIGSERIAL PRIMARY KEY,
  part_number TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'each',
  lot_tracked BOOLEAN NOT NULL DEFAULT FALSE,
  serial_tracked BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS boms (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id),
  revision TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  effective_from DATE,
  effective_to DATE,
  UNIQUE(product_id, revision)
);

CREATE TABLE IF NOT EXISTS bom_components (
  id BIGSERIAL PRIMARY KEY,
  bom_id BIGINT NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
  part_id BIGINT REFERENCES parts(id),
  component_product_id BIGINT REFERENCES products(id),
  quantity NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
  scrap_percent NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (scrap_percent >= 0),
  sequence INTEGER NOT NULL DEFAULT 10
);

CREATE TABLE IF NOT EXISTS routings (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id),
  revision TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  UNIQUE(product_id, revision)
);

CREATE TABLE IF NOT EXISTS routing_operations (
  id BIGSERIAL PRIMARY KEY,
  routing_id BIGINT NOT NULL REFERENCES routings(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  operation TEXT NOT NULL,
  work_center_id BIGINT NOT NULL REFERENCES work_centers(id),
  setup_minutes NUMERIC(12,2) NOT NULL DEFAULT 0,
  run_minutes NUMERIC(12,2) NOT NULL DEFAULT 0,
  instructions TEXT NOT NULL DEFAULT '',
  UNIQUE(routing_id, sequence)
);

CREATE TABLE IF NOT EXISTS work_orders (
  id BIGSERIAL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  product_id BIGINT REFERENCES products(id),
  quantity NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'open',
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shift_entries (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  note TEXT NOT NULL DEFAULT '',
  CHECK (end_time IS NULL OR end_time > start_time)
);

CREATE TABLE IF NOT EXISTS time_entries (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  work_center_id BIGINT NOT NULL REFERENCES work_centers(id),
  operation TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  labor_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  machine_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  CHECK (end_time IS NULL OR end_time > start_time)
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id BIGSERIAL PRIMARY KEY,
  part_id BIGINT REFERENCES parts(id),
  product_id BIGINT REFERENCES products(id),
  sku TEXT NOT NULL,
  location TEXT NOT NULL,
  lot_number TEXT,
  serial_number TEXT,
  quantity NUMERIC(14,4) NOT NULL DEFAULT 0,
  reorder_point NUMERIC(14,4) NOT NULL DEFAULT 0,
  UNIQUE(sku, location, lot_number, serial_number)
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id BIGSERIAL PRIMARY KEY,
  inventory_item_id BIGINT NOT NULL REFERENCES inventory_items(id),
  transaction_type TEXT NOT NULL,
  quantity NUMERIC(14,4) NOT NULL CHECK (quantity <> 0),
  work_order_id BIGINT REFERENCES work_orders(id),
  reference TEXT,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id BIGSERIAL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  supplier_id BIGINT NOT NULL REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'draft',
  order_date DATE NOT NULL,
  total NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id BIGSERIAL PRIMARY KEY,
  purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id),
  part_id BIGINT REFERENCES parts(id),
  quantity NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_time_entries_work_order ON time_entries(work_order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
