import { Router } from "express";
import { pool } from "../db.js";
import { getMetrics } from "../middleware/metrics.js";

const router = Router();

/* ============================================================
   FORGELOGIC AI — SYSTEM HEALTH & DIAGNOSTICS
   Central health check & Observability metrics so frontend/K8s
   never silently fail.
   ============================================================ */

// GET /api/health -> liveness + DB connectivity + module status
router.get("/", async (_req, res) => {
  const started = process.uptime();
  let db = "down";
  let dbLatencyMs = null;
  try {
    const t0 = Date.now();
    await pool.query("SELECT 1");
    dbLatencyMs = Date.now() - t0;
    db = "up";
  } catch { db = "down"; }

  res.status(db === "up" ? 200 : 503).json({
    status: db === "up" ? "healthy" : "degraded",
    service: "ForgeLogic AI — Manufacturing OS",
    version: "1.0.0",
    uptimeSeconds: Math.round(started),
    database: { status: db, latencyMs: dbLatencyMs },
    timestamp: new Date().toISOString()
  });
});

// GET /api/health/metrics -> Prometheus / Observability metrics
router.get("/metrics", (_req, res) => {
  res.json(getMetrics());
});

export default router;
