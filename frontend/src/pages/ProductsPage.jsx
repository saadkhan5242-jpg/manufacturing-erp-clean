import { useEffect, useState } from "react";
import apiClient from "../lib/apiClient.js";
import "./ErpPage.css";

const emptyForm = { name: "", sku: "", description: "", unitPrice: "" };

function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProducts() {
      try {
        setProducts(await apiClient.get("/api/products"));
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
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
      const result = await apiClient.post("/api/products", { ...form, unitPrice: Number(form.unitPrice) });
      setProducts((current) => [...current, result]);
      setForm(emptyForm);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="erp-page">
      <h1>Products</h1>
      <p>Manage finished goods and manufactured product master data.</p>
      <section className="erp-section">
        <div className="erp-section-header"><h2>New product</h2><p>Register a finished good or manufactured item.</p></div>
      <form className="erp-form" onSubmit={handleSubmit}>
        <label>Name<input name="name" value={form.name} onChange={handleChange} required /></label>
        <label>SKU<input name="sku" value={form.sku} onChange={handleChange} required /></label>
        <label>Description<input name="description" value={form.description} onChange={handleChange} required /></label>
        <label>Unit price<input name="unitPrice" type="number" min="0" step="0.01" value={form.unitPrice} onChange={handleChange} required /></label>
        <button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create product"}</button>
      </form>
      </section>
      {error && <p className="erp-alert" role="alert">{error}</p>}
      {loading ? <p>Loading products...</p> : (
        <section className="erp-section"><div className="erp-section-header"><h2>Product register</h2><p>{products.length} products</p></div><div className="erp-table-wrap">
          <table className="erp-table"><thead><tr><th>Name</th><th>SKU</th><th>Description</th><th>Unit price</th><th>Status</th></tr></thead>
            <tbody>{products.map((product) => <tr key={product.id}><td>{product.name}</td><td>{product.sku}</td><td>{product.description}</td><td>{product.unitPrice.toFixed(2)}</td><td><span className={`erp-badge ${product.active ? "erp-badge-success" : "erp-badge-neutral"}`}>{product.active ? "Active" : "Inactive"}</span></td></tr>)}</tbody>
          </table>
        </div></section>
      )}
    </main>
  );
}

export default ProductsPage;
