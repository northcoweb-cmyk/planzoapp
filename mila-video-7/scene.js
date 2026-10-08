/* Mila film #7 — "Close Every Tab".
 * render(t) is a pure function of time; cues are beats b of "Money Talks" (0.4602 s).
 * App switcher piles up b0-12 (freeze on the song's silent beat b7) · every app swiped away b12-15.5 ·
 * DROP: only Mila is left and opens b16 · Leads/Calendar/Emails/Follow-ups/Posts/Approvals b16-28 ·
 * "12 apps." -> "One app." b28-32 · end b32 · loop tail b39-40 back to the exact frame-0 switcher.
 */
(async function () {
  const TL = await (await fetch('timeline.json')).json();
  const BEAT = TL.beat, DUR = TL.duration, TOT = TL.totalBeats;
  const qs = new URLSearchParams(location.search);
  const RENDER = qs.has('render');
  const FORMAT = qs.get('format') || 'square';
  const HOOK = qs.get('hook') || '12 apps to sell one house.';
  if (RENDER) document.body.classList.add('render');
  const SIZES = { square: [1080, 1080, 1], feed: [1080, 1350, 1.04], portrait: [1080, 1920, 1.1] };
  const [W, H, SK] = SIZES[FORMAT] || SIZES.square;
  const vp = document.getElementById('viewport');
  vp.style.width = W + 'px'; vp.style.height = H + 'px';
  document.getElementById('stage').style.transform = `scale(${SK})`;
  if (!RENDER) { const fit = () => { const k = Math.min(innerWidth / W, (innerHeight - 60) / H); vp.style.transformOrigin = '0 0'; vp.style.transform = `translate(${(innerWidth - W * k) / 2}px,0) scale(${k})`; }; fit(); addEventListener('resize', fit); }

  /* ---------------------------------------------------------------- helpers */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, p) => a + (b - a) * p, P = (x, x0, x1) => clamp((x - x0) / (x1 - x0));
  const E = {
    outExpo: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)), inExpo: p => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10)),
    inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2), outCubic: p => 1 - Math.pow(1 - p, 3), inCubic: p => p * p * p,
    outBack: p => { const c = 1.6; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    spring: p => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-6.2 * p) * Math.cos(9.5 * p)),
  };
  const TAU = Math.PI * 2, per = (b, k) => Math.sin(TAU * k * b / TOT), perc = (b, k) => Math.cos(TAU * k * b / TOT);
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const set = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const vis = (el, on) => { el.style.visibility = on ? 'inherit' : 'hidden'; };
  const pulseAt = (b, T, k = 8) => (b >= T ? Math.exp(-(b - T) * k) : 0);

  const I = {
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.6"/><path d="m3.6 6.6 8.4 6.4 8.4-6.4"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    msg: '<path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-5.5 4v-4h0a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.5"/><path d="M15.5 14.3c2.6-.4 4.4 1.2 5 4.2"/>',
    note: '<path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M9 11h6.5M9 14.5h6.5M9 18h4"/>',
    doc: '<path d="M6.5 3h8l4 4v14h-12z"/><path d="M14 3v4.5h4.5M9 12h6M9 15.5h6"/>',
    brush: '<path d="M14.5 4.5l5 5-8.5 8.5-5-5z"/><path d="M6 13l-2.5 7.5L11 18"/>',
    home: '<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
    grid: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M3.5 15h17M9.5 4v16M15 4v16"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.3 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.3-3.8-8.5S9.4 5.9 12 3.5z"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    pen: '<path d="M4 20h16"/><path d="M14.5 4.5l4 4L9 18H5v-4z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  };
  const svg = (n, s = 22, w = 1.9, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;
  const ICOL = { mail: '#4f7cff', cal: '#e5534b', msg: '#2fb36d', users: '#f08c2e', note: '#e9b730', doc: '#3d6df2', brush: '#9b5cf6', home: '#14a3a3', grid: '#22a55b', globe: '#5a6170', heart: '#e2468a', pen: '#3b4a6b' };
  $('#sbIcons').innerHTML = '<svg width="18" height="12" viewBox="0 0 18 12" fill="#fff"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="rgba(255,255,255,.5)"/><rect x="2" y="2" width="17" height="9" rx="2" fill="#fff"/></svg>';
  const CHK = '<svg viewBox="0 0 22 22" width="22" height="22"><circle cx="11" cy="11" r="9.6" fill="none" stroke="rgba(255,255,255,.38)" stroke-width="1.4"/><circle class="f" cx="11" cy="11" r="10" fill="#fff" opacity="0"/><path class="p" d="M6.4 11.4l3.1 3.1 6.2-6.6" fill="none" stroke="#0b0b12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="16" stroke-dashoffset="16"/></svg>';
  $$('.chk').forEach(el => (el.innerHTML = CHK));
  function setChk(el, p) { const f = el.querySelector('.f'); f.setAttribute('opacity', clamp(p * 2.5)); f.setAttribute('r', 10 * (0.6 + 0.4 * E.outBack(clamp(p * 2.5)))); el.querySelector('.p').setAttribute('stroke-dashoffset', 16 * (1 - E.outCubic(clamp((p - 0.25) / 0.75)))); }
  $('#aiCal').innerHTML = svg('cal', 22, 2); $('#aiMail').innerHTML = svg('mail', 22, 2);
  $$('#sApprove .bt').forEach(b => b.insertAdjacentHTML('beforeend', svg('check', 20, 2.8, '#0b0b12')));

  /* ---------------------------------------------------------------- app cards (generic UI, no real products) */
  const lines = n => Array.from({ length: n }, (_, i) => `<div class="ln" style="width:${[92, 78, 85, 64, 88, 70, 80][i % 7]}%"></div>`).join('');
  const BODY = {
    mail: () => [['Jordan Ellis', 'Re: still available?'], ['Title company', 'Docs needed by 5'], ['Priya Shah', 'Saturday showing?'], ['Lender', 'Pre-approval update'], ['Marcus Lee', 'HOA question'], ['Seller · Kim', 'Any feedback yet?'], ['Dana Ortiz', 'Call me back pls']]
      .map(([a, s]) => `<div class="r"><i></i><div><b>${a}</b><span>${s}</span></div></div>`).join(''),
    cal: () => { const r = rng(4); let h = ''; for (let i = 0; i < 9; i++) { const c = ['rgba(143,180,255,.5)', 'rgba(166,140,255,.5)', 'rgba(255,201,168,.75)'][i % 3]; h += `<div class="bl" style="left:${(i % 3) * 33 + 1}%;top:${10 + Math.floor(r() * 12) * 38}px;width:31%;height:${54 + Math.floor(r() * 2) * 30}px;background:${c}">Showing</div>`; } return `<div style="position:relative;height:500px">${h}</div>`; },
    msg: () => ['still on for Sunday?', 'can we see it today??', 'lockbox code?', 'any update on the offer', 'call me back pls'].map((m, i) => `<div class="bb" style="background:${i % 2 ? '#2fb36d' : '#eceef2'};color:${i % 2 ? '#fff' : '#22252d'};margin-left:${i % 2 ? 'auto' : '0'}">${m}</div>`).join(''),
    users: () => [['Jordan Ellis', 'Hot'], ['Priya Shah', 'New'], ['Marcus Lee', 'Nurture'], ['Dana Ortiz', 'Hot'], ['Ray Brooks', 'New'], ['Kim Walsh', 'Client']].map(([a, s]) => `<div class="r"><div style="flex:1"><b>${a}</b><span>Last contact 6d ago</span></div><span style="color:#f08c2e;font-weight:700">${s}</span></div>`).join(''),
    note: () => `<div style="font:500 17px/1.7 var(--sans);color:#5a4a1a">lockbox 4417??<br>call Dana back!!<br>flyers for Sunday<br>sign-in sheet<br>send Kim the comps<br>HOA docs → Marcus<br>post the listing</div>`,
    doc: () => `<div style="font:700 16px/1.2 var(--sans);margin:10px 0">Listing description v7 (final) (2)</div>` + lines(14),
    brush: () => `<div class="ph" style="height:250px;background-image:url(assets/photos/tampa_rockpool.jpg)"></div><div style="font:800 26px/1 var(--sans);letter-spacing:.06em;margin:16px 0 6px">JUST LISTED</div>` + lines(4),
    home: () => `<div class="ph" style="height:200px;background-image:url(assets/photos/sarasota_bridgepool.jpg)"></div><div style="font:700 22px/1.2 var(--sans);margin-top:12px">$1,890,000</div><div style="color:#8a8f9c">1207 Sea Grape Ln · Sarasota</div>` + lines(5),
    grid: () => `<div style="display:grid;grid-template-columns:1.4fr 1fr 1fr">${Array.from({ length: 45 }, (_, i) => `<div class="cell">${['Lead', 'Source', 'Stage'][i % 3] && i < 3 ? ['Lead', 'Source', 'Stage'][i] : ['J. Ellis', 'Open hs', 'Hot', 'P. Shah', 'Referral', 'New', 'M. Lee', 'Social', '??'][i % 9]}</div>`).join('')}</div>`,
    globe: () => `<div style="display:flex;gap:4px;margin:6px 0 12px">${Array.from({ length: 7 }, () => '<div style="flex:1;height:26px;border-radius:6px;background:#e4e6ea"></div>').join('')}<div style="height:26px;padding:0 8px;border-radius:6px;background:#22252d;color:#fff;font:700 12px/26px var(--sans)">47</div></div>` + lines(16),
    heart: () => `<div class="ph" style="height:300px;background-image:url(assets/photos/beach_boardwalk.jpg)"></div><div style="font:600 13px/1.5 var(--sans);margin-top:10px">♡ 12 · 3 comments</div>` + lines(4),
    pen: () => `<div style="font:700 15px/1.2 var(--sans);margin:10px 0">Purchase agreement</div>` + lines(11) + `<div style="margin-top:22px;border-bottom:2px solid #3b4a6b;width:70%;font:italic 400 13px/1 var(--sans);color:#8a8f9c;padding-bottom:6px">Sign here ✕</div>`,
  };
  const CARDS = [];
  const mkCard = (name, ic, badge, at, mila) => {
    const el = document.createElement('div'); el.className = 'appc';
    const icon = mila ? `<div class="ico" style="background:radial-gradient(circle at 50% 30%,#2a2d45,#07070b 75%);font:400 25px/1 var(--serif)">M</div>` : `<div class="ico" style="background:${ICOL[ic]}">${svg(ic, 22, 2)}${badge ? `<span class="bd">${badge}</span>` : ''}</div>`;
    const inner = mila ? `<div class="milaPrev"><div style="position:absolute;left:0;right:0;top:170px;text-align:center;font:400 86px/1 var(--serif);letter-spacing:-.02em">Mila</div><div style="position:absolute;left:24px;right:24px;top:300px;height:62px;border-radius:31px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.18);font:400 15px/62px var(--sans);color:rgba(255,255,255,.5);padding-left:22px">What do you need to get done?</div></div>`
      : `<div class="ab">${name}</div><div class="ac">${BODY[ic]()}</div>`;
    el.innerHTML = `<div class="lab">${icon}${name}</div><div class="card">${inner}<div class="shade"></div></div>`;
    $('#switcher').appendChild(el);
    CARDS.push({ el, at, mila, shade: el.querySelector('.shade') });
  };
  mkCard('Mila', null, 0, -1, true);
  TL.apps.forEach(([n, ic, bd, at]) => mkCard(n, ic, bd, at, false));
  // swipe order: newest first, Mila (index 0) is never swiped
  CARDS.slice(1).reverse().forEach((c, i) => (c.sw = TL.swipes[i]));

  /* ---------------------------------------------------------------- flying icons (absorbed into Mila) + the ring of 12 */
  const ABSORB = [[16, ['users']], [18, ['cal']], [20, ['mail']], [22, ['msg']], [24, ['brush', 'heart']], [26, ['pen', 'doc', 'note']]];
  const FLY = [];
  ABSORB.forEach(([f, ics]) => ics.forEach((ic, j) => {
    const el = document.createElement('div'); el.className = 'fly'; el.style.background = ICOL[ic]; el.innerHTML = svg(ic, 40, 2);
    $('#flys').appendChild(el); FLY.push({ el, f: f - 0.15 * j, y0: 300 + j * 240, kind: 'absorb' });
  }));
  const RING = TL.apps.map(([, ic], i) => {
    const el = document.createElement('div'); el.className = 'fly'; el.style.background = ICOL[ic]; el.innerHTML = svg(ic, 40, 2);
    $('#flys').appendChild(el); const a = -Math.PI / 2 + i / 12 * TAU; return { el, ax: 540 + Math.cos(a) * 330, ay: 560 + Math.sin(a) * 300, at: 28.1 + i * 0.09, sp: 2.2 + (i % 3) * 0.4 };
  });

  /* ---------------------------------------------------------------- world carousel (Posts) */
  $('#fan').innerHTML = `
    <div class="slide"><div class="photo" style="background-image:url(assets/photos/hero_waterfront.jpg)"></div><div class="gr"></div><div class="tx"><div class="k">Just listed</div><div class="a">48 Coral Palm Way</div><div class="c">Naples, FL 34102</div></div></div>
    <div class="slide"><div class="photo" style="background-image:url(assets/photos/hero_waterfront.jpg);background-size:240%;background-position:70% 40%"></div><div class="dim"></div><div class="k" style="position:absolute;left:18px;top:18px;font:600 9.5px/1 var(--sans);letter-spacing:.22em">OFFERED AT</div><div class="price">$2,450,000</div>
      <div class="grid"><div class="cell"><b>4</b><span>Beds</span></div><div class="cell"><b>4.5</b><span>Baths</span></div><div class="cell"><b>3,860</b><span>Sq ft</span></div><div class="cell"><b>Dock</b><span>Waterfront</span></div></div></div>
    <div class="slide"><div class="photo" style="background-image:url(assets/photos/hero_waterfront.jpg);background-size:220%;background-position:30% 70%"></div><div class="cta"><div class="k">Open house</div><div class="big">Sunday</div><div class="tm">3–5 PM · Naples</div></div></div>`;
  const SLIDES = $$('#fan .slide');

  /* ---------------------------------------------------------------- type */
  const WORDS = [
    { l: [HOOK], at: [-9], out: 11.6, x: 540, y: 112, fs: 84, w: 960, center: true, hook: true },
    { l: ['Close every tab.'], at: [12.0], out: 15.55, x: 540, y: 112, fs: 96, w: 960, center: true },
    { l: ['Leads.'], at: [16.45], out: 17.7, x: 620, y: 540, fs: 124, w: 400 },
    { l: ['Calendar.'], at: [18.1], out: 19.7, x: 620, y: 540, fs: 124, w: 400 },
    { l: ['Emails.'], at: [20.1], out: 21.7, x: 620, y: 540, fs: 124, w: 400 },
    { l: ['Follow-ups.'], at: [22.1], out: 23.7, x: 620, y: 540, fs: 124, w: 400 },
    { l: ['Posts.'], at: [24.1], out: 25.7, x: 600, y: 250, fs: 124, w: 400 },
    { l: ['Approvals.'], at: [26.1], out: 27.75, x: 620, y: 540, fs: 124, w: 400 },
    { l: ['12 apps.'], at: [28.2], out: 29.75, x: 540, y: 150, fs: 130, w: 800, center: true },
    { l: ['One app.'], at: [30.05], out: 31.75, x: 540, y: 150, fs: 130, w: 800, center: true },
  ];
  WORDS.forEach(w => {
    const el = document.createElement('div'); el.className = 'kw';
    el.innerHTML = w.l.map(t => `<div class="ln"><span>${t}</span></div>`).join('');
    set(el, { left: w.x + 'px', top: w.y + 'px', fontSize: w.fs + 'px', transform: w.center ? 'translate(-50%,-50%)' : 'translate(0,-50%)', textAlign: w.center ? 'center' : 'left' });
    $('#words').appendChild(el); w.el = el; w.spans = $$('.ln > span', el);
  });

  /* ---------------------------------------------------------------- assets */
  await document.fonts.load('400 40px "Instrument Serif"'); await document.fonts.load('italic 40px "Instrument Serif"'); await document.fonts.load('600 16px "Inter"'); await document.fonts.ready;
  await Promise.all(['hero_waterfront', 'sarasota_bridgepool', 'beach_boardwalk', 'tampa_rockpool'].map(n => new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = `assets/photos/${n}.jpg`; })));
  WORDS.forEach(w => { const wd = w.el.offsetWidth; if (wd > w.w) w.el.style.fontSize = (w.fs * w.w / wd) + 'px'; });

  /* ---------------------------------------------------------------- refs */
  const R = {
    cam: $('#cam'), grey: $('#greyBg'), switcher: $('#switcher'), appsOpen: $('#appsOpen'), rig: $('#rig'), fan: $('#fan'), flys: $('#flys'), milaIcon: $('#milaIcon'),
    endc: $('#endc'), wordmark: $('#wordmark'), tagline: $('#tagline'), tagSpan: $('#tagline .ln > span'), cta: $('#cta'), ctaSpans: $$('#cta .ln > span'),
    flash: $('#flash'), redTint: $('#redTint'), gA: $('#gA'), gB: $('#gB'), gC: $('#gC'),
    chips: $$('#sLeads .chip'), leads: $$('#sLeads .lead'), evcs: $$('#sCal .evc'), emailBody: $('#emailBody'), sig: $('#sig'), tcs: $$('#sTexts .tc'), tqs: $$('#sTexts .q'), cTrack: $('#cTrack'),
    aprs: $$('#sApprove .apr'),
  };
  const SCR = { sLeads: [15.9, 18], sCal: [18, 20], sEmail: [20, 22], sTexts: [22, 24], sContent: [24, 26], sApprove: [26, 28.6] };
  for (const k in SCR) SCR[k] = { el: document.getElementById(k), r: SCR[k] };
  const EMAIL = 'Hi there,\n\nJust listed: 48 Coral Palm Way, a 4-bed Naples waterfront home with a private dock.\n\nOpen house Sunday 3–5 PM!';
  const grain = $('#grain'), gctx = grain.getContext('2d'), NOISE = [];
  { const r = rng(99); for (let k = 0; k < 8; k++) { const c = document.createElement('canvas'); c.width = c.height = 540; const x = c.getContext('2d'), id = x.createImageData(540, 540); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 110; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); NOISE.push(c); } }
  const stars = $('#stars'), sctx = stars.getContext('2d');
  const STARS = (() => { const r = rng(5); return Array.from({ length: 140 }, () => ({ x: r() * 780, y: r() * 1688, s: 0.6 + r() * 1.6, a: 0.25 + r() * 0.6, ph: r() * 6.28, sp: 0.5 + r() * 2 })); })();
  const reveal = (span, b, b0, outB = 999, dur = 0.8) => { const p = E.outExpo(P(b, b0, b0 + dur)), q = E.inCubic(P(b, outB, outB + 0.35)); span.style.transform = `translateY(${(1 - p) * 112 - q * 112}%)`; span.style.opacity = p > 0 ? 1 : 0; span.style.filter = (p < 1 || q > 0) ? `blur(${(1 - p) * 6 + q * 6}px)` : 'none'; };
  const PHONE_X = -190;

  /* ================================================================ RENDER */
  function render(t) {
    const raw = t / BEAT, b = raw;
    const tail = raw >= 39;
    const tailIn = E.inOut(P(raw, 39.15, 39.85));
    const sb = tail ? 0 : (b >= 7 && b < 8 ? 7 : b);          // switcher time: holds on the song's silent beat

    /* camera */
    let cx = per(raw, 3) * 3, cy = per(raw, 2) * 2, cs = 1 + 0.004 * per(raw, 2), cr = 0;
    if (b < 16 && !(b >= 7 && b < 8)) { const a = 0.3 + 7 * Math.pow(Math.min(b, 12) / 12, 2); const hit = TL.apps.reduce((s, x) => s + (x[3] >= 0 ? pulseAt(b, x[3], 7) : 0), 0) * 6;
      cx += Math.sin(b * 37) * (a + hit); cy += Math.sin(b * 29 + 1) * (a + hit) * 0.8; cr = Math.sin(b * 23) * a * 0.03; }
    for (const T of [16, ...TL.feats.slice(1), 28, 30, 32]) { const d = pulseAt(b, T, 8); cy += 5 * d; cs *= 1 + (T === 16 || T === 30 || T === 32 ? 0.035 : 0.01) * d; }
    R.cam.style.transform = `translate(${cx}px,${cy}px) rotate(${cr}deg) scale(${cs})`;

    /* worlds: grey stress world -> white Mila world on the drop -> grey again in the loop tail */
    const greyO = tail ? tailIn : 1 - P(b, 15.85, 16.05);
    R.grey.style.opacity = greyO; vis(R.grey, greyO > 0.001);
    const W2 = W / 2, H2 = H / 2, glow = 0.45 + 0.45 * (pulseAt(b, 16, 2) + pulseAt(b, 30, 2) + pulseAt(b, 32, 2));
    set(R.gA, { left: (W2 - 300 + per(raw, 2) * 160) + 'px', top: (H2 - 260 + perc(raw, 1) * 120) + 'px', opacity: glow });
    set(R.gB, { left: (W2 + 320 + perc(raw, 2) * 140) + 'px', top: (H2 + 60 + per(raw, 1) * 140) + 'px', opacity: glow * 0.9 });
    set(R.gC, { left: (W2 + per(raw, 1) * 200) + 'px', top: (H2 + 360) + 'px', opacity: glow * 0.85 });

    /* ---------- app switcher (b0-16, and the tail) ---------- */
    const swOn = b < 16.6 || raw >= 39.15; vis(R.switcher, swOn); vis(R.appsOpen, swOn);
    if (swOn) {
      const pres = CARDS.map(c => (c.at < 0 ? 1 : E.spring(P(sb, c.at, c.at + 0.5))) * (c.sw !== undefined ? 1 - E.outCubic(P(sb, c.sw, c.sw + 0.3)) : 1));
      const open = CARDS.slice(1).filter((c, i) => sb >= c.at && !(c.sw !== undefined && sb >= c.sw + 0.12)).length;
      CARDS.forEach((c, i) => {
        const shown = c.at < 0 || sb >= c.at, gone = c.sw !== undefined && sb >= c.sw + 0.45;
        vis(c.el, shown && !gone); if (!shown || gone) return;
        let r = 0; for (let j = i + 1; j < CARDS.length; j++) if (CARDS[j].at < 0 || sb >= CARDS[j].at) r += pres[j];   // depth = cards in front of this one
        const enter = c.at < 0 ? 1 : E.spring(P(sb, c.at, c.at + 0.5));
        const sw = c.sw !== undefined ? E.inCubic(P(sb, c.sw, c.sw + 0.4)) : 0;
        let x = 620 - 185 * r / (1 + 0.1 * r) + (1 - enter) * 520, y = 600 + r * 6 - sw * 1100, s = Math.max(0.62, 1 - 0.045 * r) * (1 - 0.15 * sw);
        // only Mila left: it slides to centre and opens on the drop
        if (c.mila) { const bb = tail ? 0 : b, ctr = E.inOut(P(bb, 15.55, 15.95)); x = lerp(x, 540, ctr); y = lerp(y, 560, ctr); const open2 = E.inExpo(P(bb, 15.9, 16.3)); s *= 1 + 0.35 * open2;
          c.el.style.opacity = tail ? tailIn : 1 - P(b, 16.05, 16.3); } else c.el.style.opacity = tail ? tailIn : clamp(enter * 3);
        set(c.el, { transform: `translate(${x}px,${y}px) rotate(${sw * -8 + Math.sin(sb * 3 + i) * 0.4 * (1 - sw)}deg) scale(${s})`, zIndex: i });
        c.shade.style.opacity = clamp(r * 0.07, 0, 0.5);
      });
      const n = tail ? 3 : open;
      R.appsOpen.textContent = n === 0 ? 'Only Mila open' : n === 1 ? '1 app open' : `${n} apps open`;
      const one = !tail && n === 0, bump = Math.max(0, ...[...TL.apps.map(a => a[3]), ...TL.swipes].map(x => (sb >= x && sb < x + 0.25) ? Math.sin(P(sb, x, x + 0.25) * Math.PI) : 0));
      set(R.appsOpen, { transform: `translate(-50%,962px) scale(${1 + 0.12 * bump})`, background: one ? 'linear-gradient(135deg,#8fb4ff,#a68cff 55%,#ffc9a8)' : '#e5342b', color: one ? '#0b0b12' : '#fff', opacity: tail ? tailIn : 1 - P(b, 15.8, 16.05) });
    }
    const red = b < 12 ? [5.5, 6.5, 10.5].reduce((s, T) => s + pulseAt(sb, T, 5), 0) : 0; R.redTint.style.opacity = clamp(red * 0.45); vis(R.redTint, red > 0.01);

    /* ---------- the Mila phone (b16-28.6) ---------- */
    let rig = null;
    if (b >= 15.95 && b < 28.6) {
      const a = E.outExpo(P(b, 16, 16.6)), out = E.inCubic(P(b, 28, 28.5));
      let punch = 0; for (const T of TL.feats.slice(1)) if (b >= T) punch = Math.max(punch, 0.03 * Math.exp(-(b - T) * 6));
      rig = { x: lerp(0, PHONE_X, E.inOut(P(b, 16.1, 16.7))), y: lerp(20, 8, a), s: lerp(0.8, 1, a) * (1 + punch) * (1 - 0.75 * out), o: clamp(P(b, 15.95, 16.15) * 5) * (1 - P(b, 28.3, 28.5)) };
      rig.x = lerp(rig.x, 0, out);
    }
    vis(R.rig, !!rig);
    if (rig) {
      set(R.rig, { transform: `perspective(2000px) translate(${rig.x}px,${rig.y}px) scale(${rig.s}) rotateY(${6 * (rig.x / PHONE_X)}deg)`, opacity: rig.o });
      sctx.clearRect(0, 0, 780, 1688); for (const s of STARS) { sctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(b * s.sp + s.ph)); sctx.fillStyle = '#fff'; sctx.beginPath(); sctx.arc(s.x, (s.y + b * 4 * s.sp) % 1688, s.s, 0, 6.283); sctx.fill(); }
    }
    let cur = null; for (const k in SCR) { const on = !!rig && b >= SCR[k].r[0] && b < SCR[k].r[1]; vis(SCR[k].el, on); if (on) cur = k; }
    if (cur) { const z = E.outExpo(P(b, SCR[cur].r[0], SCR[cur].r[0] + 0.4)); set(SCR[cur].el, { transform: `scale(${lerp(0.88, 1, z)})`, opacity: clamp(z * 1.6) }); }
    if (rig) {
      R.leads.forEach((el, i) => { const p = E.spring(P(b, 16.2 + i * 0.25, 16.8 + i * 0.25)); set(el, { opacity: clamp(p * 2), transform: `translateY(${(1 - p) * 30}px)` }); });
      R.chips.forEach((el, i) => { const p = E.outBack(P(b, 16.9 + i * 0.3, 17.2 + i * 0.3)); set(el, { opacity: clamp(p * 2), transform: `scale(${0.6 + 0.4 * p})` }); });
      R.evcs.forEach((el, i) => { const p = E.spring(P(b, 18.1 + i * 0.25, 18.7 + i * 0.25)); set(el, { opacity: clamp(p * 2), transform: `translateX(${(1 - p) * 60}px)` }); setChk(el.querySelector('.chk'), P(b, 18.8 + i * 0.3, 19.1 + i * 0.3)); });
      const ne = Math.floor(EMAIL.length * P(b, 20.2, 21.5));
      R.emailBody.innerHTML = EMAIL.slice(0, ne) + (b < 21.6 ? '<span class="ecaret"></span>' : '');
      R.sig.style.opacity = E.outCubic(P(b, 21.5, 21.7));
      R.tcs.forEach((el, i) => { const p = E.spring(P(b, 22.1 + i * 0.3, 22.7 + i * 0.3)); set(el, { opacity: clamp(p * 2), transform: `translateY(${(1 - p) * 40}px)` }); });
      R.tqs.forEach((el, i) => { const p = E.outBack(P(b, 23.2 + i * 0.1, 23.45 + i * 0.1)); set(el, { opacity: clamp(p * 2), transform: `scale(${0.6 + 0.4 * p})` }); });
      R.cTrack.style.backgroundPosition = `${40 + 20 * P(b, 24, 26)}% 50%`;
      R.aprs.forEach((el, i) => {
        const p = E.spring(P(b, 26.05 + i * 0.12, 26.6 + i * 0.12)), T = 26.5 + i * 0.5, fill = E.outCubic(P(b, T, T + 0.12));
        set(el, { opacity: clamp(p * 2), transform: `translateY(${(1 - p) * 30}px)` });
        const bt = el.querySelector('.bt'); set(bt, { background: fill > 0 ? `linear-gradient(135deg, rgba(143,180,255,${fill}), rgba(166,140,255,${fill}))` : 'transparent', borderColor: fill > 0.5 ? 'transparent' : 'rgba(255,255,255,.3)', boxShadow: fill > 0 ? `0 0 ${30 * (1 - P(b, T, T + 0.8))}px rgba(166,140,255,.95)` : 'none', transform: `scale(${b >= T && b < T + 0.2 ? 1 - 0.1 * Math.sin(P(b, T, T + 0.2) * Math.PI) : 1})` });
        bt.querySelector('.lbl').style.opacity = 1 - fill; const ck = bt.querySelector('svg'), pth = ck.querySelector('path'); pth.setAttribute('stroke-dasharray', 22); pth.setAttribute('stroke-dashoffset', 22 * (1 - E.outCubic(P(b, T + 0.02, T + 0.2)))); ck.style.opacity = fill;
      });
    }
    const fanOn = b >= 24.2 && b < 26.1; vis(R.fan, fanOn);
    if (fanOn) {
      const FAN = [[700, 620, -9], [800, 595, 0], [900, 620, 9]];
      SLIDES.forEach((el, i) => { const p = E.spring(P(b, 24.3 + i * 0.18, 25.1 + i * 0.18)), out = E.inCubic(P(b, 25.65, 26.05));
        set(el, { transform: `translate(${lerp(350, FAN[i][0], p) + out * 500}px,${lerp(540, FAN[i][1], p)}px) rotate(${lerp(0, FAN[i][2], p)}deg) scale(${lerp(0.5, 1, p)})`, opacity: clamp(p * 2) * (1 - out), zIndex: i === 1 ? 3 : 2 }); });
    }

    /* ---------- icons: absorbed into the phone (b15.4-26), then the ring of 12 (b28-30) ---------- */
    const flyOn = (b >= 15.3 && b < 26.2) || (b >= 28 && b < 30.1); vis(R.flys, flyOn);
    if (flyOn) {
      FLY.forEach(f => {
        const on = b >= f.f - 0.6 && b < f.f + 0.05; vis(f.el, on); if (!on) return;
        const p = E.inCubic(P(b, f.f - 0.6, f.f)), x = lerp(1180, 350 + PHONE_X * 0 + 0, p), y = lerp(f.y0, 540, p);
        set(f.el, { transform: `translate(${x}px,${y}px) rotate(${(1 - p) * 30}deg) scale(${lerp(1.1, 0.15, p)})`, opacity: 1 - P(b, f.f - 0.08, f.f) });
      });
      RING.forEach(r => {
        const on = b >= r.at && b < 30.05; vis(r.el, on); if (!on) return;
        const a = E.spring(P(b, r.at, r.at + 0.5)), suck = E.inExpo(P(b, 29.3, 30));
        const ang = Math.atan2(r.ay - 560, r.ax - 540) + suck * r.sp, d = Math.hypot(r.ax - 540, r.ay - 560) * lerp(0.4, 1, a) * (1 - suck);
        set(r.el, { transform: `translate(${540 + Math.cos(ang) * d}px,${560 + Math.sin(ang) * d}px) scale(${lerp(0.3, 1, a) * (1 - 0.8 * suck)})`, opacity: clamp(a * 3) * (1 - P(b, 29.9, 30)) });
      });
    }
    // the absorb flash on the phone glass
    const absorbPulse = TL.feats.slice(0).reduce((s, f) => s + pulseAt(b, f, 6), 0);
    if (rig) R.rig.style.filter = absorbPulse > 0.02 ? `drop-shadow(0 0 ${40 * absorbPulse}px rgba(166,140,255,.9))` : 'none';

    /* ---------- the Mila icon (b28.3-32.6) ---------- */
    const icOn = b >= 28.25 && b < 32.7; vis(R.milaIcon, icOn);
    if (icOn) {
      const a = E.spring(P(b, 28.3, 28.9)), hit = pulseAt(b, 30, 4), out = E.inCubic(P(b, 31.7, 32.2));
      set(R.milaIcon, { transform: `translateY(${20 - 220 * out}px) scale(${lerp(0.4, 1, a) * (1 + 0.25 * hit) * (1 - 0.4 * out)})`, opacity: clamp(a * 3) * (1 - P(b, 32.0, 32.4)),
        boxShadow: `0 40px 80px -30px rgba(40,30,110,.6), 0 0 0 1.5px rgba(166,140,255,.5), 0 0 ${80 + 160 * hit}px rgba(166,140,255,${0.45 + 0.5 * hit})` });
    }

    /* ---------- type ---------- */
    for (const w of WORDS) {
      if (w.hook) {
        const on = b < 12 || raw >= 39.15; vis(w.el, on); if (!on) continue;
        const o = raw >= 39.15 ? tailIn : 1 - E.inCubic(P(b, 11.55, 11.95));
        set(w.el, { opacity: o, filter: o < 1 ? `blur(${(1 - o) * 8}px)` : 'none', textShadow: '0 0 40px rgba(255,255,255,.6)' });
        w.spans[0].style.transform = 'none'; w.spans[0].style.opacity = 1; w.spans[0].style.filter = 'none';
        continue;
      }
      const on = b >= w.at[0] - 0.05 && b < w.out + 0.4; vis(w.el, on); if (!on) continue;
      w.spans.forEach((s, j) => reveal(s, b, w.at[j], w.out));
      const g = 1 - P(b, w.at[0], w.at[0] + 1.6);
      w.el.style.textShadow = `0 0 ${30 + 40 * g}px rgba(166,140,255,${0.15 + 0.35 * g})`;
    }

    /* ---------- end card ---------- */
    const endOn = b >= 31.9 && raw < 39.9; vis(R.endc, endOn);
    if (endOn) {
      const rise = E.outExpo(P(b, 32, 33.6)), out = E.inOut(P(raw, 39.0, 39.6));
      set(R.endc, { opacity: 1 - out, filter: out > 0 ? `blur(${out * 12}px)` : 'none' });
      set(R.wordmark, { top: (280 + 90 * (1 - rise)) + 'px', opacity: E.outCubic(P(b, 32, 32.5)), transform: `translateX(-50%) scale(${0.9 + 0.1 * rise})`, filter: `blur(${(1 - E.outCubic(P(b, 32, 33))) * 14}px)`, textShadow: `0 0 ${50 + 70 * (1 - P(b, 32, 35))}px rgba(166,140,255,${0.35 + 0.35 * (1 - P(b, 32, 35))})` });
      set(R.tagline, { top: '548px', transform: 'translateX(-50%)' }); reveal(R.tagSpan, b, 33, 999, 1.0);
      set(R.cta, { top: '640px', transform: 'translateX(-50%)' }); R.ctaSpans.forEach((s, j) => reveal(s, b, 34 + j * 0.5, 999, 0.9));
    }

    /* flash on the drop */
    const fl = b >= 15.8 && b < 17 ? (b < 16 ? E.inCubic(P(b, 15.8, 16)) * 0.7 : 0.7 * Math.exp(-(b - 16) * 5)) : 0;
    R.flash.style.opacity = fl; vis(R.flash, fl > 0.002);

    const fi = Math.floor(t * 60), nz = NOISE[fi % 8], ox = (fi * 137) % 540, oy = (fi * 251) % 540;
    gctx.drawImage(nz, -ox, -oy); gctx.drawImage(nz, 540 - ox, -oy); gctx.drawImage(nz, -ox, 540 - oy); gctx.drawImage(nz, 540 - ox, 540 - oy);
    grain.style.opacity = b < 16 || tail ? 0.26 : 0.2;
  }

  /* ---------------------------------------------------------------- boot */
  window.renderFrame = render; window.DURATION = DUR;
  for (const tw of [0, 4, 9, 13, 15.7, 16.5, 18.5, 20.5, 22.5, 24.8, 26.8, 28.8, 30.5, 33, 36, 39.5, 39.95]) render(tw * BEAT);
  render(0); window.__ready = true;
  if (!RENDER) {
    const aud = $('#aud'), pp = $('#pp'), scrub = $('#scrub'), tc = $('#tc'); scrub.max = DUR; let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (aud.currentTime >= DUR - 0.05) aud.currentTime = 0; aud.play(); } else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; render(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; render(t); scrub.value = t; tc.textContent = t.toFixed(2) + 's'; if (t >= DUR) { playing = false; pp.textContent = 'Play'; } } requestAnimationFrame(loop); };
    loop();
  }
})();
