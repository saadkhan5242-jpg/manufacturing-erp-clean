import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { MODULE_TOKENS } from "../components/moduleCatalog";
import InventoryLevelsPage from "./InventoryLevelsPage";
import ShopFloorTerminal from "./ShopFloorTerminal";
import OrderEntryForm from "../components/OrderEntryForm";
import BomTreeExplorer from "../components/BomTreeExplorer";
import ShopTraveler from "../components/ShopTraveler";

// 'Feature Under Active Release' placeholder grid for modules not yet deployed
function ModulePlaceholder({ title, tone }) {
  const toneColor = { red: "#e53e3e", "light-green": "#68d391", yellow: "#d69e2e", magenta: "#d53f8c" }[tone] || "#3182ce";
  return (
    <div style={{ padding: "24px", fontFamily: "Segoe UI, sans-serif" }}>
      <h2 style={{ color: "#1a202c", marginTop: 0 }}>{title}</h2>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderTop: `4px solid ${toneColor}`, borderRadius: "8px", padding: "24px", marginTop: "16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
          {["Overview", "Transactions", "Reports", "Configuration"].map((panel) => (
            <div key={panel} style={{ background: "#f7fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "18px", minHeight: "90px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#2d3748" }}>{panel}</div>
              <div style={{ fontSize: "11px", color: "#a0aec0", marginTop: "6px" }}>Panel scaffold</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "20px", background: "#fffbeb", border: "1px solid #fbd38d", borderLeft: "4px solid #d69e2e", borderRadius: "6px", padding: "14px 16px", color: "#744210", fontWeight: 600, fontSize: "13px" }}>
          ⚠️ Feature Under Active Release — this {title} module is being finalized and will be enabled in an upcoming build.
        </div>
      </div>
    </div>
  );
}

function ModulePage() {
  const { moduleKey } = useParams();

  // TRACK 1: top-toolbar state machine. The selected tab's token drives the
  // central workspace wrapper. Defaults to PRODUCTION when unmapped.
  const [activeModule, setActiveModule] = useState("PRODUCTION");

  useEffect(() => {
    if (moduleKey && MODULE_TOKENS[moduleKey]) {
      setActiveModule(MODULE_TOKENS[moduleKey]);
    }
  }, [moduleKey]);

  // Central conditional workspace wrapper — swaps the central view space to the
  // active module's interactive panel(s).
  const renderActiveWorkspace = () => {
    switch (activeModule) {
      case "SHOP_FLOOR":
        return <ShopFloorTerminal />;
      case "PRODUCTION":
        return <div style={{ padding: "24px" }}><ShopTraveler /></div>;
      case "BOM_SETUP":
        return <div style={{ padding: "24px" }}><BomTreeExplorer rootPart="BRACKET-ASSY" /></div>;
      case "CUSTOMERS":
        return <div style={{ padding: "24px" }}><OrderEntryForm /></div>;
      case "WIDGETS":
        return <WidgetsMenu />;
      case "INVENTORY":
        return <div style={{ padding: "24px" }}><InventoryLevelsPage /></div>;
      case "ADMIN":
        return <ModulePlaceholder title="Admin & Control" tone="red" />;
      case "VENDORS":
        return <ModulePlaceholder title="Vendors" tone="light-green" />;
      case "ACCOUNTING":
        return <ModulePlaceholder title="Accounting" tone="yellow" />;
      case "AI_TOOLS":
        return <ModulePlaceholder title="AI Tools" tone="magenta" />;
      default:
        return <WidgetsMenu />;
    }
  };

  return (
    <div style={{ minHeight: "80vh", backgroundColor: "#f4f6f9" }}>
      {/* Active module indicator bar */}
      <div style={{ padding: "10px 24px", background: "#1a202c", color: "#fff", fontSize: "12px", fontWeight: 700, letterSpacing: "0.05em", display: "flex", justifyContent: "space-between" }}>
        <span>ACTIVE MODULE: <span style={{ color: "#63b3ed" }}>{activeModule.replace(/_/g, " ")}</span></span>
        <span style={{ color: "#a0aec0", fontWeight: 400 }}>GSS Workspace State Controller</span>
      </div>
      {renderActiveWorkspace()}
    </div>
  );
}

// Standard multi-column operations dashboard menu (WIDGETS default view)
function WidgetsMenu() {
  const panels = [
    { title: "Production Control", items: ["Work Orders", "Live Job Dashboard", "Scheduling Board"] },
    { title: "Inventory Management", items: ["Multi Level BOM", "Stock Records", "Live Levels"] },
    { title: "Order Entry & Sales", items: ["Sales Orders", "Order Entry Intake", "Daily Shipments"] },
    { title: "Financial Ledger", items: ["WIP Valuation", "AP Ledger", "GL Reports"] }
  ];
  return (
    <div style={{ padding: "24px", fontFamily: "Segoe UI, sans-serif" }}>
      <h2 style={{ color: "#1a202c", marginTop: 0 }}>Operations Command Center</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px", marginTop: "16px" }}>
        {panels.map((panel) => (
          <div key={panel.title} style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", borderTop: "6px solid #3182ce", padding: "20px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 14px 0", color: "#2d3748" }}>{panel.title}</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {panel.items.map((item) => (
                <li key={item} style={{ marginBottom: "8px", background: "#f8fafc", padding: "10px 14px", borderRadius: "6px", fontSize: "13px", color: "#4a5568", fontWeight: 600 }}>
                  ⚙️ {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ModulePage;
