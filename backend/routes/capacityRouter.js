import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.get("/", async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT wc.id, wc.name, wc.daily_capacity_hours,
             COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0)
               FILTER (WHERE s.status IN ('scheduled', 'in-progress') AND s.end_time >= NOW()), 0) AS scheduled_hours
      FROM work_centers wc LEFT JOIN schedules s ON s.work_center_id = wc.id
      WHERE wc.active = TRUE
      GROUP BY wc.id, wc.name, wc.daily_capacity_hours ORDER BY wc.name
    `);
    return res.json(result.rows.map((row) => {
      const capacityHours = Number(row.daily_capacity_hours) || 0;
      const scheduledHours = Number(row.scheduled_hours) || 0;
      return { workCenterId: Number(row.id), workCenterName: row.name, capacityHours: Number(capacityHours.toFixed(2)), scheduledHours: Number(scheduledHours.toFixed(2)), remainingHours: Number((capacityHours - scheduledHours).toFixed(2)), utilizationPercent: capacityHours === 0 ? 0 : Number(((scheduledHours / capacityHours) * 100).toFixed(2)) };
    }));
  } catch (error) {
    return next(error);
  }
});

router.get("/:workCenterId", async (req, res, next) => {
  const workCenterId = Number(req.params.workCenterId);
  if (!Number.isInteger(workCenterId) || workCenterId < 1) return res.status(400).json({ error: "workCenterId must be a positive integer" });
  try {
    const result = await pool.query(`
      SELECT wc.id, wc.name, wc.daily_capacity_hours,
             COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0)
               FILTER (WHERE s.status IN ('scheduled', 'in-progress') AND s.end_time >= NOW()), 0) AS scheduled_hours
      FROM work_centers wc LEFT JOIN schedules s ON s.work_center_id = wc.id
      WHERE wc.id = $1 AND wc.active = TRUE
      GROUP BY wc.id, wc.name, wc.daily_capacity_hours
    `, [workCenterId]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: "Work center not found" });
    const capacityHours = Number(row.daily_capacity_hours) || 0;
    const scheduledHours = Number(row.scheduled_hours) || 0;
    return res.json({ workCenterId, workCenterName: row.name, capacityHours, scheduledHours, remainingHours: capacityHours - scheduledHours, utilizationPercent: capacityHours === 0 ? 0 : Number(((scheduledHours / capacityHours) * 100).toFixed(2)) });
  } catch (error) {
    return next(error);
  }
});

export default router;