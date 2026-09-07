import { useEffect, useState } from "react";
import apiClient from "../lib/apiClient.js";

const emptyForm = {
  name: "",
  sku: "",
  quantityOnHand: "",
  reorderPoint: "",
  location: ""
};

function InventoryPage() {
  const [items, setItems] = useState([]);
  const [reorderSuggestions, setReorderSuggestions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadItems() {
      try {
        const [inventoryData, reorderData] = await Promise.all([
          apiClient.get("/api/inventory"),
          apiClient.get("/api/inventory/reorder-suggestions")
        ]);
        setItems(Array.isArray(inventoryData) ? inventoryData : inventoryData?.items || []);
        setReorderSuggestions(reorderData?.suggestions || []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadItems();
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
      const result = await apiClient.post("/api/inventory", {
          ...form,
          quantityOnHand: Number(form.quantityOnHand),
          reorderPoint: Number(form.reorderPoint)
        });

      setItems((currentItems) => [...currentItems, result]);
      setForm(emptyForm);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>Inventory</h1>
      <p>Track stock levels across your manufacturing locations.</p>
      <p role="status">{reorderSuggestions.length} material{reorderSuggestions.length === 1 ? "" : "s"} at or below reorder point.</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <label>
          Item name
          <input name="name" value={form.name} onChange={handleChange} required />
        </label>
        <label>
          SKU
          <input name="sku" value={form.sku} onChange={handleChange} required />
        </label>
        <label>
          Quantity on hand
          <input
            name="quantityOnHand"
            type="number"
            min="0"
            step="1"
            value={form.quantityOnHand}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Reorder point
          <input
            name="reorderPoint"
            type="number"
            min="0"
            step="1"
            value={form.reorderPoint}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Location
          <input name="location" value={form.location} onChange={handleChange} required />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Adding..." : "Add item"}
        </button>
      </form>

      {error && <p role="alert" style={styles.error}>{error}</p>}

      {loading ? (
        <p>Loading inventory...</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>On hand</th>
                <th>Reorder point</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.sku}</td>
                  <td>{item.quantityOnHand}</td>
                  <td>{item.reorderPoint}</td>
                  <td>{item.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && reorderSuggestions.length > 0 && (
        <section style={styles.reorderPanel} aria-label="Reorder suggestions">
          <h2>Reorder suggestions</h2>
          <ul>
            {reorderSuggestions.map((suggestion) => (
              <li key={suggestion.partNumber}>
                <strong>{suggestion.partNumber}</strong>: order {suggestion.recommendedOrderQty} {suggestion.unit}
                {suggestion.supplier?.name ? ` from ${suggestion.supplier.name}` : "; assign a supplier"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

const styles = {
  form: {
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    margin: "24px 0",
    textAlign: "left"
  },
  error: { color: "#b42318" },
  reorderPanel: { background: "#fff8e1", border: "1px solid #f0c36d", marginTop: "24px", padding: "16px" },
  tableWrapper: { overflowX: "auto" },
  table: { borderCollapse: "collapse", minWidth: "680px", width: "100%" }
};

export default InventoryPage;
