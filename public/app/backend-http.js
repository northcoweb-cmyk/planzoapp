/**
 * HTTP backend — the server build. Everything goes through /api, so this
 * is the path that supports real link sharing and cross-device check-in.
 */
(function(){
'use strict';
let session = localStorage.getItem('planzo.session') || '';
let meCache = JSON.parse(localStorage.getItem('planzo.me') || 'null');
let origin = JSON.parse(localStorage.getItem('planzo.origin') || 'null');

async function api(path, opts = {}){
  const res = await fetch('/api' + path, {
    ...opts,
    headers: { 'Content-Type':'application/json',
      ...(session ? { 'X-Planzo-Session': session } : {}), ...(opts.headers || {}) },
  });
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('json') ? await res.json().catch(() => ({})) : await res.text();
  return { ok: res.ok, status: res.status, body };
}
const post = (p, b) => api(p, { method:'POST', body: JSON.stringify(b || {}) });

window.PlanzoBackend = {
  canAnswerAs: false,

  async caps(){
    const h = await api('/health');
    return {
      sharing: true, publicPlans: true, reminders: true,
      signInNote: 'Google sign-in arrives with the native app. For now this is a name-based identity.',
      sharingNote: '',
      paymentsNote: 'No payment provider is connected yet, so Planzo will not take money or issue a paid ticket.',
      remindersNote: 'No email or push provider is connected, so reminders are shown here rather than sent.',
      places: h.body.places, ai: h.body.ai,
    };
  },

  async me(){
    if (meCache) return meCache;
    // Someone who joined a plan from a shared link already has a session but
    // has never opened the app. Recover their identity from it rather than
    // making them introduce themselves twice. The payload is their own signed
    // identity; the signature still gates every request server-side.
    if (session && session.includes('.')){
      try {
        const payload = JSON.parse(atob(session.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload && payload.pid && payload.name && (!payload.exp || payload.exp > Date.now())){
          meCache = { id: payload.pid, name: payload.name };
          localStorage.setItem('planzo.me', JSON.stringify(meCache));
          return meCache;
        }
      } catch {}
    }
    return null;
  },
  async signIn(name){
    const r = await post('/session', { name });
    if (!r.ok) return null;
    session = r.body.session;
    meCache = r.body.participant;
    localStorage.setItem('planzo.session', session);
    localStorage.setItem('planzo.me', JSON.stringify(meCache));
    return meCache;
  },
  isCreator(plan){ return meCache && plan.creatorName === meCache.name; },

  async getLocation(){ return origin; },
  requestLocation(force){
    return new Promise(resolve => {
      if (!force && origin) return resolve(origin);
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(pos => {
        origin = { lat:+pos.coords.latitude.toFixed(4), lon:+pos.coords.longitude.toFixed(4), label:'Your location' };
        localStorage.setItem('planzo.origin', JSON.stringify(origin));
        resolve(origin);
      }, () => resolve(null), { timeout: 8000, maximumAge: 600000 });
    });
  },

  shareUrl(code){ return location.origin + '/p/' + code; },
  eventUrl(id){ return location.origin + '/app#/e/' + id; },

  async createPlan(idea){
    const r = await post('/plans', { idea, origin });
    if (!r.ok) return null;
    const codes = JSON.parse(localStorage.getItem('planzo.plans') || '[]');
    codes.push(r.body.plan.code);
    localStorage.setItem('planzo.plans', JSON.stringify(codes));
    return r.body.plan;
  },
  async listPlans(){
    const codes = JSON.parse(localStorage.getItem('planzo.plans') || '[]');
    const loaded = await Promise.all(codes.slice(-40).reverse().map(c => api('/plans/' + c)));
    return loaded.filter(r => r.ok).map(r => r.body.plan);
  },
  async getPlan(code){
    const [p, s] = await Promise.all([api('/plans/' + code), api(`/plans/${code}/status`)]);
    if (!p.ok) return null;
    return { plan: p.body.plan, status: s.body };
  },
  async nextQuestion(code){ const r = await api(`/plans/${code}/question`); return r.ok ? r.body : { done: true }; },
  async answer(code, questionId, value){
    const r = await post(`/plans/${code}/answer`, { questionId, value });
    return r.ok ? r.body : { done: true };
  },
  async generate(code){ const r = await post(`/plans/${code}/generate`); return r.ok ? r.body.finalPlan : null; },
  async addParticipant(){ return null; },   // server build shares a link instead
  async setVisibility(code, visibility){ return (await post(`/plans/${code}/visibility`, { visibility })).body; },
  async publicPlans(){ return (await api('/plans/public')).body; },
  async remind(code, name){ return (await post(`/plans/${code}/remind`, { name })).body; },

  async expenses(code){ return (await api(`/plans/${code}/expenses`)).body; },
  async addExpense(code, e){ return (await post(`/plans/${code}/expenses`, e)).body; },
  async calendarIcs(code){ const r = await api(`/plans/${code}/calendar.ics`); return r.ok ? r.body : null; },
  async reminders(code){ return (await api(`/plans/${code}/reminders`)).body.reminders || []; },
  async trip(code, opts){ return (await post(`/plans/${code}/trip`, opts)).body.trip; },

  async groups(){ return (await api('/groups')).body; },
  async createGroup(name){ return (await post('/groups', { name })).body; },
  async getGroup(id){ const r = await api('/groups/' + id); return r.ok ? r.body : null; },
  async addGroupMember(id, name){ return (await post(`/groups/${id}/members`, { name })).body; },

  async memory(){ return (await api('/me/memory')).body; },
  async remember(category, value){ return (await post('/me/memory', { category, value })).body; },
  async forget(id){ return (await api('/me/memory/' + encodeURIComponent(id), { method:'DELETE' })).body; },

  async createEvent(e){ return (await post('/events', e)).body; },
  async myEvents(){ return (await api('/events/mine')).body; },
  async publicEvents(){ return (await api('/events/public')).body; },
  async getEvent(id){ const r = await api('/events/' + id); return r.ok ? r.body : null; },
  async rsvp(id, status){ return (await post(`/events/${id}/rsvp`, { status })).body; },
  async addStaff(id, s){ return (await post(`/events/${id}/staff`, s)).body; },
  async addUpdate(id, text){ return (await post(`/events/${id}/updates`, { text })).body; },
  async eventStats(id){ const r = await api(`/events/${id}/stats`); return r.ok ? r.body : null; },
  async eventIcs(id){ const r = await api(`/events/${id}/calendar.ics`); return r.ok ? r.body : null; },
  async externalEvents(){ return (await api('/events/external')).body; },

  async claimTicket(eventId){ return (await post(`/events/${eventId}/claim`)).body; },
  async myTickets(){ return (await api('/tickets/mine')).body; },
  async getTicket(id){
    const { tickets } = (await api('/tickets/mine')).body;
    return (tickets || []).find(t => t.id === id) || null;
  },
  async checkIn(eventId, credential){ return (await post('/tickets/checkin', { eventId, credential })).body; },

  async search(q, o){
    const p = new URLSearchParams({ q });
    if (o){ p.set('lat', o.lat); p.set('lon', o.lon); }
    return (await api('/search?' + p)).body;
  },
  async weather(lat, lon){ return (await api(`/weather?lat=${lat}&lon=${lon}`)).body; },
  async health(){
    const h = (await api('/health')).body;
    return {
      services: {
        storage: { on: true, note: h.storage },
        'venue search': { on: h.places, note: h.places ? null : 'no key — venues unverified' },
        AI: { on: h.ai, note: h.ai ? 'capped' : '$0 spend' },
        weather: { on: true, note: 'Open-Meteo, free' },
        payments: { on: false, note: 'not connected' },
      },
      spend: h.spend,
    };
  },
  qrSvg(text){ return window.PlanzoQR.toSvg(text, { size: 200 }); },
  async reset(){
    localStorage.clear();
    session = ''; meCache = null; origin = null;
  },
};
})();
