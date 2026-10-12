/* Mila film #12 — "Launch" (4:5 feed).
 * render(t) is a pure function of time; cues are beats b of "1997 (Extended Mix)" at 132 BPM (0.45445 s).
 * BUILD (letterboxed, dark): "You just got the listing." b0 · photo-in-type to-do list, one word per beat b2-8, half-beats b9-11.5 ·
 * photo strobe on 1/4 beats + counter to 40 tasks b12-14 · "Or just say:" + composer b14-15.25 · reverb hang b15.5 ·
 * DROP b16: bars snap open, bright premium world, one feature per beat b16-24 · "Every listing." montage on 1/2 beats b25-29 ·
 * kicker words b29-32 · "Launched." b33 · end card b34.5 · loop tail b43-44 to the exact frame 0.
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
  const img = n => `url(assets/photos/${n}.jpg)`;
  const CHECK = s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
  const ARROW = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 18.5V5.5M6 11.5 12 5.5l6 6"/></svg>`;

  /* ---------------------------------------------------------------- shots */
  const SH = [];
  const shot = (a, b, html, upd, opts = {}) => { const el = document.createElement('div'); el.className = 'full'; el.innerHTML = html; $('#shots').appendChild(el); const s = { a, b, el, upd, ...opts }; SH.push(s); return s; };
  const dark = (n, bri = 0.42) => `<div class="ph" style="background-image:${img(n)};filter:brightness(${bri}) saturate(.85) blur(${bri < 0.4 ? 6 : 0}px)"></div>`;

  // HOOK b0-2 (also the loop frame)
  const HOOK = shot(-9, 2, `${dark('hero_waterfront', 0.5)}<div class="serifW" style="top:610px;font-size:104px">You just got<br>the listing.</div>
    <div class="mono" style="position:absolute;left:0;right:0;top:800px;text-align:center;color:rgba(255,255,255,.7)">48 Coral Palm Way · Naples, FL</div>`, (b, s) => {
    s.el.querySelector('.ph').style.transform = `scale(${1.04 + 0.05 * P(b, 0, 2)})`;
  }, { hook: true });
  // to-do words, photo inside the type
  const TODO = [...TL.todo1.map(([w, at, p]) => [w, at, at + 1, p]), ...TL.todo2.map(([w, at], i) => [w, at, at + 0.5, ['tampa_rockpool', 'beach_boardwalk', 'malibu_firepit', 'nyc_loft', 'hill_ranch', 'austin_int'][i]])];
  TODO.forEach(([w, a, e, p], i) => shot(a, e, `${dark(p, 0.32)}<div class="mtx" style="background-image:${img(p)};font-size:${w.length > 9 ? 190 : 240}px">${w}</div>`, (b, s) => {
    const k = E.outExpo(P(b, a, a + 0.35));
    set(s.el.querySelector('.mtx'), { transform: `translate(-50%,-50%) scale(${1.18 - 0.18 * k})`, backgroundPosition: `${40 + 20 * P(b, a, e)}% 50%`, filter: `brightness(1.35) saturate(1.15) drop-shadow(0 10px 40px rgba(0,0,0,.6))` });
    s.el.querySelector('.ph').style.transform = `scale(${1.12 - 0.06 * P(b, a, e)})`;
  }, { cut: true }));
  // photo strobe b12-14
  TL.strobe.forEach(([a, p], i) => shot(a, a + 0.25, `<div class="ph" style="background-image:${img(p)};filter:brightness(.9) contrast(1.05)"></div>`, (b, s) => { s.el.querySelector('.ph').style.transform = `scale(${1.1 - 0.04 * P(b, a, a + 0.25)})`; }));
  // 40 TASKS b14 + composer
  const CMP = shot(14, 16, `<div style="position:absolute;inset:0;background:#05050a"></div>
    <div class="serifW" id="orSay" style="top:560px;font-size:90px">Or just say:</div>
    <div id="composer" class="dglass"><span id="typed"></span><span id="caret"></span><div class="send">${ARROW}</div></div>`, (b, s) => {
    const k = TL.keyBeats.filter(x => x <= b).length;
    $('#typed').textContent = TL.prompt.slice(0, k); $('#caret').style.opacity = b >= TL.send ? 0 : (k < TL.prompt.length || b % 0.5 < 0.3 ? 1 : 0);
    const a = E.outExpo(P(b, 14, 14.35)), ca = E.spring(P(b, 14.2, 14.7)), hang = E.inCubic(P(b, 15.5, 16));
    set($('#orSay'), { opacity: a * (1 - hang), transform: `translate(-50%,-50%) translateY(${(1 - a) * 30}px)` });
    set($('#composer'), { opacity: clamp(ca * 2) * (1 - hang * 0.6), transform: `translateY(${(1 - ca) * 80}px) scale(${1 + 0.05 * hang})`, filter: hang > 0.01 ? `blur(${hang * 6}px)` : 'none',
      boxShadow: b >= TL.send ? `0 0 ${80 * pulseAt(b, TL.send, 2)}px rgba(166,140,255,.95)` : '' });
    s.el.querySelector('.send').style.transform = `scale(${b >= TL.send && b < TL.send + 0.2 ? 1 - 0.12 * Math.sin(P(b, TL.send, TL.send + 0.2) * Math.PI) : 1})`;
  });

  /* post-drop: light world shots */
  const lightBg = p => p ? `<div class="ph" style="background-image:${img(p)};filter:blur(30px) brightness(1.15) saturate(1.1);opacity:.55"></div>` : '';
  shot(16, 17, `<div class="ph" style="background-image:${img('hero_waterfront')}"></div><div class="serifW" style="top:230px;font-size:150px">Just listed.</div>
    <div class="card lglass" style="top:900px;padding:30px 40px"><div class="k">48 Coral Palm Way · Naples, FL</div><div class="t" style="font-size:64px">$2,450,000</div><div class="d" style="margin-top:8px">4 bd · 4.5 ba · 3,860 sq ft · private dock</div></div>`, (b, s) => {
    s.el.querySelector('.ph').style.transform = `scale(${1.2 - 0.14 * E.outExpo(P(b, 16, 17))})`;
    const c = E.spring(P(b, 16.15, 16.7)); set(s.el.querySelector('.card'), { transform: `translateY(${(1 - c) * 200}px)`, opacity: clamp(c * 2) });
  });
  const COPY = 'Waterfront living, redefined. Sunrise over the Gulf from a private dock, an infinity pool framed by royal palms, and four bedrooms of light-filled calm.';
  shot(17, 18, `${lightBg('hero_waterfront')}<div class="card lglass" style="top:330px;height:640px"><div class="k">Listing copy · written</div><div class="t" style="font-size:92px">Waterfront living, redefined.</div><div class="d" id="copyT" style="font-size:36px;line-height:1.42;margin-top:26px;color:rgba(11,11,18,.72)"></div></div>`, (b, s) => {
    $('#copyT').textContent = COPY.slice(0, Math.floor(COPY.length * P(b, 17.1, 17.85)));
    const c = E.outExpo(P(b, 17, 17.3)); set(s.el.querySelector('.card'), { transform: `translateY(${(1 - c) * 80}px) scale(${0.95 + 0.05 * c})` });
  });
  const G9 = ['hero_waterfront', 'sarasota_bridgepool', 'lauderdale_tiki', 'tampa_rockpool', 'malibu_pool', 'beach_boardwalk', 'malibu_firepit', 'austin_int', 'nyc_loft'];
  shot(18, 19, `${lightBg()}<div class="grid9">${G9.map(p => `<div style="background-image:${img(p)}"></div>`).join('')}</div><div class="pill" style="position:absolute;left:90px;top:1180px">PHOTOS · ORGANIZED ${CHECK(20)}</div>`, (b, s) => {
    $$('.grid9 div', s.el).forEach((d, i) => { const a = E.outBack(P(b, 18 + i * 0.07, 18 + i * 0.07 + 0.25)); set(d, { transform: `scale(${a})`, opacity: clamp(a * 3) }); });
  });
  shot(19, 20, `${lightBg('lauderdale_tiki')}<div class="ig"><div class="hd"><div class="av"></div>coastline.realty<span style="margin-left:auto;font:700 16px/1 var(--mono);letter-spacing:.14em;color:#7a6be0">SCHEDULED</span></div>
    <div class="img" style="background-image:${img('hero_waterfront')}"><b>Just<br>listed.</b></div><div class="ft">♡ ◯ ➤<div class="dots"><i></i><i></i><i></i></div></div></div>`, (b, s) => {
    const a = E.outExpo(P(b, 19, 19.4)); set(s.el.querySelector('.ig'), { transform: `perspective(1600px) rotateY(${(1 - a) * -28 + 6}deg) rotateX(4deg) translateY(${(1 - a) * 80}px)` });
  });
  shot(20, 21, `${lightBg('sarasota_bridgepool')}<div class="card lglass" style="top:300px"><div class="k">Email blast · ready</div><div class="t">Just listed in Naples.</div><div class="d">To: <b id="nB">0</b> buyers who want waterfront</div><div class="avs">${'<i></i>'.repeat(32)}</div></div>`, (b, s) => {
    const n = Math.floor(31 * P(b, 20.05, 20.75)); $('#nB').textContent = n;
    $$('.avs i', s.el).forEach((d, i) => { const on = i < n; set(d, { transform: `scale(${on ? 1 : 0.3})`, opacity: on ? 1 : 0.15 }); });
  });
  shot(21, 22, `${lightBg('malibu_pool')}<div class="card lglass" style="top:290px"><div class="k">Open house · on the calendar</div><div class="t">Sunday, 1–4 PM</div>
    <div class="cal">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<div style="font-weight:700">${d}</div>`).join('')}${Array.from({ length: 14 }, (_, i) => `<div>${i + 9}</div>`).join('')}</div></div><div class="stamp" id="stmp" style="left:560px;top:820px">OPEN HOUSE</div>`, (b, s) => {
    const a = E.outBack(P(b, 21.15, 21.4)); set($('#stmp'), { transform: `rotate(-8deg) scale(${lerp(2.2, 1, clamp(a, 0, 1.2))})`, opacity: clamp(P(b, 21.15, 21.22) * 5) });
  });
  shot(22, 23, `${lightBg('austin_ext')}<div class="card" style="top:250px;padding:0"><div class="k" style="color:#7a6be0">Showings · booked</div><div class="t" style="margin-bottom:10px">4 this weekend.</div>
    ${['Sat · 10:00 AM · Jordan', 'Sat · 11:30 AM · Priya', 'Sun · 4:30 PM · Marcus', 'Mon · 9:00 AM · the Ellises'].map(r => `<div class="row">${r}<span class="ok">BOOKED ✓</span></div>`).join('')}</div>`, (b, s) => {
    $$('.row', s.el).forEach((d, i) => { const a = E.spring(P(b, 22 + i * 0.25, 22.4 + i * 0.25)); set(d, { transform: `translateX(${(1 - a) * 300}px)`, opacity: clamp(a * 2) }); });
  });
  shot(23, 24, `${lightBg('tampa_rockpool')}<div class="card" style="top:280px;padding:0"><div class="k" style="color:#7a6be0">Follow-ups · queued</div><div class="t" style="margin-bottom:10px">Nobody slips.</div>
    ${['Thanks for coming Sunday! Want a second look?', 'Hi Priya, the disclosures are ready for you.', 'Marcus, a similar home just hit in Tampa.'].map(m => `<div class="bub">${m}</div>`).join('')}</div>`, (b, s) => {
    $$('.bub', s.el).forEach((d, i) => { const a = E.spring(P(b, 23.1 + i * 0.25, 23.5 + i * 0.25)); set(d, { transform: `translateY(${(1 - a) * 60}px) scale(${0.9 + 0.1 * a})`, opacity: clamp(a * 2) }); });
  });
  shot(24, 25, `${lightBg('hero_waterfront')}<div class="card lglass" style="top:380px;text-align:center"><div class="k">Ready for approval</div><div class="t" style="font-size:96px">6 drafts.</div><div class="d">Copy · photos · post · email · showings · follow-ups</div>
    <div id="apBtn" style="margin:34px auto 0;width:520px;height:100px;border-radius:50px;background:var(--ink);color:#fff;font:650 34px/100px var(--sans);position:relative;overflow:hidden"><b id="apFill" style="position:absolute;inset:0;background:linear-gradient(135deg,var(--blue),var(--violet) 55%,var(--peach));opacity:0"></b><span id="apTx" style="position:relative">Approve all</span></div></div>`, (b, s) => {
    const ok = b >= 24.5, f = E.outCubic(P(b, 24.5, 24.62)), press = ok && b < 24.7 ? 1 - 0.06 * Math.sin(P(b, 24.5, 24.7) * Math.PI) : 1;
    $('#apFill').style.opacity = f; $('#apTx').textContent = ok ? 'All approved ✓' : 'Approve all'; $('#apTx').style.color = ok ? 'var(--ink)' : '#fff';
    set($('#apBtn'), { transform: `scale(${press})`, boxShadow: ok ? `0 0 ${70 * pulseAt(b, 24.5, 2)}px rgba(166,140,255,.95)` : 'none' });
  });
  // montage: every listing, half-beat whip cuts
  TL.montage.forEach(([a, p, l], i) => shot(a, a + 0.5, `<div class="ph" style="background-image:${img(p)}"></div><div class="mono mlab">${l}</div><div class="serifW" style="top:250px;font-size:140px">Every listing.</div>`, (b, s) => {
    const k = E.outExpo(P(b, a, a + 0.2)), dir = i % 2 ? -1 : 1;
    s.el.querySelector('.ph').style.transform = `translateX(${(1 - k) * 380 * dir}px) scale(${1.15 - 0.06 * P(b, a, a + 0.5)})`;
    s.el.querySelector('.ph').style.filter = k < 0.95 ? `blur(${(1 - k) * 18}px)` : 'none';
  }, { montage: true }));
  // kicker words
  TL.kicker.forEach(([w, a, p], i) => shot(a, a + 1, `<div class="mtx ink" style="background-image:${img(p)};font-size:${w.length > 8 ? 200 : 250}px">${w}</div><div class="pill" style="position:absolute;left:50%;top:860px;transform:translateX(-50%)">${CHECK(22)}</div>`, (b, s) => {
    const k = E.outExpo(P(b, a, a + 0.3)); set(s.el.querySelector('.mtx'), { transform: `translate(-50%,-50%) scale(${1.25 - 0.25 * k})`, backgroundPosition: `${30 + 40 * P(b, a, a + 1)}% 50%`, filter: 'saturate(1.2) drop-shadow(0 20px 40px rgba(40,30,110,.25))' });
    const c = E.outBack(P(b, a + 0.15, a + 0.4)); set(s.el.querySelector('.pill'), { transform: `translateX(-50%) scale(${c})` });
  }));
  shot(33, 34.5, `<div class="ph" style="background-image:${img('hero_waterfront')};filter:brightness(.55)"></div><div class="mtx" style="background-image:${img('malibu_sunset')};font-size:250px;filter:brightness(1.4) saturate(1.2) drop-shadow(0 20px 60px rgba(0,0,0,.6))">Launched.</div>`, (b, s) => {
    const k = E.outExpo(P(b, 33, 33.5)); set(s.el.querySelector('.mtx'), { transform: `translate(-50%,-50%) scale(${1.3 - 0.3 * k})`, letterSpacing: `${-0.035 + 0.05 * (1 - k)}em`, backgroundPosition: `${50 + 20 * P(b, 33, 34.5)}% 50%` });
    s.el.querySelector('.ph').style.transform = `scale(${1.1 - 0.05 * P(b, 33, 34.5)})`;
  });
  // end card (light)
  const END = shot(34.5, 43.6, `<div class="full" style="background:transparent"><div id="wordmark">Mila</div><div id="tagline"><div class="ln"><span>Your AI operations manager for real estate.</span></div></div>
    <div id="cta"><div class="ln"><span>Comment <span class="q">“Mila”</span></span></div><div class="ln"><span>for a 7-day free trial.</span></div></div></div>`, (b) => {
    const rise = E.outExpo(P(b, 34.5, 36.2));
    set($('#wordmark'), { top: (360 + 90 * (1 - rise)) + 'px', opacity: E.outCubic(P(b, 34.5, 35)), transform: `translateX(-50%) scale(${0.9 + 0.1 * rise})`, filter: `blur(${(1 - E.outCubic(P(b, 34.5, 35.5))) * 14}px)` });
    set($('#tagline'), { top: '660px', transform: 'translateX(-50%)' }); reveal($('#tagline .ln > span'), b, 35.2, 999, 1.0);
    set($('#cta'), { top: '750px', transform: 'translateX(-50%)' }); $$('#cta .ln > span').forEach((s, j) => reveal(s, b, 35.8 + j * 0.45, 999, 0.9));
  }, { end: true });

  /* ---------------------------------------------------------------- assets */
  await document.fonts.load('400 40px "Instrument Serif"'); await document.fonts.load('italic 40px "Instrument Serif"'); await document.fonts.load('600 16px "Inter"'); await document.fonts.load('700 16px "DejaVu Sans Mono"'); await document.fonts.ready;
  const PHOTOS = [...new Set([...document.body.innerHTML.matchAll(/assets\/photos\/([a-z_]+)\.jpg/g)].map(m => m[1]))];
  await Promise.all(PHOTOS.map(n => new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = `assets/photos/${n}.jpg`; })));
  function reveal(span, b, b0, outB = 999, dur = 0.8) { const p = E.outExpo(P(b, b0, b0 + dur)), q = E.inCubic(P(b, outB, outB + 0.35)); span.style.transform = `translateY(${(1 - p) * 112 - q * 112}%)`; span.style.opacity = p > 0 ? 1 : 0; span.style.filter = (p < 1 || q > 0) ? `blur(${(1 - p) * 6 + q * 6}px)` : 'none'; }

  const R = { cam: $('#cam'), light: $('#light'), lbT: $('#lbT'), lbB: $('#lbB'), counter: $('#counter'), cntN: $('#cntN'), leak: $('#leak'), flash: $('#flash'), vig: $('#vig'), gA: $('#gA'), gB: $('#gB'), gC: $('#gC') };
  const grain = $('#grain'), gctx = grain.getContext('2d'), NOISE = [];
  { const r = rng(99); for (let k = 0; k < 8; k++) { const c = document.createElement('canvas'); c.width = 540; c.height = 675; const x = c.getContext('2d'), id = x.createImageData(540, 675); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 110; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); NOISE.push(c); } }
  const CUT_T = [2, ...TODO.map(t => t[1]), ...TL.strobe.map(s => s[0]), 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, ...TL.montage.map(m => m[0]), ...TL.kicker.map(k => k[1]), 33, 34.5];

  /* ================================================================ RENDER */
  function render(t) {
    const raw = t / BEAT, b = raw;
    const tail = raw >= TL.loopTail[0], tailIn = E.inOut(P(raw, 43.1, 43.85));
    const lightWorld = b >= 16 && !tail;

    /* camera: punch-in on every cut, beat pulse after the drop */
    let cs = 1 + 0.004 * per(raw, 2), cx = per(raw, 3) * 2, cy = per(raw, 2) * 2;
    for (const T of CUT_T) { if (b >= T && b < T + 0.6) cs *= 1 + 0.035 * Math.exp(-(b - T) * 9); }
    if (b >= 16 && b < 33) { const ph = b % 1; cs *= 1 + 0.008 * Math.exp(-ph * 7); cy += 4 * Math.exp(-ph * 9); }
    if (b >= 14 && b < 16) cs *= 1 + 0.03 * E.inCubic(P(b, 15.5, 16));
    R.cam.style.transform = `translate(${cx}px,${cy}px) scale(${cs})`;

    /* world */
    vis(R.light, lightWorld || (b >= 34.4 && raw < 43.9));
    if (R.light.style.visibility !== 'hidden') {
      set(R.gA, { left: (240 + per(raw, 2) * 160) + 'px', top: (480 + perc(raw, 1) * 140) + 'px', opacity: 0.8 });
      set(R.gB, { left: (860 + perc(raw, 2) * 140) + 'px', top: (760 + per(raw, 1) * 160) + 'px', opacity: 0.75 });
      set(R.gC, { left: (540 + per(raw, 1) * 220) + 'px', top: 1180 + 'px', opacity: 0.7 });
      R.light.style.opacity = tail ? 1 - tailIn : 1;
    }

    /* shots: exactly one active (plus the end card behind the tail) */
    for (const s of SH) {
      let on;
      if (s.hook) on = b < 2 || raw >= 43.1;
      else if (s.end) on = b >= s.a && raw < 43.95;
      else on = b >= s.a && b < s.b && !tail;
      vis(s.el, on); if (!on) continue;
      if (s.hook) { s.upd(tail ? 0 : b, s); s.el.style.opacity = tail ? tailIn : 1; }
      else if (s.end) { s.upd(b, s); s.el.style.opacity = tail ? 1 - tailIn : 1; }
      else s.upd(b, s);
    }

    /* letterbox: on through the build, snaps open on the drop, back for the loop */
    const lb = tail ? tailIn : 1 - E.outExpo(P(b, 15.95, 16.25));
    R.lbT.style.transform = `translateY(${-(1 - lb) * 180}px)`; R.lbB.style.transform = `translateY(${(1 - lb) * 180}px)`;
    vis(R.lbT, lb > 0.001); vis(R.lbB, lb > 0.001);
    // task counter during the build
    const cOn = (b >= 2 && b < 14.05) && !tail; vis(R.counter, cOn);
    if (cOn) { const n = b < 12 ? TODO.filter(x => b >= x[1]).length : 13 + Math.floor(27 * P(b, 12, 13.95)); R.cntN.textContent = String(n).padStart(2, '0'); R.counter.style.color = b >= 12 ? '#ff8aa0' : ''; }

    /* light leak sweep on big cuts, flashes */
    const leakT = [16, 25, 29, 33, 34.5].find(T => b >= T && b < T + 0.8);
    vis(R.leak, leakT !== undefined && !tail);
    if (leakT !== undefined) { const p = P(b, leakT, leakT + 0.8); set(R.leak, { transform: `translateX(${lerp(-1100, 1100, E.inOut(p))}px)`, opacity: Math.sin(p * Math.PI) }); }
    const fl = tail ? 0 : Math.max(b >= 15.9 && b < 16 ? P(b, 15.9, 16) : 0, 0.95 * pulseAt(b, 16, 5), 0.5 * pulseAt(b, 33, 6), 0.35 * pulseAt(b, 34.5, 6), b >= 12 && b < 14 ? 0.25 * pulseAt(b % 0.25, 0, 30) : 0, ...TL.kicker.map(k => 0.35 * pulseAt(b, k[1], 10)));
    R.flash.style.opacity = fl; vis(R.flash, fl > 0.002);
    R.vig.style.opacity = lightWorld ? 0.35 : 1;

    const fi = Math.floor(t * 60), nz = NOISE[fi % 8], gx = (fi * 137) % 540, gy = (fi * 251) % 675;
    gctx.drawImage(nz, -gx, -gy); gctx.drawImage(nz, 540 - gx, -gy); gctx.drawImage(nz, -gx, 675 - gy); gctx.drawImage(nz, 540 - gx, 675 - gy);
    grain.style.opacity = lightWorld ? 0.14 : 0.24;
  }

  /* ---------------------------------------------------------------- boot */
  window.renderFrame = render; window.DURATION = DUR;
  for (const tw of [0, 3, 9.2, 12.5, 14.6, 15.7, 16.4, 17.5, 18.5, 19.5, 20.5, 21.5, 22.5, 23.5, 24.6, 25.3, 27.2, 29.5, 31.5, 33.5, 37, 43.5, 43.95]) render(tw * BEAT);
  render(0); window.__ready = true;
  if (!RENDER) {
    const aud = $('#aud'), pp = $('#pp'), scrub = $('#scrub'), tc = $('#tc'); scrub.max = DUR; let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (aud.currentTime >= DUR - 0.05) aud.currentTime = 0; aud.play(); } else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; render(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; render(t); scrub.value = t; tc.textContent = t.toFixed(2) + 's'; if (t >= DUR) { playing = false; pp.textContent = 'Play'; } } requestAnimationFrame(loop); };
    loop();
  }
})();
