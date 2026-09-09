import { z } from "zod";

const numericString = z.union([z.string(), z.number()]).transform((value) => String(value).trim());

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(25),
  sortBy: z.string().trim().optional().default("updatedAt"),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
  status: z.string().trim().optional(),
  machine: z.string().trim().optional(),
  operatorId: z.string().trim().optional(),
  operatorStatus: z.enum(["active", "idle", "all"]).optional().default("all"),
  search: z.string().trim().optional()
});

export const qualityCheckpointSchema = z.object({
  passedCount: z.coerce.number().int().nonnegative(),
  failedCount: z.coerce.number().int().nonnegative().optional().default(0),
  materialCertId: z.string().trim().min(1, "materialCertId is required").optional(),
  employeeId: z.string().trim().min(1, "employeeId is required"),
  employeeTimestamp: z.coerce.date(),
  notes: z.string().trim().max(500).optional().default("")
});

export const clockInSchema = z.object({
  employeeId: numericString.optional(),
  employeeNumber: numericString.optional(),
  workOrderId: numericString.optional(),
  workOrderNumber: numericString.optional(),
  routerOperationId: numericString.optional(),
  sequence: numericString.optional(),
  jobStatus: z.enum(["SETUP", "RUNNING", "PAUSED", "COMPLETED"]).optional().default("RUNNING")
}).refine((payload) => Boolean(payload.employeeId || payload.employeeNumber), {
  message: "employeeId or employeeNumber is required",
  path: ["employeeId"]
}).refine((payload) => Boolean(payload.workOrderId || payload.workOrderNumber), {
  message: "workOrderId or workOrderNumber is required",
  path: ["workOrderId"]
});

export const clockOutSchema = z.object({
  employeeId: numericString.optional(),
  workOrderId: numericString.optional(),
  logId: numericString.optional(),
  partsProduced: z.coerce.number().int().nonnegative().optional().default(0),
  finalStatus: z.enum(["PAUSED", "COMPLETED", "SCRAPPED", "HOLD"]).optional().default("COMPLETED"),
  qualityCheckpoint: qualityCheckpointSchema
}).refine((payload) => Boolean(payload.logId || payload.employeeId || payload.workOrderId), {
  message: "logId, employeeId, or workOrderId is required",
  path: ["logId"]
});

export const shopFloorActionSchema = z.object({
  actionType: z.enum(["CLOCK_IN", "CLOCK_OUT", "PAUSE", "RESUME", "QUALITY_CHECK", "MATERIAL_CERT"]),
  employeeId: z.string().trim().min(1),
  workOrderId: numericString,
  routerOperationId: numericString.optional(),
  machine: z.string().trim().optional(),
  status: z.enum(["SETUP", "RUNNING", "PAUSED", "COMPLETED", "HOLD", "SCRAPPED"]).optional(),
  qualityCheckpoint: qualityCheckpointSchema
});

export const workOrderStatusUpdateSchema = z.object({
  status: z.enum(["open", "released", "in-progress", "completed", "cancelled", "hold", "scrapped"]),
  qualityCheckpoint: qualityCheckpointSchema
});

export const workOrderCreateSchema = z.object({
  orderNumber: z.string().trim().optional(),
  partNumber: z.string().trim().min(1, "partNumber is required"),
  quantity: z.coerce.number().positive("quantity must be greater than zero"),
  dueDate: z.string().trim().optional(),
  status: z.enum(["open", "released", "in-progress", "completed", "cancelled", "hold", "scrapped"]).optional().default("open")
});

export const workOrderUpdateSchema = z.object({
  orderNumber: z.string().trim().optional(),
  partNumber: z.string().trim().min(1, "partNumber is required"),
  quantity: z.coerce.number().positive("quantity must be greater than zero"),
  dueDate: z.string().trim().optional(),
  status: z.enum(["open", "released", "in-progress", "completed", "cancelled", "hold", "scrapped"]),
  qualityCheckpoint: qualityCheckpointSchema
});

export const workOrderRowActionSchema = z.object({
  actionType: z.enum(["QUICK_ASSIGN", "MATERIAL_REORDER"]),
  operatorId: z.string().trim().min(1).optional(),
  requestedBy: z.string().trim().min(1).optional(),
  reorderReason: z.string().trim().max(300).optional()
}).refine((payload) => payload.actionType !== "QUICK_ASSIGN" || Boolean(payload.operatorId), {
  message: "operatorId is required for QUICK_ASSIGN",
  path: ["operatorId"]
});

export const laborLogSchema = z.object({
  employeeId: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
  workOrderId: z.union([z.string(), z.number()]).transform((v) => Number(v)),
  routingStepId: z.union([z.string(), z.number()]).optional(),
  sequence: z.union([z.string(), z.number()]).optional(),
  workCode: z.enum(["R", "S", "I"]).optional(),
  setupHours: z.number().nonnegative().optional().default(0),
  runHours: z.number().nonnegative().optional().default(0),
  piecesProduced: z.number().nonnegative().optional().default(0),
  piecesScrapped: z.number().nonnegative().optional().default(0)
});

export const supervisorPinSchema = z.object({
  pin: z.string().length(4, "Supervisor PIN must be exactly 4 digits")
});

export const salesOrderSchema = z.object({
  orderNumber: z.string().min(1, "Order number is required"),
  customerId: z.string().min(1, "Customer ID is required"),
  partNumber: z.string().min(1, "Part number is required"),
  quantityOrdered: z.number().positive("Quantity ordered must be greater than zero"),
  unitPrice: z.number().nonnegative().optional().default(0),
  requiredDate: z.string().nullable().optional()
});

export const productSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Product name is required"),
  unitPrice: z.number().nonnegative().optional().default(0),
  category: z.string().optional()
});

export const aiEstimateSchema = z.object({
  operation: z.string().min(1, "Operation description is required"),
  material: z.string().optional(),
  quantity: z.number().positive().optional().default(1),
  complexity: z.enum(["low", "medium", "high", "extreme"]).optional().default("medium"),
  historicalSetupMinutes: z.number().optional(),
  historicalRunMinutes: z.number().optional()
});
