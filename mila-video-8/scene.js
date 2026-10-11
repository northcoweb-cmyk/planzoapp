/* Mila film #8 — "Speedrun" (retro 8-bit).
 * Everything is drawn on a low-res pixel canvas (270 px wide, scaled 4x with nearest-neighbour) and finished
 * with a CRT pass (bloom, scanlines, RGB mask, vignette). render(t) is a pure function of time; cues are beats b
 * of the song at 128 BPM (0.46875 s).
 * Title b0-4 · loadout (all connectors linked) b4-8 · READY 3-2-1 b8-12 · GO on the drop b12 ·
 * 6 splits b12-30 (real-time timer) · NEW RECORD b30 · approve all b32 · leaderboard b33.5 · end b36 · dissolve to frame 0 b39.1-40.
 */
(async function () {
  const TL = await (await fetch('timeline.json')).json();
  const BEAT = TL.beat, DUR = TL.duration, TOT = TL.totalBeats;
  const qs = new URLSearchParams(location.search);
  const RENDER = qs.has('render');
  const FORMAT = qs.get('format') || 'square';
  const HOOK = (qs.get('hook') || '').toUpperCase();          // optional alternate title line
  if (RENDER) document.body.classList.add('render');
  const SIZES = { square: [1080, 1080], feed: [1080, 1350], portrait: [1080, 1920] };
  const [W, H] = SIZES[FORMAT] || SIZES.square;
  const PX = 4, LW = W / PX, LH = Math.ceil(H / PX), OY = Math.floor((LH - 270) / 2);   // stage = 270x270 centred
  const vp = document.getElementById('viewport'); vp.style.width = W + 'px'; vp.style.height = H + 'px';
  const cv = document.getElementById('px'), bl = document.getElementById('bloom');
  cv.width = LW; cv.height = LH; set(cv, { width: W + 'px', height: LH * PX + 'px', top: Math.floor((H - LH * PX) / 2) + 'px' });
  bl.width = LW; bl.height = LH; set(bl, { width: W + 'px', height: LH * PX + 'px', top: Math.floor((H - LH * PX) / 2) + 'px' });
  const g = cv.getContext('2d'), bg = bl.getContext('2d'); g.imageSmoothingEnabled = false;
  if (!RENDER) { const fit = () => { const k = Math.min(innerWidth / W, (innerHeight - 60) / H); vp.style.transformOrigin = '0 0'; vp.style.transform = `translate(${(innerWidth - W * k) / 2}px,0) scale(${k})`; }; fit(); addEventListener('resize', fit); }
  function set(el, o) { for (const k in o) el.style[k] = o[k]; }

  /* ---------------------------------------------------------------- helpers */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, p) => a + (b - a) * p, P = (x, x0, x1) => clamp((x - x0) / (x1 - x0));
  const E = { outExpo: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)), inCubic: p => p * p * p, outCubic: p => 1 - Math.pow(1 - p, 3), inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    outBack: p => { const c = 2.2; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); } };
  const R = Math.round, TAU = Math.PI * 2;
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pulseAt = (b, T, k = 8) => (b >= T ? Math.exp(-(b - T) * k) : 0);

  /* palette: Mila night sky + brand gradient, with arcade accents */
  const C = { bg0: '#07070b', bg1: '#11112a', navy: '#1c1c44', dim: '#4b4b85', blue: '#8fb4ff', violet: '#a68cff', peach: '#ffc9a8', white: '#f6f3ff',
    green: '#5cff8a', gold: '#ffd66b', red: '#ff5c7a', cyan: '#6fe7ff', ink: '#0b0b12' };
  const GRAD = ['#eaf1ff', '#c3d6ff', '#a9bcff', '#ad9cff', '#c7a3f5', '#eab6d6', '#ffc9a8', '#ffdcc4'];

  /* ---------------------------------------------------------------- crisp pixel text (alpha-thresholded, cached) */
  const FONTS = { ps: 'PS2P', sk: 'Silk', skb: 'SilkB' };
  const TC = new Map();
  function glyphs(str, size, font, colors) {
    const key = str + '|' + size + '|' + font + '|' + (Array.isArray(colors) ? colors.join(',') : colors);
    if (TC.has(key)) return TC.get(key);
    const m = document.createElement('canvas').getContext('2d'); m.font = `${size}px ${FONTS[font]}`;
    const w = Math.ceil(m.measureText(str).width) + 2, h = Math.ceil(size * 1.25) + 2;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.font = `${size}px ${FONTS[font]}`; x.textBaseline = 'top'; x.fillStyle = '#fff'; x.fillText(str, 1, 1);
    const id = x.getImageData(0, 0, w, h), d = id.data;
    let top = h, bot = 0;
    for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { const k = (y * w + i) * 4; const on = d[k + 3] > 110; d[k] = d[k + 1] = d[k + 2] = 255; d[k + 3] = on ? 255 : 0; if (on) { top = Math.min(top, y); bot = Math.max(bot, y); } }
    x.putImageData(id, 0, 0);
    x.globalCompositeOperation = 'source-in';
    if (Array.isArray(colors)) {          // hard-banded vertical gradient, applied in ONE source-in draw (per-row fills would wipe each other)
      const band = document.createElement('canvas'); band.width = w; band.height = h; const bx = band.getContext('2d'), span = Math.max(1, bot - top + 1);
      for (let y = 0; y < h; y++) { bx.fillStyle = colors[clamp(Math.floor((y - top) / span * colors.length), 0, colors.length - 1)]; bx.fillRect(0, y, w, 1); }
      x.drawImage(band, 0, 0);
    }
    else { x.fillStyle = colors; x.fillRect(0, 0, w, h); }
    const out = { c, w, h }; TC.set(key, out); return out;
  }
  // txt(str, x, y, {size, font, color, align, shadow, depth})
  function txt(str, x, y, o = {}) {
    const size = o.size || 8, font = o.font || 'ps', col = o.color || C.white;
    const gl = glyphs(str, size, font, col);
    let X = R(x - (o.align === 'center' ? gl.w / 2 : o.align === 'right' ? gl.w : 0)), Y = R(y);
    if (o.depth) { const sh = glyphs(str, size, font, o.shadow || C.navy); for (let k = o.depth; k >= 1; k--) g.drawImage(sh.c, X + k, Y + k); }
    else if (o.shadow) { const sh = glyphs(str, size, font, o.shadow); g.drawImage(sh.c, X + 1, Y + 1); }
    g.drawImage(gl.c, X, Y); return gl.w;
  }
  const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(R(x), R(y), R(w), R(h)); };
  function box(x, y, w, h, fill, edge, edge2) {             // chunky 8-bit panel with notched corners
    x = R(x); y = R(y); w = R(w); h = R(h);
    rect(x + 1, y, w - 2, h, edge); rect(x, y + 1, w, h - 2, edge);
    rect(x + 2, y + 1, w - 4, h - 2, fill); rect(x + 1, y + 2, w - 2, h - 4, fill);
    if (edge2) { rect(x + 2, y + h - 2, w - 4, 1, edge2); rect(x + w - 2, y + 2, 1, h - 4, edge2); }
  }
  // pixel sprites from string maps
  function sprite(map, pal, x, y, s = 1) { for (let r = 0; r < map.length; r++) for (let c = 0; c < map[r].length; c++) { const ch = map[r][c]; if (ch !== '.' && pal[ch]) rect(x + c * s, y + r * s, s, s, pal[ch]); } }
  const RACHEL = { // the player (the agent using Mila)
    head: ['....hhhh....', '...hhhhhh...', '..hhsssshh..', '..hsesesh...', '..hhsssshh..', '..hhsmmshh..', '..h.ssss.h..'],
    body: ['....vwwv....', '...vvwwvv...', '..vvvwwvvv..', '..svvvvvvs..', '....vvvv....', '....nnnn....'],
    stand: ['....n..n....', '....n..n....', '...kk..kk...'],
    runA: ['...nn..n....', '..nn....n...', '.kk.....kk..'],
    runB: ['....nnn.....', '.....nn.....', '....kkk.....'],
  };
  const RPAL = { h: '#5a3220', s: '#f2c4a0', e: '#0b0b12', m: '#d9817a', v: C.violet, w: C.white, n: '#2a2a66', k: '#0b0b12' };
  function rachel(x, y, s, frame) { sprite(RACHEL.head, RPAL, x, y, s); sprite(RACHEL.body, RPAL, x, y + 7 * s, s); sprite(RACHEL[frame], RPAL, x, y + 13 * s, s); }
  const ICON = {
    check: ['......g', '.....gg', 'g...gg.', 'gg.gg..', '.ggg...', '..g....'],
    star: ['...y...', '...y...', 'yyyyyyy', '.yyyyy.', '..yyy..', '.yy.yy.', 'yy...yy'],
    mail: ['wwwwwwwww', 'wvwwwwwvw', 'wwvwwwvww', 'wwwvwvwww', 'wwwwvwwww', 'wwwwwwwww'],
    heart: ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
    coin: ['.yyy.', 'yywyy', 'yywyy', 'yywyy', '.yyy.'],
    palm: ['..ggg.gg.', '.g..gg..g', 'g..g.tg..', '....t....', '....t....', '....t....', '...t.....', '...t.....', '...t.....', '..ttt....'],
  };
  const IPAL = { g: C.green, y: C.gold, w: C.white, v: C.violet, r: C.red, t: '#8a5a3a' };

  /* ---------------------------------------------------------------- pixelated photos (posterized) */
  async function pixPhoto(name, w, h, levels = 6) {
    const im = new Image(); im.src = `assets/photos/${name}.jpg`; await im.decode();
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    const ar = im.width / im.height, tar = w / h; let sw = im.width, sh = im.height, sx = 0, sy = 0;
    if (ar > tar) { sw = im.height * tar; sx = (im.width - sw) / 2; } else { sh = im.width / tar; sy = (im.height - sh) / 2; }
    x.imageSmoothingQuality = 'high'; x.drawImage(im, sx, sy, sw, sh, 0, 0, w, h);
    const id = x.getImageData(0, 0, w, h), d = id.data, q = 255 / (levels - 1);
    for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] = Math.round(Math.round(d[i + k] / q) * q * 0.92 + 10);
    x.putImageData(id, 0, 0); return c;
  }

  /* ---------------------------------------------------------------- assets */
  await document.fonts.load('8px PS2P'); await document.fonts.load('8px Silk'); await document.fonts.load('8px SilkB'); await document.fonts.ready;
  const PH = {
    heroBig: await pixPhoto('hero_waterfront', 112, 64, 6), hero: await pixPhoto('hero_waterfront', 60, 38), bridge: await pixPhoto('sarasota_bridgepool', 60, 38),
    rock: await pixPhoto('tampa_rockpool', 60, 38), beach: await pixPhoto('beach_boardwalk', 60, 38), tiki: await pixPhoto('lauderdale_tiki', 60, 38),
    card: await pixPhoto('hero_waterfront', 40, 30, 5),
  };
  const mosaic = (src, k) => { const c = document.createElement('canvas'); c.width = Math.max(1, R(src.width / k)); c.height = Math.max(1, R(src.height / k)); const x = c.getContext('2d'); x.drawImage(src, 0, 0, c.width, c.height); return c; };
  const MOS = ['hero', 'bridge', 'rock', 'tiki'].map(n => [8, 5, 3, 2].map(k => mosaic(PH[n], k)));

  /* background star field + Florida skyline (loop-periodic) */
  const STARS = (() => { const r = rng(8); return Array.from({ length: 110 }, () => ({ x: r() * LW, y: r() * LH, z: 1 + Math.floor(r() * 3), tw: r() * TAU })); })();
  const SKY = (() => { const r = rng(3); const out = []; let x = 0; while (x < 540) { const kind = r() < 0.38 ? 'palm' : 'house'; const w = kind === 'palm' ? 9 : 18 + Math.floor(r() * 16); out.push({ x, kind, w, h: kind === 'palm' ? 10 : 8 + Math.floor(r() * 12), win: r() }); x += w + 4 + Math.floor(r() * 10); } return { items: out, len: x }; })();
  // ground scroll: integral of a speed curve, rescaled so it returns to 0 mod the tile length at b = 40
  const speed = b => (b < 12 ? 0.6 : b < 30 ? 3.2 : b < 36 ? 1.2 : 0.6);
  const RAW40 = (() => { let s = 0; for (let k = 0; k < 4000; k++) s += speed(k / 100) / 100; return s; })();
  const SCROLL = new Float32Array(4001); { let s = 0; for (let k = 0; k <= 4000; k++) { SCROLL[k] = s; s += speed(k / 100) / 100; } const kf = Math.round(SCROLL[4000] * 12 / SKY.len) * SKY.len / (SCROLL[4000] * 12); for (let k = 0; k <= 4000; k++) SCROLL[k] *= kf * 12; }
  const scroll = b => { const i = clamp(b * 100, 0, 4000), i0 = Math.floor(i); return lerp(SCROLL[i0], SCROLL[Math.min(4000, i0 + 1)], i - i0); };

  function drawBackground(b, warp) {
    rect(0, 0, LW, LH, C.bg0);
    for (let y = 0; y < LH; y += 2) { const t = y / LH; if (t > 0.55) rect(0, y, LW, 2, `rgba(166,140,255,${(t - 0.55) * 0.22})`); }
    for (const s of STARS) {
      const sp = s.z * 8;                                   // px per bar; one full wrap every 40 beats
      let x = ((s.x - (b / TOT) * LW * s.z) % LW + LW) % LW, y = s.y;
      const tw = 0.5 + 0.5 * Math.sin(TAU * 5 * b / TOT + s.tw);
      if (warp > 0) { const len = R(1 + warp * 26 * s.z); rect(x - len, y, len, 1, s.z === 3 ? C.white : C.dim); }
      else rect(x, y, 1, 1, s.z === 3 ? (tw > 0.5 ? C.white : C.blue) : s.z === 2 ? C.dim : C.navy);
    }
  }
  function drawSkyline(b, y0) {
    const off = scroll(b) % SKY.len;
    for (let rep = -1; rep < Math.ceil(LW / SKY.len) + 1; rep++) for (const it of SKY.items) {
      const x = R(it.x - off + rep * SKY.len); if (x > LW || x + it.w < 0) continue;
      if (it.kind === 'palm') sprite(ICON.palm, { g: '#2f6b5a', t: '#3a2a4a' }, x, y0 - 10, 1);
      else { rect(x, y0 - it.h, it.w, it.h, '#1a1a3a'); rect(x + 1, y0 - it.h - 1, it.w - 2, 1, '#26264f'); for (let wx = x + 3; wx < x + it.w - 3; wx += 5) if ((wx * 7 + it.h) % 3) rect(wx, y0 - it.h + 3, 2, 2, it.win > 0.5 ? C.peach : C.gold); }
    }
    rect(0, y0, LW, LH - y0, '#14142e'); for (let x = 0; x < LW; x += 6) rect(((x - R(scroll(b))) % LW + LW) % LW, y0 + 2, 3, 1, '#2a2a5a');
  }

  /* ---------------------------------------------------------------- scenes (stage coords, 270x270, translated by OY) */
  const fmt = s => { const m = Math.floor(s / 60), ss = s - m * 60; return `${m}:${ss < 10 ? '0' : ''}${ss.toFixed(2)}`.replace(/(\.\d\d)\d*$/, '$1'); };
  const fmtFloor = s => { const cs = Math.floor(s * 100 + 1e-6), m = Math.floor(cs / 6000), r = cs - m * 6000; return `${m}:${String(Math.floor(r / 100)).padStart(2, '0')}.${String(r % 100).padStart(2, '0')}`; };
  const GO = TL.go, FINAL = TL.splits[TL.splits.length - 1][1];

  function arcadeBar(b, credit) {
    const y = 6 - OY;                                        // stage coords: the very top of the screen in every format
    txt('1UP', 8, y, { color: C.red }); txt('RACHEL', 34, y, { color: C.white });
    txt(credit, LW - 8, y, { color: C.gold, align: 'right' });
  }

  function sceneTitle(b) {
    const ty = 40;
    txt('SPEEDRUN', 135, ty, { size: 24, color: GRAD, align: 'center', depth: 3, shadow: '#2b2160' });
    const sub = HOOK || 'NEW LISTING >> OPEN HOUSE';
    txt(sub, 135, ty + 34, { size: 8, color: C.white, align: 'center', shadow: C.navy });
    // level card
    box(77, 96, 116, 84, C.bg1, C.violet, '#5a4aa0');
    g.drawImage(PH.heroBig, 79, 98);
    rect(79, 162, 112, 16, 'rgba(7,7,11,.82)');
    txt('LEVEL 1-1', 82, 164, { size: 8, font: 'sk', color: C.peach }); txt('NAPLES, FL', 189, 164, { size: 8, font: 'sk', color: C.white, align: 'right' });
    txt('48 CORAL PALM WAY', 135, 188, { size: 8, font: 'skb', color: C.blue, align: 'center' });
    const blink = ((b + 0.5) % 1) < 0.62;
    if (blink) txt('PRESS START', 135, 210, { size: 8, color: C.gold, align: 'center', shadow: '#5a3a10' });
    txt('CATEGORY: ANY% · MILA', 135, 228, { size: 8, font: 'sk', color: C.dim, align: 'center' });
  }

  function sceneLoadout(b) {
    txt('PLAYER 1', 52, 32, { size: 8, color: C.red, align: 'center' });
    box(12, 44, 80, 108, C.bg1, C.violet, '#5a4aa0');
    rachel(28, 56 + ((b * 2) % 1 < 0.5 ? 0 : 1), 4, 'stand');
    txt('RACHEL', 52, 160, { size: 8, color: GRAD, align: 'center', shadow: '#2b2160' });
    txt('LV 99 AGENT', 52, 172, { size: 8, font: 'sk', color: C.peach, align: 'center' });
    // connectors
    box(100, 30, 158, 150, C.bg1, C.blue, '#3d5aa0');
    txt('CONNECTORS', 110, 38, { size: 8, color: C.blue });
    TL.connectors.forEach((name, i) => {
      const y = 56 + i * 17, T = TL.checkBeats[i], on = b >= T, p = E.outBack(P(b, T, T + 0.35));
      rect(108, y - 3, 142, 14, i % 2 ? 'rgba(143,180,255,.06)' : 'rgba(166,140,255,.08)');
      txt(name, 112, y, { size: 8, font: 'skb', color: on ? C.white : C.dim });
      txt('....', 196, y, { size: 8, font: 'sk', color: C.navy });
      if (on) { const s = Math.max(1, R(p * 1.4)); sprite(ICON.check, IPAL, 236 - (s - 1) * 3, y - (s - 1) * 3, s); if (b < T + 0.25) rect(108, y - 3, 142, 14, `rgba(92,255,138,${0.25 * (1 - P(b, T, T + 0.25))})`); }
      else txt('[ ]', 232, y, { size: 8, font: 'sk', color: C.dim });
    });
    if (b >= 7.5) { const p = E.outBack(P(b, 7.5, 7.85)); txt('ALL LINKED!', 135, 196, { size: 16, color: [C.green, C.green, '#2fbf62'], align: 'center', depth: 2, shadow: '#0f4a2a' }); if (p < 1) rect(0, 190, 270, 24, `rgba(92,255,138,${0.2 * (1 - p)})`); }
    else txt('LINKING...', 135, 200, { size: 8, color: C.dim, align: 'center' });
  }

  function sceneCountdown(b) {
    const k = Math.floor(b - 8), f = b - 8 - k;
    if (k === 0) { if ((b * 4) % 1 < 0.7) txt('READY?', 135, 118, { size: 24, color: GRAD, align: 'center', depth: 3, shadow: '#2b2160' }); txt('ALL CONNECTORS LINKED', 135, 156, { size: 8, font: 'sk', color: C.green, align: 'center' }); return; }
    const n = String(4 - k), size = [64, 56, 48, 40][Math.min(3, Math.floor(f * 6))] || 40;
    txt(n, 135, 135 - size / 2, { size, color: k === 3 ? [C.red, C.red, '#c23050'] : [C.gold, C.gold, '#d9a531'], align: 'center', depth: 4, shadow: '#3a1530' });
    // radial burst ring on each beat
    const rr = R(20 + f * 120); g.strokeStyle = `rgba(255,214,107,${0.6 * (1 - f)})`; g.lineWidth = 2; g.strokeRect(135 - rr, 135 - rr, rr * 2, rr * 2);
  }

  function hud(b) {
    const runT = Math.min(b, FINAL) - GO, secs = Math.max(0, runT) * BEAT, done = b >= FINAL;
    box(4, 4, 262, 22, C.bg1, done ? C.gold : C.violet, '#3a2d78');
    txt('RACHEL', 10, 11, { size: 8, color: C.white }); txt('x', 60, 11, { size: 8, color: C.dim }); txt('MILA', 72, 11, { size: 8, color: GRAD });
    const tcol = done ? (((b * 4) % 1) < 0.6 ? C.gold : C.white) : C.white;
    txt(fmtFloor(secs), 262, 8, { size: 16, color: tcol, align: 'right', shadow: '#2b2160' });
  }
  function splitsPanel(b) {
    box(4, 30, 118, 116, C.bg1, C.blue, '#3d5aa0');
    TL.splits.forEach(([name, T], i) => {
      const start = i ? TL.splits[i - 1][1] : GO, y = 37 + i * 18, cur = b >= start && b < T, done = b >= T;
      if (cur) rect(7, y - 4, 112, 16, 'rgba(166,140,255,.28)');
      if (done && b < T + 0.5) rect(7, y - 4, 112, 16, `rgba(92,255,138,${0.45 * (1 - P(b, T, T + 0.5))})`);
      txt(name, 9, y, { size: 8, font: 'sk', color: done ? C.green : cur ? C.white : C.dim });
      const val = done ? fmtFloor((T - GO) * BEAT) : cur ? fmtFloor((b - GO) * BEAT) : '-:--.--';
      txt(val, 117, y, { size: 8, font: 'sk', color: done ? C.green : cur ? C.gold : C.navy, align: 'right' });
    });
  }
  function levelPanel(b) {
    const i = clamp(TL.splits.findIndex(s => b < s[1]), 0, 5), [name, T] = TL.splits[i], start = i ? TL.splits[i - 1][1] : GO, p = P(b, start, T);
    box(126, 30, 140, 116, C.bg1, C.violet, '#5a4aa0');
    txt(`${i + 1}-${['A', 'B', 'C', 'D', 'E', 'F'][i]}`, 132, 36, { size: 8, color: C.peach }); txt(name, 262, 36, { size: 8, font: 'sk', color: C.dim, align: 'right' });
    const X = 132, Y = 48;
    g.save(); g.beginPath(); g.rect(128, 46, 136, 98); g.clip();
    if (i === 0) {           // listing copy types itself
      box(X + 6, Y + 2, 116, 88, C.white, '#c9c3ff');
      txt('48 CORAL PALM WAY', X + 12, Y + 8, { size: 8, font: 'skb', color: C.ink });
      const lines = [96, 104, 88, 100, 70, 96, 60], n = p * 7.4;
      lines.forEach((w, k) => { const f = clamp(n - k); if (f > 0) rect(X + 12, Y + 22 + k * 9, R(w * f), 3, k === 4 ? C.violet : '#8a86b8'); if (f > 0 && f < 1 && (b * 6) % 1 < 0.6) rect(X + 12 + R(w * f) + 1, Y + 20 + k * 9, 2, 7, C.violet); });
    } else if (i === 1) {    // photos resolve from mosaic
      [[0, 0], [62, 0], [0, 42], [62, 42]].forEach(([dx, dy], k) => {
        const a = P(p, k * 0.12, k * 0.12 + 0.55); if (a <= 0) { rect(X + 4 + dx, Y + 4 + dy, 60, 38, C.navy); return; }
        const lvl = Math.min(4, Math.floor(a * 5)); const src = lvl >= 4 ? PH[['hero', 'bridge', 'rock', 'tiki'][k]] : MOS[k][lvl];
        g.drawImage(src, X + 4 + dx, Y + 4 + dy, 60, 38);
        if (a >= 1 && a < 1.2) rect(X + 4 + dx, Y + 4 + dy, 60, 38, 'rgba(255,255,255,.3)');
      });
    } else if (i === 2) {    // carousel cards fan in
      for (let k = 0; k < 3; k++) {
        const a = E.outBack(P(p, k * 0.18, k * 0.18 + 0.45)); if (a <= 0) continue;
        const cx = X + 68 + (k - 1) * 40 * a, cy = Y + 48 - (k === 1 ? 4 : 0), rot = (k - 1) * 0.12 * a;
        g.save(); g.translate(R(cx), R(cy)); g.rotate(rot);
        box(-22, -32, 44, 62, C.white, k === 1 ? C.violet : '#c9c3ff');
        g.drawImage(PH.card, -20, -30, 40, 30);
        txt(['JUST', 'OFFERED', 'OPEN'][k], 0, 3, { size: 8, font: 'skb', color: C.ink, align: 'center' });
        txt(['LISTED', '$2.45M', 'SUN 1-4'][k], 0, 13, { size: 8, font: 'sk', color: C.violet, align: 'center' });
        g.restore();
      }
    } else if (i === 3) {    // email flies to 31 buyers
      const a = E.outCubic(P(p, 0.05, 0.6));
      box(X + 8, Y + 6, 120, 34, C.white, '#c9c3ff');
      txt('FROM: RACHEL', X + 14, Y + 12, { size: 8, font: 'sk', color: C.ink }); txt('JUST LISTED: NAPLES', X + 14, Y + 24, { size: 8, font: 'sk', color: C.violet });
      for (let k = 0; k < 4; k++) { const q = clamp(a * 1.4 - k * 0.15); if (q <= 0) continue; sprite(ICON.mail, IPAL, R(X + 20 + q * 90 - k * 6), R(Y + 52 + Math.sin(q * Math.PI) * -12 + k * 6), 2); }
      const n = Math.floor(31 * P(p, 0.2, 0.85)); const nw = txt(String(n), X + 36, Y + 74, { size: 16, color: C.gold, shadow: '#5a3a10' }); txt('BUYERS', X + 40 + nw, Y + 82, { size: 8, color: C.white });
    } else if (i === 4) {    // open house stamped on the calendar
      box(X + 8, Y + 4, 120, 88, C.white, '#c9c3ff');
      ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((d, k) => txt(d, X + 16 + k * 16, Y + 10, { size: 8, font: 'skb', color: k === 6 ? C.violet : '#8a86b8' }));
      for (let r2 = 0; r2 < 4; r2++) for (let k = 0; k < 7; k++) rect(X + 14 + k * 16, Y + 22 + r2 * 16, 12, 12, '#ece9ff');
      const a = E.outBack(P(p, 0.15, 0.5)), s = Math.max(1, R(lerp(3, 1, clamp(a))));
      if (a > 0) { rect(X + 14 + 6 * 16 - 2, Y + 22 + 16 - 2, 16, 16, C.violet); sprite(ICON.star, IPAL, X + 14 + 6 * 16 + 2 - (s - 1) * 3, Y + 22 + 16 + 2 - (s - 1) * 3, s); }
      if (p > 0.45) txt('OPEN HOUSE SUN 1-4', X + 68, Y + 92 - 14, { size: 8, font: 'skb', color: C.violet, align: 'center' });
    } else {                 // follow-ups queued
      [['JE', 'THANKS FOR VISITING!'], ['PS', 'OPEN HOUSE SUN 1-4'], ['ML', 'WANT A 2ND LOOK?']].forEach(([av, m], k) => {
        const a = E.outBack(P(p, k * 0.2, k * 0.2 + 0.35)); if (a <= 0) return;
        const y = Y + 6 + k * 30;
        rect(X + 6, y + 4, 14, 14, [C.blue, C.violet, C.peach][k]); txt(av, X + 13, y + 7, { size: 8, font: 'skb', color: C.ink, align: 'center' });
        box(X + 24, y, R(104 * clamp(a, 0, 1.1)), 22, 'rgba(143,180,255,.25)', C.blue);
        if (a > 0.8) { txt(m, X + 28, y + 4, { size: 8, font: 'sk', color: C.white }); txt('QUEUED', X + 124, y + 13, { size: 8, font: 'sk', color: C.peach, align: 'right' }); }
      });
    }
    g.restore();
    // progress bar for the level
    rect(130, 140, 132, 3, C.navy); rect(130, 140, R(132 * p), 3, C.green);
  }
  function track(b) {          // the run, as a level: 6 checkpoints, coins, Rachel at 2x
    const y0 = 216, xs = TL.splits.map((_, i) => 46 + i * 38), prog = clamp((Math.min(b, FINAL) - GO) / (FINAL - GO));
    rect(8, y0, 254, 4, '#2a2a5a'); rect(8, y0, R(8 + prog * 246), 4, C.violet); rect(8, y0 + 4, 254, 1, '#3d3d7a');
    TL.splits.forEach(([name, T], i) => {
      const x = xs[i], done = b >= T, pop = done ? E.outBack(P(b, T, T + 0.3)) : 0;
      rect(x, y0 - 18, 1, 18, done ? C.green : C.dim);
      rect(x + 1, y0 - 18, 8, 6, done ? C.green : '#2a2a5a');
      txt(String(i + 1), x + 5, y0 + 8, { size: 8, font: 'sk', color: done ? C.green : C.dim, align: 'center' });
      if (done && b < T + 0.6) { const r2 = R(4 + 10 * P(b, T, T + 0.6)); g.strokeStyle = `rgba(92,255,138,${1 - P(b, T, T + 0.6)})`; g.lineWidth = 1; g.strokeRect(x - r2 + 4, y0 - 15 - r2 + 3, r2 * 2, r2 * 2); }
    });
    // coins between checkpoints get collected as Rachel passes
    for (let k = 0; k < 12; k++) { const cx = 26 + k * 19; if (8 + prog * 236 < cx - 4) sprite(ICON.coin, IPAL, cx, y0 - 12 + R(Math.sin(b * 3 + k) * 1.2), 1); }
    const run = b >= GO && b < FINAL, frame = run ? ((b * 4) % 1 < 0.5 ? 'runA' : 'runB') : 'stand';
    const jump = b >= FINAL && b < FINAL + 1 ? R(Math.sin(P(b, FINAL, FINAL + 1) * Math.PI) * 18) : run ? R(Math.abs(Math.sin(b * Math.PI * 2)) * 2) : 0;
    rachel(R(6 + prog * 232), y0 - 32 - jump, 2, frame);
    txt('GOAL', 262, y0 - 30, { size: 8, font: 'sk', color: b >= FINAL ? C.gold : C.dim, align: 'right' });
  }

  function sceneRun(b) {
    hud(b); splitsPanel(b); levelPanel(b); track(b);
    // SPLIT! popups
    for (const [, T] of TL.splits) if (b >= T && b < T + 0.6 && T < FINAL) { const a = P(b, T, T + 0.6); txt('SPLIT!', 64, R(150 - a * 10), { size: 8, color: a < 0.8 ? C.green : C.dim, align: 'center', shadow: '#0f4a2a' }); }
    txt('ANY% · ALL CONNECTORS LINKED · REAL TIME', 135, 154, { size: 8, font: 'sk', color: C.dim, align: 'center' });
  }

  function sceneRecord(b) {
    hud(b); splitsPanel(b); track(b);
    box(126, 30, 140, 116, C.bg1, C.gold, '#8a6a20');
    const cyc = [C.gold, C.peach, C.violet, C.blue][Math.floor(b * 8) % 4];
    txt('NEW', 196, 50, { size: 16, color: cyc, align: 'center', depth: 2, shadow: '#3a2010' });
    txt('RECORD!', 196, 72, { size: 16, color: cyc, align: 'center', depth: 2, shadow: '#3a2010' });
    txt(fmtFloor((FINAL - GO) * BEAT), 196, 100, { size: 16, color: C.white, align: 'center', shadow: '#2b2160' });
    if (b >= 31.6) {
      const press = b >= 32 && b < 32.25, ok = b >= 32;
      box(144, 122, 104, 18, ok ? C.green : C.violet, C.white);
      txt(ok ? '6/6 APPROVED' : 'APPROVE ALL [A]', 196, R(127 + (press ? 1 : 0)), { size: 8, font: 'skb', color: C.ink, align: 'center' });
    } else txt('ALL 6 DRAFTED', 196, 126, { size: 8, font: 'sk', color: C.peach, align: 'center' });
  }

  function sceneBoard(b) {
    txt('TOP RUNS', 135, 34, { size: 16, color: GRAD, align: 'center', depth: 2, shadow: '#2b2160' });
    const rows = [['1', 'RACHEL + MILA', fmtFloor((FINAL - GO) * BEAT), C.gold], ['2', '12 APPS + COFFEE', 'DNF', C.red], ['3', 'ALL BY HAND', 'DNF', C.red]];
    rows.forEach(([n, who, tm, col], k) => {
      const T = TL.board + k * 0.5, a = E.outExpo(P(b, T, T + 0.4)); if (a <= 0) return;
      const y = 70 + k * 30, x = R(lerp(300, 12, a));
      box(x, y, 246, 24, k ? C.bg1 : '#241d4a', k ? C.dim : C.gold);
      txt(n, x + 10, y + 8, { size: 8, color: col }); txt(who, x + 28, y + 8, { size: 8, color: k ? C.dim : C.white }); txt(tm, x + 238, y + 8, { size: 8, color: col, align: 'right' });
      if (!k) sprite(ICON.star, IPAL, x + 236 - 70, y + 8, 1);
    });
    txt('MILA DRAFTS IT. RACHEL APPROVES IT.', 135, 170, { size: 8, font: 'sk', color: C.peach, align: 'center' });
  }

  function sceneEnd(b) {
    const a = E.outBack(P(b, 36, 36.5)), size = a < 0.5 ? 16 : 32;
    txt('MILA', 135, R(60 + (1 - clamp(a)) * 20), { size, color: GRAD, align: 'center', depth: size === 32 ? 4 : 2, shadow: '#2b2160' });
    if (b >= 36.6) { txt('YOUR AI OPERATIONS MANAGER', 135, 112, { size: 8, font: 'skb', color: C.white, align: 'center' }); txt('FOR REAL ESTATE', 135, 123, { size: 8, font: 'skb', color: C.white, align: 'center' }); }
    if (b >= 37) { const blink = b < 38.5 || ((b * 2) % 1) < 0.75; if (blink) txt('COMMENT "MILA"', 135, 150, { size: 16, color: [C.gold, C.gold, '#e0a838'], align: 'center', depth: 2, shadow: '#5a3a10' }); }
    if (b >= 37.5) txt('FOR A 7-DAY FREE TRIAL', 135, 176, { size: 8, color: C.white, align: 'center', shadow: C.navy });
    if (b >= 37.5) for (let k = 0; k < 5; k++) sprite(ICON.coin, IPAL, 100 + k * 16, R(196 + Math.sin(b * 4 + k) * 2), 1);
  }

  /* particles (deterministic bursts) */
  const BURSTS = [[12, 60, C.white], [30, 70, C.gold], [36, 40, C.violet], ...TL.splits.slice(0, 5).map(s => [s[1], 14, C.green])];
  function particles(b) {
    for (const [T, n, col] of BURSTS) {
      if (b < T || b > T + 1.6) continue; const r = rng(T * 100 + n), a = (b - T) / 1.6;
      const cx = T === 30 ? 196 : T === 36 ? 135 : T === 12 ? 135 : 64, cy = T === 30 ? 80 : T === 36 ? 76 : T === 12 ? 130 : 37 + TL.splits.findIndex(s => s[1] === T) * 18;
      for (let k = 0; k < n; k++) { const ang = r() * TAU, sp = 30 + r() * 110, x = cx + Math.cos(ang) * sp * a, y = cy + Math.sin(ang) * sp * a + 60 * a * a, s = r() < 0.3 ? 2 : 1;
        if (a < 1 - r() * 0.4) rect(x, y, s, s, [col, C.peach, C.blue][Math.floor(r() * 3)]); }
    }
  }

  // ordered-dither dissolve mask (Bayer 4x4) for the loop transition
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const tmp = document.createElement('canvas'); tmp.width = LW; tmp.height = LH; const tg = tmp.getContext('2d'); tg.imageSmoothingEnabled = false;

  /* ================================================================ RENDER */
  function frame(b, raw) {
    const warp = b >= 8 && b < 12 ? E.inCubic(P(b, 8, 12)) : b >= 12 && b < 12.6 ? 1 - P(b, 12, 12.6) : 0;
    drawBackground(raw, warp);
    // shake
    let sx = 0, sy = 0; const sh = (b >= 8 && b < 12 ? 1.5 * P(b, 8, 12) : 0) + pulseAt(b, 12, 5) * 4 + pulseAt(b, 30, 6) * 3 + pulseAt(b, 36, 6) * 3 + [9, 10, 11].reduce((s, T) => s + pulseAt(b, T, 9) * 2, 0);
    if (sh > 0.3) { sx = R(Math.sin(b * 97) * sh); sy = R(Math.cos(b * 71) * sh); }
    g.save(); g.translate(sx, OY + sy);
    const groundY = 250;
    if (b < 4) { arcadeBar(b, 'CREDIT 0'); sceneTitle(b); }
    else if (b < 8) { arcadeBar(b, 'CREDIT 1'); sceneLoadout(b); }
    else if (b < 12) sceneCountdown(b);
    else if (b < FINAL) sceneRun(b);
    else if (b < TL.board) sceneRecord(b);
    else if (b < TL.logo) sceneBoard(b);
    else sceneEnd(b);
    g.restore();
    // ground strip + runner live below the stage content (bottom of the canvas in every format)
    const gy = LH - 6;                                       // skyline sits on the bottom edge in every format
    drawSkyline(raw, gy);
    g.save(); g.translate(sx, OY + sy); particles(b); g.restore();
    // GO! overlay + flash
    if (b >= 12 && b < 13.2) { const a = P(b, 12, 13.2), size = a < 0.15 ? 64 : a < 0.3 ? 48 : 40; if (a < 0.85) txt('GO!', 135, OY + 118 - size / 2 + R(-a * 30), { size, color: [C.green, C.green, '#2fbf62'], align: 'center', depth: 4, shadow: '#0f4a2a' }); }
    const fl = Math.max(pulseAt(b, 12, 7), pulseAt(b, 30, 9) * 0.6, pulseAt(b, 36, 9) * 0.5, b >= 7.9 && b < 8.1 ? 0.3 : 0);
    if (fl > 0.02) rect(0, 0, LW, LH, `rgba(255,255,255,${fl})`);
    // scene wipes (pixel blinds) at b4, b8, b33.5, b36
    for (const T of [4, 8, TL.board, TL.logo]) if (b >= T - 0.25 && b < T + 0.25) { const a = 1 - Math.abs(b - T) / 0.25; for (let y = 0; y < LH; y += 8) rect(0, y, LW, R(8 * a), C.bg0); }
  }

  function render(t) {
    const raw = t / BEAT;
    const tailStart = TL.loopTail[0];
    if (raw < tailStart) frame(raw, raw);
    else {
      // dissolve from the end card to the exact frame-0 title, ordered dither
      frame(raw, raw); tg.clearRect(0, 0, LW, LH); tg.drawImage(cv, 0, 0);
      frame(0, raw);                                         // title, with loop-periodic ambient motion
      const a = clamp((raw - tailStart) / (TL.loopTail[1] - 0.12 - tailStart));
      if (a < 1) {
        const thr = a * 16, id = tg.getImageData(0, 0, LW, LH), d = id.data;
        for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) if (BAYER[(y & 3) * 4 + (x & 3)] < thr) d[(y * LW + x) * 4 + 3] = 0;
        tg.putImageData(id, 0, 0); g.drawImage(tmp, 0, 0);
      }
    }
    // bloom copy
    bg.clearRect(0, 0, LW, LH); bg.drawImage(cv, 0, 0);
  }

  /* ---------------------------------------------------------------- boot */
  window.renderFrame = render; window.DURATION = DUR;
  for (const tw of [0, 5, 9, 12.5, 16, 19, 22, 25, 28, 31, 34, 37, 39.5, 39.95]) render(tw * BEAT);
  render(0); window.__ready = true;
  if (!RENDER) {
    const aud = document.getElementById('aud'), pp = document.getElementById('pp'), scrub = document.getElementById('scrub'), tc = document.getElementById('tc'); scrub.max = DUR; let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (aud.currentTime >= DUR - 0.05) aud.currentTime = 0; aud.play(); } else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; render(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; render(t); scrub.value = t; tc.textContent = t.toFixed(2) + 's'; if (t >= DUR) { playing = false; pp.textContent = 'Play'; } } requestAnimationFrame(loop); };
    loop();
  }
})();
