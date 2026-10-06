/* Mila film #3 — "CONTRACT TO KEYS" (Texas).
 * render(t) is a pure function of time; cues are song beats (b). Drop = b24 ("UNDER CONTRACT"), logo = b40.
 */
(async function () {
  const TL = await (await fetch('timeline.json')).json();
  const BEAT = TL.beat, DUR = TL.duration, HOLD = 45.75;
  const RENDER = new URLSearchParams(location.search).has('render');
  if (RENDER) document.body.classList.add('render');
  const vp = document.getElementById('viewport');
  if (!RENDER) { const fit = () => { const k = Math.min(innerWidth / 1080, (innerHeight - 60) / 1080); vp.style.transformOrigin = '0 0'; vp.style.transform = `translate(${(innerWidth - 1080 * k) / 2}px,0) scale(${k})`; }; fit(); addEventListener('resize', fit); }

  /* ---------------------------------------------------------------- helpers */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, p) => a + (b - a) * p, P = (b, b0, b1) => clamp((b - b0) / (b1 - b0));
  const E = {
    linear: p => p, step: p => (p >= 1 ? 1 : 0),
    outExpo: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)), inExpo: p => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10)),
    inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    ramp: p => (p < 0.5 ? 16 * p ** 5 : 1 - Math.pow(-2 * p + 2, 5) / 2),      // slow-fast-slow speed ramp
    outCubic: p => 1 - Math.pow(1 - p, 3), inCubic: p => p * p * p,
    outBack: p => { const c = 1.6; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    spring: p => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-6.2 * p) * Math.cos(9.5 * p)),
  };
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const set = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const vis = (el, on) => { el.style.visibility = on ? 'visible' : 'hidden'; };

  /* ---------------------------------------------------------------- icons + checks */
  const I = {
    home: '<path d="M3.5 10.5 12 3.8l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-5.8H9.2v5.8H5A1.5 1.5 0 0 1 3.5 19z"/>',
    users: '<circle cx="9" cy="8" r="3.3"/><path d="M2.8 20c.6-3.6 3.2-5.6 6.2-5.6s5.6 2 6.2 5.6"/><circle cx="17.2" cy="9" r="2.6"/><path d="M17 14.3c2.3.2 3.9 1.8 4.4 4.6"/>',
    house: '<path d="M4 20.5V9.2L12 4l8 5.2v11.3"/><path d="M9.5 20.5v-5.5h5v5.5M2.5 20.5h19"/>',
    spark: '<path d="M11 3.5l1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8z"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    dots: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  };
  const svg = (n, s = 22, w = 1.8, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;
  $$('[data-i]').forEach(el => el.insertAdjacentHTML('afterbegin', svg(el.dataset.i)));
  $('#sbIcons').innerHTML = '<svg width="18" height="12" viewBox="0 0 18 12" fill="#fff"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="rgba(255,255,255,.5)"/><rect x="2" y="2" width="17" height="9" rx="2" fill="#fff"/></svg>';
  const CHK = '<svg viewBox="0 0 22 22" width="24" height="24"><circle cx="11" cy="11" r="9.6" fill="none" stroke="rgba(255,255,255,.38)" stroke-width="1.4"/><circle class="f" cx="11" cy="11" r="10" fill="#fff" opacity="0"/><path class="p" d="M6.4 11.4l3.1 3.1 6.2-6.6" fill="none" stroke="#0b0b12" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="16" stroke-dashoffset="16"/></svg>';
  $$('.chk').forEach(el => (el.innerHTML = CHK));
  function setChk(el, p) { const f = el.querySelector('.f'); f.setAttribute('opacity', clamp(p * 2.5)); f.setAttribute('r', 10 * (0.6 + 0.4 * E.outBack(clamp(p * 2.5)))); el.querySelector('.p').setAttribute('stroke-dashoffset', 16 * (1 - E.outCubic(clamp((p - 0.25) / 0.75)))); }
  $('#apBtn').insertAdjacentHTML('beforeend', svg('check', 20, 2.8, '#0b0b12'));
  $('#vWave').innerHTML = Array.from({ length: 34 }, () => '<i></i>').join('');
  const WBARS = $$('#vWave i');

  /* ---------------------------------------------------------------- Texas silhouette (simplified, for stamps) */
  const TX = 'M20 0H38V30L52 32L66 35L78 34L90 38L92 50L93 62L88 70L78 76L70 82L64 92L60 100L52 96L48 88L40 78L33 68L26 64L18 62L10 54L0 44L20 44Z';
  const txSvg = c => `<svg class="tx" viewBox="0 0 94 100"><path d="${TX}" fill="${c}"/></svg>`;

  /* ---------------------------------------------------------------- S1: highway at sunrise (built, no stock) */
  const HZ = 585;
  {
    const g = [];
    g.push(`<defs><linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b3f6e"/><stop offset=".42" stop-color="#4f6fa0"/><stop offset=".72" stop-color="#e98b54"/><stop offset=".9" stop-color="#ffc58a"/><stop offset="1" stop-color="#ffe2b4"/></linearGradient>
      <radialGradient id="sunG"><stop offset="0" stop-color="#fffbea"/><stop offset=".35" stop-color="#ffe8b8"/><stop offset="1" stop-color="#ffb46a" stop-opacity="0"/></radialGradient>
      <linearGradient id="roadG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d5546"/><stop offset="1" stop-color="#2a221d"/></linearGradient>
      <linearGradient id="fieldG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a5b3a"/><stop offset="1" stop-color="#3a2b1d"/></linearGradient></defs>`);
    g.push(`<rect width="1080" height="${HZ}" fill="url(#skyG)"/>`);
    g.push(`<circle cx="770" cy="${HZ - 30}" r="190" fill="url(#sunG)" opacity=".9"/><circle cx="770" cy="${HZ - 30}" r="40" fill="#fffdf2"/>`);
    // hill-country horizon + live oaks
    let hills = `M0 ${HZ - 18} `; for (let x = 0; x <= 1080; x += 60) hills += `Q${x + 30} ${HZ - 30 - 14 * Math.sin(x * 0.013)} ${x + 60} ${HZ - 16 - 10 * Math.cos(x * 0.011)} `;
    g.push(`<path d="${hills}V${HZ + 4}H0Z" fill="#3a2a22" opacity=".75"/>`);
    const r = rng(3); for (let i = 0; i < 16; i++) { const x = r() * 1080, s = 10 + r() * 22; if (Math.abs(x - 560) < 120) continue; g.push(`<ellipse cx="${x}" cy="${HZ - 14 - s * 0.4}" rx="${s * 1.6}" ry="${s * 0.8}" fill="#2a1f1a"/>`); }
    g.push(`<rect y="${HZ}" width="1080" height="${1080 - HZ}" fill="url(#fieldG)"/>`);
    g.push(`<path d="M548 ${HZ} L572 ${HZ} L1500 1080 L-380 1080 Z" fill="url(#roadG)"/>`);
    g.push('<g id="dashes"></g><g id="sign"></g>');
    $('#roadSvg').innerHTML = g.join('');
    // windshield frame + dashboard, in front of the road, behind the phone
    $('#dashSvg').innerHTML = `<defs><linearGradient id="dashG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2420"/><stop offset=".1" stop-color="#161210"/><stop offset="1" stop-color="#0a0807"/></linearGradient></defs>
      <path d="M0 0H1080V64C760 92 320 92 0 64Z" fill="#0b0908"/>
      <rect x="420" y="40" width="240" height="64" rx="18" fill="#0d0b0a"/><rect x="430" y="50" width="220" height="44" rx="12" fill="#3a3f52" opacity=".6"/>
      <path d="M0 0H120L30 780H0Z" fill="#0d0b0a"/><path d="M1080 0H960L1050 780H1080Z" fill="#0d0b0a"/>
      <path d="M0 790C260 742 820 732 1080 772V1080H0Z" fill="url(#dashG)"/>
      <path d="M0 790C260 742 820 732 1080 772" fill="none" stroke="rgba(255,190,120,.55)" stroke-width="3"/>
      <rect x="620" y="770" width="170" height="40" rx="10" fill="#0a0807"/>`;
  }
  const dashesG = () => document.getElementById('dashes'), signG = () => document.getElementById('sign');

  /* ---------------------------------------------------------------- reel + flaps */
  const REEL = [['austin_interior', '1106 Pecan St', '$612,000 · 3 bd'], ['hill_country_ranch', '9031 Hill Country Rd', '$1,149,000 · 4 bd'], ['austin_exterior', '2217 Live Oak Dr', '$668,000 · 3 bd'],
    ['austin_interior', '77 Barton Springs Ct', '$639,000 · 3 bd'], ['hill_country_ranch', '540 Mesquite Trl', '$705,000 · 4 bd'], ['austin_interior', '3310 Lamar Pl', '$598,000 · 2 bd'],
    ['hill_country_ranch', '18 Cypress Bend', '$720,000 · 3 bd'], ['austin_interior', '902 Agave Way', '$655,000 · 3 bd'], ['austin_exterior', '4812 Bluebonnet Ln', '$649,000 · 3 bd · 2 ba']];
  const RSP = 396;
  $('#reel').innerHTML = REEL.map(([ph, a, b], i) => `<div class="rcard" style="top:${24 + i * RSP}px"><div class="photo" style="background-image:url(assets/photos/${ph}.jpg)"></div><div class="gr"></div><div class="a">${a}</div><div class="b">${b}</div></div>`).join('');
  function makeFlaps(host, n, small) {
    host.innerHTML = Array.from({ length: n }, () => `<div class="fc${small ? ' sm' : ''}"><div class="h t s1"><span></span></div><div class="h b s2"><span></span></div><div class="h t fl"><span></span></div><div class="h b fl2"><span></span></div></div>`).join('');
    return $$('.fc', host).map(c => ({ s1: c.querySelector('.s1 span'), s2: c.querySelector('.s2 span'), fl: c.querySelector('.fl'), fls: c.querySelector('.fl span'), fl2: c.querySelector('.fl2'), fl2s: c.querySelector('.fl2 span') }));
  }
  const PIPE = makeFlaps($('#pipeFlaps'), 8, false), DAYS = makeFlaps($('#dayFlaps'), 2, false);
  const PIPE_EV = [[-99, '$000,000'], [6.5, '$312,000'], [7, '$649,000']];
  const DAY_EV = [[-99, '30'], [26, '21'], [27, '14'], [28, '07'], [29, '00']];
  function renderFlaps(cells, evs, b) {
    cells.forEach((c, k) => {
      let i = 0; while (i < evs.length - 1 && b >= evs[i + 1][0] + k * 0.035) i++;
      const to = evs[i][1][k], from = i > 0 ? evs[i - 1][1][k] : to;
      const p = i > 0 && from !== to ? P(b, evs[i][0] + k * 0.035, evs[i][0] + k * 0.035 + 0.2) : 1;
      c.s1.textContent = to; c.s2.textContent = p < 0.5 ? from : to; c.fls.textContent = from; c.fl2s.textContent = to;
      c.fl.style.transform = `rotateX(${-90 * clamp(p * 2)}deg)`; c.fl.style.visibility = p < 0.5 ? '' : 'hidden';
      c.fl2.style.transform = `rotateX(${90 * (1 - clamp(p * 2 - 1))}deg)`; c.fl2.style.visibility = p >= 0.5 && p < 1 ? '' : 'hidden';
    });
  }

  /* ---------------------------------------------------------------- big type + stamps */
  const SLAMS = [
    { l: ['$650K'], at: 4, out: 6, x: 616, y: 225, fs: 150, w: 380 },
    { l: ['3 BED'], at: 4.5, out: 6, x: 616, y: 395, fs: 150, w: 380 },
    { l: ['AUSTIN'], at: 5, out: 6, x: 616, y: 565, fs: 150, w: 380, c: '#e9d6b6' },
    { l: ['THU'], at: 8, out: 9, x: 96, y: 300, fs: 260, w: 900 },
    { l: ['4:30 PM'], at: 8.5, out: 9, x: 96, y: 560, fs: 260, w: 900, c: '#e9d6b6' },
    { l: ['FOLLOW', 'UP.'], at: 14, out: 16, x: 616, y: 370, fs: 170, w: 380 },
    { l: ['PRICE', 'DROP.'], at: 16, out: 18, x: 616, y: 370, fs: 170, w: 380 },
    { l: ['NOTHING', 'MISSED.'], at: 18, out: 20, x: 616, y: 370, fs: 170, w: 380 },
    { l: ['OFFER', 'IN.'], at: 20, out: 21, x: 616, y: 370, fs: 170, w: 380 },
    { l: ['ACCEPTED.'], at: 21, out: 22.85, x: 616, y: 440, fs: 170, w: 380, c: '#e9d6b6' },
    { l: ['CONTRACT'], at: 36, out: 99, x: 540, y: 330, fs: 250, w: 900, center: true },
    { l: ['TO KEYS.'], at: 37, out: 99, x: 540, y: 560, fs: 250, w: 900, center: true, c: '#e9d6b6' },
  ];
  SLAMS.forEach(s => {
    const el = document.createElement('div'); el.className = 'slam';
    el.innerHTML = s.l.map(t => `<span class="l">${t}</span>`).join('');
    set(el, { left: s.x + 'px', top: s.y + 'px', fontSize: s.fs + 'px', color: s.c || '#fff' });
    $('#slams').appendChild(el); s.el = el;
  });
  const STAMPS = [
    { t: 'NEW LEAD', sub: 'Austin · Texas', at: 2, out: 4, x: 540, y: 470, fs: 170, rot: -9, c: '#c4512f' },
    { t: 'SHOWING', sub: 'Thu · 4:30 PM', at: 12, out: 14, x: 330, y: 520, fs: 130, rot: -7, c: '#c4512f' },
    { t: 'UNDER<br>CONTRACT', sub: '4812 Bluebonnet Ln', at: 24, out: 30, x: 540, y: 520, fs: 165, rot: -8, c: '#1d5fa8', shrinkTo: [800, 210, 0.38] },
    { t: 'SOLD', sub: '4812 Bluebonnet Ln · Austin TX', at: 32, out: 36, x: 400, y: 540, fs: 330, rot: -10, c: '#c4512f' },
  ];
  STAMPS.forEach(s => {
    const el = document.createElement('div'); el.className = 'stamp';
    el.innerHTML = `<div class="box">${s.t}<div class="sub">${txSvg(s.c)}${s.sub}${txSvg(s.c)}</div></div>`;
    set(el, { fontSize: s.fs + 'px', color: s.c, filter: 'url(#ink)' });
    $('#stamps').appendChild(el); s.el = el;
  });

  /* ---------------------------------------------------------------- key tag (built object) */
  $('#keytag').innerHTML = `<svg viewBox="0 0 330 330" width="330" height="330">
    <defs><linearGradient id="brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7dfa0"/><stop offset=".5" stop-color="#c9973f"/><stop offset="1" stop-color="#8a6322"/></linearGradient>
      <linearGradient id="leather" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d0603a"/><stop offset="1" stop-color="#9c3a1f"/></linearGradient>
      <filter id="ksh"><feDropShadow dx="10" dy="18" stdDeviation="10" flood-opacity=".45"/></filter></defs>
    <g filter="url(#ksh)">
      <circle cx="96" cy="86" r="44" fill="none" stroke="url(#brass)" stroke-width="9"/>
      <g transform="rotate(-24 96 86)"><rect x="70" y="122" width="52" height="150" rx="12" fill="url(#brass)"/><rect x="118" y="214" width="26" height="12" rx="3" fill="url(#brass)"/><rect x="118" y="238" width="18" height="12" rx="3" fill="url(#brass)"/><circle cx="96" cy="150" r="10" fill="#8a6322"/></g>
      <g transform="rotate(14 200 160)"><rect x="128" y="70" width="168" height="210" rx="24" fill="url(#leather)"/><rect x="138" y="80" width="148" height="190" rx="18" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2" stroke-dasharray="6 6"/>
        <circle cx="212" cy="102" r="10" fill="#7a2c16"/>
        <text x="212" y="176" text-anchor="middle" font-family="Anton" font-size="56" fill="#fff">4812</text>
        <text x="212" y="204" text-anchor="middle" font-family="Inter" font-weight="700" font-size="14" letter-spacing="2.5" fill="#fff">BLUEBONNET LN</text>
        <text x="212" y="244" text-anchor="middle" font-family="Inter" font-weight="800" font-size="13" letter-spacing="4" fill="#ffe2c8">CLOSED ✓</text></g>
    </g></svg>`;

  /* ---------------------------------------------------------------- flare, burn, title */
  $('#flare').innerHTML = `<div id="fGlow" style="position:absolute;width:900px;height:900px;margin:-450px 0 0 -450px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,226,170,.85),rgba(255,160,80,.35) 40%,rgba(255,140,60,0))"></div>
    <div id="fStreak" style="position:absolute;width:1600px;height:5px;margin:-2px 0 0 -800px;border-radius:3px;background:linear-gradient(90deg,rgba(255,170,90,0),rgba(255,210,150,.9) 45%,#fff 50%,rgba(255,210,150,.9) 55%,rgba(255,170,90,0));filter:blur(1.5px)"></div>
    ${[0.45, 0.8, 1.25].map((k, i) => `<div class="fGhost" data-k="${k}" style="position:absolute;width:${[90, 50, 140][i]}px;height:${[90, 50, 140][i]}px;margin:-${[45, 25, 70][i]}px 0 0 -${[45, 25, 70][i]}px;border-radius:50%;background:radial-gradient(circle,rgba(255,200,140,0) 40%,rgba(255,200,140,.28) 70%,rgba(255,200,140,0) 72%)"></div>`).join('')}`;
  $('#burn').innerHTML = ['255,120,30', '255,60,20', '255,230,170'].map(c => `<div class="bb" style="position:absolute;width:1400px;height:1400px;margin:-700px 0 0 -700px;border-radius:50%;background:radial-gradient(closest-side,rgba(${c},.95),rgba(${c},.5) 45%,rgba(${c},0))"></div>`).join('');
  const BB = $$('#burn .bb'), GHOSTS = $$('.fGhost');

  /* ---------------------------------------------------------------- assets */
  await document.fonts.load('400 40px "Anton"'); await document.fonts.load('400 40px "Instrument Serif"'); await document.fonts.load('italic 40px "Instrument Serif"'); await document.fonts.load('600 16px "Inter"'); await document.fonts.ready;
  await Promise.all(['austin_exterior', 'hill_country_ranch', 'austin_interior'].map(n => new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = `assets/photos/${n}.jpg`; })));
  SLAMS.forEach(s => { const w = s.el.offsetWidth; if (w > s.w) s.el.style.fontSize = (s.fs * s.w / w) + 'px'; s.W = s.el.offsetWidth; s.H = s.el.offsetHeight; });
  STAMPS.forEach(s => { s.W = s.el.offsetWidth; s.H = s.el.offsetHeight; });

  /* ---------------------------------------------------------------- refs */
  const R = {
    cam: $('#cam'), road: $('#road'), dash: $('#dash'), plates: $('#plates'), pA: $('#pA'), pB: $('#pB'), pC: $('#pC'), grade: $('#grade'), grade2: $('#grade2'),
    reelScene: $('#reelScene'), reel: $('#reel'), match: $('#match'), titleCard: $('#titleCard'), keytag: $('#keytag'), rig: $('#rig'), black: $('#black'),
    dropFlaps: $('#dropFlaps'), lblTL: $('#lblTL'), lblTLt: $('#lblTLt'), lblBR: $('#lblBR'), flare: $('#flare'), fGlow: $('#fGlow'), fStreak: $('#fStreak'),
    flash: $('#flash'), endcard: $('#endcard'), wordmark: $('#wordmark'), tagline: $('#tagline'), tagSpan: $('#tagline .ln > span'), cta: $('#cta'), ctaSpans: $$('#cta .ln > span'),
    heatDisp: $('#heatDisp'), heatTurb: $('#heatTurb'), mbBlur: $('#mbBlur'), sbTime: $('#sbTime'), notif: $('#notif'),
    contact: $('#contact'), cchk: $$('#contact .chk'), evCard: $('#evCard'), sg: $$('#sSheet .sg'), bubble: $('#bubble'), deliv: $('#deliv'), sendBtn: $('#sendBtn'),
    fuText: $('#fuText'), post: $('#post'), fgchk: $$('#fgCard .chk'), ofLbl: $('#ofLbl'), ofAmt: $('#ofAmt'), ofState: $('#ofState'),
    tcBar: $('#tcBar i'), tcchk: $$('#tcCard .chk'), tcRows: $$('#tcCard .rw'), apBtn: $('#apBtn'), touch: $('#touch'), soldPost: $('#soldPost'),
    vignette: $('#vignette'), phGlow: $('#phGlow'),
  };
  const SCR = { sLock: [0, 4], sVoice: [4, 6], sEvent: [9, 10], sSheet: [10, 11], sText: [11, 14], sFollow: [14, 16], sPost: [16, 18], sForget: [18, 20], sOffer: [20, 23], sCheck: [24, 30], sSold: [30, 36] };
  for (const k in SCR) SCR[k] = { el: document.getElementById(k), r: SCR[k] };
  const TABA = { sVoice: 1, sEvent: 4, sSheet: 4, sCheck: 2, sSold: 0 };
  const LABELS = ['Home', 'Contacts', 'Properties', 'Content', 'Calendar', 'More'], ICONS = ['home', 'users', 'house', 'spark', 'cal', 'dots'], PILLW = [104, 128, 132, 122, 126, 0];
  const tabEls = $$('#tabbar .tab'), tabbar = $('#tabbar'), pill = $('#tabPill');
  function layoutTabs(a) { const pw = PILLW[a], gap = (344 - pw - 200) / 5; let x = 9; tabEls.forEach((el, i) => { const w = i === a ? pw : 40; el.style.left = (x + w / 2 - 23) + 'px'; el.style.opacity = i === a ? 0 : 1; if (i === a) set(pill, { left: x + 'px', width: pw + 'px' }); x += w + gap; }); $('#pillLabel').textContent = LABELS[a]; $('#pillIcon').innerHTML = svg(ICONS[a], 20, 2); }
  let lastTab = -1;

  /* ---------------------------------------------------------------- grain, dust, stars */
  const grain = $('#grain'), gctx = grain.getContext('2d'), NOISE = [];
  { const r = rng(99); for (let k = 0; k < 8; k++) { const c = document.createElement('canvas'); c.width = c.height = 540; const x = c.getContext('2d'), id = x.createImageData(540, 540); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 170; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); NOISE.push(c); } }
  const dust = $('#dust'), dctx = dust.getContext('2d');
  const CONF = (() => { const r = rng(31), cols = ['#e9d6b6', '#c4512f', '#ffffff', '#1d5fa8', '#ffd28a']; return Array.from({ length: 140 }, () => ({ x: r() * 1080, y: -100 - r() * 900, vx: (r() - 0.5) * 140, vy: 380 + r() * 520, s: 5 + r() * 9, rot: r() * 6, vr: (r() - 0.5) * 14, c: cols[Math.floor(r() * 5)] })); })();
  const stars = $('#stars'), sctx = stars.getContext('2d');
  const STARS = (() => { const r = rng(5); return Array.from({ length: 140 }, () => ({ x: r() * 780, y: r() * 1688, s: 0.6 + r() * 1.6, a: 0.25 + r() * 0.6, ph: r() * 6.28, sp: 0.5 + r() * 2 })); })();

  /* ---------------------------------------------------------------- phone track */
  const K = (b, v, e = 'inOut') => [b, v, e];
  const base = { x: 0, y: 0, s: 1, rx: 0, ry: 0, rz: 0, o: 1 }, st = o => Object.assign({}, base, o);
  const RIG = [
    K(0, st({ x: 150, y: 196, s: 0.64, rx: 30, ry: -8, rz: -7 })),
    K(3.6, st({ x: 150, y: 190, s: 0.66, rx: 28, ry: -8, rz: -7 }), 'linear'),
    K(4.0, st({ x: 0, y: 0, s: 2.6, rx: 0, ry: 0, rz: 0, o: 0 }), 'inExpo'),          // zoom through the screen
    K(4.0001, st({ x: -205, y: 10, s: 1.35, ry: 8 }), 'step'),
    K(4.45, st({ x: -200, y: 6, s: 1.0, ry: 8 }), 'outExpo'),
    K(5.95, st({ x: -196, y: 0, s: 1.03, ry: 7 }), 'inOut'),
    K(6.0, st({ x: -196, s: 1.03, o: 0 }), 'step'),
    K(8.95, st({ x: 1000, y: 10, s: 1.0, ry: -14, o: 0 }), 'step'),
    K(9.0, st({ x: 1000, y: 10, s: 1.0, ry: -14 }), 'step'),
    K(9.35, st({ x: 205, y: 10, s: 1.0, ry: -8 }), 'outExpo'),
    K(13.8, st({ x: 200, y: 0, s: 1.05, ry: -6 }), 'inOut'),
    K(14.0, st({ x: -205, y: 10, s: 1.0, ry: 8 }), 'step'),
    K(22.2, st({ x: -195, y: 0, s: 1.08, ry: 6 }), 'linear'),
    K(23.0, st({ x: 0, y: 0, s: 3.0, o: 0 }), 'inExpo'),
    K(24.45, st({ x: -212, y: 900, s: 0.98, ry: 8, o: 1 }), 'step'),
    K(24.85, st({ x: -212, y: 12, s: 0.98, ry: 8 }), 'outExpo'),
    K(29.7, st({ x: -205, y: 0, s: 1.03, ry: 6 }), 'inOut'),
    K(30.0, st({ x: 0, y: 0, s: 2.6, o: 0 }), 'inExpo'),
    K(30.0001, st({ x: 210, y: 10, s: 1.32, ry: -8 }), 'step'),
    K(30.4, st({ x: 210, y: 4, s: 1.0, ry: -8 }), 'outExpo'),
    K(35.9, st({ x: 205, y: 0, s: 1.04, ry: -6 }), 'inOut'),
    K(36.0, st({ s: 1, o: 0 }), 'step'), K(99, st({ o: 0 }), 'linear'),
  ];
  function rigAt(b) {
    let i = 0; while (i < RIG.length - 2 && b >= RIG[i + 1][0]) i++;
    const [b0, v0] = RIG[i], [b1, v1, e] = RIG[i + 1], p = E[e](P(b, b0, b1)), o = {};
    for (const k in base) o[k] = lerp(v0[k], v1[k], p);
    return o;
  }

  /* camera: per-shot speed-ramped push + handheld + hit shake */
  const SHOTS = [[0, 4, 1.0, 1.12], [4, 6, 1.14, 1.02], [6, 8, 1.0, 1.06], [8, 9, 1.0, 1.05], [9, 14, 1.06, 1.0], [14, 23, 1.0, 1.08], [24, 30, 1.1, 1.0], [30, 36, 1.0, 1.07], [36, 40, 1.0, 1.1]];
  const HITS = [[0, 0.7], [2, 1], [4, 0.5], [8, 0.6], [12, 0.9], [14, 0.4], [16, 0.4], [18, 0.4], [20, 0.4], [21, 0.4], [24, 1.3], [30, 0.5], [32, 1.3], [36, 0.9], [37, 0.6]];
  function camAt(b) {
    const sh = SHOTS.find(s => b >= s[0] && b < s[1]) || SHOTS[0];
    let s = lerp(sh[2], sh[3], E.ramp(P(b, sh[0], sh[1])));
    if (b >= 14 && b < 23) s *= 1 + 0.035 * (1 - E.outExpo(P(b, Math.floor(b), Math.floor(b) + 0.5)));   // per-beat punch
    let x = Math.sin(b * 1.9) * 2.5 + Math.sin(b * 4.3 + 1) * 1.5, y = Math.cos(b * 2.3) * 2.5 + Math.sin(b * 3.7) * 1.5, r = Math.sin(b * 1.3) * 0.15;
    for (const [h, a] of HITS) if (b >= h && b < h + 1) { const d = Math.exp(-(b - h) * 7) * a; x += Math.sin(b * 97) * 16 * d; y += Math.cos(b * 83) * 16 * d; r += Math.sin(b * 61) * 0.8 * d; s *= 1 + 0.03 * d; }
    return { s, x, y, r };
  }

  /* ---------------------------------------------------------------- plates */
  const BUILD_SEQ = ['A', 'C', 'B', 'A', 'C', 'B', 'A', 'C', 'B'];   // b14..b22, one per beat
  const PL = { A: R.pA, B: R.pB, C: R.pC };
  function plateState(b) {   // returns [{key, x, s}] visible plates
    if (b >= 4 && b < 6) return [{ k: 'A', x: 0, s: lerp(1.25, 1.05, E.outExpo(P(b, 4, 4.5))) }];
    if (b >= 8 && b < 14) { const w = E.outExpo(P(b, 8, 8.3)); return [{ k: 'C', x: (1 - w) * 1200, s: 1.05 }]; }
    if (b >= 14 && b < 23) {
      const i = Math.floor(b) - 14, w = E.outExpo(P(b, Math.floor(b), Math.floor(b) + 0.32)), dir = i % 2 ? -1 : 1;
      const cur = { k: BUILD_SEQ[i], x: (1 - w) * 1200 * dir, s: 1.06 };
      if (i === 0 || w >= 1) return [cur];
      return [{ k: BUILD_SEQ[i - 1], x: -w * 1200 * dir, s: 1.06 }, cur];
    }
    if (b >= 24 && b < 30) return [{ k: 'A', x: 0, s: lerp(1.12, 1.02, E.outCubic(P(b, 24, 30))) }];
    if (b >= 30 && b < 36) return [{ k: 'C', x: 0, s: lerp(1.25, 1.06, E.outExpo(P(b, 30, 30.5))) }];
    return [];
  }

  const reveal = (span, b, b0, dur = 0.75) => { const p = E.outExpo(P(b, b0, b0 + dur)); span.style.transform = `translateY(${(1 - p) * 112}%)`; span.style.opacity = p > 0 ? 1 : 0; span.style.filter = p < 1 ? `blur(${(1 - p) * 6}px)` : 'none'; };

  /* ================================================================ RENDER */
  function render(t) {
    const b = Math.min(t / BEAT, HOLD), frozen = t / BEAT >= HOLD;

    /* camera */
    const cm = camAt(b);
    R.cam.style.transform = `translate(${cm.x}px,${cm.y}px) rotate(${cm.r}deg) scale(${cm.s})`;

    /* S1 highway */
    const s1 = b < 4;
    vis(R.road, s1); vis(R.dash, s1);
    if (s1) {
      const off = b * 1.6; let d = '';
      for (let k = 0; k < 14; k++) {
        const u = ((k + off) % 14) / 14, u2 = (((k + off) % 14) + 0.45) / 14, y1 = HZ + 495 * u ** 2.3, y2 = HZ + 495 * u2 ** 2.3, w1 = 2 + 26 * u ** 2.3, w2 = 2 + 26 * u2 ** 2.3, cx = 560;
        d += `<path d="M${cx - w1 / 2} ${y1}L${cx + w1 / 2} ${y1}L${cx + w2 / 2} ${y2}L${cx - w2 / 2} ${y2}Z" fill="#f2c14e" opacity="${0.4 + 0.6 * u}"/>`;
      }
      dashesG().innerHTML = d;
      const q = E.inCubic(P(b, 0, 4)), sx = 640 + 520 * q, sy = HZ - 70 - 260 * q, sc = 0.25 + 1.6 * q;
      signG().innerHTML = `<g transform="translate(${sx} ${sy}) scale(${sc})"><rect x="-4" y="0" width="8" height="200" fill="#5d5853"/><rect x="96" y="0" width="8" height="200" fill="#5d5853"/>
        <rect x="-70" y="-120" width="250" height="130" rx="10" fill="#1f6a3d" stroke="#fff" stroke-width="5"/><text x="55" y="-68" text-anchor="middle" font-family="Anton" font-size="44" fill="#fff">AUSTIN</text><text x="55" y="-18" text-anchor="middle" font-family="Anton" font-size="40" fill="#fff">12</text></g>`;
      R.road.style.filter = `url(#heat) saturate(1.15) contrast(1.05)`;
    }

    /* plates */
    const ps = plateState(b), shown = new Set(ps.map(p => p.k));
    for (const k in PL) vis(PL[k], shown.has(k));
    let whipV = 0;
    ps.forEach(p => { PL[p.k].style.transform = `translateX(${p.x}px) scale(${p.s})`; });
    if (b >= 14 && b < 23) { const fb = Math.floor(b); whipV = Math.abs(E.outExpo(P(b, fb, fb + 0.32)) - E.outExpo(P(b - 0.0189, fb, fb + 0.32))) * 1200; }
    if (b >= 8 && b < 8.3) whipV = Math.abs(E.outExpo(P(b, 8, 8.3)) - E.outExpo(P(b - 0.0189, 8, 8.3))) * 1200;
    R.mbBlur.setAttribute('stdDeviation', `${Math.min(40, whipV * 0.35)} 0`);
    const golden = b >= 24 && b < 30 ? 1 : 0;
    const heat = (b >= 14 && b < 30) || b < 4 ? (golden ? 9 : 6) : 0;
    R.heatDisp.setAttribute('scale', heat); R.heatTurb.setAttribute('seed', Math.floor(b * 8) % 50 + 1);
    R.heatTurb.setAttribute('baseFrequency', `0.004 ${0.03 + 0.004 * Math.sin(b * 3)}`);
    R.plates.style.filter = [heat ? 'url(#heat)' : '', whipV > 1 ? 'url(#mb)' : ''].join(' ').trim() || 'none';
    const pf = golden ? 'contrast(1.12) saturate(1.3) sepia(.28) brightness(1.02)' : 'contrast(1.12) saturate(1.16) sepia(.12) brightness(1.03)';
    for (const k in PL) PL[k].querySelector('.img').style.filter = pf;
    const anyPlate = ps.length > 0;
    vis(R.grade, anyPlate); vis(R.grade2, anyPlate);
    R.grade.style.background = golden ? 'rgba(255,150,60,.5)' : 'rgba(255,175,95,.32)';
    R.grade2.style.background = golden ? 'rgb(255,222,180)' : 'rgb(255,242,226)';

    /* S4 reel + pipeline flaps */
    const s4 = b >= 6 && b < 8; vis(R.reelScene, s4);
    if (s4) {
      const p = P(b, 6, 7), idx = 8 * (1 - Math.pow(1 - p, 2.6)) + (b >= 7 ? Math.sin(P(b, 7, 7.5) * Math.PI * 2) * Math.exp(-P(b, 7, 7.5) * 4) * 0.06 : 0);
      const pPrev = P(b - 0.0189, 6, 7), idx0 = 8 * (1 - Math.pow(1 - pPrev, 2.6)), v = Math.abs(idx - idx0) * RSP;
      R.reel.style.transform = `translateY(${-idx * RSP}px)`; R.reel.style.filter = v > 2 ? `blur(${Math.min(14, v * 0.12)}px)` : 'none';
      const m = E.outBack(P(b, 7, 7.3)); set(R.match, { opacity: clamp(m * 2), transform: `rotate(6deg) scale(${0.4 + 0.6 * m})` });
      renderFlaps(PIPE, PIPE_EV, b);
    }

    /* phone */
    const r0 = rigAt(b);
    R.rig.style.transform = `perspective(2000px) translate(${r0.x}px,${r0.y}px) scale(${r0.s}) rotateX(${r0.rx}deg) rotateY(${r0.ry}deg) rotateZ(${r0.rz}deg)`;
    R.rig.style.opacity = r0.o; vis(R.rig, r0.o > 0.01 && !(b >= 6 && b < 9) && b < 36);
    const r1 = rigAt(b - 0.0189), zoomV = Math.abs(r0.s - r1.s);
    R.rig.style.filter = zoomV > 0.02 ? `blur(${Math.min(10, zoomV * 60)}px)` : 'none';
    R.phGlow.style.opacity = b < 4 ? 0.35 + 0.3 * (b < 1 ? Math.sin(b * Math.PI) : 0) : 0.75;
    // buzz on the dashboard
    if (b < 2) { const bz = (b < 0.6 || (b >= 1 && b < 1.6)) ? Math.sin(b * 260) * 3 : 0; R.rig.style.transform += ` translateX(${bz}px)`; }
    // stars
    sctx.clearRect(0, 0, 780, 1688);
    for (const s of STARS) { sctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(b * s.sp + s.ph)); sctx.fillStyle = '#fff'; sctx.beginPath(); sctx.arc(s.x, (s.y + b * 4 * s.sp) % 1688, s.s, 0, 6.283); sctx.fill(); }
    // which screen
    let cur = null;
    for (const k in SCR) { const on = b >= SCR[k].r[0] && b < SCR[k].r[1]; vis(SCR[k].el, on); if (on) cur = k; }
    if (cur) {
      const t0 = SCR[cur].r[0], zi = E.outExpo(P(b, t0, t0 + 0.3));
      if ((b >= 14 && b < 23) || cur === 'sSheet' || cur === 'sText') SCR[cur].el.style.transform = `scale(${lerp(0.82, 1, zi)})`, SCR[cur].el.style.opacity = clamp(zi * 1.6);
      else SCR[cur].el.style.transform = 'none', SCR[cur].el.style.opacity = 1;
    }
    const ta = cur in TABA ? TABA[cur] : -1;
    vis(tabbar, ta >= 0); if (ta >= 0 && ta !== lastTab) { layoutTabs(ta); lastTab = ta; }
    R.sbTime.textContent = b < 9 ? '6:42' : b < 14 ? '4:30' : b < 24 ? '9:12' : b < 30 ? '11:05' : '2:00';

    // lock screen notification
    const nt = E.spring(P(b, 0.1, 0.8)); set(R.notif, { opacity: clamp(nt * 2), transform: `translateY(${(1 - nt) * -40}px) scale(${0.92 + 0.08 * nt})` });
    // voice -> contact
    const col = E.inOut(P(b, 4.7, 5.0));
    WBARS.forEach((el, i) => { const h = 10 + 120 * Math.abs(Math.sin(b * 6.1 + i * 0.7) * Math.sin(b * 2.9 + i * 0.37)) * (0.4 + 0.6 * Math.sin(i / 33 * Math.PI)); set(el, { height: lerp(h, 4, col) + 'px', opacity: 1 - P(b, 4.85, 5.0) }); });
    const cc = E.spring(P(b, 4.9, 5.5)); set(R.contact, { opacity: clamp(cc * 2), transform: `translateY(${(1 - cc) * 40}px) scale(${0.94 + 0.06 * cc})` });
    R.cchk.forEach((c, i) => setChk(c, P(b, 5.15 + i * 0.2, 5.45 + i * 0.2)));
    // showing
    const ev = E.spring(P(b, 9.05, 9.6)); set(R.evCard, { transform: `translateY(${(1 - ev) * 30}px)`, opacity: clamp(ev * 2) });
    R.sg.forEach((el, i) => { const p = E.outExpo(P(b, 10 + i * 0.33, 10.35 + i * 0.33)); set(el, { opacity: p, transform: `translateX(${(1 - p) * 60}px)` }); });
    const press = b >= 11 && b < 11.2 ? 1 - 0.05 * Math.sin(P(b, 11, 11.2) * Math.PI) : 1; R.sendBtn.style.transform = `scale(${press})`;
    const bu = E.spring(P(b, 11.25, 11.85)); set(R.bubble, { opacity: clamp(bu * 2), transform: `translateY(${(1 - bu) * 60}px) scale(${0.8 + 0.2 * bu})` });
    R.deliv.style.opacity = P(b, 11.7, 11.9);
    // build screens
    const fu = TL.followUp, nfu = Math.floor(fu.length * P(b, TL.followType[0], TL.followType[1]));
    R.fuText.innerHTML = fu.slice(0, nfu) + (b < 15.6 && Math.floor(b * 4) % 2 === 0 ? '<span class="ecaret"></span>' : '');
    R.post.querySelector('s').style.textDecoration = b >= 16.5 ? 'line-through' : 'none';
    R.fgchk.forEach((c, i) => setChk(c, P(b, 18 + i * 0.5, 18.35 + i * 0.5)));
    const acc = b >= 21;
    R.ofLbl.textContent = acc ? 'Counter accepted' : 'Offer sent';
    R.ofAmt.textContent = acc ? '$645,000' : '$640,000';
    R.ofState.innerHTML = acc ? `${svg('check', 16, 2.8, '#0b0b12')}Accepted` : 'Sent · waiting';
    set(R.ofState, { background: acc ? '#fff' : 'rgba(166,140,255,.3)', color: acc ? '#0b0b12' : '#fff', transform: `scale(${acc ? 1 + 0.15 * (1 - E.outBack(P(b, 21, 21.3))) : 1})` });
    // checklist cascade
    R.tcchk.forEach((c, i) => setChk(c, P(b, 25 + i * 0.5, 25.3 + i * 0.5)));
    R.tcRows.forEach((row, i) => { const p = E.outExpo(P(b, 24.6 + i * 0.12, 25 + i * 0.12)); set(row, { opacity: p, transform: `translateX(${(1 - p) * 40}px)` }); });
    R.tcBar.style.width = (100 * E.outCubic(P(b, 25, 26.8))) + '%';
    // just sold approval
    const sp = E.spring(P(b, 30.1, 30.7)); set(R.soldPost, { transform: `scale(${0.92 + 0.08 * sp})`, opacity: clamp(sp * 2) });
    const fill = E.outCubic(P(b, 31.5, 31.6)), bp = b >= 31.5 && b < 31.65 ? 1 - 0.1 * Math.sin(P(b, 31.5, 31.65) * Math.PI) : 1;
    set(R.apBtn, { background: `rgba(255,255,255,${fill})`, transform: `scale(${bp})`, boxShadow: fill > 0 ? `0 0 ${30 * (1 - P(b, 31.5, 32.3))}px rgba(166,140,255,.95)` : 'none' });
    R.apBtn.querySelector('.lbl').style.opacity = 1 - fill;
    const ck = R.apBtn.querySelector('svg'), ckp = ck.querySelector('path'); ckp.setAttribute('stroke-dasharray', 22); ckp.setAttribute('stroke-dashoffset', 22 * (1 - E.outCubic(P(b, 31.52, 31.75)))); ck.style.opacity = fill;
    const tp = b >= 31.1 && b < 32 ? Math.min(P(b, 31.1, 31.3), 1 - P(b, 31.8, 32)) : 0;
    set(R.touch, { left: '318px', top: '614px', opacity: tp * 0.95, transform: `scale(${b >= 31.45 && b < 31.65 ? 0.8 : 1})` });

    /* drop: day flaps */
    const df = b >= 24.4 && b < 30; vis(R.dropFlaps, df);
    if (df) { renderFlaps(DAYS, DAY_EV, b); const e = E.spring(P(b, 24.4, 25)); set(R.dropFlaps, { opacity: clamp(e * 2), transform: `translateY(${(1 - e) * 60}px)` }); }

    /* key tag drops onto the counter on b30 */
    const kt = b >= 30 && b < 36; vis(R.keytag, kt);
    if (kt) { const p = E.spring(P(b, 30.0, 30.75)); set(R.keytag, { transform: `translate(${90}px,${lerp(-420, 600, p)}px) rotate(${lerp(-30, -4, p) + Math.sin(b * 2) * 1.2}deg) scale(${lerp(1.3, 1, p)})` }); }

    /* title card */
    vis(R.titleCard, b >= 36 && b < 40);

    /* slams: hard in, hard out */
    for (const s of SLAMS) {
      const on = b >= s.at && b < s.out; vis(s.el, on); if (!on) continue;
      const p = P(b, s.at, s.at + 0.12), k = lerp(1.45, 1, E.outCubic(p));
      set(s.el, { opacity: clamp(p * 3), transform: `${s.center ? `translate(-50%,-50%)` : 'translate(0,-50%)'} scale(${k})`, transformOrigin: s.center ? '50% 50%' : '0 50%', filter: p < 1 ? `blur(${(1 - p) * 8}px)` : 'none' });
    }
    /* stamps: slam from 2x, ink, settle; UNDER CONTRACT shrinks to the corner */
    for (const s of STAMPS) {
      const on = b >= s.at && b < s.out; vis(s.el, on); if (!on) continue;
      const p = P(b, s.at, s.at + 0.13), k = lerp(2.1, 1, E.inExpo(p)) * (p >= 1 ? 1 + 0.04 * Math.exp(-(b - s.at - 0.13) * 20) : 1);
      let x = s.x, y = s.y, sc = k;
      if (s.shrinkTo) { const q = E.inOut(P(b, 25.3, 25.9)); x = lerp(s.x, s.shrinkTo[0], q); y = lerp(s.y, s.shrinkTo[1], q); sc *= lerp(1, s.shrinkTo[2], q); }
      set(s.el, { opacity: clamp(p * 4), transform: `translate(${x - s.W / 2}px,${y - s.H / 2}px) rotate(${s.rot}deg) scale(${sc})` });
    }

    /* black silence beat (b23) */
    vis(R.black, b >= 23 && b < 24);

    /* labels */
    const LBL = [[0, '06:42 · I-35 South'], [4, 'Lead captured · 06:43'], [6, 'Buyer match'], [8, 'Showing · Thu 4:30 PM'], [14, 'Day 4 · follow-through'], [23, ''], [24, 'Under contract · day 9'], [30, 'Closing day · Nov 7'], [36, '']];
    let li = 0; while (li < LBL.length - 1 && b >= LBL[li + 1][0]) li++;
    R.lblTLt.textContent = LBL[li][1]; vis(R.lblTL, !!LBL[li][1] && b < 36);
    R.lblTL.style.color = b >= 6 && b < 8 ? '#fff' : '#fff';
    const br = (b >= 4 && b < 6) || (b >= 8 && b < 14) || (b >= 24 && b < 30) || (b >= 30 && b < 36);
    R.lblBR.innerHTML = br ? '4812 Bluebonnet Ln<br>Austin, TX 78704' : ''; vis(R.lblBR, br);

    /* lens flare: low Texas sun */
    let fx = 770, fy = HZ - 30, fo = 0;
    if (b < 4) fo = 0.75 + 0.15 * Math.sin(b * 3);
    else if (b >= 24 && b < 30) { fx = 930; fy = 170; fo = 0.8; }
    else if (b >= 14 && b < 23) { fx = 960; fy = 140; fo = 0.35 + 0.25 * Math.abs(Math.sin(b * Math.PI)); }
    else if (b >= 4 && b < 6) { fx = 960; fy = 120; fo = 0.4; }
    else if (b >= 30 && b < 36) { fx = 120; fy = 140; fo = 0.35; }
    vis(R.flare, fo > 0);
    set(R.fGlow, { left: fx + 'px', top: fy + 'px', opacity: fo });
    set(R.fStreak, { left: fx + 'px', top: fy + 'px', opacity: fo * 0.9 });
    GHOSTS.forEach(g => { const k = +g.dataset.k; set(g, { left: lerp(fx, 1080 - fx, k) + 'px', top: lerp(fy, 1080 - fy, k) + 'px', opacity: fo }); });

    /* film burns: b12 flash, b23 silence beat, b38 burn-out to white */
    const BURNS = [[12, 0.8, 0.8], [23, 1.0, 1.0], [32, 0.5, 0.7]];
    let bo = 0, bx = 900, by = 200, bs = 0.7;
    for (const [h, d, a] of BURNS) if (b >= h && b < h + d) { const q = P(b, h, h + d); bo = Math.sin(q * Math.PI) * a; bx = h === 23 ? lerp(-200, 1280, q) : 950; by = h === 23 ? 540 : 150; bs = 0.6 + q * 0.6; }
    if (b >= 38) { const q = E.inCubic(P(b, 38, 39.8)); bo = q * 1.0; bx = lerp(1100, 540, q); by = lerp(-100, 540, q); bs = 0.5 + 1.6 * q; }
    vis($('#burn'), bo > 0.01 && b < 40.6);
    BB.forEach((el, i) => set(el, { left: (bx + [0, -160, 120][i] * bs) + 'px', top: (by + [0, 120, -80][i] * bs) + 'px', opacity: bo * [1, 0.8, 0.9][i] * (b >= 40 ? 1 - P(b, 40, 40.6) : 1), transform: `scale(${bs * [1, 0.8, 0.6][i]})` }));

    /* flash: SOLD hit + white-out into the end card */
    const fl = Math.max(b >= 32 ? 0.75 * (1 - E.outCubic(P(b, 32, 32.5))) : 0, b >= 24 ? 0.5 * (1 - E.outCubic(P(b, 24, 24.4))) * (b < 25 ? 1 : 0) : 0,
      E.inCubic(P(b, 39.2, 39.9)) * (1 - E.outCubic(P(b, 40.0, 40.8))), b < 0.15 ? 0 : 0);
    R.flash.style.opacity = fl;

    /* end card */
    const end = b >= 39.9; vis(R.endcard, end);
    if (end) {
      const rise = E.outExpo(P(b, 40, 41.3));
      set(R.wordmark, { top: (300 + 90 * (1 - rise)) + 'px', opacity: E.outCubic(P(b, 40, 40.4)), transform: `translateX(-50%) scale(${0.9 + 0.1 * rise})`, filter: `blur(${(1 - E.outCubic(P(b, 40, 40.8))) * 14}px)`, textShadow: `0 0 ${40 + 70 * (1 - P(b, 40, 42.5))}px rgba(255,255,255,${0.35 + 0.5 * (1 - P(b, 40, 42.5))})` });
      set(R.tagline, { top: '548px' }); reveal(R.tagSpan, b, 41, 0.8);
      set(R.cta, { top: '640px', textShadow: `0 0 ${24 + 30 * (1 - P(b, 42, 43.5))}px rgba(255,255,255,${0.3 + 0.35 * (1 - P(b, 42, 43.5))})` });
      R.ctaSpans.forEach((s, j) => reveal(s, b, 42 + j * 0.5, 0.75));
    }
    R.vignette.style.opacity = end ? 0.35 : 1;

    /* dust + scratches + SOLD confetti */
    dctx.clearRect(0, 0, 1080, 1080);
    if (!frozen && b < 40) {
      const r = rng(Math.floor(t * 60) + 7);
      for (let i = 0; i < 9; i++) { dctx.fillStyle = r() < 0.6 ? 'rgba(20,12,6,.55)' : 'rgba(255,248,235,.6)'; dctx.beginPath(); dctx.arc(r() * 1080, r() * 1080, 0.8 + r() * 2.2, 0, 6.283); dctx.fill(); }
      if (r() < 0.25) { dctx.strokeStyle = 'rgba(255,245,230,.22)'; dctx.lineWidth = 1; const x = r() * 1080; dctx.beginPath(); dctx.moveTo(x, 0); dctx.lineTo(x + (r() - 0.5) * 20, 1080); dctx.stroke(); }
    }
    if (b >= 32 && b < 36) {
      const tt = (b - 32) * BEAT;
      for (const c of CONF) { const y = c.y + c.vy * tt + 520 * tt; if (y < -20 || y > 1100) continue; dctx.save(); dctx.translate(c.x + c.vx * tt, y); dctx.rotate(c.rot + c.vr * tt); dctx.globalAlpha = 0.9 * (1 - P(b, 35.2, 36)); dctx.fillStyle = c.c; dctx.fillRect(-c.s / 2, -c.s / 4, c.s, c.s / 2); dctx.restore(); }
      dctx.globalAlpha = 1;
    }

    /* grain */
    const fi = frozen ? 0 : Math.floor(t * 60), nz = NOISE[fi % 8], ox = (fi * 137) % 540, oy = (fi * 251) % 540;
    gctx.drawImage(nz, -ox, -oy); gctx.drawImage(nz, 540 - ox, -oy); gctx.drawImage(nz, -ox, 540 - oy); gctx.drawImage(nz, 540 - ox, 540 - oy);
    grain.style.opacity = end ? 0.22 : 0.42;
  }

  /* ---------------------------------------------------------------- boot */
  window.renderFrame = render; window.DURATION = DUR;
  for (const tw of [0, 2, 5, 6.5, 9, 10.5, 12, 15, 17, 19, 21, 24, 26, 31, 32.5, 37, 41, 44]) render(tw * BEAT);
  render(0); window.__ready = true;
  if (!RENDER) {
    const aud = $('#aud'), pp = $('#pp'), scrub = $('#scrub'), tc = $('#tc'); scrub.max = DUR; let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (aud.currentTime >= DUR - 0.05) aud.currentTime = 0; aud.play(); } else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; render(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; render(t); scrub.value = t; tc.textContent = t.toFixed(2) + 's'; if (t >= DUR) { playing = false; pp.textContent = 'Play'; } } requestAnimationFrame(loop); };
    loop();
  }
})();
