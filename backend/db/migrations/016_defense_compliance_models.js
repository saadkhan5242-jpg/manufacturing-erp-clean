export async function up(client) {
  await client.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_us_citizen_or_permanent_resident BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await client.query(`
    ALTER TABLE work_orders
      ADD COLUMN IF NOT EXISTS is_itar_controlled BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await client.query(`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS is_itar_controlled BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await client.query(`
    ALTER TABLE parts
      ADD COLUMN IF NOT EXISTS is_itar_controlled BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS export_control_classification TEXT NOT NULL DEFAULT ''
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS rfqs (
      id BIGSERIAL PRIMARY KEY,
      rfq_number TEXT NOT NULL UNIQUE,
      customer_id TEXT NOT NULL,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      due_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'estimating', 'quoted', 'won', 'lost', 'cancelled')),
      is_itar_controlled BOOLEAN NOT NULL DEFAULT FALSE,
      created_by BIGINT REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS rfq_line_items (
      id BIGSERIAL PRIMARY KEY,
      rfq_id BIGINT NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
      line_number INTEGER NOT NULL,
      part_id BIGINT REFERENCES parts(id),
      product_id BIGINT REFERENCES products(id),
      part_number TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      quantity NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
      due_date DATE,
      is_itar_controlled BOOLEAN NOT NULL DEFAULT FALSE,
      UNIQUE (rfq_id, line_number)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS quote_estimates (
      id BIGSERIAL PRIMARY KEY,
      rfq_line_item_id BIGINT NOT NULL REFERENCES rfq_line_items(id) ON DELETE CASCADE,
      estimator_user_id BIGINT REFERENCES users(id),
      work_center_id BIGINT REFERENCES work_centers(id),
      estimated_setup_minutes NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (estimated_setup_minutes >= 0),
      estimated_run_minutes_per_piece NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (estimated_run_minutes_per_piece >= 0),
      machine_rate NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (machine_rate >= 0),
      labor_rate NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (labor_rate >= 0),
      raw_material_cost NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (raw_material_cost >= 0),
      outside_process_cost NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (outside_process_cost >= 0),
      estimator_notes TEXT NOT NULL DEFAULT '',
      confidence_score NUMERIC(5,2) CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100)),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS manufacturing_boms (
      id BIGSERIAL PRIMARY KEY,
      parent_part_id BIGINT REFERENCES parts(id),
      parent_product_id BIGINT REFERENCES products(id),
      revision TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'superseded', 'obsolete')),
      is_itar_controlled BOOLEAN NOT NULL DEFAULT FALSE,
      approved_by BIGINT REFERENCES users(id),
      approved_at TIMESTAMPTZ,
      effective_from DATE,
      effective_to DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (parent_part_id IS NOT NULL OR parent_product_id IS NOT NULL)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS manufacturing_bom_components (
      id BIGSERIAL PRIMARY KEY,
      bom_id BIGINT NOT NULL REFERENCES manufacturing_boms(id) ON DELETE CASCADE,
      child_part_id BIGINT REFERENCES parts(id),
      child_product_id BIGINT REFERENCES products(id),
      child_bom_id BIGINT REFERENCES manufacturing_boms(id),
      sequence_number INTEGER NOT NULL DEFAULT 10,
      quantity_per NUMERIC(14,6) NOT NULL CHECK (quantity_per > 0),
      unit TEXT NOT NULL DEFAULT 'each',
      scrap_percent NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (scrap_percent >= 0),
      reference_designator TEXT NOT NULL DEFAULT '',
      is_critical_to_quality BOOLEAN NOT NULL DEFAULT FALSE,
      UNIQUE (bom_id, sequence_number),
      CHECK (child_part_id IS NOT NULL OR child_product_id IS NOT NULL OR child_bom_id IS NOT NULL)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS work_order_router_operations (
      id BIGSERIAL PRIMARY KEY,
      work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      source_routing_operation_id BIGINT REFERENCES routing_operations(id),
      sequence_number INTEGER NOT NULL,
      work_center_id BIGINT NOT NULL REFERENCES work_centers(id),
      assigned_employee_id BIGINT REFERENCES employees(id),
      operation_name TEXT NOT NULL,
      instructions TEXT NOT NULL DEFAULT '',
      estimated_setup_minutes NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (estimated_setup_minutes >= 0),
      estimated_run_minutes NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (estimated_run_minutes >= 0),
      actual_setup_minutes NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (actual_setup_minutes >= 0),
      actual_run_minutes NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (actual_run_minutes >= 0),
      active BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'active', 'paused', 'qc-hold', 'complete', 'scrapped')),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (work_order_id, sequence_number)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS supplier_material_documents (
      id BIGSERIAL PRIMARY KEY,
      supplier_id BIGINT REFERENCES suppliers(id),
      purchase_order_id BIGINT REFERENCES purchase_orders(id),
      purchase_order_line_id BIGINT REFERENCES purchase_order_lines(id),
      document_type TEXT NOT NULL CHECK (document_type IN ('supplier_invoice', 'mill_test_report', 'certificate_of_conformance', 'packing_slip')),
      document_number TEXT NOT NULL,
      file_uri TEXT NOT NULL,
      uploaded_by BIGINT REFERENCES users(id),
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (document_type, document_number)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS inventory_lots (
      id BIGSERIAL PRIMARY KEY,
      part_id BIGINT REFERENCES parts(id),
      product_id BIGINT REFERENCES products(id),
      lot_number TEXT NOT NULL,
      heat_number TEXT NOT NULL,
      serial_number TEXT,
      quantity_on_hand NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
      location TEXT NOT NULL DEFAULT 'RECEIVING',
      supplier_id BIGINT REFERENCES suppliers(id),
      supplier_material_document_id BIGINT NOT NULL REFERENCES supplier_material_documents(id),
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      received_by BIGINT REFERENCES users(id),
      is_itar_controlled BOOLEAN NOT NULL DEFAULT FALSE,
      UNIQUE (part_id, lot_number, heat_number, serial_number),
      CHECK (part_id IS NOT NULL OR product_id IS NOT NULL)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS inventory_lot_movements (
      id BIGSERIAL PRIMARY KEY,
      inventory_lot_id BIGINT NOT NULL REFERENCES inventory_lots(id),
      movement_type TEXT NOT NULL CHECK (movement_type IN ('receive', 'issue', 'move', 'consume', 'adjust', 'ship')),
      quantity NUMERIC(14,4) NOT NULL CHECK (quantity <> 0),
      from_location TEXT,
      to_location TEXT,
      work_order_id BIGINT REFERENCES work_orders(id),
      supplier_material_document_id BIGINT NOT NULL REFERENCES supplier_material_documents(id),
      performed_by BIGINT REFERENCES users(id),
      performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip_address INET,
      notes TEXT NOT NULL DEFAULT ''
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS compliance_audit_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT,
      action_type TEXT NOT NULL,
      target_table TEXT NOT NULL,
      target_record_id TEXT NOT NULL,
      target_file_id TEXT,
      is_itar_controlled BOOLEAN NOT NULL DEFAULT FALSE,
      decision TEXT NOT NULL CHECK (decision IN ('allowed', 'blocked')),
      severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
      reason TEXT NOT NULL DEFAULT '',
      ip_address INET,
      user_agent TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    ALTER TABLE compliance_audit_logs
      ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info'
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_users_us_person ON users(is_us_citizen_or_permanent_resident)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_work_orders_itar ON work_orders(is_itar_controlled)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_products_itar ON products(is_itar_controlled)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_parts_itar ON parts(is_itar_controlled)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_rfq_line_items_rfq ON rfq_line_items(rfq_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_quote_estimates_line ON quote_estimates(rfq_line_item_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_mfg_bom_components_bom ON manufacturing_bom_components(bom_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_work_order_router_ops_wo ON work_order_router_operations(work_order_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_inventory_lots_trace ON inventory_lots(lot_number, heat_number, serial_number)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_inventory_lot_movements_lot ON inventory_lot_movements(inventory_lot_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_compliance_audit_target ON compliance_audit_logs(target_table, target_record_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_compliance_audit_severity ON compliance_audit_logs(severity, created_at DESC)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_compliance_audit_created ON compliance_audit_logs(created_at DESC)`);
}

export async function down(client) {
  await client.query(`DROP TABLE IF EXISTS compliance_audit_logs CASCADE`);
  await client.query(`DROP TABLE IF EXISTS inventory_lot_movements CASCADE`);
  await client.query(`DROP TABLE IF EXISTS inventory_lots CASCADE`);
  await client.query(`DROP TABLE IF EXISTS supplier_material_documents CASCADE`);
  await client.query(`DROP TABLE IF EXISTS work_order_router_operations CASCADE`);
  await client.query(`DROP TABLE IF EXISTS manufacturing_bom_components CASCADE`);
  await client.query(`DROP TABLE IF EXISTS manufacturing_boms CASCADE`);
  await client.query(`DROP TABLE IF EXISTS quote_estimates CASCADE`);
  await client.query(`DROP TABLE IF EXISTS rfq_line_items CASCADE`);
  await client.query(`DROP TABLE IF EXISTS rfqs CASCADE`);
  await client.query(`ALTER TABLE parts DROP COLUMN IF EXISTS export_control_classification, DROP COLUMN IF EXISTS is_itar_controlled`);
  await client.query(`ALTER TABLE products DROP COLUMN IF EXISTS is_itar_controlled`);
  await client.query(`ALTER TABLE work_orders DROP COLUMN IF EXISTS is_itar_controlled`);
  await client.query(`ALTER TABLE users DROP COLUMN IF EXISTS is_us_citizen_or_permanent_resident`);
}
