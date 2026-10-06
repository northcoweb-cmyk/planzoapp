/* Mila launch film — scene engine.
 *
 * Everything on screen is a pure function of time: render(t) sets every
 * property for that instant, so any frame can be rendered in any order and
 * the result is identical (this is what makes frame-exact beat sync possible).
 *
 * Times below are in BEATS of the song (b). seconds = b * BEAT. See
 * timeline.json / README for the cut list.
 */
(async function () {
  const TL = await (await fetch('timeline.json')).json();
  const BEAT = TL.beat, DUR = TL.duration;
  const HOLD = 43.75;                    // last 1 s+ is a frozen hold (spec)
  const qs = new URLSearchParams(location.search);
  const FORMAT = qs.get('format') || 'square';
  const RENDER = qs.has('render');
  if (RENDER) document.body.classList.add('render');

  /* ------------------------------------------------------------ layouts */
  const LAYOUTS = {
    square:    { W: 1080, H: 1080, PX: 178, PS: 1.08, PY: 0,   FS: 1.0,  FY: 50,
                 side: s => s < 0 ? { x: 618, y: 540, w: 372, fs: 86, align: 'left' } : { x: 90, y: 540, w: 372, fs: 86, align: 'left' },
                 top: { x: 540, y: 182, w: 900, fs: 104, align: 'center' } },
    portrait:  { W: 1080, H: 1920, PX: 0,   PS: 1.3,  PY: 170, FS: 1.25, FY: 190,
                 side: () => ({ x: 540, y: 300, w: 900, fs: 124, align: 'center' }),
                 top: { x: 540, y: 300, w: 900, fs: 124, align: 'center' } },
    landscape: { W: 1920, H: 1080, PX: 330, PS: 1.08, PY: 0,   FS: 1.05, FY: 50,
                 side: s => s < 0 ? { x: 1010, y: 540, w: 640, fs: 120, align: 'left' } : { x: 290, y: 540, w: 640, fs: 120, align: 'left' },
                 top: { x: 960, y: 160, w: 1400, fs: 108, align: 'center' } },
  };
  const L = LAYOUTS[FORMAT];
  const vp = document.getElementById('viewport');
  vp.style.width = L.W + 'px'; vp.style.height = L.H + 'px';
  vp.style.right = 'auto'; vp.style.bottom = 'auto';
  if (!RENDER) {
    const fit = () => {
      const k = Math.min(innerWidth / L.W, (innerHeight - 60) / L.H);
      vp.style.transformOrigin = '0 0';
      vp.style.transform = `translate(${(innerWidth - L.W * k) / 2}px,0) scale(${k})`;
    };
    fit(); addEventListener('resize', fit);
  }

  /* ------------------------------------------------------------ math */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const P = (b, b0, b1) => clamp((b - b0) / (b1 - b0));
  const E = {
    linear: p => p,
    outExpo: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    inExpo: p => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10)),
    inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    outCubic: p => 1 - Math.pow(1 - p, 3),
    inCubic: p => p * p * p,
    outBack: p => { const c = 1.5; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    spring: p => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-6.2 * p) * Math.cos(9.5 * p)),
    soft: p => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-7 * p) * Math.cos(5 * p)),
    step: p => (p >= 1 ? 1 : 0),
  };
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const $ = s => document.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const set = (el, o) => { for (const k in o) el.style[k] = o[k]; };

  /* ------------------------------------------------------------ icons */
  const I = {
    home: '<path d="M3.5 10.5 12 3.8l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-5.8H9.2v5.8H5A1.5 1.5 0 0 1 3.5 19z"/>',
    users: '<circle cx="9" cy="8" r="3.3"/><path d="M2.8 20c.6-3.6 3.2-5.6 6.2-5.6s5.6 2 6.2 5.6"/><circle cx="17.2" cy="9" r="2.6"/><path d="M17 14.3c2.3.2 3.9 1.8 4.4 4.6"/>',
    house: '<path d="M4 20.5V9.2L12 4l8 5.2v11.3"/><path d="M9.5 20.5v-5.5h5v5.5M2.5 20.5h19"/>',
    spark: '<path d="M11 3.5l1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    dots: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    plus: '<path d="M12 5.5v13M5.5 12h13"/>',
    arrow: '<path d="M12 18.5V5.5M6 11.5 12 5.5l6 6"/>',
    msg: '<path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-5.5 4v-4h0a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/>',
    tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3-8.7 8.7z"/><circle cx="8.2" cy="8.2" r="1.4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.6"/><path d="m3.6 6.6 8.4 6.4 8.4-6.4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    cam: '<rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.5" r="3.6"/><path d="M8.5 7l1.6-2.5h3.8L15.5 7"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  };
  const svg = (name, size = 22, sw = 1.8, color = 'currentColor') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${I[name]}</svg>`;
  $$('[data-i]').forEach(el => {
    const n = el.dataset.i;
    const big = el.classList.contains('icon-tile');
    el.insertAdjacentHTML('afterbegin', n === 'arrow' ? svg('arrow', 20, 2.4, '#0b0b12') : svg(n, big ? 22 : n === 'clock' ? 13 : 22, big ? 1.7 : 1.8));
  });
  $('#sbIcons').innerHTML =
    '<svg width="18" height="12" viewBox="0 0 18 12" fill="#fff"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>' +
    '<svg width="16" height="12" viewBox="0 0 16 12" fill="#fff"><path d="M8 2.3c2.3 0 4.4.9 6 2.4l1.2-1.3A10.5 10.5 0 0 0 8 .5 10.5 10.5 0 0 0 .8 3.4L2 4.7a8.7 8.7 0 0 1 6-2.4zm0 3.5c1.4 0 2.6.5 3.6 1.4l1.2-1.3A7 7 0 0 0 8 4a7 7 0 0 0-4.8 1.9l1.2 1.3c1-.9 2.2-1.4 3.6-1.4zM8 9.3l1.9-2a2.7 2.7 0 0 0-3.8 0z"/></svg>' +
    '<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="rgba(255,255,255,.5)"/><rect x="2" y="2" width="17" height="9" rx="2" fill="#fff"/><rect x="24.5" y="4.5" width="1.6" height="4" rx=".8" fill="rgba(255,255,255,.5)"/></svg>';

  // check circles
  const CHK = '<svg viewBox="0 0 22 22" width="22" height="22"><circle cx="11" cy="11" r="9.6" fill="none" stroke="rgba(255,255,255,.38)" stroke-width="1.4"/><circle class="f" cx="11" cy="11" r="10" fill="#fff" opacity="0"/><path class="p" d="M6.4 11.4l3.1 3.1 6.2-6.6" fill="none" stroke="#0b0b12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="16" stroke-dashoffset="16"/></svg>';
  $$('.chk').forEach(el => (el.innerHTML = CHK));
  function setChk(el, p) {
    const f = el.querySelector('.f'), pa = el.querySelector('.p');
    f.setAttribute('opacity', clamp(p * 2.5));
    f.setAttribute('r', 10 * (0.6 + 0.4 * E.outBack(clamp(p * 2.5))));
    pa.setAttribute('stroke-dashoffset', 16 * (1 - E.outCubic(clamp((p - 0.25) / 0.75))));
  }

  /* ------------------------------------------------------------ build dynamic DOM */
  // week strip
  const days = [['M', 5], ['T', 6], ['W', 7], ['T', 8], ['F', 9], ['S', 10], ['S', 11]];
  $('#week').innerHTML = days.map(([l, n], i) =>
    `<div class="day${i === 1 ? ' today' : ''}${i === 6 ? ' oh' : ''}"><div class="l">${l}</div><div class="n">${n}</div><i class="dt"${i === 6 ? ' style="background:var(--peach)"' : ''}></i></div>`).join('');
  // pipeline strip
  const PEOPLE = [
    ['Daniela Reyes', 'DR', 'Touring', '#8fb4ff', '$3.2M budget · viewed 26110 PCH twice', 0.55],
    ['Marcus Chen', 'MC', 'New lead', '#ffc9a8', '$5M budget · wants oceanfront', 0.2],
    ['The Hollands', 'TH', 'Offer', '#a68cff', '28450 Winding Way · $1,795,000', 0.8],
    ['Ava Brooks', 'AB', 'Closing', '#ffffff', '6420 Zumirez Dr · escrow day 21', 0.95],
    ['Theo Navarro', 'TN', 'Touring', '#8fb4ff', '$2.4M budget · Point Dume', 0.5],
  ];
  $('#strip').innerHTML = PEOPLE.map(([n, i, st, c, l, p]) =>
    `<div class="pc glass"><div class="hd"><span class="avatar">${i}</span><div><div class="nm">${n}</div><span class="stage"><i style="background:${c}"></i>${st}</span></div></div><div class="ln">${l}</div><div class="pb"><i style="width:${p * 100}%"></i></div></div>`).join('');
  // approvals "all clear" state
  $('#sApprove').insertAdjacentHTML('beforeend',
    `<div id="allClear" style="position:absolute;left:0;right:0;top:300px;text-align:center"><div style="width:64px;height:64px;margin:0 auto;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center">${svg('check', 34, 2.6, '#0b0b12')}</div><div class="serif" style="font-size:30px;margin-top:16px">All caught up</div><div style="font:400 13.5px/1.4 var(--sans);color:rgba(255,255,255,.55);margin-top:6px">4 items approved · scheduled</div></div>`);
  // approve buttons get a check glyph
  $$('.acard .ab').forEach(b => { b.innerHTML = `<span class="lbl">Approve</span>${svg('check', 18, 2.6, '#0b0b12')}`; });

  // expansion tiles: 7x7 grid of the four listing photos
  const PHOTOS = ['hero', 'pool', 'firepit', 'hillside'];
  const tilesEl = $('#tiles');
  const TILES = [];
  {
    const r = rng(42);
    for (let row = -3; row <= 3; row++) for (let col = -3; col <= 3; col++) {
      const center = row === 0 && col === 0;
      const el = document.createElement('div');
      el.className = 'tile';
      const ph = PHOTOS[(col * 3 + row * 5 + 40) % 4];
      const pos = `${Math.round(r() * 100)}% ${Math.round(30 + r() * 40)}%`;
      el.innerHTML = center
        ? `<div class="photo" style="inset:-8%;background-image:url(assets/photos/hero.jpg)" id="heroPhoto"></div><div id="mapLayer"></div>`
        : `<div class="photo" style="background-image:url(assets/photos/${ph}.jpg);background-position:${pos};background-size:${180 + r() * 60}%"></div>`;
      tilesEl.appendChild(el);
      TILES.push({ el, row, col, center, z: center ? 0.35 : r() * 2 - 1, jx: (r() - 0.5) * 30, jy: (r() - 0.5) * 30, rot: (r() - 0.5) * 4, ph: r() * 6.28, dist: Math.hypot(row, col) });
    }
  }
  // stylised Malibu map (no third-party tiles, nothing to license)
  $('#mapLayer').innerHTML = `
  <svg viewBox="0 0 300 300" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0">
    <defs>
      <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16345e"/><stop offset="1" stop-color="#0b1a33"/></linearGradient>
      <linearGradient id="land" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a1b26"/><stop offset="1" stop-color="#121219"/></linearGradient>
      <linearGradient id="pch" x1="0" x2="1"><stop offset="0" stop-color="#8fb4ff"/><stop offset=".55" stop-color="#a68cff"/><stop offset="1" stop-color="#ffc9a8"/></linearGradient>
    </defs>
    <rect width="300" height="300" fill="url(#sea)"/>
    <path d="M0 0H300V150C270 160 250 178 222 176 196 174 182 158 152 160 120 162 104 186 74 188 46 190 22 176 0 182Z" fill="url(#land)"/>
    <path d="M0 182C22 176 46 190 74 188 104 186 120 162 152 160 182 158 196 174 222 176 250 178 270 160 300 150" fill="none" stroke="rgba(255,201,168,.35)" stroke-width="1.2"/>
    <g stroke="rgba(255,255,255,.10)" stroke-width="1" fill="none">
      <path d="M20 40 70 90 60 140M110 20l10 60 40 30M180 30l-10 70 30 40M240 20l-20 60 40 50M60 90h80l40-20 70 10M30 130l60-10 50 10 60-12 70 6"/>
      <path d="M150 0v60l20 40M90 60l-30 40M260 80l40 10"/>
    </g>
    <path d="M0 170C24 166 48 178 74 176 104 174 120 150 152 148 182 146 198 162 222 164 250 166 272 148 300 138" fill="none" stroke="url(#pch)" stroke-width="3.2" stroke-linecap="round"/>
    <text x="22" y="62" fill="rgba(255,255,255,.55)" font-family="Inter" font-weight="600" font-size="9" letter-spacing="3">MALIBU</text>
    <text x="196" y="250" fill="rgba(143,180,255,.55)" font-family="Instrument Serif" font-style="italic" font-size="14">Pacific Ocean</text>
    <text x="232" y="132" fill="rgba(255,255,255,.35)" font-family="Inter" font-weight="600" font-size="6.5" letter-spacing="1.5">PACIFIC COAST HWY</text>
  </svg>
  <div id="pinRipple"></div>
  <svg id="pin" viewBox="0 0 46 60"><path d="M23 59C23 59 3 36 3 22a20 20 0 0 1 40 0c0 14-20 37-20 37z" fill="#fff"/><circle cx="23" cy="22" r="8" fill="#a68cff"/></svg>
  <div id="pinLabel">26110 Pacific Coast Hwy</div>`;

  // particles
  const partsEl = $('#particles');
  const PARTS = [];
  {
    const r = rng(7), cols = ['#ffffff', '#ffc9a8', '#a68cff', '#8fb4ff'];
    for (let i = 0; i < 70; i++) {
      const el = document.createElement('div'); el.className = 'particle';
      const s = 3 + r() * 6, c = cols[i % 4];
      set(el, { width: s + 'px', height: s + 'px', background: c, boxShadow: `0 0 ${s * 2}px ${c}`, opacity: 0 });
      partsEl.appendChild(el);
      PARTS.push({ el, a: r() * Math.PI * 2, v: 380 + r() * 520, life: 0.7 + r() * 0.6, tw: r() * 6.28, s, group: i < 40 ? 'approve' : 'logo', ox: (r() - 0.5) * 520, oy: (r() - 0.5) * 240 });
    }
  }

  // kinetic words
  const WORDS = [
    { lines: ['Ready', 'to list.'], at: [12, 12.5], out: 15.55, side: -1 },
    { lines: ['Posts.'], at: [16], out: 19.55, top: true },
    { lines: ['Emails.'], at: [20], out: 22.55, side: 1 },
    { lines: ['Follow-ups.'], at: [23], out: 25.55, side: -1 },
    { lines: ['Approved.'], at: [28], out: 29.55, side: 1, sub: ['Mila asks before', 'anything goes out.'], subAt: 26.25 },
    { lines: ['Open house.', 'Done.'], at: [30, 31], out: 32.55, side: -1 },
    { lines: ['Who’s next?'], at: [33], out: 35.55, side: 1 },
    { lines: ['Nothing', 'forgotten.'], at: [36, 37], out: 39.45, side: -1 },
  ];
  const wordsEl = $('#words');
  WORDS.forEach(w => {
    const a = w.top ? L.top : L.side(w.side);
    const el = document.createElement('div');
    el.className = 'kw';
    el.innerHTML = w.lines.map(l => `<div class="ln"><span>${l}</span></div>`).join('') +
      (w.sub ? `<div class="subl">${w.sub.map(l => `<div class="ln"><span>${l}</span></div>`).join('')}</div>` : '');
    set(el, { left: a.x - L.W / 2 + 'px', top: a.y - L.H / 2 + 'px', fontSize: a.fs + 'px', textAlign: a.align,
      transform: a.align === 'center' ? 'translate(-50%,-50%)' : 'translate(0,-50%)' });
    if (FORMAT !== 'square' && w.sub) el.querySelector('.subl').style.fontSize = '30px';
    wordsEl.appendChild(el);
    w.el = el; w.spans = $$(':scope > .ln > span', el); w.subSpans = w.sub ? $$('.subl .ln > span', el) : []; w.maxW = a.w; w.fs = a.fs;
  });

  /* ------------------------------------------------------------ wait for assets */
  await document.fonts.load('400 40px "Instrument Serif"');
  await document.fonts.load('italic 40px "Instrument Serif"');
  await document.fonts.load('600 16px "Inter"');
  await document.fonts.ready;
  await Promise.all(['hero', 'pool', 'firepit', 'hillside'].map(n => new Promise(res => { const im = new Image(); im.onload = im.onerror = res; im.src = `assets/photos/${n}.jpg`; })));
  // fit kinetic words into their column
  WORDS.forEach(w => { const wd = w.el.offsetWidth; if (wd > w.maxW) w.el.style.fontSize = (w.fs * w.maxW / wd) + 'px'; });

  /* ------------------------------------------------------------ element refs */
  const rig = $('#rig'), screen = $('#screen'), cam = $('#cam');
  const mbRigBlur = $('#mbRigBlur'), mbFanBlur = $('#mbFanBlur');
  const scr = id => document.getElementById(id);
  function localRect(el) {   // rect relative to #screen, unaffected by transforms
    let x = 0, y = 0, n = el;
    while (n && n !== screen) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }
  // world-space rect of an element inside the phone, for a given rig state (rotation ignored: it is ~0 at hand-off)
  function worldRect(el, st) {
    const r = localRect(el);
    const cx = 11 + r.x + r.w / 2 - 206, cy = 11 + r.y + r.h / 2 - 433;
    return { x: st.x + cx * st.s, y: st.y + cy * st.s, w: r.w * st.s, h: r.h * st.s };
  }

  /* ------------------------------------------------------------ phone rig track */
  const X = L.PX, S = L.PS, Y = L.PY;
  const K = (b, v, ease = 'inOut') => [b, v, ease];
  const base = { x: 0, y: Y, s: S, rx: 0, ry: 0, rz: 0, o: 1, dim: 0 };
  const st = o => Object.assign({}, base, o);
  const RIG = [
    K(0, st({ y: Y + 1050, s: S * 0.96, rx: 26, ry: -16, rz: 5 })),
    K(0.45, st({ y: Y + 1050, s: S * 0.96, rx: 26, ry: -16, rz: 5 })),
    K(2.0, st({ y: Y + 14, s: S * 0.95, rx: 10, ry: -15, rz: 2 }), 'soft'),
    K(6.9, st({ y: Y, s: S * 1.01, rx: 5, ry: -7, rz: 0.5 }), 'inOut'),
    K(7.7, st({ y: Y + 6, s: S * 0.97, rx: 3, ry: -4 }), 'outCubic'),
    K(8.0, st({ s: S * 0.95, rx: 2, ry: -2 }), 'inCubic'),
    K(8.45, st({ s: S * 2.3, o: 0 }), 'outExpo'),
    K(11.0, st({ x: -X, s: S * 1.6, o: 0 }), 'step'),
    K(12.0, st({ x: -X }), 'outExpo'),
    K(15.85, st({ x: -X + 10, y: Y - 8, s: S * 1.03, ry: 5 }), 'inOut'),
    K(16.5, st({ x: 0, y: Y + L.FY + 150, s: S * 0.74, rx: 10, dim: 1 }), 'outExpo'),
    K(19.9, st({ x: 0, y: Y + L.FY + 140, s: S * 0.72, rx: 8, dim: 1 }), 'linear'),
    K(20.45, st({ x: X, ry: -5 }), 'outExpo'),
    K(22.9, st({ x: X - 8, y: Y - 6, s: S * 1.03, ry: -3 }), 'inOut'),
    K(23.45, st({ x: -X, ry: 5 }), 'outExpo'),
    K(25.9, st({ x: -X + 8, y: Y - 6, s: S * 1.03, ry: 3 }), 'inOut'),
    K(26.45, st({ x: X, ry: -5 }), 'outExpo'),
    K(29.9, st({ x: X - 8, y: Y - 6, s: S * 1.03, ry: -3 }), 'inOut'),
    K(30.45, st({ x: -X, ry: 5 }), 'outExpo'),
    K(32.9, st({ x: -X + 8, y: Y - 6, s: S * 1.03, ry: 3 }), 'inOut'),
    K(33.45, st({ x: X, ry: -5 }), 'outExpo'),
    K(35.9, st({ x: X - 8, y: Y - 6, s: S * 1.03, ry: -3 }), 'inOut'),
    K(36.45, st({ x: -X, ry: 5 }), 'outExpo'),
    K(39.4, st({ x: -X + 12, y: Y - 8, s: S * 1.05, ry: 2 }), 'inOut'),
    K(40.1, st({ x: 0, s: S * 1.9, o: 0, ry: 0 }), 'inExpo'),
    K(99, st({ x: 0, s: S * 1.9, o: 0 }), 'linear'),
  ];
  const KEYS = ['x', 'y', 's', 'rx', 'ry', 'rz', 'o', 'dim'];
  function rigAt(b) {
    let i = 0; while (i < RIG.length - 2 && b >= RIG[i + 1][0]) i++;
    const [b0, v0] = RIG[i], [b1, v1, ease] = RIG[i + 1];
    const p = E[ease](P(b, b0, b1));
    const o = {}; KEYS.forEach(k => (o[k] = lerp(v0[k], v1[k], p)));
    // continuous life: never fully still
    o.y += Math.sin(b * 0.42) * 5; o.rz += Math.sin(b * 0.27) * 0.5; o.rx += Math.sin(b * 0.33 + 1) * 0.8;
    return o;
  }
  const rigTransform = o => `translate(${o.x}px,${o.y}px) scale(${o.s}) rotateX(${o.rx}deg) rotateY(${o.ry}deg) rotateZ(${o.rz}deg)`;

  /* ------------------------------------------------------------ screens */
  // [id, in-beat, out-beat, direction of travel on entry]
  const SCREENS = [
    ['sHome', -1, 8.3, 0], ['sChat', 10.9, 15.95, 0], ['sContent', 16, 20, 1], ['sEmail', 20, 23, 1],
    ['sTexts', 23, 26, -1], ['sApprove', 26, 30, 1], ['sCal', 30, 33, -1], ['sContacts', 33, 36, 1], ['sPrep', 36, 99, -1],
  ].map(([id, i, o, d], k, arr) => ({ el: scr(id), i, o, d, dOut: arr[k + 1] ? arr[k + 1][3] : 0 }));
  const TABS = [[-1, 0], [10.9, null], [16, 3], [20, null], [23, 1], [26, 0], [30, 4], [33, 1], [36, 0]];
  const PILLW = [104, 128, 0, 122, 126, 0], LABELS = ['Home', 'Contacts', 'Properties', 'Content', 'Calendar', 'More'], ICONS = ['home', 'users', 'house', 'spark', 'cal', 'dots'];
  function tabLayout(a) {
    const inner = 362 - 18, pw = a == null ? 40 : PILLW[a], gap = (inner - pw - 5 * 40) / 5;
    let x = 9; const out = [];
    for (let i = 0; i < 6; i++) { const w = i === a ? pw : 40; out.push({ x, w }); x += w + gap; }
    return out;
  }
  const tabEls = $$('#tabbar .tab'), pill = $('#tabPill'), pillLabel = $('#pillLabel'), pillIcon = $('#pillIcon'), badge = $('#tabBadge');
  tabEls.forEach(t => { t.style.position = 'absolute'; t.style.top = '9px'; });

  /* measure hand-off rects once (layout is static) */
  const briefPhoto = $('#briefPhoto'), emailBanner = $('#emailBanner');
  const HERO_DST = worldRect(briefPhoto, rigAt(12.0));
  const FAN_SRC = worldRect(briefPhoto, rigAt(15.95));
  const BANNER_DST = worldRect(emailBanner, rigAt(20.45));

  /* ------------------------------------------------------------ noise for grain */
  const grain = $('#grain'), gctx = grain.getContext('2d');
  const NOISE = [];
  {
    const r = rng(99);
    for (let k = 0; k < 8; k++) {
      const c = document.createElement('canvas'); c.width = c.height = 540;
      const x = c.getContext('2d'), id = x.createImageData(540, 540);
      for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 120; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
      x.putImageData(id, 0, 0); NOISE.push(c);
    }
  }
  const stars = $('#stars'), sctx = stars.getContext('2d');
  const STARS = (() => { const r = rng(5); return Array.from({ length: 150 }, () => ({ x: r() * 780, y: r() * 1688, s: 0.6 + r() * 1.6, a: 0.25 + r() * 0.6, ph: r() * 6.28, sp: 0.5 + r() * 2 })); })();

  /* ------------------------------------------------------------ dom refs used per frame */
  const R = {
    bgWhite: $('#bgWhite'), bgSky: $('#bgSky'), bgPhoto: $('#bgPhoto'), bgGrad: $('#bgGrad'), leakA: $('#leakA'), leakB: $('#leakB'), leakC: $('#leakC'),
    vignette: $('#vignette'), flash: $('#flash'), typed: $('#typed'), caret: $('#caret'), ph: $('#ph'), composerTxt: $('#composer .txt'), send: $('#send'),
    glow: $('#composerGlow'), composerShine: $('#composer .shine'), heroTile: TILES.find(t => t.center), mapLayer: $('#mapLayer'), heroPhoto: $('#heroPhoto'),
    pin: $('#pin'), pinRipple: $('#pinRipple'), pinLabel: $('#pinLabel'), ringArc: $('#ringArc'), ringPct: $('#ringPct'), ring: $('#ring'),
    brows: $$('#brief .brow'), bbtns: $('#brief .btns'), briefShine: $('#brief .shine'), kb: $('#briefPhoto .kb'), userBubble: $('#userBubble'), milaLbl: $('#milaLbl'),
    slides: [$('#sl0'), $('#sl1'), $('#sl2')], dots: $$('#dots i'), dotsEl: $('#dots'), fan: $('#fan'),
    emailBody: $('#emailBody'), sig: $('#sig'), openMail: $('#openMail'), emailShine: $('#emailCard .shine'),
    tcards: $$('#sTexts .tcard'), queued: $$('#sTexts .q'),
    acards: $$('#sApprove .acard'), apCount: $('#apCount'), touch: $('#touch'), touchRing: $('#touchRing'), allClear: $('#allClear'),
    ohCard: $('#ohCard'), ags: $$('#sCal .ag'), dts: $$('#week .dt'), cShow: $('#cShow'), cTask: $('#cTask'), cOH: $('#cOH'),
    strip: $('#strip'), pcs: $$('#strip .pc'), answer: $('#answer'), chipTour: $('#chipTour'), answerShine: $('#answer .shine'),
    prepA: $('#prepA'), prepB: $('#prepB'), prepChk: $$('#sPrep .chk'), prepBg: $$('#sPrep .bg'),
    wordmark: $('#wordmark'), tagline: $('#tagline'), cta: $('#cta'), tagSpan: $('#tagline .ln > span'), ctaSpans: $$('#cta .ln > span'), endcard: $('#endcard'),
    content: $$('.slide .tx, .slide .price, .slide .grid, .slide .cta, .slide .k, .slide .pg'),
  };
  const EMAIL = 'Hi there,\n\nYou’re invited to an open house this Sunday, 1–4 PM, at 26110 Pacific Coast Hwy. Four bedrooms, ocean views from every room and sunsets over Point Dume.\n\nBring a friend. Light bites served.';

  const shine = (el, b, b0, dur = 0.9) => { const p = E.inOut(P(b, b0, b0 + dur)); el.style.transform = `translateX(${lerp(-160, 360, p)}%) skewX(-12deg)`; };
  const reveal = (span, b, b0, outB = 999, dur = 0.7) => {
    const p = E.outExpo(P(b, b0, b0 + dur)), q = E.inCubic(P(b, outB, outB + 0.4));
    span.style.transform = `translateY(${(1 - p) * 112 - q * 112}%)`;
    span.style.filter = (p < 1 || q > 0) ? `blur(${(1 - p) * 6 + q * 6}px)` : 'none';
    span.style.opacity = p > 0 ? 1 : 0;
  };

  /* ============================================================ RENDER */
  function render(t) {
    let b = Math.min(t / BEAT, HOLD);
    const frozen = t / BEAT >= HOLD;

    /* ---------- world backgrounds ---------- */
    set(R.bgWhite, { opacity: 1 - P(b, 8.0, 8.5) });
    R.bgPhoto.style.opacity = 0.16 * P(b, 11, 13);
    R.bgGrad.style.opacity = P(b, 39.7, 39.95);
    R.vignette.style.opacity = lerp(0.15, 0.7, P(b, 8, 9)) * (1 - 0.5 * P(b, 40, 41));
    // white flash: drop (8) and the final dissolve into the gradient (39.4 -> 40 -> 40.6)
    const fl = Math.max(0.85 * (1 - E.outCubic(P(b, 8.0, 8.7))) * (b >= 8 ? 1 : 0),
      E.inCubic(P(b, 39.3, 39.9)) * (1 - E.outCubic(P(b, 39.95, 40.7))));
    R.flash.style.opacity = fl;
    // light leaks
    const leakBase = 0.35 * P(b, 8, 9) * (1 - P(b, 39.5, 40));
    const leakHit = Math.max(1 - P(b, 8, 9.5), 0) * (b >= 8 ? 0.6 : 0) + (b >= 28 ? 0.55 * (1 - P(b, 28, 29.8)) : 0) + (b >= 40 ? 0.5 * (1 - P(b, 40, 43)) + 0.2 : 0);
    set(R.leakA, { opacity: leakBase + leakHit, transform: `translate(${Math.sin(b * 0.21) * 520 + 200}px,${Math.cos(b * 0.17) * 380 - 260}px) scale(${1 + 0.2 * Math.sin(b * 0.3)})` });
    set(R.leakB, { opacity: leakBase * 0.9 + leakHit * 0.7, transform: `translate(${Math.cos(b * 0.19) * 560 - 260}px,${Math.sin(b * 0.23) * 420 + 260}px)` });
    const bloom = (b >= 8 ? 0.7 * (1 - E.outCubic(P(b, 8, 9))) : 0) + (b >= 28 ? 0.45 * (1 - E.outCubic(P(b, 28, 29))) : 0) + (b >= 40 ? 0.55 * (1 - E.outCubic(P(b, 40, 41.5))) : 0);
    set(R.leakC, { opacity: bloom, transform: `scale(${0.7 + 0.5 * bloom})` });

    /* ---------- global camera: slow push + float ---------- */
    const push = 1 + 0.0024 * Math.min(b, 40) - 0.0024 * 40 * P(b, 39.6, 40.2);
    cam.style.transform = `translate(${Math.sin(b * 0.31) * 4}px,${Math.cos(b * 0.27) * 3}px) scale(${push})`;

    /* ---------- phone rig ---------- */
    const r0 = rigAt(b), r1 = rigAt(b - (1 / 120) / BEAT);
    rig.style.transform = rigTransform(r0);
    rig.style.opacity = r0.o;
    rig.style.visibility = r0.o < 0.002 ? 'hidden' : 'visible';
    const vx = Math.abs(r0.x - r1.x), vy = Math.abs(r0.y - r1.y);
    const mb = [Math.min(16, vx * 0.2), Math.min(12, vy * 0.2)];
    mbRigBlur.setAttribute('stdDeviation', `${mb[0]} ${mb[1]}`);
    const dof = r0.dim * 3.2;
    rig.style.filter = [(mb[0] + mb[1] > 0.3 ? 'url(#mbRig)' : ''), dof > 0.05 ? `blur(${dof}px) brightness(${1 - r0.dim * 0.08})` : ''].join(' ').trim() || 'none';
    rig.style.zIndex = 2;

    /* ---------- stars & moon (inside the screen) ---------- */
    sctx.clearRect(0, 0, 780, 1688);
    for (const s of STARS) {
      const y = (s.y + b * 4 * s.sp) % 1688, a = s.a * (0.6 + 0.4 * Math.sin(b * s.sp + s.ph));
      sctx.globalAlpha = a; sctx.fillStyle = '#fff'; sctx.beginPath(); sctx.arc(s.x, y, s.s, 0, 6.283); sctx.fill();
    }

    /* ---------- screens: visibility + whip transitions ---------- */
    for (const s of SCREENS) {
      const pin = s.i < 0 ? 1 : P(b, s.i - 0.08, s.i + 0.1), pout = P(b, s.o - 0.12, s.o + 0.06);
      const vis = b >= s.i - 0.08 && b < s.o + 0.06;
      s.el.style.visibility = vis ? 'visible' : 'hidden';
      if (!vis) continue;
      const xin = s.i < 0 ? 0 : -s.d * 150 * (1 - E.outExpo(P(b, s.i - 0.08, s.i + 0.45)));
      const xout = -s.dOut * 110 * E.inCubic(pout);
      s.el.style.transform = `translateX(${xin + xout}px)`;
      s.el.style.opacity = Math.min(E.outCubic(pin), 1 - pout);
    }

    /* ---------- tab bar ---------- */
    {
      let i = 0; while (i < TABS.length - 1 && b >= TABS[i + 1][0]) i++;
      const [tb, a1] = TABS[i], a0 = i > 0 ? TABS[i - 1][1] : a1;
      const p = E.spring(P(b, tb - 0.05, tb + 0.55));
      const show0 = a0 != null ? 1 : 0, show1 = a1 != null ? 1 : 0;
      const show = lerp(show0, show1, E.outCubic(P(b, tb - 0.05, tb + 0.3)));
      const tbEl = document.getElementById('tabbar');
      tbEl.style.transform = `translateY(${(1 - show) * 120}px)`; tbEl.style.opacity = show;
      const la = tabLayout(a0 ?? a1), lb = tabLayout(a1 ?? a0);
      const A = a1 ?? a0;
      tabEls.forEach((el, k) => {
        const x = lerp(la[k].x, lb[k].x, p), w = lerp(la[k].w, lb[k].w, p);
        el.style.left = (x + w / 2 - 23) + 'px';
        const activeness = lerp(k === (a0 ?? a1) ? 1 : 0, k === A ? 1 : 0, clamp(p));
        el.style.opacity = 1 - activeness;
      });
      const px = lerp(la[a0 ?? a1].x, lb[A].x, p), pw = lerp(la[a0 ?? a1].w, lb[A].w, p);
      set(pill, { left: px + 'px', width: pw + 'px' });
      const lab = p < 0.5 && a0 != null ? a0 : A;
      if (pillLabel.textContent !== LABELS[lab]) { pillLabel.textContent = LABELS[lab]; pillIcon.innerHTML = svg(ICONS[lab], 20, 2); }
      pillLabel.parentElement.style.color = `rgba(11,11,18,${0.35 + 0.65 * Math.abs(p - 0.5) * 2})`;
      // badge: approvals waiting
      const taps = [26.5, 27, 27.5, 28].filter(x => b >= x).length;
      const count = b < 26 ? 3 : 4 - taps;
      badge.textContent = count; badge.style.display = lab === 0 && count > 0 ? 'block' : 'none';
    }

    /* ---------- 0–8: home, typing ---------- */
    {
      const n = TL.keyBeats.filter(k => k <= b).length;
      const sent = b >= 7;
      R.typed.textContent = TL.prompt.slice(0, n);
      R.ph.style.display = n === 0 ? 'inline' : 'none';
      const typingNow = n > 0 && n < TL.prompt.length;
      R.caret.style.opacity = sent ? 0 : typingNow || (b > 1.2 && Math.floor(b * 2.0) % 2 === 0) ? 1 : (b < 1.2 ? 0 : 0);
      const fly = E.inOut(P(b, 7.0, 7.4));
      set(R.composerTxt, { transform: `translateY(${-40 * fly}px)`, opacity: 1 - fly });
      const press = b >= 7 && b < 7.25 ? 1 - Math.sin(P(b, 7, 7.25) * Math.PI) * 0.15 : 1;
      R.send.style.transform = `scale(${press})`;
      R.glow.style.opacity = Math.max(E.outCubic(P(b, 1.9, 2.4)) * (1 - 0.4 * P(b, 2.4, 3.2)), b >= 6.9 ? 1 - P(b, 7.2, 8) * 0.6 : 0);
      shine(R.composerShine, b, 2.0, 1.2);
    }

    /* ---------- 8–12: the expansion ---------- */
    {
      const on = b >= 8 && b < 12.05;
      tilesEl.style.visibility = on ? 'visible' : 'hidden';
      tilesEl.style.zIndex = 3;
      if (on) {
        const grow = 1 + 0.1 * E.inOut(P(b, 8.6, 10.6));
        const out = E.inOut(P(b, 10.35, 11.2));          // non-hero tiles leave
        const heroGrow = E.outExpo(P(b, 9.0, 9.6));
        const sw = 390 * S * 0.97, sh = 844 * S * 0.97;
        for (const tt of TILES) {
          const e = E.outExpo(P(b, 8.0 + tt.dist * 0.025, 8.75 + tt.dist * 0.04));
          const depth = 1 + 0.12 * tt.z;
          const cx0 = tt.col * (sw / 7.4), cy0 = Y + tt.row * (sh / 7.4), s0 = 50 * S / 300;
          let cx = (tt.col * 334 + tt.jx) * depth * grow, cy = Y * 0.3 + (tt.row * 334 + tt.jy) * depth * grow;
          let sz = depth * grow, rot = tt.rot * (1 - 0.5 * P(b, 8.5, 10)) - 1.5 * P(b, 8.6, 10.6);
          let x = lerp(cx0, cx, e), y = lerp(cy0, cy, e), sc = lerp(s0, sz, e);
          if (!tt.center) {
            x *= 1 + 0.9 * out; y *= 1 + 0.9 * out;
            const rack = 0.5 + 0.5 * Math.sin(b * 2.4 + tt.ph);
            const blur = (Math.abs(tt.z) * 4 + rack * 5) * e + 8 * out + 2.5 * heroGrow;
            set(tt.el, { width: '300px', height: '300px', transform: `translate(${x - 150}px,${y - 150}px) rotate(${rot}deg) scale(${sc})`,
              filter: `blur(${blur.toFixed(2)}px) brightness(${1 - 0.25 * heroGrow})`, opacity: 1 - out, zIndex: 1 });
          } else {
            // hero tile: grows (9), becomes the map + pin (10), locks as hero (10.5), flies into the app (11->12)
            sc *= 1 + 0.55 * heroGrow + 0.2 * E.outExpo(P(b, 10.5, 11));
            const fly = E.inOut(P(b, 11.0, 12.0));
            const w0 = 300 * sc, h0 = 300 * sc;
            const w = lerp(w0, HERO_DST.w, fly), h = lerp(h0, HERO_DST.h, fly);
            const fx = lerp(x, HERO_DST.x, fly), fy = lerp(y, HERO_DST.y, fly);
            set(tt.el, { width: w + 'px', height: h + 'px', transform: `translate(${fx - w / 2}px,${fy - h / 2}px) rotate(${rot * (1 - fly) * (1 - heroGrow)}deg)`,
              borderRadius: lerp(26, 20 * S, fly) + 'px', filter: 'none', opacity: 1, zIndex: 5 });
            const mapOn = E.outCubic(P(b, 9.0, 9.35)) * (1 - E.inOut(P(b, 10.5, 10.75)));
            R.mapLayer.style.opacity = mapOn;
            R.heroPhoto.style.filter = `blur(${(10 * (1 - E.outCubic(P(b, 10.55, 10.9))) * (b > 10.4 ? 1 : 0)).toFixed(2)}px)`;
            // pin drops onto the map, landing exactly on beat 10
            const fall = E.inCubic(P(b, 9.55, 10.0));
            const sq = b >= 10 ? Math.sin(P(b, 10, 10.3) * Math.PI) * 0.18 : 0;
            set(R.pin, { transform: `translateY(${-160 * (1 - fall)}px) scale(${1 + sq * 0.5},${1 - sq})`, opacity: P(b, 9.5, 9.6) });
            const rp = P(b, 10, 10.9);
            set(R.pinRipple, { transform: `scale(${1 + rp * 6})`, opacity: b >= 10 ? (1 - rp) * 0.9 : 0 });
            set(R.pinLabel, { opacity: E.outCubic(P(b, 10, 10.2)), transform: `translate(-50%,${18 + 12 * (1 - E.spring(P(b, 10, 10.6)))}px) scale(${0.85 + 0.15 * E.spring(P(b, 10, 10.6))})` });
          }
        }
      }
    }

    /* ---------- 11–16: listing brief ---------- */
    {
      const heroLanded = b >= 12.0;
      briefPhoto.style.opacity = (b < 12.0 || b >= 15.95) ? 0 : 1;
      R.kb.style.transform = `scale(${1 + 0.07 * P(b, 12, 16)}) translateX(${-2 * P(b, 12, 16)}%)`;
      const ring = E.outCubic(P(b, 12, 15));
      R.ringArc.setAttribute('stroke-dasharray', `${119.4}`);
      R.ringArc.setAttribute('stroke-dashoffset', `${119.4 * (1 - ring)}`);
      R.ringPct.textContent = Math.round(ring * 100) + '%';
      const done = E.outBack(P(b, 15, 15.3));
      R.ring.style.transform = `scale(${1 + 0.15 * Math.sin(P(b, 15, 15.4) * Math.PI)})`;
      R.ring.style.filter = b >= 15 ? `drop-shadow(0 0 ${10 * (1 - P(b, 15, 16))}px rgba(166,140,255,.9))` : 'none';
      R.brows.forEach((row, i) => {
        const b0 = 12.5 + i * 0.5;
        const p = E.outExpo(P(b, b0, b0 + 0.5));
        set(row, { opacity: p, transform: `translateY(${(1 - p) * 14}px)`, clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` });
        setChk(row.querySelector('.chk'), P(b, b0 + 0.15, b0 + 0.5));
      });
      const bp = E.spring(P(b, 14.5, 15.2));
      set(R.bbtns, { opacity: clamp(bp), transform: `translateY(${(1 - bp) * 16}px)` });
      shine(R.briefShine, b, 15.0, 0.9);
      void heroLanded; void done;
    }

    /* ---------- 16–20.5: carousel (world space) ---------- */
    {
      const on = b >= 15.95 && b < 20.6;
      R.fan.style.visibility = on ? 'visible' : 'hidden';
      R.fan.style.zIndex = 4;
      if (on) {
        const FS = L.FS, FY = L.FY, D = 384 * FS;
        const morph = E.outExpo(P(b, 15.95, 16.6));
        const spread = [0, E.spring(P(b, 16.05, 16.9)), E.spring(P(b, 16.15, 17.0))];
        const strip = E.inOut(P(b, 17.0, 17.6));
        const k = E.outExpo(P(b, 18.0, 18.5)) + E.outExpo(P(b, 19.0, 19.5));
        const exit = E.inOut(P(b, 19.92, 20.45));
        const fanPos = [{ x: 0, y: 0, r: 0 }, { x: 250 * FS, y: 22, r: 7 }, { x: 455 * FS, y: 64, r: 14 }];
        const fanVel = Math.abs(E.outExpo(P(b, 18.0, 18.5)) - E.outExpo(P(b - 0.0189, 18.0, 18.5))) + Math.abs(E.outExpo(P(b, 19.0, 19.5)) - E.outExpo(P(b - 0.0189, 19.0, 19.5)));
        mbFanBlur.setAttribute('stdDeviation', `${Math.min(14, fanVel * D * 0.2)} 0`);
        R.slides.forEach((el, i) => {
          // fan -> strip -> swipe
          const fx = lerp(0, fanPos[i].x, spread[i]), fy = lerp(0, fanPos[i].y, spread[i]), fr = lerp(0, fanPos[i].r, spread[i]);
          const sx = (i - k) * D, focus = clamp(1 - Math.abs(i - k));
          let x = lerp(fx, sx, strip), y = lerp(fy, 0, strip) + FY, rot = lerp(fr, 0, strip);
          let sc = FS * lerp(i === 0 ? 1 : 0.92, lerp(0.86, 1, focus), strip);
          let op = i === 0 ? 1 : clamp(spread[i] * 3) * lerp(1, lerp(0.55, 1, focus), strip);
          let clip = 'none', radius = 26;
          if (i === 0 && morph < 1) {
            // shared element: the brief photo becomes slide 1
            const fullW = 344 * FS, fullH = 430 * FS;
            const w = lerp(FAN_SRC.w, fullW, morph), h = lerp(FAN_SRC.h, fullH, morph);
            const s2 = w / 344;
            x = lerp(FAN_SRC.x, x, morph); y = lerp(FAN_SRC.y, y, morph); sc = s2;
            const insetY = Math.max(0, (430 - h / s2) / 2);
            clip = `inset(${insetY}px 0 ${insetY}px 0 round ${lerp(20 * S / s2, 26, morph)}px)`;
          }
          if (exit > 0) {
            if (i === 2) {     // CTA slide becomes the email banner
              const w = lerp(344 * sc, BANNER_DST.w, exit), h = lerp(430 * sc, BANNER_DST.h, exit), s2 = w / 344;
              x = lerp(x, BANNER_DST.x, exit); y = lerp(y, BANNER_DST.y, exit); sc = s2;
              const insetY = Math.max(0, (430 - h / s2) / 2);
              clip = `inset(${insetY}px 0 ${insetY}px 0 round ${18 * S / s2}px)`;
              op = b > 20.4 ? 1 - P(b, 20.4, 20.55) : 1;
            } else { x -= exit * 700 * FS; op *= 1 - exit; }
          }
          const z = i === 2 && exit > 0 ? 10 : Math.round(10 - Math.abs(lerp(i === 0 ? -1 : i, i - k, strip)) * 3);
          set(el, { transform: `translate(${x}px,${y}px) rotate(${rot}deg) scale(${sc})`, opacity: op, zIndex: z, clipPath: clip,
            filter: fanVel > 0.002 ? 'url(#mbFan)' : 'none' });
        });
        // slide text fades in once the morph is done, and out as slide 3 becomes the banner
        const txt = E.outCubic(P(b, 16.35, 16.7));
        R.content.forEach(el => { el.style.opacity = el.closest('#sl2') ? txt * (1 - P(b, 19.95, 20.15)) : txt; });
        const dk = Math.round(k);
        R.dots.forEach((d, i) => { d.style.width = (i === dk ? 22 : 8) + 'px'; d.style.background = i === dk ? 'rgba(11,11,18,.75)' : 'rgba(11,11,18,.22)'; });
        set(R.dotsEl, { transform: `translate(-50%,${FY + 430 * FS / 2 + 30}px)`, opacity: strip * (1 - exit) });
      }
    }

    /* ---------- 20–23: email ---------- */
    {
      emailBanner.style.opacity = b >= 20.45 ? 1 : 0;
      const n = Math.floor(EMAIL.length * P(b, TL.emailType[0], TL.emailType[1]));
      const caretOn = b < TL.emailType[1] || Math.floor(b * 2) % 2 === 0;
      R.emailBody.innerHTML = EMAIL.slice(0, n).replace(/&/g, '&amp;').replace(/</g, '&lt;') + (b < 22.6 && caretOn ? '<span class="ecaret"></span>' : '');
      const sp = E.outExpo(P(b, 22.35, 22.8));
      set(R.sig, { opacity: sp, transform: `translateY(${(1 - sp) * 10}px)` });
      const bp = E.spring(P(b, 22.5, 23.1));
      const press = b >= 22.75 && b < 22.95 ? 1 - 0.05 * Math.sin(P(b, 22.75, 22.95) * Math.PI) : 1;
      set(R.openMail, { opacity: clamp(bp * 2), transform: `translateY(${(1 - bp) * 30}px) scale(${press})` });
      shine(R.emailShine, b, 20.4, 1.0);
    }

    /* ---------- 23–26: text follow-ups ---------- */
    R.tcards.forEach((c, i) => {
      const b0 = 23.0 + i * 0.75, p = E.spring(P(b, b0, b0 + 0.7));
      set(c, { opacity: clamp(P(b, b0, b0 + 0.15)), transform: `translateY(${(1 - p) * 40}px) scale(${0.94 + 0.06 * p})` });
      const q = E.outBack(P(b, 25.0 + i * 0.12, 25.35 + i * 0.12));
      set(R.queued[i], { opacity: clamp(q * 2), transform: `scale(${0.6 + 0.4 * q})` });
    });

    /* ---------- 26–30: approvals ---------- */
    {
      const T = [26.5, 27, 27.5, 28];
      R.acards.forEach((c, i) => {
        const enter = E.spring(P(b, 26.0 + i * 0.08, 26.7 + i * 0.08));
        let shift = 0; for (let j = 0; j < i; j++) shift += 112 * E.spring(P(b, T[j] + 0.18, T[j] + 0.7));
        const sweep = E.outExpo(P(b, T[i] + 0.15, T[i] + 0.55));
        set(c, { top: (152 + i * 112 - shift) + 'px', opacity: clamp(P(b, 26 + i * 0.08, 26.2 + i * 0.08)) * (1 - P(b, T[i] + 0.25, T[i] + 0.5)),
          transform: `translate(${sweep * 420}px,${(1 - enter) * 60}px) rotate(${sweep * 7}deg)` });
        const btn = c.querySelector('.ab'), lbl = btn.querySelector('.lbl'), ck = btn.querySelector('svg');
        const fill = E.outCubic(P(b, T[i], T[i] + 0.1));
        const press = b >= T[i] && b < T[i] + 0.15 ? 1 - 0.1 * Math.sin(P(b, T[i], T[i] + 0.15) * Math.PI) : 1;
        set(btn, { background: `rgba(255,255,255,${fill})`, transform: `scale(${press})`, boxShadow: fill > 0 ? `0 0 ${24 * (1 - P(b, T[i], T[i] + 0.6))}px rgba(166,140,255,.9)` : 'none' });
        lbl.style.opacity = 1 - fill;
        const path = ck.querySelector('path'); path.setAttribute('stroke-dasharray', '22'); path.setAttribute('stroke-dashoffset', 22 * (1 - E.outCubic(P(b, T[i] + 0.02, T[i] + 0.2))));
        ck.style.opacity = fill;
      });
      const cnt = 4 - T.filter(x => b >= x).length;
      R.apCount.textContent = cnt; R.apCount.style.opacity = cnt > 0 ? 1 : 1 - P(b, 28, 28.2);
      R.apCount.style.transform = `scale(${1 + 0.25 * Math.max(0, ...T.map(x => (b >= x && b < x + 0.2) ? Math.sin(P(b, x, x + 0.2) * Math.PI) : 0))})`;
      const tp = (b >= 26.25 && b < 28.45) ? Math.min(P(b, 26.25, 26.4), 1 - P(b, 28.25, 28.45)) : 0;
      const pr = Math.max(0, ...T.map(x => (b >= x - 0.05 && b < x + 0.12) ? Math.sin(P(b, x - 0.05, x + 0.12) * Math.PI) : 0));
      set(R.touch, { left: '318px', top: '201px', opacity: tp * 0.95, transform: `scale(${1 - 0.22 * pr})` });
      const ripple = Math.max(0, ...T.map(x => b >= x ? 1 - P(b, x, x + 0.45) : 0));
      const rs = T.map(x => P(b, x, x + 0.45)).find((v, i) => b >= T[i] && v < 1) ?? 1;
      set(R.touchRing, { left: '318px', top: '201px', opacity: tp * ripple * 0.9, transform: `scale(${1 + rs * 1.6})` });
      const ac = E.spring(P(b, 28.4, 29.1));
      set(R.allClear, { opacity: clamp(ac * 1.5), transform: `translateY(${(1 - ac) * 24}px) scale(${0.9 + 0.1 * ac})` });
    }

    /* ---------- 30–33: calendar ---------- */
    {
      const d = E.spring(P(b, 30.0, 30.8));
      set(R.ohCard, { opacity: clamp(P(b, 30, 30.12)), transform: `translateY(${(1 - d) * -150}px) scale(${1.06 - 0.06 * d})` });
      const dotB = [null, null, 31.0, 31.5, 32.0, 32.5, 30.35];
      R.dts.forEach((el, i) => { const p = dotB[i] == null ? 0 : E.outBack(P(b, dotB[i], dotB[i] + 0.3)); set(el, { opacity: clamp(p * 2), transform: `scale(${p})` }); });
      R.ags.forEach((el, i) => { const b0 = 31 + i * 0.5, p = E.spring(P(b, b0, b0 + 0.6)); set(el, { opacity: clamp(P(b, b0, b0 + 0.15)), transform: `translateX(${(1 - p) * 60}px)` }); });
      R.cShow.textContent = Math.round(3 * E.outCubic(P(b, 30.5, 32.5)));
      R.cTask.textContent = Math.round(12 * E.outCubic(P(b, 30.5, 32.7)));
      R.cOH.textContent = b >= 30.35 ? 1 : 0;
    }

    /* ---------- 33–36: pipeline ---------- */
    {
      const slide = E.inOut(P(b, 33.2, 35.3));
      R.strip.style.transform = `translateX(${-260 * 1.6 * slide}px)`;
      R.pcs.forEach((el, i) => { const p = E.spring(P(b, 33 + i * 0.08, 33.7 + i * 0.08)); set(el, { opacity: clamp(p * 2), transform: `translateX(${(1 - p) * 70}px)` }); });
      R.chipTour.classList.toggle('on', b >= 34);
      const a = E.spring(P(b, 35.0, 35.7));
      set(R.answer, { opacity: clamp(P(b, 35, 35.15)), transform: `translateY(${(1 - a) * 90}px)` });
      shine(R.answerShine, b, 35.2, 0.8);
    }

    /* ---------- 36–40: prep + "what am I forgetting" ---------- */
    {
      const a = E.spring(P(b, 36.0, 36.7)), bb = E.spring(P(b, 38.0, 38.7));
      set(R.prepA, { opacity: clamp(P(b, 36, 36.15)), transform: `translateY(${(1 - a) * 60}px) scale(${0.96 + 0.04 * a})` });
      set(R.prepB, { opacity: clamp(P(b, 38, 38.15)), transform: `translateY(${(1 - bb) * 70}px) scale(${0.96 + 0.04 * bb})` });
      const CB = [36.5, 37, 37.5, 38.5, 39, 39.25];
      R.prepChk.forEach((el, i) => setChk(el, P(b, CB[i], CB[i] + 0.3)));
      R.prepBg.forEach((el, i) => (el.style.transform = `scale(${1.02 + 0.05 * P(b, 36 + i * 2, 40)})`));
    }

    /* ---------- particles ---------- */
    {
      const pr = rigAt(28);
      const ox = pr.x + (318 + 11 - 206) * pr.s, oy = pr.y + (201 + 11 - 433) * pr.s;
      for (const p of PARTS) {
        let x, y, a = 0, sc = 1;
        if (p.group === 'approve') {
          const tt = (b - 28) * BEAT;
          if (tt >= 0 && tt < p.life) {
            x = ox + Math.cos(p.a) * p.v * tt; y = oy + Math.sin(p.a) * p.v * tt + 520 * tt * tt;
            a = (1 - tt / p.life) * (0.6 + 0.4 * Math.sin(tt * 30 + p.tw)); sc = 1 - 0.5 * tt / p.life;
          }
        } else {
          const tt = (b - 40) * BEAT;
          if (tt >= 0) {
            x = p.ox; y = -170 + p.oy - 40 * tt;
            a = Math.min(1, tt * 3) * (1 - clamp((tt - 1.2) / 0.9)) * (0.4 + 0.6 * Math.abs(Math.sin(tt * 4 + p.tw)));
            sc = 0.6;
          }
        }
        if (a > 0.002) set(p.el, { opacity: a, transform: `translate(${x}px,${y}px) scale(${sc})` }); else p.el.style.opacity = 0;
      }
      partsEl.style.zIndex = 6;
    }

    /* ---------- kinetic words ---------- */
    wordsEl.style.transform = `translate(${-Math.sin(b * 0.31) * 6}px,${-Math.cos(b * 0.27) * 4}px)`;
    for (const w of WORDS) {
      const vis = b >= Math.min(w.subAt ?? 99, w.at[0]) - 0.05 && b < w.out + 0.45;
      w.el.style.visibility = vis ? 'visible' : 'hidden';
      if (!vis) continue;
      w.spans.forEach((s, j) => reveal(s, b, w.at[j], w.out));
      w.subSpans.forEach((s, j) => reveal(s, b, w.subAt + j * 0.12, w.out));
      const glow = b >= w.at[0] ? 1 - P(b, w.at[0], w.at[0] + 1.2) : 0;
      w.el.style.textShadow = `0 0 ${30 + glow * 30}px rgba(255,255,255,${0.55 + glow * 0.4})`;
    }

    /* ---------- 40–46: end card ---------- */
    {
      const on = b >= 39.9;
      R.endcard.style.visibility = on ? 'visible' : 'hidden';
      if (on) {
        const k = FORMAT === 'portrait' ? 1.12 : 1;
        R.endcard.style.transform = `scale(${k})`;
        const p = E.outExpo(P(b, 40, 41.3));
        const glow = 1 - P(b, 40, 42.5);
        set(R.wordmark, { top: '-330px', opacity: E.outCubic(P(b, 40, 40.35)), transform: `translateX(-50%) scale(${0.82 + 0.18 * p})`,
          filter: `blur(${(1 - E.outCubic(P(b, 40, 40.7))) * 14}px)`, textShadow: `0 0 ${40 + 60 * glow}px rgba(255,255,255,${0.35 + 0.5 * glow})` });
        set(R.tagline, { top: '-62px' });
        reveal(R.tagSpan, b, 41, 999, 0.8);
        set(R.cta, { top: '40px', textShadow: `0 0 ${24 + 30 * (1 - P(b, 42, 43.5))}px rgba(255,255,255,${0.3 + 0.35 * (1 - P(b, 42, 43.5))})` });
        R.ctaSpans.forEach((s, j) => reveal(s, b, 42 + j * 0.5, 999, 0.75));
      }
    }

    /* ---------- grain ---------- */
    const fi = frozen ? 0 : Math.floor(t * 60);
    const nz = NOISE[fi % NOISE.length], ox = (fi * 137) % 540, oy = (fi * 251) % 540;
    gctx.drawImage(nz, -ox, -oy); gctx.drawImage(nz, 540 - ox, -oy); gctx.drawImage(nz, -ox, 540 - oy); gctx.drawImage(nz, 540 - ox, 540 - oy);
    grain.style.opacity = b < 8 ? 0.2 : 0.34;
  }

  /* ------------------------------------------------------------ boot */
  window.renderFrame = render;
  window.DURATION = DUR;
  window.FORMAT_SIZE = [L.W, L.H];
  // warm-up pass so every photo and font is decoded before the first captured frame
  for (const tw of [0, 3, 8.5, 9.5, 10.6, 12.5, 16.8, 18.3, 21, 24, 27, 31, 34, 37, 41, 44]) render(tw * BEAT);
  render(0);
  window.__ready = true;

  if (!RENDER) {
    const aud = $('#aud'), pp = $('#pp'), scrub = $('#scrub'), tc = $('#tc');
    scrub.max = DUR;
    let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (aud.currentTime >= DUR - 0.05) aud.currentTime = 0; aud.play(); } else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; render(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; render(t); scrub.value = t; tc.textContent = t.toFixed(2) + 's'; if (t >= DUR) { playing = false; pp.textContent = 'Play'; } } requestAnimationFrame(loop); };
    loop();
  }
})();
