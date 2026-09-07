import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

/* ============================================================
   BUSINESS INTELLIGENCE — GET /api/bi/wip-valuation
   Aggregates active financial balances from the WipLedger,
   grouped by active Work Orders, split by Material / Labor /
   Overhead WIP. Feeds the BI column dashboard.
   ============================================================ */
router.get("/wip-valuation", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT wo.id,
             wo.order_number,
             wo.part_number,
             wo.status,
             wo.quantity_ordered,
             wo.quantity_completed,
             COALESCE(SUM(wl.debit - wl.credit) FILTER (WHERE wl.entry_type = 'Material WIP'), 0)::float AS material_wip,
             COALESCE(SUM(wl.debit - wl.credit) FILTER (WHERE wl.entry_type = 'Labor WIP'), 0)::float AS labor_wip,
             COALESCE(SUM(wl.debit - wl.credit) FILTER (WHERE wl.entry_type = 'Overhead WIP'), 0)::float AS overhead_wip,
             COALESCE(SUM(wl.debit - wl.credit), 0)::float AS total_wip
      FROM work_orders wo
      LEFT JOIN wip_ledger wl ON wl.work_order_id = wo.id
      WHERE wo.status IN ('open', 'released', 'in-progress', 'In-Progress', 'Planned')
      GROUP BY wo.id, wo.order_number, wo.part_number, wo.status, wo.quantity_ordered, wo.quantity_completed
      ORDER BY total_wip DESC
    `);

    const jobs = result.rows.map((row) => ({
      workOrderId: Number(row.id),
      orderNumber: row.order_number,
      partNumber: row.part_number,
      status: row.status,
      quantityOrdered: Number(row.quantity_ordered),
      quantityCompleted: Number(row.quantity_completed),
      materialWip: row.material_wip,
      laborWip: row.labor_wip,
      overheadWip: row.overhead_wip,
      totalWip: row.total_wip
    }));

    const totals = jobs.reduce((acc, j) => ({
      materialWip: acc.materialWip + j.materialWip,
      laborWip: acc.laborWip + j.laborWip,
      overheadWip: acc.overheadWip + j.overheadWip,
      totalWip: acc.totalWip + j.totalWip
    }), { materialWip: 0, laborWip: 0, overheadWip: 0, totalWip: 0 });

    return res.status(200).json({
      success: true,
      polledAt: new Date().toISOString(),
      totals: {
        materialWip: Number(totals.materialWip.toFixed(2)),
        laborWip: Number(totals.laborWip.toFixed(2)),
        overheadWip: Number(totals.overheadWip.toFixed(2)),
        totalWip: Number(totals.totalWip.toFixed(2))
      },
      jobs
    });
  } catch (error) {
    console.error("WIP Valuation Error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to compute WIP valuation", message: error.message });
  }
});

export default router;
