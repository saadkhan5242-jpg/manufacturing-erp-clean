import { loadCollection, saveCollection } from "../storage/jsonStore.js";

const suppliers = loadCollection("suppliers.json", [
  {
    id: 1,
    name: "Precision Metals Ltd.",
    code: "SUP-001",
    email: "orders@precision-metals.example",
    phone: "+1-555-0100",
    active: true
  }
]);

function nextId() {
  return suppliers.length === 0 ? 1 : Math.max(...suppliers.map((supplier) => supplier.id)) + 1;
}

export function findAll() {
  return suppliers;
}

export function findById(id) {
  return suppliers.find((supplier) => supplier.id === id);
}

export function insert(attributes) {
  const supplier = { id: nextId(), ...attributes };
  suppliers.push(supplier);
  saveCollection("suppliers.json", suppliers);
  return supplier;
}

export function updateById(id, attributes) {
  const index = suppliers.findIndex((supplier) => supplier.id === id);
  if (index === -1) return undefined;

  suppliers[index] = { id, ...attributes };
  saveCollection("suppliers.json", suppliers);
  return suppliers[index];
}

export function deleteById(id) {
  const index = suppliers.findIndex((supplier) => supplier.id === id);
  if (index === -1) return false;

  suppliers.splice(index, 1);
  saveCollection("suppliers.json", suppliers);
  return true;
}

export function hasCode(code, excludedId) {
  return suppliers.some(
    (supplier) => supplier.id !== excludedId && supplier.code.toLowerCase() === code.toLowerCase()
  );
}
