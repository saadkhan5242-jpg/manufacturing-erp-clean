import { Router } from "express";
import { pool, withTransaction } from "../db.js";

const router = Router();

/* ============================================================
   LABOR LOGGING — POST /api/shop-floor/labor-log
   Books labor hours against a JobRouting step AND writes the
   corresponding financial valuation entry to the WipLedger
   (Labor WIP at work_center.labor_rate, Overhead WIP at
   overhead_rate) — all inside one ACID transaction. This is the
   SFC -> GL link in the GSS closed loop.
   ============================================================ */
router.post("/labor-log", async (req, res) => {
  const {
    employeeId,
    workOrderId,
    routingStepId: rawRoutingStepId,
    sequence,
    workCode,
    setupHours: rawSetupHours,
    runHours: rawRunHours,
    piecesProduced = 0,
    piecesScrapped = 0
  } = req.body || {};

  const cleanEmployeeId = String(employeeId || "").trim();
  const cleanWorkOrderId = parseInt(workOrderId, 10);

  if (!cleanEmployeeId || !cleanWorkOrderId) {
    return res.status(400).json({ error: "employeeId and workOrderId are required." });
  }

  let setupHours = Number(rawSetupHours || 0);
  let runHours = Number(rawRunHours || 0);

  if (setupHours === 0 && runHours === 0) {
    if (workCode === 'S') setupHours = 1.0;
    else runHours = 1.0;
  }

  const totalHours = setupHours + runHours;
  if (!(totalHours > 0)) {
    return res.status(400).json({ error: "setupHours + runHours must be greater than zero." });
  }

  try {
    const result = await withTransaction(async (client) => {
      let stepRes;
      if (rawRoutingStepId) {
        stepRes = await client.query(
          `SELECT jr.id, jr.work_order_id, jr.work_center_code, jr.status,
                  wc.labor_rate, wc.overhead_rate
           FROM job_routing jr
           LEFT JOIN work_centers wc ON wc.code = jr.work_center_code
           WHERE jr.id = $1 AND jr.work_order_id = $2`,
          [parseInt(rawRoutingStepId, 10), cleanWorkOrderId]
        );
      }

      if ((!stepRes || stepRes.rows.length === 0) && (sequence || rawRoutingStepId)) {
        const targetSeq = parseInt(sequence || rawRoutingStepId, 10) || 10;
        stepRes = await client.query(
          `SELECT jr.id, jr.work_order_id, jr.work_center_code, jr.status,
                  wc.labor_rate, wc.overhead_rate
           FROM job_routing jr
           LEFT JOIN work_centers wc ON wc.code = jr.work_center_code
           WHERE jr.work_order_id = $1 AND jr.sequence_number = $2`,
          [cleanWorkOrderId, targetSeq]
        );
      }

      if (!stepRes || stepRes.rows.length === 0) {
        stepRes = await client.query(
          `SELECT jr.id, jr.work_order_id, jr.work_center_code, jr.status,
                  wc.labor_rate, wc.overhead_rate
           FROM job_routing jr
           LEFT JOIN work_centers wc ON wc.code = jr.work_center_code
           WHERE jr.work_order_id = $1
           ORDER BY jr.sequence_number ASC LIMIT 1`,
          [cleanWorkOrderId]
        );
      }

      if (!stepRes || stepRes.rows.length === 0) {
        const err = new Error("No valid routing step found for the specified work order.");
        err.statusCode = 400;
        throw err;
      }

      const step = stepRes.rows[0];
      const routingStepId = step.id;

      const laborRate = Number(step.labor_rate) || 0;
      const overheadRate = Number(step.overhead_rate) || 0;
      const laborCost = Number((totalHours * laborRate).toFixed(2));
      const overheadCost = Number((totalHours * overheadRate).toFixed(2));

      // 1. Insert the labor transaction (elapsed window = now - hours .. now)
      const tx = await client.query(
        `INSERT INTO labor_transactions
           (employee_id, work_order_id, routing_step_id, start_time, end_time,
            setup_hours, run_hours, pieces_produced, pieces_scrapped, labor_cost, overhead_cost)
         VALUES ($1, $2, $3, NOW() - ($4 || ' hours')::interval, NOW(), $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [String(employeeId), parseInt(workOrderId, 10), parseInt(routingStepId, 10),
         totalHours, Number(setupHours) || 0, Number(runHours) || 0,
         parseInt(piecesProduced, 10) || 0, parseInt(piecesScrapped, 10) || 0,
         laborCost, overheadCost]
      );
      const laborTxId = tx.rows[0].id;

      // 2. Increment actual_hours on the JobRouting step
      await client.query(
        "UPDATE job_routing SET actual_hours = actual_hours + $1, status = 'In-Progress' WHERE id = $2",
        [Number(totalHours.toFixed(4)), parseInt(routingStepId, 10)]
      );

      // 3. Roll produced pieces into the work order completion tally
      const produced = parseInt(piecesProduced, 10) || 0;
      if (produced > 0) {
        await client.query(
          `UPDATE work_orders
           SET quantity_completed = LEAST(quantity_completed + $1, quantity_ordered),
               status = CASE WHEN quantity_completed + $1 >= quantity_ordered THEN 'completed' ELSE status END,
               updated_at = NOW()
           WHERE id = $2`,
          [produced, parseInt(workOrderId, 10)]
        );
      }

      // 4. Write the GL WipLedger valuation entries (Labor + Overhead)
      if (laborCost > 0) {
        await client.query(
          `INSERT INTO wip_ledger (work_order_id, entry_type, debit, reference)
           VALUES ($1, 'Labor WIP', $2, $3)`,
          [parseInt(workOrderId, 10), laborCost, `LABOR-${laborTxId} @ ${step.work_center_code}`]
        );
      }
      if (overheadCost > 0) {
        await client.query(
          `INSERT INTO wip_ledger (work_order_id, entry_type, debit, reference)
           VALUES ($1, 'Overhead WIP', $2, $3)`,
          [parseInt(workOrderId, 10), overheadCost, `OVH-${laborTxId} @ ${step.work_center_code}`]
        );
      }

      return { laborTxId, totalHours, laborCost, overheadCost, workCenter: step.work_center_code };
    });

    return res.status(201).json({
      success: true,
      message: "Labor logged and WIP valuation booked to GL.",
      laborTransactionId: Number(result.laborTxId),
      hoursLogged: result.totalHours,
      laborCost: result.laborCost,
      overheadCost: result.overheadCost,
      workCenter: result.workCenter
    });
  } catch (error) {
    console.error("Labor Log Error:", error.message);
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

export default router;
