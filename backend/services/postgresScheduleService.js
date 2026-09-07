import { query } from "../db.js";

const statuses = new Set(["scheduled", "in-progress", "completed", "cancelled"]);
function normalize(input) {
  const workOrderId = Number(input?.workOrderId);
  const workCenterId = Number(input?.workCenterId);
  const start = new Date(input?.startTime);
  const end = new Date(input?.endTime);
  if (!Number.isInteger(workOrderId) || workOrderId <= 0) throw new Error("workOrderId must be a positive integer");
  if (!Number.isInteger(workCenterId) || workCenterId <= 0) throw new Error("workCenterId must be a positive integer");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new Error("endTime must be after a valid startTime");
  const status = input.status || "scheduled";
  if (!statuses.has(status)) throw new Error(`status must be one of: ${[...statuses].join(", ")}`);
  return { workOrderId, workCenterId, startTime: start.toISOString(), endTime: end.toISOString(), status };
}

const select = "SELECT id, work_order_id AS \"workOrderId\", work_center_id AS \"workCenterId\", start_time AS \"startTime\", end_time AS \"endTime\", status, created_at AS \"createdAt\", updated_at AS \"updatedAt\" FROM schedules";
export async function listSchedules() { return (await query(`${select} ORDER BY start_time`)).rows; }
export async function getSchedule(id) { return (await query(`${select} WHERE id = $1`, [id])).rows[0]; }
export async function createSchedule(input) { const item = normalize(input); return (await query("INSERT INTO schedules (work_order_id, work_center_id, start_time, end_time, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, work_order_id AS \"workOrderId\", work_center_id AS \"workCenterId\", start_time AS \"startTime\", end_time AS \"endTime\", status, created_at AS \"createdAt\", updated_at AS \"updatedAt\"", [item.workOrderId, item.workCenterId, item.startTime, item.endTime, item.status])).rows[0]; }
export async function updateSchedule(id, input) { const item = normalize(input); return (await query("UPDATE schedules SET work_order_id = $1, work_center_id = $2, start_time = $3, end_time = $4, status = $5, updated_at = NOW() WHERE id = $6 RETURNING id, work_order_id AS \"workOrderId\", work_center_id AS \"workCenterId\", start_time AS \"startTime\", end_time AS \"endTime\", status, created_at AS \"createdAt\", updated_at AS \"updatedAt\"", [item.workOrderId, item.workCenterId, item.startTime, item.endTime, item.status, id])).rows[0]; }
export async function deleteSchedule(id) { return (await query("DELETE FROM schedules WHERE id = $1 RETURNING id", [id])).rowCount > 0; }
