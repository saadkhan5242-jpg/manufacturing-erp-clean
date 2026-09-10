export type UserRole = "admin" | "manager" | "operator" | "viewer" | "finance";

export interface User {
  id: number;
  sub: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export interface WorkOrder {
  id: number;
  orderNumber: string;
  partNumber: string;
  status: string;
  quantityOrdered: number;
  quantityCompleted: number;
  currentWorkCenter?: string;
  currentSequence?: number;
  stepStatus?: string;
  estimatedHours?: number;
  loggedHours?: number;
  piecesProduced?: number;
  efficiencyPercent?: number;
  varianceHours?: number;
  varianceFlag?: "ON_TRACK" | "BEHIND" | "OVER_BUDGET";
  salesOrderNumber?: string | null;
  wipCost?: number;
}

export interface LaborPunchPayload {
  employeeId: string;
  workOrderId: number;
  sequence?: number;
  routerOperationId?: number;
  measurementInstrumentId?: number;
  jobStatus?: string;
  workCode?: string;
  setupHours?: number;
  runHours?: number;
  piecesProduced?: number;
  piecesScrapped?: number;
}

export interface InspectionMeasurement {
  characteristicNumber: string;
  description: string;
  nominalValue: number;
  lowerTolerance: number;
  upperTolerance: number;
  actualValue: number;
  unit: string;
  passFail?: "pass" | "fail";
}

export interface InspectionRecordPayload {
  workOrderId: number;
  routingStepId: number;
  inspectionType: "in_process" | "first_article" | "final" | "receiving";
  measurementInstrumentId?: number;
  employeeId: string;
  notes?: string;
  measurements: InspectionMeasurement[];
}

export interface FaiReportPayload {
  workOrderId: number;
  partNumber: string;
  partName: string;
  revision: string;
  reportNumber: string;
  result: "approved" | "rejected" | "partial" | "pending_review";
  form1: Record<string, string>;
  form2: Record<string, string>;
  form3: InspectionMeasurement[];
}

export interface NcrPayload {
  workOrderId: number;
  routingStepId?: number;
  inventoryLotId?: number;
  employeeId: string;
  quantityScrapped: number;
  defectCode: string;
  description: string;
  severity: "minor" | "major" | "critical";
}

export interface MeasurementInstrument {
  id: number;
  instrumentNumber: string;
  instrumentType: string;
  description: string;
  serialNumber: string;
  ownerWorkCenterId?: number | null;
  calibrationDueAt: string;
  status: "active" | "expired" | "out_of_service" | "lost";
}

export interface MrpDiagnostic {
  level: "info" | "warning" | "critical";
  type: "SAFETY_STOCK" | "SHORTAGE" | "NO_PREFERRED_VENDOR" | "LEAD_TIME_RISK";
  partNumber: string;
  message: string;
  preferredVendorId?: number | null;
  requiredBy?: string;
  estimatedArrivalDate?: string;
}

export interface MrpRequirement {
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

export interface MrpRunResult {
  success: boolean;
  runId?: string;
  preview: boolean;
  activeWorkOrderCount: number;
  activeSalesOrderCount: number;
  partsAnalyzed: number;
  shortagesFound: number;
  requirements: MrpRequirement[];
  diagnostics: MrpDiagnostic[];
}

export interface AiSecondaryFinish {
  process: string;
  specification: string;
  notes: string;
}

export interface AiBomDraftItem {
  parentPartNumber: string;
  componentPartNumber: string;
  componentDescription: string;
  materialGrade: string;
  quantityPer: number;
  unit: string;
  sourceConfidence?: number;
}

export interface AiRouterDraftStep {
  sequenceNumber: number;
  operationName: string;
  workCenterCode: string;
  estimatedSetupMinutes: number;
  estimatedRunMinutes: number;
  outsideProcess: boolean;
  finishSpecification: string;
  qaRequired: boolean;
}

export interface AiQuoteExtraction {
  partNumber: string;
  revisionNumber: string;
  materialGrade: string;
  materialVolume: number;
  materialUnit: string;
  estimatedSetupMinutes: number;
  estimatedCycleMinutes: number;
  secondaryFinishes: AiSecondaryFinish[];
  estimatorNotes: string;
  confidenceScore?: number;
  bomDraft: AiBomDraftItem[];
  routerDraft: AiRouterDraftStep[];
}

export interface AiQuoteIntakeProposal {
  id: number;
  proposalNumber: string;
  validationStatus: "draft_proposal" | "qa_approved" | "qa_rejected";
  requiresQaApproval: boolean;
  partNumber: string;
  revisionNumber: string;
  createdAt: string;
}

export interface SupervisorPinResponse {
  verified: boolean;
  error?: string;
}

export interface ApiResponse<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
  requestId?: string;
}
