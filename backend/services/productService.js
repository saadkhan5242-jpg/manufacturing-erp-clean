import AppError from "../errors/AppError.js";
import {
  deleteById,
  findAll,
  findById,
  hasSku,
  insert,
  updateById
} from "../models/productModel.js";

function getProductId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, "id must be a positive integer");
  }
  return id;
}

export function listProducts() {
  return findAll();
}

export function getProduct(value) {
  const id = getProductId(value);
  const product = findById(id);
  if (!product) throw new AppError(404, "Product not found");
  return product;
}

export function createProduct(attributes) {
  if (hasSku(attributes.sku)) throw new AppError(409, "sku must be unique");
  return insert(attributes);
}

export function updateProduct(value, attributes) {
  const id = getProductId(value);
  if (!findById(id)) throw new AppError(404, "Product not found");
  if (hasSku(attributes.sku, id)) throw new AppError(409, "sku must be unique");
  return updateById(id, attributes);
}

export function removeProduct(value) {
  const id = getProductId(value);
  if (!deleteById(id)) throw new AppError(404, "Product not found");
}
