import { loadCollection, saveCollection } from "../storage/jsonStore.js";

export function recordQualityCheckpoint(workOrderId, checkpoint, status = "passed") {
  const inspections = loadCollection("qualityInspections.json", []);
  const record = {
    id: inspections.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1,
    workOrderId: Number(workOrderId),
    inspectionType: "Operator checkpoint",
    status,
    passedCount: checkpoint.passedCount,
    failedCount: checkpoint.failedCount,
    materialCertId: checkpoint.materialCertId || null,
    employeeId: checkpoint.employeeId,
    employeeTimestamp: checkpoint.employeeTimestamp.toISOString(),
    notes: checkpoint.notes || ""
  };
  inspections.push(record);
  saveCollection("qualityInspections.json", inspections);
  return record;
}
