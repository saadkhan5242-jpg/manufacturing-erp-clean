import express from "express";
import { pool, withTransaction } from "../db.js";

const router = express.Router();

/* ============================================================
   MODULE 5: AUTOMATED MRP RUN ENGINE (PostgreSQL-backed)
   Parses open work orders (shop_floor_labor_logs), reads BOM
   routing maps (router_operations.required_materials jsonb),
   nets against live stock tallies (inventory), and INSERTs
   actionable purchasing requisitions (mrp_procurement_demands).
   ============================================================ */

/**
 * Explicit MRP processing loop. Shared by the live forecast preview
 * and the committed run so both always agree on the math.
 */
async function computeMrpDemand(client) {
  // 1. Parse open work orders: labor logs that have not clocked out yet
  const openJobs = await client.query(`
    SELECT sfll.id AS log_id, sfll.work_order_id, sfll.router_operation_id,
           ro.required_materials, ro.work_center, ro.sequence_number
    FROM shop_floor_labor_logs sfll
    JOIN router_operations ro ON ro.id = sfll.router_operation_id
    WHERE sfll.clock_out_time IS NULL
  `);

  // 2. Explode BOM routing maps into gross material requirements
  const grossMap = new Map();
  for (const job of openJobs.rows) {
    const materials = Array.isArray(job.required_materials) ? job.required_materials : [];
    for (const material of materials) {
      const partNumber = String(material.partNumber || "").trim();
      if (!partNumber) continue;
      const qty = Number(material.quantity) || 0;
      const entry = grossMap.get(partNumber) || { partNumber, grossRequirement: 0, sources: [] };
      entry.grossRequirement += qty;
      entry.sources.push({ workOrderId: job.work_order_id, workCenter: job.work_center, quantity: qty });
      grossMap.set(partNumber, entry);
    }
  }

  // 3. Cross-reference current stock tallies and compute net deficiency delta
  const partNumbers = [...grossMap.keys()];
  const stock = partNumbers.length
    ? await client.query(
        "SELECT part_number, description, quantity, unit_price FROM inventory WHERE part_number = ANY($1)",
        [partNumbers]
      )
    : { rows: [] };
  const stockMap = new Map(stock.rows.map((row) => [row.part_number, row]));

  return {
    openJobCount: openJobs.rows.length,
    requirements: partNumbers.map((partNumber) => {
      const demand = grossMap.get(partNumber);
      const onHandRow = stockMap.get(partNumber);
      const onHand = Number(onHandRow?.quantity) || 0;
      const unitPrice = Number(onHandRow?.unit_price) || 0;
      const netDeficiency = Math.max(0, demand.grossRequirement - onHand);
      return {
        partNumber,
        description: onHandRow?.description || partNumber,
        grossRequirement: demand.grossRequirement,
        onHand,
        netDeficiency,
        suggestedOrderQty: netDeficiency,
        estimatedCost: Number((netDeficiency * unitPrice).toFixed(2)),
        priority: netDeficiency > 0 && onHand === 0 ? "CRITICAL" : netDeficiency > 0 ? "EXPEDITE" : "STANDARD",
        status: netDeficiency > 0 ? "SHORTAGE" : "COVERED",
        sources: demand.sources
      };
    })
  };
}

// GET /forecast -> live shortage preview without writing requisitions
router.get("/forecast", async (_req, res) => {
  try {
    const result = await computeMrpDemand(pool);
    return res.status(200).json({ success: true, preview: true, ...result });
  } catch (error) {
    console.error("MRP Forecast Error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to compute MRP forecast", message: error.message });
  }
});

// POST /run-engine -> full transactional MRP generation run
router.post("/run-engine", async (_req, res) => {
  try {
    const runId = `MRP-${Date.now()}`;
    const result = await withTransaction(async (client) => {
      const computed = await computeMrpDemand(client);

      // Supersede any still-open requisitions from previous runs
      await client.query("UPDATE mrp_procurement_demands SET status = 'SUPERSEDED' WHERE status = 'OPEN'");

      // 4. INSERT actionable purchasing requisitions for every shortage
      const shortages = computed.requirements.filter((req) => req.netDeficiency > 0);
      for (const shortage of shortages) {
        await client.query(
          `INSERT INTO mrp_procurement_demands
           (run_id, part_number, description, gross_requirement, on_hand, net_deficiency, suggested_order_qty, estimated_cost, priority, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'OPEN')`,
          [runId, shortage.partNumber, shortage.description, shortage.grossRequirement,
           shortage.onHand, shortage.netDeficiency, shortage.suggestedOrderQty,
           shortage.estimatedCost, shortage.priority]
        );
      }
      return { ...computed, shortages };
    });

    return res.status(201).json({
      success: true,
      runId,
      openJobsParsed: result.openJobCount,
      partsAnalyzed: result.requirements.length,
      shortagesFound: result.shortages.length,
      requirements: result.requirements,
      message: `GSS MRP run complete: ${result.shortages.length} procurement demand(s) generated from ${result.openJobCount} open job(s).`
    });
  } catch (error) {
    console.error("MRP Run Engine Error:", error.message);
    return res.status(500).json({ success: false, error: "MRP material generation run failed", message: error.message });
  }
});

// GET /demands -> purchasing requisitions ledger (latest open first)
router.get("/demands", async (_req, res) => {
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
    console.error("MRP Demands Query Error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to fetch MRP procurement demands", message: error.message });
  }
});

export default router;
