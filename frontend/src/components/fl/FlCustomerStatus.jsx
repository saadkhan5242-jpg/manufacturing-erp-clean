import { useState } from "react";
import apiClient from "../../lib/apiClient.js";

/**
 * FlCustomerStatus — customer-facing job status report. Look up a job by ID
 * and render a clean, shareable progress report (routing, QC, shipping).
 */
function FlCustomerStatus() {
  const [jobId, setJobId] = useState("");
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadReport = async (e) => {
    e.preventDefault();
    if (!jobId.trim()) return;
    setLoading(true); setError(""); setReport(null);
    try {
      const data = await apiClient.get(`/api/fl/jobs/${jobId.trim()}/status-report`);
      setReport(data.report);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const statusBadge = (s) => ({
    in_progress: { bg: "#14532d", fg: "#4ade80" }, qc: { bg: "#78350f", fg: "#fbbf24" },
    ready_to_ship: { bg: "#14532d", fg: "#4ade80" }, shipped: { bg: "#1e3a8a", fg: "#60a5fa" },
    outside_process: { bg: "#701a3a", fg: "#f472b6" }
  }[s] || { bg: "#334155", fg: "#cbd5e1" });

  return (
    <div style={{ fontFamily: "monospace", color: "#e2e8f0" }}>
      {/* Lookup bar */}
      <form onSubmit={loadReport} style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        <input value={jobId} onChange={(e) => setJobId(e.target.value)} placeholder="Enter Job ID (e.g. 1)"
          style={{ flex: 1, backgroundColor: "#0f172a", border: "1px solid #334155", color: "#e2e8f0", padding: "10px", fontFamily: "monospace", fontSize: "13px" }} />
        <button type="submit" disabled={loading} style={{ backgroundColor: "#2563eb", color: "#fff", padding: "10px 20px", fontWeight: "bold", border: "none", cursor: "pointer" }}>
          {loading ? "LOADING…" : "🔍 VIEW STATUS"}
        </button>
      </form>
      {error && <div style={{ padding: "10px", backgroundColor: "#7f1d1d", border: "1px solid #ef4444", color: "#f87171", fontSize: "12px", fontWeight: "bold", marginBottom: "12px" }}>❌ {error}</div>}

      {!report && !error && <div style={{ textAlign: "center", padding: "40px", color: "#64748b", border: "1px dashed #334155" }}>Enter a job ID to generate the customer status report.</div>}

      {report && (
        <div style={{ backgroundColor: "#fff", color: "#0f172a", border: "1px solid #cbd5e1", padding: "24px" }}>
          {/* Report header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #0f172a", paddingBottom: "12px", marginBottom: "16px" }}>
            <div>
              <div style={{ fontWeight: "900", fontSize: "18px" }}>JOB STATUS REPORT</div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>ForgeLogic AI · Customer Progress Document</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: "900", fontSize: "16px" }}>{report.jobNumber}</div>
              <span style={{ fontSize: "10px", fontWeight: "bold", padding: "2px 8px", backgroundColor: statusBadge(report.status).bg, color: statusBadge(report.status).fg, textTransform: "uppercase" }}>
                {report.status.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          {/* Summary grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "16px" }}>
            {[["PART", `${report.partNumber}${report.partName ? ` — ${report.partName}` : ""}`], ["CUSTOMER", report.customer || "—"], ["QTY", `${report.quantityCompleted}/${report.quantityOrdered}`], ["DUE", report.dueDate ? new Date(report.dueDate).toLocaleDateString() : "—"]].map(([k, v]) => (
              <div key={k} style={{ border: "1px solid #cbd5e1", padding: "10px" }}>
                <div style={{ fontSize: "9px", color: "#64748b", fontWeight: "bold" }}>{k}</div>
                <div style={{ fontSize: "13px", fontWeight: "bold", marginTop: "2px" }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Progress bars */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "10px", fontWeight: "bold", color: "#64748b", marginBottom: "4px" }}>ROUTING PROGRESS — {report.progressPercent}%</div>
            <div style={{ height: "10px", backgroundColor: "#e2e8f0", marginBottom: "8px" }}><div style={{ height: "100%", width: `${report.progressPercent}%`, backgroundColor: "#16a34a" }} /></div>
            <div style={{ fontSize: "10px", fontWeight: "bold", color: "#64748b", marginBottom: "4px" }}>QUANTITY COMPLETE — {report.quantityPercent}%</div>
            <div style={{ height: "10px", backgroundColor: "#e2e8f0" }}><div style={{ height: "100%", width: `${report.quantityPercent}%`, backgroundColor: "#2563eb" }} /></div>
            <div style={{ marginTop: "8px", fontSize: "11px", fontWeight: "bold", color: report.isOnTrack ? "#16a34a" : "#dc2626" }}>
              {report.isOnTrack ? "✅ ON TRACK FOR DELIVERY" : "⚠️ REVIEW DELIVERY DATE"}
            </div>
          </div>

          {/* Routing timeline */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "11px", fontWeight: "900", marginBottom: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "4px" }}>MANUFACTURING ROUTING</div>
            {report.routing.map((s) => (
              <div key={s.sequence} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: "11px" }}>
                <span style={{ width: "30px", fontWeight: "bold", color: "#2563eb" }}>{s.sequence}</span>
                <span style={{ flex: 1 }}>{s.description}{s.isOutside && <span style={{ color: "#9333ea" }}> (Outside: {s.outsideProcess || "vendor"})</span>}</span>
                <span style={{ fontWeight: "bold", color: s.status === "complete" ? "#16a34a" : s.status === "in_progress" ? "#d97706" : "#94a3b8", textTransform: "uppercase", fontSize: "10px" }}>
                  {s.status === "complete" ? "✓ Done" : s.status === "in_progress" ? "● Running" : "○ Pending"}
                </span>
              </div>
            ))}
          </div>

          {/* QC + Shipping */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "11px", fontWeight: "900", marginBottom: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "4px" }}>QUALITY CONTROL</div>
              {report.qc.length === 0 && <div style={{ fontSize: "11px", color: "#94a3b8" }}>No QC checks recorded yet.</div>}
              {report.qc.map((q, i) => (
                <div key={i} style={{ fontSize: "11px", padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <b>{q.type.replace(/_/g, " ")}</b> — <span style={{ color: q.result === "pass" ? "#16a34a" : q.result === "fail" ? "#dc2626" : "#d97706", fontWeight: "bold" }}>{q.result.toUpperCase()}</span>
                  <span style={{ color: "#94a3b8" }}> · {q.inspector || "—"}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: "11px", fontWeight: "900", marginBottom: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "4px" }}>SHIPPING</div>
              {report.shipments.length === 0 && <div style={{ fontSize: "11px", color: "#94a3b8" }}>Not yet shipped.</div>}
              {report.shipments.map((s, i) => (
                <div key={i} style={{ fontSize: "11px", padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <b>{s.carrier || "—"}</b> · {s.qty} pcs · {s.status}
                  {s.tracking && <span style={{ color: "#2563eb" }}> · #{s.tracking}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FlCustomerStatus;
