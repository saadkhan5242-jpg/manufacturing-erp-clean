import { useState, useEffect, useCallback } from "react";
import apiClient from "../lib/apiClient.js";

const POLL_MS = 5000;

const FLAG_STYLES = {
  ON_TRACK: "bg-emerald-100 text-emerald-700",
  BEHIND: "bg-amber-100 text-amber-800",
  OVER_BUDGET: "bg-red-100 text-red-700"
};

/**
 * LiveOperationsDashboard — BI-column widget. Tracks active shop floor
 * operations with actual-vs-standard hours per routing sequence, plus a
 * GL WIP valuation strip (Material / Labor / Overhead) from the WipLedger.
 */
function LiveOperationsDashboard() {
  const [jobs, setJobs] = useState([]);
  const [wip, setWip] = useState(null);
  const [polledAt, setPolledAt] = useState(null);
  const [error, setError] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const [jobsData, wipData] = await Promise.all([
        apiClient.get("/api/dashboard/live-jobs"),
        apiClient.get("/api/bi/wip-valuation")
      ]);
      setJobs(jobsData.jobs || []);
      setWip(wipData.totals || null);
      setPolledAt(jobsData.polledAt);
      setError("");
    } catch (err) {
      setError(`Live operations stream interrupted: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(timer);
  }, [fetchAll]);

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans">
      <header className="border-b-4 border-indigo-600 pb-4 mb-6 flex items-end justify-between">
        <div>
          <h2 className="m-0 text-2xl font-bold text-indigo-700">📈 BI — Live Operations Dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">
            Shop Floor Control performance linked to General Ledger WIP valuation — the GSS closed loop.
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 bg-indigo-500 animate-pulse" />
          {polledAt ? `Live · ${new Date(polledAt).toLocaleTimeString()}` : "Connecting…"} · refresh {POLL_MS / 1000}s
        </div>
      </header>

      {error && <div className="px-4 py-3 rounded-md mb-4 font-semibold text-white bg-red-600">{error}</div>}

      {/* GL WIP Valuation strip */}
      {wip && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "MATERIAL WIP", value: wip.materialWip, color: "border-slate-500 text-slate-700" },
            { label: "LABOR WIP", value: wip.laborWip, color: "border-sky-500 text-sky-700" },
            { label: "OVERHEAD WIP", value: wip.overheadWip, color: "border-violet-500 text-violet-700" },
            { label: "TOTAL WIP VALUE", value: wip.totalWip, color: "border-indigo-600 text-indigo-700" }
          ].map((k) => (
            <div key={k.label} className={`bg-white border border-slate-200 border-t-4 rounded-lg p-4 ${k.color}`}>
              <div className="text-[11px] tracking-wide text-slate-400">{k.label}</div>
              <div className="text-2xl font-bold mt-1">${k.value.toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Active operations */}
      <div className="space-y-6">
        {jobs.length === 0 && !error && (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-400">
            No active shop floor operations.
          </div>
        )}
        {jobs.map((job) => {
          const pct = job.estimatedHours > 0 ? Math.min(100, Math.round((job.loggedHours / job.estimatedHours) * 100)) : 0;
          const overBudget = job.varianceFlag === "OVER_BUDGET";
          const behind = job.varianceFlag === "BEHIND";
          const barColor = overBudget ? "bg-red-500" : behind ? "bg-amber-500" : "bg-emerald-500";
          const eff = job.efficiencyPercent;
          return (
            <div key={job.id} className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
              {/* Job header */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-slate-50 border-b border-slate-200">
                <div>
                  <span className="text-lg font-bold text-slate-800">{job.orderNumber}</span>
                  <span className="ml-3 text-sm text-slate-500">{job.partNumber}</span>
                  {job.salesOrderNumber && (
                    <span className="ml-3 px-2 py-0.5 rounded text-xs font-semibold bg-sky-100 text-sky-700">OE {job.salesOrderNumber}</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-slate-500">Qty <b className="text-slate-800">{job.quantityCompleted}/{job.quantityOrdered}</b></span>
                  <span className="text-slate-500">WIP <b className="text-indigo-700">${job.wipCost.toFixed(2)}</b></span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${FLAG_STYLES[job.varianceFlag] || "bg-slate-100 text-slate-600"}`}>
                    {job.varianceFlag?.replace("_", " ")}
                  </span>
                </div>
              </div>

              {/* Aggregate hours bar */}
              <div className="px-5 pt-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Total labor: <b className="text-slate-700">{job.loggedHours.toFixed(2)}h</b> actual</span>
                  <span>vs <b className="text-slate-700">{job.estimatedHours.toFixed(2)}h</b> standard · Efficiency <b className={eff === null ? "text-slate-400" : eff >= 90 ? "text-emerald-600" : eff >= 75 ? "text-amber-600" : "text-red-600"}>{eff === null ? "—" : `${eff}%`}</b></span>
                </div>
                <div className="bg-slate-200 rounded-full h-4 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* Per-sequence routing steps */}
              <div className="px-5 py-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-400">
                      <th className="pb-2 pr-4">Seq</th>
                      <th className="pb-2 pr-4">Work Center</th>
                      <th className="pb-2 pr-4 w-2/5">Actual vs Std</th>
                      <th className="pb-2 pr-4">Std (h)</th>
                      <th className="pb-2 pr-4">Actual (h)</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.steps.map((s) => {
                      const sPct = s.estimatedHours > 0 ? Math.min(100, Math.round((s.actualHours / s.estimatedHours) * 100)) : 0;
                      const sColor = s.status === "Completed" ? "bg-emerald-500" : s.status === "In-Progress" ? "bg-sky-500" : "bg-slate-300";
                      return (
                        <tr key={s.routingStepId} className="border-t border-slate-100">
                          <td className="py-2 pr-4 text-slate-400">{s.sequenceNumber}</td>
                          <td className="py-2 pr-4 font-semibold text-slate-700">{s.workCenterCode}</td>
                          <td className="py-2 pr-4">
                            <div className="bg-slate-200 rounded-full h-2.5 overflow-hidden">
                              <div className={`h-full rounded-full ${sColor}`} style={{ width: `${sPct}%` }} />
                            </div>
                          </td>
                          <td className="py-2 pr-4 text-slate-600">{s.estimatedHours.toFixed(2)}</td>
                          <td className="py-2 pr-4 font-semibold text-slate-800">{s.actualHours.toFixed(2)}</td>
                          <td className="py-2">
                            <span className={`px-2 py-0.5 rounded-full font-bold ${s.status === "Completed" ? "bg-emerald-100 text-emerald-700" : s.status === "In-Progress" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-500"}`}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LiveOperationsDashboard;
