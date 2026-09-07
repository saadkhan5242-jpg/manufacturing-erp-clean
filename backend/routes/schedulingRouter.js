import express from "express";
import { loadCollection, saveCollection } from "../storage/jsonStore.js";

const router = express.Router();
const allowedStatuses = new Set(["scheduled", "in-progress", "completed"]);

export const schedules = loadCollection("schedules.json", [
  {
    id: 1,
    workOrderId: 1001,
    workCenterId: 1,
    startTime: "2026-09-05T08:00:00.000Z",
    endTime: "2026-09-05T12:00:00.000Z",
    status: "scheduled"
  }
]);

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validateSchedule(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be an object";
  }

  for (const field of ["workOrderId", "workCenterId"]) {
    if (!Number.isInteger(body[field]) || body[field] <= 0) {
      return `${field} must be a positive integer`;
    }
  }

  for (const field of ["startTime", "endTime"]) {
    if (typeof body[field] !== "string" || Number.isNaN(Date.parse(body[field]))) {
      return `${field} must be a valid date and time`;
    }
  }

  if (new Date(body.endTime) <= new Date(body.startTime)) {
    return "endTime must be after startTime";
  }

  if (!allowedStatuses.has(body.status)) {
    return "status must be scheduled, in-progress, or completed";
  }

  return null;
}

function normalizedSchedule(body) {
  return {
    workOrderId: body.workOrderId,
    workCenterId: body.workCenterId,
    startTime: new Date(body.startTime).toISOString(),
    endTime: new Date(body.endTime).toISOString(),
    status: body.status
  };
}

router.get("/", (_req, res) => {
  res.json(schedules);
});

router.post("/", (req, res) => {
  const validationError = validateSchedule(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const newSchedule = {
    id: schedules.length === 0 ? 1 : Math.max(...schedules.map((schedule) => schedule.id)) + 1,
    ...normalizedSchedule(req.body)
  };
  schedules.push(newSchedule);
  saveCollection("schedules.json", schedules);

  return res.status(201).json(newSchedule);
});

router.put("/:id", (req, res) => {
  const id = parseId(req.params.id);
  const scheduleIndex = id === null ? -1 : schedules.findIndex((schedule) => schedule.id === id);

  if (scheduleIndex === -1) {
    return res.status(404).json({ error: "Schedule not found" });
  }

  const validationError = validateSchedule(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  schedules[scheduleIndex] = { id, ...normalizedSchedule(req.body) };
  saveCollection("schedules.json", schedules);
  return res.json(schedules[scheduleIndex]);
});

router.delete("/:id", (req, res) => {
  const id = parseId(req.params.id);
  const scheduleIndex = id === null ? -1 : schedules.findIndex((schedule) => schedule.id === id);

  if (scheduleIndex === -1) {
    return res.status(404).json({ error: "Schedule not found" });
  }

  schedules.splice(scheduleIndex, 1);
  saveCollection("schedules.json", schedules);
  return res.status(204).send();
});

export default router;
