import {
  createProduct,
  getProduct,
  listProducts,
  removeProduct,
  updateProduct
} from "../services/productService.js";
import { normalizeProduct, validateProduct } from "../validation/productValidation.js";

function validateOrRespond(body, res) {
  const validationError = validateProduct(body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return false;
  }
  return true;
}

export function list(_req, res) {
  res.json(listProducts());
}

export function detail(req, res) {
  res.json(getProduct(req.params.id));
}

export function create(req, res) {
  if (!validateOrRespond(req.body, res)) return;
  res.status(201).json(createProduct(normalizeProduct(req.body)));
}

export function update(req, res) {
  if (!validateOrRespond(req.body, res)) return;
  res.json(updateProduct(req.params.id, normalizeProduct(req.body)));
}

export function remove(req, res) {
  removeProduct(req.params.id);
  res.status(204).send();
}
