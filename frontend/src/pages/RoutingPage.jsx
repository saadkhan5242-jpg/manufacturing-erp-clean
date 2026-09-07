import { useEffect, useState } from "react";
import { GitBranch, Plus, Save } from "lucide-react";
import apiClient from "../lib/apiClient.js";
import "./OperationsPage.css";

const emptyStep = { sequence: 10, operation: "", workCenterId: 1, setupMinutes: 0, runMinutes: 0, instructions: "" };

function RoutingPage() {
  const [routings, setRoutings] = useState([]);
  const [form, setForm] = useState({ productId: 1, revision: "", steps: [{ ...emptyStep }] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient.get("/api/routings").then(setRoutings).catch((loadError) => setError(loadError.message)).finally(() => setLoading(false));
  }, []);

  function updateStep(index, field, value) {
    setForm((current) => ({ ...current, steps: current.steps.map((step, stepIndex) => stepIndex === index ? { ...step, [field]: field === "operation" || field === "instructions" ? value : Number(value) } : step) }));
  }

  function addStep() {
    setForm((current) => ({ ...current, steps: [...current.steps, { ...emptyStep, sequence: (current.steps.length + 1) * 10 }] }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await apiClient.post("/api/routings", { ...form, productId: Number(form.productId) });
      setRoutings((current) => [...current, result]);
      setForm({ productId: 1, revision: "", steps: [{ ...emptyStep }] });
    } catch (submitError) { setError(submitError.message); } finally { setSaving(false); }
  }

  return <main className="operations-page"><header className="operations-page-header"><div><p className="eyebrow">Engineering / Process control</p><h1>Routing library</h1><p>Define the ordered operations, work centers, and standard times for each manufactured product.</p></div></header>
    <section className="operation-panel"><h2><GitBranch size={18} /> New routing revision</h2><p className="panel-subtitle">A routing is the shop-floor recipe behind a finished product.</p>{error && <p className="operation-alert" role="alert">{error}</p>}<form className="operation-form" onSubmit={submit}><label>Product ID<input min="1" name="productId" type="number" value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })} required /></label><label>Revision<input name="revision" placeholder="e.g. A" value={form.revision} onChange={(event) => setForm({ ...form, revision: event.target.value })} required /></label>{form.steps.map((step, index) => <div className="routing-step" key={index}><span className="step-number">{step.sequence}</span><label>Operation<input value={step.operation} onChange={(event) => updateStep(index, "operation", event.target.value)} required /></label><label>Work center ID<input min="1" type="number" value={step.workCenterId} onChange={(event) => updateStep(index, "workCenterId", event.target.value)} required /></label><label>Setup min<input min="0" type="number" value={step.setupMinutes} onChange={(event) => updateStep(index, "setupMinutes", event.target.value)} /></label><label>Run min<input min="0" type="number" value={step.runMinutes} onChange={(event) => updateStep(index, "runMinutes", event.target.value)} /></label><label>Instructions<input value={step.instructions} onChange={(event) => updateStep(index, "instructions", event.target.value)} /></label></div>)}<div className="routing-actions"><button className="secondary-action" onClick={addStep} type="button"><Plus size={15} /> Add operation</button><button className="form-submit" disabled={saving} type="submit"><Save size={15} /> {saving ? "Saving..." : "Save routing"}</button></div></form></section>
    <section className="operation-table"><div className="table-heading"><h2>Active revisions</h2><span>{routings.length} routings</span></div>{loading ? <p className="operation-empty">Loading routings...</p> : <table><thead><tr><th>Product</th><th>Revision</th><th>Operations</th><th>Status</th></tr></thead><tbody>{routings.map((routing) => <tr key={routing.id}><td>Product #{routing.productId}</td><td><strong>{routing.revision}</strong></td><td>{routing.steps.length} operations</td><td><span className="erp-badge erp-badge-success">{routing.status}</span></td></tr>)}</tbody></table>}</section>
  </main>;
}

export default RoutingPage;
