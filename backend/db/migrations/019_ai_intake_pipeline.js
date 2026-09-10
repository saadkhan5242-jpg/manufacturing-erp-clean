export async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ai_quote_intake_proposals (
      id BIGSERIAL PRIMARY KEY,
      proposal_number TEXT NOT NULL UNIQUE,
      source_type TEXT NOT NULL DEFAULT 'customer_email' CHECK (source_type IN ('customer_email', 'rfq_text', 'engineering_requirement', 'manual')),
      source_text_hash TEXT NOT NULL,
      customer_id TEXT,
      part_number TEXT NOT NULL,
      revision_number TEXT NOT NULL DEFAULT '',
      material_grade TEXT NOT NULL,
      material_volume NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (material_volume >= 0),
      material_unit TEXT NOT NULL DEFAULT 'in3',
      estimated_setup_minutes NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (estimated_setup_minutes >= 0),
      estimated_cycle_minutes NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (estimated_cycle_minutes >= 0),
      secondary_finishes JSONB NOT NULL DEFAULT '[]'::jsonb,
      estimator_notes TEXT NOT NULL DEFAULT '',
      confidence_score NUMERIC(5,2) CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100)),
      model_provider TEXT NOT NULL,
      model_name TEXT NOT NULL,
      raw_model_output JSONB NOT NULL,
      validation_status TEXT NOT NULL DEFAULT 'draft_proposal' CHECK (validation_status IN ('draft_proposal', 'qa_approved', 'qa_rejected')),
      requires_qa_approval BOOLEAN NOT NULL DEFAULT TRUE,
      reviewed_by BIGINT REFERENCES users(id),
      reviewed_at TIMESTAMPTZ,
      review_notes TEXT NOT NULL DEFAULT '',
      created_by BIGINT REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ai_quote_intake_bom_drafts (
      id BIGSERIAL PRIMARY KEY,
      proposal_id BIGINT NOT NULL REFERENCES ai_quote_intake_proposals(id) ON DELETE CASCADE,
      parent_part_number TEXT NOT NULL,
      component_part_number TEXT NOT NULL,
      component_description TEXT NOT NULL DEFAULT '',
      material_grade TEXT NOT NULL DEFAULT '',
      quantity_per NUMERIC(14,6) NOT NULL CHECK (quantity_per > 0),
      unit TEXT NOT NULL DEFAULT 'each',
      source_confidence NUMERIC(5,2) CHECK (source_confidence IS NULL OR (source_confidence >= 0 AND source_confidence <= 100)),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ai_quote_intake_router_drafts (
      id BIGSERIAL PRIMARY KEY,
      proposal_id BIGINT NOT NULL REFERENCES ai_quote_intake_proposals(id) ON DELETE CASCADE,
      sequence_number INTEGER NOT NULL,
      operation_name TEXT NOT NULL,
      work_center_code TEXT NOT NULL,
      estimated_setup_minutes NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (estimated_setup_minutes >= 0),
      estimated_run_minutes NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (estimated_run_minutes >= 0),
      outside_process BOOLEAN NOT NULL DEFAULT FALSE,
      finish_specification TEXT NOT NULL DEFAULT '',
      qa_required BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (proposal_id, sequence_number)
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_quote_proposals_status ON ai_quote_intake_proposals(validation_status, created_at DESC)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_quote_proposals_part ON ai_quote_intake_proposals(part_number, revision_number)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_quote_bom_proposal ON ai_quote_intake_bom_drafts(proposal_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_quote_router_proposal ON ai_quote_intake_router_drafts(proposal_id)`);
}

export async function down(client) {
  await client.query(`DROP TABLE IF EXISTS ai_quote_intake_router_drafts CASCADE`);
  await client.query(`DROP TABLE IF EXISTS ai_quote_intake_bom_drafts CASCADE`);
  await client.query(`DROP TABLE IF EXISTS ai_quote_intake_proposals CASCADE`);
}
