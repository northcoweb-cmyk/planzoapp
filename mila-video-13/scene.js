/* Mila film #13 — "Viral" (4:5 feed).
 * render(t) is a pure function of time; cues are beats b of "Can You Just Relax" at 128 BPM (0.46875 s).
 * BUILD (the song's breakdown): one listing post on Rachel's phone b0 · notifications + carousel b2-8 ·
 * the camera pulls back and the post lights up the phones around it b8-14 · "And then…" + reverb hang b15 ·
 * DROP b16: exponential zoom-out, the phone becomes one screen in a tilted city of screens lighting up on every beat ·
 * b19.55 whip back in to the same phone: 214 DMs b20 · Mila sorts, drafts, you approve b21-24 · 6 showings b24-27 ·
 * payoff b27 · kicker photos b28-32 · "One post. Mila handles the rest." b32-33 · end card b34 · loop tail b42-44.
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
    outBack: p => { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    spring: p => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-6.2 * p) * Math.cos(9.5 * p)),
  };
  const TAU = Math.PI * 2, per = (b, k) => Math.sin(TAU * k * b / TOT), perc = (b, k) => Math.cos(TAU * k * b / TOT);
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const hash = (i, j, k = 0) => { let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(k + 1, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const set = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const vis = (el, on) => { el.style.visibility = on ? 'inherit' : 'hidden'; };
  const pulseAt = (b, T, k = 8) => (b >= T ? Math.exp(-(b - T) * k) : 0);
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const PHOTOS = ['cliff_pool', 'palm_estate', 'cliff_sunset', 'conservatory', 'living_room'];
  const img = n => `url(assets/photos/${n}.jpg)`;
  const svg = (d, s = 40, w = 2.2, fill = 'none') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const I = {
    heart: '<path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4 7.4 4c2 0 3.6 1.1 4.6 2.6C13 5.1 14.6 4 16.6 4c3.5 0 5.8 3.6 4.6 7.1-1.7 4.8-9.2 9.4-9.2 9.4z"/>',
    cmt: '<path d="M20.5 11.6a8.4 8.4 0 0 1-12.3 7.5L3.5 20.5l1.4-4.5a8.4 8.4 0 1 1 15.6-4.4z"/>',
    snd: '<path d="M21 3 10.2 13.8M21 3l-6.8 18-4-7.2L3 9.8 21 3z"/>',
    sav: '<path d="M18.5 21 12 16.5 5.5 21V4.5A1.5 1.5 0 0 1 7 3h10a1.5 1.5 0 0 1 1.5 1.5V21z"/>',
    share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13"/>',
    msg: '<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 1 1 21 11.5z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  };
  const NOTIF_ICON = t => t.includes('liked') ? I.heart : t.includes('shared') ? I.share : t.includes('saved') ? I.sav : I.msg;

  /* ---------------------------------------------------------------- phone UI */
  $('#track').innerHTML = PHOTOS.map((p, i) => `<div style="background-image:${img(p)}">${i === 0 ? `<div class="ov"><b>Just listed.</b><div class="mono">2884 Cliffside Dr · Malibu, CA</div><div class="price">$50,000,000 · 9 bd · 15 ba</div></div>` : ''}</div>`).join('');
  $('#heart').innerHTML = svg(I.heart); $('.cmt').innerHTML = svg(I.cmt); $('.snd').innerHTML = svg(I.snd); $('.sav').innerHTML = svg(I.sav);
  $('#banners').innerHTML = TL.notifs.map(([, u, t]) => `<div class="bn"><div class="ai">${svg(NOTIF_ICON(t), 30, 2.4)}</div><div><div class="ap">coastline.realty</div><div class="tx"><b>${u}</b> ${t}</div></div><span class="tm">now</span></div>`).join('');
  const BANNERS = $$('#banners .bn');
  $('#rows').innerHTML = TL.dms.map(([u, m], i) => `<div class="dm"><div class="da" style="background:linear-gradient(140deg,hsl(${(i * 47 + 200) % 360} 70% 70%),hsl(${(i * 47 + 250) % 360} 60% 55%))"></div><div><div class="dn">${u}</div><div class="dt">${m}</div></div><i class="du"></i></div>`).join('');
  const ROWS = $$('#rows .dm');
  const DRAFT = 'Hi Jordan! Yes, it’s still available. I can show it Saturday at 10:00 or 11:30. Which works for you?';
  const BARS = [['Serious buyers', 38], ['Tour requests', 21], ['Agents & lenders', 9], ['General questions', 146]];
  $('#sheet').innerHTML = `<div class="grab"></div><div class="mh"><div class="orb"></div><div><div class="mn">Mila</div><div class="ms">FOR RACHEL</div></div></div>
    <div class="sec" id="sec1"><div class="st">Sorted 214 DMs.</div>${BARS.map(([l, n]) => `<div class="bar"><div class="bl"><span>${l}</span><span>${n}</span></div><div class="bt"><i></i></div></div>`).join('')}</div>
    <div class="sec" id="sec2"><div class="st">214 replies drafted.</div><div class="rto">TO: JORDAN.ELLIS</div><div class="rbub" id="draftT"></div><div class="dchips"><i>Tour times</i><i>HOA info</i><i>Price &amp; terms</i><i>Open house</i></div></div>
    <div class="sec" id="sec3"><div class="st">Ready when you are.</div><div class="dchips"><i>214 replies</i><i>21 tour invites</i><i>38 buyers tagged</i></div><div class="apb" id="apb"><b id="apFill"></b><span id="apTx">Approve all</span></div></div>`;
  const SECS = [$('#sec1'), $('#sec2'), $('#sec3')];

  /* ---------------------------------------------------------------- shots (after the world part) */
  const SH = [];
  const shot = (a, b, html, upd, opts = {}) => { const el = document.createElement('div'); el.className = 'full'; el.innerHTML = html; $('#shots').appendChild(el); const s = { a, b, el, upd, ...opts }; SH.push(s); return s; };
  shot(24, 27, `<div class="ph" style="background-image:${img('cliff_sunset')};filter:blur(26px) brightness(.5) saturate(1.1)"></div>
    <div class="card dglass" style="top:200px"><div class="k">Showings · confirmed</div><div class="t">This weekend.</div>
    ${TL.showings.map(([, r], i) => `<div class="row"><span class="cn">${i + 1}</span>${r}<span class="ok">BOOKED ${svg(I.check, 18, 3)}</span></div>`).join('')}</div>
    <div class="mono" id="fromOne" style="position:absolute;left:0;right:0;top:1170px;text-align:center;color:rgba(255,255,255,.7)">All from one post</div>`, (b, s) => {
    const c = E.outExpo(P(b, 24, 24.35)); set(s.el.querySelector('.card'), { transform: `translateY(${(1 - c) * 120}px) scale(${0.94 + 0.06 * c})`, opacity: clamp(c * 2) });
    $$('.row', s.el).forEach((d, i) => { const a = E.spring(P(b, TL.showings[i][0], TL.showings[i][0] + 0.45)); set(d, { transform: `translateX(${(1 - a) * 260}px)`, opacity: clamp(a * 2) }); });
    s.el.querySelector('.ph').style.transform = `scale(${1.15 - 0.06 * P(b, 24, 27)})`;
    $('#fromOne').style.opacity = E.outCubic(P(b, 26.7, 27));
  });
  shot(27, 28, `<div class="ph" style="background-image:${img('cliff_pool')};filter:brightness(.42) saturate(.9)"></div>
    <div class="serifW" id="sixS" style="top:560px;font-size:200px">6 showings</div>
    <div class="serifW" style="top:770px;font-size:190px"><span class="gtx" style="font-style:italic">booked.</span></div><div class="mono" style="position:absolute;left:0;right:0;top:905px;text-align:center;color:rgba(255,255,255,.75)">From one post</div>`, (b, s) => {
    const k = E.outExpo(P(b, 27, 27.35)); set($('#sixS'), { transform: `translate(-50%,-50%) scale(${1.2 - 0.2 * k})` });
    const k2 = E.outExpo(P(b, 27.15, 27.5)); set(s.el.querySelectorAll('.serifW')[1], { transform: `translate(-50%,-50%) translateY(${(1 - k2) * 60}px)`, opacity: k2 });
    s.el.querySelector('.ph').style.transform = `scale(${1.12 - 0.05 * P(b, 27, 28)})`;
  });
  TL.kicker.forEach(([w, a, p], i) => shot(a, a + 1, `<div class="ph" style="background-image:${img(p)}"></div><div class="fill" style="background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,0) 30%,rgba(0,0,0,0) 55%,rgba(0,0,0,.55))"></div>
    <div class="mono lab">2884 Cliffside Dr · Malibu, CA</div><div class="kw" style="font-size:${w.length > 8 ? 200 : 230}px">${w}</div>`, (b, s) => {
    const k = E.outExpo(P(b, a, a + 0.22)), dir = i % 2 ? -1 : 1, ph = s.el.querySelector('.ph');
    ph.style.transform = `translateX(${(1 - k) * 420 * dir}px) scale(${1.16 - 0.07 * P(b, a, a + 1)})`; ph.style.filter = k < 0.97 ? `blur(${(1 - k) * 20}px)` : 'none';
    const w2 = E.outExpo(P(b, a + 0.05, a + 0.4)); set(s.el.querySelector('.kw'), { transform: `translateY(${(1 - w2) * 80}px)`, opacity: w2, clipPath: `inset(${(1 - w2) * 100}% 0 0 0)` });
  }, { cut: true }));
  shot(32, 33, `<div class="serifW" style="top:675px;font-size:190px">One post.</div>`, (b, s) => {
    const k = E.outExpo(P(b, 32, 32.35)); set(s.el.querySelector('.serifW'), { transform: `translate(-50%,-50%) scale(${1.25 - 0.25 * k})`, opacity: k, filter: `blur(${(1 - k) * 10}px)` });
  });
  shot(33, 34, `<div class="serifW" style="top:600px;font-size:150px">Mila handles</div><div class="serifW" style="top:770px;font-size:170px"><span class="gtx" style="font-style:italic">the rest.</span></div>`, (b, s) => {
    $$('.serifW', s.el).forEach((d, i) => { const k = E.outExpo(P(b, 33 + i * 0.25, 33.35 + i * 0.25)); set(d, { transform: `translate(-50%,-50%) translateY(${(1 - k) * 70}px)`, opacity: k }); });
  });
  shot(34, 43.9, `<div id="wordmark">Mila</div><div id="tagline"><div class="ln"><span>Your AI operations manager for real estate.</span></div></div>
    <div id="cta"><div class="ln"><span>Comment <span class="q">“Mila”</span></span></div><div class="ln"><span>for a 7-day free trial.</span></div></div>`, (b) => {
    const rise = E.outExpo(P(b, 34, 35.7));
    set($('#wordmark'), { top: (330 + 90 * (1 - rise)) + 'px', opacity: E.outCubic(P(b, 34, 34.5)), transform: `translateX(-50%) scale(${0.9 + 0.1 * rise})`, filter: `blur(${(1 - E.outCubic(P(b, 34, 35))) * 14}px)` });
    set($('#tagline'), { top: '630px', transform: 'translateX(-50%)' }); reveal($('#tagline .ln > span'), b, 34.7, 1.0);
    set($('#cta'), { top: '720px', transform: 'translateX(-50%)' }); $$('#cta .ln > span').forEach((s, j) => reveal(s, b, 35.3 + j * 0.45, 0.9));
  }, { end: true });

  /* ---------------------------------------------------------------- assets */
  await document.fonts.load('400 40px "Instrument Serif"'); await document.fonts.load('italic 40px "Instrument Serif"'); await document.fonts.load('600 16px "Inter"'); await document.fonts.load('700 16px "DejaVu Sans Mono"'); await document.fonts.ready;
  const IMG = await Promise.all(PHOTOS.map(n => new Promise(r => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = `assets/photos/${n}.jpg`; })));
  function reveal(span, b, b0, dur = 0.8) { const p = E.outExpo(P(b, b0, b0 + dur)); span.style.transform = `translateY(${(1 - p) * 112}%)`; span.style.opacity = p > 0 ? 1 : 0; span.style.filter = p < 1 ? `blur(${(1 - p) * 6}px)` : 'none'; }

  /* ---------------------------------------------------------------- phone sprites for the city (mipmapped) */
  const SW = 310, SHh = 645;
  function rr(x, c, y, w, h, r) { x.beginPath(); x.roundRect(c, y, w, h, r); }
  function phoneSprite(photo) {
    const c = document.createElement('canvas'); c.width = SW; c.height = SHh; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, SW, SHh); g.addColorStop(0, '#4a4c57'); g.addColorStop(0.3, '#17181d'); g.addColorStop(0.7, '#0d0e12'); g.addColorStop(1, '#3a3c46');
    x.fillStyle = g; rr(x, 0, 0, SW, SHh, 46); x.fill();
    x.save(); rr(x, 7, 7, SW - 14, SHh - 14, 39); x.clip();
    x.fillStyle = photo ? '#0b0c11' : '#0d0f17'; x.fillRect(0, 0, SW, SHh);
    if (photo) {
      x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(30, 32 + 7 + 24, 14, 0, TAU); x.fill();
      x.fillStyle = 'rgba(255,255,255,.75)'; x.fillRect(52, 32 + 7 + 17, 92, 7); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(52, 32 + 7 + 28, 64, 5);
      const iy = 32 + 7 + 48, iw = SW - 14, ih = 370, sr = photo.width / photo.height, dr = iw / ih;
      let sx = 0, sy = 0, sw = photo.width, sh = photo.height; if (sr > dr) { sw = sh * dr; sx = (photo.width - sw) / 2; } else { sh = sw / dr; sy = (photo.height - sh) / 2; }
      x.drawImage(photo, sx, sy, sw, sh, 7, iy, iw, ih);
      x.fillStyle = 'rgba(255,255,255,.8)'; for (let k = 0; k < 3; k++) { x.beginPath(); x.arc(28 + k * 30, iy + ih + 22, 7, 0, TAU); x.fill(); }
      x.fillStyle = 'rgba(255,255,255,.6)'; x.fillRect(20, iy + ih + 44, 110, 7); x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(20, iy + ih + 60, 200, 6); x.fillRect(20, iy + ih + 74, 160, 6);
    } else {
      const s2 = x.createLinearGradient(0, 0, 0, SHh); s2.addColorStop(0, '#1a1d2e'); s2.addColorStop(1, '#0b0c14'); x.fillStyle = s2; x.fillRect(0, 0, SW, SHh);
    }
    x.restore();
    x.fillStyle = '#000'; rr(x, SW / 2 - 42, 15, 84, 22, 11); x.fill();
    const mips = [c]; let cur = c;
    while (cur.width > 12) { const n = document.createElement('canvas'); n.width = Math.max(6, cur.width >> 1); n.height = Math.max(12, cur.height >> 1); const nx = n.getContext('2d'); nx.imageSmoothingQuality = 'high'; nx.drawImage(cur, 0, 0, n.width, n.height); mips.push(n); cur = n; }
    return mips;
  }
  const LIT = IMG.map(phoneSprite), DARK = phoneSprite(null);
  const AVG = IMG.map(im => { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; });
  const GLOW = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(200,190,255,.55)'); g.addColorStop(1, 'rgba(166,140,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return c; })();
  const pickMip = (mips, w) => { let m = mips[0]; for (const c of mips) if (c.width >= w * 0.9) m = c; return m; };

  /* ---------------------------------------------------------------- the city of screens */
  const GX = 700, GY = 1380, SX = 540, SY = 760, PW = 620, PHH = 1290;
  const wxOf = i => i * GX + Math.floor((i + 2) / 5) * SX, wyOf = j => j * GY + Math.floor((j + 1) / 3) * SY;
  function litBeat(i, j) {
    if (i === 0 && j === 0) return -999;
    const d = Math.hypot(wxOf(i) / GX, wyOf(j) / GX), r1 = hash(i, j, 1), r2 = hash(i, j, 2), r3 = hash(i, j, 3);
    if (r3 < 0.07) return 999;                                                       // a few screens stay dark: city texture
    if (d < 5.2) { let L = 8.2 + (d - 1) * 1.3 + r1 * 0.7; if (r2 < 0.22) L = 16 + r1 * 0.5; return L; }
    let L = 16 + 3.3 * Math.pow(clamp((d - 5.2) / 70), 0.55) + (r1 - 0.5) * 0.4;
    if (r2 < 0.5) L = Math.min(19, Math.max(16, Math.round(L))) + r1 * 0.1;         // half of them land right on a beat: bursts
    return Math.max(15.95, L);
  }
  const cityCv = $('#city'), cx2 = cityCv.getContext('2d');
  const F = 1500;
  function drawCity(b, cam, opts = {}) {
    const x = cx2; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H); x.imageSmoothingQuality = 'high';
    const { s, cx, cy, tilt } = cam, th = tilt * Math.PI / 180, ct = Math.cos(th), st = Math.sin(th);
    const proj = (X, Y) => { const u = X - 540, v = Y - 675, k = F / (F - v * st); return [540 + u * k, 675 + v * ct * k, k]; };
    // the reach origin glow
    const [ox, oy] = proj(cx, cy), gl = (opts.allLit ? 0.25 : 0.35 + 0.35 * Math.exp(-(b % 1) * 4) * (b >= 16 && b < 19.6 ? 1 : 0.3));
    x.globalCompositeOperation = 'lighter'; x.globalAlpha = gl * clamp((0.5 - s) * 3); const R = 900; x.drawImage(GLOW, ox - R, oy - R * 0.8, R * 2, R * 1.6); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    // visible flat region (generous, accounts for the tilt)
    const vTop = -675 * F / (F * ct - 675 * st) - 80, vBot = 760, uMax = 560 / (F / (F - vTop * st)) + 60;
    const wx0 = (540 - uMax - cx) / s, wx1 = (540 + uMax - cx) / s, wy0 = (675 + vTop - cy) / s, wy1 = (675 + vBot - cy) / s;
    const i0 = Math.floor(wx0 / (GX + SX / 5)) - 2, i1 = Math.ceil(wx1 / (GX + SX / 5)) + 2, j0 = Math.floor(wy0 / (GY + SY / 3)) - 2, j1 = Math.ceil(wy1 / (GY + SY / 3)) + 2;
    const pings = [];
    for (let j = j0; j <= j1; j++) {
      const wy = wyOf(j);
      for (let i = i0; i <= i1; i++) {
        if (i === 0 && j === 0 && opts.skipCenter) continue;
        const wx = wxOf(i), X = cx + s * (wx - PW / 2), Y = cy + s * (wy - PHH / 2);
        const [px, py, k] = proj(X + s * PW / 2, Y + s * PHH / 2);
        const w = PW * s * k, h = PHH * s * k * ct;
        if (px + w / 2 < -10 || px - w / 2 > W + 10 || py + h / 2 < -10 || py - h / 2 > H + 10) continue;
        const L = opts.allLit ? (hash(i, j, 3) < 0.1 ? 999 : -999) : litBeat(i, j), lit = b >= L, ph = (i === 0 && j === 0) ? 0 : Math.floor(hash(i, j, 4) * 5);
        const fog = clamp(k * 1.5 - 0.35, 0.25, 1);
        x.globalAlpha = fog * (lit ? 1 : 0.55);
        if (w >= 7) x.drawImage(pickMip(lit ? LIT[ph] : DARK, w), px - w / 2, py - h / 2, w, h);
        else { const a = AVG[ph]; x.fillStyle = lit ? `rgb(${a[0] * 0.6 + 100},${a[1] * 0.6 + 100},${a[2] * 0.6 + 110})` : '#1c2033'; x.fillRect(px - w / 2, py - h / 2, Math.max(1.2, w), Math.max(2, h)); }
        if (lit && b - L < 1.2) pings.push([px, py, w, h, Math.exp(-(b - L) * 4.5) * fog]);
        if (i === 0 && j === 0 && s < 0.3) pings.push([px, py, w, h, 0.5 + 0.4 * Math.exp(-(b % 1) * 4), true]);
      }
    }
    x.globalAlpha = 1;
    // notification pings: a bloom on every screen as it lights up
    x.globalCompositeOperation = 'lighter';
    for (const [px, py, w, h, a, me] of pings) { const gw = Math.max(w * 2.4, 14), gh = Math.max(h * 1.5, 18); x.globalAlpha = a * (me ? 0.9 : 0.75); x.drawImage(GLOW, px - gw / 2, py - gh / 2, gw, gh); }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    // "you are here": a gradient ring around the original post once it is small
    const me = pings.find(p => p[5]);
    if (me) { const [px, py, w, h] = me, g = x.createLinearGradient(px - w, py - h, px + w, py + h); g.addColorStop(0, '#8fb4ff'); g.addColorStop(0.55, '#a68cff'); g.addColorStop(1, '#ffc9a8');
      x.strokeStyle = g; x.lineWidth = 3; x.beginPath(); x.roundRect(px - w / 2 - 6, py - h / 2 - 6, w + 12, h + 12, Math.max(4, w * 0.16)); x.stroke(); }
  }

  /* ---------------------------------------------------------------- camera */
  const L_S0 = Math.log(0.965), L_S1 = Math.log(0.40), L_SD = Math.log(0.428), L_SE = Math.log(0.026);
  function camAt(b) {
    let s = 1, cx = 540, cy = 960, tilt = 0;
    if (b < 8) s = 1 - 0.035 * E.inOut(P(b, 0, 8));
    else if (b < 14) { const p = E.inOut(P(b, 8, 14)); s = Math.exp(lerp(L_S0, L_S1, p)); cy = lerp(960, 720, p); }
    else if (b < 16) { s = 0.40 * (1 + 0.07 * E.inOut(P(b, 14, 15.5))); cy = 720; }
    else if (b < 19.55) { const p = P(b, 16, 19.55), q = 1 - Math.pow(1 - p, 2.3); s = Math.exp(lerp(L_SD, L_SE, q)) * (1 + 0.06 * Math.exp(-(b % 1) * 7)); cy = lerp(720, 700, p); }
    else if (b < 20) { const p = P(b, 19.55, 20), sE = Math.exp(L_SE) * (1 + 0.06 * Math.exp(-0.55 * 7)); s = Math.exp(lerp(Math.log(sE), 0, Math.pow(p, 2.6))); cy = lerp(700, 960, Math.pow(p, 1.5)); }
    else { const d = b - 20; s = 1 + 0.07 * Math.sin(d * 13) * Math.exp(-d * 7); }
    if (b >= 16 && b < 19.9) tilt = 36 * (b < 19.45 ? E.inOut(P(b, 16.3, 18.4)) : 1 - E.inOut(P(b, 19.45, 19.8)));
    return { s, cx, cy, tilt };
  }

  /* ---------------------------------------------------------------- render state */
  const R = { cam: $('#cam'), world: $('#world'), anchor: $('#anchor'), post: $('#post'), inbox: $('#inbox'), sheet: $('#sheet'), head: $('#head'), reach: $('#reach'), reachN: $('#reachN'), kick: $('#kick'),
    leak: $('#leak'), scrim: $('#scrim'), flash: $('#flash'), vig: $('#vig'), gA: $('#gA'), gB: $('#gB'), gC: $('#gC'), track: $('#track'), dots: $$('#dots i'), carN: $('#carN'), likeN: $('#likeN'), badge: $('#badge') };
  const grain = $('#grain'), gctx = grain.getContext('2d'), NOISE = [];
  { const r = rng(99); for (let k = 0; k < 8; k++) { const c = document.createElement('canvas'); c.width = 540; c.height = 675; const x = c.getContext('2d'), id = x.createImageData(540, 675); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 110; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); NOISE.push(c); } }
  const HEADS = [...TL.head, [20, '214 DMs.'], [21, 'Mila sorted them.'], [22, 'Drafted every reply.'], [23, 'You just approve.']];
  const HEAD_END = b => (b < 16 ? 15.85 : 24);
  let headIdx = -1;
  const CUT_T = [16, 20, 24, 27, ...TL.kicker.map(k => k[1]), 32, 33, 34];

  function carouselPos(b) { let pos = 0; for (const [t, idx] of TL.carousel) { const p = E.outExpo(P(b, t, t + (idx === 0 ? 0.35 : 0.3))); pos = lerp(pos, idx, p); } return pos; }

  /* ================================================================ RENDER */
  function render(t) {
    const raw = t / BEAT;
    const tail = raw >= TL.loopTail[0], tailIn = E.inOut(P(raw, 42.2, 43.85));
    const b = raw, bw = tail ? 0 : b;                  // bw: the world/phone part runs from the hook state in the loop tail
    const worldOn = b < 24 || tail;
    const cam = camAt(bw);

    /* global camera: punch-in on cuts, ambient drift (loop-periodic) */
    let cs = 1 + 0.004 * per(raw, 2), ccx = per(raw, 3) * 2, ccy = per(raw, 2) * 2;
    for (const T of CUT_T) { if (b >= T && b < T + 0.6 && !tail) cs *= 1 + 0.03 * Math.exp(-(b - T) * 9); }
    if (b >= 20 && b < 33 && !tail) { const ph = b % 1; cs *= 1 + 0.006 * Math.exp(-ph * 7); }
    R.cam.style.transform = `translate(${ccx}px,${ccy}px) scale(${cs})`;
    set(R.gA, { left: (260 + per(raw, 2) * 160) + 'px', top: (420 + perc(raw, 1) * 120) + 'px' });
    set(R.gB, { left: (840 + perc(raw, 2) * 140) + 'px', top: (820 + per(raw, 1) * 140) + 'px' });
    set(R.gC, { left: (540 + per(raw, 1) * 200) + 'px', top: 1250 + 'px' });

    /* ---------------- world: phone + city */
    vis(R.world, worldOn || (b >= 33.9 && !tail) || tail);
    const endCity = b >= 33.9 && !(tail && tailIn >= 1);
    const cityOn = (bw >= 7.8 && bw < 20.1) || endCity;
    vis(cityCv, cityOn);
    const phoneDom = worldOn && (cam.s >= 0.17 && cam.tilt < 1.5);
    vis(R.anchor, phoneDom);
    if (cityOn) {
      if (endCity && !(bw >= 7.8 && bw < 20.1)) {
        drawCity(b, { s: 0.05, cx: 540 + per(raw, 1) * 30, cy: 640 + perc(raw, 1) * 20, tilt: 40 }, { allLit: true, skipCenter: false }); cityCv.style.filter = 'none';
        cityCv.style.opacity = 0.32 * E.outCubic(P(b, 33.9, 35)) * (tail ? 1 - tailIn : 1);
      } else {
        drawCity(bw, cam, { skipCenter: phoneDom });
        cityCv.style.opacity = bw < 16 ? E.outCubic(P(bw, 7.8, 9)) : 1;
        if (bw >= 19.55) cityCv.style.filter = `blur(${8 * Math.sin(P(bw, 19.55, 20) * Math.PI)}px)`; else cityCv.style.filter = 'none';
      }
    }
    if (phoneDom) {
      const lift = tail ? (1 - tailIn) * 160 : 0;
      set(R.anchor, { transform: `translate(${cam.cx}px,${cam.cy + lift}px) scale(${cam.s})`, opacity: tail ? tailIn : 1 });
      R.anchor.style.filter = bw >= 15 && bw < 16 ? `blur(${2 * E.inCubic(P(bw, 15.2, 16))}px)` : (bw >= 19.55 && bw < 20 ? `blur(${6 * Math.sin(P(bw, 19.55, 20) * Math.PI)}px)` : 'none');
      const inboxOn = bw >= 19.7;
      vis(R.post, !inboxOn); vis(R.inbox, inboxOn); if (!inboxOn) vis(R.sheet, false);
      if (!inboxOn) {
        // carousel + likes + banners
        const pos = carouselPos(bw), vel = Math.abs(carouselPos(bw + 0.03) - pos) / 0.03;
        set(R.track, { transform: `translateX(${-pos * 592}px)`, filter: vel > 1 ? `blur(${Math.min(14, vel * 1.2)}px)` : 'none' });
        const ci = Math.round(pos); R.dots.forEach((d, i) => { d.style.background = i === ci ? '#8fb4ff' : ''; d.style.transform = `scale(${i === ci ? 1.25 : 1})`; }); R.carN.textContent = `${ci + 1}/5`;
        const lk = bw < 2 ? 12 : 12 * Math.pow(1204 / 12, Math.pow(P(bw, 2, 8), 1.2)) * (bw > 8 ? Math.pow(4.2, P(bw, 8, 16)) : 1);
        R.likeN.textContent = fmt(lk);
        const hp = bw >= 2 ? pulseAt(bw % 1, 0, 9) * (bw < 8 ? 1 : 0) : 0; $('#heart').style.transform = `scale(${1 + 0.25 * hp})`; $('#heart').style.color = bw >= 2 ? '#ff3b5c' : '#fff';
        $('#heart svg').setAttribute('fill', bw >= 2 ? '#ff3b5c' : 'none');
        BANNERS.forEach((el, k) => {
          const T = TL.notifs[k][0];
          if (bw < T || bw >= 9.2) { vis(el, false); return; }
          let slot = 0; for (let m = k + 1; m < BANNERS.length; m++) slot += E.outCubic(P(bw, TL.notifs[m][0], TL.notifs[m][0] + 0.25));
          const a = E.spring(P(bw, T, T + 0.5)), out = E.inCubic(P(bw, 8.7, 9.2));
          vis(el, slot < 2.6);
          set(el, { top: (74 + slot * 122 - (1 - a) * 150) + 'px', transform: `scale(${(0.92 + 0.08 * a) * (1 - 0.05 * slot)})`, opacity: clamp(2.6 - slot) * clamp(a * 3) * (1 - out) * (slot > 0 ? 0.85 : 1) });
        });
      } else {
        const n = TL.dms.length;
        ROWS.forEach((el, k) => {
          const T = 19.85 + k * 0.115; if (bw < T) { vis(el, false); return; } vis(el, true);
          let slot = 0; for (let m = k + 1; m < n; m++) slot += E.outCubic(P(bw, 19.85 + m * 0.115, 19.85 + m * 0.115 + 0.12));
          const a = E.outExpo(P(bw, T, T + 0.2)); set(el, { top: (slot * 112) + 'px', opacity: a, transform: `translateX(${(1 - a) * -60}px)`, background: a < 1 ? `rgba(166,140,255,${0.25 * (1 - a)})` : 'transparent' });
        });
        const cnt = Math.round(214 * E.outCubic(P(bw, 19.85, 21))); R.badge.textContent = cnt; R.badge.style.transform = `scale(${1 + 0.12 * pulseAt(bw % 0.125, 0, 40) * (bw < 21 ? 1 : 0)})`;
        // Mila sheet
        const su = E.spring(P(bw, 21, 21.45)); vis(R.sheet, bw >= 21);
        set(R.sheet, { transform: `translateY(${(1 - su) * 1000}px)` });
        SECS.forEach((el, i) => { const a0 = 21 + i, on = bw >= a0 && (i === 2 || bw < a0 + 1); vis(el, on); if (!on) return;
          const k = E.outExpo(P(bw, a0 + (i ? 0 : 0.15), a0 + (i ? 0.3 : 0.45))); set(el, { opacity: k, transform: `translateY(${(1 - k) * 40}px)` }); });
        if (bw >= 21 && bw < 22) $$('#sec1 .bt i').forEach((d, i) => { d.style.width = (100 * BARS[i][1] / 146 * E.outExpo(P(bw, 21.25 + i * 0.1, 21.75 + i * 0.1))) + '%'; });
        if (bw >= 22 && bw < 23) $('#draftT').textContent = DRAFT.slice(0, Math.floor(DRAFT.length * P(bw, 22.1, 22.75)));
        if (bw >= 23) {
          const ok = bw >= TL.approveTap, f = E.outCubic(P(bw, TL.approveTap, TL.approveTap + 0.12)), press = ok && bw < TL.approveTap + 0.2 ? 1 - 0.06 * Math.sin(P(bw, TL.approveTap, TL.approveTap + 0.2) * Math.PI) : 1;
          $('#apFill').style.opacity = f; $('#apTx').innerHTML = ok ? `All approved ${svg(I.check, 30, 3)}` : 'Approve all';
          set($('#apb'), { transform: `scale(${press})`, boxShadow: ok ? `0 0 ${80 * pulseAt(bw, TL.approveTap, 2)}px rgba(166,140,255,.95)` : 'none' });
        }
      }
    }

    const scr = !tail && bw >= 8 && bw < 19.9 ? E.outCubic(P(bw, 8, 9)) * (1 - P(bw, 19.5, 19.9)) : 0;
    R.scrim.style.opacity = scr; vis(R.scrim, scr > 0.001);

    /* ---------------- headline */
    let hi = -1; for (let k = 0; k < HEADS.length; k++) if (bw >= HEADS[k][0]) hi = k;
    const headOn = worldOn && hi >= 0 && bw < HEAD_END(bw) && !(bw >= 15.85 && bw < 20);
    vis(R.head, headOn);
    if (headOn) {
      if (hi !== headIdx) { R.head.innerHTML = `<div class="ln"><span>${HEADS[hi][1]}</span></div>`; headIdx = hi; }
      const a0 = HEADS[hi][0], nxt = hi + 1 < HEADS.length && HEADS[hi + 1][0] < HEAD_END(bw) ? HEADS[hi + 1][0] : HEAD_END(bw);
      const p = hi === 0 ? 1 : E.outExpo(P(bw, a0, a0 + 0.45)), q = E.inCubic(P(bw, nxt - 0.18, nxt));
      const sp = R.head.firstChild.firstChild;
      sp.style.transform = `translateY(${(1 - p) * 110 - q * 110}%)`; sp.style.filter = (p < 1 || q > 0) ? `blur(${(1 - p) * 6 + q * 6}px)` : 'none';
      set(R.head, { opacity: tail ? tailIn : 1, top: (bw < 8 ? 150 : bw < 16 ? lerp(150, 175, E.inOut(P(bw, 8, 14))) : 150) + 'px',
        fontSize: (bw >= 14.5 && bw < 16 ? 96 : 86) + 'px', letterSpacing: bw >= 15 && bw < 16 ? `${-0.02 + 0.03 * E.outCubic(P(bw, 15, 15.85))}em` : '' });
    }

    /* ---------------- reach counter + drop words */
    const reachOn = !tail && bw >= 8 && bw < 19.6;
    vis(R.reach, reachOn);
    if (reachOn) {
      const v = bw < 14 ? 1204 * Math.pow(9870 / 1204, P(bw, 8, 14)) : bw < 16 ? lerp(9870, 12400, P(bw, 14, 16)) : lerp(12400, 48210, E.outCubic(P(bw, 16, 19.4)));
      R.reachN.textContent = fmt(v); R.reach.style.opacity = E.outCubic(P(bw, 8, 8.5)) * (1 - P(bw, 19.4, 19.6));
    }
    const kOn = !tail && bw >= 16 && bw < 19.6;
    vis(R.kick, kOn);
    if (kOn) {
      const k = Math.min(3, Math.floor(bw - 16)), a = 16 + k, w = TL.kickDrop[k][1];
      if (R.kick.textContent !== w) R.kick.textContent = w;
      const p = E.outExpo(P(bw, a, a + 0.3));
      set(R.kick, { transform: `translate(-50%,-50%) scale(${1.3 - 0.3 * p})`, opacity: clamp(p * 3) * (1 - P(bw, 19.4, 19.58)), fontSize: (w.length > 8 ? 190 : 230) + 'px', filter: p < 1 ? `blur(${(1 - p) * 10}px)` : 'none' });
    }

    /* ---------------- shots after the world */
    for (const s of SH) {
      let on;
      if (s.end) on = b >= s.a && !(tail && tailIn >= 1);
      else on = b >= s.a && b < s.b && !tail;
      vis(s.el, on); if (!on) continue;
      s.upd(b, s);
      if (s.end) s.el.style.opacity = tail ? 1 - tailIn : 1;
    }

    /* ---------------- light leak, flashes, grain */
    const leakT = [16, 24, 27, 28, 33, 34].find(T => b >= T && b < T + 0.8);
    vis(R.leak, leakT !== undefined && !tail);
    if (leakT !== undefined) { const p = P(b, leakT, leakT + 0.8); set(R.leak, { transform: `translateX(${lerp(-1100, 1100, E.inOut(p))}px)`, opacity: Math.sin(p * Math.PI) }); }
    const fl = tail ? 0 : Math.max(b >= 15.8 && b < 16 ? 0.6 * E.inCubic(P(b, 15.8, 16)) : 0, 0.75 * pulseAt(b, 16, 5), 0.5 * pulseAt(b, 20, 7), 0.25 * pulseAt(b, 24, 7), 0.45 * pulseAt(b, 27, 6),
      ...TL.kicker.map(k => 0.3 * pulseAt(b, k[1], 10)), 0.25 * pulseAt(b, 32, 8), 0.45 * pulseAt(b, 33, 6), 0.3 * pulseAt(b, 34, 6), b >= 17 && b < 19.5 ? 0.18 * pulseAt(b % 1, 0, 9) : 0);
    R.flash.style.opacity = fl; vis(R.flash, fl > 0.002);
    const fi = Math.floor(t * 60), nz = NOISE[fi % 8], gx = (fi * 137) % 540, gy = (fi * 251) % 675;
    gctx.drawImage(nz, -gx, -gy); gctx.drawImage(nz, 540 - gx, -gy); gctx.drawImage(nz, -gx, 675 - gy); gctx.drawImage(nz, 540 - gx, 675 - gy);
    grain.style.opacity = 0.2;
  }

  /* ---------------------------------------------------------------- boot */
  window.renderFrame = render; window.DURATION = DUR;
  for (const tw of [0, 3, 6, 9, 12, 15.5, 16.3, 17.5, 19.7, 20.5, 21.5, 22.5, 23.6, 25, 27.3, 28.5, 32.3, 33.3, 36, 43, 43.95]) render(tw * BEAT);
  render(0); window.__ready = true;
  if (!RENDER) {
    const aud = $('#aud'), pp = $('#pp'), scrub = $('#scrub'), tc = $('#tc'); scrub.max = DUR; let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (aud.currentTime >= DUR - 0.05) aud.currentTime = 0; aud.play(); } else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; render(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; render(t); scrub.value = t; tc.textContent = t.toFixed(2) + 's'; if (t >= DUR) { playing = false; pp.textContent = 'Play'; } } requestAnimationFrame(loop); };
    loop();
  }
})();
