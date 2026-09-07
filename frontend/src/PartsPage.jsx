import { useEffect, useState } from 'react';
import { Boxes, PackagePlus } from 'lucide-react';
import apiClient from './lib/apiClient.js';
import './pages/OperationsPage.css';

export default function PartsPage() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/api/parts')
      .then(setParts)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="operations-page">
      <header className="operations-page-header"><div><p className="eyebrow">Materials / Catalog</p><h1>Parts</h1><p>Reference parts and components used across the production floor.</p></div></header>
      <div className="operations-toolbar"><span className="record-count"><strong>{parts.length}</strong> catalog records</span><span className="system-status"><span className="status-dot" /> Synced</span></div>
      {error && <p className="operation-alert" role="alert">{error}</p>}
      <section className="operation-table">
        {loading ? <p className="operation-empty">Loading parts...</p> : parts.length === 0 ? <p className="operation-empty"><Boxes size={22} />No parts found.</p> : <table><thead><tr><th>Part number</th><th>Description</th><th>Record ID</th></tr></thead><tbody>{parts.map((part) => <tr key={part.id}><td><strong>{part.part_number}</strong></td><td>{part.description}</td><td>#{part.id}</td></tr>)}</tbody></table>}
      </section>
      <section className="operation-panel" style={{ marginTop: 18 }}><h2><PackagePlus size={18} /> Catalog note</h2><p className="panel-subtitle">New parts are currently managed through the Products master data workflow.</p></section>
    </main>
  );
}
