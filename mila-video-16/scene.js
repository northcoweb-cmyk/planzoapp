/* Mila film #16 — "On the Calendar" (4:5 feed).
 * render(t) is a pure function of time; cues are beats b of "90s Legacy" at 130 BPM (0.461538 s).
 * BUILD (letterboxed, dark): client texts with times buried in them pile up, one per beat, over listing photos b0-7 ·
 *   "6 events. 0 on your calendar." b7 · "Or just tell Mila." + the ask b8-10.75 · Mila finds the 6 events b11 ·
 *   "Add 6 events?" Google Calendar + Apple Calendar on, tap b15 · reverb hang ·
 * DROP b16: bars snap open, bright world, the two calendar logos slam in · the events land in the week one per beat b17-22 ·
 *   lock-screen reminders b24 · kicker photos b28-32 · "You just say it. / Mila puts it on the calendar." b32-34 ·
 *   end card + "Works with Google Calendar & Apple Calendar" b34 · loop tail b42.5-44.
 */
(async function () {
  const TL = await (await fetch('timeline.json')).json();
  const BEAT = TL.beat, DUR = TL.duration, TOT = TL.totalBeats;
  const RENDER = new URLSearchParams(location.search).has('render');
  if (RENDER) document.body.classList.add('render');
  const W = 1080, H = 1350, vp = document.getElementById('viewport');
  if (!RENDER) { const fit = () => { const k = Math.min(innerWidth / W, (innerHeight - 60) / H); vp.style.transformOrigin = '0 0'; vp.style.transform = `translate(${(innerWidth - W * k) / 2}px,0) scale(${k})`; }; fit(); addEventListener('resize', fit); }

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, p) => a + (b - a) * p, P = (x, x0, x1) => clamp((x - x0) / (x1 - x0));
  const E = { outExpo: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)), inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2), outCubic: p => 1 - Math.pow(1 - p, 3),
    inCubic: p => p * p * p, outBack: p => { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    spring: p => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-6.2 * p) * Math.cos(9.5 * p)) };
  const TAU = Math.PI * 2, per = (b, k) => Math.sin(TAU * k * b / TOT), perc = (b, k) => Math.cos(TAU * k * b / TOT);
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const set = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const vis = (el, on) => { el.style.visibility = on ? 'inherit' : 'hidden'; };
  const pulseAt = (b, T, k = 8) => (b >= T ? Math.exp(-(b - T) * k) : 0);
  const img = n => `url(assets/photos/${n}.jpg)`;
  const CHECK = s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
  const ARROW = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 18.5V5.5M6 11.5 12 5.5l6 6"/></svg>`;
  // the two calendar apps
  const GCAL = s => `<img src="assets/logos/google-calendar.svg" width="${s}" height="${s}" style="display:block">`;
  const ACAL = (s, wd = 'Tuesday', n = '15') => `<svg width="${s}" height="${s}" viewBox="0 0 100 100" style="display:block;filter:drop-shadow(0 ${s / 40}px ${s / 18}px rgba(20,20,60,.18))">
    <rect x="1" y="1" width="98" height="98" rx="22.5" fill="#fff"/><rect x="1" y="1" width="98" height="98" rx="22.5" fill="none" stroke="rgba(0,0,0,.08)" stroke-width="1"/>
    <text x="50" y="28" text-anchor="middle" font-family="Inter" font-weight="550" font-size="13.5" fill="#FF3B30">${wd}</text>
    <text x="50" y="80" text-anchor="middle" font-family="Inter" font-weight="300" font-size="56" letter-spacing="-2" fill="#111">${n}</text></svg>`;

  /* ---------------------------------------------------------------- shots */
  const SH = [];
  const shot = (a, b, html, upd, o = {}) => { const el = document.createElement('div'); el.className = 'full'; el.innerHTML = html; $('#shots').appendChild(el); const s = { a, b, el, upd, ...o }; SH.push(s); return s; };
  function reveal(span, b, b0, dur = 0.6) { const p = E.outExpo(P(b, b0, b0 + dur)); span.style.transform = `translateY(${(1 - p) * 112}%)`; span.style.opacity = p > 0 ? 1 : 0; span.style.filter = p < 1 ? `blur(${(1 - p) * 6}px)` : 'none'; }

  // BUILD b0-8: the texts pile up (also the loop frame)
  const HIL = /(Saturday at 2|Tue 10:30 AM|Wednesday 1 PM|Friday 4:00|Sunday 1–4|Thu 9 AM)/;
  const MS = TL.msgs;
  const BUILD = shot(-9, 8, `${MS.map(m => `<div class="ph bg" style="background-image:${img(m[5])};filter:brightness(.38) saturate(.85) blur(4px)"></div>`).join('')}
    <div class="serifW" id="hook" style="top:255px;font-size:76px">Still adding these by hand?</div>
    ${MS.map((m, i) => `<div class="msg"><div class="fr"><div class="av" style="background:linear-gradient(140deg,hsl(${i * 53 + 200} 70% 70%),hsl(${i * 53 + 250} 60% 55%))"></div>${m[1]}<span class="now">now</span></div><div class="tx">${m[2].replace(HIL, '<b>$1</b>')}</div></div>`).join('')}
    <div class="serifW" id="zero" style="top:1080px;font-size:92px">6 events. <span style="color:#ff8aa0">0</span> on your calendar.</div>`, (b, s) => {
    let cur = 0; MS.forEach((m, i) => { if (b >= m[0]) cur = i; });
    $$('.bg', s.el).forEach((d, i) => { vis(d, i === cur); if (i === cur) d.style.transform = `scale(${1.1 - 0.05 * P(b, MS[i][0], MS[i][0] + 1)})`; });
    const shake = b >= 7 && b < 8 ? Math.exp(-(b - 7) * 5) : 0;
    $$('.msg', s.el).forEach((d, i) => {
      const T = MS[i][0]; if (b < T) { vis(d, false); return; }
      let slot = 0; MS.forEach((m2, j) => { if (j > i) slot += E.outCubic(P(b, m2[0], m2[0] + 0.3)); });
      vis(d, slot < 3.2);
      const a = T === 0 ? 1 : E.spring(P(b, T, T + 0.45)), sc = (0.82 + 0.18 * a) * Math.pow(0.9, slot);
      set(d, { top: (560 - slot * 120) + 'px', transform: `translateY(${(1 - a) * 200}px) scale(${sc}) rotate(${(i % 2 ? 1 : -1) * (slot > 0 ? 1.5 : 0) + Math.sin(b * 60 + i) * 3 * shake}deg)`,
        opacity: clamp(a * 2) * clamp(3.2 - slot) * (slot > 0 ? 0.88 : 1) * (1 - 0.5 * P(b, 7, 7.2)), zIndex: 10 + i });
    });
    const z = E.outExpo(P(b, 7, 7.3)); set($('#zero'), { opacity: z, transform: `translate(-50%,-50%) scale(${1.25 - 0.25 * z})` }); vis($('#zero'), b >= 7);
    $('#hook').style.opacity = 1 - P(b, 6.8, 7);
  }, { hook: true });

  // THE ASK b8-11
  shot(8, 11, `<div class="orbL" id="orb"></div><div class="serifW" style="top:600px;font-size:100px"><div class="ln"><span>Or just tell Mila.</span></div></div>
    <div id="composer" class="dglass"><span id="typed"></span><span id="caret"></span><div class="send">${ARROW}</div></div>`, (b, s) => {
    const k = TL.keyBeats.filter(x => x <= b).length; $('#typed').textContent = TL.prompt.slice(0, k);
    $('#caret').style.opacity = b >= TL.send ? 0 : (k < TL.prompt.length || b % 0.5 < 0.3 ? 1 : 0);
    reveal(s.el.querySelector('.ln span'), b, 8, 0.5);
    const c = E.spring(P(b, 8.4, 8.95)); set($('#composer'), { opacity: clamp(c * 2), transform: `translateY(${(1 - c) * 80}px)`, boxShadow: b >= TL.send ? `0 0 ${90 * pulseAt(b, TL.send, 3)}px rgba(166,140,255,.95)` : '' });
    set($('#orb'), { transform: `scale(${clamp(E.outBack(P(b, 8, 8.5)), 0, 1.2) * (1 + 0.04 * Math.sin(b * TAU) + 0.25 * pulseAt(b, TL.send, 5))})` });
  });
  // MILA FINDS THE EVENTS b11-13.5
  shot(11, 13.5, `<div class="dglass" id="found" style="position:absolute;left:90px;top:220px;width:900px;padding:40px 42px"><div class="k">Mila found 6 events</div>
    <div style="font:400 72px/1 var(--serif);margin:14px 0 10px">From 6 texts.</div>${MS.map(m => `<div class="ev"><i></i><span class="d">${m[3]}</span>${m[4]}<span class="ok">READY</span></div>`).join('')}</div>`, (b, s) => {
    const c = E.outExpo(P(b, 11, 11.3)); set($('#found'), { opacity: c, transform: `translateY(${(1 - c) * 60}px)` });
    $$('.ev', s.el).forEach((d, i) => { const a = E.spring(P(b, 11 + i * 0.25, 11.4 + i * 0.25)); set(d, { transform: `translateX(${(1 - a) * 200}px)`, opacity: clamp(a * 2) }); });
  });
  // CONFIRM b13.5-16: both calendars on, tap
  shot(13.5, 16, `<div class="dglass" id="conf" style="position:absolute;left:110px;top:300px;width:860px;padding:44px 44px"><div class="k">Ready to add</div>
    <div style="font:400 84px/1 var(--serif);margin:14px 0 14px">Add 6 events?</div>
    <div class="tog">${GCAL(60)}Google Calendar<span class="sw"></span></div><div class="tog">${ACAL(60)}Apple Calendar<span class="sw"></span></div>
    <div class="apb" id="addB"><b id="addF"></b><span id="addT">Add to calendar</span></div></div>`, (b, s) => {
    const c = E.spring(P(b, 13.5, 13.95)); set($('#conf'), { opacity: clamp(c * 2), transform: `translateY(${(1 - c) * 100}px) scale(${1 + 0.04 * E.inCubic(P(b, 15.5, 16))})`, filter: b >= 15.5 ? `blur(${4 * E.inCubic(P(b, 15.5, 16))}px)` : 'none' });
    const ok = b >= TL.tap, f = E.outCubic(P(b, TL.tap, TL.tap + 0.12)); $('#addF').style.opacity = f; $('#addT').innerHTML = ok ? `Adding… ${CHECK(28)}` : 'Add to calendar';
    set($('#addB'), { transform: `scale(${ok && b < TL.tap + 0.2 ? 1 - 0.06 * Math.sin(P(b, TL.tap, TL.tap + 0.2) * Math.PI) : 1})`, boxShadow: ok ? `0 0 ${90 * pulseAt(b, TL.tap, 2)}px rgba(166,140,255,.95)` : 'none' });
  });

  // DROP b16-17: the logos
  shot(16, 17, `<div class="logo" id="lgG" style="left:200px;top:400px">${GCAL(260)}</div><div class="logo" id="lgA" style="left:620px;top:400px">${ACAL(260)}</div>
    <div class="lname" style="left:330px;top:700px">Google Calendar</div><div class="lname" style="left:750px;top:700px">Apple Calendar</div>
    <div class="serifI" id="syn" style="top:900px;font-size:150px">Synced.</div>`, (b, s) => {
    [['#lgG', -1], ['#lgA', 1]].forEach(([q, d], i) => { const a = E.outBack(P(b, 16 + i * 0.08, 16.4 + i * 0.08)); set($(q), { transform: `translateX(${(1 - clamp(a)) * d * 300}px) scale(${clamp(a, 0, 1.3)}) rotate(${(1 - clamp(a)) * d * 20}deg)` }); });
    $$('.lname', s.el).forEach(d => { d.style.opacity = E.outCubic(P(b, 16.2, 16.5)); });
    const k = E.outExpo(P(b, 16.25, 16.6)); set($('#syn'), { opacity: k, transform: `translate(-50%,-50%) scale(${1.2 - 0.2 * k})` });
  });
  // WEEK b17-24: every event lands, one per beat
  const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'], DATES = [9, 10, 11, 12, 13, 14, 15], HR = 91.4, COL = (960 - 70) / 7;
  shot(17, 24, `<div class="serifI" style="top:150px;font-size:96px"><div class="ln"><span>On your calendar.</span></div></div>
    <div class="week lglass"><div class="wh"><div></div>${DAYS.map((d, i) => `<div>${d}<b>${DATES[i]}</b></div>`).join('')}</div>
    <div class="grid">${Array.from({ length: 10 }, (_, i) => `<div class="hr" style="top:${i * HR}px">${((i + 8 - 1) % 12) + 1} ${i + 8 < 12 ? 'AM' : 'PM'}</div>`).join('')}
    ${TL.events.map(([, d, st, du, tt, k]) => { const di = DAYS.indexOf(d); return `<div class="blk" style="left:${70 + di * COL + 5}px;top:${(st - 8) * HR + 3}px;width:${COL - 10}px;height:${du * HR - 6}px;background:${k === 'g' ? 'linear-gradient(160deg,#5b8cff,#3d6fe6)' : 'linear-gradient(160deg,#ff6b6b,#e8434f)'}">${tt.split(' · ')[0]}<small>${tt.split(' · ')[1]}</small><span class="lg">${k === 'g' ? GCAL(30) : ACAL(30, 'Mon', '9')}</span></div>`; }).join('')}</div></div>
    <div class="toast" id="toast"></div>`, (b, s) => {
    reveal(s.el.querySelector('.ln span'), b, 17, 0.5);
    const c = E.outExpo(P(b, 17, 17.35)); set(s.el.querySelector('.week'), { transform: `translateY(${(1 - c) * 120}px)`, opacity: clamp(c * 2) });
    $$('.blk', s.el).forEach((d, i) => { const T = TL.events[i][0], a = E.outBack(P(b, T, T + 0.35)); vis(d, b >= T);
      set(d, { transform: `translateY(${(1 - clamp(a)) * -220}px) scale(${clamp(a, 0, 1.15)})`, boxShadow: `0 16px 30px -12px rgba(30,20,90,.45), 0 0 ${50 * pulseAt(b, T + 0.25, 4)}px rgba(166,140,255,.9)` }); });
    let cur = -1; TL.events.forEach(([T], i) => { if (b >= T) cur = i; });
    const toast = $('#toast'); vis(toast, cur >= 0);
    if (cur >= 0) {
      const e = TL.events[cur], T = e[0], k = e[5]; toast.innerHTML = `${k === 'g' ? GCAL(44) : ACAL(44)}Added to ${k === 'g' ? 'Google' : 'Apple'} Calendar <span class="ok">${CHECK(28)}</span>`;
      const a = E.spring(P(b, T + 0.1, T + 0.5)); set(toast, { top: '1170px', transform: `translateX(-50%) translateY(${(1 - a) * 60}px) scale(${0.9 + 0.1 * a})`, opacity: clamp(a * 2) });
    }
  });
  // REMINDERS b24-28: the lock screen
  const NTS = [['Calendar', 'a', 'Showing in 30 min', '48 Coral Palm Way · with Jordan Ellis'], ['Google Calendar', 'g', 'Inspection · Tue 10:30 AM', '1207 Sea Grape Ln · Gulf Home Co.'],
    ['Mila', 'm', 'Invite accepted', 'Jordan Ellis is going Sat 2:00 PM'], ['Calendar', 'a', 'Closing · Fri 4:00 PM', '2219 Banyan Isle Dr · title company']];
  shot(24, 28, `<div class="ph" style="background-image:${img('malibu_sunset')};filter:blur(30px) brightness(1.1) saturate(1.1);opacity:.5"></div>
    <div class="serifI" style="top:120px;font-size:92px"><div class="ln"><span>Reminders, handled.</span></div></div>
    <div class="phone"><div class="scr" style="background-image:${img('malibu_sunset')}"><div class="date">Saturday, March 14</div><div class="clock">1:30</div>
    ${NTS.map(([ap, k, tt, bb], i) => `<div class="nt" style="top:${330 + i * 150}px"><div style="flex:none">${k === 'g' ? GCAL(52) : k === 'a' ? ACAL(52, 'Saturday', '14') : '<div style="width:52px;height:52px;border-radius:14px;background:radial-gradient(circle at 35% 30%,#fff 0,#dbe6ff 12%,#a68cff 50%,#ffc9a8 100%)"></div>'}</div>
      <div><div class="ap">${ap}</div><div class="tt">${tt}</div><div class="bb">${bb}</div></div><span class="tm">now</span></div>`).join('')}</div></div>`, (b, s) => {
    reveal(s.el.querySelector('.ln span'), b, 24, 0.5);
    const c = E.outExpo(P(b, 24, 24.4)); set(s.el.querySelector('.phone'), { transform: `translateY(${(1 - c) * 300}px)` });
    $$('.nt', s.el).forEach((d, i) => { const a = E.spring(P(b, 24.25 + i * 0.5, 24.7 + i * 0.5)); set(d, { transform: `translateY(${(1 - a) * -80}px) scale(${0.9 + 0.1 * a})`, opacity: clamp(a * 2) }); });
  });
  // KICKER b28-32
  TL.kicker.forEach(([w, a, p], i) => shot(a, a + 1, `<div class="ph" style="background-image:${img(p)}"></div><div class="fill" style="background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,0) 30%,rgba(0,0,0,0) 55%,rgba(0,0,0,.55))"></div>
    <div class="mono lab">${['Client texts', 'Mila adds it', 'Google + Apple', 'Before every showing'][i]}</div><div class="kw" style="font-size:${w.length > 8 ? 190 : 210}px">${w}</div>`, (b, s) => {
    const k = E.outExpo(P(b, a, a + 0.22)), dir = i % 2 ? -1 : 1, ph = s.el.querySelector('.ph');
    ph.style.transform = `translateX(${(1 - k) * 420 * dir}px) scale(${1.16 - 0.07 * P(b, a, a + 1)})`; ph.style.filter = k < 0.97 ? `blur(${(1 - k) * 20}px)` : 'none';
    const w2 = E.outExpo(P(b, a + 0.05, a + 0.4)); set(s.el.querySelector('.kw'), { transform: `translateY(${(1 - w2) * 80}px)`, opacity: w2, clipPath: `inset(${(1 - w2) * 100}% 0 0 0)` });
  }, { cut: true }));
  // SAY IT b32-34
  shot(32, 34, `<div class="serifI" style="top:560px;font-size:140px">You just say it.</div><div class="serifI" style="top:730px;font-size:96px">Mila puts it on <span class="gtx" style="font-style:italic">the calendar.</span></div>`, (b, s) => {
    $$('.serifI', s.el).forEach((d, i) => { const k = E.outExpo(P(b, 32 + i, 32.35 + i)); set(d, { transform: `translate(-50%,-50%) translateY(${(1 - k) * 70}px)`, opacity: k, filter: k < 1 ? `blur(${(1 - k) * 8}px)` : 'none' }); });
  });
  // END CARD
  shot(34, 43.9, `<div id="wordmark">Mila</div><div id="tagline"><div class="ln"><span>Your AI operations manager for real estate.</span></div></div>
    <div id="cta"><div class="ln"><span>Comment <span class="q">“Mila”</span></span></div><div class="ln"><span>for a 7-day free trial.</span></div></div>
    <div id="works">Works with ${GCAL(44)} Google Calendar <span style="opacity:.4">·</span> ${ACAL(44, 'Monday', '9')} Apple Calendar</div>`, (b) => {
    const rise = E.outExpo(P(b, 34, 35.7));
    set($('#wordmark'), { top: (300 + 90 * (1 - rise)) + 'px', opacity: E.outCubic(P(b, 34, 34.5)), transform: `translateX(-50%) scale(${0.9 + 0.1 * rise})`, filter: `blur(${(1 - E.outCubic(P(b, 34, 35))) * 14}px)` });
    set($('#tagline'), { top: '600px', transform: 'translateX(-50%)' }); reveal($('#tagline .ln > span'), b, 34.7, 1.0);
    set($('#cta'), { top: '690px', transform: 'translateX(-50%)' }); $$('#cta .ln > span').forEach((s, j) => reveal(s, b, 35.3 + j * 0.45, 0.9));
    const w = E.outExpo(P(b, 36.5, 37.2)); set($('#works'), { top: '900px', transform: `translateX(-50%) translateY(${(1 - w) * 30}px)`, opacity: w });
  }, { end: true });

  /* ---------------------------------------------------------------- assets */
  await document.fonts.load('400 40px "Instrument Serif"'); await document.fonts.load('italic 40px "Instrument Serif"'); await document.fonts.load('300 40px "Inter"'); await document.fonts.load('600 16px "Inter"'); await document.fonts.load('700 16px "DejaVu Sans Mono"'); await document.fonts.ready;
  const PH = [...new Set([...document.body.innerHTML.matchAll(/assets\/(photos|logos)\/([a-z_-]+)\.(jpg|svg)/g)].map(m => m[0]))];
  await Promise.all(PH.map(n => new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = n; })));
  const R = { cam: $('#cam'), light: $('#light'), lbT: $('#lbT'), lbB: $('#lbB'), leak: $('#leak'), flash: $('#flash'), vig: $('#vig') };
  const grain = $('#grain'), gctx = grain.getContext('2d'), NOISE = [];
  { const r = rng(99); for (let k = 0; k < 8; k++) { const c = document.createElement('canvas'); c.width = 540; c.height = 675; const x = c.getContext('2d'), id = x.createImageData(540, 675); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 110; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); NOISE.push(c); } }
  const CUT_T = [...MS.map(m => m[0]).filter(x => x > 0), 7, 8, 11, 13.5, 16, 17, 24, ...TL.kicker.map(k => k[1]), 32, 33, 34];

  function render(t) {
    const raw = t / BEAT, b = raw, tail = raw >= TL.loopTail[0], tailIn = E.inOut(P(raw, 42.6, 43.85));
    const lightWorld = (b >= 16 && b < 28) || (b >= 32 && !tail);
    let cs = 1 + 0.004 * per(raw, 2), cx = per(raw, 3) * 2, cy = per(raw, 2) * 2;
    for (const T of CUT_T) if (b >= T && b < T + 0.6 && !tail) cs *= 1 + 0.035 * Math.exp(-(b - T) * 9);
    if (b >= 16 && b < 33 && !tail) { const ph = b % 1; cs *= 1 + 0.008 * Math.exp(-ph * 7); cy += 4 * Math.exp(-ph * 9); }
    if (b >= 15 && b < 16) cs *= 1 + 0.03 * E.inCubic(P(b, 15.5, 16));
    R.cam.style.transform = `translate(${cx}px,${cy}px) scale(${cs})`;
    vis(R.light, lightWorld || tail);
    set($('#lA'), { left: (240 + per(raw, 2) * 160) + 'px', top: (480 + perc(raw, 1) * 140) + 'px' }); set($('#lB'), { left: (860 + perc(raw, 2) * 140) + 'px', top: (760 + per(raw, 1) * 160) + 'px' }); set($('#lC'), { left: (540 + per(raw, 1) * 220) + 'px', top: '1180px' });
    set($('#gA'), { left: (260 + per(raw, 2) * 160) + 'px', top: (420 + perc(raw, 1) * 120) + 'px' }); set($('#gB'), { left: (840 + perc(raw, 2) * 140) + 'px', top: (820 + per(raw, 1) * 140) + 'px' }); set($('#gC'), { left: (540 + per(raw, 1) * 200) + 'px', top: '1250px' });
    R.light.style.opacity = tail ? 1 - tailIn : 1;
    for (const s of SH) {
      let on;
      if (s.hook) on = b < s.b || raw >= 42.6; else if (s.end) on = b >= s.a && raw < 43.95; else on = b >= s.a && b < s.b && !tail;
      vis(s.el, on); if (!on) continue;
      if (s.hook) { s.upd(tail ? 0 : b, s); s.el.style.opacity = tail ? tailIn : 1; s.el.style.zIndex = tail ? 3 : ''; }
      else if (s.end) { s.upd(b, s); s.el.style.opacity = tail ? 1 - tailIn : 1; }
      else s.upd(b, s);
    }
    const lb = tail ? tailIn : 1 - E.outExpo(P(b, 15.95, 16.25));
    R.lbT.style.transform = `translateY(${-(1 - lb) * 150}px)`; R.lbB.style.transform = `translateY(${(1 - lb) * 150}px)`; vis(R.lbT, lb > 0.001); vis(R.lbB, lb > 0.001);
    const leakT = [16, 24, 28, 33, 34].find(T => b >= T && b < T + 0.8);
    vis(R.leak, leakT !== undefined && !tail);
    if (leakT !== undefined) { const p = P(b, leakT, leakT + 0.8); set(R.leak, { transform: `translateX(${lerp(-1100, 1100, E.inOut(p))}px)`, opacity: Math.sin(p * Math.PI) }); }
    const fl = tail ? 0 : Math.max(b >= 15.9 && b < 16 ? P(b, 15.9, 16) : 0, 0.95 * pulseAt(b, 16, 5), 0.25 * pulseAt(b, 7, 8), ...TL.kicker.map(k => 0.3 * pulseAt(b, k[1], 10)), 0.45 * pulseAt(b, 33, 6), 0.3 * pulseAt(b, 34, 6), ...TL.events.map(e => 0.12 * pulseAt(b, e[0], 12)));
    R.flash.style.opacity = fl; vis(R.flash, fl > 0.002);
    R.vig.style.opacity = lightWorld ? 0.3 : 1;
    const fi = Math.floor(t * 60), nz = NOISE[fi % 8], gx = (fi * 137) % 540, gy = (fi * 251) % 675;
    gctx.drawImage(nz, -gx, -gy); gctx.drawImage(nz, 540 - gx, -gy); gctx.drawImage(nz, -gx, 675 - gy); gctx.drawImage(nz, 540 - gx, 675 - gy);
    grain.style.opacity = lightWorld ? 0.12 : 0.22;
  }
  window.renderFrame = render; window.DURATION = DUR;
  for (const tw of [0, 3, 6, 7.5, 9.5, 12, 14.5, 15.7, 16.4, 18, 21, 23.5, 25, 27, 28.5, 32.5, 33.5, 37, 43, 43.95]) render(tw * BEAT);
  render(0); window.__ready = true;
  if (!RENDER) {
    const aud = $('#aud'), pp = $('#pp'), scrub = $('#scrub'), tc = $('#tc'); scrub.max = DUR; let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (aud.currentTime >= DUR - 0.05) aud.currentTime = 0; aud.play(); } else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; render(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; render(t); scrub.value = t; } requestAnimationFrame(loop); }; loop();
  }
})();
