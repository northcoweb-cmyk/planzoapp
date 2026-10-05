/* HouseDAW — project actions shared by the UI and the AI producer (all undoable). */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const S = HD.State, M = HD.Music, Lib = HD.Lib;
  const A = (HD.Actions = {});

  A.flavor = () => (HD.Compose.GENRES[S.project.genre] || HD.Compose.GENRES.House).flavor;
  A.spb = () => 60 / S.project.bpm;
  A.snd = (id) => Lib.byId[id];

  // expand a looping clip's notes/rows into the window [from,to) (beats, clip-relative); results are re-based to 0
  A.expand = (clip, from, to) => {
    const cl = Math.max(0.25, clip.cl || clip.len), out = {};
    const take = (arr) => { const o = []; for (let k = 0; k * cl < to; k++) for (const n of arr) { const s = k * cl + n.s; if (s >= from - 1e-9 && s < to - 1e-9) o.push({ ...n, s: HD.round(s - from, 4), l: n.l == null ? undefined : Math.min(n.l, k * cl + cl - s, to - s) }); } return o; };
    if (clip.type === 'midi') out.notes = take(clip.notes || []);
    if (clip.type === 'drum') out.rows = (clip.rows || []).map((r) => ({ ...r, id: HD.uid('row'), notes: take(r.notes).map((n) => { delete n.l; return n; }) }));
    return out;
  };

  A.splitClip = (id, beat) => {
    const c = S.clip(id); if (!c) return false;
    const rel = beat - c.start; if (rel <= 0.0625 || rel >= c.len - 0.0625) return false;
    const right = S.cloneClip(c, { start: beat, len: HD.round(c.len - rel, 4) });
    if (c.type === 'audio') {
      const spb = A.spb(), rate = c.rate || 1; right.off = (c.off || 0) + rel * spb * rate;
      const buf = Lib.buffer(c.snd) || Lib.bufs[c.snd]; if (buf && c.loop) right.off = (c.off || 0) + (((right.off - (c.off || 0)) % Math.max(0.01, buf.duration - (c.off || 0))));
      right.fi = 0; c.fo = 0;
    } else {
      const ex = A.expand(c, rel, c.len); Object.assign(right, ex); right.cl = right.len;
      const lx = A.expand(c, 0, rel); Object.assign(c, lx); c.cl = Math.max(0.25, rel);
    }
    c.len = HD.round(rel, 4); S.project.clips.push(right); S.sel.clips = [c.id, right.id];
    return right;
  };

  A.defaultRow = (item) => {
    const pats = { Kick: 'X...X...X...X...', Clap: '....X.......X...', Snare: '....X.......X...', 'Closed Hat': '..x...x...x...x.', 'Open Hat': '..X...X...X...X.', Percussion: 'x..x..x...x..x..', Crash: 'X...............' };
    const str = pats[item.sub] || 'X...X...X...X...', notes = [];
    for (let i = 0; i < 16; i++) if (str[i] !== '.') notes.push({ s: i * 0.25, v: str[i] === 'X' ? 1 : 0.82, o: 0 });
    return { id: HD.uid('row'), name: item.sub, snd: item.id, vol: 1, pan: 0, notes };
  };

  A.findTrack = (type, id) => { const t = id && S.track(id); return t && t.type === type ? t : null; };
  A.newDrumTrack = (name) => S.addTrack('drum', S.uniqueName(name), { color: S.TYPE_COLOR[/kick/i.test(name) ? 'kick' : /clap|snare/i.test(name) ? 'clap' : /hat/i.test(name) ? 'hat' : 'perc'] });
  A.newInstTrack = (name, presetId, color) => { const t = S.addTrack('inst', S.uniqueName(name), { color }); S.setInstrument(t, Lib.byId[presetId].preset); return t; };
  A.clipAt = (trackId, beat) => S.project.clips.find((c) => c.track === trackId && beat >= c.start && beat < c.start + c.len);

  // add any library item to the project. target: {trackId, beat}
  A.addItem = (item, target = {}) => {
    const P = S.project, beat = Math.max(0, target.beat != null ? target.beat : Math.floor(HD.Transport && HD.Transport.beat ? HD.Transport.beat() / 4 : 0) * 4);
    const snap = S.begin(); let res = null; const spb = A.spb();
    const tTrack = target.trackId ? S.track(target.trackId) : null;
    const done = (label) => { S.end(snap, label); return res; };
    if (item.type === 'sample' || item.type === 'import') {
      const oneShotDrum = item.cat === 'DRUMS' && item.sub !== 'Perc Loop';
      if (oneShotDrum) {
        let tr = A.findTrack('drum', target.trackId) || A.newDrumTrack(item.sub === 'Closed Hat' ? 'Hats' : item.sub === 'Open Hat' ? 'Open Hat' : item.sub);
        const over = A.clipAt(tr.id, beat);
        if (over && over.type === 'drum') { over.rows.push(A.defaultRow(item)); res = { trackId: tr.id, clipId: over.id }; }
        else { const c = S.newClip('drum', tr.id, beat, 16, { cl: 4, rows: [A.defaultRow(item)], swing: 0, name: item.name }); P.clips.push(c); res = { trackId: tr.id, clipId: c.id }; }
        S.select([res.clipId], tr.id);
        return done('Add ' + item.name);
      }
      const tr = A.findTrack('audio', target.trackId) || S.addTrack('audio', S.uniqueName(item.cat === 'FX' ? 'FX' : item.cat === 'VOCALS' ? 'Vocals' : 'Audio'), { color: S.TYPE_COLOR[item.cat === 'FX' ? 'fx' : item.cat === 'VOCALS' ? 'chords' : 'audio'] });
      const buf = Lib.buffer(item.id) || Lib.bufs[item.id]; if (!buf) { HD.toast('Could not load that sound'); return null; }
      let len = buf.duration / spb, rate = 1;
      if (item.loopBpm) { rate = P.bpm / item.loopBpm; len = item.beats; }
      len = Math.max(0.5, Math.round(len * 4) / 4);
      const c = S.newClip('audio', tr.id, beat, len, { snd: item.id, off: 0, rate, name: item.name, loop: !!item.loopBpm });
      if (item.loopBpm) c.len = item.beats * 4; // loops arrive 4 repeats long
      P.clips.push(c); res = { trackId: tr.id, clipId: c.id }; S.select([c.id], tr.id);
      return done('Add ' + item.name);
    }
    if (item.type === 'inst') {
      if (tTrack && tTrack.type === 'inst') { S.setInstrument(tTrack, item.preset); res = { trackId: tTrack.id }; S.select(S.sel.clips, tTrack.id); return done('Set instrument ' + item.name); }
      const tr = S.addTrack('inst', S.uniqueName(item.name), { color: item.cat === 'BASS' ? S.TYPE_COLOR.bass : S.TYPE_COLOR.lead }); S.setInstrument(tr, item.preset);
      const c = S.newClip('midi', tr.id, beat, 16, { cl: 16, notes: [], name: item.name + ' clip', swing: 0 }); P.clips.push(c); res = { trackId: tr.id, clipId: c.id }; S.select([c.id], tr.id);
      return done('Add instrument ' + item.name);
    }
    const instTarget = (preset) => A.findTrack('inst', target.trackId) || A.newInstTrack(preset === 'b_deep' ? 'Bass' : preset === 's_ld_soft' ? 'Lead' : 'Chords', preset, preset === 'b_deep' ? S.TYPE_COLOR.bass : preset === 's_ld_soft' ? S.TYPE_COLOR.lead : S.TYPE_COLOR.chords);
    if (item.type === 'chords') {
      const tr = instTarget('s_pn_house'), { notes, bars } = M.chordNotes(item.prog, P.key);
      const c = S.newClip('midi', tr.id, beat, bars * 4, { cl: bars * 4, notes, name: item.prog.name, swing: 0 }); P.clips.push(c); res = { trackId: tr.id, clipId: c.id }; S.select([c.id], tr.id);
      if (!P.tracks.some((t) => t.id === tr.id && t.type === 'inst')) return null;
      return done('Add chords ' + item.prog.name);
    }
    if (item.type === 'bass') {
      const tr = instTarget('b_deep'), c = S.newClip('midi', tr.id, beat, 16, { cl: 4, notes: M.bassNotes(item.pat, [0], P.key.root), name: item.pat.name, swing: 0 });
      P.clips.push(c); res = { trackId: tr.id, clipId: c.id }; S.select([c.id], tr.id); return done('Add bass ' + item.pat.name);
    }
    if (item.type === 'melody') {
      const tr = instTarget('s_ld_soft'), c = S.newClip('midi', tr.id, beat, 16, { cl: 16, notes: M.melody(item.mel.seed, P.key, 4, item.mel.den), name: item.name, swing: 0 });
      P.clips.push(c); res = { trackId: tr.id, clipId: c.id }; S.select([c.id], tr.id); return done('Add melody');
    }
    if (item.type === 'drum') {
      const tr = A.findTrack('drum', target.trackId) || A.newDrumTrack(item.pat.fill ? 'Fills' : 'Drums');
      const { rows, bars } = M.rowsFromPattern(item.pat, A.flavor()), len = item.pat.fill ? 4 : 16;
      const c = S.newClip('drum', tr.id, beat, len, { cl: bars * 4, rows, swing: item.pat.swing, name: item.pat.name }); P.clips.push(c); res = { trackId: tr.id, clipId: c.id }; S.select([c.id], tr.id);
      return done('Add drum pattern ' + item.pat.name);
    }
    return null;
  };

  A.addEmptyClip = (trackId, beat, bars = 4) => {
    const t = S.track(trackId); if (!t || t.type === 'audio' || t.type === 'bus') return null;
    let c; const snap = S.begin();
    if (t.type === 'drum') c = S.newClip('drum', t.id, beat, bars * 4, { cl: 4, rows: [{ id: HD.uid('row'), name: 'Kick', snd: M.FLAVORS[A.flavor()].kick, vol: 1, pan: 0, notes: [] }], swing: 0, name: 'Pattern' });
    else c = S.newClip('midi', t.id, beat, bars * 4, { cl: bars * 4, notes: [], name: 'Clip', swing: 0 });
    S.project.clips.push(c); S.sel.clips = [c.id]; S.end(snap, 'New clip'); return c;
  };

  A.deleteClips = (ids) => S.mutate('Delete clips', (P) => { P.clips = P.clips.filter((c) => !ids.includes(c.id)); S.sel.clips = []; });
  A.duplicateClips = (ids) => {
    const cl = ids.map(S.clip).filter(Boolean); if (!cl.length) return;
    const a = Math.min(...cl.map((c) => c.start)), z = Math.max(...cl.map((c) => c.start + c.len)), span = z - a, out = [];
    S.mutate('Duplicate clips', (P) => { cl.forEach((c) => { const n = S.cloneClip(c, { start: c.start + span }); P.clips.push(n); out.push(n.id); }); S.sel.clips = out; });
  };
  A.splitSelected = (beat) => {
    const snap = S.begin(); let any = false;
    for (const id of S.sel.clips.slice()) { if (A.splitClip(id, beat)) any = true; }
    if (any) S.end(snap, 'Split'); return any;
  };

  A.quantize = (clip, sel, grid, strength = 1) => {
    if (!clip || clip.type !== 'midi') return;
    clip.notes.forEach((n, i) => { if (sel && sel.length && !sel.includes(i)) return; const q = Math.round(n.s / grid) * grid; n.s = HD.round(n.s + (q - n.s) * strength, 4); });
  };

  // set tempo; keeps audio loops in sync by rescaling their playbackRate
  A.applyBpm = (P, bpm) => {
    bpm = HD.clamp(Math.round(bpm * 10) / 10, 60, 200); P.bpm = bpm;
    for (const c of P.clips) if (c.type === 'audio') { const it = Lib.byId[c.snd]; if (it && it.loopBpm) c.rate = bpm / it.loopBpm; }
    return bpm;
  };
  A.setBpm = (bpm) => S.mutate('Tempo', (P) => A.applyBpm(P, bpm), 'transport');

  A.randomName = () => ['Warehouse', 'Neon Dusk', 'Velvet Floor', 'Midnight Loop', 'Basement Glow', 'After Hours', 'Sunday Session', 'Low Light'][Math.floor(Math.random() * 8)];
})();
