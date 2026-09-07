import { useEffect, useState } from "react";
import { BrainCircuit, CircleStop, Play, Timer } from "lucide-react";
import apiClient from "../lib/apiClient.js";
import "./OperationsPage.css";

function OperatorClockPage() {
  const [active, setActive] = useState([]);
  const [form, setForm] = useState({ workOrderId: "", workCenterId: "1", operation: "" });
  const [estimateForm, setEstimateForm] = useState({ operation: "", material: "", quantity: "1", complexity: "medium" });
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState("");

  async function loadActive() {
    const result = await apiClient.get("/api/time-tracking/active");
    setActive(result);
  }

  useEffect(() => { loadActive().catch((loadError) => setError(loadError.message)); }, []);

  async function clockIn(event) {
    event.preventDefault(); setError("");
    try { const result = await apiClient.post("/api/time-tracking/clock-in", { ...form, workOrderId: Number(form.workOrderId), workCenterId: Number(form.workCenterId) }); setActive((current) => [...current, result]); setForm({ ...form, operation: "" }); } catch (clockError) { setError(clockError.message); }
  }

  async function clockOut(id) {
    try { await apiClient.post(`/api/time-tracking/${id}/clock-out`); setActive((current) => current.filter((entry) => entry.id !== id)); } catch (clockError) { setError(clockError.message); }
  }

  async function getEstimate(event) {
    event.preventDefault(); setError("");
    try { setEstimate(await apiClient.post("/ai/estimate", { ...estimateForm, quantity: Number(estimateForm.quantity) })); } catch (estimateError) { setError(estimateError.message); }
  }

  return <main className="operations-page"><header className="operations-page-header"><div><p className="eyebrow">Shop floor / Operator terminal</p><h1>Job clock</h1><p>Clock time against the exact work order and operation to capture true labor and machine cost.</p></div></header>{error && <p className="operation-alert" role="alert">{error}</p>}<section className="operation-panel"><h2><Timer size={18} /> Clock into an operation</h2><p className="panel-subtitle">Only one active clock is allowed per operator.</p><form className="operation-form" onSubmit={clockIn}><label>Work order ID<input min="1" type="number" value={form.workOrderId} onChange={(event) => setForm({ ...form, workOrderId: event.target.value })} required /></label><label>Work center ID<input min="1" type="number" value={form.workCenterId} onChange={(event) => setForm({ ...form, workCenterId: event.target.value })} required /></label><label>Operation<input placeholder="e.g. CNC mill housing" value={form.operation} onChange={(event) => setForm({ ...form, operation: event.target.value })} required /></label><button className="form-submit" disabled={active.length > 0} type="submit"><Play size={15} /> Clock in</button></form></section><section className="operation-table"><div className="table-heading"><h2>Active job</h2><span>{active.length} running</span></div>{active.length === 0 ? <p className="operation-empty">No active operation. Clock in when you begin work.</p> : <table><thead><tr><th>Work order</th><th>Operation</th><th>Started</th><th>Live cost</th><th /></tr></thead><tbody>{active.map((entry) => <tr key={entry.id}><td>#{entry.workOrderId}</td><td><strong>{entry.operation}</strong></td><td>{new Date(entry.startTime).toLocaleTimeString()}</td><td>${entry.totalCost.toFixed(2)}</td><td><button className="secondary-action" onClick={() => clockOut(entry.id)} type="button"><CircleStop size={15} /> Clock out</button></td></tr>)}</tbody></table>}</section><section className="operation-panel" style={{ marginTop: 18 }}><h2><BrainCircuit size={18} /> AI time estimate</h2><p className="panel-subtitle">Use the estimate as a planning suggestion; approve it before adding it to a routing.</p><form className="operation-form" onSubmit={getEstimate}><label>Operation<input value={estimateForm.operation} onChange={(event) => setEstimateForm({ ...estimateForm, operation: event.target.value })} required /></label><label>Material<input value={estimateForm.material} onChange={(event) => setEstimateForm({ ...estimateForm, material: event.target.value })} /></label><label>Quantity<input min="1" type="number" value={estimateForm.quantity} onChange={(event) => setEstimateForm({ ...estimateForm, quantity: event.target.value })} /></label><label>Complexity<select value={estimateForm.complexity} onChange={(event) => setEstimateForm({ ...estimateForm, complexity: event.target.value })}><option>low</option><option>medium</option><option>high</option><option>extreme</option></select></label><button className="form-submit" type="submit"><BrainCircuit size={15} /> Estimate setup and run time</button></form>{estimate && <div className="result-panel"><h2>AI-assisted estimate</h2><p>Setup: <strong>{estimate.setupMinutes} minutes</strong> · Run: <strong>{estimate.runMinutesPerUnit} minutes/unit</strong> · Total: <strong>{estimate.totalMinutes} minutes</strong></p><p>Confidence: {estimate.confidence}. {estimate.assumptions.join(" ")}</p></div>}</section></main>;
}

export default OperatorClockPage;
