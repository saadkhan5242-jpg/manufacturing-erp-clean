import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, Send } from "lucide-react";
import apiClient from "./lib/apiClient.js";
import "./pages/OperationsPage.css";

function WorkOrdersPage() {
  const [partNumber, setPartNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [result, setResult] = useState(null);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient.get("/api/work-orders")
      .then(setOrders)
      .catch((loadError) => setError(loadError.message));
  }, []);

  const submitWorkOrder = async () => {
    setError("");

    try {
      const data = await apiClient.post("/api/work-orders", {
          partNumber,
          quantity: Number(quantity)
      });

      setResult(data);
      setOrders((current) => [...current, data]);
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  return (
    <main className="operations-page">
      <header className="operations-page-header"><div><p className="eyebrow">Production / Execution</p><h1>Work orders</h1><p>Release production work and track the next job on the floor.</p></div></header>
      <section className="operation-panel"><h2><ClipboardList size={18} /> Create work order</h2><p className="panel-subtitle">Add a job to the open production queue.</p>
        <form className="operation-form" onSubmit={(event) => { event.preventDefault(); submitWorkOrder(); }}><label>Part number<input placeholder="e.g. P-1001" value={partNumber} onChange={e => setPartNumber(e.target.value)} required /></label><label>Quantity<input min="1" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} required /></label><button className="form-submit" type="submit"><Send size={15} /> Release order</button></form>
      </section>
      {error && <p className="operation-alert" role="alert">{error}</p>}
      {result && <section className="result-panel"><h2><CheckCircle2 size={17} /> Work order released</h2><p>Order #{result.id} for {result.partNumber} is now {result.status.toLowerCase()}.</p><p>Planned quantity: {result.quantity}</p></section>}
      <section className="operation-table"><div className="table-heading"><h2>Production queue</h2><span>{orders.length} orders</span></div><table><thead><tr><th>Order</th><th>Part</th><th>Quantity</th><th>Status</th><th>Due</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>{order.orderNumber || `#${order.id}`}</td><td>{order.partNumber}</td><td>{order.quantity}</td><td>{order.status}</td><td>{order.dueDate || "-"}</td></tr>)}</tbody></table></section>
    </main>
  );
}

export default WorkOrdersPage;
