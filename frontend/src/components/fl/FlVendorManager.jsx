import { useState, useEffect } from "react";
import apiClient from "../../lib/apiClient.js";

/**
 * FlVendorManager — vendor & outside process management. Material +
 * outside process vendors with lead times, performance tracking, and
 * one-click automated PO creation.
 */
function FlVendorManager() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [poForm, setPoForm] = useState({ vendorId: "", partNumber: "", quantity: "", unitCost: "" });

  const load = () => {
    apiClient.get("/api/fl/vendors").then((d) => {
      if (d?.vendors) setVendors(d.vendors);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(load, []);

  const createPo = async (e) => {
    e.preventDefault();
    setNotice("");
    try {
      const data = await apiClient.post("/api/fl/vendors/po", {
          vendorId: Number(poForm.vendorId),
          lines: [{ partNumber: poForm.partNumber, quantity: Number(poForm.quantity), unitCost: Number(poForm.unitCost), description: "PO line" }]
      });
      setNotice(`✅ ${data.message}`);
      setPoForm({ vendorId: "", partNumber: "", quantity: "", unitCost: "" });
      load();
    } catch (err) { setNotice(`❌ ${err.message}`); }
  };

  const typeColor = { material: "#38bdf8", outside_process: "#f472b6", both: "#a78bfa" };
  const input = { backgroundColor: "#0f172a", border: "1px solid #334155", color: "#e2e8f0", padding: "8px", fontFamily: "monospace", fontSize: "12px" };

  return (
    <div style={{ fontFamily: "monospace", color: "#e2e8f0", display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
      {/* Vendor table */}
      <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", padding: "16px" }}>
        <div style={{ fontWeight: "900", marginBottom: "12px", color: "#f8fafc" }}>🏭 VENDOR DIRECTORY & PERFORMANCE</div>
        {loading && <div style={{ color: "#64748b", padding: "20px", textAlign: "center" }}>Loading vendors…</div>}
        {!loading && (
          <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#0f172a", color: "#94a3b8" }}>
                {["VENDOR", "TYPE", "LEAD (DAYS)", "POs", "ON-TIME %", "QUALITY"].map((h) => (
                  <th key={h} style={{ padding: "8px", border: "1px solid #334155", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id} style={{ borderBottom: "1px solid #334155" }}>
                  <td style={{ padding: "8px", border: "1px solid #334155", fontWeight: "bold", color: "#e2e8f0" }}>{v.name}<div style={{ fontSize: "9px", color: "#64748b" }}>{v.code}</div></td>
                  <td style={{ padding: "8px", border: "1px solid #334155" }}><span style={{ padding: "2px 6px", backgroundColor: typeColor[v.vendor_type] || "#334155", color: "#0f172a", fontSize: "9px", fontWeight: "bold" }}>{v.vendor_type.replace(/_/g, " ").toUpperCase()}</span></td>
                  <td style={{ padding: "8px", border: "1px solid #334155" }}>{v.lead_time_days}</td>
                  <td style={{ padding: "8px", border: "1px solid #334155" }}>{v.total_pos}</td>
                  <td style={{ padding: "8px", border: "1px solid #334155", color: Number(v.on_time_rate) >= 0.9 ? "#4ade80" : Number(v.on_time_rate) >= 0.7 ? "#fbbf24" : "#94a3b8" }}>{v.on_time_rate !== null ? `${Math.round(Number(v.on_time_rate) * 100)}%` : "—"}</td>
                  <td style={{ padding: "8px", border: "1px solid #334155", color: "#fbbf24" }}>{v.avg_quality !== null ? `${v.avg_quality}★` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick PO creation */}
      <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", padding: "16px" }}>
        <div style={{ fontWeight: "900", marginBottom: "12px", color: "#f8fafc" }}>⚡ AUTO PO CREATION</div>
        <form onSubmit={createPo} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <select style={input} value={poForm.vendorId} onChange={(e) => setPoForm((f) => ({ ...f, vendorId: e.target.value }))} required>
            <option value="">Select vendor…</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <input style={input} placeholder="Part / material" value={poForm.partNumber} onChange={(e) => setPoForm((f) => ({ ...f, partNumber: e.target.value }))} required />
          <input style={input} type="number" min="1" placeholder="Quantity" value={poForm.quantity} onChange={(e) => setPoForm((f) => ({ ...f, quantity: e.target.value }))} required />
          <input style={input} type="number" step="0.01" min="0" placeholder="Unit cost $" value={poForm.unitCost} onChange={(e) => setPoForm((f) => ({ ...f, unitCost: e.target.value }))} required />
          <button type="submit" style={{ backgroundColor: "#16a34a", color: "#fff", padding: "12px", fontWeight: "bold", border: "none", cursor: "pointer" }}>📤 CREATE & SEND PO</button>
        </form>
        {notice && <div style={{ marginTop: "10px", fontSize: "11px", fontWeight: "bold", color: notice.startsWith("✅") ? "#4ade80" : "#f87171" }}>{notice}</div>}
      </div>
    </div>
  );
}

export default FlVendorManager;
