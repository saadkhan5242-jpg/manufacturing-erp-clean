import express from "express";
import { pool, withTransaction } from "../db.js";

const router = express.Router();

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function mapInventoryRow(row) {
  return {
    id: Number(row.id),
    name: row.description,
    sku: row.part_number,
    quantityOnHand: Number(row.quantity),
    reorderPoint: Number(row.reorder_point),
    unit: row.unit,
    location: row.location,
    supplierId: row.supplier_id ? Number(row.supplier_id) : null,
    leadTimeDays: Number(row.lead_time_days),
    unitPrice: Number(row.unit_price || 0),
    lastUpdated: row.last_updated
  };
}

function normalizeItem(body) {
  const item = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const name = String(item.name ?? item.description ?? "").trim();
  const sku = String(item.sku ?? item.partNumber ?? "").trim();
  const quantityOnHand = Number(item.quantityOnHand ?? item.quantity);
  const reorderPoint = Number(item.reorderPoint);
  if (!name || !sku || !String(item.location || "").trim()) throw new Error("name, sku, and location are required");
  if (!Number.isFinite(quantityOnHand) || quantityOnHand < 0) throw new Error("quantityOnHand must be non-negative");
  if (!Number.isFinite(reorderPoint) || reorderPoint < 0) throw new Error("reorderPoint must be non-negative");
  const leadTimeDays = Number(item.leadTimeDays || 0);
  if (!Number.isInteger(leadTimeDays) || leadTimeDays < 0) throw new Error("leadTimeDays must be a non-negative integer");
  const unitPrice = Number(item.unitPrice || 0);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("unitPrice must be non-negative");
  return { name, sku, quantityOnHand, reorderPoint, unit: String(item.unit || "EA").trim().toUpperCase(), location: String(item.location).trim(), supplierId: parseId(item.supplierId), leadTimeDays, unitPrice };
}

router.get("/", async (_req, res, next) => {
  try {
    const result = await pool.query(`SELECT * FROM inventory ORDER BY part_number ASC`);
    return res.json(result.rows.map(mapInventoryRow));
  } catch (error) {
    return next(error);
  }
});

/* ============================================================
   MATERIAL MASTER STOCK LEDGER — GET /api/inventory/stock-ledger
   Flat high-density spreadsheet feed consumed by MaterialStockLedger.
   Reads the live PostgreSQL inventory table. Returns a bare array.
   ============================================================ */
router.get("/stock-ledger", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT part_number, description, quantity, unit_price, last_updated
      FROM inventory
      ORDER BY part_number ASC
    `);
    return res.status(200).json(result.rows.map((row) => ({
      partNumber: row.part_number,
      description: row.description,
      quantity: Number(row.quantity),
      unit: row.part_number && row.part_number.startsWith("MAT-") ? "LBS" : "EA",
      unitPrice: Number(row.unit_price),
      lastUpdated: row.last_updated
    })));
  } catch (error) {
    console.error("Stock Ledger Error:", error.message);
    return res.status(200).json([]); // never 500 the ledger grid
  }
});

/* ============================================================
   MODULE 7: REAL-TIME GRAPHIC INVENTORY STOCK STATUS READOUTS
   Streams live PostgreSQL stock tallies enriched with movement
   deltas (AP invoice receipts increment, WO completions subtract).
   NOTE: registered before /:id so "live-levels" is not parsed
   as an id parameter.
   ============================================================ */
router.get("/live-levels", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.part_number, i.description, i.quantity, i.unit_price, i.last_updated,
             COALESCE(SUM(m.change_qty) FILTER (WHERE m.source = 'AP_INVOICE'), 0) AS received_from_invoices,
             COALESCE(SUM(m.change_qty) FILTER (WHERE m.source = 'WORK_ORDER_COMPLETE'), 0) AS consumed_by_work_orders
      FROM inventory i
      LEFT JOIN inventory_movements m ON m.part_number = i.part_number
      GROUP BY i.id, i.part_number, i.description, i.quantity, i.unit_price, i.last_updated
      ORDER BY i.part_number ASC
    `);

    return res.status(200).json({
      success: true,
      polledAt: new Date().toISOString(),
      levels: result.rows.map((row) => ({
        partNumber: row.part_number,
        description: row.description,
        quantity: Number(row.quantity),
        unitPrice: Number(row.unit_price),
        stockValue: Number((Number(row.quantity) * Number(row.unit_price)).toFixed(2)),
        receivedFromInvoices: Number(row.received_from_invoices),
        consumedByWorkOrders: Math.abs(Number(row.consumed_by_work_orders)),
        lastUpdated: row.last_updated
      }))
    });
  } catch (error) {
    console.error("Live Inventory Levels Error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to stream live inventory levels", message: error.message });
  }
});

// GET /api/inventory/reorder-suggestions -> current material shortages
router.get("/reorder-suggestions", async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT i.part_number, i.description, i.quantity, i.reorder_point, i.unit,
             i.location, i.supplier_id, i.lead_time_days, i.unit_price,
             s.code AS supplier_code, s.name AS supplier_name
      FROM inventory i
      LEFT JOIN suppliers s ON s.id = i.supplier_id
      WHERE i.quantity <= i.reorder_point
      ORDER BY (i.reorder_point - i.quantity) DESC, i.part_number ASC
    `);
    return res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      suggestions: result.rows.map((row) => ({
        partNumber: row.part_number,
        description: row.description,
        quantityOnHand: Number(row.quantity),
        reorderPoint: Number(row.reorder_point),
        recommendedOrderQty: Number((Number(row.reorder_point) - Number(row.quantity)).toFixed(4)),
        unit: row.unit,
        location: row.location,
        supplier: row.supplier_id ? { id: Number(row.supplier_id), code: row.supplier_code, name: row.supplier_name } : null,
        leadTimeDays: Number(row.lead_time_days),
        estimatedCost: Number(((Number(row.reorder_point) - Number(row.quantity)) * Number(row.unit_price || 0)).toFixed(2))
      }))
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "id must be a positive integer" });
  try {
    const result = await pool.query(`SELECT * FROM inventory WHERE id = $1`, [id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Inventory item not found" });
    return res.json(mapInventoryRow(result.rows[0]));
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const item = normalizeItem(req.body);
    const result = await withTransaction(async (client) => {
      const inserted = await client.query(`
        INSERT INTO inventory (part_number, description, quantity, reorder_point, unit, location, supplier_id, lead_time_days, unit_price)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
      `, [item.sku, item.name, item.quantityOnHand, item.reorderPoint, item.unit, item.location, item.supplierId, item.leadTimeDays, item.unitPrice]);
      if (item.quantityOnHand > 0) await client.query(`INSERT INTO inventory_movements (part_number, change_qty, source, reference) VALUES ($1,$2,'INITIAL_BALANCE',$3)`, [item.sku, item.quantityOnHand, "inventory-create"]);
      return inserted.rows[0];
    });
    return res.status(201).json(mapInventoryRow(result));
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "sku must be unique" });
    if (error.message.includes("required") || error.message.includes("must be")) return res.status(400).json({ error: error.message });
    return next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "id must be a positive integer" });
  try {
    const item = normalizeItem(req.body);
    const result = await pool.query(`
      UPDATE inventory SET part_number=$1, description=$2, quantity=$3, reorder_point=$4, unit=$5, location=$6, supplier_id=$7, lead_time_days=$8, unit_price=$9, last_updated=CURRENT_TIMESTAMP
      WHERE id=$10 RETURNING *
    `, [item.sku, item.name, item.quantityOnHand, item.reorderPoint, item.unit, item.location, item.supplierId, item.leadTimeDays, item.unitPrice, id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Inventory item not found" });
    return res.json(mapInventoryRow(result.rows[0]));
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "sku must be unique" });
    if (error.message.includes("required") || error.message.includes("must be")) return res.status(400).json({ error: error.message });
    return next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "id must be a positive integer" });
  try {
    const result = await pool.query(`DELETE FROM inventory WHERE id = $1 RETURNING id`, [id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Inventory item not found" });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;
