import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  Factory,
  FileCheck2,
  FileText,
  Gauge,
  Loader2,
  LockKeyhole,
  LogOut,
  Radar,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Truck,
  Workflow
} from "lucide-react";
import apiClient from "./lib/apiClient.js";
import { useAuth } from "./hooks/useAuth.jsx";
import ShopFloorKiosk from "./components/ShopFloorKiosk.jsx";

const AEROSPACE_TABS = [
  { id: "quoting", label: "Quoting", icon: FileText, endpointKeys: ["quoteProposals", "mrp"] },
  { id: "bom", label: "BOM Multi-level Routers", icon: Workflow, endpointKeys: ["workOrders", "parts"] },
  { id: "kiosk", label: "Shop Floor Kiosk", icon: Factory, endpointKeys: ["workOrders", "calibration"] },
  { id: "quality", label: "AS9102 QMS Quality", icon: ShieldCheck, endpointKeys: ["calibration", "workOrders"] },
  { id: "shipping", label: "Shipping/Receiving", icon: Truck, endpointKeys: ["shipping", "parts", "mrpQueue"] }
];

const DATA_FEEDS = {
  mrp: { label: "MRP Forecast", endpoint: "/api/mrp/forecast", extract: (payload) => payload?.requirements || [] },
  mrpQueue: { label: "Draft PO Queue", endpoint: "/api/mrp/purchase-queue", extract: (payload) => payload?.vendors || [] },
  calibration: { label: "Calibration Instruments", endpoint: "/api/quality/calibration/instruments", extract: (payload) => Array.isArray(payload) ? payload : [] },
  parts: { label: "Parts Traceability", endpoint: "/api/parts", extract: (payload) => Array.isArray(payload) ? payload : [] },
  workOrders: { label: "Work Orders", endpoint: "/api/work-orders", extract: (payload) => Array.isArray(payload) ? payload : payload?.data || [] },
  shipping: { label: "Daily Shipments", endpoint: "/api/dashboard/daily-shipments", extract: (payload) => payload?.shipments || [] },
  quoteProposals: { label: "AI Quote Proposals", endpoint: "/api/ai-intake/quote-proposals", extract: (payload) => payload?.proposals || [] }
};

const HEALTH_STYLES = {
  green: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  yellow: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  red: "border-rose-400/30 bg-rose-400/10 text-rose-100",
  blue: "border-sky-400/30 bg-sky-400/10 text-sky-100"
};

function emptyFeedState() {
  return Object.fromEntries(Object.keys(DATA_FEEDS).map((key) => [key, { data: [], status: "idle", error: "" }]));
}

function countItar(items) {
  return items.filter((item) => item?.is_itar_controlled || item?.isItarControlled).length;
}

function statusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (/(hold|late|risk|critical|fail|blocked|shortage)/.test(normalized)) return "red";
  if (/(pending|draft|review|open|expedite)/.test(normalized)) return "yellow";
  if (/(complete|covered|approved|shipped|pass)/.test(normalized)) return "green";
  return "blue";
}

function valueOrDash(value) {
  return value === undefined || value === null || value === "" ? "--" : value;
}

function DataStatusPill({ feed }) {
  if (feed.status === "loading") return <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-xs font-bold text-sky-100"><Loader2 className="h-3 w-3 animate-spin" /> Syncing</span>;
  if (feed.status === "error") return <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-1 text-xs font-bold text-rose-100"><AlertTriangle className="h-3 w-3" /> API down</span>;
  return <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-100"><Radar className="h-3 w-3" /> Live</span>;
}

function MetricTile({ icon: Icon, label, value, caption, tone = "blue" }) {
  return (
    <article className={`rounded-lg border p-4 ${HEALTH_STYLES[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-wide opacity-80">{label}</span>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <strong className="mt-3 block text-3xl font-black text-white">{value}</strong>
      <p className="mt-1 text-xs opacity-75">{caption}</p>
    </article>
  );
}

function FeedCard({ title, feedKey, feed, children }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200/80">{DATA_FEEDS[feedKey]?.label || feedKey}</p>
          <h2 className="mt-1 text-xl font-black text-white">{title}</h2>
        </div>
        <DataStatusPill feed={feed} />
      </div>
      {feed.error && <p className="mt-3 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-100">{feed.error}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TraceList({ items, renderItem, emptyText }) {
  if (!items.length) return <div className="rounded-lg border border-dashed border-white/15 bg-black/20 p-8 text-center text-sm font-bold text-slate-400">{emptyText}</div>;
  return <div className="grid gap-3">{items.map(renderItem)}</div>;
}

function QuotingWorkspace({ feeds }) {
  const proposals = feeds.quoteProposals.data;
  const shortages = feeds.mrp.data.filter((item) => item.status === "shortage").slice(0, 4);
  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <FeedCard title="AI RFQ Draft Proposals" feedKey="quoteProposals" feed={feeds.quoteProposals}>
        <TraceList
          items={proposals}
          emptyText="No AI quote proposals are waiting for QA approval."
          renderItem={(proposal) => (
            <article key={proposal.id} className="rounded-lg border border-white/10 bg-slate-950/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-white">{proposal.partNumber} Rev {valueOrDash(proposal.revisionNumber)}</h3>
                  <p className="mt-1 text-sm text-slate-400">Proposal {proposal.proposalNumber} / {proposal.materialGrade || "material pending"}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${HEALTH_STYLES[statusTone(proposal.validationStatus)]}`}>{proposal.validationStatus}</span>
              </div>
            </article>
          )}
        />
      </FeedCard>

      <FeedCard title="Material Risk Before Quote Release" feedKey="mrp" feed={feeds.mrp}>
        <TraceList
          items={shortages}
          emptyText="No material shortages surfaced by the latest MRP forecast."
          renderItem={(item) => (
            <article key={item.partNumber} className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-amber-50">
              <div className="flex items-center justify-between gap-3">
                <strong>{item.partNumber}</strong>
                <span className="text-xs font-black uppercase">{item.priority}</span>
              </div>
              <p className="mt-1 text-sm text-amber-100/75">Need {item.netRequirement} / Available {item.availableStock} / Vendor {valueOrDash(item.preferredVendorId)}</p>
            </article>
          )}
        />
      </FeedCard>
    </div>
  );
}

function BomRouterWorkspace({ feeds }) {
  const parts = feeds.parts.data.slice(0, 8);
  const workOrders = feeds.workOrders.data.slice(0, 5);
  return (
    <div className="grid gap-5 2xl:grid-cols-[0.9fr_1.1fr]">
      <FeedCard title="ITAR-Aware Part Master" feedKey="parts" feed={feeds.parts}>
        <TraceList
          items={parts}
          emptyText="No parts returned from /api/parts."
          renderItem={(part) => (
            <article key={part.id} className="rounded-lg border border-white/10 bg-black/25 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-white">{part.part_number || part.sku}</h3>
                  <p className="mt-1 text-sm text-slate-400">{part.description || "Traceability description pending"}</p>
                </div>
                {part.is_itar_controlled && <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-xs font-black text-rose-100">ITAR</span>}
              </div>
            </article>
          )}
        />
      </FeedCard>

      <FeedCard title="Dynamic Work Order Routers" feedKey="workOrders" feed={feeds.workOrders}>
        <TraceList
          items={workOrders}
          emptyText="No active work orders returned from /api/work-orders."
          renderItem={(order) => (
            <article key={order.id} className="rounded-lg border border-white/10 bg-slate-950/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-white">{order.orderNumber || `WO-${order.id}`}</h3>
                  <p className="mt-1 text-sm text-slate-400">{order.partNumber} / Qty {valueOrDash(order.quantity)}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${HEALTH_STYLES[statusTone(order.status)]}`}>{order.status}</span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {["Milling", "Deburr", "Inspection"].map((step, index) => <div key={step} className="rounded-md border border-cyan-300/15 bg-cyan-300/5 p-3 text-sm font-bold text-cyan-100">{(index + 1) * 10}. {step}</div>)}
              </div>
            </article>
          )}
        />
      </FeedCard>
    </div>
  );
}

function QualityWorkspace({ feeds }) {
  const instruments = feeds.calibration.data;
  const workOrdersOnHold = feeds.workOrders.data.filter((order) => /hold|qc/i.test(String(order.status))).slice(0, 5);
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <FeedCard title="AS9102 / In-Process Quality Queue" feedKey="workOrders" feed={feeds.workOrders}>
        <TraceList
          items={workOrdersOnHold}
          emptyText="No work orders are currently flagged for quality hold."
          renderItem={(order) => (
            <article key={order.id} className="rounded-lg border border-rose-400/25 bg-rose-500/10 p-4 text-rose-50">
              <h3 className="font-black">{order.orderNumber || `WO-${order.id}`}</h3>
              <p className="mt-1 text-sm text-rose-100/75">{order.partNumber} / {order.status}</p>
            </article>
          )}
        />
      </FeedCard>

      <FeedCard title="Calibration-Controlled Instruments" feedKey="calibration" feed={feeds.calibration}>
        <TraceList
          items={instruments.slice(0, 6)}
          emptyText="No measurement instruments returned from /api/quality/calibration/instruments."
          renderItem={(instrument) => (
            <article key={instrument.id} className="rounded-lg border border-white/10 bg-black/25 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-white">{instrument.instrumentNumber}</h3>
                  <p className="mt-1 text-sm text-slate-400">{instrument.instrumentType} / Due {valueOrDash(instrument.calibrationDueAt)}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${HEALTH_STYLES[statusTone(instrument.status)]}`}>{instrument.status}</span>
              </div>
            </article>
          )}
        />
      </FeedCard>
    </div>
  );
}

function ShippingWorkspace({ feeds }) {
  const shipments = feeds.shipping.data.slice(0, 6);
  const queue = feeds.mrpQueue.data.slice(0, 4);
  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <FeedCard title="Shipping / Receiving Trace" feedKey="shipping" feed={feeds.shipping}>
        <TraceList
          items={shipments}
          emptyText="No shipment activity returned from /api/dashboard/daily-shipments."
          renderItem={(shipment) => (
            <article key={shipment.id || `${shipment.jobId}-${shipment.partNumber}`} className="rounded-lg border border-white/10 bg-slate-950/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-white">{shipment.jobId || shipment.orderNumber || "Shipment"}</h3>
                  <p className="mt-1 text-sm text-slate-400">{shipment.partNumber || shipment.carrier || "Receiving trace pending"}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${HEALTH_STYLES[statusTone(shipment.status)]}`}>{shipment.status || "scheduled"}</span>
              </div>
            </article>
          )}
        />
      </FeedCard>

      <FeedCard title="Vendor-Grouped Draft PO Queue" feedKey="mrpQueue" feed={feeds.mrpQueue}>
        <TraceList
          items={queue}
          emptyText="No draft purchase queue returned from /api/mrp/purchase-queue."
          renderItem={(vendor, index) => (
            <article key={vendor.preferredVendorId || index} className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-amber-50">
              <h3 className="font-black">{vendor.supplierName || "Unassigned vendor"}</h3>
              <p className="mt-1 text-sm text-amber-100/75">{(vendor.lines || []).length} line(s) / Est ${Number(vendor.estimatedTotalCost || 0).toFixed(2)}</p>
            </article>
          )}
        />
      </FeedCard>
    </div>
  );
}

function KioskWorkspace({ feeds }) {
  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.3fr)_0.7fr]">
      <ShopFloorKiosk />
      <FeedCard title="Live Work Order Context" feedKey="workOrders" feed={feeds.workOrders}>
        <TraceList
          items={feeds.workOrders.data.slice(0, 6)}
          emptyText="No work orders available for kiosk context."
          renderItem={(order) => (
            <article key={order.id} className="rounded-lg border border-white/10 bg-black/25 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-white">{order.orderNumber || `WO-${order.id}`}</h3>
                  <p className="mt-1 text-sm text-slate-400">{order.partNumber} / {order.status}</p>
                </div>
                {order.is_itar_controlled && <LockKeyhole className="h-5 w-5 text-rose-300" aria-hidden="true" />}
              </div>
            </article>
          )}
        />
      </FeedCard>
    </div>
  );
}

function ActiveWorkspace({ activeTab, feeds }) {
  if (activeTab === "quoting") return <QuotingWorkspace feeds={feeds} />;
  if (activeTab === "bom") return <BomRouterWorkspace feeds={feeds} />;
  if (activeTab === "kiosk") return <KioskWorkspace feeds={feeds} />;
  if (activeTab === "quality") return <QualityWorkspace feeds={feeds} />;
  return <ShippingWorkspace feeds={feeds} />;
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("quoting");
  const [feeds, setFeeds] = useState(emptyFeedState);
  const [lastSyncedAt, setLastSyncedAt] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const loadFeeds = async () => {
      setFeeds((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, { ...value, status: "loading", error: "" }])));
      const entries = await Promise.allSettled(Object.entries(DATA_FEEDS).map(async ([key, feed]) => {
        const payload = await apiClient.get(feed.endpoint);
        return [key, { data: feed.extract(payload), status: "ready", error: "" }];
      }));
      if (cancelled) return;
      const nextFeeds = emptyFeedState();
      for (const entry of entries) {
        if (entry.status === "fulfilled") {
          const [key, value] = entry.value;
          nextFeeds[key] = value;
        } else {
          const key = Object.keys(DATA_FEEDS)[entries.indexOf(entry)];
          nextFeeds[key] = { data: [], status: "error", error: entry.reason?.message || "Unable to load feed" };
        }
      }
      setFeeds(nextFeeds);
      setLastSyncedAt(new Date().toLocaleTimeString());
    };

    loadFeeds();
    const timer = window.setInterval(loadFeeds, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshToken]);

  const workOrders = feeds.workOrders.data;
  const parts = feeds.parts.data;
  const mrpRequirements = feeds.mrp.data;
  const quoteProposals = feeds.quoteProposals.data;
  const activeShortages = mrpRequirements.filter((item) => item.status === "shortage").length;
  const itarAssets = countItar(parts) + countItar(workOrders);
  const qmsHolds = workOrders.filter((order) => /hold|qc/i.test(String(order.status))).length;
  const proposalCount = quoteProposals.filter((proposal) => proposal.requiresQaApproval !== false).length;

  const metrics = [
    { label: "Draft Quotes", value: proposalCount, caption: "QA approval required", icon: Sparkles, tone: proposalCount > 0 ? "yellow" : "green" },
    { label: "ITAR Assets", value: itarAssets, caption: "Controlled records visible", icon: LockKeyhole, tone: itarAssets > 0 ? "red" : "blue" },
    { label: "QMS Holds", value: qmsHolds, caption: "Routing or job holds", icon: ClipboardCheck, tone: qmsHolds > 0 ? "red" : "green" },
    { label: "MRP Shortages", value: activeShortages, caption: "Material risks", icon: Gauge, tone: activeShortages > 0 ? "yellow" : "green" }
  ];

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <div className="absolute inset-0 -z-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(16,185,129,0.12),transparent_28%),linear-gradient(135deg,#05070d_0%,#0d1321_52%,#111827_100%)]" />
      <div className="relative z-10 grid min-h-screen grid-cols-1 xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl xl:border-b-0 xl:border-r">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 font-black text-cyan-100">A9</span>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-white">Aerospace ERP</p>
              <p className="text-xs font-semibold text-slate-400">AS9100 / ITAR command layer</p>
            </div>
          </div>

          <nav className="mt-8 grid gap-2" aria-label="Aerospace workspace tabs">
            {AEROSPACE_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`group flex items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm font-black transition ${active ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-50 shadow-lg shadow-cyan-950/30" : "border-white/5 bg-white/[0.03] text-slate-400 hover:border-white/15 hover:bg-white/[0.06] hover:text-white"}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <section className="mt-8 rounded-lg border border-white/10 bg-black/25 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Session</p>
            <p className="mt-2 font-black text-white">{user?.name || user?.email || "Operator"}</p>
            <p className="text-sm text-slate-400">{user?.role || "operator"}</p>
            <button type="button" onClick={logout} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-black text-slate-950 hover:bg-cyan-100">
              <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
            </button>
          </section>
        </aside>

        <main className="min-w-0 p-4 sm:p-6 2xl:p-8">
          <header className="rounded-xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-100"><FileCheck2 className="h-3.5 w-3.5" /> Paperless control tower</p>
                <h1 className="mt-4 max-w-5xl text-3xl font-black tracking-normal text-white sm:text-5xl">Real-time aerospace manufacturing, traceability, quality, and compliance dashboard</h1>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">Dynamic feeds map directly to ERP endpoints for MRP, QMS, parts, work orders, shipping, and AI quote intake. Every card is driven by live arrays and designed for fast shop-floor triage.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold text-slate-300">Synced {lastSyncedAt || "pending"}</span>
                <button type="button" onClick={() => setRefreshToken((value) => value + 1)} className="inline-flex items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-sm font-black text-cyan-100 hover:bg-cyan-300/20">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh feeds
                </button>
              </div>
            </div>
          </header>

          <section className="mt-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4" aria-label="Compliance metrics">
            {metrics.map((metric) => <MetricTile key={metric.label} {...metric} />)}
          </section>

          <section className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {AEROSPACE_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-3 text-sm font-black transition ${active ? "bg-white text-slate-950" : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white"}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" /> {tab.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-5">
            <ActiveWorkspace activeTab={activeTab} feeds={feeds} />
          </section>

          <section className="mt-5 grid gap-4 lg:grid-cols-3">
            {Object.entries(DATA_FEEDS).map(([key, feed]) => (
              <article key={key} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">{feed.label}</p>
                    <p className="mt-1 text-sm font-bold text-slate-300">{feed.endpoint}</p>
                  </div>
                  <DataStatusPill feed={feeds[key]} />
                </div>
              </article>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}
