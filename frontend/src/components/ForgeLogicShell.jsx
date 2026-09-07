import { useState } from "react";
import FlLiveJobBoard from "./fl/FlLiveJobBoard";
import FlEstimating from "./fl/FlEstimating";
import FlVendorManager from "./fl/FlVendorManager";
import FlAiIntelligence from "./fl/FlAiIntelligence";
import FlCadWorkspace from "./fl/FlCadWorkspace";
import FlShopFloorTerminal from "./fl/FlShopFloorTerminal";
import FlCustomerStatus from "./fl/FlCustomerStatus";

/* ============================================================
   FORGELOGIC AI — MODERN WINDOW-BASED SHELL (Fulcrum-style)
   Clean, fast, AI-assisted, dashboard-driven. Window panes open
   over the live command dashboard.
   ============================================================ */

const MODULES = [
  { key: "JOBS", label: "Live Job Board", icon: "🏭", desc: "Real-time floor tracking", accent: "#38bdf8" },
  { key: "SHOP_FLOOR", label: "Shop Floor", icon: "🖥️", desc: "Operator punch terminal", accent: "#4ade80" },
  { key: "ESTIMATING", label: "Estimating & Quoting", icon: "💰", desc: "AI quote builder", accent: "#4ade80" },
  { key: "VENDORS", label: "Vendors & Outside", icon: "🤝", desc: "POs, lead times, performance", accent: "#f472b6" },
  { key: "AI", label: "AI Intelligence", icon: "🧠", desc: "Lateness, capacity, routing", accent: "#a78bfa" },
  { key: "CAD", label: "CAD Workspace", icon: "📐", desc: "Upload, features, cycle time", accent: "#fbbf24" },
  { key: "CUSTOMER", label: "Customer Status", icon: "📊", desc: "Shareable job reports", accent: "#60a5fa" }
];

const WINDOW_TITLES = {
  JOBS: "LIVE JOB BOARD — REAL-TIME FLOOR TRACKING",
  SHOP_FLOOR: "SHOP FLOOR — OPERATOR PUNCH TERMINAL",
  ESTIMATING: "ESTIMATING & QUOTING — AI-ASSISTED",
  VENDORS: "VENDORS & OUTSIDE PROCESS MANAGEMENT",
  AI: "AI MANUFACTURING INTELLIGENCE",
  CAD: "CAD FILE WORKSPACE",
  CUSTOMER: "CUSTOMER-FACING JOB STATUS REPORT"
};

function ForgeLogicShell({ onLogout }) {
  const [openWindow, setOpenWindow] = useState(null);
  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem("erp_user") || "{}"); } catch { return {}; }
  });

  const renderWindow = () => {
    switch (openWindow) {
      case "JOBS": return <FlLiveJobBoard />;
      case "SHOP_FLOOR": return <FlShopFloorTerminal />;
      case "ESTIMATING": return <FlEstimating />;
      case "VENDORS": return <FlVendorManager />;
      case "AI": return <FlAiIntelligence />;
      case "CAD": return <FlCadWorkspace />;
      case "CUSTOMER": return <FlCustomerStatus />;
      default: return null;
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0b1220", color: "#e2e8f0", fontFamily: "monospace", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", backgroundColor: "#0f172a", borderBottom: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: 34, height: 34, backgroundColor: "#f97316", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", color: "#0b1220", fontSize: "16px" }}>FL</div>
          <div>
            <div style={{ fontWeight: "900", fontSize: "15px", color: "#f8fafc", letterSpacing: "0.02em" }}>ForgeLogic <span style={{ color: "#f97316" }}>AI</span></div>
            <div style={{ fontSize: "10px", color: "#64748b" }}>Machine Shop ERP · CNC Lathe / Mill / Live Tooling</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "11px", color: "#94a3b8" }}>
          <span>🟢 Connected</span>
          <span>{user.name || "Operator"}</span>
          {onLogout && <button onClick={onLogout} style={{ background: "none", border: "1px solid #334155", color: "#94a3b8", padding: "4px 10px", cursor: "pointer", fontSize: "10px" }}>Sign out</button>}
        </div>
      </header>

      {/* Module launcher */}
      <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
        {MODULES.map((m) => (
          <button
            key={m.key}
            onClick={() => setOpenWindow(m.key)}
            style={{ textAlign: "left", backgroundColor: openWindow === m.key ? "#1e293b" : "#0f172a", border: `1px solid ${openWindow === m.key ? m.accent : "#1e293b"}`, borderLeft: `4px solid ${m.accent}`, padding: "14px", cursor: "pointer", color: "#e2e8f0", transition: "border-color 0.15s" }}
          >
            <div style={{ fontSize: "22px", marginBottom: "6px" }}>{m.icon}</div>
            <div style={{ fontWeight: "900", fontSize: "12px" }}>{m.label}</div>
            <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Content area */}
      <main style={{ flex: 1, padding: "0 16px 16px", overflowY: "auto" }}>
        {openWindow === null ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <FlLiveJobBoard />
          </div>
        ) : (
          <div style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", boxShadow: "0 20px 50px rgba(0,0,0,0.4)" }}>
            {/* Window title bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", backgroundColor: "#1e293b", borderBottom: "1px solid #334155" }}>
              <span style={{ fontSize: "11px", fontWeight: "900", color: "#cbd5e1", letterSpacing: "0.05em" }}>{WINDOW_TITLES[openWindow]}</span>
              <button onClick={() => setOpenWindow(null)} style={{ background: "#ef4444", color: "#fff", border: "none", padding: "2px 10px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>✕</button>
            </div>
            <div style={{ padding: "16px" }}>{renderWindow()}</div>
          </div>
        )}
      </main>

      {/* Status footer */}
      <footer style={{ padding: "6px 16px", backgroundColor: "#0f172a", borderTop: "1px solid #1e293b", fontSize: "10px", color: "#64748b", display: "flex", justifyContent: "space-between" }}>
        <span>ForgeLogic AI · Machine Job Shop</span>
        <span>{openWindow ? `WINDOW: ${openWindow}` : "DASHBOARD"} · {new Date().toLocaleTimeString()}</span>
      </footer>
    </div>
  );
}

export default ForgeLogicShell;
