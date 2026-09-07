import { loadCollection, saveCollection } from "../storage/jsonStore.js";

export const workCenters = loadCollection("workCenters.json", [
  {
    id: 1,
    name: "CNC Mill",
    code: "WC-100",
    dailyCapacityHours: 8,
    capacityHoursPerDay: 8
  },
  {
    id: 2,
    name: "Laser Cutter",
    code: "WC-200",
    dailyCapacityHours: 6,
    capacityHoursPerDay: 6
  }
]);

function nextId() {
  return workCenters.length === 0 ? 1 : Math.max(...workCenters.map((workCenter) => workCenter.id)) + 1;
}

export function findAll() {
  return workCenters;
}

export function findById(id) {
  return workCenters.find((workCenter) => workCenter.id === id);
}

export function insert(attributes) {
  const workCenter = { id: nextId(), ...attributes };
  workCenters.push(workCenter);
  saveCollection("workCenters.json", workCenters);
  return workCenter;
}

export function updateById(id, attributes) {
  const index = workCenters.findIndex((workCenter) => workCenter.id === id);
  if (index === -1) return undefined;

  workCenters[index] = { id, ...attributes };
  saveCollection("workCenters.json", workCenters);
  return workCenters[index];
}

export function deleteById(id) {
  const index = workCenters.findIndex((workCenter) => workCenter.id === id);
  if (index === -1) return false;

  workCenters.splice(index, 1);
  saveCollection("workCenters.json", workCenters);
  return true;
}

export function hasCode(code, excludedId) {
  return workCenters.some(
    (workCenter) => workCenter.id !== excludedId && workCenter.code.toLowerCase() === code.toLowerCase()
  );
}
