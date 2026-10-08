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

  // ---------- Vibes: each is a complete groove "personality" (tempo, drums, bass, hat feel, hook, pump) ----------
  // Their numbers come from measuring real reference house tracks (continuous 16th hats with accented off-beats, bass hits on
  // the pickup 16ths, deep kick-ducking, bright harmonic bass, steady 16–32 bar drops) — never from copying any recording.
  C.VIBES = {
    Bouncy: { desc: 'Tech-house bounce: pickup bass, short stabs, vocal-chop hook', genre: 'Tech House', bpm: 127, drums: ['dp_bounce', 'dp_tech'], perc: 'dp_bounce', kicks: ['k_punch_02', 'k_tight_03', 'k_club_02'], claps: ['c_tight_02', 'c_snap_02'], chat: 'hc_tech_02', ohat: 'ho_tech_02', bass: ['b_tech', 'b_bounce2', 'b_bounce'], pats: ['bp_pick3', 'bp_pick1', 'bp_pick2'], rhythm: 'techstab', hook: 'chop', swing: 0.07, pump: 0.8 },
    Rolling: { desc: 'Driving rolling bass, tight hats, minimal stabs', genre: 'Tech House', bpm: 128, drums: ['dp_roll', 'dp_ware'], perc: 'dp_roll', kicks: ['k_tight_01', 'k_punch_04', 'k_hard_03'], claps: ['c_tight_03', 'c_classic_03'], chat: 'hc_tech_05', ohat: 'ho_tech_04', bass: ['b_roll', 'b_tech', 'b_moog'], pats: ['bp_pick2', 'bp_pick3', 'bp_pick2'], rhythm: 'pickup', hook: 'riff', swing: 0.06, pump: 0.85 },
    Dusty: { desc: 'Laid-back swung deep house, warm keys, soft hats', genre: 'Deep House', bpm: 124, drums: ['dp_dusty', 'dp_deep', 'dp_soul'], perc: 'dp_dusty', kicks: ['k_deep_03', 'k_soft_02', 'k_club_03'], claps: ['c_room_01', 'c_dark_02'], chat: 'hc_soft_02', ohat: 'ho_dark_02', bass: ['b_deep', 'b_garage', 'b_warm'], pats: ['bp_pick4', 'bp_pick1', 'bp_pick4'], rhythm: 'dubchord', hook: 'melody', swing: 0.16, pump: 0.55, crackle: true },
    Miami: { desc: 'Bright bouncy bass house with vocal chops and claps', genre: 'Jackin House', bpm: 129, drums: ['dp_miami', 'dp_jackin'], perc: 'dp_miami', kicks: ['k_club_01', 'k_punch_01', 'k_sat_02'], claps: ['c_classic_02', 'c_wide_01'], chat: 'hc_metal_03', ohat: 'ho_bright_02', bass: ['b_bounce', 'b_jackin', 'b_funk'], pats: ['bp_pick5', 'bp_pick3', 'bp_pick5'], rhythm: 'pickup', hook: 'chop', swing: 0.05, pump: 0.8 },
    Warehouse: { desc: 'Dark driving warehouse groove, acid bass, toms', genre: 'Minimal House', bpm: 130, drums: ['dp_ware', 'dp_minimal'], perc: 'dp_ware', kicks: ['k_hard_02', 'k_tight_05', 'k_sat_03'], claps: ['c_dark_03', 'c_tight_01'], chat: 'hc_tight_03', ohat: 'ho_classic_03', bass: ['b_acid', 'b_dark', 'b_wob'], pats: ['bp_pick2', 'bp_pick3', 'bp_pick2'], rhythm: 'dubchord', hook: 'riff', swing: 0.03, pump: 0.7 },
    Sunset: { desc: 'Melodic uplifting house with piano and a singing lead', genre: 'House', bpm: 124, drums: ['dp_classic', 'dp_drive', 'dp_disco'], perc: 'dp_disco', kicks: ['k_deep_01', 'k_club_04', 'k_soft_01'], claps: ['c_classic_01', 'c_room_02'], chat: 'hc_metal_02', ohat: 'ho_classic_02', bass: ['b_moog', 'b_deep', 'b_garage'], pats: ['bp_pick1', 'bp_pick4', 'bp_pick1'], rhythm: null, hook: 'melody', swing: 0.08, pump: 0.6 },
  };
  C.VIBE_BY_GENRE = { 'House': 'Bouncy', 'Deep House': 'Dusty', 'Tech House': 'Rolling', 'Minimal House': 'Warehouse', 'Jackin House': 'Miami' };

  // ---------- main builder ----------
  C.build = (o) => {
    const genre = C.GENRES[o.genre] || C.GENRES['House'], mood = C.MOODS[o.mood] || C.MOODS.Groovy, e = C.ENERGY[o.energy] != null ? C.ENERGY[o.energy] : 0.6;
    const vibeName = o.vibe && C.VIBES[o.vibe] ? o.vibe : C.VIBE_BY_GENRE[o.genre] || 'Bouncy', V = C.VIBES[vibeName];
    const seed = o.seed != null ? o.seed : Math.floor(Math.random() * 9999), bpm = Math.round(o.bpm || V.bpm || genre.bpm), r = HD.rng(seed + 7);
    const prevProject = S.project, P = S.newProject((o.name || (o.genre + ' · ' + o.mood)) + ' (' + bpm + ')'); S.project = P; P.bpm = bpm; P.genre = o.genre || 'House'; P.vibe = vibeName;
    const progs = M.PROGS.filter((p) => mood.prog.includes(p.mood) && p.chords.length <= 4 && p.style.indexOf('arp') < 0);
    const prog = pickBy(progs, seed), keyRoots = [9, 2, 7, 0, 5, 4, 11];
    const key = o.key || { root: pickBy(keyRoots, seed, 3), scale: C.progIsMajor(prog) ? 'major' : 'minor' }; P.key = key;
    const fl = V.genre ? (C.GENRES[V.genre] || genre).flavor : genre.flavor, ei = Math.round(e * (V.drums.length - 1));
    const drumPat = V.drums[Math.min(V.drums.length - 1, ei)], percPat = V.perc, bassPats = V.pats, bassPreset = pickBy(V.bass, seed, ei);
    const style = V.rhythm || mood.style || prog.style;
    const song = o.mode === 'song', totalBars = song ? Math.max(32, Math.round(((o.minutes || 3) * 60 * bpm) / 240 / 8) * 8) : 8;
    const plan = song ? C.sectionPlan(totalBars) : [{ name: 'Groove', bars: 8 }];

    // sounds: vibe-specific picks (kick/clap/hats), the rest from the flavour kit
    const FLN = M.FLAVORS[fl], K = S.TYPE_COLOR;
    const snd = { kick: pickBy(V.kicks, seed, 1), clap: pickBy(V.claps, seed, 2), chat: V.chat, ohat: V.ohat };
    // tracks (volumes are a starting point — Auto-mix then balances them against the reference profile)
    const tKick = C.addDrumTrack(P, 'Kick', K.kick, 0.4), tClap = C.addDrumTrack(P, 'Clap', K.clap, 0.8), tHat = C.addDrumTrack(P, 'Hats', K.hat, 0.62), tOpen = C.addDrumTrack(P, 'Open Hat', K.hat, 0.52), tPerc = C.addDrumTrack(P, 'Percussion', K.perc, 0.95);
    const tBass = C.setupInstTrack('Bass', bassPreset, K.bass, { vol: 0.42 });
    const tChord = C.setupInstTrack('Chords', mood.chord, K.chords, { vol: 0.6 });
    const tPad = C.setupInstTrack('Pad', mood.pad, '#7b6cf0', { vol: 0.3 });
    const chopPreset = pickBy(['v_ah', 'v_oh', 'v_eh', 'v_uu'], seed, 2);
    const tLead = V.hook === 'chop' ? C.setupInstTrack('Vocal Chops', chopPreset, K.lead, { vol: 0.75 }) : C.setupInstTrack('Lead', mood.lead, K.lead, { vol: 0.55 });
    const tFx = S.addTrack('audio', 'FX', { color: K.fx, vol: 0.5 });
    // mix: kick-ducking pump (deep, like the references), light compression, sends
    const pump = V.pump * (0.85 + 0.2 * e);
    [tBass, tChord, tPad, tLead].forEach((t, i) => t.fx.push(S.newFx('pump', { depth: Math.min(0.92, i === 0 ? pump : pump * 0.9), release: 0.62, curve: 1.3 })));
    tPad.sendA = 0.3; tChord.sendA = 0.14; tLead.sendA = 0.18; tLead.sendB = 0.14; tClap.sendA = 0.12; tPerc.sendB = 0.08; tOpen.sendA = 0.06;
    tKick.fx.push(S.newFx('comp', { thr: -12, ratio: 3, attack: 0.02, release: 0.1, makeup: 1 }));
    tBass.fx.push(S.newFx('comp', { thr: -16, ratio: 3, attack: 0.03, release: 0.15, makeup: 1 }));
    if (o.mood === 'Dark') tChord.fx.push(S.newFx('filter', { mode: 0, freq: 3200, res: 1 }));

    const rowsKick = ['kick'], rowsClap = ['clap', 'snare'], rowsHat = ['chat'], rowsOpen = ['ohat'], rowsPerc = ['rim', 'shaker', 'conga', 'bongo', 'tom', 'perc'];
    const swing = V.swing, fillPat = e > 0.5 ? 'dp_fill2' : 'dp_fill1', spb = 60 / bpm;
    let at = 0; const mk = (c) => { if (c) P.clips.push(c); return c; };
    const colorOf = { Intro: '#4da3ff', Build: '#ffd166', Drop: '#ff5d73', Break: '#a78bfa', 'Build 2': '#ffd166', 'Drop 2': '#ff5d73', Outro: '#4da3ff', Groove: '#ff5d73' };
    const fxPick = (pre, k) => { const l = Lib.items.filter((x) => x.id.startsWith(pre)); return l[(seed + k) % l.length].id; };
    const dclip = (track, start, bars, pat, rows, name, o2 = {}) => mk(C.drumClip(track, start, bars, pat, fl, rows, { sounds: snd, swing, name, ...o2 }));
    // bass: alternate two patterns in 8-bar blocks so a long drop keeps moving
    const bassBlocks = (start, bars) => { for (let b = 0; b < bars; b += 8) { const len = Math.min(8, bars - b), pat = bassPats[Math.floor(b / 8) % 2 === 0 ? 0 : 1] || bassPats[0]; mk(C.bassClip(tBass, pat, prog, key, start + b * 4, len)); } };
    const hookClip = (start, bars, name, si) => {
      if (V.hook === 'chop') mk(C.midiClip(tLead, start, bars, M.chopRiff(seed + si, key, 2, 60), 2, 'Chop riff', { swing: 0 }));
      else if (V.hook === 'riff') mk(C.midiClip(tLead, start, bars, M.chopRiff(seed + si, key, 2, 66), 2, 'Riff', { swing: 0 }));
      else mk(C.midiClip(tLead, start, bars, M.melody(seed + si, key, 4, 0.35 + e * 0.35), 4, name || 'Hook'));
    };

    plan.forEach((sec, si) => {
      const n = sec.name, bars = sec.bars, start = at * 4, isDrop = n.startsWith('Drop') || n === 'Groove', isBuild = n.startsWith('Build'), isBreak = n === 'Break', isIntro = n === 'Intro', isOutro = n === 'Outro';
      const nextIsDrop = song && plan[si + 1] && plan[si + 1].name.startsWith('Drop');
      P.markers.push({ id: HD.uid('mk'), name: n, beat: start, bars, color: colorOf[n] });
      const gap = nextIsDrop && bars >= 4 ? 1 : 0; // beats of kick/hat drop-out right before the drop
      const len = (b) => b - gap / 4; // clip lengths in bars, leaving the pre-drop gap
      // drums
      if (isDrop || isBuild || isIntro || isOutro) dclip(tKick, start, len(bars), drumPat, rowsKick, 'Kick');
      if (isDrop || (isBuild && bars >= 8) || isOutro) { const off = isBuild ? Math.min(bars, 8) / 2 : 0; dclip(tClap, start + off * 4, len(bars) - off, drumPat, rowsClap, 'Clap'); }
      if (isIntro || isDrop || isBuild || isOutro) dclip(tHat, start, len(bars), drumPat, rowsHat, 'Hats');
      const pat0 = M.DRUMPATS.find((p) => p.id === drumPat);
      if ((isDrop || isBuild) && pat0.rows.ohat) dclip(tOpen, start, len(bars), drumPat, rowsOpen, 'Open Hat');
      if (isDrop || (isIntro && bars >= 8 && e > 0.3) || (isBreak && e > 0.6) || isBuild) {
        const pp = isDrop ? percPat : drumPat, has = Object.keys(M.DRUMPATS.find((p) => p.id === pp).rows).some((k) => rowsPerc.includes(k)), off = isIntro ? Math.floor(bars / 2) : 0;
        if (has) dclip(tPerc, start + off * 4, len(bars) - off, pp, rowsPerc, 'Percussion');
      }
      if ((isDrop || isBuild) && (bars >= 8 || n === 'Groove')) {
        if (n === 'Groove') mk(C.drumClip(tPerc, start + 28, 1, fillPat, fl, ['snare', 'tom'], { sounds: snd, name: 'Fill', swing: 0 }));
        else for (let b = 8; b <= bars; b += 8) { if (isDrop && b === bars && si === plan.length - 1) continue; mk(C.drumClip(tPerc, start + (b - 1) * 4, 1, fillPat, fl, ['snare', 'tom'], { sounds: snd, name: 'Fill', swing: 0 })); }
      }
      // bass (stops with the kick before the drop)
      if (isDrop) bassBlocks(start, bars);
      else if (isOutro) bassBlocks(start, Math.max(8, Math.floor(bars / 2)));
      else if (isBuild && bars >= 8) bassBlocks(start + Math.max(0, bars - 8) * 4, 8);
      // harmony
      if (isDrop || isBuild) mk(C.chordClip(tChord, prog, key, start + (isBuild ? Math.floor(bars / 2) * 4 : 0), bars - (isBuild ? Math.floor(bars / 2) : 0), style));
      if (isBreak) mk(C.chordClip(tChord, prog, key, start, bars, 'sustain'));
      if (isIntro && bars >= 8) mk(C.chordClip(tPad, prog, key, start + Math.floor(bars / 2) * 4, bars - Math.floor(bars / 2), 'sustain'));
      if (isBreak || isOutro || isBuild || n === 'Groove') mk(C.chordClip(tPad, prog, key, start, bars, 'sustain'));
      // hook: chops/riff/melody in drops (bar 3 on in the groove), a melodic version in the break
      if (isDrop && (n === 'Drop 2' || e > 0.4 || !song)) hookClip(start + (n === 'Groove' ? 8 : 0), bars - (n === 'Groove' ? 2 : 0), 'Hook', si);
      if (isBreak) mk(C.midiClip(tLead, start + Math.floor(bars / 2) * 4, bars - Math.floor(bars / 2), M.melody(seed + 99, key, 4, 0.3), 4, 'Break Hook'));
      // FX: crash + impact + sub drop on every drop, risers/snare-roll feel into it, downlifters out of it
      if (isDrop || n === 'Groove') {
        mk(C.fxClip(tFx, fxPick('cr_' + (e > 0.6 ? 'bright' : 'dark') + '_', si), start, 8, bpm));
        mk(C.fxClip(tFx, fxPick('fx_is_', si + 1), start, 4, bpm));
        if (song) mk(C.fxClip(tFx, fxPick('fx_dr_', si), start, 8, bpm));
      }
      if (isBuild || n === 'Groove') {
        const rb = Math.min(bars, n === 'Groove' ? 2 : 8);
        mk(C.fxClip(tFx, C.fxFit(si % 2 ? ['fx_rt_', 'fx_rp_'] : ['fx_rn_', 'fx_rg_'], rb * 4 * spb, si), start + (bars - rb) * 4, null, bpm, rb * 4));
      }
      if (isBreak || isOutro) mk(C.fxClip(tFx, C.fxFit(['fx_dn_', 'fx_dt_'], Math.min(8, bars * 4 / 2) * spb, si), start, 8, bpm, Math.min(8, bars * 4 / 2)));
      if (isBreak && bars >= 8) mk(C.fxClip(tFx, fxPick('fx_an_', si), start, bars * 4, bpm));
      if (V.crackle && (isIntro || isBreak || isOutro) && song) { const c = C.fxClip(tFx, 'fx_ac_01', start, 24, bpm); c.len = bars * 4; c.loop = true; c.gain = 0.35; mk(c); }
      at += bars;
    });
    const total = at * 4;
    P.loop = song ? { on: false, s: 0, e: total } : { on: true, s: 0, e: 32 };
    S.project = prevProject || P;
    P.name = (o.name || (vibeName + ' · ' + (o.mood || 'Groovy') + (song ? ' Song' : ' Groove')));
    return P;
  };
})();
