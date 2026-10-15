/* Mila film #14 — "The Match" (4:5 feed).
 * render(t) is a pure function of time; cues are beats b of "Real Love" at 128 BPM (0.46875 s).
 * BUILD: new client Maya, budget + must-haves b0-5 · the ask typed to Mila b5-8 · Mila searches a live map of Manhattan,
 * 4,812 listings filtered on the beat down to 3 b8-14 · "Found 3." + reverb hang b14-16 ·
 * DROP b16: match 1/2/3 slam in, one per beat · shortlist b19 · sent to Maya b20 · "The 3rd one!!" b21.75 ·
 * the 3rd thumbnail expands into the apartment b22.75 · more photos pop in b24-25 · settle + every must-have checked b26-30 ·
 * tour booked b30 · kicker photos b32-36 · "Your client's wishlist. Mila finds the match." b36-38 · end card b38 · loop tail b50-52.
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
  const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const set = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const vis = (el, on) => { el.style.visibility = on ? 'inherit' : 'hidden'; };
  const pulseAt = (b, T, k = 8) => (b >= T ? Math.exp(-(b - T) * k) : 0);
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const img = n => `url(assets/photos/${n}.jpg)`;
  const svg = (d, s = 24, w = 2.6) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const CHECK = s => svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', s, 3);
  const ARROW = svg('<path d="M12 18.5V5.5M6 11.5 12 5.5l6 6"/>', 36, 2.6);
  const HEART = '<svg width="40" height="40" viewBox="0 0 24 24" fill="#ff5c7a"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4 7.4 4c2 0 3.6 1.1 4.6 2.6C13 5.1 14.6 4 16.6 4c3.5 0 5.8 3.6 4.6 7.1-1.7 4.8-9.2 9.4-9.2 9.4z"/></svg>';
  function reveal(span, b, b0, dur = 0.8) { const p = E.outExpo(P(b, b0, b0 + dur)); span.style.transform = `translateY(${(1 - p) * 112}%)`; span.style.opacity = p > 0 ? 1 : 0; span.style.filter = p < 1 ? `blur(${(1 - p) * 6}px)` : 'none'; }
  const head = (txt, top, size = 90) => `<div class="serifW hd" style="top:${top}px;font-size:${size}px"><div class="ln"><span>${txt}</span></div></div>`;
  const REQ_SHORT = ['1–2 bed', 'Natural light', 'Doorman', 'In-unit laundry', 'Near the subway', 'Dog-friendly'];

  /* ---------------------------------------------------------------- shots */
  const SH = [];
  const shot = (a, b, html, upd, opts = {}) => { const el = document.createElement('div'); el.className = 'full'; el.innerHTML = html; $('#shots').appendChild(el); const s = { a, b, el, upd, ...opts }; SH.push(s); return s; };

  // HOOK + BRIEF b0-5 (also the loop frame)
  const CH = TL.reqs.filter(r => r[1] === 'chip');
  shot(-9, 5, `${head('New client.', 250, 112)}
    <div id="client" class="dglass"><div class="who"><div class="ava"><b>MC</b></div><div><div class="nm">Maya Chen</div><div class="sub">Moving to Manhattan · November 1</div></div></div>
    <div id="budget"><div class="k">Monthly budget</div><div class="v gtx">${TL.reqs[0][2]}</div></div>
    <div class="k" style="margin-top:34px">Must-haves</div><div id="chips" style="margin-top:18px">${CH.map(r => `<span class="chip">${CHECK(22)}${r[2]}</span>`).join('')}</div></div>`, (b, s) => {
    const v = $('#budget .v'), pk = pulseAt(b, 1, 5);           // the budget is there from frame 0; on b1 it pops
    set(v, { transform: `scale(${1 + 0.07 * pk})`, filter: `drop-shadow(0 0 ${30 * pk}px rgba(166,140,255,.9))`, transformOrigin: '0 50%' });
    $$('#chips .chip', s.el).forEach((c, i) => { const a = E.outBack(P(b, CH[i][0], CH[i][0] + 0.35)); set(c, { transform: `scale(${clamp(a, 0, 1.2)})`, opacity: clamp(a * 3) }); });
    set($('#client'), { transform: `translateY(${-14 * E.inOut(P(b, 0, 5))}px)` });
    s.el.querySelector('.hd').style.transform = `translate(-50%,-50%)`;
  }, { hook: true });

  // THE ASK b5-8
  shot(5, 8, `<div class="orbL" id="orb"></div>${head('Hand it to Mila.', 610, 100)}
    <div id="composer" class="dglass"><span id="typed"></span><span id="caret"></span><div class="send">${ARROW}</div></div>`, (b, s) => {
    const k = TL.keyBeats.filter(x => x <= b).length; $('#typed').textContent = TL.prompt.slice(0, k);
    $('#caret').style.opacity = b >= TL.send ? 0 : (k < TL.prompt.length || b % 0.5 < 0.3 ? 1 : 0);
    reveal(s.el.querySelector('.hd span'), b, 5.05, 0.6);
    const c = E.spring(P(b, 5.2, 5.75)); set($('#composer'), { opacity: clamp(c * 2), transform: `translateY(${(1 - c) * 80}px)`, boxShadow: b >= TL.send ? `0 0 ${90 * pulseAt(b, TL.send, 3)}px rgba(166,140,255,.95)` : '' });
    const o = E.outBack(P(b, 5, 5.5)), breathe = 1 + 0.04 * Math.sin(b * Math.PI * 2) + 0.25 * pulseAt(b, TL.send, 5);
    set($('#orb'), { transform: `scale(${clamp(o, 0, 1.2) * breathe})` });
    s.el.querySelector('.send').style.transform = `scale(${b >= TL.send && b < TL.send + 0.2 ? 1 - 0.12 * Math.sin(P(b, TL.send, TL.send + 0.2) * Math.PI) : 1})`;
  });

  // THE SEARCH b8-16: a live map of Manhattan
  const MAP = shot(8, 16, `<canvas id="map" width="1080" height="1350"></canvas><div class="serifW hd" id="mapHead" style="top:120px;font-size:84px"></div>
    <div id="funnel" class="dglass"><div class="n" id="fN">0</div><div><div class="l" id="fL"></div><div class="s" id="fS"></div></div><div class="steps"><i></i><i></i><i></i><i></i></div></div>`, (b) => drawMap(b));

  // DROP b16-19: the three matches
  const RING = p => `<svg width="170" height="170" viewBox="0 0 170 170"><defs><linearGradient id="rg${p}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fb4ff"/><stop offset=".55" stop-color="#a68cff"/><stop offset="1" stop-color="#ffc9a8"/></linearGradient></defs>
    <circle cx="85" cy="85" r="74" fill="rgba(8,8,16,.55)" stroke="rgba(255,255,255,.15)" stroke-width="10"/><circle class="arc" cx="85" cy="85" r="74" fill="none" stroke="url(#rg${p})" stroke-width="10" stroke-linecap="round" stroke-dasharray="465" stroke-dashoffset="465" transform="rotate(-90 85 85)"/></svg>`;
  TL.matches.forEach((m, i) => shot(m.b, m.b + 1, `<div class="ph" style="background-image:${img(m.photo)}"></div><div class="fill" style="background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,0) 28%,rgba(0,0,0,0) 50%,rgba(0,0,0,.6))"></div>
    <div class="mtag mono">Match ${i + 1} of 3</div><div class="ring">${RING(i)}<b><span class="pn">0</span><small>MATCH</small></b></div>
    <div class="mcard dglass"><div class="mrow"><div><div class="hood">${m.hood}</div><div class="addr">${m.addr}</div></div><div><div class="price">${m.price}<small> /mo</small></div><div class="bed">${m.bed}</div></div></div>
    <div class="mchips">${['Light', 'Doorman', 'W/D', 'Subway'].map(c => `<i>${CHECK(18)}${c}</i>`).join('')}</div></div>`, (b, s) => {
    const k = E.outExpo(P(b, m.b, m.b + 0.25)), dir = i % 2 ? -1 : 1, ph = s.el.querySelector('.ph');
    ph.style.transform = `translateX(${(1 - k) * 420 * dir}px) scale(${1.18 - 0.08 * P(b, m.b, m.b + 1)})`; ph.style.filter = k < 0.97 ? `blur(${(1 - k) * 20}px)` : 'none';
    const c = E.spring(P(b, m.b + 0.08, m.b + 0.55)); set(s.el.querySelector('.mcard'), { transform: `translateY(${(1 - c) * 260}px)`, opacity: clamp(c * 2) });
    const r = E.outCubic(P(b, m.b + 0.1, m.b + 0.6)); s.el.querySelector('.arc').setAttribute('stroke-dashoffset', 465 * (1 - r * m.pct / 100)); s.el.querySelector('.pn').textContent = Math.round(m.pct * r) + '%';
    set(s.el.querySelector('.ring'), { transform: `scale(${clamp(E.outBack(P(b, m.b + 0.05, m.b + 0.35)), 0, 1.2)})` });
  }, { cut: true }));

  // SHORTLIST b19-20
  shot(19, 20, `${head('Shortlist ready.', 200, 100)}${TL.matches.map((m, i) => `<div class="tri" style="left:${75 + i * 315}px;background-image:${img(m.photo)}"><span class="pc">${m.pct}%</span><div class="tb"><div class="th">${m.hood}</div><div class="tp">${m.price}/mo</div></div></div>`).join('')}
    <div class="mono" style="position:absolute;left:0;right:0;top:930px;text-align:center;color:rgba(255,255,255,.7)">Every must-have · every budget line</div>`, (b, s) => {
    reveal(s.el.querySelector('.hd span'), b, 19, 0.5);
    $$('.tri', s.el).forEach((d, i) => { const a = E.spring(P(b, 19 + i * 0.2, 19.55 + i * 0.2)); set(d, { transform: `translateY(${(1 - a) * 500}px) rotate(${(i - 1) * 4 * (1 - a) + (i - 1) * 2}deg)`, opacity: clamp(a * 3) }); });
  });

  // SENT + REPLY b20-23.25
  const CHAT = shot(20, 23.25, `<div class="chat dglass"><div class="chd"><div class="ava"><b>MC</b></div><div><div class="cn">Maya Chen</div><div class="cs">Active now</div></div></div>
    <div class="msgs"><div class="out" id="outB">Hi Maya! Found 3 places that check every box:<div class="thumbs">${TL.matches.map((m, i) => `<div style="background-image:${img(m.photo)}"><b>${i + 1}</b></div>`).join('')}</div></div>
    <div class="meta" id="meta">DRAFTED BY MILA · SENT ${CHECK(16)}</div>
    <div class="in" id="dots"><div class="dots3"><i></i><i></i><i></i></div></div><div class="in" id="reply">The 3rd one!! ${HEART}</div></div></div>
    <div id="zoomImg" class="pop" style="background-image:${img('nassau_dining')};border:0"></div>`, (b, s) => {
    const c = E.outExpo(P(b, 20, 20.35)); set(s.el.querySelector('.chat'), { transform: `translateY(${(1 - c) * 120}px) scale(${0.95 + 0.05 * c})`, opacity: clamp(c * 2) });
    const o = E.spring(P(b, 20.1, 20.6)); set($('#outB'), { transform: `translateY(${(1 - o) * 60}px) scale(${0.9 + 0.1 * o})`, opacity: clamp(o * 2), transformOrigin: '100% 100%' });
    $('#meta').style.opacity = E.outCubic(P(b, 20.5, 20.8));
    const dOn = b >= TL.typingDots && b < TL.reply; vis($('#dots'), dOn); $('#dots').style.display = b < TL.reply ? 'flex' : 'none';
    if (dOn) $$('#dots i').forEach((d, i) => { d.style.transform = `translateY(${-8 * Math.max(0, Math.sin((b * 4 - i * 0.33) * Math.PI))}px)`; });
    const r = E.spring(P(b, TL.reply, TL.reply + 0.45)); vis($('#reply'), b >= TL.reply); set($('#reply'), { transform: `scale(${0.6 + 0.4 * r})`, opacity: clamp(r * 2), transformOrigin: '0 100%' });
    // the 3rd thumbnail: tapped, then it opens into the apartment
    const th = $$('.thumbs div', s.el)[2], tap = b >= TL.pick;
    set(th, { boxShadow: tap ? `0 0 0 ${4 + 6 * pulseAt(b, TL.pick, 4)}px #a68cff, 0 0 ${60 * pulseAt(b, TL.pick, 2)}px rgba(166,140,255,.9)` : 'none', transform: `scale(${tap && b < TL.pick + 0.2 ? 1 - 0.08 * Math.sin(P(b, TL.pick, TL.pick + 0.2) * Math.PI) : 1})` });
    const z = E.inOut(P(b, 22.75, 23.25)), zi = $('#zoomImg'); vis(zi, b >= 22.75);
    if (b >= 22.75) { const r0 = THUMB3; set(zi, { left: lerp(r0.x, 0, z) + 'px', top: lerp(r0.y, 0, z) + 'px', width: lerp(r0.w, W, z) + 'px', height: lerp(r0.h, H, z) + 'px', borderRadius: lerp(18, 0, z) + 'px' }); }
  });

  // THE APARTMENT b23.25-32: hero, photos pop in, settle into a grid, every must-have checked, tour booked
  const NASSAU = TL.matches[2];
  const GRID = { hero: [80, 150, 560, 440], living: [656, 150, 344, 212], kitchen: [656, 378, 344, 212] };
  const POP0 = { living: [70, 330, 620, 760, -5], kitchen: [400, 420, 600, 740, 6] };
  shot(23.25, 32, `<div class="pop" id="gHero" style="background-image:${img('nassau_dining')}"></div>
    <div class="pop" id="gLiving" style="background-image:${img('nassau_living')}"></div><div class="pop" id="gKitchen" style="background-image:${img('nassau_kitchen')}"></div>
    <div class="mono" id="gLab" style="position:absolute;left:60px;top:70px;text-shadow:0 2px 20px rgba(0,0,0,.6)">${NASSAU.addr} · ${NASSAU.hood}</div>
    <div class="dcard dglass" id="dcard"><div class="k">Maya’s pick · ${NASSAU.pct}% match</div><div class="dh" style="margin-top:16px">${NASSAU.addr.replace(' · ', ', ')}</div><div class="dp">${NASSAU.hood} · ${NASSAU.bed} · ${NASSAU.price}/mo</div>
    <div class="ck">${REQ_SHORT.map(r => `<div><i>${CHECK(22)}</i>${r}</div>`).join('')}</div><div class="dp" id="tourL" style="margin-top:30px;color:#fff">Tour: Saturday · 11:00 AM with Maya</div></div>
    <div class="stamp" id="stmp" style="left:560px;top:600px">TOUR BOOKED</div>`, (b, s) => {
    const arr = E.inOut(P(b, TL.arrange, TL.arrange + 0.6));
    // hero: full-bleed, then into the grid
    const hero = $('#gHero'), hg = GRID.hero, push = 1.08 - 0.06 * P(b, 23.25, 26);
    set(hero, { left: lerp(-(push - 1) * W / 2, hg[0], arr) + 'px', top: lerp(-(push - 1) * H / 2, hg[1], arr) + 'px', width: lerp(W * push, hg[2], arr) + 'px', height: lerp(H * push, hg[3], arr) + 'px',
      borderRadius: lerp(0, 30, arr) + 'px', borderWidth: lerp(0, 3, arr) + 'px', filter: `brightness(${lerp(0.82, 1, arr)})` });
    $('#gLab').style.opacity = 1 - arr;
    [['living', $('#gLiving'), TL.gallery[0][0]], ['kitchen', $('#gKitchen'), TL.gallery[1][0]]].forEach(([n, el, t]) => {
      const a = E.spring(P(b, t, t + 0.5)), p0 = POP0[n], g = GRID[n]; vis(el, b >= t);
      set(el, { left: lerp(p0[0], g[0], arr) + 'px', top: lerp(p0[1], g[1], arr) + 'px', width: lerp(p0[2], g[2], arr) + 'px', height: lerp(p0[3], g[3], arr) + 'px',
        transform: `rotate(${lerp(p0[4], 0, arr)}deg) scale(${lerp(0.4 + 0.6 * a, 1, arr)})`, opacity: clamp(a * 3) });
    });
    const dc = E.spring(P(b, TL.checks, TL.checks + 0.5)); vis($('#dcard'), b >= TL.checks); set($('#dcard'), { transform: `translateY(${(1 - dc) * 300}px)`, opacity: clamp(dc * 2) });
    $$('.ck div', s.el).forEach((d, i) => { const a = E.outBack(P(b, TL.checks + 0.25 + i * 0.25, TL.checks + 0.55 + i * 0.25)); set(d.querySelector('i'), { transform: `scale(${clamp(a, 0, 1.3)})` }); d.style.opacity = 0.35 + 0.65 * clamp(a * 2); });
    const tl = E.outExpo(P(b, TL.tour + 0.5, TL.tour + 0.9)); set($('#tourL'), { opacity: tl, transform: `translateY(${(1 - tl) * 20}px)` });
    const st = E.outBack(P(b, TL.tour, TL.tour + 0.25)); vis($('#stmp'), b >= TL.tour); set($('#stmp'), { transform: `rotate(-8deg) scale(${lerp(2.2, 1, clamp(st, 0, 1.2))})`, opacity: clamp(P(b, TL.tour, TL.tour + 0.07) * 5) });
  });

  // KICKER b32-36
  TL.kicker.forEach(([w, a, p], i) => shot(a, a + 1, `<div class="ph" style="background-image:${img(p)}"></div><div class="fill" style="background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,0) 30%,rgba(0,0,0,0) 55%,rgba(0,0,0,.55))"></div>
    <div class="mono lab">Manhattan · $5–6K · Maya Chen</div><div class="kw" style="font-size:${w.length > 8 ? 205 : 230}px">${w}</div>`, (b, s) => {
    const k = E.outExpo(P(b, a, a + 0.22)), dir = i % 2 ? -1 : 1, ph = s.el.querySelector('.ph');
    ph.style.transform = `translateX(${(1 - k) * 420 * dir}px) scale(${1.16 - 0.07 * P(b, a, a + 1)})`; ph.style.filter = k < 0.97 ? `blur(${(1 - k) * 20}px)` : 'none';
    const w2 = E.outExpo(P(b, a + 0.05, a + 0.4)); set(s.el.querySelector('.kw'), { transform: `translateY(${(1 - w2) * 80}px)`, opacity: w2, clipPath: `inset(${(1 - w2) * 100}% 0 0 0)` });
  }, { cut: true }));
  // OUTRO lines b36-38
  shot(36, 38, `<div class="serifW" style="top:560px;font-size:130px">Your client’s wishlist.</div><div class="serifW" style="top:740px;font-size:150px">Mila finds <span class="gtx" style="font-style:italic">the match.</span></div>`, (b, s) => {
    $$('.serifW', s.el).forEach((d, i) => { const k = E.outExpo(P(b, 36 + i, 36.35 + i)); set(d, { transform: `translate(-50%,-50%) translateY(${(1 - k) * 70}px) scale(${1.08 - 0.08 * k})`, opacity: k, filter: k < 1 ? `blur(${(1 - k) * 8}px)` : 'none' }); });
  });
  // END CARD
  shot(38, 51.9, `<div id="wordmark">Mila</div><div id="tagline"><div class="ln"><span>Your AI operations manager for real estate.</span></div></div>
    <div id="cta"><div class="ln"><span>Comment <span class="q">“Mila”</span></span></div><div class="ln"><span>for a 7-day free trial.</span></div></div>`, (b) => {
    const rise = E.outExpo(P(b, 38, 39.7));
    set($('#wordmark'), { top: (360 + 90 * (1 - rise)) + 'px', opacity: E.outCubic(P(b, 38, 38.5)), transform: `translateX(-50%) scale(${0.9 + 0.1 * rise})`, filter: `blur(${(1 - E.outCubic(P(b, 38, 39))) * 14}px)` });
    set($('#tagline'), { top: '660px', transform: 'translateX(-50%)' }); reveal($('#tagline .ln > span'), b, 38.7, 1.0);
    set($('#cta'), { top: '750px', transform: 'translateX(-50%)' }); $$('#cta .ln > span').forEach((s, j) => reveal(s, b, 39.3 + j * 0.45, 0.9));
  }, { end: true });

  /* ---------------------------------------------------------------- assets */
  await document.fonts.load('400 40px "Instrument Serif"'); await document.fonts.load('italic 40px "Instrument Serif"'); await document.fonts.load('600 16px "Inter"'); await document.fonts.load('700 16px "DejaVu Sans Mono"'); await document.fonts.ready;
  const PH = [...new Set([...document.body.innerHTML.matchAll(/assets\/photos\/([a-z_]+)\.jpg/g)].map(m => m[1]))];
  await Promise.all(PH.map(n => new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = `assets/photos/${n}.jpg`; })));
  // where the 3rd thumbnail sits inside the chat shot (layout coordinates, no transforms)
  const offIn = (el, root) => { let x = 0, y = 0; while (el && el !== root) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; } return [x, y]; };
  vis(CHAT.el, true); const t3 = $$('.thumbs div', CHAT.el)[2]; const [tx, ty] = offIn(t3, CHAT.el); const THUMB3 = { x: tx, y: ty, w: t3.offsetWidth, h: t3.offsetHeight };

  /* ---------------------------------------------------------------- the Manhattan map */
  const COAST = [[40.7003, -74.0153], [40.7046, -74.0192], [40.7110, -74.0170], [40.7200, -74.0140], [40.7290, -74.0112], [40.7390, -74.0103], [40.7480, -74.0090], [40.7580, -74.0045],
    [40.7680, -73.9965], [40.7800, -73.9880], [40.7950, -73.9775], [40.8100, -73.9665], [40.8250, -73.9560], [40.8250, -73.9330], [40.8100, -73.9340], [40.7980, -73.9290],
    [40.7870, -73.9390], [40.7760, -73.9420], [40.7650, -73.9535], [40.7550, -73.9630], [40.7450, -73.9715], [40.7350, -73.9735], [40.7250, -73.9718], [40.7160, -73.9760],
    [40.7110, -73.9790], [40.7085, -73.9950], [40.7050, -74.0040], [40.7010, -74.0110]];
  const HOODS = [['Midtown', 40.7549, -73.9840], ['Chelsea', 40.7465, -74.0014], ['Gramercy', 40.7368, -73.9845], ['West Village', 40.7358, -74.0036], ['East Village', 40.7265, -73.9815],
    ['SoHo', 40.7233, -74.0030], ['Tribeca', 40.7163, -74.0086], ['Lower East Side', 40.7150, -73.9843], ['FiDi', 40.7075, -74.0110]];
  const PINS3 = [[40.7452, -74.0010], [40.7348, -74.0048], [40.7093, -74.0083]];
  const TH = 29 * Math.PI / 180, mLon = 111320 * Math.cos(40.75 * Math.PI / 180);
  const toR = (la, lo) => { const x = (lo + 73.99) * mLon, y = (la - 40.735) * 111000; return [x * Math.cos(TH) - y * Math.sin(TH), x * Math.sin(TH) + y * Math.cos(TH)]; };
  const MS = 0.118, MX = 560, MY = 640;       // px per meter, screen anchor for rotated (0,0)
  const toS = (la, lo) => { const [x, y] = toR(la, lo); return [MX + x * MS, MY - y * MS]; };
  const coastS = COAST.map(([a, o]) => toS(a, o));
  const inPoly = (x, y) => { let c = false; for (let i = 0, j = coastS.length - 1; i < coastS.length; j = i++) { const [xi, yi] = coastS[i], [xj, yj] = coastS[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const PINS = []; { const r = rng(14); while (PINS.length < 340) { const x = 80 + r() * 920, y = 160 + r() * 900; if (inPoly(x, y)) PINS.push({ x, y, r: r(), d: r() }); } }
  const P3 = PINS3.map(([a, o]) => toS(a, o));
  const mapCv = $('#map'), mx = mapCv.getContext('2d');
  const fN = $('#fN'), fL = $('#fL'), fS = $('#fS'), fSteps = $$('#funnel .steps i'), mapHead = $('#mapHead');
  let mapHeadTxt = '';
  function drawMap(b) {
    const x = mx; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H);
    // camera: slow push, then lean into downtown where the 3 matches are
    const z = 1 + 0.06 * P(b, 8, 14) + 0.2 * E.inOut(P(b, 13.5, 16)), fx = lerp(540, (P3[0][0] + P3[2][0]) / 2, E.inOut(P(b, 13.5, 16))), fy = lerp(640, (P3[0][1] + P3[2][1]) / 2, E.inOut(P(b, 13.5, 16)));
    const intro = E.outExpo(P(b, 8, 8.6));
    x.translate(540, 640); x.scale(z * (0.92 + 0.08 * intro), z * (0.92 + 0.08 * intro)); x.translate(-fx, -fy);
    // island
    x.beginPath(); coastS.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath();
    const g = x.createLinearGradient(0, 160, 0, 1100); g.addColorStop(0, 'rgba(30,34,62,.95)'); g.addColorStop(1, 'rgba(22,24,44,.95)');
    x.globalAlpha = intro; x.fillStyle = g; x.fill();
    x.save(); x.clip();
    x.strokeStyle = 'rgba(143,180,255,.10)'; x.lineWidth = 1.2;
    for (let gx = -2000; gx < 2000; gx += 260 * MS) { x.beginPath(); x.moveTo(MX + gx, 0); x.lineTo(MX + gx, H); x.stroke(); }            // avenues
    for (let gy = -3000; gy < 3000; gy += 80 * MS) { x.beginPath(); x.moveTo(0, MY + gy); x.lineTo(W, MY + gy); x.stroke(); }             // streets
    // scan beam on each funnel stage
    for (const [T] of TL.funnel) { if (b >= T && b < T + 1.2) { const p = E.inOut(P(b, T, T + 1.2)), yy = lerp(1120, 120, p), bg = x.createLinearGradient(0, yy - 90, 0, yy + 90);
      bg.addColorStop(0, 'rgba(166,140,255,0)'); bg.addColorStop(0.5, `rgba(166,140,255,${0.35 * Math.sin(p * Math.PI)})`); bg.addColorStop(1, 'rgba(166,140,255,0)'); x.fillStyle = bg; x.fillRect(0, yy - 90, W, 180); } }
    x.restore();
    x.beginPath(); coastS.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath();
    const cg = x.createLinearGradient(200, 100, 900, 1100); cg.addColorStop(0, '#8fb4ff'); cg.addColorStop(0.55, '#a68cff'); cg.addColorStop(1, '#ffc9a8');
    x.strokeStyle = cg; x.lineWidth = 3; x.shadowColor = 'rgba(166,140,255,.8)'; x.shadowBlur = 24; x.stroke(); x.shadowBlur = 0;
    // neighborhood labels
    x.font = '700 15px "DejaVu Sans Mono"'; x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,.38)';
    for (const [n, a, o] of HOODS) { const [px, py] = toS(a, o); x.fillText(n.toUpperCase().split('').join(String.fromCharCode(8202)), px, py); }
    // pins: everything appears, then each stage rules most of them out
    const stage = TL.funnel.filter(f => b >= f[0]).length - 1, keep = [1, 0.13, 0.012, 0];
    for (const p of PINS) {
      const t0 = 8 + p.d * 0.9, a = E.outBack(P(b, t0, t0 + 0.3)); if (a <= 0) continue;
      let alive = 1; for (let s = 1; s <= stage; s++) { const T = TL.funnel[s][0]; if (p.r >= keep[s]) alive = Math.min(alive, 1 - E.outCubic(P(b, T + p.d * 0.5, T + p.d * 0.5 + 0.3))); }
      const r = (4 + 2 * alive) * clamp(a, 0, 1.3);
      x.globalAlpha = intro * (0.18 + 0.82 * alive); x.fillStyle = alive > 0.5 ? '#c9bcff' : '#7f88b0'; x.beginPath(); x.arc(p.x, p.y, r, 0, TAU); x.fill();
    }
    x.globalAlpha = 1;
    // the 3 best fits
    if (b >= 12.5) {
      TL.matches.forEach((m, i) => {
        const [px, py] = P3[i], a = E.outBack(P(b, 12.5 + i * 0.25, 12.85 + i * 0.25)), pl = Math.sin((b * 2 + i * 0.3) * Math.PI) * 0.5 + 0.5;
        const R = 70 * (0.6 + 0.4 * pl) * clamp(a), rg = x.createRadialGradient(px, py, 0, px, py, R); rg.addColorStop(0, 'rgba(166,140,255,.55)'); rg.addColorStop(1, 'rgba(166,140,255,0)');
        x.fillStyle = rg; x.beginPath(); x.arc(px, py, R, 0, TAU); x.fill();
        x.fillStyle = '#fff'; x.beginPath(); x.arc(px, py, 10 * clamp(a, 0, 1.3), 0, TAU); x.fill();
        if (a > 0.05) { const lw = 150, lh = 52, lx = px + 22, ly = py - lh / 2; x.globalAlpha = clamp(a);
          const lg = x.createLinearGradient(lx, ly, lx + lw, ly + lh); lg.addColorStop(0, '#8fb4ff'); lg.addColorStop(0.55, '#a68cff'); lg.addColorStop(1, '#ffc9a8');
          x.fillStyle = lg; x.beginPath(); x.roundRect(lx, ly, lw * clamp(a, 0, 1), lh, 26); x.fill();
          x.fillStyle = '#0b0b12'; x.font = '700 22px "DejaVu Sans Mono"'; x.textAlign = 'left'; x.fillText(`${m.pct}% ${m.price}`.slice(0, Math.ceil(12 * clamp(a))), lx + 16, ly + 34); x.globalAlpha = 1; }
      });
    }
    // headline
    const txt = b < 14 ? 'Mila searches Manhattan.' : 'Found 3.';
    if (txt !== mapHeadTxt) { mapHead.innerHTML = `<div class="ln"><span>${txt}</span></div>`; mapHeadTxt = txt; }
    const ht = b < 14 ? 8.05 : 14, hp = E.outExpo(P(b, ht, ht + 0.45)), hq = b < 14 ? E.inCubic(P(b, 13.75, 14)) : 0, sp = mapHead.firstChild.firstChild;
    sp.style.transform = `translateY(${(1 - hp) * 110 - hq * 110}%)`; set(mapHead, { fontSize: (b >= 14 ? 120 : 84) + 'px', top: (b >= 14 ? 140 : 120) + 'px', letterSpacing: b >= 14.5 ? `${-0.02 + 0.03 * E.outCubic(P(b, 14.5, 15.9))}em` : '' });
    // funnel card
    const fi = Math.max(0, stage), f = TL.funnel[fi], prev = fi ? TL.funnel[fi - 1][1] : 0, cp = E.outExpo(P(b, f[0], f[0] + 0.6));
    fN.textContent = fmt(lerp(prev, f[1], cp)); fL.textContent = f[2]; fS.textContent = ['ACTIVE RENTALS', '$5,000 – $6,000', 'LIGHT · DOORMAN · W/D · SUBWAY · DOGS', 'RANKED FOR MAYA'][fi];
    fSteps.forEach((d, i) => { d.style.background = i <= fi ? 'linear-gradient(135deg,#8fb4ff,#a68cff)' : ''; d.style.transform = `scale(${i === fi ? 1 + 0.4 * pulseAt(b, f[0], 6) : 1})`; });
    const fc = E.spring(P(b, 8.1, 8.6)); set($('#funnel'), { transform: `translateY(${(1 - fc) * 200}px) scale(${1 + 0.03 * pulseAt(b, f[0], 8)})`, opacity: clamp(fc * 2) * (1 - E.inCubic(P(b, 15.2, 16))) });
    if (fi === 3) fN.classList.add('gtx'); else fN.classList.remove('gtx');
  }

  /* ---------------------------------------------------------------- render */
  const R = { cam: $('#cam'), leak: $('#leak'), flash: $('#flash'), gA: $('#gA'), gB: $('#gB'), gC: $('#gC') };
  const grain = $('#grain'), gctx = grain.getContext('2d'), NOISE = [];
  { const r = rng(99); for (let k = 0; k < 8; k++) { const c = document.createElement('canvas'); c.width = 540; c.height = 675; const x = c.getContext('2d'), id = x.createImageData(540, 675); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 110; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); NOISE.push(c); } }
  const CUT_T = [5, 8, 16, 17, 18, 19, 20, 23.25, 24, 25, 26, 30, ...TL.kicker.map(k => k[1]), 36, 37, 38];

  function render(t) {
    const raw = t / BEAT, b = raw;
    const tail = raw >= TL.loopTail[0], tailIn = E.inOut(P(raw, 50.2, 51.85));
    let cs = 1 + 0.004 * per(raw, 2), cx = per(raw, 3) * 2, cy = per(raw, 2) * 2;
    for (const T of CUT_T) { if (b >= T && b < T + 0.6 && !tail) cs *= 1 + 0.03 * Math.exp(-(b - T) * 9); }
    if (b >= 16 && b < 36 && !tail) { const ph = b % 1; cs *= 1 + 0.007 * Math.exp(-ph * 7); cy += 3 * Math.exp(-ph * 9); }
    if (b >= 14 && b < 16) cs *= 1 + 0.03 * E.inCubic(P(b, 15, 16));
    R.cam.style.transform = `translate(${cx}px,${cy}px) scale(${cs})`;
    set(R.gA, { left: (260 + per(raw, 2) * 160) + 'px', top: (420 + perc(raw, 1) * 120) + 'px' });
    set(R.gB, { left: (840 + perc(raw, 2) * 140) + 'px', top: (820 + per(raw, 1) * 140) + 'px' });
    set(R.gC, { left: (540 + per(raw, 1) * 200) + 'px', top: 1250 + 'px' });

    for (const s of SH) {
      let on;
      if (s.hook) on = b < s.b || raw >= 50.2;
      else if (s.end) on = b >= s.a && !(tail && tailIn >= 1);
      else on = b >= s.a && b < s.b && !tail;
      vis(s.el, on); if (!on) continue;
      if (s.hook) { s.upd(tail ? 0 : b, s); s.el.style.opacity = tail ? tailIn : 1; s.el.style.transform = tail ? `translateY(${(1 - tailIn) * 40}px)` : ''; }
      else if (s.end) { s.upd(b, s); s.el.style.opacity = tail ? 1 - tailIn : 1; }
      else s.upd(b, s);
    }
    // the hang: the whole map breathes out of focus for a beat before the drop
    MAP.el.style.filter = b >= 15 && b < 16 ? `blur(${3 * E.inCubic(P(b, 15.3, 16))}px) brightness(${1 + 0.4 * E.inCubic(P(b, 15.5, 16))})` : 'none';

    const leakT = [16, 20, 23.25, 32, 36, 38].find(T => b >= T && b < T + 0.8);
    vis(R.leak, leakT !== undefined && !tail);
    if (leakT !== undefined) { const p = P(b, leakT, leakT + 0.8); set(R.leak, { transform: `translateX(${lerp(-1100, 1100, E.inOut(p))}px)`, opacity: Math.sin(p * Math.PI) }); }
    const fl = tail ? 0 : Math.max(b >= 15.85 && b < 16 ? 0.6 * E.inCubic(P(b, 15.85, 16)) : 0, 0.8 * pulseAt(b, 16, 5), 0.35 * pulseAt(b, 17, 8), 0.35 * pulseAt(b, 18, 8), 0.3 * pulseAt(b, 23.25, 6),
      0.25 * pulseAt(b, 30, 8), ...TL.kicker.map(k => 0.3 * pulseAt(b, k[1], 10)), 0.4 * pulseAt(b, 36, 6), 0.3 * pulseAt(b, 38, 6), b >= 8 && b < 14 ? 0.12 * Math.max(...TL.funnel.map(f => pulseAt(b, f[0], 10))) : 0);
    R.flash.style.opacity = fl; vis(R.flash, fl > 0.002);
    const fi = Math.floor(t * 60), nz = NOISE[fi % 8], gx = (fi * 137) % 540, gy = (fi * 251) % 675;
    gctx.drawImage(nz, -gx, -gy); gctx.drawImage(nz, 540 - gx, -gy); gctx.drawImage(nz, -gx, 675 - gy); gctx.drawImage(nz, 540 - gx, 675 - gy);
    grain.style.opacity = 0.2;
  }

  window.renderFrame = render; window.DURATION = DUR;
  for (const tw of [0, 3, 6, 9, 12, 14.5, 16.3, 17.3, 18.3, 19.5, 21, 22.6, 23, 24.3, 25.3, 26.5, 28, 30.5, 32.5, 36.5, 37.5, 40, 51, 51.95]) render(tw * BEAT);
  render(0); window.__ready = true;
  if (!RENDER) {
    const aud = $('#aud'), pp = $('#pp'), scrub = $('#scrub'), tc = $('#tc'); scrub.max = DUR; let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (aud.currentTime >= DUR - 0.05) aud.currentTime = 0; aud.play(); } else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; render(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; render(t); scrub.value = t; tc.textContent = t.toFixed(2) + 's'; if (t >= DUR) { playing = false; pp.textContent = 'Play'; } } requestAnimationFrame(loop); };
    loop();
  }
})();
