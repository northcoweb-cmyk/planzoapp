/**
 * LOCAL backend — the standalone file. The engine runs in the browser and
 * everything persists to localStorage.
 *
 * Where a capability genuinely needs a server it says so, in the UI, with
 * the reason. It never pretends. The two honest gaps are link sharing
 * (there is nowhere to share to) and Google Places (a key in a downloadable
 * file would leak).
 */
(function(){
'use strict';

const intent    = require('./intent');
const questions = require('./questions');
const consensus = require('./consensus');
const planEng   = require('./plan');
const tripsEng  = require('./trips');
const searchEng = require('./search');
const weatherSvc= require('../services/weather');
const ticketsEng= require('./tickets');
const hosting   = require('./hosting');
const memoryEng = require('./memory');
const expensesEng=require('./expenses');
const calendarEng=require('./calendar');
const eventsSvc = require('../services/events');
const qr        = require('../lib/qr');

const DB = 'planzo.local.v2';
const blank = { plans:{}, groups:{}, events:{}, tickets:{}, credentials:{}, memory:[], expenses:{}, me:null, origin:null };
let db;
try { db = Object.assign({}, blank, JSON.parse(localStorage.getItem(DB)) || {}); } catch { db = { ...blank }; }
const save = () => { try { localStorage.setItem(DB, JSON.stringify(db)); } catch {} };
const uid = () => Math.random().toString(36).slice(2, 10);

/** Shape a stored plan the way the API's publicPlan() does, so the UI is identical. */
function shape(plan){
  const st = consensus.build(plan);
  return {
    code: plan.id, title: plan.title, idea: plan.idea, date: plan.date,
    creatorName: db.me?.name, status: plan.finalPlan ? 'planned' : 'collecting',
    visibility: plan.visibility || 'private',
    intent: plan.intent,
    participants: plan.participants.map(p => ({ id: p.id, name: p.name,
      answered: Object.keys(p.answers || {}).length > 0 })),
    finalPlan: plan.finalPlan, trip: plan.trip, confirmed: st.confirmedCount,
    createdAt: plan.createdAt,
  };
}

function statusOf(plan){
  const st = consensus.build(plan);
  return {
    roster: plan.participants.map(p => {
      const a = p.answers || {};
      return { name: p.name, isCreator: !!p.isCreator,
        status: a.availability === "I'm in" ? 'Confirmed'
              : a.availability === 'Maybe' ? 'Maybe'
              : a.availability === "Can't make it" ? 'Out'
              : Object.keys(a).length ? 'Responding' : 'Waiting' };
    }),
    confirmed: st.confirmedCount, total: plan.participants.length,
    waitingOn: st.waitingOn, readyToPlan: st.readyToPlan,
    leaning: questions.publicState(st).leaning,
  };
}

const people = plan => plan.participants.map(p => ({ id: p.id, name: p.name }));

window.PlanzoBackend = {
  // The organizer answers for everyone here, because there is no link to send.
  canAnswerAs: true,

  async caps(){
    return {
      sharing: false, publicPlans: false, reminders: true,
      signInNote: 'Everything stays in this browser. Nothing is uploaded anywhere.',
      sharingNote: 'Sharing a link needs the server build — there is nowhere for a link to point. '
        + 'Add people here and answer as each; the engine behaves identically.',
      paymentsNote: 'No payment provider is connected, so Planzo will not take money or issue a paid ticket.',
      remindersNote: 'Reminders are shown here. Sending them needs an email or push provider.',
      places: false, ai: false,
    };
  },

  async me(){ return db.me; },
  async signIn(name){ db.me = { id: uid(), name }; save(); return db.me; },
  isCreator(){ return true; },

  async getLocation(){ return db.origin; },
  requestLocation(force){
    return new Promise(resolve => {
      if (!force && db.origin) return resolve(db.origin);
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(pos => {
        db.origin = { lat:+pos.coords.latitude.toFixed(4), lon:+pos.coords.longitude.toFixed(4), label:'Your location' };
        save(); resolve(db.origin);
      }, () => resolve(null), { timeout: 8000, maximumAge: 600000 });
    });
  },

  shareUrl(){ return null; },                       // honest: nothing to share to
  eventUrl(id){ return location.href.split('#')[0] + '#/e/' + id; },

  async createPlan(idea){
    const parsed = await intent.extract(idea);
    const id = uid();
    db.plans[id] = {
      id, code: id, idea, intent: parsed, title: parsed.title,
      origin: db.origin, date: null, finalPlan: null, trip: null, visibility: 'private',
      participants: [{ id: db.me.id, name: db.me.name, answers: {}, isCreator: true }],
      createdAt: new Date().toISOString(),
    };
    save();
    return shape(db.plans[id]);
  },
  async listPlans(){
    return Object.values(db.plans)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .map(shape);
  },
  async getPlan(code){
    const plan = db.plans[code];
    return plan ? { plan: shape(plan), status: statusOf(plan) } : null;
  },
  async nextQuestion(code, pid){
    const plan = db.plans[code];
    if (!plan) return { done: true };
    const who = plan.participants.find(p => p.id === pid) || plan.participants[0];
    return questions.next(plan, who);
  },
  async answer(code, questionId, value, pid){
    const plan = db.plans[code];
    const who = plan.participants.find(p => p.id === pid) || plan.participants[0];
    who.answers = { ...who.answers, [questionId]: value };
    who.answeredAt = new Date().toISOString();
    // Learning happens here, exactly as it would server-side.
    if (who.id === db.me.id) db.memory = memoryEng.learnFromPlan(db.memory, plan, who.id);
    save();
    return questions.next(plan, who);
  },
  async generate(code){
    const plan = db.plans[code];
    plan.finalPlan = await planEng.generate(plan, { origin: plan.origin || db.origin });
    save();
    return plan.finalPlan;
  },
  async addParticipant(code, name){
    const p = { id: uid(), name, answers: {} };
    db.plans[code].participants.push(p);
    save();
    return p;
  },
  async setVisibility(){ return { ok: false }; },
  async publicPlans(){ return { plans: [] }; },
  async remind(code, name){
    return { ok: true, delivered: false,
      message: `Nothing is connected to send this through, so ${name} won't get a message. `
        + `In the server build this is an email or a push notification.` };
  },

  async expenses(code){
    const plan = db.plans[code];
    const ledger = db.expenses[code] || [];
    return { ledger, balances: expensesEng.balances(ledger, people(plan)),
             settle: expensesEng.settleUp(ledger, people(plan)) };
  },
  async addExpense(code, e){
    const plan = db.plans[code];
    const chosen = people(plan).filter(p => !e.participantIds || e.participantIds.includes(p.id));
    db.expenses[code] = expensesEng.addExpense(db.expenses[code] || [], {
      id: uid(), label: e.label, amountCents: Math.round(e.amount * 100),
      paidBy: e.paidBy, participants: chosen,
    });
    save();
    return this.expenses(code);
  },
  async calendarIcs(code){
    const plan = db.plans[code];
    return plan?.finalPlan ? calendarEng.planToIcs(plan, plan.finalPlan) : null;
  },
  async reminders(code){
    const plan = db.plans[code];
    return plan ? calendarEng.remindersFor(plan, plan.finalPlan) : [];
  },
  async trip(code, opts){
    const plan = db.plans[code];
    plan.trip = await tripsEng.generate(plan, { ...opts, origin: plan.origin || db.origin });
    save();
    return plan.trip;
  },

  async groups(){ return { groups: Object.values(db.groups) }; },
  async createGroup(name){
    const id = uid();
    db.groups[id] = { id, name, ownerId: db.me.id,
      members: [{ id: db.me.id, name: db.me.name, role: 'owner' }],
      planIds: [], createdAt: new Date().toISOString() };
    save();
    return { ok: true, group: db.groups[id] };
  },
  async getGroup(id){
    const group = db.groups[id];
    if (!group) return null;
    const plans = (group.planIds || []).map(c => db.plans[c]).filter(Boolean);
    return { group, profile: memoryEng.groupProfile(plans), plans: plans.map(shape) };
  },
  async addGroupMember(id, name){
    db.groups[id].members.push({ id: uid(), name, role: 'member' });
    save();
    return { ok: true };
  },

  async memory(){ return { memories: memoryEng.prune(db.memory) }; },
  async remember(category, value){
    db.memory = memoryEng.observe(db.memory, { category, value, scope:'user',
      stability:'stable', source:'explicit' });
    save();
    return { ok: true };
  },
  async forget(id){
    db.memory = db.memory.filter(m => m.id !== id);
    save();
    return { ok: true };
  },

  async createEvent(e){
    const id = uid();
    let event;
    try { event = hosting.createEvent({ ...e, id, ownerId: db.me.id, ownerName: db.me.name }); }
    catch (err) { return { ok: false, message: err.message }; }
    db.events[id] = event;
    save();
    return { ok: true, event: hosting.publicView(event, { userId: db.me.id }) };
  },
  async myEvents(){
    return { events: Object.values(db.events)
      .filter(e => e.ownerId === db.me.id)
      .map(e => hosting.publicView(e, { userId: db.me.id })) };
  },
  async publicEvents(){
    return { events: Object.values(db.events)
      .filter(e => e.visibility === 'public')
      .map(e => hosting.publicView(e, { userId: db.me.id })) };
  },
  async getEvent(id){
    const e = db.events[id];
    return e ? { event: hosting.publicView(e, { userId: db.me.id }) } : null;
  },
  async rsvp(id, status){
    const res = hosting.rsvp(db.events[id], { id: db.me.id, name: db.me.name, status });
    save();
    return res.ok ? { ok: true } : { ok: false, reason: res.reason };
  },
  async addStaff(id, s){
    hosting.addStaff(db.events[id], { id: s.id || uid(), name: s.name, role: s.role });
    save();
    return { ok: true };
  },
  async addUpdate(id, text){
    db.events[id].updates.push({ text, at: new Date().toISOString(), by: db.me.name });
    save();
    return { ok: true };
  },
  async eventStats(id){
    const list = Object.values(db.tickets).filter(t => t.eventId === id);
    return {
      issued: list.length,
      checkedIn: list.filter(t => t.status === 'CHECKED_IN').length,
      active: list.filter(t => t.status === 'ACTIVE').length,
      cancelled: list.filter(t => ['CANCELLED','INVALIDATED'].includes(t.status)).length,
    };
  },
  async eventIcs(id){ return calendarEng.eventToIcs(db.events[id]); },
  async externalEvents(){ return eventsSvc.search(); },

  async claimTicket(eventId){
    const event = db.events[eventId];
    const type = event.ticketTypes[0];
    if (type.price > 0){
      return { ok: false, message: 'This is a paid ticket and no payment provider is connected, '
        + 'so Planzo will not issue it.' };
    }
    const existing = Object.values(db.tickets)
      .find(t => t.eventId === eventId && t.attendeeId === db.me.id && t.status !== 'CANCELLED');
    if (existing) return { ok: true, ticket: existing };

    // Same issuing path as the server: random credential, only its hash stored.
    const id = uid();
    const raw = uid() + uid() + uid();
    db.tickets[id] = { id, eventId, attendeeId: db.me.id, attendeeName: db.me.name,
      ticketType: type.name, status: 'ACTIVE', issuedAt: new Date().toISOString(),
      checkedInAt: null, credentialHash: hashOf(`${id}.${raw}`) };
    db.credentials[id] = `${id}.${raw}`;
    hosting.rsvp(event, { id: db.me.id, name: db.me.name, status: 'going' });
    save();
    return { ok: true, ticket: db.tickets[id] };
  },
  async myTickets(){
    return { tickets: Object.values(db.tickets)
      .filter(t => t.attendeeId === db.me.id)
      .map(t => ({ ...t, credential: db.credentials[t.id],
        event: db.events[t.eventId] ? {
          title: db.events[t.eventId].title, startsAt: db.events[t.eventId].startsAt,
          venue: db.events[t.eventId].venue, address: db.events[t.eventId].address } : null }))
      .reverse() };
  },
  async getTicket(id){
    const t = db.tickets[id];
    if (!t) return null;
    const e = db.events[t.eventId];
    return { ...t, credential: db.credentials[id],
      event: e ? { title: e.title, startsAt: e.startsAt, venue: e.venue, address: e.address } : null };
  },
  async checkIn(eventId, credential){
    const event = db.events[eventId];
    if (!event) return { result: 'INVALID_EVENT' };
    const role = hosting.roleOf(event, null, db.me.id);
    if (!hosting.can('ticket.checkin', { event, userId: db.me.id })) return { result: 'NOT_AUTHORIZED' };

    const id = String(credential).split('.')[0];
    const t = db.tickets[id];
    if (!t || t.credentialHash !== hashOf(credential)) return { result: 'INVALID_TICKET' };
    if (t.eventId !== eventId) return { result: 'INVALID_EVENT' };
    if (['CANCELLED','REFUNDED'].includes(t.status)) return { result: 'TICKET_CANCELLED' };
    if (t.status === 'CHECKED_IN')
      return { result: 'ALREADY_USED', attendeeName: t.attendeeName, checkedInAt: t.checkedInAt };
    if (t.status !== 'ACTIVE') return { result: 'INVALID_TICKET' };

    t.status = 'CHECKED_IN';
    t.checkedInAt = new Date().toISOString();
    save();
    return { result: 'ENTRY_GRANTED', attendeeName: t.attendeeName,
             ticketType: t.ticketType, checkedInAt: t.checkedInAt };
  },

  async search(q, o){ return searchEng.run(q, o || {}); },
  async weather(lat, lon){ return weatherSvc.forecast(lat, lon); },
  async health(){
    return { services: {
      storage:         { on: true,  note: 'this browser' },
      'venue search':  { on: false, note: 'needs a server-side key' },
      AI:              { on: false, note: '$0 spend' },
      weather:         { on: true,  note: 'Open-Meteo, free' },
      'link sharing':  { on: false, note: 'needs the server build' },
      payments:        { on: false, note: 'not connected' },
    } };
  },
  qrSvg(text){ return qr.toSvg(text, { size: 200 }); },
  async reset(){ localStorage.removeItem(DB); db = { ...blank }; },
};

/** Non-cryptographic digest — enough to bind a credential to a ticket locally. */
function hashOf(v){
  let h = 0x811c9dc5;
  const s = String(v);
  for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
}
})();
