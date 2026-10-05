/* HouseDAW — application bootstrap: audio context, top bar, transport UI, autosave, project management, shortcuts. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const el = HD.el, UI = HD.UI, S = HD.State, Lib = HD.Lib, A = HD.Actions, T = HD.Transport;
  const App = (HD.App = { saveTimer: null });

  // ---------- busy overlay ----------
  App.busy = (msg) => { let b = document.getElementById('busy'); if (!b) { b = el('div', { id: 'busy' }, el('div', { class: 'busy-box' }, el('div', { class: 'spin' }), el('div', { class: 'busy-msg' }))); document.body.append(b); } b.querySelector('.busy-msg').textContent = msg; b.style.display = 'flex'; };
  App.idle = () => { const b = document.getElementById('busy'); if (b) b.style.display = 'none'; };
  const tick = () => new Promise((r) => setTimeout(r, 10));

  // ---------- audio ----------
  App.setupAudio = () => {
    const AC = window.AudioContext || window.webkitAudioContext, ctx = new AC({ latencyHint: 'interactive' });
    Lib.sr = ctx.sampleRate; Lib.ctx = ctx; HD.engine = new HD.Engine(ctx, true); T.init(HD.engine);
    const resume = () => { if (ctx.state !== 'running') ctx.resume(); };
    ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, resume, { capture: true }));
  };

  // pre-render the sounds a project uses so Play is instant
  App.prepare = async () => {
    const ids = S.usedSounds().filter((id) => !Lib.bufs[id]); const big = ids.length > 6;
    if (big) App.busy('Rendering sounds…');
    let i = 0; for (const id of ids) { Lib.buffer(id); if (++i % 3 === 0) { if (big) document.querySelector('.busy-msg').textContent = `Rendering sounds… ${i}/${ids.length}`; await tick(); } }
    Lib.pin(S.usedSounds()); if (big) App.idle();
  };

  // ---------- projects ----------
  App.save = async (quiet) => {
    if (!S.project) return; clearTimeout(App.saveTimer); App.status('Saving…');
    try { await HD.Store.saveProject(S.project); await HD.Store.setKV('last', S.project.id); S.dirty = false; App.status('Saved ✓'); if (!quiet) HD.toast('Project saved locally'); } catch (e) { console.error(e); App.status('Save failed'); }
  };
  App.status = (t) => { const s = document.getElementById('savestate'); if (s) s.textContent = t; };
  App.queueSave = () => { App.status('Unsaved…'); clearTimeout(App.saveTimer); App.saveTimer = setTimeout(() => App.save(true), 900); };

  App.afterLoad = async () => { await App.prepare(); HD.engine.sync(); S.undo = []; S.redo = []; T.pos = S.project.loop.on ? S.project.loop.s : 0; HD.bus.emit('transport', {}); App.refreshTop(); HD.Timeline.render(); HD.Timeline.scroll.scrollLeft = 0; HD.Timeline.scroll.scrollTop = 0; setTimeout(() => HD.Timeline.fit(), 30); };
  App.loadNewProject = async (P) => { T.stop(); if (S.project && S.project.tracks.length) await App.save(true); S.load(P); await App.afterLoad(); await App.save(true); };
  App.newBlank = async () => { const P = S.newProject('Untitled House Track'); await App.loadNewProject(P); HD.toast('Blank project — drag sounds in, or use ✦ New House Track'); };
  App.openProject = async (id) => { const d = await HD.Store.loadProject(id); if (!d) { HD.toast('Could not open that project'); return; } T.stop(); await App.save(true); S.load(d); await App.afterLoad(); await HD.Store.setKV('last', id); HD.toast('Opened “' + d.name + '”'); };

  App.generate = async (opts, replace) => {
    App.busy(opts.mode === 'song' ? 'Building your arrangement…' : 'Generating groove…'); await tick(); await tick();
    try {
      T.stop(); const P = HD.Compose.build({ ...opts, seed: Math.floor(Math.random() * 99999) });
      if (replace && S.project && S.project.tracks.length) {
        const snap = S.begin(), cur = S.project;
        for (const k of ['bpm', 'key', 'genre', 'loop', 'tracks', 'clips', 'markers', 'sends']) cur[k] = P[k];
        S.sel = { clips: [], track: cur.tracks[0] ? cur.tracks[0].id : null }; await App.prepare(); S.end(snap, 'Song Builder', 'structure'); HD.engine.sync(); App.refreshTop(); setTimeout(() => HD.Timeline.fit(), 30); T.pos = 0;
        HD.toast('Arrangement built: ' + P.markers.map((m) => m.name).join(' → ') + ' — Ctrl+Z undoes it');
      } else { await App.loadNewProject(P); HD.toast(opts.mode === 'song' ? 'Song built — press SPACE to play' : 'Groove ready — press SPACE to play, then edit anything', 3800); }
      HD.Dock.show('editor');
    } catch (e) { console.error(e); HD.toast('Generation failed: ' + e.message, 5000); }
    App.idle();
  };

  // project file export/import (includes the audio you imported, base64)
  const b64 = (ab) => { let s = ''; const u = new Uint8Array(ab), n = 0x8000; for (let i = 0; i < u.length; i += n) s += String.fromCharCode.apply(null, u.subarray(i, i + n)); return btoa(s); };
  const unb64 = (s) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  App.exportProjectFile = async () => {
    S.embedSounds(); const used = new Set(S.usedSounds()), assets = [];
    for (const a of await HD.Store.loadAssets()) if (used.has(a.id)) assets.push({ id: a.id, name: a.name, fileName: a.fileName, meta: a.meta, created: a.created, b64: b64(a.bytes) });
    const blob = new Blob([JSON.stringify({ housedaw: 1, project: S.project, assets })], { type: 'application/json' });
    HD.Export.download(blob, (S.project.name || 'project').replace(/\s+/g, '-') + '.housedaw.json'); HD.toast('Project file saved (includes imported audio used by the project)');
  };
  App.importProjectFile = () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
    i.onchange = async () => {
      try {
        const d = JSON.parse(await i.files[0].text()); if (!d.housedaw || !d.project) throw new Error('Not a HouseDAW project file');
        for (const a of d.assets || []) { const bytes = unb64(a.b64); await HD.Store.saveAsset({ id: a.id, name: a.name, bytes, fileName: a.fileName, meta: a.meta, created: a.created }); if (!Lib.byId[a.id]) { const buf = await HD.Import.decode(bytes, a.fileName || a.name); Lib.addImport(a.id, a.name, buf, a.meta); } }
        d.project.id = HD.uid('proj'); await HD.Store.saveProject(d.project); await App.openProject(d.project.id);
      } catch (e) { HD.toast('Import failed: ' + e.message, 4500); }
    }; i.click();
  };

  // ---------- top bar ----------
  App.refreshTop = () => {
    const P = S.project; if (!P || !App.top) return;
    App.top.name.value = P.name; App.top.bpm.value = P.bpm; App.top.loop.classList.toggle('on', P.loop.on); App.top.metro.classList.toggle('on', !!P.metro);
    App.top.undo.disabled = !S.undo.length; App.top.redo.disabled = !S.redo.length;
    App.top.key.value = P.key.root; App.top.scale.value = P.key.scale;
  };
  App.buildTop = (root) => {
    root.innerHTML = '';
    const tp = (App.top = {});
    tp.name = el('input', { class: 'inp pname', value: '', title: 'Project name', onchange: (e) => S.mutate('Rename project', (p) => (p.name = e.target.value || 'Untitled'), 'meta') });
    tp.play = el('button', { class: 'tbtn play', id: 'btn-play', title: 'Play / Stop (Space)', onclick: () => T.toggle() }, el('span', { class: 'ic', text: '▶' }));
    tp.rew = el('button', { class: 'tbtn', title: 'Go to start (Home)', text: '⏮', onclick: () => { T.seek(S.project.loop.on ? S.project.loop.s : 0); } });
    tp.pos = el('div', { class: 'pos', text: '001:1:1' }); tp.time = el('div', { class: 'time', text: '0:00.0' });
    tp.bpm = el('input', { class: 'inp bpm', type: 'number', min: 60, max: 200, step: 1, title: 'Tempo (BPM)', onchange: (e) => A.setBpm(parseFloat(e.target.value)) });
    let taps = []; tp.tap = el('button', { class: 'btn small', text: 'Tap', title: 'Tap tempo', onclick: () => { const n = performance.now(); taps = taps.filter((x) => n - x < 2500); taps.push(n); if (taps.length >= 3) { const iv = []; for (let i = 1; i < taps.length; i++) iv.push(taps[i] - taps[i - 1]); A.setBpm(60000 / (iv.reduce((a, b) => a + b, 0) / iv.length)); } } });
    tp.loop = el('button', { class: 'tbtn', title: 'Loop (L)', text: '🔁', onclick: () => S.mutate('Loop', (p) => (p.loop.on = !p.loop.on), 'transport') });
    tp.metro = el('button', { class: 'tbtn', title: 'Metronome (K)', text: '🥁', onclick: () => S.mutate('Metronome', (p) => (p.metro = !p.metro), 'transport') });
    tp.key = UI.select(HD.NOTE_NAMES.map((n, i) => [i, n]), 9, (v) => S.mutate('Key', (p) => (p.key.root = parseInt(v, 10)), 'transport'), 'small');
    tp.scale = UI.select(Object.keys(HD.Music.SCALES), 'minor', (v) => S.mutate('Scale', (p) => (p.key.scale = v), 'transport'), 'small');
    tp.undo = el('button', { class: 'tbtn', title: 'Undo (Ctrl+Z)', text: '↶', onclick: () => App.undo() }); tp.redo = el('button', { class: 'tbtn', title: 'Redo (Ctrl+Shift+Z)', text: '↷', onclick: () => App.redo() });
    root.append(
      el('div', { class: 'brand', title: 'HouseDAW' }, el('span', { class: 'logo', text: '◉' }), el('b', { text: 'House' }), el('span', { text: 'DAW' })), tp.name,
      el('button', { class: 'btn primary', text: '✦ New House Track', onclick: () => HD.Dialogs.wizard() }),
      el('div', { class: 'transport' }, tp.rew, tp.play, tp.loop, tp.metro, el('div', { class: 'lcd' }, tp.pos, tp.time), el('div', { class: 'bpmbox' }, tp.bpm, el('span', { text: 'BPM' }), tp.tap), el('div', { class: 'keybox' }, el('span', { text: 'Key' }), tp.key, tp.scale)),
      el('div', { class: 'grow' }), tp.undo, tp.redo,
      el('button', { class: 'btn', text: '🏗 Song Builder', onclick: () => HD.Dialogs.songBuilder() }), el('button', { class: 'btn', text: '✦ Generate Sound', onclick: () => HD.Dialogs.generator() }),
      el('button', { class: 'btn', text: '📁 Projects', onclick: () => HD.Dialogs.projects() }), el('button', { class: 'btn', text: '⬇ Export', onclick: () => HD.Dialogs.export() }),
      el('span', { id: 'savestate', class: 'savestate', text: '' }), el('button', { class: 'tbtn', title: 'Guide & shortcuts (?)', text: '?', onclick: () => HD.Dialogs.help() }),
      el('button', { class: 'tbtn only-narrow', id: 'btn-right', title: 'Inspector / AI', text: '☰', onclick: () => document.getElementById('right').classList.toggle('open') }));
    // live readouts
    const f = () => {
      const b = T.beat(), P = S.project;
      if (P) { const bar = Math.floor(b / 4) + 1, beat = Math.floor(b % 4) + 1, sx = Math.floor((b % 1) * 4) + 1; tp.pos.textContent = String(bar).padStart(3, '0') + ':' + beat + ':' + sx; tp.time.textContent = HD.fmtTime((b * 60) / P.bpm); }
      tp.play.firstChild.textContent = T.playing ? '■' : '▶'; tp.play.classList.toggle('on', T.playing);
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  };
  App.undo = () => { const l = S.undoOne(); if (l) HD.toast('Undo: ' + l, 1200); App.refreshTop(); };
  App.redo = () => { const l = S.redoOne(); if (l) HD.toast('Redo: ' + l, 1200); App.refreshTop(); };
  App.toggleDock = (min) => { const d = document.getElementById('dock'); d.classList.toggle('min', min); };

  // ---------- layout: dock resizer ----------
  App.hookResizer = () => {
    const r = document.getElementById('resizer'), dock = document.getElementById('dock');
    r.addEventListener('pointerdown', (e) => {
      e.preventDefault(); r.setPointerCapture(e.pointerId); const y0 = e.clientY, h0 = dock.getBoundingClientRect().height;
      const mv = (ev) => { const h = HD.clamp(h0 - (ev.clientY - y0), 60, innerHeight - 260); dock.style.height = h + 'px'; dock.classList.remove('min'); if (HD.Dock.tab === 'editor') HD.PianoRoll.layout(); };
      const up = () => { r.removeEventListener('pointermove', mv); r.removeEventListener('pointerup', up); };
      r.addEventListener('pointermove', mv); r.addEventListener('pointerup', up);
    });
    r.addEventListener('dblclick', () => dock.classList.toggle('min'));
  };

  // ---------- keyboard ----------
  App.hookKeys = () => {
    window.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) { if (!(e.key === 'Escape')) return; }
      const ctrl = e.ctrlKey || e.metaKey, k = e.key;
      if (e.target.classList && e.target.classList.contains('pr-scroll') && (k === 'Delete' || k === 'Backspace' || (ctrl && 'acxv'.includes(k)) || k.startsWith('Arrow') || k === 'q')) return; // piano roll handles its own
      if (k === ' ') { e.preventDefault(); T.toggle(); }
      else if (ctrl && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? App.redo() : App.undo(); }
      else if (ctrl && k.toLowerCase() === 'y') { e.preventDefault(); App.redo(); }
      else if (ctrl && k.toLowerCase() === 's') { e.preventDefault(); App.save(); }
      else if (ctrl && k.toLowerCase() === 'd') { e.preventDefault(); A.duplicateClips(S.sel.clips); }
      else if (ctrl && k.toLowerCase() === 'e') { e.preventDefault(); HD.Dialogs.export(); }
      else if (ctrl && k.toLowerCase() === 'a' && !e.target.classList.contains('pr-scroll')) { e.preventDefault(); S.select(S.project.clips.map((c) => c.id)); }
      else if (k === 'Delete' || k === 'Backspace') { if (S.sel.clips.length) { e.preventDefault(); A.deleteClips(S.sel.clips); } }
      else if (k === 'Home') { T.seek(S.project.loop.on ? S.project.loop.s : 0); }
      else if (!ctrl && k.toLowerCase() === 's') { HD.Timeline.splitAtPlayhead(); }
      else if (!ctrl && k.toLowerCase() === 'l') { S.mutate('Loop', (p) => (p.loop.on = !p.loop.on), 'transport'); }
      else if (!ctrl && k.toLowerCase() === 'k') { S.mutate('Metronome', (p) => (p.metro = !p.metro), 'transport'); }
      else if (!ctrl && k.toLowerCase() === 'c') { HD.Timeline.setTool(HD.Timeline.tool === 'split' ? 'select' : 'split'); }
      else if (k === '?') HD.Dialogs.help();
      else if (e.altKey && '1234'.includes(k)) { e.preventDefault(); HD.Dock.show(['editor', 'mixer', 'device', 'master'][parseInt(k, 10) - 1]); }
      else if (k === 'Escape') { UI.closeMenu(); HD.Timeline.setTool('select'); }
    });
  };

  // computer-keyboard piano: audition the selected instrument track (A W S E D F T G Y H U J …)
  App.hookPiano = () => {
    const map = { z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11, ',': 12 };
    window.addEventListener('keydown', (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.repeat) return; const t = S.track(S.sel.track); if (!t || t.type !== 'inst' || !(e.key.toLowerCase() in map)) return;
      e.preventDefault(); HD.engine.auditionNote(t.id, 48 + map[e.key.toLowerCase()] + 12, 0.85, 0.5);
    });
  };

  // ---------- init ----------
  App.init = async () => {
    App.setupAudio();
    await HD.Store.open(); await HD.Import.loadAll(); HD.Packs.load().then((n) => { if (n && HD.Browser.root) HD.Browser.render(); });
    try { (await HD.Store.getKV('favs', [])).forEach((id) => Lib.favs.add(id)); } catch (e) { /* noop */ }
    // initial empty project so every panel has something to bind to
    S.project = S.newProject('Untitled House Track');
    App.buildTop(document.getElementById('topbar'));
    HD.Browser.init(document.getElementById('browser')); HD.Timeline.init(document.getElementById('tl'));
    HD.Dock.init(document.getElementById('dock')); HD.Right.init(document.getElementById('right'));
    App.hookResizer(); App.hookKeys(); App.hookPiano(); HD.Import.hookWindow();
    HD.bus.on('change', (e) => { HD.engine.sync(); App.refreshTop(); if (e.kind !== 'auto') Lib.pin(S.usedSounds()); App.queueSave(); });
    HD.bus.on('project', () => { HD.engine.sync(); App.refreshTop(); });
    HD.bus.on('transport', () => App.refreshTop());
    HD.bus.on('selection', () => App.refreshTop());
    window.addEventListener('visibilitychange', () => { if (document.hidden && S.dirty) App.save(true); });
    window.addEventListener('beforeunload', () => { if (S.dirty) App.save(true); });
    // restore last project or show the welcome screen
    const last = await HD.Store.getKV('last', null), d = last ? await HD.Store.loadProject(last) : null;
    if (d) { S.load(d); await App.afterLoad(); App.status('Saved ✓'); } else { S.load(S.project); App.afterLoad(); HD.Dialogs.welcome(); }
    document.body.classList.add('ready'); const sp = document.getElementById('splash'); if (sp) sp.remove();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  };
  window.addEventListener('DOMContentLoaded', () => App.init().catch((e) => { console.error(e); const sp = document.getElementById('splash'); if (sp) sp.textContent = 'Startup error: ' + e.message; }));
})();
