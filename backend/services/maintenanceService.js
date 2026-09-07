import AppError from "../errors/AppError.js";
import {
  deleteById,
  findAll,
  findById,
  insert,
  updateById
} from "../models/maintenanceModel.js";

function getMaintenanceId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, "id must be a positive integer");
  }
  return id;
}

export function listMaintenance() {
  return findAll();
}

export function getMaintenance(value) {
  const id = getMaintenanceId(value);
  const record = findById(id);
  if (!record) throw new AppError(404, "Maintenance record not found");
  return record;
}

export function createMaintenance(attributes) {
  return insert(attributes);
}

export function updateMaintenance(value, attributes) {
  const id = getMaintenanceId(value);
  if (!findById(id)) throw new AppError(404, "Maintenance record not found");
  return updateById(id, attributes);
}

export function removeMaintenance(value) {
  const id = getMaintenanceId(value);
  if (!deleteById(id)) throw new AppError(404, "Maintenance record not found");
}
