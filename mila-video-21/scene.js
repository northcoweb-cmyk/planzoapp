/* Mila film #21 — "Mila is live." Launch day hero (4:5 feed), "I Follow Rivers" (The Magician remix) 2:20-2:53, 122 BPM, A minor.
 * render(t) is a pure function of time; cues are beats b (0.4918 s).
 * THE PROBLEM (pad, letterboxed): "You became an agent / to sell homes." b0-2 · "Not this." five late-night notifications stack, one per beat b2-7
 * THE FILL (the toms): a cut on every hit — Leads. Showings. Offers. Posts. Follow-ups. — then 3, 2, 1 · the hang: silence, the orb breathes b12.15
 * MILA IS LIVE b13 (on "I follow"): bars snap open, light world · "Your AI operations manager for real estate." · one sentence on the phone ->
 *   contact + calendar + reminder fly out b15-21 · conflict caught b21 · Google/Apple calendar b23 · reminder b24 · offer -> timeline b25 · listing b27
 * THE GROOVE b29+: carousel + Fair Housing b29 · drafts, nothing sends without your OK b31.5 · open house follow-ups b33 · summarize Dana b35 ·
 *   payment b37 · priorities b39 · 1031 advice b41 · speed run b43 · Less admin. More closings. b45 · You approve. Mila does the rest. b49 ·
 *   Available today + pricing b53 · She follows up. So you don't have to. b57 (the lyric) · end card b61 · loop tail b66-68 -> frame 0.
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

  const SEND = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 18.5V5.5M6 11.5 12 5.5l6 6"/></svg>`;
  const ICO = {
    user: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>`,
    cal: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>`,
    bell: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>`,
    warn: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#d9822b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.01"/></svg>`,
  };
  const lightBg = p => p ? `<div class="ph" style="background-image:${img(p)};filter:blur(30px) brightness(1.15) saturate(1.1);opacity:.55"></div>` : '';
  const pop = (el, b, T, dy = 60, dur = 0.4) => { const a = E.spring(P(b, T, T + dur)); set(el, { transform: `translateY(${(1 - a) * dy}px) scale(${0.92 + 0.08 * a})`, opacity: clamp(a * 2.5) }); };
  const slideIn = (el, b, T, dx = 300) => { const a = E.spring(P(b, T, T + 0.4)); set(el, { transform: `translateX(${(1 - a) * dx}px)`, opacity: clamp(a * 2.5) }); };
  // every light shot enters with a short push + blur, alternating direction (the whip itself is the sound + the camera punch)
  const enterL = (el, b, a, i = 0) => { const k = E.outExpo(P(b, a, a + 0.28)), d = i % 2 ? -1 : 1; el.style.transform = `translateX(${(1 - k) * 160 * d}px) scale(${1.04 - 0.04 * k})`; el.style.filter = k < 0.97 ? `blur(${(1 - k) * 16}px)` : 'none'; };
  let LI = 0;
  const lshot = (a, b, html, upd = () => {}, o = {}) => { const i = LI++; return shot(a, b, html, (bb, s) => { enterL(s.el, bb, a, i); upd(bb, s); }, o); };

  // ================= THE PROBLEM (b0-7): the breakdown's pad. Dark, letterboxed.
  // b0-2 HOOK (loop frame)
  shot(-9, 2, `${bgp('cliff_sunset', 0.32)}<div class="serifW" id="h1" style="top:540px;font-size:92px">You became an agent</div>
    <div class="mtx" id="h2" style="top:720px;font-size:178px;background-image:${img('cliff_sunset')};filter:brightness(1.5) saturate(1.2) drop-shadow(0 10px 40px rgba(0,0,0,.6))">to sell homes.</div>`, (b, s) => {
    const k = E.outExpo(P(b, 0.5, 1.1)); set($('#h2'), { transform: `translate(-50%,-50%) scale(${1.04 - 0.04 * k})`, backgroundPosition: `${40 + 20 * P(b, -1, 2)}% 50%` });
    set($('#h1'), { transform: 'translate(-50%,-50%)' });
    s.el.querySelector('.ph').style.transform = `scale(${1.12 - 0.06 * P(b, -1, 2)})`;
  }, { hook: true });
  // b2-7: not this. The night fills with it, one notification per beat
  shot(2, 7.12, `${bgp('nassau_living', 0.2)}${cap('Not this.', 250, 100)}<div class="mono clk">11:48 PM</div>
    ${TL.pains.map(([, tx, app], i) => `<div class="pain" style="top:${360 + i * 152}px;left:${i % 2 ? 150 : 110}px"><div class="ic">${app[0]}</div><div class="tx"><b>${app}</b><span>${tx}</span></div><div class="bd">${[3, 2, 1, 1, 23][i]}</div></div>`).join('')}`, (b, s) => {
    const c = E.outExpo(P(b, 2, 2.3)); set(s.el.querySelector('.cap'), { opacity: c, transform: `translate(-50%,-50%) translateY(${(1 - c) * 26}px)` });
    $$('.pain', s.el).forEach((d, i) => { const T = TL.pains[i][0], a = E.spring(P(b, T, T + 0.45)), r = [-2, 1.5, -1, 2, -1.5][i];
      vis(d, b >= T); set(d, { transform: `scale(${1.25 - 0.25 * a}) rotate(${r * a}deg)`, opacity: clamp(a * 3) }); });
    const g = P(b, 6.55, 7.1); s.el.style.filter = g > 0 ? `blur(${g * 14}px) saturate(${1 - g})` : 'none'; s.el.style.opacity = 1 - E.inCubic(g);
    if (b > 6.55 && b < 6.8) s.el.style.transform = `translateX(${Math.sin(b * 400) * 18}px)`; else s.el.style.transform = 'none';
  });
  // ================= THE FILL (b7.12-12.15): the toms. Every hit is a cut, then 3, 2, 1
  TL.words.forEach(([T, w, p], i) => { const nx = (TL.words[i + 1] || TL.count[0])[0];
    shot(T, nx, `${bgp(p, 0.4)}<div class="mtx" style="background-image:${img(p)};font-size:${w.length > 9 ? 190 : 230}px;filter:brightness(1.45) saturate(1.2) drop-shadow(0 10px 40px rgba(0,0,0,.6))">${w}</div>`, (b, s) => {
      const k = E.outExpo(P(b, T, T + 0.3)); set(s.el.querySelector('.mtx'), { transform: `translate(-50%,-50%) scale(${1.3 - 0.3 * k})`, backgroundPosition: `${30 + 40 * P(b, T, nx)}% 50%` });
      s.el.querySelector('.ph').style.transform = `scale(${1.2 - 0.1 * k})`;
    }); });
  TL.count.forEach(([T, n], i) => { const nx = i < 2 ? TL.count[i + 1][0] : TL.hang[0];
    shot(T, nx, `<div style="position:absolute;inset:0;background:radial-gradient(70% 55% at 50% 50%, #1d1840, #05050a 75%)"></div><div class="ring"></div><div class="cnt">${n}</div>`, (b, s) => {
      const k = E.outExpo(P(b, T, T + 0.25)); set(s.el.querySelector('.cnt'), { transform: `translate(-50%,-50%) scale(${1.4 - 0.4 * k})`, filter: k < 0.97 ? `blur(${(1 - k) * 20}px)` : 'none' });
      set(s.el.querySelector('.ring'), { transform: `scale(${0.6 + 0.5 * E.outExpo(P(b, T, nx))})`, opacity: 1 - P(b, T, nx) });
    }); });
  // b12.15-13: the hang. Silence + reverb. The orb breathes in.
  shot(TL.hang[0], 13, `<div style="position:absolute;inset:0;background:#05050a"></div><div class="orbG"></div>
    <div class="bigtime" id="ht" style="top:675px;font-size:200px">1:59<small style="font-size:.4em;margin-left:14px;opacity:.6">PM</small></div>
    <div class="mono" id="ld" style="position:absolute;left:0;right:0;top:860px;text-align:center;color:rgba(255,255,255,.75)">Today · Launch day</div>`, (b, s) => {
    const k = E.inCubic(P(b, TL.hang[0], 13)); set(s.el.querySelector('.orbG'), { transform: `scale(${0.2 + 1.2 * k})`, opacity: 0.4 + 0.6 * k });
    $('#ld').style.opacity = E.outCubic(P(b, 12.2, 12.6)); const h = E.outExpo(P(b, 12.15, 12.45));
    set($('#ht'), { opacity: h, transform: `translate(-50%,-50%) scale(${1.1 - 0.1 * h})`, filter: h < 0.97 ? `blur(${(1 - h) * 12}px)` : 'none' });
  });

  // ================= MILA IS LIVE (b13): "I follow..." — bars snap open, the light world
  shot(13, 15, `<div class="bloomR"></div><div id="wm2">${'Mila'.split('').map(c => `<span>${c}</span>`).join('')}</div>
    <div class="pill" id="t2p" style="position:absolute;left:50%;top:300px;height:64px;font-size:22px">TODAY · 2:00 PM</div>
    <div class="inkS" id="live" style="top:800px;font-size:150px"><span class="gtx" style="font-style:italic">is live.</span></div>
    <div class="mono" id="avl" style="position:absolute;left:0;right:0;top:960px;text-align:center;color:#7a6be0">Launch day · October 23 · 2 PM</div>`, (b, s) => {
    const k = E.outExpo(P(b, 13, 13.8)); set(s.el.querySelector('.bloomR'), { transform: `scale(${0.2 + 0.9 * k})`, opacity: 1 - 0.55 * P(b, 13.2, 15) });
    $$('#wm2 span').forEach((sp, i) => { const a = E.outExpo(P(b, 13 + i * 0.07, 13.6 + i * 0.07)); set(sp, { transform: `translateY(${(1 - a) * 90}px)`, opacity: clamp(a * 2), filter: a < 0.98 ? `blur(${(1 - a) * 16}px)` : 'none' }); });
    set($('#wm2'), { transform: `translate(-50%,-50%) scale(${1.06 - 0.06 * E.outCubic(P(b, 13, 15))})`, letterSpacing: `${-0.03 + 0.04 * (1 - k)}em` });
    const l = E.outExpo(P(b, 13.5, 14)); set($('#live'), { opacity: l, transform: `translate(-50%,-50%) translateY(${(1 - l) * 40}px)` });
    $('#avl').style.opacity = E.outCubic(P(b, 14, 14.4));
    const tp = E.outBack(P(b, 13.15, 13.45)); set($('#t2p'), { transform: `translateX(-50%) scale(${tp})`, opacity: clamp(tp * 2) });
  });
  // b15-21: what she is, then the one-sentence demo — the phone rises, slides left, the results fly out
  const RES = [[19.25, 'user', 'Contact · saved', 'Priya Shah', 'Buyer · $600k · Bethesda · Zillow'], [19.75, 'cal', 'Calendar · added', 'Call Priya', 'Tomorrow · 2:00 PM'], [20.25, 'bell', 'Reminder · set', 'Prep for Priya call', 'Tomorrow · 1:45 PM']];
  shot(15, 21, `<div class="inkS" id="w1" style="top:300px;font-size:96px">Your AI operations manager</div><div class="inkS" id="w2" style="top:410px;font-size:96px"><span class="gtx" style="font-style:italic">for real estate.</span></div>
    <div class="rcap" id="rc" style="top:300px">Text her like<br><span class="gtx" style="font-style:italic">a coworker.</span></div>
    <div class="bph" id="ph1"><div class="bscr"><div class="bisl"></div><div class="chat"><div class="hd"><i class="orbM"></i>Mila</div><div class="rdy" id="rdy">Ready when you are.</div>
      <div class="msg me" id="m1">${TL.ask}</div><div class="msg mi" id="m2">Done ✓ Here’s what I saved:</div></div>
      <div class="cmp"><span id="ty"></span><span class="ph0" id="ph0">Message Mila…</span><span class="cr" id="cr"></span><b class="sd">${SEND}</b></div></div></div>
    ${RES.map(([, ic, k, t2, d]) => `<div class="res lglass"><div class="ri">${ICO[ic]}</div><div><div class="rk">${k}</div><div class="rt">${t2}</div><div class="rd">${d}</div></div></div>`).join('')}`, (b, s) => {
    const t1 = E.outExpo(P(b, 15, 15.5)), t2 = E.outExpo(P(b, 15.3, 15.8)), up = E.inOut(P(b, 16.7, 17.1));
    set($('#w1'), { opacity: t1 * (1 - up), transform: `translate(-50%,-50%) translateY(${(1 - t1) * 40 - up * 120}px)` });
    set($('#w2'), { opacity: t2 * (1 - up), transform: `translate(-50%,-50%) translateY(${(1 - t2) * 40 - up * 120}px)` });
    const rise = E.outExpo(P(b, 15.2, 16.2)), mv = E.inOut(P(b, 16.7, 17.2));
    const ph = $('#ph1'); set(ph, { left: lerp(290, 60, mv) + 'px', top: lerp(lerp(1500, 560, rise), 165, mv) + 'px' });
    const rc = E.outExpo(P(b, 17.1, 17.6)); set($('#rc'), { opacity: rc, transform: `translate(-50%,-50%) translateY(${(1 - rc) * 30}px)` });
    const n = Math.floor(TL.ask.length * P(b, TL.askB[0], TL.askB[1])), sent = b >= TL.send;
    $('#ty').textContent = sent ? '' : TL.ask.slice(0, n); vis($('#ph0'), n === 0 || sent); vis($('#cr'), !sent && b >= 17);
    vis($('#m1'), sent); if (sent) pop($('#m1'), b, TL.send, 80, 0.35);
    vis($('#m2'), b >= 19); if (b >= 19) pop($('#m2'), b, 19, 40, 0.35);
    $('#rdy').style.opacity = sent ? 0 : 1;
    $$('.res', s.el).forEach((d, i) => { const T = RES[i][0], a = E.spring(P(b, T, T + 0.45)); vis(d, b >= T);
      set(d, { top: (520 + i * 190) + 'px', transform: `translateX(${(1 - a) * -380}px) scale(${0.7 + 0.3 * a})`, opacity: clamp(a * 2.5) }); });
  });
  // b21-23: the conflict, caught and fixed
  lshot(21, 23, `${lightBg('conservatory')}<div class="card lglass" style="top:250px"><div class="k">Calendar · new showing</div><div class="t">Showing · Sat 1:00 PM</div>
    <div class="warn" id="wn">${ICO.warn}<span>Conflicts with your open house<br>48 Coral Palm Way · 1–4 PM</span></div>
    <div class="btns" id="bt"><div>Keep</div><div>Move</div><div id="fat"><i></i><span style="position:relative">Find another time</span></div></div>
    <div class="row" id="fx" style="margin-top:22px">Sat · 4:30 PM · Showing<span class="ok">BOOKED ✓</span></div></div>
    <div class="inkS" id="cc" style="top:1150px;font-size:88px">Double-booked? <span class="gtx" style="font-style:italic">Caught.</span></div>`, (b, s) => {
    pop($('#wn'), b, 21.5, 30); pop($('#bt'), b, 21.7, 30);
    const tp = P(b, 22.2, 22.5), f = $('#fat'); f.classList.toggle('sel', b >= 22.2); set(f.querySelector('i'), { transform: `scale(${tp})`, opacity: b >= 22.2 ? 1 - tp : 0 });
    set(f, { transform: `scale(${b >= 22.2 && b < 22.4 ? 0.95 : 1})` });
    vis($('#fx'), b >= 22.45); slideIn($('#fx'), b, 22.45);
    const c = E.outExpo(P(b, 21.2, 21.6)); set($('#cc'), { opacity: c, transform: `translate(-50%,-50%) translateY(${(1 - c) * 30}px)` });
  });
  // b23-24: on every calendar
  lshot(23, 24, `${lightBg('palm_estate')}<div class="card lglass" style="top:330px;text-align:center"><div class="k">Google connected · Apple via private feed</div><div class="t">On your calendar.</div>
    <div class="syncrow"><div class="sl">${GCAL(130)}<span>Google Calendar</span></div><div class="sl">${ACAL(130)}<span>Apple Calendar</span></div></div>
    <div class="row">Tomorrow · 2:00 PM · Call Priya<span class="ok">ADDED ✓</span></div></div>`, (b, s) => {
    $$('.sl', s.el).forEach((d, i) => { const a = E.outBack(P(b, 23.1 + i * 0.15, 23.4 + i * 0.15)); set(d, { transform: `scale(${clamp(a, 0, 1.2)})`, opacity: clamp(a * 3) }); });
    slideIn(s.el.querySelector('.row'), b, 23.4);
  });
  // b24-25: reminders in plain English
  lshot(24, 25, `${lightBg('village_kitchen')}<div class="qb" style="top:400px">Remind me Thursday at 9 to send comps to Dana</div>
    <div class="card lglass" id="rm" style="top:640px;display:flex;align-items:center;gap:26px"><div class="res" style="position:static;padding:0;width:auto"><div class="ri" style="width:90px;height:90px;border-radius:24px">${ICO.bell}</div></div>
    <div><div class="k">Reminder · set</div><div class="t" style="font-size:64px;margin-top:10px">Thu · 9:00 AM</div><div class="d" style="margin-top:8px">Send comps to Dana Whitfield</div></div></div>`, (b, s) => {
    pop(s.el.querySelector('.qb'), b, 24.0, 50); vis($('#rm'), b >= 24.45); pop($('#rm'), b, 24.45, 80);
  });
  // b25-27: offer accepted -> the whole transaction timeline
  const TLX = [['Earnest money', 'OCT 26'], ['Inspection', 'OCT 30'], ['Appraisal', 'NOV 6'], ['Financing', 'NOV 13'], ['Final walkthrough', 'NOV 19'], ['Closing', 'NOV 20']];
  lshot(25, 27, `${lightBg('hero_waterfront')}<div class="card lglass" style="top:200px"><div class="k">Offer accepted · 7 Harbor View Ct</div><div class="t">Timeline, built.</div>
    <div class="tl6"><div class="ln6"></div>${TLX.map(([a, d]) => `<div class="st">${a}<em>${d}</em></div>`).join('')}</div></div>`, (b, s) => {
    $$('.tl6 .st', s.el).forEach((d, i) => { const T = 25.25 + i * 0.25; vis(d, b >= T); slideIn(d, b, T, 200); });
    s.el.querySelector('.ln6').style.transform = `scaleY(${E.outCubic(P(b, 25.25, 26.6))})`;
  });
  // b27-29: a listing from one sentence
  lshot(27, 29, `${lightBg('malibu_pool')}<div class="qb" style="top:250px">Add 12 Sea Grape Ln, $1.2M, 4 bd, 3 ba, 2,800 sqft</div>
    <div class="lst"><div class="lim" style="background-image:${img('malibu_pool')}"><span class="pill">COMING SOON</span></div><div class="lb"><div class="lp">$1,200,000</div><div class="la">12 Sea Grape Ln</div>
    <div class="chips"><span>4 bd</span><span>3 ba</span><span>2,800 sqft</span><span style="background:rgba(166,140,255,.18);color:#5b4bc4">Listing copy ✓</span></div></div></div>`, (b, s) => {
    pop(s.el.querySelector('.qb'), b, 27, 50); const l = s.el.querySelector('.lst'), a = E.spring(P(b, 27.3, 27.8));
    vis(l, b >= 27.3); set(l, { transform: `perspective(1600px) rotateX(${(1 - a) * 18}deg) translateY(${(1 - a) * 160}px)`, opacity: clamp(a * 2.5) });
    l.querySelector('.lim').style.backgroundPosition = `${50 + 10 * P(b, 27, 29)}% 50%`;
  });

  // ================= THE GROOVE (b29+): the toms come in — cuts land on the hits
  const SL = [['cliff_pool', 'Just<br>listed.'], ['living_room', '4 bd · 3 ba<br>2,800 sqft'], ['malibu_sunset', 'Open house<br>Sat 1–4']];
  lshot(29, 31.5, `${lightBg('cliff_pool')}<div class="ig" style="top:170px"><div class="hd"><div class="av"></div>rachel.homes<span style="margin-left:auto;font:700 16px/1 var(--mono);letter-spacing:.14em;color:#7a6be0">CAROUSEL · 1/10</span></div>
    <div class="img" style="overflow:hidden;background:none"><div class="strip" style="position:absolute;left:0;top:0;height:100%;width:2040px;display:flex">${SL.map(([p, t2]) => `<div style="position:relative;width:680px;height:100%;background:${img(p)} center/cover"><b style="position:absolute;left:30px;bottom:30px;font:400 78px/.9 var(--serif);color:#fff;text-shadow:0 6px 30px rgba(0,0,0,.45)">${t2}</b></div>`).join('')}</div></div>
    <div class="ft">♡ ◯ ➤<div class="dots"><i></i><i></i><i></i></div></div></div>
    <div class="pill" id="fh" style="position:absolute;left:50%;top:1110px">FAIR HOUSING ✓ · 1080×1350 · READY</div>`, (b, s) => {
    const sw = E.inOut(P(b, 29.85, 30.15)) + E.inOut(P(b, 30.6, 30.9)); s.el.querySelector('.strip').style.transform = `translateX(${-680 * sw}px)`;
    const di = Math.round(sw); $$('.ig .dots i', s.el).forEach((d, i) => d.style.background = i === di ? 'var(--violet)' : '#c9c3ff');
    s.el.querySelector('.ig .hd span').textContent = `CAROUSEL · ${di + 1}/10`;
    const a = E.outBack(P(b, 31.5, 31.8)); vis($('#fh'), b >= 31.5); set($('#fh'), { transform: `translateX(-50%) scale(${a})` });
  });
  lshot(31.5, 33, `${lightBg('nassau_living')}<div class="card lglass" style="top:340px"><div class="k">Text draft · in your voice</div><div class="t">Hi Dana!</div>
    <div class="bub out" style="margin-top:24px;margin-left:0;max-width:820px">Pulled 3 comps on Elm St, all under $590k. Want to see them Thursday at 10?</div>
    <div class="dact"><div>Open in Messages</div><div>Copy</div></div></div>
    <div class="ban" id="nb" style="top:1000px">NOTHING SENDS WITHOUT <b>YOUR OK</b></div>`, (b, s) => {
    pop(s.el.querySelector('.bub'), b, 31.6, 50); pop(s.el.querySelector('.dact'), b, 32.2, 30);
    const a = P(b, 32.9, 33.05), nb = $('#nb'); vis(nb, b >= 32.9); set(nb, { transform: `translateX(-50%) scale(${1.6 - 0.6 * E.outCubic(a)}) rotate(${-3 * (1 - a)}deg)`, opacity: clamp(a * 3) });
  });
  const VIS = [['J. Alvarez', 'Loved the kitchen'], ['The Kims', 'Pre-approved · $1.1M'], ['R. Patel', 'Selling first'], ['M. Osei', 'Asked about schools'], ['T. Brooks', 'Just looking']];
  lshot(33, 35, `${lightBg('sarasota_bridgepool')}<div class="card lglass" style="top:220px"><div class="k">Open house recap · 48 Coral Palm Way</div><div class="t">14 visitors.<br><span class="gtx" style="font-style:italic">14 follow-ups.</span></div>
    ${VIS.map(([n, d]) => `<div class="row" style="height:84px"><span style="width:250px">${n}</span><span style="font-weight:500;color:rgba(11,11,18,.55);font-size:25px">${d}</span><span class="ok">DRAFTED ✓</span></div>`).join('')}</div>`, (b, s) => {
    $$('.row', s.el).forEach((d, i) => { const T = 33.3 + i * 0.2; vis(d, b >= T); slideIn(d, b, T, 250); });
  });
  lshot(35, 37, `${lightBg('chelsea_living')}<div class="qb" style="top:330px">Summarize Dana</div>
    <div class="card lglass" id="sm" style="top:500px"><div class="k">Client summary</div><div class="t">Dana Whitfield</div><div class="chips"><span>Buyer</span><span>Pre-approved $580k</span><span>Bethesda</span></div>
    <div class="cols3"><div><b>Do now</b><span>Send Elm St comps</span></div><div><b>Coming up</b><span>Showing · Thu 10 AM</span></div><div><b>Later</b><span>Inspection checklist</span></div></div></div>`, (b, s) => {
    pop(s.el.querySelector('.qb'), b, 35, 40); vis($('#sm'), b >= 35.3); pop($('#sm'), b, 35.3, 90);
    $$('.cols3 > div', s.el).forEach((d, i) => { const T = 35.75 + i * 0.25; vis(d, b >= T); pop(d, b, T, 50); });
  });
  lshot(37, 39, `${lightBg('hero_waterfront')}<div class="card lglass" style="top:360px"><div class="k">Monthly payment · 7 Harbor View Ct</div><div class="bign" id="pm">$0<small>/mo</small></div>
    <div class="bars"><i style="width:78.7%;background:var(--violet)"></i><i style="width:14.6%;background:var(--blue)"></i><i style="width:6.7%;background:var(--peach)"></i></div>
    <div class="leg"><div>Principal &amp; interest<b>$2,684</b></div><div>Taxes<b>$498</b></div><div>Insurance (est.)<b>$230</b></div></div></div>
    <div class="inkS" style="top:1050px;font-size:72px">PITI · net sheets · commission</div>`, (b, s) => {
    const v = Math.round(3412 * E.outCubic(P(b, 37.2, 38.4))); $('#pm').innerHTML = `$${v.toLocaleString('en-US')}<small>/mo</small>`;
    s.el.querySelector('.bars').style.clipPath = `inset(0 ${100 - 100 * E.outCubic(P(b, 37.3, 38.3))}% 0 0)`;
    const c = E.outExpo(P(b, 37.8, 38.2)); set(s.el.querySelector('.inkS'), { opacity: c, transform: `translate(-50%,-50%) translateY(${(1 - c) * 30}px)` });
  });
  const PRI = [['Priya Shah', 'New Zillow lead · call at 2 PM'], ['Dana Whitfield', 'Waiting on Elm St comps'], ['The Kims', 'Asked for a second showing']];
  lshot(39, 41, `${lightBg('austin_ext')}<div class="card lglass" style="top:340px"><div class="k">Priorities · today</div><div class="t">Who to follow up with.</div>
    ${PRI.map(([n, d], i) => `<div class="row" style="height:110px"><span style="width:56px;height:56px;border-radius:50%;background:linear-gradient(140deg,var(--blue),var(--violet) 60%,var(--peach));display:flex;align-items:center;justify-content:center;font:700 22px/1 var(--sans)">${i + 1}</span><span style="display:flex;flex-direction:column;gap:6px">${n}<span style="font:500 23px/1 var(--sans);color:rgba(11,11,18,.55)">${d}</span></span></div>`).join('')}</div>`, (b, s) => {
    $$('.row', s.el).forEach((d, i) => { const T = 39.2 + i * 0.3; vis(d, b >= T); slideIn(d, b, T, 260); });
  });
  lshot(41, 43, `${lightBg('md_cabin')}<div class="qb" style="top:330px">If I close Nov 20, when are my 1031 deadlines?</div>
    <div class="card lglass" id="av" style="top:570px"><div class="k">Advice</div><div class="ans">Identify by <span class="gtx" style="font-style:italic">Jan 4.</span><br>Close by <span class="gtx" style="font-style:italic">May 19.</span></div>
    <div class="fn" id="fn">45 and 180 days from closing. Confirm with your CPA or qualified intermediary.</div></div>`, (b, s) => {
    pop(s.el.querySelector('.qb'), b, 41, 40); vis($('#av'), b >= 41.3); pop($('#av'), b, 41.3, 80); vis($('#fn'), b >= 41.6); pop($('#fn'), b, 41.6, 20);
  });
  // b43-45: the speed run — photo-in-type, half a beat each
  TL.strobe.slice(0, 4).forEach(([T, w, p]) => shot(T, T + 0.5, `<div class="mtx ink" style="background-image:${img(p)};font-size:250px">${w}</div>`, (b, s) => {
    const k = E.outExpo(P(b, T, T + 0.25)); set(s.el.querySelector('.mtx'), { transform: `translate(-50%,-50%) scale(${1.25 - 0.25 * k})`, backgroundPosition: `${30 + 40 * P(b, T, T + 0.5)}% 50%`, filter: 'saturate(1.2) drop-shadow(0 20px 40px rgba(40,30,110,.25))' });
  }));
  // b45-49: the why — full photos cut every half beat
  TL.mont.forEach(([T, p], i) => shot(T, T + 0.5, `<div class="ph" style="background-image:${img(p)}"></div><div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,0) 40%,rgba(0,0,0,.35))"></div>
    <div class="serifW" style="top:620px;font-size:170px">${T < 47 ? 'Less admin.' : 'More <i>closings.</i>'}</div>`, (b, s) => {
    const k = E.outExpo(P(b, T, T + 0.22)), d = i % 2 ? -1 : 1; set(s.el.querySelector('.ph'), { transform: `translateX(${(1 - k) * 300 * d}px) scale(${1.14 - 0.06 * P(b, T, T + 0.5)})`, filter: k < 0.95 ? `blur(${(1 - k) * 16}px)` : 'none' });
    const w = T === 45 || T === 47 ? E.outExpo(P(b, T, T + 0.3)) : 1; set(s.el.querySelector('.serifW'), { transform: `translate(-50%,-50%) scale(${1.2 - 0.2 * w})`, opacity: w });
  }));
  // b49-53: you approve, she does the rest
  lshot(49, 53, `<div class="inkS" id="ya" style="top:420px;font-size:150px">You approve.</div>
    <div class="apb" id="ap"><b id="apf"></b><span id="apt">Approve all · 14</span></div>
    <div class="inkS" id="mr" style="top:1030px;font-size:120px"><span class="gtx" style="font-style:italic">Mila does the rest.</span></div>`, (b, s) => {
    const a = E.outExpo(P(b, 49, 49.4)); set($('#ya'), { opacity: a, transform: `translate(-50%,-50%) translateY(${(1 - a) * 40}px)` });
    pop($('#ap'), b, 49.6, 80); const ok = b >= 51, f = E.outCubic(P(b, 51, 51.15));
    $('#apf').style.opacity = f; $('#apt').textContent = ok ? 'Approved ✓' : 'Approve all · 14'; $('#apt').style.color = ok ? 'var(--ink)' : '#fff';
    $('#ap').style.boxShadow = `0 40px 80px -30px rgba(11,11,18,.6), 0 0 ${110 * pulseAt(b, 51, 2)}px rgba(166,140,255,.95)`;
    if (b >= 51 && b < 51.25) $('#ap').style.transform = `scale(${1 - 0.06 * Math.sin(P(b, 51, 51.25) * Math.PI)})`;
    const m = E.outExpo(P(b, 51.3, 51.8)); set($('#mr'), { opacity: m, transform: `translate(-50%,-50%) translateY(${(1 - m) * 40}px)` });
  });
  // b53-57: available today
  const PRC = [['Start free', '7 days', 'No card needed', 1], ['Mila', '$39<small>/mo</small>', '1,200 credits', 0], ['Annual', '$390<small>/yr</small>', 'Two months free', 0], ['Teams', 'Custom', 'For brokerages', 0]];
  lshot(53, 57, `<div class="bloomR" style="top:300px;opacity:.5"></div><div class="inkS" id="at" style="top:300px;font-size:130px">Live today <span class="gtx" style="font-style:italic">at 2 PM.</span></div>
    <div class="ban" id="lib" style="top:1110px;font-size:26px">START FREE · <b>LINK IN BIO ↑</b></div>
    ${PRC.map(([k, p, d, h], i) => `<div class="prc ${h ? 'hero' : 'lglass'}" style="left:${i % 2 ? 560 : 80}px;top:${520 + Math.floor(i / 2) * 290}px"><div class="k2">${k}</div><div class="p2">${p}</div><div class="d2">${d}</div></div>`).join('')}`, (b, s) => {
    const a = E.outExpo(P(b, 53, 53.4)); set($('#at'), { opacity: a, transform: `translate(-50%,-50%) scale(${1.15 - 0.15 * a})` });
    $$('.prc', s.el).forEach((d, i) => { const T = 54 + i * 0.75; vis(d, b >= T); pop(d, b, T, 90); });
    const lb2 = E.outBack(P(b, 56.6, 56.9)); vis($('#lib'), b >= 56.6); set($('#lib'), { transform: `translateX(-50%) scale(${lb2})` });
  });
  // b57-61: the lyric line — "I follow, I follow you"
  [[57, 'She follows up.', 'cliff_sunset', 200], [59, 'So you don’t have to.', 'malibu_sunset', 150]].forEach(([T, w, p, fs]) => shot(T, T + 2, `<div class="mtx ink" style="background-image:${img(p)};font-size:${fs}px">${w}</div>`, (b, s) => {
    const k = E.outExpo(P(b, T, T + 0.35)); set(s.el.querySelector('.mtx'), { transform: `translate(-50%,-50%) scale(${1.25 - 0.25 * k})`, letterSpacing: `${-0.035 + 0.05 * (1 - k)}em`, backgroundPosition: `${30 + 40 * P(b, T, T + 2)}% 50%`, filter: 'saturate(1.2) drop-shadow(0 20px 40px rgba(40,30,110,.25))' });
  }));
  // end card
  shot(61, 67.95, `<div class="full" style="background:transparent"><div id="wordmark">Mila</div><div id="tagline"><div class="ln"><span>Your AI operations manager for real estate. <b style="color:#7a6be0">Live today · 2 PM.</b></span></div></div>
    <div id="cta"><div class="ln"><span>Start your <span class="q">7-day</span> free trial.</span></div><div class="ln"><span style="font-size:34px;font-weight:650;letter-spacing:.02em;color:#7a6be0">No card · link in bio ↑</span></div></div>
    <div class="ban" id="lb3" style="top:960px;font-size:30px;padding:30px 50px;border-radius:50px">TAP THE <b>LINK IN BIO</b></div></div>`, (b) => {
    const rise = E.outExpo(P(b, 61, 62.7));
    set($('#wordmark'), { top: (360 + 90 * (1 - rise)) + 'px', opacity: E.outCubic(P(b, 61, 61.5)), transform: `translateX(-50%) scale(${0.9 + 0.1 * rise})`, filter: `blur(${(1 - E.outCubic(P(b, 61, 62))) * 14}px)` });
    set($('#tagline'), { top: '660px', transform: 'translateX(-50%)' }); reveal($('#tagline .ln > span'), b, 61.7, 999, 1.0);
    set($('#cta'), { top: '750px', transform: 'translateX(-50%)' }); $$('#cta .ln > span').forEach((s, j) => reveal(s, b, 62.3 + j * 0.45, 999, 0.9));
    const l3 = E.outBack(P(b, 63.4, 63.75)); set($('#lb3'), { transform: `translateX(-50%) scale(${l3}) translateY(${-6 * Math.max(0, Math.sin((b - 63.4) * Math.PI))}px)`, opacity: clamp(l3 * 2) });
  }, { end: true });

  /* ---------------------------------------------------------------- assets */
  await document.fonts.load('400 40px "Instrument Serif"'); await document.fonts.load('italic 40px "Instrument Serif"'); await document.fonts.load('600 16px "Inter"'); await document.fonts.load('700 16px "DejaVu Sans Mono"'); await document.fonts.ready;
  const PHOTOS = [...new Set([...document.body.innerHTML.matchAll(/assets\/(photos|logos)\/([a-z_-]+)\.(jpg|svg)/g)].map(m => m[0]))];
  await Promise.all(PHOTOS.map(n => new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = n; })));
  function reveal(span, b, b0, outB = 999, dur = 0.8) { const p = E.outExpo(P(b, b0, b0 + dur)), q = E.inCubic(P(b, outB, outB + 0.35)); span.style.transform = `translateY(${(1 - p) * 112 - q * 112}%)`; span.style.opacity = p > 0 ? 1 : 0; span.style.filter = (p < 1 || q > 0) ? `blur(${(1 - p) * 6 + q * 6}px)` : 'none'; }

  const R = { cam: $('#cam'), light: $('#light'), lbT: $('#lbT'), lbB: $('#lbB'), leak: $('#leak'), flash: $('#flash'), vig: $('#vig'), gA: $('#gA'), gB: $('#gB'), gC: $('#gC') };
  vis($('#counter'), false);
  const grain = $('#grain'), gctx = grain.getContext('2d'), NOISE = [];
  { const r = rng(99); for (let k = 0; k < 8; k++) { const c = document.createElement('canvas'); c.width = 540; c.height = 675; const x = c.getContext('2d'), id = x.createImageData(540, 675); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 110; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); NOISE.push(c); } }

  /* ================================================================ RENDER */
  const CUT_T = [2, ...TL.fill, 13, 15, 17, 21, 23, 24, 25, 27, 29, 31.5, 33, 35, 37, 39, 41, ...TL.strobe.map(s => s[0]), ...TL.mont.map(m => m[0]), 49, 51, 53, 57, 59, 61];
  const GRV = TL.groove;
  function render(t) {
    const raw = t / BEAT, b = raw, R2 = TL.reveal;
    const tail = raw >= TL.loopTail[0], tailIn = E.inOut(P(raw, 66.1, 67.85));
    const lightWorld = b >= R2 && !tail;
    let cs = 1 + 0.004 * per(raw, 2), cx = per(raw, 3) * 2, cy = per(raw, 2) * 2;
    for (const T of CUT_T) { if (b >= T && b < T + 0.6) cs *= 1 + 0.035 * Math.exp(-(b - T) * 9); }
    for (const T of GRV) { if (b >= T && b < T + 0.4) { cs *= 1 + 0.01 * Math.exp(-(b - T) * 10); cy += 3 * Math.exp(-(b - T) * 12); } }
    if (b >= TL.hang[0] && b < R2) cs *= 1 + 0.03 * E.inCubic(P(b, TL.hang[0], R2));
    R.cam.style.transform = `translate(${cx}px,${cy}px) scale(${cs})`;
    vis(R.light, lightWorld || (b >= 60.9 && raw < 67.95));
    if (R.light.style.visibility !== 'hidden') {
      set(R.gA, { left: (240 + per(raw, 2) * 160) + 'px', top: (480 + perc(raw, 1) * 140) + 'px', opacity: 0.8 });
      set(R.gB, { left: (860 + perc(raw, 2) * 140) + 'px', top: (760 + per(raw, 1) * 160) + 'px', opacity: 0.75 });
      set(R.gC, { left: (540 + per(raw, 1) * 220) + 'px', top: 1180 + 'px', opacity: 0.7 });
      R.light.style.opacity = tail ? 1 - tailIn : 1;
    }
    for (const s of SH) {
      let on;
      if (s.hook) on = b < s.b || raw >= 66.1;
      else if (s.end) on = b >= s.a && raw < 67.95;
      else on = b >= s.a && b < s.b && !tail;
      vis(s.el, on); if (!on) continue;
      if (s.hook) { s.upd(tail ? 0 : b, s); s.el.style.opacity = tail ? tailIn : 1; }
      else if (s.end) { s.upd(b, s); s.el.style.opacity = tail ? 1 - tailIn : 1; }
      else s.upd(b, s);
    }
    const lb = tail ? tailIn : 1 - E.outExpo(P(b, R2 - 0.02, R2 + 0.3));
    R.lbT.style.transform = `translateY(${-(1 - lb) * 180}px)`; R.lbB.style.transform = `translateY(${(1 - lb) * 180}px)`;
    vis(R.lbT, lb > 0.001); vis(R.lbB, lb > 0.001);
    const leakT = [R2, 29, 45, 53, 61].find(T => b >= T && b < T + 0.8);
    vis(R.leak, leakT !== undefined && !tail);
    if (leakT !== undefined) { const p = P(b, leakT, leakT + 0.8); set(R.leak, { transform: `translateX(${lerp(-1100, 1100, E.inOut(p))}px)`, opacity: Math.sin(p * Math.PI) }); }
    const fl = tail ? 0 : Math.max(b >= R2 - 0.08 && b < R2 ? P(b, R2 - 0.08, R2) : 0, pulseAt(b, R2, 4), ...TL.fill.map(h => 0.22 * pulseAt(b, h, 12)), 0.3 * pulseAt(b, 45, 8), 0.3 * pulseAt(b, 47, 8), 0.35 * pulseAt(b, 53, 6), 0.25 * pulseAt(b, 57, 8), 0.25 * pulseAt(b, 59, 8), 0.3 * pulseAt(b, 61, 6));
    R.flash.style.opacity = fl; vis(R.flash, fl > 0.002);
    R.vig.style.opacity = lightWorld ? 0.35 : 1;
    const fi = Math.floor(t * 60), nz = NOISE[fi % 8], gx = (fi * 137) % 540, gy = (fi * 251) % 675;
    gctx.drawImage(nz, -gx, -gy); gctx.drawImage(nz, 540 - gx, -gy); gctx.drawImage(nz, -gx, 675 - gy); gctx.drawImage(nz, 540 - gx, 675 - gy);
    grain.style.opacity = lightWorld ? 0.12 : 0.24;
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
