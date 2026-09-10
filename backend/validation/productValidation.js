export function validateProduct(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be an object";
  }

  for (const field of ["name", "sku", "description"]) {
    if (typeof body[field] !== "string" || body[field].trim() === "") {
      return `${field} is required and must be a non-empty string`;
    }
  }

  if (typeof body.unitPrice !== "number" || !Number.isFinite(body.unitPrice) || body.unitPrice < 0) {
    return "unitPrice must be a non-negative number";
  }

  if (body.active !== undefined && typeof body.active !== "boolean") {
    return "active must be a boolean";
  }

  if (body.is_itar_controlled !== undefined && typeof body.is_itar_controlled !== "boolean") {
    return "is_itar_controlled must be a boolean";
  }

  return null;
}

export function normalizeProduct(body) {
  return {
    name: body.name.trim(),
    sku: body.sku.trim().toUpperCase(),
    description: body.description.trim(),
    unitPrice: body.unitPrice,
    active: body.active ?? true,
    is_itar_controlled: body.is_itar_controlled ?? body.isItarControlled ?? false
  };
}
