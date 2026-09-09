import { useState, useEffect } from "react";
import {
  Activity,
  BarChart3,
  Boxes,
  ClipboardCheck,
  Clock3,
  Factory,
  FileStack,
  Gauge,
  Layers3,
  LogOut,
  PanelRight,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Wrench
} from "lucide-react";
import apiClient from "./lib/apiClient.js";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import { useAuth } from "./hooks/useAuth.jsx";
import ShopFloorKiosk from "./components/ShopFloorKiosk.jsx";

const WORKSPACE_MODULES = [
  { id: "floor", label: "Shop Floor", icon: Factory, roles: ["admin", "operator", "employee"] },
  { id: "production", label: "Production", icon: Layers3, roles: ["admin", "operator"] },
  { id: "quality", label: "Quality", icon: ClipboardCheck, roles: ["admin", "operator", "employee"] },
  { id: "materials", label: "Materials", icon: Boxes, roles: ["admin", "operator"] },
  { id: "maintenance", label: "Maintenance", icon: Wrench, roles: ["admin", "operator"] },
  { id: "insights", label: "Insights", icon: BarChart3, roles: ["admin", "operator"] }
];

const WORKSPACE_CARDS = [
  { id: "dispatch", module: "production", title: "Dispatch Board", icon: Clock3, description: "Prioritize jobs by active variance, due pressure, and work center load." },
  { id: "traveler", module: "production", title: "Digital Travelers", icon: FileStack, description: "Surface routings, materials, blueprints, and operator notes in one workspace." },
  { id: "inspection", module: "quality", title: "Inspection Queue", icon: ShieldCheck, description: "Capture in-process checks and supervisor reviews from the floor." },
  { id: "material", module: "materials", title: "Material Readiness", icon: Boxes, description: "Track shortages, lot traceability, and upcoming kitting needs." },
  { id: "maintenance", module: "maintenance", title: "Asset Health", icon: Wrench, description: "Coordinate downtime, preventive work, and blocked machines." },
  { id: "analytics", module: "insights", title: "Live Absorption", icon: Gauge, description: "Watch standard-to-actual performance as labor posts from kiosks." }
];

function normalizeVarianceRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.variance_data)) return payload.variance_data;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function buildTimeline(rows) {
  return rows.slice(0, 6).map((row, index) => {
    const standardHours = Number(row.standardHours ?? row.estimatedHours ?? 0);
    const actualHours = Number(row.actualHours ?? 0);
    const efficiency = actualHours > 0 ? Math.round((standardHours / actualHours) * 100) : 0;
    return {
      id: row.id ?? `${row.workCenter ?? row.jobId ?? "row"}-${index}`,
      title: row.workCenter || row.jobId || "Unassigned work center",
      detail: row.partNumber || row.operation || "No part linked",
      metric: actualHours > 0 ? `${efficiency}% efficiency` : "Awaiting labor",
      tone: efficiency >= 90 ? "emerald" : efficiency >= 75 ? "amber" : "rose"
    };
  });
}

function MetricCard({ metric }) {
  const Icon = metric.icon;
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{metric.label}</span>
        <Icon className="h-4 w-4 text-teal-700" aria-hidden="true" />
      </div>
      <strong className="mt-3 block text-2xl font-black text-slate-950">{metric.value}</strong>
      <span className="mt-1 block text-xs text-slate-500">{metric.caption}</span>
    </article>
  );
}

function WorkspaceCard({ card, rows }) {
  const Icon = card.icon;
  const relatedCount = rows.length;
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-md bg-teal-50 p-3 text-teal-800">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{relatedCount} live</span>
      </div>
      <h3 className="mt-5 text-lg font-black text-slate-950">{card.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
    </article>
  );
}

function TimelineItem({ item }) {
  const tones = {
    emerald: "bg-emerald-500 text-emerald-700 border-emerald-200",
    amber: "bg-amber-500 text-amber-700 border-amber-200",
    rose: "bg-rose-500 text-rose-700 border-rose-200"
  };
  return (
    <li className="flex gap-3">
      <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${tones[item.tone]?.split(" ")[0] || "bg-slate-400"}`} />
      <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-slate-950">{item.title}</h3>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[item.tone]?.replace(/^\S+\s/, "") || "text-slate-600 border-slate-200"}`}>{item.metric}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
      </div>
    </li>
  );
}

export default function Dashboard() {
  const { user, isAdmin, logout } = useAuth();
  const [activeModule, setActiveModule] = useState("floor");
  const [showAdmin, setShowAdmin] = useState(false);
  const [varianceData, setVarianceData] = useState([]);
  const [varianceLoading, setVarianceLoading] = useState(true);
  const [workspaceQuery, setWorkspaceQuery] = useState("");

  // Autonomous cloud refresh polling — sync variance metrics every 10s
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      apiClient.get("/api/shopfloor/variance-analytics")
        .then((data) => {
          if (cancelled) return;
          setVarianceData(normalizeVarianceRows(data));
          setVarianceLoading(false);
        })
        .catch(() => {
          if (!cancelled) setVarianceLoading(false);
        });
    };
    load();
    const timer = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const role = user?.role || "operator";
  const visibleModules = WORKSPACE_MODULES.filter((module) => !module.roles || module.roles.includes(role));
  const filteredCards = WORKSPACE_CARDS.filter((card) => {
    const matchesModule = activeModule === "floor" || card.module === activeModule;
    const searchable = `${card.title} ${card.description}`.toLowerCase();
    return matchesModule && searchable.includes(workspaceQuery.trim().toLowerCase());
  });
  const totalStdHours = varianceData.reduce((sum, r) => sum + Number(r.standardHours ?? r.estimatedHours ?? 0), 0);
  const totalActHours = varianceData.reduce((sum, r) => sum + Number(r.actualHours ?? 0), 0);
  const avgEfficiency = totalActHours > 0 ? Math.round((totalStdHours / totalActHours) * 100) : 0;
  const timelineItems = buildTimeline(varianceData);

  const metrics = [
    { label: "Live Jobs", value: varianceData.length, caption: varianceLoading ? "Syncing shop feed" : "Variance rows online", icon: Activity },
    { label: "Standard Hours", value: totalStdHours.toFixed(2), caption: "Planned routing time", icon: TimerReset },
    { label: "Actual Hours", value: totalActHours.toFixed(2), caption: "Posted labor time", icon: Clock3 },
    { label: "Efficiency", value: `${avgEfficiency}%`, caption: "Std vs actual", icon: Gauge }
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#d7f4ec,transparent_34%),linear-gradient(135deg,#f8fafc_0%,#eef2f1_48%,#f6efe6_100%)] text-slate-950">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
        <aside className="border-b border-slate-200 bg-white/80 p-5 backdrop-blur lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-teal-800 font-black text-white">FL</span>
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-slate-900">ForgeLogic</p>
              <p className="text-xs text-slate-500">Paperless factory OS</p>
            </div>
          </div>

          <nav className="mt-8 grid gap-2" aria-label="Workspace modules">
            {visibleModules.map((module) => {
              const Icon = module.icon;
              const active = activeModule === module.id;
              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => setActiveModule(module.id)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-bold transition ${active ? "bg-teal-800 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span>{module.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signed in</p>
            <p className="mt-2 font-bold text-slate-950">{user?.name || user?.email || "Operator"}</p>
            <p className="text-sm capitalize text-slate-500">{role}</p>
            <div className="mt-4 flex gap-2">
              {isAdmin() && (
                <button type="button" onClick={() => setShowAdmin((visible) => !visible)} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-teal-500 hover:text-teal-800">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Admin
                </button>
              )}
              <button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800">
                <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 p-4 sm:p-6 xl:p-8">
          <header className="flex flex-col gap-5 rounded-lg border border-white/80 bg-white/70 p-5 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-teal-800">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Real-time workspace
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">Modern paperless manufacturing command center</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Fluid cards, live timelines, and operator actions share the same state-driven workspace so production context can move with the job instead of hiding inside fixed forms.</p>
            </div>
            <label className="relative block min-w-0 md:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                value={workspaceQuery}
                onChange={(event) => setWorkspaceQuery(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none ring-teal-700/20 transition focus:border-teal-600 focus:ring-4"
                placeholder="Search workspace"
              />
            </label>
          </header>

          {showAdmin && <div className="mt-6"><AdminDashboard /></div>}

          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Live metrics">
            {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="grid gap-6">
              <ShopFloorKiosk />

              <section className="rounded-lg border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-slate-950">Dynamic Workspace</h2>
                    <p className="mt-1 text-sm text-slate-500">Cards render from workspace state and respond to module filters.</p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    <PanelRight className="h-3.5 w-3.5" aria-hidden="true" /> {filteredCards.length} panels
                  </span>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {filteredCards.map((card) => <WorkspaceCard key={card.id} card={card} rows={varianceData} />)}
                  {filteredCards.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500 md:col-span-2 2xl:col-span-3">No workspace cards match the current filter.</div>
                  )}
                </div>
              </section>
            </div>

            <section className="rounded-lg border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-950">Live Factory Timeline</h2>
                  <p className="mt-1 text-sm text-slate-500">Generated from variance analytics polling.</p>
                </div>
                <Activity className="h-5 w-5 text-teal-700" aria-hidden="true" />
              </div>
              <ol className="mt-5 grid gap-3">
                {timelineItems.map((item) => <TimelineItem key={item.id} item={item} />)}
              </ol>
              {!varianceLoading && timelineItems.length === 0 && (
                <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">No live variance events are available yet.</div>
              )}
              {varianceLoading && <div className="mt-5 rounded-lg bg-slate-100 p-4 text-sm font-semibold text-slate-500">Syncing live operations...</div>}
            </section>
          </section>
        </main>

        <aside className="border-t border-slate-200 bg-slate-950 p-5 text-white lg:border-l lg:border-t-0">
          <div className="sticky top-5 grid gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-teal-200">Live Metrics Panel</p>
              <h2 className="mt-2 text-2xl font-black text-white">Plant pulse</h2>
            </div>
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <article key={metric.label} className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-slate-300">{metric.label}</span>
                    <Icon className="h-4 w-4 text-teal-200" aria-hidden="true" />
                  </div>
                  <strong className="mt-2 block text-3xl font-black text-white">{metric.value}</strong>
                  <p className="mt-1 text-xs text-slate-400">{metric.caption}</p>
                </article>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
