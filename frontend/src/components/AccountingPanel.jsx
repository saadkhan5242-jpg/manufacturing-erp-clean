import { useState, useEffect } from "react";
import apiClient from "../lib/apiClient.js";

/**
 * AccountingPanel — General Ledger / Accounts Payable command center.
 * WIP valuation strip + AP invoice ledger + financial summary. GSS density.
 */
function AccountingPanel() {
  const [wip, setWip] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiClient.get("/api/bi/wip-valuation").catch(() => null),
      apiClient.get("/api/ai-document-intake/ledger").catch(() => null)
    ]).then(([wipData, ledgerData]) => {
      if (cancelled) return;
      if (wipData?.totals) setWip(wipData.totals);
      if (ledgerData?.invoices) setInvoices(ledgerData.invoices);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalAp = invoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

  const kpis = [
    { label: "TOTAL AP LEDGER", value: `$${totalAp.toFixed(2)}`, color: "#eab308" },
    { label: "INVOICES POSTED", value: invoices.length, color: "#0284c7" },
    { label: "TOTAL WIP VALUE", value: `$${Number(wip?.totalWip || 0).toFixed(2)}`, color: "#16a34a" },
    { label: "LABOR WIP", value: `$${Number(wip?.laborWip || 0).toFixed(2)}`, color: "#2563eb" },
    { label: "OVERHEAD WIP", value: `$${Number(wip?.overheadWip || 0).toFixed(2)}`, color: "#9333ea" }
  ];

  return (
    <div style={{ backgroundColor: "#f1f5f9", border: "3px solid #eab308", fontFamily: "monospace", width: "100%", color: "#000", padding: "16px" }}>
      {/* Module Title Bar */}
      <div style={{ backgroundColor: "#eab308", color: "#000", padding: "8px 12px", fontWeight: "bold", fontSize: "13px", marginBottom: "16px", border: "1px solid #ca8a04", textTransform: "uppercase" }}>
        💰 ACCOUNTING — GENERAL LEDGER &amp; ACCOUNTS PAYABLE COMMAND CENTER
      </div>

      {/* Financial KPI strip */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ backgroundColor: "#fff", border: "2px solid #cbd5e1", borderTop: `4px solid ${k.color}`, padding: "10px 14px", minWidth: "150px", flex: 1 }}>
            <div style={{ fontSize: "10px", color: "#64748b", letterSpacing: "0.05em", fontWeight: "bold" }}>{k.label}</div>
            <div style={{ fontSize: "20px", fontWeight: "900", color: k.color, marginTop: "4px" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* AP Invoice Ledger */}
      <div style={{ backgroundColor: "#fff", border: "2px solid #cbd5e1" }}>
        <div style={{ backgroundColor: "#475569", color: "#fff", fontSize: "11px", fontWeight: "bold", padding: "6px 12px", textTransform: "uppercase" }}>
          ● ACCOUNTS PAYABLE — POSTED INVOICE LEDGER
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f1f5f9" }}>
              <th style={{ padding: "8px", border: "1px solid #cbd5e1", textAlign: "left" }}>INVOICE #</th>
              <th style={{ padding: "8px", border: "1px solid #cbd5e1", textAlign: "left" }}>VENDOR</th>
              <th style={{ padding: "8px", border: "1px solid #cbd5e1", textAlign: "center" }}>DATE</th>
              <th style={{ padding: "8px", border: "1px solid #cbd5e1", textAlign: "right" }}>AMOUNT</th>
              <th style={{ padding: "8px", border: "1px solid #cbd5e1", textAlign: "center" }}>POSTED</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="5" style={{ padding: "16px", textAlign: "center", color: "#94a3b8" }}>Loading ledger…</td></tr>
            )}
            {!loading && invoices.length === 0 && (
              <tr><td colSpan="5" style={{ padding: "16px", textAlign: "center", color: "#94a3b8" }}>No invoices posted yet — use the Genii AI Document Intake to post one.</td></tr>
            )}
            {!loading && invoices.map((inv) => (
              <tr key={inv.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "8px", border: "1px solid #e2e8f0", fontWeight: "bold", color: "#2563eb" }}>{inv.invoice_number}</td>
                <td style={{ padding: "8px", border: "1px solid #e2e8f0" }}>{inv.vendor_name}</td>
                <td style={{ padding: "8px", border: "1px solid #e2e8f0", textAlign: "center" }}>{inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : "—"}</td>
                <td style={{ padding: "8px", border: "1px solid #e2e8f0", textAlign: "right", fontWeight: "bold" }}>${Number(inv.total_amount).toFixed(2)}</td>
                <td style={{ padding: "8px", border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AccountingPanel;
