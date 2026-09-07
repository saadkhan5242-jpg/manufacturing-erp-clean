import { useState, useEffect } from "react";
import apiClient from "../../lib/apiClient.js";

/**
 * FlAiIntelligence — AI command center. Predictive lateness alerts,
 * machine capacity load, AI routing suggester, and decision audit log.
 */
function FlAiIntelligence() {
  const [alerts, setAlerts] = useState([]);
  const [capacity, setCapacity] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [suggestForm, setSuggestForm] = useState({ partNumber: "", hasMilledFeatures: false, hasThreads: false, tightTolerances: false, requiresHeatTreat: false, requiresPlating: false });
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiClient.get("/api/fl/ai/lateness-alerts").catch(() => null),
      apiClient.get("/api/fl/ai/capacity").catch(() => null),
      apiClient.get("/api/fl/ai/decisions").catch(() => null)
    ]).then(([a, c, d]) => {
      if (cancelled) return;
      if (a?.alerts) setAlerts(a.alerts);
      if (c?.machines) setCapacity(c.machines);
      if (d?.decisions) setDecisions(d.decisions);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const runSuggest = async (e) => {
    e.preventDefault();
    const data = await apiClient.post("/api/fl/ai/suggest-routing", suggestForm);
    setSuggestion(data.suggestedRouting);
  };

  const riskColor = { critical: "#ef4444", at_risk: "#f59e0b", on_track: "#4ade80" };
  const input = { backgroundColor: "#0f172a", border: "1px solid #334155", color: "#e2e8f0", padding: "8px", fontFamily: "monospace", fontSize: "12px", width: "100%" };
  const toggle = (k) => (e) => setSuggestForm((f) => ({ ...f, [k]: e.target.checked }));

  return (
    <div style={{ fontFamily: "monospace", color: "#e2e8f0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
      {/* Lateness alerts */}
      <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", padding: "16px" }}>
        <div style={{ fontWeight: "900", marginBottom: "12px", color: "#f8fafc" }}>🚨 PREDICTIVE LATENESS ALERTS</div>
        {loading && <div style={{ color: "#64748b", padding: "16px", textAlign: "center" }}>Analyzing schedule…</div>}
        {!loading && alerts.length === 0 && <div style={{ color: "#4ade80", padding: "16px", textAlign: "center", fontSize: "12px" }}>✅ All jobs on track.</div>}
        {alerts.map((a) => (
          <div key={a.jobId} style={{ border: `1px solid ${riskColor[a.riskLevel]}`, borderLeft: `4px solid ${riskColor[a.riskLevel]}`, padding: "10px", marginBottom: "8px", backgroundColor: "#0f172a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
              <b style={{ color: "#f8fafc" }}>{a.jobNumber}</b>
              <span style={{ color: riskColor[a.riskLevel], fontWeight: "bold", textTransform: "uppercase", fontSize: "10px" }}>{a.riskLevel.replace("_", " ")}</span>
            </div>
            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>{a.partNumber} · {a.remainingHours}h remaining · due in {a.daysUntilDue}d</div>
            <div style={{ fontSize: "10px", color: "#fbbf24", marginTop: "4px" }}>💡 {a.recommendation}</div>
          </div>
        ))}
      </div>

      {/* Capacity + routing suggester */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", padding: "16px" }}>
          <div style={{ fontWeight: "900", marginBottom: "12px", color: "#f8fafc" }}>⚙️ MACHINE CAPACITY LOAD</div>
          {capacity.map((m) => (
            <div key={m.id} style={{ marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "2px" }}>
                <span style={{ color: "#cbd5e1" }}>{m.code} <span style={{ color: "#64748b" }}>({m.machineType.replace(/_/g, " ")})</span></span>
                <span style={{ fontWeight: "bold", color: m.overloaded ? "#f87171" : m.utilizationPercent > 80 ? "#fbbf24" : "#4ade80" }}>{m.utilizationPercent}%</span>
              </div>
              <div style={{ height: "8px", backgroundColor: "#0f172a", border: "1px solid #334155" }}>
                <div style={{ height: "100%", width: `${Math.min(100, m.utilizationPercent)}%`, backgroundColor: m.overloaded ? "#ef4444" : "#38bdf8" }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", padding: "16px" }}>
          <div style={{ fontWeight: "900", marginBottom: "12px", color: "#f8fafc" }}>🧠 AI ROUTING SUGGESTER</div>
          <form onSubmit={runSuggest} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <input style={input} placeholder="Part number" value={suggestForm.partNumber} onChange={(e) => setSuggestForm((f) => ({ ...f, partNumber: e.target.value }))} required />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11px", color: "#cbd5e1" }}>
              {[["hasMilledFeatures", "Milled features"], ["hasThreads", "Threads"], ["tightTolerances", "Tight tolerances"], ["requiresHeatTreat", "Heat treat"], ["requiresPlating", "Plating/Anodize"]].map(([k, lbl]) => (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input type="checkbox" checked={suggestForm[k]} onChange={toggle(k)} /> {lbl}
                </label>
              ))}
            </div>
            <button type="submit" style={{ backgroundColor: "#7c3aed", color: "#fff", padding: "10px", fontWeight: "bold", border: "none", cursor: "pointer" }}>✨ SUGGEST ROUTING</button>
          </form>
          {suggestion && (
            <div style={{ marginTop: "10px", fontSize: "11px" }}>
              {suggestion.map((s) => (
                <div key={s.sequence} style={{ padding: "4px 6px", borderLeft: "2px solid #7c3aed", marginBottom: "4px", backgroundColor: "#0f172a", color: "#cbd5e1" }}>
                  <b style={{ color: "#a78bfa" }}>{s.sequence}</b> {s.description} {s.outside && <span style={{ color: "#f472b6" }}>({s.process})</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Decision audit log */}
      <div style={{ gridColumn: "1 / -1", backgroundColor: "#1e293b", border: "1px solid #334155", padding: "16px" }}>
        <div style={{ fontWeight: "900", marginBottom: "12px", color: "#f8fafc" }}>📜 AI DECISION AUDIT LOG</div>
        <div style={{ maxHeight: "180px", overflowY: "auto", fontSize: "11px" }}>
          {decisions.length === 0 && <div style={{ color: "#64748b", textAlign: "center", padding: "16px" }}>No AI decisions logged yet.</div>}
          {decisions.map((d) => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px", borderBottom: "1px solid #334155", color: "#94a3b8" }}>
              <span style={{ color: "#a78bfa", fontWeight: "bold" }}>{d.module.toUpperCase()}</span>
              <span>{d.confidence} confidence</span>
              <span>{new Date(d.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FlAiIntelligence;
