/* Mila film #4 — "Chaos to Calm" (Maryland).
 * render(t) is a pure function of time; cues are song beats (b).
 * Hook b0-4 · white b4-6 · typing b6-11.5 · SNAP b12-15.5 · features b16-27 · freeze b27 · DROP approvals b28 · photos b34 · logo b40 · loop b46.
 */
(async function () {
  const TL = await (await fetch('timeline.json')).json();
  const BEAT = TL.beat, DUR = TL.duration, HOLD0 = 43.75, HOLD1 = 46;
  const qs = new URLSearchParams(location.search);
  const RENDER = qs.has('render');
  const FORMAT = qs.get('format') || 'square';
  const HOOK = qs.get('hook') || 'Sound familiar?';
  if (RENDER) document.body.classList.add('render');
  const SIZES = { square: [1080, 1080, 1], feed: [1080, 1350, 1.04], portrait: [1080, 1920, 1.1] };
  const [W, H, SK] = SIZES[FORMAT] || SIZES.square;
  const vp = document.getElementById('viewport');
  vp.style.width = W + 'px'; vp.style.height = H + 'px';
  document.getElementById('stage').style.transform = `scale(${SK})`;
  if (!RENDER) { const fit = () => { const k = Math.min(innerWidth / W, (innerHeight - 60) / H); vp.style.transformOrigin = '0 0'; vp.style.transform = `translate(${(innerWidth - W * k) / 2}px,0) scale(${k})`; }; fit(); addEventListener('resize', fit); }

  /* ---------------------------------------------------------------- helpers */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, p) => a + (b - a) * p, P = (b, b0, b1) => clamp((b - b0) / (b1 - b0));
  const E = {
    linear: p => p, step: p => (p >= 1 ? 1 : 0),
    outExpo: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)), inExpo: p => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10)),
    inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2), outCubic: p => 1 - Math.pow(1 - p, 3), inCubic: p => p * p * p,
    outBack: p => { const c = 1.6; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    spring: p => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-6.2 * p) * Math.cos(9.5 * p)),
  };
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const set = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const vis = (el, on) => { el.style.visibility = on ? 'inherit' : 'hidden'; };

  const I = {
    phone: '<path d="M6.5 3.5h3l1.5 4.5-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    msg: '<path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-5.5 4v-4h0a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.6"/><path d="m3.6 6.6 8.4 6.4 8.4-6.4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', plus: '<path d="M12 5.5v13M5.5 12h13"/>', arrow: '<path d="M12 18.5V5.5M6 11.5 12 5.5l6 6"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  };
  const svg = (n, s = 22, w = 1.8, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;
  $('#cPlus').innerHTML = svg('plus', 28, 1.8); $('#cMic').innerHTML = svg('mic', 30, 1.8); $('#cSend').innerHTML = svg('arrow', 30, 2.4);
  $('#sbIcons').innerHTML = '<svg width="18" height="12" viewBox="0 0 18 12" fill="#fff"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="rgba(255,255,255,.5)"/><rect x="2" y="2" width="17" height="9" rx="2" fill="#fff"/></svg>';
  const CHK = '<svg viewBox="0 0 22 22" width="22" height="22"><circle cx="11" cy="11" r="9.6" fill="none" stroke="rgba(255,255,255,.38)" stroke-width="1.4"/><circle class="f" cx="11" cy="11" r="10" fill="#fff" opacity="0"/><path class="p" d="M6.4 11.4l3.1 3.1 6.2-6.6" fill="none" stroke="#0b0b12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="16" stroke-dashoffset="16"/></svg>';
  $$('.chk').forEach(el => (el.innerHTML = CHK));
  function setChk(el, p) { const f = el.querySelector('.f'); f.setAttribute('opacity', clamp(p * 2.5)); f.setAttribute('r', 10 * (0.6 + 0.4 * E.outBack(clamp(p * 2.5)))); el.querySelector('.p').setAttribute('stroke-dashoffset', 16 * (1 - E.outCubic(clamp((p - 0.25) / 0.75)))); }

  /* ---------------------------------------------------------------- the chaos (hook) */
  const MESSY = {
    missed: (n) => `<div class="notif red"><div class="hd"><span class="ic" style="background:#34c759">${svg('phone', 13, 2.4)}</span>Phone · now</div><div class="t">Missed call (${n})</div><div class="d">Dana Ortiz</div></div>`,
    sticky: (t) => `<div class="sticky">${t}</div>`,
    cal: (t) => `<div class="notif red"><div class="hd"><span class="ic" style="background:#ff3b30">${svg('cal', 13, 2.4)}</span>Calendar · conflict</div><div class="t">${t}</div><div class="d">Overlaps another showing</div></div>`,
    text: (n, m) => `<div class="notif"><div class="hd"><span class="ic" style="background:#34c759">${svg('msg', 13, 2.4)}</span>Messages · now</div><div class="t">${n}</div><div class="d">${m}</div></div>`,
    mail: (n) => `<div class="notif"><div class="hd"><span class="ic" style="background:#0a84ff">${svg('mail', 13, 2.4)}</span>Mail</div><div class="t">${n} unread</div><div class="d">Re: Sunday open house?</div></div>`,
  };
  const CHAOS = [
    MESSY.missed(3), MESSY.sticky('lockbox code??<br>sign-in sheet<br>FLYERS!!'), MESSY.cal('Showing · 2:00 PM'), MESSY.text('Jordan Ellis', 'still on for Sunday?'), MESSY.mail(41),
    MESSY.text('Priya Shah', 'can we see it today??'), MESSY.cal('Showing · 2:00 PM'), MESSY.mail(42), MESSY.text('Dana Ortiz', 'call me back pls'),
    MESSY.missed(4), MESSY.text('Seller · Kim', 'any feedback yet?'), MESSY.cal('Inspection · 2:30 PM'),
  ];
  const PIECES = CHAOS.map((html, k) => {
    const el = document.createElement('div'); el.className = 'piece'; el.innerHTML = html;
    (k % 2 ? $('#chaosBack') : $('#chaosFront')).appendChild(el);
    const r = rng(k * 13 + 5);
    return { el, k, rot: (r() - 0.5) * 26, th0: (k / 12) * Math.PI * 2 + r() * 0.3, rx: 360 + r() * 90, ry: 250 + r() * 70, at: 0.1 + k * 0.3 };
  });
  function chaosPos(p, b) {   // centre position + scale of a chaos piece at beat b (frozen after b4)
    const bc = Math.min(b, 4), th = p.th0 + bc * 0.42 * (p.k % 2 ? -1 : 1);
    const d = Math.sin(th);
    return { x: 540 + p.rx * Math.cos(th), y: 560 + p.ry * d + Math.sin(bc * 2 + p.k) * 10, s: 0.8 + 0.22 * (d + 1) / 2, r: p.rot + Math.sin(bc * 1.7 + p.k) * 4 };
  }
  // lock screen notification pile
  $('#lkList').innerHTML = [['Messages', 'Jordan Ellis', 'still on for Sunday?'], ['Mail', '41 unread', 'Re: open house flyers'], ['Calendar', 'Showing · 2:00 PM', 'conflict with 2:00 PM'], ['Phone', 'Missed call (3)', 'Dana Ortiz'], ['Messages', 'Priya Shah', 'lockbox code?'], ['Mail', 'Title company', 'docs needed by 5']]
    .map(([a, b2, c]) => `<div class="ln2 glass"><div class="a">${a} · now</div><b>${b2}</b>${c}</div>`).join('');
  const LK = $$('#lkList .ln2');

  /* ---------------------------------------------------------------- approval cards (SNAP targets) */
  const SLOT_Y = [330, 442, 554, 666, 778], CARD_X = 160, SNAP_T = [12, 13, 14, 15, 15.5], APPROVE_T = [28, 29, 30, 31, 32];
  const TIDY = [['phone', 'Follow-up draft', 'Dana Ortiz · missed call ×3'], ['list', 'Open house checklist', 'Sign-in sheet, flyers, lockbox'], ['cal', 'Calendar, cleaned up', 'Sun 1–4 open house · showings moved'],
    ['msg', '3 text follow-ups', 'Everyone from last week'], ['mail', 'Open house email', '23 buyers · ready to send']];
  const MESSY_FOR = [CHAOS[0], CHAOS[1], CHAOS[2], CHAOS[3], CHAOS[4]];
  const CARDS = TIDY.map(([ic, t, d], i) => {
    const el = document.createElement('div'); el.className = 'card';
    el.innerHTML = `<div class="messy">${MESSY_FOR[i]}</div><div class="tidy lglass"><div class="ti">${svg(ic, 28, 2)}</div><div><div class="tt">${t}</div><div class="td">${d}</div></div><div class="ap"><span class="lbl">Approve</span>${svg('check', 24, 2.8, '#fff')}</div></div><div class="ring"></div>`;
    $('#cards').appendChild(el);
    return { el, messy: el.querySelector('.messy'), tidy: el.querySelector('.tidy'), ap: el.querySelector('.ap'), ring: el.querySelector('.ring'), piece: PIECES[i] };
  });

  /* ---------------------------------------------------------------- world carousel */
  $('#fan').innerHTML = `
    <div class="slide"><div class="photo" style="background-image:url(assets/photos/hero_farmhouse.jpg)"></div><div class="gr"></div><div class="tx"><div class="k">Just listed</div><div class="a">27 Fernwood Hollow Ct</div><div class="c">Germantown, MD 20874</div></div></div>
    <div class="slide"><div class="photo" style="background-image:url(assets/photos/pool.jpg)"></div><div class="dim"></div><div class="k" style="position:absolute;left:18px;top:18px;font:600 9.5px/1 var(--sans);letter-spacing:.22em">OFFERED AT</div><div class="price">$849,000</div>
      <div class="grid"><div class="cell"><b>4</b><span>Beds</span></div><div class="cell"><b>3.5</b><span>Baths</span></div><div class="cell"><b>3,240</b><span>Sq ft</span></div><div class="cell"><b>Pool</b><span>Heated</span></div></div></div>
    <div class="slide"><div class="photo" style="background-image:url(assets/photos/hero_farmhouse.jpg);background-size:230%;background-position:42% 62%"></div><div class="cta"><div class="k">Open house</div><div class="big">Sunday</div><div class="tm">1–4 PM · Germantown</div></div></div>`;
  const SLIDES = $$('#fan .slide');

  /* ---------------------------------------------------------------- type */
  const WORDS = [
    { l: [HOOK], at: [0.5], out: 3.85, x: 540, y: 150, fs: 92, w: 900, center: true },
    { l: ['Brief.', 'Built.'], at: [16, 16.5], out: 17.6, x: 620, y: 540, fs: 130, w: 370 },
    { l: ['Posts.'], at: [18], out: 19.6, x: 600, y: 250, fs: 120, w: 380 },
    { l: ['Emails.'], at: [20], out: 21.6, x: 620, y: 540, fs: 130, w: 370 },
    { l: ['Follow-ups.'], at: [22], out: 23.6, x: 620, y: 540, fs: 130, w: 370 },
    { l: ['Open house.', 'Booked.'], at: [24, 25], out: 27.8, x: 620, y: 540, fs: 120, w: 370 },
    { l: ['Typed once.', 'Done.'], at: [32, 33], out: 33.75, x: 540, y: 560, fs: 150, w: 900, center: true },
  ];
  WORDS.forEach(w => {
    const el = document.createElement('div'); el.className = 'kw';
    el.innerHTML = w.l.map(t => `<div class="ln"><span>${t}</span></div>`).join('');
    set(el, { left: w.x + 'px', top: w.y + 'px', fontSize: w.fs + 'px', transform: w.center ? 'translate(-50%,-50%)' : 'translate(0,-50%)', textAlign: w.center ? 'center' : 'left' });
    $('#words').appendChild(el); w.el = el; w.spans = $$('.ln > span', el);
  });
  const WHIPS = [['log_cabin', 'Open house · Sat 12–2', '88 Laurel Fern Way', 'Frederick, MD 21702'], ['pool', 'Just listed', '41 Quail Hollow Bend', 'Bethesda, MD 20817'],
    ['stone_farmhouse', 'Open house · Sat 2–4', '12 Millstone Bend Ln', 'Poolesville, MD 20837'], ['hero_farmhouse', 'Open house · Sun 1–4', '27 Fernwood Hollow Ct', 'Germantown, MD 20874']];
  $$('.wp').forEach((el, i) => (el.style.backgroundImage = `url(assets/photos/${WHIPS[i][0]}.jpg)`));
  const youTxt = TL.prompt.replace(/\n/g, ' ');
  $('#youBub').textContent = youTxt;

  /* ---------------------------------------------------------------- assets */
  await document.fonts.load('400 40px "Instrument Serif"'); await document.fonts.load('italic 40px "Instrument Serif"'); await document.fonts.load('600 16px "Inter"'); await document.fonts.ready;
  await Promise.all(['hero_farmhouse', 'log_cabin', 'stone_farmhouse', 'pool'].map(n => new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = `assets/photos/${n}.jpg`; })));
  WORDS.forEach(w => { const wd = w.el.offsetWidth; if (wd > w.w) w.el.style.fontSize = (w.fs * w.w / wd) + 'px'; });
  PIECES.forEach(p => { p.w = p.el.firstElementChild.offsetWidth; p.h = p.el.firstElementChild.offsetHeight; });
  CARDS.forEach(c => { c.mw = c.messy.firstElementChild.offsetWidth; c.mh = c.messy.firstElementChild.offsetHeight; });
  const youBub = $('#youBub'); youBub.style.width = '600px';
  const YB = { w: 600, h: youBub.offsetHeight };

  /* ---------------------------------------------------------------- refs */
  const R = {
    cam: $('#cam'), rig: $('#rig'), calm: $('#calm'), composer: $('#composer'), cGlow: $('#cGlow'), askLbl: $('#askLbl'), typed: $('#typed'), caret: $('#caret'), cPh: $('#cPh'), cSend: $('#cSend'),
    stack: $('#stack'), title: $('#stackTitle'), count: $('#stackCount'), you: youBub, fan: $('#fan'), words: $('#words'), endc: $('#endc'), wordmark: $('#wordmark'),
    tagline: $('#tagline'), tagSpan: $('#tagline .ln > span'), cta: $('#cta'), ctaSpans: $$('#cta .ln > span'), flash: $('#flash'), wpCard: $('#wpCard'), wpK: $('#wpK'), wpA: $('#wpA'), wpC: $('#wpC'),
    whips: $$('.wp'), whipsHost: $('#whips'), gA: $('#gA'), gB: $('#gB'), gC: $('#gC'), mbBlur: $('#mbBlur'), chaosB: $('#chaosBack'), chaosF: $('#chaosFront'),
    bws: $$('#brief .bw'), emailBody: $('#emailBody'), sig: $('#sig'), tcs: $$('#sTexts .tc'), tqs: $$('#sTexts .q'), ev: $('#ev'), acts: $$('#ev .act'),
  };
  const SCR = { sLock: [0, 4.8], sBrief: [16, 18], sContent: [18, 20], sEmail: [20, 22], sTexts: [22, 24], sCal: [24, 28] };
  for (const k in SCR) SCR[k] = { el: document.getElementById(k), r: SCR[k] };
  const EMAIL = 'Hi there,\n\nJoin me Sunday 1–4 PM at 27 Fernwood Hollow Ct: a 4-bed Germantown farmhouse with a heated pool and a wide front porch.\n\nSee you there!';

  const grain = $('#grain'), gctx = grain.getContext('2d'), NOISE = [];
  { const r = rng(99); for (let k = 0; k < 8; k++) { const c = document.createElement('canvas'); c.width = c.height = 540; const x = c.getContext('2d'), id = x.createImageData(540, 540); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 110; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); NOISE.push(c); } }
  const stars = $('#stars'), sctx = stars.getContext('2d');
  const STARS = (() => { const r = rng(5); return Array.from({ length: 140 }, () => ({ x: r() * 780, y: r() * 1688, s: 0.6 + r() * 1.6, a: 0.25 + r() * 0.6, ph: r() * 6.28, sp: 0.5 + r() * 2 })); })();
  const reveal = (span, b, b0, outB = 999, dur = 0.7) => { const p = E.outExpo(P(b, b0, b0 + dur)), q = E.inCubic(P(b, outB, outB + 0.35)); span.style.transform = `translateY(${(1 - p) * 112 - q * 112}%)`; span.style.opacity = p > 0 ? 1 : 0; span.style.filter = (p < 1 || q > 0) ? `blur(${(1 - p) * 6 + q * 6}px)` : 'none'; };

  /* ================================================================ RENDER */
  function render(t) {
    const braw = t / BEAT;
    const b = braw >= HOLD0 && braw < HOLD1 ? HOLD0 : braw;   // frozen hold, then the loop tail
    const frozen = braw >= HOLD0 && braw < HOLD1;
    const bf = b >= 27 && b < 28 ? 27 : b;                     // the freeze beat before the drop

    /* camera: light float, hook shake builds, freeze push */
    let cx = Math.sin(b * 0.31) * 3, cy = Math.cos(b * 0.27) * 2, cs = 1 + 0.004 * Math.sin(b * 0.2), cr = 0;
    if (b < 4) { const a = 1.5 + 13 * Math.pow(b / 4, 2.2); cx += Math.sin(b * 41) * a + Math.sin(b * 23) * a * 0.5; cy += Math.cos(b * 37) * a; cr = Math.sin(b * 29) * a * 0.05; cs = 1 + 0.05 * (b / 4); }
    if (b >= 27 && b < 28) cs *= 1 + 0.03 * E.inCubic(P(b, 27, 28));
    for (const T of [...SNAP_T, ...APPROVE_T]) if (b >= T && b < T + 0.6) { const d = Math.exp(-(b - T) * 9); cy += 5 * d; cs *= 1 + 0.008 * d; }
    R.cam.style.transform = `translate(${cx}px,${cy}px) rotate(${cr}deg) scale(${cs})`;

    /* glow blobs */
    const pulse = [...SNAP_T, ...APPROVE_T].reduce((a, T) => a + (b >= T ? Math.exp(-(b - T) * 3) : 0), 0);
    const gAmt = clamp((b < 4 ? 0.25 : 0.55) + 0.35 * pulse, 0, 1.2);
    const W2 = W / 2, H2 = H / 2;
    set(R.gA, { left: (W2 - 300 + Math.sin(b * 0.2) * 160) + 'px', top: (H2 - 260 + Math.cos(b * 0.17) * 120) + 'px', opacity: gAmt });
    set(R.gB, { left: (W2 + 320 + Math.cos(b * 0.23) * 140) + 'px', top: (H2 + 60 + Math.sin(b * 0.19) * 140) + 'px', opacity: gAmt * 0.9 });
    set(R.gC, { left: (W2 + Math.sin(b * 0.15) * 200) + 'px', top: (H2 + 360) + 'px', opacity: gAmt * 0.85 });

    /* ---------- hook: phone + chaos orbit, freeze on b4 ---------- */
    const hookOn = b < 5;
    vis(R.chaosB, hookOn); vis(R.chaosF, hookOn);
    const freezeBlur = b < 4 ? 0 : 22 * E.outCubic(P(b, 4, 4.7)), freezeO = 1 - P(b, 4.25, 4.9);
    if (hookOn) {
      for (const p of PIECES) {
        const c = chaosPos(p, b), a = E.spring(P(b, p.at, p.at + 0.5));
        set(p.el, { opacity: clamp(a * 2) * freezeO, transform: `translate(${c.x - p.w / 2}px,${c.y - p.h / 2 + (1 - a) * -40}px) rotate(${c.r}deg) scale(${c.s * (0.5 + 0.5 * a)})`, filter: freezeBlur > 0.1 ? `blur(${freezeBlur}px)` : (p.k % 2 ? 'blur(1.5px)' : 'none') });
      }
      LK.forEach((el, i) => { const at = 0.2 + i * 0.6, a = E.spring(P(b, at, at + 0.5)); set(el, { top: (i * 0) + 'px', transform: `translateY(${(LK.length - 1 - i) * 0 + ((i) * 78) * a - 40 * (1 - a)}px)`, opacity: clamp(a * 2) }); });
      // newest on top: re-stack so the latest notification sits at the top
      LK.forEach((el, i) => { const n = LK.filter((_, j) => b >= 0.2 + j * 0.6).length; const pos = Math.max(0, n - 1 - i); el.style.transform = `translateY(${pos * 78}px) scale(${1 - pos * 0.0})`; el.style.zIndex = 10 + i; });
    }

    /* ---------- phone ---------- */
    let rig = null;
    if (b < 4.9) rig = { x: 0, y: 30, s: 0.9 + 0.04 * Math.min(b, 4) / 4, rx: 6, ry: -10 + Math.min(b, 4), rz: -3, o: freezeO, blur: freezeBlur };
    else if (bf >= 15.95 && bf < 28) {
      const a = E.outExpo(P(bf, 16, 16.45));
      let punch = 0; for (const T of [18, 20, 22, 24]) if (bf >= T) punch = Math.max(punch, 0.035 * Math.exp(-(bf - T) * 6));
      rig = { x: -190, y: lerp(10, 6, P(bf, 16, 27)), s: lerp(1.7, 1, a) * (1 + punch) * (1 + 0.025 * P(bf, 16, 27)), rx: 2, ry: 8, rz: 0, o: clamp(a * 2), blur: (1 - a) * 8 };
    }
    vis(R.rig, !!rig && rig.o > 0.01);
    if (rig) { set(R.rig, { transform: `perspective(2000px) translate(${rig.x}px,${rig.y}px) scale(${rig.s}) rotateX(${rig.rx}deg) rotateY(${rig.ry}deg) rotateZ(${rig.rz}deg)`, opacity: rig.o, filter: rig.blur > 0.1 ? `blur(${rig.blur}px)` : 'none' }); }
    let cur = null; for (const k in SCR) { const on = bf >= SCR[k].r[0] && bf < SCR[k].r[1]; vis(SCR[k].el, on); if (on) cur = k; }
    if (cur && cur !== 'sLock') { const z = E.outExpo(P(bf, SCR[cur].r[0], SCR[cur].r[0] + 0.3)); set(SCR[cur].el, { transform: `scale(${lerp(0.84, 1, z)})`, opacity: clamp(z * 1.6) }); }
    if (rig) { sctx.clearRect(0, 0, 780, 1688); for (const s of STARS) { sctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(bf * s.sp + s.ph)); sctx.fillStyle = '#fff'; sctx.beginPath(); sctx.arc(s.x, (s.y + bf * 4 * s.sp) % 1688, s.s, 0, 6.283); sctx.fill(); } }
    $('#sbTime').textContent = b < 5 ? '8:47' : '9:02';

    /* features */
    R.bws.forEach((row, i) => { const b0 = 16.5 + i * 0.5, p = E.outExpo(P(bf, b0 - 0.1, b0 + 0.35)); set(row, { opacity: p, clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }); setChk(row.querySelector('.chk'), P(bf, b0, b0 + 0.3)); });
    const fanOn = bf >= 18 && bf < 20.2; vis(R.fan, fanOn);
    if (fanOn) {
      const FAN = [[700, 610, -9], [800, 585, 0], [900, 610, 9]];
      SLIDES.forEach((el, i) => { const p = E.spring(P(bf, 18.05 + i * 0.12, 18.75 + i * 0.12)), out = E.inCubic(P(bf, 19.75, 20.15));
        const sx = 540 - 190 + 0, sy = 540;
        set(el, { transform: `translate(${lerp(sx, FAN[i][0], p) + out * 400}px,${lerp(sy, FAN[i][1], p)}px) rotate(${lerp(0, FAN[i][2], p) + Math.sin(bf * 2 + i) * 0.6}deg) scale(${lerp(0.5, 1, p)})`, opacity: clamp(p * 2) * (1 - out), zIndex: i === 1 ? 3 : 2 }); });
    }
    const ne = Math.floor(EMAIL.length * P(bf, TL.emailType[0], TL.emailType[1]));
    R.emailBody.innerHTML = EMAIL.slice(0, ne) + (bf < TL.emailType[1] + 0.2 ? '<span class="ecaret"></span>' : '');
    R.sig.style.opacity = E.outCubic(P(bf, 21.85, 22));
    R.tcs.forEach((el, i) => { const p = E.spring(P(bf, 22.5 + i * 0.5, 23.1 + i * 0.5)); set(el, { opacity: clamp(p * 2), transform: `translateY(${(1 - p) * 40}px)` }); });
    R.tqs.forEach((el, i) => { const p = E.outBack(P(bf, 23.6 + i * 0.1, 23.9 + i * 0.1)); set(el, { opacity: clamp(p * 2), transform: `scale(${0.6 + 0.4 * p})` }); });
    { const d = E.spring(P(bf, 24.5, 25.2)), ex = E.inOut(P(bf, 25.35, 25.9)); set(R.ev, { transform: `translateY(${(1 - d) * -120}px)`, opacity: clamp(P(bf, 24.5, 24.6) * 3), height: lerp(230, 404, ex) + 'px' });
      R.acts.forEach((el, i) => { const p = E.outBack(P(bf, 25.5 + i * 0.3, 25.8 + i * 0.3)); set(el, { opacity: clamp(p * 2), transform: `scale(${0.7 + 0.3 * p})` }); }); }

    /* ---------- calm: the chat box (b4.6-12) and the loop tail (b46-48) ---------- */
    const calmIn = E.outCubic(P(b, 4.6, 5.3)), loopIn = E.outCubic(P(braw, 46.4, 47.3));
    const calmOn = (b >= 4.6 && b < 12.1) || braw >= 46.4;
    vis(R.calm, calmOn);
    if (calmOn) {
      const loop = braw >= 46.4;
      const k = loop ? 0 : TL.keyBeats.filter(x => x <= b).length;
      R.typed.textContent = TL.prompt.slice(0, k);
      R.cPh.style.display = k ? 'none' : 'inline';
      R.caret.style.opacity = !loop && b >= 11.5 ? 0 : (k > 0 && k < TL.prompt.length) || Math.floor((loop ? braw : b) * 2) % 2 === 0 ? 1 : 0;
      const send = !loop && b >= 11.5 ? E.inOut(P(b, 11.55, 12.0)) : 0;
      const a = loop ? loopIn : calmIn;
      set(R.calm, { opacity: a * (1 - send), transform: `translateY(${(1 - a) * 30 - send * 260}px) scale(${(0.97 + 0.03 * a) * (1 - 0.35 * send)})`, filter: a < 1 ? `blur(${(1 - a) * 10}px)` : 'none' });
      R.cGlow.style.opacity = loop ? 0.5 * loopIn : Math.max(0.5 * calmIn, b >= 11.2 && b < 11.8 ? 1 - P(b, 11.5, 11.8) : 0);
      R.cSend.style.transform = `scale(${!loop && b >= 11.5 && b < 11.7 ? 1 - 0.12 * Math.sin(P(b, 11.5, 11.7) * Math.PI) : 1})`;
    }

    /* ---------- the stack: SNAP (b12-16) and approvals on the drop (b28-34) ---------- */
    const stackOn = (b >= 11.4 && b < 16.15) || (b >= 28 && b < 34);
    vis(R.stack, stackOn);
    if (stackOn) {
      const drop = b >= 28;
      // push through the first card into the phone on b16
      const thru = !drop ? E.inExpo(P(b, 15.7, 16.1)) : 0;
      const enter = drop ? E.outExpo(P(b, 28, 28.4)) : 1;
      set(R.stack, { transform: `scale(${(1 + 1.6 * thru) * lerp(1.12, 1, enter)})`, transformOrigin: '540px 380px', opacity: 1 - thru, filter: thru > 0.01 ? `blur(${thru * 10}px)` : 'none' });
      const yb = drop ? 1 : E.spring(P(b, 11.7, 12.3)), headOut = drop ? E.inCubic(P(b, 32.2, 32.6)) : 0;
      set(R.you, { transform: `translate(${920 - YB.w}px,${lerp(220, 110, yb)}px)`, opacity: clamp(yb * 2) * (1 - headOut) });
      const tp = drop ? 1 : E.outExpo(P(b, 11.9, 12.4));
      set(R.title, { transform: `translate(0,${262 + (1 - tp) * 30}px)`, opacity: tp * (1 - headOut) });
      const landed = drop ? 5 - APPROVE_T.filter(x => b >= x).length : SNAP_T.filter(x => b >= x).length;
      R.count.textContent = landed;
      set(R.count, { transform: `translate(870px,${264}px) scale(${1 + 0.25 * Math.max(0, ...[...SNAP_T, ...APPROVE_T].map(x => (b >= x && b < x + 0.25) ? Math.sin(P(b, x, x + 0.25) * Math.PI) : 0))})`, opacity: tp * (1 - headOut) });
      CARDS.forEach((c, i) => {
        const p = c.piece;
        if (!drop) {
          const T = SNAP_T[i], q = P(b, T - 0.6, T);
          if (b < T - 0.6) { vis(c.el, false); return; }
          vis(c.el, true);
          const from = chaosPos(p, 4), to = { x: CARD_X + 380, y: SLOT_Y[i] + 49 };
          const e = E.inCubic(q), bulge = Math.sin(Math.PI * q) * 120;
          const x = lerp(from.x, to.x, e) + (from.x < 540 ? -bulge : bulge) * 0.6, y = lerp(from.y, to.y, e) - bulge * 0.4;
          const w = lerp(c.mw * from.s, 760, e), h = lerp(c.mh * from.s, 98, e);
          const land = b >= T ? Math.exp(-(b - T) * 14) * Math.sin((b - T) * 30) : 0;
          set(c.el, { transform: `translate(${x - w / 2}px,${y - h / 2}px) rotate(${lerp(from.r, 0, e)}deg) scale(${1 + 0.05 * land},${1 - 0.08 * land})`, opacity: 1, zIndex: b < T + 0.05 ? 10 : 1 });
          const mo = 1 - P(b, T - 0.08, T + 0.1), to2 = P(b, T - 0.04, T + 0.12);
          set(c.messy, { opacity: mo, transform: `scale(${w / c.mw},${h / c.mh})`, transformOrigin: '0 0' });
          set(c.tidy, { opacity: to2, transform: `scale(${w / 760},${h / 98})`, transformOrigin: '0 0' });
          set(c.ring, { left: '0px', top: '0px', width: '760px', height: '98px', opacity: b >= T ? 1 - P(b, T, T + 0.8) : 0, transform: `scale(${(w / 760) * (1 + 0.05 * P(b, T, T + 0.8))},${(h / 98) * (1 + 0.2 * P(b, T, T + 0.8))})`, transformOrigin: '50% 50%' });
          set(c.ap, { background: 'transparent', borderColor: 'rgba(11,11,18,.22)', boxShadow: 'none', transform: 'none' }); c.ap.querySelector('.lbl').style.opacity = 1; c.ap.querySelector('svg').style.opacity = 0;
        } else {
          vis(c.el, true);
          const T = APPROVE_T[i];
          let shift = 0; for (let j = 0; j < i; j++) shift += 112 * E.spring(P(b, APPROVE_T[j] + 0.15, APPROVE_T[j] + 0.7));
          const sweep = E.outExpo(P(b, T + 0.12, T + 0.5));
          set(c.el, { transform: `translate(${CARD_X + sweep * 760}px,${SLOT_Y[i] - shift}px) rotate(${sweep * 6}deg)`, opacity: 1 - P(b, T + 0.2, T + 0.5), zIndex: 1 });
          set(c.messy, { opacity: 0 }); set(c.tidy, { opacity: 1, transform: 'none' });
          const fill = E.outCubic(P(b, T, T + 0.1)), press = b >= T && b < T + 0.15 ? 1 - 0.08 * Math.sin(P(b, T, T + 0.15) * Math.PI) : 1;
          set(c.ap, { background: fill > 0 ? `linear-gradient(135deg, rgba(143,180,255,${fill}), rgba(166,140,255,${fill}))` : 'transparent', borderColor: fill > 0.5 ? 'transparent' : 'rgba(11,11,18,.22)', transform: `scale(${press})`, boxShadow: fill > 0 ? `0 0 ${36 * (1 - P(b, T, T + 0.7))}px rgba(166,140,255,.95)` : 'none' });
          c.ap.querySelector('.lbl').style.opacity = 1 - fill;
          const ck = c.ap.querySelector('svg'), path = ck.querySelector('path'); path.setAttribute('stroke-dasharray', 22); path.setAttribute('stroke-dashoffset', 22 * (1 - E.outCubic(P(b, T + 0.02, T + 0.2)))); ck.style.opacity = fill;
          set(c.ring, { width: '760px', height: '98px', opacity: b >= T ? 1 - P(b, T, T + 0.7) : 0, transform: `scale(${1 + 0.06 * P(b, T, T + 0.7)})`, transformOrigin: '50% 50%' });
        }
      });
    }

    /* ---------- type ---------- */
    for (const w of WORDS) {
      const on = bf >= w.at[0] - 0.05 && bf < w.out + 0.4; vis(w.el, on); if (!on) continue;
      w.spans.forEach((s, j) => reveal(s, bf, w.at[j], w.out));
      const g = 1 - P(bf, w.at[0], w.at[0] + 1.3);
      w.el.style.textShadow = `0 0 ${30 + 40 * g}px rgba(166,140,255,${0.15 + 0.35 * g})`;
    }

    /* ---------- photo whips (b34-38) ---------- */
    const whipOn = b >= 33.8 && b < 39.8; vis(R.whipsHost, whipOn); vis(R.wpCard, b >= 34 && b < 38.4);
    if (whipOn) {
      let mv = 0;
      R.whips.forEach((el, i) => {
        const T = 34 + i, inn = E.outExpo(P(b, T, T + 0.3)), out = i < 3 ? E.outExpo(P(b, T + 1, T + 1.3)) : 0;
        const on = b >= T && (i === 3 || b < T + 1.3);
        vis(el, on); if (!on) return;
        const x = (1 - inn) * (W + 200) - out * (W + 200);
        mv = Math.max(mv, Math.abs(E.outExpo(P(b, T, T + 0.3)) - E.outExpo(P(b - 0.0189, T, T + 0.3))) * W);
        set(el, { left: (-60 + x) + 'px', width: (W + 120) + 'px', height: (H + 120) + 'px', transform: `scale(${1.08 - 0.06 * P(b, T, T + 1.5)})`, filter: 'url(#mb) saturate(1.05)' });
      });
      R.mbBlur.setAttribute('stdDeviation', `${Math.min(40, mv * 0.3)} 0`);
      const i = clamp(Math.floor(b - 34), 0, 3), T = 34 + i, cp = E.spring(P(b, T + 0.05, T + 0.6));
      R.wpK.textContent = WHIPS[i][1]; R.wpA.textContent = WHIPS[i][2]; R.wpC.textContent = WHIPS[i][3];
      set(R.wpCard, { opacity: clamp(cp * 2) * (1 - P(b, 38.1, 38.4)), transform: `translateY(${(1 - cp) * 40}px)` });
    }

    /* ---------- white, end card, loop ---------- */
    const fl = Math.max(E.inCubic(P(b, 38.3, 39.6)) * (1 - E.outCubic(P(b, 39.9, 40.5))), b >= 4 && b < 5 ? 0.6 * Math.sin(P(b, 4, 5) * Math.PI) : 0);
    R.flash.style.opacity = fl;
    const endOn = b >= 39.9 && braw < 47.2; vis(R.endc, endOn);
    if (endOn) {
      const rise = E.outExpo(P(b, 40, 41.3)), out = E.inCubic(P(braw, 46, 46.6));
      R.endc.style.opacity = 1 - out;
      set(R.wordmark, { top: (280 + 90 * (1 - rise)) + 'px', opacity: E.outCubic(P(b, 40, 40.4)), transform: `translateX(-50%) scale(${0.9 + 0.1 * rise})`, filter: `blur(${(1 - E.outCubic(P(b, 40, 40.8))) * 14}px)`, textShadow: `0 0 ${50 + 70 * (1 - P(b, 40, 42.5))}px rgba(166,140,255,${0.35 + 0.35 * (1 - P(b, 40, 42.5))})` });
      set(R.tagline, { top: '548px', transform: 'translateX(-50%)' }); reveal(R.tagSpan, b, 41, 999, 0.8);
      set(R.cta, { top: '640px', transform: 'translateX(-50%)' }); R.ctaSpans.forEach((s, j) => reveal(s, b, 42 + j * 0.5, 999, 0.75));
    }

    /* grain */
    const fi = frozen ? 0 : Math.floor(t * 60), nz = NOISE[fi % 8], ox = (fi * 137) % 540, oy = (fi * 251) % 540;
    gctx.drawImage(nz, -ox, -oy); gctx.drawImage(nz, 540 - ox, -oy); gctx.drawImage(nz, -ox, 540 - oy); gctx.drawImage(nz, 540 - ox, 540 - oy);
    grain.style.opacity = whipOn ? 0.35 : 0.22;
  }

  /* ---------------------------------------------------------------- boot */
  window.renderFrame = render; window.DURATION = DUR;
  for (const tw of [0, 2, 5, 8, 12.5, 14, 16.5, 18.5, 20.5, 22.5, 24.5, 27.5, 28.5, 31, 34.5, 36.5, 41, 47]) render(tw * BEAT);
  render(0); window.__ready = true;
  if (!RENDER) {
    const aud = $('#aud'), pp = $('#pp'), scrub = $('#scrub'), tc = $('#tc'); scrub.max = DUR; let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (aud.currentTime >= DUR - 0.05) aud.currentTime = 0; aud.play(); } else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; render(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; render(t); scrub.value = t; tc.textContent = t.toFixed(2) + 's'; if (t >= DUR) { playing = false; pp.textContent = 'Play'; } } requestAnimationFrame(loop); };
    loop();
  }
})();
