/* Mila film #11 — "Running Late" (4:5 feed).
 * render(t) is a pure function of time; cues are beats b of "Too Much For Me" at 128 BPM (0.46875 s).
 * Hook clock b0-0.9 · VOICE MODE: she talks to Mila over the reverb bed b0.9-18 (orb reacts to her voice, live transcript,
 * quick-cut inserts on her words) · "On it, Rachel." + stutter b18.5-19.5 · silence/collapse b19.5-20 ·
 * DROP b20: fast whip-cuts of Mila doing it all b20-29.5 · "You talk. Mila handles it." · end b32 · loop tail b39-40.
 */
(async function () {
  const TL = await (await fetch('timeline.json')).json();
  let VENV = []; try { VENV = await (await fetch('audio/voice_env.json')).json(); } catch (e) { VENV = []; }
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
  const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const set = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const vis = (el, on) => { el.style.visibility = on ? 'inherit' : 'hidden'; };
  const pulseAt = (b, T, k = 8) => (b >= T ? Math.exp(-(b - T) * k) : 0);
  const CHECK = s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
  const wordAt = (pi, w) => TL.voice[pi].words.find(x => x[0].toLowerCase().startsWith(w))[1];

  /* ---------------------------------------------------------------- the fast cuts (after the drop) */
  const MSG = 'Hi Dana & Mark! Running about 5 minutes behind, my closing ran a little long. See you at 1207 Sea Grape Ln at 2:05. Thanks for your patience! – Rachel';
  const CUTS = [
    { at: 20, end: 21, html: `<div class="big dglass" style="top:320px;height:620px;overflow:hidden;padding:0"><div style="position:absolute;inset:0 0 50% 0;background:url(assets/photos/sarasota_bridgepool.jpg) center/cover"></div><div style="position:absolute;left:0;right:0;top:50%;bottom:0;padding:34px 40px"><div class="k">Showing · booked</div><div class="t">2:00 PM today</div><div class="d">1207 Sea Grape Ln · Dana &amp; Mark Ellis</div></div></div><div class="ok" style="position:absolute;left:130px;top:980px">CONFIRMED ${CHECK(22)}</div>` },
    { at: 21, end: 22, html: `<div class="big dglass" style="top:400px"><div class="k">Showing access</div><div class="t">Listing agent notified.</div><div class="d">2:00 PM slot confirmed for the Ellises.</div><div class="ok">DONE ${CHECK(22)}</div></div>` },
    { at: 22, end: 25.5, thread: true, html: `<div class="thread dglass"><div class="hd"><div class="av">DE</div><div>Dana &amp; Mark Ellis<span>Showing · 2:00 PM</span></div></div>
        <div class="drafted" style="top:150px">DRAFTED BY MILA</div>
        <div class="bub me" id="msgB" style="top:190px"><span id="msgT"></span></div>
        <div class="meta" id="msgMeta" style="top:560px">DELIVERED ✓</div>
        <div class="bub them" id="replyB" style="top:610px">No worries at all, see you soon!</div>
        <div class="sendBtn" id="sendBtn">Send ${CHECK(24)}</div></div>` },
    { at: 25.5, end: 26.5, html: `<div class="map" id="mapBox"><svg width="900" height="520" viewBox="0 0 900 520"><defs><linearGradient id="rt" x1="0" x2="1"><stop offset="0" stop-color="#8fb4ff"/><stop offset=".55" stop-color="#a68cff"/><stop offset="1" stop-color="#ffc9a8"/></linearGradient></defs>
        ${Array.from({ length: 12 }, (_, i) => `<line x1="${i * 80}" y1="0" x2="${i * 80 - 160}" y2="520" stroke="rgba(143,180,255,.08)" stroke-width="18"/>`).join('')}
        ${Array.from({ length: 7 }, (_, i) => `<line x1="0" y1="${i * 86}" x2="900" y2="${i * 86 + 40}" stroke="rgba(143,180,255,.07)" stroke-width="12"/>`).join('')}
        <path id="route" d="M 110 430 C 260 420, 300 300, 420 280 S 640 140, 790 110" fill="none" stroke="url(#rt)" stroke-width="12" stroke-linecap="round"/>
        <circle cx="110" cy="430" r="14" fill="#fff"/><circle cx="790" cy="110" r="18" fill="#ffc9a8"/></svg></div>
        <div class="big dglass" style="top:810px;padding:34px 40px"><div class="k">Directions</div><div class="t" style="font-size:72px">Leave now · 14 min</div><div class="d">to 1207 Sea Grape Ln · arrive 2:05 PM</div></div>` },
    { at: 26.5, end: 27.5, html: `<div class="big dglass" style="top:300px"><div class="k">Showing notes · ready</div><div class="t" style="font-size:70px">1207 Sea Grape Ln</div><ul class="notes" style="margin-top:22px"><li><i></i>4 bd · 3.5 ba · 3,240 sq ft</li><li><i></i>Heated pool · bridge deck</li><li><i></i>HOA $210 / month</li><li><i></i>Ellises: pre-approved, want a pool</li></ul></div>` },
    { at: 27.5, end: 28.5, html: `<div class="big dglass" style="top:300px"><div class="k">Calendar · today</div>
        <div style="margin-top:26px;display:flex;flex-direction:column;gap:14px">
        <div style="padding:22px 24px;border-radius:22px;background:rgba(255,255,255,.06);font:600 28px/1.2 var(--sans)">12:30 PM · Closing<div style="font:500 20px/1.3 var(--sans);color:var(--red);margin-top:6px">ran 15 min long</div></div>
        <div style="padding:22px 24px;border-radius:22px;background:linear-gradient(135deg,rgba(143,180,255,.28),rgba(166,140,255,.34));border:1px solid rgba(166,140,255,.6);font:650 30px/1.2 var(--sans)">2:00 PM · Showing · Ellises<div style="font:500 21px/1.3 var(--sans);color:rgba(255,255,255,.75);margin-top:6px">1207 Sea Grape Ln · arriving 2:05 · they know ✓</div></div>
        <div style="padding:22px 24px;border-radius:22px;background:rgba(255,255,255,.06);font:600 28px/1.2 var(--sans)">4:00 PM · Listing photos</div></div></div>` },
    { at: 28.5, end: 29.5, html: [['SHOWING', 'Booked'], ['ELLISES', 'Texted'], ['ROUTE', 'Ready'], ['NOTES', 'Prepped']].map(([k, t], i) => `<div class="tile dglass" style="left:${i % 2 ? 560 : 90}px;top:${i < 2 ? 330 : 670}px"><div class="k">${k}</div><div class="t">${t}</div><div class="ck">${CHECK(24)}</div></div>`).join('') },
  ];
  CUTS.forEach(c => { const el = document.createElement('div'); el.className = 'cut'; el.innerHTML = c.html; $('#cuts').appendChild(el); c.el = el; });

  /* ---------------------------------------------------------------- type */
  const WORDS = [
    { l: ['Running late', 'to a showing?'], at: [-9, -9], out: 0.9, x: 540, y: 180, fs: 92, w: 980, hook: true },
    { l: ['You talk.', 'Mila handles it.'], at: [29.5, 30.1], out: 31.6, x: 540, y: 640, fs: 170, w: 960 },
  ];
  WORDS.forEach(w => {
    const el = document.createElement('div'); el.className = 'kw';
    el.innerHTML = w.l.map(t => `<div class="ln"><span>${t}</span></div>`).join('');
    set(el, { left: w.x + 'px', top: w.y + 'px', fontSize: w.fs + 'px', transform: 'translate(-50%,-50%)', textAlign: 'center' });
    $('#words').appendChild(el); w.el = el; w.spans = $$('.ln > span', el);
  });
  // transcript: one span per word per phrase
  const PHR = TL.voice.map(v => ({ ...v, html: v.words.map((w, i) => `<span class="w" data-i="${i}">${w[0]}</span>`).join(' ') }));

  /* ---------------------------------------------------------------- assets */
  await document.fonts.load('400 40px "Instrument Serif"'); await document.fonts.load('600 16px "Inter"'); await document.fonts.load('700 16px "DejaVu Sans Mono"'); await document.fonts.ready;
  await new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = 'assets/photos/sarasota_bridgepool.jpg'; });
  WORDS.forEach(w => { const wd = w.el.offsetWidth; if (wd > w.w) w.el.style.fontSize = (w.fs * w.w / wd) + 'px'; });

  const R = {
    cam: $('#cam'), hook: $('#hook'), ringArc: $('#ringArc'), clockHM: $('#clockHM'), minLeft: $('#minLeft'), clockWrap: $('#clockWrap'),
    voice: $('#voice'), orb: $('#orb'), listen: $('#listen'), tPrev: $('#tPrev'), tCur: $('#tCur'), trans: $('#trans'),
    ins1: $('#ins1'), ins1t: $('#ins1t'), insHouse: $('#insHouse'), insTime: $('#insTime'), insCont: $('#insCont'), insLate: $('#insLate'), insClose: $('#insClose'), overrun: $('#overrun'),
    onit: $('#onit'), msgT: $('#msgT'), msgB: $('#msgB'), msgMeta: $('#msgMeta'), replyB: $('#replyB'), sendBtn: $('#sendBtn'), route: $('#route'),
    endc: $('#endc'), wordmark: $('#wordmark'), tagline: $('#tagline'), tagSpan: $('#tagline .ln > span'), cta: $('#cta'), ctaSpans: $$('#cta .ln > span'),
    flash: $('#flash'), gA: $('#gA'), gB: $('#gB'), gC: $('#gC'),
  };
  const RLEN = R.route.getTotalLength(); R.route.setAttribute('stroke-dasharray', RLEN);
  const RING_C = TAU * 310; R.ringArc.setAttribute('stroke-dasharray', RING_C);
  const ox = R.orb.getContext('2d');
  const grain = $('#grain'), gctx = grain.getContext('2d'), NOISE = [];
  { const r = rng(99); for (let k = 0; k < 8; k++) { const c = document.createElement('canvas'); c.width = 540; c.height = 675; const x = c.getContext('2d'), id = x.createImageData(540, 675); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 110; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); NOISE.push(c); } }
  const stars = $('#stars'), sctx = stars.getContext('2d');
  const STARS = (() => { const r = rng(5); return Array.from({ length: 150 }, () => ({ x: r() * 1080, y: r() * 1350, s: 0.6 + r() * 1.6, a: 0.2 + r() * 0.6, ph: r() * TAU, k: 1 + Math.floor(r() * 3) })); })();
  const reveal = (span, b, b0, outB = 999, dur = 0.8) => { const p = E.outExpo(P(b, b0, b0 + dur)), q = E.inCubic(P(b, outB, outB + 0.35)); span.style.transform = `translateY(${(1 - p) * 112 - q * 112}%)`; span.style.opacity = p > 0 ? 1 : 0; span.style.filter = (p < 1 || q > 0) ? `blur(${(1 - p) * 6 + q * 6}px)` : 'none'; };
  const venv = t => VENV.length ? VENV[clamp(Math.floor(t * 60), 0, VENV.length - 1)] : 0;

  function drawOrb(b, t, amp, scale, strobe) {
    ox.clearRect(0, 0, 720, 720);
    const cx = 360, cy = 360, base = (120 + 70 * amp) * scale;
    if (base < 0.5) return;
    ox.globalCompositeOperation = 'lighter';
    const blobs = [['143,180,255', 0], ['166,140,255', 2.1], ['255,201,168', 4.2]];
    blobs.forEach(([c, ph], i) => {
      const a = b * 1.3 + ph, r = base * (1.05 + 0.18 * Math.sin(b * 2.1 + ph) + 0.25 * amp), x = cx + Math.cos(a) * base * 0.22, y = cy + Math.sin(a * 1.2) * base * 0.22;
      const g = ox.createRadialGradient(x, y, 0, x, y, r * 1.6); g.addColorStop(0, `rgba(${c},${0.62 * strobe})`); g.addColorStop(0.45, `rgba(${c},${0.26 * strobe})`); g.addColorStop(1, `rgba(${c},0)`);
      ox.fillStyle = g; ox.beginPath(); ox.arc(x, y, r * 1.6, 0, TAU); ox.fill();
    });
    const core = ox.createRadialGradient(cx, cy, 0, cx, cy, base * 0.7); core.addColorStop(0, `rgba(255,250,255,${0.55 * strobe})`); core.addColorStop(0.4, `rgba(210,195,255,${0.22 * strobe})`); core.addColorStop(1, 'rgba(255,255,255,0)');
    ox.fillStyle = core; ox.beginPath(); ox.arc(cx, cy, base * 0.7, 0, TAU); ox.fill();
    ox.globalCompositeOperation = 'source-over';
    // speech rings
    for (let k = 0; k < 3; k++) { const f = ((b * 1.5 + k / 3) % 1), rr = base * (1.2 + f * 1.4); ox.strokeStyle = `rgba(200,190,255,${0.35 * (1 - f) * Math.min(1, amp * 2.5) * strobe})`; ox.lineWidth = 2; ox.beginPath(); ox.arc(cx, cy, rr, 0, TAU); ox.stroke(); }
  }

  /* ================================================================ RENDER */
  const PH_STARTS = TL.voice.map(v => v.b0), CUT_ZOOM = [1.0, 1.07, 0.97, 1.09, 1.03];
  function render(t) {
    const raw = t / BEAT, b = raw;
    const tail = raw >= TL.loopTail[0], tailIn = E.inOut(P(raw, 39.15, 39.85));
    const amp = venv(t);
    const voiceOn = b >= 0.9 && b < 20.05 && !tail;

    /* camera: hard "cuts" on each phrase (instant zoom/tilt changes), punches after the drop */
    let cx = per(raw, 3) * 3, cy = per(raw, 2) * 2, cs = 1 + 0.004 * per(raw, 2), cr = 0;
    if (voiceOn && b < 18.5) { const pi = PH_STARTS.filter(s => b >= s).length - 1; if (pi >= 0) { cs *= CUT_ZOOM[pi] * (1 + 0.012 * (b - PH_STARTS[pi])); cr = [0, -0.8, 0.6, -0.5, 0.9][pi]; } }
    if (b >= 18.5 && b < 19.5) { const k = Math.floor((b - 18.5) * 8); cs *= 1 + 0.03 * (k % 2) + 0.01 * k; }
    for (const T of [20, ...CUTS.map(c => c.at), 23.5, 24.5, 29.5, 32]) { const d = pulseAt(b, T, 9); cy += 6 * d; cs *= 1 + 0.02 * d; }
    R.cam.style.transform = `translate(${cx}px,${cy}px) rotate(${cr}deg) scale(${cs})`;

    /* ambient */
    const glow = 0.45 + 0.45 * amp * (voiceOn ? 1 : 0) + 0.6 * (pulseAt(b, 20, 1.8) + pulseAt(b, 32, 2));
    set(R.gA, { left: (540 - 300 + per(raw, 2) * 160) + 'px', top: (500 + perc(raw, 1) * 140) + 'px', opacity: glow });
    set(R.gB, { left: (540 + 320 + perc(raw, 2) * 140) + 'px', top: (780 + per(raw, 1) * 160) + 'px', opacity: glow * 0.9 });
    set(R.gC, { left: (540 + per(raw, 1) * 220) + 'px', top: 1180 + 'px', opacity: glow * 0.7 });
    sctx.clearRect(0, 0, 1080, 1350);
    for (const s of STARS) { sctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(TAU * 4 * raw / TOT + s.ph)); sctx.fillStyle = '#fff'; const y = ((s.y - (raw / TOT) * 1350 * s.k) % 1350 + 1350) % 1350; sctx.fillRect(s.x, y, s.s, s.s); }

    /* ---------- hook: the clock (b0-0.9 and the tail) ---------- */
    const hookOn = b < 0.95 || raw >= 39.15; vis(R.hook, hookOn);
    if (hookOn) {
      const o = tail ? tailIn : 1 - P(b, 0.88, 0.95);
      set(R.hook, { opacity: o, filter: tail && tailIn < 1 ? `blur(${(1 - tailIn) * 10}px)` : 'none' });
      R.ringArc.setAttribute('stroke-dashoffset', RING_C * (1 - 0.8));                    // 8 of 10 minutes left
    }

    /* ---------- voice mode (b0.9-20) ---------- */
    vis(R.voice, voiceOn);
    if (voiceOn) {
      const collapse = E.inExpo(P(b, 19.4, 19.95));
      const strobe = b >= 18.5 && b < 19.5 ? (Math.floor((b - 18.5) * 8) % 2 ? 0.45 : 1) : 1;
      const sc = b < 18.5 ? 1 : b < 19.5 ? 0.8 : (1 - collapse) * 0.8;
      drawOrb(b, t, b < 18.4 ? amp : 0.15, sc * (b < 1.3 ? E.outBack(P(b, 0.9, 1.3)) : 1), strobe);
      set(R.orb, { transform: `translateY(${b >= 18.5 ? -60 : 0}px)`, opacity: 1 });
      R.listen.textContent = b < 18.4 ? 'Mila · listening' : 'Mila · working';
      R.listen.style.opacity = b < 19.5 ? 1 : 0;
      // transcript
      const pi = TL.voice.filter(v => b >= v.b0 - 0.05).length - 1;
      vis(R.trans, b < 18.5 && pi >= 0);
      if (pi >= 0 && b < 18.5) {
        const ph = PHR[pi];
        if (R.tCur.dataset.pi !== String(pi)) { R.tCur.innerHTML = ph.html; R.tCur.dataset.pi = pi; R.tPrev.textContent = pi > 0 ? TL.voice[pi - 1].text : ''; }
        $$('.w', R.tCur).forEach((s, i) => { const wt = ph.words[i][1], p = E.outCubic(P(b, wt - 0.05, wt + 0.4)); set(s, { opacity: 0.12 + 0.88 * p, transform: `translateY(${(1 - p) * 14}px)`, filter: p < 1 ? `blur(${(1 - p) * 6}px)` : 'none', color: p >= 1 ? '#fff' : '#d9d2ff' }); });
      }
      // quick-cut inserts on her words
      const ins = (el, on0, off, x, y, rot, from = 'up') => {
        const on = b >= on0 - 0.02 && b < off + 0.3; vis(el, on); if (!on) return;
        const a = E.spring(P(b, on0, on0 + 0.5)), out = E.inCubic(P(b, off, off + 0.3));
        set(el, { transform: `translate(${x + (from === 'left' ? -1 : from === 'right' ? 1 : 0) * (1 - a) * 200}px,${y + (from === 'up' ? -1 : 0) * (1 - a) * 80 + out * 40}px) rotate(${rot * a}deg) scale(${(0.85 + 0.15 * a) * (1 - 0.1 * out)})`, opacity: clamp(a * 2) * (1 - out) });
      };
      ins(R.ins1, wordAt(1, 'running'), TL.voice[2].b0, 300, 80, 0);
      R.ins1t.textContent = '1:53 PM · showing at 2:00';
      ins(R.insTime, wordAt(2, 'two'), TL.voice[3].b0 - 0.1, 70, 300, -3, 'left');
      ins(R.insHouse, wordAt(2, 'sea'), TL.voice[3].b0 - 0.1, 640, 250, 4, 'right');
      ins(R.insCont, wordAt(3, 'ellises'), TL.voice[4].b0 - 0.1, 70, 300, -3, 'left');
      ins(R.insLate, wordAt(3, 'five'), TL.voice[4].b0 - 0.1, 600, 420, 3, 'right');
      ins(R.insClose, wordAt(4, 'closing'), 18.3, 560, 250, 3, 'right');
      R.overrun.style.width = (24 * E.outCubic(P(b, wordAt(4, 'closing') + 0.3, wordAt(4, 'long') + 0.4))) + '%';
    }
    // "On it, Rachel." + stutter + collapse
    const onOn = b >= 18.45 && b < 20 && !tail; vis(R.onit, onOn);
    if (onOn) {
      const a = E.outExpo(P(b, 18.5, 18.9)), k = Math.floor((b - 18.5) * 8), st = b < 19.5 ? (k % 2 ? 1.06 : 1) : 1, out = E.inExpo(P(b, 19.45, 19.9));
      set(R.onit, { opacity: clamp(a * 2) * (1 - out) * (b < 19.5 && k % 2 ? 0.7 : 1), transform: `translate(-50%,-50%) translateY(${300 - 0 * a}px) scale(${st * (1 - 0.6 * out)})`, filter: `blur(${(1 - a) * 10 + out * 20}px)`,
        textShadow: `0 0 ${60 + 60 * (k % 2)}px rgba(166,140,255,.7)` });
    }

    /* ---------- the fast cuts (b20-29.5) ---------- */
    CUTS.forEach((c, i) => {
      const on = b >= c.at - 0.01 && b < c.end + 0.15 && !tail; vis(c.el, on); if (!on) return;
      const inn = E.outExpo(P(b, c.at, c.at + 0.22)), out = E.inCubic(P(b, c.end - 0.1, c.end + 0.12));
      const vel = Math.abs(inn - E.outExpo(P(b - 0.05, c.at, c.at + 0.22))) + Math.abs(out - E.inCubic(P(b - 0.05, c.end - 0.1, c.end + 0.12)));
      set(c.el, { transform: `translateX(${(1 - inn) * 760 - out * 760}px) scale(${1 + 0.04 * (1 - inn)})`, opacity: clamp(inn * 3) * (1 - out), filter: vel > 0.02 ? `blur(${Math.min(24, vel * 140)}px)` : 'none' });
    });
    // the text thread (b22-25.5)
    if (b >= 22 && b < 25.7 && !tail) {
      const n = Math.floor(MSG.length * P(b, 22.15, 23.3));
      R.msgT.textContent = MSG.slice(0, n) + (b < 23.35 ? '▍' : '');
      const sent = b >= TL.send, rp = E.spring(P(b, TL.reply, TL.reply + 0.5));
      set(R.msgB, { opacity: 1, transform: `translateY(${sent ? -E.outExpo(P(b, TL.send, TL.send + 0.3)) * 0 : 0}px)` });
      set(R.msgMeta, { opacity: sent ? E.outCubic(P(b, TL.send + 0.1, TL.send + 0.35)) : 0 });
      set(R.sendBtn, { opacity: 1 - P(b, TL.send + 0.2, TL.send + 0.45), transform: `scale(${b >= TL.send && b < TL.send + 0.2 ? 1 - 0.1 * Math.sin(P(b, TL.send, TL.send + 0.2) * Math.PI) : 1})`, boxShadow: b >= TL.send ? `0 0 ${50 * pulseAt(b, TL.send, 3)}px rgba(166,140,255,.95)` : 'none' });
      set(R.replyB, { opacity: clamp(rp * 2), transform: `translateY(${(1 - rp) * 40}px) scale(${0.9 + 0.1 * rp})` });
    }
    if (b >= 25.4 && b < 26.8) R.route.setAttribute('stroke-dashoffset', RLEN * (1 - E.inOut(P(b, 25.6, 26.3))));

    /* ---------- type ---------- */
    for (const w of WORDS) {
      if (w.hook) {
        const on = b < 0.95 || raw >= 39.15; vis(w.el, on); if (!on) continue;
        const o = raw >= 39.15 ? tailIn : 1 - P(b, 0.88, 0.95);
        set(w.el, { opacity: o, filter: o < 1 && tail ? `blur(${(1 - o) * 8}px)` : 'none', textShadow: '0 0 50px rgba(166,140,255,.4)' });
        w.spans.forEach(s => { s.style.transform = 'none'; s.style.opacity = 1; s.style.filter = 'none'; }); continue;
      }
      const on = b >= w.at[0] - 0.05 && b < w.out + 0.4 && !tail; vis(w.el, on); if (!on) continue;
      w.spans.forEach((s, j) => reveal(s, b, w.at[j], w.out));
      const g = 1 - P(b, w.at[0], w.at[0] + 1.6);
      w.el.style.textShadow = `0 0 ${40 + 50 * g}px rgba(166,140,255,${0.35 + 0.4 * g})`;
    }

    /* ---------- end card ---------- */
    const endOn = b >= 31.9 && raw < 39.9; vis(R.endc, endOn);
    if (endOn) {
      const rise = E.outExpo(P(b, 32, 33.6)), out = E.inOut(P(raw, 39.0, 39.6));
      set(R.endc, { opacity: 1 - out, filter: out > 0 ? `blur(${out * 12}px)` : 'none' });
      set(R.wordmark, { top: (360 + 90 * (1 - rise)) + 'px', opacity: E.outCubic(P(b, 32, 32.5)), transform: `translateX(-50%) scale(${0.9 + 0.1 * rise})`, filter: `blur(${(1 - E.outCubic(P(b, 32, 33))) * 14}px)`, textShadow: `0 0 ${60 + 80 * (1 - P(b, 32, 35))}px rgba(166,140,255,${0.45 + 0.35 * (1 - P(b, 32, 35))})` });
      set(R.tagline, { top: '640px', transform: 'translateX(-50%)' }); reveal(R.tagSpan, b, 32.6, 999, 1.0);
      set(R.cta, { top: '732px', transform: 'translateX(-50%)' }); R.ctaSpans.forEach((s, j) => reveal(s, b, 33.2 + j * 0.45, 999, 0.9));
    }

    /* flashes: phrase cuts, the drop, cut whips */
    const fl = Math.max(...(b < 18.5 && !tail ? PH_STARTS.map(s => 0.18 * pulseAt(b, s, 14)) : [0]), b >= 19.85 && b < 20 ? 0.9 * P(b, 19.85, 20) : 0, 0.9 * pulseAt(b, 20, 5), 0.4 * pulseAt(b, 32, 7), b >= 18.5 && b < 19.5 ? 0.12 * (Math.floor((b - 18.5) * 8) % 2) : 0);
    R.flash.style.opacity = tail ? 0 : fl; vis(R.flash, !tail && fl > 0.002);

    const fi = Math.floor(t * 60), nz = NOISE[fi % 8], gx = (fi * 137) % 540, gy = (fi * 251) % 675;
    gctx.drawImage(nz, -gx, -gy); gctx.drawImage(nz, 540 - gx, -gy); gctx.drawImage(nz, -gx, 675 - gy); gctx.drawImage(nz, 540 - gx, 675 - gy);
    grain.style.opacity = 0.18;
  }

  /* ---------------------------------------------------------------- boot */
  window.renderFrame = render; window.DURATION = DUR;
  for (const tw of [0, 1.5, 3, 6, 10, 13, 16, 18.8, 19.7, 20.3, 21.4, 22.8, 24, 25, 26, 27, 28, 29, 30.5, 34, 39.5, 39.95]) render(tw * BEAT);
  render(0); window.__ready = true;
  if (!RENDER) {
    const aud = $('#aud'), pp = $('#pp'), scrub = $('#scrub'), tc = $('#tc'); scrub.max = DUR; let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (aud.currentTime >= DUR - 0.05) aud.currentTime = 0; aud.play(); } else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; render(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; render(t); scrub.value = t; tc.textContent = t.toFixed(2) + 's'; if (t >= DUR) { playing = false; pp.textContent = 'Play'; } } requestAnimationFrame(loop); };
    loop();
  }
})();
