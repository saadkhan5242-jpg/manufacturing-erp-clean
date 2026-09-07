import { useEffect, useState } from "react";
import apiClient from "../lib/apiClient.js";
import "./ErpPage.css";

const emptyForm = { equipmentId: "", title: "", description: "", scheduledDate: "", status: "scheduled", priority: "medium" };

function MaintenancePage() {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadMaintenance() {
      try {
        setRecords(await apiClient.get("/api/maintenance"));
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }
    loadMaintenance();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await apiClient.post("/api/maintenance", form);
      setRecords((current) => [...current, result]);
      setForm(emptyForm);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="erp-page">
      <h1>Maintenance</h1>
      <p>Schedule and track preventive and corrective equipment maintenance.</p>
      <section className="erp-section">
        <div className="erp-section-header"><h2>Schedule maintenance</h2><p>Plan the next service activity for an asset.</p></div>
      <form className="erp-form" onSubmit={handleSubmit}>
        <label>Equipment ID<input name="equipmentId" value={form.equipmentId} onChange={handleChange} required /></label>
        <label>Title<input name="title" value={form.title} onChange={handleChange} required /></label>
        <label>Description<input name="description" value={form.description} onChange={handleChange} required /></label>
        <label>Scheduled date<input name="scheduledDate" type="date" value={form.scheduledDate} onChange={handleChange} required /></label>
        <label>Status<select name="status" value={form.status} onChange={handleChange}><option value="scheduled">Scheduled</option><option value="in-progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
        <label>Priority<select name="priority" value={form.priority} onChange={handleChange}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
        <button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create maintenance task"}</button>
      </form>
      </section>
      {error && <p className="erp-alert" role="alert">{error}</p>}
      {loading ? <p>Loading maintenance...</p> : (
        <section className="erp-section"><div className="erp-section-header"><h2>Maintenance queue</h2><p>{records.length} scheduled tasks</p></div><div className="erp-table-wrap"><table className="erp-table"><thead><tr><th>Equipment</th><th>Title</th><th>Scheduled</th><th>Status</th><th>Priority</th></tr></thead>
          <tbody>{records.map((record) => <tr key={record.id}><td>{record.equipmentId}</td><td>{record.title}</td><td>{record.scheduledDate}</td><td><span className={`erp-badge ${record.status === "completed" ? "erp-badge-success" : record.status === "cancelled" ? "erp-badge-danger" : "erp-badge-warning"}`}>{record.status}</span></td><td><span className={`erp-badge ${record.priority === "critical" ? "erp-badge-danger" : record.priority === "high" ? "erp-badge-warning" : "erp-badge-neutral"}`}>{record.priority}</span></td></tr>)}</tbody>
        </table></div></section>
      )}
    </main>
  );
}

export default MaintenancePage;
