import express from "express";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { pool } from "../db.js";
import { computeMrpPlan, listMrpDraftPurchaseQueue, recordSupplierDelay, runMrpEngine } from "../services/mrpEngineService.js";
import { mrpSupplierDelaySchema } from "../validators/schemas.js";

const router = express.Router();

router.get("/forecast", async (_req, res, next) => {
  try {
    const result = await computeMrpPlan(pool, { preview: true });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
});

router.post("/run-engine", authenticate, async (req, res, next) => {
  try {
    const result = await runMrpEngine(req);
    return res.status(201).json({
      ...result,
      message: `MRP run complete: ${result.shortages.length} shortage(s), ${result.diagnostics.length} diagnostic warning(s).`
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/purchase-queue", authenticate, async (_req, res, next) => {
  try {
    return res.json({ success: true, vendors: await listMrpDraftPurchaseQueue() });
  } catch (error) {
    return next(error);
  }
});

router.post("/supplier-delay", authenticate, validateBody(mrpSupplierDelaySchema), async (req, res, next) => {
  try {
    const result = await recordSupplierDelay(req.body);
    if (!result) return res.status(404).json({ error: "MRP purchase queue line not found", requestId: req.requestId });
    return res.status(202).json({ success: true, signal: result });
  } catch (error) {
    return next(error);
  }
});

router.get("/demands", async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, run_id, part_number, description, gross_requirement, on_hand,
              net_deficiency, suggested_order_qty, estimated_cost, priority, status, created_at
       FROM mrp_procurement_demands
       ORDER BY CASE status WHEN 'OPEN' THEN 0 ELSE 1 END, created_at DESC
       LIMIT 200`
    );
    return res.status(200).json({ success: true, demands: result.rows });
  } catch (error) {
    return next(error);
  }
});

export default router;
