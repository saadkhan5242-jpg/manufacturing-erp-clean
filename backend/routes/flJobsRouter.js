import { Router } from "express";
import { pool, withTransaction } from "../db.js";

const router = Router();

/* ============================================================
   FORGELOGIC AI — LIVE JOB TRACKING ENGINE
   Real-time job progress: current routing step, machine, operator,
   est vs actual hours, WIP status, QC, shipping readiness.
   ============================================================ */

// GET /api/fl/jobs/live -> real-time job tracking dashboard feed
router.get("/live", async (_req, res) => {
  try {
    const result = await pool.query(`
      WITH current_step AS (
        SELECT DISTINCT ON (rs.job_id)
               rs.job_id, rs.sequence_number, rs.description, rs.status AS step_status,
               rs.is_outside_process, rs.outside_process_name,
               m.code AS machine_code, m.name AS machine_name, m.machine_type
        FROM fl_routing_steps rs
        LEFT JOIN fl_machines m ON m.id = rs.machine_id
        ORDER BY rs.job_id,
                 CASE rs.status WHEN 'in_progress' THEN 0 WHEN 'ready' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
                 rs.sequence_number ASC
      ),
      labor AS (
        SELECT job_id,
               SUM(EXTRACT(EPOCH FROM (COALESCE(clock_out, NOW()) - clock_in)) / 3600.0) AS actual_hours,
               SUM(pieces_produced) AS pieces
        FROM fl_labor_logs GROUP BY job_id
      ),
      open_punch AS (
        SELECT DISTINCT ON (job_id) job_id, employee_id
        FROM fl_labor_logs WHERE clock_out IS NULL
        ORDER BY job_id, clock_in DESC
      ),
      qc AS (
        SELECT job_id,
               COUNT(*) FILTER (WHERE result = 'pass') AS passed,
               COUNT(*) FILTER (WHERE result = 'fail') AS failed,
               COUNT(*) FILTER (WHERE result = 'pending') AS pending
        FROM fl_qc_checks GROUP BY job_id
      )
      SELECT j.id, j.job_number, j.part_number, j.part_name, j.status, j.priority,
             j.quantity_ordered, j.quantity_completed, j.due_date, j.total_cost,
             c.name AS customer_name,
             cs.sequence_number AS current_sequence, cs.description AS current_step,
             cs.step_status, cs.is_outside_process, cs.outside_process_name,
             cs.machine_code, cs.machine_name, cs.machine_type,
             op.employee_id AS active_operator,
             COALESCE(l.actual_hours, 0)::float AS actual_hours,
             (SELECT COALESCE(SUM(rs2.estimated_hours),0) FROM fl_routing_steps rs2 WHERE rs2.job_id = j.id)::float AS estimated_hours,
             COALESCE(qc.passed,0)::int AS qc_passed, COALESCE(qc.failed,0)::int AS qc_failed, COALESCE(qc.pending,0)::int AS qc_pending,
             CASE WHEN j.due_date < CURRENT_DATE AND j.status NOT IN ('shipped','closed') THEN TRUE ELSE FALSE END AS is_late,
             CASE WHEN j.due_date - CURRENT_DATE <= 2 AND j.status NOT IN ('shipped','closed') THEN TRUE ELSE FALSE END AS at_risk
      FROM fl_jobs j
      LEFT JOIN fl_customers c ON c.id = j.customer_id
      LEFT JOIN current_step cs ON cs.job_id = j.id
      LEFT JOIN labor l ON l.job_id = j.id
      LEFT JOIN open_punch op ON op.job_id = j.id
      LEFT JOIN qc ON qc.job_id = j.id
      WHERE j.status NOT IN ('closed','shipped')
      ORDER BY j.priority = 'rush' DESC, j.due_date ASC NULLS LAST
    `);

    return res.status(200).json({
      success: true,
      polledAt: new Date().toISOString(),
      jobs: result.rows.map((r) => ({
        id: Number(r.id),
        jobNumber: r.job_number,
        partNumber: r.part_number,
        partName: r.part_name,
        customer: r.customer_name,
        status: r.status,
        priority: r.priority,
        quantityOrdered: Number(r.quantity_ordered),
        quantityCompleted: Number(r.quantity_completed),
        dueDate: r.due_date,
        totalCost: Number(r.total_cost),
        currentStep: r.current_step,
        currentSequence: r.current_sequence,
        stepStatus: r.step_status,
        isOutsideProcess: r.is_outside_process,
        outsideProcessName: r.outside_process_name,
        machine: r.machine_code ? { code: r.machine_code, name: r.machine_name, type: r.machine_type } : null,
        activeOperator: r.active_operator || null,
        actualHours: Number(r.actual_hours.toFixed(2)),
        estimatedHours: Number(r.estimated_hours.toFixed(2)),
        efficiency: r.actual_hours > 0 ? Number(((r.estimated_hours / r.actual_hours) * 100).toFixed(1)) : null,
        qc: { passed: r.qc_passed, failed: r.qc_failed, pending: r.qc_pending },
        isLate: r.is_late,
        atRisk: r.at_risk
      }))
    });
  } catch (error) {
    console.error("ForgeLogic live-jobs error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/fl/jobs -> list with filters
router.get("/", async (req, res) => {
  try {
    const { status, customerId } = req.query;
    let text = `SELECT j.*, c.name AS customer_name FROM fl_jobs j LEFT JOIN fl_customers c ON c.id = j.customer_id WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); text += ` AND j.status = $${params.length}`; }
    if (customerId) { params.push(customerId); text += ` AND j.customer_id = $${params.length}`; }
    text += ` ORDER BY j.created_at DESC LIMIT 200`;
    const result = await pool.query(text, params);
    return res.json({ success: true, jobs: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/fl/jobs -> create job with auto routing template
router.post("/", async (req, res) => {
  const { jobNumber, customerId, partNumber, partName, quantityOrdered, materialSpec, materialForm, dueDate, priority } = req.body || {};
  if (!jobNumber || !partNumber) return res.status(400).json({ error: "jobNumber and partNumber are required" });
  try {
    const job = await withTransaction(async (client) => {
      const j = await client.query(
        `INSERT INTO fl_jobs (job_number, customer_id, part_number, part_name, quantity_ordered, material_spec, material_form, due_date, priority, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'released') RETURNING id`,
        [jobNumber, customerId || null, partNumber, partName || null, quantityOrdered || 1, materialSpec || null, materialForm || null, dueDate || null, priority || 'normal']
      );
      const jobId = j.rows[0].id;

      // Auto-generate a standard machine-shop routing: material -> saw -> lathe -> mill -> deburr -> outside -> QC -> ship
      const template = [
        { seq: 10, type: "machining", desc: "Saw / cut raw material to blank", wc: "SAW" },
        { seq: 20, type: "setup", desc: "CNC Lathe setup", wc: "LATHE-01" },
        { seq: 30, type: "machining", desc: "CNC Lathe turning", wc: "LATHE-01" },
        { seq: 40, type: "setup", desc: "CNC Mill setup", wc: "MILL-01" },
        { seq: 50, type: "machining", desc: "CNC Mill machining", wc: "MILL-01" },
        { seq: 60, type: "deburr", desc: "Deburr & wash", wc: "DEBURR" },
        { seq: 70, type: "outside_process", desc: "Outside process (if required)", wc: null, outside: true },
        { seq: 80, type: "inspection", desc: "Final QC inspection", wc: "QC-01" },
        { seq: 90, type: "packaging", desc: "Pack & ship prep", wc: "SHIP" }
      ];
      for (const step of template) {
        await client.query(
          `INSERT INTO fl_routing_steps (job_id, sequence_number, operation_type, work_center_code, description, is_outside_process, status)
           VALUES ($1,$2,$3,$4,$5,$6,'pending') ON CONFLICT (job_id, sequence_number) DO NOTHING`,
          [jobId, step.seq, step.type, step.wc, step.desc, step.outside === true]
        );
      }
      return jobId;
    });
    return res.status(201).json({ success: true, jobId: Number(job), message: `Job ${jobNumber} created with standard routing.` });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/fl/jobs/:id/clock -> operator punch (live tracking)
router.post("/:id/clock", async (req, res) => {
  const jobId = parseInt(req.params.id, 10);
  const { employeeId, routingStepId, machineId, action } = req.body || {}; // action: 'in' | 'out'
  if (!employeeId) return res.status(400).json({ error: "employeeId required" });
  try {
    if (action === "out") {
      const result = await withTransaction(async (client) => {
        const punch = await client.query(
          `UPDATE fl_labor_logs SET clock_out = NOW(), pieces_produced = $1
           WHERE job_id = $2 AND employee_id = $3 AND clock_out IS NULL
           RETURNING id, routing_step_id, clock_in, clock_out`,
          [parseInt(req.body.piecesProduced, 10) || 0, jobId, String(employeeId)]
        );
        if (punch.rows.length === 0) return null;
        const row = punch.rows[0];
        const hours = (new Date(row.clock_out) - new Date(row.clock_in)) / 3600000;
        if (row.routing_step_id) {
          await client.query(
            `UPDATE fl_routing_steps SET actual_hours = COALESCE(actual_hours,0) + $1, status='complete' WHERE id = $2`,
            [Number(hours.toFixed(4)), row.routing_step_id]
          );
        }
        // roll pieces to job completion
        if ((parseInt(req.body.piecesProduced, 10) || 0) > 0) {
          await client.query(
            `UPDATE fl_jobs SET quantity_completed = LEAST(quantity_completed + $1, quantity_ordered), updated_at = NOW() WHERE id = $2`,
            [parseInt(req.body.piecesProduced, 10), jobId]
          );
        }
        return row;
      });
      if (!result) return res.status(404).json({ error: "No open punch for this operator on this job" });
      return res.json({ success: true, message: "Clocked out", logId: Number(result.id) });
    }

    // clock in
    const insert = await pool.query(
      `INSERT INTO fl_labor_logs (job_id, routing_step_id, employee_id, machine_id, clock_in)
       VALUES ($1,$2,$3,$4,NOW()) RETURNING id`,
      [jobId, routingStepId || null, String(employeeId), machineId || null]
    );
    await pool.query(`UPDATE fl_jobs SET status='in_progress', updated_at=NOW() WHERE id=$1 AND status IN ('released','quoted','contract_review')`, [jobId]);
    if (routingStepId) await pool.query(`UPDATE fl_routing_steps SET status='in_progress' WHERE id=$1`, [routingStepId]);
    return res.status(201).json({ success: true, logId: Number(insert.rows[0].id) });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/fl/jobs/:id -> full job detail + routing steps (drives the punch terminal)
router.get("/:id", async (req, res) => {
  const jobId = parseInt(req.params.id, 10);
  try {
    const jobRes = await pool.query(
      `SELECT j.*, c.name AS customer_name FROM fl_jobs j LEFT JOIN fl_customers c ON c.id = j.customer_id WHERE j.id = $1`,
      [jobId]
    );
    if (jobRes.rows.length === 0) return res.status(404).json({ success: false, error: "Job not found" });
    const job = jobRes.rows[0];

    const stepsRes = await pool.query(
      `SELECT rs.id, rs.sequence_number, rs.operation_type, rs.description, rs.status,
              rs.estimated_hours, rs.actual_hours, rs.pieces_completed, rs.is_outside_process, rs.outside_process_name,
              m.id AS machine_id, m.code AS machine_code, m.name AS machine_name
       FROM fl_routing_steps rs LEFT JOIN fl_machines m ON m.id = rs.machine_id
       WHERE rs.job_id = $1 ORDER BY rs.sequence_number ASC`,
      [jobId]
    );

    return res.json({
      success: true,
      job: {
        id: Number(job.id), jobNumber: job.job_number, partNumber: job.part_number, partName: job.part_name,
        status: job.status, priority: job.priority, customer: job.customer_name,
        quantityOrdered: Number(job.quantity_ordered), quantityCompleted: Number(job.quantity_completed),
        dueDate: job.due_date
      },
      steps: stepsRes.rows.map((s) => ({
        id: Number(s.id), sequenceNumber: s.sequence_number, operationType: s.operation_type,
        description: s.description, status: s.status,
        estimatedHours: Number(s.estimated_hours), actualHours: Number(s.actual_hours),
        piecesCompleted: s.pieces_completed,
        isOutsideProcess: s.is_outside_process, outsideProcessName: s.outside_process_name,
        machine: s.machine_id ? { id: Number(s.machine_id), code: s.machine_code, name: s.machine_name } : null
      }))
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/fl/jobs/:id/status-report -> customer-facing job status (shareable)
router.get("/:id/status-report", async (req, res) => {
  const jobId = parseInt(req.params.id, 10);
  try {
    const jobRes = await pool.query(
      `SELECT j.job_number, j.part_number, j.part_name, j.status, j.priority,
              j.quantity_ordered, j.quantity_completed, j.due_date, j.promised_date,
              c.name AS customer_name, c.code AS customer_code
       FROM fl_jobs j LEFT JOIN fl_customers c ON c.id = j.customer_id WHERE j.id = $1`,
      [jobId]
    );
    if (jobRes.rows.length === 0) return res.status(404).json({ success: false, error: "Job not found" });
    const job = jobRes.rows[0];

    const stepsRes = await pool.query(
      `SELECT sequence_number, operation_type, description, status, estimated_hours, actual_hours, is_outside_process, outside_process_name
       FROM fl_routing_steps WHERE job_id = $1 ORDER BY sequence_number ASC`,
      [jobId]
    );

    const qcRes = await pool.query(
      `SELECT check_type, result, checked_at, inspector FROM fl_qc_checks WHERE job_id = $1 ORDER BY checked_at DESC`,
      [jobId]
    );

    const shipRes = await pool.query(
      `SELECT ship_date, quantity_shipped, carrier, tracking_number, status FROM fl_shipments WHERE job_id = $1 ORDER BY created_at DESC`,
      [jobId]
    );

    const steps = stepsRes.rows;
    const completedSteps = steps.filter((s) => s.status === 'complete').length;
    const totalSteps = steps.length || 1;
    const progressPercent = Math.round((completedSteps / totalSteps) * 100);
    const qtyPct = job.quantity_ordered > 0 ? Math.round((Number(job.quantity_completed) / Number(job.quantity_ordered)) * 100) : 0;

    return res.json({
      success: true,
      report: {
        jobNumber: job.job_number,
        partNumber: job.part_number,
        partName: job.part_name,
        customer: job.customer_name,
        status: job.status,
        priority: job.priority,
        quantityOrdered: Number(job.quantity_ordered),
        quantityCompleted: Number(job.quantity_completed),
        dueDate: job.due_date,
        promisedDate: job.promised_date,
        progressPercent,
        quantityPercent: qtyPct,
        isOnTrack: job.due_date ? new Date(job.due_date) >= new Date() : true,
        routing: steps.map((s) => ({
          sequence: s.sequence_number, operation: s.operation_type, description: s.description,
          status: s.status, isOutside: s.is_outside_process, outsideProcess: s.outside_process_name,
          estimatedHours: Number(s.estimated_hours), actualHours: Number(s.actual_hours)
        })),
        qc: qcRes.rows.map((q) => ({ type: q.check_type, result: q.result, at: q.checked_at, inspector: q.inspector })),
        shipments: shipRes.rows.map((s) => ({ shipDate: s.ship_date, qty: Number(s.quantity_shipped), carrier: s.carrier, tracking: s.tracking_number, status: s.status }))
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
