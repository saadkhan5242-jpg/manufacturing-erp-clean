import { useEffect, useState } from "react";
import { BarChart3, ClipboardCheck, Factory, ShoppingCart, Wrench } from "lucide-react";
import apiClient from "../lib/apiClient.js";
import "./OperationsPage.css";

function ReportsPage() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { apiClient.get("/api/reports/overview").then(setReport).catch((loadError) => setError(loadError.message)); }, []);

  if (error) return <main className="operations-page"><p className="operation-alert" role="alert">{error}</p></main>;
  if (!report) return <main className="operations-page"><p className="operation-empty">Preparing ERP report...</p></main>;

  return <main className="operations-page"><header className="operations-page-header"><div><p className="eyebrow">Analytics / Management</p><h1>ERP reports</h1><p>Operational signals across master data, purchasing, maintenance, and capacity.</p></div><span className="period-label">Updated {new Date(report.generatedAt).toLocaleTimeString()}</span></header><div className="report-grid"><ReportCard icon={Factory} label="Master data" value={report.masterData.products} detail="Products" /><ReportCard icon={ShoppingCart} label="Open purchasing value" value={`$${report.purchasing.openValue.toFixed(2)}`} detail={`${report.purchasing.orderCount} purchase orders`} /><ReportCard icon={Wrench} label="Maintenance due" value={report.maintenance.scheduled} detail={`${report.maintenance.urgent} high priority`} /><ReportCard icon={ClipboardCheck} label="Work centers" value={report.masterData.workCenters} detail="Configured resources" /></div><section className="operation-table"><div className="table-heading"><h2><BarChart3 size={18} /> Capacity register</h2><span>Daily available hours</span></div><table><thead><tr><th>Work center</th><th>Capacity</th><th>Planning status</th></tr></thead><tbody>{report.capacity.workCenters.map((workCenter) => <tr key={workCenter.id}><td><strong>{workCenter.name}</strong></td><td>{workCenter.dailyCapacityHours} hrs</td><td><span className="erp-badge erp-badge-success">Available</span></td></tr>)}</tbody></table></section></main>;
}

function ReportCard({ icon: Icon, label, value, detail }) { return <article className="report-card"><Icon color="var(--teal)" size={19} /><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }

export default ReportsPage;
