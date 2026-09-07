import { useEffect, useState } from "react";
import { useWindowStore } from "../windowing/windowStore";
import OSWindow from "../windowing/OSWindow";
import Taskbar from "../windowing/Taskbar";
import { MODULES } from "../windowing/moduleRegistry";
import FlLiveJobBoard from "./fl/FlLiveJobBoard";
import apiClient from "../lib/apiClient.js";


/* ============================================================
   FORGELOGIC AI — MANUFACTURING OS (windowed desktop)
   Fulcrum-style multi-window workspace: draggable, resizable
   windows over a live dashboard, with a taskbar and module dock.
   ============================================================ */
function ForgeLogicOS({ onLogout }) {
  const { windows, openWindow } = useWindowStore();
  const [health, setHealth] = useState(null);
  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem("erp_user") || "{}"); } catch { return {}; }
  });

  // Backend health probe (poll) — surfaces outages instead of "Failed to fetch"
  useEffect(() => {
    let cancelled = false;
    const probe = () => apiClient.get("/api/health").then((d) => { if (!cancelled) setHealth(d); }).catch(() => { if (!cancelled) setHealth(null); });
    probe();
    const t = setInterval(probe, 10000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const connected = health?.status === "healthy";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#0b1220", color: "#e2e8f0", fontFamily: "monospace", overflow: "hidden" }}>
      {/* Top OS bar */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", backgroundColor: "#0f172a", borderBottom: "1px solid #1e293b", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: 30, height: 30, backgroundColor: "#f97316", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", color: "#0b1220", fontSize: "14px" }}>FL</div>
          <div>
            <div style={{ fontWeight: "900", fontSize: "14px", color: "#f8fafc" }}>ForgeLogic <span style={{ color: "#f97316" }}>AI</span> <span style={{ color: "#64748b", fontWeight: 400, fontSize: "10px" }}>— Manufacturing OS</span></div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "10px", color: "#94a3b8" }}>
          <span title={health ? `DB ${health.database.status} · ${health.database.latencyMs}ms` : "probing"}>
            {connected ? "🟢 Connected" : "🔴 Backend offline"}
          </span>
          <span>{user.name || "Operator"}</span>
          {onLogout && <button onClick={onLogout} style={{ background: "none", border: "1px solid #334155", color: "#94a3b8", padding: "3px 10px", cursor: "pointer", fontSize: "10px", fontFamily: "monospace" }}>Sign out</button>}
        </div>
      </header>

      {/* Module dock */}
      <nav style={{ display: "flex", gap: "6px", padding: "10px 14px", backgroundColor: "#0d1526", borderBottom: "1px solid #1e293b", flexWrap: "wrap", flexShrink: 0 }}>
        {MODULES.map((m) => (
          <button
            key={m.key}
            onClick={() => openWindow(m.key, m.title, m.accent)}
            style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#0f172a", border: `1px solid #1e293b`, borderLeft: `3px solid ${m.accent}`, color: "#cbd5e1", padding: "8px 12px", cursor: "pointer", fontSize: "11px", fontWeight: "bold", fontFamily: "monospace" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = m.accent)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e293b")}
          >
            <span>{m.icon}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </nav>

      {/* Desktop area: live dashboard backdrop + floating windows */}
      <main style={{ position: "relative", flex: 1, overflow: "hidden", backgroundColor: "#0b1220" }}>
        {/* Backdrop dashboard (always visible behind windows) */}
        <div style={{ position: "absolute", inset: 0, overflow: "auto", padding: "16px" }}>
          <div style={{ fontSize: "11px", color: "#475569", fontWeight: "bold", marginBottom: "10px" }}>
            DESKTOP · LIVE FLOOR (open modules float above — drag, resize, minimize)
          </div>
          <FlLiveJobBoard />
        </div>

        {/* Floating module windows */}
        {windows.map((w) => {
          const mod = MODULES.find((m) => m.key === w.module);
          const Component = mod?.component;
          return (
            <OSWindow key={w.id} window={w}>
              {Component ? <Component /> : <div style={{ color: "#64748b" }}>Unknown module</div>}
            </OSWindow>
          );
        })}
      </main>

      {/* Taskbar */}
      <Taskbar modules={MODULES} />
    </div>
  );
}

export default ForgeLogicOS;
