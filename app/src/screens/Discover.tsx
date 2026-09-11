"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Ticket as TicketIcon, ExternalLink, MapPin, Calendar, Sparkles } from "lucide-react";
import { Glass, Pill, Img, Sheet, Notice } from "@/components/ui/glass";
import { SelectorChips } from "@/components/ui/selector-chips";
import { store, useStore, originOrFallback, type Plan } from "@/lib/store";
import * as events from "@/lib/engine/events.js";
import * as places from "@/lib/engine/places.js";
import * as memoryEng from "@/lib/engine/memory.js";
import { fmtDate } from "./Home";

const CATS = ["For you", "Music", "Comedy", "Sports", "Theatre"] as const;

/** Things to do that aren't ticketed events or restaurants — each maps to a
 * tuned Places text query plus the verb/category used to build the idea and
 * detail sheet. Places is a business/POI search, so results are real
 * locations (a park, a trail head, a beach) with real addresses — not
 * curated trail data (no mileage/difficulty). Good enough to start a plan
 * from; not a trail app. */
const ACTIVITIES: Record<string, { query: string; verb: string; noun: string; emoji: string }> = {
  Hike:    { query: "hiking trail nature park", verb: "Go hiking at", noun: "trail", emoji: "🥾" },
  Picnic:  { query: "park picnic area", verb: "Have a picnic at", noun: "picnic spot", emoji: "🧺" },
  Swim:    { query: "public swimming lake beach pool", verb: "Go swimming at", noun: "swim spot", emoji: "🏊" },
};
type Kind = "event" | "restaurant" | "activity";

/** Build and save a plan directly from a known event/restaurant/activity
 * instead of routing it through the free-text intent parser — we already
 * know exactly what this is, so guessing at it from a sentence would only
 * lose accuracy and burn AI spend for nothing. */
function seedPlanFrom(item: any, kind: Kind, me: { id: string; name: string }, activityKey?: string): Plan {
  const title = kind === "event" ? item.title : item.name;
  const act = kind === "activity" && activityKey ? ACTIVITIES[activityKey] : null;
  const idea = kind === "event" ? `Go to ${title}` : kind === "restaurant" ? `Eat at ${title}` : `${act?.verb ?? "Go to"} ${title}`;
  const categories = kind === "event" ? [item.genre || item.category || "event"]
    : kind === "restaurant" ? ["food"] : ["outdoors", activityKey?.toLowerCase() ?? "activity"];
  return {
    id: crypto.randomUUID().slice(0, 8),
    idea, title,
    intent: {
      title, categories,
      needsFood: kind === "restaurant",
      confidence: 1,
      source: "seeded_from_" + kind,
      seed: kind === "event"
        ? { kind, providerId: item.providerId, venue: item.venue, date: item.date, address: item.address }
        : { kind, providerId: item.providerId, name: item.name, address: item.address, activityKey },
    },
    origin: originOrFallback(),
    participants: [{ id: me.id, name: me.name, answers: {}, isCreator: true }],
    finalPlan: null, createdAt: new Date().toISOString(),
  };
}

export default function Discover({ initial, go }: { initial?: any; go?: (tab: string, arg?: any) => void }) {
  const interests = useStore(s => s.interests);
  const memory = useStore(s => s.memory);
  const viewed = useStore(s => s.viewed);
  const me = useStore(s => s.me);
  const [cat, setCat] = React.useState<string>("For you");
  const [q, setQ] = React.useState("");
  const [rawEvents, setRawEvents] = React.useState<any[] | null>(null);
  const [open, setOpen] = React.useState<any>(initial ?? null);
  const [openVenue, setOpenVenue] = React.useState<any>(null);
  const [venues, setVenues] = React.useState<any[] | null>(null);
  const [openActivity, setOpenActivity] = React.useState<any>(null);
  const [activityKey, setActivityKey] = React.useState<string | null>(null);
  const [activityResults, setActivityResults] = React.useState<any[] | null>(null);

  React.useEffect(() => {
    let dead = false;
    setRawEvents(null);
    (async () => {
      const o = originOrFallback();
      const map: Record<string, string | undefined> = {
        "For you": undefined, Music: "concert", Comedy: "comedy", Sports: "sports", Theatre: "theatre",
      };
      const today = new Date().toISOString().slice(0, 10);
      const [er, pr] = await Promise.all([
        events.search({
          lat: o.lat, lon: o.lon, radiusMiles: 30, category: map[cat],
          keyword: q || undefined, limit: 30, startDate: today,
        }),
        // Restaurants are folded in under the events feed, not a separate tab —
        // fetched alongside events on every category so they're always there.
        places.search({ query: q || "restaurants", lat: o.lat, lon: o.lon, limit: 10 }),
      ]);
      if (dead) return;
      // Belt and suspenders: even with startDate sent, a cached response can
      // outlive the day it was fetched on and start showing stale past events.
      setRawEvents(er.available ? er.events.filter((e: any) => !e.date || e.date >= today) : []);
      setVenues(pr.available ? pr.places : []);
    })();
    return () => { dead = true; };
  }, [cat, q]);

  // Activities are opt-in (pick Hike/Picnic/Swim) rather than always-on like
  // restaurants, so a Discover load never spends more Places budget than the
  // user actually asked for.
  React.useEffect(() => {
    if (!activityKey) { setActivityResults(null); return; }
    let dead = false;
    setActivityResults(null);
    (async () => {
      const o = originOrFallback();
      const ar = await places.search({ query: ACTIVITIES[activityKey].query, lat: o.lat, lon: o.lon, limit: 10 });
      if (dead) return;
      setActivityResults(ar.available ? ar.places : []);
    })();
    return () => { dead = true; };
  }, [activityKey]);

  // Re-rank in place as interests/memory/click-history change, without
  // re-hitting the network for the same raw event list. On "For you"
  // specifically, explicit interests actually FILTER now, not just sort —
  // picking Food + Sports used to still show plays and concerts, just
  // ranked slightly lower, which isn't what "only show me this" means.
  const list = React.useMemo(() => {
    if (!rawEvents) return null;
    const ranked = rank(rawEvents, interests, memory, viewed);
    if (cat !== "For you" || interests.length === 0) return ranked;
    const filtered = filterToInterests(ranked, interests);
    // Never leave the screen empty over a mismatch (e.g. "Food" has no
    // ticketed-event equivalent) — fall back to the ranked, unfiltered list.
    return filtered.length > 0 ? filtered : ranked;
  }, [rawEvents, interests, memory, viewed, cat]);

  const startIdea = (item: any, kind: Kind, actKey?: string) => {
    if (!me) return;
    store.trackView({
      id: item.providerId, kind,
      title: kind === "event" ? item.title : item.name,
      category: kind === "event" ? (item.genre || item.category) : kind === "restaurant" ? "restaurant" : actKey,
      at: new Date().toISOString(),
    });
    const plan = seedPlanFrom(item, kind, me, actKey);
    store.savePlan(plan);
    store.say({
      role: "planzo",
      text: `Started a plan around ${plan.title.toLowerCase()} — answer a couple quick questions and I'll work out the rest.`,
      at: new Date().toISOString(), planId: plan.id,
    });
    setOpen(null); setOpenVenue(null); setOpenActivity(null);
    go?.("plans", plan.id);
  };

  const trackViewOnly = (item: any, kind: Kind, actKey?: string) => {
    store.trackView({
      id: item.providerId, kind,
      title: kind === "event" ? item.title : item.name,
      category: kind === "event" ? (item.genre || item.category) : kind === "restaurant" ? "restaurant" : actKey,
      at: new Date().toISOString(),
    });
  };

  return (
    <div className="px-5 pb-4 pt-[calc(18px+var(--safe-t))]">
      <h1 className="display mb-1">Discover</h1>
      <p className="mb-4 text-[14px] text-white/45">
        {cat === "For you" && interests.length > 0
          ? `Ranked around ${interests.slice(0, 2).join(" and ").toLowerCase()}`
          : "Real events near you, straight from the box office"}
      </p>

      <Glass className="mb-4 flex items-center gap-2.5 rounded-full px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-white/35" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search artists, teams, shows…"
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-white/30"
        />
      </Glass>

      <div className="no-bar edge-fade -mx-5 mb-5 flex gap-2 overflow-x-auto px-5">
        {CATS.map(c => (
          <button key={c} onClick={() => setCat(c)}
            className={`relative shrink-0 rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors ${
              cat === c ? "text-white" : "text-white/45 hover:text-white/75"}`}>
            {cat === c && (
              <motion.span layoutId="cat-pill" className="absolute inset-0 rounded-full"
                style={{ background: "var(--grad-brand)" }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }} />
            )}
            <span className="relative">{c}</span>
          </button>
        ))}
      </div>

      {list === null && (
        <div className="grid grid-cols-2 gap-3">
          {[0,1,2,3].map(i => <div key={i} className="skeleton h-[210px] rounded-[22px]" />)}
        </div>
      )}

      {list && list.length === 0 && (
        <Notice>No events came back for that. Try a different category or clear the search.</Notice>
      )}

      {list && list.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {list.map((e, i) => (
            <motion.button
              key={e.providerId}
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * .04, duration: .45, ease: [.22,1,.36,1] }}
              onClick={() => { trackViewOnly(e, "event"); setOpen(e); }} className="text-left"
            >
              <Glass className="h-full overflow-hidden p-0 transition-transform active:scale-[.98]">
                <Img src={e.imageUrl} alt={e.title} ratio="4/3" />
                <div className="p-3">
                  <p className="mb-1 truncate text-[10px] font-bold uppercase tracking-wider text-[#C9C1FF]">
                    {e.genre || e.category}
                  </p>
                  <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug">{e.title}</p>
                  <p className="mt-1.5 truncate text-[11.5px] text-white/45">{fmtDate(e.date)}</p>
                  {e.priceAvailable && (
                    <p className="mt-1 text-[11.5px] font-semibold text-white/70">from ${Math.round(e.priceMin)}</p>
                  )}
                </div>
              </Glass>
            </motion.button>
          ))}
        </div>
      )}

      {/* Restaurants live under the events feed, not as a separate tab —
          a place to eat near whatever you're doing, not its own category. */}
      {venues && venues.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-[15px] font-semibold">Nearby restaurants</h3>
          <div className="space-y-3">
            {venues.map((v, i) => (
              <VenueCard key={v.providerId} v={v} i={i} onClick={() => { trackViewOnly(v, "restaurant"); setOpenVenue(v); }} />
            ))}
          </div>
        </div>
      )}
      {venues && venues.length === 0 && (
        <div className="mt-6">
          <Notice>
            Restaurant search needs a Google Places key — add one in <strong>You → Settings</strong>.
            Until then nothing is listed here rather than guessed.
          </Notice>
        </div>
      )}

      {/* Things to do beyond ticketed events — opt-in via chips since these
          spend Places budget only when actually asked for. */}
      <div className="mt-6">
        <h3 className="mb-3 text-[15px] font-semibold">Something outdoors?</h3>
        <div className="no-bar edge-fade -mx-5 mb-3 flex gap-2 overflow-x-auto px-5">
          {Object.keys(ACTIVITIES).map(k => (
            <button key={k} onClick={() => setActivityKey(activityKey === k ? null : k)}
              className={`shrink-0 rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors ${
                activityKey === k ? "text-white" : "border border-white/10 bg-white/[.06] text-white/60 hover:text-white/85"}`}
              style={activityKey === k ? { background: "var(--grad-brand)" } : undefined}>
              {ACTIVITIES[k].emoji} {k}
            </button>
          ))}
        </div>

        {activityKey && activityResults === null && (
          <div className="space-y-3">
            {[0, 1].map(i => <div key={i} className="skeleton h-[92px] rounded-[22px]" />)}
          </div>
        )}
        {activityKey && activityResults && activityResults.length === 0 && (
          <Notice>
            No {ACTIVITIES[activityKey].noun}s came back nearby. Google Places needs a key set
            (<strong>You → Settings</strong>) to search this at all.
          </Notice>
        )}
        {activityKey && activityResults && activityResults.length > 0 && (
          <div className="space-y-3">
            {activityResults.map((v, i) => (
              <VenueCard key={v.providerId} v={v} i={i}
                onClick={() => { trackViewOnly(v, "activity", activityKey); setOpenActivity(v); }} />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {open && <EventSheet e={open} onClose={() => setOpen(null)} onStartIdea={() => startIdea(open, "event")} />}
        {openVenue && <VenueSheet v={openVenue} onClose={() => setOpenVenue(null)} onStartIdea={() => startIdea(openVenue, "restaurant")} />}
        {openActivity && activityKey && (
          <VenueSheet v={openActivity} label={ACTIVITIES[activityKey].noun.replace(/^./, c => c.toUpperCase())}
            onClose={() => setOpenActivity(null)}
            onStartIdea={() => startIdea(openActivity, "activity", activityKey)} />
        )}
      </AnimatePresence>
    </div>
  );
}

/** One photo per venue, fetched lazily and cached forever against the place id. */
function VenueCard({ v, i, onClick }: { v: any; i: number; onClick?: () => void }) {
  const [photo, setPhoto] = React.useState<string | null>(null);
  React.useEffect(() => { places.photoFor(v, 400).then(setPhoto); }, [v]);
  return (
    <motion.button onClick={onClick} className="block w-full text-left"
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .04 }}>
      <Glass className="flex gap-3 overflow-hidden p-0 transition-transform active:scale-[.98]">
        <Img src={photo} alt={v.name} ratio="1/1" className="w-[104px] shrink-0" />
        <div className="min-w-0 flex-1 py-3 pr-3">
          <p className="truncate text-[14.5px] font-semibold">{v.name}</p>
          <p className="mt-0.5 truncate text-[12px] text-white/45">{v.address}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {v.rating && <Pill>★ {v.rating}</Pill>}
            {v.priceLevel && <Pill>{"$".repeat(Math.max(1, ["PRICE_LEVEL_FREE","PRICE_LEVEL_INEXPENSIVE","PRICE_LEVEL_MODERATE","PRICE_LEVEL_EXPENSIVE","PRICE_LEVEL_VERY_EXPENSIVE"].indexOf(v.priceLevel)))}</Pill>}
            {v.openNow === true && <Pill className="!text-emerald-300">Open now</Pill>}
          </div>
        </div>
      </Glass>
    </motion.button>
  );
}

function VenueSheet({ v, onClose, onStartIdea, label = "Restaurant" }: { v: any; onClose: () => void; onStartIdea: () => void; label?: string }) {
  const [photo, setPhoto] = React.useState<string | null>(null);
  React.useEffect(() => { places.photoFor(v, 800).then(setPhoto); }, [v]);
  return (
    <Sheet open onClose={onClose}>
      <div className="-mx-5 -mt-5 mb-4">
        <Img src={photo} alt={v.name} ratio="16/9" className="rounded-t-[34px]" />
      </div>
      <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#C9C1FF]">{label}</p>
      <h2 className="text-[24px] leading-tight">{v.name}</h2>

      <div className="mt-4 space-y-2.5 text-[14px]">
        <Row icon={<MapPin className="h-4 w-4" />}>{v.address}</Row>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {v.rating && <Pill>★ {v.rating}{v.ratingCount ? ` (${v.ratingCount})` : ""}</Pill>}
        {v.priceLevel && <Pill>{"$".repeat(Math.max(1, ["PRICE_LEVEL_FREE","PRICE_LEVEL_INEXPENSIVE","PRICE_LEVEL_MODERATE","PRICE_LEVEL_EXPENSIVE","PRICE_LEVEL_VERY_EXPENSIVE"].indexOf(v.priceLevel)))}</Pill>}
        {v.openNow === true && <Pill className="!text-emerald-300">Open now</Pill>}
      </div>

      <div className="mt-5 flex gap-2.5">
        <button onClick={onStartIdea}
          className="flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-semibold text-white transition-transform active:scale-[.98]"
          style={{ background: "var(--grad-brand)" }}>
          <Sparkles className="h-4 w-4" /> Start an idea with this
        </button>
        {v.website && (
          <a href={v.website} target="_blank" rel="noopener"
            className="glass grid place-items-center rounded-full px-4 transition-transform active:scale-[.98]">
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    </Sheet>
  );
}

function EventSheet({ e, onClose, onStartIdea }: { e: any; onClose: () => void; onStartIdea?: () => void }) {
  return (
    <Sheet open onClose={onClose}>
      <div className="-mx-5 -mt-5 mb-4">
        <Img src={e.imageUrl} alt={e.title} ratio="16/9" className="rounded-t-[34px]" />
      </div>
      <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#C9C1FF]">
        {e.genre || e.category}
      </p>
      <h2 className="text-[24px] leading-tight">{e.title}</h2>

      <div className="mt-4 space-y-2.5 text-[14px]">
        <Row icon={<Calendar className="h-4 w-4" />}>
          {fmtDate(e.date)}{e.time ? ` · ${fmt12(e.time)}` : e.timeTbd ? " · time TBA" : ""}
        </Row>
        {e.venue && <Row icon={<MapPin className="h-4 w-4" />}>{e.venue}{e.address ? ` · ${e.address}` : ""}</Row>}
        <Row icon={<TicketIcon className="h-4 w-4" />}>
          {e.priceAvailable
            ? `$${Math.round(e.priceMin)}${e.priceMax > e.priceMin ? `–$${Math.round(e.priceMax)}` : ""}`
            : "Price not listed"}
          {e.ageRestriction && ` · ${e.ageRestriction}`}
        </Row>
      </div>

      {!e.priceAvailable && (
        <div className="mt-4">
          <Notice>Ticketmaster doesn't publish a price for this one, so we're not showing one. The official page will have it.</Notice>
        </div>
      )}

      <div className="mt-5 flex gap-2.5">
        <button onClick={onStartIdea}
          className="flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-semibold text-white transition-transform active:scale-[.98]"
          style={{ background: "var(--grad-brand)" }}>
          <Sparkles className="h-4 w-4" /> Start an idea with this
        </button>
        <a href={e.officialUrl} target="_blank" rel="noopener"
          className="glass grid place-items-center rounded-full px-4 transition-transform active:scale-[.98]">
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
      <p className="mt-3 text-center text-[12px] text-white/35">
        Opens Ticketmaster. Planzo doesn't resell or issue tickets for events it doesn't host.
      </p>
    </Sheet>
  );
}

const Row = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex items-start gap-2.5 text-white/70">
    <span className="mt-0.5 shrink-0 text-white/35">{icon}</span><span>{children}</span>
  </div>
);

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${ap}`;
}

/**
 * Actually exclude events outside the person's stated interests, rather than
 * just nudging them down the list. Matches loosely (either string contains
 * the other) since Ticketmaster's genres ("Rock", "Hip-Hop") and Planzo's
 * onboarding interests ("Live music", "Hip-Hop") don't share one vocabulary.
 */
function filterToInterests(list: any[], interests: string[]) {
  const liked = interests.map(s => s.toLowerCase()).filter(Boolean);
  if (!liked.length) return list;
  return list.filter(e => {
    const genreWords = `${e.genre || ""} ${e.category || ""}`.toLowerCase().split(/\s+/).filter(Boolean);
    const hay = `${e.genre || ""} ${e.category || ""} ${e.title || ""}`.toLowerCase();
    return liked.some(k => hay.includes(k) || genreWords.some(w => k.includes(w) && w.length > 2));
  });
}

/**
 * Rank by what this person actually engages with, not just by date.
 * Learned food/activity memory, explicit interests, and what they've actually
 * clicked into before all feed in; without any signal, order is chronological.
 */
function rank(list: any[], interests: string[], memory: any[], viewed: any[] = []) {
  const active = memoryEng.active(memory) as any[];
  const liked = new Set([
    ...interests.map(s => s.toLowerCase()),
    ...active.filter(m => m.confidence >= .5).map(m => String(m.value).toLowerCase()),
  ]);
  const clickedCats = new Set(
    (viewed || [])
      .filter(v => v.kind === "event" && v.category)
      .map(v => String(v.category).toLowerCase()),
  );
  const clickedIds = new Set((viewed || []).map(v => v.id));
  if (!liked.size && !clickedCats.size && !clickedIds.size) return list;
  return [...list].sort((a, b) => score(b) - score(a));
  function score(e: any) {
    const hay = `${e.genre} ${e.category} ${e.title}`.toLowerCase();
    let s = 0;
    for (const k of liked) if (k && hay.includes(k)) s += 3;
    const cat = String(e.genre || e.category || "").toLowerCase();
    if (cat && clickedCats.has(cat)) s += 2;
    if (clickedIds.has(e.providerId)) s -= 1; // already seen — nudge fresh stuff up instead
    if (e.imageUrl) s += .5;
    if (e.priceAvailable) s += .25;
    return s;
  }
}
