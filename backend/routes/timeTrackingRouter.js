import express from "express";
import { loadCollection, saveCollection } from "../storage/jsonStore.js";
import { listWorkCenters } from "../services/workCenterService.js";

const router = express.Router();
const entries = loadCollection("timeEntries.json", []);
const shifts = loadCollection("shiftEntries.json", []);
const defaultLaborRate = 35;
const defaultMachineRate = 60;

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function getRates(workCenterId) {
  const workCenter = listWorkCenters().find((candidate) => candidate.id === workCenterId);
  return {
    laborRate: Number(workCenter?.laborRate) || defaultLaborRate,
    machineRate: Number(workCenter?.machineRate) || defaultMachineRate
  };
}

function costFor(entry, endTime = new Date()) {
  const elapsedHours = Math.max(0, (new Date(endTime) - new Date(entry.startTime)) / 3600000);
  const laborCost = elapsedHours * entry.laborRate;
  const machineCost = elapsedHours * entry.machineRate;
  return { elapsedHours: Math.round(elapsedHours * 10000) / 10000, laborCost: Math.round(laborCost * 100) / 100, machineCost: Math.round(machineCost * 100) / 100, totalCost: Math.round((laborCost + machineCost) * 100) / 100 };
}

function shiftHours(entry, endTime = new Date()) {
  const totalHours = Math.max(0, (new Date(endTime) - new Date(entry.startTime)) / 3600000);
  const regularHours = Math.min(totalHours, 8);
  const overtimeHours = Math.max(0, totalHours - 8);
  return { totalHours: Math.round(totalHours * 10000) / 10000, regularHours: Math.round(regularHours * 10000) / 10000, overtimeHours: Math.round(overtimeHours * 10000) / 10000 };
}

router.get("/shifts", (req, res) => {
  const visible = req.user.role === "admin" ? shifts : shifts.filter((shift) => shift.employeeId === req.user.sub);
  return res.json(visible.map((shift) => ({ ...shift, ...shiftHours(shift, shift.endTime || new Date()) })));
});

router.get("/shifts/active", (req, res) => {
  return res.json(shifts.find((shift) => !shift.endTime && shift.employeeId === req.user.sub) || null);
});

router.get("/employees/report", (req, res) => {
  const visible = req.user.role === "admin" ? shifts : shifts.filter((shift) => shift.employeeId === req.user.sub);
  const byEmployee = new Map();
  for (const shift of visible) {
    const current = byEmployee.get(shift.employeeId) || { employeeId: shift.employeeId, employeeName: shift.employeeName, shifts: 0, totalHours: 0, regularHours: 0, overtimeHours: 0 };
    const hours = shiftHours(shift, shift.endTime || new Date());
    current.shifts += 1;
    current.totalHours += hours.totalHours;
    current.regularHours += hours.regularHours;
    current.overtimeHours += hours.overtimeHours;
    byEmployee.set(shift.employeeId, current);
  }
  return res.json([...byEmployee.values()].map((summary) => Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, typeof value === "number" ? Math.round(value * 100) / 100 : value]))));
});

router.post("/shifts/clock-in", (req, res) => {
  if (shifts.some((shift) => !shift.endTime && shift.employeeId === req.user.sub)) return res.status(409).json({ error: "Employee is already clocked in" });
  const shift = { id: shifts.length === 0 ? 1 : Math.max(...shifts.map((entry) => entry.id)) + 1, employeeId: req.user.sub, employeeName: req.user.name, startTime: new Date().toISOString(), note: typeof req.body?.note === "string" ? req.body.note.trim() : "" };
  shifts.push(shift);
  saveCollection("shiftEntries.json", shifts);
  return res.status(201).json({ ...shift, ...shiftHours(shift) });
});

router.post("/shifts/:id/clock-out", (req, res) => {
  const id = positiveInteger(req.params.id);
  const shift = shifts.find((candidate) => candidate.id === id && candidate.employeeId === req.user.sub);
  if (!shift) return res.status(404).json({ error: "Active shift not found" });
  if (shift.endTime) return res.status(409).json({ error: "Shift is already closed" });
  shift.endTime = new Date().toISOString();
  saveCollection("shiftEntries.json", shifts);
  return res.json({ ...shift, ...shiftHours(shift, shift.endTime) });
});

router.get("/", (_req, res) => res.json(entries.map((entry) => entry.endTime ? { ...entry, ...costFor(entry, entry.endTime) } : { ...entry, ...costFor(entry) })));

router.get("/active", (req, res) => res.json(entries.filter((entry) => !entry.endTime && (!req.user || entry.operatorId === req.user.sub))));

router.get("/work-order/:workOrderId/cost", (req, res) => {
  const workOrderId = positiveInteger(req.params.workOrderId);
  if (!workOrderId) return res.status(400).json({ error: "workOrderId must be a positive integer" });
  const workOrderEntries = entries.filter((entry) => entry.workOrderId === workOrderId && entry.endTime);
  const totals = workOrderEntries.reduce((sum, entry) => { const costs = costFor(entry, entry.endTime); return { laborHours: sum.laborHours + costs.elapsedHours, laborCost: sum.laborCost + costs.laborCost, machineCost: sum.machineCost + costs.machineCost, totalCost: sum.totalCost + costs.totalCost }; }, { laborHours: 0, laborCost: 0, machineCost: 0, totalCost: 0 });
  return res.json({ workOrderId, entryCount: workOrderEntries.length, ...Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Math.round(value * 100) / 100])) });
});

router.post("/clock-in", (req, res) => {
  const workOrderId = positiveInteger(req.body?.workOrderId);
  const workCenterId = positiveInteger(req.body?.workCenterId);
  const operation = typeof req.body?.operation === "string" ? req.body.operation.trim() : "";
  if (!workOrderId || !workCenterId || !operation) return res.status(400).json({ error: "workOrderId, workCenterId, and operation are required" });
  if (!shifts.some((shift) => !shift.endTime && shift.employeeId === req.user.sub)) return res.status(409).json({ error: "Clock into your employee shift before starting a job" });
  if (entries.some((entry) => !entry.endTime && entry.operatorId === req.user.sub)) return res.status(409).json({ error: "Operator already has an active clock" });
  const rates = getRates(workCenterId);
  const entry = { id: entries.length === 0 ? 1 : Math.max(...entries.map((item) => item.id)) + 1, operatorId: req.user.sub, operatorName: req.user.name, workOrderId, workCenterId, operation, startTime: new Date().toISOString(), laborRate: rates.laborRate, machineRate: rates.machineRate };
  entries.push(entry);
  saveCollection("timeEntries.json", entries);
  return res.status(201).json({ ...entry, ...costFor(entry) });
});

router.post("/:id/clock-out", (req, res) => {
  const id = positiveInteger(req.params.id);
  const entry = entries.find((candidate) => candidate.id === id && candidate.operatorId === req.user.sub);
  if (!entry) return res.status(404).json({ error: "Active time entry not found" });
  if (entry.endTime) return res.status(409).json({ error: "Time entry is already closed" });
  entry.endTime = new Date().toISOString();
  saveCollection("timeEntries.json", entries);
  return res.json({ ...entry, ...costFor(entry, entry.endTime) });
});

export default router;
