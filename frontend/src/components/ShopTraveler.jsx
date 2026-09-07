import { useState, useEffect, useRef } from "react";
import apiClient from "../lib/apiClient.js";

// Barcode is declared at module scope so React does not remount it on every render.
// Renders a mock 1D barcode from a deterministic bar pattern derived from the value.
function Barcode({ value }) {
  const bars = Array.from({ length: 32 }, (_, i) => (String(value).charCodeAt(i % String(value).length) + i) % 3 !== 0);
  return (
    <div className="flex items-end gap-[2px] h-14 print:h-12" title={value}>
      {bars.map((wide, i) => (
        <div key={i} className={`bg-slate-900 ${wide ? "w-[3px]" : "w-[1px]"} h-full`} />
      ))}
    </div>
  );
}

/**
 * ShopTraveler — print-optimized manufacturing routing document.
 * Tracks a Work Order, part number, and target quantities with a
 * sequential operational routing grid (Step 10 CNC_MILL, Step 20
 * ASSEMBLY) and scannable 1D barcode blocks per operation.
 */
function ShopTraveler({ workOrderId = "WO-1001", partNumber = "PRT-990-STEEL", quantityOrdered = 50, quantityCompleted = 0 }) {
  const printAreaRef = useRef();
  const [steps, setSteps] = useState([
    { seq: 10, workCenter: "CNC_MILL", description: "CNC Milling — profile face & drilled bore", estimatedHours: 4.0, actualHours: 0, status: "READY" },
    { seq: 20, workCenter: "ASSY_01", description: "Final Assembly — deburr & press fit bearings", estimatedHours: 2.5, actualHours: 0, status: "PENDING" }
  ]);

  useEffect(() => {
    let cancelled = false;
    // Updated path to use local proxy configurations to prevent network layer drops
    apiClient.get("/api/dashboard/live-jobs")
      .then((data) => {
        if (cancelled || !data) return;
        // Search across the live active operational job collection arrays
        const activeJob = (data.jobs || []).find((job) => String(job.orderNumber) === String(workOrderId) || String(job.id) === String(workOrderId));
        if (activeJob) {
          setSteps([
            {
              seq: 10,
              workCenter: "CNC_MILL",
              description: "CNC Milling — profile face & drilled bore",
              estimatedHours: parseFloat(activeJob.estimatedHours || 4.0),
              actualHours: parseFloat(activeJob.actualHours || 0.0),
              status: activeJob.actualHours > 0 ? "In-Progress" : "READY"
            }
          ]);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [workOrderId]);

  // Secure print isolation function to print the slip without breaking the React canvas state
  const handlePrintTraveler = () => {
    const printContent = printAreaRef.current.innerHTML;
    const originalContent = document.body.innerHTML;
    
    document.body.innerHTML = printContent;
    window.print();
    
    // Restore the window frame instantly
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  return (
    <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl max-w-4xl mx-auto shadow-2xl text-slate-100 font-mono">
      {/* Management Action Tray Component */}
      <div className="flex justify-between items-center border-b border-slate-700 pb-4 mb-6 no-print">
        <div>
          <h2 className="text-xl font-bold tracking-wider text-blue-400">📄 SHOP TRAVELER MANAGER</h2>
          <p className="text-xs text-slate-400">Shop Floor Control (SFC) — Blueprint Router Dispatches</p>
        </div>
        <button 
          onClick={handlePrintTraveler}
          className="bg-blue-600 hover:bg-blue-500 font-bold px-4 py-2 rounded text-white tracking-widest text-xs transition shadow-md uppercase"
        >
          🖨️ Print Traveler Document
        </button>
      </div>

      {/* Target Sheet Canvas Area Wrapper */}
      <div ref={printAreaRef} className="bg-white text-slate-900 p-8 rounded-lg shadow-inner print:p-0 print:bg-white">
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body { background: white !important; color: black !important; font-family: monospace !important; }
            .no-print { display: none !important; }
          }
        `}} />
        
        {/* Header Link Info */}
        <div className="flex justify-between items-start border-b-4 border-slate-900 pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">SHOP TRAVELER ROUTING SLIP</h1>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">Manufacturing Routing Document — GSS Standard</p>
          </div>
          <div className="text-right flex flex-col items-end">
            <Barcode value={workOrderId} />
            <div className="text-xs font-mono mt-1 tracking-[0.3em] font-bold text-slate-800">*{workOrderId}*</div>
          </div>
        </div>

        {/* Job Header Info Cards Data Grid */}
        <div className="grid grid-cols-4 gap-4 mb-6 text-sm">
          <div className="border-2 border-slate-300 rounded p-3 bg-slate-50">
            <div className="text-[10px] uppercase text-slate-500 font-black tracking-wide">Work Order Row</div>
            <div className="font-black text-lg text-slate-900">{workOrderId}</div>
          </div>
          <div className="border-2 border-slate-300 rounded p-3 bg-slate-50">
            <div className="text-[10px] uppercase text-slate-500 font-black tracking-wide">Part Number ID</div>
            <div className="font-black text-lg text-slate-900">{partNumber}</div>
          </div>
          <div className="border-2 border-slate-300 rounded p-3 bg-slate-50">
            <div className="text-[10px] uppercase text-slate-500 font-black tracking-wide">Quantity Ordered</div>
            <div className="font-black text-lg text-blue-600">{quantityOrdered}</div>
          </div>
          <div className="border-2 border-slate-300 rounded p-3 bg-slate-50">
            <div className="text-[10px] uppercase text-slate-500 font-black tracking-wide">Quantity Completed</div>
            <div className="font-black text-lg text-emerald-600">{quantityCompleted}</div>
          </div>
        </div>

        {/* Sequential Manufacturing Routing Tracking Matrix */}
        <table className="w-full border-collapse text-xs mb-6 border-2 border-slate-900">
          <thead>
            <tr className="bg-slate-900 text-white text-left font-black uppercase text-[10px]">
              <th className="px-3 py-2 border border-slate-700 w-12 text-center">Step</th>
              <th className="px-3 py-2 border border-slate-700 w-24">Work Center</th>
              <th className="px-3 py-2 border border-slate-700">Operation Specifications Description</th>
              <th className="px-3 py-2 border border-slate-700 w-16 text-center">Est Hrs</th>
              <th className="px-3 py-2 border border-slate-700 w-16 text-center">Act Hrs</th>
              <th className="px-3 py-2 border border-slate-700 w-20 text-center">Stage</th>
              <th className="px-3 py-2 border border-slate-900 w-40 text-center bg-slate-800">Scan Operation</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.seq} className="border-b-2 border-slate-300 align-middle h-16 bg-white font-bold text-slate-800">
                <td className="px-3 py-2 border border-slate-300 font-black text-center text-sm text-slate-900">{step.seq}</td>
                <td className="px-3 py-2 border border-slate-300 text-center">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-800 text-white tracking-wide uppercase">{step.workCenter}</span>
                </td>
                <td className="px-3 py-2 border border-slate-300 text-slate-700 font-medium pr-4">{step.description}</td>
                <td className="px-3 py-2 border border-slate-300 text-center text-slate-600 font-bold">{Number(step.estimatedHours).toFixed(2)}</td>
                <td className="px-3 py-2 border border-slate-300 text-center text-blue-600 font-bold">{Number(step.actualHours).toFixed(2)}</td>
                <td className="px-3 py-2 border border-slate-300 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${step.status === "Completed" ? "bg-emerald-100 text-emerald-700" : step.status === "In-Progress" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>
                    {step.status}
                  </span>
                </td>
                <td className="px-3 py-2 border border-slate-300 bg-slate-50/50 flex flex-col items-center justify-center h-16">
                  <Barcode value={`${workOrderId}-${step.seq}`} />
                  <span className="text-[8px] font-black tracking-widest text-slate-500 mt-0.5">*{workOrderId}-{step.seq}*</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Quality Validation & Inspection Sign-Off Footer */}
        <div className="grid grid-cols-3 gap-6 text-[10px] text-slate-500 mt-8 pt-4 border-t border-slate-200">
          {["Machine Operator Stamp", "Quality Inspector Log", "Floor Supervisor Bypass"].map((role) => (
            <div key={role} className="border-t-2 border-dashed border-slate-400 pt-2">
              <div className="uppercase tracking-wider font-black text-slate-700">{role}</div>
              <div className="text-slate-400 mt-6 font-medium">Verification Stamp / Date</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ShopTraveler;
