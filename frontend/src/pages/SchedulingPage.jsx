import { useEffect, useState } from "react";
import apiClient from "../lib/apiClient.js";

const emptyForm = {
  workOrderId: "",
  workCenterId: "",
  startTime: "",
  endTime: "",
  status: "scheduled"
};

function SchedulingPage() {
  const [schedules, setSchedules] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSchedules() {
      try {
        setSchedules(await apiClient.get("/api/scheduling"));
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadSchedules();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const result = await apiClient.post("/api/scheduling", {
          ...form,
          workOrderId: Number(form.workOrderId),
          workCenterId: Number(form.workCenterId),
          startTime: new Date(form.startTime).toISOString(),
          endTime: new Date(form.endTime).toISOString()
      });

      setSchedules((currentSchedules) => [...currentSchedules, result]);
      setForm(emptyForm);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>Scheduling</h1>
      <p>Assign work orders to work centers and track their production windows.</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <label>
          Work order ID
          <input
            name="workOrderId"
            type="number"
            min="1"
            step="1"
            value={form.workOrderId}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Work center ID
          <input
            name="workCenterId"
            type="number"
            min="1"
            step="1"
            value={form.workCenterId}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Start time
          <input
            name="startTime"
            type="datetime-local"
            value={form.startTime}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          End time
          <input
            name="endTime"
            type="datetime-local"
            value={form.endTime}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Status
          <select name="status" value={form.status} onChange={handleChange}>
            <option value="scheduled">Scheduled</option>
            <option value="in-progress">In progress</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create schedule"}
        </button>
      </form>

      {error && <p role="alert" style={styles.error}>{error}</p>}

      {loading ? (
        <p>Loading schedules...</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Work order</th>
                <th>Work center</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule) => (
                <tr key={schedule.id}>
                  <td>{schedule.id}</td>
                  <td>{schedule.workOrderId}</td>
                  <td>{schedule.workCenterId}</td>
                  <td>{new Date(schedule.startTime).toLocaleString()}</td>
                  <td>{new Date(schedule.endTime).toLocaleString()}</td>
                  <td>{schedule.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

const styles = {
  form: {
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    margin: "24px 0",
    textAlign: "left"
  },
  error: { color: "#b42318" },
  tableWrapper: { overflowX: "auto" },
  table: { borderCollapse: "collapse", minWidth: "760px", width: "100%" }
};

export default SchedulingPage;
