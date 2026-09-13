"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Share2, Sparkles, Trash2, CalendarPlus, Check, Link as LinkIcon } from "lucide-react";
import { Glass, Sheet, Notice, Pill } from "@/components/ui/glass";
import { SelectorChips } from "@/components/ui/selector-chips";
import { store, useStore, originOrFallback, type Plan } from "@/lib/store";
import * as consensus from "@/lib/engine/consensus.js";
import * as questions from "@/lib/engine/questions.js";
import * as planEng from "@/lib/engine/plan.js";
import * as calendarEng from "@/lib/engine/calendar.js";
import * as api from "@/lib/api";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** The plan's own resolved date if it has one (finalPlan.date, or whatever
 * the group's day answers already resolve to via the same consensus.build
 * every other part of this screen already calls) — falling back to when
 * the plan was created. Purely a read of data that already exists; nothing
 * here computes or stores anything new. */
function dateKeyFor(p: Plan, st: ReturnType<typeof consensus.build>): string {
  return p.finalPlan?.date || st.hard.date || p.createdAt.slice(0, 10);
}

function MonthCalendar({ list, states }: { list: Plan[]; states: Map<string, ReturnType<typeof consensus.build>> }) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const [viewed, setViewed] = React.useState(() => { const d = new Date(); d.setDate(1); return d; });

  const byDay = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const p of list) {
      const k = dateKeyFor(p, states.get(p.id)!);
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  }, [list, states]);

  const year = viewed.getFullYear(), month = viewed.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const keyFor = (day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return (
    <div className="brutal-card brutal-tilt-l mb-6 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="brutal-mono text-[20px] font-black uppercase tracking-tight text-white">
          {viewed.toLocaleDateString(undefined, { month: "long" })} <span style={{ color: "#7C6BFF" }}>{year}</span>
        </h2>
        <div className="flex gap-1.5">
          <button onClick={() => setViewed(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="grid h-8 w-8 place-items-center border-2 border-black bg-white text-black transition-transform active:scale-90" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" strokeWidth={3} />
          </button>
          <button onClick={() => setViewed(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="grid h-8 w-8 place-items-center border-2 border-black bg-white text-black transition-transform active:scale-90" aria-label="Next month">
            <ChevronRight className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>
      </div>

      <div className="mb-1.5 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="brutal-mono text-center text-[11px] font-bold text-white/40">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day == null) return <div key={i} />;
          const k = keyFor(day);
          const isToday = k === todayKey;
          const count = byDay.get(k) || 0;
          return (
            <div key={i}
              className={`relative flex aspect-square flex-col items-center justify-center text-[13px] font-bold ${
                isToday ? "brutal-card-accent text-white" : "border-2 border-white/15 text-white/70"}`}
              style={{ borderRadius: 2 }}>
              {day}
              {count > 0 && !isToday && (
                <span className="brutal-dot absolute bottom-1 h-1.5 w-1.5 rounded-full" style={{ background: "#7C6BFF" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Plans({ focus, setFocus, go }: { focus?: string; setFocus: (id?: string) => void; go: (tab: string, arg?: any) => void }) {
  const plans = useStore(s => s.plans);
  const list = Object.values(plans).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // Same consensus.build() call this screen already made per plan for the
  // "confirmed" count — computed once here and reused by both the calendar
  // dots above and the list below, instead of building it twice.
  const states = React.useMemo(() => {
    const m = new Map<string, ReturnType<typeof consensus.build>>();
    for (const p of list) m.set(p.id, consensus.build(p));
    return m;
  }, [list]);

  if (focus && plans[focus]) return <PlanDetail plan={plans[focus]} back={() => setFocus(undefined)} go={go} />;

  return (
    <div className="px-5 pb-4 pt-[calc(18px+var(--safe-t))]">
      <h1 className="mb-1 -rotate-1 text-[32px] font-black uppercase italic tracking-tight text-white">Plans</h1>
      <p className="brutal-mono mb-6 text-[13px] text-white/45">// everything you're putting together</p>

      <MonthCalendar list={list} states={states} />

      <h3 className="brutal-mono mb-3 rotate-1 text-[13px] font-bold uppercase tracking-widest text-white/50">— Event list —</h3>

      {list.length === 0 ? (
        <div className="brutal-card-flat p-8 text-center">
          <p className="text-[15px] font-bold">Nothing yet.</p>
          <p className="brutal-mono mt-1 text-[12.5px] text-black/60">Say what you want to do on the home screen.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((p, i) => {
            const st = states.get(p.id)!;
            const tilt = i % 3 === 0 ? "brutal-tilt-r" : i % 3 === 1 ? "brutal-tilt-l" : "";
            return (
              <motion.button key={p.id}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * .05, ease: [.22,1,.36,1] }}
                onClick={() => setFocus(p.id)} className="block w-full text-left">
                <div className={`brutal-card p-4 transition-transform active:scale-[.98] ${tilt}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[17px] font-black uppercase text-white">{p.title}</p>
                      <p className="brutal-mono mt-1 truncate text-[12.5px] text-white/40">"{p.idea}"</p>
                    </div>
                    <span className={`shrink-0 border-2 border-black px-2 py-1 text-[10px] font-black uppercase tracking-wide ${
                      p.finalPlan ? "bg-emerald-300 text-black" : "text-white"}`}
                      style={!p.finalPlan ? { background: "#7C6BFF" } : undefined}>
                      {p.finalPlan ? "Planned" : "Collecting"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {p.participants.slice(0, 5).map(x => (
                        <span key={x.id} className="grid h-7 w-7 place-items-center border-2 border-black text-[11px] font-bold text-white"
                          style={{ background: "var(--grad-brand)", borderRadius: "50%" }}>{x.name[0]?.toUpperCase()}</span>
                      ))}
                    </div>
                    <span className="brutal-mono text-[12px] text-white/40">
                      {st.confirmedCount}/{p.participants.length} in
                      {p.finalPlan && ` · ~$${p.finalPlan.cost.perPerson}pp`}
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const FREE_GROUP_SIZE_CAP = 8;

function PlanDetail({ plan, back, go }: { plan: Plan; back: () => void; go: (tab: string, arg?: any) => void }) {
  const me = useStore(s => s.me);
  const [who, setWho] = React.useState(plan.participants[0].id);
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const st = consensus.build(plan);
  const participant = plan.participants.find(p => p.id === who) || plan.participants[0];
  const q = questions.next(plan, participant);

  const answer = (qid: string, value: any) => {
    const next: Plan = {
      ...plan,
      participants: plan.participants.map(p =>
        p.id === who ? { ...p, answers: { ...p.answers, [qid]: value } } : p),
    };
    store.savePlan(next);
    if (who === me?.id) store.learn(next, who);
  };

  const atFreeCap = !me?.pro && plan.participants.length >= FREE_GROUP_SIZE_CAP;

  const addPerson = () => {
    if (!name.trim() || atFreeCap) return;
    const id = crypto.randomUUID().slice(0, 8);
    store.savePlan({ ...plan, participants: [...plan.participants, { id, name: name.trim(), answers: {} }] });
    setWho(id); setName(""); setAdding(false);
  };

  /** First click creates the plan server-side (so there's something at
   * the other end of the link at all) and caches the code on the plan;
   * every click after that just copies the same link. */
  const shareLink = async () => {
    if (!me || !api.canShare()) return;
    setSharing(true);
    try {
      let url = plan.shareUrl;
      if (!url) {
        const shared = await api.createSharedPlan({
          name: me.name, idea: plan.idea, date: plan.finalPlan?.date || null,
          origin: plan.origin || originOrFallback(),
        });
        if (!shared) return; // no server in this build — nothing to link to
        url = shared.shareUrl;
        store.savePlan({ ...plan, shareCode: shared.code, shareUrl: shared.shareUrl });
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally { setSharing(false); }
  };

  const build = async () => {
    setBusy(true);
    try {
      const fp = await planEng.generate(plan, { origin: plan.origin || originOrFallback(), effort: plan.effort });
      store.savePlan({ ...plan, finalPlan: fp });
    } finally { setBusy(false); }
  };

  return (
    <div className="px-5 pb-4 pt-[calc(18px+var(--safe-t))]">
      <button onClick={back} className="mb-4 flex items-center gap-1.5 text-[14px] text-white/45 transition-colors hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Plans
      </button>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px]">{plan.title}</h1>
          <p className="mt-1 text-[13.5px] text-white/40">"{plan.idea}"</p>
        </div>
        {api.canShare() && (
          <button onClick={shareLink} disabled={sharing}
            className="mt-1 flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[.06] px-3.5 py-2 text-[12.5px] font-medium text-white/70 transition-colors hover:bg-white/[.12] disabled:opacity-50">
            {copied ? <><Check className="h-3.5 w-3.5 text-emerald-300" /> Copied</>
              : sharing ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> …</>
              : <><Share2 className="h-3.5 w-3.5" /> {plan.shareUrl ? "Copy link" : "Share"}</>}
          </button>
        )}
      </div>
      <div className="mb-5" />

      <Glass className="mb-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="eyebrow text-white/40">Who's in</span>
          <Pill>{st.confirmedCount}/{plan.participants.length}</Pill>
        </div>
        <div className="no-bar flex gap-2 overflow-x-auto pb-1">
          {plan.participants.map(p => {
            const done = questions.next(plan, p).done;
            const answered = Object.keys(p.answers || {}).length > 0;
            return (
              <button key={p.id} onClick={() => setWho(p.id)}
                className={`flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-[13px] font-medium transition-colors ${
                  who === p.id ? "border-[#7C6BFF]/60 bg-[#7C6BFF]/20 text-[#C9C1FF]" : "border-white/10 bg-white/[.05] text-white/55"}`}>
                <span className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold"
                  style={{ background: done ? "#10B981" : answered ? "var(--grad-brand)" : "rgba(255,255,255,.12)" }}>
                  {done ? "✓" : p.name[0]?.toUpperCase()}
                </span>
                {p.name}
              </button>
            );
          })}
          <button onClick={() => atFreeCap ? go("upgrade") : setAdding(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-white/20 text-white/45 transition-colors hover:text-white">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {atFreeCap && (
          <p className="mt-2.5 text-[11.5px] text-white/35">
            Free plans top out at {FREE_GROUP_SIZE_CAP} people.{" "}
            <button onClick={() => go("upgrade")} className="font-semibold text-[#C9C1FF] underline underline-offset-2">
              Upgrade for unlimited groups
            </button>
          </p>
        )}
      </Glass>

      {/* The adaptive question — one at a time, for whoever is selected. */}
      <AnimatePresence mode="wait">
        {!q.done ? (
          <motion.div key={q.question.id + who}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: .3, ease: [.22,1,.36,1] }}>
            <Glass className="mb-4 p-5">
              <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/10">
                <motion.div className="h-full rounded-full" style={{ background: "var(--grad-brand)" }}
                  animate={{ width: `${Math.min(96, (q.progress.answered / Math.max(1, q.progress.estimatedTotal)) * 100)}%` }}
                  transition={{ duration: .4 }} />
              </div>
              <p className="mb-1 text-[12px] text-white/35">
                {participant.name} · question {q.progress.answered + 1} of about {q.progress.estimatedTotal}
              </p>
              <h3 className="mb-1 text-[19px]">{q.question.text}</h3>
              {q.question.because && <p className="mb-3 text-[12.5px] text-[#C9C1FF]">{q.question.because}</p>}
              {q.question.kind === "hard" && (
                <p className="mb-3 text-[12.5px] text-white/35">This one binds the whole group, so everyone is asked.</p>
              )}
              <MultiOrSingle q={q.question} onPick={(v) => answer(q.question.id, v)} />
            </Glass>
          </motion.div>
        ) : (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Glass className="mb-4 p-5 text-center">
              <p className="text-[15px] font-semibold">{participant.name} is done.</p>
              <p className="mt-1 text-[13px] text-white/40">Pick someone else, or add more people.</p>
            </Glass>
          </motion.div>
        )}
      </AnimatePresence>

      {!plan.finalPlan ? (
        <button onClick={build} disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full py-4 text-[15.5px] font-semibold text-white transition-transform active:scale-[.98] disabled:opacity-60"
          style={{ background: st.readyToPlan ? "var(--grad-brand)" : "rgba(255,255,255,.09)" }}>
          {busy ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Working it out…</>
                : <><Sparkles className="h-4 w-4" /> {st.readyToPlan ? "Build the plan" : "Build it anyway"}</>}
        </button>
      ) : <FinalPlan plan={plan} />}

      <button onClick={() => { store.deletePlan(plan.id); back(); }}
        className="mt-5 flex w-full items-center justify-center gap-2 py-3 text-[13.5px] text-white/30 transition-colors hover:text-red-300">
        <Trash2 className="h-3.5 w-3.5" /> Delete plan
      </button>

      <AnimatePresence>
        {adding && (
          <Sheet open onClose={() => setAdding(false)} title="Add someone">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPerson()}
              placeholder="Their name"
              className="glass mb-3 w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none placeholder:text-white/30" />
            <button onClick={addPerson} className="w-full rounded-full py-3.5 text-[15px] font-semibold"
              style={{ background: "var(--grad-brand)" }}>Add</button>
            <p className="mt-3 text-center text-[12px] text-white/35">
              In the full app they join from a link you share. Here you answer as each of them.
            </p>
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}

function MultiOrSingle({ q, onPick }: { q: any; onPick: (v: any) => void }) {
  const [sel, setSel] = React.useState<string[]>([]);
  if (!q.multi) {
    return <SelectorChips options={q.options} value={[]} onChange={(v) => v[0] && onPick(v[0])} single />;
  }
  return (
    <>
      <SelectorChips options={q.options} value={sel} onChange={setSel} max={q.maxPicks || undefined} />
      {q.maxPicks && <p className="mt-2 text-[12px] text-white/35">Pick up to {q.maxPicks}</p>}
      <button disabled={!sel.length} onClick={() => onPick(sel)}
        className="mt-4 w-full rounded-full py-3 text-[14.5px] font-semibold disabled:opacity-40"
        style={{ background: "var(--grad-brand)" }}>Continue</button>
    </>
  );
}

function FinalPlan({ plan }: { plan: Plan }) {
  const fp = plan.finalPlan;
  const ics = () => {
    const blob = new Blob([calendarEng.planToIcs(plan, fp)], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `planzo-${plan.id}.ics`; a.click();
  };
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: [.22,1,.36,1] }}>
      <Glass className="mb-3 p-5">
        <span className="eyebrow text-[#C9C1FF]">Your plan is ready</span>
        <h3 className="mt-2 text-[22px]">{fp.title}</h3>
        <p className="mt-1 text-[13.5px] text-white/45">
          {fp.window} · {fp.groupSize} {fp.groupSize === 1 ? "person" : "people"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill className="!text-[#C9C1FF]">~${fp.cost.perPerson}/person · est.</Pill>
          {fp.weather?.available
            ? <Pill>{fp.weather.summary} · {fp.weather.highF}°</Pill>
            : <Pill className="!text-amber-200">Weather unavailable</Pill>}
        </div>
      </Glass>

      {fp.caveats?.map((c: string, i: number) => (
        <div key={i} className="mb-3"><Notice>{c}</Notice></div>
      ))}

      <Glass className="mb-3 p-5">
        <div className="relative pl-6">
          <div className="absolute bottom-2 left-[5px] top-2 w-px" style={{ background: "linear-gradient(180deg,#6366F1,#C026D3)" }} />
          {fp.itinerary.map((it: any, i: number) => (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * .07 }} className="relative pb-5 last:pb-0">
              <span className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-[#0B0B12]"
                style={{ background: "var(--grad-brand)" }} />
              <p className="text-[11.5px] font-bold tracking-wide text-[#C9C1FF]">{it.time}</p>
              <p className="text-[15px] font-semibold">{it.title}</p>
              {it.place?.name && (
                <p className="mt-0.5 text-[13px] text-white/55">
                  {it.place.name}{it.place.rating ? ` · ★${it.place.rating}` : ""}
                  {it.place.distanceMiles != null && ` · ${it.place.distanceMiles} mi from you`}
                </p>
              )}
              {it.place?.address && <p className="text-[12px] text-white/35">{it.place.address}</p>}
              {it.unresolved && <p className="mt-1 text-[12.5px] text-amber-200/80">{it.unresolvedMessage}</p>}
              {it.alternatives?.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-white/30">Other options nearby</p>
                  {it.alternatives.map((a: any, j: number) => (
                    <p key={j} className="text-[12px] text-white/40">
                      {a.name}{a.distanceMiles != null && ` · ${a.distanceMiles} mi`}
                    </p>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </Glass>

      <Glass className="mb-3 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-[16px]">What it costs</h4><Pill>Estimate</Pill>
        </div>
        {fp.cost.lines.length ? fp.cost.lines.map((l: any, i: number) => (
          <div key={i} className="flex items-start justify-between py-1.5 text-[14px]">
            <div><p>{l.label}</p><p className="text-[11.5px] text-white/35">{l.basis}</p></div>
            <p className="font-semibold">${l.perPerson.toFixed(2)}</p>
          </div>
        )) : <p className="text-[13px] text-white/40">Nothing in this plan costs money.</p>}
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
          <span className="font-semibold">Per person</span>
          <span className="gradient-text text-[20px] font-bold">~${fp.cost.perPerson}</span>
        </div>
        <p className="mt-2 text-[11.5px] text-white/35">{fp.cost.note}</p>
      </Glass>

      <button onClick={ics}
        className="glass flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[14.5px] font-semibold transition-transform active:scale-[.98]">
        <CalendarPlus className="h-4 w-4" /> Add to calendar
      </button>
    </motion.div>
  );
}
