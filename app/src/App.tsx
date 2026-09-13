"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home as HomeIcon, Compass, CalendarDays, Ticket, User } from "lucide-react";
import { AppleDock, AppleDockIcon } from "@/components/ui/apple-dock";
import { SelectorChips } from "@/components/ui/selector-chips";
import { Glass } from "@/components/ui/glass";
import { store, useStore } from "@/lib/store";
import { timeSlot, auroraFor } from "@/lib/greeting";
import Home from "@/screens/Home";
import Discover from "@/screens/Discover";
import Plans from "@/screens/Plans";
import Tickets from "@/screens/Tickets";
import Profile from "@/screens/Profile";
import Upgrade from "@/screens/Upgrade";

const TABS = [
  { id: "home",     label: "Home",     Icon: HomeIcon,     tint: "text-[#A5B4FC]" },
  { id: "discover", label: "Discover", Icon: Compass,      tint: "text-[#67E8F9]" },
  { id: "plans",    label: "Plans",    Icon: CalendarDays, tint: "text-[#C4B5FD]" },
  { id: "tickets",  label: "Tickets",  Icon: Ticket,       tint: "text-[#FDA4AF]" },
  { id: "profile",  label: "You",      Icon: User,         tint: "text-[#FCD34D]" },
] as const;

const ORDER = TABS.map(t => t.id) as readonly string[];

export default function App() {
  const me = useStore(s => s.me);
  const [tab, setTab] = React.useState("home");
  const [prev, setPrev] = React.useState("home");
  const [planFocus, setPlanFocus] = React.useState<string | undefined>();
  const [discoverArg, setDiscoverArg] = React.useState<any>();
  const slot = timeSlot();
  const tint = auroraFor(slot);

  const go = (next: string, arg?: any) => {
    setPrev(tab);
    if (next === "plans") setPlanFocus(typeof arg === "string" ? arg : undefined);
    if (next === "discover") setDiscoverArg(arg);
    setTab(next);
  };

  // Direction drives the slide, so moving right feels like moving right.
  const dir = ORDER.indexOf(tab) >= ORDER.indexOf(prev) ? 1 : -1;

  if (!me) return <Onboarding />;

  return (
    <div className="relative min-h-dvh">
      <Aurora tint={tint} />
      <div className="grain" />

      <main className="relative z-10 mx-auto min-h-dvh w-full max-w-[560px] pb-[calc(96px+var(--safe-b))]">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={tab}
            custom={dir}
            initial={{ opacity: 0, x: dir * 26, filter: "blur(6px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: dir * -22, filter: "blur(6px)" }}
            transition={{ duration: .34, ease: [.22, 1, .36, 1] }}
            // A settled screen must carry no filter/transform at all: either
            // one turns this into the containing block for any fixed child.
            onAnimationComplete={() => {
              const el = document.getElementById(`screen-${tab}`);
              if (el) { el.style.filter = "none"; el.style.transform = "none"; }
            }}
            id={`screen-${tab}`}
          >
            {tab === "home" && <Home go={go} />}
            {tab === "discover" && <Discover initial={discoverArg} go={go} />}
            {tab === "plans" && <Plans focus={planFocus} setFocus={setPlanFocus} go={go} />}
            {tab === "tickets" && <Tickets />}
            {tab === "profile" && <Profile go={go} />}
            {tab === "upgrade" && <Upgrade onBack={() => go(prev)} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(10px+var(--safe-b))]">
        <div className="glass w-full max-w-[420px] rounded-[26px]">
          <AppleDock iconSize={44} iconMagnification={62} iconDistance={120}>
            {TABS.map(({ id, label, Icon, tint: c }) => (
              <AppleDockIcon
                key={id}
                label={label}
                active={tab === id}
                onClick={() => go(id)}
                className={tab === id ? "bg-white/[.14]" : "hover:bg-white/[.07]"}
              >
                <Icon className={`h-[21px] w-[21px] ${tab === id ? c : "text-white/45"} transition-colors`}
                  strokeWidth={tab === id ? 2.3 : 1.9} />
              </AppleDockIcon>
            ))}
          </AppleDock>
        </div>
      </nav>
    </div>
  );
}

function Aurora({ tint }: { tint: string[] }) {
  return (
    <div className="aurora">
      {tint.map((c, i) => <i key={i} style={{ background: c }} />)}
      <i style={{ background: tint[1] }} />
    </div>
  );
}

const SEED_INTERESTS = ["Live music","Hip-Hop","Comedy","Sports","Festivals","Nightlife","Food","Outdoors","Theatre","Art"];

function Onboarding() {
  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState("");
  const [picks, setPicks] = React.useState<string[]>([]);
  const tint = auroraFor(timeSlot());

  return (
    <div className="relative min-h-dvh">
      <Aurora tint={tint} />
      <div className="grain" />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[460px] flex-col justify-center px-6 py-16">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="a" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }} transition={{ ease: [.22,1,.36,1], duration: .45 }}>
              <div className="mb-7 grid h-16 w-16 place-items-center rounded-[22px] text-[30px] font-bold"
                style={{ background: "var(--grad-brand)" }}>P</div>
              <h1 className="display mb-3">Planzo</h1>
              <p className="mb-9 text-[17px] leading-relaxed text-white/50">
                Send the idea.<br />We'll make the plan.
              </p>
              <label className="mb-2 block text-[13px] font-medium text-white/50">What's your name?</label>
              <input autoFocus value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && name.trim() && setStep(1)}
                placeholder="Ryan" enterKeyHint="next"
                className="glass mb-4 w-full rounded-2xl px-5 py-4 text-[16px] outline-none placeholder:text-white/25" />
              <button disabled={!name.trim()} onClick={() => setStep(1)}
                className="w-full rounded-full py-4 text-[16px] font-semibold transition-transform active:scale-[.98] disabled:opacity-40"
                style={{ background: "var(--grad-brand)" }}>Continue</button>
              <p className="mt-5 text-center text-[12px] leading-relaxed text-white/30">
                Google and email sign-in arrive with the hosted app.<br />
                Here everything stays on this device.
              </p>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="b" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }} transition={{ ease: [.22,1,.36,1], duration: .45 }}>
              <h1 className="mb-2 text-[30px]">What are you into?</h1>
              <p className="mb-7 text-[15px] text-white/45">
                Pick a few and Discover starts there. It keeps learning from what you actually choose.
              </p>
              <SelectorChips options={SEED_INTERESTS} value={picks} onChange={setPicks} />
              <button onClick={() => {
                  store.set({ interests: picks });
                  store.signIn(name.trim());
                }}
                className="mt-9 w-full rounded-full py-4 text-[16px] font-semibold transition-transform active:scale-[.98]"
                style={{ background: "var(--grad-brand)" }}>
                {picks.length ? "Let's go" : "Skip for now"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
