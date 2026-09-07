import { useEffect, useState } from "react";
import { Clock3, LogIn, LogOut, Users } from "lucide-react";
import apiClient from "../lib/apiClient.js";
import "./OperationsPage.css";

function EmployeeTimePage() {
  const [activeShift, setActiveShift] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [report, setReport] = useState([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadTime() {
    const [active, shiftList, reportResult] = await Promise.all([apiClient.get("/api/time-tracking/shifts/active"), apiClient.get("/api/time-tracking/shifts"), apiClient.get("/api/time-tracking/employees/report")]);
    setActiveShift(active); setShifts(shiftList); setReport(reportResult);
  }

  useEffect(() => { loadTime().catch((loadError) => setError(loadError.message)).finally(() => setLoading(false)); }, []);

  async function clockIn() {
    setError("");
    const result = await apiClient.post("/api/time-tracking/shifts/clock-in", { note });
    setActiveShift(result); setNote(""); setShifts((current) => [...current, result]);
  }

  async function clockOut() {
    if (!activeShift) return;
    await apiClient.post(`/api/time-tracking/shifts/${activeShift.id}/clock-out`);
    setActiveShift(null); await loadTime();
  }

  return <main className="operations-page"><header className="operations-page-header"><div><p className="eyebrow">People / Attendance</p><h1>Employee time</h1><p>Track shifts separately from job operations, then review regular and overtime hours.</p></div></header>{error && <p className="operation-alert" role="alert">{error}</p>}<section className="operation-panel shift-status-panel"><h2><Clock3 size={18} /> Shift status</h2><p className="panel-subtitle">Your shift clock controls attendance time. Use Job clock for operation time.</p><div className="shift-status-row"><div><span className="shift-status-label">Current status</span><strong className={activeShift ? "shift-active" : ""}>{activeShift ? "Clocked in" : "Off shift"}</strong>{activeShift && <small>Started {new Date(activeShift.startTime).toLocaleTimeString()}</small>}</div>{activeShift ? <button className="secondary-action" onClick={clockOut} type="button"><LogOut size={15} /> Clock out</button> : <div className="shift-clock-in"><input placeholder="Optional shift note" value={note} onChange={(event) => setNote(event.target.value)} /><button className="form-submit" onClick={clockIn} type="button"><LogIn size={15} /> Clock in</button></div>}</div></section><section className="report-grid">{report.map((summary) => <article className="report-card" key={summary.employeeId}><Users color="var(--teal)" size={19} /><span>{summary.employeeName}</span><strong>{summary.totalHours.toFixed(2)} hrs</strong><small>{summary.regularHours.toFixed(2)} regular · {summary.overtimeHours.toFixed(2)} overtime</small></article>)}</section><section className="operation-table"><div className="table-heading"><h2>Shift history</h2><span>{shifts.length} shifts</span></div>{loading ? <p className="operation-empty">Loading time records...</p> : <table><thead><tr><th>Employee</th><th>Start</th><th>End</th><th>Total</th><th>Overtime</th></tr></thead><tbody>{shifts.map((shift) => <tr key={shift.id}><td><strong>{shift.employeeName}</strong></td><td>{new Date(shift.startTime).toLocaleString()}</td><td>{shift.endTime ? new Date(shift.endTime).toLocaleString() : "Active"}</td><td>{shift.totalHours.toFixed(2)} hrs</td><td>{shift.overtimeHours.toFixed(2)} hrs</td></tr>)}</tbody></table>}</section></main>;
}

export default EmployeeTimePage;
