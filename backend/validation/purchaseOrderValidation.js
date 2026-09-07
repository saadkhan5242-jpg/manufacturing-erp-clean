const allowedStatuses = new Set(["draft", "submitted", "approved", "received", "cancelled"]);

export function validatePurchaseOrder(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be an object";
  }

  if (typeof body.orderNumber !== "string" || body.orderNumber.trim() === "") {
    return "orderNumber is required and must be a non-empty string";
  }

  if (!Number.isInteger(body.supplierId) || body.supplierId <= 0) {
    return "supplierId must be a positive integer";
  }

  if (typeof body.orderDate !== "string" || Number.isNaN(Date.parse(body.orderDate))) {
    return "orderDate must be a valid date";
  }

  if (!allowedStatuses.has(body.status)) {
    return "status must be draft, submitted, approved, received, or cancelled";
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return "items must contain at least one line item";
  }

  for (const item of body.items) {
    if (!item || !Number.isInteger(item.productId) || item.productId <= 0) {
      return "each item productId must be a positive integer";
    }
    if (typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity <= 0) {
      return "each item quantity must be a positive number";
    }
    if (typeof item.unitPrice !== "number" || !Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
      return "each item unitPrice must be a non-negative number";
    }
  }

  return null;
}

export function normalizePurchaseOrder(body) {
  const items = body.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice
  }));

  return {
    orderNumber: body.orderNumber.trim().toUpperCase(),
    supplierId: body.supplierId,
    orderDate: new Date(body.orderDate).toISOString().slice(0, 10),
    status: body.status,
    items,
    total: Math.round(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100) / 100
  };
}
