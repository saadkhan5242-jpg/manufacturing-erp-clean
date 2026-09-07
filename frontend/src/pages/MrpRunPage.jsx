import { useState, useEffect, useCallback } from "react";
import apiClient from "../lib/apiClient.js";


/**
 * MODULE 5: AUTOMATED MATERIAL REQUIREMENTS PLANNING (MRP) RUN ENGINE
 * Shortage forecasts, critical allocations, and the one-click GSS
 * material generation run trigger.
 */
function MrpRunPage() {
  const [forecast, setForecast] = useState(null);
  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [banner, setBanner] = useState({ text: "", type: "" });

  const fetchForecast = useCallback(async () => {
    try {
      setForecast(await apiClient.get("/api/mrp/forecast"));
    } catch (err) {
      setBanner({ text: `Forecast stream interrupted: ${err.message}`, type: "error" });
    }
  }, []);

  const fetchDemands = useCallback(async () => {
    try {
      const data = await apiClient.get("/api/mrp/demands");
      setDemands(data.demands || []);
    } catch (err) {
      setBanner({ text: `Demand ledger read failed: ${err.message}`, type: "error" });
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchForecast(), fetchDemands()]).finally(() => setLoading(false));
  }, [fetchForecast, fetchDemands]);

  const executeMrpRun = async () => {
    setRunning(true);
    setBanner({ text: "", type: "" });
    try {
      const data = await apiClient.post("/api/mrp/run-engine", { trigger: "MANUAL_CONSOLE" });
      setBanner({ text: data.message, type: "success" });
      await Promise.all([fetchForecast(), fetchDemands()]);
    } catch (err) {
      setBanner({ text: `MRP Run Rejected: ${err.message}`, type: "error" });
    } finally {
      setRunning(false);
    }
  };

  const requirements = forecast?.requirements || [];
  const shortages = requirements.filter((r) => r.status === "SHORTAGE");
  const totalExposure = shortages.reduce((sum, r) => sum + r.estimatedCost, 0);

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto", fontFamily: "Segoe UI, sans-serif" }}>
      <header style={{ borderBottom: "3px solid #2b6cb0", paddingBottom: "14px", marginBottom: "20px" }}>
        <h2 style={{ margin: 0, color: "#2b6cb0" }}>🧮 GSS Automated MRP Run Engine</h2>
        <p style={{ margin: "4px 0 0", color: "#718096", fontSize: "13px" }}>
          Nets open work-order demand against live stock tallies and generates actionable purchasing requisitions.
        </p>
      </header>

      {banner.text && (
        <div style={{ padding: "12px 16px", borderRadius: "6px", marginBottom: "18px", fontWeight: 600, color: "#fff", backgroundColor: banner.type === "success" ? "#2f855a" : "#c53030" }}>
          {banner.text}
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "22px" }}>
        {[
          { label: "OPEN JOBS PARSED", value: forecast?.openJobCount ?? "—", color: "#2b6cb0" },
          { label: "PARTS ANALYZED", value: requirements.length, color: "#4a5568" },
          { label: "ACTIVE SHORTAGES", value: shortages.length, color: shortages.length ? "#c53030" : "#2f855a" },
          { label: "SHORTAGE EXPOSURE", value: `$${totalExposure.toFixed(2)}`, color: totalExposure ? "#c53030" : "#2f855a" }
        ].map((kpi) => (
          <div key={kpi.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderTop: `4px solid ${kpi.color}`, borderRadius: "8px", padding: "14px 16px" }}>
            <div style={{ fontSize: "11px", color: "#a0aec0", letterSpacing: "0.05em" }}>{kpi.label}</div>
            <div style={{ fontSize: "26px", fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={executeMrpRun}
        disabled={running}
        style={{
          width: "100%", padding: "18px", marginBottom: "24px",
          backgroundColor: running ? "#90cdf4" : "#2b6cb0", color: "#fff",
          border: "none", borderRadius: "8px", fontSize: "16px", fontWeight: 700,
          cursor: running ? "wait" : "pointer", letterSpacing: "0.02em",
          boxShadow: "0 4px 12px rgba(43,108,176,0.35)"
        }}
      >
        {running ? "⏳ Executing MRP Netting Loop…" : "▶ Execute GSS MRP Material Generation Run"}
      </button>

      {/* Shortage forecast table */}
      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", marginBottom: "24px", overflow: "hidden" }}>
        <h3 style={{ margin: 0, padding: "14px 16px", background: "#ebf4ff", color: "#2b6cb0", fontSize: "14px" }}>
          📉 Shortage Forecast & Critical Allocations
        </h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f7fafc", textAlign: "left", color: "#718096" }}>
              {["Part #", "Description", "Gross Req", "On Hand", "Net Deficiency", "Priority", "Status"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="7" style={{ padding: "20px", textAlign: "center", color: "#a0aec0" }}>Streaming demand netting…</td></tr>}
            {!loading && requirements.length === 0 && (
              <tr><td colSpan="7" style={{ padding: "20px", textAlign: "center", color: "#2f855a" }}>✅ No open production demand — all materials covered.</td></tr>
            )}
            {requirements.map((r) => (
              <tr key={r.partNumber} style={{ borderBottom: "1px solid #edf2f7", background: r.status === "SHORTAGE" ? "#fff5f5" : "#fff" }}>
                <td style={{ padding: "10px 14px", fontWeight: 700 }}>{r.partNumber}</td>
                <td style={{ padding: "10px 14px" }}>{r.description}</td>
                <td style={{ padding: "10px 14px" }}>{r.grossRequirement}</td>
                <td style={{ padding: "10px 14px" }}>{r.onHand}</td>
                <td style={{ padding: "10px 14px", fontWeight: 700, color: r.netDeficiency > 0 ? "#c53030" : "#2f855a" }}>{r.netDeficiency}</td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{ padding: "3px 10px", borderRadius: "10px", fontSize: "11px", fontWeight: 700, color: "#fff", background: r.priority === "CRITICAL" ? "#c53030" : r.priority === "EXPEDITE" ? "#dd6b20" : "#38a169" }}>
                    {r.priority}
                  </span>
                </td>
                <td style={{ padding: "10px 14px", fontWeight: 600, color: r.status === "SHORTAGE" ? "#c53030" : "#38a169" }}>
                  {r.status === "SHORTAGE" ? "⚠ SHORTAGE" : "✔ COVERED"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Procurement demands ledger */}
      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
        <h3 style={{ margin: 0, padding: "14px 16px", background: "#f0fff4", color: "#276749", fontSize: "14px" }}>
          🛒 Generated Procurement Requisitions (mrp_procurement_demands)
        </h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f7fafc", textAlign: "left", color: "#718096" }}>
              {["Run ID", "Part #", "Order Qty", "Est. Cost", "Priority", "Status", "Generated"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {demands.length === 0 && (
              <tr><td colSpan="7" style={{ padding: "20px", textAlign: "center", color: "#a0aec0" }}>No requisitions yet — execute an MRP run to generate demands.</td></tr>
            )}
            {demands.map((d) => (
              <tr key={d.id} style={{ borderBottom: "1px solid #edf2f7", opacity: d.status === "OPEN" ? 1 : 0.55 }}>
                <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: "12px" }}>{d.run_id}</td>
                <td style={{ padding: "10px 14px", fontWeight: 700 }}>{d.part_number}</td>
                <td style={{ padding: "10px 14px" }}>{d.suggested_order_qty}</td>
                <td style={{ padding: "10px 14px" }}>${Number(d.estimated_cost).toFixed(2)}</td>
                <td style={{ padding: "10px 14px" }}>{d.priority}</td>
                <td style={{ padding: "10px 14px", fontWeight: 600, color: d.status === "OPEN" ? "#c53030" : "#718096" }}>{d.status}</td>
                <td style={{ padding: "10px 14px", color: "#718096" }}>{new Date(d.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default MrpRunPage;
