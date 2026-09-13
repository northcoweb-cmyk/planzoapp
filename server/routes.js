'use strict';
/**
 * API router. One place, so auth, rate limiting and shapes stay consistent
 * across the PWA, the participant web flow and any future native client.
 */
const store = require('../lib/store');
const ids = require('../lib/ids');
const rl = require('../lib/ratelimit');
const cost = require('../lib/cost');
const intent = require('../engine/intent');
const questions = require('../engine/questions');
const consensus = require('../engine/consensus');
const planEngine = require('../engine/plan');
const tickets = require('../engine/tickets');
const hosting = require('../engine/hosting');
const memory = require('../engine/memory');
const expenses = require('../engine/expenses');
const calendar = require('../engine/calendar');
const trips = require('../engine/trips');
const search = require('../engine/search');
const weather = require('../services/weather');
const places = require('../services/places');
const geocode = require('../services/geocode');
const events = require('../services/events');
const ai = require('../services/ai');

const ok   = (body, headers) => ({ status: 200, body, headers });
const bad  = (error, status = 400) => ({ status, body: { error } });
/** The real deployment's own origin, not a hardcoded fallback. A share
 * link built from PLANZO_PUBLIC_URL alone silently pointed at
 * localhost:4000 in production whenever that env var was never set (it
 * wasn't, on the live Vercel deploy) — the request's own Host header is
 * always correct and never needs remembering to configure. The env var
 * still wins if explicitly set, for setups that front the app with a
 * different public domain than what the server itself sees. */
const PUBLIC_URL = (headers = {}) => {
  if (process.env.PLANZO_PUBLIC_URL) return process.env.PLANZO_PUBLIC_URL.replace(/\/$/, '');
  const host = headers['x-forwarded-host'] || headers.host;
  if (host) {
    const proto = (headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https')).split(',')[0];
    return `${proto}://${host}`;
  }
  return 'http://localhost:4000';
};

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** Participant identity from the signed cookie/header. Never a URL param. */
function identity(headers) {
  const raw = headers['x-planzo-session'] || '';
  return ids.verify(String(raw));
}

async function handle({ method, url, body, ip, headers }) {
  const p = url.pathname.replace(/^\/api/, '') || '/';
  const seg = p.split('/').filter(Boolean);

  // ── WAITLIST ────────────────────────────────────────────────────────
  if (p === '/waitlist' && method === 'POST') {
    const gate = await rl.check('waitlist', ip);
    if (!gate.ok) return bad('rate_limited', 429);

    const name = str(body.name, 80);
    const email = str(body.email, 200).toLowerCase();
    const phone = str(body.phone, 30).replace(/[^\d+]/g, '');
    if (!name) return bad('name_required');
    if (!EMAIL_RE.test(email)) return bad('invalid_email');
    if (phone && phone.replace(/\D/g, '').length < 10) return bad('invalid_phone');

    const key = `waitlist:${ids.hash(email).slice(0, 32)}`;
    const existing = await store.get(key);
    if (existing) return ok({ ok: true, alreadyOnList: true, position: existing.position });

    const position = await store.incrBy('waitlist:count', 1);
    const record = {
      id: ids.token(10), name, email, phone: phone || null,
      college: str(body.college, 120) || null,
      city: str(body.city, 120) || null,
      useCase: str(body.useCase, 300) || null,
      source: str(body.source, 60) || 'direct',
      referralCode: str(body.ref, 40) || null,
      marketingOptIn: body.marketingOptIn !== false,
      status: 'pending', launchNotified: false,
      position: Math.round(position),
      createdAt: new Date().toISOString(),
    };
    await store.set(key, record);
    await store.push('waitlist:index', { id: record.id, email, name, position: record.position, createdAt: record.createdAt }, 20000);
    return ok({ ok: true, position: record.position });
  }

  // ── SESSION (anonymous participant identity) ────────────────────────
  if (p === '/session' && method === 'POST') {
    const name = str(body.name, 60);
    if (!name) return bad('name_required');
    const existing = identity(headers);
    const pid = existing?.pid || ids.token(12);
    const session = ids.sign({ pid, name, photo: str(body.photo, 500) || null });
    await store.set(`participant:${pid}`, { id: pid, name, photo: str(body.photo, 500) || null, updatedAt: new Date().toISOString() });
    return ok({ ok: true, session, participant: { id: pid, name } });
  }

  // ── PLANS ───────────────────────────────────────────────────────────
  if (p === '/plans' && method === 'POST') {
    const gate = await rl.check('plan_create', ip);
    if (!gate.ok) return bad('rate_limited', 429);

    const idea = str(body.idea, 500);
    if (!idea) return bad('idea_required');
    const me = identity(headers);
    if (!me) return bad('session_required', 401);

    const code = ids.planCode();
    const parsed = await intent.extract(idea, { planId: code });
    const plan = {
      id: code, code,
      creatorId: me.pid, creatorName: me.name,
      idea, intent: parsed,
      title: parsed.title,
      date: str(body.date, 20) || null,
      origin: body.origin && Number.isFinite(body.origin.lat)
        ? { lat: +body.origin.lat, lon: +body.origin.lon, label: str(body.origin.label, 120) || null }
        : null,
      visibility: body.visibility === 'public' ? 'public' : 'private',
      status: 'collecting',
      // The creator authored this idea — asking them "are you in?" right
      // after they typed it is a redundant, confusing first question.
      // Availability is pre-answered for them; every other question still
      // runs through the normal adaptive sequence.
      participants: [{ id: me.pid, name: me.name, answers: { availability: "I'm in" }, joinedAt: new Date().toISOString(), isCreator: true }],
      finalPlan: null,
      createdAt: new Date().toISOString(),
    };
    await store.set(`plan:${code}`, plan);
    await store.push(`user_plans:${me.pid}`, code, 200);
    return ok({ ok: true, plan: publicPlan(plan), shareUrl: `${PUBLIC_URL(headers)}/p/${code}` });
  }

  if (seg[0] === 'plans' && seg[1] && method === 'GET' && seg.length === 2) {
    const plan = await store.get(`plan:${seg[1]}`);
    if (!plan) return bad('plan_not_found', 404);
    return ok({ plan: publicPlan(plan), state: questions.publicState(consensus.build(plan)) });
  }

  if (seg[0] === 'plans' && seg[1] && seg[2] === 'join' && method === 'POST') {
    const plan = await store.get(`plan:${seg[1]}`);
    if (!plan) return bad('plan_not_found', 404);
    const me = identity(headers);
    if (!me) return bad('session_required', 401);
    if (!plan.participants.some(x => x.id === me.pid)) {
      plan.participants.push({ id: me.pid, name: me.name, answers: {}, joinedAt: new Date().toISOString() });
      await store.set(`plan:${plan.id}`, plan);
    }
    return ok({ ok: true, plan: publicPlan(plan) });
  }

  if (seg[0] === 'plans' && seg[1] && seg[2] === 'question' && method === 'GET') {
    const plan = await store.get(`plan:${seg[1]}`);
    if (!plan) return bad('plan_not_found', 404);
    const me = identity(headers);
    if (!me) return bad('session_required', 401);
    const participant = plan.participants.find(x => x.id === me.pid);
    if (!participant) return bad('not_a_participant', 403);
    return ok(questions.next(plan, participant));
  }

  if (seg[0] === 'plans' && seg[1] && seg[2] === 'answer' && method === 'POST') {
    const gate = await rl.check('plan_answer', ip);
    if (!gate.ok) return bad('rate_limited', 429);
    const plan = await store.get(`plan:${seg[1]}`);
    if (!plan) return bad('plan_not_found', 404);
    const me = identity(headers);
    if (!me) return bad('session_required', 401);
    const participant = plan.participants.find(x => x.id === me.pid);
    if (!participant) return bad('not_a_participant', 403);

    const qid = str(body.questionId, 40);
    if (!qid) return bad('question_required');
    const value = Array.isArray(body.value)
      ? body.value.slice(0, 8).map(v => str(v, 60)).filter(Boolean)
      : str(body.value, 60);
    if (!value || (Array.isArray(value) && !value.length)) return bad('value_required');

    participant.answers = { ...participant.answers, [qid]: value };
    participant.answeredAt = new Date().toISOString();
    await store.set(`plan:${plan.id}`, plan);
    return ok(questions.next(plan, participant));
  }

  if (seg[0] === 'plans' && seg[1] && seg[2] === 'generate' && method === 'POST') {
    const plan = await store.get(`plan:${seg[1]}`);
    if (!plan) return bad('plan_not_found', 404);
    const me = identity(headers);
    if (!me || me.pid !== plan.creatorId) return bad('only_the_creator_can_generate', 403);

    const generated = await planEngine.generate(plan, { origin: plan.origin });
    plan.finalPlan = generated;
    plan.status = 'planned';
    await store.set(`plan:${plan.id}`, plan);
    return ok({ ok: true, finalPlan: generated });
  }

  if (seg[0] === 'plans' && seg[1] && seg[2] === 'status' && method === 'GET') {
    const plan = await store.get(`plan:${seg[1]}`);
    if (!plan) return bad('plan_not_found', 404);
    const state = consensus.build(plan);
    return ok({
      roster: plan.participants.map(x => ({
        name: x.name,
        status: x.answers?.availability === "I'm in" ? 'Confirmed'
              : x.answers?.availability === 'Maybe' ? 'Maybe'
              : x.answers?.availability === "Can't make it" ? 'Out'
              : Object.keys(x.answers || {}).length ? 'Responding' : 'Waiting',
        isCreator: Boolean(x.isCreator),
      })),
      confirmed: state.confirmedCount, total: plan.participants.length,
      waitingOn: state.waitingOn, readyToPlan: state.readyToPlan,
      leaning: questions.publicState(state).leaning,
    });
  }

  // ── LIVE DATA ───────────────────────────────────────────────────────
  if (p === '/weather' && method === 'GET') {
    const lat = parseFloat(url.searchParams.get('lat'));
    const lon = parseFloat(url.searchParams.get('lon'));
    return ok(await weather.forecast(lat, lon, url.searchParams.get('date')));
  }

  if (p === '/geocode' && method === 'GET') {
    const lat = parseFloat(url.searchParams.get('lat'));
    const lon = parseFloat(url.searchParams.get('lon'));
    return ok(await geocode.cityFor(lat, lon));
  }

  if (p === '/discover' && method === 'GET') {
    const lat = parseFloat(url.searchParams.get('lat'));
    const lon = parseFloat(url.searchParams.get('lon'));
    const q = str(url.searchParams.get('q'), 100) || 'things to do';
    const res = await places.search({ query: q, lat, lon, limit: 12 });
    return ok(res);
  }

  if (p === '/events/external' && method === 'GET') return ok(await events.search());

  if (p === '/places/photo' && method === 'GET') {
    // Real Places photo resource names run 400-500+ chars — 300 was truncating
    // every one of them before it ever reached the Places media API.
    const ref = str(url.searchParams.get('ref'), 700);
    const width = Math.min(1200, parseInt(url.searchParams.get('w'), 10) || 400);
    const uri = await places.photoFor(ref, width);
    return ok({ uri });
  }

  // ── AI CHAT (browser client proxy — keeps the key server-side) ────────
  if (p === '/ai/chat' && method === 'POST') {
    const gate = await rl.check('ai', ip);
    if (!gate.ok) return bad('rate_limited', 429);
    const prompt = str(body.prompt, 4000);
    if (!prompt) return bad('prompt_required');
    const system = str(body.system, 2000) || undefined;
    const tier = body.tier === 'smart' ? 'smart' : 'cheap';
    const r = await ai.ask({ system, prompt, tier, maxTokens: 500 });
    if (!r.ok) return ok({ ok: false, reason: r.reason });
    return ok({ ok: true, data: r.data });
  }

  // ── TICKETS ─────────────────────────────────────────────────────────
  if (p === '/tickets/checkin' && method === 'POST') {
    const gate = await rl.check('checkin', ip);
    if (!gate.ok) return bad('rate_limited', 429);
    const me = identity(headers);
    if (!me) return bad('session_required', 401);

    const eventId = str(body.eventId, 40);
    const event = await store.get(`event:${eventId}`);
    if (!event) return bad('event_not_found', 404);
    // Authorization is server-side. A frontend claim of "staff" is ignored.
    const staffIds = [event.ownerId, ...(event.staff || []).map(s => s.id)];
    if (!staffIds.includes(me.pid)) return ok({ result: tickets.RESULT.FORBIDDEN });

    const r = await tickets.checkIn(str(body.credential, 200), eventId, { id: me.pid, name: me.name });
    return ok(r);
  }

  if (seg[0] === 'events' && seg[1] && seg[2] === 'stats' && method === 'GET') {
    const me = identity(headers);
    const event = await store.get(`event:${seg[1]}`);
    if (!event) return bad('event_not_found', 404);
    const staffIds = [event.ownerId, ...(event.staff || []).map(s => s.id)];
    if (!me || !staffIds.includes(me.pid)) return bad('not_authorized', 403);
    return ok(await tickets.stats(seg[1]));
  }


  // ── GROUPS + GROUP MEMORY (spec §16) ────────────────────────────────
  if (p === '/groups' && method === 'POST') {
    const me = identity(headers);
    if (!me) return bad('session_required', 401);
    const name = str(body.name, 60);
    if (!name) return bad('name_required');
    const id = ids.token(10);
    const group = { id, name, ownerId: me.pid,
      members: [{ id: me.pid, name: me.name, role: 'owner' }],
      planIds: [], createdAt: new Date().toISOString() };
    await store.set(`group:${id}`, group);
    await store.push(`user_groups:${me.pid}`, id, 100);
    return ok({ ok: true, group });
  }

  if (p === '/groups' && method === 'GET') {
    const me = identity(headers);
    if (!me) return bad('session_required', 401);
    const idsList = (await store.get(`user_groups:${me.pid}`)) || [];
    const groups = (await Promise.all(idsList.map(g => store.get(`group:${g}`)))).filter(Boolean);
    return ok({ groups });
  }

  if (seg[0] === 'groups' && seg[1] && method === 'GET' && seg.length === 2) {
    const group = await store.get(`group:${seg[1]}`);
    if (!group) return bad('group_not_found', 404);
    const plans = (await Promise.all((group.planIds || []).map(c => store.get(`plan:${c}`)))).filter(Boolean);
    return ok({ group, profile: memory.groupProfile(plans),
      plans: plans.map(publicPlan) });
  }

  if (seg[0] === 'groups' && seg[1] && seg[2] === 'members' && method === 'POST') {
    const me = identity(headers);
    const group = await store.get(`group:${seg[1]}`);
    if (!group) return bad('group_not_found', 404);
    if (!me || group.ownerId !== me.pid) return bad('not_authorized', 403);
    const name = str(body.name, 60);
    if (!name) return bad('name_required');
    group.members.push({ id: ids.token(10), name, role: 'member' });
    await store.set(`group:${group.id}`, group);
    return ok({ ok: true, group });
  }

  // ── PERSONAL MEMORY (spec §15) ──────────────────────────────────────
  if (p === '/me/memory' && method === 'GET') {
    const me = identity(headers);
    if (!me) return bad('session_required', 401);
    const mem = (await store.get(`memory:${me.pid}`)) || [];
    return ok({ memories: memory.prune(mem) });
  }

  if (p === '/me/memory' && method === 'POST') {
    const me = identity(headers);
    if (!me) return bad('session_required', 401);
    const mem = (await store.get(`memory:${me.pid}`)) || [];
    const next = memory.observe(mem, {
      category: str(body.category, 30), value: str(body.value, 60),
      scope: 'user', stability: str(body.stability, 20) || 'stable',
      source: 'explicit',
    });
    await store.set(`memory:${me.pid}`, next);
    return ok({ ok: true, memories: memory.prune(next) });
  }

  if (seg[0] === 'me' && seg[1] === 'memory' && seg[2] && method === 'DELETE') {
    const me = identity(headers);
    if (!me) return bad('session_required', 401);
    const mem = (await store.get(`memory:${me.pid}`)) || [];
    const next = mem.filter(m => m.id !== decodeURIComponent(seg[2]));
    await store.set(`memory:${me.pid}`, next);
    return ok({ ok: true, memories: next });
  }

  // ── PLANZO-CREATED EVENTS (spec §22, §35–37) ────────────────────────
  if (p === '/events' && method === 'POST') {
    const gate = await rl.check('event_create', ip);
    if (!gate.ok) return bad('rate_limited', 429);
    const me = identity(headers);
    if (!me) return bad('session_required', 401);
    let event;
    try {
      event = hosting.createEvent({
        id: ids.token(10), ownerId: me.pid, ownerName: me.name,
        orgId: str(body.orgId, 40) || null,
        title: str(body.title, 120), description: str(body.description, 2000),
        startsAt: str(body.startsAt, 40), endsAt: str(body.endsAt, 40) || null,
        venue: str(body.venue, 120), address: str(body.address, 200),
        capacity: Number(body.capacity) || null,
        visibility: str(body.visibility, 20),
        ticketTypes: Array.isArray(body.ticketTypes) ? body.ticketTypes : null,
      });
    } catch (e) { return bad(e.message); }
    await store.set(`event:${event.id}`, event);
    await store.push(`user_events:${me.pid}`, event.id, 200);
    if (event.visibility === 'public') await store.push('public_events', event.id, 500);
    return ok({ ok: true, event: hosting.publicView(event, { userId: me.pid }),
      shareUrl: `${PUBLIC_URL(headers)}/e/${event.id}` });
  }

  if (p === '/events/mine' && method === 'GET') {
    const me = identity(headers);
    if (!me) return bad('session_required', 401);
    const own = (await store.get(`user_events:${me.pid}`)) || [];
    const list = (await Promise.all(own.map(e => store.get(`event:${e}`)))).filter(Boolean);
    return ok({ events: list.map(e => hosting.publicView(e, { userId: me.pid })) });
  }

  if (p === '/events/public' && method === 'GET') {
    const pub = (await store.get('public_events')) || [];
    const list = (await Promise.all(pub.slice(-40).map(e => store.get(`event:${e}`)))).filter(Boolean);
    return ok({ events: list.reverse().map(e => hosting.publicView(e, {})) });
  }

  if (seg[0] === 'events' && seg[1] && method === 'GET' && seg.length === 2) {
    const event = await store.get(`event:${seg[1]}`);
    if (!event) return bad('event_not_found', 404);
    const me = identity(headers);
    return ok({ event: hosting.publicView(event, { userId: me?.pid }) });
  }

  if (seg[0] === 'events' && seg[1] && seg[2] === 'rsvp' && method === 'POST') {
    const me = identity(headers);
    if (!me) return bad('session_required', 401);
    const event = await store.get(`event:${seg[1]}`);
    if (!event) return bad('event_not_found', 404);
    let res;
    try { res = hosting.rsvp(event, { id: me.pid, name: me.name, status: str(body.status, 20) }); }
    catch (e) { return bad(e.message); }
    if (!res.ok) return ok({ ok: false, reason: res.reason });
    await store.set(`event:${event.id}`, event);
    return ok({ ok: true, event: hosting.publicView(event, { userId: me.pid }) });
  }

  if (seg[0] === 'events' && seg[1] && seg[2] === 'staff' && method === 'POST') {
    const me = identity(headers);
    const event = await store.get(`event:${seg[1]}`);
    if (!event) return bad('event_not_found', 404);
    if (!hosting.can('staff.manage', { event, userId: me?.pid })) return bad('not_authorized', 403);
    try { hosting.addStaff(event, { id: str(body.id, 40) || ids.token(10), name: str(body.name, 60), role: str(body.role, 20) }); }
    catch (e) { return bad(e.message); }
    await store.set(`event:${event.id}`, event);
    return ok({ ok: true, event: hosting.publicView(event, { userId: me.pid }) });
  }

  if (seg[0] === 'events' && seg[1] && seg[2] === 'updates' && method === 'POST') {
    const me = identity(headers);
    const event = await store.get(`event:${seg[1]}`);
    if (!event) return bad('event_not_found', 404);
    if (!hosting.can('event.edit', { event, userId: me?.pid })) return bad('not_authorized', 403);
    event.updates.push({ text: str(body.text, 500), at: new Date().toISOString(), by: me.name });
    await store.set(`event:${event.id}`, event);
    return ok({ ok: true, event: hosting.publicView(event, { userId: me.pid }) });
  }

  // ── PLANZO TICKETS (spec §23–24) ────────────────────────────────────
  if (seg[0] === 'events' && seg[1] && seg[2] === 'claim' && method === 'POST') {
    const me = identity(headers);
    if (!me) return bad('session_required', 401);
    const event = await store.get(`event:${seg[1]}`);
    if (!event) return bad('event_not_found', 404);
    const type = (event.ticketTypes || []).find(t => t.id === str(body.ticketTypeId, 20))
      || event.ticketTypes[0];
    // Paid tickets need a payment provider. None is connected, so rather
    // than issue a ticket nobody paid for, this refuses and says why.
    if (type.price > 0) {
      return ok({ ok: false, reason: 'payment_not_connected',
        message: 'This is a paid ticket and no payment provider is connected yet, so Planzo will not issue it.' });
    }
    const already = ((await store.get(`event_tickets:${event.id}`)) || []);
    for (const tid of already) {
      const t = await store.get(`ticket:${tid}`);
      if (t && t.attendeeId === me.pid && t.status !== 'CANCELLED') {
        return ok({ ok: true, alreadyHad: true, ticket: await tickets.get(tid) });
      }
    }
    const issued = await tickets.issue({ eventId: event.id, attendeeName: me.name,
      attendeeId: me.pid, ticketType: type.name });
    await store.set(`ticket_owner:${me.pid}:${issued.ticket.id}`, issued.credential);
    await store.push(`user_tickets:${me.pid}`, issued.ticket.id, 200);
    hosting.rsvp(event, { id: me.pid, name: me.name, status: 'going' });
    await store.set(`event:${event.id}`, event);
    return ok({ ok: true, ticket: issued.ticket, credential: issued.credential });
  }

  if (p === '/tickets/mine' && method === 'GET') {
    const me = identity(headers);
    if (!me) return bad('session_required', 401);
    const list = (await store.get(`user_tickets:${me.pid}`)) || [];
    const out = [];
    for (const id of list) {
      const t = await tickets.get(id);
      if (!t) continue;
      const event = await store.get(`event:${t.eventId}`);
      out.push({ ...t, credential: await store.get(`ticket_owner:${me.pid}:${id}`),
        event: event ? { title: event.title, startsAt: event.startsAt, venue: event.venue, address: event.address } : null });
    }
    return ok({ tickets: out.reverse() });
  }

  // ── EXPENSES (spec §26) ─────────────────────────────────────────────
  if (seg[0] === 'plans' && seg[1] && seg[2] === 'expenses' && method === 'GET') {
    const plan = await store.get(`plan:${seg[1]}`);
    if (!plan) return bad('plan_not_found', 404);
    const ledger = (await store.get(`expenses:${plan.id}`)) || [];
    const people = plan.participants.map(x => ({ id: x.id, name: x.name }));
    return ok({ ledger, balances: expenses.balances(ledger, people), settle: expenses.settleUp(ledger, people) });
  }

  if (seg[0] === 'plans' && seg[1] && seg[2] === 'expenses' && method === 'POST') {
    const me = identity(headers);
    const plan = await store.get(`plan:${seg[1]}`);
    if (!plan) return bad('plan_not_found', 404);
    if (!me || !plan.participants.some(x => x.id === me.pid)) return bad('not_a_participant', 403);
    const people = plan.participants
      .filter(x => !Array.isArray(body.participantIds) || body.participantIds.includes(x.id))
      .map(x => ({ id: x.id, name: x.name }));
    let ledger = (await store.get(`expenses:${plan.id}`)) || [];
    try {
      ledger = expenses.addExpense(ledger, {
        id: ids.token(8), label: str(body.label, 60),
        amountCents: Math.round(Number(body.amount) * 100),
        paidBy: str(body.paidBy, 40) || me.pid, participants: people,
      });
    } catch (e) { return bad(e.message); }
    await store.set(`expenses:${plan.id}`, ledger);
    const all = plan.participants.map(x => ({ id: x.id, name: x.name }));
    return ok({ ok: true, ledger, balances: expenses.balances(ledger, all), settle: expenses.settleUp(ledger, all) });
  }

  // ── CALENDAR + REMINDERS (spec §27–28) ──────────────────────────────
  if (seg[0] === 'plans' && seg[1] && seg[2] === 'calendar.ics' && method === 'GET') {
    const plan = await store.get(`plan:${seg[1]}`);
    if (!plan || !plan.finalPlan) return bad('plan_not_found', 404);
    return { status: 200, body: calendar.planToIcs(plan, plan.finalPlan),
      headers: { 'Content-Type': 'text/calendar; charset=utf-8',
                 'Content-Disposition': `attachment; filename="planzo-${plan.code}.ics"` } };
  }

  if (seg[0] === 'events' && seg[1] && seg[2] === 'calendar.ics' && method === 'GET') {
    const event = await store.get(`event:${seg[1]}`);
    if (!event) return bad('event_not_found', 404);
    return { status: 200, body: calendar.eventToIcs(event),
      headers: { 'Content-Type': 'text/calendar; charset=utf-8',
                 'Content-Disposition': `attachment; filename="planzo-event.ics"` } };
  }

  if (seg[0] === 'plans' && seg[1] && seg[2] === 'reminders' && method === 'GET') {
    const plan = await store.get(`plan:${seg[1]}`);
    if (!plan) return bad('plan_not_found', 404);
    return ok({ reminders: calendar.remindersFor(plan, plan.finalPlan) });
  }

  if (seg[0] === 'plans' && seg[1] && seg[2] === 'remind' && method === 'POST') {
    const gate = await rl.check('reminder', ip);
    if (!gate.ok) return bad('rate_limited', 429);
    const me = identity(headers);
    const plan = await store.get(`plan:${seg[1]}`);
    if (!plan) return bad('plan_not_found', 404);
    if (!me || me.pid !== plan.creatorId) return bad('not_authorized', 403);
    const who = str(body.name, 60);
    // Honest about the channel: with no email or push provider configured,
    // a reminder is recorded, not delivered.
    const log = (await store.get(`reminders:${plan.id}`)) || [];
    log.push({ name: who, at: new Date().toISOString(), delivered: false, channel: 'none_configured' });
    await store.set(`reminders:${plan.id}`, log);
    return ok({ ok: true, delivered: false,
      message: `No email or push provider is connected, so we can't deliver this. Nudge ${who} yourself — the plan link is enough.` });
  }

  // ── TRIPS (spec §12) ────────────────────────────────────────────────
  if (seg[0] === 'plans' && seg[1] && seg[2] === 'trip' && method === 'POST') {
    const me = identity(headers);
    const plan = await store.get(`plan:${seg[1]}`);
    if (!plan) return bad('plan_not_found', 404);
    if (!me || me.pid !== plan.creatorId) return bad('not_authorized', 403);
    const trip = await trips.generate(plan, {
      destination: body.destination && Number.isFinite(body.destination.lat)
        ? { lat: +body.destination.lat, lon: +body.destination.lon, label: str(body.destination.label, 80) }
        : null,
      startDate: str(body.startDate, 20), nights: Math.min(6, Math.max(1, Number(body.nights) || 2)),
      origin: plan.origin,
    });
    plan.trip = trip;
    await store.set(`plan:${plan.id}`, plan);
    return ok({ ok: true, trip });
  }

  // ── SEARCH + PUBLIC DISCOVERY (spec §19, §40, §49) ──────────────────
  if (p === '/search' && method === 'GET') {
    const q = str(url.searchParams.get('q'), 160);
    if (!q) return bad('query_required');
    return ok(await search.run(q, {
      lat: parseFloat(url.searchParams.get('lat')),
      lon: parseFloat(url.searchParams.get('lon')),
    }));
  }

  if (p === '/plans/public' && method === 'GET') {
    const list = (await store.get('public_plans')) || [];
    const plans = (await Promise.all(list.slice(-30).map(c => store.get(`plan:${c}`)))).filter(Boolean);
    return ok({ plans: plans.reverse().map(pl => ({
      code: pl.code, title: pl.title, creatorName: pl.creatorName,
      date: pl.date, going: pl.participants.filter(x => x.answers?.availability === "I'm in").length,
      total: pl.participants.length,
      spotsOpen: pl.maxSize ? Math.max(0, pl.maxSize - pl.participants.length) : null,
    })) });
  }

  if (seg[0] === 'plans' && seg[1] && seg[2] === 'visibility' && method === 'POST') {
    const me = identity(headers);
    const plan = await store.get(`plan:${seg[1]}`);
    if (!plan) return bad('plan_not_found', 404);
    if (!me || me.pid !== plan.creatorId) return bad('not_authorized', 403);
    plan.visibility = body.visibility === 'public' ? 'public' : 'private';
    plan.maxSize = Number(body.maxSize) || null;
    await store.set(`plan:${plan.id}`, plan);
    if (plan.visibility === 'public') await store.push('public_plans', plan.code, 300);
    return ok({ ok: true, visibility: plan.visibility });
  }

  // ── ADMIN / OPS ─────────────────────────────────────────────────────
  if (p === '/admin/cost' && method === 'GET') {
    if (!adminOk(url)) return bad('not_authorized', 403);
    return ok(await cost.report());
  }
  if (p === '/admin/waitlist' && method === 'GET') {
    if (!adminOk(url)) return bad('not_authorized', 403);
    const index = (await store.get('waitlist:index')) || [];
    return ok({ count: index.length, signups: index.slice().reverse() });
  }
  if (p === '/health' && method === 'GET') {
    return ok({
      ok: true, at: new Date().toISOString(),
      storage: store.remote ? 'redis' : 'files',
      ai: require('../services/ai').enabled(),
      places: places.enabled(),
      spend: (await cost.report()).services,
    });
  }

  return bad('not_found', 404);
}

function adminOk(url) {
  const key = process.env.PLANZO_ADMIN_KEY || '';
  return Boolean(key) && url.searchParams.get('key') === key;
}

/** Never leaks participant ids, emails or raw session material. */
function publicPlan(plan) {
  return {
    code: plan.code, title: plan.title, idea: plan.idea, date: plan.date,
    creatorName: plan.creatorName, status: plan.status, visibility: plan.visibility,
    intent: { needsFood: plan.intent?.needsFood, categories: plan.intent?.categories, groupSize: plan.intent?.groupSize },
    participants: plan.participants.map(x => ({ name: x.name, answered: Object.keys(x.answers || {}).length > 0 })),
    finalPlan: plan.finalPlan,
    createdAt: plan.createdAt,
  };
}

module.exports = { handle };
