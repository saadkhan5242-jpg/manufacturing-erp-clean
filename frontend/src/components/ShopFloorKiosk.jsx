import { useEffect, useState } from "react";
import { ClipboardCheck, Eraser, FileText, LogIn, LogOut, Play, ScanLine, ShieldCheck } from "lucide-react";
import apiClient from "../lib/apiClient.js";

const INPUT_FIELDS = [
  { id: "employeeId", label: "Badge", inputMode: "text" },
  { id: "workOrderId", label: "Work order", inputMode: "numeric" },
  { id: "operationId", label: "Operation", inputMode: "numeric" }
];

function buildActionRows(activeLog, handlers) {
  if (activeLog) {
    return [
      { id: "blueprint", label: "Blueprint", icon: FileText, tone: "slate", onClick: handlers.openBlueprint },
      { id: "quality", label: "Quality Check", icon: ClipboardCheck, tone: "teal", onClick: handlers.logQualityCheck },
      { id: "clockOut", label: "Clock Out", icon: LogOut, tone: "rose", onClick: handlers.clockOut }
    ];
  }
  return [
    { id: "setup", label: "Start Setup", icon: ScanLine, tone: "amber", onClick: () => handlers.clockIn("SETUP") },
    { id: "run", label: "Start Run", icon: Play, tone: "emerald", onClick: () => handlers.clockIn("RUNNING") },
    { id: "blueprint", label: "Blueprint", icon: FileText, tone: "slate", onClick: handlers.openBlueprint }
  ];
}

function KioskActionButton({ action }) {
  const Icon = action.icon;
  const tones = {
    amber: "bg-amber-500 text-slate-950 hover:bg-amber-400",
    emerald: "bg-emerald-600 text-white hover:bg-emerald-500",
    rose: "bg-rose-600 text-white hover:bg-rose-500",
    slate: "bg-slate-800 text-white hover:bg-slate-700",
    teal: "bg-teal-700 text-white hover:bg-teal-600"
  };
  return (
    <button type="button" onClick={action.onClick} className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg p-4 text-center text-base font-black shadow-sm transition active:scale-[0.98] ${tones[action.tone]}`}>
      <Icon className="h-7 w-7" aria-hidden="true" />
      <span>{action.label}</span>
    </button>
  );
}

export default function ShopFloorKiosk() {
  const [entry, setEntry] = useState({ employeeId: "", workOrderId: "", operationId: "" });
  const [activeField, setActiveField] = useState("employeeId");
  const [activeLog, setActiveLog] = useState(null);
  const [partsProduced, setPartsProduced] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState({ type: "idle", text: "Ready for badge scan or touch entry." });
  const [blueprintOpen, setBlueprintOpen] = useState(false);

  useEffect(() => {
    if (!activeLog) return undefined;
    const timer = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [activeLog]);

  const hours = String(Math.floor(elapsedSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");
  const formattedElapsed = `${hours}:${minutes}:${seconds}`;

  const addEvent = (text) => {
    setEvents((current) => [{ id: crypto.randomUUID(), text, time: new Date().toLocaleTimeString() }, ...current].slice(0, 5));
  };

  const updateEntry = (fieldId, value) => {
    setEntry((current) => ({ ...current, [fieldId]: value }));
  };

  const clockIn = async (jobStatus) => {
    if (!entry.employeeId || !entry.workOrderId || !entry.operationId) {
      setStatus({ type: "error", text: "Badge, work order, and operation are required before clock-in." });
      return;
    }
    setStatus({ type: "busy", text: "Posting labor start to the ERP backend..." });
    try {
      const data = await apiClient.post("/api/shopfloor/clock-in", {
        employeeId: entry.employeeId,
        workOrderId: Number(entry.workOrderId),
        routerOperationId: Number(entry.operationId),
        jobStatus
      });
      setActiveLog(data?.logId || `${entry.employeeId}-${entry.workOrderId}-${entry.operationId}`);
      setElapsedSeconds(0);
      addEvent(`${jobStatus} started for work order ${entry.workOrderId}`);
      setStatus({ type: "success", text: "Operator is clocked in and live labor is running." });
    } catch (error) {
      setStatus({ type: "error", text: error.message });
    }
  };

  const clockOut = async () => {
    if (!activeLog) return;
    setStatus({ type: "busy", text: "Posting labor closeout and parts produced..." });
    try {
      await apiClient.post("/api/shopfloor/clock-out", {
        logId: activeLog,
        partsProduced: Number(partsProduced),
        finalStatus: "COMPLETED",
        qualityCheckpoint: {
          passedCount: Number(partsProduced),
          failedCount: 0,
          employeeId: entry.employeeId,
          employeeTimestamp: new Date().toISOString(),
          notes: `Operator closeout for work order ${entry.workOrderId}`
        }
      });
      addEvent(`Clocked out with ${partsProduced} good pieces`);
      setActiveLog(null);
      setPartsProduced(0);
      setElapsedSeconds(0);
      setStatus({ type: "success", text: "Job labor was dispatched successfully." });
    } catch (error) {
      setStatus({ type: "error", text: error.message });
    }
  };

  const openBlueprint = () => {
    setBlueprintOpen((open) => !open);
    addEvent("Digital blueprint view toggled");
  };

  const logQualityCheck = () => {
    addEvent(`Quality check logged for operation ${entry.operationId || "current"}`);
    setStatus({ type: "success", text: "Quality checkpoint added to the operator log." });
  };

  const clearEntry = () => {
    setEntry({ employeeId: "", workOrderId: "", operationId: "" });
    setPartsProduced(0);
    setActiveField("employeeId");
  };

  const actions = buildActionRows(activeLog, { clockIn, clockOut, openBlueprint, logQualityCheck });
  const statusTone = status.type === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : status.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
            <LogIn className="h-3.5 w-3.5" aria-hidden="true" /> Shop Floor Kiosk
          </p>
          <h2 className="mt-3 text-2xl font-black text-slate-950">Operator digital workspace</h2>
        </div>
        <div className="rounded-lg bg-slate-950 px-4 py-3 text-right text-white">
          <span className="block text-xs font-bold uppercase tracking-wide text-slate-400">Elapsed</span>
          <strong className="text-2xl font-black tabular-nums">{formattedElapsed}</strong>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {INPUT_FIELDS.map((field) => (
              <label key={field.id} className={`rounded-lg border p-3 transition ${activeField === field.id ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-slate-50"}`}>
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{field.label}</span>
                <input
                  value={entry[field.id]}
                  inputMode={field.inputMode}
                  onFocus={() => setActiveField(field.id)}
                  onChange={(event) => updateEntry(field.id, event.target.value)}
                  className="mt-2 w-full bg-transparent text-xl font-black text-slate-950 outline-none"
                  placeholder="Scan"
                />
              </label>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {actions.map((action) => <KioskActionButton key={action.id} action={action} />)}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Good pieces</span>
              <input
                value={partsProduced}
                inputMode="numeric"
                onChange={(event) => setPartsProduced(Number(event.target.value) || 0)}
                className="mt-2 w-full bg-transparent text-2xl font-black text-slate-950 outline-none"
              />
            </label>
            <button type="button" onClick={clearEntry} className="inline-flex min-h-20 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:border-slate-500">
              <Eraser className="h-5 w-5" aria-hidden="true" /> Clear
            </button>
          </div>

          <div className={`rounded-lg border px-4 py-3 text-sm font-bold ${statusTone}`}>{status.text}</div>
        </div>

        <div className="grid gap-4">
          {blueprintOpen && (
            <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 text-white">
              <div className="flex items-center gap-2 text-sm font-bold text-teal-200"><FileText className="h-4 w-4" aria-hidden="true" /> Digital blueprint</div>
              <div className="mt-4 aspect-[4/3] rounded-md border border-dashed border-slate-600 bg-[linear-gradient(90deg,rgba(20,184,166,.2)_1px,transparent_1px),linear-gradient(rgba(20,184,166,.2)_1px,transparent_1px)] bg-[length:22px_22px]" />
              <p className="mt-3 text-xs text-slate-400">WO {entry.workOrderId || "pending"} / OP {entry.operationId || "pending"}</p>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-slate-950"><ShieldCheck className="h-4 w-4 text-teal-700" aria-hidden="true" /> Operator log</div>
            <ol className="mt-3 grid gap-2">
              {events.map((event) => (
                <li key={event.id} className="rounded-md bg-white p-3 text-sm shadow-sm">
                  <span className="block text-xs font-bold text-slate-400">{event.time}</span>
                  <span className="font-semibold text-slate-700">{event.text}</span>
                </li>
              ))}
              {events.length === 0 && <li className="rounded-md border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">No operator events yet.</li>}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}