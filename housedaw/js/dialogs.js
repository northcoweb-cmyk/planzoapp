/* HouseDAW — dialogs: House Mode wizard, Song Builder, Sound Generator, Export, Projects, Welcome, Help. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const el = HD.el, UI = HD.UI, S = HD.State, Lib = HD.Lib, C = HD.Compose;
  const Dg = (HD.Dialogs = {});
  const GEN_OPTS = Object.keys(C.GENRES), MOODS = Object.keys(C.MOODS), ENERGY = Object.keys(C.ENERGY);

  // ---------- option form shared by the wizard and the song builder ----------
  const optionsForm = (o, withLength) => {
    const bpmVal = el('span', { class: 'val big', text: o.bpm + ' BPM' });
    const vibeOf = () => C.VIBES[o.vibe || C.VIBE_BY_GENRE[o.genre]];
    const setBpm = (v) => { o.bpm = v; bpm.value = v; bpmVal.textContent = v + ' BPM'; };
    const bpm = UI.slider(100, 140, o.bpm, 1, (v) => { o.bpm = v; o.userBpm = true; bpmVal.textContent = v + ' BPM'; });
    const vdesc = el('div', { class: 'hint vdesc' }), showV = () => { const V = vibeOf(); vdesc.textContent = (o.vibe || C.VIBE_BY_GENRE[o.genre]) + ' — ' + V.desc; };
    const genre = UI.chips(GEN_OPTS, o.genre, (v) => { o.genre = v; if (!o.userBpm) setBpm(vibeOf().bpm); showV(); });
    const vibe = UI.chips(['Auto', ...Object.keys(C.VIBES)], o.vibe || 'Auto', (v) => { o.vibe = v === 'Auto' ? null : v; if (!o.userBpm) setBpm(vibeOf().bpm); showV(); });
    showV();
    const f = el('div', { class: 'wiz' },
      el('div', { class: 'wiz-sec' }, el('div', { class: 'wiz-lab', text: 'Style' }), genre),
      el('div', { class: 'wiz-sec' }, el('div', { class: 'wiz-lab', text: 'Vibe  (the groove’s personality — bass, hats, hook, feel)' }), vibe, vdesc),
      el('div', { class: 'wiz-sec' }, el('div', { class: 'wiz-lab', text: 'Mood' }), UI.chips(MOODS, o.mood, (v) => (o.mood = v))),
      el('div', { class: 'wiz-sec' }, el('div', { class: 'wiz-lab', text: 'Energy' }), UI.chips(ENERGY, o.energy, (v) => (o.energy = v))),
      el('div', { class: 'wiz-sec' }, el('div', { class: 'wiz-lab', text: 'Tempo' }), el('div', { class: 'wiz-bpm' }, bpm, bpmVal)));
    if (withLength) f.append(el('div', { class: 'wiz-sec' }, el('div', { class: 'wiz-lab', text: 'Song length' }), UI.chips([[2, '2 minutes'], [3, '3 minutes'], [4, '4 minutes'], [5, '5 minutes']], o.minutes, (v) => (o.minutes = parseInt(v, 10)))));
    return f;
  };

  Dg.wizard = () => {
    const o = { genre: 'House', mood: 'Groovy', energy: 'Medium', bpm: C.VIBES[C.VIBE_BY_GENRE['House']].bpm, vibe: null };
    const m = UI.modal({ title: '✦ New House Track', width: 620, body: el('div', {}, el('p', { class: 'lead', text: 'Pick a vibe. In a couple of seconds you’ll get a complete, playable groove — kick, clap, hats, percussion, bass, chords, pad, lead and FX — using only sounds built into HouseDAW. Everything stays editable.' }), optionsForm(o)),
      buttons: [{ label: 'Cancel', onClick: (c) => c() }, { label: 'GENERATE GROOVE', cls: 'primary big', onClick: async (close) => { close(); await HD.App.generate({ ...o, mode: 'groove' }); } }] });
    return m;
  };
  Dg.songBuilder = () => {
    const g0 = S.project && S.project.genre && C.GENRES[S.project.genre] ? S.project.genre : 'House', o = { genre: g0, mood: 'Groovy', energy: 'Medium', bpm: S.project && S.project.tracks.length ? S.project.bpm : C.VIBES[C.VIBE_BY_GENRE[g0]].bpm, vibe: S.project && S.project.vibe && C.VIBES[S.project.vibe] ? S.project.vibe : null, minutes: 3, userBpm: !!(S.project && S.project.tracks.length) };
    UI.modal({ title: '🏗 Song Builder', width: 640, body: el('div', {}, el('p', { class: 'lead', text: 'Builds a full arrangement on the timeline: Intro → Build → Drop → Break → Build → Drop 2 → Outro, with fills, risers, impacts and section markers. Every clip is editable afterwards.' }), optionsForm(o, true)),
      buttons: [{ label: 'Cancel', onClick: (c) => c() }, { label: 'BUILD SONG', cls: 'primary big', onClick: async (close) => { close(); await HD.App.generate({ ...o, mode: 'song' }, true); } }] });
  };

  // ---------- sound generator ----------
  Dg.generator = (startKind = 'KICK') => {
    const st = { kind: startKind, vals: HD.Gen.defaults(startKind), seed: 1 + Math.floor(Math.random() * 9999), buf: null, peaks: null };
    const wave = el('canvas', { width: 560, height: 80, class: 'gen-wave' }), nameIn = el('input', { class: 'inp', value: '' }), info = el('div', { class: 'hint', text: '' }), knobsBox = el('div', { class: 'gen-knobs' });
    let busy = 0;
    const kindBar = el('div', { class: 'gen-kinds' }, Object.keys(HD.Gen.KINDS).map((k) => el('button', { class: 'chip' + (k === st.kind ? ' on' : ''), 'data-k': k, text: k, onclick: () => { st.kind = k; st.vals = HD.Gen.defaults(k); kindBar.querySelectorAll('.chip').forEach((b) => b.classList.toggle('on', b.dataset.k === k)); drawKnobs(); render(true); } })));
    const render = async (play) => {
      const my = ++busy, K = HD.Gen.KINDS[st.kind];
      try {
        if (K.audio) { const spec = HD.Gen.specFor(st.kind, st.vals, st.seed), s = HD.Dsp.render(spec, Lib.sr); st.buf = Lib.makeBuffer(s.L, s.R, s.sr); st.peaks = HD.computePeaks([s.L, s.R], 280); }
        else { const pre = K.buildPreset(st.vals); st.preset = pre; const b = await HD.Inst.bounce(pre, pre.pv, 0.9, Lib.sr, pre.prev); if (my !== busy) return; st.buf = b; st.peaks = HD.computePeaks([b.getChannelData(0), b.getChannelData(1)], 280); }
      } catch (e) { console.error(e); return; }
      if (my !== busy) return; HD.drawPeaks(wave, st.peaks, '#7bdc7b', { bg: '#12141a' }); info.textContent = HD.fmtDur(st.buf.duration) + ' · ' + HD.Gen.subFor(st.kind, st.vals) + (K.inst ? ' (instrument preset — play it from the piano roll)' : '');
      if (play) { HD.engine.ctx.resume(); HD.engine.previewBuffer(st.buf); }
    };
    const drawKnobs = () => {
      knobsBox.innerHTML = ''; const K = HD.Gen.KINDS[st.kind];
      for (const df of K.defs) knobsBox.append(UI.knob(df, st.vals[df.k], { size: 50, onInput: (v) => (st.vals[df.k] = v), onEnd: () => render(true) }));
      nameIn.value = (K.sub || st.kind) + ' ' + String(Math.floor(Math.random() * 90) + 10);
    };
    const redraw = () => { drawKnobs(); render(true); };
    const body = el('div', { class: 'gen' }, el('p', { class: 'lead', text: 'The sound factory: pick a type, hit GENERATE for a new variation, tweak the knobs, then save it to MY SOUNDS to drag into your project. Everything is synthesised on your device.' }), kindBar, knobsBox, wave, info, el('div', { class: 'gen-save' }, el('label', { text: 'Name' }), nameIn));
    const m = UI.modal({ title: '✦ Generate Sound', width: 640, cls: 'gen-modal', body, buttons: [
      { label: '🎲 GENERATE SOUND', cls: 'primary big', onClick: () => { st.seed = 1 + Math.floor(Math.random() * 99999); st.vals = HD.Gen.randomize(st.kind); redraw(); } },
      { label: '▶ Preview', onClick: () => { if (st.buf) { HD.engine.ctx.resume(); HD.engine.previewBuffer(st.buf); } } },
      { label: '💾 Save to My Sounds', cls: 'good', onClick: async () => { const K = HD.Gen.KINDS[st.kind], nm = nameIn.value.trim() || 'Generated sound'; if (K.audio) { await HD.Gen.saveUserSample(nm, st.kind, st.vals, st.seed); HD.toast('Saved “' + nm + '” — find it under MY SOUNDS'); } else await HD.Gen.saveUserPreset(nm, st.preset || K.buildPreset(st.vals)); HD.Browser.cat = 'MY SOUNDS'; HD.Browser.sub = 'All'; HD.Browser.render(); } },
      { label: 'Bounce to audio', onClick: async () => { const K = HD.Gen.KINDS[st.kind]; if (K.audio) { HD.toast('Audio sounds are already saved as audio assets'); return; } const pre = st.preset || K.buildPreset(st.vals), nm = (nameIn.value.trim() || 'Bounce') + ' (audio)'; const buf = await HD.Inst.bounce(pre, pre.pv, 1.5, Lib.sr, pre.prev || [0]); const wav = HD.Export.encodeWav(buf, 16), bytes = await wav.arrayBuffer(), id = 'bnc_' + Date.now().toString(36), meta = HD.Import.analyze(buf); await HD.Store.saveAsset({ id, name: nm, bytes, fileName: nm + '.wav', meta, created: Date.now() }); const it = Lib.addImport(id, nm, buf, meta); it.created = Date.now(); HD.toast('Bounced to audio → saved in MY SOUNDS'); HD.Browser.cat = 'MY SOUNDS'; HD.Browser.sub = 'All'; HD.Browser.render(); } },
    ] });
    redraw(); return m;
  };

  // ---------- export ----------
  Dg.export = () => {
    const P = S.project, o = { fmt: 'wav16', range: 'song', tail: true, norm: false, kbps: 192 };
    const selClips = S.sel.clips.map(S.clip).filter(Boolean);
    const info = el('div', { class: 'hint', text: '' }), prog = el('div', { class: 'progress' }, el('i')), status = el('div', { class: 'exp-status', text: '' });
    const regionTxt = () => { const r = region(); return 'Range: bar ' + (r.start / 4 + 1).toFixed(1).replace('.0', '') + ' → bar ' + (r.end / 4 + 1).toFixed(1).replace('.0', '') + ' · ' + HD.fmtTime(((r.end - r.start) * 60) / P.bpm); };
    const region = () => o.range === 'loop' ? { start: P.loop.s, end: P.loop.e } : o.range === 'sel' && selClips.length ? { start: Math.min(...selClips.map((c) => c.start)), end: Math.max(...selClips.map((c) => c.start + c.len)) } : { start: 0, end: S.endBeat() };
    const refresh = () => (info.textContent = regionTxt());
    const body = el('div', { class: 'exp' },
      el('div', { class: 'wiz-sec' }, el('div', { class: 'wiz-lab', text: 'Format' }), UI.chips([['wav16', 'WAV 16-bit'], ['wav24', 'WAV 24-bit'], ['mp3', 'MP3']], o.fmt, (v) => (o.fmt = v))),
      el('div', { class: 'wiz-sec' }, el('div', { class: 'wiz-lab', text: 'MP3 bitrate' }), UI.chips([[128, '128 kbps'], [192, '192 kbps'], [320, '320 kbps']], o.kbps, (v) => (o.kbps = parseInt(v, 10)))),
      el('div', { class: 'wiz-sec' }, el('div', { class: 'wiz-lab', text: 'Range' }), UI.chips([['song', 'Entire song'], ['loop', 'Loop region'], ['sel', 'Selected clips']], o.range, (v) => { o.range = v; refresh(); })), info,
      el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: true, onchange: (e) => (o.tail = e.target.checked) }), ' Include reverb/echo tail (2 s)'),
      el('label', { class: 'chk' }, el('input', { type: 'checkbox', onchange: (e) => (o.norm = e.target.checked) }), ' Normalize to −1 dBFS'),
      el('div', { class: 'hint', text: 'The export is a faithful offline render of exactly what you hear: all tracks, effects, sends, automation and the master/mastering chain.' }), prog, status);
    refresh();
    UI.modal({ title: '⬇ Export audio', width: 520, body, buttons: [{ label: 'Close', onClick: (c) => c() }, { label: 'EXPORT', cls: 'primary big', onClick: async () => {
      const r = region(); if (r.end - r.start < 0.5) { status.textContent = 'Nothing to export in that range — add clips first.'; return; }
      try {
        HD.Transport.stop(); status.textContent = 'Rendering…'; prog.firstChild.style.width = '5%';
        await new Promise((res) => setTimeout(res, 30));
        HD.Lib.pin(S.usedSounds()); S.embedSounds();
        let buf = await HD.renderProject(P, { start: r.start, end: r.end, tail: o.tail ? 2 : 0.05, onProgress: (f, msg) => { prog.firstChild.style.width = Math.round(f * 70) + '%'; status.textContent = msg; } });
        if (o.norm) HD.Export.normalize(buf, -1);
        let blob; const base = (P.name || 'house-track').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'house-track';
        if (o.fmt === 'mp3') { status.textContent = 'Encoding MP3…'; blob = await HD.Export.encodeMp3(buf, o.kbps, (f) => (prog.firstChild.style.width = 70 + Math.round(f * 30) + '%')); HD.Export.download(blob, base + '.mp3'); }
        else { blob = HD.Export.encodeWav(buf, o.fmt === 'wav24' ? 24 : 16); HD.Export.download(blob, base + '.wav'); }
        prog.firstChild.style.width = '100%'; const st = HD.Export.stats(buf);
        status.textContent = `Done — ${(blob.size / 1e6).toFixed(1)} MB · ${HD.fmtTime(st.dur)} · peak ${st.peakDb.toFixed(1)} dBFS · RMS ${st.rmsDb.toFixed(1)} dBFS. Your download should have started.`;
      } catch (e) { console.error(e); status.textContent = 'Export failed: ' + e.message; }
    } }] });
  };

  // ---------- projects ----------
  Dg.projects = async () => {
    const list = el('div', { class: 'proj-list' }); let m;
    const draw = async () => {
      list.innerHTML = ''; const ps = await HD.Store.listProjects();
      if (!ps.length) list.append(el('div', { class: 'empty', text: 'No saved projects yet — your work is saved automatically as you go.' }));
      for (const p of ps) {
        list.append(el('div', { class: 'proj-row' + (S.project && p.id === S.project.id ? ' cur' : '') }, el('div', { class: 'pn' }, el('b', { text: p.name }), el('span', { class: 'hint', text: p.bpm + ' BPM · ' + new Date(p.updated).toLocaleString() })),
          el('button', { class: 'btn small', text: 'Open', onclick: async () => { m.close(); await HD.App.openProject(p.id); } }),
          el('button', { class: 'btn small', text: 'Duplicate', onclick: async () => { const d = await HD.Store.loadProject(p.id); d.id = HD.uid('proj'); d.name += ' copy'; await HD.Store.put('projects', { id: d.id, name: d.name, updated: Date.now(), bpm: d.bpm, data: d }); draw(); } }),
          el('button', { class: 'btn small', text: 'Delete', onclick: async () => { if (confirm('Delete “' + p.name + '”?')) { await HD.Store.deleteProject(p.id); if (S.project && S.project.id === p.id) { HD.App.newBlank(); } draw(); } } })));
      }
    };
    const body = el('div', {}, el('div', { class: 'proj-bar' }, el('button', { class: 'btn primary', text: '✦ New House Track', onclick: () => { m.close(); Dg.wizard(); } }), el('button', { class: 'btn', text: 'Blank project', onclick: () => { m.close(); HD.App.newBlank(); } }), el('button', { class: 'btn', text: 'Export project file…', onclick: () => HD.App.exportProjectFile() }), el('button', { class: 'btn', text: 'Import project file…', onclick: () => HD.App.importProjectFile() })), list);
    m = UI.modal({ title: 'Projects (saved locally in your browser)', width: 640, body }); draw();
  };

  Dg.welcome = () => {
    const st = Lib.items.filter((i) => i.type === 'sample').length, ins = Lib.items.filter((i) => i.type === 'inst').length;
    const m = UI.modal({ title: 'Welcome to HouseDAW', width: 640, cls: 'welcome sticky', body: el('div', { class: 'wel' },
      el('div', { class: 'wel-hero', text: 'Make a complete house track with zero samples.' }),
      el('p', { class: 'lead', text: `Everything is built in and generated on your device: ${st} drum, FX and vocal sounds, ${ins} playable bass & synth instruments, ${HD.Music.PROGS.length} chord progressions and ${HD.Music.DRUMPATS.length + HD.Music.BASSPATS.length} drum/bass patterns. No downloads, no accounts, no internet needed.` }),
      el('button', { class: 'btn primary huge', text: '✦ NEW HOUSE TRACK', onclick: () => { m.close(); Dg.wizard(); } }),
      el('div', { class: 'wel-steps' }, el('div', {}, el('b', { text: '1' }), ' Pick a style, mood, energy & BPM'), el('div', {}, el('b', { text: '2' }), ' Press GENERATE GROOVE'), el('div', {}, el('b', { text: '3' }), ' Press SPACE to play — then edit anything'), el('div', {}, el('b', { text: '4' }), ' Song Builder makes the full arrangement · Export saves WAV/MP3')),
      el('button', { class: 'btn', text: 'Start with a blank project', onclick: () => { m.close(); HD.App.newBlank(); } })) });
  };

  Dg.help = () => UI.modal({ title: 'Quick guide & shortcuts', width: 620, body: el('div', { class: 'help' },
    el('h4', { text: 'Workflow' }), el('ul', {}, ['✦ New House Track builds a playable groove; Song Builder builds a full arrangement.', 'Drag sounds from the browser into the timeline. Drums become a step-sequenced pattern; instruments become tracks you play in the piano roll.', 'Double-click a clip to edit it: piano roll for MIDI, step sequencer for drums.', 'Mixer: volume, pan, mute/solo, sends, routing. Device: instrument knobs + insert effects + house FX presets.', 'Right-click any effect knob to automate it; automation lanes appear under the track (the A button).', 'AI Producer (right panel) edits your project from plain-English requests.'].map((t) => el('li', { text: t }))),
    el('h4', { text: 'Shortcuts' }), el('table', { class: 'keys' }, [['Space', 'Play / stop'], ['Home', 'Go to start'], ['Ctrl/⌘ Z · Shift+Z', 'Undo · redo'], ['Ctrl/⌘ S', 'Save now'], ['S', 'Split selected clip at the playhead'], ['Ctrl/⌘ D', 'Duplicate selected clips'], ['Delete', 'Delete selected clips / notes'], ['L', 'Toggle loop'], ['K', 'Toggle metronome'], ['C', 'Split tool'], ['Ctrl + wheel', 'Zoom timeline / piano roll'], ['Alt + drag clip', 'Duplicate while dragging'], ['Right-click note', 'Delete note (piano roll)'], ['Q', 'Quantize (piano roll)'], ['Alt+1…4', 'Editor / Mixer / Device / Master']].map(([k, v]) => el('tr', {}, el('td', {}, el('kbd', { text: k })), el('td', { text: v }))))) });
})();
