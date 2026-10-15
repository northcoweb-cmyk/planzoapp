/* Mila "weekend" TikTok (1080x1920). render(t) is a pure function of time; b = beats of "Real Love" at 128 BPM.
 * b0 kitchen "your weekend:" (hook, up from frame 0) · b2 dining "2 open houses." · b4 listing laptop "3 showings."
 *   (the weekend piles up as chips) · b6 living room "monday:" b7 "all the follow-ups." · b7.5-11.5 the follow-ups avalanche in,
 *   faster and faster, over the song's kickless riser · b11.5 hang · DROP b12: white aura, every follow-up flies into Mila —
 *   "Mila sends them." · b14 "so monday's for clients." · b16-18 punch-ins on the laptops, which now show Mila ·
 *   b18 end frame + CTA · loop tail b22.5-24 back to frame 0.
 */
(async function () {
  const TL = await (await fetch('timeline.json')).json();
  const BEAT = TL.beat, DUR = TL.duration, TOT = TL.totalBeats;
  const RENDER = new URLSearchParams(location.search).has('render');
  if (RENDER) document.body.classList.add('render');
  const W = 1080, H = 1920, vp = document.getElementById('viewport');
  if (!RENDER) { const fit = () => { const k = Math.min(innerWidth / W, (innerHeight - 60) / H); vp.style.transformOrigin = '0 0'; vp.style.transform = `translate(${(innerWidth - W * k) / 2}px,0) scale(${k})`; }; fit(); addEventListener('resize', fit); }

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, p) => a + (b - a) * p, P = (x, x0, x1) => clamp((x - x0) / (x1 - x0));
  const E = { outExpo: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)), inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2), outCubic: p => 1 - Math.pow(1 - p, 3),
    inCubic: p => p * p * p, outBack: p => { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    spring: p => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-6.2 * p) * Math.cos(9.5 * p)) };
  const TAU = Math.PI * 2, per = (b, k) => Math.sin(TAU * k * b / TOT);
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const set = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const vis = (el, on) => { el.style.visibility = on ? 'inherit' : 'hidden'; };
  const pulseAt = (b, T, k = 8) => (b >= T ? Math.exp(-(b - T) * k) : 0);

  /* ---------------------------------------------------------------- photos (graded, 1904 x 2538) */
  const IW = 1904, IH = 2538, FILL = Math.max(W / IW, H / IH) * 1.04;
  const SCREEN_C = { 'kitchen-setup': [582, 1380], 'dining-setup': [894, 1466], 'listing-laptop': [1007, 1680] };   // laptop screen centers (graded px)
  const photo = n => `<img class="photo" src="assets/photos/${n}.jpg" width="${IW}" height="${IH}"><div class="shade"></div>`;
  function place(img, cx, cy, s, dx = 0) { set(img, { transform: `translate(${540 - cx * s + dx}px,${960 - cy * s}px) scale(${s})` }); }

  const SH = [];
  const shot = (a, b, html, upd, o = {}) => { const el = document.createElement('div'); el.className = 'full'; el.innerHTML = html; $('#shots').appendChild(el); const s = { a, b, el, upd, ...o }; SH.push(s); return s; };
  // THE WEEKEND (b0-12, also the loop frame): a glowing calendar that fills up on the beat
  const EVTS = [[2.5, 'SAT', 13, 3, 'Open house', '1–4 PM', 'oh'], [3.0, 'SUN', 12, 3, 'Open house', '12–3 PM', 'oh'],
    [4.5, 'SAT', 10, 1, 'Showing', '10:00 AM', 'sh'], [5.0, 'SAT', 16.5, 1, 'Showing', '4:30 PM', 'sh'], [5.5, 'SUN', 10.5, 1, 'Showing', '10:30 AM', 'sh']];
  const ROW = 64, H0 = 9;
  const CAL = shot(-9, 12, `<div class="night"></div><div class="glow g1"></div><div class="glow g2"></div>
    <div class="cal" id="cal"><div class="calh" id="calh"><div class="ch" id="chA">SAT <b>14</b></div><div class="ch" id="chB">SUN <b>15</b></div></div>
      <div class="calg">${Array.from({ length: 10 }, (_, i) => `<div class="hr" style="top:${i * ROW}px"><span>${((i + H0 - 1) % 12) + 1} ${i + H0 < 12 ? 'AM' : 'PM'}</span></div>`).join('')}
      ${EVTS.map(([, d, st, du, t, tm, k]) => `<div class="ev ${k}" style="left:${d === 'SAT' ? 110 : 495}px;top:${(st - H0) * ROW + 3}px;height:${du * ROW - 6}px"><b>${t}</b><span>${tm}</span></div>`).join('')}
      <div class="mon" id="mon">MON <b>16</b></div></div></div>
    <div class="mono" id="calc" style="position:absolute;left:0;right:0;top:1600px;text-align:center;color:rgba(255,255,255,.7)"></div>`, (bb, s) => {
    const cal = $('#cal'), c = E.outExpo(P(bb, 0, 0.01));
    const toMon = E.inOut(P(bb, 6, 6.4)), dim = P(bb, 7.5, 9);
    set(cal, { transform: `translateY(${-10 * Math.sin(bb * 0.5)}px) scale(${1 + 0.015 * pulseAt(bb % 1, 0, 6) * (bb >= 2 ? 1 : 0)})`, opacity: 1 - 0.55 * dim, filter: dim > 0 ? `blur(${3 * dim}px)` : 'none' });
    $$('.ev', s.el).forEach((d, i) => { const T = EVTS[i][0], a = E.outBack(P(bb, T, T + 0.3)); vis(d, bb >= T && toMon < 0.5);
      set(d, { transform: `scale(${clamp(a, 0, 1.25)})`, boxShadow: `0 0 ${60 * pulseAt(bb, T + 0.05, 4)}px rgba(166,140,255,.95), 0 16px 30px -12px rgba(0,0,0,.6)` }); });
    // the weekend flips to monday
    set($('#calh'), { opacity: 1 - toMon }); set($('#mon'), { opacity: toMon, transform: `translateY(${(1 - toMon) * 30}px)` });
    const n = EVTS.filter(e => bb >= e[0]).length; $('#calc').innerHTML = bb < 6 && n ? `THIS WEEKEND: <b style="color:#ffc9a8">${n}</b> / 5 BOOKED` : '';
  }, { hook: true });
  // the open-house photos: ~0.3 s flash cards between the hits
  const FL_AR = { 'kitchen-setup': 1080 / 1904, 'dining-setup': 1060 / 1784, 'listing-laptop': 1200 / 1904, 'living-room': 1960 / 1904 };
  TL.flash.forEach(([a, n]) => shot(a, a + 0.64, `<div class="flashcard" style="height:${Math.round(940 * FL_AR[n])}px;top:${960 - Math.round(470 * FL_AR[n])}px;background-image:url(assets/photos/flash_${n}.jpg)"></div>`, (bb, s) => {
    const k = E.outExpo(P(bb, a, a + 0.2)), o = 1 - E.inCubic(P(bb, a + 0.5, a + 0.64));
    set(s.el.querySelector('.flashcard'), { transform: `scale(${1.18 - 0.18 * k}) rotate(${(1 - k) * -3}deg)`, opacity: o });
  }, { flash: true }));
  // the aura (drop + end frame) — a canvas glow, breathing on the beat
  const AU = shot(12, 99, `<div class="aura"><canvas width="540" height="960" style="width:1080px;height:1920px"></canvas></div>`, () => {}, { aura: true });
  const auCv = AU.el.querySelector('canvas'), ax = auCv.getContext('2d');
  const STOPS = [[0, '#7A90F0'], [0.2, '#8C9BF2'], [0.42, '#B6A4F3'], [0.64, '#D9D2F7'], [0.84, '#EEF3FC'], [1, '#FFFFFF']];
  function drawAura(scale) {
    ax.setTransform(1, 0, 0, 1, 0, 0); ax.fillStyle = '#fff'; ax.fillRect(0, 0, 540, 960);
    const rx = 0.62 * 540 * scale, ry = 0.40 * 960 * scale; ax.setTransform(rx / ry, 0, 0, 1, 270, 960 * 0.44);
    const g = ax.createRadialGradient(0, 0, 0, 0, 0, ry); for (const [p, c] of STOPS) g.addColorStop(p, c);
    ax.fillStyle = g; ax.fillRect(-ry * 2, -ry * 2, ry * 4, ry * 4);
  }
  // AFTER THE DROP: a fast "all sent" run over the aura, one photo per half beat
  TL.run.forEach(([a, n, lab], i) => shot(a, i < TL.run.length - 1 ? a + 0.5 : 18, `<div class="flashcard" style="height:${Math.round(940 * FL_AR[n])}px;top:${900 - Math.round(470 * FL_AR[n])}px;background-image:url(assets/photos/flash_${n}.jpg)"></div>
    <div class="tag" style="top:${900 + Math.round(470 * FL_AR[n]) + 40}px"><b></b>${lab} · sent ✓</div>`, (bb, s) => {
    const k = E.outExpo(P(bb, a, a + 0.18)); set(s.el.querySelector('.flashcard'), { transform: `translateY(${(1 - k) * 120}px) scale(${0.92 + 0.08 * k}) rotate(${(i % 2 ? 1 : -1) * 2 * (1 - k)}deg)`, opacity: clamp(k * 2) });
    const t = E.spring(P(bb, a + 0.08, a + 0.4)); set(s.el.querySelector('.tag'), { transform: `translateX(-50%) translateY(${(1 - t) * 40}px)`, opacity: clamp(t * 2) });
  }));

  /* ---------------------------------------------------------------- headlines */
  const HEADS = [[0, 2, ['your weekend:'], false], [2, 4, ['2 open houses.'], false], [4, 6, ['3 showings.'], false], [6, 7, ['monday:'], false], [7, 7.5, ['monday:', 'all the follow-ups.'], false],
    [12.5, 14, ['Mila sends them.'], true], [14, 16, ['Mila sends them.', '<span class="sub">so monday’s for clients.</span>'], true],
    [18, 99, ['Mila sends them.', '<span class="sub">so monday’s for clients.</span>'], true]];
  const head = $('#head'); let headKey = '';

  /* ---------------------------------------------------------------- weekend chips + the follow-up pile */
  $('#chips').innerHTML = TL.chips.map(([, d, k]) => `<div class="chip"><i class="${k === 'Showing' ? 'sh' : ''}"></i><span class="mono">${d}</span>${k}</div>`).join('');
  const CHIPS = $$('#chips .chip');
  const R = rng(7);
  $('#pile').innerHTML = TL.fu.map(([, txt]) => `<div class="fu"><div class="ic">!</div><div><div class="s">FOLLOW-UP DUE MONDAY</div><div class="t">${txt}</div></div></div>`).join('');
  const FU = $$('#pile .fu').map((el, i) => ({ el, t: TL.fu[i][0], x: 470 + R() * 140, y: 560 + R() * 880, r: (R() - 0.5) * 16, d: R() }));

  /* ---------------------------------------------------------------- assets */
  await document.fonts.load('400 40px "Instrument Serif"'); await document.fonts.load('600 16px "Inter"'); await document.fonts.load('700 16px "DejaVu Sans Mono"'); await document.fonts.ready;
  await Promise.all($$('img').map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
  const grain = $('#grain'), gx = grain.getContext('2d'), NOISE = [];
  { const r = rng(99); for (let k = 0; k < 8; k++) { const c = document.createElement('canvas'); c.width = 540; c.height = 960; const x = c.getContext('2d'), id = x.createImageData(540, 960); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 100; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); NOISE.push(c); } }
  const CUTS = [2, 4, 6, 12, ...TL.flash.map(f => f[0]), ...TL.run.map(r => r[0]), 18];

  function render(t) {
    const raw = t / BEAT, tail = raw >= TL.loopTail[0], tailIn = E.inOut(P(raw, TL.loopTail[0], 23.9)), b = raw, bw = tail ? 0 : b;
    let cs = 1, cx = 0, cy = 0;
    if (!tail) {
      for (const T of CUTS) if (b >= T && b < T + 0.5) cs *= 1 + 0.035 * Math.exp(-(b - T) * 10);
      if (b >= 12 && b < 18) cs *= 1 + 0.01 * Math.exp(-(b % 1) * 7);
      if (b >= 9.5 && b < 11.5) { const e = P(b, 9.5, 11.5) * 6; cx = Math.sin(b * 53) * e; cy = Math.cos(b * 41) * e; }    // tension shake under the riser
    }
    $('#cam').style.transform = `translate(${cx}px,${cy}px) scale(${cs})`;

    for (const s of SH) {
      let on;
      if (s.hook) on = b < s.b || tail; else if (s.flash) on = b >= s.a && b < s.b && !tail; else if (s.aura) on = b >= s.a && !(tail && tailIn >= 1); else on = b >= s.a && b < s.b && !tail;
      vis(s.el, on); if (!on) continue;
      s.upd(s.hook ? bw : b, s);
      if (s.hook) { s.el.style.opacity = tail ? tailIn : 1; s.el.style.zIndex = tail ? 3 : ''; }
      if (s.aura) { s.el.style.opacity = tail ? 1 - tailIn : 1; drawAura(1 + 0.04 * Math.sin(TAU * (b - 12) / 4) + 0.03 * pulseAt(b % 1, 0, 6) * (b < 18 ? 1 : 0.4)); }
    }
    const onAura = (b >= 12 && b < 16) || (b >= 18 && !tail) || (tail && tailIn < 0.5);

    // headline
    let hd = null; for (const h of HEADS) if (bw >= h[0] && bw < h[1]) hd = h;
    if (tail && tailIn < 0.5) hd = HEADS[HEADS.length - 1];
    if (tail && tailIn >= 0.5) hd = HEADS[0];
    vis(head, !!hd);
    if (hd) {
      const key = hd[2].join('|'); if (key !== headKey) { head.innerHTML = hd[2].map((l, i) => `<div class="hl${hd[3] ? ' dark' : ''}" style="${l.includes('class="sub"') ? 'margin-top:26px;font-size:66px' : ''}">${l}</div>`).join(''); headKey = key; }
      const lines = $$('.hl', head);
      lines.forEach((ln, i) => {
        const a0 = hd[0] === 0 ? -1 : (i === lines.length - 1 && hd[2].length > 1 && !(hd[0] === 18) ? hd[0] : (hd[0] === 7 || hd[0] === 14 || hd[0] === 18) ? -1 : hd[0]);
        const p = a0 < 0 ? 1 : E.outExpo(P(bw, a0, a0 + 0.3));
        set(ln, { opacity: p, transform: `scale(${1.12 - 0.12 * p})`, filter: p < 1 ? `blur(${(1 - p) * 10}px)` : 'none' });
      });
      head.style.top = (hd[3] ? 960 * 0.88 : 430) + 'px';
      if (tail) head.style.opacity = tailIn < 0.5 ? 1 - tailIn * 2 : (tailIn - 0.5) * 2; else head.style.opacity = bw >= 11.5 && bw < 12 ? 1 - P(bw, 11.5, 11.75) : 1;
      if (bw >= 7.5 && bw < 12 && !hd[3]) head.style.opacity = 0;
    }

    // weekend chips: stack up b2.5-6, swept away at the monday cut
    vis($('#chips'), false);
    CHIPS.forEach((c, i) => {
      const T = TL.chips[i][0], a = E.spring(P(b, T, T + 0.45)); let slot = 0; TL.chips.forEach(([T2], j) => { if (j > i) slot += E.outCubic(P(b, T2, T2 + 0.25)); });
      const out = E.inCubic(P(b, 6, 6.35));
      set(c, { top: (1500 - slot * 100) + 'px', transform: `translateX(-50%) translateY(${(1 - a) * 80 + out * 900}px) scale(${0.85 + 0.15 * a})`, opacity: b >= T ? clamp(a * 2) : 0 });
    });

    // the follow-up pile: drops in on the riser, then gets sent into Mila on the drop
    const pileOn = !tail && b >= 7.5 && b < 13.2; vis($('#pile'), pileOn);
    let n = 0;
    if (pileOn) FU.forEach((f, i) => {
      if (b < f.t) { vis(f.el, false); return; } vis(f.el, true); n++;
      const a = E.spring(P(b, f.t, f.t + 0.35)), sent = E.inOut(P(b, 12 + f.d * 0.15, 12.3 + f.d * 0.15));
      const x = lerp(f.x, 540, sent), y = lerp(f.y, 840, sent);
      set(f.el, { transform: `translate(${x - 410}px,${y - 66 - (1 - a) * 260}px) rotate(${f.r * (1 - sent)}deg) scale(${(1.1 - 0.1 * a) * (1 - 0.92 * sent)})`, opacity: clamp(a * 3) * (1 - P(sent, 0.85, 1)), zIndex: i });
      f.el.classList.toggle('sent', b >= 12);
      if (b >= 12) { f.el.querySelector('.s').textContent = 'SENT BY MILA ✓'; f.el.querySelector('.ic').textContent = '✓'; } else { f.el.querySelector('.s').textContent = 'FOLLOW-UP DUE MONDAY'; f.el.querySelector('.ic').textContent = '!'; }
    });
    const cOn = !tail && b >= 7.5 && b < 14; vis($('#count'), cOn);
    if (cOn) {
      const due = Math.round(lerp(0, 47, E.inCubic(P(b, 7.5, 11.6)))), sentN = Math.round(47 * E.outCubic(P(b, 12, 12.9)));
      $('#count').innerHTML = b < 12 ? `Follow-ups due monday: <b>${due}</b>` : `<span style="color:#1a1a2e;text-shadow:none">Sent: <b style="color:#5b48d6">${sentN}</b> / 47 ✓</span>`;
      $('#count').style.top = (b < 12 ? 1640 : 1250) + 'px';
    }
    // wordmark: lavender on photos, deeper lavender on the aura
    $('#wm').style.color = onAura ? '#A99BEA' : '#EBE6FF';
    // CTA on the end frame
    const fl = tail ? 0 : Math.max(b >= 11.85 && b < 12 ? 0.8 * P(b, 11.85, 12) : 0, 0.9 * pulseAt(b, 12, 6), ...[2, 4, 6].map(T => 0.25 * pulseAt(b, T, 12)), ...TL.screens.map(s => 0.2 * pulseAt(b, s[0], 12)), 0.4 * pulseAt(b, 18, 6));
    $('#flash').style.opacity = fl; vis($('#flash'), fl > 0.002);
    $('#vig').style.opacity = onAura ? 0 : 1;
    const fi = Math.floor(t * 60), nz = NOISE[fi % 8], ox = (fi * 137) % 540, oy = (fi * 251) % 960;
    gx.drawImage(nz, -ox, -oy); gx.drawImage(nz, 540 - ox, -oy); gx.drawImage(nz, -ox, 960 - oy); gx.drawImage(nz, 540 - ox, 960 - oy);
    grain.style.opacity = onAura ? 0.08 : 0.2;
  }
  // CTA lives in the aura shot
  AU.el.insertAdjacentHTML('beforeend', `<div class="cta" id="cta" style="position:absolute;left:540px;top:1560px;transform:translateX(-50%)">comment MILA for your 7-day free trial</div>`);
  const _r = render; window.renderFrame = t => { _r(t); const b = t / BEAT, tl = b >= TL.loopTail[0], c = $('#cta'); const p = tl ? 1 : E.outExpo(P(b, 18.4, 18.9)); vis(c, b >= 18.4); set(c, { opacity: p, transform: `translateX(-50%) translateY(${(1 - p) * 30}px)` }); };
  window.DURATION = DUR;
  for (const tw of [0, 3, 5, 8, 11, 12.3, 14.5, 16.2, 17.5, 19, 23, 23.95]) window.renderFrame(tw * BEAT);
  window.renderFrame(0); window.__ready = true;
  if (!RENDER) {
    const aud = $('#aud'), pp = $('#pp'), scrub = $('#scrub'), tc = $('#tc'); scrub.max = DUR; let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (aud.currentTime >= DUR - 0.05) aud.currentTime = 0; aud.play(); } else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; window.renderFrame(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; window.renderFrame(t); scrub.value = t; } requestAnimationFrame(loop); }; loop();
  }
})();
