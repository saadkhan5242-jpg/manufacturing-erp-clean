import { useDeferredValue, useEffect, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Gauge,
  Loader2,
  Search,
  Send,
  UserPlus,
  Webhook
} from "lucide-react";
import apiClient from "./lib/apiClient.js";
import "./pages/OperationsPage.css";

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "In Progress", value: "in-progress" },
  { label: "QC Hold", value: "hold" },
  { label: "Completed", value: "completed" }
];

const SORT_OPTIONS = [
  { label: "Due date", value: "dueDate" },
  { label: "Order", value: "orderNumber" },
  { label: "Part", value: "partNumber" },
  { label: "Status", value: "status" },
  { label: "Updated", value: "updatedAt" }
];
const PAGE_LIMIT = 12;

function statusLabel(status) {
  const labels = { "in-progress": "In Progress", hold: "QC Hold", completed: "Completed", released: "Released", open: "Open", cancelled: "Cancelled", scrapped: "Scrapped" };
  return labels[String(status || "").toLowerCase()] || status || "Unscheduled";
}

function getHealth(order) {
  const dueDate = order.dueDate ? new Date(order.dueDate) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const status = String(order.status || "").toLowerCase();
  if (status.includes("hold") || status.includes("scrap") || (dueDate && dueDate < today && status !== "completed")) {
    return { label: "Bottlenecked", color: "bg-rose-500", badge: "bg-rose-50 text-rose-700 border-rose-200" };
  }
  if (status === "completed") return { label: "On schedule", color: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  return { label: "Quality pending", color: "bg-amber-400", badge: "bg-amber-50 text-amber-700 border-amber-200" };
}

function formatDate(value) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function DetailList({ title, icon: Icon, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><Icon className="h-4 w-4 text-teal-700" aria-hidden="true" /> {title}</h3>
      <div className="mt-3 grid gap-2">{children}</div>
    </section>
  );
}

function WorkOrderDetails({ details, loading, onAssign, onReorder, operatorId, setOperatorId, actionMessage }) {
  if (loading) return <div className="rounded-lg bg-slate-50 p-4 text-sm font-bold text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading trace details...</div>;
  if (!details) return null;

  return (
    <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 xl:grid-cols-3">
      <DetailList title="Routing Steps" icon={Gauge}>
        {(details.routingSteps || []).map((step) => (
          <div key={step.id} className="rounded-md bg-slate-50 p-3 text-sm">
            <div className="flex items-center justify-between gap-3"><strong>{step.sequenceNumber} / {step.workCenterCode}</strong><span className="text-xs font-bold text-slate-500">{step.status}</span></div>
            <p className="mt-1 text-xs text-slate-500">Est {step.estimatedHours}h / Act {step.actualHours}h</p>
          </div>
        ))}
        {(details.routingSteps || []).length === 0 && <p className="text-sm font-semibold text-slate-500">No routing steps attached.</p>}
      </DetailList>

      <DetailList title="Milestones" icon={ClipboardCheck}>
        {(details.milestones || []).map((milestone) => (
          <div key={milestone.id} className="rounded-md bg-slate-50 p-3 text-sm">
            <strong>{milestone.label}</strong>
            <p className="mt-1 text-xs text-slate-500">{statusLabel(milestone.status)}{milestone.timestamp ? ` / ${formatDate(milestone.timestamp)}` : ""}</p>
          </div>
        ))}
      </DetailList>

      <DetailList title="Documents & Actions" icon={FileText}>
        {(details.documents || []).map((document) => (
          <div key={document.id} className="rounded-md bg-slate-50 p-3 text-sm">
            <strong>{document.title}</strong>
            <p className="mt-1 text-xs text-slate-500">{document.type} / {document.reference}</p>
          </div>
        ))}
        {(details.documents || []).length === 0 && <p className="text-sm font-semibold text-slate-500">No digital documents linked yet.</p>}
        <div className="mt-2 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Operator</label>
          <input value={operatorId} onChange={(event) => setOperatorId(event.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600" placeholder="EMP-104" />
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={onAssign} className="inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-black text-white hover:bg-teal-600"><UserPlus className="h-4 w-4" />Assign</button>
            <button type="button" onClick={onReorder} className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-black text-white hover:bg-slate-800"><Webhook className="h-4 w-4" />Reorder</button>
          </div>
          {actionMessage && <p className="text-xs font-bold text-teal-700">{actionMessage}</p>}
        </div>
      </DetailList>
    </div>
  );
}

function WorkOrderCard({ order, expanded, details, loading, onToggle, onAssign, onReorder, operatorId, setOperatorId, actionMessage }) {
  const health = getHealth(order);
  const quantity = Number(order.quantity || 0);
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-300 hover:shadow-md">
      <button type="button" onClick={onToggle} className="grid w-full gap-4 text-left lg:grid-cols-[minmax(0,1.1fr)_1fr_160px_150px_44px] lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`h-12 w-2 rounded-full ${health.color}`} />
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-slate-950">{order.orderNumber || `#${order.id}`}</p>
            <p className="truncate text-sm text-slate-500">{order.partNumber}</p>
          </div>
        </div>
        <div className="grid gap-1 text-sm text-slate-600">
          <span className="font-bold text-slate-950">{quantity.toLocaleString()} planned pieces</span>
          <span>Due {formatDate(order.dueDate)}</span>
        </div>
        <span className="inline-flex w-fit rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">{statusLabel(order.status)}</span>
        <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-black ${health.badge}`}>{health.label}</span>
        <ChevronDown className={`h-5 w-5 justify-self-end text-slate-500 transition ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {expanded && <WorkOrderDetails details={details} loading={loading} onAssign={onAssign} onReorder={onReorder} operatorId={operatorId} setOperatorId={setOperatorId} actionMessage={actionMessage} />}
    </article>
  );
}

function WorkOrdersPage() {
  const [partNumber, setPartNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [result, setResult] = useState(null);
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_LIMIT, total: 0, hasMore: false });
  const [filters, setFilters] = useState({ search: "", status: "", sortBy: "dueDate", sortDir: "asc" });
  const deferredSearch = useDeferredValue(filters.search);
  const [expandedId, setExpandedId] = useState(null);
  const [detailsById, setDetailsById] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});
  const [operatorById, setOperatorById] = useState({});
  const [actionMessageById, setActionMessageById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrders = async (page = pagination.page) => {
    setLoading(true);
    setError("");
    try {
      const payload = await apiClient.get("/api/work-orders", {
        query: { page, limit: PAGE_LIMIT, search: deferredSearch, status: filters.status, sortBy: filters.sortBy, sortDir: filters.sortDir }
      });
      setOrders(Array.isArray(payload) ? payload : payload.data || []);
      setPagination(Array.isArray(payload) ? { page: 1, limit: PAGE_LIMIT, total: payload.length, hasMore: false } : payload.pagination || { page, limit: PAGE_LIMIT, total: 0, hasMore: false });
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadFilteredOrders = async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await apiClient.get("/api/work-orders", {
          query: { page: 1, limit: PAGE_LIMIT, search: deferredSearch, status: filters.status, sortBy: filters.sortBy, sortDir: filters.sortDir }
        });
        if (cancelled) return;
        setOrders(Array.isArray(payload) ? payload : payload.data || []);
        setPagination(Array.isArray(payload) ? { page: 1, limit: PAGE_LIMIT, total: payload.length, hasMore: false } : payload.pagination || { page: 1, limit: PAGE_LIMIT, total: 0, hasMore: false });
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadFilteredOrders();
    return () => {
      cancelled = true;
    };
  }, [deferredSearch, filters.status, filters.sortBy, filters.sortDir]);

  const submitWorkOrder = async () => {
    setError("");
    try {
      const data = await apiClient.post("/api/work-orders", { partNumber, quantity: Number(quantity) });
      setResult(data);
      setPartNumber("");
      setQuantity("");
      await loadOrders(1);
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const toggleDetails = async (orderId) => {
    const nextId = expandedId === orderId ? null : orderId;
    setExpandedId(nextId);
    if (!nextId || detailsById[nextId]) return;
    setLoadingDetails((current) => ({ ...current, [nextId]: true }));
    try {
      const details = await apiClient.get(`/api/work-orders/${nextId}`);
      setDetailsById((current) => ({ ...current, [nextId]: details }));
    } catch (detailError) {
      setError(detailError.message);
    } finally {
      setLoadingDetails((current) => ({ ...current, [nextId]: false }));
    }
  };

  const triggerAction = async (order, actionType) => {
    const operatorId = operatorById[order.id] || "EMP-104";
    try {
      await apiClient.post(`/api/work-orders/${order.id}/actions`, {
        actionType,
        operatorId: actionType === "QUICK_ASSIGN" ? operatorId : undefined,
        requestedBy: operatorId,
        reorderReason: actionType === "MATERIAL_REORDER" ? `Material replenishment requested for ${order.partNumber}` : undefined
      });
      setActionMessageById((current) => ({ ...current, [order.id]: actionType === "QUICK_ASSIGN" ? `Assigned ${operatorId}` : "Material reorder webhook queued" }));
    } catch (actionError) {
      setActionMessageById((current) => ({ ...current, [order.id]: actionError.message }));
    }
  };

  const toggleSortDirection = () => setFilters((current) => ({ ...current, sortDir: current.sortDir === "asc" ? "desc" : "asc" }));

  return (
    <main className="operations-page">
      <header className="operations-page-header">
        <div>
          <p className="eyebrow">Production / Execution</p>
          <h1>Work orders</h1>
          <p>Release production work and trace live shop activity, quality health, routing, and documents.</p>
        </div>
      </header>

      <section className="operation-panel">
        <h2><ClipboardList size={18} /> Create work order</h2>
        <p className="panel-subtitle">Add a job to the open production queue.</p>
        <form className="operation-form" onSubmit={(event) => { event.preventDefault(); submitWorkOrder(); }}>
          <label>Part number<input placeholder="e.g. P-1001" value={partNumber} onChange={(event) => setPartNumber(event.target.value)} required /></label>
          <label>Quantity<input min="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
          <button className="form-submit" type="submit"><Send size={15} /> Release order</button>
        </form>
      </section>

      {error && <p className="operation-alert" role="alert">{error}</p>}
      {result && <section className="result-panel"><h2><CheckCircle2 size={17} /> Work order released</h2><p>Order #{result.id} for {result.partNumber} is now {statusLabel(result.status)}.</p><p>Planned quantity: {result.quantity}</p></section>}

      <section className="mt-5 rounded-lg border border-slate-200 bg-white/90 p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-teal-700">Dynamic job grid</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Production queue intelligence</h2>
            <p className="mt-1 text-sm text-slate-500">Server-side search, filtering, sorting, and trace expansion.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_44px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} className="h-11 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-teal-600" placeholder="Search order or part" />
            </label>
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-teal-600">
              {STATUS_FILTERS.map((status) => <option key={status.value || "all"} value={status.value}>{status.label}</option>)}
            </select>
            <select value={filters.sortBy} onChange={(event) => setFilters((current) => ({ ...current, sortBy: event.target.value }))} className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-teal-600">
              {SORT_OPTIONS.map((sort) => <option key={sort.value} value={sort.value}>{sort.label}</option>)}
            </select>
            <button type="button" onClick={toggleSortDirection} className="grid h-11 place-items-center rounded-md bg-slate-950 text-white hover:bg-slate-800" title="Toggle sort direction" aria-label="Toggle sort direction">
              {filters.sortDir === "asc" ? <ArrowUpAZ className="h-5 w-5" /> : <ArrowDownAZ className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {loading && <div className="rounded-lg bg-slate-50 p-6 text-sm font-bold text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading work orders...</div>}
          {!loading && orders.map((order) => (
            <WorkOrderCard
              key={order.id}
              order={order}
              expanded={expandedId === order.id}
              details={detailsById[order.id]}
              loading={Boolean(loadingDetails[order.id])}
              operatorId={operatorById[order.id] || ""}
              setOperatorId={(value) => setOperatorById((current) => ({ ...current, [order.id]: value }))}
              actionMessage={actionMessageById[order.id]}
              onToggle={() => toggleDetails(order.id)}
              onAssign={() => triggerAction(order, "QUICK_ASSIGN")}
              onReorder={() => triggerAction(order, "MATERIAL_REORDER")}
            />
          ))}
          {!loading && orders.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm font-bold text-slate-500"><Boxes className="mx-auto mb-2 h-6 w-6 text-slate-400" />No jobs match the current filters.</div>}
        </div>

        <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm text-slate-500">
          <span><strong className="text-slate-950">{pagination.total}</strong> jobs / page {pagination.page}</span>
          <div className="flex gap-2">
            <button type="button" disabled={pagination.page <= 1} onClick={() => loadOrders(pagination.page - 1)} className="rounded-md border border-slate-200 px-3 py-2 font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
            <button type="button" disabled={!pagination.hasMore} onClick={() => loadOrders(pagination.page + 1)} className="rounded-md border border-slate-200 px-3 py-2 font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </div>
        </footer>
      </section>
    </main>
  );
}

export default WorkOrdersPage;
