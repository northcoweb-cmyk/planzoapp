/* HouseDAW — bottom dock (editor/mixer/device/master tabs) and right panel (inspector + AI producer). */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const el = HD.el, UI = HD.UI, S = HD.State, Lib = HD.Lib, A = HD.Actions;
  const Dock = (HD.Dock = { tab: 'editor' }), Right = (HD.Right = { tab: 'inspector', log: [] });

  // ---------- dock ----------
  Dock.init = (root) => {
    Dock.root = root; root.innerHTML = '';
    const tabs = [['editor', '🎹 Editor'], ['mixer', '🎚 Mixer'], ['device', '🎛 Device & FX'], ['master', '🏁 Master']];
    Dock.bar = el('div', { class: 'dock-tabs' }, tabs.map(([k, l]) => el('button', { class: 'dock-tab', 'data-t': k, text: l, onclick: () => Dock.show(k) })), el('span', { class: 'grow' }), el('span', { class: 'hint', id: 'dock-hint' }));
    Dock.panes = {};
    for (const [k] of tabs) { Dock.panes[k] = el('div', { class: 'dock-pane', 'data-t': k }); }
    Dock.roll = el('div', { class: 'ed roll' }); Dock.drum = el('div', { class: 'ed drum' }); Dock.audio = el('div', { class: 'ed audio' }); Dock.none = el('div', { class: 'ed none' }, el('div', { class: 'empty big', text: 'Double-click a clip in the arrangement to edit it here: MIDI clips open the piano roll, drum clips open the step sequencer.' }));
    Dock.panes.editor.append(Dock.roll, Dock.drum, Dock.audio, Dock.none);
    root.append(Dock.bar, ...Object.values(Dock.panes));
    HD.PianoRoll.init(Dock.roll); HD.DrumSeq.init(Dock.drum); HD.Mixer.init(Dock.panes.mixer); HD.Device.init(Dock.panes.device); HD.Master.init(Dock.panes.master);
    Dock.show('editor'); Dock.mode(null);
    HD.bus.on('selection', () => Dock.follow()); HD.bus.on('project', () => Dock.follow());
  };
  Dock.show = (tab) => {
    Dock.tab = tab; Dock.bar.querySelectorAll('.dock-tab').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
    for (const k in Dock.panes) Dock.panes[k].classList.toggle('on', k === tab);
    if (tab === 'editor') { HD.PianoRoll.layout(); } if (tab === 'mixer') HD.Mixer.render(); if (tab === 'master') HD.Master.render();
  };
  Dock.mode = (type) => { Dock.roll.style.display = type === 'midi' ? 'flex' : 'none'; Dock.drum.style.display = type === 'drum' ? 'flex' : 'none'; Dock.audio.style.display = type === 'audio' ? 'flex' : 'none'; Dock.none.style.display = !type ? 'flex' : 'none'; };
  Dock.openEditor = (id) => {
    const c = S.clip(id); if (!c) return; Dock.show('editor'); Dock.setClip(c);
    const sh = document.getElementById('dock'); if (sh && sh.classList.contains('min')) HD.App.toggleDock(false);
  };
  Dock.setClip = (c) => {
    if (c.type === 'midi') { Dock.mode('midi'); HD.PianoRoll.open(c.id); setTimeout(() => HD.PianoRoll.layout(), 0); }
    else if (c.type === 'drum') { Dock.mode('drum'); HD.DrumSeq.open(c.id); }
    else { Dock.mode('audio'); Dock.audioInfo(c); }
  };
  Dock.follow = () => {
    const ids = S.sel.clips, c = ids.length === 1 ? S.clip(ids[0]) : null;
    if (c) Dock.setClip(c); else if (!S.clip(HD.PianoRoll.clipId) && !S.clip(HD.DrumSeq.clipId)) Dock.mode(null);
  };
  Dock.audioInfo = (c) => {
    const it = Lib.byId[c.snd] || {}, buf = Lib.buffer(c.snd) || Lib.bufs[c.snd], p = Dock.audio; p.innerHTML = '';
    const cv = el('canvas', { width: 900, height: 120, class: 'audio-wave' }); if (buf) HD.drawPeaks(cv, HD.computePeaks([buf.getChannelData(0), buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)], 900), '#6bd', { bg: '#12141a' });
    const m = it.meta;
    p.append(el('div', { class: 'audio-info' }, el('div', { class: 'big-t', text: it.name || 'Audio clip' }), el('div', { class: 'hint', text: (buf ? HD.fmtDur(buf.duration) + ' · ' + buf.sampleRate + ' Hz · ' + buf.numberOfChannels + ' ch' : 'sound not loaded') + (m ? ` · peak ${m.peakDb.toFixed(1)} dB · RMS ${m.rmsDb.toFixed(1)} dB` + (m.bpm ? ` · ~${m.bpm} BPM (estimate)` : '') : '') }), cv,
      el('div', { class: 'hint', text: 'Audio clips are edited in the arrangement: drag to move, drag edges to trim/loop, drag the top corners for fades, S to split. Gain / fades / speed are in the Inspector →' })));
  };

  // ---------- right panel ----------
  Right.init = (root) => {
    Right.root = root; root.innerHTML = '';
    const tabs = el('div', { class: 'dock-tabs' }, [['inspector', 'Inspector'], ['ai', '✦ AI Producer']].map(([k, l]) => el('button', { class: 'dock-tab' + (k === Right.tab ? ' on' : ''), 'data-t': k, text: l, onclick: () => Right.show(k) })));
    Right.insp = el('div', { class: 'rp-pane insp on' }); Right.aip = el('div', { class: 'rp-pane aip' });
    root.append(tabs, Right.insp, Right.aip); Right.tabs = tabs;
    Right.buildAI(); Right.renderInspector();
    HD.bus.on('change', (e) => { if (e.kind !== 'notes' || true) Right.renderInspector(); }); HD.bus.on('selection', () => Right.renderInspector()); HD.bus.on('project', () => Right.renderInspector());
  };
  Right.show = (t) => { Right.tab = t; Right.tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === t)); Right.insp.classList.toggle('on', t === 'inspector'); Right.aip.classList.toggle('on', t === 'ai'); if (t === 'ai') setTimeout(() => Right.input && Right.input.focus(), 30); };

  const row = (label, ctrl, hint) => el('div', { class: 'ins-row' }, el('label', { text: label }), ctrl, hint ? el('span', { class: 'hint', text: hint }) : null);
  const num = (val, step, onChange, min, max) => { const i = el('input', { type: 'number', class: 'inp num', step, value: HD.round(val, 3) }); if (min != null) i.min = min; if (max != null) i.max = max; i.addEventListener('change', () => { let v = parseFloat(i.value); if (isNaN(v)) return; if (min != null) v = Math.max(min, v); if (max != null) v = Math.min(max, v); onChange(v); }); return i; };
  const slide = (min, max, val, step, label, onInput, fmt) => { const sp = el('span', { class: 'val', text: fmt ? fmt(val) : val }); const i = UI.slider(min, max, val, step, (v) => { onInput(v); sp.textContent = fmt ? fmt(v) : v; }); let snap; i.addEventListener('pointerdown', () => (snap = S.begin())); i.addEventListener('change', () => { S.end(snap, label, 'structure'); }); return el('div', { class: 'sl-wrap' }, i, sp); };

  Right.renderInspector = () => {
    const root = Right.insp; if (!root || !S.project) return; root.innerHTML = '';
    const P = S.project, ids = S.sel.clips, clips = ids.map(S.clip).filter(Boolean), c = clips.length === 1 ? clips[0] : null;
    if (clips.length > 1) { root.append(el('div', { class: 'ins-title', text: clips.length + ' clips selected' }), el('div', { class: 'hint', text: 'Drag to move together · Ctrl+D duplicate · Delete removes · S splits at the playhead.' })); }
    if (c) {
      const t = S.track(c.track), spb = 60 / P.bpm, it = Lib.byId[c.snd];
      root.append(el('div', { class: 'ins-title', text: 'Clip' }), row('Name', el('input', { class: 'inp', value: c.name || '', onchange: (e) => S.mutate('Rename clip', () => (c.name = e.target.value)) })),
        row('Track', el('span', { class: 'val', text: t ? t.name : '' })),
        row('Start (bar)', num(c.start / 4 + 1, 0.25, (v) => S.mutate('Clip start', () => (c.start = Math.max(0, (v - 1) * 4))), 1)), row('Length (bars)', num(c.len / 4, 0.25, (v) => S.mutate('Clip length', () => (c.len = Math.max(0.25, v * 4))), 0.0625)),
        row('Gain', slide(0, 2, c.gain == null ? 1 : c.gain, 0.01, 'Clip gain', (v) => (c.gain = v), (v) => (v <= 0 ? '-∞' : (20 * Math.log10(v)).toFixed(1) + ' dB'))),
        row('Mute', el('input', { type: 'checkbox', checked: c.mute, onchange: (e) => S.mutate('Mute clip', () => (c.mute = e.target.checked)) })));
      if (c.type === 'audio') {
        root.append(row('Fade in', slide(0, Math.max(0.5, c.len / 2), c.fi || 0, 0.05, 'Fade in', (v) => (c.fi = v), (v) => v.toFixed(2) + ' beats')), row('Fade out', slide(0, Math.max(0.5, c.len / 2), c.fo || 0, 0.05, 'Fade out', (v) => (c.fo = v), (v) => v.toFixed(2) + ' beats')),
          row('Speed', slide(0.5, 2, c.rate || 1, 0.01, 'Clip speed', (v) => (c.rate = v), (v) => '×' + v.toFixed(2))),
          row('Loop', el('input', { type: 'checkbox', checked: !!c.loop, onchange: (e) => S.mutate('Loop clip', () => (c.loop = e.target.checked)) }), 'repeat the sound to fill the clip'));
        if (it && it.meta && it.meta.bpm) root.append(el('button', { class: 'btn small', text: 'Fit to project BPM (~' + it.meta.bpm + ' → ' + P.bpm + ')', onclick: () => S.mutate('Fit tempo', () => (c.rate = P.bpm / it.meta.bpm)) }));
        if (it && it.loopBpm) root.append(el('div', { class: 'hint', text: 'This loop is automatically time-fitted to the project tempo.' }));
      } else {
        root.append(row('Swing', slide(0, 100, Math.round((c.swing || 0) * 100), 1, 'Swing', (v) => (c.swing = v / 100), (v) => v + '%')));
        root.append(el('div', { class: 'hint', text: 'Content loops every ' + HD.round((c.cl || c.len) / 4, 2) + ' bar(s). Drag the clip’s right edge to repeat it.' }));
        root.append(el('button', { class: 'btn small', text: 'Open editor', onclick: () => Dock.openEditor(c.id) }));
      }
    }
    const t = S.track(S.sel.track);
    if (!clips.length || c) {
      if (t && !c) root.append(el('div', { class: 'ins-title', text: 'Track · ' + t.name }), el('div', { class: 'hint', text: 'Select a clip to see its properties. Use the Mixer and Device tabs for levels and effects.' }));
      root.append(el('div', { class: 'ins-title', style: { marginTop: '14px' }, text: 'Project' }),
        row('Name', el('input', { class: 'inp', value: P.name, onchange: (e) => S.mutate('Rename project', () => (P.name = e.target.value || 'Untitled'), 'meta') })),
        row('Tempo', num(P.bpm, 1, (v) => A.setBpm(v), 60, 200), 'BPM'),
        row('Key', el('div', { class: 'two' }, UI.select(HD.NOTE_NAMES.map((n, i) => [i, n]), P.key.root, (v) => S.mutate('Key', () => (P.key.root = parseInt(v, 10)), 'transport'), 'small'), UI.select(Object.keys(HD.Music.SCALES), P.key.scale, (v) => S.mutate('Scale', () => (P.key.scale = v), 'transport'), 'small'))),
        row('Length', el('span', { class: 'val', text: Math.ceil(S.endBeat() / 4) + ' bars · ' + HD.fmtTime((S.endBeat() * 60) / P.bpm) })),
        P.markers.length ? row('Sections', el('div', { class: 'sec-list' }, P.markers.map((m) => el('button', { class: 'chip', style: { '--c': m.color }, text: m.name, onclick: () => HD.Transport.seek(m.beat) })))) : null);
    }
  };

  // ---------- AI producer ----------
  Right.buildAI = () => {
    const p = Right.aip; p.innerHTML = '';
    Right.chat = el('div', { class: 'chat' });
    Right.input = el('input', { class: 'inp', placeholder: 'Ask: “make the drums punchier”, “create a 16-bar intro”…' });
    let busy = false;
    const send = async () => {
      const t = Right.input.value.trim(); if (!t || busy) return; Right.input.value = ''; Right.say('user', t); busy = true;
      const wait = Right.say('ai', '…thinking');
      try { const r = await HD.AI.respond(t, (m) => { wait.firstChild.textContent = m; }); wait.remove(); if (r) Right.say(r.ok ? 'ai' : 'ai warn', r.reply); } catch (e) { console.error(e); wait.remove(); Right.say('ai warn', 'Something went wrong, nothing was changed. (' + e.message + ')'); }
      busy = false;
    };
    Right.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); e.stopPropagation(); });
    p.append(el('div', { class: 'ai-note', html: '<b>✦ AI Producer</b> reads your project and edits it directly. It’s a built-in <b>rule-based</b> assistant — fully offline, no cloud — and it only reports changes it actually made.' }),
      Right.chat, el('div', { class: 'chips ai-chips' }, HD.AI.examples.map((x) => el('button', { class: 'chip', text: x, onclick: () => { Right.input.value = x; send(); } }))), el('div', { class: 'ai-in' }, Right.input, el('button', { class: 'btn primary', text: 'Send', onclick: send })));
    Right.say('ai', 'Hi! Tell me what to change in plain English — for example “make this darker”, “add a riser before the drop” or “give me a deeper bass”. Type “help” to see everything I can do.');
  };
  Right.say = (who, text) => { const m = el('div', { class: 'msg ' + who }, text.split('\n').map((l) => el('div', { text: l }))); Right.chat.append(m); Right.chat.scrollTop = 1e6; return m; };
})();
