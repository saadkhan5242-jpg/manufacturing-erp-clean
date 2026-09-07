import { useState } from "react";
import apiClient from "../lib/apiClient.js";

// Field is declared at module scope so React does not remount it on every render.
function Field({ label, ...props }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{label}</span>
      <input
        {...props}
        className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
      />
    </label>
  );
}

/**
 * OrderEntryForm — Order Entry intake panel. Captures customer account,
 * sales order number, required delivery date, part item, and volume.
 * Submission triggers the backend inventory-shortfall evaluation which
 * auto-generates a Work Order + routing when stock cannot cover demand.
 */
function OrderEntryForm() {
  const [form, setForm] = useState({
    orderNumber: "",
    customerId: "",
    partNumber: "",
    quantityOrdered: "",
    unitPrice: "",
    requiredDate: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const data = await apiClient.post("/api/bom/submit-sales-order", {
          orderNumber: form.orderNumber.trim(),
          customerId: form.customerId.trim(),
          partNumber: form.partNumber.trim(),
          quantityOrdered: Number(form.quantityOrdered),
          unitPrice: Number(form.unitPrice) || 0,
          requiredDate: form.requiredDate || null
      });
      setResult({ ok: true, data });
    } catch (err) {
      setResult({ ok: false, error: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 max-w-2xl font-sans">
      <header className="border-b-2 border-sky-600 pb-3 mb-5">
        <h3 className="m-0 text-lg font-bold text-sky-700">🧾 Order Entry — Sales Order Intake</h3>
        <p className="m-0 mt-1 text-xs text-slate-500">Submission runs an immediate inventory shortfall evaluation and auto-generates a shop-floor work order when stock is short.</p>
      </header>

      <form onSubmit={submit} className="grid grid-cols-2 gap-4">
        <Field label="Customer Account" value={form.customerId} onChange={update("customerId")} placeholder="CUST-NORTHSTAR" required />
        <Field label="Sales Order #" value={form.orderNumber} onChange={update("orderNumber")} placeholder="SO-9001" required />
        <Field label="Part Number" value={form.partNumber} onChange={update("partNumber")} placeholder="BRACKET-ASSY" required />
        <Field label="Volume Target (Qty)" type="number" min="1" value={form.quantityOrdered} onChange={update("quantityOrdered")} placeholder="25" required />
        <Field label="Unit Price ($)" type="number" step="0.01" min="0" value={form.unitPrice} onChange={update("unitPrice")} placeholder="412.50" />
        <Field label="Required Delivery Date" type="date" value={form.requiredDate} onChange={update("requiredDate")} />

        <div className="col-span-2 mt-2">
          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3 rounded font-bold text-white text-sm ${submitting ? "bg-sky-300 cursor-wait" : "bg-sky-600 hover:bg-sky-500"}`}
          >
            {submitting ? "Evaluating Inventory Shortfall…" : "Submit Order & Evaluate Inventory"}
          </button>
        </div>
      </form>

      {result && (
        <div className={`mt-4 px-4 py-3 rounded text-sm font-semibold ${result.ok ? (result.data.workOrderGenerated ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-sky-50 text-sky-700 border border-sky-200") : "bg-red-50 text-red-700 border border-red-200"}`}>
          {result.ok ? (
            <>
              <div>{result.data.message}</div>
              {result.data.workOrderGenerated && (
                <div className="mt-2 text-xs font-mono">
                  WO: {result.data.trigger.orderNumber} · Shortfall: {result.data.trigger.shortfall} · Routing steps: {result.data.trigger.routingSteps}
                </div>
              )}
            </>
          ) : (
            <>Order rejected: {result.error}</>
          )}
        </div>
      )}
    </div>
  );
}

export default OrderEntryForm;
