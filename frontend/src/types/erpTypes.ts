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
  jobStatus?: string;
  workCode?: string;
  setupHours?: number;
  runHours?: number;
  piecesProduced?: number;
  piecesScrapped?: number;
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
