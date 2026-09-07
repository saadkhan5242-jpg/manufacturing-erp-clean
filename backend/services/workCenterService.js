import AppError from "../errors/AppError.js";
import {
  deleteById,
  findAll,
  findById,
  hasCode,
  insert,
  updateById
} from "../models/workCenterModel.js";

function getWorkCenterId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, "id must be a positive integer");
  }
  return id;
}

export function listWorkCenters() {
  return findAll();
}

export function getWorkCenter(value) {
  const id = getWorkCenterId(value);
  const workCenter = findById(id);
  if (!workCenter) throw new AppError(404, "Work center not found");
  return workCenter;
}

export function createWorkCenter(attributes) {
  if (hasCode(attributes.code)) throw new AppError(409, "code must be unique");
  return insert(attributes);
}

export function updateWorkCenter(value, attributes) {
  const id = getWorkCenterId(value);
  if (!findById(id)) throw new AppError(404, "Work center not found");
  if (hasCode(attributes.code, id)) throw new AppError(409, "code must be unique");
  return updateById(id, attributes);
}

export function removeWorkCenter(value) {
  const id = getWorkCenterId(value);
  if (!deleteById(id)) throw new AppError(404, "Work center not found");
}
