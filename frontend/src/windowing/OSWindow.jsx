import { Rnd } from "react-rnd";
import { useWindowStore } from "./windowStore";

/* ============================================================
   FORGELOGIC AI — OS WINDOW FRAME
   A draggable, resizable window hosting a module. Title bar with
   minimize/close, accent focus highlight, drag from the title bar.
   ============================================================ */
function OSWindow({ window: win, children }) {
  const { focusWindow, closeWindow, minimizeWindow, moveWindow, resizeWindow, activeId } = useWindowStore();
  const isActive = activeId === win.id;

  if (win.minimized) return null;

  return (
    <Rnd
      position={{ x: win.x, y: win.y }}
      size={{ width: win.width, height: win.height }}
      minWidth={420}
      minHeight={300}
      bounds="parent"
      dragHandleClassName="os-window-titlebar"
      style={{ zIndex: win.z }}
      onDragStart={() => focusWindow(win.id)}
      onDragStop={(e, d) => moveWindow(win.id, d.x, d.y)}
      onResizeStop={(e, dir, ref, delta, pos) => resizeWindow(win.id, ref.offsetWidth, ref.offsetHeight, pos.x, pos.y)}
    >
      <div
        onMouseDown={() => focusWindow(win.id)}
        style={{
          display: "flex", flexDirection: "column", height: "100%",
          backgroundColor: "#0f172a",
          border: `1px solid ${isActive ? win.accent : "#334155"}`,
          boxShadow: isActive ? `0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px ${win.accent}33` : "0 12px 32px rgba(0,0,0,0.4)",
          overflow: "hidden"
        }}
      >
        {/* Title bar */}
        <div className="os-window-titlebar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", backgroundColor: isActive ? "#1e293b" : "#16202e", borderBottom: `1px solid ${isActive ? win.accent : "#334155"}`, cursor: "move", userSelect: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: win.accent }} />
            <span style={{ fontSize: "11px", fontWeight: "900", color: "#e2e8f0", fontFamily: "monospace", letterSpacing: "0.04em" }}>{win.title}</span>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button onClick={(e) => { e.stopPropagation(); minimizeWindow(win.id); }} title="Minimize" style={{ width: 22, height: 22, border: "none", background: "#334155", color: "#cbd5e1", cursor: "pointer", fontSize: "12px", lineHeight: 1 }}>–</button>
            <button onClick={(e) => { e.stopPropagation(); closeWindow(win.id); }} title="Close" style={{ width: 22, height: 22, border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontSize: "12px", lineHeight: 1 }}>✕</button>
          </div>
        </div>
        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "14px" }}>{children}</div>
      </div>
    </Rnd>
  );
}

export default OSWindow;
