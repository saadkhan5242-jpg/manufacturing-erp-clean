import { Router } from "express";
import { pool, withTransaction } from "../db.js";

const router = Router();

/* ============================================================
   FORGELOGIC AI — ESTIMATING & QUOTING ENGINE
   AI-assisted quoting with cost rollup (material + labor +
   overhead + outside process) and margin pricing.
   ============================================================ */

// POST /api/fl/quotes/estimate -> AI-assisted quote generation
router.post("/estimate", async (req, res) => {
  const { partNumber, partName, quantity = 1, materialSpec, machineType = "cnc_mill", complexity = "medium", outsideProcesses = [] } = req.body || {};
  if (typeof partNumber !== "string" || !partNumber.trim()) return res.status(400).json({ error: "partNumber required" });
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: "quantity must be greater than zero" });
  if (!["low", "medium", "high", "extreme"].includes(complexity)) return res.status(400).json({ error: "Unsupported complexity" });

  try {
    // Look up machine rates for costing
    const machine = await pool.query(`SELECT * FROM fl_machines WHERE machine_type = $1 AND active = TRUE LIMIT 1`, [machineType]);
    const mc = machine.rows[0] || { labor_rate: 35, overhead_rate: 15, machine_rate: 85 };

    // Heuristic AI estimate (complexity + material factors)
    const complexityFactor = { low: 0.8, medium: 1, high: 1.35, extreme: 1.8 }[complexity] || 1;
    const materialFactor = /titanium|inconel|hardened/i.test(String(materialSpec)) ? 1.45 : /aluminum|plastic|brass/i.test(String(materialSpec)) ? 0.85 : 1;
    const setupHours = Number((1.5 * complexityFactor).toFixed(2));
    const runHoursPerPiece = Number((0.25 * complexityFactor * materialFactor).toFixed(3));
    const totalMachineHours = setupHours + runHoursPerPiece * qty;

    const laborCost = Number((totalMachineHours * mc.labor_rate).toFixed(2));
    const overheadCost = Number((totalMachineHours * mc.overhead_rate).toFixed(2));
    const materialCost = Number((qty * 8.5 * materialFactor).toFixed(2)); // heuristic stock cost
    const outsideCost = Number((outsideProcesses.reduce((s, p) => s + (Number(p.cost) || 0), 0)).toFixed(2));

    const subtotal = laborCost + overheadCost + materialCost + outsideCost;
    const margin = 0.30;
    const totalPrice = Number((subtotal / (1 - margin)).toFixed(2));
    const unitPrice = Number((totalPrice / qty).toFixed(2));

    // Log the AI decision
    await pool.query(
      `INSERT INTO fl_ai_decisions (module, input, output, confidence) VALUES ('estimating', $1, $2, 'medium')`,
      [JSON.stringify(req.body), JSON.stringify({ laborCost, overheadCost, materialCost, outsideCost, unitPrice })]
    );

    return res.json({
      success: true,
      estimate: {
        partNumber, partName, quantity: qty,
        setupHours, runHoursPerPiece, totalMachineHours: Number(totalMachineHours.toFixed(2)),
        laborCost, overheadCost, materialCost, outsideProcessCost: outsideCost,
        subtotal: Number(subtotal.toFixed(2)), marginPercent: margin * 100,
        unitPrice, totalPrice,
        confidence: "medium",
        approved: false
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/fl/quotes -> list
router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(`SELECT q.*, c.name AS customer_name FROM fl_quotes q LEFT JOIN fl_customers c ON c.id = q.customer_id ORDER BY q.created_at DESC LIMIT 200`);
    return res.json({ success: true, quotes: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/fl/quotes -> create quote (optionally from AI estimate)
router.post("/", async (req, res) => {
  const { quoteNumber, customerId, partNumber, partName, quantity, materialCost, laborCost, overheadCost, outsideProcessCost, marginPercent, notes, aiEstimated, revision = "Rev A", bomId } = req.body || {};
  if (typeof quoteNumber !== "string" || !quoteNumber.trim() || typeof partNumber !== "string" || !partNumber.trim()) return res.status(400).json({ error: "quoteNumber and partNumber required" });
  try {
    const qty = Number(quantity);
    const marginPercentValue = Number(marginPercent ?? 30);
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: "quantity must be greater than zero" });
    if (!Number.isFinite(marginPercentValue) || marginPercentValue < 0 || marginPercentValue >= 100) return res.status(400).json({ error: "marginPercent must be between 0 and 99.99" });
    if (typeof revision !== "string" || !revision.trim() || revision.length > 40) return res.status(400).json({ error: "revision is required and must be 40 characters or fewer" });
    const subtotal = (Number(materialCost) || 0) + (Number(laborCost) || 0) + (Number(overheadCost) || 0) + (Number(outsideProcessCost) || 0);
    const margin = marginPercentValue / 100;
    const totalPrice = Number((subtotal / (1 - margin)).toFixed(2));
    const unitPrice = Number((totalPrice / qty).toFixed(2));
    const result = await pool.query(
      `INSERT INTO fl_quotes (quote_number, customer_id, part_number, part_name, quantity, material_cost, labor_cost, overhead_cost, outside_process_cost, margin_percent, unit_price, total_price, ai_estimated, notes, revision, bom_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'draft') RETURNING id`,
      [quoteNumber.trim(), customerId || null, partNumber.trim(), partName || null, qty, materialCost || 0, laborCost || 0, overheadCost || 0, outsideProcessCost || 0, marginPercentValue, unitPrice, totalPrice, aiEstimated === true, notes || null, revision.trim(), bomId || null]
    );
    return res.status(201).json({ success: true, quoteId: Number(result.rows[0].id), unitPrice, totalPrice });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "id must be a positive integer" });
  if (!["draft", "sent", "won", "lost", "expired"].includes(status)) return res.status(400).json({ error: "Unsupported quote status" });
  try {
    const result = await pool.query(`UPDATE fl_quotes SET status = $1 WHERE id = $2 RETURNING id, quote_number, status`, [status, id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Quote not found" });
    return res.json({ success: true, quote: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/:id/convert", async (req, res) => {
  const quoteId = Number(req.params.id);
  if (!Number.isSafeInteger(quoteId) || quoteId < 1) return res.status(400).json({ error: "id must be a positive integer" });
  try {
    const result = await withTransaction(async (client) => {
      const quoteResult = await client.query(`SELECT * FROM fl_quotes WHERE id = $1 FOR UPDATE`, [quoteId]);
      const quote = quoteResult.rows[0];
      if (!quote) return null;
      if (quote.status !== "won") throw Object.assign(new Error("Only won quotes can be converted to jobs"), { statusCode: 409 });
      const jobNumber = String(req.body?.jobNumber || `JOB-${quote.quote_number}`).trim();
      const jobResult = await client.query(`
        INSERT INTO fl_jobs (job_number, quote_id, customer_id, part_number, part_name, quantity_ordered, material_spec, due_date, revision, bom_id, material_cost, labor_cost, overhead_cost, outside_process_cost, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'released') RETURNING id, job_number
      `, [jobNumber, quote.id, quote.customer_id, quote.part_number, quote.part_name, quote.quantity, null, req.body?.dueDate || null, quote.revision, quote.bom_id, quote.material_cost, quote.labor_cost, quote.overhead_cost, quote.outside_process_cost]);
      const template = [
        [10, "machining", "Saw / cut raw material to blank", "SAW", false],
        [20, "setup", "CNC setup", "MILL-01", false],
        [30, "machining", "Primary machining", "MILL-01", false],
        [40, "deburr", "Deburr & wash", "DEBURR", false],
        [50, "inspection", "Final QC inspection", "QC-01", false],
        [60, "packaging", "Pack & ship prep", "SHIP", false]
      ];
      for (const [sequence, type, description, workCenter, outside] of template) {
        await client.query(`INSERT INTO fl_routing_steps (job_id, sequence_number, operation_type, work_center_code, description, is_outside_process, status) VALUES ($1,$2,$3,$4,$5,$6,'pending')`, [jobResult.rows[0].id, sequence, type, workCenter, description, outside]);
      }
      return jobResult.rows[0];
    });
    if (!result) return res.status(404).json({ error: "Quote not found" });
    return res.status(201).json({ success: true, jobId: Number(result.id), jobNumber: result.job_number, message: "Quote converted to released job with routing" });
  } catch (error) {
    return res.status(error.statusCode || (error.code === "23505" ? 409 : 500)).json({ success: false, error: error.message });
  }
});

export default router;
