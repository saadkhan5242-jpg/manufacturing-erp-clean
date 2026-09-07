import express from "express";
import { loadCollection, saveCollection } from "../storage/jsonStore.js";
const router = express.Router();

const workOrders = loadCollection("workOrders.json", [
  { id: 1, partNumber: "P-1001", quantity: 50, status: "Open", dueDate: "2026-09-10" },
  { id: 2, partNumber: "P-2002", quantity: 20, status: "In Progress", dueDate: "2026-09-12" }
]);

router.get("/", (_req, res) => res.json(workOrders));

router.post("/", (req, res) => {
  const { partNumber, quantity, dueDate } = req.body;
  const newWO = {
    id: workOrders.length + 1,
    partNumber,
    quantity,
    status: "Open",
    dueDate
  };
  workOrders.push(newWO);
  saveCollection("workOrders.json", workOrders);
  res.status(201).json(newWO);
});

router.put("/:id/status", (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  const wo = workOrders.find(w => w.id === id);
  if (!wo) return res.status(404).json({ error: "Work order not found" });
  wo.status = status;
  saveCollection("workOrders.json", workOrders);
  res.json(wo);
});

export default router;
