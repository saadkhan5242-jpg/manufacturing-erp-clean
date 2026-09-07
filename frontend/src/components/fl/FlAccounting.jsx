import { useState, useEffect } from "react";
import apiClient from "../../lib/apiClient.js";

const SYNC_ENTITIES = [
  { key: "customers", label: "Customers", icon: "🧑‍🤝‍🧑" },
  { key: "vendors", label: "Vendors", icon: "🏭" },
  { key: "purchase-orders", label: "Purchase Orders", icon: "📦" },
  { key: "bills", label: "Bills", icon: "🧾" },
  { key: "invoices", label: "Invoices", icon: "📄" },
  { key: "payments", label: "Payments", icon: "💳" },
  { key: "job-costing", label: "Job Costing", icon: "🎯" }
];

/**
 * FlAccounting — Accounting / QuickBooks Online integration panel.
 * Connection status, one-click entity sync, and the reliable sync queue.
 */
function FlAccounting() {
  const [status, setStatus] = useState(null);
  const [queue, setQueue] = useState([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const load = () => {
    Promise.all([
      apiClient.get("/api/quickbooks/status").catch(() => null),
      apiClient.get("/api/quickbooks/queue").catch(() => null)
    ]).then(([s, q]) => {
      if (s) setStatus(s);
      if (q?.queue) setQueue(q.queue);
    });
  };
  useEffect(load, []);

  const connect = async () => {
    const res = await apiClient.get("/api/quickbooks/connect").catch(() => null);
    if (res?.authUrl) {
      window.open(res.authUrl, "_blank", "width=600,height=700");
    } else {
      setNotice(res?.error || "QuickBooks is not configured. Set QB_CLIENT_ID/QB_CLIENT_SECRET to enable OAuth.");
    }
  };

  const sync = async (entity) => {
    setBusy(entity); setNotice("");
    try {
      const data = await apiClient.post(`/api/quickbooks/sync/${entity}`, {});
      setNotice(`✅ ${entity}: queued ${data.queued}, pushed ${data.pushed}${data.connected ? "" : " (queued — connect QuickBooks to push)"}`);
      load();
    } catch (e) { setNotice(`❌ ${e.message}`); } finally { setBusy(""); }
  };

  const statusColor = { synced: "#4ade80", pending: "#fbbf24", failed: "#f87171", processing: "#38bdf8" };

  return (
    <div style={{ fontFamily: "monospace", color: "#e2e8f0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
      {/* Connection + sync */}
      <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", padding: "16px" }}>
        <div style={{ fontWeight: "900", color: "#f8fafc", marginBottom: "12px" }}>💼 QUICKBOOKS ONLINE</div>

        {/* Status */}
        <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", padding: "12px", marginBottom: "12px", fontSize: "11px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ color: "#94a3b8" }}>Connection</span>
            <span style={{ fontWeight: "bold", color: status?.connected ? "#4ade80" : "#f87171" }}>{status?.connected ? "● CONNECTED" : "○ NOT CONNECTED"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ color: "#94a3b8" }}>Environment</span><span style={{ color: "#e2e8f0" }}>{status?.environment || "sandbox"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#94a3b8" }}>Pending sync items</span><span style={{ color: "#fbbf24", fontWeight: "bold" }}>{status?.pendingSyncItems ?? 0}</span>
          </div>
        </div>

        <button onClick={connect} style={{ width: "100%", backgroundColor: "#2ca01c", color: "#fff", padding: "12px", fontWeight: "bold", border: "none", cursor: "pointer", marginBottom: "12px" }}>
          🔗 CONNECT TO QUICKBOOKS
        </button>

        <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "bold", marginBottom: "6px" }}>SYNC ENTITIES</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          {SYNC_ENTITIES.map((e) => (
            <button key={e.key} onClick={() => sync(e.key)} disabled={busy === e.key}
              style={{ backgroundColor: "#0f172a", border: "1px solid #334155", color: "#cbd5e1", padding: "10px", cursor: "pointer", fontSize: "11px", textAlign: "left", fontFamily: "monospace" }}>
              {busy === e.key ? "⏳" : e.icon} {e.label}
            </button>
          ))}
        </div>
        {notice && <div style={{ marginTop: "10px", fontSize: "11px", fontWeight: "bold", color: notice.startsWith("✅") ? "#4ade80" : "#fbbf24" }}>{notice}</div>}
      </div>

      {/* Sync queue */}
      <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", padding: "16px" }}>
        <div style={{ fontWeight: "900", color: "#f8fafc", marginBottom: "12px" }}>📤 SYNC QUEUE (reliable, retryable)</div>
        <div style={{ maxHeight: "380px", overflowY: "auto", fontSize: "11px" }}>
          {queue.length === 0 && <div style={{ color: "#64748b", textAlign: "center", padding: "24px" }}>Queue is empty. Sync an entity to begin.</div>}
          {queue.map((q) => (
            <div key={q.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px", borderBottom: "1px solid #334155" }}>
              <span style={{ color: "#cbd5e1" }}><b style={{ color: "#a78bfa" }}>{q.entity_type}</b> · {q.operation}</span>
              <span style={{ fontWeight: "bold", color: statusColor[q.status] || "#94a3b8", textTransform: "uppercase", fontSize: "10px" }}>{q.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FlAccounting;
