import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { absorbManufacturingCosts } from "../services/wipLedgerService.js";
import { verifySupervisorPinHandler } from "../middleware/supervisorAuth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import { broadcastShopFloorEvent, subscribeToShopFloorEvents } from "../services/shopFloorEventBus.js";
import { recordQualityCheckpoint } from "../services/qualityCheckpointService.js";
import { assertSetupCalibrationValid, fileNcr } from "../services/qmsService.js";
import { clockInSchema, clockOutSchema, paginationQuerySchema, shopFloorActionSchema } from "../validators/schemas.js";

const router = Router();
const prisma = new PrismaClient();
const sortColumns = new Set(["orderNumber", "partNumber", "status", "dueDate", "updatedAt", "efficiency"]);

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toSerializable(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(toSerializable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toSerializable(item)]));
  }
  return value;
}

function numericIdFilter(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? { id } : null;
}

function buildWorkOrderWhere(filters) {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.machine) where.routingSteps = { some: { workCenterCode: { contains: filters.machine, mode: "insensitive" } } };
  if (filters.operatorId) where.laborTransactions = { some: { employeeId: filters.operatorId } };
  if (filters.operatorStatus === "active") {
    where.laborTransactions = { some: { ...(where.laborTransactions?.some || {}), endTime: null } };
  }
  if (filters.search) {
    where.OR = [
      { orderNumber: { contains: filters.search, mode: "insensitive" } },
      { partNumber: { contains: filters.search, mode: "insensitive" } }
    ];
  }
  return where;
}

function mapVarianceOrder(order) {
  const quantity = toNumber(order.quantity || order.quantityOrdered, 0);
  const estimatedHours = order.routingSteps.reduce((sum, step) => sum + toNumber(step.estimatedHours), 0);
  const actualHours = order.routingSteps.reduce((sum, step) => sum + toNumber(step.actualHours), 0);
  const activeLabor = order.laborTransactions.filter((transaction) => !transaction.endTime);
  const efficiency = actualHours > 0 ? Math.round((estimatedHours / actualHours) * 100) : 0;
  return {
    id: String(order.id),
    jobId: order.orderNumber,
    partNumber: order.partNumber,
    status: order.status,
    dueDate: order.dueDate,
    qtyOrdered: quantity,
    qtyCompleted: toNumber(order.quantityCompleted, 0),
    workCenters: order.routingSteps.map((step) => step.workCenterCode),
    activeOperators: activeLabor.map((transaction) => transaction.employeeId),
    efficiency,
    estimatedHours: estimatedHours.toFixed(2),
    actualHours: actualHours.toFixed(2)
  };
}

async function findWorkOrder(workOrderId, select) {
  const filters = [{ orderNumber: String(workOrderId) }];
  const numeric = numericIdFilter(workOrderId);
  if (numeric) filters.push(numeric);
  return prisma.workOrder.findFirst({ where: { OR: filters }, select });
}

router.post("/verify-pin", verifySupervisorPinHandler);

router.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const unsubscribe = subscribeToShopFloorEvents(res);
  req.on("close", unsubscribe);
});

router.post("/clock-in", validateBody(clockInSchema), async (req, res) => {
  const { employeeId, employeeNumber, workOrderId, workOrderNumber, routerOperationId, sequence, measurementInstrumentId, jobStatus } = req.body;
  const operatorId = employeeId || employeeNumber;
  const targetWorkOrderId = workOrderId || workOrderNumber;
  const rawSeq = routerOperationId || sequence || "10";

  try {
    const targetOrder = await findWorkOrder(targetWorkOrderId, { id: true, orderNumber: true, partNumber: true });
    if (!targetOrder) return res.status(404).json({ error: "Work order not found", requestId: req.requestId });

    const targetRoute = await prisma.jobRouting.findFirst({
      where: { workOrderId: targetOrder.id, sequenceNumber: parseInt(rawSeq, 10) || 10 },
      select: { id: true, sequenceNumber: true, workCenterCode: true }
    });
    if (!targetRoute) return res.status(404).json({ error: "Routing operation not found", requestId: req.requestId });

    if (jobStatus === "SETUP") {
      await assertSetupCalibrationValid({ workOrderId: targetOrder.id, routingStepId: targetRoute.id, measurementInstrumentId });
    }

    const laborLog = await prisma.$transaction(async (tx) => {
      const created = await tx.laborTransaction.create({
        data: {
          employeeId: operatorId,
          workOrderId: targetOrder.id,
          routingStepId: targetRoute.id,
          startTime: new Date()
        },
        select: { id: true, employeeId: true, startTime: true }
      });
      await tx.workOrder.update({ where: { id: targetOrder.id }, data: { status: "in-progress", updatedAt: new Date() } });
      await tx.jobRouting.update({ where: { id: targetRoute.id }, data: { status: jobStatus } });
      return created;
    });

    const payload = toSerializable({
      message: "Operator clocked into sequence successfully!",
      logId: laborLog.id,
      workOrderId: targetOrder.id,
      orderNumber: targetOrder.orderNumber,
      employeeId: operatorId,
      jobStatus,
      sequence: targetRoute.sequenceNumber,
      machine: targetRoute.workCenterCode,
      measurementInstrumentId: measurementInstrumentId || null
    });
    broadcastShopFloorEvent("job-status", payload);
    return res.status(201).json(payload);
  } catch (error) {
    console.error("Exception handled inside active labor cloud transaction:", error.message);
    return res.status(500).json({ error: "Failed to clock operator into work order", requestId: req.requestId });
  }
});

router.post("/actions", validateBody(shopFloorActionSchema), async (req, res) => {
  const { actionType, employeeId, workOrderId, routerOperationId, machine, status, qualityCheckpoint } = req.body;

  try {
    const order = await findWorkOrder(workOrderId, { id: true, orderNumber: true, partNumber: true, status: true });
    if (!order) return res.status(404).json({ error: "Work order not found", requestId: req.requestId });

    const checkpoint = recordQualityCheckpoint(order.id, qualityCheckpoint, qualityCheckpoint.failedCount > 0 ? "failed" : "passed");
    const nextStatus = status || (actionType === "QUALITY_CHECK" ? order.status : actionType.toLowerCase().replace("_", "-"));
    const updatedOrder = await prisma.workOrder.update({
      where: { id: order.id },
      data: { status: nextStatus, updatedAt: new Date() },
      select: { id: true, orderNumber: true, partNumber: true, status: true, updatedAt: true }
    });

    const payload = toSerializable({ actionType, employeeId, machine, routerOperationId, workOrder: updatedOrder, qualityCheckpoint: checkpoint });
    broadcastShopFloorEvent("job-status", payload);
    broadcastShopFloorEvent("quality-checkpoint", payload);
    return res.status(202).json(payload);
  } catch (error) {
    console.error("Exception handled inside dynamic shop floor action:", error.message);
    return res.status(500).json({ error: "Failed to process shop floor action", requestId: req.requestId });
  }
});

router.post("/clock-out", validateBody(clockOutSchema), async (req, res) => {
  const { employeeId, workOrderId, partsProduced, partsScrapped, inventoryLotId, defectCode, nonConformanceDescription, logId, finalStatus, qualityCheckpoint } = req.body;
  const targetLogId = logId ? Number(logId) : null;

  try {
    const targetOrder = !targetLogId && workOrderId ? await findWorkOrder(workOrderId, { id: true }) : null;
    const activePunch = targetLogId
      ? await prisma.laborTransaction.findUnique({ where: { id: targetLogId }, select: { id: true, workOrderId: true, routingStepId: true, employeeId: true, startTime: true } })
      : await prisma.laborTransaction.findFirst({
          where: {
            ...(employeeId ? { employeeId } : {}),
            ...(targetOrder ? { workOrderId: targetOrder.id } : {}),
            endTime: null
          },
          select: { id: true, workOrderId: true, routingStepId: true, employeeId: true, startTime: true },
          orderBy: { startTime: "desc" }
        });

    if (!activePunch) return res.status(404).json({ error: "Active labor punch not found", requestId: req.requestId });

    const now = new Date();
    const elapsedHours = Math.max((now.getTime() - new Date(activePunch.startTime).getTime()) / 3600000, 0);
    const closedPunch = await prisma.$transaction(async (tx) => {
      const updated = await tx.laborTransaction.update({
        where: { id: activePunch.id },
        data: { endTime: now, runHours: finalStatus === "COMPLETED" ? elapsedHours : 0, piecesProduced: partsProduced, piecesScrapped: partsScrapped },
        select: { id: true, employeeId: true, workOrderId: true, routingStepId: true, endTime: true, piecesProduced: true, piecesScrapped: true }
      });

      await tx.workOrder.update({
        where: { id: activePunch.workOrderId },
        data: { status: finalStatus.toLowerCase(), quantityCompleted: { increment: partsProduced }, updatedAt: now }
      });
      await tx.jobRouting.update({ where: { id: activePunch.routingStepId }, data: { status: finalStatus } });
      return updated;
    });

    const checkpoint = recordQualityCheckpoint(activePunch.workOrderId, qualityCheckpoint, qualityCheckpoint.failedCount > 0 ? "failed" : "passed");
    const ncrWorkflow = partsScrapped > 0 ? await fileNcr({
      workOrderId: Number(activePunch.workOrderId),
      routingStepId: Number(activePunch.routingStepId),
      inventoryLotId,
      employeeId: activePunch.employeeId,
      quantityScrapped: partsScrapped,
      defectCode,
      description: nonConformanceDescription,
      severity: "major"
    }, req) : null;
    await absorbManufacturingCosts(closedPunch.id);

    const payload = toSerializable({ message: "Operator clocked out and manufacturing costs absorbed successfully!", laborTransaction: closedPunch, qualityCheckpoint: checkpoint, ncrWorkflow });
    broadcastShopFloorEvent("job-status", payload);
    broadcastShopFloorEvent("quality-checkpoint", payload);
    if (ncrWorkflow) broadcastShopFloorEvent("non-conformance", ncrWorkflow);
    return res.status(200).json(payload);
  } catch (error) {
    console.error("Exception handled inside cloud clock out transaction:", error.message);
    return res.status(500).json({ error: "Failed to clock operator out of work order", requestId: req.requestId });
  }
});

router.get("/variance-analytics", validateQuery(paginationQuerySchema), async (req, res) => {
  const filters = req.query;
  const sortBy = sortColumns.has(filters.sortBy) ? filters.sortBy : "updatedAt";
  const skip = (filters.page - 1) * filters.limit;
  const orderBy = sortBy === "efficiency" ? { updatedAt: filters.sortDir } : { [sortBy]: filters.sortDir };

  try {
    const where = buildWorkOrderWhere(filters);
    const [activeWorkOrders, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy,
        select: {
          id: true,
          orderNumber: true,
          partNumber: true,
          quantity: true,
          quantityOrdered: true,
          quantityCompleted: true,
          status: true,
          dueDate: true,
          updatedAt: true,
          routingSteps: { select: { workCenterCode: true, sequenceNumber: true, estimatedHours: true, actualHours: true, status: true } },
          laborTransactions: { select: { employeeId: true, startTime: true, endTime: true, piecesProduced: true, piecesScrapped: true }, take: 8, orderBy: { startTime: "desc" } }
        }
      }),
      prisma.workOrder.count({ where })
    ]);

    const varianceData = activeWorkOrders.map(mapVarianceOrder).sort((left, right) => {
      if (sortBy !== "efficiency") return 0;
      return filters.sortDir === "asc" ? left.efficiency - right.efficiency : right.efficiency - left.efficiency;
    });

    return res.json({
      data: varianceData,
      pagination: { page: filters.page, limit: filters.limit, total, hasMore: skip + varianceData.length < total },
      filters: { status: filters.status || null, machine: filters.machine || null, operatorId: filters.operatorId || null, operatorStatus: filters.operatorStatus, search: filters.search || null }
    });
  } catch (error) {
    console.error("Prisma analytics engine data stream failure:", error.message);
    return res.status(500).json({ error: "Failed to compile live analytics data layers.", requestId: req.requestId });
  }
});

export default router;
