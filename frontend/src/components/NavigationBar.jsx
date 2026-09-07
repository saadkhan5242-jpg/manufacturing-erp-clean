import { NavLink, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Search, Sparkles } from "lucide-react";
import { commandModules } from "./moduleCatalog";
import "./NavigationBar.css";

function NavigationBar({ onLogout, activeModule, onModuleSelect }) {
  const navigate = useNavigate();

  // Toolbar module tabs drive the shared workspace state machine directly.
  const handleModuleClick = (token) => {
    if (typeof onModuleSelect === "function") onModuleSelect(token);
    navigate("/"); // Ensure the dashboard workspace is in view
  };

  return <>
    <header className="erp-command-bar">
      <NavLink className="erp-brand" to="/" onClick={() => typeof onModuleSelect === "function" && onModuleSelect(null)}>
        <span className="erp-brand-symbol">GS</span>
        <span><strong>Global Shop</strong><small>Manufacturing Solutions</small></span>
      </NavLink>
      <nav className="command-modules" aria-label="ERP modules">
        {commandModules.map(({ label, token, icon: Icon, tone }) => (
          <button
            type="button"
            className={`command-module module-${tone} ${activeModule === token ? "active" : ""}`}
            key={token}
            onClick={() => handleModuleClick(token)}
          >
            <Icon size={23} strokeWidth={1.8} />
            <span>
              {label.split("\n").map((line) => <span key={line}>{line}</span>)}
            </span>
            <ChevronDown className="module-caret" size={12} />
          </button>
        ))}
      </nav>
      <div className="command-actions">
        <button aria-label="Search" title="Search" type="button"><Search size={18} /></button>
        <button aria-label="AI assistant" title="AI assistant" type="button"><Sparkles size={18} /></button>
        <button aria-label="Sign out" title="Sign out" onClick={onLogout} type="button"><LogOut size={17} /></button>
      </div>
    </header>
    <div className="erp-status-bar">
      <span className="status-caption">Supervisor&apos;s Status</span>
      <span className="availability"><span className="status-dot" /> Available <ChevronDown size={12} /></span>
      <span className="status-spacer" />
      <NavLink to="/job-clock">Queue Items: 0/0</NavLink>
      <NavLink to="/ai">Messages: 0/0</NavLink>
      <NavLink to="/reports">Events: 0/0</NavLink>
      <span>Processes Running: 0</span>
      <label className="status-search">Search <input aria-label="Search workspace" /><Search size={14} /></label>
    </div>
    <div className="erp-workspace-tabs">
      <span className="workspace-tab active">Main Workspace <button aria-label="Close workspace" type="button">×</button></span>
      <button className="new-tab" aria-label="New workspace" type="button">+</button>
    </div>
  </>;
}

export default NavigationBar;
