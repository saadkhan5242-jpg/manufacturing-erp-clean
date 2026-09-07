import { useState, useEffect } from "react";
import apiClient from "../../lib/apiClient.js";

/**
 * FlLiveJobBoard — ForgeLogic AI flagship: real-time shop floor job tracking.
 * Shows current routing step, machine, operator, est vs actual hours, WIP,
 * QC checkpoints, shipping readiness, and lateness alerts per job.
 */
function FlLiveJobBoard() {
  const [jobs, setJobs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [polledAt, setPolledAt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      Promise.all([
        apiClient.get("/api/fl/jobs/live").catch(() => null),
        apiClient.get("/api/fl/ai/lateness-alerts").catch(() => null)
      ]).then(([jobsData, alertsData]) => {
        if (cancelled) return;
        if (jobsData?.jobs) setJobs(jobsData.jobs);
        if (jobsData?.polledAt) setPolledAt(jobsData.polledAt);
        if (alertsData?.alerts) setAlerts(alertsData.alerts);
        setLoading(false);
      });
    };
    load();
    const timer = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const statusColor = { contract_review: "#94a3b8", estimating: "#a78bfa", quoted: "#60a5fa", released: "#38bdf8", in_progress: "#34d399", qc: "#fbbf24", outside_process: "#f472b6", ready_to_ship: "#4ade80", on_hold: "#f87171" };

  return (
    <div style={{ fontFamily: "monospace", color: "#e2e8f0" }}>
      {/* Lateness alert banner */}
      {alerts.length > 0 && (
        <div style={{ backgroundColor: "#7f1d1d", border: "1px solid #ef4444", padding: "10px 14px", marginBottom: "14px", fontSize: "12px", fontWeight: "bold" }}>
          🚨 AI PREDICTIVE LATENESS: {alerts.length} job(s) at risk — {alerts.map((a) => `${a.jobNumber} (${a.riskLevel})`).join(", ")}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <span style={{ fontSize: "12px", color: "#94a3b8" }}>
          {polledAt ? `LIVE · ${new Date(polledAt).toLocaleTimeString()}` : "CONNECTING…"} · {jobs.length} ACTIVE JOBS
        </span>
        <span style={{ fontSize: "11px", color: "#4ade80" }}>● STREAMING</span>
      </div>

      {loading && <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>Loading live floor…</div>}
      {!loading && jobs.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748b", border: "1px dashed #334155" }}>
          No active jobs on the floor. Create one to begin tracking.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "12px" }}>
        {jobs.map((job) => {
          const pct = job.quantityOrdered > 0 ? Math.round((job.quantityCompleted / job.quantityOrdered) * 100) : 0;
          const hrsPct = job.estimatedHours > 0 ? Math.min(100, Math.round((job.actualHours / job.estimatedHours) * 100)) : 0;
          return (
            <div key={job.id} style={{ backgroundColor: "#1e293b", border: `1px solid ${job.isLate ? "#ef4444" : job.atRisk ? "#f59e0b" : "#334155"}`, borderLeft: `4px solid ${statusColor[job.status] || "#334155"}`, padding: "14px" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontWeight: "900", color: "#f8fafc" }}>{job.jobNumber}</span>
                <span style={{ fontSize: "10px", fontWeight: "bold", padding: "2px 8px", backgroundColor: statusColor[job.status] || "#334155", color: "#0f172a", textTransform: "uppercase" }}>
                  {job.status.replace(/_/g, " ")}
                </span>
              </div>
              <div style={{ fontSize: "12px", color: "#cbd5e1", marginBottom: "8px" }}>
                {job.partNumber}{job.partName ? ` — ${job.partName}` : ""} · {job.customer || "—"}
              </div>

              {/* Current step / machine / operator */}
              <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "8px", lineHeight: 1.6 }}>
                <div>▸ Step: <b style={{ color: "#e2e8f0" }}>{job.currentStep || "—"}</b> {job.isOutsideProcess && <span style={{ color: "#f472b6" }}>({job.outsideProcessName || "Outside"})</span>}</div>
                <div>▸ Machine: <b style={{ color: "#e2e8f0" }}>{job.machine ? job.machine.code : "—"}</b> {job.activeOperator && <>· Operator: <b style={{ color: "#e2e8f0" }}>{job.activeOperator}</b></>}</div>
              </div>

              {/* Quantity progress */}
              <div style={{ marginBottom: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#94a3b8", marginBottom: "2px" }}>
                  <span>QTY {job.quantityCompleted}/{job.quantityOrdered}</span><span>{pct}%</span>
                </div>
                <div style={{ height: "6px", backgroundColor: "#0f172a" }}>
                  <div style={{ height: "100%", width: `${pct}%`, backgroundColor: "#38bdf8" }} />
                </div>
              </div>

              {/* Hours est vs actual */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "6px" }}>
                <span style={{ color: "#94a3b8" }}>EST {job.estimatedHours}h</span>
                <span style={{ color: "#94a3b8" }}>ACT {job.actualHours}h</span>
                <span style={{ fontWeight: "bold", color: job.efficiency === null ? "#64748b" : job.efficiency >= 90 ? "#4ade80" : job.efficiency >= 75 ? "#fbbf24" : "#f87171" }}>
                  {job.efficiency === null ? "—" : `${job.efficiency}%`}
                </span>
              </div>
              <div style={{ height: "4px", backgroundColor: "#0f172a", marginBottom: "8px" }}>
                <div style={{ height: "100%", width: `${hrsPct}%`, backgroundColor: hrsPct > 100 ? "#f87171" : "#4ade80" }} />
              </div>

              {/* QC + shipping footer */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#94a3b8" }}>
                <span>QC: <b style={{ color: "#4ade80" }}>{job.qc.passed}✓</b> <b style={{ color: "#f87171" }}>{job.qc.failed}✗</b> {job.qc.pending}⏳</span>
                <span>Due: {job.dueDate ? new Date(job.dueDate).toLocaleDateString() : "—"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default FlLiveJobBoard;
