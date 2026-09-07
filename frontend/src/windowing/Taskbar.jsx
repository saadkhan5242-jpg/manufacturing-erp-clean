import { useWindowStore } from "./windowStore";

/* ============================================================
   FORGELOGIC AI — TASKBAR
   Lists open + minimized windows; click to focus/restore.
   ============================================================ */
function Taskbar({ modules }) {
  const { windows, activeId, focusWindow } = useWindowStore();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", backgroundColor: "#0a0f1a", borderTop: "1px solid #1e293b", fontFamily: "monospace" }}>
      <span style={{ fontSize: "10px", color: "#f97316", fontWeight: "900", marginRight: "8px" }}>⬢ FORGELOGIC</span>
      {windows.length === 0 && <span style={{ fontSize: "10px", color: "#475569" }}>No windows open — launch a module above</span>}
      {windows.map((w) => {
        const mod = modules.find((m) => m.key === w.module);
        return (
          <button
            key={w.id}
            onClick={() => focusWindow(w.id)}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "5px 12px", fontSize: "11px", fontFamily: "monospace", fontWeight: activeId === w.id ? "900" : "600",
              backgroundColor: activeId === w.id ? "#1e293b" : "transparent",
              color: w.minimized ? "#64748b" : "#cbd5e1",
              border: `1px solid ${activeId === w.id ? w.accent : "#1e293b"}`,
              borderLeft: `3px solid ${w.accent}`,
              cursor: "pointer"
            }}
          >
            <span>{mod?.icon}</span>
            <span>{mod?.label || w.module}</span>
            {w.minimized && <span style={{ fontSize: "9px", color: "#475569" }}>(min)</span>}
          </button>
        );
      })}
    </div>
  );
}

export default Taskbar;
