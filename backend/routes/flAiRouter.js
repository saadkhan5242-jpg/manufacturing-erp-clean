import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

/* ============================================================
   FORGELOGIC AI — AI MANUFACTURING INTELLIGENCE LAYER
   Master planning, backward scheduling, capacity planning,
   predictive lateness alerts, routing suggestions, optimization.
   ============================================================ */

// GET /api/fl/ai/lateness-alerts -> predictive lateness detection
router.get("/lateness-alerts", async (_req, res) => {
  try {
    const result = await pool.query(`
      WITH remaining AS (
        SELECT job_id, COALESCE(SUM(estimated_hours - actual_hours), 0) AS remaining_hours
        FROM fl_routing_steps WHERE status <> 'complete' GROUP BY job_id
      )
      SELECT j.id, j.job_number, j.part_number, j.due_date, j.status, j.priority,
             COALESCE(r.remaining_hours, 0)::float AS remaining_hours,
             (j.due_date - CURRENT_DATE) AS days_until_due,
             CASE
               WHEN COALESCE(r.remaining_hours,0) / 8.0 > (j.due_date - CURRENT_DATE) THEN 'critical'
               WHEN COALESCE(r.remaining_hours,0) / 8.0 > (j.due_date - CURRENT_DATE) * 0.7 THEN 'at_risk'
               ELSE 'on_track'
             END AS risk_level
      FROM fl_jobs j
      LEFT JOIN remaining r ON r.job_id = j.id
      WHERE j.status NOT IN ('closed','shipped')
      ORDER BY days_until_due ASC NULLS LAST
    `);
    const alerts = result.rows.filter((r) => r.risk_level !== 'on_track');
    return res.json({
      success: true,
      alerts: alerts.map((r) => ({
        jobId: Number(r.id), jobNumber: r.job_number, partNumber: r.part_number,
        dueDate: r.due_date, daysUntilDue: Number(r.days_until_due),
        remainingHours: Number(r.remaining_hours.toFixed(2)),
        riskLevel: r.risk_level,
        recommendation: r.risk_level === 'critical'
          ? "Overtime or outsource required to hit due date"
          : "Monitor closely — consider schedule compression"
      }))
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/fl/ai/capacity -> machine capacity load
router.get("/capacity", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.id, m.code, m.name, m.machine_type, m.daily_capacity_hours,
             COALESCE(SUM(rs.estimated_hours - rs.actual_hours) FILTER (WHERE rs.status <> 'complete'), 0)::float AS queued_hours,
             COALESCE(SUM(EXTRACT(EPOCH FROM (NOW() - ll.clock_in))/3600.0) FILTER (WHERE ll.clock_out IS NULL), 0)::float AS in_progress_hours
      FROM fl_machines m
      LEFT JOIN fl_routing_steps rs ON rs.machine_id = m.id
      LEFT JOIN fl_labor_logs ll ON ll.machine_id = m.id
      WHERE m.active = TRUE
      GROUP BY m.id
      ORDER BY m.code
    `);
    return res.json({
      success: true,
      machines: result.rows.map((r) => {
        const loadHours = Number(r.queued_hours) + Number(r.in_progress_hours);
        const utilization = r.daily_capacity_hours > 0 ? Math.min(100, Math.round((loadHours / Number(r.daily_capacity_hours)) * 100)) : 0;
        return {
          id: Number(r.id), code: r.code, name: r.name, machineType: r.machine_type,
          dailyCapacityHours: Number(r.daily_capacity_hours),
          queuedHours: Number(r.queued_hours.toFixed(2)),
          inProgressHours: Number(r.in_progress_hours.toFixed(2)),
          utilizationPercent: utilization,
          overloaded: utilization > 100
        };
      })
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/fl/ai/suggest-routing -> automated routing suggestion for a part
router.post("/suggest-routing", async (req, res) => {
  const { partNumber, materialSpec, hasThreads, hasMilledFeatures, tightTolerances, requiresHeatTreat, requiresPlating } = req.body || {};
  if (!partNumber) return res.status(400).json({ error: "partNumber required" });
  try {
    const steps = [];
    let seq = 10;
    steps.push({ sequence: seq, type: "machining", workCenter: "SAW", description: "Cut raw material to blank" }); seq += 10;
    if (hasMilledFeatures !== true) {
      steps.push({ sequence: seq, type: "machining", workCenter: "LATHE-01", description: "CNC turning" }); seq += 10;
    }
    if (hasMilledFeatures) {
      steps.push({ sequence: seq, type: "machining", workCenter: "MILL-01", description: "CNC milling" }); seq += 10;
    }
    if (hasThreads || (hasMilledFeatures && tightTolerances)) {
      steps.push({ sequence: seq, type: "machining", workCenter: "LIVETOOL-01", description: "Live tooling / single-setup completion" }); seq += 10;
    }
    steps.push({ sequence: seq, type: "deburr", workCenter: "DEBURR", description: "Deburr & wash" }); seq += 10;
    if (requiresHeatTreat) {
      steps.push({ sequence: seq, type: "outside_process", workCenter: null, outside: true, process: "Heat Treat", description: "Outside: heat treatment" }); seq += 10;
    }
    if (requiresPlating) {
      steps.push({ sequence: seq, type: "outside_process", workCenter: null, outside: true, process: "Plating/Anodize", description: "Outside: plating/anodize" }); seq += 10;
    }
    steps.push({ sequence: seq, type: "inspection", workCenter: "QC-01", description: tightTolerances ? "Final QC (CMM, tight tolerance)" : "Final QC" }); seq += 10;
    steps.push({ sequence: seq, type: "packaging", workCenter: "SHIP", description: "Pack & ship" });

    await pool.query(
      `INSERT INTO fl_ai_decisions (module, input, output, confidence) VALUES ('routing', $1, $2, 'high')`,
      [JSON.stringify(req.body), JSON.stringify(steps)]
    );

    return res.json({ success: true, partNumber, suggestedRouting: steps, confidence: "high", note: "AI-generated routing suggestion — review before release." });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/fl/ai/decisions -> AI decision audit log
router.get("/decisions", async (_req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM fl_ai_decisions ORDER BY created_at DESC LIMIT 100`);
    return res.json({ success: true, decisions: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/fl/ai/decisions/:id -> accept or reject a recommendation
router.patch("/decisions/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { approved, reviewNotes = "" } = req.body || {};
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "id must be a positive integer" });
  if (typeof approved !== "boolean") return res.status(400).json({ error: "approved must be boolean" });
  if (typeof reviewNotes !== "string" || reviewNotes.length > 2000) return res.status(400).json({ error: "reviewNotes must be 2000 characters or fewer" });
  try {
    const result = await pool.query(`
      UPDATE fl_ai_decisions
      SET approved = $1, reviewed_by = $2, review_notes = $3, reviewed_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [approved, req.user?.email || req.user?.name || "operator", reviewNotes.trim() || null, id]);
    if (!result.rows[0]) return res.status(404).json({ error: "AI decision not found" });
    return res.json({ success: true, decision: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
