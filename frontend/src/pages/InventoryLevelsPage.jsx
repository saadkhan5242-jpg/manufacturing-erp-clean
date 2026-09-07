import { useState, useEffect, useCallback } from "react";
import apiClient from "../lib/apiClient.js";

const POLL_MS = 5000;

/**
 * MODULE 7: REAL-TIME GRAPHIC INVENTORY STOCK STATUS READOUTS
 * Interactive spreadsheet monitoring canvas with visual bar meters.
 * Meters increment when a Genii AI invoice posts to the AP ledger and
 * subtract material units when a work order completes — polled live.
 */
function InventoryLevelsPage() {
  const [levels, setLevels] = useState([]);
  const [polledAt, setPolledAt] = useState(null);
  const [error, setError] = useState("");
  const [pulse, setPulse] = useState(false);

  const fetchLevels = useCallback(async () => {
    try {
      const data = await apiClient.get("/api/inventory/live-levels");
      setLevels((prev) => {
        // Flash rows whose quantity changed since last poll
        const prevMap = new Map(prev.map((p) => [p.partNumber, p.quantity]));
        return (data.levels || []).map((row) => ({
          ...row,
          delta: prevMap.has(row.partNumber) ? row.quantity - prevMap.get(row.partNumber) : 0
        }));
      });
      setPolledAt(data.polledAt);
      setError("");
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    } catch (err) {
      setError(`Live stream interrupted: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    fetchLevels();
    const timer = setInterval(fetchLevels, POLL_MS);
    return () => clearInterval(timer);
  }, [fetchLevels]);

  const maxQty = Math.max(1, ...levels.map((l) => l.quantity));
  const totalValue = levels.reduce((sum, l) => sum + l.stockValue, 0);

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto", fontFamily: "Segoe UI, sans-serif" }}>
      <header style={{ borderBottom: "3px solid #0891b2", paddingBottom: "14px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h2 style={{ margin: 0, color: "#0e7490" }}>📊 GSS Real-Time Inventory Stock Status</h2>
          <p style={{ margin: "4px 0 0", color: "#718096", fontSize: "13px" }}>
            Live readout stream — invoice receipts increment rows, work-order completions decrement them.
          </p>
        </div>
        <div style={{ textAlign: "right", fontSize: "12px", color: "#718096" }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", marginRight: 6, background: pulse ? "#22c55e" : "#94a3b8", transition: "background 0.3s" }} />
          {polledAt ? `Polled ${new Date(polledAt).toLocaleTimeString()}` : "Connecting…"} · refresh {POLL_MS / 1000}s
        </div>
      </header>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: "6px", marginBottom: "18px", fontWeight: 600, color: "#fff", backgroundColor: "#c53030" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "22px" }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderTop: "4px solid #0891b2", borderRadius: "8px", padding: "14px 16px" }}>
          <div style={{ fontSize: "11px", color: "#a0aec0", letterSpacing: "0.05em" }}>TRACKED PARTS</div>
          <div style={{ fontSize: "26px", fontWeight: 700, color: "#0e7490" }}>{levels.length}</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderTop: "4px solid #0891b2", borderRadius: "8px", padding: "14px 16px" }}>
          <div style={{ fontSize: "11px", color: "#a0aec0", letterSpacing: "0.05em" }}>TOTAL UNITS ON HAND</div>
          <div style={{ fontSize: "26px", fontWeight: 700, color: "#0e7490" }}>{levels.reduce((s, l) => s + l.quantity, 0)}</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderTop: "4px solid #0891b2", borderRadius: "8px", padding: "14px 16px" }}>
          <div style={{ fontSize: "11px", color: "#a0aec0", letterSpacing: "0.05em" }}>TOTAL STOCK VALUE</div>
          <div style={{ fontSize: "26px", fontWeight: 700, color: "#0e7490" }}>${totalValue.toFixed(2)}</div>
        </div>
      </div>

      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#ecfeff", textAlign: "left", color: "#0e7490" }}>
              {["Part #", "Description", "Live Stock Meter", "Qty", "Δ Poll", "+ Invoiced", "− Consumed", "Unit Cost", "Stock Value", "Last Movement"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", borderBottom: "2px solid #a5f3fc" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {levels.length === 0 && !error && (
              <tr><td colSpan="10" style={{ padding: "20px", textAlign: "center", color: "#a0aec0" }}>Awaiting first live stream…</td></tr>
            )}
            {levels.map((row) => {
              const pct = Math.round((row.quantity / maxQty) * 100);
              const meterColor = row.quantity === 0 ? "#c53030" : pct < 25 ? "#dd6b20" : "#0891b2";
              return (
                <tr key={row.partNumber} style={{ borderBottom: "1px solid #edf2f7" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 700 }}>{row.partNumber}</td>
                  <td style={{ padding: "10px 14px" }}>{row.description}</td>
                  <td style={{ padding: "10px 14px", minWidth: "180px" }}>
                    <div style={{ background: "#edf2f7", borderRadius: "6px", height: "16px", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${meterColor}, ${meterColor}cc)`, transition: "width 0.6s ease" }} />
                    </div>
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: meterColor }}>{row.quantity}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: row.delta > 0 ? "#16a34a" : row.delta < 0 ? "#dc2626" : "#94a3b8" }}>
                    {row.delta > 0 ? `▲ +${row.delta}` : row.delta < 0 ? `▼ ${row.delta}` : "·"}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#16a34a" }}>+{row.receivedFromInvoices}</td>
                  <td style={{ padding: "10px 14px", color: "#dc2626" }}>−{row.consumedByWorkOrders}</td>
                  <td style={{ padding: "10px 14px" }}>${row.unitPrice.toFixed(2)}</td>
                  <td style={{ padding: "10px 14px" }}>${row.stockValue.toFixed(2)}</td>
                  <td style={{ padding: "10px 14px", color: "#718096" }}>{row.lastUpdated ? new Date(row.lastUpdated).toLocaleString() : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default InventoryLevelsPage;
