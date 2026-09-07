import AppError from "../errors/AppError.js";
import {
  deleteById,
  findAll,
  findById,
  hasCode,
  insert,
  updateById
} from "../models/supplierModel.js";

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function getSupplierId(value) {
  const id = parseId(value);
  if (id === null) {
    throw new AppError(400, "id must be a positive integer");
  }
  return id;
}

export function listSuppliers() {
  return findAll();
}

export function getSupplier(value) {
  const id = getSupplierId(value);
  const supplier = findById(id);
  if (!supplier) throw new AppError(404, "Supplier not found");
  return supplier;
}

export function createSupplier(attributes) {
  if (hasCode(attributes.code)) {
    throw new AppError(409, "code must be unique");
  }
  return insert(attributes);
}

export function updateSupplier(value, attributes) {
  const id = getSupplierId(value);
  if (!findById(id)) throw new AppError(404, "Supplier not found");
  if (hasCode(attributes.code, id)) throw new AppError(409, "code must be unique");
  return updateById(id, attributes);
}

export function removeSupplier(value) {
  const id = getSupplierId(value);
  if (!deleteById(id)) throw new AppError(404, "Supplier not found");
}
