"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Sparkles, Check, Lock, Users, CalendarRange, Brain,
  History, Ticket as TicketIcon, Zap, Mail,
} from "lucide-react";
import { Glass } from "@/components/ui/glass";
import { store, useStore } from "@/lib/store";
import * as api from "@/lib/api";

type FeatureId = "groupSize" | "multiDay" | "memory" | "history" | "hosting" | "priority";

const FEATURES: { id: FeatureId; icon: any; title: string; free: string; pro: string }[] = [
  { id: "groupSize", icon: Users, title: "Group size", free: "Up to 8 people", pro: "Any size, no cap" },
  { id: "multiDay", icon: CalendarRange, title: "Trip length", free: "One day", pro: "Multi-day trips" },
  { id: "memory", icon: Brain, title: "Group memory", free: "This plan only", pro: "Remembers everyone's tastes across plans" },
  { id: "history", icon: History, title: "Plan history", free: "Last 2 plans", pro: "Everything, forever" },
  { id: "hosting", icon: TicketIcon, title: "Event hosting", free: "Not included", pro: "Host public events + free ticketing" },
  { id: "priority", icon: Zap, title: "Planning speed", free: "Standard queue", pro: "Priority" },
];

export default function Upgrade({ onBack }: { onBack: () => void }) {
  const me = useStore(s => s.me);
  const [view, setView] = React.useState<"free" | "pro">("pro");
  const [email, setEmail] = React.useState(me?.email || "");
  const [status, setStatus] = React.useState<"idle" | "busy" | "done" | "error">("idle");
  const [position, setPosition] = React.useState<number | null>(null);
  const [alreadyOn, setAlreadyOn] = React.useState(false);

  const join = async () => {
    if (!me || !email.trim() || status === "busy") return;
    setStatus("busy");
    const r = await api.joinWaitlist({ name: me.name, email: email.trim(), source: "upgrade_page" });
    if (!r) { setStatus("error"); return; }
    setPosition(r.position); setAlreadyOn(r.alreadyOnList); setStatus("done");
  };

  return (
    <div className="px-5 pb-4 pt-[calc(18px+var(--safe-t))]">
      <button onClick={onBack} className="mb-5 flex items-center gap-1.5 text-[14px] font-medium text-white/50 transition-colors hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45, ease: [.22, 1, .36, 1] }}>
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-[20px]" style={{ background: "var(--grad-brand)" }}>
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="display mb-2">Planzo Pro</h1>
        <p className="mb-6 text-[15px] leading-relaxed text-white/50">
          Everything Free does, plus the tools for bigger groups and longer trips.
        </p>
      </motion.div>

      {/* Interactive Free/Pro toggle — flip it and the whole feature list
          morphs to show what changes, instead of a static side-by-side
          table nobody actually reads line by line. */}
      <div className="glass mb-6 flex rounded-full p-1">
        {(["free", "pro"] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`relative flex-1 rounded-full py-2.5 text-[13.5px] font-semibold transition-colors ${view === v ? "text-white" : "text-white/40 hover:text-white/65"}`}>
            {view === v && (
              <motion.div layoutId="upgrade-toggle" className="absolute inset-0 rounded-full"
                style={{ background: v === "pro" ? "var(--grad-brand)" : "rgba(255,255,255,.10)" }}
                transition={{ type: "spring", stiffness: 500, damping: 38 }} />
            )}
            <span className="relative">{v === "free" ? "Free" : "Pro"}</span>
          </button>
        ))}
      </div>

      <div className="mb-6 space-y-2.5">
        <AnimatePresence mode="popLayout">
          {FEATURES.map((f, i) => (
            <motion.div key={f.id + view} layout
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: .3, delay: i * .03, ease: [.22, 1, .36, 1] }}
            >
              <Glass className="flex items-center gap-3.5 p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl"
                  style={{ background: view === "pro" ? "var(--grad-brand)" : "rgba(255,255,255,.08)" }}>
                  <f.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold">{f.title}</p>
                  <p className="mt-0.5 text-[12.5px] text-white/45">{view === "pro" ? f.pro : f.free}</p>
                </div>
                {view === "pro"
                  ? <Check className="h-4 w-4 shrink-0 text-[#C9C1FF]" />
                  : <Lock className="h-3.5 w-3.5 shrink-0 text-white/25" />}
              </Glass>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* No price shown here — there's no payment provider connected yet
          (Profile's small Pro card says the same). Pretending to charge a
          real card for a feature that can't actually be billed would be
          dishonest, so the CTA is a real signup instead: an actual row in
          the waitlist backend (server/routes.js's /waitlist, the same one
          the marketing site uses), with a real queue position handed back. */}
      <Glass className="p-5">
        {status === "done" ? (
          <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full" style={{ background: "var(--grad-brand)" }}>
              <Check className="h-5 w-5" />
            </div>
            <p className="text-[15px] font-semibold">
              {alreadyOn ? "You're already on the list" : "You're on the list"}
            </p>
            {position != null && (
              <p className="mt-1 text-[13px] text-white/45">Position #{position} — we'll email you the moment Pro opens up.</p>
            )}
          </motion.div>
        ) : (
          <>
            <p className="mb-1 text-[15px] font-semibold">Get early access</p>
            <p className="mb-4 text-[13px] text-white/45">
              Pro is still being built. Join the waitlist and you'll be first in line when it opens.
            </p>
            <div className="glass mb-3 flex items-center gap-2.5 rounded-full px-4 py-3">
              <Mail className="h-4 w-4 shrink-0 text-white/35" />
              <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                placeholder="you@email.com" enterKeyHint="done"
                onKeyDown={e => e.key === "Enter" && join()}
                className="w-full bg-transparent text-[14px] outline-none placeholder:text-white/30" />
            </div>
            {status === "error" && (
              <p className="mb-3 text-[12.5px] text-red-300">Couldn't reach the waitlist right now — try again in a moment.</p>
            )}
            <button onClick={join} disabled={!email.trim() || status === "busy"}
              className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-semibold text-white transition-transform active:scale-[.98] disabled:opacity-40"
              style={{ background: "var(--grad-brand)" }}>
              {status === "busy" ? "Joining…" : <>Join the waitlist <Sparkles className="h-4 w-4" /></>}
            </button>
          </>
        )}
      </Glass>

      <p className="mt-4 text-center text-[12px] text-white/25">
        Multi-day trips and event hosting are already live — try them from any plan today.
      </p>
    </div>
  );
}
