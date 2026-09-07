import express from "express";
import { loadCollection, saveCollection } from "../storage/jsonStore.js";

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function cleanRecord(body) {
  const record = { ...body };
  delete record.id;
  delete record.createdAt;
  delete record.updatedAt;
  return record;
}

export function createModuleRouter({ filename, seed = [] }) {
  const records = loadCollection(filename, seed);
  const router = express.Router();

  router.get("/", (_req, res) => res.json(records));

  router.get("/:id", (req, res) => {
    const id = parseId(req.params.id);
    const record = id === null ? undefined : records.find((entry) => entry.id === id);
    if (!record) return res.status(404).json({ error: "Record not found" });
    return res.json(record);
  });

  router.post("/", (req, res) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "Request body must be an object" });
    }
    const now = new Date().toISOString();
    const record = {
      id: records.length === 0 ? 1 : Math.max(...records.map((entry) => entry.id)) + 1,
      ...cleanRecord(req.body),
      createdAt: now,
      updatedAt: now
    };
    records.push(record);
    saveCollection(filename, records);
    return res.status(201).json(record);
  });

  router.put("/:id", (req, res) => {
    const id = parseId(req.params.id);
    const index = id === null ? -1 : records.findIndex((entry) => entry.id === id);
    if (index === -1) return res.status(404).json({ error: "Record not found" });
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "Request body must be an object" });
    }
    records[index] = { ...records[index], ...cleanRecord(req.body), id, updatedAt: new Date().toISOString() };
    saveCollection(filename, records);
    return res.json(records[index]);
  });

  router.delete("/:id", (req, res) => {
    const id = parseId(req.params.id);
    const index = id === null ? -1 : records.findIndex((entry) => entry.id === id);
    if (index === -1) return res.status(404).json({ error: "Record not found" });
    records.splice(index, 1);
    saveCollection(filename, records);
    return res.status(204).send();
  });

  return router;
}
