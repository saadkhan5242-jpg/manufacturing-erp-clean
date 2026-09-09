import express from "express";
import { loadCollection, saveCollection } from "../storage/jsonStore.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import { broadcastShopFloorEvent } from "../services/shopFloorEventBus.js";
import { recordQualityCheckpoint } from "../services/qualityCheckpointService.js";
import { paginationQuerySchema, workOrderCreateSchema, workOrderStatusUpdateSchema } from "../validators/schemas.js";

const router = express.Router();
const defaultWorkOrders = [
  { id: 1, partNumber: "P-1001", quantity: 50, status: "open", dueDate: "2026-09-10" },
  { id: 2, partNumber: "P-2002", quantity: 20, status: "in-progress", dueDate: "2026-09-12" }
];
const sortableFields = new Set(["id", "orderNumber", "partNumber", "quantity", "status", "dueDate", "updatedAt"]);

function listWorkOrders() {
  return loadCollection("workOrders.json", defaultWorkOrders);
}

function saveWorkOrders(records) {
  saveCollection("workOrders.json", records);
}

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function applyFilters(records, filters) {
  return records.filter((record) => {
    if (filters.status && normalizeStatus(record.status) !== normalizeStatus(filters.status)) return false;
    if (filters.machine && String(record.machine || record.workCenter || "").toLowerCase() !== filters.machine.toLowerCase()) return false;
    if (filters.operatorId && String(record.operatorId || record.employeeId || "") !== filters.operatorId) return false;
    if (filters.operatorStatus !== "all" && normalizeStatus(record.operatorStatus || record.status) !== filters.operatorStatus) return false;
    if (filters.search) {
      const searchable = `${record.orderNumber || ""} ${record.partNumber || ""} ${record.status || ""}`.toLowerCase();
      if (!searchable.includes(filters.search.toLowerCase())) return false;
    }
    return true;
  });
}

function sortRecords(records, sortBy, sortDir) {
  const field = sortableFields.has(sortBy) ? sortBy : "dueDate";
  const direction = sortDir === "asc" ? 1 : -1;
  return [...records].sort((left, right) => {
    const leftValue = left[field] ?? "";
    const rightValue = right[field] ?? "";
    return String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true }) * direction;
  });
}

router.get("/", validateQuery(paginationQuerySchema), (req, res) => {
  const { page, limit, sortBy, sortDir } = req.query;
  const filtered = applyFilters(listWorkOrders(), req.query);
  const sorted = sortRecords(filtered, sortBy, sortDir);
  const start = (page - 1) * limit;
  const data = sorted.slice(start, start + limit);

  return res.json({
    data,
    pagination: { page, limit, total: filtered.length, hasMore: start + data.length < filtered.length },
    filters: { status: req.query.status || null, machine: req.query.machine || null, operatorId: req.query.operatorId || null, operatorStatus: req.query.operatorStatus, search: req.query.search || null }
  });
});

router.post("/", validateBody(workOrderCreateSchema), (req, res) => {
  const workOrders = listWorkOrders();
  const nextId = workOrders.reduce((max, record) => Math.max(max, Number(record.id) || 0), 0) + 1;
  const newWorkOrder = {
    id: nextId,
    orderNumber: req.body.orderNumber || `WO-${String(nextId).padStart(5, "0")}`,
    partNumber: req.body.partNumber,
    quantity: req.body.quantity,
    status: req.body.status,
    dueDate: req.body.dueDate || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  workOrders.push(newWorkOrder);
  saveWorkOrders(workOrders);
  broadcastShopFloorEvent("job-status", { actionType: "WORK_ORDER_CREATED", workOrder: newWorkOrder });
  return res.status(201).json(newWorkOrder);
});

router.put("/:id/status", validateBody(workOrderStatusUpdateSchema), (req, res) => {
  const id = Number(req.params.id);
  const workOrders = listWorkOrders();
  const workOrder = workOrders.find((record) => Number(record.id) === id);
  if (!workOrder) return res.status(404).json({ error: "Work order not found", requestId: req.requestId });

  const checkpoint = recordQualityCheckpoint(id, req.body.qualityCheckpoint, req.body.qualityCheckpoint.failedCount > 0 ? "failed" : "passed");
  workOrder.status = req.body.status;
  workOrder.qualityStatus = checkpoint.status;
  workOrder.updatedAt = new Date().toISOString();
  saveWorkOrders(workOrders);

  const payload = { actionType: "WORK_ORDER_STATUS_UPDATED", workOrder, qualityCheckpoint: checkpoint };
  broadcastShopFloorEvent("job-status", payload);
  broadcastShopFloorEvent("quality-checkpoint", payload);
  return res.json(payload);
});

export default router;
