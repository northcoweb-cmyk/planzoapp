/* Mila film #15 — "Pay Attention" (4:5 feed). Hype-edit style.
 * render(t) is a pure function of time t in SECONDS (the beat is a swung hip-hop edit; cuts are snapped to its real hits).
 * INTRO 0-7.3: letterboxed, slow pushes, the Mila voice-over captioned word by word:
 *   "And I'll tell you what. Every agent needs to start paying attention, because there's something going on… in real estate."
 * DROP 7.306: bars snap open; a cut on every hit: slam words over listings ⇄ Mila doing the work (copy, DMs, showings, follow-ups),
 *   photo strobe, "Approve all", kicker words on the brand gradient, a city montage, EVERY LISTING / LEAD / DAY.
 * BREAK 19.6: black. "Her name's Mila." The orb inhales…  HIT 22.33: the wordmark slams, CTA. Loop tail 24.7-25.5 to frame 0.
 */
(async function () {
  const TL = await (await fetch('timeline.json')).json();
  const DUR = TL.duration;
  const qs = new URLSearchParams(location.search);
  const RENDER = qs.has('render');
  if (RENDER) document.body.classList.add('render');
  const W = 1080, H = 1350, vp = document.getElementById('viewport');
  if (!RENDER) { const fit = () => { const k = Math.min(innerWidth / W, (innerHeight - 60) / H); vp.style.transformOrigin = '0 0'; vp.style.transform = `translate(${(innerWidth - W * k) / 2}px,0) scale(${k})`; }; fit(); addEventListener('resize', fit); }

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, p) => a + (b - a) * p, P = (x, x0, x1) => clamp((x - x0) / (x1 - x0));
  const E = {
    outExpo: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)), inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    outCubic: p => 1 - Math.pow(1 - p, 3), inCubic: p => p * p * p, outBack: p => { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    spring: p => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-6.2 * p) * Math.cos(9.5 * p)),
  };
  const TAU = Math.PI * 2, per = (t, k) => Math.sin(TAU * k * t / DUR), perc = (t, k) => Math.cos(TAU * k * t / DUR);
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const set = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const vis = (el, on) => { el.style.visibility = on ? 'inherit' : 'hidden'; };
  const pulseAt = (t, T, k = 8) => (t >= T ? Math.exp(-(t - T) * k) : 0);
  const img = n => `url(assets/photos/${n}.jpg)`;
  const CHECK = s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
  const B = TL.beat, DROP = TL.drop, BRK = TL.break, HIT = TL.hit;

  /* ---------------------------------------------------------------- shots */
  const SH = [];
  const shot = (a, b, html, upd, opts = {}) => { const el = document.createElement('div'); el.className = 'full'; el.innerHTML = html; $('#shots').appendChild(el); const s = { a, b, el, upd, ...opts }; SH.push(s); return s; };
  const photo = (n, f = '') => `<div class="ph" style="background-image:${img(n)};${f}"></div>`;

  // INTRO
  const IN = TL.intro, inEnd = i => (i + 1 < IN.length ? IN[i + 1][0] : DROP);
  IN.forEach(([a, kind], i) => {
    const b = inEnd(i);
    if (kind === 'orb') shot(a, b, `<div class="orb"></div>`, (t, s) => {
      const k = E.outExpo(P(t, a, a + 0.5)), br = 1 + 0.05 * Math.sin((t - a) * TAU * 1.1);
      set(s.el.querySelector('.orb'), { transform: `translateY(-230px) scale(${(0.6 + 0.4 * k) * br})`, opacity: k });
    });
    else if (kind === 'type') shot(a, b, `${photo('cliff_pool', 'filter:brightness(.35) blur(4px)')}<div class="mtx" style="background-image:${img('cliff_pool')};font-size:210px;filter:brightness(1.35) saturate(1.2)">real estate.</div>`, (t, s) => {
      const k = E.outExpo(P(t, 6.287, 6.6)), push = E.inCubic(P(t, 6.6, DROP));
      set(s.el.querySelector('.mtx'), { opacity: k, transform: `translate(-50%,-50%) scale(${(1.12 - 0.12 * k) * (1 + 2.2 * push)})`, letterSpacing: `${-0.035 + 0.04 * (1 - k)}em` });
      s.el.querySelector('.ph').style.transform = `scale(${1.05 + 0.1 * P(t, a, DROP)})`;
    });
    else shot(a, b, photo(kind, 'filter:brightness(.62) saturate(.9)'), (t, s) => {
      s.el.querySelector('.ph').style.transform = `scale(${1.04 + 0.07 * P(t, a, b)}) translateX(${(i % 2 ? -1 : 1) * 18 * P(t, a, b)}px)`;
    }, { hook: i === 0 });
  });

  // DROP
  const UI = {
    copy: () => `${photo('cliff_pool', 'filter:blur(26px) brightness(.5)')}<div class="card dglass" style="top:330px"><div class="k">Listing copy · drafted</div><div class="ct">Cliffside living, redefined.</div><div class="cd" data-type="Sunset over the Pacific from every room, a pool carved into the bluff, and nine bedrooms of calm."></div></div>`,
    dms: () => `${photo('chelsea_living', 'filter:blur(26px) brightness(.5)')}<div class="card" style="top:300px;padding:0"><div class="k">DMs · 214 replies drafted</div>
      <div class="bin">Is this still available??</div><div class="bout">Yes! I can show it Saturday at 10 or 11:30. Which works?</div><div class="bin">Can we tour this weekend?</div><div class="bout">Absolutely. Sending times now.</div></div>`,
    cal: () => `${photo('conservatory', 'filter:blur(26px) brightness(.45)')}<div class="card" style="top:300px;padding:0"><div class="k">Showings · booked</div><div class="ct" style="margin-bottom:12px">This weekend.</div>
      ${['Sat · 10:00 AM · Jordan', 'Sat · 11:30 AM · Priya', 'Sun · 1:00 PM · Marcus', 'Sun · 3:30 PM · Dana'].map(r => `<div class="row">${r}<span class="ok">BOOKED ✓</span></div>`).join('')}</div>`,
    follow: () => `${photo('village_kitchen', 'filter:blur(26px) brightness(.45)')}<div class="card" style="top:320px;padding:0"><div class="k">Follow-ups · queued</div><div class="ct" style="margin-bottom:8px">Nobody slips.</div>
      <div class="bout">Thanks for coming Sunday! Want a second look?</div><div class="bout">Hi Priya, the disclosures are ready.</div><div class="bout">A similar home just hit. Want to see it?</div></div>`,
    approve: () => `${photo('nassau_living', 'filter:blur(26px) brightness(.5)')}<div class="card dglass" style="top:380px;text-align:center"><div class="k">Ready for you</div><div class="ct" style="font-size:110px">6 drafts.</div>
      <div class="cd" style="min-height:0;font-size:28px">Copy · posts · replies · showings · follow-ups</div><div class="apb" id="apb"><b id="apF"></b><span id="apT">Approve all</span></div></div>`,
  };
  const KR = rng(15);
  TL.seq.forEach(([a, kind, pay, b], i) => {
    if (kind === 'slam') shot(a, b, `${photo(pay[1])}<div class="fill" style="background:rgba(0,0,0,.28)"></div><div class="slam" style="font-size:${Math.min(190, 1650 / pay[0].length)}px">${pay[0]}</div>`, (t, s) => {
      const k = E.outExpo(P(t, a, a + 0.18)), ph = s.el.querySelector('.ph');
      ph.style.transform = `scale(${1.22 - 0.14 * k - 0.03 * P(t, a, b)})`;
      set(s.el.querySelector('.slam'), { transform: `translate(-50%,-50%) scale(${1.35 - 0.35 * k}) skewX(${-6 * (1 - k)}deg)`, opacity: clamp(k * 4),
        textShadow: `${-14 * (1 - k)}px 0 rgba(143,180,255,.9), ${14 * (1 - k)}px 0 rgba(255,201,168,.9), 0 12px 60px rgba(0,0,0,.5)` });
    }, { cut: true });
    else if (kind === 'ui') shot(a, b, UI[pay](), (t, s) => {
      const c = E.outExpo(P(t, a, a + 0.2)), card = s.el.querySelector('.card');
      set(card, { transform: `translateY(${(1 - c) * 120}px) scale(${0.94 + 0.06 * c})`, opacity: clamp(c * 2) });
      const ty = s.el.querySelector('[data-type]'); if (ty) ty.textContent = ty.dataset.type.slice(0, Math.floor(ty.dataset.type.length * P(t, a + 0.05, b - 0.02)));
      $$('.bin,.bout,.row', s.el).forEach((d, j) => { const q = E.spring(P(t, a + 0.04 + j * 0.07, a + 0.3 + j * 0.07)); set(d, { transform: `translateY(${(1 - q) * 40}px) scale(${0.92 + 0.08 * q})`, opacity: clamp(q * 2) }); });
      if (pay === 'approve') {
        const T = TL.approveTap, ok = t >= T, f = E.outCubic(P(t, T, T + 0.08));
        $('#apF').style.opacity = f; $('#apT').innerHTML = ok ? `All approved ${CHECK(32)}` : 'Approve all';
        set($('#apb'), { transform: `scale(${ok && t < T + 0.12 ? 1 - 0.06 * Math.sin(P(t, T, T + 0.12) * Math.PI) : 1})`, boxShadow: ok ? `0 0 ${90 * pulseAt(t, T, 4)}px rgba(166,140,255,.95)` : 'none' });
      }
    }, { cut: true });
    else if (kind === 'strobe') shot(a, b, photo(pay, 'filter:contrast(1.05)'), (t, s) => { s.el.querySelector('.ph').style.transform = `scale(${1.14 - 0.05 * P(t, a, b)})`; });
    else if (kind === 'kick') shot(a, b, `<div class="kickbg"></div><div class="kickw" style="font-size:${Math.min(175, 1500 / pay.length)}px">${pay}</div>`, (t, s) => {
      const k = E.outExpo(P(t, a, a + 0.18)); set(s.el.querySelector('.kickw'), { transform: `translate(-50%,-50%) scale(${1.3 - 0.3 * k})`, opacity: clamp(k * 4) });
      s.el.querySelector('.kickbg').style.filter = `hue-rotate(${(i % 3) * 25}deg)`;
    }, { cut: true });
    else if (kind === 'mont') shot(a, b, `${photo(pay[0])}<div class="loc">${pay[1]}</div>`, (t, s) => {
      const k = E.outExpo(P(t, a, a + 0.12)), dir = i % 2 ? -1 : 1, ph = s.el.querySelector('.ph');
      ph.style.transform = `translateX(${(1 - k) * 360 * dir}px) scale(${1.14 - 0.05 * P(t, a, b)})`; ph.style.filter = k < 0.97 ? `blur(${(1 - k) * 18}px)` : 'none';
    });
    else if (kind === 'dark') shot(a, b, '', () => {});
  });

  // BREAK + HIT + END
  shot(BRK, 99, `<div class="orb" id="bOrb"></div><div class="ring" id="ring"></div><div id="wordmark">Mila</div>
    <div id="tagline"><div class="ln"><span>Your AI operations manager for real estate.</span></div></div>
    <div id="cta"><div class="ln"><span>Comment <span class="q">“Mila”</span></span></div><div class="ln"><span>for a 7-day free trial.</span></div></div>`, (t) => {
    // the orb rises in the break, inhales to a point, and the wordmark slams on the hit
    const rise = E.outCubic(P(t, BRK, 20.6)), inh = E.inCubic(P(t, 21.4, HIT)), after = t >= HIT;
    const o = $('#bOrb'); vis(o, !after);
    set(o, { transform: `translateY(${-230 + (1 - rise) * 80}px) scale(${(0.35 + 0.45 * rise) * (1 - 0.92 * inh) * (1 + 0.04 * Math.sin(t * TAU * 1.2))})`, opacity: rise });
    const w = E.outExpo(P(t, HIT, HIT + 0.35)); vis($('#wordmark'), after);
    set($('#wordmark'), { transform: `translate(-50%,-50%) scale(${1.6 - 0.6 * w})`, filter: `blur(${(1 - w) * 12}px)`, opacity: clamp(w * 3) });
    const r = P(t, HIT, HIT + 0.7); vis($('#ring'), after && r < 1); set($('#ring'), { transform: `scale(${0.4 + 2.4 * E.outCubic(r)})`, opacity: 1 - r });
    reveal($('#tagline .ln > span'), t, HIT + 0.35, 0.45); $$('#cta .ln > span').forEach((s, j) => reveal(s, t, HIT + 0.7 + j * 0.22, 0.45));
  }, { end: true });

  /* ---------------------------------------------------------------- assets */
  await document.fonts.load('400 40px "Instrument Serif"'); await document.fonts.load('italic 40px "Instrument Serif"'); await document.fonts.load('900 italic 40px "Inter"'); await document.fonts.load('800 16px "Inter"'); await document.fonts.load('700 16px "DejaVu Sans Mono"'); await document.fonts.ready;
  const PH = [...new Set([...document.body.innerHTML.matchAll(/assets\/photos\/([a-z_]+)\.jpg/g)].map(m => m[1]))];
  await Promise.all(PH.map(n => new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = `assets/photos/${n}.jpg`; })));
  function reveal(span, t, t0, dur) { const p = E.outExpo(P(t, t0, t0 + dur)); span.style.transform = `translateY(${(1 - p) * 112}%)`; span.style.opacity = p > 0 ? 1 : 0; span.style.filter = p < 1 ? `blur(${(1 - p) * 6}px)` : 'none'; }

  /* ---------------------------------------------------------------- captions */
  const cap = $('#cap'); let capKey = '';
  function caption(t) {
    for (const [t0, , text, mode, d, words] of TL.vo) {
      const end = t0 + d + (mode === 'line' ? 0.25 : 0.12);
      const from = mode === 'line' && t0 < 1 ? 0 : t0;               // the hook line is up from frame 0
      if (t < from || t >= end) continue;
      if (text.startsWith('in real') && t >= 6.27) return false;      // the big photo-type takes over from the caption
      let txt, k;
      if (mode === 'line') { txt = text.replace(/[.,]$/, ''); k = 'L' + t0; }
      else { let wi = 0; words.forEach(([wt], j) => { if (t >= wt) wi = j; }); txt = words[wi][1].replace(/[.,]$/, ''); k = 'W' + t0 + '_' + wi; }
      if (k !== capKey) { cap.textContent = txt; capKey = k; }
      const st = mode === 'line' ? t0 : words.reduce((a, [wt]) => (t >= wt ? wt : a), t0);
      const p = from === 0 ? 1 : E.outExpo(P(t, st, st + 0.12));
      set(cap, { opacity: p, transform: `translateY(-50%) scale(${1.12 - 0.12 * p})`, fontSize: (mode === 'line' ? 46 : 64) + 'px' });
      return true;
    }
    return false;
  }

  /* ---------------------------------------------------------------- render */
  const R = { cam: $('#cam'), lbT: $('#lbT'), lbB: $('#lbB'), leak: $('#leak'), flash: $('#flash'), gA: $('#gA'), gB: $('#gB'), gC: $('#gC') };
  const grain = $('#grain'), gctx = grain.getContext('2d'), NOISE = [];
  { const r = rng(99); for (let k = 0; k < 8; k++) { const c = document.createElement('canvas'); c.width = 540; c.height = 675; const x = c.getContext('2d'), id = x.createImageData(540, 675); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 110; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); NOISE.push(c); } }
  const SHAKE = TL.kicks.map((k, i) => { const r = rng(1000 + i); return [k, (r() - 0.5) * 2, (r() - 0.5) * 2, (r() - 0.5) * 2]; });
  const CUTS = [...TL.intro.map(x => x[0]).slice(1), ...TL.seq.map(s => s[0])];

  function render(t) {
    const tail = t >= TL.loopTail[0], tailIn = E.inOut(P(t, TL.loopTail[0], DUR - 0.05));
    const tt = tail ? 0 : t;                                       // everything but the end card runs from the hook state in the tail
    // camera: shake on every kick in the drop, punch on cuts, a slam on the final hit
    let cs = 1 + 0.004 * per(t, 2), cx = per(t, 3) * 2, cy = per(t, 2) * 2, rot = 0;
    if (!tail) {
      for (const [k, sx, sy, sr] of SHAKE) { if (t >= k && t < k + 0.25) { const e = Math.exp(-(t - k) * 22); cx += sx * 14 * e; cy += sy * 14 * e; rot += sr * 0.6 * e; cs *= 1 + 0.025 * e; } }
      for (const T of CUTS) if (t >= T && t < T + 0.3) cs *= 1 + 0.03 * Math.exp(-(t - T) * 14);
      if (t >= HIT && t < HIT + 0.5) { const e = Math.exp(-(t - HIT) * 10); cs *= 1 + 0.06 * e; cx += 16 * e * Math.sin((t - HIT) * 90); cy += 10 * e * Math.cos((t - HIT) * 70); }
    }
    R.cam.style.transform = `translate(${cx}px,${cy}px) rotate(${rot}deg) scale(${cs})`;
    set(R.gA, { left: (260 + per(t, 2) * 160) + 'px', top: (420 + perc(t, 1) * 120) + 'px' });
    set(R.gB, { left: (840 + perc(t, 2) * 140) + 'px', top: (820 + per(t, 1) * 140) + 'px' });
    set(R.gC, { left: (540 + per(t, 1) * 200) + 'px', top: 1250 + 'px' });

    for (const s of SH) {
      let on;
      if (s.hook) on = t < s.b || tail;
      else if (s.end) on = t >= s.a && !(tail && tailIn >= 1);
      else on = t >= s.a && t < s.b && !tail;
      vis(s.el, on); if (!on) continue;
      if (s.hook) { s.upd(tt, s); s.el.style.opacity = tail ? tailIn : 1; s.el.style.zIndex = tail ? 2 : ''; }
      else if (s.end) { s.upd(t, s); s.el.style.opacity = tail ? 1 - tailIn : 1; }
      else s.upd(t, s);
    }
    // letterbox in the intro, snapped open on the drop, back for the loop
    const lb = tail ? tailIn : 1 - E.outExpo(P(t, DROP - 0.02, DROP + 0.2));
    R.lbT.style.transform = `translateY(${-(1 - lb) * 150}px)`; R.lbB.style.transform = `translateY(${(1 - lb) * 150}px)`; vis(R.lbT, lb > 0.001); vis(R.lbB, lb > 0.001);
    const capOn = caption(tt) && (!tail || tailIn > 0.5); vis(cap, capOn); if (capOn && tail) cap.style.opacity = P(tailIn, 0.5, 1);

    const leakT = [DROP, 13.0, HIT].find(T => t >= T && t < T + 0.6);
    vis(R.leak, leakT !== undefined && !tail);
    if (leakT !== undefined) { const p = P(t, leakT, leakT + 0.6); set(R.leak, { transform: `translateX(${lerp(-1100, 1100, E.inOut(p))}px)`, opacity: Math.sin(p * Math.PI) }); }
    const fl = tail ? 0 : Math.max(t >= DROP - 0.1 && t < DROP ? 0.7 * E.inCubic(P(t, DROP - 0.1, DROP)) : 0, 0.9 * pulseAt(t, DROP, 9), 0.95 * pulseAt(t, HIT, 7),
      ...TL.seq.filter(s => s[1] === 'slam' || s[1] === 'kick').map(s => 0.28 * pulseAt(t, s[0], 18)), ...TL.seq.filter(s => s[1] === 'strobe').map(s => 0.3 * pulseAt(t, s[0], 25)));
    R.flash.style.opacity = fl; vis(R.flash, fl > 0.002);
    const fi = Math.floor(t * 60), nz = NOISE[fi % 8], gx = (fi * 137) % 540, gy = (fi * 251) % 675;
    gctx.drawImage(nz, -gx, -gy); gctx.drawImage(nz, 540 - gx, -gy); gctx.drawImage(nz, -gx, 675 - gy); gctx.drawImage(nz, 540 - gx, 675 - gy);
    grain.style.opacity = 0.22;
  }

  window.renderFrame = render; window.DURATION = DUR;
  for (const tw of [0, 2, 3.6, 5, 6.5, 7.4, 8, 9, 10, 11, 12.5, 14, 14.7, 15.5, 16.5, 17.5, 18.5, 19.5, 20.5, 22, 22.5, 23.5, 25, 25.45]) render(tw);
  render(0); window.__ready = true;
  if (!RENDER) {
    const aud = $('#aud'), pp = $('#pp'), scrub = $('#scrub'), tc = $('#tc'); scrub.max = DUR; let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (aud.currentTime >= DUR - 0.05) aud.currentTime = 0; aud.play(); } else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; render(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; render(t); scrub.value = t; tc.textContent = t.toFixed(2) + 's'; if (t >= DUR) { playing = false; pp.textContent = 'Play'; } } requestAnimationFrame(loop); };
    loop();
  }
})();
