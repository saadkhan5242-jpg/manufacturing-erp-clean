export function validateWorkCenter(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be an object";
  }

  for (const field of ["name", "code"]) {
    if (typeof body[field] !== "string" || body[field].trim() === "") {
      return `${field} is required and must be a non-empty string`;
    }
  }

  const capacity = body.dailyCapacityHours ?? body.capacityHoursPerDay;
  if (typeof capacity !== "number" || !Number.isFinite(capacity) || capacity <= 0) {
    return "dailyCapacityHours must be a positive number";
  }

  return null;
}

export function normalizeWorkCenter(body) {
  const capacity = body.dailyCapacityHours ?? body.capacityHoursPerDay;
  return {
    name: body.name.trim(),
    code: body.code.trim().toUpperCase(),
    dailyCapacityHours: capacity,
    capacityHoursPerDay: capacity
  };
}
