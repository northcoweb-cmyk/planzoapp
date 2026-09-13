/**
 * Shared "start an idea from a known thing" logic — an event, a restaurant,
 * or an activity. Used by both Discover (events/restaurants/activities) and
 * Home (the "Popular activities" section), so this lives here instead of
 * being duplicated or trapped inside one screen's file.
 */
import { store, originOrFallback, type Plan } from "./store";

export type Kind = "event" | "restaurant" | "activity";

export type Activity = { query: string; verb: string; noun: string; emoji: string; seasons?: number[] };
// seasons: months (0=Jan..11=Dec) an activity makes sense in. Omitted means
// year-round.
export const ACTIVITIES: Record<string, Activity> = {
  Hike:     { query: "hiking trail nature park", verb: "Go hiking at", noun: "trail", emoji: "🥾" },
  Picnic:   { query: "park picnic area", verb: "Have a picnic at", noun: "picnic spot", emoji: "🧺", seasons: [2,3,4,5,6,7,8,9] },
  Swim:     { query: "public swimming lake beach pool", verb: "Go swimming at", noun: "swim spot", emoji: "🏊", seasons: [4,5,6,7,8,9] },
  Bike:     { query: "bike trail rail trail", verb: "Go biking at", noun: "bike trail", emoji: "🚴", seasons: [2,3,4,5,6,7,8,9,10] },
  Climb:    { query: "rock climbing gym bouldering", verb: "Go climbing at", noun: "climbing spot", emoji: "🧗" },
  Kayak:    { query: "kayak rental launch river lake", verb: "Go kayaking at", noun: "put-in", emoji: "🛶", seasons: [3,4,5,6,7,8,9] },
  Fish:     { query: "fishing spot pier lake", verb: "Go fishing at", noun: "fishing spot", emoji: "🎣", seasons: [2,3,4,5,6,7,8,9,10] },
  Ski:      { query: "ski resort snowboarding", verb: "Go skiing at", noun: "ski spot", emoji: "🎿", seasons: [10,11,0,1,2] },
  Museum:   { query: "museum gallery exhibit", verb: "Check out", noun: "museum", emoji: "🖼️" },
  Arcade:   { query: "arcade bowling mini golf", verb: "Go play at", noun: "spot", emoji: "🕹️" },
  Camp:     { query: "campground camping site", verb: "Go camping at", noun: "campground", emoji: "🏕️", seasons: [3,4,5,6,7,8,9] },
};

export function inSeason(a: Activity, month = new Date().getMonth()) {
  return !a.seasons || a.seasons.includes(month);
}

/** Ticketmaster's "HH:MM:SS" -> the same buckets the timing question uses,
 * so a 7:30pm concert never gets asked "morning or evening?" — the event
 * itself already answered that. */
export function timeOfDayFor(hhmmss?: string | null): string | null {
  if (!hhmmss) return null;
  const h = parseInt(hhmmss.slice(0, 2), 10);
  if (!Number.isFinite(h)) return null;
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  if (h < 21) return "Evening";
  return "Late night";
}

/** Build a plan directly from a known event/restaurant/activity instead of
 * routing it through the free-text intent parser — we already know exactly
 * what this is, so guessing at it from a sentence would only lose accuracy
 * and burn AI spend for nothing. */
export function seedPlanFrom(item: any, kind: Kind, me: { id: string; name: string }, activityKey?: string): Plan {
  const title = kind === "event" ? item.title : item.name;
  const act = kind === "activity" && activityKey ? ACTIVITIES[activityKey] : null;
  const idea = kind === "event" ? `Go to ${title}` : kind === "restaurant" ? `Eat at ${title}` : `${act?.verb ?? "Go to"} ${title}`;
  const categories = kind === "event" ? [item.genre || item.category || "event"]
    : kind === "restaurant" ? ["food"] : ["outdoors", activityKey?.toLowerCase() ?? "activity"];
  return {
    id: crypto.randomUUID().slice(0, 8),
    idea, title,
    // The event already IS the date and time — asking "what day/time works"
    // after picking a specific concert made no sense and used to happen.
    ...(kind === "event" ? { date: item.date || null } : {}),
    intent: {
      title, categories,
      needsFood: kind === "restaurant",
      confidence: 1,
      source: "seeded_from_" + kind,
      dayHint: kind === "event" ? (item.date || null) : null,
      timeOfDay: kind === "event" ? timeOfDayFor(item.time) : null,
      seed: kind === "event"
        ? { kind, providerId: item.providerId, title: item.title, venue: item.venue, date: item.date, time: item.time,
            address: item.address, lat: item.lat, lon: item.lon, officialUrl: item.officialUrl, category: item.genre || item.category }
        : { kind, providerId: item.providerId, name: item.name, address: item.address, activityKey },
    },
    origin: originOrFallback(),
    // Starting an idea from a restaurant/event/activity they picked already
    // answers "are you in?" — pre-fill it so they aren't asked next.
    participants: [{ id: me.id, name: me.name, answers: { availability: "I'm in" }, isCreator: true }],
    finalPlan: null, createdAt: new Date().toISOString(),
  };
}

export function trackViewOnly(item: any, kind: Kind, actKey?: string) {
  store.trackView({
    id: item.providerId, kind,
    title: kind === "event" ? item.title : item.name,
    category: kind === "event" ? (item.genre || item.category) : kind === "restaurant" ? "restaurant" : actKey,
    at: new Date().toISOString(),
  } as any);
}

/** trackView + save the plan + a Planzo chat line + navigate to it. Caller
 * is responsible for closing its own sheet/local UI state afterward. */
export function startIdea(item: any, kind: Kind, me: { id: string; name: string } | null | undefined,
  go: ((tab: string, arg?: any) => void) | undefined, activityKey?: string) {
  if (!me) return;
  trackViewOnly(item, kind, activityKey);
  const plan = seedPlanFrom(item, kind, me, activityKey);
  store.savePlan(plan);
  store.say({
    role: "planzo",
    text: `Started a plan around ${plan.title.toLowerCase()} — answer a couple quick questions and I'll work out the rest.`,
    at: new Date().toISOString(), planId: plan.id,
  });
  go?.("plans", plan.id);
}
