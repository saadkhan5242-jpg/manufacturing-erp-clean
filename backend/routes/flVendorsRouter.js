import { Router } from "express";
import { pool, withTransaction } from "../db.js";

const router = Router();

/* ============================================================
   FORGELOGIC AI — VENDOR & OUTSIDE PROCESS MANAGEMENT
   Raw material vendors, outside process vendors, automated PO
   creation, lead times, performance tracking, outside routing.
   ============================================================ */

// GET /api/fl/vendors -> list with performance rollup
router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.*,
        COUNT(p.id)::int AS total_pos,
        COUNT(p.id) FILTER (WHERE p.status = 'received')::int AS received_pos,
        AVG(vp.quality_rating)::numeric(3,1) AS avg_quality,
        AVG(CASE WHEN vp.on_time THEN 1.0 ELSE 0.0 END)::numeric(3,2) AS on_time_rate
      FROM fl_vendors v
      LEFT JOIN fl_purchase_orders p ON p.vendor_id = v.id
      LEFT JOIN fl_vendor_performance vp ON vp.vendor_id = v.id
      GROUP BY v.id
      ORDER BY v.vendor_type, v.name
    `);
    return res.json({ success: true, vendors: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/fl/vendors -> create vendor
router.post("/", async (req, res) => {
  const { code, name, vendorType, contactName, email, phone, leadTimeDays } = req.body || {};
  if (!code || !name) return res.status(400).json({ error: "code and name required" });
  try {
    const result = await pool.query(
      `INSERT INTO fl_vendors (code, name, vendor_type, contact_name, email, phone, lead_time_days)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [code, name, vendorType || 'material', contactName || null, email || null, phone || null, leadTimeDays || 7]
    );
    return res.status(201).json({ success: true, vendorId: Number(result.rows[0].id) });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/fl/vendors/po -> automated PO creation (raw material or outside process)
router.post("/po", async (req, res) => {
  const { vendorId, lines, expectedDate } = req.body || {};
  if (!vendorId || !Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: "vendorId and non-empty lines[] required" });
  }
  try {
    const result = await withTransaction(async (client) => {
      const poNum = `PO-${Date.now()}`;
      const po = await client.query(
        `INSERT INTO fl_purchase_orders (po_number, vendor_id, expected_date, status) VALUES ($1,$2,$3,'sent') RETURNING id`,
        [poNum, vendorId, expectedDate || null]
      );
      const poId = po.rows[0].id;
      let total = 0;
      for (const line of lines) {
        const lineTotal = (Number(line.quantity) || 0) * (Number(line.unitCost) || 0);
        total += lineTotal;
        await client.query(
          `INSERT INTO fl_purchase_order_lines (po_id, job_id, part_number, material_spec, description, quantity, unit, unit_cost)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [poId, line.jobId || null, line.partNumber || null, line.materialSpec || null, line.description || '', line.quantity || 0, line.unit || 'each', line.unitCost || 0]
        );
      }
      await client.query(`UPDATE fl_purchase_orders SET total_cost = $1 WHERE id = $2`, [total, poId]);
      return { poId, poNum, total };
    });
    return res.status(201).json({ success: true, ...result, message: `PO ${result.poNum} created and sent.` });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/fl/vendors/:id/performance -> log vendor performance
router.post("/:id/performance", async (req, res) => {
  const vendorId = parseInt(req.params.id, 10);
  const { poReference, promisedDate, deliveredDate, qualityRating, notes } = req.body || {};
  try {
    const onTime = promisedDate && deliveredDate ? new Date(deliveredDate) <= new Date(promisedDate) : null;
    const result = await pool.query(
      `INSERT INTO fl_vendor_performance (vendor_id, po_reference, promised_date, delivered_date, quality_rating, on_time, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [vendorId, poReference || null, promisedDate || null, deliveredDate || null, qualityRating || null, onTime, notes || null]
    );
    return res.status(201).json({ success: true, performanceId: Number(result.rows[0].id), onTime });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
