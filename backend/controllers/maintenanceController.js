import {
  createMaintenance,
  getMaintenance,
  listMaintenance,
  removeMaintenance,
  updateMaintenance
} from "../services/maintenanceService.js";
import {
  normalizeMaintenance,
  validateMaintenance
} from "../validation/maintenanceValidation.js";

function validateOrRespond(body, res) {
  const validationError = validateMaintenance(body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return false;
  }
  return true;
}

export function list(_req, res) {
  res.json(listMaintenance());
}

export function detail(req, res) {
  res.json(getMaintenance(req.params.id));
}

export function create(req, res) {
  if (!validateOrRespond(req.body, res)) return;
  res.status(201).json(createMaintenance(normalizeMaintenance(req.body)));
}

export function update(req, res) {
  if (!validateOrRespond(req.body, res)) return;
  res.json(updateMaintenance(req.params.id, normalizeMaintenance(req.body)));
}

export function remove(req, res) {
  removeMaintenance(req.params.id);
  res.status(204).send();
}
