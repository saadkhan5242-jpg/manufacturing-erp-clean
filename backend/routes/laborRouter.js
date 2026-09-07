import { Router } from "express";
import { pool, withTransaction } from "../db.js";

const router = Router();

/* ============================================================
   LABOR TRANSACTION ENGINE — /api/labor
   Real-time clock-in / clock-out punches against labor_transactions.
   Clock-out dynamically increments actual_hours on the linked
   job_routing step and quantity_completed on the work order,
   all inside a single ACID transaction.
   ============================================================ */

// POST /api/labor/clock-in -> open a punch record (one open punch per employee)
router.post("/clock-in", async (req, res) => {
  const { employeeId, workOrderId, routingStepId } = req.body || {};

  if (!employeeId || !workOrderId || !routingStepId) {
    return res.status(400).json({ error: "employeeId, workOrderId, and routingStepId are required." });
  }

  try {
    const result = await withTransaction(async (client) => {
      // Verify the routing step belongs to the work order (relational integrity)
      const step = await client.query(
        "SELECT id FROM job_routing WHERE id = $1 AND work_order_id = $2",
        [parseInt(routingStepId, 10), parseInt(workOrderId, 10)]
      );
      if (step.rows.length === 0) {
        const err = new Error("Routing step does not belong to the specified work order.");
        err.statusCode = 400;
        throw err;
      }

      // One open punch per employee
      await client.query(
        "UPDATE labor_transactions SET end_time = NOW() WHERE employee_id = $1 AND end_time IS NULL",
        [String(employeeId)]
      );

      const inserted = await client.query(
        `INSERT INTO labor_transactions (employee_id, work_order_id, routing_step_id, start_time)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, start_time`,
        [String(employeeId), parseInt(workOrderId, 10), parseInt(routingStepId, 10)]
      );

      // Mark the step and order as actively in progress
      await client.query(
        "UPDATE job_routing SET status = 'In-Progress' WHERE id = $1 AND status = 'Pending'",
        [parseInt(routingStepId, 10)]
      );
      await client.query(
        "UPDATE work_orders SET status = 'in-progress', updated_at = NOW() WHERE id = $1 AND status IN ('open', 'released')",
        [parseInt(workOrderId, 10)]
      );

      return inserted.rows[0];
    });

    return res.status(201).json({
      success: true,
      message: `Employee ${employeeId} clocked in.`,
      laborTransactionId: Number(result.id),
      startTime: result.start_time
    });
  } catch (error) {
    console.error("Labor Clock-In Error:", error.message);
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

// POST /api/labor/clock-out -> close punch, increment actual_hours + quantity_completed
router.post("/clock-out", async (req, res) => {
  const { laborTransactionId, piecesProduced } = req.body || {};

  if (!laborTransactionId) {
    return res.status(400).json({ error: "laborTransactionId is required." });
  }

  try {
    const result = await withTransaction(async (client) => {
      const punch = await client.query(
        `UPDATE labor_transactions
         SET end_time = NOW(), pieces_produced = $1
         WHERE id = $2 AND end_time IS NULL
         RETURNING id, work_order_id, routing_step_id, start_time, end_time, pieces_produced`,
        [parseInt(piecesProduced, 10) || 0, parseInt(laborTransactionId, 10)]
      );

      if (punch.rows.length === 0) {
        const err = new Error("Open labor transaction not found (already closed or invalid id).");
        err.statusCode = 404;
        throw err;
      }

      const row = punch.rows[0];
      const hoursWorked = (new Date(row.end_time) - new Date(row.start_time)) / 3600000;

      // Dynamically increment actual_hours on the routing step
      await client.query(
        "UPDATE job_routing SET actual_hours = actual_hours + $1 WHERE id = $2",
        [Number(hoursWorked.toFixed(4)), row.routing_step_id]
      );

      // Roll produced pieces up to the work order completion tally
      if (row.pieces_produced > 0) {
        await client.query(
          `UPDATE work_orders
           SET quantity_completed = LEAST(quantity_completed + $1, quantity_ordered),
               updated_at = NOW()
           WHERE id = $2`,
          [row.pieces_produced, row.work_order_id]
        );
      }

      // Auto-complete the work order when the ordered quantity is fully produced
      await client.query(
        `UPDATE work_orders
         SET status = 'completed', updated_at = NOW()
         WHERE id = $1 AND quantity_ordered > 0 AND quantity_completed >= quantity_ordered AND status <> 'completed'`,
        [row.work_order_id]
      );

      return { ...row, hoursWorked: Number(hoursWorked.toFixed(4)) };
    });

    return res.status(200).json({
      success: true,
      message: "Punch closed. Routing actual_hours and work order completion updated.",
      laborTransactionId: Number(result.id),
      hoursWorked: result.hoursWorked,
      piecesProduced: result.pieces_produced
    });
  } catch (error) {
    console.error("Labor Clock-Out Error:", error.message);
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

export default router;
