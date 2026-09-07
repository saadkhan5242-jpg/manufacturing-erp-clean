import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

/* ============================================================
   LIVE JOB DASHBOARD — GET /api/dashboard/live-jobs
   All active work orders joined to their current routing step,
   with total logged labor hours vs estimated hours and
   efficiency variance metrics. Labor hours are derived from
   labor_transactions (end-start), plus any open punch's
   elapsed time, so the grid updates in real time.
   ============================================================ */
router.get("/live-jobs", async (_req, res) => {
  try {
    const result = await pool.query(`
      WITH labor_hours AS (
        SELECT work_order_id,
               SUM(EXTRACT(EPOCH FROM (COALESCE(end_time, NOW()) - start_time)) / 3600.0) AS logged_hours,
               SUM(pieces_produced) AS pieces
        FROM labor_transactions
        GROUP BY work_order_id
      ),
      current_step AS (
        SELECT DISTINCT ON (work_order_id)
               work_order_id, work_center_code, sequence_number, status AS step_status,
               estimated_hours, actual_hours
        FROM job_routing
        ORDER BY work_order_id,
                 CASE status WHEN 'In-Progress' THEN 0 WHEN 'Pending' THEN 1 ELSE 2 END,
                 sequence_number ASC
      ),
      step_totals AS (
        SELECT work_order_id,
               SUM(estimated_hours) AS est_total,
               SUM(actual_hours) AS act_total
        FROM job_routing
        GROUP BY work_order_id
      )
      SELECT wo.id,
             wo.order_number,
             wo.part_number,
             wo.status,
             wo.quantity_ordered,
             wo.quantity_completed,
             so.order_number AS sales_order_number,
             cs.work_center_code AS current_work_center,
             cs.sequence_number AS current_sequence,
             cs.step_status,
             COALESCE(st.est_total, 0)::float AS estimated_hours,
             COALESCE(lh.logged_hours, 0)::float AS logged_hours,
             COALESCE(lh.pieces, 0)::int AS pieces_produced,
             COALESCE(wip.wip_cost, 0)::float AS wip_cost,
             ROUND(
               100 * COALESCE(st.est_total, 0) /
               NULLIF(COALESCE(lh.logged_hours, 0), 0), 2
             )::float AS efficiency_percent,
             ROUND(
               COALESCE(lh.logged_hours, 0) - COALESCE(st.est_total, 0), 2
             )::float AS variance_hours,
             CASE
               WHEN COALESCE(st.est_total, 0) > 0
                AND COALESCE(lh.logged_hours, 0) > COALESCE(st.est_total, 0) * 1.25
                 THEN 'OVER_BUDGET'
               WHEN COALESCE(lh.logged_hours, 0) > COALESCE(st.est_total, 0)
                 THEN 'BEHIND'
               ELSE 'ON_TRACK'
             END AS variance_flag
      FROM work_orders wo
      LEFT JOIN sales_orders so ON so.id = wo.sales_order_id
      LEFT JOIN current_step cs ON cs.work_order_id = wo.id
      LEFT JOIN step_totals st ON st.work_order_id = wo.id
      LEFT JOIN labor_hours lh ON lh.work_order_id = wo.id
      LEFT JOIN (
        SELECT work_order_id, SUM(debit - credit) AS wip_cost
        FROM wip_ledger GROUP BY work_order_id
      ) wip ON wip.work_order_id = wo.id
      WHERE wo.status IN ('open', 'released', 'in-progress', 'In-Progress', 'Planned')
      ORDER BY wo.due_date ASC NULLS LAST, wo.id ASC
    `);

    // Fetch per-step sequence detail for every returned work order (SFC routing sequences)
    const stepsRes = await pool.query(`
      SELECT id, work_order_id, work_center_code, sequence_number, estimated_hours, actual_hours, status
      FROM job_routing
      ORDER BY work_order_id, sequence_number ASC
    `);
    const stepsByWo = new Map();
    for (const s of stepsRes.rows) {
      if (!stepsByWo.has(s.work_order_id)) stepsByWo.set(s.work_order_id, []);
      stepsByWo.get(s.work_order_id).push({
        routingStepId: Number(s.id),
        workCenterCode: s.work_center_code,
        sequenceNumber: s.sequence_number,
        estimatedHours: Number(s.estimated_hours),
        actualHours: Number(s.actual_hours),
        status: s.status
      });
    }

    return res.status(200).json({
      success: true,
      polledAt: new Date().toISOString(),
      jobs: result.rows.map((row) => ({
        id: Number(row.id),
        orderNumber: row.order_number,
        partNumber: row.part_number,
        status: row.status,
        quantityOrdered: Number(row.quantity_ordered),
        quantityCompleted: Number(row.quantity_completed),
        currentWorkCenter: row.current_work_center || "UNSCHEDULED",
        currentSequence: row.current_sequence,
        stepStatus: row.step_status || "Pending",
        estimatedHours: row.estimated_hours,
        loggedHours: Number(row.logged_hours.toFixed(2)),
        piecesProduced: row.pieces_produced,
        efficiencyPercent: row.efficiency_percent,
        varianceHours: row.variance_hours,
        varianceFlag: row.variance_flag,
        salesOrderNumber: row.sales_order_number || null,
        wipCost: Number(row.wip_cost.toFixed(2)),
        steps: stepsByWo.get(row.id) || []
      }))
    });
  } catch (error) {
    console.error("Live Jobs Dashboard Error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to load live jobs", message: error.message });
  }
});

router.get("/completion-history", async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 31);
  try {
    const result = await pool.query(`
      SELECT created_at::date AS day, COUNT(*)::int AS completed
      FROM work_orders
      WHERE status IN ('completed', 'Completed', 'shipped', 'Shipped')
        AND updated_at >= CURRENT_DATE - ($1::int - 1)
      GROUP BY created_at::date
      ORDER BY day
    `, [days]);
    return res.json({ success: true, days, history: result.rows.map((row) => ({ day: row.day, completed: row.completed })) });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to load completion history", message: error.message });
  }
});

/* ============================================================
   DAILY SHIPMENT DASHBOARD — GET /api/dashboard/daily-shipments
   Today's shipped vs pending volume, computed by comparing
   target_ship_date against actual_ship_date. Each shipment is
   classified On-Time / Delayed / Critical (Past Due).
   ============================================================ */
router.get("/daily-shipments", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT sl.id,
             sl.customer_id,
             sl.sales_order_number,
             sl.order_number,
             sl.part_number,
             sl.target_ship_date,
             sl.actual_ship_date,
             sl.quantity_shipped,
             sl.carrier,
             CASE
               WHEN sl.actual_ship_date IS NOT NULL AND sl.actual_ship_date <= sl.target_ship_date
                 THEN 'On-Time'
               WHEN sl.actual_ship_date IS NOT NULL AND sl.actual_ship_date > sl.target_ship_date
                 THEN 'Delayed'
               WHEN sl.actual_ship_date IS NULL AND sl.target_ship_date < CURRENT_DATE
                 THEN 'Past Due'
               ELSE 'Scheduled'
             END AS tracking_status
      FROM shipment_lines sl
      WHERE sl.target_ship_date <= CURRENT_DATE
         OR sl.actual_ship_date = CURRENT_DATE
      ORDER BY tracking_status DESC, sl.target_ship_date ASC
    `);

    const rows = result.rows.map((row) => ({
      id: Number(row.id),
      customerId: row.customer_id,
      salesOrderNumber: row.sales_order_number || null,
      orderNumber: row.order_number,
      partNumber: row.part_number,
      targetShipDate: row.target_ship_date,
      actualShipDate: row.actual_ship_date,
      quantityShipped: Number(row.quantity_shipped),
      carrier: row.carrier,
      trackingStatus: row.tracking_status
    }));

    const scheduledToday = rows.filter((r) =>
      r.targetShipDate && new Date(r.targetShipDate).toDateString() === new Date().toDateString());
    const shippedToday = rows.filter((r) =>
      r.actualShipDate && new Date(r.actualShipDate).toDateString() === new Date().toDateString());

    return res.status(200).json({
      success: true,
      polledAt: new Date().toISOString(),
      metrics: {
        totalScheduledToday: scheduledToday.length,
        totalShippedToday: shippedToday.length,
        unitsShippedToday: shippedToday.reduce((sum, r) => sum + r.quantityShipped, 0),
        onTime: rows.filter((r) => r.trackingStatus === "On-Time").length,
        delayed: rows.filter((r) => r.trackingStatus === "Delayed").length,
        pastDue: rows.filter((r) => r.trackingStatus === "Past Due").length
      },
      shipments: rows
    });
  } catch (error) {
    console.error("Daily Shipments Dashboard Error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to load daily shipments", message: error.message });
  }
});

export default router;
