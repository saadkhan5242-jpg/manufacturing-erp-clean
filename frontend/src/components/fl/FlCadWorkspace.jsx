import { useState } from "react";
import apiClient from "../../lib/apiClient.js";

/**
 * FlCadWorkspace — CAD upload + AI feature extraction. Upload STEP/DXF/DWG/STL,
 * get extracted features, machining notes, and estimated cycle time. Attaches
 * files to jobs/quotes/travelers.
 */
function FlCadWorkspace() {
  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const ACCEPTED = ".step,.stp,.dxf,.dwg,.stl,.pdf";

  const upload = async (e) => {
    e.preventDefault();
    if (!file) { setError("Select a CAD file first."); return; }
    setBusy(true); setError(""); setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (jobId) formData.append("jobId", jobId);
      const data = await apiClient.post("/api/fl/cad/upload", formData);
      setResult(data);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div style={{ fontFamily: "monospace", color: "#e2e8f0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
      {/* Upload panel */}
      <form onSubmit={upload} style={{ backgroundColor: "#1e293b", border: "1px solid #334155", padding: "16px" }}>
        <div style={{ fontWeight: "900", marginBottom: "12px", color: "#f8fafc" }}>📐 CAD UPLOAD & FEATURE EXTRACTION</div>

        <label style={{ display: "block", border: "2px dashed #475569", padding: "30px", textAlign: "center", cursor: "pointer", backgroundColor: "#0f172a", marginBottom: "12px" }}>
          <input type="file" accept={ACCEPTED} style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>📁</div>
          <div style={{ fontSize: "12px", color: "#94a3b8" }}>{file ? file.name : "Drop STEP / DXF / DWG / STL / PDF here or click to browse"}</div>
          {file && <div style={{ fontSize: "10px", color: "#64748b", marginTop: "4px" }}>{(file.size / 1024).toFixed(1)} KB</div>}
        </label>

        <label style={{ display: "block", fontSize: "10px", color: "#94a3b8", marginBottom: "4px", fontWeight: "bold" }}>ATTACH TO JOB # (optional)</label>
        <input value={jobId} onChange={(e) => setJobId(e.target.value)} placeholder="e.g. 12" style={{ width: "100%", backgroundColor: "#0f172a", border: "1px solid #334155", color: "#e2e8f0", padding: "8px", marginBottom: "12px", fontFamily: "monospace", fontSize: "12px" }} />

        <button type="submit" disabled={busy} style={{ width: "100%", backgroundColor: "#0ea5e9", color: "#fff", padding: "12px", fontWeight: "bold", border: "none", cursor: "pointer" }}>
          {busy ? "ANALYZING GEOMETRY…" : "🔍 EXTRACT FEATURES & ESTIMATE"}
        </button>
        {error && <div style={{ marginTop: "10px", fontSize: "11px", color: "#f87171", fontWeight: "bold" }}>❌ {error}</div>}
      </form>

      {/* Result panel */}
      <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", padding: "16px" }}>
        <div style={{ fontWeight: "900", marginBottom: "12px", color: "#f8fafc" }}>🧬 EXTRACTED FEATURES & CYCLE ESTIMATE</div>
        {!result && <div style={{ color: "#64748b", fontSize: "12px", padding: "30px", textAlign: "center" }}>Upload a CAD file to see AI-extracted machining data.</div>}
        {result && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
              <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", padding: "10px" }}>
                <div style={{ fontSize: "10px", color: "#64748b" }}>EST. CYCLE TIME</div>
                <div style={{ fontSize: "22px", fontWeight: "900", color: "#38bdf8" }}>{result.estimatedCycleMinutes} min</div>
              </div>
              <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", padding: "10px" }}>
                <div style={{ fontSize: "10px", color: "#64748b" }}>VOLUME</div>
                <div style={{ fontSize: "22px", fontWeight: "900", color: "#38bdf8" }}>{result.extractedFeatures.volumeCm3} cm³</div>
              </div>
            </div>
            <div style={{ fontSize: "11px", marginBottom: "10px" }}>
              <div style={{ color: "#94a3b8", fontWeight: "bold", marginBottom: "4px" }}>FEATURE COUNTS</div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {Object.entries(result.extractedFeatures.featureCounts).map(([k, v]) => (
                  <span key={k} style={{ backgroundColor: "#0f172a", border: "1px solid #334155", padding: "4px 8px", color: "#cbd5e1" }}>{k}: <b style={{ color: "#f8fafc" }}>{v}</b></span>
                ))}
              </div>
            </div>
            <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", padding: "10px", fontSize: "11px", color: "#fbbf24", lineHeight: 1.6 }}>
              <div style={{ color: "#94a3b8", fontWeight: "bold", marginBottom: "4px" }}>🛠️ MACHINING NOTES</div>
              {result.machiningNotes}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default FlCadWorkspace;
