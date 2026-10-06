/* Mila film #2 — "A NYC agent's day, handled."
 * render(t) is a pure function of time (seconds). Cue times are in song beats (b).
 * Spine: the sun/moon arc + clock, and the app's day -> night theme, which flips on the drop (b32).
 */
(async function () {
  const TL = await (await fetch('timeline.json')).json();
  const BEAT = TL.beat, DUR = TL.duration, DROP = TL.drop;
  const HOLD = 61.5;
  const RENDER = new URLSearchParams(location.search).has('render');
  if (RENDER) document.body.classList.add('render');
  const vp = document.getElementById('viewport');
  if (!RENDER) { const fit = () => { const k = Math.min(innerWidth / 1080, (innerHeight - 60) / 1080); vp.style.transformOrigin = '0 0'; vp.style.transform = `translate(${(innerWidth - 1080 * k) / 2}px,0) scale(${k})`; }; fit(); addEventListener('resize', fit); }

  /* ---------------------------------------------------------------- math */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const P = (b, b0, b1) => clamp((b - b0) / (b1 - b0));
  const E = {
    linear: p => p, step: p => (p >= 1 ? 1 : 0),
    outExpo: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)), inExpo: p => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10)),
    inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    outCubic: p => 1 - Math.pow(1 - p, 3), inCubic: p => p * p * p,
    outBack: p => { const c = 1.5; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    spring: p => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-6.2 * p) * Math.cos(9.5 * p)),
    soft: p => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-7 * p) * Math.cos(5 * p)),
  };
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const set = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const mix = (c1, c2, p) => c1.map((v, i) => lerp(v, c2[i], p));
  const rgba = c => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${c[3] ?? 1})`;

  /* ---------------------------------------------------------------- icons */
  const I = {
    home: '<path d="M3.5 10.5 12 3.8l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-5.8H9.2v5.8H5A1.5 1.5 0 0 1 3.5 19z"/>',
    users: '<circle cx="9" cy="8" r="3.3"/><path d="M2.8 20c.6-3.6 3.2-5.6 6.2-5.6s5.6 2 6.2 5.6"/><circle cx="17.2" cy="9" r="2.6"/><path d="M17 14.3c2.3.2 3.9 1.8 4.4 4.6"/>',
    house: '<path d="M4 20.5V9.2L12 4l8 5.2v11.3"/><path d="M9.5 20.5v-5.5h5v5.5M2.5 20.5h19"/>',
    spark: '<path d="M11 3.5l1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    dots: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    plus: '<path d="M12 5.5v13M5.5 12h13"/>', arrow: '<path d="M12 18.5V5.5M6 11.5 12 5.5l6 6"/>',
    msg: '<path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-5.5 4v-4h0a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.6"/><path d="m3.6 6.6 8.4 6.4 8.4-6.4"/>',
    phone: '<path d="M6.5 3.5h3l1.5 4.5-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  };
  const svg = (n, s = 22, w = 1.8, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;
  $$('[data-i]').forEach(el => { const n = el.dataset.i; el.insertAdjacentHTML('afterbegin', n === 'arrow' ? svg('arrow', 20, 2.4) : svg(n, el.id === 'mic' ? 38 : 22, el.id === 'mic' ? 2 : 1.8)); });
  $('#sbIcons').innerHTML = '<svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" stroke-opacity=".5"/><rect x="2" y="2" width="17" height="9" rx="2" fill="currentColor"/></svg>';
  const CHK = '<svg viewBox="0 0 22 22" width="22" height="22"><circle cx="11" cy="11" r="9.6" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1.4"/><circle class="f" cx="11" cy="11" r="10" fill="url(#ckg)" opacity="0"/><path class="p" d="M6.4 11.4l3.1 3.1 6.2-6.6" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="16" stroke-dashoffset="16"/><defs><linearGradient id="ckg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fb4ff"/><stop offset="1" stop-color="#a68cff"/></linearGradient></defs></svg>';
  const fillChecks = root => $$('.chk', root).forEach(el => { if (!el.innerHTML) el.innerHTML = CHK; });
  function setChk(el, p) {
    el.querySelector('.f').setAttribute('opacity', clamp(p * 2.5));
    el.querySelector('.f').setAttribute('r', 10 * (0.6 + 0.4 * E.outBack(clamp(p * 2.5))));
    el.querySelector('.p').setAttribute('stroke-dashoffset', 16 * (1 - E.outCubic(clamp((p - 0.25) / 0.75))));
  }

  /* ---------------------------------------------------------------- build: approvals, voice, week */
  $$('.acard .ab').forEach(b => { b.innerHTML = `<span class="lbl">Approve</span>${svg('check', 18, 2.6, '#fff')}`; });
  $('#allClear').innerHTML = `<div style="width:64px;height:64px;margin:0 auto;border-radius:50%;background:var(--pbg);display:flex;align-items:center;justify-content:center;color:var(--pfg)">${svg('check', 34, 2.6)}</div><div class="serif" style="font-size:32px;margin-top:16px">All approved</div><div style="font:400 13.5px/1.4 var(--sans);color:var(--muted);margin-top:6px">Scheduled · sending tonight</div>`;
  $('#clear .ck').innerHTML = svg('check', 36, 2.6, '#0b0b12');
  $('#wave').innerHTML = Array.from({ length: 34 }, () => '<i></i>').join('');
  const WBARS = $$('#wave i');
  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'], HEIGHTS = [0.45, 0.8, 0.6, 0.95, 0.7, 0.55, 1.0];
  $('#bars').innerHTML = DAYS.map(d => `<div class="bw"><div class="b"></div><div class="l">${d}</div></div>`).join('');
  const BARS = $$('#bars .b');

  /* ---------------------------------------------------------------- build: the building */
  const FH = 760;
  const ROW = (txt) => `<div class="row" style="margin-top:11px"><span class="chk" style="color:#0b0b12"></span>${txt}</div>`;
  const FLOORS = [
    { b: 16, t: '11:40', w: 'Sent.', lbl: '11:40 AM · Email', card: `
      <div class="caps">Email draft</div>
      <div style="font:400 13px/1.3 var(--sans);color:rgba(11,11,18,.5);margin-top:14px">To · Jordan Ellis</div>
      <div style="font:600 17px/1.3 var(--sans);margin-top:6px;min-height:44px" id="fSubj"></div>
      <div style="height:1px;background:rgba(11,11,18,.1);margin:12px 0"></div>
      <div id="fBody" style="font:400 14px/1.5 var(--sans);white-space:pre-wrap;height:150px"></div>
      <div id="fSig"><div class="serif" style="font-size:24px">Sarah Bennett</div><div style="font:400 12px/1.4 var(--sans);color:rgba(11,11,18,.5)">Coastline Realty Group · (212) 555-0174</div></div>` },
    { b: 19, t: '12:40', w: 'Queued.', lbl: '12:40 PM · Follow-ups', card: `
      <div class="caps">Follow-ups · 3 queued</div>
      ${[['JE', 'Jordan Ellis', 'See you at 3 today! Lobby of 245 W 19th.'], ['PS', 'Priya Shah', 'Pre-approval came through. See 6B Sunday?'], ['TC', 'The Coopers', 'Board package is ready for tonight.']].map(([i, n, m]) =>
        `<div class="fmsg"><div class="who"><span class="avatar">${i}</span>${n}<span class="q">${svg('clock', 12, 2)}Queued</span></div><div class="bub">${m}</div></div>`).join('')}` },
    { b: 22, t: '1:30', w: 'Who’s next?', lbl: '1:30 PM · Pipeline', card: `
      <div class="caps">Pipeline · 13 buyers</div>
      <div style="display:flex;gap:6px;margin-top:14px" id="fChips"><span class="chip" style="height:30px;font-size:12.5px">New 6</span><span class="chip" style="height:30px;font-size:12.5px">Touring 4</span><span class="chip" style="height:30px;font-size:12.5px">Offer 2</span><span class="chip" style="height:30px;font-size:12.5px">Closing 1</span></div>
      ${[['JE', 'Jordan Ellis', 'Touring · $1.3M', '#8fb4ff'], ['PS', 'Priya Shah', 'Touring · $1.1M', '#8fb4ff'], ['TC', 'The Coopers', 'Offer · 88 Horatio St', '#a68cff']].map(([i, n, s, c]) =>
        `<div class="fpr" style="display:flex;align-items:center;gap:10px;margin-top:12px"><span class="avatar">${i}</span><div style="flex:1"><div style="font:600 14px/1.2 var(--sans)">${n}</div><div style="font:400 12.5px/1.3 var(--sans);color:rgba(11,11,18,.55)"><i style="display:inline-block;width:7px;height:7px;border-radius:4px;background:${c};margin-right:6px"></i>${s}</div></div></div>`).join('')}
      <div id="fAns" style="margin-top:14px;padding:13px 14px;border-radius:18px;background:rgba(11,11,18,.06)"><div class="caps">Who should I follow up with?</div><div class="serif" style="font-size:25px;margin-top:8px">Jordan and Priya.</div></div>` },
    { b: 25, t: '3:00', w: 'Showing.', lbl: '3:00 PM · Calendar', card: `
      <div class="caps">Tuesday, Oct 6</div>
      ${[['10:00', 'Buyer consult · the Coopers', 1, ''], ['12:30', 'Call Priya Shah', 1, ''], ['3:00', 'Showing · 245 W 19th St, 6B', 0, 'day_loft'], ['5:30', 'Prep board package', 0, '']].map(([tm, tt, done, ph], k) =>
        `<div class="fcal" style="display:flex;align-items:center;gap:12px;margin-top:12px;height:52px;padding:0 12px;border-radius:16px;${ph ? 'background:linear-gradient(90deg,rgba(166,140,255,.28),rgba(255,201,168,.28));' : 'background:rgba(11,11,18,.05);'}">
          <div style="width:44px;font:600 13px/1 var(--sans);color:rgba(11,11,18,.55)">${tm}</div>${ph ? `<div class="photo" style="width:38px;height:38px;border-radius:10px;background-image:url(assets/photos/${ph}.jpg)"></div>` : ''}
          <div style="font:600 14px/1.2 var(--sans);flex:1;${done ? 'text-decoration:line-through;opacity:.5' : ''}">${tt}</div></div>`).join('')}
      <div style="display:flex;gap:6px;margin-top:14px"><span class="chip" style="height:30px;font-size:12.5px">Sun · Open house 1–4</span><span class="chip" style="height:30px;font-size:12.5px" id="fTasks">8 of 12 done</span></div>` },
    { b: 28, t: '4:30', w: 'Closing.', lbl: '4:30 PM · Closing', card: `
      <div class="caps">88 Horatio St, Apt 3F</div>
      <div class="serif" style="font-size:32px;margin-top:10px">Closing Friday</div>
      <div style="height:6px;border-radius:3px;background:rgba(11,11,18,.08);margin-top:14px;overflow:hidden"><i id="fProg" style="display:block;height:100%;width:0;background:linear-gradient(90deg,#8fb4ff,#a68cff,#ffc9a8)"></i></div>
      ${ROW('Contract signed')}${ROW('Inspection cleared')}${ROW('Appraisal in at $1.18M')}
      <div class="row" style="margin-top:11px;opacity:.55"><span style="width:22px;height:22px;border-radius:50%;border:1.4px dashed rgba(11,11,18,.4)"></span>Final walkthrough · Thu</div>
      <div class="row" style="margin-top:11px;opacity:.55"><span style="width:22px;height:22px;border-radius:50%;border:1.4px dashed rgba(11,11,18,.4)"></span>Closing · Fri 11 AM</div>` },
  ];
  const tower = $('#tower');
  FLOORS.forEach((f, k) => {
    const el = document.createElement('div');
    el.className = 'floor'; el.style.top = (k * FH) + 'px';
    el.innerHTML = `<div class="facade"><div class="glint"></div></div>
      <div class="ftime"><div class="lbl">${f.lbl}</div><div class="t"><div class="kl"><span>${f.t}</span></div></div><div class="w"><div class="kl"><span>${f.w}</span></div></div></div>
      <div class="fcard">${f.card}</div>`;
    tower.appendChild(el); f.el = el; f.card = el.querySelector('.fcard'); f.glint = el.querySelector('.glint');
    f.tSpan = el.querySelector('.t span'); f.wSpan = el.querySelector('.w span');
    $$('.kl', el).forEach(k2 => set(k2, { overflow: 'hidden', paddingBottom: '.08em' })); $$('.kl > span', el).forEach(s => (s.style.display = 'inline-block'));
    fillChecks(el);
  });
  // last "floor" is the ground: a single tall window we fly through into the dusk apartment
  const ground = document.createElement('div'); ground.className = 'floor'; ground.style.top = (FLOORS.length * FH) + 'px'; ground.innerHTML = '<div class="facade"></div>'; tower.appendChild(ground);
  fillChecks(document);

  /* ---------------------------------------------------------------- build: map */
  {
    const g = [];
    g.push('<rect width="1080" height="1080" fill="#f1efe9"/>');
    g.push('<path d="M0 0 L260 0 L120 1080 L0 1080 Z" fill="#c9daf3"/>');             // Hudson
    g.push('<g transform="rotate(-29 540 540)">');
    for (let i = -12; i <= 12; i++) g.push(`<line x1="${540 + i * 70}" y1="-300" x2="${540 + i * 70}" y2="1380" stroke="${i % 3 === 0 ? 'rgba(11,11,18,.16)' : 'rgba(11,11,18,.07)'}" stroke-width="${i % 3 === 0 ? 4 : 1.5}"/>`);
    for (let j = -14; j <= 14; j++) g.push(`<line x1="-300" y1="${540 + j * 46}" x2="1380" y2="${540 + j * 46}" stroke="rgba(11,11,18,.07)" stroke-width="1.5"/>`);
    g.push('<line id="w19" x1="-300" y1="494" x2="1380" y2="494" stroke="url(#mg)" stroke-width="7" stroke-linecap="round"/>');
    g.push('<rect x="300" y="250" width="70" height="140" fill="rgba(140,190,140,.25)"/>');
    g.push('<text x="560" y="482" font-family="Inter" font-weight="700" font-size="15" letter-spacing="4" fill="rgba(11,11,18,.55)">W 19TH ST</text>');
    g.push('<text x="752" y="300" font-family="Inter" font-weight="600" font-size="12" letter-spacing="3" fill="rgba(11,11,18,.35)" transform="rotate(90 752 300)">7TH AVE</text>');
    g.push('</g><defs><linearGradient id="mg" x1="0" x2="1"><stop offset="0" stop-color="#8fb4ff"/><stop offset=".5" stop-color="#a68cff"/><stop offset="1" stop-color="#ffc9a8"/></linearGradient></defs>');
    g.push('<text x="70" y="760" font-family="Instrument Serif" font-style="italic" font-size="30" fill="rgba(40,70,130,.6)" transform="rotate(-80 70 760)">Hudson River</text>');
    $('#mapSvg').innerHTML = g.join('');
  }

  /* ---------------------------------------------------------------- build: type */
  const DAYINK = '#0b0b12', WHITE = '#ffffff';
  const WORDS = [
    { lines: ['7 AM'], at: [2], out: 5.55, x: 96, y: 520, fs: 250, w: 430, layer: 'back', color: DAYINK },
    { lines: ['Chelsea.'], at: [7], out: 7.7, x: 590, y: 860, fs: 150, w: 400, layer: 'top', color: DAYINK },
    { lines: ['Ready.'], at: [9], out: 11.55, x: 610, y: 540, fs: 170, w: 380, layer: 'back', color: DAYINK },
    { lines: ['Posted.'], at: [13], out: 15.55, x: 540, y: 845, fs: 140, w: 600, layer: 'top', color: WHITE, center: true },
    { lines: ['Approved.'], at: [32], out: 35.4, x: 96, y: 560, fs: 140, w: 390, layer: 'back', color: WHITE },
    { lines: ['Logged.'], at: [38], out: 39.6, x: 620, y: 540, fs: 150, w: 370, layer: 'back', color: WHITE },
    { lines: ['Pipeline', 'up.'], at: [41, 41.5], out: 43.55, x: 620, y: 540, fs: 140, w: 370, layer: 'back', color: WHITE },
    { lines: ['Goodnight.'], at: [48], out: 55.4, x: 540, y: 540, fs: 215, w: 900, layer: 'back', color: WHITE, center: true },
  ];
  WORDS.forEach(w => {
    const el = document.createElement('div'); el.className = 'kw';
    el.innerHTML = w.lines.map(l => `<div class="ln"><span>${l}</span></div>`).join('');
    set(el, { left: w.x + 'px', top: w.y + 'px', fontSize: w.fs + 'px', color: w.color, transform: w.center ? 'translate(-50%,-50%)' : 'translate(0,-50%)', textAlign: w.center ? 'center' : 'left' });
    $(w.layer === 'top' ? '#wordsTopHost' : '#wordsBack')?.appendChild(el);
    w.el = el; w.spans = $$('.ln > span', el);
  });
  // a top-most type layer (above map / story / building)
  const top = document.createElement('div'); top.id = 'wordsTopHost'; top.className = 'full'; top.style.zIndex = 47; top.style.pointerEvents = 'none';
  $('#viewport').insertBefore(top, $('#fg'));
  WORDS.filter(w => w.layer === 'top').forEach(w => top.appendChild(w.el));

  // foreground: window mullion (rack focus) + night bokeh
  $('#fg').innerHTML = `<div id="mull" style="position:absolute;left:-20px;top:-40px;width:150px;height:1160px;background:linear-gradient(90deg,#0c0d12,#1c1d24 60%,#0c0d12)"></div>
    <div id="mullH" style="position:absolute;left:-40px;top:760px;width:1160px;height:70px;background:linear-gradient(180deg,#0c0d12,#22232b 50%,#0c0d12)"></div>
    <div id="bokehs"></div>`;
  {
    const r = rng(12), cols = ['255,170,80', '255,120,70', '143,180,255', '255,230,190'];
    $('#bokehs').innerHTML = Array.from({ length: 14 }, (_, i) => { const s = 60 + r() * 160; return `<div class="bokeh" data-x="${r() * 1080}" data-y="${r() * 1080}" data-s="${s}" style="width:${s}px;height:${s}px;background:radial-gradient(circle,rgba(${cols[i % 4]},.55),rgba(${cols[i % 4]},.18) 60%,rgba(${cols[i % 4]},0) 72%)"></div>`; }).join('');
  }
  const BOKEH = $$('#bokehs .bokeh').map(el => ({ el, x: +el.dataset.x, y: +el.dataset.y, s: +el.dataset.s }));
  // taxi light streaks
  const STREAKS = [];
  {
    const r = rng(77), host = $('#streaks');
    for (let i = 0; i < 16; i++) {
      const el = document.createElement('div'); el.className = 'streak';
      const warm = i % 3 !== 2, c = warm ? (i % 2 ? '255,90,50' : '255,160,70') : '230,240,255';
      const len = 200 + r() * 600;
      set(el, { width: len + 'px', background: `linear-gradient(90deg, rgba(${c},0), rgba(${c},.95) 70%, rgba(255,255,255,.95))`, boxShadow: `0 0 18px 4px rgba(${c},.55)` });
      host.appendChild(el);
      STREAKS.push({ el, y: 170 + r() * 720, v: (900 + r() * 1600) * (r() < 0.75 ? 1 : -1), off: r() * 3000, len });
    }
  }
  // doorbell rings
  $('#rings').innerHTML = Array.from({ length: 4 }, () => '<i></i>').join('');
  const RINGS = $$('#rings i');

  /* ---------------------------------------------------------------- assets ready */
  await document.fonts.load('400 40px "Instrument Serif"'); await document.fonts.load('italic 40px "Instrument Serif"'); await document.fonts.load('600 16px "Inter"'); await document.fonts.ready;
  await Promise.all(['day_loft', 'dusk_sofa', 'night_kitchen', 'night_living'].map(n => new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = `assets/photos/${n}.jpg`; })));
  WORDS.forEach(w => { const wd = w.el.offsetWidth; if (wd > w.w) w.el.style.fontSize = (w.fs * w.w / wd) + 'px'; });

  /* ---------------------------------------------------------------- refs */
  const R = {
    main: $('#main'), map: $('#map'), story: $('#story'), building: $('#building'), bsky: $('#bsky'), endcard: $('#endcard'), hud: $('#hud'),
    pDay: $('#pDay'), pDusk: $('#pDusk'), pKitchen: $('#pKitchen'), pLiving: $('#pLiving'), tint: $('#tint'), tint2: $('#tint2'), cab: $('#cab'),
    rig: $('#rig'), screen: $('#screen'), nightBg: $('#nightBg'), dayBg: $('#dayBg'), glare: $('#glare'), phShadow: $('#phShadow'), sbTime: $('#sbTime'),
    typed: $('#typed'), caret: $('#caret'), ph: $('#ph'), ctxt: $('#composer .txt'), send: $('#send'), glow: $('#composerGlow'),
    brief: $('#brief'), ub: $('#ub'), thumbs: $$('#thumbs .photo'), brows: $$('#brief .brow'), bbtns: $('#brief .btns'), ringArc: $('#ringArc'), ringPct: $('#ringPct'),
    slides: $$('#track .slide'), cdots: $$('#cdots i'), storyCard: $('#storyCard'), storyBars: $$('#storyCard .bars b'), storyBg: $('#storyBg'), seam: $('#seam'),
    acards: $$('.acard'), apCount: $('#apCount'), touch: $('#touch'), allClear: $('#allClear'),
    listen: $('#listen'), mic: $('#mic'), micRing: $('#micRing'), note: $('#note'), noteChk: $('#note .chk'), wave: $('#wave'),
    wkVal: $('#wkVal'), wkUp: $('#wkUp'), s1: $('#s1'), s2: $('#s2'), s3: $('#s3'),
    fq: $('#fq'), fcard: $('#fcard'), fchk: $$('#fcard .chk'), clear: $('#clear'),
    tower: $('#tower'), mpin: $('#mpin'), mripple: $('#mripple'), mapA: $('#mapA'), mapB: $('#mapB'),
    fg: $('#fg'), mull: $('#mull'), mullH: $('#mullH'), leakA: $('#leakA'), leakB: $('#leakB'), streakA: $('#streakA'), flash: $('#flash'),
    sun: $('#sun'), moon: $('#moon'), arcDone: $('#arcDone'), arcPath: $('#arcPath'), clock: $('#clock'), lblA: $('#lblA'), lblB: $('#lblB'), ctA: $('#ctA'), ctB: $('#ctB'),
    endCity: $('#endCity'), wordmark: $('#wordmark'), tagline: $('#tagline'), tagSpan: $('#tagline .ln > span'), cta: $('#cta'), ctaSpans: $$('#cta .ln > span'),
    letterbox: $('#letterbox'), vignette: $('#vignette'),
  };
  const screens = { sHome: $('#sHome'), sBrief: $('#sBrief'), sContent: $('#sContent'), sApprove: $('#sApprove'), sVoice: $('#sVoice'), sWeek: $('#sWeek'), sForget: $('#sForget') };
  const ARCLEN = R.arcPath.getTotalLength();

  /* ---------------------------------------------------------------- photo grades (time of day) */
  const G = {   // br, co, sa, se, hue, blur ; tint (soft-light rgba) ; mul (multiply rgb)
    morning: { f: [1.06, 0.95, 0.92, 0.10, -6], tint: [255, 214, 170, 0.45], mul: [255, 250, 244] },
    midday:  { f: [1.08, 1.10, 1.08, 0.00, 0], tint: [225, 238, 255, 0.30], mul: [255, 255, 255] },
    golden:  { f: [1.02, 1.06, 1.25, 0.22, -4], tint: [255, 165, 70, 0.55], mul: [255, 226, 190] },
    blue:    { f: [0.80, 1.10, 1.10, 0.00, -8], tint: [40, 70, 170, 0.50], mul: [170, 182, 235] },
    night:   { f: [0.84, 1.18, 1.18, 0.00, -4], tint: [20, 40, 120, 0.42], mul: [160, 172, 225] },
  };
  const gmix = (a, b, p) => ({ f: a.f.map((v, i) => lerp(v, b.f[i], p)), tint: mix(a.tint, b.tint, p), mul: mix(a.mul, b.mul, p) });
  function gradeAt(b) {
    if (b < 6) return G.morning;
    if (b < 8) return gmix(G.morning, G.midday, 0.5);
    if (b < 16.6) return gmix(G.morning, G.midday, E.inOut(P(b, 8, 12)));
    if (b < 32) return G.golden;
    if (b < 36) return gmix(gmix(G.golden, G.blue, E.inOut(P(b, 32, 33.4))), G.night, E.inOut(P(b, 33.4, 35.8)));
    return G.night;
  }
  const gradeFilter = (g, blur) => `brightness(${g.f[0]}) contrast(${g.f[1]}) saturate(${g.f[2]}) sepia(${g.f[3]}) hue-rotate(${g.f[4]}deg)${blur > 0.05 ? ` blur(${blur.toFixed(2)}px)` : ''}`;

  /* ---------------------------------------------------------------- masks */
  const rectPath = (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}Z`;
  function slats(p, n = 9) {     // vertical slats, alternate top/bottom, staggered
    const w = 1080 / n; let d = '';
    for (let i = 0; i < n; i++) { const q = E.outExpo(clamp(p * 1.6 - i * 0.07)); const h = 1080 * q; d += rectPath(i * w - 0.5, i % 2 ? 1080 - h : 0, w + 1, h); }
    return d;
  }
  function panes(p, cols = 3, rows = 2, gap0 = 46) {   // window panes growing from their centres, mullions close last
    const cw = 1080 / cols, ch = 1080 / rows; let d = '';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const q = E.inOut(clamp(p * 1.35 - (r * cols + c) * 0.06)), gap = gap0 * (1 - E.inCubic(clamp((p - 0.6) / 0.4)));
      const w = (cw - gap) * q, h = (ch - gap) * q;
      d += rectPath(c * cw + cw / 2 - w / 2, r * ch + ch / 2 - h / 2, w, h);
    }
    return d;
  }
  const FULL = rectPath(0, 0, 1080, 1080);

  /* ---------------------------------------------------------------- phone rig */
  const K = (b, v, ease = 'inOut') => [b, v, ease];
  const base = { x: 0, y: 0, s: 1, rx: 0, ry: 0, rz: 0, o: 1 };
  const st = o => Object.assign({}, base, o);
  const RIG = [
    K(0, st({ x: 175, y: 40, s: 0.94, rx: 8, ry: -18, rz: -5 })),
    K(5.6, st({ x: 165, y: 22, s: 0.99, rx: 5, ry: -12, rz: -3 }), 'inOut'),
    K(6.0, st({ x: 165, y: 22, s: 1.02, rx: 5, ry: -12, rz: -3 }), 'outCubic'),
    K(7.9, st({ x: -175, y: 12, s: 1.0, rx: 4, ry: 12, rz: 2 }), 'step'),
    K(11.8, st({ x: -168, y: 0, s: 1.03, rx: 2, ry: 10, rz: 1 }), 'inOut'),
    K(12.35, st({ x: -268, y: 20, s: 0.86, ry: 6 }), 'outExpo'),
    K(15.75, st({ x: -264, y: 10, s: 0.88, ry: 5 }), 'inOut'),
    K(16.45, st({ x: -264, y: 10, s: 0.88, ry: 5 }), 'linear'),
    K(30.9, st({ x: 175, y: 10, s: 1.0, rx: 3, ry: -10 }), 'step'),
    K(31.8, st({ x: 175, y: 0, s: 1.01, ry: -8 }), 'outCubic'),
    K(35.85, st({ x: 170, y: -10, s: 1.04, ry: -6 }), 'inOut'),
    K(36.0, st({ x: -170, y: 92, s: 1.0, rx: 22, ry: 10, rz: 3 }), 'step'),
    K(39.8, st({ x: -165, y: 72, s: 1.02, rx: 18, ry: 8, rz: 2 }), 'inOut'),
    K(43.85, st({ x: -160, y: 52, s: 1.04, rx: 14, ry: 8, rz: 1 }), 'inOut'),
    K(44.5, st({ x: 175, y: 0, s: 1.0, rx: 4, ry: -10 }), 'outExpo'),
    K(47.9, st({ x: 170, y: -6, s: 1.02, ry: -8 }), 'inOut'),
    K(50.5, st({ x: 0, y: 36, s: 0.9, rx: 4 }), 'inOut'),
    K(55.6, st({ x: 0, y: 26, s: 0.93, rx: 3 }), 'inOut'),
    K(56.3, st({ x: 0, y: 0, s: 1.25, o: 0 }), 'inExpo'),
    K(99, st({ s: 1.25, o: 0 }), 'linear'),
  ];
  const KEYS = Object.keys(base);
  function rigAt(b) {
    let i = 0; while (i < RIG.length - 2 && b >= RIG[i + 1][0]) i++;
    const [b0, v0] = RIG[i], [b1, v1, ease] = RIG[i + 1], p = E[ease](P(b, b0, b1));
    const o = {}; KEYS.forEach(k => (o[k] = lerp(v0[k], v1[k], p)));
    o.y += Math.sin(b * 0.45) * 5; o.x += Math.sin(b * 0.31 + 2) * 4; o.rz += Math.sin(b * 0.27) * 0.6; o.rx += Math.sin(b * 0.37 + 1) * 0.8;   // handheld
    return o;
  }
  const worldOf = (st0, lx, ly) => ({ x: 540 + st0.x + (11 + lx - 206) * st0.s, y: 540 + st0.y + (11 + ly - 433) * st0.s });

  /* ---------------------------------------------------------------- screens + tabs */
  const SCR = [['sHome', -1, 6.2], ['sBrief', 7.9, 12.0], ['sContent', 12.0, 16.6], ['sApprove', 30.9, 36.0], ['sVoice', 36.0, 40.0, 'cut'], ['sWeek', 40.0, 44.0, 'cube'], ['sForget', 44.0, 99, 'cube']];
  const TABS = [[-1, 0], [7.9, null], [12, 3], [16.6, 3], [30.9, 0], [36, null], [40, 4], [44, 0]];
  const PILLW = [104, 128, 0, 122, 126, 0], LABELS = ['Home', 'Contacts', 'Properties', 'Content', 'Calendar', 'More'], ICONS = ['home', 'users', 'house', 'spark', 'cal', 'dots'];
  const tabEls = $$('#tabbar .tab'), pill = $('#tabPill'), pillLabel = $('#pillLabel'), pillIcon = $('#pillIcon'), tabbar = $('#tabbar');
  function tabLayout(a) { const inner = 344, pw = a == null ? 40 : PILLW[a], gap = (inner - pw - 200) / 5; let x = 9; return Array.from({ length: 6 }, (_, i) => { const w = i === a ? pw : 40, r = { x, w }; x += w + gap; return r; }); }

  /* ---------------------------------------------------------------- clock */
  const CLK = TL.clock;
  const LBL = { 0: 'Chelsea · morning', 6: 'Address found', 8: 'Listing brief', 12: 'Post + story', 16: 'Email', 19: 'Follow-ups', 22: 'Pipeline', 25: 'Calendar', 28: 'Transaction', 31: 'Ready for approval', 32: 'Approved', 36: 'Voice log · cab', 40: 'Week overview', 44: 'Night check' };
  const LBLB = Object.keys(LBL).map(Number);
  const mins = s => { const [hm, ap] = s.split(' '); let [h, m] = hm.split(':').map(Number); if (ap === 'PM' && h !== 12) h += 12; if (ap === 'AM' && h === 12) h = 0; return h * 60 + m; };
  const SUNSET = mins('6:05 PM'), SUNRISE = mins('7:00 AM'), MOONTOP = mins('9:15 PM');
  const sunU = m => clamp((m - SUNRISE) / (SUNSET - SUNRISE));
  const moonU = m => clamp((m - SUNSET) / (MOONTOP - SUNSET) * 0.5, 0, 0.5);

  /* ---------------------------------------------------------------- grain + stars */
  const grain = $('#grain'), gctx = grain.getContext('2d'), NOISE = [];
  { const r = rng(99); for (let k = 0; k < 8; k++) { const c = document.createElement('canvas'); c.width = c.height = 540; const x = c.getContext('2d'), id = x.createImageData(540, 540); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 130; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); NOISE.push(c); } }
  const stars = $('#stars'), sctx = stars.getContext('2d');
  const STARS = (() => { const r = rng(5); return Array.from({ length: 150 }, () => ({ x: r() * 780, y: r() * 1688, s: 0.6 + r() * 1.6, a: 0.25 + r() * 0.6, ph: r() * 6.28, sp: 0.5 + r() * 2 })); })();

  const reveal = (span, b, b0, outB = 999, dur = 0.7) => {
    const p = E.outExpo(P(b, b0, b0 + dur)), q = E.inCubic(P(b, outB, outB + 0.4));
    span.style.transform = `translateY(${(1 - p) * 112 - q * 112}%)`; span.style.opacity = p > 0 ? 1 : 0;
    span.style.filter = (p < 1 || q > 0) ? `blur(${(1 - p) * 6 + q * 6}px)` : 'none';
  };
  const EMAIL_SUBJ = 'Viewing today at 3 PM, 245 W 19th St';
  const EMAIL_BODY = 'Hi Jordan,\n\nYou’re confirmed for 3:00 PM at 245 W 19th St, Apt 6B. Doorman building, I’ll meet you in the lobby.\n\nSee you there!';
  const D = { day: { fg: [11, 11, 18, 1], muted: [11, 11, 18, 0.55], card: [255, 255, 255, 0.62], cardB: [255, 255, 255, 0.9], chip: [11, 11, 18, 0.06], btnB: [11, 11, 18, 0.2], pbg: [11, 11, 18, 1], pfg: [255, 255, 255, 1], sh: [60, 50, 120, 0.22] },
    night: { fg: [255, 255, 255, 1], muted: [255, 255, 255, 0.58], card: [255, 255, 255, 0.08], cardB: [255, 255, 255, 0.13], chip: [255, 255, 255, 0.08], btnB: [255, 255, 255, 0.28], pbg: [255, 255, 255, 1], pfg: [11, 11, 18, 1], sh: [0, 0, 0, 0.55] } };

  /* ================================================================ RENDER */
  function render(t) {
    const b = Math.min(t / BEAT, HOLD), frozen = t / BEAT >= HOLD;

    /* ---------- theme: day -> night on the drop ---------- */
    const n = E.inOut(P(b, DROP + 0.1, DROP + 1.4));
    const sv = R.screen.style;
    for (const k of ['fg', 'muted', 'card', 'cardB', 'chip', 'btnB', 'pbg', 'pfg']) sv.setProperty('--' + k, rgba(mix(D.day[k], D.night[k], n)));
    sv.setProperty('--shadow', `0 18px 40px -16px ${rgba(mix(D.day.sh, D.night.sh, n))}, inset 0 1px 0 rgba(255,255,255,${lerp(0.7, 0.1, n)})`);
    const rev = E.inOut(P(b, DROP, DROP + 1.3));
    R.nightBg.style.clipPath = b < DROP ? 'circle(0px at 325px 95px)' : `circle(${rev * 1000}px at 325px 95px)`;
    R.nightBg.style.visibility = b < DROP ? 'hidden' : 'visible';
    if (b >= DROP) {
      sctx.clearRect(0, 0, 780, 1688);
      for (const s of STARS) { const y = (s.y + b * 4 * s.sp) % 1688; sctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(b * s.sp + s.ph)); sctx.fillStyle = '#fff'; sctx.beginPath(); sctx.arc(s.x, y, s.s, 0, 6.283); sctx.fill(); }
    }

    /* ---------- photo plates ---------- */
    const g = gradeAt(b);
    const plates = [[R.pDay, -1, 16.6], [R.pDusk, 30.9, 36.05], [R.pKitchen, 35.95, 44.9], [R.pLiving, 44.0, 99]];
    for (const [el, b0, b1] of plates) {
      const on = b >= b0 && b < b1; el.style.visibility = on ? 'visible' : 'hidden'; if (!on) continue;
      let blur = 4;
      if (el === R.pDay) blur = b < 1.6 ? lerp(9, 4, E.inOut(P(b, 0.2, 1.6))) : (b >= 8 && b < 8.7 ? lerp(0.5, 3.5, P(b, 8.2, 8.7)) : 3.5);
      if (el === R.pKitchen) { blur = b < 40 ? 16 : lerp(16, 4, E.inOut(P(b, 40, 40.8))); if (b < 40) el.style.opacity = 0.7; else el.style.opacity = lerp(0.7, 1, P(b, 40, 40.8)); }
      if (el === R.pLiving) blur = b < 48 ? (b < 44.8 ? 0.5 : lerp(0.5, 4, P(b, 44.8, 45.5))) : lerp(4, 0.6, E.inOut(P(b, 48, 50)));
      if (el === R.pDusk) blur = 3.5;
      const push = 1 + 0.06 * P(b, Math.max(b0, 0), b1 > 90 ? 56 : b1);
      el.style.filter = gradeFilter(g, blur);
      el.style.transform = `translate(${Math.sin(b * 0.23) * 8}px,${Math.cos(b * 0.19) * 6}px) scale(${push})`;
    }
    R.pLiving.style.clipPath = b < 44 ? 'path("M0 0Z")' : b < 44.9 ? `path("${panes(P(b, 44.0, 44.85))}")` : 'none';
    R.tint.style.background = rgba(g.tint); R.tint2.style.background = `rgb(${g.mul.map(v => v | 0).join(',')})`;

    /* ---------- cab (b36-40) ---------- */
    const cabOn = b >= 36 && b < 40.6;
    R.cab.style.visibility = cabOn ? 'visible' : 'hidden';
    if (cabOn) {
      R.cab.style.opacity = 1 - P(b, 40, 40.6);
      const tt = (b - 36) * BEAT;
      STREAKS.forEach((s, i) => {
        let x = ((s.off + tt * s.v) % 3000 + 3000) % 3000 - 900;
        if (i === 0) x = lerp(-700, 1500, E.inOut(P(b, 35.9, 36.8)));     // the hero streak: match-cut into the card glow
        set(s.el, { transform: `translate(${x}px,${i === 0 ? 560 : s.y}px)`, opacity: i === 0 ? 1 : 0.85 });
      });
    }

    /* ---------- phone ---------- */
    const r0 = rigAt(b), r1 = rigAt(b - (1 / 120) / BEAT);
    R.rig.style.transform = `perspective(2200px) translate(${r0.x}px,${r0.y}px) scale(${r0.s}) rotateX(${r0.rx}deg) rotateY(${r0.ry}deg) rotateZ(${r0.rz}deg)`;
    R.rig.style.opacity = r0.o; R.rig.style.visibility = r0.o < 0.01 || (b > 16.5 && b < 30.9) || (b >= 6.45 && b < 7.9) ? 'hidden' : 'visible';
    const vx = Math.abs(r0.x - r1.x), vy = Math.abs(r0.y - r1.y);
    $('#mbRigBlur').setAttribute('stdDeviation', `${Math.min(16, vx * 0.2)} ${Math.min(14, vy * 0.2)}`);
    const focusBlur = b < 1.6 ? lerp(8, 0, E.inOut(P(b, 0.2, 1.6))) : 0;
    R.rig.style.filter = [vx + vy > 1.5 ? 'url(#mbRig)' : '', focusBlur > 0.05 ? `blur(${focusBlur}px)` : ''].join(' ').trim() || 'none';
    // light match: warm glare by day, cool city light at night; shadow follows the sun
    R.glare.style.background = `linear-gradient(${115 + r0.ry * 2}deg, rgba(255,255,255,0) 30%, ${n < 0.5 ? 'rgba(255,236,210,.16)' : 'rgba(170,190,255,.12)'} 48%, rgba(255,255,255,0) 62%)`;
    R.phShadow.style.transform = `translate(${lerp(40, 10, n)}px, ${lerp(46, 30, n)}px)`; R.phShadow.style.opacity = lerp(0.55, 0.75, n);

    // screen visibility + transitions
    for (const [id, i0, o0, kind] of SCR) {
      const el = screens[id], vis = b >= i0 - 0.05 && b < o0 + (kind === 'cube' ? 0 : 0.02) + 0.5 * (SCR.find(s => s[1] === o0)?.[3] === 'cube' ? 1 : 0);
      el.style.visibility = vis ? 'visible' : 'hidden'; if (!vis) continue;
      let tr = 'none', op = 1;
      if (kind === 'cube' && b < i0 + 0.5) { const p = E.inOut(P(b, i0 - 0.05, i0 + 0.45)); tr = `perspective(900px) translateZ(-195px) rotateY(${90 * (1 - p)}deg) translateZ(195px)`; }
      const nxt = SCR.find(s => s[1] === o0);
      if (nxt && nxt[3] === 'cube' && b >= o0 - 0.05) { const p = E.inOut(P(b, o0 - 0.05, o0 + 0.45)); tr = `perspective(900px) translateZ(-195px) rotateY(${-90 * p}deg) translateZ(195px)`; if (p >= 1) op = 0; }
      if (!nxt || nxt[3] !== 'cube') if (b >= o0) op = 0;
      if (kind !== 'cube' && b < i0) op = 0;
      el.style.transform = tr; el.style.opacity = op;
    }
    // tab bar
    {
      let i = 0; while (i < TABS.length - 1 && b >= TABS[i + 1][0]) i++;
      const [tb, a1] = TABS[i], a0 = i > 0 ? TABS[i - 1][1] : a1;
      const p = E.spring(P(b, tb - 0.05, tb + 0.55)), show = lerp(a0 != null ? 1 : 0, a1 != null ? 1 : 0, E.outCubic(P(b, tb - 0.05, tb + 0.3)));
      set(tabbar, { transform: `translateY(${(1 - show) * 120}px)`, opacity: show });
      const A0 = a0 ?? a1, A = a1 ?? a0, la = tabLayout(A0), lb = tabLayout(A);
      tabEls.forEach((el, k) => { const x = lerp(la[k].x, lb[k].x, p), w = lerp(la[k].w, lb[k].w, p); el.style.left = (x + w / 2 - 23) + 'px'; el.style.opacity = 1 - lerp(k === A0 ? 1 : 0, k === A ? 1 : 0, clamp(p)); });
      set(pill, { left: lerp(la[A0].x, lb[A].x, p) + 'px', width: lerp(la[A0].w, lb[A].w, p) + 'px' });
      const lab = p < 0.5 ? A0 : A;
      if (pillLabel.textContent !== LABELS[lab]) { pillLabel.textContent = LABELS[lab]; pillIcon.innerHTML = svg(ICONS[lab], 20, 2); }
    }

    /* ---------- 0-6 home + typing ---------- */
    {
      const k = TL.keyBeats.filter(x => x <= b).length;
      R.typed.textContent = TL.prompt.slice(0, k); R.ph.style.display = k ? 'none' : 'inline';
      R.caret.style.opacity = b >= 6 ? 0 : (k > 0 && k < TL.prompt.length) || Math.floor(b * 2) % 2 === 0 ? 1 : 0;
      const fly = E.inOut(P(b, 6.0, 6.35)); set(R.ctxt, { transform: `translateY(${-40 * fly}px)`, opacity: 1 - fly });
      R.send.style.transform = `scale(${b >= 6 && b < 6.25 ? 1 - Math.sin(P(b, 6, 6.25) * Math.PI) * 0.15 : 1})`;
      R.glow.style.opacity = Math.max(E.outCubic(P(b, 1.0, 1.5)) * 0.7, b >= 5.6 ? 1 - P(b, 6.1, 6.4) : 0);
    }

    /* ---------- 6-8 map ---------- */
    {
      const on = b >= 6 && b < 8.9;
      R.map.style.visibility = on ? 'visible' : 'hidden';
      if (on) {
        R.map.style.clipPath = b < 6.5 ? `path("${slats(P(b, 6, 6.5))}")` : b < 8 ? 'none' : `path(evenodd, "${FULL} ${panes(P(b, 8.0, 8.85))}")`;
        R.map.style.transform = `scale(${1.08 - 0.06 * E.outCubic(P(b, 6, 8))})`;
        const pf = E.inCubic(P(b, 6.6, 7.0)), pinX = 548, pinY = 470;
        const sq = b >= 7 ? Math.sin(P(b, 7, 7.25) * Math.PI) * 0.2 : 0;
        set(R.mpin, { left: pinX + 'px', top: pinY + 'px', transform: `translateY(${-200 * (1 - pf)}px) scale(${1 + sq * 0.5},${1 - sq})`, opacity: P(b, 6.55, 6.65) });
        const rp = P(b, 7, 7.9); set(R.mripple, { left: pinX + 'px', top: pinY + 'px', transform: `scale(${1 + rp * 7})`, opacity: b >= 7 ? (1 - rp) * 0.9 : 0 });
        R.mapA.textContent = '245 W 19th St';
        const comp = ', New York, NY 10011', nc = Math.floor(comp.length * E.outCubic(P(b, 6.3, 6.95)));
        R.mapB.innerHTML = nc ? `Apt 6B<span class="ac">${comp.slice(0, nc)}</span>` : 'Apt 6B';
      }
    }

    /* ---------- 8-12 brief ---------- */
    {
      R.thumbs.forEach((el, i) => { const p = E.spring(P(b, 8.3 + i * 0.12, 8.9 + i * 0.12)); set(el, { opacity: clamp(p * 2), transform: `translateY(${(1 - p) * 26}px) scale(${0.8 + 0.2 * p})` }); });
      const ring = E.outCubic(P(b, 8.2, 11.2));
      R.ringArc.setAttribute('stroke-dashoffset', 119.4 * (1 - ring)); R.ringPct.textContent = Math.round(ring * 100) + '%';
      R.brows.forEach((row, i) => { const b0 = 9 + i, p = E.outExpo(P(b, b0 - 0.1, b0 + 0.4)); set(row, { opacity: p, clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }); setChk(row.querySelector('.chk'), P(b, b0, b0 + 0.35)); });
      const bp = E.spring(P(b, 11.0, 11.7)); set(R.bbtns, { opacity: clamp(bp), transform: `translateY(${(1 - bp) * 14}px)` });
    }

    /* ---------- 12-16 content + story (split) ---------- */
    {
      const k = E.outExpo(P(b, 13, 13.45)) + E.outExpo(P(b, 14, 14.45)) + E.outExpo(P(b, 15, 15.45));
      R.slides.forEach((el, i) => { const x = (i - k) * 360, f = clamp(1 - Math.abs(i - k)); el.style.transform = `translateX(${x}px) scale(${0.9 + 0.1 * f})`; el.style.opacity = 0.4 + 0.6 * f; });
      R.cdots.forEach((d, i) => { const on = Math.round(k) === i; d.style.width = (on ? 20 : 7) + 'px'; d.style.opacity = on ? 1 : 0.45; });
      const on = b >= 11.95 && b < 16.6;
      R.story.style.visibility = on ? 'visible' : 'hidden';
      if (on) {
        const sp = E.outExpo(P(b, 12.0, 12.4));
        R.story.style.clipPath = `inset(0 0 0 ${lerp(1080, 540, sp)}px)`;
        R.storyCard.style.transform = `translateY(${(1 - E.spring(P(b, 12.05, 12.8))) * 80}px) rotate(${(1 - sp) * 4}deg)`;
        R.storyBars[0].style.width = P(b, 12.3, 14) * 100 + '%'; R.storyBars[1].style.width = P(b, 14, 15.7) * 100 + '%';
        R.storyCard.querySelector('.photo').style.transform = `scale(${1 + 0.06 * P(b, 12, 16)})`;
      }
    }

    /* ---------- 16-31: the building (one continuous downward camera move) ---------- */
    {
      const on = b >= 15.7 && b < 31.75;
      R.building.style.visibility = on ? 'visible' : 'hidden';
      const enter = E.outExpo(P(b, 15.75, 16.45));
      const lift = -1080 * enter;   // everything above moves up with the camera
      R.main.style.transform = b >= 15.75 && b < 16.6 ? `translateY(${lift}px)` : 'none';
      R.story.style.transform = b >= 15.75 ? `translateY(${lift}px)` : 'none';
      if (on) {
        R.building.style.transform = `translateY(${1080 + lift}px)`;
        // camera Y through the floors: lands on each floor on its beat, drifts between
        let camY = 0;
        FLOORS.forEach((f, k) => { if (k > 0) camY += FH * E.inOut(P(b, f.b - 0.45, f.b + 0.35)); });
        camY += FH * E.inOut(P(b, 30.4, 31.2)) * 0.55 + 46 * P(b, 16, 31);
        R.tower.style.transform = `translateY(${120 - camY}px)`;
        // sky through the day: midday -> afternoon -> golden
        const sky = b < 25 ? [[156, 196, 255], [236, 243, 255], P(b, 16, 25) * 0.5] : [[246, 178, 107], [255, 236, 214], P(b, 25, 30)];
        const top = b < 25 ? mix([150, 190, 255], [170, 196, 255], sky[2]) : mix([170, 196, 255], [242, 170, 104], sky[2]);
        const bot = b < 25 ? mix([238, 244, 255], [250, 238, 222], sky[2]) : mix([250, 238, 222], [255, 222, 186], sky[2]);
        R.bsky.style.background = `linear-gradient(180deg, ${rgba(top)} 0%, ${rgba(bot)} 100%)`;
        FLOORS.forEach((f, k) => {
          const a = P(b, f.b - 0.1, f.b + 0.6);
          reveal(f.tSpan, b, f.b - 0.05, 999, 0.6); reveal(f.wSpan, b, f.b + 1, 999, 0.6);
          const cp = E.spring(P(b, f.b, f.b + 0.75)); set(f.card, { opacity: clamp(cp * 2), transform: `translateY(${(1 - cp) * 60}px) rotate(${(1 - cp) * 2}deg)` });
          f.glint.style.transform = `translateX(${lerp(-400, 1300, E.inOut(P(b, f.b, f.b + 1.2)))}px)`; void a;
        });
        // floor content
        const subN = Math.floor(EMAIL_SUBJ.length * P(b, 16.15, 16.85)), bodyN = Math.floor(EMAIL_BODY.length * P(b, 16.85, 18.35));
        $('#fSubj').textContent = EMAIL_SUBJ.slice(0, subN); $('#fBody').textContent = EMAIL_BODY.slice(0, bodyN);
        set($('#fSig'), { opacity: E.outCubic(P(b, 18.35, 18.7)) });
        $$('.fmsg', FLOORS[1].el).forEach((m, i) => { const p = E.spring(P(b, 19.3 + i * 0.5, 19.9 + i * 0.5)); set(m, { opacity: clamp(p * 2), transform: `translateY(${(1 - p) * 20}px)` }); const q = m.querySelector('.q'); const qp = E.outBack(P(b, 20 + i * 0.5, 20.3 + i * 0.5)); set(q, { opacity: clamp(qp * 2), transform: `scale(${0.6 + 0.4 * qp})` }); });
        $$('#fChips .chip').forEach((c, i) => c.classList.toggle('on', i === 1 && b >= 23));
        $$('.fpr', FLOORS[2].el).forEach((m, i) => { const p = E.outExpo(P(b, 22.2 + i * 0.2, 22.7 + i * 0.2)); set(m, { opacity: p, transform: `translateX(${(1 - p) * 30}px)` }); });
        const ans = E.spring(P(b, 23.5, 24.2)); set($('#fAns'), { opacity: clamp(ans * 2), transform: `translateY(${(1 - ans) * 20}px)` });
        $$('.fcal', FLOORS[3].el).forEach((m, i) => { const b0 = i === 2 ? 25.3 : 25 + i * 0.15, p = i === 2 ? E.spring(P(b, b0, b0 + 0.7)) : E.outExpo(P(b, b0, b0 + 0.4)); set(m, { opacity: clamp(p * 2), transform: i === 2 ? `translateY(${(1 - p) * -40}px) scale(${1.05 - 0.05 * p})` : `translateX(${(1 - p) * 30}px)` }); });
        $('#fTasks').textContent = `${Math.round(lerp(5, 8, E.outCubic(P(b, 25.5, 26.8))))} of 12 done`;
        $('#fProg').style.width = (80 * E.outCubic(P(b, 28.2, 30.2))) + '%';
        $$('.chk', FLOORS[4].el).forEach((c, i) => setChk(c, P(b, 29 + i * 0.5, 29.35 + i * 0.5)));
        // fly through a window into the dusk apartment (evenodd hole)
        if (b >= 30.9) {
          const p = E.inOut(P(b, 30.9, 31.6)), x0 = 655, y0 = 420, w0 = 120, h0 = 230;
          const x = lerp(x0, -2, p), y = lerp(y0, -2, p), w = lerp(w0, 1084, p), h = lerp(h0, 1084, p);
          R.building.style.clipPath = `path(evenodd, "${FULL} ${rectPath(x, y, w, h)}")`;
        } else R.building.style.clipPath = 'none';
      }
      R.main.style.visibility = b > 16.5 && b < 30.85 ? 'hidden' : 'visible';
    }

    /* ---------- 31-36 approvals: the drop flips day to night ---------- */
    {
      const T = [32, 33, 34, 35];
      R.acards.forEach((c, i) => {
        const enter = E.spring(P(b, 31.0 + i * 0.1, 31.7 + i * 0.1));
        let shift = 0; for (let j = 0; j < i; j++) shift += 108 * E.spring(P(b, T[j] + 0.2, T[j] + 0.75));
        const sweep = E.outExpo(P(b, T[i] + 0.15, T[i] + 0.55));
        set(c, { top: (150 + i * 108 - shift) + 'px', opacity: clamp(P(b, 31 + i * 0.1, 31.2 + i * 0.1)) * (1 - P(b, T[i] + 0.25, T[i] + 0.5)), transform: `translate(${sweep * 420}px,${(1 - enter) * 60}px) rotate(${sweep * 7}deg)` });
        const btn = c.querySelector('.ab'), fill = E.outCubic(P(b, T[i], T[i] + 0.1));
        const press = b >= T[i] && b < T[i] + 0.15 ? 1 - 0.1 * Math.sin(P(b, T[i], T[i] + 0.15) * Math.PI) : 1;
        set(btn, { background: fill > 0 ? `linear-gradient(135deg, rgba(143,180,255,${fill}), rgba(166,140,255,${fill}))` : 'transparent', transform: `scale(${press})`, boxShadow: fill > 0 ? `0 0 ${30 * (1 - P(b, T[i], T[i] + 0.7))}px rgba(166,140,255,.95)` : 'none' });
        btn.querySelector('.lbl').style.opacity = 1 - fill;
        const ck = btn.querySelector('svg'), path = ck.querySelector('path'); path.setAttribute('stroke-dasharray', '22'); path.setAttribute('stroke-dashoffset', 22 * (1 - E.outCubic(P(b, T[i] + 0.02, T[i] + 0.2)))); ck.style.opacity = fill;
      });
      const cnt = 4 - T.filter(x => b >= x).length; R.apCount.textContent = Math.max(cnt, 1); R.apCount.style.opacity = cnt > 0 ? 1 : 1 - P(b, 35, 35.2);
      const tp = b >= 31.6 && b < 35.4 ? Math.min(P(b, 31.6, 31.8), 1 - P(b, 35.2, 35.4)) : 0;
      const pr = Math.max(0, ...T.map(x => (b >= x - 0.05 && b < x + 0.12) ? Math.sin(P(b, x - 0.05, x + 0.12) * Math.PI) : 0));
      set(R.touch, { left: '318px', top: '198px', opacity: tp * 0.95, transform: `scale(${1 - 0.22 * pr})` });
      const ac = E.spring(P(b, 35.4, 36)); set(R.allClear, { opacity: clamp(ac * 1.5), transform: `translateY(${(1 - ac) * 24}px)` });
    }

    /* ---------- 36-40 voice log ---------- */
    {
      const listening = b < 38;
      R.listen.style.opacity = listening ? 1 : 1 - P(b, 38, 38.2);
      const collapse = E.inOut(P(b, 37.75, 38.15));
      WBARS.forEach((el, i) => {
        const h = 10 + 130 * Math.abs(Math.sin(b * 5.1 + i * 0.7) * Math.sin(b * 2.3 + i * 0.31)) * (0.4 + 0.6 * Math.sin((i / 33) * Math.PI));
        set(el, { height: lerp(h, 4, collapse) + 'px', opacity: 1 - P(b, 38.0, 38.25) });
      });
      R.wave.style.transform = `translateY(${-80 * collapse}px) scaleX(${1 - 0.4 * collapse})`;
      set(R.mic, { transform: `scale(${1 + 0.05 * Math.sin(b * 6)})`, opacity: 1 - P(b, 37.9, 38.2) });
      set(R.micRing, { transform: `scale(${1 + 0.6 * ((b * 1.5) % 1)})`, opacity: (1 - ((b * 1.5) % 1)) * (1 - P(b, 37.9, 38.2)) });
      const np = E.spring(P(b, 38.0, 38.7));
      set(R.note, { opacity: clamp(np * 2), transform: `translateY(${(1 - np) * 40}px) scale(${0.94 + 0.06 * np})`,
        boxShadow: `0 0 ${lerp(70, 0, P(b, 36, 37.5))}px ${lerp(14, 0, P(b, 36, 37.5))}px rgba(255,150,70,${lerp(0.7, 0, P(b, 36, 37.5))}), var(--shadow)` });
      setChk(R.noteChk, P(b, 38.6, 39));
    }

    /* ---------- 40-44 week ---------- */
    {
      const v = lerp(2.40, 3.65, E.outCubic(P(b, 40.4, 42.6)));
      R.wkVal.textContent = '$' + v.toFixed(2) + 'M';
      const up = E.outBack(P(b, 42.6, 42.9)); set(R.wkUp, { opacity: clamp(up * 2), transform: `scale(${0.7 + 0.3 * up})` });
      BARS.forEach((el, i) => { const p = E.spring(P(b, 40.4 + i * 0.12, 41.1 + i * 0.12)); el.style.height = (HEIGHTS[i] * 200 * clamp(p, 0, 1.1)) + 'px'; });
      R.s1.textContent = Math.round(4 * E.outCubic(P(b, 40.5, 42))); R.s2.textContent = b >= 41 ? 1 : 0; R.s3.textContent = Math.round(12 * E.outCubic(P(b, 40.5, 42.4)));
    }

    /* ---------- 44-56 forgetting + all clear ---------- */
    {
      const q = E.spring(P(b, 44.3, 44.9)); set(R.fq, { opacity: clamp(q * 2), transform: `translateY(${(1 - q) * 20}px)` });
      const c = E.spring(P(b, 44.6, 45.2)); set(R.fcard, { opacity: clamp(c * 2), transform: `translateY(${(1 - c) * 30}px)` });
      [45, 45.5, 46].forEach((x, i) => setChk(R.fchk[i], P(b, x, x + 0.35)));
      const a = E.spring(P(b, 47, 47.7)); set(R.clear, { opacity: clamp(a * 2), transform: `translateY(${(1 - a) * 30}px) scale(${0.9 + 0.1 * a})` });
    }

    /* ---------- type ---------- */
    for (const w of WORDS) {
      const vis = b >= w.at[0] - 0.05 && b < w.out + 0.45; w.el.style.visibility = vis ? 'visible' : 'hidden'; if (!vis) continue;
      w.spans.forEach((s, j) => reveal(s, b, w.at[j], w.out));
      const glow = 1 - P(b, w.at[0], w.at[0] + 1.4);
      w.el.style.textShadow = w.color === WHITE ? `0 0 ${30 + glow * 40}px rgba(166,140,255,${0.25 + glow * 0.45})` : `0 0 30px rgba(255,255,255,${0.35 + glow * 0.35})`;
    }
    $('#wordsBack').style.transform = `translate(${-Math.sin(b * 0.31) * 6}px,${-Math.cos(b * 0.27) * 4}px)`;

    /* ---------- foreground: rack focus (open) and city bokeh (calm) ---------- */
    {
      const mf = P(b, 0.2, 1.6), mo = 1 - P(b, 3.5, 5.5);
      const fgOn = b < 5.6 || (b >= 48 && b < 56.2);
      R.fg.style.visibility = fgOn ? 'visible' : 'hidden';
      set(R.mull, { filter: `blur(${lerp(0, 26, E.inOut(mf))}px)`, opacity: mo * lerp(1, 0.85, mf), transform: `translateX(${-60 * P(b, 0, 5.5)}px)` });
      set(R.mullH, { filter: `blur(${lerp(0, 26, E.inOut(mf))}px)`, opacity: mo * lerp(1, 0.8, mf), transform: `translateY(${80 * P(b, 0, 5.5)}px)` });
      const calm = b >= 48 ? E.inOut(P(b, 48, 50)) * (1 - P(b, 55.6, 56.1)) : 0;
      BOKEH.forEach((k, i) => set(k.el, { opacity: calm * 0.75, transform: `translate(${k.x + Math.sin(b * 0.2 + i) * 30}px,${k.y + Math.cos(b * 0.17 + i) * 20}px)`, filter: 'blur(6px)' }));
    }

    /* ---------- doorbell match-cut rings (tap -> ring) ---------- */
    {
      const on = b >= 35 && b < 36.1; R.rings ??= $('#rings'); R.rings.style.visibility = on ? 'visible' : 'hidden';
      if (on) {
        const o = worldOf(rigAt(35), 318, 198);
        RINGS.forEach((el, i) => { const p = P(b, 35 + i * 0.12, 35.9 + i * 0.12); const r = 30 + E.outCubic(p) * 1100; set(el, { left: (o.x - r) + 'px', top: (o.y - r) + 'px', width: 2 * r + 'px', height: 2 * r + 'px', opacity: p > 0 ? (1 - p) * 0.9 : 0, borderWidth: lerp(3, 1, p) + 'px' }); });
      }
    }

    /* ---------- light: brand-gradient pulses, anamorphic streak ---------- */
    {
      const ph = rigAt(Math.min(b, 36)), cx = 540 + ph.x, cy = 540 + ph.y;
      const pulse = [32, 33, 34, 35].reduce((a, x) => a + (b >= x ? (1 - E.outCubic(P(b, x, x + 0.9))) * (x === 32 ? 1 : 0.6) : 0), 0);
      const endGlow = b >= 56 ? 0.5 * (1 - P(b, 56, 59)) : 0;
      set(R.leakA, { left: cx + 'px', top: cy + 'px', background: 'radial-gradient(closest-side, rgba(166,140,255,.75), rgba(143,180,255,.25) 55%, rgba(143,180,255,0))', opacity: clamp(pulse * 0.8 + endGlow), transform: `scale(${0.6 + 0.5 * pulse})` });
      set(R.leakB, { left: (cx - 200) + 'px', top: (cy + 200) + 'px', background: 'radial-gradient(closest-side, rgba(255,201,168,.6), rgba(255,201,168,0))', opacity: clamp(pulse * 0.5 + (b < 3 ? 0.35 * (1 - P(b, 0, 3)) : 0)) });
      const hits = [[0, 300, 1.2], [8, 520, 0.9], [32, 540, 1.3], [36, 600, 1.1], [56, 420, 1.4]];
      let so = 0, sy = 540;
      for (const [hb, y, d] of hits) if (b >= hb && b < hb + d) { so = Math.sin(P(b, hb, hb + d) * Math.PI); sy = y; }
      set(R.streakA, { top: sy + 'px', opacity: so * 0.85, transform: `scaleX(${0.6 + 0.4 * so})` });
    }

    /* ---------- HUD: sun/moon arc + clock ---------- */
    {
      let i = 0; while (i < CLK.length - 1 && b >= CLK[i + 1][0]) i++;
      const [cb, label] = CLK[i], prev = i > 0 ? CLK[i - 1][1] : label;
      const p = E.outExpo(P(b, cb, cb + 0.6));
      const m = lerp(mins(prev), mins(label), p);
      // sun until sunset (the drop), then the moon
      const sunset = E.inOut(P(b, DROP, DROP + 1.2)), moonrise = E.inOut(P(b, DROP + 0.5, DROP + 1.8));
      const su = b < DROP ? sunU(m) : 1, mu = b < DROP ? 0 : moonU(m);
      const sp = R.arcPath.getPointAtLength(ARCLEN * su), mp = R.arcPath.getPointAtLength(ARCLEN * mu);
      set(R.sun, { left: sp.x + 'px', top: (sp.y + 28 * sunset) + 'px', opacity: 1 - sunset, transform: `scale(${1 + 0.4 * (b < DROP ? 0 : sunset)})` });
      set(R.moon, { left: mp.x + 'px', top: (mp.y + 28 * (1 - moonrise)) + 'px', opacity: moonrise });
      R.arcDone.setAttribute('stroke-dasharray', `${ARCLEN * (b < DROP + 0.5 ? su : mu)} 9999`);
      R.arcDone.style.opacity = b < DROP ? 1 : moonrise;
      const night = P(b, 30.9, 31.4), endP = P(b, 55.8, 56.6);
      const col = rgba(mix([11, 11, 18, 1], [255, 255, 255, 1], night));
      R.clock.style.color = col; R.clock.style.opacity = 1 - endP;
      $('#arc line').setAttribute('stroke', night > 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(11,11,18,.25)');
      // rolling digits on each jump
      const rp = E.outExpo(P(b, cb, cb + 0.35));
      if (R.ctB.textContent !== label) R.ctB.textContent = label;
      if (R.ctA.textContent !== prev) R.ctA.textContent = prev;
      R.ctA.style.transform = `translateY(${-100 * rp}%)`; R.ctB.style.transform = `translateY(${100 * (1 - rp)}%)`; R.ctA.style.opacity = i === 0 ? 0 : 1 - rp;
      let li = 0; while (li < LBLB.length - 1 && b >= LBLB[li + 1]) li++;
      const lb0 = LBLB[li], lp = E.outExpo(P(b, lb0, lb0 + 0.35));
      R.lblB.textContent = LBL[lb0]; R.lblA.textContent = li ? LBL[LBLB[li - 1]] : '';
      R.lblA.style.transform = `translateY(${-110 * lp}%)`; R.lblB.style.transform = `translateY(${110 * (1 - lp)}%)`; R.lblA.style.opacity = 1 - lp;
      R.sbTime.textContent = label.replace(/ (AM|PM)/, '');
      R.hud.style.zIndex = b >= 56 ? 75 : 60;
      $('#arc').style.opacity = b >= 56 ? lerp(1, 0.7, P(b, 56, 57)) : 1;
    }

    /* ---------- end card (final downbeat b56) ---------- */
    {
      const fl = Math.max(b < 1 ? 1 - E.outCubic(P(b, 0, 0.9)) : 0, E.inCubic(P(b, 55.4, 55.95)) * (1 - E.outCubic(P(b, 56.0, 56.8))));
      R.flash.style.background = b < 1 ? '#000' : '#fff'; R.flash.style.opacity = fl;
      const on = b >= 55.9; R.endcard.style.visibility = on ? 'visible' : 'hidden';
      if (on) {
        const rise = E.outExpo(P(b, 56, 57.4));
        set(R.endCity, { opacity: 0.42, transform: `translateY(${(1 - E.outCubic(P(b, 56, 58))) * 40}px)` });
        set(R.wordmark, { top: (300 + 90 * (1 - rise)) + 'px', opacity: E.outCubic(P(b, 56, 56.4)), transform: `translateX(-50%) scale(${0.9 + 0.1 * rise})`,
          filter: `blur(${(1 - E.outCubic(P(b, 56, 56.8))) * 14}px)`, textShadow: `0 0 ${40 + 70 * (1 - P(b, 56, 58.5))}px rgba(255,255,255,${0.35 + 0.5 * (1 - P(b, 56, 58.5))})` });
        set(R.tagline, { top: '548px' }); reveal(R.tagSpan, b, 57, 999, 0.8);
        set(R.cta, { top: '640px', textShadow: `0 0 ${24 + 30 * (1 - P(b, 58, 59.5))}px rgba(255,255,255,${0.3 + 0.35 * (1 - P(b, 58, 59.5))})` });
        R.ctaSpans.forEach((s, j) => reveal(s, b, 58 + j * 0.5, 999, 0.75));
      }
      R.letterbox.style.opacity = 1 - P(b, 56, 57);
      R.vignette.style.opacity = b >= 56 ? 0.4 : lerp(0.7, 1, n);
    }

    /* ---------- grain ---------- */
    const fi = frozen ? 0 : Math.floor(t * 60), nz = NOISE[fi % 8], ox = (fi * 137) % 540, oy = (fi * 251) % 540;
    gctx.drawImage(nz, -ox, -oy); gctx.drawImage(nz, 540 - ox, -oy); gctx.drawImage(nz, -ox, 540 - oy); gctx.drawImage(nz, 540 - ox, 540 - oy);
    grain.style.opacity = 0.32 + 0.12 * n;
  }

  /* ---------------------------------------------------------------- boot */
  window.renderFrame = render; window.DURATION = DUR;
  for (const tw of [0, 3, 7, 9, 13, 17, 20, 23, 26, 29, 31.5, 33, 37, 41, 45, 50, 57, 62]) render(tw * BEAT);
  render(0); window.__ready = true;
  if (!RENDER) {
    const aud = $('#aud'), pp = $('#pp'), scrub = $('#scrub'), tc = $('#tc'); scrub.max = DUR; let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (aud.currentTime >= DUR - 0.05) aud.currentTime = 0; aud.play(); } else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; render(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; render(t); scrub.value = t; tc.textContent = t.toFixed(2) + 's'; if (t >= DUR) { playing = false; pp.textContent = 'Play'; } } requestAnimationFrame(loop); };
    loop();
  }
})();
