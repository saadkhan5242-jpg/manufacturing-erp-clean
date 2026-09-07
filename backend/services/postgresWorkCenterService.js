import { query } from "../db.js";

function normalize(input) {
  if (!input || typeof input.name !== "string" || input.name.trim() === "") throw new Error("name is required");
  if (typeof input.code !== "string" || input.code.trim() === "") throw new Error("code is required");
  const capacity = Number(input.dailyCapacityHours);
  if (!Number.isFinite(capacity) || capacity < 0) throw new Error("dailyCapacityHours must be a non-negative number");
  return { name: input.name.trim(), code: input.code.trim().toUpperCase(), dailyCapacityHours: capacity, laborRate: Number(input.laborRate || 0), machineRate: Number(input.machineRate || 0) };
}

export async function listWorkCenters() { return (await query("SELECT id, code, name, daily_capacity_hours AS \"dailyCapacityHours\", labor_rate AS \"laborRate\", machine_rate AS \"machineRate\", active FROM work_centers ORDER BY code")).rows; }
export async function getWorkCenter(id) { return (await query("SELECT id, code, name, daily_capacity_hours AS \"dailyCapacityHours\", labor_rate AS \"laborRate\", machine_rate AS \"machineRate\", active FROM work_centers WHERE id = $1", [id])).rows[0]; }
export async function createWorkCenter(input) { const item = normalize(input); return (await query("INSERT INTO work_centers (code, name, daily_capacity_hours, labor_rate, machine_rate) VALUES ($1, $2, $3, $4, $5) RETURNING id, code, name, daily_capacity_hours AS \"dailyCapacityHours\", labor_rate AS \"laborRate\", machine_rate AS \"machineRate\", active", [item.code, item.name, item.dailyCapacityHours, item.laborRate, item.machineRate])).rows[0]; }
export async function updateWorkCenter(id, input) { const item = normalize(input); return (await query("UPDATE work_centers SET code = $1, name = $2, daily_capacity_hours = $3, labor_rate = $4, machine_rate = $5, updated_at = NOW() WHERE id = $6 RETURNING id, code, name, daily_capacity_hours AS \"dailyCapacityHours\", labor_rate AS \"laborRate\", machine_rate AS \"machineRate\", active", [item.code, item.name, item.dailyCapacityHours, item.laborRate, item.machineRate, id])).rows[0]; }
export async function deleteWorkCenter(id) { return (await query("DELETE FROM work_centers WHERE id = $1 RETURNING id", [id])).rowCount > 0; }
