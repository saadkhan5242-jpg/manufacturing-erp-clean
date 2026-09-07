import { z } from "zod";

export const clockInSchema = z.object({
  employeeId: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
  workOrderId: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
  routerOperationId: z.union([z.string(), z.number()]).optional(),
  sequence: z.union([z.string(), z.number()]).optional(),
  jobStatus: z.enum(["SETUP", "RUNNING", "PAUSED", "COMPLETED"]).optional().default("RUNNING")
});

export const clockOutSchema = z.object({
  employeeId: z.union([z.string(), z.number()]).optional(),
  workOrderId: z.union([z.string(), z.number()]).optional(),
  logId: z.union([z.string(), z.number()]).optional(),
  partsProduced: z.number().nonnegative().optional().default(0),
  finalStatus: z.string().optional().default("COMPLETED")
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
