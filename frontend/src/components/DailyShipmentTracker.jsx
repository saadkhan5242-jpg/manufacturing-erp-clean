import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient.js';

export default function DailyShipmentTracker() {
  const [shipments, setShipments] = useState([]);
  const [metrics, setMetrics] = useState({ totalScheduledToday: 0, totalShippedToday: 0, pastDue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Dynamic fetch query targeting your unified proxy route endpoint links
    apiClient.get('/api/dashboard/daily-shipments')
      .then(data => {
        if (data) {
          setShipments(data.shipments || []);
          setMetrics(data.metrics || { totalScheduledToday: 0, totalShippedToday: 0, pastDue: 0 });
        }
      })
      .catch(err => console.error("Fulfillment engine retrieval warning:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ backgroundColor: "#f1f5f9", border: "3px solid #475569", fontFamily: "monospace", width: "100%", color: "#000", padding: "16px" }}>
      
      {/* Module Title Bar */}
      <div style={{ backgroundColor: "#0284c7", color: "#fff", padding: "8px 12px", fontWeight: "bold", fontSize: "13px", marginBottom: "16px", border: "1px solid #0369a1", textTransform: "uppercase" }}>
        📦 LOGISTICS & SHIPPING — DAILY SHIPMENT DISPATCH STATUS MATRIX
      </div>

      {/* Industrial Hardware KPI Tickers Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
        <div style={{ backgroundColor: "#fff", border: "2px solid #cbd5e1", padding: "10px" }}>
          <span style={{ display: "block", fontSize: "10px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Slated to Ship Today:</span>
          <span style={{ fontSize: "20px", fontWeight: "black", color: "#1e293b" }}>{metrics.totalScheduledToday} Orders</span>
        </div>
        <div style={{ backgroundColor: "#fff", border: "2px solid #cbd5e1", padding: "10px" }}>
          <span style={{ display: "block", fontSize: "10px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Dispatched / Loaded:</span>
          <span style={{ fontSize: "20px", fontWeight: "black", color: "#16a34a" }}>{metrics.totalShippedToday} Freight LTL</span>
        </div>
        <div style={{ backgroundColor: "#fff", border: "2px solid #cbd5e1", padding: "10px" }}>
          <span style={{ display: "block", fontSize: "10px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Past Due Shipping Backlog:</span>
          <span style={{ fontSize: "20px", fontWeight: "black", color: metrics.pastDue > 0 ? "#dc2626" : "#475569" }}>{metrics.pastDue} BACKLOG</span>
        </div>
      </div>

      {/* High-Density Shipping Ledger Spreadsheet Matrix Layout */}
      <div style={{ backgroundColor: "#fff", border: "2px solid #cbd5e1" }}>
        <div style={{ backgroundColor: "#475569", color: "#fff", fontSize: "11px", fontWeight: "bold", padding: "6px 12px", textTransform: "uppercase" }}>
          ● ACTIVE DOCK MANIFEST DISPATCH QUEUE LINES
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", textAligh: "left", fontSize: "12px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #cbd5e1", fontWeight: "900", textTransform: "uppercase" }}>
              <th style={{ padding: "8px", borderRight: "1px solid #cbd5e1" }}>Job #</th>
              <th style={{ padding: "8px", borderRight: "1px solid #cbd5e1" }}>Material Item ID</th>
              <th style={{ padding: "8px", borderRight: "1px solid #cbd5e1", textAligh: "center" }}>Volume Qty</th>
              <th style={{ padding: "8px", borderRight: "1px solid #cbd5e1" }}>Assigned Carrier</th>
              <th style={{ padding: "8px", textAligh: "center" }}>Logistical Stage</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ padding: "20px", textAligh: "center", color: "#64748b", fontWeight: "bold" }}>STREAMS SEARCHING CLOUD SHIPMENT LEDGER...</td></tr>
            ) : shipments.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: "20px", textAligh: "center", color: "#64748b", fontWeight: "bold" }}>NO ACTIVE SHIPPING MANIFEST LINES FOUND FOR THE SELECTION TIMEFRAME.</td></tr>
            ) : (
              shipments.map((line, idx) => (
                <tr key={line.id || idx} style={{ borderBottom: "1px solid #e2e8f0", fontWeight: "bold" }}>
                  <td style={{ padding: "8px", borderRight: "1px solid #cbd5e1", color: "#2563eb" }}>{line.jobId}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #cbd5e1" }}>{line.partNumber}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #cbd5e1", textAligh: "center" }}>{line.quantity}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #cbd5e1", color: "#475569" }}>{line.carrier}</td>
                  <td style={{ padding: "8px", textAligh: "center" }}>
                    <span style={{ 
                      backgroundColor: line.status === "SHIPPED" ? "#dcfce7" : line.status === "DELAYED" ? "#fee2e2" : "#fef9c3",
                      color: line.status === "SHIPPED" ? "#15803d" : line.status === "DELAYED" ? "#991b1b" : "#854d0e",
                      padding: "2px 8px", fontSize: "10px", fontWeight: "black", textTransform: "uppercase", border: "1px solid rgba(0,0,0,0.05)"
                    }}>
                      {line.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
