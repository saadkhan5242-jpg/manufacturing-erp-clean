import {
  createWorkCenter,
  getWorkCenter,
  listWorkCenters,
  removeWorkCenter,
  updateWorkCenter
} from "../services/workCenterService.js";
import { normalizeWorkCenter, validateWorkCenter } from "../validation/workCenterValidation.js";

function validateOrRespond(body, res) {
  const validationError = validateWorkCenter(body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return false;
  }
  return true;
}

export function list(_req, res) {
  res.json(listWorkCenters());
}

export function detail(req, res) {
  res.json(getWorkCenter(req.params.id));
}

export function create(req, res) {
  if (!validateOrRespond(req.body, res)) return;
  res.status(201).json(createWorkCenter(normalizeWorkCenter(req.body)));
}

export function update(req, res) {
  if (!validateOrRespond(req.body, res)) return;
  res.json(updateWorkCenter(req.params.id, normalizeWorkCenter(req.body)));
}

export function remove(req, res) {
  removeWorkCenter(req.params.id);
  res.status(204).send();
}
