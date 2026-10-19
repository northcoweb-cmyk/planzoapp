/* Mila film #18 — "DIY Agent" (4:5 feed).
 * render(t) is a pure function of time; cues are beats b of "Da Fonk" at 127.1 BPM (0.47207 s).
 * BUILD (letterboxed, dark, the song's breakdown): "Sorry." photo-in-type b0 · "Mila isn't launching this week." b2 ·
 *   the date flips OCT 20 → OCT 23 (tomorrow → Friday) b4-6 · "But there's a reason." b6 · photo-in-type Smarter./Faster./Sharper. b8-10 ·
 *   photo strobe b11 · the song drops out: "She's getting" / "an upgrade." with a reverb hang b12-14 · pickup flashes b14, b15 ·
 * DROP b16: bars snap open, bright world, "Mila." · one feature per beat b17-24 · "Just say it." montage b25-29 ·
 *   kicker words b29-32 · "Just works." b33 · end card b34.5 · loop tail b42-44 to the exact frame 0.
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
  const ACAL = (s, wd = 'Thursday', n = '23') => `<svg width="${s}" height="${s}" viewBox="0 0 100 100" style="display:block;filter:drop-shadow(0 2px 6px rgba(20,20,60,.18))">
    <rect x="1" y="1" width="98" height="98" rx="22.5" fill="#fff"/><rect x="1" y="1" width="98" height="98" rx="22.5" fill="none" stroke="rgba(0,0,0,.08)"/>
    <text x="50" y="28" text-anchor="middle" font-family="Inter" font-weight="550" font-size="13.5" fill="#FF3B30">${wd}</text>
    <text x="50" y="80" text-anchor="middle" font-family="Inter" font-weight="300" font-size="56" letter-spacing="-2" fill="#111">${n}</text></svg>`;

  /* ---------------------------------------------------------------- shots */
  const SH = [];
  const shot = (a, b, html, upd, opts = {}) => { const el = document.createElement('div'); el.className = 'full'; el.innerHTML = html; $('#shots').appendChild(el); const s = { a, b, el, upd, ...opts }; SH.push(s); return s; };
  const dark = (n, bri = 0.42) => `<div class="ph" style="background-image:${img(n)};filter:brightness(${bri}) saturate(.85) blur(${bri < 0.4 ? 6 : 0}px)"></div>`;

  // ================= BUILD (b0-16): quick device cuts. Laptop + phone screens, a cut every half beat, whip / zoom / glitch
  // transitions. The models are fine — it's the DIY plumbing (logins, webhooks, keys, rate limits) that keeps breaking.
  const LOGOS = [['claude', 'Claude'], ['openai', 'ChatGPT'], ['gemini', 'Gemini'], ['agent', 'Agent app']];
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
  const EDITOR = `<div class="ed"><div class="edside"><div class="edh">MODELS</div>${LOGOS.map(([f, n]) => `<div class="edm"><img src="assets/logos/${f}.png">${n}</div>`).join('')}
    <div class="edh" style="margin-top:22px">TOOLS</div>${['gmail.py', 'calendar.py', 'crm.py', 'mls.py'].map(n => `<div class="edm f">${n}</div>`).join('')}</div>
    <div class="edcode"><div class="edtab">my-agent.py</div>${['<b>from</b> agents <b>import</b> Agent, Tool', '', 'agent = Agent(', '  model=<i>"best-available"</i>,', '  tools=[gmail, calendar,', '         crm, mls_feed],', '  retries=<i>3</i>,', ')', '', 'agent.run(<i>"follow up with everyone"</i>)']
      .map((l, i) => `<div><span class="ln2">${i + 1}</span>${l}</div>`).join('')}</div></div>`;
  // b0-1 HOOK (loop frame): the laptop, the code, the models
  cut(-9, 1, 'none', `${bgp('nyc_night', 0.25)}${cap('Built your own AI agent?')}${lap(EDITOR)}`, (b, s) => {
    const k = 1 + 0.05 * P(b, 0, 1); s.el.querySelector('.lap').style.transform = `scale(${k})`; s.el.querySelector('.cap').style.opacity = 1; s.el.querySelector('.cap').style.transform = 'translate(-50%,-50%)';
  }, { hook: true });
  // b1-1.5: the phone — the agent says it's connecting
  cut(1, 1.5, 'whipL', `${bgp('cliff_sunset', 0.28)}${cap('Wired it to everything.')}${phn(`<div class="chat"><div class="chd2"><img src="assets/logos/agent.png">my-agent</div>
    <div class="cb out">connect my tools</div><div class="cb in">Connecting Gmail, Calendar, CRM, MLS…</div></div>`)}`);
  // b1.5-3.5: the dashboard — each connection goes green on the beat, the camera punches in each time
  const CONN = [['Gmail', 1.5], ['Calendar', 2], ['CRM', 2.5], ['MLS feed', 3]];
  cut(1.5, 3.5, 'zoom', `${bgp('nyc_loft', 0.25)}${cap('Gmail. Calendar. CRM. MLS.')}${lap(`<div class="dash"><div class="dh">Integrations</div>${CONN.map(([n]) => `<div class="drow"><span>${n}</span><i class="sw2"><b></b></i><em>connecting…</em></div>`).join('')}</div>`)}`, (b, s) => {
    $$('.drow', s.el).forEach((r, i) => { const on = b >= CONN[i][1]; r.classList.toggle('on', on); r.querySelector('em').textContent = on ? 'connected' : 'connecting…'; });
    const T = CONN.filter(c => b >= c[1]).pop(); s.el.querySelector('.lscr').style.transform = `scale(${1 + 0.05 * (T ? pulseAt(b, T[1], 6) : 0)})`;
  });
  // b3.5-4: all green (the calm before)
  cut(3.5, 4, 'whipR', `${bgp('palm_estate', 0.3)}${cap('All connected.')}${phn(`<div class="lock"><div class="lt">9:41</div><div class="nt ok"><b>my-agent</b>All 4 tools connected ✓</div></div>`)}`);
  // b4-7: it breaks — a failure every half beat, alternating phone / laptop
  cut(4, 4.5, 'glitch', `${bgp('nyc_night', 0.22)}${cap('Then it breaks.')}${phn(`<div class="lock"><div class="lt">3:02</div>
    ${[['my-agent', 'Gmail · 401 Unauthorized'], ['my-agent', 'OAuth token expired'], ['my-agent', 'Retrying… (2/3)']].map(([a2, t2]) => `<div class="nt bad"><b>${a2}</b>${t2}</div>`).join('')}</div>`)}`, (b, s) => {
    $$('.nt', s.el).forEach((d, i) => { const a = E.spring(P(b, 4 + i * 0.1, 4.3 + i * 0.1)); set(d, { transform: `translateY(${(1 - a) * -60}px)`, opacity: clamp(a * 2) }); });
  });
  cut(4.5, 5, 'zoom', `${bgp('nyc_loft', 0.2)}${lap(`<div class="modal"><div class="mx">!</div><div class="mt">Webhook timed out</div><div class="ms">calendar.sync · 504 after 30,000 ms</div><div class="mb">Try again</div></div>`)}`);
  cut(5, 5.5, 'whipL', `${bgp('chelsea_living', 0.25)}${cap('Clients get ghosted.')}${phn(`<div class="chat"><div class="chd2 plain">Jordan Ellis</div><div class="cb in">Did you get my email?? Still want to tour Saturday</div>
    <div class="cb out bad">Sure, Saturday works!</div><div class="nd">Not Delivered ⓘ</div></div>`)}`);
  cut(5.5, 6, 'glitch', `${bgp('nyc_night', 0.2)}${lap(`<div class="tlog2">${['$ python my-agent.py', '✕ crm.update  invalid_api_key', '✕ mls.fetch  429 Too Many Requests', '✕ followups.queue  undefined is not a function', '✕ agent crashed (exit code 1)']
      .map(l => `<div class="${l.startsWith('✕') ? 'r' : ''}">${l}</div>`).join('')}</div>`)}`);
  cut(6, 6.5, 'drop', `${bgp('sarasota_bridgepool', 0.25)}${cap('Showings disappear.')}${phn(`<div class="cal2"><div class="ch2">Saturday</div>${['10:00 Showing · Jordan', '11:30 Showing · Priya', '2:00 Open house'].map(e => `<div class="ce">${e}</div>`).join('')}
    <div class="banner2">⚠︎ Sync failed · events may be missing</div></div>`)}`);
  cut(6.5, 7, 'zoom', `${bgp('nyc_loft', 0.2)}${lap(`<div class="modal"><div class="mx">!</div><div class="mt">API key revoked</div><div class="ms">crm · re-authenticate to continue</div><div class="mb">Generate new key</div></div>`)}`);
  // b7-8: glitch strobe through the models on quarter beats
  LOGOS.forEach(([f], i) => shot(7 + i * 0.25, 7.25 + i * 0.25, `<div style="position:absolute;inset:0;background:#07070d"></div><div class="glitchlogo"><img src="assets/logos/${f}.png"></div>
    <div class="mono" style="position:absolute;left:0;right:0;top:1000px;text-align:center;color:#ff8a98">TOOL CONNECTION FAILED</div>`, (b, s) => {
    const k = P(b, 7 + i * 0.25, 7.25 + i * 0.25); set(s.el.querySelector('.glitchlogo'), { transform: `translate(-50%,-50%) scale(${1.15 - 0.15 * k}) translateX(${Math.sin(b * 200) * 10}px)` });
  }));
  // b8-10: the wall — every screen red at once, pulling back
  const TILES = ['401 Unauthorized', 'Webhook timed out', 'API key revoked', '429 Rate limit', 'Sync failed', 'Not Delivered', 'exit code 1', 'token expired', 'Retrying… 3/3'];
  cut(8, 10, 'zoom', `<div style="position:absolute;inset:0;background:#07070d"></div><div class="wall">${TILES.map((t2, i) => `<div class="tile ${i % 3 === 1 ? 'p' : ''}"><div class="tx">✕</div><div>${t2}</div></div>`).join('')}</div>${cap('3:07 AM.', 250, 110)}`, (b, s) => {
    const k = E.inOut(P(b, 8, 10)); s.el.querySelector('.wall').style.transform = `scale(${1.5 - 0.42 * k}) rotate(${-3 + 3 * k}deg)`;
    $$('.tile', s.el).forEach((d, i) => { d.style.opacity = b >= 8 + i * 0.12 ? 1 : 0.15; d.style.boxShadow = `0 0 ${40 * pulseAt(b, 8 + i * 0.12, 6)}px rgba(255,80,100,.9)`; });
  });
  // b10-11.5: three words, one per half beat
  [['Re-auth.', 10, 'nyc_night'], ['Re-deploy.', 10.5, 'nyc_loft'], ['Repeat.', 11, 'chelsea_living']].forEach(([w, a, p], i) =>
    cut(a, a + 0.5, i % 2 ? 'whipR' : 'whipL', `${bgp(p, 0.22)}<div class="bigw" style="color:${i === 2 ? '#ff7a8a' : '#fff'}">${w}</div>`));
  // b11.5-12: crash to black
  cut(11.5, 12, 'glitch', `<div style="position:absolute;inset:0;background:#000"></div><div class="mono" style="position:absolute;left:0;right:0;top:660px;text-align:center;color:#ff7a8a;font-size:26px">agent crashed · exit code 1</div>`);
  // b12-16: the turn — the phone, Mila, one sentence, send, the hang
  shot(12, 16, `<div style="position:absolute;inset:0;background:#05050a"></div><div class="serifW" id="orT" style="top:250px;font-size:100px">Or… <span class="gtx" style="font-style:italic">skip the setup.</span></div>
    ${phn(`<div class="mchat"><div class="mh2"><i class="orbS"></i>Mila</div><div class="mready">Ready. Nothing to connect.</div>
      <div id="composer2"><span id="typed"></span><span id="caret"></span><b class="snd"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 18.5V5.5M6 11.5 12 5.5l6 6"/></svg></b></div></div>`, 350, 330)}`, (b, s) => {
    const o = E.outExpo(P(b, 12, 12.35)), hang = E.inCubic(P(b, 15.5, 16));
    set($('#orT'), { opacity: o * (1 - hang), transform: `translate(-50%,-50%) translateY(${(1 - o) * 30}px)` });
    const ph = s.el.querySelector('.phn'), c = E.spring(P(b, 12.5, 13.1)); set(ph, { transform: `translateY(${(1 - c) * 500}px) scale(${1 + 0.06 * hang})`, filter: hang > 0.01 ? `blur(${hang * 6}px)` : 'none' });
    const [a0, a1] = TL.askB, n = Math.floor(TL.ask.length * P(b, a0, a1)); $('#typed').textContent = TL.ask.slice(0, n);
    $('#caret').style.opacity = b >= TL.send ? 0 : (n < TL.ask.length || b % 0.5 < 0.3 ? 1 : 0);
    set($('#composer2'), { boxShadow: b >= TL.send ? `0 0 ${80 * pulseAt(b, TL.send, 2)}px rgba(166,140,255,.95)` : 'none' });
  });

  /* ---------------- after the drop: the bright world */
  const lightBg = p => p ? `<div class="ph" style="background-image:${img(p)};filter:blur(30px) brightness(1.15) saturate(1.1);opacity:.55"></div>` : '';
  shot(16, 17, `<div class="ph" style="background-image:${img('cliff_pool')}"></div><div class="serifW" style="top:230px;font-size:170px">Mila.</div>
    <div class="card lglass" style="top:930px;padding:30px 40px;text-align:center"><div class="k">No setup · no code · no API keys</div><div class="t" style="font-size:72px">It just works.</div></div>`, (b, s) => {
    s.el.querySelector('.ph').style.transform = `scale(${1.2 - 0.14 * E.outExpo(P(b, 16, 17))})`;
    const c = E.spring(P(b, 16.15, 16.7)); set(s.el.querySelector('.card'), { transform: `translateY(${(1 - c) * 200}px)`, opacity: clamp(c * 2) });
  });
  const COPY = 'Sunset over the Pacific from every room, a pool carved into the bluff, and nine bedrooms of light-filled calm.';
  shot(17, 18, `${lightBg('cliff_sunset')}<div class="card lglass" style="top:300px;height:680px"><div class="k">Listing copy · written</div><div class="t" style="font-size:92px">Cliffside living, redefined.</div><div class="d" id="copyT" style="font-size:36px;line-height:1.42;margin-top:26px;color:rgba(11,11,18,.72)"></div></div>`, (b, s) => {
    $('#copyT').textContent = COPY.slice(0, Math.floor(COPY.length * P(b, 17.1, 17.85)));
    const c = E.outExpo(P(b, 17, 17.3)); set(s.el.querySelector('.card'), { transform: `translateY(${(1 - c) * 80}px) scale(${0.95 + 0.05 * c})` });
  });
  const G9 = ['cliff_pool', 'cliff_sunset', 'palm_estate', 'conservatory', 'living_room', 'nassau_living', 'hero_waterfront', 'malibu_pool', 'sarasota_bridgepool'];
  shot(18, 19, `${lightBg()}<div class="grid9">${G9.map(p => `<div style="background-image:${img(p)}"></div>`).join('')}</div><div class="pill" style="position:absolute;left:90px;top:1180px">PHOTOS · ORGANIZED ${CHECK(20)}</div>`, (b, s) => {
    $$('.grid9 div', s.el).forEach((d, i) => { const a = E.outBack(P(b, 18 + i * 0.07, 18 + i * 0.07 + 0.25)); set(d, { transform: `scale(${a})`, opacity: clamp(a * 3) }); });
  });
  shot(19, 20, `${lightBg('palm_estate')}<div class="ig"><div class="hd"><div class="av"></div>coastline.realty<span style="margin-left:auto;font:700 16px/1 var(--mono);letter-spacing:.14em;color:#7a6be0">SCHEDULED</span></div>
    <div class="img" style="background-image:${img('cliff_pool')}"><b>Just<br>listed.</b></div><div class="ft">♡ ◯ ➤<div class="dots"><i></i><i></i><i></i></div></div></div>`, (b, s) => {
    const a = E.outExpo(P(b, 19, 19.4)); set(s.el.querySelector('.ig'), { transform: `perspective(1600px) rotateY(${(1 - a) * -28 + 6}deg) rotateX(4deg) translateY(${(1 - a) * 80}px)` });
  });
  shot(20, 21, `${lightBg('nassau_living')}<div class="card" style="top:250px;padding:0"><div class="k" style="color:#7a6be0">DMs · answered</div><div class="t" style="margin-bottom:10px">Every reply, drafted.</div>
    <div class="bub in">Is this still available??</div><div class="bub out">Yes! I can show it Saturday at 10 or 11:30. Which works?</div><div class="bub in">Saturday 10 🙌</div></div>`, (b, s) => {
    $$('.bub', s.el).forEach((d, i) => { const a = E.spring(P(b, 20.05 + i * 0.25, 20.45 + i * 0.25)); set(d, { transform: `translateY(${(1 - a) * 60}px) scale(${0.9 + 0.1 * a})`, opacity: clamp(a * 2) }); });
  });
  shot(21, 22, `${lightBg('conservatory')}<div class="card lglass" style="top:300px"><div class="k">Calendar · synced</div><div class="t">Your whole week.</div>
    <div class="syncrow"><div class="sl">${GCAL(110)}<span>Google Calendar</span></div><div class="sl">${ACAL(110)}<span>Apple Calendar</span></div></div>
    <div class="row">Sat · 10:00 AM · Showing<span class="ok">ADDED ✓</span></div></div>`, (b, s) => {
    $$('.sl', s.el).forEach((d, i) => { const a = E.outBack(P(b, 21.05 + i * 0.12, 21.35 + i * 0.12)); set(d, { transform: `scale(${clamp(a, 0, 1.2)})`, opacity: clamp(a * 3) }); });
    const r = E.spring(P(b, 21.3, 21.7)); set(s.el.querySelector('.row'), { transform: `translateX(${(1 - r) * 300}px)`, opacity: clamp(r * 2) });
  });
  shot(22, 23, `${lightBg('sarasota_bridgepool')}<div class="card" style="top:250px;padding:0"><div class="k" style="color:#7a6be0">Showings · booked</div><div class="t" style="margin-bottom:10px">4 this weekend.</div>
    ${['Sat · 10:00 AM · Jordan', 'Sat · 11:30 AM · Priya', 'Sun · 1:00 PM · Marcus', 'Sun · 4:30 PM · the Ellises'].map(r => `<div class="row">${r}<span class="ok">BOOKED ✓</span></div>`).join('')}</div>`, (b, s) => {
    $$('.row', s.el).forEach((d, i) => { const a = E.spring(P(b, 22 + i * 0.2, 22.4 + i * 0.2)); set(d, { transform: `translateX(${(1 - a) * 300}px)`, opacity: clamp(a * 2) }); });
  });
  shot(23, 24, `${lightBg('hero_waterfront')}<div class="card" style="top:280px;padding:0"><div class="k" style="color:#7a6be0">Follow-ups · queued</div><div class="t" style="margin-bottom:10px">Nobody slips.</div>
    ${['Thanks for coming Sunday! Want a second look?', 'Hi Priya, the disclosures are ready for you.', 'Marcus, a similar home just hit in Malibu.'].map(m => `<div class="bub">${m}</div>`).join('')}</div>`, (b, s) => {
    $$('.bub', s.el).forEach((d, i) => { const a = E.spring(P(b, 23.1 + i * 0.25, 23.5 + i * 0.25)); set(d, { transform: `translateY(${(1 - a) * 60}px) scale(${0.9 + 0.1 * a})`, opacity: clamp(a * 2) }); });
  });
  shot(24, 25, `${lightBg('cliff_sunset')}<div class="card lglass" style="top:380px;text-align:center"><div class="k">Ready for approval</div><div class="t" style="font-size:96px">8 drafts.</div><div class="d">Copy · photos · posts · DMs · calendar · showings</div>
    <div id="apBtn" style="margin:34px auto 0;width:520px;height:100px;border-radius:50px;background:var(--ink);color:#fff;font:650 34px/100px var(--sans);position:relative;overflow:hidden"><b id="apFill" style="position:absolute;inset:0;background:linear-gradient(135deg,var(--blue),var(--violet) 55%,var(--peach));opacity:0"></b><span id="apTx" style="position:relative">Approve all</span></div></div>`, (b, s) => {
    const ok = b >= 24.5, f = E.outCubic(P(b, 24.5, 24.62)), press = ok && b < 24.7 ? 1 - 0.06 * Math.sin(P(b, 24.5, 24.7) * Math.PI) : 1;
    $('#apFill').style.opacity = f; $('#apTx').textContent = ok ? 'All approved ✓' : 'Approve all'; $('#apTx').style.color = ok ? 'var(--ink)' : '#fff';
    set($('#apBtn'), { transform: `scale(${press})`, boxShadow: ok ? `0 0 ${70 * pulseAt(b, 24.5, 2)}px rgba(166,140,255,.95)` : 'none' });
  });
  // montage: half-beat whip cuts
  TL.montage.forEach(([a, p, l], i) => shot(a, a + 0.5, `<div class="ph" style="background-image:${img(p)}"></div><div class="mono mlab">${l}</div><div class="serifW" style="top:250px;font-size:130px">Just say it.</div>`, (b, s) => {
    const k = E.outExpo(P(b, a, a + 0.2)), dir = i % 2 ? -1 : 1;
    s.el.querySelector('.ph').style.transform = `translateX(${(1 - k) * 380 * dir}px) scale(${1.15 - 0.06 * P(b, a, a + 0.5)})`;
    s.el.querySelector('.ph').style.filter = k < 0.95 ? `blur(${(1 - k) * 18}px)` : 'none';
  }, { montage: true }));
  // kicker words on white, photo in the type
  TL.kicker.forEach(([w, a, p]) => shot(a, a + 1, `<div class="mtx ink" style="background-image:${img(p)};font-size:${w.length > 8 ? 200 : 250}px">${w}</div><div class="pill" style="position:absolute;left:50%;top:860px;transform:translateX(-50%)">${CHECK(22)}</div>`, (b, s) => {
    const k = E.outExpo(P(b, a, a + 0.3)); set(s.el.querySelector('.mtx'), { transform: `translate(-50%,-50%) scale(${1.25 - 0.25 * k})`, backgroundPosition: `${30 + 40 * P(b, a, a + 1)}% 50%`, filter: 'saturate(1.2) drop-shadow(0 20px 40px rgba(40,30,110,.25))' });
    const c = E.outBack(P(b, a + 0.15, a + 0.4)); set(s.el.querySelector('.pill'), { transform: `translateX(-50%) scale(${c})` });
  }));
  shot(33, 34.5, `<div class="ph" style="background-image:${img('cliff_pool')};filter:brightness(.5)"></div><div class="mtx" style="background-image:${img('cliff_sunset')};font-size:210px;filter:brightness(1.4) saturate(1.2) drop-shadow(0 20px 60px rgba(0,0,0,.6))">Just works.</div>`, (b, s) => {
    const k = E.outExpo(P(b, 33, 33.5)); set(s.el.querySelector('.mtx'), { transform: `translate(-50%,-50%) scale(${1.3 - 0.3 * k})`, letterSpacing: `${-0.035 + 0.05 * (1 - k)}em`, backgroundPosition: `${50 + 20 * P(b, 33, 34.5)}% 50%` });
    s.el.querySelector('.ph').style.transform = `scale(${1.1 - 0.05 * P(b, 33, 34.5)})`;
  });
  // end card (light)
  shot(34.5, 43.6, `<div class="full" style="background:transparent"><div id="wordmark">Mila</div><div id="tagline"><div class="ln"><span>Your AI operations manager for real estate.</span></div></div>
    <div id="cta"><div class="ln"><span>Comment <span class="q">“Mila”</span></span></div><div class="ln"><span>for a 7-day free trial.</span></div></div></div>`, (b) => {
    const rise = E.outExpo(P(b, 34.5, 36.2));
    set($('#wordmark'), { top: (360 + 90 * (1 - rise)) + 'px', opacity: E.outCubic(P(b, 34.5, 35)), transform: `translateX(-50%) scale(${0.9 + 0.1 * rise})`, filter: `blur(${(1 - E.outCubic(P(b, 34.5, 35.5))) * 14}px)` });
    set($('#tagline'), { top: '660px', transform: 'translateX(-50%)' }); reveal($('#tagline .ln > span'), b, 35.2, 999, 1.0);
    set($('#cta'), { top: '750px', transform: 'translateX(-50%)' }); $$('#cta .ln > span').forEach((s, j) => reveal(s, b, 35.8 + j * 0.45, 999, 0.9));
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
  const CUT_T = [...CUTS.filter(x => x > 0), 7, 7.25, 7.5, 7.75, 12, 16, ...TL.feats, ...TL.montage.map(m => m[0]), ...TL.kicker.map(k => k[1]), 33, 34.5];

  /* ================================================================ RENDER */
  function render(t) {
    const raw = t / BEAT, b = raw;
    const tail = raw >= TL.loopTail[0], tailIn = E.inOut(P(raw, 42.1, 43.85));
    const lightWorld = b >= 16 && !tail;
    let cs = 1 + 0.004 * per(raw, 2), cx = per(raw, 3) * 2, cy = per(raw, 2) * 2;
    for (const T of CUT_T) { if (b >= T && b < T + 0.6) cs *= 1 + 0.035 * Math.exp(-(b - T) * 9); }
    if (b >= 16 && b < 33) { const ph = b % 1; cs *= 1 + 0.008 * Math.exp(-ph * 7); cy += 4 * Math.exp(-ph * 9); }
    if (b >= 15.5 && b < 16) cs *= 1 + 0.03 * E.inCubic(P(b, 15.5, 16));
    R.cam.style.transform = `translate(${cx}px,${cy}px) scale(${cs})`;
    vis(R.light, lightWorld || (b >= 34.4 && raw < 43.9));
    if (R.light.style.visibility !== 'hidden') {
      set(R.gA, { left: (240 + per(raw, 2) * 160) + 'px', top: (480 + perc(raw, 1) * 140) + 'px', opacity: 0.8 });
      set(R.gB, { left: (860 + perc(raw, 2) * 140) + 'px', top: (760 + per(raw, 1) * 160) + 'px', opacity: 0.75 });
      set(R.gC, { left: (540 + per(raw, 1) * 220) + 'px', top: 1180 + 'px', opacity: 0.7 });
      R.light.style.opacity = tail ? 1 - tailIn : 1;
    }
    for (const s of SH) {
      let on;
      if (s.hook) on = b < s.b || raw >= 42.1;
      else if (s.end) on = b >= s.a && raw < 43.95;
      else on = b >= s.a && b < s.b && !tail;
      vis(s.el, on); if (!on) continue;
      if (s.hook) { s.upd(tail ? 0 : b, s); s.el.style.opacity = tail ? tailIn : 1; }
      else if (s.end) { s.upd(b, s); s.el.style.opacity = tail ? 1 - tailIn : 1; }
      else s.upd(b, s);
    }
    const lb = tail ? tailIn : 1 - E.outExpo(P(b, 15.95, 16.25));
    R.lbT.style.transform = `translateY(${-(1 - lb) * 180}px)`; R.lbB.style.transform = `translateY(${(1 - lb) * 180}px)`;
    vis(R.lbT, lb > 0.001); vis(R.lbB, lb > 0.001);
    const leakT = [16, 25, 29, 33, 34.5].find(T => b >= T && b < T + 0.8);
    vis(R.leak, leakT !== undefined && !tail);
    if (leakT !== undefined) { const p = P(b, leakT, leakT + 0.8); set(R.leak, { transform: `translateX(${lerp(-1100, 1100, E.inOut(p))}px)`, opacity: Math.sin(p * Math.PI) }); }
    const fl = tail ? 0 : Math.max(b >= 15.9 && b < 16 ? P(b, 15.9, 16) : 0, 0.95 * pulseAt(b, 16, 5), ...[4, 4.5, 5, 5.5, 6, 6.5].map(x => 0.18 * pulseAt(b, x, 12)), 0.5 * pulseAt(b, 33, 6), 0.35 * pulseAt(b, 34.5, 6),
      b >= 7 && b < 8 ? 0.3 * pulseAt(b % 0.25, 0, 30) : 0, ...TL.kicker.map(k => 0.35 * pulseAt(b, k[1], 10)));
    R.flash.style.opacity = fl; vis(R.flash, fl > 0.002);
    R.vig.style.opacity = lightWorld ? 0.35 : 1;
    const fi = Math.floor(t * 60), nz = NOISE[fi % 8], gx = (fi * 137) % 540, gy = (fi * 251) % 675;
    gctx.drawImage(nz, -gx, -gy); gctx.drawImage(nz, 540 - gx, -gy); gctx.drawImage(nz, -gx, 675 - gy); gctx.drawImage(nz, 540 - gx, 675 - gy);
    grain.style.opacity = lightWorld ? 0.14 : 0.24;
  }
  window.renderFrame = render; window.DURATION = DUR;
  for (const tw of [0, 1.2, 2.2, 3.7, 4.2, 4.7, 5.2, 5.7, 6.2, 6.7, 7.1, 9, 10.2, 10.7, 11.2, 11.7, 12.5, 14.5, 15.7, 16.4, 17.5, 18.5, 19.5, 20.5, 21.5, 22.5, 23.5, 24.6, 25.3, 27.2, 29.5, 31.5, 33.5, 37, 43.5, 43.95]) render(tw * BEAT);
  render(0); window.__ready = true;
  if (!RENDER) {
    const aud = $('#aud'), pp = $('#pp'), scrub = $('#scrub'), tc = $('#tc'); scrub.max = DUR; let playing = false;
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (aud.currentTime >= DUR - 0.05) aud.currentTime = 0; aud.play(); } else aud.pause(); };
    scrub.oninput = () => { aud.currentTime = +scrub.value; render(+scrub.value); tc.textContent = (+scrub.value).toFixed(2) + 's'; };
    const loop = () => { if (playing) { const t = aud.currentTime; render(t); scrub.value = t; } requestAnimationFrame(loop); }; loop();
  }
})();
