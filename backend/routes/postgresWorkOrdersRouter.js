import express from "express";
import * as service from "../services/postgresWorkOrderService.js";
import { authenticate } from "../middleware/auth.js";
import { isUsPerson, requireUsPersonForItarPayload, requireUsPersonForItarRecord } from "../middleware/itarAccess.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import { broadcastShopFloorEvent } from "../services/shopFloorEventBus.js";
import { recordComplianceAudit } from "../services/complianceAuditService.js";
import { recordQualityCheckpoint } from "../services/qualityCheckpointService.js";
import { paginationQuerySchema, workOrderCreateSchema, workOrderRowActionSchema, workOrderStatusUpdateSchema, workOrderUpdateSchema } from "../validators/schemas.js";

const router = express.Router();
const id = (value) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const handle = (action) => async (req, res, next) => { try { const result = await action(req); if (result === undefined) return res.status(404).json({ error: "Work order not found" }); return res.status(req.method === "POST" ? 201 : 200).json(result); } catch (error) { next(error); } };
const itarWorkOrderGuard = (actionType) => requireUsPersonForItarRecord({ targetTable: "work_orders", actionType, loadRecord: (req) => service.getWorkOrder(id(req.params.id)) });

router.use(authenticate);
router.get("/", validateQuery(paginationQuerySchema), handle(async (req) => {
	const userIsUsPerson = isUsPerson(req.user);
	const result = await service.listWorkOrders({ ...req.query, includeItarControlled: userIsUsPerson });
	const itarRows = result.data.filter((workOrder) => workOrder.is_itar_controlled);
	await Promise.all(itarRows.map((workOrder) => recordComplianceAudit({ req, actionType: "VIEW", targetTable: "work_orders", targetRecordId: workOrder.id, isItarControlled: true, decision: "allowed", reason: "US person listed ITAR work order" })));
	if (!userIsUsPerson) {
		await recordComplianceAudit({ req, actionType: "VIEW", targetTable: "work_orders", targetRecordId: "filtered-list", isItarControlled: true, decision: "blocked", reason: "Non-US person work-order list suppressed ITAR rows" });
	}
	return result;
}));
router.get("/:id", itarWorkOrderGuard("VIEW"), handle((req) => service.getWorkOrder(id(req.params.id))));
router.post("/", validateBody(workOrderCreateSchema), requireUsPersonForItarPayload("work_orders"), handle(async (req) => {
	const workOrder = await service.createWorkOrder(req.body);
	broadcastShopFloorEvent("job-status", { actionType: "WORK_ORDER_CREATED", workOrder });
	return workOrder;
}));
router.post("/:id/actions", itarWorkOrderGuard("ACTION"), validateBody(workOrderRowActionSchema), handle(async (req) => {
	const workOrder = await service.getWorkOrder(id(req.params.id));
	if (!workOrder) return undefined;
	const payload = { actionType: req.body.actionType, workOrder, operatorId: req.body.operatorId || null, requestedBy: req.body.requestedBy || null, reorderReason: req.body.reorderReason || null };
	broadcastShopFloorEvent("job-action", payload);
	return { accepted: true, ...payload };
}));
router.put("/:id", itarWorkOrderGuard("MODIFY"), validateBody(workOrderUpdateSchema), requireUsPersonForItarPayload("work_orders"), handle(async (req) => {
	const workOrder = await service.updateWorkOrder(id(req.params.id), req.body);
	if (!workOrder) return undefined;
	const checkpoint = recordQualityCheckpoint(workOrder.id, req.body.qualityCheckpoint, req.body.qualityCheckpoint.failedCount > 0 ? "failed" : "passed");
	const payload = { actionType: "WORK_ORDER_UPDATED", workOrder, qualityCheckpoint: checkpoint };
	broadcastShopFloorEvent("job-status", payload);
	broadcastShopFloorEvent("quality-checkpoint", payload);
	return payload;
}));
router.put("/:id/status", itarWorkOrderGuard("MODIFY_STATUS"), validateBody(workOrderStatusUpdateSchema), handle(async (req) => {
	const workOrder = await service.updateWorkOrderStatus(id(req.params.id), req.body.status);
	if (!workOrder) return undefined;
	const checkpoint = recordQualityCheckpoint(workOrder.id, req.body.qualityCheckpoint, req.body.qualityCheckpoint.failedCount > 0 ? "failed" : "passed");
	const payload = { actionType: "WORK_ORDER_STATUS_UPDATED", workOrder, qualityCheckpoint: checkpoint };
	broadcastShopFloorEvent("job-status", payload);
	broadcastShopFloorEvent("quality-checkpoint", payload);
	return payload;
}));
router.delete("/:id", itarWorkOrderGuard("DELETE"), async (req, res, next) => { try { if (!(await service.deleteWorkOrder(id(req.params.id)))) return res.status(404).json({ error: "Work order not found" }); return res.status(204).send(); } catch (error) { next(error); } });
export default router;
