"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Share2, Sparkles, Trash2, CalendarPlus } from "lucide-react";
import { Glass, Sheet, Notice, Pill } from "@/components/ui/glass";
import { SelectorChips } from "@/components/ui/selector-chips";
import { store, useStore, originOrFallback, type Plan } from "@/lib/store";
import * as consensus from "@/lib/engine/consensus.js";
import * as questions from "@/lib/engine/questions.js";
import * as planEng from "@/lib/engine/plan.js";
import * as calendarEng from "@/lib/engine/calendar.js";

export default function Plans({ focus, setFocus }: { focus?: string; setFocus: (id?: string) => void }) {
  const plans = useStore(s => s.plans);
  const list = Object.values(plans).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (focus && plans[focus]) return <PlanDetail plan={plans[focus]} back={() => setFocus(undefined)} />;

  return (
    <div className="px-5 pb-4 pt-[calc(18px+var(--safe-t))]">
      <h1 className="display mb-1">Plans</h1>
      <p className="mb-6 text-[14px] text-white/45">Everything you're putting together</p>
      {list.length === 0 ? (
        <Glass className="p-8 text-center">
          <p className="text-[15px] text-white/55">Nothing yet.</p>
          <p className="mt-1 text-[13.5px] text-white/35">Say what you want to do on the home screen.</p>
        </Glass>
      ) : (
        <div className="space-y-3">
          {list.map((p, i) => {
            const st = consensus.build(p);
            return (
              <motion.button key={p.id}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * .05, ease: [.22,1,.36,1] }}
                onClick={() => setFocus(p.id)} className="w-full text-left">
                <Glass className="p-4 transition-transform active:scale-[.99]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[16px] font-semibold">{p.title}</p>
                      <p className="mt-1 truncate text-[13px] text-white/40">"{p.idea}"</p>
                    </div>
                    <Pill className={p.finalPlan ? "!text-emerald-300" : "!text-[#C9C1FF]"}>
                      {p.finalPlan ? "Planned" : "Collecting"}
                    </Pill>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {p.participants.slice(0, 5).map(x => (
                        <span key={x.id} className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#0B0B12] text-[11px] font-bold"
                          style={{ background: "var(--grad-brand)" }}>{x.name[0]?.toUpperCase()}</span>
                      ))}
                    </div>
                    <span className="text-[12.5px] text-white/40">
                      {st.confirmedCount}/{p.participants.length} in
                      {p.finalPlan && ` · ~$${p.finalPlan.cost.perPerson}pp`}
                    </span>
                  </div>
                </Glass>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlanDetail({ plan, back }: { plan: Plan; back: () => void }) {
  const me = useStore(s => s.me);
  const [who, setWho] = React.useState(plan.participants[0].id);
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

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

  const addPerson = () => {
    if (!name.trim()) return;
    const id = crypto.randomUUID().slice(0, 8);
    store.savePlan({ ...plan, participants: [...plan.participants, { id, name: name.trim(), answers: {} }] });
    setWho(id); setName(""); setAdding(false);
  };

  const build = async () => {
    setBusy(true);
    try {
      const fp = await planEng.generate(plan, { origin: plan.origin || originOrFallback() });
      store.savePlan({ ...plan, finalPlan: fp });
    } finally { setBusy(false); }
  };

  return (
    <div className="px-5 pb-4 pt-[calc(18px+var(--safe-t))]">
      <button onClick={back} className="mb-4 flex items-center gap-1.5 text-[14px] text-white/45 transition-colors hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Plans
      </button>
      <h1 className="text-[26px]">{plan.title}</h1>
      <p className="mt-1 mb-5 text-[13.5px] text-white/40">"{plan.idea}"</p>

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
          <button onClick={() => setAdding(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-white/20 text-white/45 transition-colors hover:text-white">
            <Plus className="h-4 w-4" />
          </button>
        </div>
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
      <SelectorChips options={q.options} value={sel} onChange={setSel} />
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
                </p>
              )}
              {it.place?.address && <p className="text-[12px] text-white/35">{it.place.address}</p>}
              {it.unresolved && <p className="mt-1 text-[12.5px] text-amber-200/80">{it.unresolvedMessage}</p>}
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
