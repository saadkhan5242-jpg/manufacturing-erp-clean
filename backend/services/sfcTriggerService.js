import { withTransaction } from "../db.js";

/* ============================================================
   LOOP 1: SALES ORDER TRIGGER HOOK  (Order Entry ──► Shop Floor)
   When a Sales Order is submitted, checks Material Master
   inventory for an absolute shortfall. If stock cannot cover
   demand, automatically generates a Work Order + standard
   routing sequences (Step 10 CNC_MILL, Step 20 ASSEMBLY) as
   JobRouting rows linked to that job number — one transaction.
   ============================================================ */

// Standard routing template for a fabricated assembly (GSS baseline)
const STANDARD_ROUTING = [
  { sequenceNumber: 10, workCenterCode: "CNC_MILL", estimatedHours: 4.0 },
  { sequenceNumber: 20, workCenterCode: "ASSEMBLY", estimatedHours: 2.5 }
];

/**
 * Evaluate a sales order line and auto-generate a Work Order + routing
 * when the part is short in the Material Master.
 *
 * Runs inside the caller's transaction when a client is supplied (so
 * FK references to a not-yet-committed sales_orders row resolve),
 * otherwise opens its own transaction.
 *
 * @param {object} salesOrder  { id, orderNumber, partNumber, quantityOrdered, requiredDate }
 * @param {import('pg').PoolClient} [client]  existing transaction client
 * @returns {Promise<{created: boolean, workOrderId?: number, orderNumber?: string,
 *                    shortfall?: number, onHand?: number, required?: number}>}
 */
export async function generateWorkOrderForSalesOrder(salesOrder, client = null) {
  const { id: salesOrderId, orderNumber: soNumber, partNumber, quantityOrdered, requiredDate } = salesOrder;

  if (!partNumber || !(Number(quantityOrdered) > 0)) {
    return { created: false, reason: "Missing partNumber or quantityOrdered" };
  }

  const run = async (cx) => {
    // 1. Check Material Master inventory for the part
    const stockRes = await cx.query(
      "SELECT quantity FROM inventory WHERE part_number = $1",
      [String(partNumber)]
    );
    const onHand = Number(stockRes.rows[0]?.quantity) || 0;
    const required = Number(quantityOrdered);
    const shortfall = required - onHand;

    // Absolute shortfall check — only generate a job when stock cannot cover demand
    if (shortfall <= 0) {
      return { created: false, reason: "Sufficient stock on hand", onHand, required, shortfall: 0 };
    }

    // 2. Create the Work Order row (linked back to the originating Sales Order)
    const woNumber = `WO-AUTO-${soNumber || salesOrderId}`;
    const woRes = await cx.query(
      `INSERT INTO work_orders
         (order_number, part_number, quantity, quantity_ordered, quantity_completed,
          status, due_date, sales_order_id, created_at, updated_at)
       VALUES ($1, $2, $3, $3, 0, 'released', $4, $5, NOW(), NOW())
       ON CONFLICT (order_number) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [woNumber, String(partNumber), shortfall, requiredDate || null, salesOrderId || null]
    );
    const workOrderId = Number(woRes.rows[0].id);

    // 3. Populate standard JobRouting sequences linked to the new job number
    for (const step of STANDARD_ROUTING) {
      await cx.query(
        `INSERT INTO job_routing
           (work_order_id, work_center_code, sequence_number, estimated_hours, actual_hours, status)
         VALUES ($1, $2, $3, $4, 0, 'Pending')
         ON CONFLICT (work_order_id, sequence_number) DO NOTHING`,
        [workOrderId, step.workCenterCode, step.sequenceNumber, step.estimatedHours]
      );
    }

    return {
      created: true,
      workOrderId,
      orderNumber: woNumber,
      shortfall,
      onHand,
      required,
      routingSteps: STANDARD_ROUTING.length
    };
  };

  // Join the caller's transaction when a client is provided; otherwise self-manage.
  return client ? run(client) : withTransaction(run);
}
