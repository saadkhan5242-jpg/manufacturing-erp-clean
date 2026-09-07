import express from "express";
import { loadCollection, saveCollection } from "../storage/jsonStore.js";

const router = express.Router();
const entries = loadCollection("accountingEntries.json", []);

function money(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.round(Number(value) * 100) / 100 : null;
}

function validateLine(line) {
  if (!line || typeof line.account !== "string" || line.account.trim() === "") return "account is required";
  const debit = money(line.debit);
  const credit = money(line.credit);
  if (debit === null || credit === null || (debit === 0 && credit === 0)) return "each line needs a non-zero debit or credit";
  if (debit > 0 && credit > 0) return "a line cannot contain both debit and credit";
  return null;
}

router.get("/", (_req, res) => res.json(entries));

router.get("/trial-balance", (_req, res) => {
  const accounts = new Map();
  for (const entry of entries) {
    const current = accounts.get(entry.account) || { account: entry.account, debit: 0, credit: 0 };
    current.debit += Number(entry.debit || 0);
    current.credit += Number(entry.credit || 0);
    accounts.set(entry.account, current);
  }
  const lines = [...accounts.values()].map((line) => ({ ...line, balance: Math.round((line.debit - line.credit) * 100) / 100 }));
  return res.json({ lines, totalDebits: lines.reduce((total, line) => total + line.debit, 0), totalCredits: lines.reduce((total, line) => total + line.credit, 0), balanced: lines.reduce((total, line) => total + line.debit, 0) === lines.reduce((total, line) => total + line.credit, 0) });
});

router.post("/", (req, res) => {
  const error = validateLine(req.body);
  if (error) return res.status(400).json({ error });
  const record = { id: entries.length === 0 ? 1 : Math.max(...entries.map((entry) => entry.id)) + 1, entryDate: req.body.entryDate || new Date().toISOString().slice(0, 10), reference: req.body.reference || "UNPOSTED", account: req.body.account.trim(), debit: money(req.body.debit), credit: money(req.body.credit), memo: req.body.memo || "", posted: false };
  entries.push(record);
  saveCollection("accountingEntries.json", entries);
  return res.status(201).json(record);
});

router.post("/journal", (req, res) => {
  const { reference, entryDate, memo = "", lines } = req.body || {};
  if (typeof reference !== "string" || reference.trim() === "") return res.status(400).json({ error: "reference is required" });
  if (typeof entryDate !== "string" || Number.isNaN(Date.parse(entryDate))) return res.status(400).json({ error: "entryDate must be a valid date" });
  if (!Array.isArray(lines) || lines.length < 2) return res.status(400).json({ error: "a journal needs at least two lines" });
  for (const line of lines) { const error = validateLine(line); if (error) return res.status(400).json({ error }); }
  const debitTotal = lines.reduce((total, line) => total + money(line.debit), 0);
  const creditTotal = lines.reduce((total, line) => total + money(line.credit), 0);
  if (Math.round(debitTotal * 100) !== Math.round(creditTotal * 100)) return res.status(422).json({ error: "journal is not balanced", debitTotal, creditTotal });
  const created = lines.map((line, index) => ({ id: entries.length + index + 1, journalReference: reference.trim(), entryDate, memo, account: line.account.trim(), debit: money(line.debit), credit: money(line.credit), createdAt: new Date().toISOString() }));
  entries.push(...created);
  saveCollection("accountingEntries.json", entries);
  return res.status(201).json({ reference, lines: created, debitTotal, creditTotal, balanced: true });
});

export default router;
