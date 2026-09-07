CREATE TABLE IF NOT EXISTS work_centers (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  daily_capacity_hours NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (daily_capacity_hours >= 0),
  labor_rate NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (labor_rate >= 0),
  machine_rate NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (machine_rate >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_orders (
  id BIGSERIAL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  part_number TEXT NOT NULL,
  quantity NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'released', 'in-progress', 'completed', 'cancelled')),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE work_centers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE work_centers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS part_number TEXT NOT NULL DEFAULT '';
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS schedules (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  work_center_id BIGINT NOT NULL REFERENCES work_centers(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_work_centers_active ON work_centers(active);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_due_date ON work_orders(due_date);
CREATE INDEX IF NOT EXISTS idx_schedules_work_order ON schedules(work_order_id);
CREATE INDEX IF NOT EXISTS idx_schedules_work_center_time ON schedules(work_center_id, start_time, end_time);
