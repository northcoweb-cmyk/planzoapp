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

function sessionToken(): string | null {
  try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
}

async function ensureSession(name: string): Promise<string | null> {
  const existing = sessionToken();
  if (existing) return existing;
  const res = await fetch('/api/session', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const j = await res.json();
  if (!j.ok) return null;
  try { localStorage.setItem(SESSION_KEY, j.session); } catch {}
  return j.session;
}

async function call(path: string, opts: { method?: string; body?: any; name?: string } = {}) {
  const token = await ensureSession(opts.name || 'Guest');
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
