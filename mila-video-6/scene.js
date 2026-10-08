/* Mila film #6 — "Out of Office".
 * render(t) is a pure function of time; cues are beats b of "Could Be Wrong" (0.6977 s).
 * Overloaded calendar b0-6 · freeze + one message to Mila b6-11 · the message becomes the sun b11-12 ·
 * DROP: out of office b12 · approvals b14-20.75 · "Approved from the beach." b21.5 · end b24 · loop b27-28.
 * Loop: ambient motion is periodic over 28 b and the tail rebuilds the exact frame-0 calendar.
 */
(async function () {
  const TL = await (await fetch('timeline.json')).json();
  const BEAT = TL.beat, DUR = TL.duration, TOT = TL.totalBeats;
  const qs = new URLSearchParams(location.search);
  const RENDER = qs.has('render');
  const FORMAT = qs.get('format') || 'square';
  const HOOK = qs.get('hook') || "Agents don't get vacations.";
  if (RENDER) document.body.classList.add('render');
  const SIZES = { square: [1080, 1080, 1], feed: [1080, 1350, 1.04], portrait: [1080, 1920, 1.1] };
  const [W, H, SK] = SIZES[FORMAT] || SIZES.square;
  const vp = document.getElementById('viewport');
  vp.style.width = W + 'px'; vp.style.height = H + 'px';
  document.getElementById('stage').style.transform = `scale(${SK})`;
  if (!RENDER) { const fit = () => { const k = Math.min(innerWidth / W, (innerHeight - 60) / H); vp.style.transformOrigin = '0 0'; vp.style.transform = `translate(${(innerWidth - W * k) / 2}px,0) scale(${k})`; }; fit(); addEventListener('resize', fit); }
  const toVX = x => W / 2 + (x - 540) * SK, toVY = y => H / 2 + (y - 540) * SK;    // stage -> viewport

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
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    msg: '<path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-5.5 4v-4h0a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', arrow: '<path d="M12 18.5V5.5M6 11.5 12 5.5l6 6"/>',
  };
  const svg = (n, s = 22, w = 1.8, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;
  $('#cSend').innerHTML = svg('arrow', 30, 2.4);

  /* ---------------------------------------------------------------- the overloaded calendar */
  const GX = 838 / 7, GY = 632 / 12;
  $('#hours').innerHTML = Array.from({ length: 12 }, (_, i) => { const h = 8 + i; return `<div style="top:${i * GY - 6}px">${h > 12 ? h - 12 : h} ${h >= 12 ? 'PM' : 'AM'}</div>`; }).join('');
  $('#grid').style.backgroundSize = `${GX}px ${GY}px`;
  const fmt = h => { const hh = Math.floor(h), m = h % 1 ? ':30' : ''; return `${hh > 12 ? hh - 12 : hh}${m} ${hh >= 12 ? 'PM' : 'AM'}`; };
  const EVS = TL.events.map(([d, h, dur, label, tone, at], i) => {
    const k = TL.events.slice(0, i).filter(([d2, h2, du2]) => d2 === d && h2 < h + dur && h < h2 + du2).length;
    const el = document.createElement('div'); el.className = `ev t${tone}` + (k ? ' cf' : '');
    el.innerHTML = `${label}<span>${fmt(h)}</span>`;
    const x = d * GX + 3 + Math.min(k, 3) * 16, y = (h - 8) * GY + 2;
    set(el, { left: x + 'px', top: y + 'px', width: Math.max(60, GX - 6 - Math.min(k, 3) * 16) + 'px', height: (dur * GY - 4) + 'px', zIndex: i });
    $('#grid').appendChild(el);
    const r = rng(i * 17 + 3);
    return { el, at, x, y, cx: 60 + 100 + x + GX / 2, cy: 236 + 134 + y + dur * GY / 2, sp: r() * 1.2 + 1.6 };
  });
  const MORE = [[1, '+4 more'], [3, '+6 more'], [4, '+3 more'], [6, '+5 more']].map(([d, t], i) => {
    const el = document.createElement('div'); el.className = 'more'; el.textContent = t; set(el, { left: (d * GX + 10) + 'px', top: (632 - 36) + 'px', zIndex: 100 });
    $('#grid').appendChild(el); return { el, at: 4.6 + i * 0.27 };
  });

  /* ---------------------------------------------------------------- approval cards */
  const SLOT_Y = [330, 442, 554, 666], CARD_X = 160, LAND_T = [14, 15.5, 17, 18.5], APPROVE_T = [20, 20.25, 20.5, 20.75];
  const TIDY = [['photo:hero_waterfront', 'Reply to a new lead', 'Asking about 48 Coral Palm Way'], ['cal', 'Showing · Sat 11 AM', '1207 Sea Grape Ln · Sarasota'],
    ['msg', '9 follow-up texts', 'Everyone from Sunday’s open house'], ['photo:tampa_rockpool', 'Just listed post', '915 Mangrove Bay Dr · 3 slides']];
  const CARDS = TIDY.map(([ic, t, d]) => {
    const el = document.createElement('div'); el.className = 'card';
    const icon = ic.startsWith('photo:') ? `<div class="ti ph" style="background-image:url(assets/photos/${ic.slice(6)}.jpg)"></div>` : `<div class="ti">${svg(ic, 28, 2)}</div>`;
    el.innerHTML = `<div class="tidy lglass">${icon}<div><div class="tt">${t}</div><div class="td">${d}</div></div><div class="ap"><span class="lbl">Approve</span>${svg('check', 24, 2.8, '#fff')}</div></div><div class="cring"></div>`;
    $('#cards').appendChild(el);
    return { el, ap: el.querySelector('.ap'), ring: el.querySelector('.cring'), lbl: el.querySelector('.lbl'), ck: el.querySelector('.ap svg') };
  });
  const PCS = [['hero_waterfront', 'Naples', 190, 215, -10], ['sarasota_bridgepool', 'Sarasota', 890, 205, 8], ['beach_boardwalk', 'Delray Beach', 185, 875, 7], ['lauderdale_tiki', 'Fort Lauderdale', 895, 880, -8]]
    .map(([ph, c, x, y, r], i) => { const el = document.createElement('div'); el.className = 'pc'; el.innerHTML = `<div style="background-image:url(assets/photos/${ph}.jpg)"></div><span>${c}</span>`; $('#pcs').appendChild(el); return { el, x, y, r, at: 22 + i * 0.5 }; });

  /* ---------------------------------------------------------------- type */
  const WORDS = [
    { l: [HOOK], at: [-9], out: 5.7, x: 540, y: 128, fs: 86, w: 960, center: true },
    { l: ['Out of office.'], at: [12.2], out: 13.3, x: 540, y: 330, fs: 160, w: 900, center: true },
    { l: ['Leads.'], at: [14.1], out: 15.3, x: 540, y: 880, fs: 120, w: 800, center: true },
    { l: ['Showings.'], at: [15.6], out: 16.8, x: 540, y: 880, fs: 120, w: 800, center: true },
    { l: ['Follow-ups.'], at: [17.1], out: 18.3, x: 540, y: 880, fs: 120, w: 800, center: true },
    { l: ['Posts.'], at: [18.6], out: 19.25, x: 540, y: 880, fs: 120, w: 800, center: true },
    { l: ['Approved', 'from the beach.'], at: [21.5, 21.85], out: 23.6, x: 540, y: 540, fs: 150, w: 720, center: true },
  ];
  WORDS.forEach(w => {
    const el = document.createElement('div'); el.className = 'kw';
    el.innerHTML = w.l.map(t => `<div class="ln"><span>${t}</span></div>`).join('');
    set(el, { left: w.x + 'px', top: w.y + 'px', fontSize: w.fs + 'px', transform: w.center ? 'translate(-50%,-50%)' : 'translate(0,-50%)', textAlign: w.center ? 'center' : 'left' });
    $('#words').appendChild(el); w.el = el; w.spans = $$('.ln > span', el);
  });

  /* ---------------------------------------------------------------- assets */
  await document.fonts.load('400 40px "Instrument Serif"'); await document.fonts.load('italic 40px "Instrument Serif"'); await document.fonts.load('600 16px "Inter"'); await document.fonts.ready;
  await Promise.all(['hero_waterfront', 'sarasota_bridgepool', 'beach_boardwalk', 'lauderdale_tiki', 'tampa_rockpool'].map(n => new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = `assets/photos/${n}.jpg`; })));
  WORDS.forEach(w => { const wd = w.el.offsetWidth; if (wd > w.w) w.el.style.fontSize = (w.fs * w.w / wd) + 'px'; });
  const TGW = $('#toggle').offsetWidth, APW = $('#apAll').offsetWidth;

  /* ---------------------------------------------------------------- refs */
  const R = {
    cam: $('#cam'), cal: $('#cal'), calCount: $('#calCount'), calm: $('#calm'), composer: $('#composer'), cGlow: $('#cGlow'), sunCore: $('#sunCore'), cTxt: $('#cTxt'), askLbl: $('#askLbl'),
    typed: $('#typed'), caret: $('#caret'), cPh: $('#cPh'), cSend: $('#cSend'), beach: $('#beach'), rays: $('#rays'), sunGlow: $('#sunGlow'), sea: $('#sea'),
    toggle: $('#toggle'), sw: $('#toggle .sw'), swI: $('#toggle .sw i'), swB: $('#toggle .sw b'),
    stack: $('#stack'), title: $('#stackTitle'), count: $('#stackCount'), apAll: $('#apAll'), apB: $('#apAll b'), pcs: $('#pcs'),
    endc: $('#endc'), wordmark: $('#wordmark'), tagline: $('#tagline'), tagSpan: $('#tagline .ln > span'), cta: $('#cta'), ctaSpans: $$('#cta .ln > span'),
    flash: $('#flash'), redTint: $('#redTint'), gA: $('#gA'), gB: $('#gB'), gC: $('#gC'),
  };
  const sea = R.sea, sx = sea.getContext('2d'); sea.width = W; sea.height = H;
  const GLINTS = (() => { const r = rng(11); return Array.from({ length: 260 }, () => ({ d: Math.pow(r(), 1.5), x: r(), w: 10 + r() * 50, ph: r() * TAU, k: 1 + Math.floor(r() * 3) })); })();
  const grain = $('#grain'), gctx = grain.getContext('2d'), NOISE = [];
  { const r = rng(99); for (let k = 0; k < 8; k++) { const c = document.createElement('canvas'); c.width = c.height = 540; const x = c.getContext('2d'), id = x.createImageData(540, 540); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 110; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); NOISE.push(c); } }
  const reveal = (span, b, b0, outB = 999, dur = 0.7) => { const p = E.outExpo(P(b, b0, b0 + dur)), q = E.inCubic(P(b, outB, outB + 0.35)); span.style.transform = `translateY(${(1 - p) * 112 - q * 112}%)`; span.style.opacity = p > 0 ? 1 : 0; span.style.filter = (p < 1 || q > 0) ? `blur(${(1 - p) * 6 + q * 6}px)` : 'none'; };
  const HZ = 772;                                 // horizon (stage y)
  const BOX = { x: 110, y: 400, w: 860, h: 250 }, SUN_D = 270;

  function drawSea(b, sunX, sunY) {
    const hz = toVY(HZ); sx.clearRect(0, 0, W, H);
    const g = sx.createLinearGradient(0, hz, 0, H); g.addColorStop(0, '#e4dcff'); g.addColorStop(0.35, '#c9d4fb'); g.addColorStop(1, '#aec4f2');
    sx.fillStyle = g; sx.fillRect(0, hz, W, H - hz);
    const rg = sx.createRadialGradient(sunX, hz, 10, sunX, hz, 520 * SK); rg.addColorStop(0, 'rgba(255,214,190,.75)'); rg.addColorStop(1, 'rgba(255,214,190,0)');
    sx.fillStyle = rg; sx.fillRect(0, hz, W, H - hz);
    sx.fillStyle = 'rgba(255,255,255,.9)'; sx.fillRect(0, hz - 1, W, 2);
    for (const s of GLINTS) {
      const y = hz + 4 + s.d * (H - hz), near = 1 - Math.min(1, Math.abs((s.x - 0.5) * W) / (120 + 500 * s.d));
      const x = (s.x * W + Math.sin(b * 0.9 * s.k + s.ph) * 30 * (0.3 + s.d)) % W, a = (0.18 + 0.6 * near) * (0.5 + 0.5 * Math.sin(TAU * s.k * b / TOT * 7 + s.ph));
      sx.fillStyle = `rgba(255,255,255,${a})`; sx.fillRect(x - s.w * (0.4 + s.d) / 2, y, s.w * (0.4 + s.d), 1.5 + 2.5 * s.d);
    }
  }

  /* ================================================================ RENDER */
  function render(t) {
    const raw = t / BEAT, b = raw;
    const cb = Math.min(b, 6);                        // calendar time freezes on b6
    const tail = raw >= 27;
    const tailIn = E.inOut(P(raw, 27.15, 27.85));     // calendar + hook return

    /* camera */
    let cx = per(raw, 3) * 3, cy = per(raw, 2) * 2, cs = 1 + 0.004 * per(raw, 2), cr = 0;
    if (b < 6) { const a = 0.4 + 9 * Math.pow(b / 6, 2.2), hit = pulseAt(b, 5.5, 5) * 8; cx += Math.sin(b * 31) * (a + hit); cy += Math.sin(b * 23 + 1) * (a + hit) * 0.8; cr = Math.sin(b * 19) * a * 0.03; cs *= 1 + 0.04 * (b / 6); }
    else if (b < 12) cs *= 1.04 - 0.04 * E.outCubic(P(b, 6, 7.5));
    for (const T of [12, ...LAND_T, ...APPROVE_T, 24]) { const d = pulseAt(b, T, 8); cy += 5 * d; cs *= 1 + (T === 12 || T === 24 ? 0.035 : 0.008) * d; }
    R.cam.style.transform = `translate(${cx}px,${cy}px) rotate(${cr}deg) scale(${cs})`;

    /* bg glows (white world) */
    const W2 = W / 2, H2 = H / 2;
    set(R.gA, { left: (W2 - 300 + per(raw, 2) * 160) + 'px', top: (H2 - 260 + perc(raw, 1) * 120) + 'px', opacity: 0.38 });
    set(R.gB, { left: (W2 + 320 + perc(raw, 2) * 140) + 'px', top: (H2 + 60 + per(raw, 1) * 140) + 'px', opacity: 0.34 });
    set(R.gC, { left: (W2 + per(raw, 1) * 200) + 'px', top: (H2 + 360) + 'px', opacity: 0.32 });

    /* ---------- calendar (b0-6 live, ghost b6-11, sucked into the sun b11-12; returns in the tail) ---------- */
    const calOn = b < 12 || raw >= 27.15; vis(R.cal, calOn);
    if (calOn) {
      const live = tail ? 0 : cb;
      const ghost = tail ? 0 : E.outCubic(P(b, 6, 7.2));
      const suck = tail ? 0 : E.inExpo(P(b, 11.0, 12));
      const sunX = BOX.x + BOX.w / 2, sunY = HZ - 40;
      let shown = 0;
      EVS.forEach(e => {
        const on = e.at < 0 || live >= e.at; vis(e.el, on); if (!on) return; shown++;
        const p = e.at < 0 ? 1 : E.spring(P(live, e.at, e.at + 0.45));
        let dx = 0, dy = (1 - p) * -46, s = 1.15 - 0.15 * p, rot = 0;
        if (suck > 0) { const ang = Math.atan2(e.cy - sunY, e.cx - sunX) + suck * e.sp, dist = Math.hypot(e.cx - sunX, e.cy - sunY) * (1 - suck);
          dx = sunX + Math.cos(ang) * dist - e.cx; dy = sunY + Math.sin(ang) * dist - e.cy; s *= 1 - 0.9 * suck; rot = suck * 200; }
        set(e.el, { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg) scale(${s})`, opacity: clamp(p * 3) * (suck > 0 ? lerp(1, 4, suck) * (1 - P(b, 11.85, 12)) : 1) });
      });
      R.calCount.textContent = `${shown} events`;
      R.calCount.style.background = live >= 4.6 ? '#dc2626' : '#0b0b12';
      R.calCount.style.transform = `scale(${1 + 0.12 * Math.max(0, ...EVS.filter(e => e.at >= 0).map(e => (live >= e.at && live < e.at + 0.2) ? Math.sin(P(live, e.at, e.at + 0.2) * Math.PI) : 0))})`;
      MORE.forEach(m => { const p = E.outBack(P(live, m.at, m.at + 0.3)); vis(m.el, live >= m.at); set(m.el, { transform: `scale(${p})`, opacity: clamp(p * 2) * (1 - suck) }); });
      const shake = live >= 5.5 ? pulseAt(live, 5.5, 6) * 10 : 0;
      set(R.cal, { opacity: (tail ? tailIn : lerp(1, 0.3, ghost)), transform: `translateX(${Math.sin(b * 90) * shake}px) scale(${lerp(1, 0.94, ghost) * (tail ? lerp(1.03, 1, tailIn) : 1)})`,
        filter: tail ? (tailIn < 1 ? `blur(${(1 - tailIn) * 10}px)` : 'none') : ghost > 0.01 ? `blur(${ghost * 5 * (1 - suck)}px)` : 'none',
        background: suck > 0 ? `rgba(255,255,255,${0.66 * (1 - suck)})` : '', borderColor: suck > 0 ? `rgba(255,255,255,${0.95 * (1 - suck)})` : '', boxShadow: suck > 0.3 ? 'none' : '' });
    }
    const red = b < 6.2 ? pulseAt(b, 5.5, 3.5) : 0; R.redTint.style.opacity = red * 0.6; vis(R.redTint, red > 0.01);

    /* ---------- the message, then the sun (b6-27.85) ---------- */
    const calmOn = b >= 6.1 && raw < 27.9; vis(R.calm, calmOn);
    if (calmOn) {
      const a = E.outExpo(P(b, 6.2, 7.1));
      const k = TL.keyBeats.filter(x => x <= b).length;
      R.typed.textContent = TL.prompt.slice(0, k); R.cPh.style.display = k ? 'none' : 'inline';
      R.caret.style.opacity = b >= 10.8 ? 0 : (k > 0 && k < TL.prompt.length) || b % 1 < 0.6 ? 1 : 0;
      const m = E.inOut(P(b, 11.0, 11.9));
      const rise = E.inOut(P(b, 24, 26.5)), sunCy = HZ - 40 - 70 * rise, sunCx = 540 + per(raw, 1) * 4;
      const bw = lerp(BOX.w, SUN_D, m), bh = lerp(BOX.h, SUN_D, m), bx = lerp(BOX.x, sunCx - SUN_D / 2, m), by = lerp(BOX.y + (1 - a) * 50, sunCy - SUN_D / 2, m);
      const clipB = Math.max(0, by + bh - HZ);
      const fadeEnd = 1 - P(raw, 27.15, 27.85);
      set(R.composer, { left: bx + 'px', top: by + 'px', width: bw + 'px', height: bh + 'px', borderRadius: lerp(40, SUN_D / 2, m) + 'px',
        clipPath: b >= 11.95 && clipB > 0 ? `inset(0 0 ${clipB}px 0 round 0)` : 'none', opacity: clamp(a * 1.5) * fadeEnd,
        background: m > 0 ? `rgba(255,255,255,${0.66 * (1 - m)})` : '', borderColor: m > 0 ? `rgba(255,255,255,${0.95 * (1 - m)})` : '', boxShadow: m > 0.6 ? 'none' : '',
        filter: a < 1 ? `blur(${(1 - a) * 10}px)` : 'none' });
      R.sunCore.style.opacity = m;
      const txtO = 1 - P(b, 10.95, 11.25);
      R.cTxt.style.opacity = txtO; R.cSend.style.opacity = txtO; R.askLbl.style.opacity = clamp(a) * txtO;
      R.cSend.style.transform = `scale(${b >= 10.8 && b < 11.0 ? 1 - 0.14 * Math.sin(P(b, 10.8, 11.0) * Math.PI) : 1})`;
      R.cGlow.style.opacity = clamp(0.4 * a * (1 - m) + pulseAt(b, 10.8, 4) + (b >= 11 && b < 12.5 ? Math.sin(P(b, 11, 12.5) * Math.PI) : 0));
    }

    /* ---------- vacation world (b11.8-27.85) ---------- */
    const beachO = Math.min(E.outCubic(P(b, 11.85, 12.05)), 1 - P(raw, 27.15, 27.85));
    vis(R.beach, beachO > 0.001); R.beach.style.opacity = beachO;
    if (beachO > 0.001) {
      const rise = E.inOut(P(b, 24, 26.5)), sunX = toVX(540), sunY = toVY(HZ - 40 - 70 * rise);
      set(R.rays, { left: sunX + 'px', top: sunY + 'px', transform: `rotate(${b * 2.2}deg) scale(${SK})`, opacity: 0.55 + 0.45 * pulseAt(b, 12, 1.5) });
      set(R.sunGlow, { left: sunX + 'px', top: sunY + 'px', transform: `scale(${SK * (1 + 0.5 * pulseAt(b, 12, 2) + 0.2 * pulseAt(b, 24, 2) + 0.03 * per(raw, 4))})` });
      drawSea(b, sunX, sunY);
    }

    /* ---------- out of office toggle ---------- */
    const tgOn = b >= 12.6 && b < 21.6; vis(R.toggle, tgOn);
    if (tgOn) {
      const a = E.spring(P(b, 12.6, 13.3)), up = E.inOut(P(b, 13.55, 13.95)), out = E.inCubic(P(b, 21.2, 21.6));
      const y = lerp(470, 140, up) - out * 60, s = lerp(1, 0.78, up);
      set(R.toggle, { transform: `translate(${-TGW / 2}px,${y - 46 + (1 - a) * 40}px) scale(${s * (0.9 + 0.1 * a)})`, transformOrigin: '50% 50%', opacity: clamp(a * 2) * (1 - out) });
      const on = E.outBack(P(b, 13.25, 13.55));
      R.swI.style.transform = `translateX(${38 * on}px)`; R.swB.style.opacity = clamp(on);
      R.sw.style.boxShadow = b >= 13.25 ? `0 0 ${40 * pulseAt(b, 13.25, 1.5)}px rgba(166,140,255,.9)` : 'none';
    }

    /* ---------- approvals (land b14-18.5, approve all on b20) ---------- */
    const stackOn = b >= 13.95 && b < 21.6; vis(R.stack, stackOn);
    if (stackOn) {
      const tp = E.outExpo(P(b, 13.95, 14.5)), headOut = E.inCubic(P(b, 21.1, 21.5));
      set(R.title, { transform: `translate(0,${238 + (1 - tp) * 30}px)`, opacity: tp * (1 - headOut) });
      R.count.textContent = LAND_T.filter(x => b >= x).length - APPROVE_T.filter(x => b >= x).length;
      const bump = Math.max(0, ...[...LAND_T, ...APPROVE_T].map(x => (b >= x && b < x + 0.3) ? Math.sin(P(b, x, x + 0.3) * Math.PI) : 0));
      set(R.count, { transform: `translate(874px,240px) scale(${1 + 0.25 * bump})`, opacity: tp * (1 - headOut) });
      CARDS.forEach((c, i) => {
        const L = LAND_T[i], T = APPROVE_T[i];
        if (b < L - 0.05) { vis(c.el, false); return; }
        vis(c.el, true);
        const land = E.spring(P(b, L - 0.05, L + 0.55)), sweep = E.outExpo(P(b, T + 0.08, T + 0.5));
        set(c.el, { transform: `translate(${CARD_X + sweep * 820}px,${SLOT_Y[i] + (1 - land) * 140 - sweep * 40}px) rotate(${sweep * 7}deg) scale(${lerp(0.92, 1, land)})`, opacity: clamp(land * 3) * (1 - P(b, T + 0.2, T + 0.5)) });
        const fill = E.outCubic(P(b, T, T + 0.1));
        set(c.ap, { background: fill > 0 ? `linear-gradient(135deg, rgba(143,180,255,${fill}), rgba(166,140,255,${fill}))` : 'transparent', borderColor: fill > 0.5 ? 'transparent' : 'rgba(11,11,18,.22)', boxShadow: fill > 0 ? `0 0 ${36 * (1 - P(b, T, T + 0.7))}px rgba(166,140,255,.95)` : 'none' });
        c.lbl.style.opacity = 1 - fill;
        const path = c.ck.querySelector('path'); path.setAttribute('stroke-dasharray', 22); path.setAttribute('stroke-dashoffset', 22 * (1 - E.outCubic(P(b, T + 0.02, T + 0.18)))); c.ck.style.opacity = fill;
        const rp = b >= T ? P(b, T, T + 0.7) : P(b, L, L + 0.8);
        set(c.ring, { opacity: rp < 1 ? (1 - rp) * (b >= T ? 1 : 0.6) : 0, transform: `scale(${1 + 0.06 * rp},${1 + 0.25 * rp})`, transformOrigin: '50% 50%' });
      });
      const ba = E.spring(P(b, 19.4, 20.0)), press = b >= 20 && b < 20.2 ? 1 - 0.08 * Math.sin(P(b, 20, 20.2) * Math.PI) : 1, bout = E.inCubic(P(b, 20.9, 21.3));
      vis(R.apAll, b >= 19.4);
      set(R.apAll, { transform: `translate(${-APW / 2}px,${800 + (1 - ba) * 60}px) scale(${press * (0.9 + 0.1 * ba)})`, opacity: clamp(ba * 2) * (1 - bout), boxShadow: b >= 20 ? `0 0 ${60 * pulseAt(b, 20, 2)}px rgba(166,140,255,.95)` : 'none' });
      R.apB.style.opacity = E.outCubic(P(b, 20, 20.12));
    }

    /* ---------- postcards around "Approved from the beach." ---------- */
    const pcOn = b >= 21.95 && b < 24.2; vis(R.pcs, pcOn);
    if (pcOn) PCS.forEach((p, i) => {
      const a = E.spring(P(b, p.at, p.at + 0.6)), out = E.inCubic(P(b, 23.6, 24.1)), dir = p.x < 540 ? -1 : 1;
      vis(p.el, b >= p.at);
      set(p.el, { transform: `translate(${p.x + dir * (1 - a) * 260 + dir * out * 500}px,${p.y + (1 - a) * 80}px) rotate(${p.r * a + dir * (1 - a) * 25}deg) scale(${lerp(0.7, 1, a)})`, opacity: clamp(a * 2) * (1 - out) });
    });

    /* ---------- type ---------- */
    for (const w of WORDS) {
      const hook = w.at[0] < 0;
      let on = hook ? (b < 6.1 || raw >= 27.15) : (b >= w.at[0] - 0.05 && b < w.out + 0.4);
      vis(w.el, on); if (!on) continue;
      if (hook) {
        const o = raw >= 27.15 ? tailIn : 1 - E.inCubic(P(b, 5.7, 6.1));
        set(w.el, { opacity: o, filter: o < 1 ? `blur(${(1 - o) * 8}px)` : 'none', textShadow: '0 0 40px rgba(166,140,255,.22)' });
        w.spans[0].style.transform = 'none'; w.spans[0].style.opacity = 1; w.spans[0].style.filter = 'none';
        continue;
      }
      w.spans.forEach((s, j) => reveal(s, b, w.at[j], w.out));
      const g = 1 - P(b, w.at[0], w.at[0] + 1.2);
      w.el.style.textShadow = `0 0 ${30 + 40 * g}px rgba(255,255,255,${0.5 + 0.4 * g})`;
    }

    /* ---------- end card ---------- */
    const endOn = b >= 23.9 && raw < 27.9; vis(R.endc, endOn);
    if (endOn) {
      const rise = E.outExpo(P(b, 24, 25.3)), out = E.inOut(P(raw, 27.0, 27.6));
      set(R.endc, { opacity: 1 - out, filter: out > 0 ? `blur(${out * 12}px)` : 'none' });
      set(R.wordmark, { top: (250 + 90 * (1 - rise)) + 'px', opacity: E.outCubic(P(b, 24, 24.4)), transform: `translateX(-50%) scale(${0.9 + 0.1 * rise})`, filter: `blur(${(1 - E.outCubic(P(b, 24, 24.8))) * 14}px)`, textShadow: `0 0 ${50 + 70 * (1 - P(b, 24, 26))}px rgba(255,255,255,${0.6 + 0.3 * (1 - P(b, 24, 26))})` });
      set(R.tagline, { top: '500px', transform: 'translateX(-50%)' }); reveal(R.tagSpan, b, 24.75, 999, 0.8);
      set(R.cta, { top: '578px', transform: 'translateX(-50%)' }); R.ctaSpans.forEach((s, j) => reveal(s, b, 25.5 + j * 0.5, 999, 0.75));
    }

    /* flash on the drop */
    const fl = b >= 11.75 && b < 13 ? (b < 12 ? E.inCubic(P(b, 11.75, 12)) * 0.85 : 0.85 * Math.exp(-(b - 12) * 4)) : 0;
    R.flash.style.opacity = fl; vis(R.flash, fl > 0.002);

    /* grain */
    const fi = Math.floor(t * 60), nz = NOISE[fi % 8], ox = (fi * 137) % 540, oy = (fi * 251) % 540;
    gctx.drawImage(nz, -ox, -oy); gctx.drawImage(nz, 540 - ox, -oy); gctx.drawImage(nz, -ox, 540 - oy); gctx.drawImage(nz, 540 - ox, 540 - oy);
    grain.style.opacity = 0.2;
  }

  /* ---------------------------------------------------------------- boot */
  window.renderFrame = render; window.DURATION = DUR;
  for (const tw of [0, 3, 5.6, 8, 11.5, 12.5, 14.5, 18, 20.4, 22.5, 25, 27.5, 27.95]) render(tw * BEAT);
  render(0); window.__ready = true;
  if (!RENDER) {
    const aud = $('#aud'), pp = $('#pp'), scrub = $('#scrub'), tc = $('#tc'); scrub.max = DUR; let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (aud.currentTime >= DUR - 0.05) aud.currentTime = 0; aud.play(); } else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; render(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; render(t); scrub.value = t; tc.textContent = t.toFixed(2) + 's'; if (t >= DUR) { playing = false; pp.textContent = 'Play'; } } requestAnimationFrame(loop); };
    loop();
  }
})();
