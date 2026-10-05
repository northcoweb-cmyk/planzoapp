/* HouseDAW — project model, selection and undo/redo history. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const S = (HD.State = { project: null, undo: [], redo: [], sel: { clips: [], track: null }, dirty: false });

  S.COLORS = ['#ff5d73', '#ff9f43', '#ffd166', '#7bdc7b', '#3ddbd9', '#4da3ff', '#a78bfa', '#f472b6', '#9ca3af'];
  S.TYPE_COLOR = { kick: '#ff5d73', clap: '#ff9f43', hat: '#ffd166', perc: '#7bdc7b', bass: '#4da3ff', chords: '#a78bfa', fx: '#f472b6', lead: '#3ddbd9', audio: '#9ca3af', bus: '#9ca3af' };

  S.newProject = (name = 'Untitled House Track') => ({
    v: 1, id: HD.uid('proj'), name, bpm: 124, key: { root: 9, scale: 'minor' }, genre: 'House',
    loop: { on: true, s: 0, e: 32 }, metro: false,
    tracks: [], clips: [], markers: [], sounds: {},
    master: {
      vol: 0.9, fx: [
        { id: HD.uid('fx'), type: 'eq', bypass: false, p: HD.FXDEF.defaults('eq') },
        { id: HD.uid('fx'), type: 'comp', bypass: false, p: { thr: -14, ratio: 2, attack: 0.03, release: 0.2, makeup: 0 } },
        { id: HD.uid('fx'), type: 'sat', bypass: false, p: { drive: 0.12, mix: 0.4 } },
        { id: HD.uid('fx'), type: 'limiter', bypass: false, p: { thr: -1, release: 0.1 } },
      ],
      mastering: { on: true, loud: 0.12, bass: 0, treble: 0, punch: 0.15, width: 1, preset: 'Clean' }, auto: {},
    },
    sends: { a: { name: 'Reverb', fx: { id: 'sendA', type: 'reverb', p: { size: 0.6, decay: 2.6, pre: 20, damp: 0.5, wet: 1, dry: 0 } }, ret: 0.6 }, b: { name: 'Echo', fx: { id: 'sendB', type: 'delay', p: { time: 0.75, fb: 0.45, wet: 1, stereo: 0.7, tone: 4500 } }, ret: 0.5 } },
  });

  S.defaultsForTrack = (type) => ({ drum: { vol: 0.45 }, inst: { vol: 0.42 }, audio: { vol: 0.55 }, bus: { vol: 0.8 } }[type] || { vol: 0.6 });
  S.newTrack = (type, name, o = {}) => ({
    id: HD.uid('trk'), name, type, color: o.color || S.COLORS[(S.project ? S.project.tracks.length : 0) % S.COLORS.length],
    vol: S.defaultsForTrack(type).vol, pan: 0, mute: false, solo: false, sendA: 0, sendB: 0, out: 'master', fx: [], auto: {}, autoShow: null, h: 64, ...o,
  });
  S.newFx = (type, p) => ({ id: HD.uid('fx'), type, bypass: false, p: { ...HD.FXDEF.defaults(type), ...(p || {}) } });
  S.newClip = (type, trackId, start, len, o = {}) => ({ id: HD.uid('clip'), type, track: trackId, start, len, cl: len, name: '', mute: false, gain: 1, fi: 0, fo: 0, ...o });

  S.track = (id) => S.project.tracks.find((t) => t.id === id);
  S.clip = (id) => S.project.clips.find((c) => c.id === id);
  S.clipsOf = (tid) => S.project.clips.filter((c) => c.track === tid);
  S.endBeat = () => S.project.clips.reduce((m, c) => Math.max(m, c.start + c.len), 0);
  S.snapshot = () => JSON.stringify(S.project);

  S.setInstrument = (track, preset) => { track.inst = { preset: HD.clone(preset) }; delete track.inst.preset.id; track.inst.presetId = preset.id; };

  // ---------- history ----------
  S.begin = () => S.snapshot();
  S.end = (snap, label = 'edit', kind = 'structure') => {
    if (snap === S.snapshot()) return false;
    S.undo.push({ snap, label }); if (S.undo.length > 120) S.undo.shift();
    S.redo = []; S.touch(kind); return true;
  };
  S.mutate = (label, fn, kind = 'structure') => { const s = S.begin(); fn(S.project); S.end(s, label, kind); };
  S.touch = (kind = 'structure') => { S.dirty = true; HD.bus.emit('change', { kind }); };
  S.undoOne = () => {
    const e = S.undo.pop(); if (!e) return false;
    S.redo.push({ snap: S.snapshot(), label: e.label }); S.project = JSON.parse(e.snap); S.afterReplace(); return e.label;
  };
  S.redoOne = () => {
    const e = S.redo.pop(); if (!e) return false;
    S.undo.push({ snap: S.snapshot(), label: e.label }); S.project = JSON.parse(e.snap); S.afterReplace(); return e.label;
  };
  S.afterReplace = () => {
    S.sel.clips = S.sel.clips.filter((id) => S.clip(id));
    if (!S.track(S.sel.track)) S.sel.track = S.project.tracks[0] ? S.project.tracks[0].id : null;
    S.dirty = true; HD.bus.emit('project', { replaced: false }); HD.bus.emit('change', { kind: 'structure' });
  };
  S.load = (p, fresh = true) => {
    S.project = p; if (fresh) { S.undo = []; S.redo = []; }
    // register custom (generated) sounds embedded in the project
    for (const id in p.sounds || {}) { const s = p.sounds[id]; if (!HD.Lib.byId[id] && s.spec) HD.Lib.addUserSample(id, s.name, s.spec, s.sub); }
    S.sel = { clips: [], track: p.tracks[0] ? p.tracks[0].id : null };
    S.dirty = false; HD.bus.emit('project', { replaced: true }); HD.bus.emit('change', { kind: 'structure' });
  };
  S.select = (ids, track) => { S.sel.clips = ids; if (track !== undefined) S.sel.track = track; HD.bus.emit('selection', S.sel); };

  // ids of every sample used by the project (to pin them in the render cache)
  S.usedSounds = () => {
    const ids = new Set();
    for (const c of S.project.clips) { if (c.type === 'audio' && c.snd) ids.add(c.snd); if (c.type === 'drum') (c.rows || []).forEach((r) => ids.add(r.snd)); }
    return [...ids];
  };
  // keep generated sounds referenced by the project embedded in it, so saves are self-contained
  S.embedSounds = () => {
    const used = new Set(S.usedSounds()), snd = {};
    for (const id of used) { const it = HD.Lib.byId[id]; if (it && it.user && it.spec) snd[id] = { name: it.name, spec: it.spec, sub: it.sub }; }
    S.project.sounds = snd;
  };

  // ---------- track / clip helpers ----------
  S.addTrack = (type, name, o = {}) => { const t = S.newTrack(type, name, o); S.project.tracks.push(t); return t; };
  S.removeTrack = (id) => {
    const p = S.project; p.tracks = p.tracks.filter((t) => t.id !== id); p.clips = p.clips.filter((c) => c.track !== id);
    p.tracks.forEach((t) => { if (t.out === id) t.out = 'master'; });
  };
  S.cloneClip = (c, o = {}) => { const n = HD.clone(c); n.id = HD.uid('clip'); if (n.rows) n.rows.forEach((r) => (r.id = HD.uid('row'))); return Object.assign(n, o); };
  S.barsToBeats = (b) => b * 4;
  S.uniqueName = (base) => { const names = new Set(S.project.tracks.map((t) => t.name)); if (!names.has(base)) return base; let i = 2; while (names.has(base + ' ' + i)) i++; return base + ' ' + i; };

  // normalise automation <-> natural values
  S.faderToGain = (n) => (n <= 0 ? 0 : Math.pow(n, 2.2) * 1.5);
  S.gainToFader = (g) => (g <= 0 ? 0 : Math.pow(g / 1.5, 1 / 2.2));
  S.paramDef = (track, key) => {
    if (key === 'vol') return { name: 'Volume', toNat: (n) => S.faderToGain(n), fromNat: (g) => S.gainToFader(g) };
    if (key === 'pan') return { name: 'Pan', toNat: (n) => n * 2 - 1, fromNat: (v) => (v + 1) / 2 };
    if (key === 'sendA' || key === 'sendB') return { name: key === 'sendA' ? 'Reverb Send' : 'Echo Send', toNat: (n) => n, fromNat: (v) => v };
    if (key.startsWith('fx:')) {
      const [, fid, k] = key.split(':'); const fx = track && track.fx.find((f) => f.id === fid); if (!fx) return null;
      const d = HD.FXDEF[fx.type].params.find((p) => p.k === k); if (!d) return null;
      if (d.curve === 'log') return { name: HD.FXDEF[fx.type].name + ' ' + d.n, toNat: (n) => d.min * Math.pow(d.max / d.min, n), fromNat: (v) => Math.log(v / d.min) / Math.log(d.max / d.min) };
      return { name: HD.FXDEF[fx.type].name + ' ' + d.n, toNat: (n) => d.min + (d.max - d.min) * n, fromNat: (v) => (v - d.min) / (d.max - d.min) };
    }
    return null;
  };
  // automatable fx params (the ones that map to AudioParams)
  S.AUTOFX = { reverb: ['wet', 'dry'], delay: ['wet', 'fb', 'tone', 'stereo'], eq: ['low', 'mid', 'high'], comp: ['thr', 'makeup'], sat: ['mix'], filter: ['freq', 'res'], chorus: ['mix', 'depth', 'rate'], phaser: ['mix', 'fb', 'depth', 'rate'], dist: ['mix'], width: ['width'], limiter: ['thr'] };
  S.autoOptions = (track) => {
    const o = [['vol', 'Volume'], ['pan', 'Pan'], ['sendA', 'Reverb Send'], ['sendB', 'Echo Send']];
    for (const fx of track.fx) for (const k of S.AUTOFX[fx.type] || []) { const d = HD.FXDEF[fx.type].params.find((p) => p.k === k); o.push([`fx:${fx.id}:${k}`, HD.FXDEF[fx.type].name + ' – ' + d.n]); }
    return o;
  };
  S.autoValueAt = (lane, beat) => {
    if (!lane || !lane.length) return null;
    if (beat <= lane[0].t) return lane[0].v;
    for (let i = 1; i < lane.length; i++) if (beat <= lane[i].t) { const a = lane[i - 1], b = lane[i]; return a.v + (b.v - a.v) * ((beat - a.t) / Math.max(1e-9, b.t - a.t)); }
    return lane[lane.length - 1].v;
  };
})();
