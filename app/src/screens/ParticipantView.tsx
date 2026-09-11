"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Sparkles, PartyPopper, MapPin, Calendar } from "lucide-react";
import { Glass, Sheet, Pill } from "@/components/ui/glass";
import { SelectorChips } from "@/components/ui/selector-chips";
import * as api from "@/lib/api";

const NAME_KEY = "planzo.participant-name.v1";

/**
 * The page a real second person lands on when they open a shared plan
 * link — an entirely separate identity and flow from the main app (no
 * local store, no onboarding, no interests). Everything here talks to the
 * real server API so this genuinely works across two different devices,
 * which nothing before this did.
 */
export default function ParticipantView({ code }: { code: string }) {
  const [name, setName] = React.useState<string>(() => { try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; } });
  const [joined, setJoined] = React.useState(false);
  const [planMeta, setPlanMeta] = React.useState<any>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [q, setQ] = React.useState<any>(null);
  const [status, setStatus] = React.useState<any>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const r = await api.getPlan(code);
      if (!r.plan) { setNotFound(true); return; }
      setPlanMeta(r.plan);
      if (name) join(name);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function join(n: string) {
    setBusy(true);
    try {
      await api.joinPlan(code, n);
      try { localStorage.setItem(NAME_KEY, n); } catch {}
      setJoined(true);
      await refresh(n);
    } finally { setBusy(false); }
  }

  async function refresh(n = name) {
    const nq = await api.nextQuestion(code, n);
    if (nq.done) {
      setQ(null);
      setStatus(await api.planStatus(code));
    } else {
      setQ(nq);
    }
  }

  async function answer(questionId: string, value: string | string[]) {
    setBusy(true);
    try {
      const nq = await api.answerQuestion(code, questionId, value, name);
      if (nq.done) { setQ(null); setStatus(await api.planStatus(code)); }
      else setQ(nq);
    } finally { setBusy(false); }
  }

  if (notFound) {
    return (
      <Shell>
        <Glass className="p-8 text-center">
          <p className="text-[16px] font-semibold">This link isn't valid anymore.</p>
          <p className="mt-1.5 text-[13.5px] text-white/40">The plan may have been deleted, or the link was mistyped.</p>
        </Glass>
      </Shell>
    );
  }

  if (!planMeta) return <Shell><LoadingCard /></Shell>;

  return (
    <Shell>
      {/* The "sweet banner" — a real hero for the plan this link points to,
          not just a bare form. Same gradient language as the rest of the app. */}
      <div className="relative mb-6 overflow-hidden rounded-[28px] p-6"
        style={{ background: "var(--grad-brand)" }}>
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-black/10 blur-2xl" />
        <p className="relative mb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/70">You're invited</p>
        <h1 className="relative text-[26px] font-bold leading-tight text-white">{planMeta.title}</h1>
        <p className="relative mt-1.5 text-[14px] text-white/85">"{planMeta.idea}"</p>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <Pill className="!bg-white/15 !text-white">
            <Users className="mr-1 inline h-3 w-3" /> {planMeta.participants?.length || 1} in
          </Pill>
          {planMeta.date && (
            <Pill className="!bg-white/15 !text-white"><Calendar className="mr-1 inline h-3 w-3" /> {planMeta.date}</Pill>
          )}
          {planMeta.origin?.label && (
            <Pill className="!bg-white/15 !text-white"><MapPin className="mr-1 inline h-3 w-3" /> {planMeta.origin.label}</Pill>
          )}
        </div>
      </div>

      {!joined ? (
        <Glass className="p-5">
          <p className="mb-3 text-[15px] font-semibold">What's your name?</p>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && name.trim() && join(name.trim())}
            placeholder="Your name" enterKeyHint="go"
            className="glass mb-3 w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none placeholder:text-white/25" />
          <button disabled={!name.trim() || busy} onClick={() => join(name.trim())}
            className="w-full rounded-full py-3.5 text-[15px] font-semibold text-white transition-transform active:scale-[.98] disabled:opacity-40"
            style={{ background: "var(--grad-brand)" }}>
            {busy ? "Joining…" : "Join the plan"}
          </button>
        </Glass>
      ) : q ? (
        <AnimatePresence mode="wait">
          <motion.div key={q.question.id}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: .3, ease: [.22, 1, .36, 1] }}>
            <Glass className="p-5">
              <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/10">
                <motion.div className="h-full rounded-full" style={{ background: "var(--grad-brand)" }}
                  animate={{ width: `${Math.min(96, (q.progress.answered / Math.max(1, q.progress.estimatedTotal)) * 100)}%` }}
                  transition={{ duration: .4 }} />
              </div>
              <p className="mb-1 text-[12px] text-white/35">Question {q.progress.answered + 1} of about {q.progress.estimatedTotal}</p>
              <h3 className="mb-4 text-[19px]">{q.question.text}</h3>
              <ParticipantAnswer q={q.question} busy={busy} onPick={(v) => answer(q.question.id, v)} />
            </Glass>
          </motion.div>
        </AnimatePresence>
      ) : (
        <Glass className="p-6 text-center">
          <PartyPopper className="mx-auto mb-2 h-8 w-8 text-[#C9C1FF]" />
          <p className="text-[16px] font-semibold">You're in.</p>
          <p className="mt-1 text-[13.5px] text-white/45">
            {status?.readyToPlan
              ? "Everyone's weighed in — the organizer can build the plan now."
              : status?.waitingOn?.length
                ? `Waiting on: ${status.waitingOn.join(", ")}`
                : "Waiting on the rest of the group."}
          </p>
        </Glass>
      )}

      <p className="mt-6 text-center text-[12px] text-white/25">
        Powered by Planzo — no account needed to answer.
      </p>
    </Shell>
  );
}

function ParticipantAnswer({ q, onPick, busy }: { q: any; onPick: (v: any) => void; busy: boolean }) {
  const [sel, setSel] = React.useState<string[]>([]);
  if (!q.multi) {
    return <SelectorChips options={q.options} value={[]} onChange={(v) => v[0] && onPick(v[0])} single />;
  }
  return (
    <>
      <SelectorChips options={q.options} value={sel} onChange={setSel} max={q.maxPicks || undefined} />
      {q.maxPicks && <p className="mt-2 text-[12px] text-white/35">Pick up to {q.maxPicks}</p>}
      <button disabled={!sel.length || busy} onClick={() => onPick(sel)}
        className="mt-4 w-full rounded-full py-3 text-[14.5px] font-semibold disabled:opacity-40"
        style={{ background: "var(--grad-brand)" }}>Continue</button>
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <div className="aurora">
        {["#7C6BFF", "#C026D3", "#6366F1"].map((c, i) => <i key={i} style={{ background: c }} />)}
      </div>
      <div className="grain" />
      <div className="relative z-10 mx-auto min-h-dvh w-full max-w-[480px] px-5 pb-10 pt-[calc(28px+var(--safe-t))]">
        {children}
      </div>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="space-y-3">
      <div className="skeleton h-[168px] rounded-[28px]" />
      <div className="skeleton h-[140px] rounded-[22px]" />
    </div>
  );
}
