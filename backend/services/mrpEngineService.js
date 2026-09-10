import { query, withTransaction } from "../db.js";
import { broadcastShopFloorEvent } from "./shopFloorEventBus.js";

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toIsoDate(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : null;
}

function userId(req) {
  const id = Number(req?.user?.sub || req?.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function buildDiagnostics(rows) {
  const diagnostics = [];
  for (const row of rows) {
    const netRequirement = toNumber(row.net_requirement);
    const availableStock = toNumber(row.available_stock);
    const safetyStock = toNumber(row.safety_stock);
    const estimatedArrivalDate = toIsoDate(row.estimated_arrival_date);
    const earliestNeedDate = toIsoDate(row.earliest_need_date);

    if (availableStock < safetyStock) {
      diagnostics.push({
        level: "warning",
        type: "SAFETY_STOCK",
        partNumber: row.part_number,
        message: `${row.part_number} is below safety stock: available ${availableStock}, safety ${safetyStock}`
      });
    }

    if (netRequirement > 0) {
      diagnostics.push({
        level: row.preferred_vendor_id ? "warning" : "critical",
        type: row.preferred_vendor_id ? "SHORTAGE" : "NO_PREFERRED_VENDOR",
        partNumber: row.part_number,
        preferredVendorId: row.preferred_vendor_id ? Number(row.preferred_vendor_id) : null,
        message: row.preferred_vendor_id
          ? `${row.part_number} requires ${netRequirement} more units; draft PO queue recommended.`
          : `${row.part_number} is short ${netRequirement} units and has no preferred vendor.`
      });
    }

    if (netRequirement > 0 && estimatedArrivalDate && earliestNeedDate && estimatedArrivalDate > earliestNeedDate) {
      diagnostics.push({
        level: "critical",
        type: "LEAD_TIME_RISK",
        partNumber: row.part_number,
        requiredBy: earliestNeedDate,
        estimatedArrivalDate,
        message: `${row.part_number} arrives ${estimatedArrivalDate}, after required date ${earliestNeedDate}`
      });
    }
  }
  return diagnostics;
}

async function computeDemandRows(client) {
  const result = await client.query(`
    WITH RECURSIVE active_work_orders AS (
      SELECT id, order_number, part_number, product_id, quantity,
             COALESCE(quantity_completed, 0) AS quantity_completed,
             GREATEST(COALESCE(quantity, 0) - COALESCE(quantity_completed, 0), 0) AS demand_qty,
             due_date
      FROM work_orders
      WHERE LOWER(status) NOT IN ('completed', 'cancelled', 'closed', 'scrapped')
        AND GREATEST(COALESCE(quantity, 0) - COALESCE(quantity_completed, 0), 0) > 0
    ),
    active_sales_orders AS (
      SELECT so.id, so.order_number, so.product_id, so.quantity_ordered AS demand_qty, so.required_date AS due_date
      FROM sales_orders so
      WHERE LOWER(so.status) NOT IN ('completed', 'cancelled', 'closed', 'shipped', 'lost')
        AND COALESCE(so.quantity_ordered, 0) > 0
    ),
    bom_seed AS (
      SELECT awo.id AS source_id, 'work_order' AS source_type, awo.order_number, awo.due_date, awo.demand_qty,
             mbc.child_bom_id,
             COALESCE(cp.part_number, child_product.sku) AS part_number,
             mbc.quantity_per * awo.demand_qty AS required_qty,
             1 AS depth
      FROM active_work_orders awo
      JOIN manufacturing_boms mb ON mb.status = 'active'
        AND (mb.parent_product_id = awo.product_id OR mb.parent_part_id = (SELECT p.id FROM parts p WHERE p.part_number = awo.part_number LIMIT 1))
      JOIN manufacturing_bom_components mbc ON mbc.bom_id = mb.id
      LEFT JOIN parts cp ON cp.id = mbc.child_part_id
      LEFT JOIN products child_product ON child_product.id = mbc.child_product_id
      UNION ALL
      SELECT aso.id AS source_id, 'sales_order' AS source_type, aso.order_number, aso.due_date, aso.demand_qty,
             mbc.child_bom_id,
             COALESCE(cp.part_number, child_product.sku) AS part_number,
             mbc.quantity_per * aso.demand_qty AS required_qty,
             1 AS depth
      FROM active_sales_orders aso
      JOIN manufacturing_boms mb ON mb.status = 'active' AND mb.parent_product_id = aso.product_id
      JOIN manufacturing_bom_components mbc ON mbc.bom_id = mb.id
      LEFT JOIN parts cp ON cp.id = mbc.child_part_id
      LEFT JOIN products child_product ON child_product.id = mbc.child_product_id
    ),
    bom_tree AS (
      SELECT * FROM bom_seed
      UNION ALL
      SELECT bt.source_id, bt.source_type, bt.order_number, bt.due_date, bt.demand_qty,
             mbc.child_bom_id,
             COALESCE(cp.part_number, child_product.sku) AS part_number,
             mbc.quantity_per * bt.required_qty AS required_qty,
             bt.depth + 1
      FROM bom_tree bt
      JOIN manufacturing_bom_components mbc ON mbc.bom_id = bt.child_bom_id
      LEFT JOIN parts cp ON cp.id = mbc.child_part_id
      LEFT JOIN products child_product ON child_product.id = mbc.child_product_id
      WHERE bt.child_bom_id IS NOT NULL AND bt.depth < 8
    ),
    legacy_router_materials AS (
      SELECT sfll.work_order_id AS source_id, 'work_order' AS source_type, COALESCE(wo.order_number, CONCAT('WO-', sfll.work_order_id)) AS order_number,
             wo.due_date,
             material->>'partNumber' AS part_number,
             SUM(COALESCE(NULLIF(material->>'quantity', '')::numeric, 0)) AS required_qty
      FROM shop_floor_labor_logs sfll
      JOIN router_operations ro ON ro.id = sfll.router_operation_id
      LEFT JOIN work_orders wo ON wo.id = sfll.work_order_id
      CROSS JOIN LATERAL jsonb_array_elements(ro.required_materials) AS material
      WHERE sfll.clock_out_time IS NULL AND material ? 'partNumber'
      GROUP BY sfll.work_order_id, wo.order_number, wo.due_date, material->>'partNumber'
    ),
    gross AS (
      SELECT part_number, SUM(required_qty) AS gross_requirement,
             MIN(due_date) AS earliest_need_date,
             jsonb_agg(jsonb_build_object('sourceType', source_type, 'sourceId', source_id, 'orderNumber', order_number, 'quantity', required_qty, 'dueDate', due_date)) AS source_work_orders
      FROM (
        SELECT part_number, required_qty, source_type, source_id, order_number, due_date FROM bom_tree WHERE part_number IS NOT NULL
        UNION ALL
        SELECT part_number, required_qty, source_type, source_id, order_number, due_date FROM legacy_router_materials WHERE part_number IS NOT NULL
      ) demand
      GROUP BY part_number
    ),
    stock AS (
      SELECT part_number, description,
             COALESCE(available_stock, quantity, 0) AS available_stock,
             COALESCE(allocated_stock, 0) AS allocated_stock,
             COALESCE(on_order, 0) AS on_order,
             COALESCE(safety_stock, reorder_point, 0) AS safety_stock,
             COALESCE(preferred_vendor_id, supplier_id) AS preferred_vendor_id,
             COALESCE(lead_time_days, 0) AS lead_time_days,
             COALESCE(unit_price, 0) AS unit_price
      FROM inventory
    )
    SELECT g.part_number, COALESCE(s.description, g.part_number) AS description,
           g.gross_requirement,
           COALESCE(s.available_stock, 0) AS available_stock,
           COALESCE(s.allocated_stock, 0) AS allocated_stock,
           COALESCE(s.on_order, 0) AS on_order,
           COALESCE(s.safety_stock, 0) AS safety_stock,
           GREATEST(g.gross_requirement + COALESCE(s.safety_stock, 0) + COALESCE(s.allocated_stock, 0) - COALESCE(s.available_stock, 0) - COALESCE(s.on_order, 0), 0) AS net_requirement,
           GREATEST(g.gross_requirement + COALESCE(s.safety_stock, 0) + COALESCE(s.allocated_stock, 0) - COALESCE(s.available_stock, 0) - COALESCE(s.on_order, 0), 0) AS suggested_order_qty,
           COALESCE(s.unit_price, 0) AS unit_price,
           COALESCE(s.preferred_vendor_id, 0) AS preferred_vendor_id,
           COALESCE(s.lead_time_days, 0) AS lead_time_days,
           g.earliest_need_date,
           CURRENT_DATE + COALESCE(s.lead_time_days, 0) AS estimated_arrival_date,
           g.source_work_orders
    FROM gross g
    LEFT JOIN stock s ON s.part_number = g.part_number
    ORDER BY net_requirement DESC, g.part_number ASC
  `);

  return result.rows;
}

export async function computeMrpPlan(client = { query }, options = {}) {
  const rows = await computeDemandRows(client);
  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM work_orders WHERE LOWER(status) NOT IN ('completed', 'cancelled', 'closed', 'scrapped')) AS active_work_order_count,
      (SELECT COUNT(*)::int FROM sales_orders WHERE LOWER(status) NOT IN ('completed', 'cancelled', 'closed', 'shipped', 'lost')) AS active_sales_order_count
  `);
  const diagnostics = buildDiagnostics(rows);

  return {
    preview: Boolean(options.preview),
    activeWorkOrderCount: counts.rows[0]?.active_work_order_count || 0,
    activeSalesOrderCount: counts.rows[0]?.active_sales_order_count || 0,
    partsAnalyzed: rows.length,
    shortagesFound: rows.filter((row) => toNumber(row.net_requirement) > 0).length,
    requirements: rows.map((row) => ({
      partNumber: row.part_number,
      description: row.description,
      grossRequirement: toNumber(row.gross_requirement),
      availableStock: toNumber(row.available_stock),
      allocatedStock: toNumber(row.allocated_stock),
      onOrder: toNumber(row.on_order),
      safetyStock: toNumber(row.safety_stock),
      netRequirement: toNumber(row.net_requirement),
      suggestedOrderQty: toNumber(row.suggested_order_qty),
      estimatedUnitCost: toNumber(row.unit_price),
      estimatedTotalCost: Number((toNumber(row.suggested_order_qty) * toNumber(row.unit_price)).toFixed(2)),
      preferredVendorId: Number(row.preferred_vendor_id) || null,
      leadTimeDays: Number(row.lead_time_days) || 0,
      requiredBy: toIsoDate(row.earliest_need_date),
      estimatedArrivalDate: toIsoDate(row.estimated_arrival_date),
      priority: toNumber(row.net_requirement) > 0 && toNumber(row.available_stock) === 0 ? "critical" : toNumber(row.net_requirement) > 0 ? "expedite" : "standard",
      status: toNumber(row.net_requirement) > 0 ? "shortage" : "covered",
      sourceWorkOrders: row.source_work_orders || []
    })),
    diagnostics
  };
}

export async function runMrpEngine(req) {
  const runId = `MRP-${Date.now()}`;
  return withTransaction(async (client) => {
    const plan = await computeMrpPlan(client);
    const shortages = plan.requirements.filter((requirement) => requirement.netRequirement > 0);

    await client.query("UPDATE mrp_procurement_demands SET status = 'SUPERSEDED' WHERE status = 'OPEN'");
    await client.query("UPDATE mrp_purchase_order_queue SET status = 'superseded' WHERE status = 'draft'");

    for (const shortage of shortages) {
      await client.query(
        `INSERT INTO mrp_procurement_demands
         (run_id, part_number, description, gross_requirement, on_hand, net_deficiency, suggested_order_qty, estimated_cost, priority, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'OPEN')`,
        [runId, shortage.partNumber, shortage.description, shortage.grossRequirement, shortage.availableStock, shortage.netRequirement, shortage.suggestedOrderQty, shortage.estimatedTotalCost, shortage.priority.toUpperCase()]
      );

      await client.query(
        `INSERT INTO mrp_purchase_order_queue
          (run_id, preferred_vendor_id, part_number, description, gross_requirement, available_stock, allocated_stock, on_order, safety_stock, net_requirement, suggested_order_qty, estimated_unit_cost, estimated_total_cost, lead_time_days, required_by, estimated_arrival_date, priority, source_work_orders)
         VALUES ($1, NULLIF($2, 0), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb)`,
        [runId, shortage.preferredVendorId || 0, shortage.partNumber, shortage.description, shortage.grossRequirement, shortage.availableStock, shortage.allocatedStock, shortage.onOrder, shortage.safetyStock, shortage.netRequirement, shortage.suggestedOrderQty, shortage.estimatedUnitCost, shortage.estimatedTotalCost, shortage.leadTimeDays, shortage.requiredBy, shortage.estimatedArrivalDate, shortage.priority, JSON.stringify(shortage.sourceWorkOrders)]
      );

      if (shortage.requiredBy && shortage.estimatedArrivalDate && shortage.estimatedArrivalDate > shortage.requiredBy) {
        for (const source of shortage.sourceWorkOrders.filter((item) => item.sourceType === "work_order")) {
          await client.query(
            `INSERT INTO mrp_reschedule_signals
              (run_id, work_order_id, part_number, current_due_date, estimated_material_arrival, projected_start_date, risk_level, message)
             VALUES ($1, $2, $3, $4, $5, $5, 'critical', $6)`,
            [runId, source.sourceId, shortage.partNumber, source.dueDate, shortage.estimatedArrivalDate, `${shortage.partNumber} material arrival is after job need date; dispatch timeline must move.`]
          );
        }
      }
    }

    await client.query(
      `INSERT INTO mrp_runs (run_id, status, active_work_order_count, active_sales_order_count, parts_analyzed, shortages_found, diagnostics, created_by)
       VALUES ($1, 'completed', $2, $3, $4, $5, $6::jsonb, $7)`,
      [runId, plan.activeWorkOrderCount, plan.activeSalesOrderCount, plan.partsAnalyzed, shortages.length, JSON.stringify(plan.diagnostics), userId(req)]
    );

    const result = { success: true, runId, ...plan, shortages };
    broadcastShopFloorEvent("mrp-run", { runId, shortagesFound: shortages.length, diagnostics: plan.diagnostics });
    for (const diagnostic of plan.diagnostics.filter((item) => item.type === "LEAD_TIME_RISK")) {
      broadcastShopFloorEvent("dispatch-reschedule", { runId, ...diagnostic });
    }
    return result;
  });
}

export async function listMrpDraftPurchaseQueue() {
  const result = await query(`
    SELECT q.preferred_vendor_id AS "preferredVendorId", s.code AS "supplierCode", s.name AS "supplierName",
           jsonb_agg(jsonb_build_object(
             'id', q.id,
             'partNumber', q.part_number,
             'description', q.description,
             'suggestedOrderQty', q.suggested_order_qty,
             'estimatedTotalCost', q.estimated_total_cost,
             'requiredBy', q.required_by,
             'estimatedArrivalDate', q.estimated_arrival_date,
             'priority', q.priority
           ) ORDER BY q.priority DESC, q.part_number ASC) AS lines,
           SUM(q.estimated_total_cost) AS "estimatedTotalCost"
    FROM mrp_purchase_order_queue q
    LEFT JOIN suppliers s ON s.id = q.preferred_vendor_id
    WHERE q.status = 'draft'
    GROUP BY q.preferred_vendor_id, s.code, s.name
    ORDER BY MAX(CASE q.priority WHEN 'critical' THEN 3 WHEN 'expedite' THEN 2 ELSE 1 END) DESC, s.name ASC NULLS LAST
  `);
  return result.rows;
}

export async function recordSupplierDelay({ queueLineId, delayedUntil, reason }) {
  const queue = (await query(
    `UPDATE mrp_purchase_order_queue
     SET estimated_arrival_date = $2
     WHERE id = $1
     RETURNING run_id, part_number, estimated_arrival_date, source_work_orders`,
    [queueLineId, delayedUntil]
  )).rows[0];

  if (!queue) return undefined;

  const sourceWorkOrders = Array.isArray(queue.source_work_orders) ? queue.source_work_orders : [];
  for (const source of sourceWorkOrders.filter((item) => item.sourceType === "work_order")) {
    await query(
      `INSERT INTO mrp_reschedule_signals
        (run_id, work_order_id, part_number, current_due_date, estimated_material_arrival, projected_start_date, risk_level, message)
       VALUES ($1, $2, $3, $4, $5, $5, 'critical', $6)`,
      [queue.run_id, source.sourceId, queue.part_number, source.dueDate, delayedUntil, reason || `${queue.part_number} supplier delay changed dispatch timeline.`]
    );
  }

  const signal = { runId: queue.run_id, partNumber: queue.part_number, delayedUntil, reason: reason || "Supplier delay reported", affectedWorkOrders: sourceWorkOrders };
  broadcastShopFloorEvent("dispatch-reschedule", signal);
  return signal;
}

export function startMrpScheduler() {
  const intervalMinutes = Number(process.env.MRP_RUN_INTERVAL_MINUTES || 0);
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) return null;

  const intervalMs = Math.max(intervalMinutes, 5) * 60 * 1000;
  const timer = setInterval(() => {
    runMrpEngine({ user: null }).catch((error) => {
      console.error("Scheduled MRP run failed:", error.message);
    });
  }, intervalMs);
  timer.unref?.();
  console.log(`MRP scheduler enabled: every ${Math.round(intervalMs / 60000)} minutes`);
  return timer;
}
