import AppError from "../errors/AppError.js";
import { findById as findProductById } from "../models/productModel.js";
import { findById as findSupplierById } from "../models/supplierModel.js";
import {
  deleteById,
  findAll,
  findById,
  hasOrderNumber,
  insert,
  updateById
} from "../models/purchaseOrderModel.js";

function getPurchaseOrderId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, "id must be a positive integer");
  }
  return id;
}

export function listPurchaseOrders() {
  return findAll();
}

export function getPurchaseOrder(value) {
  const id = getPurchaseOrderId(value);
  const purchaseOrder = findById(id);
  if (!purchaseOrder) throw new AppError(404, "Purchase order not found");
  return purchaseOrder;
}

export function createPurchaseOrder(attributes) {
  assertReferences(attributes);
  if (hasOrderNumber(attributes.orderNumber)) {
    throw new AppError(409, "orderNumber must be unique");
  }
  return insert(attributes);
}

export function updatePurchaseOrder(value, attributes) {
  const id = getPurchaseOrderId(value);
  assertReferences(attributes);
  if (!findById(id)) throw new AppError(404, "Purchase order not found");
  if (hasOrderNumber(attributes.orderNumber, id)) {
    throw new AppError(409, "orderNumber must be unique");
  }
  return updateById(id, attributes);
}

function assertReferences(attributes) {
  const supplier = findSupplierById(attributes.supplierId);
  if (!supplier || supplier.active === false) throw new AppError(400, "supplierId must reference an active supplier");
  for (const item of attributes.items) {
    const product = findProductById(item.productId);
    if (!product || product.active === false) throw new AppError(400, `productId ${item.productId} must reference an active product`);
  }
}

export function removePurchaseOrder(value) {
  const id = getPurchaseOrderId(value);
  if (!deleteById(id)) throw new AppError(404, "Purchase order not found");
}
