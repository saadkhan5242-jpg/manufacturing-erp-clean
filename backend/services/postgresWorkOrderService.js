import { query } from "../db.js";
import { loadCollection } from "../storage/jsonStore.js";

const statuses = new Set(["open", "released", "in-progress", "completed", "cancelled", "hold", "scrapped"]);
const sortColumns = {
  id: "wo.id",
  orderNumber: "wo.order_number",
  partNumber: "wo.part_number",
  quantity: "wo.quantity",
  status: "wo.status",
  dueDate: "wo.due_date",
  updatedAt: "wo.updated_at"
};
const select = `
  SELECT
    wo.id,
    wo.order_number AS "orderNumber",
    wo.part_number AS "partNumber",
    wo.quantity,
    wo.status,
    wo.due_date AS "dueDate",
    wo.created_at AS "createdAt",
    wo.updated_at AS "updatedAt"
  FROM work_orders wo
`;

function normalize(input) {
  if (!input || typeof input.partNumber !== "string" || input.partNumber.trim() === "") throw new Error("partNumber is required");
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("quantity must be greater than zero");
  const status = input.status ? String(input.status).toLowerCase() : "open";
  if (!statuses.has(status)) throw new Error(`status must be one of: ${[...statuses].join(", ")}`);
  return { orderNumber: String(input.orderNumber || `WO-${Date.now()}`).trim(), partNumber: input.partNumber.trim(), quantity, status, dueDate: input.dueDate || null };
}

function buildListQuery(filters = {}) {
  const values = [];
  const clauses = [];
  const add = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filters.status) clauses.push(`wo.status = ${add(filters.status)}`);
  if (filters.search) {
    const term = `%${filters.search}%`;
    clauses.push(`(wo.order_number ILIKE ${add(term)} OR wo.part_number ILIKE ${add(term)})`);
  }
  if (filters.machine) {
    clauses.push(`EXISTS (SELECT 1 FROM job_routing jr WHERE jr.work_order_id = wo.id AND jr.work_center_code ILIKE ${add(`%${filters.machine}%`)})`);
  }
  if (filters.operatorId) {
    clauses.push(`EXISTS (SELECT 1 FROM labor_transactions lt WHERE lt.work_order_id = wo.id AND lt.employee_id = ${add(filters.operatorId)})`);
  }
  if (filters.operatorStatus === "active") {
    clauses.push("EXISTS (SELECT 1 FROM labor_transactions lt WHERE lt.work_order_id = wo.id AND lt.end_time IS NULL)");
  }
  if (filters.operatorStatus === "idle") {
    clauses.push("NOT EXISTS (SELECT 1 FROM labor_transactions lt WHERE lt.work_order_id = wo.id AND lt.end_time IS NULL)");
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  return { where, values };
}

export async function listWorkOrders(filters = {}) {
  const { where, values } = buildListQuery(filters);
  const page = Number(filters.page) || 1;
  const limit = Math.min(Number(filters.limit) || 25, 100);
  const offset = (page - 1) * limit;
  const sortBy = sortColumns[filters.sortBy] ? filters.sortBy : "dueDate";
  const sortDir = filters.sortDir === "asc" ? "ASC" : "DESC";
  const totalResult = await query(`SELECT COUNT(*)::int AS total FROM work_orders wo ${where}`, values);
  const dataResult = await query(
    `${select} ${where} ORDER BY ${sortColumns[sortBy]} ${sortDir} NULLS LAST, wo.id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset]
  );

  return {
    data: dataResult.rows,
    pagination: { page, limit, total: totalResult.rows[0]?.total || 0, hasMore: offset + dataResult.rows.length < (totalResult.rows[0]?.total || 0) },
    filters: { status: filters.status || null, machine: filters.machine || null, operatorId: filters.operatorId || null, operatorStatus: filters.operatorStatus || "all", search: filters.search || null }
  };
}

export async function getWorkOrder(id) {
  const workOrder = (await query(`${select} WHERE wo.id = $1`, [id])).rows[0];
  if (!workOrder) return undefined;

  const [routingResult, laborResult] = await Promise.all([
    query(
      `SELECT id, sequence_number AS "sequenceNumber", work_center_code AS "workCenterCode", estimated_hours AS "estimatedHours", actual_hours AS "actualHours", status
       FROM job_routing
       WHERE work_order_id = $1
       ORDER BY sequence_number ASC`,
      [id]
    ),
    query(
      `SELECT id, employee_id AS "employeeId", start_time AS "startTime", end_time AS "endTime", pieces_produced AS "piecesProduced", pieces_scrapped AS "piecesScrapped"
       FROM labor_transactions
       WHERE work_order_id = $1
       ORDER BY start_time DESC
       LIMIT 8`,
      [id]
    )
  ]);

  const documents = loadCollection("documents.json", []).filter((document) => {
    const sourceMatches = Number(document.sourceId) === Number(id);
    const referenceMatches = String(document.reference || "").includes(workOrder.orderNumber);
    return sourceMatches || referenceMatches;
  }).map((document) => ({
    id: document.id,
    title: document.title,
    type: document.type,
    reference: document.reference,
    createdAt: document.createdAt
  }));

  const milestones = [
    { id: "created", label: "Released", timestamp: workOrder.createdAt, status: "completed" },
    ...routingResult.rows.map((step) => ({
      id: `routing-${step.id}`,
      label: `${step.sequenceNumber} ${step.workCenterCode}`,
      status: step.status,
      estimatedHours: step.estimatedHours,
      actualHours: step.actualHours
    })),
    ...laborResult.rows.map((labor) => ({
      id: `labor-${labor.id}`,
      label: `${labor.employeeId} labor ${labor.endTime ? "posted" : "active"}`,
      timestamp: labor.endTime || labor.startTime,
      status: labor.endTime ? "completed" : "in-progress",
      piecesProduced: labor.piecesProduced,
      piecesScrapped: labor.piecesScrapped
    }))
  ];

  return { ...workOrder, routingSteps: routingResult.rows, milestones, documents };
}

export async function createWorkOrder(input) {
  const item = normalize(input);
  return (await query(
    "INSERT INTO work_orders (order_number, part_number, quantity, status, due_date) VALUES ($1, $2, $3, $4, $5) RETURNING id, order_number AS \"orderNumber\", part_number AS \"partNumber\", quantity, status, due_date AS \"dueDate\", created_at AS \"createdAt\", updated_at AS \"updatedAt\"",
    [item.orderNumber, item.partNumber, item.quantity, item.status, item.dueDate]
  )).rows[0];
}

export async function updateWorkOrder(id, input) {
  const item = normalize(input);
  return (await query(
    "UPDATE work_orders SET order_number = $1, part_number = $2, quantity = $3, status = $4, due_date = $5, updated_at = NOW() WHERE id = $6 RETURNING id, order_number AS \"orderNumber\", part_number AS \"partNumber\", quantity, status, due_date AS \"dueDate\", created_at AS \"createdAt\", updated_at AS \"updatedAt\"",
    [item.orderNumber, item.partNumber, item.quantity, item.status, item.dueDate, id]
  )).rows[0];
}

export async function updateWorkOrderStatus(id, status) {
  return (await query(
    "UPDATE work_orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, order_number AS \"orderNumber\", part_number AS \"partNumber\", quantity, status, due_date AS \"dueDate\", created_at AS \"createdAt\", updated_at AS \"updatedAt\"",
    [status, id]
  )).rows[0];
}

export async function deleteWorkOrder(id) {
  return (await query("DELETE FROM work_orders WHERE id = $1 RETURNING id", [id])).rowCount > 0;
}
