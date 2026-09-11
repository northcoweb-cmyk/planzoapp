"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { MapPin, ArrowRight, CloudSun, Users } from "lucide-react";
import { PromptInput } from "@/components/ui/ai-chat-input";
import { Glass, Pill, Img } from "@/components/ui/glass";
import { timeSlot, greetingFor } from "@/lib/greeting";
import { store, useStore, originOrFallback, requestLocation, type Plan } from "@/lib/store";
import * as intent from "@/lib/engine/intent.js";
import * as events from "@/lib/engine/events.js";
import * as weather from "@/lib/engine/weather.js";
import * as consensus from "@/lib/engine/consensus.js";

export default function Home({ go }: { go: (tab: string, arg?: any) => void }) {
  const me = useStore(s => s.me);
  const plans = useStore(s => s.plans);
  const chat = useStore(s => s.chat);
  const slot = timeSlot();
  const g = greetingFor(slot);

  const [wx, setWx] = React.useState<any>(null);
  const [near, setNear] = React.useState<any[]>([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      await requestLocation();
      const o = originOrFallback();
      weather.forecast(o.lat, o.lon).then(setWx);
      const r = await events.search({ lat: o.lat, lon: o.lon, radiusMiles: 25, limit: 6 });
      if (r.available) setNear(r.events);
    })();
  }, []);

  const openPlans = Object.values(plans)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 2);

  async function submit(text: string) {
    setBusy(true);
    store.say({ role: "user", text, at: new Date().toISOString() });
    try {
      const parsed = await intent.extract(text);
      const plan: Plan = {
        id: crypto.randomUUID().slice(0, 8),
        idea: text, title: parsed.title, intent: parsed,
        origin: originOrFallback(),
        participants: [{ id: me!.id, name: me!.name, answers: {}, isCreator: true }],
        finalPlan: null, createdAt: new Date().toISOString(),
      };
      store.savePlan(plan);
      store.say({
        role: "planzo",
        text: `Got it — ${parsed.title.toLowerCase()}. Add who's coming and I'll work the rest out.`,
        at: new Date().toISOString(), planId: plan.id,
      });
      go("plans", plan.id);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-full flex-col px-5 pb-4 pt-[calc(18px+var(--safe-t))]">
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .5, ease: [.22, 1, .36, 1] }}
        className="mb-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <Pill><MapPin className="h-3 w-3" />{originOrFallback().label}</Pill>
          {wx?.available && (
            <Pill><CloudSun className="h-3 w-3" />{wx.highF}° · {wx.summary}</Pill>
          )}
        </div>
        <p className="text-[15px] font-medium text-white/45">
          {g.hi}, {me?.name?.split(" ")[0]}
        </p>
        <h1 className="display mt-1">{g.line}</h1>
      </motion.div>

      {/* The chat is the front door — open, focused, waiting. */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .5, delay: .06, ease: [.22, 1, .36, 1] }}
        className="mb-3"
      >
        <PromptInput
          className="!max-w-none"
          placeholder={g.prompts[0]}
          onSubmit={(v) => submit(v)}
          busy={busy}
          proUnlocked={Boolean(me?.pro)}
          onProRequest={() => go("profile")}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .14 }}
        className="no-bar edge-fade -mx-5 mb-7 flex gap-2 overflow-x-auto px-5"
      >
        {g.prompts.map((p) => (
          <button key={p} onClick={() => submit(p)}
            className="shrink-0 rounded-full border border-white/10 bg-white/[.06] px-3.5 py-2 text-[13px] font-medium text-white/70 backdrop-blur-sm transition-colors hover:bg-white/[.12] active:scale-95">
            {p}
          </button>
        ))}
      </motion.div>

      {chat.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 space-y-2">
          {chat.slice(-2).map((t, i) => (
            <div key={i} className={t.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={t.role === "user"
                ? "max-w-[85%] rounded-[18px] rounded-br-md px-4 py-2.5 text-[14px] text-white"
                : "glass max-w-[85%] rounded-[18px] rounded-bl-md px-4 py-2.5 text-[14px] text-white/85"}
                style={t.role === "user" ? { background: "var(--grad-brand)" } : undefined}>
                {t.text}
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {openPlans.length > 0 && (
        <Section title="Your plans" action="All" onAction={() => go("plans")}>
          <div className="space-y-2.5">
            {openPlans.map((p) => {
              const st = consensus.build(p);
              return (
                <button key={p.id} onClick={() => go("plans", p.id)} className="w-full text-left">
                  <Glass className="flex items-center gap-3 p-3.5 transition-transform active:scale-[.99]">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[17px]"
                      style={{ background: "var(--grad-brand)" }}>
                      {p.intent?.categories?.includes("food") ? "🍕"
                        : p.intent?.categories?.includes("outdoors") ? "🏖️"
                        : p.intent?.categories?.includes("event") ? "🎟️" : "✨"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">{p.title}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-white/45">
                        <Users className="h-3 w-3" />
                        {p.participants.length} · {st.confirmedCount} in
                        {p.finalPlan && ` · ~$${p.finalPlan.cost.perPerson}pp`}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-white/25" />
                  </Glass>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Happening near you" action="See all" onAction={() => go("discover")}>
        {near.length === 0 ? (
          <div className="flex gap-3">
            {[0, 1].map(i => <div key={i} className="skeleton h-[168px] flex-1 rounded-[22px]" />)}
          </div>
        ) : (
          <div className="no-bar edge-fade -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
            {near.map((e, i) => (
              <motion.button
                key={e.providerId}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: .05 * i, duration: .45, ease: [.22, 1, .36, 1] }}
                onClick={() => go("discover", e)}
                className="w-[240px] shrink-0 text-left"
              >
                <Glass className="overflow-hidden p-0 transition-transform active:scale-[.98]">
                  <Img src={e.imageUrl} alt={e.title} ratio="16/9" />
                  <div className="p-3.5">
                    <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-[#C9C1FF]">
                      {e.genre || e.category}
                    </p>
                    <p className="line-clamp-2 text-[14.5px] font-semibold leading-snug">{e.title}</p>
                    <p className="mt-1.5 truncate text-[12px] text-white/45">
                      {fmtDate(e.date)}{e.venue ? ` · ${e.venue}` : ""}
                    </p>
                  </div>
                </Glass>
              </motion.button>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, action, onAction, children }: {
  title: string; action?: string; onAction?: () => void; children: React.ReactNode;
}) {
  return (
    <div className="mb-7">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[17px]">{title}</h2>
        {action && <button onClick={onAction} className="text-[13px] font-medium text-white/40 transition-colors hover:text-white/70">{action}</button>}
      </div>
      {children}
    </div>
  );
}

export function fmtDate(d?: string | null) {
  if (!d) return "Date TBA";
  const dt = new Date(d + "T12:00:00");
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const days = Math.round((dt.getTime() - today.getTime()) / 86400000);
  if (days === 0) return "Tonight";
  if (days === 1) return "Tomorrow";
  if (days > 1 && days < 7) return dt.toLocaleDateString([], { weekday: "long" });
  return dt.toLocaleDateString([], { month: "short", day: "numeric" });
}
