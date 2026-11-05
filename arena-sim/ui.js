'use strict';
/* ====================================================================
   INPUT / PLAYER
   ==================================================================== */
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.key.toLowerCase()] = true;
  const k = e.key.toLowerCase();
  if (modalOpen) { if (k === 'escape') closeModal(); return; }
  if (k === ' ') { setSpeed(speed ? 0 : 1); e.preventDefault(); }
  if (k === 'e') { const n = nearestThing(); if (n) inspect(n); }
  if (k === 'b') openMenu('build'); if (k === 'p') openMenu('prices'); if (k === 'm') openMenu('maint'); if (k === 'f') openMenu('fin'); if (k === 'h') openMenu('help');
  if (k === 'l') cycleLevels(); if (k === 'v') toggleHeat(); if (k === 'o') toggleOverview(); if (k === 'n') doSkip();
  if (k === 'escape') closeInsp();
  if (k === '1') setSpeed(1); if (k === '2') setSpeed(2); if (k === '3') setSpeed(4); if (k === '4') setSpeed(8);
  if (k === '=' || k === '+') cam.zt = clamp(cam.zt * 1.2, 0.22, 5); if (k === '-') cam.zt = clamp(cam.zt / 1.2, 0.22, 5);
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
cv.addEventListener('wheel', e => { e.preventDefault(); cam.zt = clamp(cam.zt * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.22, 5); }, { passive: false });
let drag = null;
cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false }; });
addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 6) { drag.moved = true; cam.follow = false; const k = 1 / (cam.z * PX), dX = -dx * k, dY = -dy * k; cam.x = drag.cx + dX + 2 * dY; cam.y = drag.cy + 2 * dY - dX; }
});
addEventListener('pointerup', e => {
  if (drag && !drag.moved && e.target === cv) {
    const w = toWorld(e.clientX, e.clientY), t = thingAt(w);
    if (t) inspect(t); else { me.tx = w.x; me.ty = w.y; cam.follow = true; }
  }
  drag = null;
});
function movePlayer(dt) {
  // WASD is screen-relative: W walks "up the screen", D walks right
  const sx = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
  const sy = (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0);
  const run = keys['shift'] ? 2.2 : 1;
  let wx = 0, wy = 0;
  if (sx || sy) { wx = sx + sy; wy = sy - sx; me.tx = undefined; cam.follow = true; }
  else if (me.tx !== undefined) { const dx = me.tx - me.x, dy = me.ty - me.y, d = Math.hypot(dx, dy); if (d < 4) me.tx = undefined; else { wx = dx / d; wy = dy / d; } }
  const l = Math.hypot(wx, wy) || 1, sp = 170 * run * (me.tx !== undefined ? 1.6 : 1);
  me.x = clamp(me.x + wx / l * sp * dt, 0, W); me.y = clamp(me.y + wy / l * sp * dt, 0, H);
  if (wx || wy) me.face = Math.atan2(wy, wx);
  if (cam.follow) { cam.x += (me.x - cam.x) * Math.min(1, dt * 5); cam.y += (me.y - cam.y) * Math.min(1, dt * 5); }
}
function allThings() {
  const out = [];
  SLOTS.forEach((a, si) => { const p = slotPos(si); const st = S.stands.find(s => s.slot === si); out.push({ kind: st ? 'stand' : 'slot', st, slot: si, x: p.x, y: p.y, r: 26, name: st ? TYPES[st.type].label : 'Empty concourse space' }); });
  gates.forEach((g, i) => { const p = gateDoor(i); out.push({ kind: 'gate', i, x: p.x, y: p.y, r: 34, name: 'Gate ' + GATE_N[i] }); });
  out.push({ kind: 'rink', x: C.x, y: C.y, r: 0, name: 'Ice rink' });
  out.push({ kind: 'lot', x: 1500, y: 1700, r: 0, name: 'Parking' });
  out.push({ kind: 'transit', x: TRANSIT.x, y: TRANSIT.y, r: 0, name: 'Transit Center' });
  return out;
}
function thingAt(w) {
  for (const t of allThings()) if (t.r && dist(t, w) < t.r) return t;
  if (w.x > RK.x0 && w.x < RK.x1 && w.y > RK.y0 && w.y < RK.y1) return allThings().find(t => t.kind === 'rink');
  const ex = (w.x - C.x) / RING.seatOut[0], ey = (w.y - C.y) / RING.seatOut[1], ix = (w.x - C.x) / RING.seatIn[0], iy = (w.y - C.y) / RING.seatIn[1];
  if (ex * ex + ey * ey < 1 && ix * ix + iy * iy > 1) { const i = secOf(angOf(w.x, w.y, RING.seatOut[0], RING.seatOut[1])); return { kind: 'sec', i, x: w.x, y: w.y, name: i ? 'Section ' + (101 + i) : 'VIP Section' }; }
  if (w.x > 930 && w.x < 2070 && w.y > 1470 && w.y < 2040) return allThings().find(t => t.kind === 'lot');
  if (w.x > 2180 && w.x < 2720 && w.y > 1460 && w.y < 2050) return allThings().find(t => t.kind === 'lot');
  if (w.x > 340 && w.x < 780 && w.y > 740 && w.y < 1060) return allThings().find(t => t.kind === 'transit');
  return null;
}
function nearestThing() {
  let best = null, bd = 60;
  for (const t of allThings()) { if (!t.r) continue; const d = dist(t, me); if (d < bd) { bd = d; best = t; } }
  if (!best) best = thingAt(me);
  return best;
}

/* ====================================================================
   UI
   ==================================================================== */
const $ = id => document.getElementById(id);
const MW = $('modalWrap'), M = $('modal');
function closeModal() { MW.style.display = 'none'; modalOpen = false; M.onclick = null; }
MW.addEventListener('click', e => { if (e.target === MW && !M.querySelector('[data-ch]')) closeModal(); });
function toast(t) { const d = document.createElement('div'); d.textContent = t; $('toast').appendChild(d); setTimeout(() => d.remove(), 3600); }
function feed(text, amt, cat) {
  if (!G) return;
  G.feed.unshift({ text, amt, cat }); if (G.feed.length > 40) G.feed.pop();
}
function setSpeed(s) { speed = s; document.querySelectorAll('[data-sp]').forEach(b => b.classList.toggle('on', +b.dataset.sp === s)); }
document.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => setSpeed(+b.dataset.sp));
$('skip').onclick = doSkip;
function doSkip() {
  const k = phK();
  if (k === 'DOWN' || k === 'EGRESS') { if (k === 'EGRESS') G.moodFinal = moodNow(); nextPhase(); }
  else if (k.startsWith('INT') || k === 'SO') nextPhase();
  else toast('Can\'t skip live play — use 8× fast forward');
}
const LV_NAMES = ['All 3 levels', 'Lower + club (upper deck hidden)', 'Lower bowl only (see the concourse)'];
function cycleLevels() { setLevelView((LV + 1) % 3); $('lvl').classList.toggle('on', LV > 0); toast('Levels: ' + LV_NAMES[LV]); }
$('lvl').onclick = cycleLevels;
function toggleHeat() { heat = !heat; $('heat').classList.toggle('on', heat); }
let ovSaved = null;
function toggleOverview() {
  if (ovSaved) { cam.zt = ovSaved; ovSaved = null; cam.follow = true; $('overview').classList.remove('on'); }
  else { ovSaved = cam.zt; cam.follow = false; cam.x = 1500; cam.y = 1150; cam.zt = Math.min(CW / 2700, CH / 1450) * 0.96; $('overview').classList.add('on'); }
}
document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openMenu(b.dataset.open));
$('inspX').onclick = closeInsp;
function closeInsp() { inspected = null; $('insp').style.display = 'none'; }

function hud() {
  $('cash').textContent = money(S.cash); $('cash').style.color = S.cash < 0 ? 'var(--bad)' : 'var(--good)';
  const rev = G ? Object.values(G.rev).reduce((a, b) => a + b, 0) : 0;
  $('tonight').textContent = inGame() ? kmoney(rev) : '—';
  const inside = agents.filter(a => a.state !== 'pending' && a.state !== 'done' && a.state !== 'arrive' && a.state !== 'gateQ' && a.state !== 'leave').length * FPA;
  $('att').textContent = inGame() ? inside.toLocaleString() + ' / ' + (G ? G.att.toLocaleString() : '') : 'Cap ' + S.capacity.toLocaleString();
  const mood = inGame() ? moodNow() : null;
  $('mood').textContent = mood == null ? '—' : Math.round(mood) + '%'; $('mood').style.color = mood == null ? '' : satCol(mood);
  $('rep').textContent = Math.round(S.rep) + ' · Hype ' + Math.round(S.hype);
  $('day').textContent = 'Day ' + S.day + ' · Record ' + S.w + '-' + S.l + '-' + S.otl;
  $('phname').textContent = PH[ph].n + ' · ' + timeLeft();
  $('phbar').firstChild.style.width = (pt / PH[ph].d * 100) + '%';
  const opp = G ? G.opp : OPPS[S.opp % OPPS.length];
  $('score').innerHTML = '<span style="color:' + HOME.color + '">' + HOME.short + '</span> ' + (inGame() ? score[0] + ' – ' + score[1] : 'vs') + ' <span style="color:' + opp.color + '">' + opp.short + '</span>' + (inGame() ? '<div style="font:600 10px system-ui;color:var(--dim);letter-spacing:.04em">SOG ' + shotsOn[0] + '–' + shotsOn[1] + (ppStatus() ? ' · <span style="color:#f0c94a">' + ppStatus() + '</span>' : '') + (G && G.dec ? ' · ' + G.dec : '') + '</div>' : '');
  $('skip').disabled = isPeriod() || phK() === 'DOORS';
  // ticker
  if (G && inGame()) {
    const r = G.rev;
    $('cats').innerHTML = [['Tickets', r.tickets], ['VIP seats', r.vip], ['Parking', r.parking], ['Food', r.food], ['Beer & drinks', r.beer], ['Team store', r.merch], ['VIP club & other', r.other], ['Lost (walk-aways)', -G.lostSales]]
      .map(([k, v]) => '<span>' + k + '</span><b style="color:' + (v < 0 ? 'var(--bad)' : '') + '">' + money(v) + '</b>').join('');
    $('feed').innerHTML = G.feed.slice(0, 16).map(f => '<div class="' + (f.cat === 'x' ? 'x' : '') + '">' + (f.amt ? '<span class="m">+' + money(f.amt) + '</span>' : '') + f.text + '</div>').join('');
    spark();
  } else {
    const f = demandForecast();
    $('cats').innerHTML = '<span>Next opponent</span><b>' + opp.name + '</b><span>Ticket demand forecast</span><b>' + f.demand.toLocaleString() + '</b><span>Seats available</span><b>' + S.capacity.toLocaleString() + '</b><span>Parking stalls</span><b>' + (S.parking * 4).toLocaleString() + ' cars</b>' + (S.weather ? '<span>Weather</span><b style="color:var(--warn)">Snowstorm</b>' : '') + (S.marketing ? '<span>Marketing boost</span><b>+' + Math.round(S.marketing * 100) + '%</b>' : '');
    $('feed').innerHTML = '<div>Arena is empty — perfect time for repairs (M) and upgrades (B). Hit Skip ▸▸ to open the doors.</div>';
    spark();
  }
  // hint
  const n = nearestThing();
  if (n && n.r) { $('hint').style.display = 'block'; $('hint').textContent = 'E — inspect ' + n.name; } else $('hint').style.display = 'none';
  if (inspected) liveInsp();
}
function timeLeft() { const r = Math.max(0, PH[ph].d - pt); return ((r / 60) | 0) + ':' + String((r % 60) | 0).padStart(2, '0'); }
function spark() {
  const c = $('spark'), x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
  const d = G && inGame() ? G.spark : (S.history.length ? S.history.slice(-20).map(h => h.profit) : [0]);
  const mxv = Math.max(1, ...d.map(Math.abs));
  x.fillStyle = '#8d97a8'; x.font = '10px system-ui'; x.fillText(G && inGame() ? 'Revenue per 10s' : 'Profit per game (last 20)', 2, 10);
  const bw = c.width / Math.max(20, d.length);
  d.forEach((v, i) => { const h = Math.abs(v) / mxv * 30; x.fillStyle = v < 0 ? '#ff5c5c' : '#3fcf7a'; x.fillRect(i * bw, 44 - h, Math.max(1, bw - 1), h); });
}
function alerts() {
  const out = [];
  if (G && inGame()) {
    gates.forEach((g, i) => { if (gateLen(g) > 22) out.push('Gate ' + GATE_N[i] + ': ' + gateLen(g) * FPA + ' fans waiting to get in — add security lanes.'); });
    S.stands.forEach(st => { if (st._q && st._q.length > 11) out.push(TYPES[st.type].label + ' (Sec ' + (101 + secOf(SLOTS[st.slot])) + ') has ' + st._q.length * FPA + ' in line — upgrade it or build another nearby.'); });
    if (G.turned > 0 && phK() === 'DOORS') out.push('Parking full: ' + G.turned + ' ticket holders went home. Expand parking or partner with transit.');
    if (G.walkaways > 15) out.push(G.walkaways * FPA + ' fans quit lines this game (' + money(G.lostSales) + ' lost). Speed up service.');
    if ((G.priceBalks || 0) > 60) out.push('Lots of fans skipping purchases because of prices.');
    if (G.powerOut > 0) out.push('Concourse power issue — registers slowed.');
  }
  if (cleanliness() < 60) out.push('Concourse cleanliness ' + Math.round(cleanliness()) + '% — hire crew or deep clean.');
  if (S.ice < 60) out.push('Ice quality ' + Math.round(S.ice) + '% — players slow down, fans notice. Rebuild in downtime.');
  S.stands.forEach(st => { if (st.cond < 30) out.push(TYPES[st.type].label + ' condition ' + Math.round(st.cond) + '% — repair during downtime.'); });
  if (S.building < 50) out.push('Building systems at ' + Math.round(S.building) + '% — HVAC & lighting need service.');
  if (S.cash < 0) out.push('You are in the red! Cut costs or raise prices.');
  $('alist').innerHTML = out.length ? out.slice(0, 7).map(t => '<div>' + t + '</div>').join('') : '<div class="ok">All systems running smoothly.</div>';
}

/* ---------------- inspector ---------------- */
function inspect(t) {
  inspected = t; t.hl = t.r ? { x: t.x, y: t.y, r: t.r } : null;
  if (t.kind === 'sec') t.hl = null;
  $('insp').style.display = 'block';
  renderInspStatic();
}
function repairCost(st) { return Math.round((100 - st.cond) * 120 * st.lvl + 500); }
function renderInspStatic() {
  const t = inspected, el = $('inspStatic'), down = phK() === 'DOWN';
  let h = '';
  if (t.kind === 'stand') {
    const st = t.st, ty = TYPES[st.type];
    h = '<h3>' + (ty.cat === 'restroom' ? 'Facility' : 'Concession') + ' · Sec ' + (101 + secOf(SLOTS[st.slot])) + '</h3><h2>' + ty.label + ' <span class="tag">Level ' + st.lvl + '</span></h2>';
    h += '<div class="btns">';
    if (st.lvl < 4) h += '<button class="buy" data-a="upg">Upgrade → L' + (st.lvl + 1) + ' (' + kmoney(st.lvl * 40000) + ')</button>';
    h += '<button data-a="rep" ' + (st.cond > 98 ? 'disabled' : '') + '>Repair ' + (down ? money(repairCost(st)) : money(repairCost(st) * 3) + ' (emergency)') + '</button>';
    h += '<button data-a="tog">' + (st.open ? 'Close stand' : 'Open stand') + '</button>';
    if (st.type !== 'vip') h += '<button data-a="demo">Demolish (+' + kmoney(ty.cost * 0.25) + ')</button>';
    h += '</div><p style="color:var(--dim);font-size:12px;margin:8px 0 0">Each level adds registers (+60% service speed). Staff cost ' + money(st.lvl * 1500) + ' per game.</p>';
  } else if (t.kind === 'slot') {
    h = '<h3>Concourse · near Sec ' + (101 + secOf(SLOTS[t.slot])) + '</h3><h2>Empty space</h2><p style="color:var(--dim);font-size:12px">Build something here. Spots near busy sections and gates sell more.</p><div class="btns">';
    BUILDABLE.forEach(k => h += '<button class="buy" data-a="build" data-t="' + k + '">' + TYPES[k].label + ' ' + kmoney(TYPES[k].cost) + '</button>');
    h += '</div>';
  } else if (t.kind === 'gate') {
    h = '<h3>Entry gate</h3><h2>Gate ' + GATE_N[t.i] + '</h2><div class="btns"><button class="buy" data-a="lane" ' + (S.lanes[t.i] >= 6 ? 'disabled' : '') + '>Add security lane ($40k)</button></div><p style="color:var(--dim);font-size:12px">Each lane (metal detector + ticket scanner) admits ~6 fans per second. Lines at puck drop hurt mood.</p>';
  } else if (t.kind === 'rink') {
    h = '<h3>Event level</h3><h2>Ice Rink</h2><div class="btns"><button data-a="ice" ' + (down ? '' : 'disabled') + '>Rebuild ice sheet ($15k)</button></div><p style="color:var(--dim);font-size:12px">Ice wears down each period. The Zamboni restores a little each intermission; a full rebuild needs an empty building.</p>';
  } else if (t.kind === 'lot') {
    h = '<h3>Parking</h3><h2>Parking Lots</h2><div class="btns">' + (!S.lotB ? '<button class="buy" data-a="lotB">Buy & pave Lot B (+864 cars) $200k</button>' : '') + (!S.garage ? '<button class="buy" data-a="garage">Build garage (+1,600 cars) $600k</button>' : '') + '</div><p style="color:var(--dim);font-size:12px">About 2 in 3 fans drive. When the lots fill, some fans give up and go home.</p>';
  } else if (t.kind === 'transit') {
    h = '<h3>City</h3><h2>Transit Center</h2><div class="btns">' + (!S.transit ? '<button class="buy" data-a="transit">Transit partnership ($120k)</button>' : '<span class="tag">Partnership active</span>') + '</div><p style="color:var(--dim);font-size:12px">Free rides with a game ticket cut the share of drivers from 66% to 50%, easing parking.</p>';
  } else if (t.kind === 'sec') {
    h = '<h3>Seating bowl</h3><h2>' + t.name + '</h2>';
  }
  el.innerHTML = h;
  el.onclick = e => { const b = e.target.closest('[data-a]'); if (b) act(b.dataset.a, b.dataset.t); };
  liveInsp();
}
function liveInsp() {
  const t = inspected, el = $('inspLive'); let h = '';
  const meter = (v, c) => '<div class="meter"><i style="width:' + clamp(v, 0, 100) + '%;background:' + (c || satCol(v)) + '"></i></div>';
  if (t.kind === 'stand') {
    const st = t.st; if (!S.stands.includes(st)) { closeInsp(); return; }
    const q = st._q ? st._q.length : 0, served = st._served || 0;
    h = '<div class="kv"><span>Status</span><b>' + (!st.open ? 'Closed' : st._closedT > 0 ? 'Temporarily closed' : 'Open') + '</b>' +
      '<span>In line now</span><b style="color:' + (q > 11 ? 'var(--bad)' : q > 6 ? 'var(--warn)' : '') + '">' + q * FPA + ' fans</b>' +
      '<span>Service speed</span><b>' + (standRate(st) * 60 * FPA | 0) + ' fans/min</b>' +
      '<span>Served tonight</span><b>' + (served * FPA).toLocaleString() + '</b>' +
      '<span>Avg wait</span><b>' + (served ? Math.round(st._wait / served) + 's' : '—') + '</b>' +
      (TYPES[st.type].cat !== 'restroom' ? '<span>Sales tonight</span><b style="color:var(--good)">' + money(st._rev || 0) + '</b><span>Walk-aways</span><b>' + ((st._lost || 0) * FPA) + '</b>' : '') +
      '</div><span style="color:var(--dim);font-size:12px">Condition ' + Math.round(st.cond) + '%</span>' + meter(st.cond);
  } else if (t.kind === 'gate') {
    const g = gates[t.i];
    h = '<div class="kv"><span>Lanes</span><b>' + S.lanes[t.i] + '</b><span>Waiting outside</span><b>' + gateLen(g) * FPA + '</b><span>Admitted tonight</span><b>' + (g.served * FPA).toLocaleString() + '</b><span>Throughput</span><b>' + Math.round(S.lanes[t.i] * 0.6 * 60 * FPA) + ' fans/min</b></div>';
  } else if (t.kind === 'rink') {
    h = '<div class="kv"><span>Ice quality</span><b>' + Math.round(S.ice) + '%</b><span>Shots on goal</span><b>' + shotsOn[0] + ' – ' + shotsOn[1] + '</b><span>Zamboni</span><b>' + (zam ? 'On ice' : 'Parked') + '</b></div>' + meter(S.ice);
    if (players.length) h += '<div style="font-size:12px;color:var(--dim)">' + players.filter(p => p.g).map(p => (p.t ? G.opp.short : HOME.short) + ' #' + p.num + ' ' + p.name + ': ' + p.g + 'G').join('<br>') + '</div>';
  } else if (t.kind === 'lot') {
    const used = stalls.filter(s => s.car).length;
    h = '<div class="kv"><span>Capacity</span><b>' + (S.parking * 4).toLocaleString() + ' cars</b><span>Parked now</span><b>' + (used * 4).toLocaleString() + '</b><span>Rate</span><b>' + money(S.prices.parking) + '</b><span>Parking revenue</span><b style="color:var(--good)">' + money(G && inGame() ? G.rev.parking : 0) + '</b><span>Fans turned away</span><b style="color:var(--bad)">' + (G && inGame() ? G.turned : 0) + '</b></div>';
  } else if (t.kind === 'sec') {
    const fans = agents.filter(a => a.sec === t.i && a.state !== 'pending' && a.state !== 'done');
    const here = fans.filter(a => a.state === 'seated').length;
    const mood = fans.length ? fans.reduce((s, a) => s + a.sat, 0) / fans.length : 0;
    const seats = t.i === 0 ? S.vipSeats : Math.round((S.capacity - S.vipSeats) / 19);
    h = '<div class="kv"><span>Seats</span><b>' + seats.toLocaleString() + '</b><span>Ticket price</span><b>' + money(t.i ? S.prices.ticket : S.prices.vip) + '</b><span>Fans in seats</span><b>' + (here * FPA) + '</b><span>Out on concourse</span><b>' + ((fans.length - here) * FPA) + '</b><span>Section mood</span><b style="color:' + satCol(mood) + '">' + (fans.length ? Math.round(mood) + '%' : '—') + '</b></div>';
  } else if (t.kind === 'transit') {
    const n = agents.filter(a => a.home && Math.abs(a.home.x - TRANSIT.x) < 160 && a.stall < 0 && a.state !== 'pending').length;
    h = '<div class="kv"><span>Fans arriving by transit</span><b>' + n * FPA + '</b></div>';
  }
  el.innerHTML = h;
}
function act(a, ty) {
  const t = inspected, down = phK() === 'DOWN';
  const spend = (c, label) => { if (S.cash < c) { toast('Not enough cash'); return false; } S.cash -= c; toast(label + ' (−' + kmoney(c) + ')'); return true; };
  if (a === 'upg') { const st = t.st; if (spend(st.lvl * 40000, TYPES[st.type].label + ' upgraded')) st.lvl++; }
  if (a === 'rep') { const st = t.st, c = repairCost(st) * (down ? 1 : 3); if (spend(c, 'Repaired')) { st.cond = 100; st._brokeEvt = false; if (st._closedT > 500) st._closedT = 0; } }
  if (a === 'tog') { t.st.open = !t.st.open; if (!t.st.open && t.st._q) for (const f of t.st._q.splice(0)) goBack(f, t.st); }
  if (a === 'demo') { const st = t.st; if (st._q) for (const f of st._q.splice(0)) goBack(f, st); S.stands.splice(S.stands.indexOf(st), 1); S.cash += TYPES[st.type].cost * 0.25; inspect(allThings().find(x => x.slot === st.slot && x.kind === 'slot')); return; }
  if (a === 'build') {
    if (!down && inGame() && !confirm('Building during a game costs 50% extra (rush crew). Continue?')) return;
    const c = TYPES[ty].cost * (down ? 1 : 1.5);
    if (spend(c, TYPES[ty].label + ' built')) { const st = { slot: t.slot, type: ty, lvl: 1, cond: 100, open: true, _q: [], _acc: 0, _served: 0, _rev: 0, _wait: 0, _lost: 0, _closedT: 0 }; S.stands.push(st); inspect(allThings().find(x => x.slot === t.slot)); }
    return;
  }
  if (a === 'lane' && spend(40000, 'Security lane added')) S.lanes[t.i]++;
  if (a === 'ice' && spend(15000, 'Ice sheet rebuilt')) S.ice = 100;
  if (a === 'lotB' && spend(200000, 'Lot B paved')) { S.lotB = true; S.parking += 216; buildStalls(); buildCity(); }
  if (a === 'garage' && spend(600000, 'Parking garage built')) { S.garage = true; S.parking += 400; buildStalls(); buildCity(); }
  if (a === 'transit' && spend(120000, 'Transit partnership signed')) { S.transit = true; S.rep += 2; }
  save();
  renderInspStatic();
}

/* ---------------- menus ---------------- */
function openMenu(which) {
  modalOpen = true; MW.style.display = 'flex'; M.onclick = null;
  const down = phK() === 'DOWN';
  let h = '<span class="x" style="position:absolute;top:10px;right:14px;cursor:pointer;color:var(--dim);font-size:18px" data-close>✕</span>';
  if (which === 'build') {
    const items = [
      ['seats', 'Expand seating (+600 seats)', 'Add an upper-deck row ring. More tickets per game.', 350000, S.capacity < 12000],
      ['vipx', 'Expand VIP section (+200 premium seats)', 'Premium seats sell at the VIP price.', 300000, S.vipSeats < 1000],
      ['jumbo', 'Center-hung jumbotron', '+ad revenue every game, hype boosts, unlocks kiss cam & proposals.', 250000, !S.jumbotron],
      ['crew', 'Hire cleaning crew member (now ' + S.crew + ')', 'Picks up trash during the game. +$800 wages per game.', 10000, S.crew < 12],
      ['fire', 'Let a crew member go', 'Saves $800 per game.', 0, S.crew > 0],
      ['mkt', 'Marketing campaign', '+15% ticket demand next game (stacks to +45%).', 30000, S.marketing < 0.45],
      ['lotB', 'Pave Lot B (+864 cars)', 'East vacant lot becomes parking.', 200000, !S.lotB],
      ['garage', 'Parking garage (+1,600 cars)', 'Multi-level garage north-east of the arena.', 600000, !S.garage],
      ['transit', 'Transit partnership', 'Fewer fans drive (66% → 50%). +2 rep.', 120000, !S.transit],
    ];
    h += '<h2>Build &amp; Upgrade</h2><p>Cash: <b style="color:var(--good)">' + money(S.cash) + '</b>. Tip: walk up to a stand, gate or empty <b>+</b> slot and press <b>E</b> to upgrade or build there.</p>';
    h += '<h3 style="margin:14px 0 4px;font-size:12px;letter-spacing:.08em;color:var(--gold)">CONCOURSE UPGRADES — make it super cool</h3>' + Object.entries(DECOR).map(([id, d]) => '<div class="row"><div><b>' + d.name + '</b><div class="d">' + d.d + '</div></div>' + (S.decor[id] ? '<span class="tag" style="background:#1d3b2a;color:#4ee07a">Installed</span>' : '<button class="buy" data-dec="' + id + '" ' + (S.cash < d.cost ? 'disabled' : '') + '>' + kmoney(d.cost) + '</button>') + '</div>').join('') + '<h3 style="margin:14px 0 4px;font-size:12px;letter-spacing:.08em;color:var(--dim)">ARENA</h3>';
    h += items.filter(i => i[4]).map(i => '<div class="row"><div><b>' + i[1] + '</b><div class="d">' + i[2] + '</div></div><button class="buy" data-b="' + i[0] + '" ' + (S.cash < i[3] ? 'disabled' : '') + '>' + (i[3] ? kmoney(i[3]) : 'Free') + '</button></div>').join('');
  } else if (which === 'prices') {
    const rows = [['ticket', 'General ticket', 20, 120], ['vip', 'VIP ticket', 60, 400], ['food', 'Food (avg item)', 4, 25], ['beer', 'Beer / drinks', 5, 25], ['merch', 'Merch (avg item)', 15, 120], ['parking', 'Parking per car', 0, 60]];
    h += '<h2>Pricing</h2><p>Higher prices = more per sale but fewer buyers and grumpier fans. "Fair" is the market price.</p>';
    h += rows.map(([k, l, a, b]) => '<div class="row"><div><b>' + l + '</b><div class="d">Market price ' + money(BASE[k]) + '</div></div><div><input type="range" min="' + a + '" max="' + b + '" value="' + S.prices[k] + '" data-p="' + k + '"> <b id="pv_' + k + '" style="display:inline-block;width:46px;text-align:right">' + money(S.prices[k]) + '</b></div></div>').join('');
    const f = demandForecast();
    h += '<p id="fcast" style="margin-top:12px">Next-game ticket forecast: <b>' + f.demand.toLocaleString() + '</b> (cap ' + S.capacity.toLocaleString() + '). Ticket prices lock when doors open.</p>';
  } else if (which === 'maint') {
    h += '<h2>Maintenance</h2><p>' + (down ? '<b style="color:var(--good)">Building is empty</b> — normal rates.' : '<b style="color:var(--warn)">Game in progress</b> — only emergency fixes (3× cost). Big jobs wait for downtime.') + '</p>';
    h += '<div class="row"><div><b>Ice sheet</b><div class="d">Quality ' + Math.round(S.ice) + '% — affects player speed & fan mood</div></div><button data-m="ice" ' + (!down || S.ice > 98 ? 'disabled' : '') + '>Rebuild $15k</button></div>';
    h += '<div class="row"><div><b>Building systems (HVAC, lights, plumbing)</b><div class="d">Condition ' + Math.round(S.building) + '% — low means power & leak events</div></div><button data-m="bld" ' + (S.building > 98 ? 'disabled' : '') + '>Service ' + money((100 - S.building) * 600 * (down ? 1 : 3)) + '</button></div>';
    h += '<div class="row"><div><b>Deep clean seating bowl & concourse</b><div class="d">Cleanliness ' + Math.round(cleanliness()) + '% · ' + trash.length + ' piles of trash</div></div><button data-m="clean" ' + (!down || !trash.length ? 'disabled' : '') + '>Clean $6k</button></div>';
    S.stands.forEach((st, i) => {
      h += '<div class="row"><div><b>' + TYPES[st.type].label + ' · Sec ' + (101 + secOf(SLOTS[st.slot])) + '</b><div class="d">Condition ' + Math.round(st.cond) + '% · Level ' + st.lvl + '</div></div><button data-m="st" data-i="' + i + '" ' + (st.cond > 98 ? 'disabled' : '') + '>Repair ' + money(repairCost(st) * (down ? 1 : 3)) + '</button></div>';
    });
    h += '<div class="row"><div><b>Repair everything</b></div><button class="buy" data-m="all">Fix all</button></div>';
  } else if (which === 'fin') {
    h += '<h2>Finances</h2><p>Cash on hand <b style="color:var(--good)">' + money(S.cash) + '</b> · Record ' + S.w + '-' + S.l + '-' + S.otl + ' · Rep ' + Math.round(S.rep) + ' · Hype ' + Math.round(S.hype) + '</p>';
    if (!S.history.length) h += '<p>No games played yet. Results show here after the first final horn.</p>';
    else {
      h += '<canvas id="finc" width="600" height="150" style="width:100%;height:150px"></canvas>';
      h += '<table><tr><th>Game</th><th>Result</th><th>Att.</th><th>Tickets</th><th>Concessions</th><th>Parking</th><th>Costs</th><th>Profit</th><th>Mood</th></tr>' +
        S.history.slice().reverse().map(g => '<tr><td>Day ' + g.day + ' vs ' + g.opp + '</td><td>' + g.res + ' ' + g.score[0] + '-' + g.score[1] + '</td><td>' + g.att.toLocaleString() + '</td><td>' + kmoney(g.rev.tickets + g.rev.vip) + '</td><td>' + kmoney(g.rev.food + g.rev.beer + g.rev.merch + g.rev.other) + '</td><td>' + kmoney(g.rev.parking) + '</td><td>' + kmoney(g.exp + g.cogs) + '</td><td style="color:' + (g.profit < 0 ? 'var(--bad)' : 'var(--good)') + '">' + kmoney(g.profit) + '</td><td>' + g.mood + '%</td></tr>').join('') + '</table>';
    }
    h += '<div class="btns" style="margin-top:12px"><button data-reset>Start a new arena (reset save)</button></div>';
  } else if (which === 'help') {
    h += '<h2>Welcome, Owner.</h2><p>You own the <b>' + HOME.name + '</b> arena in Lakeview. Walk the building, watch the game, and grow the business.</p>' +
      '<div class="kv" style="grid-template-columns:auto 1fr"><span>WASD / arrows</span><b>Walk (Shift to run) · or click the ground to walk there</b><span>Click / E</span><b>Inspect a stand, gate, section, rink, lot</b><span>Mouse wheel / drag</span><b>Zoom / pan · O for overview</b><span>Space · 1-4</span><b>Pause · speed 1×/2×/4×/8×</b><span>N / Skip</span><b>Skip downtime, intermissions, or exiting fans</b><span>V</span><b>Fan-mood heat map</b><span>L</span><b>Cycle stadium levels: all 3 / hide upper deck / lower bowl only</b><span>B · P · M · F</span><b>Build · Prices · Maintenance · Finances</b></div>' +
      '<p><b>A game day:</b> Downtime (6 min, repairs) → Doors open (2 min) → 3 × 5-min periods with 90-s intermissions → Fans leave (2 min). About 22 minutes of game, then downtime.</p>' +
      '<p><b>How to grow:</b> watch lines (colored badges), bottlenecks at gates, parking that fills up, and fan mood. Happy fans raise reputation → more tickets next game. Random events will hit you — pick wisely.</p>' +
      '<div class="btns"><button class="buy" data-close>Let\'s go</button></div>';
  }
  M.innerHTML = h;
  if (which === 'fin' && S.history.length) finChart();
  M.onclick = e => {
    if (e.target.closest('[data-close]')) { closeModal(); return; }
    if (e.target.closest('[data-reset]')) { if (confirm('Erase your arena and start over?')) { localStorage.removeItem('arenaTycoon'); location.reload(); } return; }
    const dc = e.target.closest('[data-dec]');
    if (dc) { const id = dc.dataset.dec, d = DECOR[id]; if (S.cash >= d.cost && !S.decor[id]) { S.cash -= d.cost; S.decor[id] = true; buildIso(); crowdDirty = true; toast('Installed: ' + d.name); save(); } openMenu('build'); return; }
    const b = e.target.closest('[data-b]');
    if (b) {
      const k = b.dataset.b, costs = { seats: 350000, vipx: 300000, jumbo: 250000, crew: 10000, fire: 0, mkt: 30000, lotB: 200000, garage: 600000, transit: 120000 };
      if (S.cash < costs[k]) return;
      S.cash -= costs[k];
      if (k === 'seats') { S.capacity += 600; buildSeats(); buildIso(); crowdDirty = true; } if (k === 'vipx') { S.vipSeats += 200; S.capacity += 200; }
      if (k === 'jumbo') S.jumbotron = true; if (k === 'crew') S.crew++; if (k === 'fire') S.crew--;
      if (k === 'mkt') S.marketing = Math.min(0.45, S.marketing + 0.15);
      if (k === 'lotB') { S.lotB = true; S.parking += 216; buildStalls(); buildCity(); }
      if (k === 'garage') { S.garage = true; S.parking += 400; buildStalls(); buildCity(); }
      if (k === 'transit') { S.transit = true; S.rep += 2; }
      syncJanitors(); toast('Purchased: ' + b.closest('.row').querySelector('b').textContent); save(); openMenu('build');
    }
    const m = e.target.closest('[data-m]');
    if (m) {
      const k = m.dataset.m, mul = down ? 1 : 3;
      const doIt = c => { if (S.cash < c) { toast('Not enough cash'); return false; } S.cash -= c; return true; };
      if (k === 'ice' && doIt(15000)) S.ice = 100;
      if (k === 'bld' && doIt((100 - S.building) * 600 * mul)) S.building = 100;
      if (k === 'clean' && doIt(6000)) trash = [];
      if (k === 'st') { const st = S.stands[+m.dataset.i]; if (doIt(repairCost(st) * mul)) { st.cond = 100; st._brokeEvt = false; } }
      if (k === 'all') {
        let c = 0; if (down) { c += S.ice < 98 ? 15000 : 0; c += trash.length ? 6000 : 0; }
        c += (100 - S.building) * 600 * mul; S.stands.forEach(st => { if (st.cond < 98) c += repairCost(st) * mul; });
        if (doIt(c)) { if (down) { S.ice = 100; trash = []; } S.building = 100; S.stands.forEach(st => { st.cond = 100; st._brokeEvt = false; }); toast('Everything repaired (−' + kmoney(c) + ')'); }
      }
      save(); openMenu('maint');
    }
  };
  M.oninput = e => {
    const k = e.target.dataset.p; if (!k) return;
    if (k === 'ticket' || k === 'vip') { if (inGame()) { toast('Ticket prices lock once doors open'); e.target.value = S.prices[k]; return; } }
    S.prices[k] = +e.target.value; $('pv_' + k).textContent = money(S.prices[k]);
    const f = demandForecast(); const fc = $('fcast'); if (fc) fc.innerHTML = 'Next-game ticket forecast: <b>' + f.demand.toLocaleString() + '</b> (cap ' + S.capacity.toLocaleString() + '). Ticket prices lock when doors open.';
    save();
  };
}
function finChart() {
  const c = $('finc'), x = c.getContext('2d'), hs = S.history.slice(-20);
  const keys = [['tickets', '#4da3ff'], ['vip', '#f0c94a'], ['parking', '#9aa4b5'], ['food', '#e39a2e'], ['beer', '#c99a2a'], ['merch', '#d42a44'], ['other', '#7a55cc'], ['ads', '#3fcf7a']];
  const tot = hs.map(h => keys.reduce((s, [k]) => s + (h.rev[k] || 0), 0));
  const mxv = Math.max(...tot, 1), bw = c.width / Math.max(10, hs.length);
  hs.forEach((h, i) => {
    let y = 130;
    keys.forEach(([k, col]) => { const v = (h.rev[k] || 0) / mxv * 115; x.fillStyle = col; x.fillRect(i * bw + 4, y - v, bw - 8, v); y -= v; });
    x.fillStyle = h.profit < 0 ? '#ff5c5c' : '#fff'; x.font = '10px system-ui'; x.textAlign = 'center'; x.fillText(kmoney(h.profit), i * bw + bw / 2, 145);
  });
  x.textAlign = 'left'; keys.forEach(([k, col], i) => { x.fillStyle = col; x.fillRect(i * 74, 0, 8, 8); x.fillStyle = '#ccd'; x.fillText(k, i * 74 + 11, 8); });
}
function showReport(g) {
  modalOpen = true; MW.style.display = 'flex';
  const tr = g.rev.tickets + g.rev.vip, con = g.rev.food + g.rev.beer + g.rev.merch + g.rev.other;
  M.innerHTML = '<h2>Final: ' + HOME.short + ' ' + g.score[0] + ' – ' + g.score[1] + ' ' + g.opp + ' (' + g.res + (g.so ? ', ' + g.so : '') + ')</h2>' +
    '<div class="kv"><span>Attendance</span><b>' + g.att.toLocaleString() + ' / ' + S.capacity.toLocaleString() + '</b><span>Fans turned away (parking)</span><b>' + g.turned + '</b>' +
    '<span>Ticket & VIP revenue</span><b>' + money(tr) + '</b><span>Concessions & store</span><b>' + money(con) + '</b><span>Parking</span><b>' + money(g.rev.parking) + '</b><span>Ads & sponsors</span><b>' + money(g.rev.ads) + '</b>' +
    '<span>Cost of goods sold</span><b style="color:var(--bad)">−' + money(g.cogs) + '</b>' +
    Object.entries(G.expBreak).map(([k, v]) => '<span>' + k + '</span><b style="color:var(--bad)">−' + money(v) + '</b>').join('') +
    (g.early ? '<span>Fans who left early (blowout)</span><b style="color:var(--warn)">' + g.early.toLocaleString() + '</b>' : '') + '<span>Sales lost to long lines</span><b style="color:var(--warn)">' + money(g.lost) + '</b>' +
    '<span style="font-size:15px;color:var(--text)">Game profit</span><b style="font-size:15px;color:' + (g.profit < 0 ? 'var(--bad)' : 'var(--good)') + '">' + money(g.profit) + '</b>' +
    '<span>Fan mood → Reputation</span><b>' + g.mood + '% → ' + Math.round(S.rep) + '</b></div>' +
    '<p style="color:var(--dim)">Downtime now — fix things up, then hit Skip ▸▸ to open the doors for the next game.</p><div class="btns"><button class="buy" data-close>Back to the arena</button></div>';
  M.onclick = e => { if (e.target.closest('[data-close]')) closeModal(); };
}

/* ====================================================================
   BOOT
   ==================================================================== */
resize(); buildSeats(); buildCity(); buildStalls(); initTraffic(); syncJanitors(); setupPlayers(); buildCrowd(); drawLogo($('logoC').getContext('2d'), 15, 15, 14);
let lastT = performance.now(), hudT = 0, miniT = 0;
function frame(now) {
  const rdt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  movePlayer(rdt); cam.z += (cam.zt - cam.z) * Math.min(1, rdt * 7);
  if (!modalOpen && speed > 0) step(rdt * speed);
  for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx * rdt; p.y += p.vy * rdt; p.life -= rdt * (modalOpen ? 0 : Math.max(1, speed)); if (p.life <= 0) particles.splice(i, 1); }
  if (banner) banner.t -= rdt;
  render();
  hudT -= rdt; if (hudT <= 0) { hudT = 0.25; hud(); }
  miniT -= rdt; if (miniT <= 0) { miniT = 0.5; drawMini(); alertsT++; if (alertsT % 2 === 0) alerts(); }
  requestAnimationFrame(frame);
}
function step(simdt) { const n = Math.ceil(simdt / 0.034), h = simdt / n; for (let i = 0; i < n; i++) update(h); }
requestAnimationFrame(frame);
if (!localStorage.getItem('arenaTycoonSeen')) { openMenu('help'); try { localStorage.setItem('arenaTycoonSeen', 1); } catch (e) {} }
// debug / automation hook
window.ARENA = { noEvents: false, S: () => S, sim: s => { const n = Math.ceil(s / 0.034); for (let i = 0; i < n; i++) update(0.034); }, phase: i => enterPhase(i), me, cam, inspect, allThings, openMenu, showEvent, EVT, closeModal, setSpeed, toggleHeat, toggleOverview, setLevelView, buildCrowd, get react() { return react; }, get phk() { return phK(); }, get day() { return S.day; }, get exitShow() { return exitShow; }, get G() { return G; }, get score() { return score; }, get players() { return players; }, get agents() { return agents; } };
