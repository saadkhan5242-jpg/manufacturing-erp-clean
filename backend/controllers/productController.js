import {
  createProduct,
  getProduct,
  listProducts,
  removeProduct,
  updateProduct
} from "../services/productService.js";
import { isUsPerson } from "../middleware/itarAccess.js";
import { recordComplianceAudit } from "../services/complianceAuditService.js";
import { normalizeProduct, validateProduct } from "../validation/productValidation.js";

function validateOrRespond(body, res) {
  const validationError = validateProduct(body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return false;
  }
  return true;
}

export async function list(req, res) {
  const products = listProducts();
  if (isUsPerson(req.user)) {
    await Promise.all(products.filter((product) => product.is_itar_controlled).map((product) => recordComplianceAudit({ req, actionType: "VIEW", targetTable: "products", targetRecordId: product.id, isItarControlled: true, decision: "allowed", reason: "US person listed ITAR product" })));
    return res.json(products);
  }

  const blocked = products.filter((product) => product.is_itar_controlled);
  await Promise.all(blocked.map((product) => recordComplianceAudit({ req, actionType: "VIEW", targetTable: "products", targetRecordId: product.id, isItarControlled: true, decision: "blocked", reason: "Non-US person product list filtered" })));
  return res.json(products.filter((product) => !product.is_itar_controlled));
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
