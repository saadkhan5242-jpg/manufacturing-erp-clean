import { useState } from "react";
import { FileDown, FileText, Receipt } from "lucide-react";
import apiClient from "../lib/apiClient.js";
import "./OperationsPage.css";

function DocumentsPage() {
  const [type, setType] = useState("purchase-order");
  const [sourceId, setSourceId] = useState(1);
  const [document, setDocument] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await apiClient.post("/api/documents", { type, sourceId: Number(sourceId) });
      setDocument(result);
    } catch (generateError) { setError(generateError.message); } finally { setLoading(false); }
  }

  return <main className="operations-page"><header className="operations-page-header"><div><p className="eyebrow">Finance / Documents</p><h1>Document center</h1><p>Generate printable purchasing and billing documents from ERP records.</p></div></header><section className="operation-panel"><h2><FileText size={18} /> Generate document</h2><p className="panel-subtitle">Choose a source record and create a clean document ready for printing or PDF export.</p>{error && <p className="operation-alert" role="alert">{error}</p>}<form className="operation-form document-form" onSubmit={generate}><label>Document type<select value={type} onChange={(event) => setType(event.target.value)}><option value="purchase-order">Purchase order</option><option value="invoice">Invoice</option></select></label><label>Purchase order ID<input min="1" type="number" value={sourceId} onChange={(event) => setSourceId(event.target.value)} required /></label><button className="form-submit" disabled={loading} type="submit"><FileDown size={15} /> {loading ? "Generating..." : "Generate document"}</button></form></section>{document && <section className="document-preview operation-panel"><div className="table-heading"><div><h2>{document.title}</h2><p className="panel-subtitle">{document.reference} · generated {new Date(document.createdAt).toLocaleString()}</p></div><Receipt color="var(--teal)" size={23} /></div><iframe title="Generated document preview" srcDoc={document.content} /></section>}</main>;
}

export default DocumentsPage;
