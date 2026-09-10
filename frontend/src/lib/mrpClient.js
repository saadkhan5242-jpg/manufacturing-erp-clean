import apiClient from "./apiClient.js";

export function getMrpForecast() {
  return apiClient.get("/api/mrp/forecast");
}

export function runMrpEngine() {
  return apiClient.post("/api/mrp/run-engine", {});
}

export function getMrpPurchaseQueue() {
  return apiClient.get("/api/mrp/purchase-queue");
}

export function recordSupplierDelay(payload) {
  return apiClient.post("/api/mrp/supplier-delay", payload);
}

export function getMrpDemands() {
  return apiClient.get("/api/mrp/demands");
}
