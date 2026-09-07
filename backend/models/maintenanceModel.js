import { loadCollection, saveCollection } from "../storage/jsonStore.js";

const maintenanceRecords = loadCollection("maintenance.json", [
  {
    id: 1,
    equipmentId: "CNC-001",
    title: "CNC Mill preventive maintenance",
    description: "Inspect spindle, coolant system, and tooling alignment.",
    scheduledDate: "2026-09-10",
    status: "scheduled",
    priority: "medium"
  }
]);

function nextId() {
  return maintenanceRecords.length === 0
    ? 1
    : Math.max(...maintenanceRecords.map((record) => record.id)) + 1;
}

export function findAll() {
  return maintenanceRecords;
}

export function findById(id) {
  return maintenanceRecords.find((record) => record.id === id);
}

export function insert(attributes) {
  const record = { id: nextId(), ...attributes };
  maintenanceRecords.push(record);
  saveCollection("maintenance.json", maintenanceRecords);
  return record;
}

export function updateById(id, attributes) {
  const index = maintenanceRecords.findIndex((record) => record.id === id);
  if (index === -1) return undefined;

  maintenanceRecords[index] = { id, ...attributes };
  saveCollection("maintenance.json", maintenanceRecords);
  return maintenanceRecords[index];
}

export function deleteById(id) {
  const index = maintenanceRecords.findIndex((record) => record.id === id);
  if (index === -1) return false;

  maintenanceRecords.splice(index, 1);
  saveCollection("maintenance.json", maintenanceRecords);
  return true;
}
