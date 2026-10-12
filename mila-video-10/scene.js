/* Mila film #10 — "Departures" (4:5 feed).
 * render(t) is a pure function of time; cues are beats b of "It Goes Like Nanana" at 130 BPM (0.4615 s).
 * Hook: split-flap departures board of your to-dos, all DELAYED, your own flight on FINAL CALL, client texts piling b0-12 ·
 * one message to Mila + AIRPLANE MODE in the kick build b12-16 (reverb hang) · DROP: the whole board scrambles to ON TIME b16 ·
 * wheels up + seat-back flight map MIA -> NAS while results land b17.6-29.6 · ARRIVALS, approve all b30-31 ·
 * "You traveled. Mila worked." b32 · end card with the CTA on split-flaps b35 · loop tail b39-40 to the exact frame 0.
 */
(async function () {
  const TL = await (await fetch('timeline.json')).json();
  const BEAT = TL.beat, DUR = TL.duration, TOT = TL.totalBeats;
  const qs = new URLSearchParams(location.search);
  const RENDER = qs.has('render');
  if (RENDER) document.body.classList.add('render');
  const W = 1080, H = 1350, vp = document.getElementById('viewport');
  if (!RENDER) { const fit = () => { const k = Math.min(innerWidth / W, (innerHeight - 60) / H); vp.style.transformOrigin = '0 0'; vp.style.transform = `translate(${(innerWidth - W * k) / 2}px,0) scale(${k})`; }; fit(); addEventListener('resize', fit); }

  /* ---------------------------------------------------------------- helpers */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, p) => a + (b - a) * p, P = (x, x0, x1) => clamp((x - x0) / (x1 - x0));
  const E = {
    outExpo: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)), inExpo: p => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10)),
    inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2), outCubic: p => 1 - Math.pow(1 - p, 3), inCubic: p => p * p * p,
    outBack: p => { const c = 1.6; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    spring: p => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-6.2 * p) * Math.cos(9.5 * p)),
  };
  const TAU = Math.PI * 2, per = (b, k) => Math.sin(TAU * k * b / TOT), perc = (b, k) => Math.cos(TAU * k * b / TOT);
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const hash = (...a) => { let h = 2166136261; for (const v of a) { h ^= Math.floor(v * 1000) | 0; h = Math.imul(h, 16777619); } return h >>> 0; };
  const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const set = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const vis = (el, on) => { el.style.visibility = on ? 'inherit' : 'hidden'; };
  const pulseAt = (b, T, k = 8) => (b >= T ? Math.exp(-(b - T) * k) : 0);
  const I = {
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.6"/><path d="m3.6 6.6 8.4 6.4 8.4-6.4"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    msg: '<path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-5.5 4v-4h0a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.5"/><path d="M15.5 14.3c2.6-.4 4.4 1.2 5 4.2"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    arrow: '<path d="M12 18.5V5.5M6 11.5 12 5.5l6 6"/>',
  };
  const svg = (n, s = 22, w = 1.9, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;
  const PLANE = (s, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c}"><path d="M21.5 15.5v-2l-8-5V3.6a1.6 1.6 0 0 0-3.2 0v4.9l-8 5v2l8-2.5v5.4l-2 1.5V21l3.6-1 3.6 1v-1.6l-2-1.5V13z"/></svg>`;
  $('#cSend').innerHTML = svg('arrow', 30, 2.4); $('#apmIc').innerHTML = PLANE(32); $('#plane').innerHTML = PLANE(34);

  /* ---------------------------------------------------------------- split-flap engine (canvas) */
  const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:-';
  const COL = { white: '#f3eee2', amber: '#ffc95c', red: '#ff5c7a', green: '#6ff0a6', dim: '#8a879b' };
  const ATLAS = new Map();
  function tile(ch, color, w, h, fs) {
    const key = ch + '|' + color + '|' + w + '|' + h; if (ATLAS.has(key)) return ATLAS.get(key);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#24242e'); g.addColorStop(0.5, '#1b1b23'); g.addColorStop(0.5, '#15151c'); g.addColorStop(1, '#1c1c24');
    x.fillStyle = g; x.beginPath(); x.roundRect(0, 0, w, h, Math.max(2, w * 0.1)); x.fill();
    x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(1, 1, w - 2, 1);
    if (ch !== ' ') { x.fillStyle = color; x.font = `700 ${fs}px "DejaVu Sans Mono"`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, w / 2, h / 2 + fs * 0.04); }
    x.fillStyle = 'rgba(0,0,0,.65)'; x.fillRect(0, h / 2 - 1, w, 2);                // the split
    ATLAS.set(key, c); return c;
  }
  // cell state at beat b for a timeline of strings
  function cellAt(evs, k, b, stagger, seedBase) {
    let i = 0; while (i < evs.length - 1 && b >= evs[i + 1][0] + k * stagger) i++;
    const target = evs[i][1][k] || ' ', prev = i > 0 ? (evs[i - 1][1][k] || ' ') : target;
    if (prev === target) return { to: target, ei: i };
    const s = evs[i][0] + k * stagger, h = hash(seedBase, i, k), n = 3 + (h % 4), d = 0.07, e = (b - s) / d;
    if (e >= n) return { to: target, ei: i };
    const j = Math.max(0, Math.floor(e)), q = e - j, rch = m => CHARSET[hash(h, m) % CHARSET.length];
    return { from: j === 0 ? prev : rch(j - 1), to: j === n - 1 ? target : rch(j), q, ei: i };
  }
  function drawCell(ctx, x, y, w, h, fs, st, color) {
    if (st.q === undefined) { ctx.drawImage(tile(st.to, color, w, h, fs), x, y); return; }
    const A = tile(st.from, color, w, h, fs), B = tile(st.to, color, w, h, fs), hh = h / 2, q = st.q;
    ctx.drawImage(B, 0, 0, w, hh, x, y, w, hh);                 // new top (revealed behind the falling leaf)
    ctx.drawImage(A, 0, hh, w, hh, x, y + hh, w, hh);           // old bottom (covered by the landing leaf)
    if (q < 0.5) { const sy = Math.cos(q * Math.PI); ctx.drawImage(A, 0, 0, w, hh, x, y + hh - hh * sy, w, hh * sy); ctx.fillStyle = `rgba(0,0,0,${0.55 * (1 - sy)})`; ctx.fillRect(x, y + hh - hh * sy, w, hh * sy); }
    else { const sy = -Math.cos(q * Math.PI); ctx.drawImage(B, 0, hh, w, hh, x, y + hh, w, hh * sy); ctx.fillStyle = `rgba(0,0,0,${0.5 * (1 - sy)})`; ctx.fillRect(x, y + hh, w, hh * sy); }
  }

  /* board data */
  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
  const rowStr = (r, status) => `${pad(r[0], 5)} ${pad(r[1], 5)} ${pad(r[2], 15)} ${pad(status, 10)}`;
  const ROWS = TL.rows.map((r, i) => {
    const evs = [[-99, rowStr(r, TL.status0[i])]];
    TL.changes.filter(c => c[1] === i).forEach(c => evs.push([c[0], rowStr(r, c[2])]));
    return { evs, statuses: [TL.status0[i], ...TL.changes.filter(c => c[1] === i).map(c => c[2])] };
  });
  const HEAD = TL.header.map(([b, s]) => [b < 0 ? -99 : b, pad(s, 11)]);
  const statusColor = s => /DELAY|CANCEL|NOT READY/.test(s) ? COL.red : /BOARDING|FINAL/.test(s) ? COL.amber : COL.green;
  const bcv = $('#bcv'), bx = bcv.getContext('2d');
  const TW = 23, TH = 40, TG = 2, X0 = 65, Y0 = 132, RH = 50;
  function drawBoard(b) {
    bx.clearRect(0, 0, 1020, 500);
    // highlight band for your own flight
    const ry = Y0 + 6 * RH; bx.fillStyle = 'rgba(255,201,92,.07)'; bx.fillRect(20, ry - 5, 980, TH + 10);
    if (b >= 8 && b < 16 && Math.floor(b * 2) % 2 === 0) { bx.fillStyle = 'rgba(255,201,92,.1)'; bx.fillRect(20, ry - 5, 980, TH + 10); }
    if (b >= 16 && b < 17.5) { bx.fillStyle = `rgba(111,240,166,${0.12 * (1 - P(b, 16, 17.5))})`; bx.fillRect(20, Y0 - 5, 980, 7 * RH); }
    // header
    for (let k = 0; k < 11; k++) { const st = cellAt(HEAD, k, b, 0.04, 999); drawCell(bx, 34 + k * 44, 26, 40, 58, 40, st, COL.amber); }
    ROWS.forEach((row, r) => {
      for (let k = 0; k < 38; k++) {
        if (k === 5 || k === 11 || k === 27) continue;
        const st = cellAt(row.evs, k, b, 0.022, r * 50);
        const col = k >= 28 ? statusColor(row.statuses[st.ei]) : k < 5 ? COL.white : k < 11 ? COL.amber : COL.white;
        drawCell(bx, X0 + k * (TW + TG) - (k > 27 ? 0 : 0), Y0 + r * RH, TW, TH, 27, st, col);
      }
      // blink the red statuses a little during the stress
      const s = row.statuses[cellAt(row.evs, 30, b, 0.022, r * 50).ei];
      if (b < 16 && /CANCEL|FINAL/.test(s) && Math.floor(b * 4) % 2 === 0) { bx.fillStyle = 'rgba(7,7,11,.35)'; bx.fillRect(X0 + 28 * (TW + TG), Y0 + r * RH, 10 * (TW + TG), TH); }
    });
  }
  // end-card CTA flaps
  const ecv = $('#ecv'), ex = ecv.getContext('2d');
  const CTA1 = [[-99, ' '.repeat(14)], [TL.cta[0], 'COMMENT "MILA"']], CTA2 = [[-99, ' '.repeat(16)], [TL.cta[1], '7-DAY FREE TRIAL']];
  const CHARSET2 = CHARSET + '"';
  function drawCTA(b) {
    ex.clearRect(0, 0, 1080, 1350);
    const r1 = { w: 60, h: 92, g: 6, fs: 62, y: 600 }, r2 = { w: 52, h: 80, g: 5, fs: 54, y: 712 };
    [[CTA1, r1, COL.amber, 14], [CTA2, r2, COL.white, 16]].forEach(([evs, g, col, n], ri) => {
      const x0 = (1080 - n * (g.w + g.g) + g.g) / 2;
      for (let k = 0; k < n; k++) { const st = cellAt(evs, k, b, 0.04, 700 + ri * 31); drawCell(ex, x0 + k * (g.w + g.g), g.y, g.w, g.h, g.fs, st, col); }
    });
  }

  /* ---------------------------------------------------------------- notifications */
  const NOTS = TL.notifs.map(([who, msg, at], i) => {
    const el = document.createElement('div'); el.className = 'nt dglass';
    const ini = who.split(/[\s·]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    el.innerHTML = `<div class="av">${/\d/.test(who) ? '3' : ini}</div><div><b>${who}</b><span>${msg}</span></div><em>now</em>`;
    $('#notifs').appendChild(el); return { el, at };
  });

  /* ---------------------------------------------------------------- result cards */
  const CARDS = TL.cards.map(([at, t, d, ic]) => {
    const el = document.createElement('div'); el.className = 'rc dglass';
    const icon = ic === 'photo' ? `<div class="ti" style="background-image:url(assets/photos/hero_waterfront.jpg)"></div>` : `<div class="ti">${svg(ic, 30, 2.1)}</div>`;
    el.innerHTML = `${icon}<div><div class="tt">${t}</div><div class="td">${d}</div></div><div class="chip">READY ✓</div>`;
    $('#cards').appendChild(el); return { el, at };
  });

  /* ---------------------------------------------------------------- take-off line art */
  $('#takeoff').innerHTML = `<defs><linearGradient id="ct" x1="0" x2="1"><stop offset="0" stop-color="#8fb4ff" stop-opacity="0"/><stop offset=".5" stop-color="#a68cff"/><stop offset="1" stop-color="#ffc9a8"/></linearGradient></defs>
    ${Array.from({ length: 9 }, (_, i) => `<line class="rw" x1="${540 + (i - 4) * 18}" y1="300" x2="${540 + (i - 4) * 150}" y2="480" stroke="rgba(255,201,92,.35)" stroke-width="2" stroke-dasharray="6 16"/>`).join('')}
    <path id="trail" d="M -80 470 C 260 450, 560 330, 1160 40" fill="none" stroke="url(#ct)" stroke-width="7" stroke-linecap="round"/>
    <g id="tPlane">${PLANE(64, '#fff').replace('<svg', '<svg x="-32" y="-32"')}</g>`;
  const trail = $('#trail'), TLEN = trail.getTotalLength(); trail.setAttribute('stroke-dasharray', TLEN);

  /* ---------------------------------------------------------------- seat-back map */
  const mcv = $('#mcv'), mx = mcv.getContext('2d');
  const LON0 = -82.6, LAT0 = 27.29, SXp = 1020 / 6.8, SYp = SXp / Math.cos(25.5 * Math.PI / 180);
  const pj = ([lon, lat]) => [(lon - LON0) * SXp, (LAT0 - lat) * SYp];
  const FL = [[-82.8, 27.9], [-82.6, 27.4], [-82.2, 26.8], [-81.9, 26.4], [-81.7, 25.9], [-81.3, 25.4], [-81.1, 25.15], [-80.5, 25.2], [-80.3, 25.4], [-80.12, 25.8], [-80.03, 26.4], [-80.08, 27.0], [-80.4, 27.6], [-80.6, 28.2], [-79.5, 28.6], [-83.5, 28.6]];
  const ISL = [
    [[-78.98, 26.69], [-78.3, 26.63], [-77.85, 26.62], [-78.0, 26.52], [-78.7, 26.5]],
    [[-77.55, 26.9], [-77.0, 26.6], [-77.15, 26.0], [-77.35, 26.1], [-77.45, 26.5]],
    [[-78.3, 25.2], [-77.75, 24.7], [-77.7, 24.3], [-78.0, 24.0], [-78.4, 24.4], [-78.25, 24.9]],
    [[-76.8, 25.55], [-76.35, 25.1], [-76.15, 24.7], [-76.3, 24.65], [-76.55, 25.1], [-76.95, 25.5]],
    [[-77.55, 25.08], [-77.2, 25.06], [-77.25, 24.99], [-77.55, 25.0]],
    [[-77.85, 25.85], [-77.7, 25.5], [-77.8, 25.45], [-77.92, 25.8]],
  ];
  const KEYS = Array.from({ length: 14 }, (_, i) => [-80.45 - i * 0.1, 25.2 - Math.pow(i / 13, 1.4) * 0.65]);
  const EXUMA = Array.from({ length: 10 }, (_, i) => [-76.6 + i * 0.07, 24.4 - i * 0.07]);
  const MIA = pj([-80.29, 25.80]), NAS = pj([-77.35, 25.04]), CTRL = [(MIA[0] + NAS[0]) / 2, Math.min(MIA[1], NAS[1]) - 150];
  const bez = (t) => [(1 - t) ** 2 * MIA[0] + 2 * (1 - t) * t * CTRL[0] + t * t * NAS[0], (1 - t) ** 2 * MIA[1] + 2 * (1 - t) * t * CTRL[1] + t * t * NAS[1]];
  const bezD = (t) => [2 * (1 - t) * (CTRL[0] - MIA[0]) + 2 * t * (NAS[0] - CTRL[0]), 2 * (1 - t) * (CTRL[1] - MIA[1]) + 2 * t * (NAS[1] - CTRL[1])];
  const PLANEP = new Path2D('M21.5 15.5v-2l-8-5V3.6a1.6 1.6 0 0 0-3.2 0v4.9l-8 5v2l8-2.5v5.4l-2 1.5V21l3.6-1 3.6 1v-1.6l-2-1.5V13z');
  function drawMap(b, prog) {
    const g = mx.createLinearGradient(0, 0, 0, 680); g.addColorStop(0, '#0d1230'); g.addColorStop(1, '#0a0b1c'); mx.fillStyle = g; mx.fillRect(0, 0, 1020, 680);
    mx.strokeStyle = 'rgba(143,180,255,.07)'; mx.lineWidth = 1;
    for (let lon = -82; lon <= -76; lon++) { const [x] = pj([lon, 0]); mx.beginPath(); mx.moveTo(x, 0); mx.lineTo(x, 680); mx.stroke(); }
    for (let lat = 24; lat <= 27; lat++) { const [, y] = pj([0, lat]); mx.beginPath(); mx.moveTo(0, y); mx.lineTo(1020, y); mx.stroke(); }
    const land = pts => { mx.beginPath(); pts.forEach((p, i) => { const [x, y] = pj(p); i ? mx.lineTo(x, y) : mx.moveTo(x, y); }); mx.closePath(); mx.fillStyle = '#25244d'; mx.fill(); mx.strokeStyle = 'rgba(166,140,255,.55)'; mx.lineWidth = 2; mx.stroke(); };
    land(FL); ISL.forEach(land);
    [...KEYS, ...EXUMA].forEach(p => { const [x, y] = pj(p); mx.fillStyle = '#3a3870'; mx.beginPath(); mx.arc(x, y, 3, 0, TAU); mx.fill(); });
    // route
    mx.setLineDash([8, 10]); mx.strokeStyle = 'rgba(255,255,255,.35)'; mx.lineWidth = 3; mx.beginPath(); mx.moveTo(...MIA); mx.quadraticCurveTo(...CTRL, ...NAS); mx.stroke(); mx.setLineDash([]);
    const rg = mx.createLinearGradient(MIA[0], 0, NAS[0], 0); rg.addColorStop(0, '#8fb4ff'); rg.addColorStop(0.55, '#a68cff'); rg.addColorStop(1, '#ffc9a8');
    mx.strokeStyle = rg; mx.lineWidth = 5; mx.shadowColor = 'rgba(166,140,255,.9)'; mx.shadowBlur = 16; mx.beginPath(); mx.moveTo(...MIA);
    for (let k = 1; k <= 60; k++) { const p = bez(prog * k / 60); mx.lineTo(...p); } mx.stroke(); mx.shadowBlur = 0;
    // cities
    [[MIA, 'MIAMI'], [NAS, 'NASSAU']].forEach(([p, n]) => { mx.fillStyle = '#fff'; mx.beginPath(); mx.arc(p[0], p[1], 7, 0, TAU); mx.fill(); mx.strokeStyle = 'rgba(255,255,255,.4)'; mx.lineWidth = 2; mx.beginPath(); mx.arc(p[0], p[1], 14, 0, TAU); mx.stroke();
      mx.font = '700 18px "DejaVu Sans Mono"'; mx.fillStyle = 'rgba(255,255,255,.85)'; mx.textAlign = 'center'; mx.fillText(n, p[0], p[1] + 40); });
    // pulses where results land
    TL.cards.forEach(c => { if (b >= c[0] && b < c[0] + 1.2) { const a = P(b, c[0], c[0] + 1.2), pp = bez(P(c[0], 18, 29.2)); mx.strokeStyle = `rgba(111,240,166,${1 - a})`; mx.lineWidth = 3; mx.beginPath(); mx.arc(pp[0], pp[1], 12 + a * 70, 0, TAU); mx.stroke(); } });
    // plane
    const pp = bez(prog), d = bezD(Math.min(0.999, Math.max(0.001, prog))), ang = Math.atan2(d[1], d[0]) + Math.PI / 2;
    mx.save(); mx.translate(pp[0], pp[1]); mx.rotate(ang); mx.scale(2.3, 2.3); mx.translate(-12, -12); mx.shadowColor = 'rgba(255,255,255,.9)'; mx.shadowBlur = 12; mx.fillStyle = '#fff'; mx.fill(PLANEP); mx.restore();
  }

  /* ---------------------------------------------------------------- type */
  const WORDS = [
    { l: ["Your flight's boarding.", "Your work isn't."], at: [-9, -9], out: 11.6, x: 540, y: 205, fs: 86, w: 960, hook: true },
    { l: ['Wheels up.'], at: [16.3], out: 17.45, x: 540, y: 1000, fs: 150, w: 900 },
    { l: ['Landed.'], at: [29.85], out: 31.7, x: 540, y: 200, fs: 130, w: 900 },
    { l: ['You traveled.', 'Mila worked.'], at: [32.0, 32.5], out: 34.55, x: 540, y: 660, fs: 170, w: 940 },
  ];
  WORDS.forEach(w => {
    const el = document.createElement('div'); el.className = 'kw';
    el.innerHTML = w.l.map(t => `<div class="ln"><span>${t}</span></div>`).join('');
    set(el, { left: w.x + 'px', top: w.y + 'px', fontSize: w.fs + 'px', transform: 'translate(-50%,-50%)', textAlign: 'center' });
    $('#words').appendChild(el); w.el = el; w.spans = $$('.ln > span', el);
  });

  /* ---------------------------------------------------------------- assets */
  await document.fonts.load('400 40px "Instrument Serif"'); await document.fonts.load('600 16px "Inter"'); await document.fonts.load('700 16px "DejaVu Sans Mono"'); await document.fonts.ready;
  await new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = 'assets/photos/hero_waterfront.jpg'; });
  WORDS.forEach(w => { const wd = w.el.offsetWidth; if (wd > w.w) w.el.style.fontSize = (w.fs * w.w / wd) + 'px'; });

  const R = {
    cam: $('#cam'), gate: $('#gate'), gateSt: $('#gateSt'), clock: $('#clock'), board: $('#board'), boardGlow: $('#boardGlow'), plane: $('#plane'),
    comp: $('#comp'), typed: $('#typed'), caret: $('#caret'), cPh: $('#cPh'), cSend: $('#cSend'), apm: $('#apm'), swI: $('#apm .sw i'), swB: $('#apm .sw b'), apmSub: $('#apmSub'),
    takeoff: $('#takeoff'), tPlane: $('#tPlane'), seat: $('#seat'), mAlt: $('#mAlt'), mSpd: $('#mSpd'), mEta: $('#mEta'), mDone: $('#mDone'), apBar: $('#apBar'),
    endc: $('#endc'), wordmark: $('#wordmark'), tagline: $('#tagline'), tagSpan: $('#tagline .ln > span'), flash: $('#flash'), gA: $('#gA'), gB: $('#gB'), gC: $('#gC'),
  };
  const grain = $('#grain'), gctx = grain.getContext('2d'), NOISE = [];
  { const r = rng(99); for (let k = 0; k < 8; k++) { const c = document.createElement('canvas'); c.width = 540; c.height = 675; const x = c.getContext('2d'), id = x.createImageData(540, 675); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 110; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); NOISE.push(c); } }
  const bk = $('#bokeh'), bkx = bk.getContext('2d');
  const BOKEH = (() => { const r = rng(12); return Array.from({ length: 26 }, () => ({ x: r() * 1080, y: r() * 1350, r: 20 + r() * 70, c: ['143,180,255', '166,140,255', '255,201,168', '255,201,92'][Math.floor(r() * 4)], a: 0.04 + r() * 0.08, ph: r() * TAU, k: 1 + Math.floor(r() * 2) })); })();
  const reveal = (span, b, b0, outB = 999, dur = 0.8) => { const p = E.outExpo(P(b, b0, b0 + dur)), q = E.inCubic(P(b, outB, outB + 0.35)); span.style.transform = `translateY(${(1 - p) * 112 - q * 112}%)`; span.style.opacity = p > 0 ? 1 : 0; span.style.filter = (p < 1 || q > 0) ? `blur(${(1 - p) * 6 + q * 6}px)` : 'none'; };

  /* ================================================================ RENDER */
  function render(t) {
    const raw = t / BEAT, b = raw;
    const tail = raw >= TL.loopTail[0], tailIn = E.inOut(P(raw, 39.15, 39.85));
    const hb = tail ? 0 : b;                                    // hook/board time (the tail rebuilds frame 0)
    const apOn = b >= 15.25 && b < 16 && !tail;                 // airplane-mode hang

    /* camera */
    let cx = per(raw, 3) * 3, cy = per(raw, 2) * 2, cs = 1 + 0.004 * per(raw, 2);
    for (const n of NOTS) if (n.at >= 0) { const d = pulseAt(hb, n.at, 9); cx += Math.sin(b * 90) * 4 * d; }
    if (apOn) cs *= 1 + 0.04 * E.inCubic(P(b, 15.25, 16));
    for (const T of [16, ...TL.cards.map(c => c[0]), 30, 31, 32, 35]) { const d = pulseAt(b, T, 8); cy += 6 * d; cs *= 1 + (T === 16 || T === 35 ? 0.035 : 0.01) * d; }
    R.cam.style.transform = `translate(${cx}px,${cy}px) scale(${cs})`;
    R.cam.style.filter = apOn ? `saturate(${1 - 0.5 * P(b, 15.25, 15.5)}) brightness(${1 - 0.15 * P(b, 15.25, 15.6)})` : 'none';

    /* ambient */
    const glow = 0.45 + 0.55 * (pulseAt(b, 16, 1.8) + pulseAt(b, 31, 2) + pulseAt(b, 35, 2));
    set(R.gA, { left: (540 - 300 + per(raw, 2) * 160) + 'px', top: (480 + perc(raw, 1) * 140) + 'px', opacity: glow });
    set(R.gB, { left: (540 + 320 + perc(raw, 2) * 140) + 'px', top: (780 + per(raw, 1) * 160) + 'px', opacity: glow * 0.9 });
    set(R.gC, { left: (540 + per(raw, 1) * 220) + 'px', top: 1180 + 'px', opacity: glow * 0.7 });
    bkx.clearRect(0, 0, 1080, 1350);
    for (const o of BOKEH) { const x = ((o.x + per(raw, o.k) * 40) % 1080 + 1080) % 1080, y = o.y + perc(raw, o.k) * 30, a = o.a * (0.7 + 0.3 * Math.sin(TAU * 3 * raw / TOT + o.ph));
      const g = bkx.createRadialGradient(x, y, 0, x, y, o.r); g.addColorStop(0, `rgba(${o.c},${a})`); g.addColorStop(1, `rgba(${o.c},0)`); bkx.fillStyle = g; bkx.beginPath(); bkx.arc(x, y, o.r, 0, TAU); bkx.fill(); }

    /* ---------- gate strip ---------- */
    const gateOn = (b < 17.6 || (b >= 29.7 && b < 32.2)) || raw >= 39.15; vis(R.gate, gateOn);
    if (gateOn) {
      R.gateSt.textContent = hb < 8 ? 'BOARDING' : hb < 16 ? 'FINAL CALL' : hb < 29.7 ? 'DEPARTED' : 'ARRIVED';
      R.gateSt.style.color = hb < 16 ? 'var(--amber)' : 'var(--green)';
      R.gateSt.style.opacity = hb >= 8 && hb < 16 && Math.floor(hb * 2) % 2 ? 0.35 : 1;
      R.clock.textContent = hb < 4 ? '07:31' : hb < 8 ? '07:34' : hb < 12 ? '07:37' : hb < 16 ? '07:39' : hb < 29.7 ? '07:40' : '08:43';
      const o = tail ? tailIn : b < 17.6 ? 1 - P(b, 17.2, 17.6) : b < 32.2 ? E.outCubic(P(b, 29.7, 30.1)) * (1 - P(b, 31.9, 32.2)) : 0;
      R.gate.style.opacity = o;
    }

    /* ---------- the board ---------- */
    const boardOn = b < 17.9 || (b >= 29.6 && b < 33) || raw >= 39.15; vis(R.board, boardOn);
    if (boardOn) {
      const bb = tail ? 0 : b;
      drawBoard(bb);
      let o = 1, y = 0, s = 1, blur = 0;
      if (tail) { o = tailIn; blur = (1 - tailIn) * 10; }
      else if (b < 17.9) { const out = E.inCubic(P(b, 17.3, 17.9)); o = 1 - out; y = -120 * out; s = 1 - 0.06 * out; blur = out * 8; }
      else { const a = E.outExpo(P(b, 29.6, 30.2)), out = E.inCubic(P(b, 32, 32.6)); o = clamp(a * 2) * lerp(1, 0.12, out); y = (1 - a) * 80; blur = out * 8; }
      set(R.board, { opacity: o, transform: `translateY(${y}px) scale(${s})`, filter: blur > 0.1 ? `blur(${blur}px)` : 'none' });
      R.boardGlow.style.opacity = Math.max(pulseAt(b, 16, 1.6), pulseAt(b, 31, 1.6));
      R.plane.style.color = hb < 16 ? 'var(--amber)' : 'var(--green)';
    }

    /* ---------- notifications (b0-12, and the tail) ---------- */
    const ntOn = b < 12.2 || raw >= 39.15;
    NOTS.forEach((n, i) => {
      const on = ntOn && hb >= n.at; vis(n.el, on); if (!on) return;
      let rank = 0; for (let j = i + 1; j < NOTS.length; j++) if (hb >= NOTS[j].at) rank += NOTS[j].at < 0 ? 1 : E.outExpo(P(hb, NOTS[j].at, NOTS[j].at + 0.45));
      const a = n.at < 0 ? 1 : E.spring(P(hb, n.at, n.at + 0.5)), out = tail ? 0 : E.inCubic(P(b, 11.6, 12.1));
      set(n.el, { top: (850 + rank * 112 + (1 - a) * -60 + out * 300) + 'px', opacity: clamp(a * 2) * (1 - P(rank, 3, 3.8)) * (1 - out) * (tail ? tailIn : 1), transform: `scale(${(0.94 + 0.06 * a) * (1 - 0.03 * Math.min(rank, 4))})` });
    });

    /* ---------- composer + airplane mode (b11.9-16.4) ---------- */
    const compOn = b >= 11.9 && b < 16.45 && !tail; vis(R.comp, compOn); vis(R.apm, compOn && b >= 14.85);
    if (compOn) {
      const a = E.spring(P(b, 11.9, 12.5)), out = E.inCubic(P(b, 16, 16.45));
      const k = TL.keyBeats.filter(x => x <= b).length;
      R.typed.textContent = TL.prompt.slice(0, k); R.cPh.style.display = k ? 'none' : 'inline';
      R.caret.style.opacity = b >= TL.send ? 0 : (k > 0 && k < TL.prompt.length) || b % 1 < 0.6 ? 1 : 0;
      const sent = E.inCubic(P(b, TL.send, TL.send + 0.35));
      set(R.comp, { transform: `translateY(${(1 - a) * 140 + out * 400 - 60 * sent}px) scale(${1 - 0.04 * sent})`, opacity: clamp(a * 2) * (1 - out) * lerp(1, 0.55, sent) });
      R.cSend.style.transform = `scale(${b >= TL.send && b < TL.send + 0.2 ? 1 - 0.12 * Math.sin(P(b, TL.send, TL.send + 0.2) * Math.PI) : 1})`;
      R.cSend.style.boxShadow = b >= TL.send ? `0 0 ${40 * pulseAt(b, TL.send, 3)}px rgba(166,140,255,.95)` : 'none';
      const pa = E.spring(P(b, 14.85, 15.35)), on = E.outBack(P(b, TL.airplane, TL.airplane + 0.3));
      set(R.apm, { transform: `translateY(${(1 - pa) * 100 + out * 400}px)`, opacity: clamp(pa * 2) * (1 - out), boxShadow: b >= TL.airplane ? `0 0 ${50 * pulseAt(b, TL.airplane, 1.5)}px rgba(255,201,168,.8)` : '' });
      R.swI.style.transform = `translateX(${44 * clamp(on, 0, 1.1)}px)`; R.swB.style.opacity = clamp(on);
      R.apmSub.textContent = b >= TL.airplane ? 'Mila keeps working ✓' : 'Off';
    }

    /* ---------- take-off (b16-17.8) ---------- */
    const toOn = b >= 15.95 && b < 17.8 && !tail; vis(R.takeoff, toOn);
    if (toOn) {
      const p = E.inOut(P(b, 16, 17.5)), out = P(b, 17.4, 17.8);
      trail.setAttribute('stroke-dashoffset', TLEN * (1 - p));
      const pt = trail.getPointAtLength(TLEN * p), pt2 = trail.getPointAtLength(Math.min(TLEN, TLEN * p + 2)), ang = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180 / Math.PI + 90;
      R.tPlane.setAttribute('transform', `translate(${pt.x},${pt.y}) rotate(${ang}) scale(${1 + 0.4 * p})`);
      R.takeoff.style.opacity = clamp(P(b, 15.95, 16.1) * 4) * (1 - out);
      $$('.rw', R.takeoff).forEach((l, i) => l.setAttribute('stroke-dashoffset', -b * 60));
    }

    /* ---------- seat-back map (b17.6-29.9) ---------- */
    const seatOn = b >= 17.5 && b < 30 && !tail; vis(R.seat, seatOn);
    if (seatOn) {
      const a = E.outExpo(P(b, 17.6, 18.3)), out = E.inCubic(P(b, 29.4, 29.9)), prog = E.inOut(P(b, 18, 29.2));
      set(R.seat, { opacity: clamp(a * 2) * (1 - out), transform: `translateY(${(1 - a) * 80 - out * 60}px) scale(${(0.95 + 0.05 * a) * (1 - 0.04 * out)})` });
      drawMap(b, prog);
      const alt = Math.round((35000 * Math.min(E.outCubic(P(b, 17.8, 19.6)), 1 - E.inOut(P(b, 27.4, 29.2)))) / 100) * 100;
      R.mAlt.textContent = alt.toLocaleString('en-US') + ' FT'; R.mSpd.textContent = Math.round(540 * Math.min(E.outCubic(P(b, 17.8, 19.2)), 1 - 0.7 * E.inOut(P(b, 27.4, 29.2)))) + ' MPH';
      const eta = Math.max(0, Math.round(58 * (1 - prog))); R.mEta.textContent = `0:${String(eta).padStart(2, '0')}`;
      R.mDone.textContent = `${TL.cards.filter(c => b >= c[0]).length} / 6 READY`;
    }
    // result cards: newest at the bottom, older step up, max three visible
    const cardsOn = b >= 17.9 && b < 30.2 && !tail;
    CARDS.forEach((c, i) => {
      const on = cardsOn && b >= c.at - 0.05; vis(c.el, on); if (!on) return;
      let rank = 0; for (let j = i + 1; j < CARDS.length; j++) rank += E.outExpo(P(b, CARDS[j].at, CARDS[j].at + 0.45));
      const p = E.spring(P(b, c.at, c.at + 0.55)), out = E.inCubic(P(b, 29.4, 29.9));
      set(c.el, { top: (1190 - rank * 124 + (1 - p) * 160 + out * 200) + 'px', opacity: clamp(p * 2) * (1 - P(rank, 2.2, 3)) * (1 - out), transform: `scale(${lerp(0.94, 1, p) * (1 - 0.03 * Math.min(rank, 3))})` });
    });

    /* ---------- approve bar (b30.3-32.4) ---------- */
    const apbOn = b >= 30.3 && b < 32.5 && !tail; vis(R.apBar, apbOn);
    if (apbOn) {
      const a = E.spring(P(b, 30.3, 30.85)), ok = b >= TL.approve, out = E.inCubic(P(b, 32, 32.45)), press = b >= TL.approve && b < TL.approve + 0.2 ? 1 - 0.05 * Math.sin(P(b, TL.approve, TL.approve + 0.2) * Math.PI) : 1;
      R.apBar.textContent = ok ? 'All 6 approved ✓' : '6 ready for you, Rachel · Approve all';
      set(R.apBar, { top: (880 + (1 - a) * 120 + out * 80) + 'px', opacity: clamp(a * 2) * (1 - out), transform: `scale(${press})`,
        background: ok ? 'linear-gradient(135deg, rgba(143,180,255,.92), rgba(166,140,255,.92) 55%, rgba(255,201,168,.92))' : '', color: ok ? '#0b0b12' : '#fff', boxShadow: ok ? `0 0 ${60 * pulseAt(b, TL.approve, 1.5)}px rgba(166,140,255,.9)` : '' });
    }

    /* ---------- type ---------- */
    for (const w of WORDS) {
      if (w.hook) {
        const on = b < 12 || raw >= 39.15; vis(w.el, on); if (!on) continue;
        const o = raw >= 39.15 ? tailIn : 1 - E.inCubic(P(b, 11.55, 11.95));
        set(w.el, { opacity: o, filter: o < 1 ? `blur(${(1 - o) * 8}px)` : 'none', textShadow: '0 0 50px rgba(166,140,255,.4)' });
        w.spans.forEach(s => { s.style.transform = 'none'; s.style.opacity = 1; s.style.filter = 'none'; }); continue;
      }
      const on = b >= w.at[0] - 0.05 && b < w.out + 0.4 && !tail; vis(w.el, on); if (!on) continue;
      w.spans.forEach((s, j) => reveal(s, b, w.at[j], w.out));
      const g = 1 - P(b, w.at[0], w.at[0] + 1.6);
      w.el.style.textShadow = `0 0 ${40 + 50 * g}px rgba(166,140,255,${0.35 + 0.4 * g})`;
    }

    /* ---------- end card ---------- */
    const endOn = b >= 34.9 && raw < 39.9; vis(R.endc, endOn);
    if (endOn) {
      const rise = E.outExpo(P(b, 35, 36.6)), out = E.inOut(P(raw, 39.0, 39.6));
      set(R.endc, { opacity: 1 - out, filter: out > 0 ? `blur(${out * 12}px)` : 'none' });
      set(R.wordmark, { top: (230 + 80 * (1 - rise)) + 'px', opacity: E.outCubic(P(b, 35, 35.5)), transform: `translateX(-50%) scale(${0.9 + 0.1 * rise})`, filter: `blur(${(1 - E.outCubic(P(b, 35, 36))) * 14}px)`, textShadow: `0 0 ${60 + 80 * (1 - P(b, 35, 38))}px rgba(166,140,255,${0.45 + 0.35 * (1 - P(b, 35, 38))})` });
      set(R.tagline, { top: '505px', transform: 'translateX(-50%)' }); reveal(R.tagSpan, b, 35.4, 999, 1.0);
      drawCTA(b);
    }

    /* flash */
    const fl = Math.max(b >= 15.9 && b < 16 ? 0.8 * P(b, 15.9, 16) : 0, 0.8 * pulseAt(b, 16, 5), 0.4 * pulseAt(b, 35, 7));
    R.flash.style.opacity = tail ? 0 : fl; vis(R.flash, !tail && fl > 0.002);

    const fi = Math.floor(t * 60), nz = NOISE[fi % 8], ox = (fi * 137) % 540, oy = (fi * 251) % 675;
    gctx.drawImage(nz, -ox, -oy); gctx.drawImage(nz, 540 - ox, -oy); gctx.drawImage(nz, -ox, 675 - oy); gctx.drawImage(nz, 540 - ox, 675 - oy);
    grain.style.opacity = 0.18;
  }

  /* ---------------------------------------------------------------- boot */
  window.renderFrame = render; window.DURATION = DUR;
  for (const tw of [0, 3, 9, 13, 15.5, 16.2, 17, 19, 23, 27, 30.4, 31.2, 33, 36.5, 39.5, 39.95]) render(tw * BEAT);
  render(0); window.__ready = true;
  if (!RENDER) {
    const aud = $('#aud'), pp = $('#pp'), scrub = $('#scrub'), tc = $('#tc'); scrub.max = DUR; let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (aud.currentTime >= DUR - 0.05) aud.currentTime = 0; aud.play(); } else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; render(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; render(t); scrub.value = t; tc.textContent = t.toFixed(2) + 's'; if (t >= DUR) { playing = false; pp.textContent = 'Play'; } } requestAnimationFrame(loop); };
    loop();
  }
})();
