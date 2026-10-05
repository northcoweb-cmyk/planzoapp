/* HouseDAW — mixer: channel strips, sends, routing, master, meters driven by the real audio graph. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const el = HD.el, UI = HD.UI, S = HD.State;
  const X = (HD.Mixer = { meters: {} });
  const PANK = { n: 'Pan', min: -1, max: 1, def: 0, curve: 'lin' }, SENDK = { n: 'Send', min: 0, max: 1, def: 0, curve: 'lin' };
  const db = (g) => (g <= 0.0005 ? '-∞' : (20 * Math.log10(g)).toFixed(1));

  X.init = (root) => {
    X.root = root; X.render();
    HD.bus.on('change', (e) => { if (e.kind === 'notes' || e.kind === 'auto') return; X.render(); });
    HD.bus.on('project', () => X.render()); HD.bus.on('selection', () => X.markSel());
    X.loop();
  };
  const live = (fn) => { fn(); HD.engine.sync(); };

  X.render = () => {
    const root = X.root; if (!root || !S.project) return; const keep = root.scrollLeft; root.innerHTML = ''; X.meters = {};
    const P = S.project, wrap = el('div', { class: 'mx-strips' });
    for (const t of P.tracks) wrap.append(X.strip(t));
    if (!P.tracks.length) wrap.append(el('div', { class: 'empty', style: { padding: '30px' }, text: 'No tracks yet — the mixer fills up as you add sounds.' }));
    const right = el('div', { class: 'mx-right' }, X.sendStrip('a'), X.sendStrip('b'), X.masterStrip());
    root.append(wrap, right); root.scrollLeft = keep; X.markSel();
  };
  X.markSel = () => X.root && X.root.querySelectorAll('.strip[data-track]').forEach((s) => s.classList.toggle('sel', s.dataset.track === S.sel.track));

  const fader = (get, set, end, big) => {
    const i = el('input', { type: 'range', class: 'fader', min: 0, max: 1, step: 0.001, value: S.gainToFader(get()), orient: 'vertical' });
    const rd = el('div', { class: 'db', text: db(get()) });
    let snap = null;
    i.addEventListener('pointerdown', () => (snap = S.begin())); i.addEventListener('dblclick', () => { snap = S.begin(); const g = 0.8; set(g); i.value = S.gainToFader(g); rd.textContent = db(g); end(snap); });
    i.addEventListener('input', () => { const g = S.faderToGain(parseFloat(i.value)); live(() => set(g)); rd.textContent = db(g); });
    i.addEventListener('change', () => { end(snap); snap = null; });
    return [i, rd];
  };
  const meter = (key) => {
    const m = el('div', { class: 'meter' }, el('div', { class: 'mbar' }, el('i')), el('div', { class: 'mbar' }, el('i')), el('div', { class: 'clip-led' }));
    m.addEventListener('click', () => m.classList.remove('hot')); X.meters[key] = { el: m, v: [0, 0], hot: 0 }; return m;
  };

  X.strip = (t) => {
    const P = S.project, buses = P.tracks.filter((x) => x.type === 'bus' && x.id !== t.id);
    const [f, rd] = fader(() => t.vol, (g) => (t.vol = g), (snap) => S.end(snap, 'Volume', 'mixer'));
    const fxs = el('div', { class: 'st-fx' }, t.fx.slice(0, 5).map((x) => el('div', { class: 'pill' + (x.bypass ? ' off' : ''), text: HD.FXDEF[x.type].name.split(' ')[0], title: HD.FXDEF[x.type].name, onclick: () => { S.sel.track = t.id; HD.Dock.show('device'); HD.bus.emit('selection', S.sel); } })), el('div', { class: 'pill add', text: t.fx.length > 5 ? '+' + (t.fx.length - 5) : '＋ FX', onclick: () => { S.sel.track = t.id; HD.Dock.show('device'); HD.bus.emit('selection', S.sel); } }));
    const knob = (d, val, set, key) => UI.knob(d, val, { size: 30, cls: 'mini', onStart: () => (X._snap = S.begin()), onInput: (v) => live(() => set(v)), onEnd: () => S.end(X._snap, key, 'mixer') });
    const s = el('div', { class: 'strip' + (S.sel.track === t.id ? ' sel' : ''), 'data-track': t.id, style: { '--c': t.color } },
      el('div', { class: 'st-name', text: t.name, title: t.name, onclick: () => { S.sel.track = t.id; HD.bus.emit('selection', S.sel); } }), fxs,
      el('div', { class: 'st-knobs' }, knob({ ...SENDK, n: 'Verb' }, t.sendA || 0, (v) => (t.sendA = v), 'Send'), knob({ ...SENDK, n: 'Echo' }, t.sendB || 0, (v) => (t.sendB = v), 'Send'), knob(PANK, t.pan, (v) => (t.pan = v), 'Pan')),
      el('div', { class: 'st-main' }, el('div', { class: 'fwrap' }, f), meter(t.id)), rd,
      el('div', { class: 'st-btns' }, el('button', { class: 'tb m' + (t.mute ? ' on' : ''), text: 'M', onclick: () => S.mutate('Mute', () => (t.mute = !t.mute), 'mixer') }), el('button', { class: 'tb s' + (t.solo ? ' on' : ''), text: 'S', onclick: () => S.mutate('Solo', () => (t.solo = !t.solo), 'mixer') })),
      UI.select([['master', 'Out: Master'], ...buses.map((b) => [b.id, 'Out: ' + b.name])], t.out || 'master', (v) => S.mutate('Routing', () => (t.out = v), 'mixer'), 'small route'));
    return s;
  };

  X.masterStrip = () => {
    const P = S.project, m = P.master;
    const [f, rd] = fader(() => m.vol, (g) => (m.vol = g), (snap) => S.end(snap, 'Master volume', 'mixer'));
    return el('div', { class: 'strip master' }, el('div', { class: 'st-name', text: 'MASTER' }),
      el('div', { class: 'st-fx' }, m.fx.map((x) => el('div', { class: 'pill' + (x.bypass ? ' off' : ''), text: HD.FXDEF[x.type].name.split(' ')[0], onclick: () => HD.Dock.show('master') })), el('div', { class: 'pill add', text: 'Master FX', onclick: () => HD.Dock.show('master') })),
      el('div', { class: 'st-main' }, el('div', { class: 'fwrap' }, f), meter('master')), rd, el('button', { class: 'btn small', text: 'Mastering ▸', onclick: () => HD.Dock.show('master') }));
  };
  X.sendStrip = (k) => {
    const P = S.project, s = P.sends[k];
    const [f, rd] = fader(() => s.ret, (g) => (s.ret = g), (snap) => S.end(snap, 'Return level', 'mixer'));
    return el('div', { class: 'strip send' }, el('div', { class: 'st-name', text: (k === 'a' ? 'REVERB' : 'ECHO') + ' RETURN' }),
      el('div', { class: 'st-fx' }, el('div', { class: 'pill', text: HD.FXDEF[s.fx.type].name, onclick: () => HD.Device.editSend(k) }), el('div', { class: 'pill add', text: 'Edit', onclick: () => HD.Device.editSend(k) })),
      el('div', { class: 'st-main' }, el('div', { class: 'fwrap' }, f)), rd);
  };

  // meters
  const norm = (p) => (p <= 0.001 ? 0 : HD.clamp((20 * Math.log10(p) + 60) / 60, 0, 1));
  X.loop = () => {
    const f = () => {
      const e = HD.engine, visible = HD.Dock && (HD.Dock.tab === 'mixer' || HD.Dock.tab === 'master');
      if (e && visible) {
        for (const key in X.meters) {
          const mt = X.meters[key], n = key === 'master' ? e.master : (e.tracks.get(key) || {}).meter; if (!n) continue;
          const pk = e.readMeter(n);
          mt.v[0] = Math.max(norm(pk[0]), mt.v[0] - 0.025); mt.v[1] = Math.max(norm(pk[1]), mt.v[1] - 0.025);
          const bars = mt.el.querySelectorAll('.mbar i'); bars[0].style.clipPath = `inset(${(1 - mt.v[0]) * 100}% 0 0 0)`; bars[1].style.clipPath = `inset(${(1 - mt.v[1]) * 100}% 0 0 0)`;
          if (Math.max(pk[0], pk[1]) >= 0.995) mt.el.classList.add('hot');
        }
      }
      if (HD.Master && HD.Dock && HD.Dock.tab === 'master') HD.Master.frame();
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  };
})();
