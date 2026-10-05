/* HouseDAW — composer: builds complete, fully editable projects (House Mode groove + Song Builder arrangement)
   out of the built-in library. Everything it creates is ordinary tracks/clips the user can edit. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const S = HD.State, M = HD.Music, Lib = HD.Lib;
  const C = (HD.Compose = {});

  C.GENRES = {
    'House': { bpm: 124, flavor: 'house', drums: ['dp_classic', 'dp_drive', 'dp_disco', 'dp_funky'], bass: ['bp_off', 'bp_bounce', 'bp_8ths', 'bp_funk'], pump: 0.55 },
    'Deep House': { bpm: 122, flavor: 'deep', drums: ['dp_deep', 'dp_soul', 'dp_afro', 'dp_perc'], bass: ['bp_sync', 'bp_walk', 'bp_off', 'bp_gar'], pump: 0.6 },
    'Tech House': { bpm: 126, flavor: 'tech', drums: ['dp_tech', 'dp_roll', 'dp_broken', 'dp_roll'], bass: ['bp_min', 'bp_roll', 'bp_8ths', 'bp_acid'], pump: 0.5 },
    'Minimal House': { bpm: 124, flavor: 'minimal', drums: ['dp_dub', 'dp_minimal', 'dp_minimal', 'dp_tech'], bass: ['bp_sub', 'bp_min', 'bp_sync', 'bp_roll'], pump: 0.4 },
    'Jackin House': { bpm: 125, flavor: 'jackin', drums: ['dp_jackin', 'dp_garage', 'dp_funky', 'dp_jackin'], bass: ['bp_jack', 'bp_bounce', 'bp_funk', 'bp_jack'], pump: 0.55 },
  };
  C.MOODS = {
    Dark: { prog: ['Dark', 'Deep'], bass: ['b_dark', 'b_reese', 'b_acid'], chord: 's_st_dub', pad: 's_pd_dark', lead: 's_ld_acid', style: 'stab' },
    Groovy: { prog: ['Groovy', 'Piano House'], bass: ['b_funk', 'b_bounce', 'b_jackin'], chord: 's_pn_house', pad: 's_pd_warm', lead: 's_ld_pluck', style: null },
    Sexy: { prog: ['Soulful', 'Deep'], bass: ['b_deep', 'b_garage', 'b_warm'], chord: 's_pn_rhodes', pad: 's_pd_air', lead: 's_ld_soft', style: null },
    Summer: { prog: ['Piano House', 'Euphoric'], bass: ['b_bounce', 'b_pluck', 'b_deep'], chord: 's_pn_house', pad: 's_pd_glass', lead: 's_ld_saw', style: null },
    Euphoric: { prog: ['Euphoric', 'Emotional'], bass: ['b_roll', 'b_moog', 'b_pluck'], chord: 's_st_euph', pad: 's_pd_string', lead: 's_ld_saw', style: null },
    Minimal: { prog: ['Minimal'], bass: ['b_min', 'b_sub', 'b_pluck'], chord: 's_st_classic', pad: 's_pd_air', lead: 's_pl_soft', style: 'stab' },
  };
  C.ENERGY = { Low: 0.25, Medium: 0.6, High: 0.95 };
  const MAJOR_Q = ['M', 'maj7', 'maj9', '6', 'add9'];
  C.progIsMajor = (p) => { const c = p.chords.find((x) => x[0] === 0); return !!c && MAJOR_Q.includes(c[1]); };

  const specDur = (id) => { const it = Lib.byId[id]; if (!it) return 1; if (it.spec && it.spec.p && it.spec.p.len) return it.spec.p.len; return Lib.duration(id) || 1; };
  // pick the library FX whose natural length is closest to the wanted length (so little pitch-warping is needed)
  C.fxFit = (prefixes, seconds, seed = 0) => {
    const l = Lib.items.filter((x) => prefixes.some((p) => x.id.startsWith(p)) && x.spec && x.spec.p && x.spec.p.len);
    l.sort((a, b) => Math.abs(Math.log(a.spec.p.len / seconds)) - Math.abs(Math.log(b.spec.p.len / seconds)));
    const best = l.slice(0, 3); return best[seed % best.length].id;
  };
  const pickBy = (arr, seed, off = 0) => arr[(seed + off) % arr.length];

  // ---------- reusable building blocks ----------
  C.addDrumTrack = (P, name, color, vol) => S.addTrack('drum', name, { color, vol });
  C.drumClip = (track, start, bars, patId, flavor, rowNames, o = {}) => {
    const pat = M.DRUMPATS.find((p) => p.id === patId), fl = flavor || pat.flavor;
    const { rows, bars: pb } = M.rowsFromPattern(pat, fl);
    const use = rows.filter((r) => !rowNames || rowNames.includes(r.name));
    if (!use.length) return null;
    if (o.sounds) use.forEach((r) => { if (o.sounds[r.name]) r.snd = o.sounds[r.name]; });
    return S.newClip('drum', track.id, start, bars * 4, { cl: pb * 4, rows: use, swing: o.swing != null ? o.swing : pat.swing, name: o.name || pat.name, vel: 1 });
  };
  C.midiClip = (track, start, bars, notes, loopBars, name, o = {}) => S.newClip('midi', track.id, start, bars * 4, { cl: loopBars * 4, notes, name, swing: 0, ...o });
  C.chordClip = (track, prog, key, start, bars, style) => { const { notes, bars: pb } = M.chordNotes(prog, key, { style }); return C.midiClip(track, start, bars, notes, pb, prog.name); };
  C.bassClip = (track, patId, prog, key, start, bars) => {
    const pat = M.BASSPATS.find((p) => p.id === patId), roots = prog.chords.map((c) => c[0]);
    return C.midiClip(track, start, bars, M.bassNotes(pat, roots, key.root), roots.length, pat.name);
  };
  C.fxClip = (track, snd, start, maxBeats, bpm, fit) => {
    const spb = 60 / bpm, d = specDur(snd);
    let len = Math.min(d / spb, maxBeats || 1e9), rate = 1;
    if (fit) { len = fit; rate = d / (fit * spb); }
    len = Math.max(0.5, Math.round(len * 4) / 4);
    return S.newClip('audio', track.id, start, len, { snd, off: 0, rate, name: (Lib.byId[snd] || {}).name || 'Audio' });
  };
  C.setupInstTrack = (name, presetId, color, o = {}) => {
    const t = S.addTrack('inst', name, { color, ...o }); S.setInstrument(t, Lib.byId[presetId].preset); return t;
  };

  // ---------- section plan ----------
  C.sectionPlan = (totalBars) => {
    const names = ['Intro', 'Build', 'Drop', 'Break', 'Build 2', 'Drop 2', 'Outro'], w = [2, 1, 2, 2, 1, 3, 1.5], sum = w.reduce((a, b) => a + b, 0);
    let bars = w.map((x) => Math.max(4, Math.round(((x / sum) * totalBars) / 4) * 4));
    let diff = totalBars - bars.reduce((a, b) => a + b, 0);
    bars[5] += diff; if (bars[5] < 8) bars[5] = 8;
    return names.map((n, i) => ({ name: n, bars: bars[i] }));
  };

  // ---------- main builder ----------
  C.build = (o) => {
    const genre = C.GENRES[o.genre] || C.GENRES['House'], mood = C.MOODS[o.mood] || C.MOODS.Groovy, e = C.ENERGY[o.energy] != null ? C.ENERGY[o.energy] : 0.6;
    const seed = o.seed != null ? o.seed : Math.floor(Math.random() * 9999), bpm = Math.round(o.bpm || genre.bpm), r = HD.rng(seed + 7);
    const prevProject = S.project, P = S.newProject((o.name || (o.genre + ' · ' + o.mood)) + ' (' + bpm + ')'); S.project = P; P.bpm = bpm; P.genre = o.genre || 'House';
    const progs = M.PROGS.filter((p) => mood.prog.includes(p.mood) && p.chords.length <= 4 && p.style.indexOf('arp') < 0);
    const prog = pickBy(progs, seed), keyRoots = [9, 2, 7, 0, 5, 4, 11];
    const key = o.key || { root: pickBy(keyRoots, seed, 3), scale: C.progIsMajor(prog) ? 'major' : 'minor' }; P.key = key;
    const fl = genre.flavor, ei = Math.round(e * (genre.drums.length - 1));
    const drumPat = genre.drums[ei], bassPat = genre.bass[Math.min(genre.bass.length - 1, ei)];
    const style = mood.style || prog.style, vary = (id, i) => id;
    const song = o.mode === 'song', totalBars = song ? Math.max(32, Math.round(((o.minutes || 3) * 60 * bpm) / 240 / 8) * 8) : 8;
    const plan = song ? C.sectionPlan(totalBars) : [{ name: 'Groove', bars: 8 }];

    // tracks
    const FLN = M.FLAVORS[fl], K = S.TYPE_COLOR;
    const kickSnd = FLN.kick, clapSnd = FLN.clap;
    const tKick = C.addDrumTrack(P, 'Kick', K.kick, 0.42), tClap = C.addDrumTrack(P, 'Clap', K.clap, 0.42), tHat = C.addDrumTrack(P, 'Hats', K.hat, 0.42), tOpen = C.addDrumTrack(P, 'Open Hat', K.hat, 0.42), tPerc = C.addDrumTrack(P, 'Percussion', K.perc, 0.4);
    const tBass = C.setupInstTrack('Bass', pickBy(mood.bass, seed, ei), K.bass, { vol: 0.44 });
    const tChord = C.setupInstTrack('Chords', mood.chord, K.chords, { vol: 0.38 });
    const tPad = C.setupInstTrack('Pad', mood.pad, '#7b6cf0', { vol: 0.34 });
    const tLead = C.setupInstTrack('Lead', mood.lead, K.lead, { vol: 0.36 });
    const tFx = S.addTrack('audio', 'FX', { color: K.fx, vol: 0.5 });
    // mix: sends + pump
    const pump = genre.pump * (0.7 + 0.3 * e);
    [tBass, tChord, tPad, tLead].forEach((t, i) => t.fx.push(S.newFx('pump', { depth: i === 0 ? pump * 0.7 : pump, release: 0.55 })));
    tPad.sendA = 0.32; tChord.sendA = 0.16; tLead.sendA = 0.2; tLead.sendB = 0.15; tClap.sendA = 0.12; tPerc.sendB = 0.08; tOpen.sendA = 0.06;
    tHat.fx.push(S.newFx('eq', { low: 0, mid: 0, high: 1.5 })); tKick.fx.push(S.newFx('comp', { thr: -12, ratio: 3, attack: 0.02, release: 0.1, makeup: 1.5 }));
    tBass.fx.push(S.newFx('comp', { thr: -16, ratio: 3, attack: 0.03, release: 0.15, makeup: 1 }));
    if (o.mood === 'Dark') tChord.fx.push(S.newFx('filter', { mode: 0, freq: 2600, res: 1 }));

    const rowsKick = ['kick'], rowsClap = ['clap', 'snare'], rowsHat = ['chat'], rowsOpen = ['ohat'], rowsPerc = ['rim', 'shaker', 'conga', 'bongo', 'tom', 'perc'];
    const snd = { kick: kickSnd, clap: clapSnd };
    const percPat = e > 0.5 ? (genre.drums[Math.min(3, ei + 1)] === drumPat ? 'dp_perc' : genre.drums[Math.min(3, ei + 1)]) : drumPat;
    const fillPat = e > 0.5 ? 'dp_fill2' : 'dp_fill1';
    const bpmSpb = 60 / bpm;
    let at = 0; const mk = (c) => { if (c) P.clips.push(c); return c; };
    const colorOf = { Intro: '#4da3ff', Build: '#ffd166', Drop: '#ff5d73', Break: '#a78bfa', 'Build 2': '#ffd166', 'Drop 2': '#ff5d73', Outro: '#4da3ff', Groove: '#ff5d73' };
    const fxPick = (pre, k) => { const l = Lib.items.filter((x) => x.id.startsWith(pre)); return l[(seed + k) % l.length].id; };
    const hatDensity = { Low: 0, Medium: 1, High: 2 }[o.energy] != null ? { Low: 0, Medium: 1, High: 2 }[o.energy] : 1;

    plan.forEach((sec, si) => {
      const n = sec.name, bars = sec.bars, start = at * 4, beats = bars * 4, isDrop = n.startsWith('Drop') || n === 'Groove', isBuild = n.startsWith('Build'), isBreak = n === 'Break', isIntro = n === 'Intro', isOutro = n === 'Outro';
      P.markers.push({ id: HD.uid('mk'), name: n, beat: start, bars, color: colorOf[n] });
      // drums
      const kicks = isDrop || isBuild || isIntro || isOutro;
      if (kicks) mk(C.drumClip(tKick, start, bars, drumPat, fl, rowsKick, { sounds: snd, name: 'Kick' }));
      const claps = isDrop || (isBuild && bars >= 8) || (isOutro);
      if (claps) mk(C.drumClip(tClap, start + (isBuild ? Math.min(bars, 8) * 2 : 0), bars - (isBuild ? Math.min(bars, 8) / 2 : 0), drumPat, fl, rowsClap, { sounds: snd, name: 'Clap' }));
      if (isIntro || isDrop || isBuild || isOutro) mk(C.drumClip(tHat, start, bars, drumPat, fl, rowsHat, { name: 'Hats' }));
      const pat0 = M.DRUMPATS.find((p) => p.id === drumPat);
      if ((isDrop || (isBuild && hatDensity > 0)) && pat0.rows.ohat) mk(C.drumClip(tOpen, start, bars, drumPat, fl, rowsOpen, { name: 'Open Hat' }));
      if (isDrop || (isIntro && bars >= 8 && e > 0.3) || (isBreak && e > 0.6) || isBuild) {
        const pp = isDrop ? percPat : drumPat, has = Object.keys(M.DRUMPATS.find((p) => p.id === pp).rows).some((k) => rowsPerc.includes(k));
        if (has) mk(C.drumClip(tPerc, start + (isIntro ? Math.floor(bars / 2) * 4 : 0), bars - (isIntro ? Math.floor(bars / 2) : 0), pp, fl, rowsPerc, { name: 'Percussion' }));
      }
      // fills: last bar of every 8 bars in builds/drops, and end of builds
      if (song && (isDrop || isBuild) && bars >= 8) {
        for (let b = 8; b <= bars; b += 8) { if (isDrop && b === bars && si === plan.length - 1) continue; mk(C.drumClip(tPerc, start + (b - 1) * 4, 1, fillPat, fl, null, { name: 'Fill', swing: 0 })); }
      }
      // bass
      if (isDrop || isOutro || (isBuild && bars >= 8) || (isIntro && false)) mk(C.bassClip(tBass, bassPat, prog, key, start + (isBuild ? Math.max(0, bars - 8) * 4 : 0), bars - (isBuild ? Math.max(0, bars - 8) : 0)));
      // chords / pad / lead
      const pb = prog.chords.length;
      if (isDrop || isBuild) mk(C.chordClip(tChord, prog, key, start + (isBuild ? Math.floor(bars / 2) * 4 : 0), bars - (isBuild ? Math.floor(bars / 2) : 0), style));
      if (isBreak) mk(C.chordClip(tChord, prog, key, start, bars, mood.style === 'stab' ? 'offbeat' : 'sustain'));
      if (isIntro && bars >= 8) mk(C.chordClip(tPad, prog, key, start + Math.floor(bars / 2) * 4, bars - Math.floor(bars / 2), 'sustain'));
      if (isBreak || isOutro || isBuild || n === 'Groove') mk(C.chordClip(tPad, prog, key, start, bars, 'sustain'));
      if (isDrop && (n === 'Drop 2' || e > 0.7 || !song)) mk(C.midiClip(tLead, start + (n === 'Groove' ? 16 : 0), bars - (n === 'Groove' ? 4 : 0), M.melody(seed + si, key, 4, 0.35 + e * 0.4), 4, 'Hook'));
      if (isBreak) mk(C.midiClip(tLead, start + Math.floor(bars / 2) * 4, bars - Math.floor(bars / 2), M.melody(seed + 99, key, 4, 0.3), 4, 'Break Hook'));
      // FX
      if (isDrop || n === 'Groove') {
        mk(C.fxClip(tFx, fxPick('cr_' + (e > 0.6 ? 'bright' : 'dark') + '_', si), start, 8, bpm));
        mk(C.fxClip(tFx, fxPick('fx_is_', si + 1), start, 4, bpm));
      }
      if (isBuild || n === 'Groove') {
        const rb = Math.min(bars, n === 'Groove' ? 2 : 8);
        mk(C.fxClip(tFx, C.fxFit(si % 2 ? ['fx_rt_', 'fx_rp_'] : ['fx_rn_', 'fx_rg_'], rb * 4 * bpmSpb, si), start + (bars - rb) * 4, null, bpm, rb * 4));
      }
      if (isBreak || isOutro) mk(C.fxClip(tFx, C.fxFit(['fx_dn_', 'fx_dt_'], Math.min(8, bars * 4 / 2) * bpmSpb, si), start, 8, bpm, Math.min(8, bars * 4 / 2)));
      if (isBreak && bars >= 8) mk(C.fxClip(tFx, fxPick('fx_an_', si), start, bars * 4, bpm));
      at += bars;
    });
    const total = at * 4;
    P.loop = song ? { on: false, s: 0, e: total } : { on: true, s: 0, e: 32 };
    S.project = prevProject || P;
    P.name = (o.name || ((o.genre || 'House') + ' · ' + (o.mood || 'Groovy') + (song ? ' Song' : ' Groove')));
    return P;
  };
})();
