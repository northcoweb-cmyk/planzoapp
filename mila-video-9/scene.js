/* Mila film #9 — "Patch" (4:5 feed).
 * render(t) is a pure function of time; cues are beats b of "Patch" at 130 BPM (0.4615 s).
 * Hook: overloaded agent_os b0-4 · update available + patch notes b4-12 · installing b12-15 · STUCK AT 99% (reverb wash) b15-16 ·
 * DROP: 100% installed, the Mila core wires up b16 · results land b18-28 · approve all b30 · "Workflow: patched." b32 · end b36 · loop b39-40.
 */
(async function () {
  const TL = await (await fetch('timeline.json')).json();
  const BEAT = TL.beat, DUR = TL.duration, TOT = TL.totalBeats;
  const qs = new URLSearchParams(location.search);
  const RENDER = qs.has('render');
  const HOOK = qs.get('hook') || 'Your workflow needs a patch.';
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
  const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const set = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const vis = (el, on) => { el.style.visibility = on ? 'inherit' : 'hidden'; };
  const pulseAt = (b, T, k = 8) => (b >= T ? Math.exp(-(b - T) * k) : 0);
  const I = {
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.6"/><path d="m3.6 6.6 8.4 6.4 8.4-6.4"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    msg: '<path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-5.5 4v-4h0a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.5"/><path d="M15.5 14.3c2.6-.4 4.4 1.2 5 4.2"/>',
    doc: '<path d="M6.5 3h8l4 4v14h-12z"/><path d="M14 3v4.5h4.5M9 12h6M9 15.5h6"/>',
    home: '<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  };
  const svg = (n, s = 22, w = 1.9, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;

  /* ---------------------------------------------------------------- hook: warnings */
  const WARN = [['47 unread emails', 'INBOX', -2, ''], ['3 showings overlap · Sat', 'CALENDAR', -1, ''], ['14 follow-ups overdue', 'CRM', 1, 'amber'], ['Listing copy · not started', 'DOCS', 2, 'amber'], ['New lead waiting · 3 hrs', 'TEXTS', 3, '']];
  const WARNS = WARN.map(([t, k, at, cls], i) => { const el = document.createElement('div'); el.className = 'warn ' + cls; el.innerHTML = `<div class="ic">!</div>${t}<em>${k}</em>`; $('#warns').appendChild(el); return { el, at, y: 214 + i * 84 }; });

  /* ---------------------------------------------------------------- patch notes */
  const NOTES = TL.notes.map((t, i) => { const el = document.createElement('div'); el.className = 'note'; const sg = t[0], body = t.slice(2); el.innerHTML = `<span class="sg" style="color:${sg === '+' ? 'var(--green)' : 'var(--red)'}">${sg}</span><span class="bd"></span>`; $('#notes').appendChild(el); return { el, bd: el.querySelector('.bd'), body, at: TL.noteBeats[i] }; });
  const LOG = ['patching inbox.sys ............ ok', 'linking calendar ............. ok', 'linking crm .................. ok', 'linking mls .................. ok', 'linking social ............... ok', 'linking texts ................ ok',
    'removing 12_apps.tmp ......... ok', 'writing listing_copy ......... ok', 'building carousel ............ ok', 'queueing follow_ups .......... ok', 'drafting lead_replies ........ ok', 'finalizing ...................'];

  /* ---------------------------------------------------------------- the core network */
  const CORE = { x: 540, y: 520 };
  const NODE_IC = { Calendar: 'cal', Email: 'mail', CRM: 'users', MLS: 'home', Social: 'heart', Texts: 'msg' };
  const NODES = TL.nodes.map((name, i) => {
    const ang = (-150 + i * 60) * Math.PI / 180, x = CORE.x + Math.cos(ang) * 375, y = CORE.y + Math.sin(ang) * 255;
    const el = document.createElement('div'); el.className = 'node dglass'; el.innerHTML = `<span class="dot">${svg(NODE_IC[name], 19, 2.1)}</span>${name}`; $('#nodes').appendChild(el);
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line'); ln.setAttribute('x1', CORE.x); ln.setAttribute('y1', CORE.y); ln.setAttribute('x2', x); ln.setAttribute('y2', y);
    ln.setAttribute('stroke', 'url(#wg)'); ln.setAttribute('stroke-width', '2.5'); ln.setAttribute('stroke-linecap', 'round');
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('r', '6'); dot.setAttribute('fill', '#fff');
    return { el, ln, dot, x, y, name, at: TL.nodeBeats[i], len: Math.hypot(x - CORE.x, y - CORE.y) };
  });
  $('#wires').innerHTML = '<defs><linearGradient id="wg" x1="0" x2="1"><stop offset="0" stop-color="#8fb4ff"/><stop offset=".55" stop-color="#a68cff"/><stop offset="1" stop-color="#ffc9a8"/></linearGradient><filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
  NODES.forEach(n => { n.ln.setAttribute('filter', 'url(#gl)'); $('#wires').appendChild(n.ln); n.dot.setAttribute('filter', 'url(#gl)'); $('#wires').appendChild(n.dot); });
  const SRC = { msg: 'Texts', cal: 'Calendar', doc: 'MLS', photo: 'Social', mail: 'Email', users: 'CRM' };
  const CARDS = TL.cards.map(([at, t, d, ic]) => {
    const el = document.createElement('div'); el.className = 'rc dglass';
    const icon = ic === 'photo' ? `<div class="ti" style="background-image:url(assets/photos/hero_waterfront.jpg)"></div>` : `<div class="ti">${svg(ic, 30, 2.1)}</div>`;
    el.innerHTML = `${icon}<div><div class="tt">${t}</div><div class="td">${d}</div></div><div class="chip">Ready</div>`;
    $('#cards').appendChild(el); return { el, at, chip: el.querySelector('.chip'), node: NODES.find(n => n.name === SRC[ic]) };
  });
  const APPROVE = document.createElement('div'); APPROVE.className = 'rc dglass'; APPROVE.style.justifyContent = 'center';
  APPROVE.innerHTML = '<div class="tt" id="apTxt">6 drafts ready for you, Rachel · Approve all</div>'; $('#cards').appendChild(APPROVE);

  /* ---------------------------------------------------------------- type */
  const WORDS = [
    { l: [HOOK], at: [-9], out: 3.7, x: 540, y: 250, fs: 96, w: 960, center: true, hook: true },
    { l: ['Installed.'], at: [16.05], out: 17.7, x: 540, y: 150, fs: 120, w: 900, center: true },
    { l: ['Workflow:', 'patched.'], at: [32.0, 32.5], out: 34.55, x: 540, y: 640, fs: 200, w: 900, center: true },
  ];
  WORDS.forEach(w => {
    const el = document.createElement('div'); el.className = 'kw';
    el.innerHTML = w.l.map(t => `<div class="ln"><span>${t}</span></div>`).join('');
    set(el, { left: w.x + 'px', top: w.y + 'px', fontSize: w.fs + 'px', transform: 'translate(-50%,-50%)', textAlign: 'center' });
    $('#words').appendChild(el); w.el = el; w.spans = $$('.ln > span', el);
  });
  const TAG = document.createElement('div'); TAG.className = 'tag'; set(TAG, { position: 'absolute', left: '540px', top: '420px', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }); TAG.textContent = 'Mila · Patch 2.0 · installed'; $('#words').appendChild(TAG);

  /* ---------------------------------------------------------------- glitch slices */
  const SLICES = Array.from({ length: 7 }, (_, i) => { const el = document.createElement('div'); el.className = 'slice'; $('#slices').appendChild(el); return el; });

  /* ---------------------------------------------------------------- assets */
  await document.fonts.load('400 40px "Instrument Serif"'); await document.fonts.load('italic 40px "Instrument Serif"'); await document.fonts.load('600 16px "Inter"'); await document.fonts.load('500 16px "DejaVu Sans Mono"'); await document.fonts.ready;
  await new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = 'assets/photos/hero_waterfront.jpg'; });
  WORDS.forEach(w => { const wd = w.el.offsetWidth; if (wd > w.w) w.el.style.fontSize = (w.fs * w.w / wd) + 'px'; });
  NODES.forEach(n => { n.w = n.el.offsetWidth; });

  const R = {
    cam: $('#cam'), os: $('#os'), cpu: $('#cpu'), mem: $('#mem'), cpuN: $('#cpuN'), memN: $('#memN'), upd: $('#upd'), install: $('#install'), instB: $('#install b'), instTxt: $('#instTxt'),
    inst: $('#inst'), pct: $('#pct'), pbar: $('#pbar i'), plog: $('#plog'), instLbl: $('#instLbl'), net: $('#net'), core: $('#core'), coreRing: $('#coreRing'), runLbl: $('#runLbl'),
    endc: $('#endc'), wordmark: $('#wordmark'), tagline: $('#tagline'), tagSpan: $('#tagline .ln > span'), cta: $('#cta'), ctaSpans: $$('#cta .ln > span'),
    flash: $('#flash'), slices: $('#slices'), gA: $('#gA'), gB: $('#gB'), gC: $('#gC'), apTxt: $('#apTxt'),
  };
  const grain = $('#grain'), gctx = grain.getContext('2d'), NOISE = [];
  { const r = rng(99); for (let k = 0; k < 8; k++) { const c = document.createElement('canvas'); c.width = 540; c.height = 675; const x = c.getContext('2d'), id = x.createImageData(540, 675); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 110; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); NOISE.push(c); } }
  const stars = $('#stars'), sctx = stars.getContext('2d');
  const STARS = (() => { const r = rng(5); return Array.from({ length: 170 }, () => ({ x: r() * 1080, y: r() * 1350, s: 0.6 + r() * 1.6, a: 0.2 + r() * 0.6, ph: r() * TAU, k: 1 + Math.floor(r() * 3) })); })();
  const reveal = (span, b, b0, outB = 999, dur = 0.8) => { const p = E.outExpo(P(b, b0, b0 + dur)), q = E.inCubic(P(b, outB, outB + 0.35)); span.style.transform = `translateY(${(1 - p) * 112 - q * 112}%)`; span.style.opacity = p > 0 ? 1 : 0; span.style.filter = (p < 1 || q > 0) ? `blur(${(1 - p) * 6 + q * 6}px)` : 'none'; };
  const GLITCH_T = [0.04, 3.5, 14, 14.5];

  /* ================================================================ RENDER */
  function render(t) {
    const raw = t / BEAT, b = raw;
    const tail = raw >= TL.loopTail[0], tailIn = E.inOut(P(raw, 39.15, 39.85));
    const hb = tail ? 0 : b;                                   // hook time (the tail rebuilds frame 0)
    const stuck = b >= 15 && b < 16;

    /* glitch amount */
    let gl = GLITCH_T.reduce((s, T) => s + (b >= T && b < T + 0.35 ? Math.sin(P(b, T, T + 0.35) * Math.PI) : 0), 0);
    if (b >= 12 && b < 15) gl += 0.35 * (Math.floor(b * 4) % 3 === 0 ? Math.sin(((b * 4) % 1) * Math.PI) : 0);
    gl += pulseAt(b, 16, 9) * 1.2;
    if (tail) gl = 0;
    const gr = rng(Math.floor(b * 24) + 7);

    /* camera */
    let cx = per(raw, 3) * 3, cy = per(raw, 2) * 2, cs = 1 + 0.004 * per(raw, 2);
    if (b < 4 && !tail) { const a = 0.3 + 2.5 * (b / 4); cx += Math.sin(b * 37) * a; cy += Math.sin(b * 29 + 1) * a; }
    for (const T of [1, 2, 3]) { const d = pulseAt(b, T, 9); cx += Math.sin(b * 90) * 7 * d; }
    if (b >= 12 && b < 15) { const a = 1 + 5 * P(b, 12, 15); cx += Math.sin(b * 41) * a; cy += Math.sin(b * 33 + 1) * a; cs *= 1 + 0.02 * P(b, 12, 15); }
    if (stuck) cs *= 1.02 + 0.05 * E.inCubic(P(b, 15, 16));
    for (const T of [16, ...TL.cards.map(c => c[0]), 30, 32, 35]) { const d = pulseAt(b, T, 8); cy += 6 * d; cs *= 1 + (T === 16 || T === 36 ? 0.04 : 0.01) * d; }
    cx += (gr() - 0.5) * 30 * gl;
    R.cam.style.transform = `translate(${cx}px,${cy}px) scale(${cs})`;
    R.cam.style.filter = (gl > 0.02 ? `drop-shadow(${8 * gl}px 0 rgba(255,40,100,.75)) drop-shadow(${-8 * gl}px 0 rgba(60,200,255,.75)) ` : '') + (stuck ? `grayscale(${0.7 * P(b, 15, 15.3)}) brightness(${1 - 0.25 * P(b, 15, 15.6)})` : '') || 'none';
    if (!R.cam.style.filter) R.cam.style.filter = 'none';
    vis(R.slices, gl > 0.05);
    if (gl > 0.05) SLICES.forEach(s => { set(s, { top: (gr() * 1350) + 'px', height: (4 + gr() * 40) + 'px', background: ['rgba(143,180,255,.25)', 'rgba(166,140,255,.3)', 'rgba(255,92,122,.25)', 'rgba(255,255,255,.18)'][Math.floor(gr() * 4)], transform: `translateX(${(gr() - 0.5) * 120 * gl}px)`, opacity: gr() < 0.7 ? gl : 0 }); });

    /* ambient: glows + stars (loop-periodic) */
    const glow = 0.5 + 0.6 * (pulseAt(b, 16, 1.8) + pulseAt(b, 30, 2) + pulseAt(b, 35, 2)) - (stuck ? 0.3 : 0);
    set(R.gA, { left: (540 - 300 + per(raw, 2) * 160) + 'px', top: (500 + perc(raw, 1) * 140) + 'px', opacity: glow });
    set(R.gB, { left: (540 + 320 + perc(raw, 2) * 140) + 'px', top: (760 + per(raw, 1) * 160) + 'px', opacity: glow * 0.9 });
    set(R.gC, { left: (540 + per(raw, 1) * 220) + 'px', top: (1150) + 'px', opacity: glow * 0.7 });
    sctx.clearRect(0, 0, 1080, 1350);
    for (const s of STARS) { sctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(TAU * 4 * raw / TOT + s.ph)); sctx.fillStyle = '#fff'; const y = ((s.y - (raw / TOT) * 1350 * s.k) % 1350 + 1350) % 1350; sctx.fillRect(s.x, y, s.s, s.s); }

    /* ---------- HOOK: agent_os (b0-4.4, and the tail) ---------- */
    const osOn = b < 12.3 || raw >= 39.15; vis(R.os, osOn);
    if (osOn) {
      const back = tail ? 0 : E.inOut(P(b, 3.8, 4.4)), out = tail ? 0 : E.inCubic(P(b, 11.8, 12.3));
      set(R.os, { transform: `translateY(${-30 * back}px) scale(${1 - 0.08 * back})`, opacity: tail ? tailIn : lerp(1, 0.18, back) * (1 - out), filter: back > 0.01 ? `blur(${back * 8}px)` : (tail && tailIn < 1 ? `blur(${(1 - tailIn) * 10}px)` : 'none') });
      const flick = hb < 4 ? 0.04 * Math.sin(hb * 50) : 0;
      R.cpu.style.width = (96 + 4 * Math.sin(hb * 7 + 0.3) * (hb > 0 ? 1 : 0) + 4 * (hb === 0 ? 1 : 0)) + '%'; R.mem.style.width = '99%';
      R.cpuN.textContent = '100%'; R.memN.textContent = '99%'; R.cpuN.style.opacity = 1 - Math.abs(flick) * 5;
      WARNS.forEach(w => {
        const on = hb >= w.at; vis(w.el, on); if (!on) return;
        const a = w.at < 0 ? 1 : E.spring(P(hb, w.at, w.at + 0.5));
        set(w.el, { top: w.y + 'px', opacity: clamp(a * 2), transform: `translateX(${(1 - a) * -60 + Math.sin(hb * 80) * 6 * pulseAt(hb, Math.max(0, w.at), 8)}px)` });
      });
    }

    /* ---------- the update modal (b4-12.4) ---------- */
    const updOn = b >= 3.9 && b < 12.5 && !tail; vis(R.upd, updOn);
    if (updOn) {
      const a = E.spring(P(b, 4, 4.7)), out = E.inCubic(P(b, 12.05, 12.45));
      set(R.upd, { transform: `translateY(${(1 - a) * 120 - out * 40}px) scale(${(0.94 + 0.06 * a) * (1 - 0.08 * out)})`, opacity: clamp(a * 2) * (1 - out) });
      NOTES.forEach(n => {
        const k = Math.floor(n.body.length * P(b, n.at, n.at + 0.38)); vis(n.el, b >= n.at - 0.02);
        n.bd.textContent = n.body.slice(0, k) + (b >= n.at && b < n.at + 0.5 && Math.floor(b * 8) % 2 === 0 ? '▍' : '');
        n.el.style.background = b >= n.at && b < n.at + 0.6 ? `rgba(166,140,255,${0.18 * (1 - P(b, n.at, n.at + 0.6))})` : 'transparent';
      });
      const glowI = b >= 11.4 ? 0.5 + 0.5 * Math.sin((b - 11.4) * 12) : 0, press = b >= 12 && b < 12.2 ? 1 - 0.06 * Math.sin(P(b, 12, 12.2) * Math.PI) : 1;
      set(R.install, { transform: `scale(${press})`, boxShadow: glowI > 0 || b >= 12 ? `0 0 ${30 + 30 * glowI}px rgba(166,140,255,.8)` : 'none' });
      R.instB.style.opacity = E.outCubic(P(b, 12, 12.12)); R.instTxt.textContent = b >= 12 ? 'Installing…' : 'Install';
    }

    /* ---------- installing (b12-16.4) ---------- */
    const instOn = b >= 12.1 && b < 16.5 && !tail; vis(R.inst, instOn);
    if (instOn) {
      const a = E.outExpo(P(b, 12.1, 12.6)), boom = E.outCubic(P(b, 16, 16.45));
      let pct = b < 15 ? Math.floor(99 * Math.pow(P(b, 12.2, 14.85), 1.5)) : b < 16 ? 99 : 100;
      R.pct.textContent = pct + '%';
      R.pct.style.color = stuck ? (Math.floor(b * 6) % 2 ? '#fff' : 'rgba(255,255,255,.55)') : '#fff';
      R.pct.style.textShadow = b >= 16 ? '0 0 60px rgba(166,140,255,.9)' : '0 0 40px rgba(166,140,255,.35)';
      R.pbar.style.width = (b >= 16 ? 100 : Math.max(0, pct)) + '%';
      R.instLbl.textContent = stuck ? 'INSTALLING… 99%' : b >= 16 ? 'INSTALLED' : 'INSTALLING MILA · PATCH 2.0';
      const nl = b >= 15 ? LOG.length : Math.floor(P(b, 12.2, 15) * LOG.length);
      R.plog.textContent = LOG.slice(Math.max(0, nl - 5), nl).join('\n');
      set(R.inst, { opacity: clamp(a * 2) * (1 - boom), transform: `scale(${(0.96 + 0.04 * a) * (1 + 0.4 * boom)})`, filter: boom > 0.01 ? `blur(${boom * 16}px)` : 'none' });
    }

    /* ---------- the patched workflow: core + nodes + results (b16-32.6) ---------- */
    const netOn = b >= 15.98 && b < 32.7 && !tail; vis(R.net, netOn);
    if (netOn) {
      const a = E.spring(P(b, 16, 16.7)), out = E.inCubic(P(b, 31.8, 32.5));
      set(R.net, { opacity: 1 - out, transform: `scale(${1 - 0.1 * out})`, transformOrigin: `${CORE.x}px ${CORE.y}px`, filter: out > 0.01 ? `blur(${out * 10}px)` : 'none' });
      const hit = Math.max(pulseAt(b, 16, 4), ...TL.cards.map(c => pulseAt(b, c[0], 6) * 0.5), pulseAt(b, 30, 4));
      set(R.core, { transform: `scale(${lerp(0.3, 1, a) * (1 + 0.12 * hit)})`, opacity: clamp(a * 3), boxShadow: `0 0 0 1.5px rgba(166,140,255,.6), 0 0 ${60 + 120 * hit}px rgba(166,140,255,${0.5 + 0.4 * hit})` });
      const rp = (b - 16) % 1, ringOn = b >= 16; set(R.coreRing, { opacity: ringOn ? (1 - rp) * 0.7 : 0, transform: `scale(${1 + rp * 1.4})` });
      set(R.runLbl, { opacity: E.outCubic(P(b, 17.8, 18.3)) });
      NODES.forEach((n, i) => {
        const p = E.spring(P(b, n.at, n.at + 0.5)), wl = E.outCubic(P(b, n.at - 0.15, n.at + 0.2));
        const src = CARDS.find(c => c.node === n && b >= c.at && b < c.at + 0.8), lit = src ? 1 - P(b, src.at, src.at + 0.8) : 0;
        vis(n.el, b >= n.at - 0.05);
        set(n.el, { left: (n.x - n.w / 2) + 'px', top: n.y + 'px', transform: `scale(${lerp(0.4, 1, p) * (1 + 0.1 * lit)})`, opacity: clamp(p * 2), boxShadow: lit > 0 ? `0 0 ${40 * lit}px rgba(111,240,166,.8), inset 0 1px 0 rgba(255,255,255,.12)` : '' });
        n.ln.setAttribute('x2', lerp(CORE.x, n.x, wl)); n.ln.setAttribute('y2', lerp(CORE.y, n.y, wl)); n.ln.setAttribute('opacity', wl > 0 ? 0.55 + 0.45 * lit : 0);
        // a data pulse runs node -> core on every beat once connected
        const f = ((b - n.at) % 1 + 1) % 1, on = b >= n.at + 0.3;
        n.dot.setAttribute('cx', lerp(n.x, CORE.x, E.inOut(f))); n.dot.setAttribute('cy', lerp(n.y, CORE.y, E.inOut(f))); n.dot.setAttribute('opacity', on ? Math.sin(f * Math.PI) : 0);
      });
      // result cards: newest lands at the bottom, older ones step up; max three visible
      const slot = k => 1196 - k * 120;
      CARDS.forEach((c, i) => {
        if (b < c.at - 0.05) { vis(c.el, false); return; }
        let rank = 0; for (let j = i + 1; j < CARDS.length; j++) rank += E.outExpo(P(b, CARDS[j].at, CARDS[j].at + 0.45));
        rank += E.outExpo(P(b, 29.5, 29.95));                                 // the approve bar takes the bottom slot
        const p = E.spring(P(b, c.at, c.at + 0.55)), y = slot(rank) + (1 - p) * 160;
        vis(c.el, rank < 3.2);
        set(c.el, { top: y + 'px', opacity: clamp(p * 2) * (1 - P(rank, 2.2, 3)), transform: `scale(${lerp(0.94, 1, p) * (1 - 0.03 * Math.min(rank, 3))})` });
        const ok = b >= 30;
        c.chip.textContent = ok ? 'Approved ✓' : 'Ready';
        set(c.chip, ok ? { background: 'linear-gradient(135deg,#8fb4ff,#a68cff 55%,#ffc9a8)', color: '#0b0b12', borderColor: 'transparent', boxShadow: `0 0 ${30 * pulseAt(b, 30, 2)}px rgba(166,140,255,.9)` } : { background: 'rgba(111,240,166,.12)', color: 'var(--green)', borderColor: 'rgba(111,240,166,.5)', boxShadow: 'none' });
      });
      const ap = E.spring(P(b, 29.5, 30.05)), apOn = b >= 29.45;
      vis(APPROVE, apOn);
      if (apOn) {
        const ok = b >= 30, press = b >= 30 && b < 30.2 ? 1 - 0.05 * Math.sin(P(b, 30, 30.2) * Math.PI) : 1;
        R.apTxt.textContent = ok ? 'All 6 approved ✓' : '6 drafts ready for you, Rachel · Approve all';
        set(APPROVE, { top: (slot(0) + (1 - ap) * 160) + 'px', opacity: clamp(ap * 2), transform: `scale(${press})`, background: ok ? 'linear-gradient(135deg, rgba(143,180,255,.9), rgba(166,140,255,.9) 55%, rgba(255,201,168,.9))' : '', color: ok ? '#0b0b12' : '#fff', boxShadow: ok ? `0 0 ${60 * pulseAt(b, 30, 1.5)}px rgba(166,140,255,.9)` : '' });
      }
    }

    /* ---------- type ---------- */
    for (const w of WORDS) {
      if (w.hook) {
        const on = b < 4.1 || raw >= 39.15; vis(w.el, on); if (!on) continue;
        const o = raw >= 39.15 ? tailIn : 1 - E.inCubic(P(b, 3.7, 4.05));
        set(w.el, { opacity: o, filter: o < 1 ? `blur(${(1 - o) * 8}px)` : 'none', textShadow: '0 0 50px rgba(166,140,255,.45)' });
        w.spans[0].style.transform = 'none'; w.spans[0].style.opacity = 1; w.spans[0].style.filter = 'none'; continue;
      }
      const on = b >= w.at[0] - 0.05 && b < w.out + 0.4 && !tail; vis(w.el, on); if (!on) continue;
      w.spans.forEach((s, j) => reveal(s, b, w.at[j], w.out));
      const g = 1 - P(b, w.at[0], w.at[0] + 1.6);
      w.el.style.textShadow = `0 0 ${40 + 50 * g}px rgba(166,140,255,${0.35 + 0.4 * g})`;
    }
    const tagOn = b >= 31.9 && b < 35 && !tail; vis(TAG, tagOn);
    if (tagOn) set(TAG, { opacity: E.outCubic(P(b, 32, 32.4)) * (1 - P(b, 34.5, 34.9)) });

    /* ---------- end card (b36-39.9) ---------- */
    const endOn = b >= 34.9 && raw < 39.9; vis(R.endc, endOn);
    if (endOn) {
      const rise = E.outExpo(P(b, 35, 36.6)), out = E.inOut(P(raw, 39.0, 39.6));
      set(R.endc, { opacity: 1 - out, filter: out > 0 ? `blur(${out * 12}px)` : 'none' });
      set(R.wordmark, { top: (380 + 90 * (1 - rise)) + 'px', opacity: E.outCubic(P(b, 35, 35.5)), transform: `translateX(-50%) scale(${0.9 + 0.1 * rise})`, filter: `blur(${(1 - E.outCubic(P(b, 35, 36))) * 14}px)`, textShadow: `0 0 ${60 + 80 * (1 - P(b, 35, 38))}px rgba(166,140,255,${0.45 + 0.35 * (1 - P(b, 35, 38))})` });
      set(R.tagline, { top: '660px', transform: 'translateX(-50%)' }); reveal(R.tagSpan, b, 35.6, 999, 1.0);
      set(R.cta, { top: '752px', transform: 'translateX(-50%)' }); R.ctaSpans.forEach((s, j) => reveal(s, b, 36.0 + j * 0.4, 999, 0.9));
    }

    /* flash on the drop and the end */
    const fl = Math.max(b >= 15.85 && b < 16 ? E.inCubic(P(b, 15.85, 16)) * 0.9 : 0, b >= 16 ? 0.9 * pulseAt(b, 16, 5) : 0, 0.5 * pulseAt(b, 35, 7));
    R.flash.style.opacity = tail ? 0 : fl; vis(R.flash, !tail && fl > 0.002);

    const fi = Math.floor(t * 60), nz = NOISE[fi % 8], ox = (fi * 137) % 540, oy = (fi * 251) % 675;
    gctx.drawImage(nz, -ox, -oy); gctx.drawImage(nz, 540 - ox, -oy); gctx.drawImage(nz, -ox, 675 - oy); gctx.drawImage(nz, 540 - ox, 675 - oy);
    grain.style.opacity = 0.18 + 0.2 * gl;
  }

  /* ---------------------------------------------------------------- boot */
  window.renderFrame = render; window.DURATION = DUR;
  for (const tw of [0, 2, 6, 10, 13, 15.5, 16.5, 19, 23, 27, 30.5, 33, 37, 39.5, 39.95]) render(tw * BEAT);
  render(0); window.__ready = true;
  if (!RENDER) {
    const aud = $('#aud'), pp = $('#pp'), scrub = $('#scrub'), tc = $('#tc'); scrub.max = DUR; let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (aud.currentTime >= DUR - 0.05) aud.currentTime = 0; aud.play(); } else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; render(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; render(t); scrub.value = t; tc.textContent = t.toFixed(2) + 's'; if (t >= DUR) { playing = false; pp.textContent = 'Play'; } } requestAnimationFrame(loop); };
    loop();
  }
})();
