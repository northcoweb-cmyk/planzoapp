/* HouseDAW — built-in sound catalog. ~400 sample sounds are defined as deterministic specs
   (families of designed variations) and rendered locally on demand by HD.Dsp. Nothing is downloaded. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const J = (r, a, b) => a + (b - a) * r();
  const R4 = (v) => Math.round(v * 10000) / 10000;
  const pad = (i) => String(i + 1).padStart(2, '0');

  const Lib = (HD.Lib = {
    items: [], byId: {}, sr: 44100, ctx: null,
    raw: {}, bufs: {}, thumbs: {}, favs: new Set(),
  });

  Lib.add = (it) => { if (Lib.byId[it.id]) { Lib.items[Lib.items.indexOf(Lib.byId[it.id])] = it; } else Lib.items.push(it); Lib.byId[it.id] = it; return it; };

  // Build `count` variations from per-parameter ranges ([lo,hi] => jittered, number => fixed)
  function fam(idp, label, count, cat, sub, mkSpec, extra = {}) {
    for (let i = 0; i < count; i++) {
      const r = HD.rng(HD.hash(idp + i));
      const spec = mkSpec(r, i, count); spec.seed = HD.hash(idp + i + 's') % 100000;
      Lib.add({ id: idp + '_' + pad(i), name: label + ' ' + pad(i), cat, sub, type: 'sample', spec, tags: [label.toLowerCase(), sub.toLowerCase()], ...extra });
    }
  }
  const ranged = (r, rg) => { const p = {}; for (const k in rg) { const v = rg[k]; p[k] = Array.isArray(v) ? R4(J(r, v[0], v[1])) : v; } return p; };
  const clamp = HD.clamp;

  // ---------- KICKS (60) ----------
  const kick = (key, label, n, rg) => fam('k_' + key, label + ' Kick', n, 'DRUMS', 'Kick', (r) => {
    const p = ranged(r, { att: 0.001, body: 1, ...rg });
    p.len = R4(clamp(Math.max(p.dec, p.subDec || 0) * 4.2 + 0.04, 0.14, 1.7)); return { kind: 'kick', p };
  });
  kick('deep', 'Deep House', 7, { f0: [125, 165], f1: [43, 50], pt: [0.035, 0.055], dec: [0.26, 0.4], subDec: [0.3, 0.5], click: [0.1, 0.25], ckF: [2200, 3200], sub: [0.8, 1], drive: [0.05, 0.3], tone: [8000, 12000] });
  kick('punch', 'Punchy House', 7, { f0: [190, 260], f1: [50, 58], pt: [0.018, 0.03], dec: [0.17, 0.25], subDec: [0.2, 0.3], click: [0.55, 0.9], ckF: [3200, 4800], sub: [0.7, 0.9], drive: [0.3, 0.5] });
  kick('tight', 'Tight House', 6, { f0: [180, 240], f1: [54, 62], pt: [0.015, 0.025], dec: [0.09, 0.15], subDec: [0.1, 0.16], click: [0.4, 0.7], ckF: [3000, 4500], sub: [0.6, 0.8], drive: [0.2, 0.4] });
  kick('sub', 'Sub-Heavy', 6, { f0: [105, 150], f1: [37, 44], pt: [0.045, 0.07], dec: [0.4, 0.65], subDec: [0.55, 0.8], click: [0.05, 0.15], sub: [1.1, 1.4], body: 0.8, drive: [0, 0.15], tone: [5000, 8000] });
  kick('club', 'Club', 6, { f0: [165, 215], f1: [47, 54], pt: [0.025, 0.04], dec: [0.3, 0.4], subDec: [0.35, 0.5], click: [0.35, 0.55], sub: [0.85, 1.05], drive: [0.35, 0.6] });
  kick('short', 'Short', 5, { f0: [170, 230], f1: [52, 60], pt: [0.015, 0.025], dec: [0.06, 0.09], subDec: [0.07, 0.1], click: [0.3, 0.6], sub: [0.5, 0.7], drive: [0.2, 0.5] });
  kick('long', 'Long', 5, { f0: [130, 170], f1: [42, 48], pt: [0.04, 0.06], dec: [0.5, 0.8], subDec: [0.7, 1.0], click: [0.1, 0.3], sub: [1, 1.2], drive: [0.05, 0.2] });
  kick('soft', 'Soft', 5, { f0: [85, 125], f1: [45, 52], pt: [0.03, 0.05], dec: [0.2, 0.32], subDec: [0.25, 0.38], click: [0.03, 0.12], sub: 0.8, drive: 0, tone: [3000, 5000], att: [0.004, 0.008] });
  kick('hard', 'Hard', 6, { f0: [250, 340], f1: [50, 60], pt: [0.012, 0.022], dec: [0.14, 0.22], subDec: [0.16, 0.25], click: [0.95, 1.3], ckF: [4500, 6500], sub: [0.6, 0.8], drive: [0.65, 0.9] });
  kick('sat', 'Saturated', 7, { f0: [140, 200], f1: [46, 54], pt: [0.03, 0.05], dec: [0.3, 0.45], subDec: [0.35, 0.5], click: [0.2, 0.4], sub: [0.7, 0.9], drive: [0.8, 1], tone: [6000, 10000] });

  // ---------- CLAPS (28) ----------
  const clap = (key, label, n, rg) => fam('c_' + key, label + ' Clap', n, 'DRUMS', 'Clap', (r) => ({ kind: 'clap', p: ranged(r, rg) }));
  clap('classic', 'Classic', 6, { nb: 4, sp: [0.010, 0.013], fc: [1200, 1800], q: [0.8, 1.1], tail: [0.1, 0.18], tailLvl: 0.5, room: [0.1, 0.3] });
  clap('tight', 'Tight', 5, { nb: 3, sp: [0.007, 0.009], fc: [1500, 2400], q: 1, tail: [0.04, 0.07], tailLvl: 0.4, room: [0, 0.1] });
  clap('room', 'Roomy', 5, { nb: 4, sp: [0.011, 0.014], fc: [1100, 1700], q: 0.9, tail: [0.2, 0.3], tailLvl: 0.55, room: [0.5, 0.8] });
  clap('snap', 'Snappy', 4, { nb: 3, sp: [0.007, 0.009], fc: [2000, 3000], q: 1.2, tail: [0.06, 0.1], tailLvl: 0.35, drive: [0.2, 0.4] });
  clap('dark', 'Dark', 4, { nb: 4, sp: [0.011, 0.013], fc: [800, 1100], q: 0.8, tail: [0.12, 0.2], tailLvl: 0.5, room: [0.2, 0.4] });
  clap('wide', 'Wide Layered', 4, { nb: 5, sp: [0.012, 0.016], fc: [1300, 1900], q: 0.9, tail: [0.12, 0.2], tailLvl: 0.5, room: [0.3, 0.5], st: 1 });

  // ---------- SNARES (28) ----------
  const snare = (key, label, n, rg) => fam('s_' + key, label + ' Snare', n, 'DRUMS', 'Snare', (r) => {
    const p = ranged(r, rg); p.len = R4(clamp(Math.max(p.nd, p.td) * 5 + 0.05 + (p.room || 0) * 0.3, 0.2, 1.1)); return { kind: 'snare', p };
  });
  snare('tight', 'Tight', 6, { f: [190, 240], td: [0.04, 0.06], nd: [0.08, 0.12], hp: [2000, 3000], snap: 0.85 });
  snare('house', 'House', 6, { f: [170, 210], td: [0.07, 0.1], nd: [0.14, 0.2], hp: [1600, 2200], room: [0.15, 0.3] });
  snare('room', 'Roomy', 5, { f: [170, 200], td: [0.08, 0.11], nd: [0.25, 0.35], hp: [1500, 2000], room: [0.5, 0.8] });
  snare('dark', 'Dark', 4, { f: [150, 180], td: [0.08, 0.12], nd: [0.14, 0.2], hp: [1200, 1600], lp: [7000, 9000], room: 0.2 });
  snare('snap', 'Snappy', 4, { f: [220, 280], td: [0.05, 0.07], nd: [0.1, 0.16], hp: [2500, 3500], snap: 1, drive: [0.3, 0.5] });
  snare('tonal', 'Tonal', 3, { f: [280, 340], td: [0.05, 0.08], nd: [0.05, 0.08], hp: 3000, tone: 1.1, snap: 0.5 });

  // ---------- HATS (34 closed + 28 open) ----------
  const chat = (key, label, n, rg) => fam('hc_' + key, label + ' Closed Hat', n, 'DRUMS', 'Closed Hat', (r) => ({ kind: 'hat', p: ranged(r, rg) }));
  chat('tight', 'Tight', 7, { dec: [0.012, 0.02], ts: [0.9, 1.1], metal: 0.7, noise: 0.3, hp: [7500, 9000], st: [0.3, 0.6] });
  chat('metal', 'Classic', 7, { dec: [0.025, 0.04], ts: [0.95, 1.05], metal: 0.85, noise: 0.25, hp: [6500, 7500], st: [0.4, 0.7] });
  chat('tech', 'Tech Noise', 7, { dec: [0.02, 0.035], ts: 1, metal: 0.1, noise: 0.9, hp: [6000, 8000], st: [0.5, 0.9] });
  chat('bright', 'Bright', 5, { dec: [0.02, 0.03], ts: [1.05, 1.2], metal: 0.6, noise: 0.5, hp: [8500, 10000], bright: [4, 7], st: 0.6 });
  chat('soft', 'Soft', 4, { dec: [0.03, 0.045], ts: [0.85, 0.95], metal: 0.5, noise: 0.5, hp: [5500, 6500], st: 0.4 });
  chat('dirty', 'Dirty', 4, { dec: [0.025, 0.04], ts: [1.2, 1.4], metal: 1, noise: 0.6, hp: [6000, 7500], st: 0.7 });
  const ohat = (key, label, n, rg) => fam('ho_' + key, label + ' Open Hat', n, 'DRUMS', 'Open Hat', (r) => ({ kind: 'hat', p: ranged(r, rg) }));
  ohat('classic', 'Classic', 7, { dec: [0.12, 0.2], ts: [0.95, 1.05], metal: 0.8, noise: 0.35, hp: [6500, 7500], st: [0.5, 0.8] });
  ohat('long', 'Long', 6, { dec: [0.25, 0.4], ts: [0.95, 1.05], metal: 0.7, noise: 0.45, hp: [6500, 7500], st: 0.8 });
  ohat('tech', 'Tech', 5, { dec: [0.15, 0.25], ts: 1, metal: 0.15, noise: 0.9, hp: [6000, 7500], st: [0.6, 1] });
  ohat('bright', 'Bright', 5, { dec: [0.14, 0.22], ts: [1.05, 1.2], metal: 0.6, noise: 0.5, hp: [8000, 9500], bright: [4, 6], st: 0.7 });
  ohat('dark', 'Dark', 5, { dec: [0.2, 0.3], ts: [0.82, 0.9], metal: 0.6, noise: 0.5, hp: [5000, 6000], st: 0.6 });

  // ---------- PERCUSSION (60) ----------
  const perc = (key, label, n, rg, spp) => fam('p_' + key, label, n, 'DRUMS', 'Percussion', (r, i) => {
    const p = ranged(r, rg); p.len = R4(clamp((p.dec || 0.1) * 5 + 0.03, 0.05, 1.2)); if (spp) spp(p, i, r); return { kind: 'perc', p };
  }, { tags: [label.toLowerCase(), 'percussion'] });
  perc('shaker', 'Shaker', 10, { type: 'shaker', fc: [5000, 9000], q: [0.8, 1.6], dec: [0.04, 0.1], att: [0.006, 0.02], st: [0.2, 0.6] });
  perc('rim', 'Rim', 8, { type: 'rim', f: [450, 1100], ratio: [1.6, 2.1], dec: [0.012, 0.035], click: [0.3, 0.7], st: 0.2 });
  perc('tom', 'Tom', 8, { type: 'tom', f: [70, 200], dec: [0.2, 0.4], drop: [0.6, 1.1], slap: [0.2, 0.5], lp: [3000, 6000] });
  perc('conga', 'Conga', 8, { type: 'conga', f: [190, 330], drop: [0.15, 0.3], dec: [0.12, 0.25], slap: [0.2, 0.5], over: [0.15, 0.4] });
  perc('bongo', 'Bongo', 6, { type: 'bongo', f: [380, 600], drop: [0.15, 0.3], dec: [0.08, 0.14], slap: [0.25, 0.5], over: 0.3 });
  perc('click', 'Click', 6, { type: 'click', f: [1800, 6000], dec: [0.004, 0.01], noise: [0.1, 0.5] });
  perc('metal', 'Metal Perc', 6, { type: 'metal', f: [600, 2200], ratio: [1.41, 3.5], idx: [2, 6], dec: [0.05, 0.35], st: 0.4 });
  perc('cow', 'Cowbell', 2, { type: 'cowbell', f: [540, 700], dec: [0.15, 0.3] });
  perc('nhit', 'Noise Hit', 6, { type: 'nhit', fc: [1500, 9000], q: [1.5, 4], dec: [0.03, 0.12], sweep: [-0.5, 1.5], st: 0.5 });

  // ---------- CRASHES (16) ----------
  const crash = (key, label, n, rg) => fam('cr_' + key, label + ' Crash', n, 'DRUMS', 'Crash', (r) => ({ kind: 'crash', p: ranged(r, rg) }));
  crash('bright', 'Bright', 5, { len: [2, 3], dec: [0.5, 0.9], hp: [4200, 5500], metal: [0.3, 0.5], bright: [3, 6], att: [0.003, 0.01] });
  crash('dark', 'Dark', 4, { len: [2.2, 3.2], dec: [0.6, 1], hp: [2800, 3600], lp: [10000, 13000], metal: [0.2, 0.4], ts: 0.8 });
  crash('short', 'Short', 4, { len: [0.9, 1.3], dec: [0.18, 0.3], hp: [3800, 5000], metal: [0.3, 0.5] });
  crash('long', 'Long', 3, { len: [3.4, 4.2], dec: [1, 1.4], hp: [3500, 4800], metal: [0.25, 0.45], att: [0.01, 0.03] });

  // ---------- PERCUSSION LOOPS (8, rendered at 124 BPM) ----------
  const PS = (type, o) => ({ kind: 'perc', seed: 7, p: { type, len: 0.3, ...o } });
  const loops = [
    ['Shaker 16ths', [{ spec: PS('shaker', { fc: 7500, dec: 0.045, att: 0.008 }), steps: 'oxoxoxoxoxoxoxox', g: 0.9 }]],
    ['Offbeat Shaker', [{ spec: PS('shaker', { fc: 6500, dec: 0.07, att: 0.012 }), steps: '..x...x...x...x.', g: 1 }, { spec: PS('shaker', { fc: 8500, dec: 0.03, att: 0.005 }), steps: 'o.o.o.o.o.o.o.o.', g: 0.6, pan: 0.3 }]],
    ['Conga Groove', [{ spec: PS('conga', { f: 250, drop: 0.2, dec: 0.15, slap: 0.35, over: 0.3 }), steps: 'x..x..x...x.x...', g: 0.9, pan: -0.3 }, { spec: PS('conga', { f: 320, drop: 0.2, dec: 0.12, slap: 0.4, over: 0.3 }), steps: '..x...x.x...x.x.', g: 0.7, pan: 0.3 }]],
    ['Bongo Bounce', [{ spec: PS('bongo', { f: 480, drop: 0.2, dec: 0.1, slap: 0.4, over: 0.3 }), steps: 'x.x.xx..x.x.x.xx', g: 0.85, pan: -0.2 }, { spec: PS('bongo', { f: 560, drop: 0.2, dec: 0.09, slap: 0.4, over: 0.3 }), steps: '.x.x..x..x.x..x.', g: 0.7, pan: 0.2 }]],
    ['Rim Shuffle', [{ spec: PS('rim', { f: 800, ratio: 1.83, dec: 0.02, click: 0.5 }), steps: '..x..x..x..x..x.', g: 0.8 }, { spec: PS('shaker', { fc: 7000, dec: 0.04, att: 0.008 }), steps: 'xoxoxoxoxoxoxoxo', g: 0.6 }]],
    ['Tom Roll Groove', [{ spec: PS('tom', { f: 110, dec: 0.25, drop: 0.8, slap: 0.3, lp: 4000 }), steps: 'x.....x...x.....', g: 0.9 }, { spec: PS('tom', { f: 150, dec: 0.2, drop: 0.8, slap: 0.3, lp: 4500 }), steps: '..x.......x.x...', g: 0.8, pan: 0.25 }, { spec: PS('shaker', { fc: 7500, dec: 0.045, att: 0.008 }), steps: 'oxoxoxoxoxoxoxox', g: 0.5 }]],
    ['Metal Tick Groove', [{ spec: PS('click', { f: 4000, dec: 0.006, noise: 0.3 }), steps: 'x.xxx.xxx.xxx.x.', g: 0.7 }, { spec: PS('cowbell', { f: 600, dec: 0.12 }), steps: '..x.......x....x', g: 0.5, pan: -0.3 }]],
    ['Tech Perc Mix', [{ spec: PS('nhit', { fc: 5200, q: 3, dec: 0.05, sweep: 0.5 }), steps: '.x..x..x..x..x..', g: 0.8, pan: 0.2 }, { spec: PS('shaker', { fc: 8000, dec: 0.035, att: 0.006 }), steps: 'xxoxxxoxxxoxxxox', g: 0.55 }, { spec: PS('conga', { f: 280, drop: 0.2, dec: 0.12, slap: 0.4, over: 0.3 }), steps: 'x.....x...x.....', g: 0.7, pan: -0.3 }]],
  ];
  loops.forEach(([name, voices], i) => Lib.add({ id: 'loop_' + pad(i), name: 'Perc Loop – ' + name, cat: 'DRUMS', sub: 'Perc Loop', type: 'sample', loopBpm: 124, beats: 4, spec: { kind: 'loop', seed: 100 + i, p: { bpm: 124, bars: 1, voices } }, tags: ['loop', 'groove', 'percussion'] }));

  // ---------- FX (117) ----------
  const BAR = 60 / 124 * 4; // one bar @124 BPM
  const fx = (idp, label, n, sub, mkSpec, extra) => fam(idp, label, n, 'FX', sub, mkSpec, { tags: [label.toLowerCase(), sub.toLowerCase(), 'fx'], ...extra });
  const lens = [1, 2, 2, 4, 4, 4, 8, 8];
  fx('fx_rn', 'Noise Riser', 8, 'Riser', (r, i) => ({ kind: 'riser', p: { type: 'noise', len: R4(lens[i] * BAR), f0: R4(J(r, 150, 400)), f1: R4(J(r, 6000, 12000)), shape: R4(J(r, 1.3, 2)), curve: R4(J(r, 1.6, 2.6)), q: R4(J(r, 1.2, 4)), st: R4(J(r, 0.4, 0.9)), panRate: R4(J(r, 0.15, 0.6)) } }));
  fx('fx_rt', 'Tonal Riser', 4, 'Riser', (r, i) => ({ kind: 'riser', p: { type: 'tone', len: R4([2, 4, 4, 8][i] * BAR), f0: 300, f1: R4(J(r, 5000, 9000)), tf0: R4(J(r, 80, 140)), tf1: R4(J(r, 600, 1400)), tone: R4(J(r, 0.35, 0.6)), q: 1.6, shape: 1.8, curve: 2.2 } }));
  fx('fx_rp', 'Pitch Riser', 4, 'Riser', (r, i) => ({ kind: 'riser', p: { type: 'pitch', len: R4([2, 2, 4, 4][i] * BAR), f0: 400, f1: 4000, tf0: R4(J(r, 60, 120)), tf1: R4(J(r, 500, 1000)), shape: 1.6, curve: 1.8 } }));
  fx('fx_rg', 'Tension Riser', 4, 'Riser', (r, i) => ({ kind: 'riser', p: { type: 'gate', len: R4([2, 4, 4, 8][i] * BAR), f0: R4(J(r, 400, 900)), f1: R4(J(r, 4000, 8000)), r0: R4(J(r, 2, 4)), r1: R4(J(r, 24, 40)), duty: R4(J(r, 0.35, 0.6)), q: 2.2, curve: 1.5 } }));
  fx('fx_dn', 'Downlifter', 7, 'Downlifter', (r, i) => ({ kind: 'riser', p: { type: 'noise', reverse: true, len: R4([1, 1, 2, 2, 2, 4, 4][i] * BAR), f0: R4(J(r, 200, 500)), f1: R4(J(r, 5000, 10000)), shape: R4(J(r, 1.2, 1.8)), curve: R4(J(r, 1.6, 2.4)), q: R4(J(r, 1.2, 3.5)), st: 0.7 } }));
  fx('fx_dt', 'Tonal Downlifter', 5, 'Downlifter', (r, i) => ({ kind: 'riser', p: { type: 'tone', reverse: true, len: R4([1, 2, 2, 4, 4][i] * BAR), f0: 300, f1: R4(J(r, 4000, 8000)), tf0: R4(J(r, 70, 130)), tf1: R4(J(r, 500, 1100)), tone: 0.5, q: 1.6, shape: 1.6, curve: 2 } }));
  fx('fx_is', 'Short Impact', 8, 'Impact', (r) => ({ kind: 'impact', p: { len: R4(J(r, 0.5, 1)), f0: R4(J(r, 100, 190)), f1: R4(J(r, 38, 55)), pt: R4(J(r, 0.08, 0.2)), dec: R4(J(r, 0.15, 0.35)), cd: R4(J(r, 0.04, 0.1)), noise: R4(J(r, 0.4, 0.9)), lp: R4(J(r, 3500, 8000)), verb: R4(J(r, 0.3, 0.7)), vmix: R4(J(r, 0.25, 0.45)), drive: R4(J(r, 0, 0.4)) } }));
  fx('fx_il', 'Long Impact', 6, 'Impact', (r) => ({ kind: 'impact', p: { len: R4(J(r, 3, 4.5)), f0: R4(J(r, 90, 160)), f1: R4(J(r, 30, 45)), pt: R4(J(r, 0.15, 0.3)), dec: R4(J(r, 0.9, 1.6)), cd: R4(J(r, 0.1, 0.2)), noise: R4(J(r, 0.5, 0.9)), lp: R4(J(r, 3000, 6000)), verb: R4(J(r, 2, 3.2)), vmix: R4(J(r, 0.55, 0.8)), drive: R4(J(r, 0, 0.3)) } }));
  fx('fx_su', 'Noise Sweep Up', 6, 'Sweep', (r) => ({ kind: 'sweep', p: { dir: 'up', len: R4(J(r, 1.9, 3.9)), f0: R4(J(r, 200, 500)), f1: R4(J(r, 6000, 11000)), q: R4(J(r, 3, 9)), bell: R4(J(r, 0.8, 1.8)), skew: 1.0, panRate: R4(J(r, 0.2, 0.8)), verb: R4(J(r, 0.8, 1.5)) } }));
  fx('fx_sd', 'Noise Sweep Down', 6, 'Sweep', (r) => ({ kind: 'sweep', p: { dir: 'down', len: R4(J(r, 1.9, 3.9)), f0: R4(J(r, 200, 500)), f1: R4(J(r, 6000, 11000)), q: R4(J(r, 3, 9)), bell: R4(J(r, 0.8, 1.8)), skew: 1.0, panRate: R4(J(r, 0.2, 0.8)), verb: R4(J(r, 0.8, 1.5)) } }));
  fx('fx_sb', 'Noise Sweep Arc', 4, 'Sweep', (r) => ({ kind: 'sweep', p: { dir: 'updown', len: R4(J(r, 1.9, 3.9)), f0: R4(J(r, 300, 600)), f1: R4(J(r, 5000, 9000)), q: R4(J(r, 3, 8)), bell: 1, panRate: R4(J(r, 0.2, 0.7)), verb: 1 } }));
  const rsrc = [
    (r) => ({ kind: 'crash', seed: 3, p: { len: 2.4, dec: R4(J(r, 0.5, 0.9)), hp: R4(J(r, 3500, 5000)), metal: 0.4 } }),
    (r) => ({ kind: 'clap', seed: 4, p: { nb: 4, sp: 0.011, fc: R4(J(r, 1200, 1800)), tail: 0.15, room: 0.5 } }),
    (r) => ({ kind: 'snare', seed: 5, p: { f: R4(J(r, 170, 220)), td: 0.08, nd: 0.2, hp: 2000, room: 0.5 } }),
    (r) => ({ kind: 'impact', seed: 6, p: { len: 2, f0: 130, f1: 40, dec: 0.5, verb: 1.2, vmix: 0.5, noise: 0.7 } }),
    (r) => ({ kind: 'hat', seed: 8, p: { dec: R4(J(r, 0.3, 0.5)), hp: 6500, metal: 0.7, noise: 0.5, len: 1 } }),
  ];
  const rnames = ['Reverse Crash', 'Reverse Clap', 'Reverse Snare', 'Reverse Impact', 'Reverse Hat'];
  let rcount = 0;
  [3, 2, 2, 2, 3].forEach((cnt, si) => {
    for (let k = 0; k < cnt; k++, rcount++) {
      const r = HD.rng(HD.hash('rev' + si + k)), len = R4(J(r, 1.1, 2.1));
      Lib.add({ id: 'fx_rv_' + pad(rcount), name: rnames[si] + ' ' + pad(k), cat: 'FX', sub: 'Reverse', type: 'sample', tags: ['reverse', 'transition', 'fx'], spec: { kind: 'reverse', seed: 50 + rcount, p: { src: rsrc[si](r), len, verb: R4(J(r, 0.8, 1.6)) } } });
    }
  });
  fx('fx_dr', 'Sub Drop', 10, 'Drop', (r) => ({ kind: 'drop', p: { len: R4(J(r, 0.8, 2.5)), f0: R4(J(r, 180, 400)), f1: R4(J(r, 28, 40)), k: R4(J(r, 3, 7)), dec: R4(J(r, 0.5, 1.4)), drive: R4(J(r, 0, 0.6)), noise: R4(J(r, 0, 0.5)) } }));
  fx('fx_wh', 'Whoosh', 12, 'Whoosh', (r, i) => ({ kind: 'whoosh', p: { dir: ['up', 'down', 'updown'][i % 3], len: R4(J(r, 0.5, 1.5)), f0: R4(J(r, 300, 900)), f1: R4(J(r, 4000, 9000)), q: R4(J(r, 1.2, 2.5)), panRate: R4(J(r, 0.5, 1.5)), verb: R4(J(r, 0, 0.8)) } }));
  const chords = [[0, 7, 12], [0, 3, 7, 10], [0, 7, 12, 19], [0, 5, 7, 12], [0, 4, 7, 11]];
  fx('fx_hs', 'Synth Hit', 5, 'Hit', (r, i) => ({ kind: 'synhit', p: { f: R4(J(r, 110, 220)), chord: chords[i], det: R4(J(r, 8, 18)), dec: R4(J(r, 0.3, 0.7)), fc0: R4(J(r, 3000, 7000)), fc1: R4(J(r, 300, 900)), fd: R4(J(r, 0.08, 0.2)), len: R4(J(r, 1.2, 2)), verb: R4(J(r, 1, 2)) } }));
  fx('fx_zp', 'Laser Zap', 4, 'Hit', (r, i) => ({ kind: 'zap', p: { len: R4(J(r, 0.2, 0.5)), f0: R4(J(r, 2500, 7000)), f1: R4(J(r, 100, 400)), k: R4(J(r, 4, 9)), dec: R4(J(r, 0.1, 0.25)), wave: ['sine', 'saw', 'square', 'sine'][i], verb: R4(J(r, 0, 0.8)), lp: R4(J(r, 6000, 12000)) } }));
  fx('fx_an', 'Noise Atmosphere', 3, 'Atmosphere', (r) => ({ kind: 'atmos', p: { type: 'noise', len: R4(J(r, 6, 9)), fc: R4(J(r, 500, 1600)), q: R4(J(r, 1, 3)), lfo: R4(J(r, 0.07, 0.16)), verb: R4(J(r, 1.5, 3)) } }));
  fx('fx_ad', 'Dark Drone', 3, 'Atmosphere', (r) => ({ kind: 'atmos', p: { type: 'drone', len: R4(J(r, 6, 9)), f: R4(J(r, 55, 98)), fc: R4(J(r, 400, 900)), lfo: R4(J(r, 0.08, 0.2)), verb: R4(J(r, 1.5, 2.5)) } }));
  fx('fx_as', 'Shimmer', 2, 'Atmosphere', (r) => ({ kind: 'atmos', p: { type: 'shimmer', len: R4(J(r, 6, 9)), f: R4(J(r, 600, 1200)), verb: 2 } }));
  fx('fx_aw', 'Wind', 2, 'Atmosphere', (r) => ({ kind: 'atmos', p: { type: 'wind', len: R4(J(r, 6, 9)), fc: R4(J(r, 400, 1200)), q: 0.8, lfo: R4(J(r, 0.08, 0.2)), verb: 1.5 } }));
  fx('fx_ac', 'Vinyl Crackle', 2, 'Atmosphere', (r, i) => ({ kind: 'atmos', p: { type: 'crackle', len: 6, rate: i ? 110 : 55 } }));

  // ---------- VOCALS (24): formant-synth vocal-like sounds ----------
  const voxItems = [];
  [['a', 'A3', 57], ['a', 'C4', 60], ['o', 'D4', 62], ['e', 'E4', 64], ['a', 'G3', 55], ['i', 'A4', 69], ['o', 'F3', 53], ['u', 'C4', 60], ['e', 'D3', 50], ['a', 'E3', 52], ['o', 'A3', 57], ['i', 'G4', 67], ['ae', 'C4', 60], ['u', 'G3', 55]].forEach(([v, nn, midi], i) => {
    voxItems.push({ id: 'vx_chop_' + pad(i), name: `Vocal Chop ${v.toUpperCase()} ${nn}`, sub: 'Chop', spec: { kind: 'vox', seed: 200 + i, p: { f: HD.mtof(midi), v1: v, v2: v, len: 0.28 + (i % 4) * 0.06, dec: 0.12 + (i % 3) * 0.04, hard: i % 2 ? 0.25 : 0, breath: 0.1, verb: 0.5 } } });
  });
  [['a', 'o', 'C3', 48], ['o', 'u', 'A2', 45], ['a', 'a', 'E3', 52], ['u', 'o', 'G3', 55]].forEach(([v1, v2, nn, midi], i) => {
    voxItems.push({ id: 'vx_tex_' + pad(i), name: `Vocal Pad ${['Ahh–Ooh', 'Ooh–Uu', 'Ahh', 'Uu–Ooh'][i]} ${nn}`, sub: 'Texture', spec: { kind: 'vox', seed: 300 + i, p: { f: HD.mtof(midi), v1, v2, len: 2.2 + i * 0.3, sus: true, att: 0.35, rel: 0.7, vib: 0.012, breath: 0.2, verb: 1.8, morph: 0.8 } } });
  });
  [['e', 'ae', 'A3', 57, 'Hey'], ['u', 'a', 'G3', 55, 'Uh'], ['a', 'a', 'D4', 62, 'Ha'], ['o', 'e', 'F3', 53, 'Yeah']].forEach(([v1, v2, nn, midi, w], i) => {
    voxItems.push({ id: 'vx_shout_' + pad(i), name: `Vocal Shout ${w} ${nn}`, sub: 'Shout', spec: { kind: 'vox', seed: 400 + i, p: { f: HD.mtof(midi), v1, v2, len: 0.32, dec: 0.1, hard: 0.5, glide: 0.08, breath: 0.2, vib: 0.002, morph: 3, verb: 0.4 } } });
  });
  [['a', 'A4', 69], ['o', 'E4', 64]].forEach(([v, nn, midi], i) => {
    voxItems.push({ id: 'vx_whisper_' + pad(i), name: `Whisper Breath ${v.toUpperCase()}`, sub: 'FX', spec: { kind: 'vox', seed: 500 + i, p: { f: HD.mtof(midi), v1: v, v2: v, len: 0.5 + i * 0.25, dec: 0.22, whisper: 1, breath: 0.9, att: 0.05, verb: 1 } } });
  });
  voxItems.forEach((v) => Lib.add({ ...v, cat: 'VOCALS', type: 'sample', tags: ['vocal', 'synthetic', v.sub.toLowerCase()] }));

  // ---------- rendering / caching ----------
  // Sounds render lazily. AudioBuffers are cached with an LRU cap; ids pinned by the open project are never evicted.
  Lib.pinned = new Set(); Lib.order = []; Lib.bytes = 0; Lib.maxBytes = 96e6;
  Lib.pin = (ids) => { Lib.pinned = new Set(ids); };
  const evict = () => {
    for (let i = 0; i < Lib.order.length && Lib.bytes > Lib.maxBytes;) {
      const id = Lib.order[i], it = Lib.byId[id];
      if (Lib.pinned.has(id) || !it || it.type === 'import') { i++; continue; }
      Lib.bytes -= Lib.bufs[id].length * 8; delete Lib.bufs[id]; Lib.order.splice(i, 1);
    }
  };
  Lib.rawOf = (id, sr) => {
    const it = Lib.byId[id]; if (!it || !it.spec) return null;
    return HD.Dsp.render(it.spec, sr || Lib.sr);
  };
  Lib.makeBuffer = (L, R, sr) => {
    let b;
    try { b = new AudioBuffer({ length: L.length, numberOfChannels: 2, sampleRate: sr }); }
    catch (e) { b = Lib.ctx.createBuffer(2, L.length, sr); }
    b.copyToChannel(L, 0); b.copyToChannel(R || L, 1); return b;
  };
  // returns an AudioBuffer (works for live + offline contexts)
  Lib.buffer = (id) => {
    if (Lib.bufs[id]) return Lib.bufs[id];
    const it = Lib.byId[id]; if (!it || it.type === 'import') return null;
    const s = Lib.rawOf(id, Lib.sr); if (!s) return null;
    if (!Lib.thumbs[id]) Lib.thumbs[id] = HD.Dsp.thumb(s, 72);
    const b = (Lib.bufs[id] = Lib.makeBuffer(s.L, s.R, s.sr));
    Lib.order.push(id); Lib.bytes += b.length * 8; evict();
    return b;
  };
  // waveform thumbnail without keeping the audio around
  Lib.thumb = (id) => {
    if (Lib.thumbs[id]) return Lib.thumbs[id];
    const b = Lib.bufs[id];
    if (b) return (Lib.thumbs[id] = HD.computePeaks([b.getChannelData(0), b.numberOfChannels > 1 ? b.getChannelData(1) : b.getChannelData(0)], 72));
    const it = Lib.byId[id];
    if (it && it.spec) { const s = Lib.rawOf(id, Lib.sr); return (Lib.thumbs[id] = HD.Dsp.thumb(s, 72)); }
    return null;
  };
  Lib.duration = (id) => { const b = Lib.buffer(id); return b ? b.duration : 0; };

  // user-generated sample (spec based; stored as spec, re-rendered deterministically)
  Lib.addUserSample = (id, name, spec, sub = 'Generated') => {
    if (Lib.bufs[id]) { Lib.bytes -= Lib.bufs[id].length * 8; delete Lib.bufs[id]; Lib.order = Lib.order.filter((x) => x !== id); } delete Lib.thumbs[id];
    return Lib.add({ id, name, cat: 'MY SOUNDS', sub, type: 'sample', user: true, spec, tags: ['generated', 'my sound'] });
  };
  Lib.addImport = (id, name, buffer, meta = {}) => {
    Lib.bufs[id] = buffer; delete Lib.thumbs[id];
    return Lib.add({ id, name, cat: 'MY SOUNDS', sub: 'Imported', type: 'import', user: true, meta, tags: ['imported', 'audio'] });
  };
  Lib.count = (pred) => Lib.items.filter(pred).length;
  Lib.stats = () => {
    const c = {}; for (const it of Lib.items) { const k = it.cat + '/' + it.sub; c[k] = (c[k] || 0) + 1; } return c;
  };
})();
