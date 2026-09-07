import { useState, useEffect } from "react";
import OrderEntryForm from "./components/OrderEntryForm";
import BomTreeExplorer from "./components/BomTreeExplorer";
import ShopTraveler from "./components/ShopTraveler";
import ShopFloorTerminal from "./components/ShopFloorTerminal";
import DailyShipmentTracker from "./components/DailyShipmentTracker";
import MaterialStockLedger from "./components/MaterialStockLedger";
import apiClient from "./lib/apiClient.js";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import { useAuth } from "./hooks/useAuth.jsx";
import "./Dashboard.css";

/* ============================================================
   FORGELOGIC AI — FULCRUM-STYLE MULTI-WINDOW CONSOLE
   Flat, minimalist, dark-charcoal tile environment. Class-based
   presentation layer; content density with crisp micro-borders.
   ============================================================ */

// Multi-environment origin adaptor — file:// (Electron exe) hits port 4000
// directly, http:// (Vite dev) uses the relative proxy path.

// Window definitions: visibility key -> { title, accent, component, roles }
// `roles` omitted = visible to every authenticated role (admin/operator/employee).
const WINDOW_DEFS = [
  { key: "showShopTerminal", label: "Shop Floor", title: "SHOP FLOOR DATA COLLECTION TERMINAL", accent: "#16a34a", component: ShopFloorTerminal },
  { key: "showMaterialLedger", label: "Material Ledger", title: "MATERIAL MASTER — STOCK BALANCES LEDGER", accent: "#0284c7", component: MaterialStockLedger, roles: ["admin", "operator"] },
  { key: "showShipmentTracker", label: "Shipments", title: "LOGISTICS — DAILY SHIPMENT DISPATCH MATRIX", accent: "#0ea5e9", component: DailyShipmentTracker, roles: ["admin", "operator"] },
  { key: "showShopTraveler", label: "Traveler", title: "PRODUCTION — SHOP TRAVELER DOCUMENT", accent: "#d97706", component: ShopTraveler, roles: ["admin", "operator"] },
  { key: "showBomExplorer", label: "BOM Assemblies", title: "BOM ASSEMBLIES — MULTI-LEVEL TREE EXPLORER", accent: "#6366f1", component: BomTreeExplorer, roles: ["admin", "operator"] },
  { key: "showOrderEntry", label: "Order Entry", title: "ORDER ENTRY — SALES INTAKE PANEL", accent: "#10b981", component: OrderEntryForm, roles: ["admin", "operator"] }
];

export default function Dashboard() {
  const { user, isAdmin, logout } = useAuth();
  // Multi-window visibility state — each window toggles independently
  const [windows, setWindows] = useState({
    showShopTerminal: true,
    showMaterialLedger: true,
    showShipmentTracker: true,
    showShopTraveler: false,
    showBomExplorer: false,
    showOrderEntry: false
  });
  const [showAdmin, setShowAdmin] = useState(false);

  const [varianceData, setVarianceData] = useState([]);
  const [varianceLoading, setVarianceLoading] = useState(true);

  // Autonomous cloud refresh polling — sync variance metrics every 10s
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      apiClient.get("/api/shopfloor/variance-analytics")
        .then((data) => {
          if (cancelled) return;
          setVarianceData(Array.isArray(data) ? data : data.variance_data || []);
          setVarianceLoading(false);
        })
        .catch(() => {
          if (!cancelled) setVarianceLoading(false);
        });
    };
    load();
    const timer = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const toggleWindow = (key) => setWindows((prev) => ({ ...prev, [key]: !prev[key] }));
  const closeWindow = (key) => setWindows((prev) => ({ ...prev, [key]: false }));

  const role = user?.role || "operator";
  const visibleWindowDefs = WINDOW_DEFS.filter((w) => !w.roles || w.roles.includes(role));
  const activeWindows = visibleWindowDefs.filter((w) => windows[w.key]);
  const activeCount = activeWindows.length;

  // Top KPI summary metrics derived from the live variance ledger
  const totalStdHours = varianceData.reduce((sum, r) => sum + Number(r.standardHours ?? r.estimatedHours ?? 0), 0);
  const totalActHours = varianceData.reduce((sum, r) => sum + Number(r.actualHours ?? 0), 0);
  const avgEfficiency = totalActHours > 0 ? Math.round((totalStdHours / totalActHours) * 100) : 0;

  const kpis = [
    { label: "Cloud Operations", value: varianceData.length },
    { label: "Standard Hours", value: totalStdHours.toFixed(2) },
    { label: "Actual Hours", value: totalActHours.toFixed(2) },
    { label: "Avg Efficiency", value: `${avgEfficiency}%` }
  ];

  return (
    <div className="erp-dashboard-container">
      {/* ===== APPLICATION HEADER TASKBAR ===== */}
      <header className="gss-header-console">
        <span className="gss-brand-mark">
          <span className="gss-brand-dot" />
          FORGELOGIC AI
        </span>
        <nav style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {visibleWindowDefs.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => toggleWindow(w.key)}
              className={windows[w.key] ? "nav-spawner-btn active" : "nav-spawner-btn"}
            >
              {w.label}
            </button>
          ))}
        </nav>
        <span className="gss-console-meta">{activeCount} window{activeCount === 1 ? "" : "s"} open</span>
        <span className="gss-console-meta">{user?.role || "operator"}</span>
        {isAdmin() && <button type="button" className="nav-spawner-btn" onClick={() => setShowAdmin((visible) => !visible)}>Admin</button>}
        <button type="button" className="nav-spawner-btn" onClick={logout}>Sign out</button>
      </header>

      {showAdmin && <AdminDashboard />}

      {/* ===== TOP KPI SUMMARY GRID ===== */}
      <section className="telemetry-metrics-grid">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="metric-card-cell">
            <span className="metric-card-label">{kpi.label}</span>
            <span className="metric-card-value">{kpi.value}</span>
          </div>
        ))}
      </section>

      {/* ===== CENTRAL MULTI-WINDOW MATRIX ===== */}
      <section className="transaction-window-matrix">
        {activeCount === 0 && (
          <div className="matrix-empty-state">
            All windows closed — toggle a module above to open a live panel.
          </div>
        )}

        {activeWindows.map((w) => {
          const Component = w.component;
          return (
            <div key={w.key} className="window-pane-card">
              <div className="window-pane-header" style={{ borderTop: `3px solid ${w.accent}` }}>
                <span>{w.title}</span>
                <button
                  type="button"
                  className="window-pane-close"
                  title="Close window"
                  onClick={() => closeWindow(w.key)}
                >
                  ×
                </button>
              </div>
              <div className="window-pane-body">
                <Component />
              </div>
            </div>
          );
        })}
      </section>

      {/* ===== BOTTOM SUMMARY ANALYTICS — live absorption ledger ===== */}
      {!varianceLoading && varianceData.length > 0 && (
        <section style={{ marginTop: "16px" }}>
          <div className="matrix-section-label">Factory Performance — Live Absorption Ledger</div>
          <table className="gss-data-table">
            <thead>
              <tr>
                <th>Work Center</th>
                <th>Part</th>
                <th style={{ textAlign: "right" }}>Std Hrs</th>
                <th style={{ textAlign: "right" }}>Act Hrs</th>
                <th style={{ textAlign: "right" }}>Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {varianceData.map((row, idx) => {
                const std = Number(row.standardHours ?? row.estimatedHours ?? 0);
                const act = Number(row.actualHours ?? 0);
                const eff = act > 0 ? Math.round((std / act) * 100) : 0;
                const effColor = eff >= 90 ? "#4ade80" : eff >= 75 ? "#fbbf24" : "#f87171";
                return (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700, color: "#38bdf8" }}>{row.workCenter || row.jobId || "—"}</td>
                    <td>{row.partNumber || "—"}</td>
                    <td style={{ textAlign: "right" }}>{std.toFixed(2)}</td>
                    <td style={{ textAlign: "right" }}>{act.toFixed(2)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: effColor }}>{eff}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
