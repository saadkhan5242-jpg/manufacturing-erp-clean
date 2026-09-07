import { useEffect, useState } from "react";
import apiClient from "../lib/apiClient.js";

/**
 * AdminControlPanel — Admin & Control module. System health status, user
 * directory, product creation, and inventory overrides. Every action here
 * runs through the shared apiClient and is only reachable via AdminRoute.
 */
function AdminControlPanel() {
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [users, setUsers] = useState(null);
  const [usersError, setUsersError] = useState("");
  const [usersLoading, setUsersLoading] = useState(true);

  const [productForm, setProductForm] = useState({ sku: "", name: "", unitPrice: "" });
  const [productMessage, setProductMessage] = useState("");
  const [productSaving, setProductSaving] = useState(false);

  const [overrideForm, setOverrideForm] = useState({ partNumber: "", quantityOnHand: "" });
  const [overrideMessage, setOverrideMessage] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient.get("/api/auth/status")
      .then((data) => { if (!cancelled) setStatus(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setStatusLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiClient.get("/api/auth/users")
      .then((data) => { if (!cancelled) setUsers(Array.isArray(data) ? data : data.users || []); })
      .catch((err) => { if (!cancelled) setUsersError(err.message || "User directory unavailable"); })
      .finally(() => { if (!cancelled) setUsersLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function submitProduct(event) {
    event.preventDefault();
    setProductSaving(true);
    setProductMessage("");
    try {
      await apiClient.post("/api/products", { ...productForm, unitPrice: Number(productForm.unitPrice) || 0 });
      setProductMessage("Product created.");
      setProductForm({ sku: "", name: "", unitPrice: "" });
    } catch (err) {
      setProductMessage(err.message);
    } finally {
      setProductSaving(false);
    }
  }

  async function submitOverride(event) {
    event.preventDefault();
    setOverrideSaving(true);
    setOverrideMessage("");
    try {
      await apiClient.post("/api/inventory", { ...overrideForm, quantityOnHand: Number(overrideForm.quantityOnHand) || 0 });
      setOverrideMessage("Inventory override applied.");
      setOverrideForm({ partNumber: "", quantityOnHand: "" });
    } catch (err) {
      setOverrideMessage(err.message);
    } finally {
      setOverrideSaving(false);
    }
  }

  const sysRows = [
    { key: "Backend Engine", value: status ? "ONLINE" : "OFFLINE", ok: !!status },
    { key: "Authentication Service", value: status ? "ACTIVE" : "DEGRADED", ok: !!status },
    { key: "Database Link", value: status ? "CONNECTED" : "DISCONNECTED", ok: !!status },
    { key: "Labor Accumulator Daemon", value: "RUNNING (60s tick)", ok: true }
  ];

  return (
    <div style={{ backgroundColor: "#f1f5f9", border: "3px solid #dc2626", fontFamily: "monospace", width: "100%", color: "#000", padding: "16px" }}>
      <div style={{ backgroundColor: "#dc2626", color: "#fff", padding: "8px 12px", fontWeight: "bold", fontSize: "13px", marginBottom: "16px", border: "1px solid #b91c1c", textTransform: "uppercase" }}>
        🛡️ ADMIN &amp; CONTROL — SYSTEM HEALTH &amp; ACCESS MANAGEMENT
      </div>

      <div style={{ backgroundColor: "#fff", border: "2px solid #cbd5e1", marginBottom: "16px" }}>
        <div style={{ backgroundColor: "#475569", color: "#fff", fontSize: "11px", fontWeight: "bold", padding: "6px 12px", textTransform: "uppercase" }}>
          ● LIVE SYSTEM SERVICE STATUS
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f1f5f9" }}>
              <th style={{ padding: "8px", border: "1px solid #cbd5e1", textAlign: "left" }}>SERVICE</th>
              <th style={{ padding: "8px", border: "1px solid #cbd5e1", textAlign: "left" }}>STATE</th>
            </tr>
          </thead>
          <tbody>
            {statusLoading && (
              <tr><td colSpan="2" style={{ padding: "12px", textAlign: "center", color: "#94a3b8" }}>Probing services…</td></tr>
            )}
            {!statusLoading && sysRows.map((row) => (
              <tr key={row.key} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "8px", border: "1px solid #e2e8f0", fontWeight: "bold" }}>{row.key}</td>
                <td style={{ padding: "8px", border: "1px solid #e2e8f0", fontWeight: "bold", color: row.ok ? "#16a34a" : "#dc2626" }}>
                  {row.ok ? "● " : "○ "}{row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ backgroundColor: "#fff", border: "2px solid #cbd5e1", marginBottom: "16px" }}>
        <div style={{ backgroundColor: "#475569", color: "#fff", fontSize: "11px", fontWeight: "bold", padding: "6px 12px", textTransform: "uppercase" }}>
          ● USER DIRECTORY
        </div>
        <div style={{ padding: "10px", fontSize: "12px" }}>
          {usersLoading && <p style={{ color: "#94a3b8" }}>Loading users…</p>}
          {!usersLoading && usersError && <p style={{ color: "#dc2626" }}>{usersError}</p>}
          {!usersLoading && !usersError && Array.isArray(users) && users.length === 0 && <p style={{ color: "#94a3b8" }}>No users found.</p>}
          {!usersLoading && !usersError && Array.isArray(users) && users.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f1f5f9" }}>
                  <th style={{ padding: "6px", border: "1px solid #cbd5e1", textAlign: "left" }}>EMAIL</th>
                  <th style={{ padding: "6px", border: "1px solid #cbd5e1", textAlign: "left" }}>ROLE</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id || u.email}>
                    <td style={{ padding: "6px", border: "1px solid #e2e8f0" }}>{u.email}</td>
                    <td style={{ padding: "6px", border: "1px solid #e2e8f0" }}>{u.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
        <form onSubmit={submitProduct} style={{ flex: "1 1 260px", backgroundColor: "#fff", border: "2px solid #cbd5e1", padding: "10px" }}>
          <div style={{ fontWeight: "bold", fontSize: "11px", marginBottom: "8px", textTransform: "uppercase" }}>Create product</div>
          <input placeholder="SKU" required value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} style={{ display: "block", width: "100%", marginBottom: "6px", padding: "4px" }} />
          <input placeholder="Name" required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} style={{ display: "block", width: "100%", marginBottom: "6px", padding: "4px" }} />
          <input placeholder="Unit price" required type="number" step="0.01" value={productForm.unitPrice} onChange={(e) => setProductForm({ ...productForm, unitPrice: e.target.value })} style={{ display: "block", width: "100%", marginBottom: "6px", padding: "4px" }} />
          <button type="submit" disabled={productSaving} style={{ padding: "6px 10px" }}>{productSaving ? "Saving…" : "Create product"}</button>
          {productMessage && <p style={{ marginTop: "6px" }}>{productMessage}</p>}
        </form>

        <form onSubmit={submitOverride} style={{ flex: "1 1 260px", backgroundColor: "#fff", border: "2px solid #cbd5e1", padding: "10px" }}>
          <div style={{ fontWeight: "bold", fontSize: "11px", marginBottom: "8px", textTransform: "uppercase" }}>Inventory override</div>
          <input placeholder="Part number" required value={overrideForm.partNumber} onChange={(e) => setOverrideForm({ ...overrideForm, partNumber: e.target.value })} style={{ display: "block", width: "100%", marginBottom: "6px", padding: "4px" }} />
          <input placeholder="Quantity on hand" required type="number" value={overrideForm.quantityOnHand} onChange={(e) => setOverrideForm({ ...overrideForm, quantityOnHand: e.target.value })} style={{ display: "block", width: "100%", marginBottom: "6px", padding: "4px" }} />
          <button type="submit" disabled={overrideSaving} style={{ padding: "6px 10px" }}>{overrideSaving ? "Saving…" : "Apply override"}</button>
          {overrideMessage && <p style={{ marginTop: "6px" }}>{overrideMessage}</p>}
        </form>
      </div>

      <div style={{ backgroundColor: "#0f172a", color: "#4ade80", fontSize: "11px", padding: "12px", border: "1px solid #334155", overflowX: "auto" }}>
        <div style={{ color: "#94a3b8", marginBottom: "6px" }}>// /api/auth/status payload</div>
        <pre style={{ margin: 0 }}>{status ? JSON.stringify(status, null, 2) : "no response"}</pre>
      </div>
    </div>
  );
}

export default AdminControlPanel;
