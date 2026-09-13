"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, ArrowRight, CloudSun, Users, Plus, Check, Ticket as TicketIcon, Globe2, Lock } from "lucide-react";
import { PromptInput } from "@/components/ui/ai-chat-input";
import { Glass, Pill, Img, Sheet, Notice } from "@/components/ui/glass";
import { VenueGridCard, VenueSheet, PRICE_LEVELS } from "@/components/ui/venue-card";
import { store, useStore, originOrFallback, requestLocation, type Plan } from "@/lib/store";
import { timeSlot, greetingFor } from "@/lib/greeting";
import { ACTIVITIES, inSeason, startIdea, trackViewOnly } from "@/lib/seed";
import * as intent from "@/lib/engine/intent.js";
import * as events from "@/lib/engine/events.js";
import * as places from "@/lib/engine/places.js";
import * as weather from "@/lib/engine/weather.js";
import * as consensus from "@/lib/engine/consensus.js";
import * as api from "@/lib/api";

// Google returns a generic "restaurant"/"food"/"point_of_interest" bucket
// alongside a specific type when it has one (e.g. "italian_restaurant").
// This picks that specific type and turns it into a readable cuisine label
// instead of inventing a classifier — a place with no specific type just
// has no cuisine chip, which is honest.
const GENERIC_TYPES = new Set(["restaurant", "food", "point_of_interest", "establishment", "meal_takeaway", "meal_delivery"]);
function cuisineOf(v: any): string | null {
  const t = (v.types || []).find((x: string) => x.endsWith("_restaurant") && !GENERIC_TYPES.has(x));
  if (!t) return null;
  return t.replace(/_restaurant$/, "").replace(/_/g, " ").replace(/^./, (c: string) => c.toUpperCase());
}

export default function Home({ go }: { go: (tab: string, arg?: any) => void }) {
  const me = useStore(s => s.me);
  const plans = useStore(s => s.plans);
  const chat = useStore(s => s.chat);
  const interests = useStore(s => s.interests);
  const likesSports = interests.some(i => ["Sports", "Basketball", "Football", "Baseball"].includes(i));
  const slot = timeSlot();
  const g = greetingFor(slot);

  const [wx, setWx] = React.useState<any>(null);
  const [near, setNear] = React.useState<any[]>([]);
  const [nearStatus, setNearStatus] = React.useState<"loading" | "ok" | "unavailable">("loading");
  const [eats, setEats] = React.useState<any[]>([]);
  const [busy, setBusy] = React.useState(false);

  const [activityKey, setActivityKey] = React.useState<string | null>(null);
  const [activityResults, setActivityResults] = React.useState<any[] | null>(null);
  const [openActivity, setOpenActivity] = React.useState<any>(null);
  const [hostedActivities, setHostedActivities] = React.useState<any[] | null>(null);
  const [addingActivity, setAddingActivity] = React.useState(false);

  const [openEat, setOpenEat] = React.useState<any>(null);
  const [eatCuisine, setEatCuisine] = React.useState<string | null>(null);
  const [eatSort, setEatSort] = React.useState<"rating" | "price_low" | "price_high">("rating");

  const [sportsEvents, setSportsEvents] = React.useState<any[] | null>(null);

  const [locating, setLocating] = React.useState(false);
  const refreshLocation = React.useCallback(async () => {
    setLocating(true);
    try {
      await requestLocation(true);
      const o = originOrFallback();
      weather.forecast(o.lat, o.lon).then(setWx);
    } finally { setLocating(false); }
  }, []);

  React.useEffect(() => {
    (async () => {
      // Force a fresh GPS read every time Home mounts (i.e. every time the
      // app is opened), instead of requestLocation()'s normal behavior of
      // reusing whatever origin is already sitting in localStorage from the
      // very first time permission was granted — someone who granted
      // location once and then travels would otherwise be stuck on that
      // first city forever. This never re-prompts for permission (browsers
      // remember that separately); it only re-reads the current position.
      await requestLocation(true);
      const o = originOrFallback();
      weather.forecast(o.lat, o.lon).then(setWx);
      const today = new Date().toISOString().slice(0, 10);
      const r = await events.search({ lat: o.lat, lon: o.lon, radiusMiles: 25, limit: 6, startDate: today });
      // This used to only ever call setNear on success, so a failed or
      // unavailable fetch (a blocked request, a network hiccup, no events
      // in range) left the section on its loading skeleton forever —
      // permanently gray, looking exactly like the app was broken.
      if (r.available) {
        setNear(r.events.filter((e: any) => !e.date || e.date >= today));
        setNearStatus("ok");
      } else {
        setNearStatus("unavailable");
      }
      // A wide net ("restaurants"), not a narrow one — cuisine/price filtering
      // happens client-side over one bigger result set instead of firing a
      // separate paid Places search per cuisine.
      const pr = await places.search({ query: "restaurants", lat: o.lat, lon: o.lon, limit: 20 });
      if (pr.available) setEats(pr.places);
    })();
    if (api.canShare()) api.publicEvents().then(r => setHostedActivities(r.events || []));
  }, []);

  // Sports specifically, not folded into the general "Happening near you"
  // feed — someone who says they like sports wants games, today's or
  // coming up, not a mixed feed of concerts they have to dig through.
  React.useEffect(() => {
    if (!likesSports) { setSportsEvents(null); return; }
    let dead = false;
    (async () => {
      const o = originOrFallback();
      const today = new Date().toISOString().slice(0, 10);
      const r = await events.search({ lat: o.lat, lon: o.lon, radiusMiles: 40, category: "sports", limit: 10, startDate: today });
      if (dead) return;
      setSportsEvents(r.available ? r.events.filter((e: any) => !e.date || e.date >= today) : []);
    })();
    return () => { dead = true; };
  }, [likesSports]);

  // Activities are opt-in (pick a chip) rather than always-on, so a Home
  // load never spends more Places budget than the user actually asked for.
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
        // Authoring the idea already answers "are you in?" — pre-fill it so
        // the creator isn't immediately asked whether they're in on their
        // own idea.
        participants: [{ id: me!.id, name: me!.name, answers: { availability: "I'm in" }, isCreator: true }],
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
          <button onClick={refreshLocation} disabled={locating} className="disabled:opacity-60">
            <Pill><MapPin className={`h-3 w-3 ${locating ? "animate-pulse" : ""}`} />{originOrFallback().label}</Pill>
          </button>
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

      {likesSports && sportsEvents && sportsEvents.length > 0 && (
        <Section title="Games coming up" action="See all" onAction={() => go("discover", undefined)}>
          <div className="no-bar edge-fade -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
            {sportsEvents.map((e, i) => (
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
                      {e.genre || "Sports"}
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
        </Section>
      )}

      <Section title="Happening near you" action="See all" onAction={() => go("discover")}>
        {nearStatus === "loading" ? (
          <div className="flex gap-3">
            {[0, 1].map(i => <div key={i} className="skeleton h-[168px] flex-1 rounded-[22px]" />)}
          </div>
        ) : nearStatus === "unavailable" ? (
          <Glass className="p-4 text-[13.5px] text-white/45">
            Couldn't load events right now — check your connection and try reopening the app.
          </Glass>
        ) : near.length === 0 ? (
          <Glass className="p-4 text-[13.5px] text-white/45">
            No events found nearby in the next few days.
          </Glass>
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

      {eats.length > 0 && (() => {
        const cuisines = Array.from(new Set(eats.map(cuisineOf).filter(Boolean))) as string[];
        const filtered = eats.filter(v => !eatCuisine || cuisineOf(v) === eatCuisine);
        const priceRank = (v: any) => Math.max(0, PRICE_LEVELS.indexOf(v.priceLevel));
        const sorted = [...filtered].sort((a, b) => {
          if (eatSort === "price_low") return priceRank(a) - priceRank(b);
          if (eatSort === "price_high") return priceRank(b) - priceRank(a);
          return (b.rating ?? 0) - (a.rating ?? 0);
        });
        return (
          <Section title="Nearby to eat" action="See all" onAction={() => go("discover")}>
            {cuisines.length > 0 && (
              <div className="no-bar edge-fade -mx-5 mb-2.5 flex gap-2 overflow-x-auto px-5">
                <button onClick={() => setEatCuisine(null)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                    !eatCuisine ? "text-white" : "border border-white/10 bg-white/[.06] text-white/60 hover:text-white/85"}`}
                  style={!eatCuisine ? { background: "var(--grad-brand)" } : undefined}>
                  All cuisines
                </button>
                {cuisines.map(c => (
                  <button key={c} onClick={() => setEatCuisine(eatCuisine === c ? null : c)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                      eatCuisine === c ? "text-white" : "border border-white/10 bg-white/[.06] text-white/60 hover:text-white/85"}`}
                    style={eatCuisine === c ? { background: "var(--grad-brand)" } : undefined}>
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div className="mb-2.5 flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-white/35">Sort</span>
              {([["rating", "Top rated"], ["price_low", "$ → $$$$"], ["price_high", "$$$$ → $"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setEatSort(key)}
                  className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                    eatSort === key ? "bg-white/15 text-white" : "text-white/45 hover:text-white/70"}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="no-bar edge-fade -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
              {sorted.map((v, i) => (
                <div key={v.providerId} className="w-[200px] shrink-0">
                  <VenueGridCard v={{ ...v, cuisine: cuisineOf(v) }} i={i} onClick={() => setOpenEat(v)} />
                </div>
              ))}
            </div>
          </Section>
        );
      })()}

      {/* Popular activities — right on the main page, not buried under a
          "something outdoors?" framing inside Discover. Chips are in-season
          only (a real season check, not decoration), and anyone can add
          their own via "Add an activity", which hosts it for real and lets
          people sign up for a free ticket right from the card. */}
      <div className="mb-7">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[17px]">Popular activities</h2>
          {api.canShare() && (
            <button onClick={() => setAddingActivity(true)}
              className="flex items-center gap-1 text-[13px] font-medium text-white/40 transition-colors hover:text-white/70">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          )}
        </div>

        <div className="no-bar edge-fade -mx-5 mb-3 flex gap-2 overflow-x-auto px-5">
          {Object.keys(ACTIVITIES).filter(k => inSeason(ACTIVITIES[k])).map(k => (
            <button key={k} onClick={() => setActivityKey(activityKey === k ? null : k)}
              className={`shrink-0 rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors ${
                activityKey === k ? "text-white" : "border border-white/10 bg-white/[.06] text-white/60 hover:text-white/85"}`}
              style={activityKey === k ? { background: "var(--grad-brand)" } : undefined}>
              {ACTIVITIES[k].emoji} {k}
            </button>
          ))}
        </div>

        {activityKey && activityResults === null && (
          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map(i => <div key={i} className="skeleton h-[168px] rounded-[22px]" />)}
          </div>
        )}
        {activityKey && activityResults && activityResults.length === 0 && (
          <Notice>
            No {ACTIVITIES[activityKey].noun}s came back nearby. Google Places needs a key set
            (<strong>You → Settings</strong>) to search this at all.
          </Notice>
        )}
        {activityKey && activityResults && activityResults.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {activityResults.map((v, i) => (
              <VenueGridCard key={v.providerId} v={v} i={i}
                onClick={() => { trackViewOnly(v, "activity", activityKey); setOpenActivity(v); }} />
            ))}
          </div>
        )}

        {/* User-hosted activities — real events other people created via
            "Add an activity" (or "Host an event" in Tickets), shown right
            here since this IS the activities feed, with an inline sign-up
            that claims a real free ticket without leaving Home. */}
        {hostedActivities && hostedActivities.length > 0 && (
          <div className="mt-4">
            <p className="mb-2.5 text-[12.5px] font-medium text-white/40">Hosted by the community</p>
            <div className="space-y-2.5">
              {hostedActivities.map(e => <HostedActivityCard key={e.id} e={e} me={me} />)}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {openEat && (
          <VenueSheet v={{ ...openEat, cuisine: cuisineOf(openEat) }} label="Restaurant" reservable
            onClose={() => setOpenEat(null)}
            onStartIdea={() => { startIdea(openEat, "restaurant", me, go); setOpenEat(null); }} />
        )}
        {openActivity && activityKey && (
          <VenueSheet v={openActivity} label={ACTIVITIES[activityKey].noun.replace(/^./, c => c.toUpperCase())}
            onClose={() => setOpenActivity(null)}
            onStartIdea={() => { startIdea(openActivity, "activity", me, go, activityKey); setOpenActivity(null); }} />
        )}
        {addingActivity && (
          <Sheet open onClose={() => setAddingActivity(false)} title="Add an activity">
            <AddActivity me={me} onDone={() => setAddingActivity(false)} />
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}

function HostedActivityCard({ e, me }: { e: any; me: any }) {
  const [status, setStatus] = React.useState<"idle" | "busy" | "done">("idle");
  const signUp = async () => {
    if (!me) return;
    setStatus("busy");
    try {
      await api.rsvpEvent(e.id, "going", me.name);
      const r = await api.claimTicket(e.id, me.name);
      if (r.ok) {
        store.addTicket({
          id: r.ticket.id, eventId: e.id, eventTitle: e.title, venue: e.venue || "TBA",
          dates: e.startsAt ? new Date(e.startsAt).toLocaleDateString([], { month: "long", day: "numeric" }) : "TBA",
          attendee: me.name, issuedAt: r.ticket.issuedAt,
        });
        setStatus("done");
      } else setStatus("idle");
    } catch { setStatus("idle"); }
  };
  return (
    <Glass className="flex items-center gap-3 p-3.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-semibold">{e.title}</p>
        <p className="mt-0.5 truncate text-[12px] text-white/45">
          {e.venue}{e.counts?.going ? ` · ${e.counts.going} going` : ""}
        </p>
      </div>
      <button onClick={signUp} disabled={status !== "idle"}
        className="shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold text-white transition-transform active:scale-95 disabled:opacity-70"
        style={{ background: "var(--grad-brand)" }}>
        {status === "done" ? <><Check className="h-3.5 w-3.5" /> Signed up</>
          : status === "busy" ? "…" : <><TicketIcon className="h-3.5 w-3.5" /> Sign up</>}
      </button>
    </Glass>
  );
}

function AddActivity({ me, onDone }: { me: any; onDone: () => void }) {
  const [title, setTitle] = React.useState("");
  const [venue, setVenue] = React.useState("");
  const [visibility, setVisibility] = React.useState<"public" | "private">("public");
  const [when, setWhen] = React.useState(() => new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10));
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  const create = async () => {
    if (!title.trim() || !venue.trim() || !me) return;
    setBusy(true); setErr(null);
    try {
      const hosted = await api.hostEvent({
        name: me.name, title: title.trim(), venue: venue.trim(),
        startsAt: new Date(when + "T15:00:00").toISOString(), visibility,
      });
      if (!hosted) { setErr("Couldn't create that — try again."); return; }
      await api.claimTicket(hosted.event.id, me.name);
      await navigator.clipboard?.writeText(hosted.shareUrl).catch(() => {});
      setDone(hosted.shareUrl);
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="py-2 text-center">
        <Check className="mx-auto mb-2 h-8 w-8 text-emerald-300" />
        <p className="text-[15px] font-semibold">Added — link copied.</p>
        <p className="mt-1 text-[13px] text-white/45">
          {visibility === "public" ? "It's live in Popular activities for everyone nearby." : "Only people with the link can see it."}
        </p>
        <button onClick={onDone} className="mt-4 w-full rounded-full py-3 text-[14.5px] font-semibold"
          style={{ background: "var(--grad-brand)" }}>Done</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed text-white/45">
        Test activities, meetups, anything — this hosts a real event people can sign up
        for and claim a free ticket to, same as anything in Tickets.
      </p>
      <label className="block">
        <span className="mb-1.5 block text-[12.5px] font-medium text-white/50">What is it</span>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Pickup basketball"
          className="glass w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none placeholder:text-white/30" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[12.5px] font-medium text-white/50">Where</span>
        <input value={venue} onChange={e => setVenue(e.target.value)} placeholder="Ritchie Coliseum"
          className="glass w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none placeholder:text-white/30" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[12.5px] font-medium text-white/50">Date</span>
        <input type="date" value={when} onChange={e => setWhen(e.target.value)}
          className="glass w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none [color-scheme:dark]" />
      </label>
      <div className="flex gap-2">
        <button onClick={() => setVisibility("public")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl border py-3 text-[13.5px] font-medium transition-colors ${
            visibility === "public" ? "border-[#7C6BFF]/60 bg-[#7C6BFF]/15 text-[#C9C1FF]" : "border-white/10 bg-white/[.04] text-white/55"}`}>
          <Globe2 className="h-3.5 w-3.5" /> Public
        </button>
        <button onClick={() => setVisibility("private")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl border py-3 text-[13.5px] font-medium transition-colors ${
            visibility === "private" ? "border-[#7C6BFF]/60 bg-[#7C6BFF]/15 text-[#C9C1FF]" : "border-white/10 bg-white/[.04] text-white/55"}`}>
          <Lock className="h-3.5 w-3.5" /> Link only
        </button>
      </div>
      {err && <Notice tone="warn">{err}</Notice>}
      <button onClick={create} disabled={busy || !title.trim() || !venue.trim()}
        className="mt-1 w-full rounded-full py-3.5 text-[15px] font-semibold disabled:opacity-40"
        style={{ background: "var(--grad-brand)" }}>
        {busy ? "Adding…" : "Add it"}
      </button>
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

/** Always carries the real date alongside any relative label — "Tonight"
 * on its own used to be all a card showed, which is useless once you're
 * not looking at it same-day anymore. */
export function fmtDate(d?: string | null) {
  if (!d) return "Date TBA";
  const dt = new Date(d + "T12:00:00");
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const days = Math.round((dt.getTime() - today.getTime()) / 86400000);
  const real = dt.toLocaleDateString([], { month: "short", day: "numeric" });
  if (days === 0) return `Tonight · ${real}`;
  if (days === 1) return `Tomorrow · ${real}`;
  if (days > 1 && days < 7) return `${dt.toLocaleDateString([], { weekday: "long" })} · ${real}`;
  return real;
}
