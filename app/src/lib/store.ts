/**
 * App state. Everything persists to localStorage so the demo genuinely
 * remembers you between sessions — that was an explicit requirement, and
 * it is also what makes the memory engine mean anything.
 */
import { useSyncExternalStore } from 'react';
import * as memoryEng from './engine/memory.js';

export type Me = { id: string; name: string; email?: string; pro?: boolean };
export type Origin = { lat: number; lon: number; label: string };
export type Participant = { id: string; name: string; answers: Record<string, any>; isCreator?: boolean };
export type Plan = {
  id: string; idea: string; title: string; intent: any;
  participants: Participant[]; origin: Origin | null;
  finalPlan: any | null; trip?: any; createdAt: string;
  /** Set once this plan has been pushed to the server (createSharedPlan) —
   * present means "Copy link" actually works for someone else. */
  shareCode?: string; shareUrl?: string;
};
export type Ticket = {
  id: string; eventId: string; eventTitle: string; venue: string; dates: string;
  attendee: string; palette?: string; admitted?: boolean; issuedAt: string;
  /** Set when this event was actually hosted on the server (api.hostEvent)
   * rather than a local-only ticket — present means the /e/<eventId> link
   * really works for someone else. */
  shareUrl?: string;
};
export type ChatTurn = { role: 'user' | 'planzo'; text: string; at: string; planId?: string };
export type ViewedItem = {
  id: string; kind: 'event' | 'restaurant' | 'activity'; title: string;
  category?: string | null; at: string;
};

export type State = {
  me: Me | null;
  origin: Origin | null;
  interests: string[];
  dietary: string[];
  plans: Record<string, Plan>;
  tickets: Record<string, Ticket>;
  memory: any[];
  chat: ChatTurn[];
  viewed: ViewedItem[];
  seenOnboarding: boolean;
  college: string | null;
};

const KEY = 'planzo.state.v3';
const EMPTY: State = {
  me: null, origin: null, interests: [], dietary: [],
  plans: {}, tickets: {}, memory: [], chat: [], viewed: [], seenOnboarding: false, college: null,
};

function load(): State {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...EMPTY }; }
}

let state: State = load();
const listeners = new Set<() => void>();

function emit() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  listeners.forEach(l => l());
}

export const store = {
  get: () => state,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  set(patch: Partial<State>) { state = { ...state, ...patch }; emit(); },

  signIn(name: string, email?: string) {
    state = { ...state, me: { id: crypto.randomUUID(), name, email } };
    emit();
  },

  savePlan(plan: Plan) {
    state = { ...state, plans: { ...state.plans, [plan.id]: plan } };
    emit();
  },

  deletePlan(id: string) {
    const { [id]: _, ...rest } = state.plans;
    state = { ...state, plans: rest };
    emit();
  },

  /** Fold a participant's answers into personal memory, as the server does. */
  learn(plan: Plan, participantId: string) {
    state = { ...state, memory: memoryEng.learnFromPlan(state.memory, plan, participantId) };
    emit();
  },

  remember(category: string, value: string) {
    state = {
      ...state,
      memory: memoryEng.observe(state.memory, {
        category, value, scope: 'user', stability: 'stable', source: 'explicit',
      }),
    };
    emit();
  },

  forget(id: string) {
    state = { ...state, memory: state.memory.filter((m: any) => m.id !== id) };
    emit();
  },

  addTicket(t: Ticket) {
    state = { ...state, tickets: { ...state.tickets, [t.id]: t } };
    emit();
  },

  say(turn: ChatTurn) {
    state = { ...state, chat: [...state.chat, turn].slice(-60) };
    emit();
  },

  /** Record that this person opened an event or restaurant, most-recent first.
   * Feeds Discover's ranking so "what they've clicked into before" means something. */
  trackView(item: ViewedItem) {
    const rest = state.viewed.filter(v => v.id !== item.id);
    state = { ...state, viewed: [item, ...rest].slice(0, 100) };
    emit();
  },

  reset() { state = { ...EMPTY }; try { localStorage.removeItem(KEY); } catch {} emit(); },
};

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.get()), () => select(EMPTY));
}

/** Location, asked for once and remembered. */
export function requestLocation(force = false): Promise<Origin | null> {
  return new Promise((resolve) => {
    const cur = store.get().origin;
    if (!force && cur) return resolve(cur);
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const o: Origin = {
          lat: +pos.coords.latitude.toFixed(4),
          lon: +pos.coords.longitude.toFixed(4),
          label: 'Near you',
        };
        store.set({ origin: o });
        resolve(o);
        // Fill in a real "City, ST" label in the background — the coarse
        // "Near you" placeholder above is what renders immediately so the
        // pin never sits blank while this resolves.
        resolveCityLabel(o);
      },
      () => resolve(null),
      // A short timeout here used to fire while the browser's own
      // permission prompt was still sitting on screen — someone who took
      // more than 9s to tap "Allow" got silently locked onto the College
      // Park fallback for the rest of the session (a one-shot effect never
      // retried), which is exactly what "weather is wrong" looks like from
      // the outside. 20s covers that; high accuracy trades a little more
      // battery for a fix that isn't several miles off at a city boundary.
      { timeout: 20000, maximumAge: 300000, enableHighAccuracy: true },
    );
  });
}

async function resolveCityLabel(o: Origin) {
  try {
    const res = await fetch(`/api/geocode?lat=${o.lat}&lon=${o.lon}`);
    const j = await res.json();
    if (j.available && j.city && store.get().origin?.lat === o.lat) {
      store.set({ origin: { ...o, label: j.city } });
    }
  } catch { /* keep "Near you" — never guess a city */ }
}

/** Falls back to UMD so the demo has something to show without permission. */
export const FALLBACK_ORIGIN: Origin = { lat: 38.9869, lon: -76.9426, label: 'College Park, MD' };
export const originOrFallback = () => store.get().origin || FALLBACK_ORIGIN;
