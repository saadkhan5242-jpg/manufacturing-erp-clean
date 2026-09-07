import express from "express";
const router = express.Router();

router.post("/chat", (req, res) => {
  const { message } = req.body;
  res.json({ reply: `AI received: ${message}` });
});

router.post("/estimate", (req, res) => {
  const { operation, material, quantity = 1, complexity = "medium", historicalSetupMinutes, historicalRunMinutes } = req.body || {};
  if (typeof operation !== "string" || operation.trim() === "") return res.status(400).json({ error: "operation is required" });
  const complexityFactor = { low: 0.8, medium: 1, high: 1.35, extreme: 1.8 }[complexity] || 1;
  const operationFactor = /inspection|deburr|pack|wash/i.test(operation) ? 0.65 : /mill|turn|cnc|weld|assembly/i.test(operation) ? 1.15 : 1;
  const materialFactor = /titanium|inconel|hardened/i.test(String(material)) ? 1.45 : /aluminum|plastic/i.test(String(material)) ? 0.8 : 1;
  const setupMinutes = Math.round((Number.isFinite(Number(historicalSetupMinutes)) ? Number(historicalSetupMinutes) : 20) * complexityFactor * operationFactor);
  const runMinutesPerUnit = Math.max(1, Math.round((Number.isFinite(Number(historicalRunMinutes)) ? Number(historicalRunMinutes) : 12) * complexityFactor * materialFactor * operationFactor));
  const units = Math.max(1, Number(quantity) || 1);
  return res.json({ estimateType: "AI-assisted heuristic", operation: operation.trim(), setupMinutes, runMinutesPerUnit, totalRunMinutes: runMinutesPerUnit * units, totalMinutes: setupMinutes + runMinutesPerUnit * units, confidence: historicalSetupMinutes !== undefined || historicalRunMinutes !== undefined ? "high" : "medium", assumptions: ["Estimate should be approved by a planner or manufacturing engineer.", `Complexity factor: ${complexityFactor}`, material ? `Material considered: ${material}` : "Material was not provided."], approved: false });
});

export default router;
