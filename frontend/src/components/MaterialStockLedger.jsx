import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient.js';

export default function MaterialStockLedger() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Dynamic network fetch scanning your active Neon cloud parts catalogs
    apiClient.get('/api/inventory/stock-ledger')
      .then((data) => setMaterials(Array.isArray(data) ? data : data?.items || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ backgroundColor: "#f1f5f9", border: "3px solid #16a34a", fontFamily: "monospace", width: "100%", color: "#000", padding: "16px" }}>
      
      {/* High Density Module Status Header */}
      <div style={{ backgroundColor: "#16a34a", color: "#fff", padding: "8px 12px", fontWeight: "bold", fontSize: "13px", marginBottom: "16px", border: "1px solid #15803d", textTransform: "uppercase" }}>
        📦 MATERIAL MASTER — WAREHOUSE STOCK BALANCES & RAW INVENTORY LEDGER
      </div>

      {/* Spreadsheet Matrix Row Cards */}
      <div style={{ backgroundColor: "#fff", border: "2px solid #cbd5e1" }}>
        <div style={{ backgroundColor: "#475569", color: "#fff", fontSize: "11px", fontWeight: "bold", padding: "6px 12px", textTransform: "uppercase" }}>
          ● LIVE MATERIAL REORDER POINT & BALANCES QUANTITY ON HAND
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", textAligh: "left", fontSize: "12px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #cbd5e1", fontWeight: "900", textTransform: "uppercase" }}>
              <th style={{ padding: "8px", borderRight: "1px solid #cbd5e1" }}>Material Item ID</th>
              <th style={{ padding: "8px", borderRight: "1px solid #cbd5e1" }}>Specification Description</th>
              <th style={{ padding: "8px", borderRight: "1px solid #cbd5e1", textAligh: "center" }}>Qty On Hand</th>
              <th style={{ padding: "8px", borderRight: "1px solid #cbd5e1", textAligh: "center" }}>UOM</th>
              <th style={{ padding: "8px", textAligh: "center" }}>Standard Cost</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ padding: "20px", textAligh: "center", color: "#64748b", fontWeight: "bold" }}>STREAMING LIVE MATERIAL QUANTITIES FROM NEON CLOUD...</td></tr>
            ) : error ? (
              <tr><td colSpan="5" style={{ padding: "20px", textAlign: "center", color: "#b91c1c", fontWeight: "bold" }}>{error}</td></tr>
            ) : materials.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: "20px", textAlign: "center", color: "#64748b", fontWeight: "bold" }}>No inventory records found.</td></tr>
            ) : (
              materials.map((item, idx) => (
                <tr key={item.id || idx} style={{ borderBottom: "1px solid #cbd5e1", fontWeight: "bold" }}>
                  <td style={{ padding: "8px", borderRight: "1px solid #cbd5e1", color: "#16a34a" }}>{item.partNumber}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #cbd5e1" }}>{item.description}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #cbd5e1", textAlign: "center", color: Number(item.quantity) > 20 ? "#16a34a" : "#dc2626" }}>{item.quantity}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #cbd5e1", textAlign: "center" }}>{item.unit}</td>
                  <td style={{ padding: "8px", textAlign: "center", color: "#64748b" }}>${Number(item.unitPrice || 0).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
