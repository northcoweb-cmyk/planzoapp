/* East Coast Hockey & Skating Supply — "New gear just dropped."
 * render(t) is a pure function of time; cues are beats of the original 140 BPM track.
 * Hook b0 · slams b2 · teasers b4 · gap b7.75 · DROP A sticks b8 · slap b14 · lockup b16 · skates teaser b20
 * · hockey-stop wipe b23.5 · DROP B skates b24 · both b32 · figure skating b36 · logo b40 · hold b45.5
 */
(async function () {
  const TL = await (await fetch('timeline.json')).json();
  const BEAT = TL.beat, DUR = TL.duration, HOLD = 45.5;
  const qs = new URLSearchParams(location.search), RENDER = qs.has('render'), FORMAT = qs.get('format') || 'feed';
  if (RENDER) document.body.classList.add('render');
  const SIZES = { square: [1080, 1080, 1], feed: [1080, 1350, 1.04], portrait: [1080, 1920, 1.1] };
  const [W, H, SK] = SIZES[FORMAT] || SIZES.feed;
  const vp = document.getElementById('viewport'); vp.style.width = W + 'px'; vp.style.height = H + 'px';
  document.getElementById('stage').style.transform = `scale(${SK})`;
  if (!RENDER) { const fit = () => { const k = Math.min(innerWidth / W, (innerHeight - 60) / H); vp.style.transformOrigin = '0 0'; vp.style.transform = `translate(${(innerWidth - W * k) / 2}px,0) scale(${k})`; }; fit(); addEventListener('resize', fit); }

  /* ---------------------------------------------------------------- helpers */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, p) => a + (b - a) * p, P = (b, b0, b1) => clamp((b - b0) / (b1 - b0));
  const E = {
    outExpo: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)), inExpo: p => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10)),
    inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2), outCubic: p => 1 - Math.pow(1 - p, 3), inCubic: p => p * p * p,
    outBack: p => { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    spring: p => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-6.2 * p) * Math.cos(9.5 * p)),
  };
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const set = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const vis = (el, on) => { el.style.visibility = on ? 'inherit' : 'hidden'; };
  const inR = (b, a, c) => b >= a && b < c;

  /* ---------------------------------------------------------------- ice texture (procedural skate scratches) */
  {
    const c = $('#scratch'), x = c.getContext('2d'), r = rng(8);
    x.lineCap = 'round';
    for (let i = 0; i < 420; i++) {
      const cx = r() * 1080, cy = r() * 1920, rad = 80 + r() * 900, a0 = r() * 6.28, len = 0.08 + r() * 0.5;
      x.strokeStyle = `rgba(${150 + r() * 60},${180 + r() * 40},${205 + r() * 30},${0.12 + r() * 0.3})`; x.lineWidth = 0.5 + r() * 1.6;
      x.beginPath(); x.arc(cx, cy, rad, a0, a0 + len); x.stroke();
    }
  }
  /* rink markings */
  $('#rink').innerHTML = `<svg width="1080" height="1080" style="position:absolute;left:0;top:0">
    <g id="rinkG" opacity=".33">
      <rect x="-200" y="972" width="1480" height="20" fill="#e1202f"/>
      <rect x="-200" y="96" width="1480" height="26" fill="#2f5fb3" opacity=".8"/>
      <g id="fo" transform="translate(540 560)">
        <circle r="330" fill="none" stroke="#e1202f" stroke-width="10"/>
        <circle r="18" fill="#e1202f"/>
        <path d="M-120 -330v-40M120 -330v-40M-120 330v40M120 330v40" stroke="#e1202f" stroke-width="10"/>
        <path d="M-60 -30h-50v-40M60 -30h50v-40M-60 30h-50v40M60 30h50v40" fill="none" stroke="#e1202f" stroke-width="6"/>
      </g>
    </g></svg>`;

  /* ---------------------------------------------------------------- products */
  const IMG = { su: ['stick_unleashed', 1260, 1268], sj: ['stick_jetspeed', 1155, 171], sb: ['skate_bauer', 598, 651], sc: ['skate_ccm', 493, 580] };
  function prod(key, extraClass = '') {
    const [f, w, h] = IMG[key], el = document.createElement('div'); el.className = 'prod ' + extraClass;
    el.innerHTML = `<img src="assets/img/${f}.png"><div class="sweep" style="-webkit-mask-image:url(assets/img/${f}.png);mask-image:url(assets/img/${f}.png)"></div>`;
    $('#prods').appendChild(el); return { el, sw: el.querySelector('.sweep'), w, h };
  }
  const P_ = { su: prod('su'), sj: prod('sj'), su2: prod('su'), sj2: prod('sj'), tSU: prod('su'), tSB: prod('sb'), tSJ: prod('sj'), tSC: prod('sc'), sb: prod('sb'), sc: prod('sc'), sb2: prod('sb'), sc2: prod('sc'), blade: prod('sb') };
  // place a product by centre, display width, rotation (deg), scale; optional pivot
  function place(p, cx, cy, w, rot = 0, s = 1, o = 1, blur = 0, origin = '50% 50%') {
    const h = w * p.h / p.w;
    set(p.el, { width: w + 'px', height: h + 'px', transformOrigin: origin, transform: `translate(${cx - w / 2}px,${cy - h / 2}px) rotate(${rot}deg) scale(${s})`, opacity: o, filter: blur > 0.2 ? `blur(${blur}px) drop-shadow(0 30px 30px rgba(10,20,50,.35))` : 'drop-shadow(0 30px 30px rgba(10,20,50,.35))' });
  }
  const sweep = (p, b, b0, dur = 0.8) => { const q = P(b, b0, b0 + dur); p.sw.style.backgroundPosition = `${lerp(160, -60, E.inOut(q))}% 0`; p.sw.style.opacity = q > 0 && q < 1 ? 1 : 0; };

  /* ---------------------------------------------------------------- type */
  const T = [];
  function slam(lines, at, out, x, y, fs, color, opts = {}) {
    const el = document.createElement('div'); el.className = 'slam';
    el.innerHTML = lines.map(([t, c]) => `<span class="l" style="color:${c || color}">${t}</span>`).join('');
    set(el, { left: x + 'px', top: y + 'px', fontSize: fs + 'px', textAlign: opts.center ? 'center' : 'left' });
    $('#type').appendChild(el); const o = { el, at, out, center: opts.center, maxW: opts.maxW || 900, fs, shadow: opts.shadow, stagger: opts.stagger }; T.push(o); return o;
  }
  const NAVY = '#16255a', RED = '#e1202f', WHITE = '#ffffff', ICEB = '#bfe3f7';
  // b2: NEW GEAR JUST DROPPED (one word per half beat)
  const S_new = [slam([['NEW']], 2, 4, 540, 300, 190, WHITE, { center: true }), slam([['GEAR']], 2.5, 4, 540, 455, 190, WHITE, { center: true }),
    slam([['JUST']], 3, 4, 540, 610, 190, WHITE, { center: true }), slam([['DROPPED.']], 3.5, 4, 540, 765, 190, RED, { center: true })];
  const S_snipe = slam([['SNIPE SEASON.']], 15, 16, 540, 850, 120, NAVY, { center: true });
  const S_ccm = slam([['NEW CCM STICKS']], 16, 20, 540, 165, 104, NAVY, { center: true });
  const S_sk = [slam([['AND']], 20, 21.9, 540, 300, 190, WHITE, { center: true }), slam([['NEW']], 20.5, 21.9, 540, 455, 190, WHITE, { center: true }),
    slam([['SKATES']], 21, 21.9, 540, 610, 190, WHITE, { center: true }), slam([['LANDED.']], 21.5, 21.9, 540, 765, 190, RED, { center: true })];
  const S_both = slam([['NEW SKATES']], 32, 36, 540, 165, 120, NAVY, { center: true });
  const S_fig = [slam([['HOCKEY.']], 36, 40, 540, 330, 180, WHITE, { center: true }), slam([['FIGURE']], 37, 40, 540, 500, 180, ICEB, { center: true }),
    slam([['SKATING.']], 38, 40, 540, 670, 180, WHITE, { center: true }), slam([['EVERYTHING ON ICE.']], 39, 40, 540, 850, 74, RED, { center: true })];
  const S_cta = [slam([['NEW GEAR']], 42, 99, 540, 800, 92, NAVY, { center: true }), slam([['IN STORE NOW']], 42.5, 99, 540, 895, 92, RED, { center: true })];
  // big outline words behind products
  function outline(txt, fs, stroke) { const el = document.createElement('div'); el.className = 'outline'; el.textContent = txt; set(el, { fontSize: fs + 'px', webkitTextStroke: `4px ${stroke}` }); $('#outlines').appendChild(el); return el; }
  const O = { ccm1: outline('CCM', 560, NAVY), bauer: outline('BAUER', 380, NAVY), ccm2: outline('CCM', 560, 'rgba(255,255,255,.9)'), nums: [1, 2, 3, 4].map(n => outline('0' + n, 620, NAVY)) };
  // tags
  function tag(k, nm, bg) { const el = document.createElement('div'); el.className = 'tagc'; el.innerHTML = `<div class="k">${k}</div><div class="n">${nm}</div>`; if (bg) el.style.background = bg; $('#callouts').appendChild(el); return el; }
  function pill(t, bg) { const el = document.createElement('div'); el.className = 'pill'; el.textContent = t; if (bg) el.style.background = bg; $('#callouts').appendChild(el); return el; }
  const TAG = { su: tag('New · CCM', 'UNLEASHED PRO'), sb: tag('New skates', 'BAUER'), sc: tag('New skates', 'CCM', '#e1202f') };
  const PILL = { new1: pill('NEW'), stock1: pill('IN STOCK', NAVY), justin: pill('JUST IN'), store: pill('IN STORE NOW') };
  // stamps
  function stamp(t, sub, fs, rot, c) { const el = document.createElement('div'); el.className = 'stamp'; el.innerHTML = `<div class="box">${t}<div class="sub">${sub}</div></div>`; set(el, { fontSize: fs + 'px', color: c }); $('#stamps').appendChild(el); return { el, rot }; }
  const ST = { stock: stamp('IN STOCK', 'East Coast Hockey', 170, -9, RED) };
  // split-flap "JETSPEED" and "JUST LANDED"
  function makeFlaps(text, x, y) {
    const host = document.createElement('div'); host.className = 'flaps'; set(host, { left: x + 'px', top: y + 'px' }); $('#flapHost').appendChild(host);
    host.innerHTML = [...text].map(ch => `<div class="fc${ch === ' ' ? ' sp' : ''}"><div class="h t s1"><span></span></div><div class="h b s2"><span></span></div><div class="h t fl"><span></span></div><div class="h b fl2"><span></span></div></div>`).join('');
    return { host, text, cells: $$('.fc', host).map(c => ({ s1: c.querySelector('.s1 span'), s2: c.querySelector('.s2 span'), fl: c.querySelector('.fl'), fls: c.querySelector('.fl span'), fl2: c.querySelector('.fl2'), fl2s: c.querySelector('.fl2 span') })) };
  }
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  function renderFlaps(f, b, b0) {   // each cell spins through random glyphs then lands, staggered
    f.cells.forEach((c, k) => {
      const target = f.text[k]; if (target === ' ') { c.s1.textContent = c.s2.textContent = ''; c.fl.style.visibility = c.fl2.style.visibility = 'hidden'; return; }
      const start = b0 + k * 0.06, spins = 5, per = 0.07, tt = b - start;
      const i = clamp(Math.floor(tt / per), 0, spins), p = clamp((tt - i * per) / per);
      const g = j => (j >= spins ? target : GLYPHS[(k * 7 + j * 11) % GLYPHS.length]);
      const from = i === 0 ? ' ' : g(i - 1), to = g(i), done = tt >= spins * per + per;
      c.s1.textContent = done ? target : to; c.s2.textContent = done ? target : (p < 0.5 ? from : to); c.fls.textContent = from; c.fl2s.textContent = to;
      c.fl.style.transform = `rotateX(${-90 * clamp(p * 2)}deg)`; c.fl.style.visibility = !done && p < 0.5 && tt > 0 ? '' : 'hidden';
      c.fl2.style.transform = `rotateX(${90 * (1 - clamp(p * 2 - 1))}deg)`; c.fl2.style.visibility = !done && p >= 0.5 && tt > 0 ? '' : 'hidden';
    });
  }
  const FL = { jet: makeFlaps('JETSPEED', 540 - 8 * 57 / 2, 300), landed: makeFlaps('JUST LANDED', 540 - 11 * 57 / 2, 150) };

  // slashes
  const SL = Array.from({ length: 3 }, () => { const el = document.createElement('div'); el.className = 'slash'; $('#slashes').appendChild(el); return el; });
  // glass cracks (hook)
  {
    const r = rng(77), g = [];
    for (let i = 0; i < 16; i++) {
      let a = (i / 16) * 6.283 + r() * 0.3, x = 540, y = 520, d = `M540 520`;
      for (let s = 0; s < 6; s++) { const L = 60 + r() * 110; a += (r() - 0.5) * 0.5; x += Math.cos(a) * L; y += Math.sin(a) * L; d += `L${x.toFixed(1)} ${y.toFixed(1)}`; }
      g.push(`<path d="${d}" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="${1.5 + r() * 2}" pathLength="1" stroke-dasharray="1" class="ck"/>`);
    }
    for (let k = 0; k < 4; k++) { const rr = 70 + k * 90; let d = ''; for (let i = 0; i <= 24; i++) { const a = i / 24 * 6.283, j = rr * (0.9 + r() * 0.2); d += (i ? 'L' : 'M') + (540 + Math.cos(a) * j).toFixed(1) + ' ' + (520 + Math.sin(a) * j).toFixed(1); } g.push(`<path d="${d}" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.2" pathLength="1" stroke-dasharray="1" class="ck"/>`); }
    $('#cracks').innerHTML = `<g style="filter:drop-shadow(0 0 2px rgba(10,20,50,.8))">${g.join('')}</g>`;
  }
  const CRACKS = $$('#cracks .ck');
  // figure-8 tracing
  $('#flapHost').insertAdjacentHTML('afterend', `<svg id="fig8" class="abs" width="1080" height="1080"><path id="f8" d="M540 540 C 720 360, 960 420, 900 560 C 840 700, 640 660, 540 540 C 440 420, 240 380, 180 520 C 120 680, 360 720, 540 540" fill="none" stroke="#bfe3f7" stroke-width="5" stroke-linecap="round" pathLength="1" stroke-dasharray="1" style="filter:drop-shadow(0 0 10px rgba(191,227,247,.9))"/></svg>`);
  const F8 = $('#f8'), FIG8 = $('#fig8');

  /* ---------------------------------------------------------------- particles (ice spray) */
  const pc = $('#particles'), px = pc.getContext('2d');
  const BURSTS = [
    { b: 0, x: 540, y: 520, n: 160, sp: [500, 1500], ang: [0, 6.283], life: 1.1, sz: [2, 7], g: 300 },
    { b: 8, x: 850, y: 830, n: 120, sp: [300, 1100], ang: [3.4, 5.0], life: 1.0, sz: [2, 6], g: 900 },
    { b: 14, x: 960, y: 520, n: 50, sp: [200, 700], ang: [3.6, 5.6], life: 0.6, sz: [2, 4], g: 600 },
    { b: 23.5, x: -100, y: 620, n: 520, sp: [1400, 3000], ang: [-0.45, 0.25], life: 1.0, sz: [4, 16], g: 400, wipe: true },
    { b: 24, x: 470, y: 840, n: 140, sp: [300, 1200], ang: [3.3, 6.1], life: 1.0, sz: [2, 7], g: 900 },
    { b: 28, x: 470, y: 840, n: 90, sp: [300, 900], ang: [3.3, 6.1], life: 0.8, sz: [2, 6], g: 900 },
    { b: 40, x: 540, y: 600, n: 220, sp: [400, 1600], ang: [3.14, 6.283], life: 1.3, sz: [2, 8], g: 700 },
  ];
  BURSTS.forEach((e, k) => { const r = rng(400 + k); e.p = Array.from({ length: e.n }, () => { const a = lerp(e.ang[0], e.ang[1], r()), s = lerp(e.sp[0], e.sp[1], r()); return { vx: Math.cos(a) * s, vy: Math.sin(a) * s, sz: lerp(e.sz[0], e.sz[1], r()), l: e.life * (0.5 + r() * 0.5), y0: (r() - 0.5) * (e.wipe ? 900 : 30), x0: (r() - 0.5) * (e.wipe ? 300 : 30), c: r() < 0.7 ? '255,255,255' : '191,227,247' }; }); });

  /* ---------------------------------------------------------------- grain */
  const grain = $('#grain'), gctx = grain.getContext('2d'), NOISE = [];
  { const r = rng(99); for (let k = 0; k < 8; k++) { const c = document.createElement('canvas'); c.width = c.height = 540; const x = c.getContext('2d'), id = x.createImageData(540, 540); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 120; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); NOISE.push(c); } }

  /* ---------------------------------------------------------------- assets */
  await document.fonts.load('400 40px "Anton"'); await document.fonts.load('700 16px "Inter"'); await document.fonts.ready;
  await Promise.all([...Object.values(IMG).map(i => `assets/img/${i[0]}.png`), 'assets/img/logo.png'].map(src => new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = src; })));
  T.forEach(o => { const w = o.el.offsetWidth; if (w > o.maxW) o.el.style.fontSize = (o.fs * o.maxW / w) + 'px'; o.W = o.el.offsetWidth; o.H = o.el.offsetHeight; });
  const STW = Object.fromEntries(Object.entries(ST).map(([k, s]) => [k, { w: s.el.offsetWidth, h: s.el.offsetHeight }]));

  const R = { cam: $('#cam'), ice: $('#ice'), navy: $('#navyBg'), red: $('#redBg'), rink: $('#rink'), fo: $('#fo'), logo: $('#logo'), puck: $('#puck'), cracks: $('#cracks'), black: $('#black'), flash: $('#flash'), tagTL: $('#tagTL') };
  const HITS = [[0, 1.4], [2, 0.5], [2.5, 0.5], [3, 0.5], [3.5, 0.7], [4, 0.4], [5, 0.4], [6, 0.4], [7, 0.4], [8, 1.3], [12, 0.8], [14, 0.9], [16, 0.6], [18, 1.0], [20, 0.5], [20.5, 0.5], [21, 0.5], [21.5, 0.7], [24, 1.4], [28, 0.9], [32, 0.7], [36, 0.6], [37, 0.6], [38, 0.6], [40, 1.5], [42, 0.5], [42.5, 0.5]];

  /* ================================================================ RENDER */
  function render(t) {
    const braw = t / BEAT, b = Math.min(braw, HOLD), frozen = braw >= HOLD;

    /* camera: slow push per section + hit shake */
    const secs = [0, 2, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 99];
    let si = 0; while (b >= secs[si + 1]) si++;
    let cs = 1 + 0.06 * E.inOut(P(b, secs[si], secs[si + 1] > 90 ? 46 : secs[si + 1]));
    let cx = Math.sin(b * 0.7) * 3, cy = Math.cos(b * 0.6) * 3, cr = 0;
    for (const [h, a] of HITS) if (b >= h && b < h + 1) { const d = Math.exp(-(b - h) * 8) * a; cx += Math.sin(b * 97) * 18 * d; cy += Math.cos(b * 83) * 18 * d; cr += Math.sin(b * 61) * 0.9 * d; cs *= 1 + 0.04 * d; }
    R.cam.style.transform = `translate(${cx}px,${cy}px) rotate(${cr}deg) scale(${cs})`;

    /* backgrounds (hard cuts on the beat) */
    const iceOn = inR(b, 0, 2) || inR(b, 4, 7.75) || inR(b, 8, 20) || inR(b, 24, 28) || inR(b, 32, 36) || b >= 40;
    const navyOn = inR(b, 2, 4) || inR(b, 20, 24) || inR(b, 28, 32) || inR(b, 36, 40);
    vis(R.ice, iceOn); vis(R.navy, navyOn || !iceOn); vis(R.red, false);
    vis(R.black, inR(b, 7.75, 8));
    vis(R.rink, iceOn);
    $('#rinkG').setAttribute('opacity', b >= 40 ? 0.22 : 0.33);
    R.fo.setAttribute('transform', `translate(540 560) rotate(${b * 4}) scale(${1 + 0.04 * Math.sin(b)})`);
    set(R.tagTL, { color: iceOn ? NAVY : WHITE, opacity: b < 2 || b >= 40 ? 0 : 1 });

    /* ---------- hook b0-2: puck hits the glass, logo slams ---------- */
    const hook = b < 2;
    vis(R.puck, b < 0.35); vis(R.cracks, hook);
    if (b < 0.35) { const p = P(b, 0, 0.35); set(R.puck, { transform: `scale(${lerp(1.15, 0.15, E.outExpo(p))}) rotate(${p * 200}deg)`, opacity: 1 - p, filter: p > 0.05 ? `blur(${p * 6}px)` : 'none' }); }
    if (hook) CRACKS.forEach((c, i) => { c.setAttribute('stroke-dashoffset', 1 - E.outExpo(P(b, 0.02 + (i % 5) * 0.01, 0.3 + (i % 5) * 0.02))); c.style.opacity = 1 - P(b, 1.5, 2); });
    const logoOn = hook || b >= 40;
    vis(R.logo, logoOn);
    if (logoOn) {
      const L0 = b < 2 ? 0 : 40, p = E.outExpo(P(b, L0, L0 + 0.4)), w = b < 2 ? 760 : 660, h = w * 1042 / 1424, cy0 = b < 2 ? 540 : 460;
      set(R.logo, { width: w + 'px', transform: `translate(${540 - w / 2}px,${cy0 - h / 2}px) scale(${lerp(1.45, 1, p)})`, opacity: (b < 2 ? lerp(0.75, 1, P(b, 0, 0.08)) : clamp(P(b, L0, L0 + 0.08) * 2)) * (b < 2 ? 1 - P(b, 1.85, 2) : 1),
        filter: `blur(${(1 - p) * (b < 2 ? 4 : 10)}px) drop-shadow(0 30px 40px rgba(10,20,50,.35))` });
    }

    /* ---------- products ---------- */
    for (const k in P_) vis(P_[k].el, false);
    const show = (k) => { vis(P_[k].el, true); return P_[k]; };
    // teasers b4-7.75: one product per beat, whipping in
    if (inR(b, 4, 7.75)) {
      const i = Math.floor(b - 4), q = E.outExpo(P(b, 4 + i, 4.3 + i)), dir = i % 2 ? -1 : 1;
      const key = ['tSU', 'tSB', 'tSJ', 'tSC'][i], p = show(key);
      const cfg = [[540, 560, 640, -10], [540, 560, 520, 6], [540, 560, 980, -14], [540, 560, 470, -6]][i];
      place(p, cfg[0] + (1 - q) * 900 * dir, cfg[1], cfg[2], cfg[3], 1 + 0.05 * P(b, 4 + i, 5 + i), 1, (1 - q) * 18);
      sweep(p, b, 4.15 + i, 0.6);
      O.nums.forEach((el, j) => { vis(el, j === i); if (j === i) set(el, { transform: `translate(${540 - el.offsetWidth / 2 + (1 - q) * -300 * dir}px,${240}px)`, opacity: 0.18 }); });
    } else O.nums.forEach(el => vis(el, false));
    // DROP A b8-12: Unleashed Pro swings down onto the ice
    vis(O.ccm1, inR(b, 8, 12));
    if (inR(b, 8, 12)) {
      const q = E.outExpo(P(b, 8, 8.35)), p = show('su');
      place(p, 560, 520, 720, lerp(-28, 0, q), 1 + 0.04 * P(b, 8, 12), 1, (1 - q) * 14, '12% 6%');
      sweep(p, b, 10.5, 0.9);
      set(O.ccm1, { transform: `translate(${lerp(260, 120, P(b, 8, 12)) - 40}px,${250}px)`, opacity: 0.16 + 0.06 * (1 - q) });
    }
    // b12-16: JetSpeed whips in, flaps spell JETSPEED, slap shot on b14
    vis(FL.jet.host, inR(b, 12.8, 16)); if (inR(b, 12.8, 16)) renderFlaps(FL.jet, b, 13);
    if (inR(b, 12, 16)) {
      const q = E.outExpo(P(b, 12, 12.3)), wind = b >= 13.7 && b < 14 ? -6 * E.inCubic(P(b, 13.7, 14)) : b >= 14 ? -6 * (1 - E.outExpo(P(b, 14, 14.25))) + 4 * Math.exp(-(b - 14) * 6) * Math.sin((b - 14) * 30) : 0;
      place(show('sj'), 540 + (1 - q) * 1300, 560, 1000, -4 + wind, 1, 1, (1 - q) * 22, '0% 50%');
      sweep(P_.sj, b, 12.6, 0.8);
    }
    // b16-20: crossed sticks lockup + IN STOCK stamp
    if (inR(b, 16, 20)) {
      const q = E.spring(P(b, 16, 16.6));
      place(show('su2'), 540, 560, 600, lerp(20, 0, q), lerp(0.7, 1, q), clamp(q * 2));
      place(show('sj2'), 540, 560, 820, lerp(-60, -44, q), lerp(0.7, 1, q), clamp(q * 2));
      sweep(P_.su2, b, 17, 0.8); sweep(P_.sj2, b, 17.2, 0.8);
    }
    // b22-23.5: Bauer blade macro teaser
    if (inR(b, 22, 23.6)) { const q = E.outExpo(P(b, 22, 22.3)); place(show('blade'), 540 + (1 - q) * -900, 680, 1300, -3, 1 + 0.05 * P(b, 22, 23.6), 1, (1 - q) * 16); sweep(P_.blade, b, 22.4, 0.9); }
    // DROP B b24-28: Bauer lands on the ice
    vis(O.bauer, inR(b, 24, 28));
    if (inR(b, 24, 28)) {
      const q = E.outCubic(P(b, 23.75, 24)), land = b >= 24 ? Math.exp(-(b - 24) * 10) * Math.sin((b - 24) * 26) : 0;
      place(show('sb'), 460, lerp(-300, 560, q), 470, -4 + 2 * Math.sin(b * 1.3), 1 + 0.04 * P(b, 24, 28) - 0.05 * land);
      sweep(P_.sb, b, 25, 0.9);
      set(O.bauer, { transform: `translate(${lerp(40, -60, P(b, 24, 28))}px,${330}px)`, opacity: 0.16 });
    }
    // b28-32: CCM skate on navy
    vis(O.ccm2, inR(b, 28, 32));
    if (inR(b, 28, 32)) {
      const q = E.outExpo(P(b, 28, 28.3));
      place(show('sc'), 460 + (1 - q) * 1100, 540, 450, -6 + 2 * Math.sin(b * 1.2), 1 + 0.04 * P(b, 28, 32), 1, (1 - q) * 20);
      sweep(P_.sc, b, 29, 0.9);
      set(O.ccm2, { transform: `translate(${lerp(240, 140, P(b, 28, 32))}px,${250}px)`, opacity: 0.18, webkitTextStroke: '4px rgba(255,255,255,.9)' });
    }
    vis(FL.landed.host, inR(b, 29.9, 32)); if (inR(b, 29.9, 32)) renderFlaps(FL.landed, b, 30);
    // b32-36: both skates
    if (inR(b, 32, 36)) {
      const q1 = E.spring(P(b, 32, 32.6)), q2 = E.spring(P(b, 32.15, 32.75));
      place(show('sb2'), 330, 560 + Math.sin(b * 1.6) * 8, 400, -4, lerp(0.6, 1, q1), clamp(q1 * 2));
      place(show('sc2'), 755, 560 + Math.sin(b * 1.6 + 1) * 8, 370, -4, lerp(0.6, 1, q2), clamp(q2 * 2));
      sweep(P_.sb2, b, 33, 0.8); sweep(P_.sc2, b, 33.2, 0.8);
    }

    /* ---------- tags + pills ---------- */
    const pop = (el, on, at, x, y, rot = 0) => { vis(el, on); if (!on) return; const q = E.outBack(P(b, at, at + 0.3)); set(el, { transform: `translate(${x}px,${y}px) rotate(${rot}deg) scale(${q})`, opacity: clamp(q * 2), transformOrigin: '0 50%' }); };
    pop(TAG.su, inR(b, 9, 12), 9, 96, 780);
    pop(PILL.new1, inR(b, 9.5, 12), 9.5, 760, 190, -4);
    pop(PILL.stock1, inR(b, 10, 12), 10, 760, 262, -4);
    pop(TAG.sb, inR(b, 25, 28), 25, 700, 700);
    pop(PILL.justin, inR(b, 26, 28), 26, 760, 190, -4);
    pop(TAG.sc, inR(b, 29, 32), 29, 700, 720);
    pop(PILL.store, inR(b, 33, 36), 33, 540 - 130, 880, -2);

    /* ---------- type slams (hard in on the beat, hard out) ---------- */
    for (const o of T) {
      const on = b >= o.at && b < o.out; vis(o.el, on); if (!on) continue;
      const p = P(b, o.at, o.at + 0.12), k = lerp(1.5, 1, E.outCubic(p));
      set(o.el, { opacity: clamp(p * 3), transform: `translate(${o.center ? -o.W / 2 : 0}px,-50%) scale(${k})`, transformOrigin: '50% 50%', filter: p < 1 ? `blur(${(1 - p) * 8}px)` : 'none' });
    }
    // the stamp
    { const s = ST.stock, on = inR(b, 18, 20); vis(s.el, on); if (on) { const p = P(b, 18, 18.13), k = lerp(2.1, 1, E.inExpo(p)); set(s.el, { opacity: clamp(p * 4), transform: `translate(${540 - STW.stock.w / 2}px,${560 - STW.stock.h / 2}px) rotate(${s.rot}deg) scale(${k})` }); } }

    /* ---------- slashes on navy scenes ---------- */
    const slashOn = inR(b, 2, 4) || inR(b, 20, 22) || inR(b, 28, 32);
    SL.forEach((el, i) => {
      vis(el, slashOn); if (!slashOn) return;
      const st = b < 4 ? 2 : b < 22 ? 20 : 28, q = E.outExpo(P(b, st + i * 0.08, st + 0.4 + i * 0.08));
      set(el, { left: '-200px', top: [190, 900, 960][i] + 'px', width: (1500 * q) + 'px', height: [30, 46, 14][i] + 'px', transform: 'rotate(-8deg)', opacity: i === 2 ? 0.6 : 0.95 });
    });

    /* ---------- figure-8 tracing ---------- */
    vis(FIG8, inR(b, 36, 40));
    if (inR(b, 36, 40)) { F8.setAttribute('stroke-dashoffset', 1 - E.inOut(P(b, 36, 39.6))); FIG8.style.opacity = 0.9; }

    /* ---------- slap-shot puck b14 ---------- */
    // reuse the hook puck element as the shot
    if (inR(b, 14, 14.6)) { vis(R.puck, true); const p = E.outCubic(P(b, 14, 14.55)); set(R.puck, { left: lerp(980, 160, p) + 'px', top: lerp(540, 300, p) + 'px', transform: `scale(${lerp(0.12, 1.4, p)})`, opacity: 1 - P(b, 14.4, 14.6), filter: `blur(${4 + p * 6}px)` }); }
    else set(R.puck, { left: '540px', top: '540px' });

    /* ---------- particles ---------- */
    px.clearRect(0, 0, 1080, 1080);
    for (const e of BURSTS) {
      const tt = (b - e.b) * BEAT; if (tt < 0 || tt > e.life + 0.2) continue;
      for (const q of e.p) {
        if (tt > q.l) continue;
        const x = e.x + q.x0 + q.vx * tt, y = e.y + q.y0 + q.vy * tt + 0.5 * e.g * tt * tt, a = (1 - tt / q.l);
        px.globalAlpha = a * 0.95; px.fillStyle = `rgb(${q.c})`; px.beginPath(); px.arc(x, y, q.sz * (e.wipe ? 1 + tt : 1), 0, 6.283); px.fill();
      }
    }
    px.globalAlpha = 1;

    /* ---------- flashes: hook, gap, drops, wipe, logo ---------- */
    let fl = 0;
    if (b < 0.4) fl = Math.max(fl, 0.75 * Math.sin(P(b, 0, 0.4) * Math.PI) * (b > 0.02 ? 1 : 0));
    for (const [h, a, d] of [[0, 0, 0.3], [8, 0.7, 0.35], [14.35, 0.5, 0.25], [24, 0.6, 0.4], [40, 0.8, 0.45], [18, 0.25, 0.2]]) if (b >= h && b < h + d) fl = Math.max(fl, a * (1 - E.outCubic(P(b, h, h + d))));
    if (inR(b, 23.5, 24.05)) fl = Math.max(fl, Math.sin(P(b, 23.5, 24.05) * Math.PI) * 0.92);   // the hockey-stop white-out
    R.flash.style.opacity = fl;

    /* ---------- grain ---------- */
    const fi = frozen ? 0 : Math.floor(t * 60), nz = NOISE[fi % 8], ox = (fi * 137) % 540, oy = (fi * 251) % 540;
    gctx.drawImage(nz, -ox, -oy); gctx.drawImage(nz, 540 - ox, -oy); gctx.drawImage(nz, -ox, 540 - oy); gctx.drawImage(nz, 540 - ox, 540 - oy);
    grain.style.opacity = 0.22;
  }

  window.renderFrame = render; window.DURATION = DUR;
  for (const tw of [0, 1, 3, 5, 6, 9, 13, 14.2, 17, 18.5, 21, 22.5, 23.8, 25, 29, 30.5, 33, 37, 41, 43]) render(tw * BEAT);
  render(0); window.__ready = true;
  if (!RENDER) {
    const aud = $('#aud'), pp = $('#pp'), scrub = $('#scrub'), tc = $('#tc'); scrub.max = DUR; let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (aud.currentTime >= DUR - 0.05) aud.currentTime = 0; aud.play(); } else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; render(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; render(t); scrub.value = t; tc.textContent = t.toFixed(2) + 's'; if (t >= DUR) { playing = false; pp.textContent = 'Play'; } } requestAnimationFrame(loop); };
    loop();
  }
})();
