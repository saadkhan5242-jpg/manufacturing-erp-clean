import { loadCollection, saveCollection } from "../storage/jsonStore.js";

const demoTag = "DEMO-ERP-2026";
const now = "2026-09-05T10:00:00.000Z";

function addUnique(filename, records, key, value) {
  const current = loadCollection(filename, []);
  if (!current.some((record) => record[key] === value)) current.push(...records);
  saveCollection(filename, current);
  return current;
}

const products = addUnique("products.json", [
  { id: 2, name: "Hydraulic Manifold", sku: `${demoTag}-MANIFOLD`, description: "Five-port aluminum hydraulic manifold", unitPrice: 485, active: true },
  { id: 3, name: "Precision Shaft", sku: `${demoTag}-SHAFT`, description: "Ground steel drive shaft", unitPrice: 215, active: true },
  { id: 4, name: "Welded Guard Assembly", sku: `${demoTag}-GUARD`, description: "Powder-coated machine safety guard", unitPrice: 325, active: true }
], "sku", `${demoTag}-MANIFOLD`);

const workCenters = loadCollection("workCenters.json", []);
for (const workCenter of workCenters) {
  if (workCenter.id === 1) Object.assign(workCenter, { laborRate: 38, machineRate: 72 });
  if (workCenter.id === 2) Object.assign(workCenter, { laborRate: 34, machineRate: 58 });
}
if (!workCenters.some((workCenter) => workCenter.code === `${demoTag}-LATHE`)) workCenters.push({ id: 3, name: "CNC Lathe", code: `${demoTag}-LATHE`, dailyCapacityHours: 8, capacityHoursPerDay: 8, laborRate: 40, machineRate: 68 }, { id: 4, name: "Welding Cell", code: `${demoTag}-WELD`, dailyCapacityHours: 7, capacityHoursPerDay: 7, laborRate: 36, machineRate: 52 });
saveCollection("workCenters.json", workCenters);

addUnique("boms.json", [{ id: 2, productId: 2, revision: "A", components: [{ partNumber: "AL-PLATE-10MM", quantity: 1, unit: "each" }, { partNumber: "SEAL-KIT-05", quantity: 1, unit: "kit" }] }, { id: 3, productId: 3, revision: "A", components: [{ partNumber: "STEEL-BAR-32MM", quantity: 1, unit: "each" }] }], "revision", "DEMO-BOM-A");
const bomRecords = loadCollection("boms.json", []);
for (const record of bomRecords) if (record.productId === 2 && record.revision === "A") record.demoTag = demoTag;
saveCollection("boms.json", bomRecords);

addUnique("routings.json", [{ id: 2, productId: 2, revision: "A", status: "active", steps: [{ sequence: 10, operation: "CNC mill manifold ports", workCenterId: 1, setupMinutes: 35, runMinutes: 22, instructions: "Probe stock and verify port depth." }, { sequence: 20, operation: "Pressure test", workCenterId: 2, setupMinutes: 10, runMinutes: 8, instructions: "Test at 180 bar for 60 seconds." }] }, { id: 3, productId: 3, revision: "A", status: "active", steps: [{ sequence: 10, operation: "Turn shaft blank", workCenterId: 3, setupMinutes: 25, runMinutes: 18, instructions: "Use soft jaws and check runout." }, { sequence: 20, operation: "Cylindrical grind", workCenterId: 1, setupMinutes: 20, runMinutes: 12, instructions: "Hold final diameter to drawing tolerance." }] }], "productId", 2);

addUnique("inventory.json", [{ id: 3, name: "Aluminum Plate 10mm", sku: `${demoTag}-AL-PLATE`, quantityOnHand: 18, reorderPoint: 25, location: "Raw Materials B" }, { id: 4, name: "Seal Kit 05", sku: `${demoTag}-SEAL`, quantityOnHand: 64, reorderPoint: 20, location: "Kitting Shelf 04" }, { id: 5, name: "Steel Bar 32mm", sku: `${demoTag}-STEEL`, quantityOnHand: 42, reorderPoint: 30, location: "Raw Materials A" }], "sku", `${demoTag}-AL-PLATE`);

addUnique("salesOrders.json", [{ id: 2, orderNumber: `${demoTag}-SO-001`, customer: "Atlas Fluid Systems", status: "confirmed", dueDate: "2026-09-18", lines: [{ productId: 2, quantity: 12 }] }, { id: 3, orderNumber: `${demoTag}-SO-002`, customer: "Meridian Automation", status: "in-production", dueDate: "2026-09-15", lines: [{ productId: 3, quantity: 24 }] }], "orderNumber", `${demoTag}-SO-001`);

addUnique("workOrders.json", [{ id: 4, partNumber: `${demoTag}-MANIFOLD`, quantity: 12, status: "In Progress", dueDate: "2026-09-15", salesOrderNumber: `${demoTag}-SO-001` }, { id: 5, partNumber: `${demoTag}-SHAFT`, quantity: 24, status: "Open", dueDate: "2026-09-17", salesOrderNumber: `${demoTag}-SO-002` }], "salesOrderNumber", `${demoTag}-SO-001`);

addUnique("purchaseOrders.json", [{ id: 2, orderNumber: `${demoTag}-PO-001`, supplierId: 1, orderDate: "2026-09-05", status: "submitted", items: [{ productId: 2, quantity: 20, unitPrice: 42 }], total: 840 }], "orderNumber", `${demoTag}-PO-001`);
addUnique("receipts.json", [{ id: 1, purchaseOrderId: 2, receivedDate: "2026-09-05", supplierDocument: "GRN-DEMO-001", status: "partial", lines: [{ productId: 2, quantity: 10 }] }], "supplierDocument", "GRN-DEMO-001");
addUnique("qualityInspections.json", [{ id: 2, workOrderId: 4, inspectionType: "First article", status: "passed", result: "Pass - port depth verified", notes: "Approved by quality for batch production." }, { id: 3, workOrderId: 5, inspectionType: "In-process", status: "pending", result: "", notes: "Awaiting first ground shaft." }], "workOrderId", 4);
addUnique("traceability.json", [{ id: 1, barcode: "LOT-DEMO-AL-001", partNumber: "AL-PLATE-10MM", workOrderId: 4, event: "consumed", quantity: 10 }, { id: 2, barcode: "LOT-DEMO-STEEL-001", partNumber: "STEEL-BAR-32MM", workOrderId: 5, event: "issued", quantity: 24 }], "barcode", "LOT-DEMO-AL-001");
addUnique("accountingEntries.json", [{ id: 1, entryDate: "2026-09-05", reference: "DEMO-MATERIAL-001", account: "Raw materials", debit: 840, credit: 0, memo: "Aluminum plate purchase" }, { id: 2, entryDate: "2026-09-05", reference: "DEMO-MATERIAL-001", account: "Accounts payable", debit: 0, credit: 840, memo: "Supplier liability" }], "reference", "DEMO-MATERIAL-001");
addUnique("finiteSchedule.json", [{ id: 1, workOrderId: 4, workCenterId: 1, startTime: "2026-09-08T08:00:00.000Z", endTime: "2026-09-08T14:00:00.000Z", status: "dispatched" }, { id: 2, workOrderId: 5, workCenterId: 3, startTime: "2026-09-08T08:00:00.000Z", endTime: "2026-09-08T16:00:00.000Z", status: "planned" }], "workOrderId", 4);
addUnique("maintenance.json", [{ id: 2, equipmentId: "CNC-001", title: "Spindle lubrication", description: "Scheduled lubrication before manifold run.", scheduledDate: "2026-09-08", status: "scheduled", priority: "high" }], "title", "Spindle lubrication");

const shifts = loadCollection("shiftEntries.json", []);
if (!shifts.some((shift) => shift.demoTag === demoTag)) shifts.push({ id: shifts.length + 1, employeeId: 1, employeeName: "Operations Admin", startTime: "2026-09-05T06:30:00.000Z", endTime: "2026-09-05T15:00:00.000Z", note: "Demo day shift", demoTag });
saveCollection("shiftEntries.json", shifts);

const timeEntries = loadCollection("timeEntries.json", []);
if (!timeEntries.some((entry) => entry.demoTag === demoTag)) timeEntries.push({ id: timeEntries.length + 1, operatorId: 1, operatorName: "Operations Admin", workOrderId: 4, workCenterId: 1, operation: "CNC mill manifold ports", startTime: "2026-09-05T07:00:00.000Z", endTime: "2026-09-05T09:30:00.000Z", laborRate: 38, machineRate: 72, demoTag });
saveCollection("timeEntries.json", timeEntries);

addUnique("documents.json", [{ id: 1, type: "purchase-order", sourceId: 2, title: "PURCHASE ORDER", reference: `${demoTag}-PO-001`, createdAt: now, content: "Demo document generated from the seeded purchase order." }], "reference", `${demoTag}-PO-001`);
console.log(`Demo data loaded for ${demoTag}. Existing records were preserved.`);
