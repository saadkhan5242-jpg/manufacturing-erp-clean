import { create } from "zustand";

/* ============================================================
   FORGELOGIC AI — WINDOW MANAGER STATE (Zustand)
   Multi-window OS-style workspace: open, focus, move, resize,
   minimize, close. Each window hosts a module component.
   ============================================================ */

let zCounter = 10;

export const useWindowStore = create((set) => ({
  windows: [], // { id, module, title, x, y, width, height, z, minimized }
  activeId: null,

  openWindow: (module, title, accent) =>
    set((state) => {
      // Focus if already open
      const existing = state.windows.find((w) => w.module === module);
      if (existing) {
        return {
          windows: state.windows.map((w) => (w.module === module ? { ...w, minimized: false, z: ++zCounter } : w)),
          activeId: existing.id
        };
      }
      const id = `win-${Date.now()}-${Math.round(Math.random() * 1000)}`;
      const offset = state.windows.length * 28;
      const win = {
        id,
        module,
        title,
        accent: accent || "#38bdf8",
        x: 120 + offset,
        y: 80 + offset,
        width: 900,
        height: 560,
        z: ++zCounter,
        minimized: false
      };
      return { windows: [...state.windows, win], activeId: id };
    }),

  closeWindow: (id) => set((state) => ({
    windows: state.windows.filter((w) => w.id !== id),
    activeId: state.activeId === id ? null : state.activeId
  })),

  focusWindow: (id) => set((state) => ({
    windows: state.windows.map((w) => (w.id === id ? { ...w, z: ++zCounter, minimized: false } : w)),
    activeId: id
  })),

  minimizeWindow: (id) => set((state) => ({
    windows: state.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w)),
    activeId: state.activeId === id ? null : state.activeId
  })),

  moveWindow: (id, x, y) => set((state) => ({
    windows: state.windows.map((w) => (w.id === id ? { ...w, x, y } : w))
  })),

  resizeWindow: (id, width, height, x, y) => set((state) => ({
    windows: state.windows.map((w) => (w.id === id ? { ...w, width, height, x, y } : w))
  }))
}));
