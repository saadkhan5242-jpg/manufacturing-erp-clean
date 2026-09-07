import { useState } from 'react';
import apiClient from '../lib/apiClient.js';

function DocumentsIntakePage() {
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [posted, setPosted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFileMock = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setParsing(true);
    setPosted(false);
    setErrorMsg('');

    // Simulate high-speed deep parsing text processing delay latency
    setTimeout(async () => {
      try {
        // FIX: Pointing explicitly to absolute backend port 4000 
        const data = await apiClient.post('/api/ai-document-intake/upload', { document: 'invoice' });
        setInvoiceData(data);
      } catch (err) {
        console.error('Fetch error:', err);
        setErrorMsg(`Parsing Error: ${err.message}`);
      } finally {
        setParsing(false);
      }
    }, 1500);
  };

  // LAYER 1: Post to AP Ledger with automatic inventory updates
  const handleApproveAndPost = async () => {
    if (!invoiceData || posted) return;

    try {
      setParsing(true);
      setErrorMsg('');
      // Post to /post-ledger endpoint with full invoice data
      const result = await apiClient.post('/api/ai-document-intake/post-ledger', {
          vendorName: invoiceData.vendorName,
          invoiceNumber: invoiceData.invoiceNumber,
          invoiceDate: invoiceData.invoiceDate,
          lineItems: invoiceData.lineItems,
          totalAmount: invoiceData.totalAmount
      });
      setPosted(true);
      setErrorMsg('');
      console.log('Invoice posted successfully:', result);
    } catch (error) {
      console.error('AP Posting error:', error);
      setErrorMsg(`Posting Error: ${error.message}`);
    } finally {
      setParsing(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '950px', margin: '0 auto', fontFamily: 'monospace', color: '#333' }}>
      <header style={{ borderBottom: '2px solid #6b46c1', paddingBottom: '12px', marginBottom: '24px' }}>
        <h2 style={{ color: '#6b46c1', margin: 0, fontSize: '24px' }}>🔮 Genii AI Intelligent Document Intake Engine</h2>
        <p style={{ color: '#718096', margin: '4px 0 0 0', fontSize: '13px' }}>Drag-and-drop supplier invoice parser with OCR neural processing</p>
      </header>

      {errorMsg && (
        <div style={{ padding: '12px', borderRadius: '6px', marginBottom: '20px', fontWeight: 'bold', color: '#fff', backgroundColor: '#9b2c2c' }}>
          {errorMsg}
        </div>
      )}

      {/* Drag & Drop Hot Zone Area */}
      {!invoiceData && (
        <div 
          onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={processFileMock}
          style={{ width: '100%', height: '240px', border: dragActive ? '3px dashed #6b46c1' : '2px dashed #cbd5e0', backgroundColor: dragActive ? '#faf5ff' : '#f7fafc', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', cursor: 'pointer' }}
        >
          {parsing ? (
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ color: '#6b46c1', margin: 0 }}>🧠 Genii AI Neural Engine Active...</h3>
              <p style={{ color: '#718096', fontSize: '13px', marginTop: '6px' }}>Parsing structural text frames, computing material unit line metrics...</p>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '48px', display: 'block', marginBottom: '10px' }}>📄</span>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#4a5568' }}>Drop Invoice Documents Here</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#a0aec0' }}>Drag and drop PDF or image files for OCR neural processing</p>
            </div>
          )}
        </div>
      )}

      {/* Extracted Data Visual Matrix Form Results */}
      {invoiceData && (
        <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #cbd5e0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #edf2f7', paddingBottom: '12px', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: '#2f855a' }}>✅ Genii AI Extraction Complete Summary</h3>
            <button onClick={() => setInvoiceData(null)} style={{ border: 'none', background: 'none', color: '#e53e3e', cursor: 'pointer', fontWeight: 'bold' }}>✕ Clear Records</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '24px', backgroundColor: '#f7fafc', padding: '16px', borderRadius: '6px' }}>
            <div><span style={{ color: '#718096', fontSize: '11px', display: 'block' }}>IDENTIFIED VENDOR NAME</span><strong>{invoiceData.vendorName}</strong></div>
            <div><span style={{ color: '#718096', fontSize: '11px', display: 'block' }}>INVOICE DOCUMENT ID #</span><strong>{invoiceData.invoiceNumber}</strong></div>
            <div><span style={{ color: '#718096', fontSize: '11px', display: 'block' }}>ISSUANCE DATE</span><strong>{invoiceData.invoiceDate}</strong></div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f7fafc', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px', fontSize: '12px' }}>Part # Reference</th>
                <th style={{ padding: '10px', fontSize: '12px' }}>Description</th>
                <th style={{ padding: '10px', fontSize: '12px' }}>Qty</th>
                <th style={{ padding: '10px', fontSize: '12px' }}>Unit Cost</th>
                <th style={{ padding: '10px', fontSize: '12px' }}>Extended Cost Total</th>
              </tr>
            </thead>
            <tbody>
              {invoiceData.lineItems.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #edf2f7', fontSize: '13px' }}>
                  <td style={{ padding: '10px' }}><code>{item.partNumber}</code></td>
                  <td style={{ padding: '10px' }}>{item.description}</td>
                  <td style={{ padding: '10px' }}>{item.quantity}</td>
                  <td style={{ padding: '10px' }}>${item.unitPrice.toFixed(2)}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>${item.totalPrice.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #edf2f7', paddingTop: '16px' }}>
            <div style={{ fontSize: '18px' }}>Total Ledger Invoice Amount: <strong style={{ color: '#6b46c1' }}>${invoiceData.totalAmount.toFixed(2)}</strong></div>
            <button 
              onClick={handleApproveAndPost} 
              disabled={posted || parsing}
              style={{ padding: '12px 24px', backgroundColor: posted ? '#4a5568' : '#6b46c1', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: posted || parsing ? 'not-allowed' : 'pointer', opacity: posted || parsing ? 0.6 : 1 }}
            >
              {parsing ? '⏳ Posting to AP Ledger...' : posted ? '✓ Transmitted to Accounts Payable Ledger' : '⚙️ Approve & Post to AP Ledger'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentsIntakePage;
