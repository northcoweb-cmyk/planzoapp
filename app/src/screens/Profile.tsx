"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, KeyRound, Brain, Trash2, MapPin, Check, Activity, ChevronDown, GraduationCap } from "lucide-react";
import { Glass, Sheet, Notice } from "@/components/ui/glass";
import { SelectorChips } from "@/components/ui/selector-chips";
import { store, useStore, requestLocation, originOrFallback } from "@/lib/store";
import { config, spendUsed, hasServer } from "@/lib/config";
import * as memoryEng from "@/lib/engine/memory.js";
import * as places from "@/lib/engine/places.js";
import * as ai from "@/lib/engine/ai.js";
import * as events from "@/lib/engine/events.js";
import Ops from "@/screens/Ops";

const INTERESTS = ["Live music","Hip-Hop","Rock","Pop","EDM","Comedy","Theatre","Sports",
  "Basketball","Football","Baseball","Festivals","Nightlife","Food","Coffee","Outdoors","Art","Film"];
const DIETARY = ["Vegetarian","Vegan","Gluten-free","Halal","Kosher","Nut allergy","Dairy-free"];
// Genres, specifically — a subset of INTERESTS Discover's Music category can
// gate on. Kept separate from INTERESTS itself so "Sports" etc. don't leak
// into genre filtering logic.
const MUSIC_GENRES = ["Hip-Hop", "Rock", "Pop", "EDM", "Live music"];

// Seed list — logos resolved live via Google's public favicon service
// (no key, no asset hosting) rather than bundling image files per school.
// Originally used Clearbit's logo API, which turned out to be unreliable
// after Clearbit's acquisition — Google's favicon endpoint has been a
// stable, widely-used public service for years. Add more here as Ryan
// sends the real list.
const COLLEGES = [
  { name: "University of Maryland", domain: "umd.edu" },
  { name: "Towson University", domain: "towson.edu" },
  { name: "University of Delaware", domain: "udel.edu" },
  { name: "Penn State", domain: "psu.edu" },
  { name: "University of Virginia", domain: "virginia.edu" },
  { name: "Virginia Tech", domain: "vt.edu" },
  { name: "George Mason University", domain: "gmu.edu" },
  { name: "Georgetown University", domain: "georgetown.edu" },
  { name: "George Washington University", domain: "gwu.edu" },
  { name: "American University", domain: "american.edu" },
  { name: "Howard University", domain: "howard.edu" },
  { name: "Rutgers University", domain: "rutgers.edu" },
  { name: "NYU", domain: "nyu.edu" },
  { name: "Temple University", domain: "temple.edu" },
  { name: "Ohio State University", domain: "osu.edu" },
];

export default function Profile({ go }: { go: (tab: string, arg?: any) => void }) {
  const me = useStore(s => s.me);
  const interests = useStore(s => s.interests);
  const dietary = useStore(s => s.dietary);
  const memory = useStore(s => s.memory);
  const college = useStore(s => s.college);
  const [keys, setKeys] = React.useState(false);
  const [ops, setOps] = React.useState(false);
  const [rememberOpen, setRememberOpen] = React.useState(false);
  const active = memoryEng.prune(memory) as any[];
  const spend = spendUsed();

  const services = [
    { k: "Events", on: events.enabled(), note: "Ticketmaster · free" },
    { k: "Weather", on: true, note: "Open-Meteo · free" },
    { k: "Planning engine", on: true, note: "runs on device · $0" },
    { k: "Venues & photos", on: places.enabled(), note: places.enabled() ? `${spend.places.used}/${spend.places.cap} today` : "add a key" },
    { k: "AI chat", on: ai.enabled(), note: ai.enabled() ? `${spend.openai.used}/${spend.openai.cap} today` : "add a key" },
  ];

  return (
    <div className="px-5 pb-4 pt-[calc(18px+var(--safe-t))]">
      <h1 className="display mb-5">You</h1>

      <Glass className="mb-4 p-5">
        <div className="flex items-center gap-3.5">
          <div className="grid h-14 w-14 place-items-center rounded-2xl text-[22px] font-bold"
            style={{ background: "var(--grad-brand)" }}>
            {me?.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[18px] font-semibold">{me?.name}</p>
            <p className="truncate text-[13px] text-white/40">{me?.email || "Local profile"}</p>
          </div>
        </div>
        <button onClick={() => requestLocation(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[.05] py-3 text-[14px] font-medium transition-colors hover:bg-white/10">
          <MapPin className="h-4 w-4" /> {originOrFallback().label}
        </button>
      </Glass>

      <Card title="What you're into" sub="Discover ranks around these">
        <SelectorChips options={INTERESTS} value={interests} size="sm"
          onChange={(v) => store.set({ interests: v })} />
      </Card>

      <Card title="Dietary" sub="A hard constraint — it binds every plan you're in">
        <SelectorChips options={DIETARY} value={dietary} size="sm"
          onChange={(v) => {
            store.set({ dietary: v });
            v.forEach(d => store.remember("dietary", d));
          }} />
      </Card>

      <Glass className="mb-4 p-5">
        <button onClick={() => setRememberOpen(v => !v)}
          className="flex w-full items-center justify-between text-left">
          <div>
            <h4 className="text-[16px]">What Planzo remembers</h4>
            {!rememberOpen && (
              <p className="mt-1 text-[12.5px] text-white/40">
                {active.length === 0 ? "Nothing yet" : `${active.length} thing${active.length === 1 ? "" : "s"} — tap to view`}
              </p>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${rememberOpen ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence initial={false}>
          {rememberOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: .25, ease: [.22, 1, .36, 1] }} className="overflow-hidden"
            >
              <p className="mb-3.5 mt-3 text-[12.5px] leading-relaxed text-white/40">
                Stable preferences last. A one-off stays with that plan and never becomes who you are.
              </p>
              {active.length === 0 ? (
                <p className="text-[13.5px] text-white/35">Nothing yet — it learns from the plans you actually make.</p>
              ) : (
                <div className="space-y-2">
                  {active.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px]">{m.value}</p>
                        <p className="text-[11.5px] text-white/35">
                          {m.category} · {m.stability} · {m.source} · {Math.round(m.confidence * 100)}%
                        </p>
                      </div>
                      <button onClick={() => store.forget(m.id)}
                        className="shrink-0 rounded-full p-2 text-white/25 transition-colors hover:text-red-300">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Glass>

      <Card title="Your college" sub="Unlocks school-linked events in Social">
        <div className="grid grid-cols-3 gap-2.5">
          {COLLEGES.map(c => (
            <button key={c.domain} onClick={() => store.set({ college: college === c.name ? null : c.name })}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-colors ${
                college === c.name ? "border-white/30 bg-white/[.10]" : "border-white/10 bg-white/[.03] hover:bg-white/[.06]"}`}>
              <img src={`https://www.google.com/s2/favicons?sz=64&domain=${c.domain}`} alt=""
                className="h-8 w-8 rounded-lg object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <span className="line-clamp-2 text-[10.5px] leading-tight text-white/70">{c.name}</span>
            </button>
          ))}
        </div>
        {college && (
          <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-white/50">
            <GraduationCap className="h-3.5 w-3.5" /> Connected to {college}
          </p>
        )}
      </Card>

      {!hasServer && (
        <Card title="What's connected">
          <div className="space-y-2">
            {services.map(s => (
              <div key={s.k} className="flex items-center justify-between text-[13.5px]">
                <span className="text-white/55">{s.k}</span>
                <span className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${s.on ? "bg-emerald-400" : "bg-white/20"}`} />
                  <span className={s.on ? "text-white/70" : "text-white/30"}>{s.note}</span>
                </span>
              </div>
            ))}
          </div>
          <button onClick={() => setKeys(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[.05] py-3 text-[14px] font-medium transition-colors hover:bg-white/10">
            <KeyRound className="h-4 w-4" /> API keys
          </button>
        </Card>
      )}

      {hasServer && (
        <Card title="Live ops" sub="Real-time system health and cost tracking">
          <button onClick={() => setOps(true)}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[.05] py-3 text-[14px] font-medium transition-colors hover:bg-white/10">
            <Activity className="h-4 w-4" /> Costs & activity
          </button>
        </Card>
      )}

      {/* Clicking Upgrade anywhere in the app — here or in the chat input's
          tier picker — pushes the same real Upgrade page. It used to open
          a separate small sheet here that undercut its own pitch ("every
          Pro feature is already built for free"), which is exactly the
          opposite of making Pro worth paying for. */}
      <Glass className="mb-4 overflow-hidden p-0">
        <div className="p-5" style={{ background: "linear-gradient(135deg, rgba(99,102,241,.22), rgba(192,38,211,.18))" }}>
          <div className="mb-3 flex items-center gap-2">
            <h4 className="flex items-center gap-2 text-[17px]"><Sparkles className="h-4 w-4 text-[#C9C1FF]" /> Planzo Pro</h4>
          </div>
          <div className="space-y-1.5">
            {["Unlimited group size (free plans top out at 8)", "Deep planning mode — a wider search and real alternatives, not just the top pick", "Priority support as more lands"].map(f => (
              <p key={f} className="flex items-center gap-2 text-[13.5px] text-white/75">
                <Check className="h-3.5 w-3.5 text-[#C9C1FF]" /> {f}
              </p>
            ))}
          </div>
          <button onClick={() => go("upgrade")}
            className="mt-4 w-full rounded-full py-3.5 text-[15px] font-semibold"
            style={{ background: "var(--grad-brand)" }}>See what you get</button>
        </div>
      </Glass>

      <button onClick={() => { if (confirm("Delete everything stored on this device?")) store.reset(); }}
        className="w-full py-3 text-[13.5px] text-white/25 transition-colors hover:text-red-300">
        Clear all local data
      </button>

      <AnimatePresence>
        {keys && <Sheet open onClose={() => setKeys(false)} title="API keys"><Keys onDone={() => setKeys(false)} /></Sheet>}
        {ops && <Sheet open onClose={() => setOps(false)} title="Live ops"><Ops onDone={() => setOps(false)} /></Sheet>}
      </AnimatePresence>
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <Glass className="mb-4 p-5">
      <h4 className="mb-1 text-[16px]">{title}</h4>
      {sub && <p className="mb-3.5 text-[12.5px] leading-relaxed text-white/40">{sub}</p>}
      {children}
    </Glass>
  );
}

function Keys({ onDone }: { onDone: () => void }) {
  const [places_, setPlaces] = React.useState(config.get().places);
  const [openai, setOpenai] = React.useState(config.get().openai);
  return (
    <div className="space-y-4">
      <Notice>
        These stay in this browser and are sent straight to Google and OpenAI — never to us.
        Both are billable, which is why they aren't shipped inside this file. There's a hard
        daily call cap either way.
      </Notice>
      <label className="block">
        <span className="mb-1.5 block text-[12.5px] font-medium text-white/50">Google Places key</span>
        <input value={places_} onChange={e => setPlaces(e.target.value)} placeholder="AIza…"
          autoCapitalize="off" spellCheck={false}
          className="glass w-full rounded-2xl px-4 py-3.5 font-mono text-[13px] outline-none placeholder:text-white/25" />
        <span className="mt-1 block text-[11.5px] text-white/30">Restaurant search and one exterior photo per venue.</span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[12.5px] font-medium text-white/50">OpenAI key</span>
        <input value={openai} onChange={e => setOpenai(e.target.value)} placeholder="sk-proj-…"
          autoCapitalize="off" spellCheck={false}
          className="glass w-full rounded-2xl px-4 py-3.5 font-mono text-[13px] outline-none placeholder:text-white/25" />
        <span className="mt-1 block text-[11.5px] text-white/30">
          gpt-4.1-nano · about $0.000023 a message. Planning works without it.
        </span>
      </label>
      <button onClick={() => { config.set({ places: places_.trim(), openai: openai.trim() }); onDone(); }}
        className="w-full rounded-full py-3.5 text-[15px] font-semibold" style={{ background: "var(--grad-brand)" }}>
        Save
      </button>
    </div>
  );
}
