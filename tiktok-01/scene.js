/* TikTok #1 — "Stop sending this text." 18 s, 1080x1920. Original motion graphics, sentence case, no photos, no branding, no selling.
 * render(t) is a pure function of time (seconds). Content sits in the TikTok-safe column (x 80-860, y 230-1500).
 * 0-2.2 hook: the generic "Thanks for stopping by!" text, struck out · 2.2-5 every agent sends it, the wall blurs ·
 * 5-10 add one column to the sign-in sheet: Notes, three handwritten notes about the house · 10-14 then text this: "Still thinking about that backyard?" ·
 * 14-18 now it sounds like you. So this Sunday, before you hit send… -> crossfades into the hook frame (loop).
 */
(async function () {
  const TL = await (await fetch('timeline.json')).json();
  const DUR = TL.duration, RENDER = new URLSearchParams(location.search).has('render');
  if (RENDER) document.body.classList.add('render');
  const W = 1080, H = 1920, vp = document.getElementById('viewport');
  if (!RENDER) { const fit = () => { const k = Math.min(innerWidth / W, (innerHeight - 60) / H); vp.style.transformOrigin = '0 0'; vp.style.transform = `translate(${(innerWidth - W * k) / 2}px,0) scale(${k})`; }; fit(); addEventListener('resize', fit); }
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), P = (x, x0, x1) => clamp((x - x0) / (x1 - x0));
  const E = { outExpo: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)), inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2), outCubic: p => 1 - Math.pow(1 - p, 3), inCubic: p => p * p * p,
    spring: p => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-6.2 * p) * Math.cos(9.5 * p)), outBack: p => { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); } };
  const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const set = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const vis = (el, on) => { el.style.visibility = on ? 'inherit' : 'hidden'; };
  const TAU = Math.PI * 2, per = (t, k) => Math.sin(TAU * k * t / DUR), perc = (t, k) => Math.cos(TAU * k * t / DUR);
  const SH = [];
  const shot = (a, b, html, upd, o = {}) => { const el = document.createElement('div'); el.className = 'full'; el.innerHTML = html; $('#shots').appendChild(el); SH.push({ a, b, el, upd, ...o }); };
  const rise = (el, t, T, dy = 40, d = 0.45) => { const k = E.outExpo(P(t, T, T + d)); set(el, { opacity: k, transform: `translate(-50%,-50%) translateY(${(1 - k) * dy}px)`, filter: k < 0.97 ? `blur(${(1 - k) * 10}px)` : 'none' }); };
  const pop = (el, t, T, dy = 50) => { const a = E.spring(P(t, T, T + 0.45)); set(el, { transform: `translateY(${(1 - a) * dy}px) scale(${0.9 + 0.1 * a})`, opacity: clamp(a * 2.5) }); };
  const OLD = 'Thanks for stopping by! Let me know if you have any questions.';
  const NEW = 'Still thinking about that backyard?';
  const SEND = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 18.5V5.5M6 11.5 12 5.5l6 6"/></svg>`;
  const phone = (inner, top = 560) => `<div class="phn" style="top:${top}px"><div class="scr"><div class="isl"></div><div class="thd">Today 4:12 PM</div>${inner}</div></div>`;

  // 0-2.2 HOOK (and the loop's landing frame)
  shot(-1, 2.2, `<div class="ttl" id="h1" style="top:300px">Stop sending</div><div class="ttl" id="h2" style="top:415px"><i>this text.</i></div>
    ${phone(`<div class="bb gray" id="ob" style="top:150px">${OLD}</div><div class="strike" id="st" style="left:130px;top:224px;width:330px"></div>
      <div class="cmp"><span class="ph0">Text message</span><b class="sd">${SEND}</b></div>`)}`, (t, s) => {
    ['#h1', '#h2'].forEach(id => set($(id), { opacity: 1, transform: 'translate(-50%,-50%)' }));
    const k = E.outCubic(P(t, 0.55, 0.95)); set($('#st'), { transform: `rotate(-6deg) scaleX(${k})`, opacity: k > 0 ? 1 : 0 });
    $('#ob').style.opacity = 1 - 0.35 * k;
    s.el.querySelector('.phn').style.transform = `translateY(${-6 * Math.sin(t * 2)}px)`;
  }, { hook: true });
  // 2.2-5 every agent sends it
  const WALL = Array.from({ length: 9 }, (_, i) => [i % 2 ? 470 : 80, 560 + i * 98 + (i % 2) * 30]);
  shot(2.2, 5, `<div class="ttl" id="e1" style="top:330px">Every agent sends it.</div>
    ${WALL.map(([x, y]) => `<div class="wb" style="left:${x}px;top:${y}px">${OLD}</div>`).join('')}
    <div class="sub" id="e2" style="top:1480px">They all blur together.</div>`, (t, s) => {
    rise($('#e1'), t, 2.2);
    $$('.wb', s.el).forEach((d, i) => { const T = 2.35 + i * 0.14; vis(d, t >= T); pop(d, t, T, 70); const bl = P(t, 3.5, 4.6) * (4 + (i % 3) * 3);
      if (t >= T + 0.45) set(d, { filter: `blur(${bl}px)`, opacity: 1 - 0.45 * P(t, 3.5, 4.6) }); });
    rise($('#e2'), t, 3.6);
  });
  // 5-10 the sign-in sheet gets a Notes column
  const NOTES = ['loved the backyard', 'asked about the light', 'liked the garage'];
  shot(5, 10, `<div class="ttl" id="n1" style="top:300px">Add one column:</div><div class="ttl" id="n2" style="top:415px"><i>Notes.</i></div>
    <div class="sheet" style="top:540px"><h3>Open house sign-in</h3><div class="sh">Sunday · 1–4 PM</div>
      <div class="tbl"><div class="hd">Name</div><div class="hd">Phone</div><div class="hd nt">Notes</div>
      ${Array.from({ length: 5 }, (_, i) => `<div></div><div></div><div class="nt">${NOTES[i] ? `<span class="hw">${NOTES[i]}</span>` : ''}</div>`).join('')}</div>
      <div class="hl" id="hl"></div></div>
    <div class="sub" id="n3" style="top:1400px">One thing they liked <i style="font-family:var(--serif);font-weight:400;font-size:48px;color:#5b4bc4">about the house.</i></div>`, (t, s) => {
    rise($('#n1'), t, 5.0); rise($('#n2'), t, 5.15);
    const sh = s.el.querySelector('.sheet'), k = E.outExpo(P(t, 5.0, 5.5)); set(sh, { transform: `translateY(${(1 - k) * 160}px) rotate(${(1 - k) * 3 - 0.6}deg)`, opacity: k });
    set($('#hl'), { left: '414px', width: '332px', top: '160px', height: '536px', transform: `scaleY(${E.outCubic(P(t, 5.6, 6.1))})` });
    $$('.hw', s.el).forEach((w, i) => { const T = 7.2 + i * 0.55; w.style.maxWidth = (420 * E.inOut(P(t, T, T + 0.5))) + 'px'; });
    rise($('#n3'), t, 7.0);
  });
  // 10-14 then text this
  shot(10, 14, `<div class="ttl" id="x1" style="top:330px">Then text <i>this.</i></div>
    ${phone(`<div class="bb gray" id="ob2" style="top:150px">${OLD}</div><div class="strike" style="left:130px;top:224px;width:330px;transform:rotate(-6deg)"></div>
      <div class="bb me" id="nb" style="top:380px">${NEW}</div>
      <div class="cmp"><span id="ty"></span><span class="ph0" id="ph0">Text message</span><span class="cr" id="cr"></span><b class="sd">${SEND}</b></div>`)}`, (t, s) => {
    rise($('#x1'), t, 10.0);
    const ph = s.el.querySelector('.phn'), k = E.outExpo(P(t, 10, 10.45)); set(ph, { transform: `translateY(${(1 - k) * 200}px)`, opacity: k });
    $('#ob2').style.opacity = 0.55; s.el.querySelector('.strike').style.opacity = 0.8;
    const n = Math.floor(NEW.length * P(t, 10.5, 11.95)), sent = t >= 12.2;
    $('#ty').textContent = sent ? '' : NEW.slice(0, n); vis($('#ph0'), n === 0 || sent); vis($('#cr'), !sent && Math.floor(t * 3) % 2 === 0);
    vis($('#nb'), sent); if (sent) pop($('#nb'), t, 12.2, 90);
    $('#nb').style.boxShadow = sent ? `0 0 ${60 * Math.exp(-(t - 12.2) * 3)}px rgba(166,140,255,.9)` : 'none';
  });
  // 14-18 now it sounds like you -> loop
  shot(14, 18, `<div class="ttl" id="y1" style="top:700px;font-size:150px">Now it sounds</div><div class="ttl" id="y2" style="top:850px;font-size:150px"><i>like you.</i></div>
    <div class="sub" id="y3" style="top:1080px">So this Sunday, before you hit send…</div>`, (t) => {
    rise($('#y1'), t, 14.0, 60); rise($('#y2'), t, 14.2, 60); rise($('#y3'), t, 16.0);
  });

  await document.fonts.load('400 40px "Instrument Serif"'); await document.fonts.load('italic 40px "Instrument Serif"'); await document.fonts.load('600 16px "Inter"'); await document.fonts.ready;
  const grain = $('#grain'), gctx = grain.getContext('2d'), NOISE = [];
  { let sd = 7; const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    for (let k = 0; k < 6; k++) { const c = document.createElement('canvas'); c.width = 540; c.height = 960; const x = c.getContext('2d'), id = x.createImageData(540, 960); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 110; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); NOISE.push(c); } }
  const CUTS = [2.2, 5, 10, 14];
  function render(t) {
    const tailIn = E.inOut(P(t, 17.35, 17.95));
    let cs = 1 + 0.006 * per(t, 1), cx = per(t, 2) * 3, cy = perc(t, 1) * 3;
    for (const T of CUTS) if (t >= T && t < T + 0.7) cs *= 1 + 0.03 * Math.exp(-(t - T) * 8);
    $('#cam').style.transform = `translate(${cx}px,${cy}px) scale(${cs})`;
    set($('#gA'), { left: (260 + per(t, 1) * 180) + 'px', top: (520 + perc(t, 1) * 160) + 'px' });
    set($('#gB'), { left: (860 + perc(t, 1) * 160) + 'px', top: (1000 + per(t, 1) * 200) + 'px' });
    set($('#gC'), { left: (540 + per(t, 2) * 200) + 'px', top: (1600 + perc(t, 1) * 120) + 'px' });
    for (const s of SH) {
      let on = s.hook ? (t < s.b || t >= 17.35) : (t >= s.a && t < s.b);
      vis(s.el, on); if (!on) continue;
      if (s.hook) { s.upd(t >= 17.35 ? 0 : t, s); s.el.style.opacity = t >= 17.35 ? tailIn : 1; }
      else { s.upd(t, s); s.el.style.opacity = t >= 17.35 ? 1 - tailIn : 1; }
    }
    const fi = Math.floor(t * 60), nz = NOISE[fi % 6], gx = (fi * 137) % 540, gy = (fi * 251) % 960;
    gctx.drawImage(nz, -gx, -gy); gctx.drawImage(nz, 540 - gx, -gy); gctx.drawImage(nz, -gx, 960 - gy); gctx.drawImage(nz, 540 - gx, 960 - gy);
  }
  window.renderFrame = render; window.DURATION = DUR;
  for (let tw = 0; tw < DUR; tw += 0.5) render(tw);
  render(0); window.__ready = true;
  if (!RENDER) {
    const aud = $('#aud'), pp = $('#pp'), scrub = $('#scrub'), tc = $('#tc'); scrub.max = DUR; let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) aud.play(); else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; render(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; render(t); scrub.value = t; } requestAnimationFrame(loop); }; loop();
  }
})();
