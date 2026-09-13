/**
 * Thin client for the server's real plan-sharing API (server/routes.js).
 * This is what makes a "copy link" actually work across devices — until
 * now every plan lived only in this browser's localStorage, so a shared
 * link had nothing on the other end for a second person to see.
 *
 * Not used for the local single-player flow (Home/Discover's instant
 * "start an idea" still writes straight to the local store — no reason to
 * pay a network round trip for a plan nobody's sharing yet). Called once a
 * plan is actually shared, and always for the /p/<code> participant view,
 * which has no local store of its own at all.
 */
import { hasServer } from './config';

const SESSION_KEY = 'planzo.session.v1';
// The name the cached session token was actually issued for. A session's
// identity is fixed at creation — if the caller now wants a different name
// (the real bug this fixed: a passive background read silently created a
// "Guest" session before the person ever typed their real name into
// "Host an event", and every action after that was attributed to "Guest"
// forever, since the cached token was reused regardless of what name was
// passed later), a NEW session has to be issued rather than reusing the
// stale one.
const SESSION_NAME_KEY = 'planzo.session-name.v1';

function cached(): { token: string | null; name: string | null } {
  try { return { token: localStorage.getItem(SESSION_KEY), name: localStorage.getItem(SESSION_NAME_KEY) }; }
  catch { return { token: null, name: null }; }
}

async function ensureSession(name: string): Promise<string | null> {
  const { token, name: cachedName } = cached();
  if (token && cachedName === name) return token;
  const res = await fetch('/api/session', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const j = await res.json();
  if (!j.ok) return null;
  try { localStorage.setItem(SESSION_KEY, j.session); localStorage.setItem(SESSION_NAME_KEY, name); } catch {}
  return j.session;
}

/** `name` is required for any call that writes something attributed to a
 * person (hosting, joining, answering, RSVPing) — never defaulted, so a
 * background read can never silently mint a "Guest" identity that a real
 * name gets stuck behind later. Purely informational reads (the public
 * events feed) pass no name and get no session at all — the server
 * doesn't require one for those. */
async function call(path: string, opts: { method?: string; body?: any; name?: string } = {}) {
  const token = opts.name ? await ensureSession(opts.name) : null;
  const res = await fetch(`/api${path}`, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-planzo-session': token } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
}

export const canShare = () => hasServer;

/** Push a locally-created plan to the server so it gets a real shareable
 * code + URL. Returns null (never throws) if this build has no server to
 * talk to — the caller keeps the plan working locally either way. */
export async function createSharedPlan(opts: {
  name: string; idea: string; date?: string | null; origin?: { lat: number; lon: number; label?: string | null } | null;
}): Promise<{ code: string; shareUrl: string } | null> {
  if (!hasServer) return null;
  try {
    const j = await call('/plans', { method: 'POST', name: opts.name, body: { idea: opts.idea, date: opts.date, origin: opts.origin } });
    if (!j.ok) return null;
    return { code: j.plan.code, shareUrl: j.shareUrl };
  } catch { return null; }
}

export async function joinPlan(code: string, name: string) {
  return call(`/plans/${code}/join`, { method: 'POST', name });
}
export async function getPlan(code: string) {
  return call(`/plans/${code}`);
}
export async function nextQuestion(code: string, name: string) {
  return call(`/plans/${code}/question`, { name });
}
export async function answerQuestion(code: string, questionId: string, value: string | string[], name: string) {
  return call(`/plans/${code}/answer`, { method: 'POST', name, body: { questionId, value } });
}
export async function planStatus(code: string) {
  return call(`/plans/${code}/status`);
}

// ── Hosted events + free ticket claiming — real server API that already
// existed (server/routes.js, engine/hosting.js, engine/tickets.js, all
// tested) but nothing on the client ever called it. "Host an event" used
// to just fabricate a ticket locally with a random id nobody else could
// ever see or claim. ─────────────────────────────────────────────────────
export async function hostEvent(opts: {
  name: string; title: string; description?: string; startsAt: string; venue: string; address?: string;
  visibility: "public" | "private"; capacity?: number | null;
}): Promise<{ event: any; shareUrl: string } | null> {
  if (!hasServer) return null;
  try {
    const j = await call('/events', { method: 'POST', name: opts.name, body: {
      title: opts.title, description: opts.description || '', startsAt: opts.startsAt,
      venue: opts.venue, address: opts.address || '', visibility: opts.visibility,
      capacity: opts.capacity ?? null, ticketTypes: [{ id: 'ga', name: 'General admission', price: 0 }],
    } });
    if (!j.ok) return null;
    return { event: j.event, shareUrl: j.shareUrl };
  } catch { return null; }
}
export async function getEvent(id: string) {
  return call(`/events/${id}`);
}
export async function publicEvents() {
  return call('/events/public');
}
export async function rsvpEvent(id: string, status: "going" | "maybe" | "not_going", name: string) {
  return call(`/events/${id}/rsvp`, { method: 'POST', name, body: { status } });
}
export async function claimTicket(id: string, name: string) {
  return call(`/events/${id}/claim`, { method: 'POST', name, body: {} });
}

/** Real waitlist row via the server's own /waitlist route (server/routes.js)
 * — the same one the marketing site uses. No session needed; it's keyed on
 * email server-side, and a repeat signup comes back as alreadyOnList rather
 * than a duplicate. */
export async function joinWaitlist(opts: { name: string; email: string; useCase?: string; source?: string }) {
  if (!hasServer) return null;
  try {
    const j = await call('/waitlist', { method: 'POST', body: {
      name: opts.name, email: opts.email, useCase: opts.useCase || null, source: opts.source || 'app',
    } });
    if (!j.ok) return null;
    return { position: j.position, alreadyOnList: Boolean(j.alreadyOnList) };
  } catch { return null; }
}
