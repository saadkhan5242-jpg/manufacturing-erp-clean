import { useState, useRef, useEffect } from 'react';
import apiClient from '../lib/apiClient.js';

export default function ShopFloorTerminal() {
  const [employeeId, setEmployeeId] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [sequence, setSequence] = useState('');
  const [workCode, setWorkCode] = useState('R'); // Default to R for Run, S for Setup
  const [statusBar, setStatusBar] = useState('READY FOR BARCODE SCANNER INPUT OR MANUAL ENTRY...');

  const employeeRef = useRef(null);

  // Auto-focus on Employee Number field on boot matching GSS hardware defaults
  useEffect(() => {
    if (employeeRef.current) employeeRef.current.focus();
  }, []);

  const handleProcessPunch = async (e) => {
    e.preventDefault();
    if (!employeeId || !workOrderId || !sequence) {
      setStatusBar('❌ GSS INVALID INPUT DATA: SUBMIT REJECTED BY HOST SYSTEM');
      return;
    }

    try {
      setStatusBar('COMMUNICATING TRANSACTION STREAM WITH ERP DATABASE...');
      try {
        await apiClient.post('/api/shop-floor/labor-log', { employeeId, workOrderId, sequence, workCode });
        setStatusBar(`✅ PUNCH SUCCESSFUL: RECORD LOGGED FOR EMP ${employeeId} ON WO-${workOrderId}`);
        setEmployeeId('');
        setWorkOrderId('');
        setSequence('');
        if (employeeRef.current) employeeRef.current.focus();
      } catch (requestError) {
        setStatusBar(`❌ GSS DATABASE REJECTION: ${requestError.message}`);
      }
    } catch (err) {
      console.error(err);
      setStatusBar('❌ CONNECTION FAULT: CANNOT REACH CORE ERP BACKEND ENGINE');
    }
  };

  return (
    <div style={{ backgroundColor: "#f1f5f9", border: "3px solid #64748b", fontFamily: "monospace", width: "100%", maxWidth: "800px", margin: "20px auto", color: "#000", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)" }}>
      
      {/* 1. GSS Fixed Top Function Action Status Bar */}
      <div style={{ display: "flex", backgroundColor: "#cbd5e1", borderBottom: "3px solid #64748b", fontWeight: "bold", fontSize: "14px" }}>
        <div style={{ backgroundColor: "#eab308", color: "#000", padding: "10px 20px", borderRight: "3px solid #64748b" }}>
          [ F1 - LOG IN ]
        </div>
        <div style={{ padding: "10px 16px", color: "#1e293b", textTransform: "uppercase" }}>
          Shop Floor Data Collection (SFDC) Client Terminal
        </div>
      </div>

      {/* 2. Core Operational Data Intake Matrix Wrapper Form */}
      <form onSubmit={handleProcessPunch} style={{ padding: "30px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        
        {/* Left Side Entry Field Columns Block */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          <div style={{ display: "flex", alignItems: "center" }}>
            <label style={{ width: "160px", fontWeight: "bold", fontSize: "13px", textTransform: "uppercase" }}>Employee Number:</label>
            <input 
              ref={employeeRef}
              value={employeeId} 
              onChange={e => setEmployeeId(e.target.value)}
              type="text" 
              style={{ flexGrow: 1, backgroundColor: "#fff", border: "2px solid #94a3b8", padding: "6px 10px", fontSize: "16px", fontWeight: "bold", textTransform: "uppercase" }} 
            />
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <label style={{ width: "160px", fontWeight: "bold", fontSize: "13px", textTransform: "uppercase" }}>Work Order Number:</label>
            <input 
              value={workOrderId} 
              onChange={e => setWorkOrderId(e.target.value)}
              type="text" 
              style={{ flexGrow: 1, backgroundColor: "#fff", border: "2px solid #94a3b8", padding: "6px 10px", fontSize: "16px", fontWeight: "bold", textTransform: "uppercase" }} 
            />
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <label style={{ width: "160px", fontWeight: "bold", fontSize: "13px", textTransform: "uppercase" }}>Sequence Number:</label>
            <input 
              value={sequence} 
              onChange={e => setSequence(e.target.value)}
              type="text" 
              style={{ width: "100px", backgroundColor: "#fff", border: "2px solid #94a3b8", padding: "6px 10px", fontSize: "16px", fontWeight: "bold", textTransform: "uppercase" }} 
            />
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <label style={{ width: "160px", fontWeight: "bold", fontSize: "13px", textTransform: "uppercase" }}>Work Code Type:</label>
            <select 
              value={workCode} 
              onChange={e => setWorkCode(e.target.value)}
              style={{ width: "160px", backgroundColor: "#fff", border: "2px solid #94a3b8", padding: "6px 10px", fontSize: "14px", fontWeight: "bold" }}
            >
              <option value="R">R - PRODUCTION RUN</option>
              <option value="S">S - SETUP TIME</option>
              <option value="I">I - INDIRECT LABOR</option>
            </select>
          </div>

        </div>

        {/* Right Side Industrial Hardware System Message Block */}
        <div style={{ display: "flex", flexDirection: "column", justifyContnet: "space-between", border: "2px dashed #94a3b8", padding: "20px", backgroundColor: "#f8fafc" }}>
          <div>
            <span style={{ display: "block", fontSize: "11px", fontWeight: "bold", color: "#64748b", marginBottom: "6px", textTransform: "uppercase" }}>📟 Peripheral Hardware Instructions:</span>
            <p style={{ margin: 0, fontSize: "11px", color: "#334155", lineHeight: "1.5" }}>
              Scan employee badge barcode string sequence first. The hardware scanner will fire an automated tab return code to cycle inputs directly forward to the Work Order Traveler block coordinates.
            </p>
          </div>

          {/* Heavy Duty Solid Action Execution Button Component Block */}
          <button 
            type="submit" 
            style={{ width: "100%", backgroundColor: "#0284c7", color: "#fff", border: "2px solid #0369a1", padding: "12px", fontSize: "14px", fontWeight: "bold", letterSpacing: "1px", cursor: "pointer", textTransform: "uppercase", marginTop: "16px" }}
          >
            Execute Terminal Punch [ Enter ]
          </button>
        </div>

      </form>

      {/* 3. Bottom Ticker System Information Line */}
      <div style={{ backgroundColor: "#334155", color: "#cbd5e1", padding: "8px 16px", fontSize: "11px", fontWeight: "bold", borderTop: "3px solid #64748b" }}>
        STATUS LOGS: {statusBar}
      </div>

    </div>
  );
}
