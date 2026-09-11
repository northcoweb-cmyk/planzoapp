"use client";
import * as React from "react";
import { Activity, RefreshCw, Zap, MapPin, AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Glass, Notice, Pill } from "@/components/ui/glass";
import { config } from "@/lib/config";

type SpendLog = { at: string; service: string; usd: number; planId: string | null; detail: any };
type ServiceReport = {
  limits: { perPlan: number; daily: number; monthly: number };
  spentToday: number; spentThisMonth: number;
  dailyRemaining: number; monthlyRemaining: number;
  avgCostPerCall?: number; callsRemainingAtCurrentRate: number | null;
  blocked: boolean;
};
type CostReport = { generatedAt: string; services: Record<string, ServiceReport>; recent: SpendLog[] };

const SERVICE_META: Record<string, { label: string; color: string; Icon: any }> = {
  ai:     { label: "AI (OpenAI)",     color: "#A5B4FC", Icon: Zap },
  places: { label: "Google Places",   color: "#67E8F9", Icon: MapPin },
};

const money = (n: number) => n < 0.01 && n > 0 ? `$${n.toFixed(6)}` : `$${n.toFixed(2)}`;
const timeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

/** Live costs + system activity, built on top of the existing spend governor
 * (lib/cost.js → GET /api/admin/cost) — no new data store, just a UI on data
 * that was already being tracked and metered server-side. */
export default function Ops({ onDone }: { onDone?: () => void }) {
  const [key, setKey] = React.useState(config.get().adminKey);
  const [saved, setSaved] = React.useState(Boolean(config.get().adminKey));
  const [report, setReport] = React.useState<CostReport | null>(null);
  const [health, setHealth] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [filter, setFilter] = React.useState<"all" | "ai" | "places">("all");

  const load = React.useCallback(async (k: string) => {
    if (!k) return;
    setLoading(true);
    try {
      const [costRes, healthRes] = await Promise.all([
        fetch(`/api/admin/cost?key=${encodeURIComponent(k)}`),
        fetch(`/api/health`),
      ]);
      if (costRes.status === 403) { setError("Wrong admin key."); setLoading(false); return; }
      const costJson = await costRes.json();
      const healthJson = await healthRes.json().catch(() => null);
      setReport(costJson);
      setHealth(healthJson);
      setError(null);
    } catch {
      setError("Couldn't reach the server.");
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (!saved || !key) return;
    load(key);
    const t = setInterval(() => load(key), 20000);
    return () => clearInterval(t);
  }, [saved, key, load]);

  // Running cumulative total per service, in chronological order, for the chart.
  // Must run on every render (not after the early return below) — conditionally
  // skipping a hook changes the hook count between renders and crashes React
  // (error #310) the moment the admin key is unlocked.
  const chartData = React.useMemo(() => {
    const chrono = [...(report?.recent || [])].reverse();
    const totals: Record<string, number> = {};
    return chrono
      .filter(r => filter === "all" || r.service === filter)
      .map(r => {
        totals[r.service] = (totals[r.service] || 0) + r.usd;
        const point: any = { t: new Date(r.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
        if (filter === "all") {
          point.ai = totals.ai || 0;
          point.places = totals.places || 0;
        } else {
          point.value = totals[filter] || 0;
        }
        return point;
      });
  }, [report, filter]);

  if (!saved || !key) {
    return (
      <div className="space-y-4">
        <Notice tone="info">
          This reads the spend governor already running on the server (lib/cost.js) —
          nothing new to build there, just a live view. Enter the server's admin key
          (PLANZO_ADMIN_KEY) to unlock it. It stays on this device.
        </Notice>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-white/50">Admin key</span>
          <input value={key} onChange={e => setKey(e.target.value)} placeholder="…"
            autoCapitalize="off" spellCheck={false}
            className="glass w-full rounded-2xl px-4 py-3.5 font-mono text-[13px] outline-none placeholder:text-white/25" />
        </label>
        {error && <p className="text-[12.5px] text-red-300">{error}</p>}
        <button
          onClick={() => { config.set({ adminKey: key.trim() }); setSaved(true); }}
          className="w-full rounded-full py-3.5 text-[15px] font-semibold" style={{ background: "var(--grad-brand)" }}>
          Unlock
        </button>
      </div>
    );
  }

  const services = report?.services || {};
  const recent = (report?.recent || []).filter(r => filter === "all" || r.service === filter);

  const todayTotal = Object.values(services).reduce((a, s) => a + s.spentToday, 0);
  const monthTotal = Object.values(services).reduce((a, s) => a + s.spentThisMonth, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[12px] text-white/40">Live · updates every 20s</p>
          <h4 className="text-[22px] font-semibold">{money(todayTotal)} <span className="text-[14px] font-normal text-white/40">today</span></h4>
          <p className="text-[12.5px] text-white/40">{money(monthTotal)} this month across every metered system</p>
        </div>
        <button onClick={() => load(key)} className="rounded-full border border-white/10 bg-white/[.05] p-2.5 hover:bg-white/10">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && <Notice tone="warn">{error}</Notice>}

      <div className="flex gap-2">
        {(["all", "ai", "places"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
              filter === f ? "bg-white text-black" : "border border-white/10 bg-white/[.05] text-white/60 hover:bg-white/10"
            }`}>
            {f === "all" ? "All systems" : SERVICE_META[f].label}
          </button>
        ))}
      </div>

      <Glass className="p-4">
        <div className="h-[180px] w-full">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[13px] text-white/30">No spend logged yet</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" vertical={false} />
                <XAxis dataKey="t" tick={{ fill: "rgba(255,255,255,.35)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,.35)", fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `$${v.toFixed(3)}`} width={54} />
                <Tooltip
                  contentStyle={{ background: "rgba(10,10,16,.92)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number) => money(v)} />
                {filter === "all" ? (
                  <>
                    <Line type="monotone" dataKey="ai" stroke={SERVICE_META.ai.color} strokeWidth={2} dot={false} name={SERVICE_META.ai.label} />
                    <Line type="monotone" dataKey="places" stroke={SERVICE_META.places.color} strokeWidth={2} dot={false} name={SERVICE_META.places.label} />
                  </>
                ) : (
                  <Line type="monotone" dataKey="value" stroke={SERVICE_META[filter].color} strokeWidth={2} dot={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Glass>

      <div className="grid grid-cols-2 gap-3">
        {Object.entries(services).map(([svc, s]) => {
          const meta = SERVICE_META[svc] || { label: svc, color: "#fff", Icon: Activity };
          const pct = s.limits.daily > 0 ? Math.min(100, (s.spentToday / s.limits.daily) * 100) : 0;
          return (
            <Glass key={svc} className="p-4">
              <div className="mb-2 flex items-center gap-1.5 text-[13px] font-medium" style={{ color: meta.color }}>
                <meta.Icon className="h-3.5 w-3.5" /> {meta.label}
              </div>
              <p className="text-[19px] font-semibold">{money(s.spentToday)}</p>
              <p className="mb-2 text-[11.5px] text-white/35">of {money(s.limits.daily)} daily cap</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-white/35">
                <span>{money(s.spentThisMonth)} / mo</span>
                {s.avgCostPerCall != null && <span>{s.callsRemainingAtCurrentRate ?? "—"} calls left today</span>}
              </div>
              {s.blocked && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-red-300">
                  <AlertTriangle className="h-3 w-3" /> ceiling hit — degraded to rules engine
                </p>
              )}
            </Glass>
          );
        })}
      </div>

      {health && (
        <Glass className="p-4">
          <h5 className="mb-2.5 text-[13px] font-medium text-white/60">System status</h5>
          <div className="flex flex-wrap gap-2">
            <Pill className={health.ok ? "!text-emerald-300" : "!text-red-300"}>server {health.ok ? "up" : "down"}</Pill>
            <Pill className={health.ai ? "!text-emerald-300" : "!text-white/40"}>AI {health.ai ? "on" : "off"}</Pill>
            <Pill className={health.places ? "!text-emerald-300" : "!text-white/40"}>Places {health.places ? "on" : "off"}</Pill>
            <Pill>{health.storage === "redis" ? "Redis storage" : "file storage"}</Pill>
          </div>
        </Glass>
      )}

      <Glass className="p-4">
        <h5 className="mb-3 text-[13px] font-medium text-white/60">Activity — every metered call</h5>
        {recent.length === 0 ? (
          <p className="text-[13px] text-white/30">Nothing logged yet.</p>
        ) : (
          <div className="max-h-[280px] space-y-2.5 overflow-y-auto no-bar pr-1">
            {recent.map((r, i) => {
              const meta = SERVICE_META[r.service] || { label: r.service, color: "#fff", Icon: Activity };
              return (
                <div key={i} className="flex items-center gap-2.5 border-l-2 pl-2.5 text-[12.5px]" style={{ borderColor: meta.color }}>
                  <meta.Icon className="h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-white/70">
                      {meta.label}{r.detail ? ` · ${typeof r.detail === "string" ? r.detail : r.detail.model || r.detail.type || ""}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-white/40">{money(r.usd)}</span>
                  <span className="shrink-0 text-white/25">{timeAgo(r.at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Glass>

      <button onClick={() => { config.set({ adminKey: "" }); setSaved(false); setKey(""); }}
        className="w-full py-2 text-center text-[12px] text-white/25 hover:text-white/50">
        Lock this view
      </button>
    </div>
  );
}
