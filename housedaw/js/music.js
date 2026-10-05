/* HouseDAW — music theory + MIDI content generators (chord progressions, drum / bass patterns, melodies). */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const M = (HD.Music = {});

  M.SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10], 'harmonic minor': [0, 2, 3, 5, 7, 8, 11], 'minor pentatonic': [0, 3, 5, 7, 10], 'major pentatonic': [0, 2, 4, 7, 9], chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  };
  M.CHORDS = {
    M: [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
    m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14], '9': [0, 4, 7, 10, 14], m11: [0, 3, 7, 10, 14, 17], add9: [0, 4, 7, 14], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], '5': [0, 7],
  };
  M.CHORD_LABEL = { M: 'Major', m: 'Minor', dim: 'Dim', aug: 'Aug', sus2: 'Sus2', sus4: 'Sus4', '7': 'Dom 7', maj7: 'Maj 7', m7: 'Min 7', m9: 'Min 9', maj9: 'Maj 9', '9': 'Dom 9', m11: 'Min 11', add9: 'Add 9', '6': 'Major 6', m6: 'Minor 6', '5': 'Power' };
  M.inScale = (midi, key) => { const pcs = M.SCALES[key.scale] || M.SCALES.minor; return pcs.includes((((midi - key.root) % 12) + 12) % 12); };

  // voice a chord near `center`, choosing the inversion that moves least
  M.voice = (rootPc, quality, center = 62) => {
    const iv = M.CHORDS[quality] || M.CHORDS.m;
    let best = null, bd = 1e9;
    for (let inv = 0; inv < iv.length; inv++) {
      for (let oct = 36; oct <= 60; oct += 12) {
        const base = oct + ((rootPc - oct) % 12 + 12) % 12;
        const notes = iv.map((x, i) => base + x + (i < inv ? 12 : 0)).sort((a, b) => a - b);
        const avg = notes.reduce((a, b) => a + b, 0) / notes.length, d = Math.abs(avg - center);
        if (d < bd) { bd = d; best = notes; }
      }
    }
    return best;
  };

  // rhythm styles: [[beatPos, length], ...] per bar
  const RH = {
    sustain: [[0, 3.9]], pulse: [[0, 0.5], [1, 0.5], [2, 0.5], [3, 0.5]],
    stab: [[0.5, 0.3], [1.5, 0.3], [2.5, 0.3], [3.5, 0.3]], offbeat: [[0.5, 0.75], [2.5, 0.75]],
    pianoHouse: [[0, 0.5], [0.75, 0.5], [1.5, 0.5], [2, 0.5], [2.75, 0.5], [3.5, 0.5]],
    soulful: [[0, 1.4], [1.5, 0.9], [2.75, 1.2]],
    euphoric: [[0, 0.45], [0.5, 0.45], [1, 0.45], [1.5, 0.45], [2, 0.45], [2.5, 0.45], [3, 0.45], [3.5, 0.45]],
  };
  M.RHYTHMS = Object.keys(RH).concat(['arp16', 'arp8']);

  // key: {root, scale}; prog: {chords:[[semi, quality],...], style, bars}
  M.chordNotes = (prog, key, opts = {}) => {
    const notes = [], bars = prog.chords.length, r = HD.rng(HD.hash(prog.id || prog.name || 'p')), style = opts.style || prog.style;
    let center = 62;
    prog.chords.forEach(([semi, q], bar) => {
      const v = M.voice((key.root + semi) % 12, q, center); center = v.reduce((a, b) => a + b, 0) / v.length;
      const b0 = bar * 4;
      if (style === 'arp16' || style === 'arp8') {
        const step = style === 'arp16' ? 0.25 : 0.5, seq = [];
        const up = v.concat(v.slice(1, -1).reverse());
        for (let i = 0; i < 4 / step; i++) seq.push(up[i % up.length] + (Math.floor(i / up.length) % 2 && i % 4 === 0 ? 12 : 0));
        seq.forEach((p, i) => notes.push({ p: p + 12, s: b0 + i * step, l: step * 0.9, v: i % 4 === 0 ? 0.95 : 0.7 + r() * 0.1 }));
        return;
      }
      (RH[style] || RH.sustain).forEach(([pos, len], i) => v.forEach((p) => notes.push({ p, s: b0 + pos, l: len, v: HD.round((i === 0 ? 0.92 : 0.72) + r() * 0.08 - (p === v[0] ? 0 : 0.03), 2) })));
    });
    return { notes, bars };
  };

  const PR = (id, name, mood, style, chords) => ({ id, name, mood, style, chords });
  M.PROGS = [
    PR('pg_deep1', 'Deep Minor Loop', 'Deep', 'sustain', [[0, 'm9'], [8, 'maj7'], [3, 'maj7'], [10, '7']]),
    PR('pg_deep2', 'Deep Dusk', 'Deep', 'soulful', [[0, 'm7'], [5, 'm7'], [10, 'maj7'], [3, 'maj7']]),
    PR('pg_deep3', 'Late Night Drive', 'Deep', 'offbeat', [[0, 'm9'], [0, 'm9'], [5, 'm7'], [7, 'm7']]),
    PR('pg_deep4', 'Velvet Room', 'Deep', 'sustain', [[0, 'm7'], [3, 'maj9'], [8, 'maj7'], [7, '7']]),
    PR('pg_deep5', 'Basement Jazz', 'Deep', 'soulful', [[2, 'm7'], [7, '9'], [0, 'maj7'], [9, 'm7']]),
    PR('pg_dark1', 'Dark Pulse', 'Dark', 'pulse', [[0, 'm'], [0, 'm'], [8, 'M'], [7, 'M']]),
    PR('pg_dark2', 'Midnight Minor', 'Dark', 'stab', [[0, 'm7'], [10, 'M'], [8, 'maj7'], [7, 'm7']]),
    PR('pg_dark3', 'Underground', 'Dark', 'stab', [[0, 'm'], [1, 'M'], [0, 'm'], [10, 'M']]),
    PR('pg_dark4', 'Shadow Stab', 'Dark', 'offbeat', [[0, 'm7'], [0, 'm7'], [3, 'M'], [2, 'm']]),
    PR('pg_soul1', 'Soul Sunday', 'Soulful', 'soulful', [[0, 'maj9'], [9, 'm9'], [2, 'm9'], [7, '9']]),
    PR('pg_soul2', 'Gospel Lift', 'Soulful', 'pianoHouse', [[0, 'M'], [5, 'M'], [9, 'm7'], [7, 'sus4']]),
    PR('pg_soul3', 'Warm Rhodes', 'Soulful', 'soulful', [[0, 'maj7'], [4, 'm7'], [9, 'm7'], [2, '9']]),
    PR('pg_soul4', 'Honey', 'Soulful', 'sustain', [[5, 'maj7'], [4, 'm7'], [2, 'm7'], [7, '9']]),
    PR('pg_emo1', 'Heartbreak', 'Emotional', 'sustain', [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']]),
    PR('pg_emo2', 'Tears In Rain', 'Emotional', 'sustain', [[0, 'm7'], [8, 'maj7'], [5, 'm7'], [7, '7']]),
    PR('pg_emo3', 'Slow Burn', 'Emotional', 'soulful', [[0, 'm9'], [10, '7'], [8, 'maj7'], [7, '7']]),
    PR('pg_emo4', 'Afterglow', 'Emotional', 'sustain', [[8, 'maj7'], [10, 'M'], [0, 'm7'], [0, 'm7']]),
    PR('pg_eup1', 'Sunrise Anthem', 'Euphoric', 'euphoric', [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']]),
    PR('pg_eup2', 'Peak Hour', 'Euphoric', 'euphoric', [[9, 'm'], [5, 'M'], [0, 'M'], [7, 'M']]),
    PR('pg_eup3', 'Hands Up', 'Euphoric', 'euphoric', [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']]),
    PR('pg_eup4', 'Skyline', 'Euphoric', 'euphoric', [[5, 'M'], [7, 'M'], [4, 'm'], [9, 'm']]),
    PR('pg_min1', 'Minimal One Chord', 'Minimal', 'stab', [[0, 'm7'], [0, 'm7'], [0, 'm7'], [0, 'm7']]),
    PR('pg_min2', 'Minimal Two', 'Minimal', 'offbeat', [[0, 'm7'], [0, 'm7'], [10, 'maj7'], [10, 'maj7']]),
    PR('pg_min3', 'Tiny Room', 'Minimal', 'sustain', [[0, 'm9'], [0, 'm9'], [0, 'm9'], [7, 'm7']]),
    PR('pg_min4', 'Click Chord', 'Minimal', 'stab', [[0, 'm7'], [3, 'maj7'], [0, 'm7'], [3, 'maj7']]),
    PR('pg_grv1', 'Funk Bounce', 'Groovy', 'pianoHouse', [[0, 'm7'], [5, '9'], [0, 'm7'], [7, '9']]),
    PR('pg_grv2', 'Disco Roll', 'Groovy', 'offbeat', [[0, 'm7'], [10, '9'], [8, 'maj7'], [7, '9']]),
    PR('pg_grv3', 'Jackin Stabs', 'Groovy', 'stab', [[0, 'm7'], [3, 'M'], [5, 'm7'], [7, '7']]),
    PR('pg_grv4', 'Swing Groove', 'Groovy', 'pianoHouse', [[2, 'm7'], [7, '9'], [0, 'maj7'], [0, 'maj7']]),
    PR('pg_pn1', 'Piano Classic', 'Piano House', 'pianoHouse', [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']]),
    PR('pg_pn2', 'Italo Piano', 'Piano House', 'pianoHouse', [[9, 'm'], [2, 'm'], [7, 'M'], [0, 'M']]),
    PR('pg_pn3', 'Black Keys', 'Piano House', 'pianoHouse', [[0, 'm7'], [8, 'M'], [10, 'M'], [0, 'm7']]),
    PR('pg_pn4', 'Smooth Piano', 'Piano House', 'soulful', [[0, 'maj9'], [5, 'maj7'], [4, 'm7'], [2, 'm7']]),
    PR('pg_arp1', 'Arp Dream', 'Euphoric', 'arp16', [[0, 'm9'], [8, 'maj7'], [3, 'maj7'], [10, '7']]),
    PR('pg_arp2', 'Arp Pulse', 'Groovy', 'arp8', [[0, 'm7'], [5, 'm7'], [10, 'maj7'], [7, 'm7']]),
    PR('pg_epic', 'Epic Journey (8 bars)', 'Emotional', 'sustain', [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M'], [0, 'm'], [8, 'M'], [5, 'm'], [7, 'M']]),
  ];
  M.PROGS.forEach((p) => HD.Lib.add({ id: p.id, name: p.name + ' · ' + p.chords.length + ' bars', cat: 'CHORDS', sub: p.mood, type: 'chords', prog: p, tags: [p.mood.toLowerCase(), p.style, 'chords', 'progression'] }));

  // ---------- drum patterns ----------
  const FL = {
    deep: { kick: 'k_deep_02', clap: 'c_room_01', snare: 's_house_01', chat: 'hc_soft_01', ohat: 'ho_dark_01', rim: 'p_rim_01', shaker: 'p_shaker_02', conga: 'p_conga_03', bongo: 'p_bongo_02', tom: 'p_tom_03', perc: 'p_click_02', crash: 'cr_dark_01' },
    house: { kick: 'k_club_01', clap: 'c_classic_02', snare: 's_house_02', chat: 'hc_metal_02', ohat: 'ho_classic_02', rim: 'p_rim_03', shaker: 'p_shaker_04', conga: 'p_conga_02', bongo: 'p_bongo_01', tom: 'p_tom_05', perc: 'p_click_03', crash: 'cr_bright_01' },
    tech: { kick: 'k_punch_02', clap: 'c_tight_02', snare: 's_tight_02', chat: 'hc_tech_02', ohat: 'ho_tech_01', rim: 'p_rim_05', shaker: 'p_shaker_06', conga: 'p_conga_05', bongo: 'p_bongo_04', tom: 'p_tom_06', perc: 'p_nhit_02', crash: 'cr_short_01' },
    minimal: { kick: 'k_tight_01', clap: 'c_snap_01', snare: 's_snap_01', chat: 'hc_tight_01', ohat: 'ho_tech_03', rim: 'p_rim_02', shaker: 'p_shaker_01', conga: 'p_conga_01', bongo: 'p_bongo_03', tom: 'p_tom_02', perc: 'p_click_01', crash: 'cr_short_02' },
    jackin: { kick: 'k_hard_02', clap: 'c_classic_01', snare: 's_snap_02', chat: 'hc_dirty_01', ohat: 'ho_bright_01', rim: 'p_rim_04', shaker: 'p_shaker_08', conga: 'p_conga_06', bongo: 'p_bongo_05', tom: 'p_tom_04', perc: 'p_metal_02', crash: 'cr_bright_02' },
  };
  M.FLAVORS = FL;
  M.ROWNAMES = { kick: 'Kick', clap: 'Clap', snare: 'Snare', chat: 'Closed Hat', ohat: 'Open Hat', rim: 'Rim', shaker: 'Shaker', conga: 'Conga', bongo: 'Bongo', tom: 'Tom', perc: 'Perc', crash: 'Crash' };
  const DP = (id, name, flavor, swing, rows, extra = {}) => ({ id, name, flavor, swing, rows, ...extra });
  M.DRUMPATS = [
    DP('dp_classic', 'Classic 4x4', 'house', 0, { kick: 'X...X...X...X...', clap: '....X.......X...', ohat: '..X...X...X...X.', chat: 'x.o.x.o.x.o.x.o.' }),
    DP('dp_deep', 'Deep House Groove', 'deep', 0.15, { kick: 'X...X...X...X...', clap: '....x.......x...', chat: 'o.x.o.x.o.x.o.x.', shaker: 'o.xxo.xxo.xxo.xx', conga: '..x....x..x.....', ohat: '..o...o...o...o.' }),
    DP('dp_funky', 'Funky House', 'house', 0.2, { kick: 'X...X...X..xX...', clap: '....X.......X...', chat: 'x.xox.xox.xox.xo', ohat: '..X...X...X...X.', conga: 'x..x..x...x..x..', rim: '...x..x...x..x.x' }),
    DP('dp_minimal', 'Minimal House', 'minimal', 0.05, { kick: 'X...X...X...X...', clap: '....o.......x...', chat: '..o...x...o...x.', perc: 'x.....x..x......', rim: '....x..x....x...' }),
    DP('dp_tech', 'Tech House', 'tech', 0, { kick: 'X...X...X...X...', clap: '....x.......x...', chat: 'xxoxxxoxxxoxxxox', ohat: '..x...x...x...x.', rim: 'x..x..x...x..x..' }),
    DP('dp_jackin', 'Jackin House', 'jackin', 0.18, { kick: 'X...X...X...X...', snare: '....X.......X...', chat: 'x.xxx.xxx.xxx.xx', ohat: '..X...X...X...X.', clap: '....o..o....o...' }),
    DP('dp_roll', 'Rolling Groove', 'tech', 0.1, { kick: 'X...X...X...X...', clap: '....X.......X...', chat: 'XoxoXoxoXoxoXoxo', ohat: '.o..o..o..o..o..', shaker: 'xxxxxxxxxxxxxxxx' }),
    DP('dp_drive', 'Driving Groove', 'house', 0, { kick: 'X...X...X...X...', clap: '....X.......X...', chat: 'x.x.x.x.x.x.x.x.', ohat: '..X...X...X...X.', tom: 'x.....x...x.....' }),
    DP('dp_perc', 'Percussion-Heavy Groove', 'deep', 0.12, { kick: 'X...X...X...X...', clap: '....x.......x...', chat: 'x.o.x.o.x.o.x.o.', conga: 'x..x..x.x..x..x.', shaker: 'xoxoxoxoxoxoxoxo', rim: '.....x.....x...x', tom: '.......x.....x..', perc: 'x.....x..x......' }),
    DP('dp_broken', 'Broken Beat House', 'tech', 0.1, { kick: 'X..x..X...x.X...', clap: '....X.......X..x', chat: 'x.x.x.x.x.xxx.x.', ohat: '..X.......X.....', rim: '.x..x.....x..x..' }),
    DP('dp_dub', 'Dub Minimal Groove', 'minimal', 0.1, { kick: 'X...X...X...X...', rim: '.......x.......x', chat: 'o...o...o...o...', ohat: '..o...........o.', perc: 'x.......x..x....' }),
    DP('dp_soul', 'Soulful Groove', 'deep', 0.2, { kick: 'X...X...X...X...', clap: '....x.......x...', shaker: 'x.oxx.oxx.oxx.ox', ohat: '..o...o...o...o.', chat: 'x.x.x.x.x.x.x.x.' }),
    DP('dp_afro', 'Afro House Groove', 'deep', 0.15, { kick: 'X...X...X...X...', clap: '....x.......x...', conga: 'x..x..x.x..x..x.', bongo: '.x..x...x.x..x..', shaker: 'xoxoxoxoxoxoxoxo', tom: 'x.......x.......' }),
    DP('dp_garage', 'Garage Shuffle', 'house', 0.3, { kick: 'X...X...X...X...', clap: '....X.......X...', chat: 'x.xx.xx.xx.xx.xx', ohat: '..X...X...X...X.', shaker: '.o.o.o.o.o.o.o.o' }),
    DP('dp_disco', 'Disco House', 'house', 0.12, { kick: 'X...X...X...X...', clap: '....X.......X...', ohat: '..X...X...X...X.', chat: 'x.x.x.x.x.x.x.x.', shaker: 'o.o.o.o.o.o.o.o.' }),
    DP('dp_start', 'Kick + Clap (Starter)', 'house', 0, { kick: 'X...X...X...X...', clap: '....X.......X...' }),
    DP('dp_fill1', 'Fill: Snare Roll', 'house', 0, { snare: '....o.o.o.xxXXXX', kick: 'X...X...X...X...' }, { fill: true }),
    DP('dp_fill2', 'Fill: Tom Fill', 'tech', 0, { tom: '..x.x.x.x.x.xxXX', kick: 'X...X...X.......', crash: 'X...............' }, { fill: true }),
  ];
  const CHV = { X: 1, x: 0.82, o: 0.45 };
  M.rowsFromPattern = (pat, flavor) => {
    const fl = FL[flavor || pat.flavor], rows = [];
    for (const name in pat.rows) {
      const str = pat.rows[name], notes = [];
      for (let i = 0; i < str.length; i++) if (str[i] !== '.') notes.push({ s: i * 0.25, v: CHV[str[i]], o: 0 });
      rows.push({ id: HD.uid('row'), name, snd: fl[name] || fl.perc, vol: name === 'chat' || name === 'shaker' || name === 'ohat' ? 0.75 : 1, pan: name === 'conga' ? -0.2 : name === 'bongo' ? 0.2 : name === 'shaker' ? 0.15 : 0, notes });
    }
    return { rows, bars: Math.max(1, Math.ceil(Math.max(...Object.values(pat.rows).map((s) => s.length)) / 16)) };
  };
  M.DRUMPATS.forEach((p) => HD.Lib.add({ id: p.id, name: p.name, cat: 'PATTERNS', sub: p.fill ? 'Drum Fill' : 'Drum', type: 'drum', pat: p, tags: ['drum', 'pattern', p.flavor, 'groove'] }));

  // ---------- bass patterns: [step16, semitoneOffset, lenSteps, vel] ----------
  M.BASSPATS = [
    { id: 'bp_off', name: 'Offbeat Bass', n: [[2, 0, 2, 1], [6, 0, 2, 0.9], [10, 0, 2, 1], [14, 0, 2, 0.9]] },
    { id: 'bp_roll', name: 'Rolling 16ths', n: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15].map((s, i) => [s, i % 5 === 3 ? 12 : 0, 1, i % 3 === 0 ? 1 : 0.8]) },
    { id: 'bp_walk', name: 'Deep Walking Bass', n: [[0, 0, 3, 1], [4, 0, 2, 0.85], [6, 7, 2, 0.9], [8, 0, 3, 1], [12, 3, 2, 0.85], [14, 5, 2, 0.9]] },
    { id: 'bp_bounce', name: 'Bouncy Bass', n: [[0, 0, 2, 1], [3, 0, 1, 0.8], [6, 12, 1, 0.9], [8, 0, 2, 1], [11, 0, 1, 0.8], [14, 7, 1, 0.9]] },
    { id: 'bp_funk', name: 'Funky Bass', n: [[0, 0, 1, 1], [2, 0, 1, 0.8], [3, 12, 1, 0.9], [5, 7, 1, 0.85], [8, 0, 2, 1], [10, 10, 1, 0.85], [12, 0, 1, 0.9], [14, 5, 2, 0.9]] },
    { id: 'bp_min', name: 'Minimal Pulse', n: [[2, 0, 1, 1], [10, 0, 1, 0.9], [14, 7, 1, 0.85]] },
    { id: 'bp_acid', name: 'Acid Line', n: [[0, 0, 1, 1], [1, 0, 1, 0.7], [3, 12, 1, 1], [4, 0, 1, 0.8], [6, 3, 1, 0.9], [7, 0, 1, 0.7], [9, 12, 1, 1], [10, 0, 1, 0.8], [12, 7, 1, 0.9], [14, 5, 1, 0.9], [15, 0, 1, 0.7]] },
    { id: 'bp_jack', name: 'Jackin Bass', n: [[0, 0, 2, 1], [4, 0, 1, 0.8], [6, 0, 2, 0.9], [10, 12, 1, 0.9], [12, 0, 2, 1], [15, 7, 1, 0.8]] },
    { id: 'bp_sub', name: 'Sub Long Notes', n: [[0, 0, 16, 1]] },
    { id: 'bp_sync', name: 'Syncopated Sub', n: [[0, 0, 6, 1], [6, 0, 3, 0.9], [10, 0, 3, 0.95], [14, 7, 2, 0.85]] },
    { id: 'bp_8ths', name: 'Driving 8ths', n: [0, 2, 4, 6, 8, 10, 12, 14].map((s, i) => [s, i % 4 === 3 ? 12 : 0, 2, i % 2 ? 0.85 : 1]) },
    { id: 'bp_gar', name: 'Garage Skip', n: [[0, 0, 2, 1], [3, 0, 2, 0.85], [6, 0, 1, 0.8], [8, 7, 2, 0.95], [11, 5, 2, 0.85], [14, 0, 2, 0.9]] },
  ];
  // rootMidi: absolute midi of the bass root for this chord; bars: list of root semitone offsets per bar
  M.bassNotes = (pat, rootsPerBar, keyRoot, baseMidi = 36) => {
    const out = [];
    rootsPerBar.forEach((semi, bar) => {
      const pc = (keyRoot + semi) % 12; let root = baseMidi - 6 + ((pc - (baseMidi - 6)) % 12 + 12) % 12;
      pat.n.forEach(([s, off, l, v]) => out.push({ p: root + off, s: bar * 4 + s * 0.25, l: l * 0.25 * 0.95, v }));
    });
    return out;
  };
  M.BASSPATS.forEach((p) => HD.Lib.add({ id: p.id, name: p.name, cat: 'PATTERNS', sub: 'Bass', type: 'bass', pat: p, tags: ['bass', 'pattern', 'groove'] }));

  // ---------- melodies / hooks ----------
  M.melody = (seed, key, bars = 4, density = 0.5, center = 72) => {
    const r = HD.rng(seed), sc = M.SCALES[key.scale] || M.SCALES.minor, notes = [];
    let deg = 5 + Math.floor(r() * 3);
    const degToMidi = (d) => { const o = Math.floor(d / sc.length), i = ((d % sc.length) + sc.length) % sc.length; return key.root + sc[i] + 12 * o + 12 * Math.floor((center - key.root) / 12) - 12; };
    for (let bar = 0; bar < bars; bar++) {
      let pos = 0;
      while (pos < 4) {
        const len = [0.5, 0.5, 0.75, 1, 1.5][Math.floor(r() * 5)], rest = r() > density + 0.25;
        if (!rest && pos + len <= 4.001) {
          deg += [-2, -1, -1, 0, 1, 1, 2][Math.floor(r() * 7)]; deg = HD.clamp(deg, 0, 11);
          notes.push({ p: degToMidi(deg), s: bar * 4 + pos, l: len * 0.9, v: 0.7 + r() * 0.3 });
        }
        pos += len;
      }
    }
    return notes;
  };
  [['Simple Hook', 11, 0.45], ['Busy Hook', 12, 0.8], ['Sparse Hook', 13, 0.25], ['Euphoric Hook', 14, 0.65], ['Dark Hook', 15, 0.4], ['Playful Hook', 16, 0.7]].forEach(([name, seed, den], i) =>
    HD.Lib.add({ id: 'mel_' + i, name: 'Melody – ' + name, cat: 'PATTERNS', sub: 'Melody', type: 'melody', mel: { seed, den, bars: 4 }, tags: ['melody', 'lead', 'hook'] }));

  // helpers: scale-snapped chord-assist
  M.stack = (root, quality) => (M.CHORDS[quality] || M.CHORDS.m).map((i) => root + i);
})();
