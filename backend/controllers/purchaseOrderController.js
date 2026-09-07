import {
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  removePurchaseOrder,
  updatePurchaseOrder
} from "../services/purchaseOrderService.js";
import {
  normalizePurchaseOrder,
  validatePurchaseOrder
} from "../validation/purchaseOrderValidation.js";

function validateOrRespond(body, res) {
  const validationError = validatePurchaseOrder(body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return false;
  }
  return true;
}

export function list(_req, res) {
  res.json(listPurchaseOrders());
}

export function detail(req, res) {
  res.json(getPurchaseOrder(req.params.id));
}

export function create(req, res) {
  if (!validateOrRespond(req.body, res)) return;
  res.status(201).json(createPurchaseOrder(normalizePurchaseOrder(req.body)));
}

export function update(req, res) {
  if (!validateOrRespond(req.body, res)) return;
  res.json(updatePurchaseOrder(req.params.id, normalizePurchaseOrder(req.body)));
}

export function remove(req, res) {
  removePurchaseOrder(req.params.id);
  res.status(204).send();
}
