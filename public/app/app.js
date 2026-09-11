/**
 * PLANZO APP — every screen.
 *
 * This file is shared by both builds. The host page injects a backend:
 *
 *   window.PlanzoBackend = LocalBackend   (standalone file — engine in-browser)
 *   window.PlanzoBackend = HttpBackend    (server build — talks to /api)
 *
 * Screens never call fetch or touch the engine directly. They ask the
 * backend, and the backend declares what it can actually do via caps().
 * A capability that is off is stated in the UI with the reason — the app
 * never silently hides a feature or fakes it.
 */
(function(){
'use strict';

const B = window.PlanzoBackend;
const R = window.PlanzoRender;
const esc = R.esc;
const view = document.getElementById('view');
const $ = id => document.getElementById(id);

let me = null, caps = {}, tab = 'home';
let answeringAs = null;   // local backend only: whose questions we're answering

// ── shared UI atoms ────────────────────────────────────────────────────
const notice = (t, cls = '') => `<div class="notice ${cls}">${t}</div>`;
const initials = n => (n || '?').trim().slice(0, 1).toUpperCase();
const money = c => `$${(c / 100).toFixed(2)}`;
const spinner = '<span class="spinner"></span>';

function when(iso, opts){
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString([], opts || { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
}

function busy(btn, label){
  btn.disabled = true;
  const old = btn.innerHTML;
  btn.innerHTML = spinner + ' ' + label;
  return () => { btn.disabled = false; btn.innerHTML = old; };
}

function sheet(title, inner, onMount){
  const wrap = document.createElement('div');
  wrap.className = 'sheet-backdrop';
  wrap.innerHTML = `<div class="sheet glass rise" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="between" style="margin-bottom:16px">
        <h3>${esc(title)}</h3>
        <button class="btn btn-quiet" data-close style="min-height:36px;padding:0 8px">Close</button>
      </div>
      <div id="sheet-body">${inner}</div>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  if (onMount) onMount(close);
  return close;
}

/** Trigger a file download from a string. Used for .ics and CSV. */
function download(filename, text, mime){
  const url = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function share(title, text, url){
  if (navigator.share) { try { await navigator.share({ title, text, url }); return 'shared'; } catch {} }
  try { await navigator.clipboard.writeText(url); return 'copied'; } catch { return 'failed'; }
}

function flash(btn, label, revert){
  const old = btn.textContent;
  btn.textContent = label;
  setTimeout(() => { btn.textContent = revert || old; }, 2000);
}

// ══════════════════════════════════════════════════════════════════════
// SCREENS
// ══════════════════════════════════════════════════════════════════════
const SCREENS = {};

// ── 1. Splash / sign in ───────────────────────────────────────────────
SCREENS.welcome = function(){
  view.innerHTML = `
    <div class="stack g24 rise" style="padding-top:52px">
      <div class="stack g12">
        <div class="mark" style="width:58px;height:58px;border-radius:19px;font-size:30px">P</div>
        <h1 style="font-size:38px">Planzo</h1>
        <p class="muted" style="font-size:17px">Send the idea. We&rsquo;ll make the plan.</p>
      </div>
      <div class="field">
        <label for="on-name">What&rsquo;s your name?</label>
        <input class="input" id="on-name" placeholder="Ryan" enterkeyhint="go" maxlength="40">
      </div>
      <button class="btn btn-primary btn-block" id="on-go">Get started</button>
      <p class="tiny muted" style="text-align:center">${esc(caps.signInNote || '')}</p>
    </div>`;
  const go = async () => {
    const n = $('on-name').value.trim();
    if (!n) return;
    const done = busy($('on-go'), 'Setting up&hellip;');
    me = await B.signIn(n);
    if (!me) return done();
    B.requestLocation();
    if (!routeHash()) render('home');
  };
  $('on-go').onclick = go;
  $('on-name').onkeydown = e => { if (e.key === 'Enter') go(); };
  $('on-name').focus();
};

// ── 2. Home ───────────────────────────────────────────────────────────
SCREENS.home = async function(){
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  view.innerHTML = `
    <div class="stack g24">
      <div class="stack g8">
        <p class="muted tiny">${greet}, ${esc(me.name)} &#128075;</p>
        <h1 style="font-size:30px">What are we doing?</h1>
      </div>
      <div class="card stack g12">
        <textarea class="input" id="h-idea" rows="2"
          placeholder="Beach Saturday with 6 friends&hellip; / Something free tonight&hellip; / Dinner before the concert"></textarea>
        <div class="quick" id="h-quick"></div>
        <button class="btn btn-primary btn-block" id="h-go">Start planning</button>
      </div>
      <div id="h-weather"></div>
      <div id="h-tickets"></div>
      <div class="stack g12">
        <div class="between"><strong>Your plans</strong><button class="btn btn-quiet" id="h-all">See all</button></div>
        <div id="h-plans" class="stack g12"><p class="muted tiny">Loading&hellip;</p></div>
      </div>
      <div class="stack g12">
        <div class="between"><strong>Events near you</strong><button class="btn btn-quiet" id="h-ev">See all</button></div>
        <div id="h-events" class="stack g12"></div>
      </div>
    </div>`;

  const quick = ['Dinner tonight','Something free','Beach Saturday','Nightlife tonight','Date night','Weekend trip'];
  $('h-quick').innerHTML = quick.map(q => `<button data-q="${esc(q)}">${esc(q)}</button>`).join('');
  $('h-quick').onclick = e => { const b = e.target.closest('[data-q]'); if (b) $('h-idea').value = b.dataset.q; };
  $('h-go').onclick = () => createPlan($('h-idea').value.trim());
  $('h-all').onclick = () => render('plans');
  $('h-ev').onclick = () => render('events');

  renderWeather('h-weather');
  renderPlanList('h-plans', 4);
  renderMyTickets('h-tickets');
  renderEventList('h-events', 2);
};

SCREENS.create = function(){ render('home'); setTimeout(() => $('h-idea') && $('h-idea').focus(), 60); };

// ── 3. Discover + 4. Search ───────────────────────────────────────────
SCREENS.discover = async function(){
  view.innerHTML = `
    <div class="stack g24">
      <h1 style="font-size:30px">Discover</h1>
      <input class="input" id="d-q" placeholder="Free stuff near me tonight" enterkeyhint="search">
      <div class="quick" id="d-quick"></div>
      <div id="d-weather"></div>
      <div id="d-out" class="stack g12"></div>
    </div>`;
  const chips = ['Concerts this weekend','Cheap date ideas','Restaurants under $20','Things to do near me','Free events'];
  $('d-quick').innerHTML = chips.map(c => `<button data-q="${esc(c)}">${esc(c)}</button>`).join('');
  $('d-quick').onclick = e => { const b = e.target.closest('[data-q]'); if (b) { $('d-q').value = b.dataset.q; runSearch(); } };
  $('d-q').onkeydown = e => { if (e.key === 'Enter') runSearch(); };
  renderWeather('d-weather');
  runSearch();
};

async function runSearch(){
  const out = $('d-out');
  if (!out) return;
  const q = ($('d-q').value || '').trim() || 'things to do near me';
  out.innerHTML = `<p class="muted tiny">Searching&hellip;</p>`;
  const origin = await B.getLocation();
  const res = await B.search(q, origin);

  const f = res.filters || {};
  const chips = [
    f.free ? 'Free only' : null,
    f.maxPrice ? `Under $${f.maxPrice}` : null,
    f.when ? `When: ${f.when}` : null,
    f.timeOfDay || null,
    ...(f.categories || []),
  ].filter(Boolean);

  out.innerHTML = `
    ${chips.length ? `<div class="row" style="gap:6px">${chips.map(c => `<span class="badge brand">${esc(c)}</span>`).join('')}</div>` : ''}
    ${(res.sections || []).map(sec => {
      if (!sec.available) return notice(esc(sec.message || `${sec.kind} unavailable`));
      return `<div class="stack g12">${sec.results.map(p => placeCard(p)).join('')}</div>`;
    }).join('')}`;

  out.onclick = e => {
    const add = e.target.closest('[data-addplace]');
    if (add) {
      $('h-idea');
      render('home');
      setTimeout(() => { const t = $('h-idea'); if (t){ t.value = add.dataset.addplace; t.focus(); } }, 80);
    }
  };
}

function placeCard(p){
  return `<div class="card stack g8">
    <div class="between" style="align-items:flex-start">
      <strong style="font-size:15px">${esc(p.name)}</strong>
      ${p.rating ? `<span class="badge">&#9733; ${p.rating}${p.ratingCount ? ` (${p.ratingCount})` : ''}</span>` : ''}
    </div>
    ${p.address ? `<span class="tiny muted">${esc(p.address)}</span>` : ''}
    <div class="row" style="gap:8px">
      ${p.mapsUrl ? `<a class="btn btn-ghost" style="min-height:38px;font-size:13.5px" target="_blank" rel="noopener" href="${esc(p.mapsUrl)}">Directions</a>` : ''}
      ${p.website ? `<a class="btn btn-ghost" style="min-height:38px;font-size:13.5px" target="_blank" rel="noopener" href="${esc(p.website)}">Website</a>` : ''}
      <button class="btn btn-ghost" style="min-height:38px;font-size:13.5px" data-addplace="${esc(p.name)}">Plan around this</button>
    </div>
  </div>`;
}

// ── 5. Plans list + 6. Plan history ───────────────────────────────────
SCREENS.plans = async function(){
  view.innerHTML = `<div class="stack g24">
    <h1 style="font-size:30px">Your plans</h1>
    <div class="row" style="gap:8px">
      <button class="btn btn-ghost" id="pl-upcoming" style="min-height:40px;font-size:14px" aria-pressed="true">Active</button>
      <button class="btn btn-ghost" id="pl-past" style="min-height:40px;font-size:14px" aria-pressed="false">History</button>
      ${caps.publicPlans ? `<button class="btn btn-ghost" id="pl-public" style="min-height:40px;font-size:14px" aria-pressed="false">Public</button>` : ''}
    </div>
    <div id="p-list" class="stack g12"><p class="muted tiny">Loading&hellip;</p></div>
  </div>`;
  const set = mode => {
    ['pl-upcoming','pl-past','pl-public'].forEach(id => $(id) && $(id).setAttribute('aria-pressed', String(id === 'pl-' + mode)));
    if (mode === 'public') renderPublicPlans('p-list');
    else renderPlanList('p-list', null, mode);
  };
  $('pl-upcoming').onclick = () => set('upcoming');
  $('pl-past').onclick = () => set('past');
  if ($('pl-public')) $('pl-public').onclick = () => set('public');
  set('upcoming');
};

async function renderPlanList(hostId, limit, mode){
  const host = $(hostId);
  if (!host) return;
  const plans = await B.listPlans();
  const now = Date.now();
  const filtered = plans.filter(p => {
    if (mode === 'past') return p.finalPlan && Date.parse(p.createdAt) < now - 86400e3;
    if (mode === 'upcoming') return !(p.finalPlan && Date.parse(p.createdAt) < now - 86400e3);
    return true;
  });
  const shown = limit ? filtered.slice(0, limit) : filtered;
  if (!shown.length){
    host.innerHTML = `<p class="muted tiny">${mode === 'past' ? 'Nothing here yet.' : 'No plans yet. Say what you want to do above.'}</p>`;
    return;
  }
  host.innerHTML = shown.map(p => `
    <button class="card stack g8" data-code="${esc(p.code)}" style="text-align:left;cursor:pointer;width:100%;border:1px solid var(--line)">
      <div class="between">
        <strong style="font-size:15px">${esc(p.title)}</strong>
        <span class="badge ${p.finalPlan ? 'ok' : 'brand'}">${p.finalPlan ? 'Planned' : 'Collecting'}</span>
      </div>
      <span class="tiny muted">${p.participants.length} ${p.participants.length === 1 ? 'person' : 'people'}
        &middot; ${p.confirmed || 0} in${p.finalPlan ? ` &middot; ~$${p.finalPlan.cost.perPerson}/person` : ''}</span>
    </button>`).join('');
  host.onclick = e => { const b = e.target.closest('[data-code]'); if (b) SCREENS.plan(b.dataset.code); };
}

async function renderPublicPlans(hostId){
  const host = $(hostId);
  const res = await B.publicPlans();
  if (!res.plans.length){
    host.innerHTML = `<p class="muted tiny">No public plans yet. Make one of yours public and it shows up here.</p>`;
    return;
  }
  host.innerHTML = res.plans.map(p => `
    <div class="card stack g8">
      <div class="between"><strong style="font-size:15px">${esc(p.title)}</strong>
        <span class="badge brand">${p.going} going</span></div>
      <span class="tiny muted">${esc(p.creatorName)}${p.spotsOpen != null ? ` &middot; ${p.spotsOpen} spots open` : ''}</span>
      <button class="btn btn-ghost" style="min-height:40px;font-size:14px" data-join="${esc(p.code)}">Ask to join</button>
    </div>`).join('');
  host.onclick = e => {
    const b = e.target.closest('[data-join]');
    if (b) SCREENS.plan(b.dataset.join);
  };
}

// ── 7. Plan detail — the hub for a single plan ────────────────────────
SCREENS.plan = async function(code, section){
  view.innerHTML = `<p class="muted tiny">Loading plan&hellip;</p>`;
  const data = await B.getPlan(code);
  if (!data){ view.innerHTML = notice('We couldn&rsquo;t load that plan.'); return; }
  const { plan, status } = data;
  const shareUrl = B.shareUrl(code);
  const isCreator = B.isCreator(plan);
  const sec = section || 'plan';

  view.innerHTML = `
    <div class="stack g24">
      <button class="btn btn-quiet" id="back" style="align-self:flex-start;padding-left:0">&larr; Back</button>
      <div class="stack g8">
        <h1 style="font-size:28px">${esc(plan.title)}</h1>
        <p class="muted tiny">&ldquo;${esc(plan.idea)}&rdquo;</p>
      </div>

      <div class="segmented" id="plan-tabs">
        ${[['plan','Plan'],['people','People'],['money','Money'],['extras','Extras']]
          .map(([k, label]) => `<button data-sec="${k}" aria-pressed="${sec === k}">${label}</button>`).join('')}
      </div>

      <div id="sec-body"></div>
    </div>`;

  $('back').onclick = () => render('plans');
  $('plan-tabs').onclick = e => {
    const b = e.target.closest('[data-sec]');
    if (b) SCREENS.plan(code, b.dataset.sec);
  };

  const body = $('sec-body');
  if (sec === 'people') return renderPeopleSection(body, plan, status, code, shareUrl, isCreator);
  if (sec === 'money')  return renderMoneySection(body, plan, code);
  if (sec === 'extras') return renderExtrasSection(body, plan, code, isCreator);
  return renderPlanSection(body, plan, status, code, isCreator);
};

// 7a. The plan itself
async function renderPlanSection(body, plan, status, code, isCreator){
  body.innerHTML = `
    ${status.waitingOn?.length ? notice(`Still waiting on ${esc(status.waitingOn.join(', '))}.`) : ''}
    <div id="final">${plan.finalPlan ? R.finalPlan(plan.finalPlan) : `
      <button class="btn ${status.readyToPlan ? 'btn-primary' : 'btn-ghost'} btn-block" id="gen">
        ${status.readyToPlan ? 'Build the plan' : 'Build it anyway'}
      </button>
      <p class="tiny muted" style="text-align:center;margin-top:9px">
        ${status.readyToPlan ? 'Everyone who needed to answer has.' : 'You can build it now, but more answers make it better.'}
      </p>`}</div>
    ${plan.finalPlan ? `<div class="row" style="gap:8px;margin-top:16px">
      <button class="btn btn-ghost" id="cal" style="min-height:44px;font-size:14px">Add to calendar</button>
      <button class="btn btn-ghost" id="regen" style="min-height:44px;font-size:14px">Rebuild</button>
    </div>` : ''}
    ${plan.trip ? `<div style="margin-top:20px">${tripView(plan.trip)}</div>` : ''}`;

  const gen = $('gen');
  if (gen) gen.onclick = async () => {
    const done = busy(gen, 'Working it out&hellip;');
    const fp = await B.generate(code);
    if (!fp){ done(); return; }
    SCREENS.plan(code, 'plan');
  };
  const regen = $('regen');
  if (regen) regen.onclick = async () => {
    const done = busy(regen, 'Rebuilding&hellip;');
    await B.generate(code);
    SCREENS.plan(code, 'plan');
  };
  const cal = $('cal');
  if (cal) cal.onclick = async () => {
    const ics = await B.calendarIcs(code);
    if (!ics) return;
    download(`planzo-${code}.ics`, ics, 'text/calendar');
    flash(cal, 'Downloaded &#10003;', 'Add to calendar');
  };
}

// 7b. People, invites and the question flow
async function renderPeopleSection(body, plan, status, code, shareUrl, isCreator){
  body.innerHTML = `
    <div class="stack g24">
      <div class="card glass stack g16">
        <div class="between"><strong>Who&rsquo;s in</strong>
          <span class="badge brand">${status.confirmed}/${status.total}</span></div>
        <div class="stack g8">
          ${status.roster.map(r => `<div class="between">
            <span>${esc(r.name)}${r.isCreator ? ' <span class="tiny muted">&middot; organizer</span>' : ''}</span>
            <div class="row" style="gap:6px">
              <span class="badge ${r.status === 'Confirmed' ? 'ok' : r.status === 'Waiting' ? '' : 'brand'}">${esc(r.status)}</span>
              ${isCreator && r.status === 'Waiting' && caps.reminders !== false
                ? `<button class="btn btn-quiet" data-remind="${esc(r.name)}" style="min-height:30px;padding:0 8px;font-size:12px">Remind</button>` : ''}
            </div>
          </div>`).join('')}
        </div>
        ${shareUrl ? `
          <button class="btn btn-primary btn-block" id="share">Share the link</button>
          <p class="tiny muted" style="text-align:center;word-break:break-all">${esc(shareUrl)}</p>`
        : `<div class="row" style="gap:8px">
            <input class="input" id="add-name" placeholder="Add someone&rsquo;s name" style="flex:1;min-height:46px" maxlength="40">
            <button class="btn btn-ghost" id="add-go" style="min-height:46px">Add</button>
          </div>
          ${notice(esc(caps.sharingNote))}`}
      </div>

      ${caps.publicPlans && isCreator ? `
      <div class="card stack g12">
        <div class="between"><strong>Visibility</strong>
          <span class="badge ${plan.visibility === 'public' ? 'brand' : ''}">${plan.visibility === 'public' ? 'Public' : 'Private'}</span></div>
        <p class="tiny muted">A public plan appears in Discover so people can ask to join.
        Nobody&rsquo;s phone number or email is ever shown.</p>
        <button class="btn btn-ghost btn-block" id="vis" style="min-height:44px;font-size:14px">
          Make ${plan.visibility === 'public' ? 'private' : 'public'}</button>
      </div>` : ''}

      <div class="card stack g16" id="qcard">
        ${B.canAnswerAs ? `
          <div class="stack g12">
            <span class="eyebrow">Answering as</span>
            <div class="who" id="who-row"></div>
          </div>` : ''}
        <div id="qbody"></div>
      </div>
    </div>`;

  body.onclick = async e => {
    const rem = e.target.closest('[data-remind]');
    if (rem){
      const res = await B.remind(code, rem.dataset.remind);
      sheet('Reminder', `<p class="muted" style="font-size:15px">${esc(res.message)}</p>`);
    }
  };

  const shareBtn = $('share');
  if (shareBtn) shareBtn.onclick = async () => {
    const r = await share('Planzo', plan.title, shareUrl);
    if (r !== 'failed') flash(shareBtn, r === 'copied' ? 'Copied &#10003;' : 'Shared &#10003;', 'Share the link');
  };

  const addGo = $('add-go');
  if (addGo) addGo.onclick = async () => {
    const n = $('add-name').value.trim();
    if (!n) return;
    const p = await B.addParticipant(code, n);
    answeringAs = p.id;
    SCREENS.plan(code, 'people');
  };
  if ($('add-name')) $('add-name').onkeydown = e => { if (e.key === 'Enter') addGo.click(); };

  const vis = $('vis');
  if (vis) vis.onclick = async () => {
    await B.setVisibility(code, plan.visibility === 'public' ? 'private' : 'public');
    SCREENS.plan(code, 'people');
  };

  await mountQuestions(code, plan);
}

/** The adaptive question card — shared by both backends. */
async function mountQuestions(code, plan){
  if (B.canAnswerAs){
    const row = $('who-row');
    if (!answeringAs || !plan.participants.some(p => p.id === answeringAs)) answeringAs = plan.participants[0].id;
    const marks = await Promise.all(plan.participants.map(p => B.nextQuestion(code, p.id)));
    row.innerHTML = plan.participants.map((p, i) => `
      <button data-pid="${esc(p.id)}" aria-pressed="${p.id === answeringAs}">
        <span class="pip ${marks[i].done ? 'done' : p.answered ? '' : 'idle'}">${marks[i].done ? '&#10003;' : esc(initials(p.name))}</span>
        ${esc(p.name)}
      </button>`).join('');
    row.onclick = e => {
      const b = e.target.closest('[data-pid]');
      if (b){ answeringAs = b.dataset.pid; SCREENS.plan(code, 'people'); }
    };
  }

  const payload = await B.nextQuestion(code, answeringAs);
  drawQuestion(code, payload);
}

function drawQuestion(code, payload){
  const host = $('qbody');
  if (!host) return;

  if (payload.done){
    host.innerHTML = `<div class="stack g8" style="text-align:center;padding:6px 0">
      <strong>${B.canAnswerAs ? 'All answered.' : 'You&rsquo;re all set.'}</strong>
      <span class="tiny muted">${payload.reason === 'declined'
        ? 'They said they can&rsquo;t make it, so nothing else is asked.'
        : B.canAnswerAs ? 'Pick someone else above, or add more people.' : 'We&rsquo;ll build the plan once everyone has answered.'}</span>
    </div>`;
    return;
  }

  const q = payload.question;
  const pr = payload.progress || { answered: 0, estimatedTotal: 5 };
  let picked = [];

  host.innerHTML = `
    <div class="stack g16">
      <div class="stack g8">
        <div class="bar"><i style="width:${Math.min(96, (pr.answered / Math.max(1, pr.estimatedTotal)) * 100)}%"></i></div>
        <p class="tiny muted">Question ${pr.answered + 1} of about ${pr.estimatedTotal}</p>
      </div>
      <h3>${esc(q.text)}</h3>
      ${q.because ? `<p class="tiny muted">${esc(q.because)}</p>` : ''}
      ${q.kind === 'hard' ? `<p class="tiny muted">This one binds the whole group, so everyone is asked.</p>` : ''}
      <div class="choices" id="q-choices"></div>
      <button class="btn btn-primary btn-block hidden" id="q-next">Continue</button>
    </div>`;

  const box = $('q-choices');
  q.options.forEach(opt => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'choice'; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = q.multi ? `<span class="dot"></span><span>${esc(opt)}</span>` : `<span>${esc(opt)}</span>`;
    b.onclick = async () => {
      if (q.multi){
        const on = b.getAttribute('aria-pressed') === 'true';
        b.setAttribute('aria-pressed', String(!on));
        picked = on ? picked.filter(x => x !== opt) : picked.concat(opt);
        $('q-next').disabled = !picked.length;
        return;
      }
      box.style.pointerEvents = 'none';
      const next = await B.answer(code, q.id, opt, answeringAs);
      if (B.canAnswerAs) SCREENS.plan(code, 'people'); else drawQuestion(code, next);
    };
    box.appendChild(b);
  });

  const next = $('q-next');
  next.classList.toggle('hidden', !q.multi);
  next.disabled = true;
  next.onclick = async () => {
    const res = await B.answer(code, q.id, picked, answeringAs);
    if (B.canAnswerAs) SCREENS.plan(code, 'people'); else drawQuestion(code, res);
  };
}

// 7c. Money — expense splits and settle-up
async function renderMoneySection(body, plan, code){
  const data = await B.expenses(code);
  const people = plan.participants;

  body.innerHTML = `
    <div class="stack g24">
      ${plan.finalPlan ? `<div class="card stack g12">
        <div class="between"><strong>Estimated for the plan</strong><span class="badge">Estimate</span></div>
        ${plan.finalPlan.cost.lines.map(l => `<div class="between" style="font-size:14.5px">
          <span>${esc(l.label)}</span><strong>$${l.perPerson.toFixed(2)}</strong></div>`).join('')
          || `<p class="tiny muted">Nothing in this plan costs money.</p>`}
        <div class="between" style="border-top:1px solid var(--line);padding-top:11px">
          <strong>Per person</strong><strong class="gradient-text">~$${plan.finalPlan.cost.perPerson}</strong></div>
      </div>` : notice('Build the plan first and the estimated costs land here.')}

      <div class="card stack g16">
        <div class="between"><strong>What people actually spent</strong>
          <button class="btn btn-ghost" id="add-exp" style="min-height:38px;font-size:13.5px">Add</button></div>
        ${data.ledger.length ? `<div class="stack g12">${data.ledger.map(e => `
          <div class="between" style="font-size:14.5px">
            <div class="stack" style="gap:2px;min-width:0">
              <span>${esc(e.label)}</span>
              <span class="tiny muted">${e.paidBy ? esc(people.find(p => p.id === e.paidBy)?.name || 'Someone') + ' paid' : 'Estimated'}
                &middot; split ${e.shares.length} ways</span>
            </div>
            <strong>${money(e.amountCents)}</strong>
          </div>`).join('')}</div>`
          : `<p class="tiny muted">Nothing logged yet. Add what people paid and Planzo works out who owes who.</p>`}
      </div>

      ${data.settle.length ? `<div class="card tint stack g12">
        <strong>Settle up</strong>
        ${data.settle.map(t => `<div class="between" style="font-size:14.5px">
          <span>${esc(t.from)} &rarr; ${esc(t.to)}</span><strong>${money(t.cents)}</strong></div>`).join('')}
        <p class="tiny muted">${esc(caps.paymentsNote)}</p>
      </div>` : data.ledger.length ? `<div class="card"><p class="tiny muted">Everyone&rsquo;s square.</p></div>` : ''}
    </div>`;

  $('add-exp').onclick = () => {
    sheet('Add an expense', `
      <div class="stack g16">
        <div class="field"><label for="e-label">What was it?</label>
          <input class="input" id="e-label" placeholder="Dinner at La Central"></div>
        <div class="field"><label for="e-amount">Total amount</label>
          <input class="input" id="e-amount" type="number" inputmode="decimal" step="0.01" placeholder="180.00"></div>
        <div class="field"><label for="e-paid">Who paid?</label>
          <select class="input" id="e-paid">${people.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Split between</label>
          <div class="stack g8" id="e-people">${people.map(p => `
            <button class="choice" type="button" data-pid="${esc(p.id)}" aria-pressed="true">
              <span class="dot"></span><span>${esc(p.name)}</span></button>`).join('')}</div></div>
        <button class="btn btn-primary btn-block" id="e-save">Save expense</button>
      </div>`, close => {
      const sel = new Set(people.map(p => p.id));
      $('e-people').onclick = e => {
        const b = e.target.closest('[data-pid]');
        if (!b) return;
        const on = b.getAttribute('aria-pressed') === 'true';
        b.setAttribute('aria-pressed', String(!on));
        on ? sel.delete(b.dataset.pid) : sel.add(b.dataset.pid);
      };
      $('e-save').onclick = async () => {
        const amount = parseFloat($('e-amount').value);
        if (!(amount > 0) || !sel.size) return;
        await B.addExpense(code, {
          label: $('e-label').value.trim() || 'Expense',
          amount, paidBy: $('e-paid').value, participantIds: [...sel],
        });
        close();
        SCREENS.plan(code, 'money');
      };
    });
  };
}

// 7d. Extras — trips, reminders, transport detail
async function renderExtrasSection(body, plan, code, isCreator){
  const reminders = await B.reminders(code);
  body.innerHTML = `
    <div class="stack g24">
      <div class="card stack g12">
        <div class="between"><strong>Reminders</strong><span class="badge">${reminders.length}</span></div>
        ${reminders.length ? reminders.map(r => `<div class="between" style="font-size:14.5px">
          <span>${esc(r.text)}</span><span class="tiny muted">${r.kind === 'nudge' ? 'now' : when(r.at, { hour:'numeric', minute:'2-digit' })}</span>
        </div>`).join('') : `<p class="tiny muted">Reminders appear once the plan is built.</p>`}
        <p class="tiny muted">${esc(caps.remindersNote)}</p>
      </div>

      <div class="card stack g12">
        <div class="between"><strong>Make it a trip</strong><span class="badge brand">Pro</span></div>
        <p class="tiny muted">Turn this into a multi-day itinerary. Each day is planned by the same
        engine, against the same group constraints.</p>
        <div class="row" style="gap:8px">
          <input class="input" id="t-nights" type="number" min="1" max="6" value="2" style="width:88px;min-height:44px">
          <input class="input" id="t-start" type="date" style="flex:1;min-height:44px">
        </div>
        <button class="btn ${isCreator ? 'btn-primary' : 'btn-ghost'} btn-block" id="t-go" ${isCreator ? '' : 'disabled'}>Build the trip</button>
      </div>

      ${plan.finalPlan ? transportDetail(plan.finalPlan) : ''}
    </div>`;

  $('t-start').value = new Date(Date.now() + 7 * 86400e3).toISOString().slice(0, 10);
  $('t-go').onclick = async () => {
    const done = busy($('t-go'), 'Planning the trip&hellip;');
    await B.trip(code, { nights: Number($('t-nights').value) || 2, startDate: $('t-start').value });
    SCREENS.plan(code, 'plan');
  };
}

/** Full transportation comparison for every leg (spec §9). */
function transportDetail(fp){
  const legs = (fp.itinerary || []).filter(i => i.transport?.length);
  if (!legs.length) return '';
  return `<div class="card stack g16">
    <strong>Getting there</strong>
    ${legs.map(l => `<div class="stack g8">
      <div class="between"><span class="tiny muted">${esc(l.time)}</span>
        <span class="tiny muted">${esc(l.detail || '')}</span></div>
      ${l.transport.map((o, i) => `<div class="between" style="font-size:14px;${i === 0 ? 'font-weight:600' : 'color:var(--ink-3)'}">
        <span>${esc(o.mode)} &middot; ${o.minutes} min${i === 0 ? ' <span class="badge brand" style="margin-left:6px">Best</span>' : ''}</span>
        <span>${o.costPerPerson > 0
          ? (o.costRange ? `$${o.costRange[0]}&ndash;$${o.costRange[1]} total` : `~$${o.costPerPerson.toFixed(2)}/person`)
          : 'Free'}</span>
      </div>`).join('')}
      ${l.transport.some(o => o.note) ? `<p class="tiny muted">${esc(l.transport.find(o => o.note).note)}</p>` : ''}
    </div>`).join('')}
  </div>`;
}

function tripView(trip){
  return `<div class="stack g16">
    <div class="card glass stack g12">
      <div class="stack g8">
        <span class="eyebrow">Trip</span>
        <h3>${esc(trip.title)}</h3>
        <p class="muted tiny">${esc(trip.startDate)} &rarr; ${esc(trip.endDate)} &middot; ${trip.nights} nights &middot; ${trip.groupSize} people</p>
      </div>
      <span class="badge brand">~$${trip.cost.perPerson}/person <span class="tiny">food &amp; activities only</span></span>
    </div>
    ${(trip.caveats || []).map(c => notice(esc(c))).join('')}
    ${trip.days.map(d => `<div class="card stack g12">
      <div class="between"><strong>${esc(d.label)}</strong><span class="tiny muted">${esc(d.date)}</span></div>
      <div class="tl">${d.itinerary.map(i => `<div class="tl-item">
        <div class="tl-time">${esc(i.time)}</div>
        <div style="font-weight:600;font-size:14.5px">${esc(i.title)}</div>
        ${i.place ? `<div class="tiny muted">${esc(i.place.name)}</div>` : ''}
        ${i.unresolved ? `<div class="tiny muted">${esc(i.unresolvedMessage)}</div>` : ''}
      </div>`).join('')}</div>
    </div>`).join('')}
  </div>`;
}

// ── 8. Groups + group memory ──────────────────────────────────────────
SCREENS.groups = async function(){
  const { groups } = await B.groups();
  view.innerHTML = `
    <div class="stack g24">
      <div class="between"><h1 style="font-size:30px">Groups</h1>
        <button class="btn btn-ghost" id="g-new" style="min-height:40px;font-size:14px">New</button></div>
      <p class="muted tiny">A group remembers what you tend to do together, so plans start
      closer to right. It never assumes a preference is permanent.</p>
      <div class="stack g12" id="g-list">
        ${groups.length ? groups.map(g => `
          <button class="card stack g8" data-gid="${esc(g.id)}" style="text-align:left;cursor:pointer;width:100%;border:1px solid var(--line)">
            <div class="between"><strong style="font-size:15px">${esc(g.name)}</strong>
              <span class="badge">${g.members.length} ${g.members.length === 1 ? 'member' : 'members'}</span></div>
            <span class="tiny muted">${(g.planIds || []).length} plans together</span>
          </button>`).join('')
          : `<p class="muted tiny">No groups yet. Make one for the people you plan with most.</p>`}
      </div>
    </div>`;
  $('g-new').onclick = () => {
    sheet('New group', `
      <div class="stack g16">
        <div class="field"><label for="g-name">Name it</label>
          <input class="input" id="g-name" placeholder="The Boys" maxlength="40"></div>
        <button class="btn btn-primary btn-block" id="g-save">Create group</button>
      </div>`, close => {
      $('g-save').onclick = async () => {
        const n = $('g-name').value.trim();
        if (!n) return;
        await B.createGroup(n);
        close(); render('groups');
      };
    });
  };
  $('g-list').onclick = e => { const b = e.target.closest('[data-gid]'); if (b) SCREENS.group(b.dataset.gid); };
};

SCREENS.group = async function(id){
  const data = await B.getGroup(id);
  if (!data){ render('groups'); return; }
  const { group, profile, plans } = data;
  const rows = [['food','Food'],['vibe','Vibe'],['transport','Getting around'],['budget','Budget']]
    .map(([k, label]) => ({ label, top: (profile[k] || [])[0] }))
    .filter(r => r.top);

  view.innerHTML = `
    <div class="stack g24">
      <button class="btn btn-quiet" id="back" style="align-self:flex-start;padding-left:0">&larr; Groups</button>
      <h1 style="font-size:28px">${esc(group.name)}</h1>

      <div class="card stack g12">
        <div class="between"><strong>Members</strong>
          <button class="btn btn-ghost" id="m-add" style="min-height:36px;font-size:13px">Add</button></div>
        ${group.members.map(m => `<div class="between">
          <span>${esc(m.name)}</span><span class="badge">${esc(m.role)}</span></div>`).join('')}
      </div>

      <div class="card ${profile.confident ? 'tint' : ''} stack g12">
        <div class="between"><strong>What this group tends to do</strong>
          <span class="badge ${profile.confident ? 'brand' : ''}">${profile.planCount} plans</span></div>
        ${profile.confident
          ? `${profile.typicalSize ? `<div class="between" style="font-size:14.5px">
              <span class="muted">Usually</span><strong>${profile.typicalSize} people</strong></div>` : ''}
             ${rows.map(r => `<div class="between" style="font-size:14.5px">
               <span class="muted">${esc(r.label)}</span>
               <strong>${esc(r.top.value)} <span class="tiny muted">&times;${r.top.count}</span></strong></div>`).join('')}`
          : `<p class="tiny muted">Not enough plans yet to call anything a pattern. After three,
             Planzo starts using this to skip questions it can already answer.</p>`}
      </div>

      <div class="stack g12">
        <strong>Plans together</strong>
        ${plans.length ? plans.map(p => `
          <button class="card stack g8" data-code="${esc(p.code)}" style="text-align:left;cursor:pointer;width:100%;border:1px solid var(--line)">
            <div class="between"><strong style="font-size:15px">${esc(p.title)}</strong>
              <span class="badge ${p.finalPlan ? 'ok' : 'brand'}">${p.finalPlan ? 'Planned' : 'Collecting'}</span></div>
          </button>`).join('')
          : `<p class="muted tiny">No plans with this group yet.</p>`}
      </div>
    </div>`;

  $('back').onclick = () => render('groups');
  $('m-add').onclick = () => {
    sheet('Add member', `<div class="stack g16">
      <div class="field"><label for="mm-name">Their name</label>
        <input class="input" id="mm-name" maxlength="40"></div>
      <button class="btn btn-primary btn-block" id="mm-save">Add</button></div>`, close => {
      $('mm-save').onclick = async () => {
        const n = $('mm-name').value.trim();
        if (!n) return;
        await B.addGroupMember(id, n);
        close(); SCREENS.group(id);
      };
    });
  };
  view.onclick = e => { const b = e.target.closest('[data-code]'); if (b) SCREENS.plan(b.dataset.code); };
};

// ── 9. Events list ────────────────────────────────────────────────────
SCREENS.events = async function(){
  view.innerHTML = `
    <div class="stack g24">
      <div class="between"><h1 style="font-size:30px">Events</h1>
        <button class="btn btn-ghost" id="e-new" style="min-height:40px;font-size:14px">Host one</button></div>
      <div id="e-tickets"></div>
      <div class="stack g12"><strong>Yours</strong><div id="e-mine" class="stack g12"></div></div>
      <div class="stack g12"><strong>Public on Planzo</strong><div id="e-public" class="stack g12"></div></div>
      <div class="stack g12"><strong>Concerts &amp; shows near you</strong><div id="e-external"></div></div>
    </div>`;
  $('e-new').onclick = () => SCREENS.eventCreate();
  renderEventList('e-mine', null, 'mine');
  renderEventList('e-public', null, 'public');
  renderMyTickets('e-tickets');
  const ext = await B.externalEvents();
  $('e-external').innerHTML = ext.available
    ? `<div class="stack g12">${(ext.events || []).map(placeCard).join('')}</div>`
    : notice(esc(ext.message || "Live event listings aren't connected yet, so none are shown rather than invented."));
};

async function renderEventList(hostId, limit, kind){
  const host = $(hostId);
  if (!host) return;
  const events = kind === 'mine' ? (await B.myEvents()).events : (await B.publicEvents()).events;
  const shown = limit ? events.slice(0, limit) : events;
  if (!shown.length){
    host.innerHTML = `<p class="muted tiny">${kind === 'mine' ? "You haven't created any events." : 'Nothing public yet.'}</p>`;
    return;
  }
  host.innerHTML = shown.map(e => `
    <button class="card stack g8" data-eid="${esc(e.id)}" style="text-align:left;cursor:pointer;width:100%;border:1px solid var(--line)">
      <div class="between"><strong style="font-size:15px">${esc(e.title)}</strong>
        <span class="badge ${e.visibility === 'public' ? 'brand' : ''}">${esc(e.visibility)}</span></div>
      <span class="tiny muted">${when(e.startsAt)}${e.venue ? ' &middot; ' + esc(e.venue) : ''}</span>
      <span class="tiny muted">${e.counts.going} going${e.counts.spotsLeft != null ? ` &middot; ${e.counts.spotsLeft} spots left` : ''}</span>
    </button>`).join('');
  host.onclick = ev => { const b = ev.target.closest('[data-eid]'); if (b) SCREENS.event(b.dataset.eid); };
}

// ── 10. Event creation ────────────────────────────────────────────────
SCREENS.eventCreate = function(){
  const soon = new Date(Date.now() + 7 * 86400e3);
  soon.setHours(21, 0, 0, 0);
  view.innerHTML = `
    <div class="stack g24">
      <button class="btn btn-quiet" id="back" style="align-self:flex-start;padding-left:0">&larr; Events</button>
      <h1 style="font-size:28px">Host an event</h1>
      <div class="card stack g16">
        <div class="field"><label for="ev-title">Event name</label>
          <input class="input" id="ev-title" placeholder="UMD Fall Social" maxlength="80"></div>
        <div class="field"><label for="ev-desc">Description</label>
          <textarea class="input" id="ev-desc" rows="3" placeholder="What is it, who's it for, what should people know?"></textarea></div>
        <div class="field"><label for="ev-start">Starts</label>
          <input class="input" id="ev-start" type="datetime-local"></div>
        <div class="field"><label for="ev-venue">Venue</label>
          <input class="input" id="ev-venue" placeholder="The Barn" maxlength="80"></div>
        <div class="field"><label for="ev-addr">Address</label>
          <input class="input" id="ev-addr" placeholder="7400 Baltimore Ave, College Park" maxlength="160"></div>
        <div class="field"><label for="ev-cap">Capacity <span class="muted" style="font-weight:400">&mdash; optional</span></label>
          <input class="input" id="ev-cap" type="number" min="1" placeholder="150"></div>
        <div class="field"><label>Who can see it</label>
          <div class="choices" id="ev-vis">
            ${[['private','Private &mdash; only people I invite'],
               ['link','Link only &mdash; anyone with the link'],
               ['public','Public &mdash; discoverable on Planzo']].map(([v, l], i) =>
              `<button class="choice" type="button" data-v="${v}" aria-pressed="${i === 1}"><span>${l}</span></button>`).join('')}
          </div></div>
        <div class="field"><label for="ev-price">Ticket price</label>
          <input class="input" id="ev-price" type="number" min="0" step="1" value="0">
          <p class="tiny muted">${esc(caps.paymentsNote)}</p></div>
        <button class="btn btn-primary btn-block" id="ev-save">Create event</button>
      </div>
    </div>`;
  $('back').onclick = () => render('events');
  const pad = n => String(n).padStart(2, '0');
  $('ev-start').value = `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}T${pad(soon.getHours())}:${pad(soon.getMinutes())}`;

  let visibility = 'link';
  $('ev-vis').onclick = e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    [...$('ev-vis').children].forEach(c => c.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    visibility = b.dataset.v;
  };

  $('ev-save').onclick = async () => {
    const title = $('ev-title').value.trim();
    if (!title){ $('ev-title').focus(); return; }
    const done = busy($('ev-save'), 'Creating&hellip;');
    const res = await B.createEvent({
      title, description: $('ev-desc').value.trim(),
      startsAt: new Date($('ev-start').value).toISOString(),
      venue: $('ev-venue').value.trim(), address: $('ev-addr').value.trim(),
      capacity: Number($('ev-cap').value) || null, visibility,
      ticketTypes: [{ name: 'General Admission', price: Number($('ev-price').value) || 0 }],
    });
    if (!res.ok){ done(); return; }
    SCREENS.event(res.event.id);
  };
};

// ── 11. Event page + 12. Ticket claim + 13. Staff ─────────────────────
SCREENS.event = async function(id){
  const res = await B.getEvent(id);
  if (!res){ view.innerHTML = notice('We couldn&rsquo;t load that event.'); return; }
  const e = res.event;
  const isStaff = ['owner','admin','event_manager','check_in','moderator'].includes(e.myRole);
  const canCheckIn = ['owner','admin','event_manager','check_in'].includes(e.myRole);
  const shareUrl = B.eventUrl(id);

  view.innerHTML = `
    <div class="stack g24">
      <button class="btn btn-quiet" id="back" style="align-self:flex-start;padding-left:0">&larr; Events</button>

      <div class="card flush">
        <div style="height:120px;background:var(--grad)"></div>
        <div class="stack g12" style="padding:18px">
          <h1 style="font-size:26px">${esc(e.title)}</h1>
          <p class="muted tiny">${when(e.startsAt, { weekday:'long', month:'long', day:'numeric', hour:'numeric', minute:'2-digit' })}</p>
          ${e.venue ? `<p style="font-size:15px">${esc(e.venue)}</p>` : ''}
          ${e.address ? `<p class="tiny muted">${esc(e.address)}</p>` : ''}
          <div class="row" style="gap:6px">
            <span class="badge brand">${e.counts.going} going</span>
            ${e.counts.spotsLeft != null ? `<span class="badge">${e.counts.spotsLeft} spots left</span>` : ''}
            <span class="badge">${esc(e.visibility)}</span>
          </div>
          ${e.description ? `<p style="font-size:14.5px;color:var(--ink-2)">${esc(e.description)}</p>` : ''}
        </div>
      </div>

      <div class="card stack g12">
        <strong>Are you going?</strong>
        <div class="choices" id="rsvp">
          ${[['going',"I'm going"],['maybe','Maybe'],['not_going',"Can't make it"]].map(([v, l]) =>
            `<button class="choice" type="button" data-r="${v}" aria-pressed="${e.myRsvp === v}"><span>${l}</span></button>`).join('')}
        </div>
        <div class="row" style="gap:8px">
          <button class="btn btn-ghost" id="ev-cal" style="min-height:44px;font-size:14px">Add to calendar</button>
          <button class="btn btn-ghost" id="ev-share" style="min-height:44px;font-size:14px">Share</button>
        </div>
      </div>

      <div class="card stack g12">
        <div class="between"><strong>Ticket</strong>
          <span class="badge">${esc(e.ticketTypes[0].name)}${e.ticketTypes[0].price > 0 ? ` &middot; $${e.ticketTypes[0].price}` : ' &middot; Free'}</span></div>
        <button class="btn btn-primary btn-block" id="claim">Get my ticket</button>
        <p class="tiny muted">Planzo issues this ticket itself, so it can be verified at the door.</p>
      </div>

      ${e.updates?.length ? `<div class="card stack g12"><strong>Updates</strong>
        ${e.updates.map(u => `<div class="stack g8" style="border-left:2px solid var(--line);padding-left:12px">
          <span style="font-size:14.5px">${esc(u.text)}</span>
          <span class="tiny muted">${esc(u.by)} &middot; ${when(u.at)}</span></div>`).join('')}</div>` : ''}

      ${isStaff ? `<div class="card tint stack g16">
        <div class="between"><strong>Organizer</strong><span class="badge brand">${esc(e.myRole)}</span></div>
        <div id="ev-stats" class="stack g8"></div>
        ${canCheckIn ? `<button class="btn btn-primary btn-block" id="go-checkin">Open check-in scanner</button>` : ''}
        ${e.myRole === 'owner' || e.myRole === 'admin' ? `
          <button class="btn btn-ghost btn-block" id="add-staff" style="min-height:44px;font-size:14px">Add door staff</button>` : ''}
        <button class="btn btn-ghost btn-block" id="post-update" style="min-height:44px;font-size:14px">Post an update</button>
        ${e.attendees?.length ? `<details><summary class="tiny muted" style="cursor:pointer">${e.attendees.length} responses</summary>
          <div class="stack g8" style="margin-top:10px">${e.attendees.map(a => `<div class="between" style="font-size:14px">
            <span>${esc(a.name)}</span><span class="badge ${a.status === 'going' ? 'ok' : ''}">${esc(a.status)}</span></div>`).join('')}</div>
        </details>` : ''}
      </div>` : ''}
    </div>`;

  $('back').onclick = () => render('events');

  $('rsvp').onclick = async ev => {
    const b = ev.target.closest('[data-r]');
    if (!b) return;
    const res2 = await B.rsvp(id, b.dataset.r);
    if (res2 && res2.ok === false && res2.reason === 'at_capacity'){
      sheet('Event is full', `<p class="muted" style="font-size:15px">This event has hit its capacity, so we can&rsquo;t mark you as going.</p>`);
      return;
    }
    SCREENS.event(id);
  };

  $('ev-cal').onclick = async () => {
    const ics = await B.eventIcs(id);
    if (ics){ download('planzo-event.ics', ics, 'text/calendar'); flash($('ev-cal'), 'Downloaded &#10003;', 'Add to calendar'); }
  };
  $('ev-share').onclick = async () => {
    const r = await share('Planzo', e.title, shareUrl);
    if (r !== 'failed') flash($('ev-share'), r === 'copied' ? 'Copied &#10003;' : 'Shared &#10003;', 'Share');
  };

  $('claim').onclick = async () => {
    const done = busy($('claim'), 'Issuing&hellip;');
    const res2 = await B.claimTicket(id);
    done();
    if (!res2.ok){
      sheet('Can&rsquo;t issue this ticket', `<p class="muted" style="font-size:15px">${esc(res2.message)}</p>`);
      return;
    }
    SCREENS.ticket(res2.ticket.id);
  };

  if (isStaff){
    const stats = await B.eventStats(id);
    if (stats && $('ev-stats')){
      $('ev-stats').innerHTML = `
        <div class="between tiny"><span class="muted">Tickets issued</span><strong>${stats.issued}</strong></div>
        <div class="between tiny"><span class="muted">Checked in</span><strong>${stats.checkedIn}</strong></div>
        <div class="between tiny"><span class="muted">Still to arrive</span><strong>${stats.active}</strong></div>`;
    }
    if ($('go-checkin')) $('go-checkin').onclick = () => SCREENS.checkin(id);
    if ($('add-staff')) $('add-staff').onclick = () => {
      sheet('Add door staff', `
        <div class="stack g16">
          <p class="tiny muted">Door staff can validate tickets and see who has arrived. They cannot
          edit or delete the event, change payment settings, or manage other staff.</p>
          <div class="field"><label for="s-name">Their name</label><input class="input" id="s-name" maxlength="40"></div>
          <div class="field"><label for="s-id">Their Planzo id</label>
            <input class="input" id="s-id" placeholder="Paste from their profile" maxlength="40"></div>
          <button class="btn btn-primary btn-block" id="s-save">Add as check-in staff</button>
        </div>`, close => {
        $('s-save').onclick = async () => {
          await B.addStaff(id, { name: $('s-name').value.trim(), id: $('s-id').value.trim(), role: 'check_in' });
          close(); SCREENS.event(id);
        };
      });
    };
    if ($('post-update')) $('post-update').onclick = () => {
      sheet('Post an update', `<div class="stack g16">
        <textarea class="input" id="u-text" rows="3" placeholder="Doors now open at 9."></textarea>
        <button class="btn btn-primary btn-block" id="u-save">Post</button></div>`, close => {
        $('u-save').onclick = async () => {
          const t = $('u-text').value.trim();
          if (!t) return;
          await B.addUpdate(id, t);
          close(); SCREENS.event(id);
        };
      });
    };
  }
};

// ── 14. Planzo ticket — the "Pulse" credential (spec §24, §54–56) ─────
SCREENS.tickets = async function(){
  view.innerHTML = `<div class="stack g24"><h1 style="font-size:30px">Your tickets</h1>
    <div id="t-list" class="stack g12"><p class="muted tiny">Loading&hellip;</p></div></div>`;
  const { tickets } = await B.myTickets();
  const host = $('t-list');
  if (!tickets.length){
    host.innerHTML = `<p class="muted tiny">No tickets yet. Claim one from an event.</p>`;
    return;
  }
  host.innerHTML = tickets.map(t => `
    <button class="card stack g8" data-tid="${esc(t.id)}" style="text-align:left;cursor:pointer;width:100%;border:1px solid var(--line)">
      <div class="between"><strong style="font-size:15px">${esc(t.event?.title || 'Event')}</strong>
        <span class="badge ${t.status === 'CHECKED_IN' ? 'ok' : t.status === 'ACTIVE' ? 'brand' : 'err'}">
          ${t.status === 'CHECKED_IN' ? 'Admitted' : t.status === 'ACTIVE' ? 'Valid' : esc(t.status)}</span></div>
      <span class="tiny muted">${esc(t.attendeeName)} &middot; ${esc(t.ticketType)}${t.event?.startsAt ? ' &middot; ' + when(t.event.startsAt) : ''}</span>
    </button>`).join('');
  host.onclick = e => { const b = e.target.closest('[data-tid]'); if (b) SCREENS.ticket(b.dataset.tid); };
};

async function renderMyTickets(hostId){
  const host = $(hostId);
  if (!host) return;
  const { tickets } = await B.myTickets();
  const live = tickets.filter(t => t.status === 'ACTIVE');
  if (!live.length){ host.innerHTML = ''; return; }
  host.innerHTML = `<div class="card glass stack g12">
    <div class="between"><strong>Your next ticket</strong><span class="badge ok">Valid</span></div>
    <div class="between"><span>${esc(live[0].event?.title || 'Event')}</span>
      <button class="btn btn-ghost" data-tid="${esc(live[0].id)}" style="min-height:38px;font-size:13.5px">Show</button></div>
  </div>`;
  host.onclick = e => { const b = e.target.closest('[data-tid]'); if (b) SCREENS.ticket(b.dataset.tid); };
}

SCREENS.ticket = async function(id){
  const t = await B.getTicket(id);
  if (!t){ view.innerHTML = notice('We couldn&rsquo;t load that ticket.'); return; }

  const admitted = t.status === 'CHECKED_IN';
  const dead = ['CANCELLED','REFUNDED','INVALIDATED','TRANSFERRED'].includes(t.status);
  // The ticket's look is derived from its own id, so every ticket is
  // visually distinct and a screenshot of someone else's is obviously not yours.
  let seed = 0;
  for (const c of t.id) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const hue = seed % 360;

  view.innerHTML = `
    <div class="stack g24">
      <button class="btn btn-quiet" id="back" style="align-self:flex-start;padding-left:0">&larr; Back</button>

      <div class="ticket ${admitted ? 'admitted' : dead ? 'dead' : ''}" style="--h:${hue}">
        <div class="ticket-sheen"></div>
        <div class="stack g16" style="position:relative">
          <div class="between">
            <span class="ticket-brand">PLANZO ${dead ? 'VOID' : admitted ? 'ADMITTED' : 'VERIFIED'}</span>
            ${!dead && !admitted ? `<span class="pulse-dot" aria-hidden="true"></span>` : ''}
          </div>
          <div class="stack g8">
            <h2 style="color:#fff;font-size:26px">${esc(t.event?.title || 'Event')}</h2>
            <p style="color:rgba(255,255,255,.82);font-size:14px">
              ${t.event?.startsAt ? esc(when(t.event.startsAt)) : ''}${t.event?.venue ? ' &middot; ' + esc(t.event.venue) : ''}</p>
          </div>
          <div class="between" style="align-items:flex-end">
            <div class="stack" style="gap:3px">
              <span class="ticket-label">Attendee</span>
              <strong style="color:#fff;font-size:19px">${esc(t.attendeeName)}</strong>
              <span class="ticket-label">${esc(t.ticketType)}</span>
            </div>
            <div class="stack" style="gap:3px;text-align:right">
              <span class="ticket-label">${dead ? 'Status' : admitted ? 'Checked in' : 'Live code'}</span>
              <strong id="rolling" style="color:#fff;font-size:19px;font-variant-numeric:tabular-nums;letter-spacing:.08em">
                ${dead ? esc(t.status) : admitted ? esc(when(t.checkedInAt, { hour:'numeric', minute:'2-digit' })) : '&middot;&middot;&middot;&middot;&middot;&middot;'}</strong>
            </div>
          </div>
        </div>
      </div>

      ${admitted ? `<div class="notice info">You&rsquo;re in &mdash; checked in at ${esc(when(t.checkedInAt))}.
        This ticket can&rsquo;t be used again.</div>` : ''}
      ${dead ? notice(`This ticket is ${esc(t.status.toLowerCase())} and will not be admitted.`) : ''}

      ${!dead && !admitted ? `
        <button class="btn btn-ghost btn-block" id="show-qr">Show scan code</button>
        <div id="qr-host" class="hidden card" style="text-align:center;padding:20px"></div>
        <p class="tiny muted" style="text-align:center">
          The animation is the experience. The door checks this against the server &mdash;
          a screenshot won&rsquo;t get anyone in.</p>` : ''}
    </div>`;

  $('back').onclick = () => render('tickets');

  // Rolling validation code. Cosmetic on its own; the server is the authority.
  if (!admitted && !dead){
    const roll = () => {
      const el = $('rolling');
      if (!el) return;
      const step = Math.floor(Date.now() / 30000);
      let v = (seed ^ (step * 2654435761)) >>> 0;
      el.textContent = String(v % 1000000).padStart(6, '0');
    };
    roll();
    const timer = setInterval(() => { if ($('rolling')) roll(); else clearInterval(timer); }, 1000);

    $('show-qr').onclick = () => {
      const host = $('qr-host');
      host.classList.toggle('hidden');
      if (!host.dataset.drawn){
        host.innerHTML = B.qrSvg(t.credential || t.id) + `<p class="tiny muted" style="margin-top:12px">Present this to door staff</p>`;
        host.dataset.drawn = '1';
      }
    };
  }
};

// ── 15. Check-in scanner (spec §58–61, §64–65) ────────────────────────
SCREENS.checkin = async function(eventId){
  const res = await B.getEvent(eventId);
  const e = res?.event;
  if (!e || !['owner','admin','event_manager','check_in'].includes(e.myRole)){
    view.innerHTML = notice('You don&rsquo;t have permission to check people in at this event.');
    return;
  }

  view.innerHTML = `
    <div class="stack g16">
      <button class="btn btn-quiet" id="back" style="align-self:flex-start;padding-left:0">&larr; ${esc(e.title)}</button>
      <div class="scanner" id="scanner">
        <video id="cam" playsinline muted class="hidden"></video>
        <div class="scan-state" id="scan-state">
          <strong id="scan-title">READY</strong>
          <span id="scan-sub" class="tiny">Scan a ticket</span>
        </div>
      </div>
      <div id="scan-counts" class="row" style="gap:8px;justify-content:center"></div>
      <div class="row" style="gap:8px">
        <button class="btn btn-primary" id="scan-start" style="flex:1">Start camera</button>
        <button class="btn btn-ghost" id="scan-manual" style="flex:1">Enter code</button>
      </div>
      <p class="tiny muted" style="text-align:center">Every scan is checked against the server.
      Two staff scanning the same ticket at once: exactly one gets in.</p>
    </div>`;

  $('back').onclick = () => SCREENS.event(eventId);

  const refreshCounts = async () => {
    const s = await B.eventStats(eventId);
    if (s && $('scan-counts')) $('scan-counts').innerHTML =
      `<span class="badge ok">${s.checkedIn} in</span>
       <span class="badge">${s.active} to come</span>
       <span class="badge">${s.issued} issued</span>`;
  };
  refreshCounts();

  let busyScan = false;
  const RESULTS = {
    ENTRY_GRANTED:  { cls:'ok',   title:'ENTRY GRANTED' },
    ALREADY_USED:   { cls:'warn', title:'ALREADY USED' },
    INVALID_TICKET: { cls:'err',  title:'INVALID TICKET' },
    INVALID_EVENT:  { cls:'err',  title:'WRONG EVENT' },
    TICKET_CANCELLED:{ cls:'err', title:'TICKET CANCELLED' },
    TICKET_EXPIRED: { cls:'err',  title:'TICKET EXPIRED' },
    NOT_AUTHORIZED: { cls:'err',  title:'NOT AUTHORIZED' },
  };

  async function validate(credential){
    if (busyScan) return;
    busyScan = true;
    setState('', 'VERIFYING', 'Checking ticket&hellip;');
    const r = await B.checkIn(eventId, credential);
    const meta = RESULTS[r.result] || RESULTS.INVALID_TICKET;
    setState(meta.cls, meta.title,
      r.result === 'ENTRY_GRANTED' ? `${r.attendeeName} &middot; ${r.ticketType}`
      : r.result === 'ALREADY_USED' ? `${r.attendeeName || 'This ticket'} came in at ${when(r.checkedInAt, { hour:'numeric', minute:'2-digit' })}`
      : 'Do not admit');
    if (navigator.vibrate) navigator.vibrate(r.result === 'ENTRY_GRANTED' ? 40 : [40, 60, 40]);
    refreshCounts();
    // Back to READY quickly — a door queue cannot wait on an animation.
    setTimeout(() => { busyScan = false; setState('', 'READY', 'Scan a ticket'); }, 1600);
  }

  function setState(cls, title, sub){
    const el = $('scan-state');
    if (!el) return;
    el.className = 'scan-state ' + cls;
    $('scan-title').innerHTML = title;
    $('scan-sub').innerHTML = sub;
  }

  $('scan-manual').onclick = () => {
    sheet('Enter ticket code', `
      <div class="stack g16">
        <p class="tiny muted">Manual entry runs through exactly the same server check as the camera.
        It is not a bypass.</p>
        <input class="input" id="mc" placeholder="Paste or type the ticket code" autocapitalize="off" spellcheck="false">
        <button class="btn btn-primary btn-block" id="mc-go">Check ticket</button>
      </div>`, close => {
      $('mc-go').onclick = async () => { const v = $('mc').value.trim(); close(); if (v) validate(v); };
      $('mc').onkeydown = e2 => { if (e2.key === 'Enter') $('mc-go').click(); };
    });
  };

  $('scan-start').onclick = async () => {
    const supported = 'BarcodeDetector' in window;
    if (!supported){
      sheet('Camera scanning unavailable', `
        <p class="muted" style="font-size:15px">This browser doesn&rsquo;t support barcode detection,
        so Planzo can&rsquo;t read the code from the camera here. It works in Chrome on Android and
        Safari 17+ on iOS.</p>
        <p class="muted" style="font-size:15px;margin-top:12px">Use <strong>Enter code</strong> instead &mdash;
        it runs the same server-side validation.</p>`);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const cam = $('cam');
      cam.srcObject = stream;
      cam.classList.remove('hidden');
      await cam.play();
      $('scan-start').textContent = 'Camera on';
      $('scan-start').disabled = true;

      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      let last = '', lastAt = 0;
      const tick = async () => {
        if (!document.getElementById('cam')) { stream.getTracks().forEach(t => t.stop()); return; }
        if (!busyScan){
          try {
            const found = await detector.detect(cam);
            if (found.length){
              const val = found[0].rawValue;
              // Ignore the same code re-read in the same second.
              if (val !== last || Date.now() - lastAt > 3000){
                last = val; lastAt = Date.now();
                setState('', 'TICKET DETECTED', 'Reading&hellip;');
                validate(val);
              }
            }
          } catch {}
        }
        requestAnimationFrame(tick);
      };
      tick();
    } catch {
      sheet('Camera blocked', `<p class="muted" style="font-size:15px">We couldn&rsquo;t open the camera.
        Check the permission, or use <strong>Enter code</strong>.</p>`);
    }
  };
};

// ── 16. Profile, memory, settings, subscription ───────────────────────
SCREENS.profile = async function(){
  const [{ memories }, health] = await Promise.all([B.memory(), B.health()]);
  const byCat = {};
  for (const m of memories) (byCat[m.category] = byCat[m.category] || []).push(m);

  view.innerHTML = `
    <div class="stack g24">
      <h1 style="font-size:30px">You</h1>

      <div class="card stack g12">
        <div class="row">
          <div class="mark" style="width:46px;height:46px;border-radius:15px;font-size:21px">${esc(initials(me.name))}</div>
          <div class="stack" style="gap:2px">
            <strong>${esc(me.name)}</strong>
            <span class="tiny muted">Planzo id ${esc(me.id)}</span>
          </div>
        </div>
        <button class="btn btn-ghost btn-block" id="pf-loc" style="min-height:44px;font-size:14px">Set my location</button>
        <button class="btn btn-ghost btn-block" id="pf-copyid" style="min-height:44px;font-size:14px">Copy my Planzo id</button>
      </div>

      <div class="card stack g16">
        <div class="between"><strong>What Planzo remembers</strong>
          <button class="btn btn-ghost" id="mem-add" style="min-height:36px;font-size:13px">Add</button></div>
        <p class="tiny muted">Stable preferences last. A one-off &mdash; &ldquo;no sushi tonight&rdquo; &mdash;
        stays with that plan and never becomes part of who you are.</p>
        ${Object.keys(byCat).length ? Object.entries(byCat).map(([cat, list]) => `
          <div class="stack g8">
            <span class="eyebrow">${esc(cat)}</span>
            ${list.map(m => `<div class="between">
              <div class="stack" style="gap:2px;min-width:0">
                <span style="font-size:14.5px">${esc(m.value)}</span>
                <span class="tiny muted">${esc(m.stability)} &middot; ${esc(m.source)} &middot; ${Math.round(m.confidence * 100)}% confident</span>
              </div>
              <button class="btn btn-quiet" data-forget="${esc(m.id)}" style="min-height:32px;padding:0 8px;font-size:12px">Forget</button>
            </div>`).join('')}
          </div>`).join('')
          : `<p class="tiny muted">Nothing yet. Planzo learns from the plans you actually make.</p>`}
      </div>

      <div class="card stack g12">
        <strong>What&rsquo;s connected</strong>
        ${Object.entries(health.services || {}).map(([k, v]) => `
          <div class="between tiny"><span class="muted">${esc(k)}</span>
            <span>${v.on ? 'On' : 'Off'}${v.note ? ` &middot; ${esc(v.note)}` : ''}</span></div>`).join('')}
      </div>

      ${health.spend ? `<div class="card stack g12">
        <strong>Spend today</strong>
        ${Object.entries(health.spend).map(([k, v]) => `
          <div class="stack g8">
            <div class="between tiny"><span class="muted">${esc(k)}</span>
              <span>$${v.spentToday} of $${v.limits.daily}${v.blocked ? ' &middot; capped' : ''}</span></div>
            <div class="bar"><i style="width:${Math.min(100, (v.spentToday / v.limits.daily) * 100)}%"></i></div>
          </div>`).join('')}
        <p class="tiny muted">Hit a cap and AI and venue lookups stop. The rules engine keeps working.</p>
      </div>` : ''}

      <div class="card tint stack g12">
        <div class="between"><strong>Planzo Pro</strong><span class="badge brand">$4.99/mo</span></div>
        <div class="stack g8">
          ${['Groups of any size','Multi-day trip planning','Advanced transport comparison',
             'Deeper group memory','Full plan history','Organization and event tools']
            .map(f => `<div class="row" style="gap:8px"><span style="color:var(--brand)">&#10003;</span>
              <span style="font-size:14.5px">${f}</span></div>`).join('')}
        </div>
        <button class="btn btn-primary btn-block" id="pro">Upgrade to Pro</button>
      </div>

      <button class="btn btn-quiet btn-block" id="pf-reset">Clear all local data</button>
    </div>`;

  $('pf-loc').onclick = async () => { await B.requestLocation(true); render('profile'); };
  $('pf-copyid').onclick = async () => {
    try { await navigator.clipboard.writeText(me.id); flash($('pf-copyid'), 'Copied ✓', 'Copy my Planzo id'); } catch {}
  };
  view.onclick = async e => {
    const f = e.target.closest('[data-forget]');
    if (f){ await B.forget(f.dataset.forget); render('profile'); }
  };
  $('mem-add').onclick = () => {
    sheet('Tell Planzo something', `
      <div class="stack g16">
        <div class="field"><label for="m-cat">Category</label>
          <select class="input" id="m-cat">
            ${['dietary','food','activity','transport','budget'].map(c => `<option>${c}</option>`).join('')}
          </select></div>
        <div class="field"><label for="m-val">What should it remember?</label>
          <input class="input" id="m-val" placeholder="Vegetarian" maxlength="50"></div>
        <p class="tiny muted">Anything you state outright is stored as stable and high confidence,
        because you said it rather than Planzo guessing.</p>
        <button class="btn btn-primary btn-block" id="m-save">Remember this</button>
      </div>`, close => {
      $('m-save').onclick = async () => {
        const v = $('m-val').value.trim();
        if (!v) return;
        await B.remember($('m-cat').value, v);
        close(); render('profile');
      };
    });
  };
  $('pro').onclick = () => {
    sheet('Planzo Pro', `<p class="muted" style="font-size:15px">${esc(caps.paymentsNote)}</p>
      <p class="muted" style="font-size:15px;margin-top:12px">Pro features are already built &mdash;
      multi-day trips are in a plan&rsquo;s Extras tab right now. Billing is the only piece missing.</p>`);
  };
  $('pf-reset').onclick = async () => {
    if (!confirm('Delete everything stored in this browser? This cannot be undone.')) return;
    await B.reset();
    me = null; answeringAs = null;
    SCREENS.welcome();
  };
};

// ── Shared list renderers ─────────────────────────────────────────────
async function renderWeather(hostId){
  const host = $(hostId);
  if (!host) return;
  const origin = await B.getLocation();
  if (!origin){
    host.innerHTML = `<button class="btn btn-ghost btn-block" id="w-ask" style="min-height:44px;font-size:14px">Use my location</button>`;
    $('w-ask').onclick = async () => { await B.requestLocation(true); renderWeather(hostId); };
    return;
  }
  host.innerHTML = `<div class="card"><p class="tiny muted">Checking the weather&hellip;</p></div>`;
  const w = await B.weather(origin.lat, origin.lon);
  host.innerHTML = w.available
    ? `<div class="card stack g8">
        <div class="between"><span class="tiny muted">Today near you</span><span class="badge">${esc(w.summary)}</span></div>
        <strong style="font-size:17px">${w.highF}&deg; / ${w.lowF}&deg; &middot; ${w.precipChance}% rain</strong>
        <span class="tiny muted">Open-Meteo &middot; checked just now</span></div>`
    : notice('Weather data isn&rsquo;t available right now.');
}

async function createPlan(idea){
  if (!idea) return;
  const btn = $('h-go');
  const done = busy(btn, 'Setting it up&hellip;');
  const plan = await B.createPlan(idea);
  done();
  if (plan) SCREENS.plan(plan.code, 'people');
}

// ── Router ────────────────────────────────────────────────────────────
function render(next){
  tab = next;
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-current', String(t.dataset.tab === next)));
  window.scrollTo(0, 0);
  (SCREENS[next] || SCREENS.home)();
}

document.querySelector('.tabbar').addEventListener('click', e => {
  const t = e.target.closest('.tab');
  if (t) render(t.dataset.tab);
});

// ── Boot + deep links ─────────────────────────────────────────────────
/** /app#/e/<id> and /app#/t/<id> so a shared event or ticket opens directly. */
function routeHash(){
  const hash = location.hash.slice(1);
  if (!me) return false;
  if (hash.startsWith('/e/')){ SCREENS.event(hash.slice(3)); return true; }
  if (hash.startsWith('/t/')){ SCREENS.ticket(hash.slice(3)); return true; }
  return false;
}

// A hash change does not reload the page, so route it explicitly.
window.addEventListener('hashchange', () => { routeHash(); });

(async function boot(){
  caps = await B.caps();
  me = await B.me();
  if (routeHash()) return;
  if (!me) SCREENS.welcome(); else render('home');
})();

window.PlanzoApp = { render, SCREENS };
})();
