import { useEffect, useState } from "react";
import apiClient from "../lib/apiClient.js";
import "./ErpPage.css";

const emptyForm = { orderNumber: "", supplierId: "", orderDate: "", status: "draft", productId: "", quantity: "", unitPrice: "" };

function PurchaseOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOrders() {
      try {
        setOrders(await apiClient.get("/api/purchase-orders"));
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
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
      const body = {
        orderNumber: form.orderNumber,
        supplierId: Number(form.supplierId),
        orderDate: form.orderDate,
        status: form.status,
        items: [{ productId: Number(form.productId), quantity: Number(form.quantity), unitPrice: Number(form.unitPrice) }]
      };
      const result = await apiClient.post("/api/purchase-orders", body);
      setOrders((current) => [...current, result]);
      setForm(emptyForm);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="erp-page">
      <h1>Purchase Orders</h1>
      <p>Create and review purchasing commitments for suppliers.</p>
      <section className="erp-section">
        <div className="erp-section-header"><h2>New purchase order</h2><p>Capture one supplier line item per order.</p></div>
      <form className="erp-form" onSubmit={handleSubmit}>
        <label>Order number<input name="orderNumber" value={form.orderNumber} onChange={handleChange} required /></label>
        <label>Supplier ID<input name="supplierId" type="number" min="1" step="1" value={form.supplierId} onChange={handleChange} required /></label>
        <label>Order date<input name="orderDate" type="date" value={form.orderDate} onChange={handleChange} required /></label>
        <label>Status<select name="status" value={form.status} onChange={handleChange}><option value="draft">Draft</option><option value="submitted">Submitted</option><option value="approved">Approved</option><option value="received">Received</option><option value="cancelled">Cancelled</option></select></label>
        <label>Product ID<input name="productId" type="number" min="1" step="1" value={form.productId} onChange={handleChange} required /></label>
        <label>Quantity<input name="quantity" type="number" min="1" step="1" value={form.quantity} onChange={handleChange} required /></label>
        <label>Unit price<input name="unitPrice" type="number" min="0" step="0.01" value={form.unitPrice} onChange={handleChange} required /></label>
        <button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create purchase order"}</button>
      </form>
      </section>
      {error && <p className="erp-alert" role="alert">{error}</p>}
      {loading ? <p>Loading purchase orders...</p> : (
        <section className="erp-section"><div className="erp-section-header"><h2>Order register</h2><p>{orders.length} purchase orders</p></div><div className="erp-table-wrap"><table className="erp-table"><thead><tr><th>Order number</th><th>Supplier</th><th>Date</th><th>Status</th><th>Items</th><th>Total</th></tr></thead>
          <tbody>{orders.map((order) => <tr key={order.id}><td>{order.orderNumber}</td><td>{order.supplierId}</td><td>{order.orderDate}</td><td><span className={`erp-badge ${order.status === "approved" || order.status === "received" ? "erp-badge-success" : order.status === "cancelled" ? "erp-badge-danger" : "erp-badge-warning"}`}>{order.status}</span></td><td>{order.items.length}</td><td>{order.total.toFixed(2)}</td></tr>)}</tbody>
        </table></div></section>
      )}
    </main>
  );
}

export default PurchaseOrdersPage;
