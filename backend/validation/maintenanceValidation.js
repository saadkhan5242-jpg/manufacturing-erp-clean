const allowedStatuses = new Set(["scheduled", "in-progress", "completed", "cancelled"]);
const allowedPriorities = new Set(["low", "medium", "high", "critical"]);

export function validateMaintenance(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be an object";
  }

  for (const field of ["equipmentId", "title", "description"]) {
    if (typeof body[field] !== "string" || body[field].trim() === "") {
      return `${field} is required and must be a non-empty string`;
    }
  }

  if (typeof body.scheduledDate !== "string" || Number.isNaN(Date.parse(body.scheduledDate))) {
    return "scheduledDate must be a valid date";
  }

  if (!allowedStatuses.has(body.status)) {
    return "status must be scheduled, in-progress, completed, or cancelled";
  }

  if (!allowedPriorities.has(body.priority)) {
    return "priority must be low, medium, high, or critical";
  }

  return null;
}

export function normalizeMaintenance(body) {
  return {
    equipmentId: body.equipmentId.trim(),
    title: body.title.trim(),
    description: body.description.trim(),
    scheduledDate: new Date(body.scheduledDate).toISOString().slice(0, 10),
    status: body.status,
    priority: body.priority
  };
}
