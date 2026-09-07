import { useState, useEffect } from "react";
import apiClient from "../../lib/apiClient.js";

/**
 * FlShopFloorTerminal — ForgeLogic touch-screen operator punch clock.
 * Select a job + routing step, clock in/out, log pieces. Drives the live
 * job board (est vs actual hours tick forward automatically).
 */
function FlShopFloorTerminal() {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobDetail, setJobDetail] = useState(null);
  const [employeeId, setEmployeeId] = useState("");
  const [pieces, setPieces] = useState("0");
  const [activeLog, setActiveLog] = useState(null); // { jobId, routingStepId }
  const [message, setMessage] = useState({ text: "", ok: true });
  const [elapsed, setElapsed] = useState(0);

  // Load active jobs
  useEffect(() => {
    apiClient.get("/api/fl/jobs/live").then((d) => {
      if (d?.jobs) setJobs(d.jobs);
    }).catch(() => {});
  }, []);

  // Load job detail (routing steps) when a job is selected
  useEffect(() => {
    if (!selectedJob) { setJobDetail(null); return; }
    apiClient.get(`/api/fl/jobs/${selectedJob}`).then((d) => {
      if (d?.steps) setJobDetail(d);
    }).catch(() => {});
  }, [selectedJob]);

  // Elapsed timer for the active punch
  useEffect(() => {
    if (!activeLog) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [activeLog]);

  const fmt = (s) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const clockIn = async (routingStepId) => {
    if (!employeeId.trim()) { setMessage({ text: "Enter your employee badge ID first.", ok: false }); return; }
    try {
      const data = await apiClient.post(`/api/fl/jobs/${selectedJob}/clock`, { employeeId: employeeId.trim(), routingStepId, action: "in" });
      setActiveLog({ jobId: selectedJob, routingStepId });
      setElapsed(0);
      setMessage({ text: `Clocked in — log #${data.logId}`, ok: true });
    } catch (err) { setMessage({ text: err.message, ok: false }); }
  };

  const clockOut = async () => {
    try {
      await apiClient.post(`/api/fl/jobs/${selectedJob}/clock`, { employeeId: employeeId.trim(), action: "out", piecesProduced: Number(pieces) || 0 });
      setActiveLog(null);
      setElapsed(0);
      setPieces("0");
      setMessage({ text: "Clocked out — hours and pieces posted to the job.", ok: true });
      // Refresh job detail
      const d = await apiClient.get(`/api/fl/jobs/${selectedJob}`);
      if (d?.steps) setJobDetail(d);
    } catch (err) { setMessage({ text: err.message, ok: false }); }
  };

  const btn = { padding: "14px", fontWeight: "bold", border: "none", cursor: "pointer", fontFamily: "monospace", fontSize: "13px" };

  return (
    <div style={{ fontFamily: "monospace", color: "#e2e8f0", display: "grid", gridTemplateColumns: "280px 1fr", gap: "16px" }}>
      {/* Job picker */}
      <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", padding: "12px" }}>
        <div style={{ fontWeight: "900", color: "#f8fafc", marginBottom: "10px" }}>📋 ACTIVE JOBS</div>
        <div style={{ maxHeight: "420px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
          {jobs.length === 0 && <div style={{ color: "#64748b", fontSize: "11px", textAlign: "center", padding: "20px" }}>No active jobs.</div>}
          {jobs.map((j) => (
            <button key={j.id} onClick={() => { setSelectedJob(j.id); setActiveLog(null); setMessage({ text: "", ok: true }); }}
              style={{ textAlign: "left", backgroundColor: selectedJob === j.id ? "#0c4a6e" : "#0f172a", border: `1px solid ${selectedJob === j.id ? "#38bdf8" : "#334155"}`, color: "#e2e8f0", padding: "10px", cursor: "pointer" }}>
              <div style={{ fontWeight: "bold", fontSize: "12px" }}>{j.jobNumber}</div>
              <div style={{ fontSize: "10px", color: "#94a3b8" }}>{j.partNumber} · {j.quantityCompleted}/{j.quantityOrdered}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Punch console */}
      <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", padding: "16px" }}>
        <div style={{ fontWeight: "900", color: "#f8fafc", marginBottom: "12px" }}>🖥️ OPERATOR PUNCH TERMINAL</div>

        {!selectedJob && <div style={{ color: "#64748b", textAlign: "center", padding: "40px" }}>Select a job on the left to begin.</div>}

        {selectedJob && (
          <>
            {/* Operator + timer */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div>
                <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "bold", marginBottom: "4px" }}>EMPLOYEE BADGE ID</div>
                <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="EMP-704" disabled={!!activeLog}
                  style={{ width: "100%", backgroundColor: "#0f172a", border: "1px solid #334155", color: "#e2e8f0", padding: "10px", fontFamily: "monospace", fontSize: "13px" }} />
              </div>
              <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "bold" }}>{activeLog ? "● RECORDING" : "IDLE"}</div>
                <div style={{ fontSize: "24px", fontWeight: "900", color: activeLog ? "#4ade80" : "#475569" }}>{fmt(elapsed)}</div>
              </div>
            </div>

            {message.text && (
              <div style={{ padding: "10px", marginBottom: "12px", fontSize: "12px", fontWeight: "bold", backgroundColor: message.ok ? "#14532d" : "#7f1d1d", color: message.ok ? "#4ade80" : "#f87171", border: `1px solid ${message.ok ? "#16a34a" : "#ef4444"}` }}>
                {message.text}
              </div>
            )}

            {/* Routing steps */}
            <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "bold", marginBottom: "6px" }}>ROUTING STEPS — {jobDetail?.job?.jobNumber || ""}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
              {!jobDetail && <div style={{ color: "#64748b", padding: "16px", textAlign: "center" }}>Loading steps…</div>}
              {jobDetail?.steps?.map((s) => {
                const isActive = activeLog?.routingStepId === s.id;
                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: isActive ? "#14532d" : "#0f172a", border: `1px solid ${isActive ? "#4ade80" : "#334155"}`, padding: "10px" }}>
                    <div>
                      <span style={{ color: "#38bdf8", fontWeight: "bold" }}>{s.sequenceNumber}</span>{" "}
                      <span style={{ color: "#e2e8f0" }}>{s.description}</span>
                      {s.isOutsideProcess && <span style={{ color: "#f472b6", fontSize: "10px" }}> (OUTSIDE: {s.outsideProcessName || "vendor"})</span>}
                      <div style={{ fontSize: "10px", color: "#64748b" }}>{s.machine?.code || s.operationType} · {s.actualHours}h / {s.estimatedHours}h</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "10px", fontWeight: "bold", color: s.status === "complete" ? "#4ade80" : s.status === "in_progress" ? "#fbbf24" : "#64748b", textTransform: "uppercase" }}>{s.status}</span>
                      {!activeLog && s.status !== "complete" && (
                        <button onClick={() => clockIn(s.id)} style={{ ...btn, backgroundColor: "#16a34a", color: "#fff", padding: "8px 14px" }}>▶ START</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Clock out + pieces */}
            {activeLog && (
              <div style={{ backgroundColor: "#0f172a", border: "1px solid #4ade80", padding: "12px" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "bold", marginBottom: "4px" }}>GOOD PIECES PRODUCED</div>
                    <input type="number" min="0" value={pieces} onChange={(e) => setPieces(e.target.value)}
                      style={{ width: "100%", backgroundColor: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", padding: "10px", fontFamily: "monospace", fontSize: "16px" }} />
                  </div>
                  <button onClick={clockOut} style={{ ...btn, backgroundColor: "#dc2626", color: "#fff" }}>🛑 CLOCK OUT & POST</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default FlShopFloorTerminal;
