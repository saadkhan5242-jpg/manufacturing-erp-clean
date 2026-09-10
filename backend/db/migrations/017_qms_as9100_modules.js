export async function up(client) {
  await client.query(`
    ALTER TABLE inventory_lots
      ADD COLUMN IF NOT EXISTS quality_status TEXT NOT NULL DEFAULT 'accepted',
      ADD COLUMN IF NOT EXISTS hold_reason TEXT NOT NULL DEFAULT ''
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS measurement_instruments (
      id BIGSERIAL PRIMARY KEY,
      instrument_number TEXT NOT NULL UNIQUE,
      instrument_type TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      serial_number TEXT NOT NULL DEFAULT '',
      owner_work_center_id BIGINT REFERENCES work_centers(id),
      calibration_due_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'out_of_service', 'lost')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS instrument_calibration_events (
      id BIGSERIAL PRIMARY KEY,
      measurement_instrument_id BIGINT NOT NULL REFERENCES measurement_instruments(id) ON DELETE CASCADE,
      calibrated_at TIMESTAMPTZ NOT NULL,
      calibration_due_at TIMESTAMPTZ NOT NULL,
      calibrated_by BIGINT REFERENCES users(id),
      certificate_document_id BIGINT REFERENCES supplier_material_documents(id),
      result TEXT NOT NULL CHECK (result IN ('passed', 'failed', 'limited_use')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS routing_step_required_instruments (
      id BIGSERIAL PRIMARY KEY,
      work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      routing_step_id BIGINT NOT NULL REFERENCES job_routing(id) ON DELETE CASCADE,
      measurement_instrument_id BIGINT NOT NULL REFERENCES measurement_instruments(id),
      required_for_status TEXT NOT NULL DEFAULT 'SETUP',
      UNIQUE (routing_step_id, measurement_instrument_id)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS inspection_records (
      id BIGSERIAL PRIMARY KEY,
      work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      routing_step_id BIGINT NOT NULL REFERENCES job_routing(id) ON DELETE CASCADE,
      inspection_type TEXT NOT NULL CHECK (inspection_type IN ('in_process', 'first_article', 'final', 'receiving')),
      measurement_instrument_id BIGINT REFERENCES measurement_instruments(id),
      operator_user_id BIGINT REFERENCES users(id),
      employee_id TEXT NOT NULL,
      result TEXT NOT NULL CHECK (result IN ('pass', 'fail', 'needs_review')),
      signature_hash TEXT NOT NULL,
      signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS inspection_measurements (
      id BIGSERIAL PRIMARY KEY,
      inspection_record_id BIGINT NOT NULL REFERENCES inspection_records(id) ON DELETE CASCADE,
      characteristic_number TEXT NOT NULL,
      description TEXT NOT NULL,
      nominal_value NUMERIC(14,6) NOT NULL,
      lower_tolerance NUMERIC(14,6) NOT NULL DEFAULT 0,
      upper_tolerance NUMERIC(14,6) NOT NULL DEFAULT 0,
      actual_value NUMERIC(14,6) NOT NULL,
      unit TEXT NOT NULL DEFAULT 'in',
      pass_fail TEXT NOT NULL CHECK (pass_fail IN ('pass', 'fail')),
      measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS fai_reports (
      id BIGSERIAL PRIMARY KEY,
      work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      part_number TEXT NOT NULL,
      part_name TEXT NOT NULL DEFAULT '',
      revision TEXT NOT NULL DEFAULT '',
      report_number TEXT NOT NULL UNIQUE,
      form1 JSONB NOT NULL,
      form2 JSONB NOT NULL,
      form3 JSONB NOT NULL,
      result TEXT NOT NULL CHECK (result IN ('approved', 'rejected', 'partial', 'pending_review')),
      prepared_by BIGINT REFERENCES users(id),
      signature_hash TEXT NOT NULL,
      signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS non_conformance_reports (
      id BIGSERIAL PRIMARY KEY,
      ncr_number TEXT NOT NULL UNIQUE,
      work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      routing_step_id BIGINT REFERENCES job_routing(id),
      inventory_lot_id BIGINT REFERENCES inventory_lots(id),
      reported_by BIGINT REFERENCES users(id),
      employee_id TEXT NOT NULL,
      quantity_scrapped INTEGER NOT NULL CHECK (quantity_scrapped > 0),
      defect_code TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'major' CHECK (severity IN ('minor', 'major', 'critical')),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'disposition_pending', 'capa_open', 'closed')),
      signature_hash TEXT NOT NULL,
      reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS corrective_preventive_actions (
      id BIGSERIAL PRIMARY KEY,
      capa_number TEXT NOT NULL UNIQUE,
      ncr_id BIGINT NOT NULL REFERENCES non_conformance_reports(id) ON DELETE CASCADE,
      owner_user_id BIGINT REFERENCES users(id),
      containment_action TEXT NOT NULL,
      root_cause TEXT NOT NULL DEFAULT '',
      corrective_action TEXT NOT NULL DEFAULT '',
      preventive_action TEXT NOT NULL DEFAULT '',
      due_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'implemented', 'verified', 'closed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_measurement_instruments_due ON measurement_instruments(calibration_due_at, status)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_routing_step_required_instruments_step ON routing_step_required_instruments(routing_step_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_inspection_records_work_order ON inspection_records(work_order_id, routing_step_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_inspection_measurements_record ON inspection_measurements(inspection_record_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_fai_reports_work_order ON fai_reports(work_order_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ncr_work_order ON non_conformance_reports(work_order_id, status)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_capa_ncr ON corrective_preventive_actions(ncr_id, status)`);
}

export async function down(client) {
  await client.query(`DROP TABLE IF EXISTS corrective_preventive_actions CASCADE`);
  await client.query(`DROP TABLE IF EXISTS non_conformance_reports CASCADE`);
  await client.query(`DROP TABLE IF EXISTS fai_reports CASCADE`);
  await client.query(`DROP TABLE IF EXISTS inspection_measurements CASCADE`);
  await client.query(`DROP TABLE IF EXISTS inspection_records CASCADE`);
  await client.query(`DROP TABLE IF EXISTS routing_step_required_instruments CASCADE`);
  await client.query(`DROP TABLE IF EXISTS instrument_calibration_events CASCADE`);
  await client.query(`DROP TABLE IF EXISTS measurement_instruments CASCADE`);
  await client.query(`ALTER TABLE inventory_lots DROP COLUMN IF EXISTS hold_reason, DROP COLUMN IF EXISTS quality_status`);
}
