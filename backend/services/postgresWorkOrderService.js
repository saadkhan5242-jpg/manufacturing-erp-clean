import { query } from "../db.js";

const statuses = new Set(["open", "released", "in-progress", "completed", "cancelled"]);
function normalize(input) {
  if (!input || typeof input.partNumber !== "string" || input.partNumber.trim() === "") throw new Error("partNumber is required");
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("quantity must be greater than zero");
  const status = input.status ? String(input.status).toLowerCase() : "open";
  if (!statuses.has(status)) throw new Error(`status must be one of: ${[...statuses].join(", ")}`);
  return { orderNumber: String(input.orderNumber || `WO-${Date.now()}`).trim(), partNumber: input.partNumber.trim(), quantity, status, dueDate: input.dueDate || null };
}

const select = "SELECT id, order_number AS \"orderNumber\", part_number AS \"partNumber\", quantity, status, due_date AS \"dueDate\", created_at AS \"createdAt\", updated_at AS \"updatedAt\" FROM work_orders";
export async function listWorkOrders() { return (await query(`${select} ORDER BY due_date NULLS LAST, id`)).rows; }
export async function getWorkOrder(id) { return (await query(`${select} WHERE id = $1`, [id])).rows[0]; }
export async function createWorkOrder(input) { const item = normalize(input); return (await query("INSERT INTO work_orders (order_number, part_number, quantity, status, due_date) VALUES ($1, $2, $3, $4, $5) RETURNING id, order_number AS \"orderNumber\", part_number AS \"partNumber\", quantity, status, due_date AS \"dueDate\", created_at AS \"createdAt\", updated_at AS \"updatedAt\"", [item.orderNumber, item.partNumber, item.quantity, item.status, item.dueDate])).rows[0]; }
export async function updateWorkOrder(id, input) { const item = normalize(input); return (await query("UPDATE work_orders SET order_number = $1, part_number = $2, quantity = $3, status = $4, due_date = $5, updated_at = NOW() WHERE id = $6 RETURNING id, order_number AS \"orderNumber\", part_number AS \"partNumber\", quantity, status, due_date AS \"dueDate\", created_at AS \"createdAt\", updated_at AS \"updatedAt\"", [item.orderNumber, item.partNumber, item.quantity, item.status, item.dueDate, id])).rows[0]; }
export async function deleteWorkOrder(id) { return (await query("DELETE FROM work_orders WHERE id = $1 RETURNING id", [id])).rowCount > 0; }
