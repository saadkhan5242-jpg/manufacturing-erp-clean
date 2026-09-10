import apiClient from "./apiClient.js";

export function submitInspectionRecord(payload) {
  return apiClient.post("/api/quality/inspections", payload);
}

export function submitFaiReport(payload) {
  return apiClient.post("/api/quality/fai-reports", payload);
}

export function fileNonConformanceReport(payload) {
  return apiClient.post("/api/quality/ncrs", payload);
}

export function listMeasurementInstruments() {
  return apiClient.get("/api/quality/calibration/instruments");
}

export function createMeasurementInstrument(payload) {
  return apiClient.post("/api/quality/calibration/instruments", payload);
}

export function recordCalibrationEvent(payload) {
  return apiClient.post("/api/quality/calibration/events", payload);
}
