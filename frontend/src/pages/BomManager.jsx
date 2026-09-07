import { useState } from 'react';
import apiClient from '../lib/apiClient.js';

function BomManager() {
  const [productId, setProductId] = useState('1');
  const [revisionNumber, setRevisionNumber] = useState('Rev A');
  const [operations, setOperations] = useState([
    { sequenceNumber: 10, workCenter: 'CNC_MILL', setupTimeHours: 1.0, estimatedRunTimeHours: 2.5 }
  ]);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  const addStep = () => {
    const nextSeq = operations.length > 0 ? operations[operations.length - 1].sequenceNumber + 10 : 10;
    setOperations([...operations, { sequenceNumber: nextSeq, workCenter: 'CNC_MILL', setupTimeHours: 0.0, estimatedRunTimeHours: 0.0 }]);
  };

  const removeStep = (index) => {
    setOperations(operations.filter((_, idx) => idx !== index));
  };

  const updateOpField = (index, field, value) => {
    setOperations(operations.map((op, idx) => idx === index ? { ...op, [field]: field === 'workCenter' ? value : Number(value) } : op));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });
    try {
      await apiClient.post('/api/bom/create', { productId: Number(productId), revisionNumber, operations });

      setMessage({ text: 'GSS Sync Matrix Success: Engineering routing definitions safely registered!', type: 'success' });
    } catch (error) {
      setMessage({ text: `GSS Synchronization Error: ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto', fontFamily: 'monospace' }}>
      <header style={{ borderBottom: '2px solid #3182ce', paddingBottom: '12px', marginBottom: '24px' }}>
        <h2 style={{ color: '#3182ce', margin: 0 }}>🏭 GSS BOM Routing Specification Control Panel</h2>
        <p style={{ color: '#718096', margin: '4px 0' }}>Enforce sequential execution maps on target production parts</p>
      </header>

      {message.text && (
        <div style={{ padding: '12px', borderRadius: '6px', marginBottom: '20px', fontWeight: 'bold', color: '#fff', backgroundColor: message.type === 'success' ? '#2f855a' : '#9b2c2c' }}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #cbd5e0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Assembly Part Product ID</label>
            <input type="number" value={productId} onChange={(e) => setProductId(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Engineering Rev Level</label>
            <input type="text" value={revisionNumber} onChange={(e) => setRevisionNumber(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0' }} />
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f7fafc', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '10px' }}>Seq #</th>
              <th style={{ padding: '10px' }}>Work Center Matrix Station</th>
              <th style={{ padding: '10px' }}>Standard Setup Hours</th>
              <th style={{ padding: '10px' }}>Standard Run Hours</th>
              <th style={{ padding: '10px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {operations.map((op, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #edf2f7' }}>
                <td style={{ padding: '8px' }}><input type="number" value={op.sequenceNumber} onChange={(e) => updateOpField(idx, 'sequenceNumber', e.target.value)} required style={{ width: '70px', padding: '6px' }} /></td>
                <td style={{ padding: '8px' }}>
                  <select value={op.workCenter} onChange={(e) => updateOpField(idx, 'workCenter', e.target.value)} style={{ padding: '6px', width: '100%' }}>
                    <option value="CNC_MILL">CNC Mill Station</option>
                    <option value="LASER">Laser Cutter Matrix</option>
                    <option value="BENDING">Hydraulic Brake Press</option>
                    <option value="ASSEMBLY">Manual Hand Bench Assembly</option>
                  </select>
                </td>
                <td style={{ padding: '8px' }}><input type="number" step="0.01" value={op.setupTimeHours} onChange={(e) => updateOpField(idx, 'setupTimeHours', e.target.value)} style={{ width: '80px', padding: '6px' }} /></td>
                <td style={{ padding: '8px' }}><input type="number" step="0.01" value={op.estimatedRunTimeHours} onChange={(e) => updateOpField(idx, 'estimatedRunTimeHours', e.target.value)} style={{ width: '80px', padding: '6px' }} /></td>
                <td style={{ padding: '8px' }}><button type="button" onClick={() => removeStep(idx)} disabled={operations.length === 1} style={{ padding: '6px', backgroundColor: '#feb2b2', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button type="button" onClick={addStep} style={{ padding: '10px 16px', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>➕ Append Route Row</button>
          <button type="submit" disabled={loading} style={{ padding: '10px 24px', backgroundColor: '#3182ce', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>{loading ? 'Transmitting...' : '💾 Save Routing Plan to ERP Engine'}</button>
        </div>
      </form>
    </div>
  );
}

export default BomManager;
