import { loadCollection, saveCollection } from "../storage/jsonStore.js";

const products = loadCollection("products.json", [
  {
    id: 1,
    name: "Standard Gear Assembly",
    sku: "PROD-001",
    description: "Finished gear assembly",
    unitPrice: 125.5,
    active: true
  }
]);

function nextId() {
  return products.length === 0 ? 1 : Math.max(...products.map((product) => product.id)) + 1;
}

export function findAll() {
  return products;
}

export function findById(id) {
  return products.find((product) => product.id === id);
}

export function insert(attributes) {
  const product = { id: nextId(), ...attributes };
  products.push(product);
  saveCollection("products.json", products);
  return product;
}

export function updateById(id, attributes) {
  const index = products.findIndex((product) => product.id === id);
  if (index === -1) return undefined;

  products[index] = { id, ...attributes };
  saveCollection("products.json", products);
  return products[index];
}

export function deleteById(id) {
  const index = products.findIndex((product) => product.id === id);
  if (index === -1) return false;

  products.splice(index, 1);
  saveCollection("products.json", products);
  return true;
}

export function hasSku(sku, excludedId) {
  return products.some(
    (product) => product.id !== excludedId && product.sku.toLowerCase() === sku.toLowerCase()
  );
}
