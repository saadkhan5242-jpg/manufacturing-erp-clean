import express from "express";
import * as service from "../services/postgresWorkOrderService.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import { broadcastShopFloorEvent } from "../services/shopFloorEventBus.js";
import { recordQualityCheckpoint } from "../services/qualityCheckpointService.js";
import { paginationQuerySchema, workOrderCreateSchema, workOrderRowActionSchema, workOrderStatusUpdateSchema, workOrderUpdateSchema } from "../validators/schemas.js";

const router = express.Router();
const id = (value) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const handle = (action) => async (req, res, next) => { try { const result = await action(req); if (result === undefined) return res.status(404).json({ error: "Work order not found" }); return res.status(req.method === "POST" ? 201 : 200).json(result); } catch (error) { next(error); } };
router.get("/", validateQuery(paginationQuerySchema), handle((req) => service.listWorkOrders(req.query)));
router.get("/:id", handle((req) => service.getWorkOrder(id(req.params.id))));
router.post("/", validateBody(workOrderCreateSchema), handle(async (req) => {
	const workOrder = await service.createWorkOrder(req.body);
	broadcastShopFloorEvent("job-status", { actionType: "WORK_ORDER_CREATED", workOrder });
	return workOrder;
}));
router.post("/:id/actions", validateBody(workOrderRowActionSchema), handle(async (req) => {
	const workOrder = await service.getWorkOrder(id(req.params.id));
	if (!workOrder) return undefined;
	const payload = { actionType: req.body.actionType, workOrder, operatorId: req.body.operatorId || null, requestedBy: req.body.requestedBy || null, reorderReason: req.body.reorderReason || null };
	broadcastShopFloorEvent("job-action", payload);
	return { accepted: true, ...payload };
}));
router.put("/:id", validateBody(workOrderUpdateSchema), handle(async (req) => {
	const workOrder = await service.updateWorkOrder(id(req.params.id), req.body);
	if (!workOrder) return undefined;
	const checkpoint = recordQualityCheckpoint(workOrder.id, req.body.qualityCheckpoint, req.body.qualityCheckpoint.failedCount > 0 ? "failed" : "passed");
	const payload = { actionType: "WORK_ORDER_UPDATED", workOrder, qualityCheckpoint: checkpoint };
	broadcastShopFloorEvent("job-status", payload);
	broadcastShopFloorEvent("quality-checkpoint", payload);
	return payload;
}));
router.put("/:id/status", validateBody(workOrderStatusUpdateSchema), handle(async (req) => {
	const workOrder = await service.updateWorkOrderStatus(id(req.params.id), req.body.status);
	if (!workOrder) return undefined;
	const checkpoint = recordQualityCheckpoint(workOrder.id, req.body.qualityCheckpoint, req.body.qualityCheckpoint.failedCount > 0 ? "failed" : "passed");
	const payload = { actionType: "WORK_ORDER_STATUS_UPDATED", workOrder, qualityCheckpoint: checkpoint };
	broadcastShopFloorEvent("job-status", payload);
	broadcastShopFloorEvent("quality-checkpoint", payload);
	return payload;
}));
router.delete("/:id", async (req, res, next) => { try { if (!(await service.deleteWorkOrder(id(req.params.id)))) return res.status(404).json({ error: "Work order not found" }); return res.status(204).send(); } catch (error) { next(error); } });
export default router;
