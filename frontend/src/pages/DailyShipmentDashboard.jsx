import { useState, useEffect, useCallback } from "react";
import apiClient from "../lib/apiClient.js";

const POLL_MS = 5000;

const BOARD_STYLES = {
  "On-Time": { chip: "bg-emerald-100 text-emerald-700 border-emerald-300", icon: "✅", label: "On-Time" },
  "Delayed": { chip: "bg-amber-100 text-amber-800 border-amber-300", icon: "⚠️", label: "Delayed" },
  "Past Due": { chip: "bg-red-100 text-red-700 border-red-300", icon: "🚨", label: "Critical / Past Due" },
  "Scheduled": { chip: "bg-sky-100 text-sky-700 border-sky-300", icon: "🕒", label: "Scheduled" }
};

/**
 * DailyShipmentDashboard — Order Entry analytical interface.
 * Top summary strip (Scheduled / Dispatched / Past Due) above a
 * color-coded board of today's shipments and the historical backlog.
 */
function DailyShipmentDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [polledAt, setPolledAt] = useState(null);
  const [error, setError] = useState("");

  const fetchShipments = useCallback(async () => {
    try {
      const data = await apiClient.get("/api/dashboard/daily-shipments");
      setMetrics(data.metrics);
      setShipments(data.shipments || []);
      setPolledAt(data.polledAt);
      setError("");
    } catch (err) {
      setError(`Shipment stream interrupted: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    fetchShipments();
    const timer = setInterval(fetchShipments, POLL_MS);
    return () => clearInterval(timer);
  }, [fetchShipments]);

  const shippingToday = shipments.filter((s) => s.trackingStatus !== "Past Due");
  const backlog = shipments.filter((s) => s.trackingStatus === "Past Due");

  const strip = metrics ? [
    { label: "SCHEDULED TODAY", value: metrics.totalScheduledToday, tone: "border-sky-500 text-sky-700" },
    { label: "DISPATCHED TODAY", value: metrics.totalShippedToday, tone: "border-emerald-500 text-emerald-700" },
    { label: "UNITS SHIPPED", value: metrics.unitsShippedToday, tone: "border-emerald-500 text-emerald-700" },
    { label: "PAST DUE (BACKLOG)", value: metrics.pastDue, tone: "border-red-500 text-red-700" }
  ] : [];

  const boardRow = (s) => {
    const style = BOARD_STYLES[s.trackingStatus] || BOARD_STYLES.Scheduled;
    return (
      <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
        <td className="px-4 py-3">
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${style.chip}`}>
            {style.icon} {style.label}
          </span>
        </td>
        <td className="px-4 py-3 font-semibold text-slate-800">{s.customerId}</td>
        <td className="px-4 py-3 text-slate-600">{s.salesOrderNumber || "—"}</td>
        <td className="px-4 py-3 text-slate-600">{s.orderNumber}</td>
        <td className="px-4 py-3 text-slate-600">{s.partNumber}</td>
        <td className="px-4 py-3 text-slate-600">{s.carrier}</td>
        <td className="px-4 py-3 text-slate-600">{s.targetShipDate ? new Date(s.targetShipDate).toLocaleDateString() : "—"}</td>
        <td className="px-4 py-3 text-slate-600">{s.actualShipDate ? new Date(s.actualShipDate).toLocaleDateString() : "—"}</td>
        <td className="px-4 py-3 font-semibold text-slate-800">{s.quantityShipped}</td>
      </tr>
    );
  };

  const boardTable = (items, emptyMsg) => (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-slate-50 text-left text-slate-500">
          {["Status", "Customer", "Sales Order", "Work Order", "Part #", "Carrier", "Target", "Shipped", "Qty"].map((h) => (
            <th key={h} className="px-4 py-3 border-b-2 border-slate-200">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.length === 0 && (
          <tr><td colSpan="9" className="px-4 py-6 text-center text-slate-400">{emptyMsg}</td></tr>
        )}
        {items.map(boardRow)}
      </tbody>
    </table>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans">
      <header className="border-b-4 border-sky-600 pb-4 mb-6 flex items-end justify-between">
        <div>
          <h2 className="m-0 text-2xl font-bold text-sky-700">🚚 Order Entry — Daily Shipment Dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">
            Scheduled vs dispatched vs past-due — target_ship_date compared against actual_ship_date.
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 bg-sky-500 animate-pulse" />
          {polledAt ? `Live · ${new Date(polledAt).toLocaleTimeString()}` : "Connecting…"} · refresh {POLL_MS / 1000}s
        </div>
      </header>

      {error && <div className="px-4 py-3 rounded-md mb-4 font-semibold text-white bg-red-600">{error}</div>}

      {/* Top summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {strip.map((k) => (
          <div key={k.label} className={`bg-white border border-slate-200 border-t-4 rounded-lg p-4 ${k.tone}`}>
            <div className="text-[11px] tracking-wide text-slate-400">{k.label}</div>
            <div className="text-3xl font-bold mt-1">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Shipping today (amber warnings for unshipped) */}
      <section className="bg-white border border-amber-200 rounded-lg shadow-sm overflow-hidden mb-6">
        <h3 className="m-0 px-4 py-3 bg-amber-50 text-amber-800 text-sm font-bold">📦 Shipping Today</h3>
        {boardTable(shippingToday, "Nothing scheduled to ship today.")}
      </section>

      {/* Historical backlog (red alerts) */}
      <section className="bg-white border border-red-200 rounded-lg shadow-sm overflow-hidden">
        <h3 className="m-0 px-4 py-3 bg-red-50 text-red-700 text-sm font-bold">🚨 Backlog — Past Due</h3>
        {boardTable(backlog, "No past-due backlog. All shipments are current.")}
      </section>
    </div>
  );
}

export default DailyShipmentDashboard;
