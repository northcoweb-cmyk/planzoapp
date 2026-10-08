/* Mila film #5 — "Maze to One Sentence" (Florida).
 * render(t) is a pure function of time; cues are grid units u (half-beats of "Kavkaz", 0.326 s).
 * Hook u0-4 · MAZE u4-24 · freeze/silence u24-26 · "Or." + one sentence u26-39 · COLLAPSE u40 ·
 * features u41-53 · approval stack u53 · DROP approvals u56 · "Already set up." u58 · whips u60 · end u64 · loop u70-72.
 * Loop: every ambient motion is periodic over 72 u and the tail rebuilds the exact frame-0 hook.
 */
(async function () {
  const TL = await (await fetch('timeline.json')).json();
  const U = TL.unit, DUR = TL.duration, TOT = TL.totalUnits;
  const qs = new URLSearchParams(location.search);
  const RENDER = qs.has('render');
  const FORMAT = qs.get('format') || 'square';
  const HOOK = qs.get('hook') || "I'll just set up my own AI agent.";
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
    linear: p => p, outExpo: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)), inExpo: p => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10)),
    inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2), outCubic: p => 1 - Math.pow(1 - p, 3), inCubic: p => p * p * p,
    outBack: p => { const c = 1.6; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    spring: p => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-6.2 * p) * Math.cos(9.5 * p)),
  };
  const TAU = Math.PI * 2, per = (u, k) => Math.sin(TAU * k * u / TOT), perc = (u, k) => Math.cos(TAU * k * u / TOT);   // loop-periodic
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const set = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const vis = (el, on) => { el.style.visibility = on ? 'inherit' : 'hidden'; };
  const pulseAt = (u, T, k = 8) => (u >= T ? Math.exp(-(u - T) * k) : 0);

  const I = {
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    msg: '<path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-5.5 4v-4h0a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.6"/><path d="m3.6 6.6 8.4 6.4 8.4-6.4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', plus: '<path d="M12 5.5v13M5.5 12h13"/>', arrow: '<path d="M12 18.5V5.5M6 11.5 12 5.5l6 6"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  };
  const svg = (n, s = 22, w = 1.8, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;
  $('#cPlus').innerHTML = svg('plus', 28, 1.8); $('#cMic').innerHTML = svg('mic', 30, 1.8); $('#cSend').innerHTML = svg('arrow', 30, 2.4);
  $('#sbIcons').innerHTML = '<svg width="18" height="12" viewBox="0 0 18 12" fill="#fff"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="rgba(255,255,255,.5)"/><rect x="2" y="2" width="17" height="9" rx="2" fill="#fff"/></svg>';
  const CHK = '<svg viewBox="0 0 22 22" width="22" height="22"><circle cx="11" cy="11" r="9.6" fill="none" stroke="rgba(255,255,255,.38)" stroke-width="1.4"/><circle class="f" cx="11" cy="11" r="10" fill="#fff" opacity="0"/><path class="p" d="M6.4 11.4l3.1 3.1 6.2-6.6" fill="none" stroke="#0b0b12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="16" stroke-dashoffset="16"/></svg>';
  $$('.chk').forEach(el => (el.innerHTML = CHK));
  function setChk(el, p) { const f = el.querySelector('.f'); f.setAttribute('opacity', clamp(p * 2.5)); f.setAttribute('r', 10 * (0.6 + 0.4 * E.outBack(clamp(p * 2.5)))); el.querySelector('.p').setAttribute('stroke-dashoffset', 16 * (1 - E.outCubic(clamp((p - 0.25) / 0.75)))); }

  /* ---------------------------------------------------------------- hook phone notifications (generic, no app marks) */
  const HN = [['New lead', 'Wants a showing Saturday', -2], ['Open house Sunday', 'Flyers not done yet', -1], ['Inbox', '23 unread emails', 1], ['Follow-ups overdue', '14 people from last week', 3]];
  const hIn = $('#hIn');
  const HNE = HN.map(([b, d, at]) => { const el = document.createElement('div'); el.className = 'hn'; el.innerHTML = `<b>${b}</b>${d}`; hIn.appendChild(el); return { el, at }; });
  $('#hookSpan').textContent = HOOK;

  /* ---------------------------------------------------------------- the maze: generic, invented setup UI (no logos, no URLs, no vendors) */
  const fld = t => `<div class="fld">${t}</div>`, btn = (t, g) => `<span class="btn${g ? ' g' : ''}">${t}</span>`;
  const rows = a => a.map(([l, r]) => `<div class="rw">${l}<em>${r}</em></div>`).join('');
  const WIN = {
    account: ['Setup', '<div class="h">Create your account</div>' + fld('Email address') + fld('••••••••••') + btn('Continue')],
    step4: ['Setup · Step 4 of 11', '<div class="h">Choose a model</div><div class="s">Not sure? See the docs.</div>' + rows([['Model A · fast', 'Select'], ['Model B · smart', 'Select']])],
    connector: ['Connectors', '<div class="h">Add a connector</div>' + rows([['Calendar', 'Connect'], ['Email', 'Connect'], ['Contacts', 'Connect']])],
    allow: ['Permissions', '<div class="h">Allow access?</div><div class="s">This agent wants to read, write and send on your behalf.</div>' + btn('Allow') + ' ' + btn('Deny', 1)],
    apikey: ['Keys', '<div class="h">Paste your API key</div>' + fld('key_••••••••••••••••••••') + btn('Save')],
    prompt: ['Instructions', '<div class="h">Write your system prompt</div><div class="ta">You are a helpful real estate<br>assistant. Always respond…<br>## TOOLS<br>- calendar.create(</div>'],
    calendar: ['Setup · Step 6 of 11', '<div class="h">Connect your calendar</div>' + fld('Paste calendar ID') + btn('Next')],
    email: ['Setup · Step 7 of 11', '<div class="h">Connect your email</div>' + fld('Mail server') + fld('Port   587')],
    e401: ['Error', '<div class="h">Error 401 · Unauthorized</div><div class="s">Check your credentials and try again.</div>' + btn('Retry'), 1],
    tabs: ['Docs', '<div class="tabs"><b>Docs</b><b>Setup</b><b>Docs (2)</b><b>Forum</b><b>Video</b><b>Docs (3)</b></div><div class="h" style="margin-top:10px">Getting started, part 3</div><div class="s">Before you begin, complete parts 1 and 2.</div>'],
    progress: ['Agent', '<div class="h">Setting up agent… 12%</div><div class="bar"><i></i></div>'],
    webhook: ['Webhooks', '<div class="h">Add a webhook</div>' + fld('Endpoint') + fld('Signing secret')],
    tools: ['Tools', '<div class="h">Define your tools</div><div class="ta">{ "name": "send_email",<br>  "parameters": {<br>    "type": "object",<br>    "required": [ ??? ]</div>'],
    test: ['Setup · Step 9 of 11', '<div class="h">Test your agent</div><div class="s">Run a test to continue.</div>' + btn('Run test')],
    token: ['Error', '<div class="h">Token expired</div><div class="s">Reconnect your account to continue.</div>' + btn('Reconnect'), 1],
    spin: ['Loading', '<div class="s" style="text-align:center">Connecting…</div><div class="spinner"></div>'],
    rate: ['Error', '<div class="h">Rate limit reached</div><div class="s">Try again in 60 seconds.</div>', 1],
    wrong: ['Error', '<div class="h">Something went wrong</div><div class="s">Please try again later.</div>' + btn('Retry'), 1],
    restart: ['Setup', '<div class="h">Start over?</div><div class="s">Your progress will be lost.</div>' + btn('Start over') + ' ' + btn('Cancel', 1)],
    conn: ['Error', '<div class="h">Connection failed</div><div class="s">Calendar · not authorized</div>' + btn('Retry'), 1],
  };
  const MAZE_SEQ = [[4, 'account'], [5, 'step4'], [6, 'connector'], [7, 'allow'], [8, 'apikey'], [9, 'prompt'], [10, 'calendar'], [11, 'email'], [12, 'e401'], [13, 'tabs'],
    [14, 'progress'], [15, 'webhook'], [16, 'tools'], [17, 'test'], [18, 'token'], [18.5, 'spin'], [19, 'step4'], [19.5, 'rate'], [20, 'allow'], [20.5, 'progress'],
    [21, 'wrong'], [21.5, 'apikey'], [22, 'restart'], [22.5, 'conn'], [23, 'e401'], [23.5, 'test']];
  const SPIN_IDX = 15;
  const mazeHost = $('#maze'), VS = Math.max(1, (H / SK) / 1080 * 0.92);   // taller formats: spread the maze to fill the frame
  const WINS = MAZE_SEQ.map(([at, key], i) => {
    const [title, body, err] = WIN[key];
    const el = document.createElement('div'); el.className = 'win' + (err ? ' err' : '');
    el.innerHTML = `<div class="tb"><i></i><i></i><i></i><span>${title}</span></div><div class="bd">${body}</div>`;
    mazeHost.appendChild(el);
    const r = rng(i * 31 + 7), late = P(at, 4, 23.5);
    const ang = i * 2.39996 + r() * 0.5, rad = lerp(330, 160, late) + r() * 170;
    return { el, at, err: !!err, i, x: 540 + Math.cos(ang) * rad * 1.05, y: 560 + Math.sin(ang) * rad * 0.92 * VS, rot: (r() - 0.5) * 16, ry: (r() - 0.5) * 34, rx: (r() - 0.5) * 18,
      s: lerp(0.86, 1.12, late) + r() * 0.1, dr: r() * TAU, spiral: r() * 1.4 + 2.2 };
  });

  /* ---------------------------------------------------------------- approval cards */
  const SLOT_Y = [372, 484, 596, 708], CARD_X = 160, LAND_T = [53, 53.5, 54, 54.5], APPROVE_T = [56, 56.5, 57, 57.5];
  const TIDY = [['cal', 'Open house · Sun 1–4', '48 Coral Palm Way · Naples'], ['photo', 'Instagram carousel', '3 slides · Just listed'],
    ['mail', 'Open house email', '31 buyers · ready to send'], ['msg', '3 follow-up texts', 'Everyone from last week']];
  const CARDS = TIDY.map(([ic, t, d]) => {
    const el = document.createElement('div'); el.className = 'card';
    const icon = ic === 'photo' ? '<div class="ti ph" style="background-image:url(assets/photos/hero_waterfront.jpg)"></div>' : `<div class="ti">${svg(ic, 28, 2)}</div>`;
    el.innerHTML = `<div class="tidy lglass">${icon}<div><div class="tt">${t}</div><div class="td">${d}</div></div><div class="ap"><span class="lbl">Approve</span>${svg('check', 24, 2.8, '#fff')}</div></div><div class="cring"></div>`;
    $('#cards').appendChild(el);
    return { el, ap: el.querySelector('.ap'), ring: el.querySelector('.cring'), lbl: el.querySelector('.lbl'), ck: el.querySelector('.ap svg') };
  });

  /* ---------------------------------------------------------------- world carousel */
  $('#fan').innerHTML = `
    <div class="slide"><div class="photo" style="background-image:url(assets/photos/hero_waterfront.jpg)"></div><div class="gr"></div><div class="tx"><div class="k">Just listed</div><div class="a">48 Coral Palm Way</div><div class="c">Naples, FL 34102</div></div></div>
    <div class="slide"><div class="photo" style="background-image:url(assets/photos/hero_waterfront.jpg);background-size:240%;background-position:70% 40%"></div><div class="dim"></div><div class="k" style="position:absolute;left:18px;top:18px;font:600 9.5px/1 var(--sans);letter-spacing:.22em">OFFERED AT</div><div class="price">$2,450,000</div>
      <div class="grid"><div class="cell"><b>4</b><span>Beds</span></div><div class="cell"><b>4.5</b><span>Baths</span></div><div class="cell"><b>3,860</b><span>Sq ft</span></div><div class="cell"><b>Dock</b><span>Waterfront</span></div></div></div>
    <div class="slide"><div class="photo" style="background-image:url(assets/photos/hero_waterfront.jpg);background-size:220%;background-position:30% 70%"></div><div class="cta"><div class="k">Open house</div><div class="big">Sunday</div><div class="tm">1–4 PM · Naples</div></div></div>`;
  const SLIDES = $$('#fan .slide');

  /* ---------------------------------------------------------------- type */
  const WORDS = [
    { l: ['11 steps.'], at: [10], out: 13.6, x: 540, y: 540, fs: 150, w: 820, center: true, box: true },
    { l: ['Still not working.'], at: [16], out: 19.6, x: 540, y: 540, fs: 132, w: 900, center: true, box: true },
    { l: ['Day 3.'], at: [20], out: 24.2, x: 540, y: 540, fs: 170, w: 820, center: true, box: true },
    { l: ['Or.'], at: [27], out: 38.6, x: 540, y: 245, fs: 170, w: 600, center: true },
    { l: ['Open house.', 'Ready.'], at: [41.3, 42], out: 43.6, x: 620, y: 540, fs: 120, w: 380 },
    { l: ['Posts.'], at: [44], out: 46.6, x: 600, y: 250, fs: 120, w: 380 },
    { l: ['Emails.'], at: [47], out: 49.6, x: 620, y: 540, fs: 130, w: 380 },
    { l: ['Follow-ups.'], at: [50], out: 52.5, x: 620, y: 540, fs: 130, w: 380 },
    { l: ['Already', 'set up.'], at: [58, 58.5], out: 60.3, x: 540, y: 560, fs: 170, w: 900, center: true },
  ];
  WORDS.forEach(w => {
    const el = document.createElement('div'); el.className = 'kw' + (w.box ? ' box' : '');
    el.innerHTML = w.l.map(t => `<div class="ln"><span>${t}</span></div>`).join('');
    set(el, { left: w.x + 'px', top: w.y + 'px', fontSize: w.fs + 'px', transform: w.center ? 'translate(-50%,-50%)' : 'translate(0,-50%)', textAlign: w.center ? 'center' : 'left' });
    $('#words').appendChild(el); w.el = el; w.spans = $$('.ln > span', el);
  });
  const WHIPS = [['sarasota_bridgepool', 'Just listed', '1207 Sea Grape Ln', 'Sarasota, FL 34236'], ['beach_boardwalk', 'Open house · Sat 12–3', '3301 Seabreeze Ct', 'Delray Beach, FL 33483'],
    ['tampa_rockpool', 'Follow-ups sent · 9', '915 Mangrove Bay Dr', 'Tampa, FL 33606'], ['lauderdale_tiki', 'Open house · Sun 1–4', '2219 Banyan Isle Dr', 'Fort Lauderdale, FL 33301']];
  $$('.wp').forEach((el, i) => (el.style.backgroundImage = `url(assets/photos/${WHIPS[i][0]}.jpg)`));

  /* ---------------------------------------------------------------- assets */
  await document.fonts.load('400 40px "Instrument Serif"'); await document.fonts.load('italic 40px "Instrument Serif"'); await document.fonts.load('600 16px "Inter"'); await document.fonts.ready;
  await Promise.all([...WHIPS.map(w => w[0]), 'hero_waterfront'].map(n => `assets/photos/${n}.jpg`).concat(['assets/img/chatbot_mark.png'])
    .map(src => new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = src; })));
  WORDS.forEach(w => { const wd = w.el.offsetWidth; if (wd > w.w) w.el.style.fontSize = (w.fs * w.w / wd) + 'px'; });
  { const ht = $('#hookTxt'); ht.style.fontSize = '86px'; const wd = ht.offsetWidth; if (wd > 960) ht.style.fontSize = (86 * 960 / wd) + 'px'; }
  WINS.forEach(w => { w.w = w.el.offsetWidth; w.h = w.el.offsetHeight; });
  HNE.forEach(n => (n.h = n.el.offsetHeight));

  /* ---------------------------------------------------------------- refs */
  const R = {
    cam: $('#cam'), hook: $('#hook'), laptop: $('#laptop'), hPhone: $('#hPhone'), hCal: $('#hCal'), hookTxt: $('#hookTxt'), lapCaret: $('#lapCaret'),
    grey: $('#greyBg'), maze: mazeHost, cursor: $('#cursor'), redTint: $('#redTint'), vignette: $('#vignette'),
    rig: $('#rig'), calm: $('#calm'), composer: $('#composer'), cGlow: $('#cGlow'), typed: $('#typed'), caret: $('#caret'), cPh: $('#cPh'), cSend: $('#cSend'), ring: $('#ring'),
    stack: $('#stack'), title: $('#stackTitle'), count: $('#stackCount'), fan: $('#fan'), endc: $('#endc'), wordmark: $('#wordmark'),
    tagline: $('#tagline'), tagSpan: $('#tagline .ln > span'), cta: $('#cta'), ctaSpans: $$('#cta .ln > span'), flash: $('#flash'), wpCard: $('#wpCard'), wpK: $('#wpK'), wpA: $('#wpA'), wpC: $('#wpC'),
    whips: $$('.wp'), whipsHost: $('#whips'), gA: $('#gA'), gB: $('#gB'), gC: $('#gC'), mbBlur: $('#mbBlur'),
    ohRows: $$('#ohRows .rw'), ohCard: $('#ohCard'), emailBody: $('#emailBody'), sig: $('#sig'), tcs: $$('#sTexts .tc'), tqs: $$('#sTexts .q'), cTrack: $('#cTrack'),
  };
  const SCR = { sOH: [40.7, 44], sContent: [44, 47], sEmail: [47, 50], sTexts: [50, 53.3] };
  for (const k in SCR) SCR[k] = { el: document.getElementById(k), r: SCR[k] };
  const EMAIL = 'Hi there,\n\nJoin me Sunday 1–4 PM at 48 Coral Palm Way: a 4-bed Naples waterfront home with a private dock and an infinity pool.\n\nSee you there!';

  const grain = $('#grain'), gctx = grain.getContext('2d'), NOISE = [];
  { const r = rng(99); for (let k = 0; k < 8; k++) { const c = document.createElement('canvas'); c.width = c.height = 540; const x = c.getContext('2d'), id = x.createImageData(540, 540); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 110; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); NOISE.push(c); } }
  const stars = $('#stars'), sctx = stars.getContext('2d');
  const STARS = (() => { const r = rng(5); return Array.from({ length: 140 }, () => ({ x: r() * 780, y: r() * 1688, s: 0.6 + r() * 1.6, a: 0.25 + r() * 0.6, ph: r() * 6.28, sp: 0.5 + r() * 2 })); })();
  const reveal = (span, b, b0, outB = 999, dur = 1.4) => { const p = E.outExpo(P(b, b0, b0 + dur)), q = E.inCubic(P(b, outB, outB + 0.7)); span.style.transform = `translateY(${(1 - p) * 112 - q * 112}%)`; span.style.opacity = p > 0 ? 1 : 0; span.style.filter = (p < 1 || q > 0) ? `blur(${(1 - p) * 6 + q * 6}px)` : 'none'; };

  /* ---------------------------------------------------------------- the hook composition; h = hook-local time (0 = the loop frame) */
  function hookPose(h, live) {
    // phone: buzz on u0.5 and u2 (never on frame 0, so the loop frame stays still)
    let wig = 0; if (live) for (const T of [0.5, 2]) if (h >= T) wig += Math.sin((h - T) * 70) * 3.2 * Math.exp(-(h - T) * 5);
    set(R.hPhone, { transform: `translate(112px,${388}px) rotate(${-4 + wig}deg)` });
    set(R.laptop, { transform: 'translate(400px,430px)' });
    set(R.hCal, { transform: 'translate(36px,782px) rotate(3deg)' });
    // notifications: newest on top
    const shown = HNE.filter(n => h >= n.at);
    HNE.forEach(n => {
      const on = h >= n.at; vis(n.el, on); if (!on) return;
      const a = n.at < 0 ? 1 : E.spring(P(h, n.at, n.at + 0.8));
      const above = shown.filter(m => m.at > n.at).reduce((s, m) => s + (m.h + 8) * (m.at < 0 ? 1 : E.outExpo(P(h, m.at, m.at + 0.6))), 0);
      set(n.el, { top: (134 + above) + 'px', opacity: clamp(a * 2), transform: `translateY(${(1 - a) * -24}px) scale(${0.9 + 0.1 * a})` });
    });
    R.lapCaret.style.opacity = (!live || h % 2 < 1.2) ? 1 : 0;
  }

  /* ================================================================ RENDER */
  function render(t) {
    const raw = t / U;
    const u = raw >= 67.5 && raw < 70 ? 67.5 : raw;         // frozen hold on the end card, then the loop tail
    const mu = Math.min(u, 24);                               // maze time freezes on u24
    const tail = raw >= 70;

    /* camera: loop-periodic float + section moves */
    let cx = per(raw, 3) * 3, cy = per(raw, 2) * 2, cs = 1 + 0.004 * per(raw, 2), cr = 0;
    if (u < 4) { const a = 0.6 + 4 * Math.pow(u / 4, 2); cx += Math.sin(u * 37) * a; cy += Math.sin(u * 29) * a * 0.8; }
    if (u >= 4 && u < 24) { const a = 1 + 11 * Math.pow(P(u, 8, 24), 1.8); const hit = [18, 21, 23].reduce((s, T) => s + pulseAt(u, T, 6), 0) * 9;
      cx += Math.sin(u * 41) * (a + hit) + Math.sin(u * 23) * a * 0.4; cy += Math.sin(u * 33 + 1) * (a + hit); cr = Math.sin(u * 27) * (a + hit) * 0.04; cs *= 1 + 0.05 * P(u, 4, 24); }
    if (u >= 24 && u < 40) cs *= 1.05 - 0.05 * E.outCubic(P(u, 24, 26));
    if (u >= 39 && u < 40) cs *= 1 - 0.03 * E.inCubic(P(u, 39, 40));
    if (u >= 55 && u < 56) cs *= 1 + 0.03 * E.inCubic(P(u, 55, 56));
    for (const T of [40, 41, 44, 47, 50, ...LAND_T, ...APPROVE_T]) { const d = pulseAt(u, T, 9); cy += 5 * d; cs *= 1 + (T === 40 ? 0.04 : 0.008) * d; }
    R.cam.style.transform = `translate(${cx}px,${cy}px) rotate(${cr}deg) scale(${cs})`;

    /* glow blobs (loop-periodic; tail returns to the frame-0 level) */
    const pulse = [40, ...APPROVE_T, 64].reduce((a, T) => a + pulseAt(u, T, 2.2), 0);
    const base = raw >= 70 ? lerp(0.6, 0.38, E.inOut(P(raw, 70, 71.6))) : u < 26 ? 0.38 : 0.6;
    const gAmt = clamp(base + 0.45 * pulse, 0, 1.3), W2 = W / 2, H2 = H / 2;
    set(R.gA, { left: (W2 - 300 + per(raw, 2) * 160) + 'px', top: (H2 - 260 + perc(raw, 1) * 120) + 'px', opacity: gAmt });
    set(R.gB, { left: (W2 + 320 + perc(raw, 2) * 140) + 'px', top: (H2 + 60 + per(raw, 1) * 140) + 'px', opacity: gAmt * 0.9 });
    set(R.gC, { left: (W2 + per(raw, 1) * 200) + 'px', top: (H2 + 360) + 'px', opacity: gAmt * 0.85 });

    /* grey "setup" world: in on the push (u4.3), out on the freeze (u24-25.4) */
    const greyO = u < 4 ? 0 : u < 24 ? E.outCubic(P(u, 4.2, 4.8)) : 1 - E.inOut(P(u, 24.2, 25.6));
    R.grey.style.opacity = greyO; vis(R.grey, greyO > 0.001);

    /* ---------- HOOK (u0-4.8) and the loop tail (u70-72) ---------- */
    const hookOn = u < 4.8 || raw >= 70.4;
    vis(R.hook, hookOn);
    if (hookOn) {
      if (!tail) {
        hookPose(u, true);
        const push = E.inExpo(P(u, 3.85, 4.8));
        // camera pushes into the laptop screen; phone + text leave
        set(R.laptop, { transform: `translate(${400 + (540 - 710) * push}px,${430 + (540 - 630) * push}px) scale(${1 + 4 * push})`, transformOrigin: '310px 200px', opacity: String(1 - P(u, 4.45, 4.8)) });
        set(R.hPhone, { opacity: String(1 - P(u, 3.9, 4.3)), translate: `${-260 * E.inCubic(P(u, 3.85, 4.4))}px 0` });
        set(R.hCal, { opacity: String(1 - P(u, 3.9, 4.3)), translate: `${-260 * E.inCubic(P(u, 3.85, 4.4))}px 0` });
        set(R.hookTxt, { opacity: String(1 - P(u, 3.85, 4.25)), filter: u > 3.85 ? `blur(${8 * P(u, 3.85, 4.25)}px)` : 'none' });
        R.hook.style.opacity = 1; R.hook.style.filter = 'none';
      } else {
        hookPose(0, false);
        set(R.laptop, { opacity: '1' }); set(R.hPhone, { opacity: '1', translate: '0 0' }); set(R.hCal, { opacity: '1', translate: '0 0' });
        set(R.hookTxt, { opacity: '1', filter: 'none' });
        const a = E.inOut(P(raw, 70.4, 71.6));
        set(R.hook, { opacity: a, filter: a < 1 ? `blur(${(1 - a) * 12}px)` : 'none' });
      }
      R.hookTxt.style.textShadow = '0 0 40px rgba(166,140,255,.22)';
    }

    /* ---------- MAZE (u4-24, ghost u24-39, spiral into the box u39-40) ---------- */
    const mazeOn = u >= 4 && u < 40;
    vis(R.maze, mazeOn);
    if (mazeOn) {
      const ghost = u < 24 ? 0 : E.outCubic(P(u, 24, 25.2)) * (1 - P(u, 39, 39.35));
      const suck = E.inExpo(P(u, 39.1, 40));
      const errHit = [18, 21, 23].reduce((s, T) => s + pulseAt(mu, T, 5), 0);
      for (const w of WINS) {
        const on = mu >= w.at; vis(w.el, on); if (!on) continue;
        const a = E.spring(P(mu, w.at, w.at + 0.55)), age = mu - w.at;
        let x = lerp(540, w.x, a) + Math.sin(mu * 0.9 + w.dr) * 10 * a, y = lerp(560, w.y, a) + Math.cos(mu * 0.8 + w.dr) * 8 * a;
        let s = lerp(0.2, w.s, a) * (1 - 0.012 * Math.min(age, 12)), rot = w.rot * a;
        if (w.err) { const j = pulseAt(mu, w.at, 4) * 8 + errHit * 3; x += Math.sin(mu * 90) * j; }
        if (w.i === SPIN_IDX || (w.i === SPIN_IDX + 2 && mu >= 20)) { x += Math.sin(mu * 2.2) * 30; y += Math.cos(mu * 1.7) * 20; }
        if (suck > 0) { const ang = Math.atan2(y - 550, x - 540) + suck * w.spiral, d = Math.hypot(x - 540, y - 550) * (1 - suck);
          x = 540 + Math.cos(ang) * d; y = 550 + Math.sin(ang) * d; s *= 1 - 0.94 * suck; rot += suck * 220; }
        set(w.el, { transform: `translate(${x - w.w / 2}px,${y - w.h / 2}px) perspective(1400px) rotateX(${w.rx * a}deg) rotateY(${w.ry * a * (1 - suck)}deg) rotate(${rot}deg) scale(${s})`,
          opacity: clamp(a * 3) * lerp(1, 0.13, ghost) * (1 - P(u, 39.85, 40)), zIndex: w.i,
          filter: ghost > 0.01 ? `blur(${ghost * 5}px) grayscale(${ghost})` : suck > 0.02 ? `blur(${suck * 5}px)` : 'none' });
      }
    }
    // the cursor chasing a spinner
    const curOn = u >= 18.6 && u < 24.6; vis(R.cursor, curOn);
    if (curOn) { const sp = WINS[SPIN_IDX], m2 = mu, lag = 0.55;
      const tx = sp.x + Math.sin((m2 - lag) * 2.2) * 30 + 60, ty = sp.y + Math.cos((m2 - lag) * 1.7) * 20 + 40;
      set(R.cursor, { transform: `translate(${tx + Math.sin(m2 * 7) * 18}px,${ty + Math.cos(m2 * 5) * 12}px)`, opacity: clamp(P(u, 18.6, 18.9) * 3) * (1 - E.outCubic(P(u, 24, 24.6))) }); }
    const red = u < 24.2 ? [18, 21, 23].reduce((s, T) => s + pulseAt(mu, T, 4.5), 0) : 0;
    R.redTint.style.opacity = clamp(red * 0.55); vis(R.redTint, red > 0.01);
    R.vignette.style.opacity = u >= 4 && u < 24.5 ? 0.5 + 0.5 * P(u, 8, 24) : 0.35;

    /* ---------- the chat box (u26-41) ---------- */
    const calmOn = u >= 25.9 && u < 41.05;
    vis(R.calm, calmOn);
    if (calmOn) {
      const k = TL.keyUnits.filter(x => x <= u).length;
      R.typed.textContent = TL.prompt.slice(0, k);
      R.cPh.style.display = k ? 'none' : 'inline';
      R.caret.style.opacity = u >= 38.9 ? 0 : (k > 0 && k < TL.prompt.length) || (u * 1) % 2 < 1 ? 1 : 0;
      const a = E.outExpo(P(u, 26, 27.2));
      const inhale = E.inCubic(P(u, 39.2, 40)), sq = u >= 40 ? Math.exp(-(u - 40) * 7) * Math.sin((u - 40) * 22) : 0;
      const m = E.inOut(P(u, 40.4, 41.0));
      const sx = (0.97 + 0.03 * a) * (1 - 0.04 * inhale) * (1 + 0.07 * sq) * lerp(1, 0.46, m), sy = (0.97 + 0.03 * a) * (1 - 0.04 * inhale) * (1 - 0.09 * sq) * lerp(1, 0.46, m);
      set(R.calm, { opacity: clamp(a * 1.5) * (1 - P(u, 40.7, 41.0)), transform: `translate(${(350 - 540) * m}px,${(1 - a) * 60}px) scale(${sx},${sy})`, transformOrigin: '540px 550px', filter: a < 1 ? `blur(${(1 - a) * 10}px)` : 'none' });
      const sendG = u >= 38.9 ? pulseAt(u, 38.9, 3) : 0;
      R.cGlow.style.opacity = clamp(0.35 * a + sendG + 0.65 * inhale + (u >= 40 ? pulseAt(u, 40, 2.5) : 0));
      R.cSend.style.transform = `scale(${u >= 38.9 && u < 39.2 ? 1 - 0.14 * Math.sin(P(u, 38.9, 39.2) * Math.PI) : 1})`;
    }
    // shockwave on the collapse
    const ringOn = u >= 40 && u < 42; vis(R.ring, ringOn);
    if (ringOn) { const p = E.outCubic(P(u, 40, 41.6)); set(R.ring, { transform: `scale(${1 + 15 * p})`, opacity: 1 - p, borderWidth: (3 / (1 + 4 * p)) + 'px' }); }

    /* ---------- phone (u40.7-53.3) ---------- */
    let rig = null;
    if (u >= 40.7 && u < 53.3) {
      const a = E.outExpo(P(u, 40.7, 41.3)), out = E.inCubic(P(u, 52.7, 53.3));
      let punch = 0; for (const T of [44, 47, 50]) if (u >= T) punch = Math.max(punch, 0.035 * Math.exp(-(u - T) * 6));
      rig = { x: -190 - out * 420, y: 8, s: lerp(1.12, 1, a) * (1 + punch) * (1 + 0.025 * P(u, 41, 53)), o: clamp(a * 2) * (1 - out), blur: (1 - a) * 6 + out * 10 };
    }
    vis(R.rig, !!rig);
    if (rig) {
      set(R.rig, { transform: `perspective(2000px) translate(${rig.x}px,${rig.y}px) scale(${rig.s}) rotateX(2deg) rotateY(8deg)`, opacity: rig.o, filter: rig.blur > 0.1 ? `blur(${rig.blur}px)` : 'none' });
      sctx.clearRect(0, 0, 780, 1688); for (const s of STARS) { sctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(u * s.sp + s.ph)); sctx.fillStyle = '#fff'; sctx.beginPath(); sctx.arc(s.x, (s.y + u * 4 * s.sp) % 1688, s.s, 0, 6.283); sctx.fill(); }
    }
    let cur = null; for (const k in SCR) { const on = !!rig && u >= SCR[k].r[0] && u < SCR[k].r[1]; vis(SCR[k].el, on); if (on) cur = k; }
    if (cur) { const z = E.outExpo(P(u, SCR[cur].r[0], SCR[cur].r[0] + 0.5)); set(SCR[cur].el, { transform: `scale(${lerp(0.86, 1, z)})`, opacity: clamp(z * 1.6) }); }
    if (rig) {
      { const d = E.spring(P(u, 41.0, 41.9)); set(R.ohCard, { transform: `translateY(${(1 - d) * 50}px) scale(${0.94 + 0.06 * d})`, opacity: clamp(P(u, 41, 41.2) * 4) }); }
      R.ohRows.forEach((row, i) => { const b0 = 42 + i * 0.5, p = E.outExpo(P(u, b0 - 0.25, b0 + 0.4)); set(row, { opacity: p, clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }); setChk(row.querySelector('.chk'), P(u, b0, b0 + 0.4)); });
      R.cTrack.style.backgroundPosition = `${40 + 20 * P(u, 44, 47)}% 50%`;
      const ne = Math.floor(EMAIL.length * P(u, TL.emailType[0], TL.emailType[1]));
      R.emailBody.innerHTML = EMAIL.slice(0, ne) + (u < TL.emailType[1] + 0.3 ? '<span class="ecaret"></span>' : '');
      R.sig.style.opacity = E.outCubic(P(u, 49.6, 49.9));
      R.tcs.forEach((el, i) => { const p = E.spring(P(u, 50.5 + i * 0.5, 51.3 + i * 0.5)); set(el, { opacity: clamp(p * 2), transform: `translateY(${(1 - p) * 40}px)` }); });
      R.tqs.forEach((el, i) => { const p = E.outBack(P(u, 52 + i * 0.12, 52.4 + i * 0.12)); set(el, { opacity: clamp(p * 2), transform: `scale(${0.6 + 0.4 * p})` }); });
    }
    const fanOn = u >= 44 && u < 46.9; vis(R.fan, fanOn);
    if (fanOn) {
      const FAN = [[700, 610, -9], [800, 585, 0], [900, 610, 9]];
      SLIDES.forEach((el, i) => { const p = E.spring(P(u, 44.4 + i * 0.25, 45.6 + i * 0.25)), out = E.inCubic(P(u, 46.3, 46.9));
        set(el, { transform: `translate(${lerp(350, FAN[i][0], p) + out * 500}px,${lerp(540, FAN[i][1], p)}px) rotate(${lerp(0, FAN[i][2], p) + Math.sin(u + i) * 0.6}deg) scale(${lerp(0.5, 1, p)})`, opacity: clamp(p * 2) * (1 - out), zIndex: i === 1 ? 3 : 2 }); });
    }

    /* ---------- approval stack (land u53-54.5, freeze u55, approve on the drop u56-57.5) ---------- */
    const stackOn = u >= 52.8 && u < 58.4;
    vis(R.stack, stackOn);
    if (stackOn) {
      const tp = E.outExpo(P(u, 52.8, 53.5)), headOut = E.inCubic(P(u, 57.8, 58.3));
      set(R.title, { transform: `translate(0,${268 + (1 - tp) * 30}px)`, opacity: tp * (1 - headOut) });
      const landed = LAND_T.filter(x => u >= x).length - APPROVE_T.filter(x => u >= x).length;
      R.count.textContent = landed;
      const bump = Math.max(0, ...[...LAND_T, ...APPROVE_T].map(x => (u >= x && u < x + 0.4) ? Math.sin(P(u, x, x + 0.4) * Math.PI) : 0));
      set(R.count, { transform: `translate(874px,270px) scale(${1 + 0.25 * bump})`, opacity: tp * (1 - headOut) });
      CARDS.forEach((c, i) => {
        const L = LAND_T[i], T = APPROVE_T[i];
        if (u < L - 0.05) { vis(c.el, false); return; }
        vis(c.el, true);
        const land = E.spring(P(u, L - 0.05, L + 0.6));
        let shift = 0; for (let j = 0; j < i; j++) shift += 112 * E.spring(P(u, APPROVE_T[j] + 0.15, APPROVE_T[j] + 0.9));
        const sweep = E.outExpo(P(u, T + 0.12, T + 0.7));
        set(c.el, { transform: `translate(${CARD_X + sweep * 760}px,${SLOT_Y[i] - shift + (1 - land) * 140}px) rotate(${sweep * 6}deg) scale(${lerp(0.92, 1, land)})`, opacity: clamp(land * 3) * (1 - P(u, T + 0.25, T + 0.65)), zIndex: 1 });
        const fill = E.outCubic(P(u, T, T + 0.12)), press = u >= T && u < T + 0.2 ? 1 - 0.08 * Math.sin(P(u, T, T + 0.2) * Math.PI) : 1;
        set(c.ap, { background: fill > 0 ? `linear-gradient(135deg, rgba(143,180,255,${fill}), rgba(166,140,255,${fill}))` : 'transparent', borderColor: fill > 0.5 ? 'transparent' : 'rgba(11,11,18,.22)', transform: `scale(${press})`, boxShadow: fill > 0 ? `0 0 ${36 * (1 - P(u, T, T + 0.9))}px rgba(166,140,255,.95)` : 'none' });
        c.lbl.style.opacity = 1 - fill;
        const path = c.ck.querySelector('path'); path.setAttribute('stroke-dasharray', 22); path.setAttribute('stroke-dashoffset', 22 * (1 - E.outCubic(P(u, T + 0.02, T + 0.25)))); c.ck.style.opacity = fill;
        const rp = u >= T ? P(u, T, T + 0.9) : u >= L ? P(u, L, L + 0.9) : 1;
        set(c.ring, { opacity: rp < 1 ? (1 - rp) * (u >= T ? 1 : 0.6) : 0, transform: `scale(${1 + 0.06 * rp},${1 + 0.25 * rp})`, transformOrigin: '50% 50%' });
      });
    }

    /* ---------- type ---------- */
    for (const w of WORDS) {
      const ww = w.at[0] < 24 ? mu : u;
      const on = ww >= w.at[0] - 0.05 && u < w.out + 0.8; vis(w.el, on); if (!on) continue;
      w.spans.forEach((s, j) => reveal(s, u, w.at[j], w.out));
      const g = 1 - P(u, w.at[0], w.at[0] + 2.6);
      w.el.style.textShadow = w.box ? 'none' : `0 0 ${30 + 40 * g}px rgba(166,140,255,${0.15 + 0.35 * g})`;
    }

    /* ---------- photo whips (u60-64) ---------- */
    const WT = [61, 62, 62.5, 63];
    const whipOn = u >= 60.8 && u < 64.6; vis(R.whipsHost, whipOn); vis(R.wpCard, u >= 61 && u < 63.9);
    if (whipOn) {
      let mv = 0;
      R.whips.forEach((el, i) => {
        const T = WT[i], nx = WT[i + 1] || 99, inn = E.outExpo(P(u, T, T + 0.45)), out = i < 3 ? E.outExpo(P(u, nx, nx + 0.45)) : 0;
        const on = u >= T && (i === 3 || u < nx + 0.45);
        vis(el, on); if (!on) return;
        const x = (1 - inn) * (W + 200) - out * (W + 200);
        mv = Math.max(mv, Math.abs(inn - E.outExpo(P(u - 0.0256, T, T + 0.45))) * W, Math.abs(out - (i < 3 ? E.outExpo(P(u - 0.0256, nx, nx + 0.45)) : 0)) * W);
        set(el, { left: (-60 + x) + 'px', width: (W + 120) + 'px', height: (H + 120) + 'px', transform: `scale(${1.08 - 0.06 * P(u, T, T + 3)})`, filter: 'url(#mb) saturate(1.05)' });
      });
      R.mbBlur.setAttribute('stdDeviation', `${Math.min(40, mv * 0.3)} 0`);
      const i = Math.max(0, WT.filter(x => u >= x).length - 1), T = WT[i], cp = E.spring(P(u, T + 0.05, T + 0.75));
      R.wpK.textContent = WHIPS[i][1]; R.wpA.textContent = WHIPS[i][2]; R.wpC.textContent = WHIPS[i][3];
      set(R.wpCard, { opacity: clamp(cp * 2) * (1 - P(u, 63.4, 63.8)), transform: `translateY(${(1 - cp) * 40}px)` });
    }

    /* ---------- flashes, end card, loop ---------- */
    const fl = Math.max(E.inCubic(P(u, 63.2, 63.95)) * (1 - E.outCubic(P(u, 64, 64.9))), u >= 40 && u < 41 ? 0.45 * Math.exp(-(u - 40) * 6) : 0);
    R.flash.style.opacity = fl; vis(R.flash, fl > 0.001);
    const endOn = u >= 63.9 && raw < 71.7; vis(R.endc, endOn);
    if (endOn) {
      const rise = E.outExpo(P(u, 64, 66.2)), out = E.inOut(P(raw, 70, 71.0));
      set(R.endc, { opacity: 1 - out, filter: out > 0 ? `blur(${out * 12}px)` : 'none' });
      set(R.wordmark, { top: (280 + 90 * (1 - rise)) + 'px', opacity: E.outCubic(P(u, 64, 64.7)), transform: `translateX(-50%) scale(${0.9 + 0.1 * rise})`, filter: `blur(${(1 - E.outCubic(P(u, 64, 65.3))) * 14}px)`, textShadow: `0 0 ${50 + 70 * (1 - P(u, 64, 67))}px rgba(166,140,255,${0.35 + 0.35 * (1 - P(u, 64, 67))})` });
      set(R.tagline, { top: '548px', transform: 'translateX(-50%)' }); reveal(R.tagSpan, u, 65, 999, 1.5);
      set(R.cta, { top: '640px', transform: 'translateX(-50%)' }); R.ctaSpans.forEach((s, j) => reveal(s, u, 66 + j * 0.5, 999, 1.4));
    }

    /* grain */
    const fi = Math.floor(t * 60), nz = NOISE[fi % 8], ox = (fi * 137) % 540, oy = (fi * 251) % 540;
    gctx.drawImage(nz, -ox, -oy); gctx.drawImage(nz, 540 - ox, -oy); gctx.drawImage(nz, -ox, 540 - oy); gctx.drawImage(nz, 540 - ox, 540 - oy);
    grain.style.opacity = whipOn ? 0.35 : u >= 4 && u < 24 ? 0.3 : 0.2;
  }

  /* ---------------------------------------------------------------- boot */
  window.renderFrame = render; window.DURATION = DUR;
  for (const tw of [0, 2, 5, 12, 20, 24.5, 30, 39.5, 40.5, 42.5, 45, 48, 51, 54, 56.5, 58.5, 61, 65, 70.5, 71.8]) render(tw * U);
  render(0); window.__ready = true;
  if (!RENDER) {
    const aud = $('#aud'), pp = $('#pp'), scrub = $('#scrub'), tc = $('#tc'); scrub.max = DUR; let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (aud.currentTime >= DUR - 0.05) aud.currentTime = 0; aud.play(); } else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; render(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; render(t); scrub.value = t; tc.textContent = t.toFixed(2) + 's'; if (t >= DUR) { playing = false; pp.textContent = 'Play'; } } requestAnimationFrame(loop); };
    loop();
  }
})();
