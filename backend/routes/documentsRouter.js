import express from "express";
import { getPurchaseOrder } from "../services/purchaseOrderService.js";
import { loadCollection, saveCollection } from "../storage/jsonStore.js";

const router = express.Router();
const documents = loadCollection("documents.json", []);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" }[character]));
}

function buildDocument(type, purchaseOrder) {
  const title = type === "invoice" ? "INVOICE" : "PURCHASE ORDER";
  const reference = type === "invoice" ? `INV-${purchaseOrder.orderNumber}` : purchaseOrder.orderNumber;
  const rows = purchaseOrder.items.map((item) => `<tr><td>Product #${escapeHtml(item.productId)}</td><td>${item.quantity}</td><td>$${item.unitPrice.toFixed(2)}</td><td>$${(item.quantity * item.unitPrice).toFixed(2)}</td></tr>`).join("");
  const content = `<!doctype html><html><head><meta charset="utf-8"><title>${title} ${reference}</title><style>body{font-family:Arial,sans-serif;color:#17252b;margin:48px}header{display:flex;justify-content:space-between;border-bottom:2px solid #137c73;padding-bottom:18px}table{border-collapse:collapse;margin-top:36px;width:100%}th,td{border-bottom:1px solid #dce6e1;padding:10px;text-align:left}th{color:#6d7c82;font-size:12px;text-transform:uppercase}.total{text-align:right;font-size:20px;font-weight:bold;margin-top:24px}</style></head><body><header><div><h1>GLOBAL SHOP</h1><p>Manufacturing ERP</p></div><div><h2>${title}</h2><p>${reference}</p><p>Date: ${escapeHtml(purchaseOrder.orderDate)}</p></div></header><p>Supplier ID: ${purchaseOrder.supplierId}</p><table><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><p class="total">Total: $${purchaseOrder.total.toFixed(2)}</p></body></html>`;
  return { title, reference, content };
}

router.get("/", (_req, res) => res.json(documents));

router.post("/", (req, res) => {
  const { type = "purchase-order", sourceId } = req.body;
  if (!new Set(["purchase-order", "invoice"]).has(type)) return res.status(400).json({ error: "type must be purchase-order or invoice" });
  try {
    const purchaseOrder = getPurchaseOrder(sourceId);
    const generated = buildDocument(type, purchaseOrder);
    const document = { id: documents.length === 0 ? 1 : Math.max(...documents.map((item) => item.id)) + 1, type, sourceId: Number(sourceId), createdAt: new Date().toISOString(), ...generated };
    documents.push(document);
    saveCollection("documents.json", documents);
    return res.status(201).json(document);
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message });
  }
});

export default router;
