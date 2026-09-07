import { loadCollection, saveCollection } from "../storage/jsonStore.js";

const purchaseOrders = loadCollection("purchaseOrders.json", [
  {
    id: 1,
    orderNumber: "PO-0001",
    supplierId: 1,
    orderDate: "2026-09-05",
    status: "draft",
    items: [
      { productId: 1, quantity: 10, unitPrice: 85 }
    ],
    total: 850
  }
]);

function nextId() {
  return purchaseOrders.length === 0 ? 1 : Math.max(...purchaseOrders.map((order) => order.id)) + 1;
}

export function findAll() {
  return purchaseOrders;
}

export function findById(id) {
  return purchaseOrders.find((order) => order.id === id);
}

export function insert(attributes) {
  const purchaseOrder = { id: nextId(), ...attributes };
  purchaseOrders.push(purchaseOrder);
  saveCollection("purchaseOrders.json", purchaseOrders);
  return purchaseOrder;
}

export function updateById(id, attributes) {
  const index = purchaseOrders.findIndex((order) => order.id === id);
  if (index === -1) return undefined;

  purchaseOrders[index] = { id, ...attributes };
  saveCollection("purchaseOrders.json", purchaseOrders);
  return purchaseOrders[index];
}

export function deleteById(id) {
  const index = purchaseOrders.findIndex((order) => order.id === id);
  if (index === -1) return false;

  purchaseOrders.splice(index, 1);
  saveCollection("purchaseOrders.json", purchaseOrders);
  return true;
}

export function hasOrderNumber(orderNumber, excludedId) {
  return purchaseOrders.some(
    (order) => order.id !== excludedId && order.orderNumber.toLowerCase() === orderNumber.toLowerCase()
  );
}
