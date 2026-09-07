import express from "express";
import { loadCollection, saveCollection } from "../storage/jsonStore.js";

const router = express.Router();

const routings = loadCollection("routings.json", [
  {
    id: 1,
    productId: 1,
    revision: "A",
    status: "active",
    steps: [
      { sequence: 10, operation: "CNC mill housing", workCenterId: 1, setupMinutes: 30, runMinutes: 45, instructions: "Verify datum alignment before first-off inspection." },
      { sequence: 20, operation: "Laser cut bracket", workCenterId: 2, setupMinutes: 15, runMinutes: 20, instructions: "Deburr all edges and verify hole pattern." }
    ]
  }
]);

function validateRouting(body) {
  if (!body || !Number.isInteger(body.productId) || body.productId <= 0) return "productId must be a positive integer";
  if (typeof body.revision !== "string" || body.revision.trim() === "") return "revision is required";
  if (!Array.isArray(body.steps) || body.steps.length === 0) return "steps must contain at least one operation";
  for (const step of body.steps) {
    if (!Number.isInteger(step.sequence) || step.sequence <= 0) return "each step sequence must be a positive integer";
    if (typeof step.operation !== "string" || step.operation.trim() === "") return "each step operation is required";
    if (!Number.isInteger(step.workCenterId) || step.workCenterId <= 0) return "each step workCenterId must be a positive integer";
    if (!Number.isInteger(step.setupMinutes) || step.setupMinutes < 0) return "setupMinutes must be a non-negative integer";
    if (!Number.isInteger(step.runMinutes) || step.runMinutes < 0) return "runMinutes must be a non-negative integer";
  }
  return null;
}

function normalizeRouting(body) {
  return {
    productId: body.productId,
    revision: body.revision.trim().toUpperCase(),
    status: body.status === "inactive" ? "inactive" : "active",
    steps: [...body.steps].sort((a, b) => a.sequence - b.sequence).map((step) => ({
      sequence: step.sequence,
      operation: step.operation.trim(),
      workCenterId: step.workCenterId,
      setupMinutes: step.setupMinutes,
      runMinutes: step.runMinutes,
      instructions: typeof step.instructions === "string" ? step.instructions.trim() : ""
    }))
  };
}

router.get("/", (_req, res) => res.json(routings));

router.post("/", (req, res) => {
  const validationError = validateRouting(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const normalized = normalizeRouting(req.body);
  const duplicate = routings.some((routing) => routing.productId === normalized.productId && routing.revision === normalized.revision);
  if (duplicate) return res.status(409).json({ error: "productId and revision must be unique" });

  const routing = { id: routings.length === 0 ? 1 : Math.max(...routings.map((item) => item.id)) + 1, ...normalized };
  routings.push(routing);
  saveCollection("routings.json", routings);
  return res.status(201).json(routing);
});

export default router;
