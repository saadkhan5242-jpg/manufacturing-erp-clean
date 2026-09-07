import FlLiveJobBoard from "../components/fl/FlLiveJobBoard";
import FlShopFloorTerminal from "../components/fl/FlShopFloorTerminal";
import FlEstimating from "../components/fl/FlEstimating";
import FlVendorManager from "../components/fl/FlVendorManager";
import FlAiIntelligence from "../components/fl/FlAiIntelligence";
import FlCadWorkspace from "../components/fl/FlCadWorkspace";
import FlCustomerStatus from "../components/fl/FlCustomerStatus";
import FlAccounting from "../components/fl/FlAccounting";

/* ============================================================
   FORGELOGIC AI — MODULE REGISTRY
   Maps each window/module key to its component + window defaults.
   ============================================================ */
export const MODULES = [
  { key: "JOBS", label: "Live Job Board", icon: "🏭", accent: "#38bdf8", title: "LIVE JOB BOARD — REAL-TIME FLOOR TRACKING", component: FlLiveJobBoard },
  { key: "SHOP_FLOOR", label: "Shop Floor", icon: "🖥️", accent: "#4ade80", title: "SHOP FLOOR — OPERATOR PUNCH TERMINAL", component: FlShopFloorTerminal },
  { key: "ESTIMATING", label: "Estimating & Quoting", icon: "💰", accent: "#4ade80", title: "ESTIMATING & QUOTING — AI-ASSISTED", component: FlEstimating },
  { key: "VENDORS", label: "Vendors & Outside", icon: "🤝", accent: "#f472b6", title: "VENDORS & OUTSIDE PROCESS MANAGEMENT", component: FlVendorManager },
  { key: "AI", label: "AI Intelligence", icon: "🧠", accent: "#a78bfa", title: "AI MANUFACTURING INTELLIGENCE", component: FlAiIntelligence },
  { key: "CAD", label: "CAD Workspace", icon: "📐", accent: "#fbbf24", title: "CAD FILE WORKSPACE", component: FlCadWorkspace },
  { key: "CUSTOMER", label: "Customer Status", icon: "📊", accent: "#60a5fa", title: "CUSTOMER-FACING JOB STATUS", component: FlCustomerStatus },
  { key: "ACCOUNTING", label: "Accounting", icon: "💼", accent: "#eab308", title: "ACCOUNTING / QUICKBOOKS", component: FlAccounting }
];

export function getModule(key) {
  return MODULES.find((m) => m.key === key);
}
