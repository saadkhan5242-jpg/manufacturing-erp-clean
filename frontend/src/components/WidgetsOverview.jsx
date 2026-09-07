import { useState, useEffect } from "react";
import apiClient from "../lib/apiClient.js";

/**
 * WidgetsOverview — the GSS "Widgets" home tile grid. Live KPI cards
 * aggregating every module's headline metric into one command view.
 */
function WidgetsOverview() {
  const [data, setData] = useState({ jobs: 0, shipments: null, wip: null, inventory: 0, variance: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiClient.get("/api/dashboard/live-jobs").catch(() => null),
      apiClient.get("/api/dashboard/daily-shipments").catch(() => null),
      apiClient.get("/api/bi/wip-valuation").catch(() => null),
      apiClient.get("/api/inventory/stock-ledger").catch(() => null),
      apiClient.get("/api/shopfloor/variance-analytics").catch(() => null)
    ]).then(([jobs, shipments, wip, inventory, variance]) => {
      if (cancelled) return;
      setData({
        jobs: jobs?.jobs?.length ?? 0,
        shipments: shipments?.metrics ?? null,
        wip: wip?.totals ?? null,
        inventory: Array.isArray(inventory) ? inventory.length : 0,
        variance: (variance?.variance_data?.length ?? (Array.isArray(variance) ? variance.length : 0))
      });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const tiles = [
    { label: "ACTIVE WORK ORDERS", value: data.jobs, accent: "#2176ff", icon: "🏭" },
    { label: "SLATED TO SHIP TODAY", value: data.shipments?.slatedToday ?? 0, accent: "#0284c7", icon: "🚚" },
    { label: "PAST DUE BACKLOG", value: data.shipments?.pastDueBacklog ?? 0, accent: "#dc2626", icon: "🚨" },
    { label: "TOTAL WIP VALUE", value: `$${Number(data.wip?.totalWip || 0).toFixed(2)}`, accent: "#16a34a", icon: "💰" },
    { label: "STOCK ITEMS TRACKED", value: data.inventory, accent: "#9333ea", icon: "📦" },
    { label: "WORK CENTERS ACTIVE", value: data.variance, accent: "#eab308", icon: "⚙️" }
  ];

  return (
    <div style={{ fontFamily: "monospace", color: "#000" }}>
      <div style={{ backgroundColor: "#f59e0b", color: "#000", padding: "8px 12px", fontWeight: "bold", fontSize: "13px", marginBottom: "16px", border: "1px solid #d97706", textTransform: "uppercase" }}>
        🧩 WIDGETS — OPERATIONS COMMAND OVERVIEW
      </div>
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontWeight: "bold" }}>Aggregating live module telemetry…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
          {tiles.map((t) => (
            <div key={t.label} style={{ backgroundColor: "#fff", border: "2px solid #cbd5e1", borderLeft: `6px solid ${t.accent}`, padding: "16px" }}>
              <div style={{ fontSize: "22px", marginBottom: "6px" }}>{t.icon}</div>
              <div style={{ fontSize: "28px", fontWeight: "900", color: t.accent }}>{t.value}</div>
              <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "bold", letterSpacing: "0.05em", marginTop: "4px" }}>{t.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default WidgetsOverview;
