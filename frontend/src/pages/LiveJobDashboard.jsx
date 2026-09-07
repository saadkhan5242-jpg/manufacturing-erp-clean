import { useState, useEffect, useCallback } from "react";
import apiClient from "../lib/apiClient.js";

const POLL_MS = 5000;

/**
 * LiveJobDashboard — real-time grid of active shop floor work orders.
 * Each row renders a green GSS-style progress bar comparing logged
 * labor hours against estimated standard hours, with variance flags.
 */
function LiveJobDashboard() {
  const [jobs, setJobs] = useState([]);
  const [polledAt, setPolledAt] = useState(null);
  const [error, setError] = useState("");

  const fetchJobs = useCallback(async () => {
    try {
      const data = await apiClient.get("/api/dashboard/live-jobs");
      setJobs(data.jobs || []);
      setPolledAt(data.polledAt);
      setError("");
    } catch (err) {
      setError(`Live job stream interrupted: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const timer = setInterval(fetchJobs, POLL_MS);
    return () => clearInterval(timer);
  }, [fetchJobs]);

  const flagStyles = {
    ON_TRACK: "bg-emerald-100 text-emerald-700",
    BEHIND: "bg-amber-100 text-amber-700",
    OVER_BUDGET: "bg-red-100 text-red-700"
  };

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans">
      <header className="border-b-4 border-emerald-600 pb-4 mb-6 flex items-end justify-between">
        <div>
          <h2 className="m-0 text-2xl font-bold text-emerald-700">🏭 GSS Live Job Dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">
            Real-time WIP tracking — logged labor hours vs. estimated standards per active work order.
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 bg-emerald-500 animate-pulse" />
          {polledAt ? `Live · ${new Date(polledAt).toLocaleTimeString()}` : "Connecting…"} · refresh {POLL_MS / 1000}s
        </div>
      </header>

      {error && (
        <div className="px-4 py-3 rounded-md mb-4 font-semibold text-white bg-red-600">{error}</div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-emerald-50 text-left text-emerald-800">
              {["Work Order", "Part #", "Current Step", "Qty (Done/Ordered)", "Labor Progress (Actual vs Std)", "Est. Hrs", "Actual Hrs", "Efficiency", "Variance"].map((h) => (
                <th key={h} className="px-4 py-3 border-b-2 border-emerald-100">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && !error && (
              <tr>
                <td colSpan="9" className="px-4 py-6 text-center text-slate-400">
                  No active work orders on the floor.
                </td>
              </tr>
            )}
            {jobs.map((job) => {
              const pct = job.estimatedHours > 0
                ? Math.min(100, Math.round((job.loggedHours / job.estimatedHours) * 100))
                : 0;
              const overBudget = job.varianceFlag === "OVER_BUDGET";
              const behind = job.varianceFlag === "BEHIND";
              const barColor = overBudget ? "bg-red-500" : behind ? "bg-amber-500" : "bg-emerald-500";
              const eff = job.efficiencyPercent;
              return (
                <tr key={job.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-800">{job.orderNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{job.partNumber}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-md text-xs font-bold bg-slate-800 text-white">
                      {job.currentWorkCenter}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">seq {job.currentSequence ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{job.quantityCompleted}/{job.quantityOrdered}</td>
                  <td className="px-4 py-3 min-w-56">
                    <div className="bg-slate-200 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{job.estimatedHours.toFixed(2)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{job.loggedHours.toFixed(2)}</td>
                  <td className="px-4 py-3 font-bold" >
                    <span className={eff === null ? "text-slate-400" : eff >= 90 ? "text-emerald-600" : eff >= 75 ? "text-amber-600" : "text-red-600"}>
                      {eff === null ? "—" : `${eff}%`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${flagStyles[job.varianceFlag] || "bg-slate-100 text-slate-600"}`}>
                      {job.varianceFlag?.replace("_", " ") || "—"}
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
}

export default LiveJobDashboard;
