import { useState, useEffect } from "react";
import apiClient from "../../lib/apiClient.js";

/**
 * FlEstimating — AI-assisted quoting workspace. Builds a cost rollup
 * (material + labor + overhead + outside process) with margin pricing,
 * then saves the quote to the database.
 */
function FlEstimating() {
  const [form, setForm] = useState({ partNumber: "", partName: "", quantity: "10", materialSpec: "A36 Steel", machineType: "cnc_mill", complexity: "medium" });
  const [outside, setOutside] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [estimate, setEstimate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    apiClient.get("/api/fl/vendors").then((d) => {
      if (d?.vendors) setVendors(d.vendors.filter((v) => v.vendor_type !== "material"));
    }).catch(() => {});
  }, []);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const runEstimate = async (e) => {
    e.preventDefault();
    setBusy(true); setSaved(""); setEstimate(null);
    try {
      const data = await apiClient.post("/api/fl/quotes/estimate", { ...form, quantity: Number(form.quantity), outsideProcesses: outside });
      setEstimate(data.estimate);
    } catch (err) {
      setSaved(`Estimate failed: ${err.message}`);
    } finally { setBusy(false); }
  };

  const saveQuote = async () => {
    if (!estimate) return;
    setBusy(true);
    try {
      const data = await apiClient.post("/api/fl/quotes", {
          quoteNumber: `Q-${Date.now()}`, partNumber: estimate.partNumber, partName: estimate.partName,
          quantity: estimate.quantity, materialCost: estimate.materialCost, laborCost: estimate.laborCost,
          overheadCost: estimate.overheadCost, outsideProcessCost: estimate.outsideProcessCost,
          marginPercent: estimate.marginPercent, aiEstimated: true
      });
      setSaved(`✅ Quote saved — $${data.totalPrice} total ($${data.unitPrice}/unit)`);
    } catch (err) { setSaved(`Save failed: ${err.message}`); } finally { setBusy(false); }
  };

  const input = { width: "100%", backgroundColor: "#0f172a", border: "1px solid #334155", color: "#e2e8f0", padding: "8px", fontFamily: "monospace", fontSize: "12px" };
  const label = { display: "block", fontSize: "10px", color: "#94a3b8", marginBottom: "4px", fontWeight: "bold", textTransform: "uppercase" };

  return (
    <div style={{ fontFamily: "monospace", color: "#e2e8f0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
      {/* Input form */}
      <form onSubmit={runEstimate} style={{ backgroundColor: "#1e293b", border: "1px solid #334155", padding: "16px" }}>
        <div style={{ fontWeight: "900", marginBottom: "12px", color: "#f8fafc" }}>🤖 AI QUOTE BUILDER</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div><span style={label}>Part Number</span><input style={input} value={form.partNumber} onChange={update("partNumber")} required /></div>
          <div><span style={label}>Part Name</span><input style={input} value={form.partName} onChange={update("partName")} /></div>
          <div><span style={label}>Quantity</span><input style={input} type="number" min="1" value={form.quantity} onChange={update("quantity")} /></div>
          <div><span style={label}>Material Spec</span><input style={input} value={form.materialSpec} onChange={update("materialSpec")} /></div>
          <div><span style={label}>Machine Type</span>
            <select style={input} value={form.machineType} onChange={update("machineType")}>
              <option value="cnc_lathe">CNC Lathe</option>
              <option value="cnc_mill">CNC Mill</option>
              <option value="live_tooling">Live Tooling</option>
              <option value="swiss">Swiss</option>
            </select>
          </div>
          <div><span style={label}>Complexity</span>
            <select style={input} value={form.complexity} onChange={update("complexity")}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="extreme">Extreme</option>
            </select>
          </div>
        </div>

        {/* Outside processes */}
        <div style={{ marginTop: "12px" }}>
          <span style={label}>Outside Processes</span>
          {vendors.map((v) => {
            const on = outside.some((o) => o.vendorId === v.id);
            return (
              <label key={v.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#cbd5e1", marginBottom: "4px" }}>
                <input type="checkbox" checked={on} onChange={(e) => {
                  setOutside((prev) => e.target.checked ? [...prev, { vendorId: v.id, name: v.name, cost: 150 }] : prev.filter((o) => o.vendorId !== v.id));
                }} />
                {v.name} ({v.lead_time_days}d lead)
              </label>
            );
          })}
        </div>

        <button type="submit" disabled={busy} style={{ marginTop: "14px", width: "100%", backgroundColor: "#2563eb", color: "#fff", padding: "12px", fontWeight: "bold", border: "none", cursor: "pointer" }}>
          {busy ? "COMPUTING…" : "▶ RUN AI ESTIMATE"}
        </button>
      </form>

      {/* Result */}
      <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", padding: "16px" }}>
        <div style={{ fontWeight: "900", marginBottom: "12px", color: "#f8fafc" }}>💰 COST ROLLUP</div>
        {!estimate && <div style={{ color: "#64748b", fontSize: "12px", padding: "30px", textAlign: "center" }}>Run an estimate to see the cost breakdown.</div>}
        {estimate && (
          <>
            <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
              <tbody>
                {[["Setup", `${estimate.setupHours}h`], ["Run/pc", `${estimate.runHoursPerPiece}h`], ["Machine hrs", `${estimate.totalMachineHours}h`], ["Material", `$${estimate.materialCost}`], ["Labor", `$${estimate.laborCost}`], ["Overhead", `$${estimate.overheadCost}`], ["Outside", `$${estimate.outsideProcessCost}`]].map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: "1px solid #334155" }}><td style={{ padding: "6px", color: "#94a3b8" }}>{k}</td><td style={{ padding: "6px", textAlign: "right", color: "#e2e8f0" }}>{v}</td></tr>
                ))}
                <tr style={{ borderTop: "2px solid #475569" }}><td style={{ padding: "8px 6px", fontWeight: "bold", color: "#f8fafc" }}>Subtotal</td><td style={{ padding: "8px 6px", textAlign: "right", fontWeight: "bold" }}>${estimate.subtotal}</td></tr>
                <tr><td style={{ padding: "6px", color: "#94a3b8" }}>Margin {estimate.marginPercent}%</td><td style={{ padding: "6px", textAlign: "right", color: "#94a3b8" }}></td></tr>
                <tr style={{ backgroundColor: "#14532d" }}><td style={{ padding: "8px 6px", fontWeight: "900", color: "#4ade80" }}>UNIT PRICE</td><td style={{ padding: "8px 6px", textAlign: "right", fontWeight: "900", color: "#4ade80" }}>${estimate.unitPrice}</td></tr>
                <tr style={{ backgroundColor: "#14532d" }}><td style={{ padding: "8px 6px", fontWeight: "900", color: "#4ade80" }}>TOTAL</td><td style={{ padding: "8px 6px", textAlign: "right", fontWeight: "900", color: "#4ade80" }}>${estimate.totalPrice}</td></tr>
              </tbody>
            </table>
            <button onClick={saveQuote} disabled={busy} style={{ marginTop: "12px", width: "100%", backgroundColor: "#16a34a", color: "#fff", padding: "12px", fontWeight: "bold", border: "none", cursor: "pointer" }}>
              💾 SAVE AS QUOTE
            </button>
          </>
        )}
        {saved && <div style={{ marginTop: "10px", fontSize: "11px", fontWeight: "bold", color: saved.startsWith("✅") ? "#4ade80" : "#f87171" }}>{saved}</div>}
      </div>
    </div>
  );
}

export default FlEstimating;
