export type UserRole = "admin" | "manager" | "operator" | "viewer" | "finance";

export interface UserSession {
  id: number;
  sub: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export interface WorkOrderContract {
  id: number;
  orderNumber: string;
  partNumber: string;
  status: "Planned" | "Released" | "In-Progress" | "Completed" | "Shipped" | "Cancelled";
  quantityOrdered: number;
  quantityCompleted: number;
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
