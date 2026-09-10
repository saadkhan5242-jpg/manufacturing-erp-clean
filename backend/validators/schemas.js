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
  measurementInstrumentId: z.coerce.number().int().positive().optional(),
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
  partsScrapped: z.coerce.number().int().nonnegative().optional().default(0),
  inventoryLotId: z.coerce.number().int().positive().optional(),
  defectCode: z.string().trim().min(1).optional(),
  nonConformanceDescription: z.string().trim().min(1).optional(),
  finalStatus: z.enum(["PAUSED", "COMPLETED", "SCRAPPED", "HOLD"]).optional().default("COMPLETED"),
  qualityCheckpoint: qualityCheckpointSchema
}).refine((payload) => Boolean(payload.logId || payload.employeeId || payload.workOrderId), {
  message: "logId, employeeId, or workOrderId is required",
  path: ["logId"]
}).refine((payload) => payload.partsScrapped === 0 || Boolean(payload.defectCode && payload.nonConformanceDescription), {
  message: "defectCode and nonConformanceDescription are required when partsScrapped is greater than zero",
  path: ["defectCode"]
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
  status: z.enum(["open", "released", "in-progress", "completed", "cancelled", "hold", "scrapped"]).optional().default("open"),
  is_itar_controlled: z.boolean().optional().default(false)
});

export const workOrderUpdateSchema = z.object({
  orderNumber: z.string().trim().optional(),
  partNumber: z.string().trim().min(1, "partNumber is required"),
  quantity: z.coerce.number().positive("quantity must be greater than zero"),
  dueDate: z.string().trim().optional(),
  status: z.enum(["open", "released", "in-progress", "completed", "cancelled", "hold", "scrapped"]),
  is_itar_controlled: z.boolean().optional().default(false),
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

export const rfqSchema = z.object({
  rfqNumber: z.string().trim().min(1),
  customerId: z.string().trim().min(1),
  receivedAt: z.coerce.date().optional(),
  dueAt: z.coerce.date().optional(),
  status: z.enum(["open", "estimating", "quoted", "won", "lost", "cancelled"]).optional().default("open"),
  is_itar_controlled: z.boolean().optional().default(false),
  createdBy: z.coerce.number().int().positive().optional()
}).strict();

export const rfqLineItemSchema = z.object({
  rfqId: z.coerce.number().int().positive(),
  lineNumber: z.coerce.number().int().positive(),
  partId: z.coerce.number().int().positive().optional(),
  productId: z.coerce.number().int().positive().optional(),
  partNumber: z.string().trim().min(1),
  description: z.string().trim().optional().default(""),
  quantity: z.coerce.number().positive(),
  dueDate: z.coerce.date().optional(),
  is_itar_controlled: z.boolean().optional().default(false)
}).strict();

export const quoteEstimateSchema = z.object({
  rfqLineItemId: z.coerce.number().int().positive(),
  estimatorUserId: z.coerce.number().int().positive().optional(),
  workCenterId: z.coerce.number().int().positive().optional(),
  estimatedSetupMinutes: z.coerce.number().nonnegative(),
  estimatedRunMinutesPerPiece: z.coerce.number().nonnegative(),
  machineRate: z.coerce.number().nonnegative(),
  laborRate: z.coerce.number().nonnegative(),
  rawMaterialCost: z.coerce.number().nonnegative(),
  outsideProcessCost: z.coerce.number().nonnegative().optional().default(0),
  estimatorNotes: z.string().trim().max(2000).optional().default(""),
  confidenceScore: z.coerce.number().min(0).max(100).optional()
}).strict();

export const manufacturingBomComponentSchema = z.object({
  childPartId: z.coerce.number().int().positive().optional(),
  childProductId: z.coerce.number().int().positive().optional(),
  childBomId: z.coerce.number().int().positive().optional(),
  sequenceNumber: z.coerce.number().int().positive().optional().default(10),
  quantityPer: z.coerce.number().positive(),
  unit: z.string().trim().min(1).optional().default("each"),
  scrapPercent: z.coerce.number().min(0).optional().default(0),
  referenceDesignator: z.string().trim().max(200).optional().default(""),
  isCriticalToQuality: z.boolean().optional().default(false)
}).strict().refine((payload) => Boolean(payload.childPartId || payload.childProductId || payload.childBomId), {
  message: "childPartId, childProductId, or childBomId is required",
  path: ["childPartId"]
});

export const manufacturingBomSchema = z.object({
  parentPartId: z.coerce.number().int().positive().optional(),
  parentProductId: z.coerce.number().int().positive().optional(),
  revision: z.string().trim().min(1),
  status: z.enum(["draft", "active", "superseded", "obsolete"]).optional().default("draft"),
  is_itar_controlled: z.boolean().optional().default(false),
  approvedBy: z.coerce.number().int().positive().optional(),
  approvedAt: z.coerce.date().optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional(),
  components: z.array(manufacturingBomComponentSchema).min(1)
}).strict().refine((payload) => Boolean(payload.parentPartId || payload.parentProductId), {
  message: "parentPartId or parentProductId is required",
  path: ["parentPartId"]
});

export const workOrderRouterOperationSchema = z.object({
  workOrderId: z.coerce.number().int().positive(),
  sourceRoutingOperationId: z.coerce.number().int().positive().optional(),
  sequenceNumber: z.coerce.number().int().positive(),
  workCenterId: z.coerce.number().int().positive(),
  assignedEmployeeId: z.coerce.number().int().positive().optional(),
  operationName: z.string().trim().min(1),
  instructions: z.string().trim().max(4000).optional().default(""),
  estimatedSetupMinutes: z.coerce.number().nonnegative(),
  estimatedRunMinutes: z.coerce.number().nonnegative(),
  actualSetupMinutes: z.coerce.number().nonnegative().optional().default(0),
  actualRunMinutes: z.coerce.number().nonnegative().optional().default(0),
  active: z.boolean().optional().default(false),
  status: z.enum(["pending", "ready", "active", "paused", "qc-hold", "complete", "scrapped"]).optional().default("pending")
}).strict();

export const supplierMaterialDocumentSchema = z.object({
  supplierId: z.coerce.number().int().positive().optional(),
  purchaseOrderId: z.coerce.number().int().positive().optional(),
  purchaseOrderLineId: z.coerce.number().int().positive().optional(),
  documentType: z.enum(["supplier_invoice", "mill_test_report", "certificate_of_conformance", "packing_slip"]),
  documentNumber: z.string().trim().min(1),
  fileUri: z.string().trim().min(1),
  uploadedBy: z.coerce.number().int().positive().optional()
}).strict();

export const inventoryLotSchema = z.object({
  partId: z.coerce.number().int().positive().optional(),
  productId: z.coerce.number().int().positive().optional(),
  lotNumber: z.string().trim().min(1),
  heatNumber: z.string().trim().min(1),
  serialNumber: z.string().trim().min(1).optional(),
  quantityOnHand: z.coerce.number().nonnegative(),
  location: z.string().trim().min(1).optional().default("RECEIVING"),
  supplierId: z.coerce.number().int().positive().optional(),
  supplierMaterialDocumentId: z.coerce.number().int().positive(),
  is_itar_controlled: z.boolean().optional().default(false)
}).strict().refine((payload) => Boolean(payload.partId || payload.productId), {
  message: "partId or productId is required",
  path: ["partId"]
});

export const inventoryLotMovementSchema = z.object({
  inventoryLotId: z.coerce.number().int().positive(),
  movementType: z.enum(["receive", "issue", "move", "consume", "adjust", "ship"]),
  quantity: z.coerce.number().refine((value) => value !== 0, "quantity cannot be zero"),
  fromLocation: z.string().trim().optional(),
  toLocation: z.string().trim().optional(),
  workOrderId: z.coerce.number().int().positive().optional(),
  supplierMaterialDocumentId: z.coerce.number().int().positive(),
  performedBy: z.coerce.number().int().positive().optional(),
  notes: z.string().trim().max(1000).optional().default("")
}).strict();

export const inspectionMeasurementSchema = z.object({
  characteristicNumber: z.string().trim().min(1),
  description: z.string().trim().min(1),
  nominalValue: z.coerce.number(),
  lowerTolerance: z.coerce.number().nonnegative().optional().default(0),
  upperTolerance: z.coerce.number().nonnegative().optional().default(0),
  actualValue: z.coerce.number(),
  unit: z.string().trim().min(1).optional().default("in")
}).strict().transform((measurement) => {
  const lowerLimit = measurement.nominalValue - measurement.lowerTolerance;
  const upperLimit = measurement.nominalValue + measurement.upperTolerance;
  return {
    ...measurement,
    passFail: measurement.actualValue >= lowerLimit && measurement.actualValue <= upperLimit ? "pass" : "fail"
  };
});

export const inspectionRecordSchema = z.object({
  workOrderId: z.coerce.number().int().positive(),
  routingStepId: z.coerce.number().int().positive(),
  inspectionType: z.enum(["in_process", "first_article", "final", "receiving"]),
  measurementInstrumentId: z.coerce.number().int().positive().optional(),
  employeeId: z.string().trim().min(1),
  notes: z.string().trim().max(1000).optional().default(""),
  measurements: z.array(inspectionMeasurementSchema).min(1)
}).strict();

export const faiReportSchema = z.object({
  workOrderId: z.coerce.number().int().positive(),
  partNumber: z.string().trim().min(1),
  partName: z.string().trim().optional().default(""),
  revision: z.string().trim().optional().default(""),
  reportNumber: z.string().trim().min(1),
  result: z.enum(["approved", "rejected", "partial", "pending_review"]),
  form1: z.object({
    partNumber: z.string().trim().min(1),
    partName: z.string().trim().min(1),
    serialNumber: z.string().trim().optional(),
    faiType: z.enum(["full", "partial"]),
    reasonForPartial: z.string().trim().optional(),
    organizationName: z.string().trim().min(1),
    purchaseOrderNumber: z.string().trim().optional()
  }).strict(),
  form2: z.object({
    materialOrProcessName: z.string().trim().min(1),
    specificationNumber: z.string().trim().min(1),
    supplierCode: z.string().trim().optional(),
    certificateNumber: z.string().trim().min(1)
  }).strict(),
  form3: z.array(inspectionMeasurementSchema).min(1)
}).strict();

export const ncrSchema = z.object({
  workOrderId: z.coerce.number().int().positive(),
  routingStepId: z.coerce.number().int().positive().optional(),
  inventoryLotId: z.coerce.number().int().positive().optional(),
  employeeId: z.string().trim().min(1),
  quantityScrapped: z.coerce.number().int().positive(),
  defectCode: z.string().trim().min(1),
  description: z.string().trim().min(1),
  severity: z.enum(["minor", "major", "critical"]).optional().default("major")
}).strict();

export const calibrationInstrumentSchema = z.object({
  instrumentNumber: z.string().trim().min(1),
  instrumentType: z.string().trim().min(1),
  description: z.string().trim().optional().default(""),
  serialNumber: z.string().trim().optional().default(""),
  ownerWorkCenterId: z.coerce.number().int().positive().optional(),
  calibrationDueAt: z.coerce.date(),
  status: z.enum(["active", "expired", "out_of_service", "lost"]).optional().default("active")
}).strict();

export const calibrationEventSchema = z.object({
  measurementInstrumentId: z.coerce.number().int().positive(),
  calibratedAt: z.coerce.date(),
  calibrationDueAt: z.coerce.date(),
  calibratedBy: z.coerce.number().int().positive().optional(),
  certificateDocumentId: z.coerce.number().int().positive().optional(),
  result: z.enum(["passed", "failed", "limited_use"]),
  notes: z.string().trim().max(1000).optional().default("")
}).strict();

export const mrpSupplierDelaySchema = z.object({
  queueLineId: z.coerce.number().int().positive(),
  delayedUntil: z.coerce.date(),
  reason: z.string().trim().min(1).max(500).optional()
}).strict();

export const aiQuoteIntakeRequestSchema = z.object({
  sourceType: z.enum(["customer_email", "rfq_text", "engineering_requirement", "manual"]).optional().default("customer_email"),
  customerId: z.string().trim().max(120).optional(),
  rawText: z.string().trim().min(25, "rawText must include enough RFQ context").max(120000, "rawText is too large for intake processing"),
  modelProvider: z.enum(["openai", "anthropic"]).optional(),
  modelName: z.string().trim().max(120).optional()
}).strict();

export const aiSecondaryFinishSchema = z.object({
  process: z.string().trim().min(1),
  specification: z.string().trim().min(1),
  notes: z.string().trim().max(500).optional().default("")
}).strict();

export const aiBomDraftItemSchema = z.object({
  parentPartNumber: z.string().trim().min(1).optional(),
  componentPartNumber: z.string().trim().min(1),
  componentDescription: z.string().trim().max(500).optional().default(""),
  materialGrade: z.string().trim().max(120).optional().default(""),
  quantityPer: z.coerce.number().positive(),
  unit: z.string().trim().min(1).max(30).optional().default("each"),
  sourceConfidence: z.coerce.number().min(0).max(100).optional()
}).strict();

export const aiRouterDraftStepSchema = z.object({
  sequenceNumber: z.coerce.number().int().positive(),
  operationName: z.string().trim().min(1),
  workCenterCode: z.string().trim().min(1).max(80),
  estimatedSetupMinutes: z.coerce.number().nonnegative(),
  estimatedRunMinutes: z.coerce.number().nonnegative(),
  outsideProcess: z.boolean().optional().default(false),
  finishSpecification: z.string().trim().max(200).optional().default(""),
  qaRequired: z.boolean().optional().default(false)
}).strict();

export const aiQuoteExtractionOutputSchema = z.object({
  partNumber: z.string().trim().min(1),
  revisionNumber: z.string().trim().optional().default(""),
  materialGrade: z.string().trim().min(1),
  materialVolume: z.coerce.number().nonnegative(),
  materialUnit: z.string().trim().min(1).max(30).optional().default("in3"),
  estimatedSetupMinutes: z.coerce.number().nonnegative(),
  estimatedCycleMinutes: z.coerce.number().nonnegative(),
  secondaryFinishes: z.array(aiSecondaryFinishSchema).optional().default([]),
  estimatorNotes: z.string().trim().max(3000).optional().default(""),
  confidenceScore: z.coerce.number().min(0).max(100).optional(),
  bomDraft: z.array(aiBomDraftItemSchema).optional().default([]),
  routerDraft: z.array(aiRouterDraftStepSchema).min(1)
}).strict();

export const aiProposalReviewSchema = z.object({
  approved: z.boolean(),
  reviewNotes: z.string().trim().min(1).max(2000)
}).strict();

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
