/* HouseDAW — device view (instrument + FX rack), master tab and mastering section. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const el = HD.el, UI = HD.UI, S = HD.State, Lib = HD.Lib, FD = HD.FXDEF;
  const Dv = (HD.Device = {}), Ms = (HD.Master = {});
  const live = () => HD.engine.sync();
  const get = (o, path) => path.split('.').reduce((a, k) => a[k], o);
  const set = (o, path, v) => { const ks = path.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };

  // ---------- FX rack ----------
  Dv.rack = (owner, opts = {}) => {
    const wrap = el('div', { class: 'rack' }), list = owner.fx, track = opts.track;
    const kind = opts.master ? 'master' : 'fx';
    list.forEach((fx, i) => {
      const def = FD[fx.type];
      const head = el('div', { class: 'fx-head' }, el('span', { class: 'fx-name', text: def.name }),
        el('button', { class: 'tb' + (fx.bypass ? '' : ' on'), text: '⏻', title: fx.bypass ? 'Enable' : 'Bypass', onclick: () => S.mutate('Bypass fx', () => (fx.bypass = !fx.bypass), 'fx') }),
        el('button', { class: 'icon-btn', text: '◀', title: 'Move earlier', onclick: () => S.mutate('Move fx', () => { if (i > 0) { list.splice(i, 1); list.splice(i - 1, 0, fx); } }, 'fx') }),
        el('button', { class: 'icon-btn', text: '▶', title: 'Move later', onclick: () => S.mutate('Move fx', () => { if (i < list.length - 1) { list.splice(i, 1); list.splice(i + 1, 0, fx); } }, 'fx') }),
        el('button', { class: 'icon-btn', text: '✕', title: 'Remove effect', onclick: () => S.mutate('Remove fx', () => list.splice(i, 1), 'fx') }));
      const knobs = el('div', { class: 'fx-knobs' });
      for (const d of def.params) {
        knobs.append(UI.knob(d, fx.p[d.k] == null ? d.def : fx.p[d.k], {
          size: 40, onStart: () => (Dv._snap = S.begin()), onInput: (v) => { fx.p[d.k] = v; live(); }, onEnd: () => S.end(Dv._snap, def.name + ' ' + d.n, 'fx'),
          onContext: (e) => {
            const items = [{ label: 'Reset to default', onClick: () => S.mutate('Reset', () => (fx.p[d.k] = d.def), 'fx') }];
            if (track && (S.AUTOFX[fx.type] || []).includes(d.k)) items.push({ label: 'Automate “' + def.name + ' – ' + d.n + '” on the timeline', onClick: () => Dv.automate(track, fx, d) });
            UI.menu(items, e.clientX, e.clientY);
          },
        }));
      }
      wrap.append(el('div', { class: 'fx-card' + (fx.bypass ? ' off' : '') + ' fx-' + fx.type }, head, knobs));
    });
    if (!list.length) wrap.append(el('div', { class: 'empty', text: 'No effects yet. Add one below, or pick a House preset.' }));
    return wrap;
  };
  Dv.automate = (t, fx, d) => {
    S.mutate('Automation lane', () => {
      const key = `fx:${fx.id}:${d.k}`, def = S.paramDef(t, key); t.auto[key] = t.auto[key] || [{ t: 0, v: HD.clamp(def.fromNat(fx.p[d.k]), 0, 1) }, { t: 32, v: HD.clamp(def.fromNat(fx.p[d.k]), 0, 1) }]; t.autoShow = key;
    });
    HD.toast('Automation lane added under the track in the arrangement — drag its points to shape it');
  };
  Dv.addBar = (owner, opts = {}) => {
    const types = FD.types.map((k) => [k, FD[k].name]);
    const add = UI.select([['', '＋ Add effect…'], ...types], '', (v) => { if (!v) return; S.mutate('Add fx', () => owner.fx.push(S.newFx(v)), 'fx'); add.value = ''; }, 'fxadd');
    const pres = HD.FXPRESETS.filter((p) => opts.master ? true : p.for === 'any');
    const ps = UI.select([['', '★ House FX presets…'], ...pres.map((p) => [p.name, p.name])], '', (v) => {
      if (!v) return; const p = HD.FXPRESETS.find((x) => x.name === v);
      S.mutate('FX preset ' + v, () => { owner.fx = p.chain.map(([type, params]) => S.newFx(type, params)); if (opts.master) S.project.master.fx = owner.fx; else if (opts.track) opts.track.fx = owner.fx; }, 'fx'); HD.toast('Applied “' + v + '” — ' + p.chain.map((c) => FD[c[0]].name).join(' → ')); ps.value = '';
    }, 'fxadd');
    return el('div', { class: 'fx-bar' }, add, ps, el('button', { class: 'btn small', text: 'Clear all', onclick: () => S.mutate('Clear fx', () => (owner.fx.length = 0), 'fx') }));
  };

  // ---------- device tab ----------
  Dv.init = (root) => { Dv.root = root; Dv.render(); HD.bus.on('change', (e) => { if (e.kind !== 'notes' && e.kind !== 'transport' && e.kind !== 'auto') Dv.render(); }); HD.bus.on('selection', () => Dv.render()); HD.bus.on('project', () => Dv.render()); };
  const INST = [['Cutoff', 'filt.f', 40, 18000, 'log', 'Hz'], ['Resonance', 'filt.q', 0.1, 20, 'log'], ['Env Amt', 'filt.env', 0, 9000, 'lin', 'Hz'], ['Attack', 'amp.a', 0.001, 2.5, 'log', 's'], ['Decay', 'amp.d', 0.02, 3, 'log', 's'], ['Sustain', 'amp.s', 0, 1, 'lin'], ['Release', 'amp.r', 0.01, 4, 'log', 's'], ['Drive', 'drive', 0, 1, 'lin'], ['Compress', 'comp', 0, 1, 'lin'], ['Width', 'width', 0, 2, 'lin'], ['Sub', 'sub', 0, 1.2, 'lin'], ['Level', 'lvl', 0.05, 1.2, 'lin']];
  Dv.render = () => {
    const root = Dv.root; if (!root || !S.project) return; const t = S.track(S.sel.track), keep = root.scrollTop; root.innerHTML = '';
    if (!t) { root.append(el('div', { class: 'empty big', text: 'Select a track to see its instrument and effects.' })); return; }
    const head = el('div', { class: 'dv-head', style: { '--c': t.color } }, el('span', { class: 'dv-dot' }), el('span', { class: 'dv-title', text: t.name }), el('span', { class: 'dv-type', text: { drum: 'Drum track', inst: 'Instrument track', audio: 'Audio track', bus: 'Group track' }[t.type] }));
    root.append(head);
    if (t.type === 'inst' && t.inst) root.append(Dv.instPanel(t));
    root.append(el('div', { class: 'dv-sec' }, el('div', { class: 'dv-label', text: 'INSERT EFFECTS  (signal flows left → right)' }), Dv.addBar(t, { track: t }), Dv.rack(t, { track: t })));
    root.scrollTop = keep;
  };
  Dv.instPanel = (t) => {
    const p = t.inst.preset, bass = Lib.byId[t.inst.presetId] ? Lib.byId[t.inst.presetId].cat : 'SYNTHS';
    const sel = el('select', { class: 'sel preset-sel' });
    for (const [lab, cat] of [['BASS', 'BASS'], ['SYNTHS', 'SYNTHS'], ['MY SOUNDS', 'MY SOUNDS']]) {
      const g = el('optgroup', { label: lab }); Lib.items.filter((i) => i.type === 'inst' && i.cat === cat).forEach((i) => { const o = el('option', { value: i.id, text: i.name + ' · ' + i.sub }); if (i.id === t.inst.presetId) o.selected = true; g.append(o); }); if (g.children.length) sel.append(g);
    }
    sel.addEventListener('change', () => S.mutate('Change instrument', () => S.setInstrument(t, Lib.byId[sel.value].preset), 'fx'));
    const wave = (idx) => { const L = p.osc[idx]; if (!L) return el('span', { class: 'hint', text: '—' }); return UI.select(['sine', 'triangle', 'sawtooth', 'square', 'organ', 'glass', 'warm', 'pulse', 'hollow', 'tine'], L.w, (v) => S.mutate('Oscillator', () => (L.w = v), 'fx'), 'small'); };
    const knobs = el('div', { class: 'inst-knobs' });
    for (const [n, path, min, max, curve, u] of INST) {
      const d = { n, min, max, curve, u, def: get(HD.Presets.byId[t.inst.presetId] || p, path) };
      knobs.append(UI.knob(d, get(p, path), { size: 44, onStart: () => (Dv._snap = S.begin()), onInput: (v) => { set(p, path, v); live(); }, onEnd: () => S.end(Dv._snap, 'Instrument', 'fx') }));
    }
    const uni = el('div', { class: 'osc-row' }, el('span', { class: 'lbl', text: 'Osc 1' }), wave(0), el('span', { class: 'lbl', text: 'Osc 2' }), wave(1), el('span', { class: 'lbl', text: 'Unison' }),
      UI.select([1, 2, 3, 4, 5, 6, 7], p.osc[0].uni || 1, (v) => S.mutate('Unison', () => (p.osc[0].uni = parseInt(v, 10)), 'fx'), 'small'), el('span', { class: 'lbl', text: 'Spread' }), UI.slider(0, 60, p.osc[0].sp || 0, 1, (v) => { p.osc[0].sp = v; live(); }, () => S.touch('fx')));
    const save = el('button', { class: 'btn small', text: 'Save to My Sounds', onclick: () => { const nm = prompt('Name for this instrument preset', t.name + ' (custom)'); if (nm) HD.Gen.saveUserPreset(nm, p); } });
    const prev = el('button', { class: 'btn small', text: '▶ Play note', onclick: () => { HD.engine.ctx.resume(); HD.engine.auditionNote(t.id, p.pv || 60, 0.85, 0.8); } });
    return el('div', { class: 'dv-sec inst' }, el('div', { class: 'dv-label', text: 'INSTRUMENT' }), el('div', { class: 'inst-top' }, sel, prev, save), uni, knobs);
  };
  Dv.editSend = (k) => {
    const s = S.project.sends[k], box = el('div', { class: 'rack' });
    const def = FD[s.fx.type], knobs = el('div', { class: 'fx-knobs' });
    for (const d of def.params) { if (d.k === 'wet' || d.k === 'dry') continue; knobs.append(UI.knob(d, s.fx.p[d.k], { size: 44, onStart: () => (Dv._snap = S.begin()), onInput: (v) => { s.fx.p[d.k] = v; live(); }, onEnd: () => S.end(Dv._snap, 'Send fx', 'fx') })); }
    UI.modal({ title: (k === 'a' ? 'Reverb' : 'Echo') + ' send effect (shared by every track’s send knob)', width: 520, body: el('div', {}, box.appendChild(el('div', { class: 'fx-card fx-' + s.fx.type }, el('div', { class: 'fx-head' }, el('span', { class: 'fx-name', text: def.name })), knobs)) && box) });
  };

  // ---------- master tab ----------
  Ms.init = (root) => { Ms.root = root; Ms.render(); HD.bus.on('change', (e) => { if (e.kind !== 'notes' && e.kind !== 'transport' && e.kind !== 'auto') Ms.render(); }); HD.bus.on('project', () => Ms.render()); };
  Ms.render = () => {
    const root = Ms.root; if (!root || !S.project) return; root.innerHTML = '';
    const m = S.project.master, ms = m.mastering;
    const mk = (k, n, min, max, u) => UI.knob({ n, min, max, def: HD.MASTER_PRESETS.Clean[k], u, curve: 'lin' }, ms[k], { size: 54, onStart: () => (Ms._snap = S.begin()), onInput: (v) => { ms[k] = v; ms.preset = null; live(); }, onEnd: () => S.end(Ms._snap, 'Mastering', 'fx') });
    const mast = el('div', { class: 'ms-box' }, el('div', { class: 'dv-label', text: 'MASTERING  (simple, beginner-friendly)' }),
      el('div', { class: 'ms-presets' }, el('button', { class: 'tb' + (ms.on !== false ? ' on' : ''), text: ms.on !== false ? 'ON' : 'OFF', onclick: () => S.mutate('Mastering on/off', () => (ms.on = ms.on === false), 'fx') }),
        Object.keys(HD.MASTER_PRESETS).map((n) => el('button', { class: 'btn small' + (ms.preset === n ? ' on' : ''), text: n, onclick: () => S.mutate('Mastering preset ' + n, () => Object.assign(ms, HD.MASTER_PRESETS[n], { preset: n, on: true }), 'fx') }))),
      el('div', { class: 'ms-knobs' }, mk('loud', 'Loudness', 0, 1), mk('bass', 'Bass', -9, 9, 'dB'), mk('treble', 'Treble', -9, 9, 'dB'), mk('punch', 'Punch', 0, 1), mk('width', 'Stereo Width', 0, 1.6)),
      el('div', { class: 'hint', text: 'Real DSP: low/high shelves, parallel slow-attack compression (punch), mid/side width, gain into a brick-wall limiter. A handy finishing touch — not a replacement for professional mastering.' }));
    const fx = el('div', { class: 'ms-box wide' }, el('div', { class: 'dv-label', text: 'MASTER CHANNEL  (EQ → compression → saturation → limiter)' }), Dv.addBar(m, { master: true }), Dv.rack(m, { master: true }));
    Ms.cv = el('canvas', { class: 'spec', width: 520, height: 150 }); Ms.read = el('div', { class: 'ms-read', text: '' });
    const spec = el('div', { class: 'ms-box spec-box' }, el('div', { class: 'dv-label', text: 'MASTER SPECTRUM' }), Ms.cv, Ms.read);
    root.append(el('div', { class: 'ms-wrap' }, fx, mast, spec, Ms.refBox()));
  };

  // ---------- Reference A/B: load a track you like, compare balance, match your mix to it ----------
  Ms.last = null;
  Ms.refBox = () => {
    const R = HD.Ref, An = HD.Analyze, box = el('div', { class: 'ms-box ref-box' }), cv = el('canvas', { class: 'refcv', width: 560, height: 190 }), info = el('div', { class: 'ms-read', style: { whiteSpace: 'pre-line' } });
    const T = () => (R.current ? R.current.profile : An.TARGETS.house), Tname = () => (R.current ? '“' + R.current.name + '”' : 'built-in house profile');
    const draw = () => {
      const g = cv.getContext('2d'), W = cv.width, H = cv.height, bands = An.BANDS, bw = (W - 50) / bands.length; g.clearRect(0, 0, W, H);
      const y = (db) => 14 + (1 - HD.clamp((db + 30) / 30, 0, 1)) * (H - 52);
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.fillStyle = '#7a7f90'; g.font = '10px sans-serif'; [0, -10, -20, -30].forEach((db) => { g.beginPath(); g.moveTo(40, y(db)); g.lineTo(W, y(db)); g.stroke(); g.fillText(db + ' dB', 4, y(db) + 3); });
      bands.forEach(([k], i) => {
        const x = 46 + i * bw, tv = T()[k]; g.fillStyle = '#ffb066'; g.fillRect(x + 4, y(tv), bw * 0.36, H - 38 - y(tv));
        if (Ms.last) { g.fillStyle = '#8a7bff'; g.fillRect(x + 8 + bw * 0.36, y(Ms.last.bands[k]), bw * 0.36, H - 38 - y(Ms.last.bands[k])); }
        g.fillStyle = '#9aa0b4'; g.fillText(An.LABEL[k].split(' ')[0], x + 6, H - 24); g.fillText(An.LABEL[k].split(' ').slice(1).join(' '), x + 6, H - 12);
      });
      g.fillStyle = '#ffb066'; g.fillRect(W - 190, 4, 10, 10); g.fillStyle = '#c9cde0'; g.fillText(R.current ? 'Reference' : 'House profile', W - 175, 13); g.fillStyle = '#8a7bff'; g.fillRect(W - 90, 4, 10, 10); g.fillStyle = '#c9cde0'; g.fillText('Your mix', W - 75, 13);
    };
    const text = () => {
      const lines = []; if (R.current) lines.push(`Reference: ${R.current.name} · ~${R.current.tempo} BPM · crest ${R.current.crest.toFixed(1)} dB · side/mid in highs ${R.current.side.himid.toFixed(1)} dB`);
      if (Ms.last) { const t = T(); lines.push('Your mix vs ' + Tname() + ': ' + An.BANDS.map(([k]) => `${k} ${(Ms.last.bands[k] - t[k] > 0 ? '+' : '') + (Ms.last.bands[k] - t[k]).toFixed(1)}`).join('  ') + `  → average error ${An.distance(Ms.last, t).toFixed(1)} dB`); }
      else lines.push('Press “Measure my mix” to compare.'); info.textContent = lines.join('\n');
    };
    const measure = async () => { HD.App.busy('Measuring your mix…'); try { Ms.last = await HD.Mix.measure(S.project); } catch (e) { console.error(e); } HD.App.idle(); draw(); text(); };
    const file = () => {
      const i = document.createElement('input'); i.type = 'file'; i.accept = 'audio/*,.wav,.mp3,.aif,.aiff,.ogg,.m4a,.flac';
      i.onchange = async () => { const f = i.files[0]; if (!f) return; HD.App.busy('Analysing reference…'); try { const ab = await f.arrayBuffer(), buf = await HD.Import.decode(ab, f.name); await new Promise((r) => setTimeout(r, 30)); R.set(f.name.replace(/\.[^.]+$/, ''), buf); Ms.last = Ms.last || (await HD.Mix.measure(S.project)); HD.toast('Reference loaded — nothing is uploaded or stored; only its measured balance is used'); } catch (e) { HD.toast('Could not read that file: ' + e.message, 4500); } HD.App.idle(); draw(); text(); };
      i.click();
    };
    const balance = async () => {
      HD.App.busy('Balancing your mix to ' + Tname() + '…'); await new Promise((r) => setTimeout(r, 30));
      try { const snap = S.begin(), before = Ms.last || (await HD.Mix.measure(S.project)), d0 = An.distance(before, T()); const res = await HD.Mix.autoMix(S.project, { target: T(), iterations: 3, onProgress: (f, m) => { const e = document.querySelector('.busy-msg'); if (e) e.textContent = m; } }); Ms.last = res.analysis; S.end(snap, 'Balance to reference', 'mixer'); HD.toast(`Balanced to ${Tname()}: error ${d0.toFixed(1)} → ${res.distance.toFixed(1)} dB` + (res.log.length ? ' (' + res.log.join(', ') + ')' : ' — already close'), 5000); } catch (e) { console.error(e); HD.toast('Balance failed: ' + e.message, 4000); }
      HD.App.idle(); draw(); text();
    };
    let playing = false;
    box.append(el('div', { class: 'dv-label', text: 'REFERENCE A/B — match your mix to a track you like' }),
      el('div', { class: 'ms-presets' }, el('button', { class: 'btn small primary', text: '⬆ Load reference track…', onclick: file }), el('button', { class: 'btn small', text: 'Measure my mix', onclick: measure }), el('button', { class: 'btn small primary', text: '⚖ Balance my mix to it', onclick: balance }),
        el('button', { class: 'btn small', text: '▶ Play reference', onclick: (e) => { if (!R.current) { HD.toast('Load a reference track first'); return; } if (playing) { HD.engine.stopPreview(); playing = false; e.target.textContent = '▶ Play reference'; } else { HD.engine.ctx.resume(); HD.engine.previewBuffer(R.current.buf, () => { playing = false; e.target.textContent = '▶ Play reference'; }); playing = true; e.target.textContent = '■ Stop'; } } }),
        el('button', { class: 'btn small', text: 'Use its tempo', onclick: () => { if (!R.current) { HD.toast('Load a reference track first'); return; } HD.Actions.setBpm(R.current.tempo); HD.toast('Tempo → ~' + R.current.tempo + ' BPM (estimate from the reference)'); } }),
        R.current ? el('button', { class: 'btn small', text: 'Back to house profile', onclick: () => { R.current = null; draw(); text(); } }) : null),
      cv, info, el('div', { class: 'hint', text: 'Analysis only — the reference audio is never uploaded, saved or copied; the app just measures its frequency balance (the orange bars) and nudges your track levels toward it. It won’t copy a song, but it makes your mix sit like the one you love.' }));
    setTimeout(() => { draw(); text(); }, 0); return box;
  };
  Ms.frame = () => {
    const e = HD.engine, cv = Ms.cv; if (!e || !e.master || !cv || !cv.isConnected) return;
    const an = e.master.a; if (!Ms.fft) Ms.fft = new Uint8Array(an.frequencyBinCount);
    an.getByteFrequencyData(Ms.fft); const g = cv.getContext('2d'), W = cv.width, H = cv.height; g.clearRect(0, 0, W, H);
    const sr = e.ctx.sampleRate, n = Ms.fft.length; g.fillStyle = 'rgba(124,108,240,.85)';
    for (let x = 0; x < W; x += 3) { const f = 20 * Math.pow(1000, x / W), bin = Math.min(n - 1, Math.floor((f / (sr / 2)) * n)); const v = Ms.fft[bin] / 255; g.fillRect(x, H - v * H, 2, v * H); }
    g.fillStyle = '#7a7f90'; g.font = '10px sans-serif'; [50, 100, 500, 1000, 5000, 10000].forEach((f) => { const x = (Math.log(f / 20) / Math.log(1000)) * W; g.fillText(f >= 1000 ? f / 1000 + 'k' : f, x, H - 3); });
    const pk = e.readMeter(e.master); Ms.read.textContent = 'Peak  L ' + HD.gainToDb(pk[0]).toFixed(1) + ' dB   R ' + HD.gainToDb(pk[1]).toFixed(1) + ' dB';
  };
})();
