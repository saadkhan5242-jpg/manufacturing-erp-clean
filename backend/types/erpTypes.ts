export type UserRole = "admin" | "manager" | "operator" | "viewer" | "finance";

export interface UserSession {
  id: number;
  sub: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  is_us_citizen_or_permanent_resident: boolean;
}

export interface WorkOrderContract {
  id: number;
  orderNumber: string;
  partNumber: string;
  status: "Planned" | "Released" | "In-Progress" | "Completed" | "Shipped" | "Cancelled";
  quantityOrdered: number;
  quantityCompleted: number;
  is_itar_controlled: boolean;
  dueDate?: string;
  salesOrderId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface LaborTransactionContract {
  id: number;
  employeeId: string;
  workOrderId: number;
  routingStepId?: number;
  startTime: string;
  endTime?: string | null;
  setupHours: number;
  runHours: number;
  piecesProduced: number;
  piecesScrapped: number;
  laborCost: number;
  overheadCost: number;
  status: "RUNNING" | "COMPLETED" | "PAUSED";
}

export interface ProductContract {
  id: number;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unitPrice: number;
  active: boolean;
  is_itar_controlled: boolean;
}

export interface RfqContract {
  id: number;
  rfqNumber: string;
  customerId: string;
  receivedAt: string;
  dueAt?: string | null;
  status: "open" | "estimating" | "quoted" | "won" | "lost" | "cancelled";
  is_itar_controlled: boolean;
  createdBy?: number | null;
}

export interface RfqLineItemContract {
  id: number;
  rfqId: number;
  lineNumber: number;
  partId?: number | null;
  productId?: number | null;
  partNumber: string;
  description: string;
  quantity: number;
  dueDate?: string | null;
  is_itar_controlled: boolean;
}

export interface QuoteEstimateContract {
  id: number;
  rfqLineItemId: number;
  estimatorUserId?: number | null;
  workCenterId?: number | null;
  estimatedSetupMinutes: number;
  estimatedRunMinutesPerPiece: number;
  machineRate: number;
  laborRate: number;
  rawMaterialCost: number;
  outsideProcessCost: number;
  estimatorNotes: string;
  confidenceScore?: number | null;
}

export interface ManufacturingBomContract {
  id: number;
  parentPartId?: number | null;
  parentProductId?: number | null;
  revision: string;
  status: "draft" | "active" | "superseded" | "obsolete";
  is_itar_controlled: boolean;
  approvedBy?: number | null;
  approvedAt?: string | null;
  components: ManufacturingBomComponentContract[];
}

export interface ManufacturingBomComponentContract {
  id: number;
  bomId: number;
  childPartId?: number | null;
  childProductId?: number | null;
  childBomId?: number | null;
  sequenceNumber: number;
  quantityPer: number;
  unit: string;
  scrapPercent: number;
  referenceDesignator: string;
  isCriticalToQuality: boolean;
}

export interface WorkOrderRouterOperationContract {
  id: number;
  workOrderId: number;
  sourceRoutingOperationId?: number | null;
  sequenceNumber: number;
  workCenterId: number;
  assignedEmployeeId?: number | null;
  operationName: string;
  instructions: string;
  estimatedSetupMinutes: number;
  estimatedRunMinutes: number;
  actualSetupMinutes: number;
  actualRunMinutes: number;
  active: boolean;
  status: "pending" | "ready" | "active" | "paused" | "qc-hold" | "complete" | "scrapped";
}

export interface SupplierMaterialDocumentContract {
  id: number;
  supplierId?: number | null;
  purchaseOrderId?: number | null;
  purchaseOrderLineId?: number | null;
  documentType: "supplier_invoice" | "mill_test_report" | "certificate_of_conformance" | "packing_slip";
  documentNumber: string;
  fileUri: string;
  uploadedBy?: number | null;
  uploadedAt: string;
}

export interface InventoryLotContract {
  id: number;
  partId?: number | null;
  productId?: number | null;
  lotNumber: string;
  heatNumber: string;
  serialNumber?: string | null;
  quantityOnHand: number;
  location: string;
  supplierId?: number | null;
  supplierMaterialDocumentId: number;
  is_itar_controlled: boolean;
}

export interface InventoryLotMovementContract {
  id: number;
  inventoryLotId: number;
  movementType: "receive" | "issue" | "move" | "consume" | "adjust" | "ship";
  quantity: number;
  fromLocation?: string | null;
  toLocation?: string | null;
  workOrderId?: number | null;
  supplierMaterialDocumentId: number;
  performedBy?: number | null;
  performedAt: string;
  ipAddress?: string | null;
  notes: string;
}

export interface ComplianceAuditLogContract {
  id: number;
  userId?: number | null;
  actionType: string;
  targetTable: string;
  targetRecordId: string;
  targetFileId?: string | null;
  is_itar_controlled: boolean;
  decision: "allowed" | "blocked";
  severity: "info" | "warning" | "critical";
  reason: string;
  ipAddress?: string | null;
  userAgent: string;
  createdAt: string;
}

export interface InspectionMeasurementContract {
  id?: number;
  characteristicNumber: string;
  description: string;
  nominalValue: number;
  lowerTolerance: number;
  upperTolerance: number;
  actualValue: number;
  unit: string;
  passFail: "pass" | "fail";
}

export interface InspectionRecordContract {
  id: number;
  workOrderId: number;
  routingStepId: number;
  inspectionType: "in_process" | "first_article" | "final" | "receiving";
  measurementInstrumentId?: number | null;
  employeeId: string;
  result: "pass" | "fail" | "needs_review";
  signatureHash: string;
  signedAt: string;
  measurements: InspectionMeasurementContract[];
}

export interface FaiReportContract {
  id: number;
  workOrderId: number;
  partNumber: string;
  reportNumber: string;
  result: "approved" | "rejected" | "partial" | "pending_review";
  signatureHash: string;
  signedAt: string;
}

export interface NonConformanceReportContract {
  id: number;
  ncrNumber: string;
  workOrderId: number;
  routingStepId?: number | null;
  inventoryLotId?: number | null;
  quantityScrapped: number;
  status: "open" | "disposition_pending" | "capa_open" | "closed";
  signatureHash: string;
  reportedAt: string;
}

export interface CapaContract {
  id: number;
  capaNumber: string;
  ncrId: number;
  containmentAction: string;
  dueAt: string;
  status: "open" | "investigating" | "implemented" | "verified" | "closed";
}

export interface MeasurementInstrumentContract {
  id: number;
  instrumentNumber: string;
  instrumentType: string;
  description: string;
  serialNumber: string;
  ownerWorkCenterId?: number | null;
  calibrationDueAt: string;
  status: "active" | "expired" | "out_of_service" | "lost";
}

export interface MrpDiagnosticContract {
  level: "info" | "warning" | "critical";
  type: "SAFETY_STOCK" | "SHORTAGE" | "NO_PREFERRED_VENDOR" | "LEAD_TIME_RISK";
  partNumber: string;
  message: string;
  preferredVendorId?: number | null;
  requiredBy?: string;
  estimatedArrivalDate?: string;
}

export interface MrpRequirementContract {
  partNumber: string;
  description: string;
  grossRequirement: number;
  availableStock: number;
  allocatedStock: number;
  onOrder: number;
  safetyStock: number;
  netRequirement: number;
  suggestedOrderQty: number;
  estimatedUnitCost: number;
  estimatedTotalCost: number;
  preferredVendorId?: number | null;
  leadTimeDays: number;
  requiredBy?: string | null;
  estimatedArrivalDate?: string | null;
  priority: "standard" | "expedite" | "critical";
  status: "covered" | "shortage";
  sourceWorkOrders: Array<Record<string, unknown>>;
}

export interface MrpRunContract {
  success: boolean;
  runId?: string;
  preview: boolean;
  activeWorkOrderCount: number;
  activeSalesOrderCount: number;
  partsAnalyzed: number;
  shortagesFound: number;
  requirements: MrpRequirementContract[];
  diagnostics: MrpDiagnosticContract[];
}

export interface MrpPurchaseQueueLineContract {
  id: number;
  partNumber: string;
  description: string;
  suggestedOrderQty: number;
  estimatedTotalCost: number;
  requiredBy?: string | null;
  estimatedArrivalDate?: string | null;
  priority: "standard" | "expedite" | "critical";
}

export interface MrpVendorPurchaseQueueContract {
  preferredVendorId?: number | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  lines: MrpPurchaseQueueLineContract[];
  estimatedTotalCost: number;
}

export interface AiSecondaryFinishContract {
  process: string;
  specification: string;
  notes: string;
}

export interface AiBomDraftItemContract {
  parentPartNumber: string;
  componentPartNumber: string;
  componentDescription: string;
  materialGrade: string;
  quantityPer: number;
  unit: string;
  sourceConfidence?: number;
}

export interface AiRouterDraftStepContract {
  sequenceNumber: number;
  operationName: string;
  workCenterCode: string;
  estimatedSetupMinutes: number;
  estimatedRunMinutes: number;
  outsideProcess: boolean;
  finishSpecification: string;
  qaRequired: boolean;
}

export interface AiQuoteExtractionContract {
  partNumber: string;
  revisionNumber: string;
  materialGrade: string;
  materialVolume: number;
  materialUnit: string;
  estimatedSetupMinutes: number;
  estimatedCycleMinutes: number;
  secondaryFinishes: AiSecondaryFinishContract[];
  estimatorNotes: string;
  confidenceScore?: number;
  bomDraft: AiBomDraftItemContract[];
  routerDraft: AiRouterDraftStepContract[];
}

export interface AiQuoteIntakeProposalContract {
  id: number;
  proposalNumber: string;
  validationStatus: "draft_proposal" | "qa_approved" | "qa_rejected";
  requiresQaApproval: boolean;
  partNumber: string;
  revisionNumber: string;
  createdAt: string;
}

export interface SupplierContract {
  id: number;
  code: string;
  name: string;
  contactEmail?: string;
  rating?: number;
  active: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  requestId?: string;
}
