/* Mila film #22 — "Listing to Sold" (4:5 feed, 25 s). "She's Gone, Dance On" 134 BPM; the drop (2:19.858) = video b36.
 * An agent talks to Mila (voice pill on top, words light up as she speaks); Mila builds the listing on the photos:
 * drone (client footage 0:03-0:08) + address b0-6.5 · beds + price over the twilight front b6.5 · "um, actually… twelve-five" price rewrite b13.5 ·
 * open house Sat 1-4 + checklist b19.5 · showing Sun 10 -> "oh wait… eleven" moved b24.5 · under contract, "Mila… it sold." b33.5 ·
 * DROP b36: drone lands on the house, SOLD · Just Sold carousel built from the photos b40.5 · end card b50 · loop tail b54.3-56 -> frame 0.
 */
(async function () {
  const TL = await (await fetch('timeline.json')).json();
  const BEAT = TL.beat, DUR = TL.duration, TOT = TL.totalBeats;
  const RENDER = new URLSearchParams(location.search).has('render');
  if (RENDER) document.body.classList.add('render');
  const W = 1080, H = 1350, vp = document.getElementById('viewport');
  if (!RENDER) { const fit = () => { const k = Math.min(innerWidth / W, (innerHeight - 60) / H); vp.style.transformOrigin = '0 0'; vp.style.transform = `translate(${(innerWidth - W * k) / 2}px,0) scale(${k})`; }; fit(); addEventListener('resize', fit); }

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, p) => a + (b - a) * p, P = (x, x0, x1) => clamp((x - x0) / (x1 - x0));
  const E = {
    outExpo: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)), inExpo: p => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10)),
    inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2), outCubic: p => 1 - Math.pow(1 - p, 3), inCubic: p => p * p * p,
    outBack: p => { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    spring: p => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-6.2 * p) * Math.cos(9.5 * p)),
  };
  const TAU = Math.PI * 2, per = (b, k) => Math.sin(TAU * k * b / TOT), perc = (b, k) => Math.cos(TAU * k * b / TOT);
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const set = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const vis = (el, on) => { el.style.visibility = on ? 'inherit' : 'hidden'; };
  const pulseAt = (b, T, k = 8) => (b >= T ? Math.exp(-(b - T) * k) : 0);
  const img = n => `url(assets/photos/${n}.jpg)`;
  const CHECK = s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
  const GCAL = s => `<img src="assets/logos/google-calendar.svg" width="${s}" height="${s}" style="display:block">`;
  const ACAL = (s, wd = 'Friday', n = '23') => `<svg width="${s}" height="${s}" viewBox="0 0 100 100" style="display:block;filter:drop-shadow(0 2px 6px rgba(20,20,60,.18))">
    <rect x="1" y="1" width="98" height="98" rx="22.5" fill="#fff"/><rect x="1" y="1" width="98" height="98" rx="22.5" fill="none" stroke="rgba(0,0,0,.08)"/>
    <text x="50" y="28" text-anchor="middle" font-family="Inter" font-weight="550" font-size="13.5" fill="#FF3B30">${wd}</text>
    <text x="50" y="80" text-anchor="middle" font-family="Inter" font-weight="300" font-size="56" letter-spacing="-2" fill="#111">${n}</text></svg>`;

  /* ---------------------------------------------------------------- shots */
  const SH = [];
  const shot = (a, b, html, upd, opts = {}) => { const el = document.createElement('div'); el.className = 'full'; el.innerHTML = html; $('#shots').appendChild(el); const s = { a, b, el, upd, ...opts }; SH.push(s); return s; };
  const dark = (n, bri = 0.42) => `<div class="ph" style="background-image:${img(n)};filter:brightness(${bri}) saturate(.85) blur(${bri < 0.4 ? 6 : 0}px)"></div>`;

  // ================= BUILD (b0-16): quick device cuts. Laptop + phone screens, a cut every half beat, whip / zoom / glitch
  // transitions. The models are fine — it's the DIY plumbing (logins, webhooks, keys, rate limits) that keeps breaking.
  const lap = (inner, x = 70, y = 330, w = 940) => `<div class="lap" style="left:${x}px;top:${y}px;width:${w}px"><div class="lscr">${inner}</div><div class="lbase"></div></div>`;
  const phn = (inner, x = 350, y = 330) => `<div class="phn" style="left:${x}px;top:${y}px"><div class="pscr">${inner}<div class="pisl"></div></div></div>`;
  const bgp = (p, bri = 0.3) => `<div class="ph" style="background-image:${img(p)};filter:brightness(${bri}) saturate(.7) blur(10px)"></div>`;
  const cap = (txt, top = 250, size = 88) => `<div class="serifW cap" style="top:${top}px;font-size:${size}px">${txt}</div>`;
  // transitions: each cut enters with one of these, alternating, so no two cuts in a row feel the same
  function enter(el, b, a, kind) {
    const k = E.outExpo(P(b, a, a + 0.32)), dev = el.querySelector('.lap,.phn,.wall,.bigw') || el;
    if (kind === 'whipL' || kind === 'whipR') { const d = kind === 'whipL' ? 1 : -1; set(dev, { transform: `translateX(${(1 - k) * 700 * d}px)`, filter: k < 0.98 ? `blur(${(1 - k) * 24}px)` : 'none' }); }
    else if (kind === 'zoom') set(dev, { transform: `scale(${1.6 - 0.6 * k})`, filter: k < 0.98 ? `blur(${(1 - k) * 18}px)` : 'none', opacity: clamp(k * 3) });
    else if (kind === 'drop') set(dev, { transform: `translateY(${(1 - k) * -500}px) rotate(${(1 - k) * -6}deg)`, filter: k < 0.98 ? `blur(${(1 - k) * 14}px)` : 'none' });
    else if (kind === 'glitch') { const g = 1 - P(b, a, a + 0.18); set(dev, { transform: `translateX(${Math.sin(b * 300) * 30 * g}px)`, filter: g > 0.02 ? `drop-shadow(${-14 * g}px 0 0 rgba(255,50,80,.8)) drop-shadow(${14 * g}px 0 0 rgba(60,200,255,.7))` : 'none' }); }
    const c = el.querySelector('.cap'); if (c) { const q = E.outExpo(P(b, a + 0.04, a + 0.3)); set(c, { opacity: q, transform: `translate(-50%,-50%) translateY(${(1 - q) * 26}px)` }); }
  }
  const CUTS = [];
  const cut = (a, b, kind, html, upd = () => {}, o = {}) => { const s = shot(a, b, html, (bb, sh) => { enter(sh.el, bb, a, kind); upd(bb, sh); }, { cut: true, ...o }); CUTS.push(a); return s; };


  const lightBg = p => `<div class="ph" style="background-image:${img(p)};filter:blur(30px) brightness(1.15) saturate(1.1);opacity:.55"></div>`;
  const pop = (el, b, T, dy = 60, dur = 0.4) => { const a = E.spring(P(b, T, T + dur)); set(el, { transform: `translateY(${(1 - a) * dy}px) scale(${0.92 + 0.08 * a})`, opacity: clamp(a * 2.5) }); };
  const kb = (el, b, a, z = 0.08, dx = 0) => { el.style.transform = `scale(${1.08 + z * P(b, a, a + 8)}) translateX(${dx * P(b, a, a + 8)}px)`; };
  const photo = (p, pos = 'center') => `<div class="bgph" style="background-image:${img(p)};background-position:${pos}"></div><div class="shade"></div>`;
  const V = Object.fromEntries(TL.voice.map(([n, s, bb, t]) => [n, { s, b: bb, t }]));
  const VB = n => V[n].b;
  // listing card (b0-13.5): over the drone, then the twilight front
  shot(-9, 13.5, `<canvas id="drone" width="1080" height="1350"></canvas><div class="bgph" id="ph1" style="background-image:${img('sunset_front')}"></div><div class="shade"></div>
    <div class="lc" id="lc1" style="top:840px"><div class="kk"><i class="orbM"></i>New listing <span class="stp" id="cs" style="margin-left:auto;height:40px;font-size:14px">COMING SOON</span></div>
      <div class="ad" id="ad"></div><div class="ct" id="ct">Malibu, California</div>
      <div class="sp" id="sp"><span>6 bd</span><span>8 ba</span><span>7,850 sq ft</span><span>1.2 ac · ocean view</span></div>
      <div class="pr" id="pr1"><span id="pv"></span><small id="dsc">DESCRIPTION WRITTEN ✓</small></div></div>`, (b, s) => {
    const ph = $('#ph1'), on2 = b >= 6.5; vis(ph, on2); vis($('#drone'), !on2); if (on2) kb(ph, b, 6.5, 0.06, -20);
    const ADDR = '21 Sea Cliff Drive', aT = 4.38; $('#ad').textContent = ADDR.slice(0, Math.floor(ADDR.length * P(b, aT, aT + 2.4)));
    const c = E.outExpo(P(b, aT - 0.4, aT + 0.2)); set($('#lc1'), { opacity: c, transform: `translateY(${(1 - c) * 120}px)` });
    $('#ct').style.opacity = E.outCubic(P(b, 6.5, 7)); $('#cs').style.opacity = E.outCubic(P(b, 7, 7.4));
    $$('#sp span', s.el).forEach((d, i) => { const T = 9.36 + i * 0.18; vis(d, b >= T); pop(d, b, T, 30); });
    const pT = 10.83, n = Math.round(11900000 * E.outCubic(P(b, pT, pT + 1.2))); $('#pv').textContent = b >= pT ? '$' + n.toLocaleString('en-US') : '';
    vis($('#dsc'), b >= 12.2); pop($('#dsc'), b, 12.2, 20);
  }, { hook: true });
  // b13.5-19.5: "um, actually... twelve-five"
  shot(13.5, 19.5, `${photo('day_pool')}<div class="lc" id="lc2" style="top:860px"><div class="kk"><i class="orbM"></i>List price · 21 Sea Cliff Dr</div>
    <div class="pr" style="margin-top:20px"><span class="oldp" id="op">$11,900,000<b id="ob"></b></span></div>
    <div class="pr" id="np" style="margin-top:6px;font-size:130px">$12,500,000</div><div class="ct" id="nu" style="margin-top:14px;color:#a8ffcf;font-weight:650">Updated everywhere: listing, flyer copy, posts ✓</div></div>`, (b, s) => {
    kb(s.el.querySelector('.bgph'), b, 13.5, 0.07, 18); const c = E.outExpo(P(b, 13.5, 13.9)); set($('#lc2'), { opacity: c, transform: `translateY(${(1 - c) * 80}px)` });
    const T = 17.3; $('#ob').style.transform = `translateY(-50%) scaleX(${E.outCubic(P(b, T - 0.4, T))})`;
    const n = E.spring(P(b, T, T + 0.5)); vis($('#np'), b >= T); set($('#np'), { opacity: clamp(n * 2), transform: `translateY(${(1 - n) * 50}px) scale(${0.9 + 0.1 * n})`, filter: n < 0.9 ? `blur(${(1 - n) * 10}px)` : 'none' });
    vis($('#nu'), b >= 17.8); pop($('#nu'), b, 17.8, 20);
  });
  // b19.5-24.5: open house
  shot(19.5, 24.5, `${photo('great_room')}<div class="lc" id="lc3" style="top:700px"><div class="kk"><i class="orbM"></i>Calendar · open house</div>
    <div class="ad" style="font-size:84px">Saturday <span id="oh14" class="gtx" style="font-style:italic;background:linear-gradient(100deg,#b9ceff,#c9b6ff 50%,#ffd2b5);-webkit-background-clip:text;background-clip:text">1–4 PM</span></div>
    <div class="ckl">${[['Signs + flyers', 'READY'], ['Sign-in sheet', 'READY'], ['Visitor follow-ups', 'AFTER']].map(([a, z]) => `<div>${a}<em>${z} ✓</em></div>`).join('')}</div></div>`, (b, s) => {
    kb(s.el.querySelector('.bgph'), b, 19.5, 0.07, -16); const c = E.outExpo(P(b, 19.5, 19.9)); set($('#lc3'), { opacity: c, transform: `translateY(${(1 - c) * 80}px)` });
    $('#oh14').style.opacity = E.outCubic(P(b, 22.5, 22.9));
    $$('.ckl div', s.el).forEach((d, i) => { const T = 22.9 + i * 0.4; vis(d, b >= T); pop(d, b, T, 20); });
  });
  // b24.5-33.5: the showing, moved
  shot(24.5, 33.5, `${photo('primary_suite')}<div class="lc" id="lc4" style="top:720px"><div class="kk"><i class="orbM"></i>Private showing · 21 Sea Cliff Dr</div>
    <div class="ad" style="font-size:84px">Sunday <span id="t10">10:00 AM</span><span id="t11" style="position:absolute;margin-left:-0px"></span></div>
    <div class="opts" id="opts"><div>Keep</div><div id="mv">Move</div><div>Find another time</div></div>
    <div class="ct" id="mvd" style="margin-top:18px;color:#a8ffcf;font-weight:650">Moved to 11:00 AM · calendar updated ✓</div></div>`, (b, s) => {
    kb(s.el.querySelector('.bgph'), b, 24.5, 0.07, 16); const c = E.outExpo(P(b, 24.5, 24.9)); set($('#lc4'), { opacity: c, transform: `translateY(${(1 - c) * 80}px)` });
    vis($('#opts'), b >= 29.2); pop($('#opts'), b, 29.2, 20); $('#mv').classList.toggle('on', b >= 31.6);
    const sw = b >= 31.95; $('#t10').textContent = sw ? '11:00 AM' : '10:00 AM';
    if (sw) { const k = E.spring(P(b, 31.95, 32.4)); set($('#t10'), { display: 'inline-block', transform: `translateY(${(1 - k) * 40}px)`, opacity: clamp(k * 2) }); } else set($('#t10'), { transform: 'none', opacity: 1 });
    vis($('#mvd'), b >= 32.3); pop($('#mvd'), b, 32.3, 20);
  });
  // b33.5-36: under contract... "Mila... it sold."
  shot(33.5, 36, `${photo('twilight_drive')}<div class="stamp2" id="st2">UNDER CONTRACT</div>`, (b, s) => {
    const ph = s.el.querySelector('.bgph'); ph.style.transform = `scale(${1.06 + 0.06 * E.inCubic(P(b, 33.5, 36))})`; ph.style.filter = `brightness(${1 - 0.45 * P(b, 34.2, 35.9)})`;
    const k = P(b, 33.9, 34.05); set($('#st2'), { opacity: clamp(k * 3), transform: `translate(-50%,-50%) scale(${1.5 - 0.5 * E.outCubic(k)}) rotate(-4deg)` });
  });
  // DROP b36-40.5: the drone lands on the house. SOLD.
  shot(36, 40.5, `<canvas id="drone2" width="1080" height="1350"></canvas><div class="shade"></div><div class="stamp2" id="st3" style="border-color:#a8ffcf;color:#a8ffcf;top:300px">SOLD</div>
    <div class="sold" id="sd">Sold.</div><div class="soldS" id="sds"><b>$12,500,000</b>21 Sea Cliff Drive · Malibu</div>`, (b) => {
    const k = E.outExpo(P(b, 36, 36.5)); set($('#sd'), { transform: `translate(-50%,-50%) scale(${1.35 - 0.35 * k})`, opacity: k, letterSpacing: `${-0.035 + 0.06 * (1 - k)}em`, filter: k < 0.97 ? `blur(${(1 - k) * 14}px)` : 'none' });
    const q = P(b, 36, 36.15); set($('#st3'), { opacity: clamp(q * 3), transform: `translate(-50%,-50%) scale(${1.6 - 0.6 * E.outCubic(q)}) rotate(-4deg)` });
    const z = E.outExpo(P(b, 36.6, 37.1)); set($('#sds'), { opacity: z, transform: `translateY(${(1 - z) * 30}px)` });
  });
  // b40.5-50: the Just Sold post, built from the photos
  const SLS = [['twilight_drive', 'JUST SOLD', '21 Sea Cliff Drive', 'Malibu, California'], ['sunset_pool', 'OCEANFRONT', 'Sunset, every night.', 'Pool + terraces over the Pacific'],
    ['great_room', '7,850 SQ FT', 'Six beds. Eight baths.', 'Vaulted beams · chef’s kitchen'], ['primary_suite', 'SOLD AT', '$12,500,000', 'Thank you to my sellers'], ['aerial_coast', 'MALIBU', 'Next one’s yours.', 'Thinking of selling? Let’s talk.']];
  shot(40.5, 50, `${lightBg('sunset_pool')}<div class="igc"><div class="hd"><div class="av"></div>rachel.homes<span id="cc" style="margin-left:auto;font:700 16px/1 var(--mono);letter-spacing:.14em;color:#7a6be0">1/5</span></div>
    <div class="win"><div class="strip" style="width:${700 * SLS.length}px">${SLS.map(([p, a, t2, t3]) => `<div class="sl" style="background-image:${img(p)}"><div class="ov"><div class="t1">${a}</div><div class="t2">${t2}</div><div class="t3">${t3}</div></div></div>`).join('')}</div></div>
    <div class="ft">♡ ◯ ➤<div class="dots">${SLS.map(() => '<i></i>').join('')}</div></div></div>
    <div class="ban rdy" id="rd">JUST SOLD POST · <b>READY FOR YOUR OK</b></div>`, (b, s) => {
    const g = s.el.querySelector('.igc'), a = E.spring(P(b, 40.5, 41.1)); set(g, { transform: `perspective(1800px) rotateX(${(1 - a) * 14}deg) translateY(${(1 - a) * 200}px) scale(${0.94 + 0.06 * a})`, opacity: clamp(a * 2) });
    let sw = 0; TL.slides.forEach(T => sw += E.inOut(P(b, T - 0.12, T + 0.2))); s.el.querySelector('.strip').style.transform = `translateX(${-700 * sw}px)`;
    const di = Math.round(sw); $$('.igc .dots i', s.el).forEach((d, i) => d.style.background = i === di ? 'var(--violet)' : '#c9c3ff'); $('#cc').textContent = `${di + 1}/5`;
    $$('.igc .sl', s.el).forEach((d, i) => { d.style.backgroundPosition = `${50 + 8 * Math.sin((b - 40) * 0.4 + i)}% 50%`; });
    const r = E.outBack(P(b, 46.3, 46.6)); vis($('#rd'), b >= 46.3); set($('#rd'), { transform: `translateX(-50%) scale(${r})` });
  });
  // end card b50-56
  shot(50, 55.95, `<div class="full" style="background:transparent"><div class="inkS" id="ls" style="top:300px;font-size:110px">Listing to <span class="gtx" style="font-style:italic">sold.</span></div><div id="wordmark">Mila</div>
    <div id="tagline"><div class="ln"><span>Your AI operations manager for real estate.</span></div></div>
    <div id="cta"><div class="ln"><span>Start your <span class="q">7-day</span> free trial.</span></div><div class="ln"><span style="font-size:34px;font-weight:650;letter-spacing:.02em;color:#7a6be0">No card · link in bio ↑</span></div></div></div>`, (b) => {
    const l = E.outExpo(P(b, 50, 50.5)); set($('#ls'), { opacity: l, transform: `translate(-50%,-50%) translateY(${(1 - l) * 30}px)` });
    const rise = E.outExpo(P(b, 50.2, 51.8));
    set($('#wordmark'), { top: (430 + 70 * (1 - rise)) + 'px', opacity: E.outCubic(P(b, 50.2, 50.7)), transform: `translateX(-50%) scale(${0.9 + 0.1 * rise})`, filter: `blur(${(1 - E.outCubic(P(b, 50.2, 51.2))) * 14}px)` });
    set($('#tagline'), { top: '730px', transform: 'translateX(-50%)' }); reveal($('#tagline .ln > span'), b, 50.8, 999, 1.0);
    set($('#cta'), { top: '830px', transform: 'translateX(-50%)' }); $$('#cta .ln > span').forEach((sp, j) => reveal(sp, b, 51.4 + j * 0.45, 999, 0.9));
  }, { end: true });

  /* ---------------------------------------------------------------- assets */
  // the voice pill lives outside the camera so it never shakes
  const vpEl = document.createElement('div'); vpEl.id = 'vp'; vpEl.innerHTML = `<div class="mic">${[0, 1, 2, 3, 4].map(() => '<i></i>').join('')}</div><div class="vt" id="vt"></div>`; vp.appendChild(vpEl);
  await document.fonts.load('400 40px "Instrument Serif"'); await document.fonts.load('italic 40px "Instrument Serif"'); await document.fonts.load('600 16px "Inter"'); await document.fonts.load('700 16px "DejaVu Sans Mono"'); await document.fonts.ready;
  const PHOTOS = [...new Set([...document.body.innerHTML.matchAll(/assets\/photos\/([a-z_]+)\.jpg/g)].map(m => m[0]))];
  await Promise.all(PHOTOS.map(n => new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = n; })));
  const DR = await Promise.all(Array.from({ length: TL.droneN }, (_, i) => new Promise(r => { const im = new Image(); im.onload = () => im.decode().then(() => r(im), () => r(im)); im.onerror = () => r(null); im.src = `assets/drone/d_${String(i + 1).padStart(4, '0')}.jpg`; })));
  const dctx = $('#drone').getContext('2d'), dctx2 = $('#drone2').getContext('2d');
  const drawDrone = (ctx, f) => { const im = DR[clamp(Math.round(f), 0, TL.droneN - 1)]; if (im) ctx.drawImage(im, 0, 0, 1080, 1350); };
  function reveal(span, b, b0, outB = 999, dur = 0.8) { const p = E.outExpo(P(b, b0, b0 + dur)), q = E.inCubic(P(b, outB, outB + 0.35)); span.style.transform = `translateY(${(1 - p) * 112 - q * 112}%)`; span.style.opacity = p > 0 ? 1 : 0; span.style.filter = (p < 1 || q > 0) ? `blur(${(1 - p) * 6 + q * 6}px)` : 'none'; }
  const R = { cam: $('#cam'), light: $('#light'), lbT: $('#lbT'), lbB: $('#lbB'), leak: $('#leak'), flash: $('#flash'), vig: $('#vig'), gA: $('#gA'), gB: $('#gB'), gC: $('#gC') };
  vis($('#counter'), false); vis(R.lbT, false); vis(R.lbB, false);
  const grain = $('#grain'), gctx = grain.getContext('2d'), NOISE = [];
  { const r = rng(99); for (let k = 0; k < 8; k++) { const c = document.createElement('canvas'); c.width = 540; c.height = 675; const x = c.getContext('2d'), id = x.createImageData(540, 675); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 110; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); NOISE.push(c); } }

  /* ================================================================ RENDER */
  const CUT_T = [6.5, 13.5, 19.5, 24.5, 33.5, 36, 40.5, 50];
  function render(t) {
    const b = t / BEAT, tail = b >= TL.loopTail[0], tailIn = E.inOut(P(b, TL.loopTail[0], TL.loopTail[1] - 0.1));
    const lightWorld = b >= 40.4 && !tail;
    let cs = 1 + 0.004 * per(b, 2), cx = per(b, 3) * 2, cy = per(b, 2) * 2;
    for (const T of CUT_T) if (b >= T && b < T + 0.6) cs *= 1 + 0.03 * Math.exp(-(b - T) * 9);
    if (b >= 36 && b < 50) { const ph = b % 1; cs *= 1 + 0.008 * Math.exp(-ph * 7); }
    R.cam.style.transform = `translate(${cx}px,${cy}px) scale(${cs})`;
    vis(R.light, lightWorld || (b >= 49.9 && b < 55.95));
    if (R.light.style.visibility !== 'hidden') {
      set(R.gA, { left: (240 + per(b, 2) * 160) + 'px', top: (480 + perc(b, 1) * 140) + 'px', opacity: 0.8 });
      set(R.gB, { left: (860 + perc(b, 2) * 140) + 'px', top: (760 + per(b, 1) * 160) + 'px', opacity: 0.75 });
      set(R.gC, { left: (540 + per(b, 1) * 220) + 'px', top: 1180 + 'px', opacity: 0.7 });
      R.light.style.opacity = tail ? 1 - tailIn : 1;
    }
    for (const s of SH) {
      let on;
      if (s.hook) on = b < s.b || tail;
      else if (s.end) on = b >= s.a && b < 55.95;
      else on = b >= s.a && b < s.b && !tail;
      vis(s.el, on); if (!on) continue;
      if (s.hook) { s.upd(tail ? 0 : b, s); s.el.style.opacity = tail ? tailIn : 1; }
      else if (s.end) { s.upd(b, s); s.el.style.opacity = tail ? 1 - tailIn : 1; }
      else s.upd(b, s);
    }
    // drone frames: part 1 plays b0-6.5 from frame 0; part 2 b36-40.5 from frame 175
    const tt = tail ? 0 : t;
    if (b < 6.5 || tail) drawDrone(dctx, tt * 60 * (175 / (6.5 * BEAT * 60)));
    if (b >= 36 && b < 40.5) drawDrone(dctx2, 175 + (b - 36) * BEAT * 60);
    // voice pill: the line being spoken lights up word by word
    const cur = TL.voice.filter(([, s]) => t >= s - 0.15).pop();
    const showVp = cur && t < cur[1] + 2.6 && b < 41 && !tail;
    vis(vpEl, !!showVp);
    if (showVp) {
      const [n, s, , txt] = cur, dur = { l1: 5.46, l2: 2.28, l3: 1.96, l4: 3.71, l5: 1.34, l6: 1.41 }[n], w = txt.split(' '), k = Math.floor(w.length * P(t, s, s + dur)) + 1;
      $('#vt').innerHTML = w.map((x, i) => i < k ? x : `<span>${x}</span>`).join(' ');
      const speaking = t >= s && t < s + dur, a = E.outExpo(P(t, s - 0.15, s + 0.1));
      set(vpEl, { opacity: a * (1 - P(t, s + dur + 1.6, s + dur + 2.5)), transform: `translateY(${(1 - a) * -20}px)` });
      $$('#vp .mic i').forEach((d, i) => { d.style.height = (speaking ? 10 + 20 * Math.abs(Math.sin(t * (9 + i * 2.3) + i)) : 8) + 'px'; });
    }
    const leakT = [6.5, 36, 40.5, 50].find(T => b >= T && b < T + 0.8);
    vis(R.leak, leakT !== undefined && !tail);
    if (leakT !== undefined) { const p = P(b, leakT, leakT + 0.8); set(R.leak, { transform: `translateX(${lerp(-1100, 1100, E.inOut(p))}px)`, opacity: Math.sin(p * Math.PI) }); }
    const fl = tail ? 0 : Math.max(b >= 35.9 && b < 36 ? P(b, 35.9, 36) : 0, 0.9 * pulseAt(b, 36, 5), 0.25 * pulseAt(b, 6.5, 10), 0.3 * pulseAt(b, 40.5, 8), 0.3 * pulseAt(b, 50, 6), 0.2 * pulseAt(b, 17.3, 10));
    R.flash.style.opacity = fl; vis(R.flash, fl > 0.002);
    R.vig.style.opacity = lightWorld ? 0.3 : 0.9;
    const fi = Math.floor(t * 60), nz = NOISE[fi % 8], gx = (fi * 137) % 540, gy = (fi * 251) % 675;
    gctx.drawImage(nz, -gx, -gy); gctx.drawImage(nz, 540 - gx, -gy); gctx.drawImage(nz, -gx, 675 - gy); gctx.drawImage(nz, 540 - gx, 675 - gy);
    grain.style.opacity = lightWorld ? 0.1 : 0.16;
  }
  window.renderFrame = render; window.DURATION = DUR;
  for (let tw = 0; tw < TOT; tw += 0.5) render(tw * BEAT);
  render(0); window.__ready = true;
  if (!RENDER) {
    const aud = $('#aud'), pp = $('#pp'), scrub = $('#scrub'), tc = $('#tc'); scrub.max = DUR; let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (aud.currentTime >= DUR - 0.05) aud.currentTime = 0; aud.play(); } else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; render(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; render(t); scrub.value = t; } requestAnimationFrame(loop); }; loop();
  }
})();
