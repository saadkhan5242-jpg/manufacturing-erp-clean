import { useState, useEffect, useCallback } from 'react';
import apiClient from '../lib/apiClient.js';

function ApLedgerPage() {
  const [ledgerData, setLedgerData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'DESC' });

  const fetchLedgerData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (filterVendor) params.append('vendor', filterVendor);
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);
      params.append('limit', 500);

      const data = await apiClient.get('/api/ai-document-intake/ledger', { query: Object.fromEntries(params) });
      setLedgerData(data.invoices || []);
    } catch (err) {
      console.error('Ledger fetch error:', err);
      setError(`Error loading AP ledger: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [filterVendor, filterStartDate, filterEndDate]);

  // Fetch ledger data on component mount and when filters change
  useEffect(() => {
    fetchLedgerData();
  }, [fetchLedgerData]);

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'DESC' ? 'ASC' : 'DESC'
    });
  };

  const sortedData = [...ledgerData].sort((a, b) => {
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];

    if (aVal < bVal) return sortConfig.direction === 'ASC' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'ASC' ? 1 : -1;
    return 0;
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'monospace' }}>
      <header style={{ borderBottom: '2px solid #d69e2e', paddingBottom: '12px', marginBottom: '24px' }}>
        <h2 style={{ color: '#d69e2e', margin: 0, fontSize: '24px' }}>📊 Accounts Payable Supervisor Audit Ledger</h2>
        <p style={{ color: '#718096', margin: '4px 0 0 0', fontSize: '13px' }}>Enterprise-grade AP invoice tracking and approval history</p>
      </header>

      {error && (
        <div style={{ padding: '12px', borderRadius: '6px', marginBottom: '20px', fontWeight: 'bold', color: '#fff', backgroundColor: '#9b2c2c' }}>
          {error}
        </div>
      )}

      {/* Filter Panel */}
      <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e0', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#2d3748', fontSize: '14px', fontWeight: 'bold' }}>Filter & Search</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '11px', color: '#6d7c82', marginBottom: '6px' }}>Vendor Name</label>
            <input
              type="text"
              value={filterVendor}
              onChange={(e) => setFilterVendor(e.target.value)}
              placeholder="Search by vendor..."
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e0', fontSize: '13px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '11px', color: '#6d7c82', marginBottom: '6px' }}>Start Date</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e0', fontSize: '13px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '11px', color: '#6d7c82', marginBottom: '6px' }}>End Date</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e0', fontSize: '13px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '11px', color: '#6d7c82', marginBottom: '6px' }}>Total Records</label>
            <div style={{ padding: '8px', backgroundColor: '#f7fafc', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold' }}>
              {sortedData.length}
            </div>
          </div>
        </div>
      </div>

      {/* Ledger Grid Table */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #cbd5e0', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#718096' }}>
            ⏳ Loading AP ledger records...
          </div>
        ) : sortedData.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#a0aec0' }}>
            No AP invoices found matching current filters
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f7fafc', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                <th 
                  onClick={() => handleSort('invoice_number')}
                  style={{ padding: '12px', fontSize: '12px', fontWeight: 'bold', color: '#2d3748', cursor: 'pointer', userSelect: 'none' }}
                >
                  Invoice # {sortConfig.key === 'invoice_number' && (sortConfig.direction === 'ASC' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('vendor_name')}
                  style={{ padding: '12px', fontSize: '12px', fontWeight: 'bold', color: '#2d3748', cursor: 'pointer', userSelect: 'none' }}
                >
                  Vendor Name {sortConfig.key === 'vendor_name' && (sortConfig.direction === 'ASC' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('invoice_date')}
                  style={{ padding: '12px', fontSize: '12px', fontWeight: 'bold', color: '#2d3748', cursor: 'pointer', userSelect: 'none' }}
                >
                  Invoice Date {sortConfig.key === 'invoice_date' && (sortConfig.direction === 'ASC' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('total_amount')}
                  style={{ padding: '12px', fontSize: '12px', fontWeight: 'bold', color: '#2d3748', cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
                >
                  Total Amount {sortConfig.key === 'total_amount' && (sortConfig.direction === 'ASC' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('created_at')}
                  style={{ padding: '12px', fontSize: '12px', fontWeight: 'bold', color: '#2d3748', cursor: 'pointer', userSelect: 'none' }}
                >
                  Posted Date {sortConfig.key === 'created_at' && (sortConfig.direction === 'ASC' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((invoice, idx) => (
                <tr 
                  key={idx} 
                  style={{ 
                    borderBottom: '1px solid #edf2f7',
                    backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#fff' : '#f9fafb'}
                >
                  <td style={{ padding: '12px', fontSize: '13px', fontWeight: 'bold', color: '#2d3748' }}>
                    {invoice.invoice_number}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: '#4a5568' }}>
                    {invoice.vendor_name}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: '#4a5568' }}>
                    {new Date(invoice.invoice_date).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', fontWeight: 'bold', color: '#2d3748', textAlign: 'right' }}>
                    ${parseFloat(invoice.total_amount).toFixed(2)}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: '#718096' }}>
                    {new Date(invoice.created_at).toLocaleDateString()} {new Date(invoice.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary Footer */}
      {sortedData.length > 0 && (
        <div style={{ marginTop: '20px', backgroundColor: '#f7fafc', padding: '16px', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', border: '1px solid #cbd5e0' }}>
          <div>
            <span style={{ color: '#718096', fontSize: '11px', fontWeight: 'bold' }}>TOTAL INVOICES</span>
            <p style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#2d3748' }}>{sortedData.length}</p>
          </div>
          <div>
            <span style={{ color: '#718096', fontSize: '11px', fontWeight: 'bold' }}>TOTAL AP AMOUNT</span>
            <p style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#2d3748' }}>
              ${sortedData.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0).toFixed(2)}
            </p>
          </div>
          <div>
            <span style={{ color: '#718096', fontSize: '11px', fontWeight: 'bold' }}>UNIQUE VENDORS</span>
            <p style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#2d3748' }}>
              {new Set(sortedData.map(inv => inv.vendor_name)).size}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApLedgerPage;
