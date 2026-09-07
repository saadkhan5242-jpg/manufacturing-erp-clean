const requiredStringFields = ["name", "code", "email", "phone"];

export function validateSupplier(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be an object";
  }

  for (const field of requiredStringFields) {
    if (typeof body[field] !== "string" || body[field].trim() === "") {
      return `${field} is required and must be a non-empty string`;
    }
  }

  if (!/^\S+@\S+\.\S+$/.test(body.email.trim())) {
    return "email must be a valid email address";
  }

  if (body.active !== undefined && typeof body.active !== "boolean") {
    return "active must be a boolean";
  }

  return null;
}

export function normalizeSupplier(body) {
  return {
    name: body.name.trim(),
    code: body.code.trim().toUpperCase(),
    email: body.email.trim().toLowerCase(),
    phone: body.phone.trim(),
    active: body.active ?? true
  };
}
