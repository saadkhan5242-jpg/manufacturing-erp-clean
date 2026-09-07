import {
  createSupplier,
  getSupplier,
  listSuppliers,
  removeSupplier,
  updateSupplier
} from "../services/supplierService.js";
import { normalizeSupplier, validateSupplier } from "../validation/supplierValidation.js";

function validateOrThrow(body, res) {
  const validationError = validateSupplier(body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return false;
  }
  return true;
}

export function list(_req, res) {
  res.json(listSuppliers());
}

export function detail(req, res) {
  res.json(getSupplier(req.params.id));
}

export function create(req, res) {
  if (!validateOrThrow(req.body, res)) return;
  res.status(201).json(createSupplier(normalizeSupplier(req.body)));
}

export function update(req, res) {
  if (!validateOrThrow(req.body, res)) return;
  res.json(updateSupplier(req.params.id, normalizeSupplier(req.body)));
}

export function remove(req, res) {
  removeSupplier(req.params.id);
  res.status(204).send();
}
