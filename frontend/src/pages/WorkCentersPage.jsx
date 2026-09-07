import { useEffect, useState } from "react";
import apiClient from "../lib/apiClient.js";
import "./ErpPage.css";

const emptyForm = { name: "", code: "", dailyCapacityHours: "" };

function WorkCentersPage() {
  const [workCenters, setWorkCenters] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadWorkCenters() {
      try {
        setWorkCenters(await apiClient.get("/api/db/work-centers"));
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }
    loadWorkCenters();
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
      const result = await apiClient.post("/api/db/work-centers", { ...form, dailyCapacityHours: Number(form.dailyCapacityHours) });
      setWorkCenters((current) => [...current, result]);
      setForm(emptyForm);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="erp-page">
      <h1>Work Centers</h1>
      <p>Define production resources and their daily available capacity.</p>
      <section className="erp-section">
        <div className="erp-section-header"><h2>New work center</h2><p>Add a production resource to the shop floor.</p></div>
      <form className="erp-form" onSubmit={handleSubmit}>
        <label>Name<input name="name" value={form.name} onChange={handleChange} required /></label>
        <label>Code<input name="code" value={form.code} onChange={handleChange} required /></label>
        <label>Daily capacity (hours)<input name="dailyCapacityHours" type="number" min="0.1" step="0.1" value={form.dailyCapacityHours} onChange={handleChange} required /></label>
        <button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create work center"}</button>
      </form>
      </section>
      {error && <p className="erp-alert" role="alert">{error}</p>}
      {loading ? <p>Loading work centers...</p> : (
        <section className="erp-section"><div className="erp-section-header"><h2>Resource register</h2><p>{workCenters.length} work centers</p></div><div className="erp-table-wrap"><table className="erp-table"><thead><tr><th>Name</th><th>Code</th><th>Daily capacity (hrs)</th><th>Availability</th></tr></thead>
          <tbody>{workCenters.map((workCenter) => <tr key={workCenter.id}><td>{workCenter.name}</td><td>{workCenter.code}</td><td>{workCenter.dailyCapacityHours}</td><td><span className="erp-badge erp-badge-success">Available</span></td></tr>)}</tbody>
        </table></div></section>
      )}
    </main>
  );
}

export default WorkCentersPage;
