/* HouseDAW — instrument presets (bass + synths), custom wavetables, effect definitions and house FX chains. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});

  // harmonic-amplitude tables for PeriodicWave based timbres
  HD.WAVES = {
    organ: [0, 1, 0.8, 0.6, 0.45, 0, 0.3, 0, 0.25, 0, 0, 0, 0.1],
    glass: [0, 1, 0, 0.5, 0, 0.35, 0, 0.18, 0, 0.12, 0, 0.07, 0, 0.04],
    warm: [0, 1, 0.5, 0.25, 0.12, 0.06, 0.03],
    pulse: [0, 1, 0.9, 0.64, 0.3, 0, 0.18, 0.2, 0.14, 0, 0.09, 0.1, 0.07],
    hollow: [0, 1, 0, 0.33, 0, 0.2, 0, 0.14, 0, 0.1],
    tine: [0, 1, 0.1, 0.35, 0.05, 0.02],
  };

  const BASE = () => ({
    osc: [{ w: 'sawtooth', oct: 0, det: 0, lvl: 1, uni: 1, sp: 0 }], sub: 0, subW: 'sine', noise: 0,
    filt: { type: 'lowpass', f: 2000, q: 1, env: 0, key: 0, a: 0.003, d: 0.2, s: 0 },
    amp: { a: 0.005, d: 0.2, s: 0.8, r: 0.15 }, drive: 0, comp: 0, width: 1, lvl: 0.7, fm: null, lfo: null, pv: 60, prev: [0],
  });
  const Presets = (HD.Presets = { list: [], byId: {} });
  function P(id, name, cat, sub, o) {
    const b = BASE();
    const pr = { ...b, ...o, filt: { ...b.filt, ...(o.filt || {}) }, amp: { ...b.amp, ...(o.amp || {}) }, osc: o.osc || b.osc, id, name, cat, subcat: sub };
    pr.osc = pr.osc.map((x) => ({ w: 'sawtooth', oct: 0, det: 0, lvl: 1, uni: 1, sp: 0, ...x }));
    Presets.list.push(pr); Presets.byId[id] = pr;
    HD.Lib.add({ id, name, cat, sub, type: 'inst', preset: pr, tags: [sub.toLowerCase(), cat.toLowerCase(), 'instrument'] });
  }
  const O = (w, o = {}) => ({ w, ...o });

  // ---------- BASS ----------
  const B = (id, name, sub, o) => P(id, name, 'BASS', sub, { pv: 36, prev: [0], ...o });
  B('b_deep', 'Deep House Bass', 'Deep', { osc: [O('triangle', { lvl: 0.8 }), O('sawtooth', { det: 6, lvl: 0.35 })], sub: 0.6, filt: { f: 420, q: 1.5, env: 700, d: 0.22, key: 0.3 }, amp: { a: 0.004, d: 0.35, s: 0.65, r: 0.14 }, drive: 0.15, comp: 0.4, width: 0.3, lvl: 0.8 });
  B('b_sub', 'Sub Bass', 'Sub', { osc: [O('sine', { lvl: 1 })], filt: { f: 1200, q: 0.7 }, amp: { a: 0.01, d: 0.2, s: 1, r: 0.12 }, drive: 0.1, comp: 0.3, width: 0, lvl: 0.9 });
  B('b_roll', 'Rolling Bass', 'Rolling', { osc: [O('sawtooth', { lvl: 0.8 }), O('square', { lvl: 0.3, oct: -1 })], sub: 0.5, filt: { f: 350, q: 3, env: 1100, d: 0.1, key: 0.25 }, amp: { a: 0.002, d: 0.13, s: 0.35, r: 0.05 }, drive: 0.25, comp: 0.5, width: 0.2, lvl: 0.8 });
  B('b_bounce', 'Bouncy Bass', 'Bouncy', { osc: [O('square', { lvl: 0.7 }), O('sawtooth', { det: 8, lvl: 0.4 })], sub: 0.4, filt: { f: 500, q: 5, env: 1800, d: 0.14, s: 0.1, key: 0.3 }, amp: { a: 0.002, d: 0.2, s: 0.3, r: 0.08 }, drive: 0.3, comp: 0.5, width: 0.2, lvl: 0.75 });
  B('b_funk', 'Funky Bass', 'Funky', { osc: [O('sawtooth', { lvl: 0.7 }), O('pulse', { lvl: 0.5, det: -5 })], sub: 0.3, filt: { f: 650, q: 7, env: 2200, d: 0.11, key: 0.5 }, amp: { a: 0.002, d: 0.25, s: 0.3, r: 0.07 }, drive: 0.35, comp: 0.5, width: 0.2, lvl: 0.75 });
  B('b_min', 'Minimal Bass', 'Minimal', { osc: [O('sine', { lvl: 0.9 }), O('triangle', { lvl: 0.35, oct: 1 })], filt: { f: 700, q: 1, env: 600, d: 0.08 }, amp: { a: 0.002, d: 0.2, s: 0.2, r: 0.06 }, drive: 0.1, comp: 0.4, width: 0, lvl: 0.85 });
  B('b_dark', 'Dark Bass', 'Dark', { osc: [O('sawtooth', { det: -8, lvl: 0.6 }), O('sawtooth', { det: 8, lvl: 0.6 })], sub: 0.7, filt: { f: 260, q: 2.5, env: 400, d: 0.3, s: 0.2, key: 0.2 }, amp: { a: 0.005, d: 0.3, s: 0.8, r: 0.15 }, drive: 0.4, comp: 0.5, width: 0.3, lvl: 0.7 });
  B('b_acid', 'Acid Bass', 'Acid', { osc: [O('sawtooth', { lvl: 0.9 })], filt: { f: 300, q: 14, env: 3800, d: 0.16, key: 0.2 }, amp: { a: 0.002, d: 0.22, s: 0.5, r: 0.06 }, drive: 0.5, comp: 0.4, width: 0, lvl: 0.65 });
  B('b_pluck', 'Pluck Bass', 'Pluck', { osc: [O('sawtooth', { lvl: 0.8 })], sub: 0.4, filt: { f: 600, q: 2, env: 3600, d: 0.09 }, amp: { a: 0.002, d: 0.16, s: 0, r: 0.06 }, drive: 0.2, comp: 0.4, width: 0, lvl: 0.8 });
  B('b_reese', 'Reese Bass', 'Reese', { osc: [O('sawtooth', { uni: 3, sp: 28, lvl: 0.8 })], sub: 0.5, filt: { f: 650, q: 1.2, env: 150, d: 0.3, s: 0.8 }, amp: { a: 0.01, d: 0.3, s: 0.9, r: 0.2 }, drive: 0.35, comp: 0.5, width: 1.2, lvl: 0.6 });
  B('b_garage', 'Garage Bass', 'Deep', { osc: [O('sine', { lvl: 0.8 }), O('sawtooth', { lvl: 0.35 })], filt: { f: 450, q: 2, env: 900, d: 0.2 }, amp: { a: 0.003, d: 0.3, s: 0.5, r: 0.1 }, drive: 0.2, comp: 0.4, width: 0.2, lvl: 0.8 });
  B('b_jackin', 'Jackin Bass', 'Funky', { osc: [O('square', { lvl: 0.6 }), O('sawtooth', { lvl: 0.5, det: 7 })], sub: 0.3, filt: { f: 420, q: 4, env: 1400, d: 0.09, s: 0.1, key: 0.3 }, amp: { a: 0.002, d: 0.12, s: 0.45, r: 0.05 }, drive: 0.3, comp: 0.5, width: 0.2, lvl: 0.75 });
  B('b_warm', 'Warm Sub', 'Sub', { osc: [O('sine', { lvl: 0.9 }), O('triangle', { lvl: 0.3 })], filt: { f: 600, q: 0.7 }, amp: { a: 0.01, d: 0.4, s: 0.9, r: 0.2 }, drive: 0.05, comp: 0.3, width: 0, lvl: 0.9 });
  B('b_moog', 'Moog-ish House Bass', 'Rolling', { osc: [O('sawtooth', { lvl: 0.7 }), O('sawtooth', { lvl: 0.5, oct: -1, det: 4 })], filt: { f: 380, q: 6, env: 1500, d: 0.2, s: 0.2, key: 0.4 }, amp: { a: 0.003, d: 0.25, s: 0.6, r: 0.1 }, drive: 0.3, comp: 0.5, width: 0.2, lvl: 0.7 });

  // ---------- SYNTHS ----------
  const S = (id, name, sub, o) => P(id, name, 'SYNTHS', sub, o);
  const CH = { prev: [0, 3, 7] };
  // plucks
  S('s_pl_house', 'House Pluck', 'Pluck', { osc: [O('sawtooth', { uni: 2, sp: 10 })], filt: { f: 900, q: 2, env: 4500, d: 0.14, key: 0.5 }, amp: { a: 0.002, d: 0.25, s: 0, r: 0.12 }, width: 1.2, lvl: 0.55 });
  S('s_pl_deep', 'Deep Pluck', 'Pluck', { osc: [O('triangle'), O('sawtooth', { lvl: 0.4, det: 5 })], filt: { f: 700, q: 1.5, env: 2400, d: 0.18, key: 0.4 }, amp: { a: 0.002, d: 0.35, s: 0, r: 0.2 }, width: 1.1, lvl: 0.65 });
  S('s_pl_soft', 'Soft Pluck', 'Pluck', { osc: [O('triangle'), O('sine', { oct: 1, lvl: 0.4 })], filt: { f: 1800, q: 0.8, env: 1200, d: 0.2, key: 0.4 }, amp: { a: 0.002, d: 0.4, s: 0, r: 0.2 }, lvl: 0.7 });
  S('s_pl_bright', 'Bright Pluck', 'Pluck', { osc: [O('square', { lvl: 0.7 }), O('sawtooth', { lvl: 0.4, det: 6 })], filt: { f: 1500, q: 2, env: 5000, d: 0.1, key: 0.5 }, amp: { a: 0.002, d: 0.2, s: 0, r: 0.1 }, width: 1.2, lvl: 0.5 });
  S('s_pl_dub', 'Dub Pluck', 'Pluck', { osc: [O('sawtooth'), O('sawtooth', { det: 9, lvl: 0.6 })], filt: { f: 500, q: 6, env: 2500, d: 0.2, key: 0.4 }, amp: { a: 0.002, d: 0.3, s: 0, r: 0.2 }, drive: 0.15, width: 1.2, lvl: 0.55 });
  // piano-like
  S('s_pn_house', 'House Piano', 'Piano', { osc: [O('sine', { lvl: 0.9 }), O('triangle', { oct: 1, lvl: 0.18 })], fm: { ratio: 1, idx: 1.6, decay: 0.35 }, filt: { f: 5000, q: 0.5, env: 0 }, amp: { a: 0.002, d: 0.9, s: 0.12, r: 0.25 }, lvl: 0.6, prev: [0, 4, 7] });
  S('s_pn_soft', 'Soft Keys', 'Piano', { osc: [O('sine', { lvl: 0.8 }), O('warm', { lvl: 0.5, oct: 0 })], fm: { ratio: 2, idx: 0.5, decay: 0.3 }, filt: { f: 3500, q: 0.5, env: 1500, d: 0.4 }, amp: { a: 0.004, d: 1.2, s: 0.2, r: 0.35 }, lvl: 0.6, prev: [0, 4, 7] });
  S('s_pn_rhodes', 'Rhodes House', 'Piano', { osc: [O('tine', { lvl: 0.8 })], fm: { ratio: 1, idx: 2.2, decay: 0.5 }, filt: { f: 4200, q: 0.5 }, amp: { a: 0.002, d: 1.0, s: 0.25, r: 0.3 }, width: 1.3, lvl: 0.6, prev: [0, 4, 7] });
  S('s_pn_organ', 'House Organ', 'Piano', { osc: [O('organ', { uni: 2, sp: 6 })], filt: { f: 4000, q: 0.7 }, amp: { a: 0.005, d: 0.1, s: 0.9, r: 0.08 }, lvl: 0.45, prev: [0, 4, 7] });
  // stabs
  S('s_st_synth', 'Synth Stab', 'Stab', { osc: [O('sawtooth', { uni: 3, sp: 18 })], filt: { f: 1200, q: 3, env: 4500, d: 0.12, s: 0.05, key: 0.4 }, amp: { a: 0.002, d: 0.2, s: 0.1, r: 0.1 }, drive: 0.2, width: 1.3, lvl: 0.5, ...CH });
  S('s_st_detroit', 'Detroit Stab', 'Stab', { osc: [O('sawtooth', { uni: 2, sp: 12 }), O('square', { lvl: 0.5, uni: 2, sp: 8 })], filt: { f: 1500, q: 4, env: 3500, d: 0.1, s: 0.05 }, amp: { a: 0.002, d: 0.18, s: 0.15, r: 0.1 }, width: 1.2, lvl: 0.45, ...CH });
  S('s_st_classic', 'Classic Stab', 'Stab', { osc: [O('sawtooth', { uni: 4, sp: 25 })], filt: { f: 2000, q: 2, env: 3000, d: 0.08, s: 0.2 }, amp: { a: 0.002, d: 0.25, s: 0.3, r: 0.12 }, width: 1.4, lvl: 0.45, ...CH });
  S('s_st_dub', 'Dub Chord Stab', 'Stab', { osc: [O('sawtooth'), O('triangle', { lvl: 0.6, det: 4 })], filt: { f: 800, q: 5, env: 2200, d: 0.22 }, amp: { a: 0.002, d: 0.35, s: 0, r: 0.3 }, width: 1.2, lvl: 0.55, ...CH });
  S('s_st_euph', 'Euphoric Stab', 'Stab', { osc: [O('sawtooth', { uni: 5, sp: 30 })], filt: { f: 2500, q: 1.5, env: 5000, d: 0.15, s: 0.3 }, amp: { a: 0.003, d: 0.3, s: 0.5, r: 0.15 }, width: 1.5, lvl: 0.4, ...CH });
  // chords
  S('s_ch_warm', 'Warm Chord', 'Chord', { osc: [O('sawtooth', { uni: 2, sp: 12 }), O('triangle', { lvl: 0.6 })], filt: { f: 1400, q: 1, env: 800, d: 0.5, s: 0.3 }, amp: { a: 0.01, d: 0.4, s: 0.6, r: 0.35 }, width: 1.3, lvl: 0.5, ...CH });
  S('s_ch_soul', 'Soulful Chord', 'Chord', { osc: [O('sine', { lvl: 0.7 }), O('triangle', { lvl: 0.5, oct: 1 })], fm: { ratio: 1, idx: 1, decay: 0.8 }, filt: { f: 3000, q: 0.7, env: 1000, d: 0.5 }, amp: { a: 0.006, d: 1.2, s: 0.4, r: 0.5 }, width: 1.3, lvl: 0.55, ...CH });
  S('s_ch_super', 'Super Saw Chord', 'Chord', { osc: [O('sawtooth', { uni: 5, sp: 26 })], filt: { f: 2600, q: 1, env: 1200, d: 0.4, s: 0.4 }, amp: { a: 0.01, d: 0.4, s: 0.7, r: 0.3 }, width: 1.5, lvl: 0.4, ...CH });
  // pads
  S('s_pd_warm', 'Warm Pad', 'Pad', { osc: [O('sawtooth', { uni: 3, sp: 14 })], filt: { f: 1100, q: 0.8, env: 0 }, lfo: { rate: 0.12, depth: 300 }, amp: { a: 0.6, d: 0.5, s: 0.85, r: 1.4 }, width: 1.5, lvl: 0.4, ...CH });
  S('s_pd_dark', 'Dark Pad', 'Pad', { osc: [O('sawtooth', { uni: 3, sp: 16 }), O('sawtooth', { oct: -1, lvl: 0.5 })], filt: { f: 520, q: 1, env: 0 }, lfo: { rate: 0.09, depth: 180 }, amp: { a: 0.8, d: 0.5, s: 0.85, r: 2 }, width: 1.4, lvl: 0.4, ...CH });
  S('s_pd_air', 'Airy Pad', 'Pad', { osc: [O('triangle', { uni: 2, sp: 10 }), O('sine', { oct: 1, lvl: 0.4 })], noise: 0.04, filt: { f: 3500, q: 0.6 }, amp: { a: 1, d: 0.5, s: 0.9, r: 1.8 }, width: 1.6, lvl: 0.45, ...CH });
  S('s_pd_string', 'String Pad', 'Pad', { osc: [O('sawtooth', { uni: 5, sp: 20 })], filt: { f: 2500, q: 0.6 }, amp: { a: 0.5, d: 0.5, s: 0.85, r: 1.2 }, width: 1.6, lvl: 0.35, ...CH });
  S('s_pd_glass', 'Glass Pad', 'Pad', { osc: [O('glass', { uni: 2, sp: 8 })], filt: { f: 4500, q: 0.6 }, amp: { a: 0.7, d: 0.5, s: 0.9, r: 1.5 }, width: 1.5, lvl: 0.4, ...CH });
  S('s_pd_evolve', 'Evolving Pad', 'Pad', { osc: [O('sawtooth', { uni: 2, sp: 12 }), O('pulse', { lvl: 0.5, uni: 2, sp: 10 })], filt: { f: 900, q: 2, env: 0 }, lfo: { rate: 0.15, depth: 700 }, amp: { a: 1.2, d: 0.5, s: 0.9, r: 2 }, width: 1.5, lvl: 0.35, ...CH });
  // leads
  S('s_ld_saw', 'Saw Lead', 'Lead', { osc: [O('sawtooth', { uni: 2, sp: 10 })], filt: { f: 3000, q: 1.5, env: 0 }, amp: { a: 0.005, d: 0.1, s: 0.8, r: 0.15 }, width: 1.2, lvl: 0.4 });
  S('s_ld_sq', 'Square Lead', 'Lead', { osc: [O('square', { uni: 2, sp: 6 })], filt: { f: 2200, q: 1.2 }, amp: { a: 0.005, d: 0.1, s: 0.8, r: 0.12 }, width: 1.1, lvl: 0.35 });
  S('s_ld_soft', 'Soft Lead', 'Lead', { osc: [O('triangle'), O('sawtooth', { lvl: 0.4, det: 6 })], filt: { f: 2600, q: 0.8 }, amp: { a: 0.01, d: 0.15, s: 0.8, r: 0.2 }, width: 1.2, lvl: 0.5 });
  S('s_ld_acid', 'Acid Lead', 'Lead', { osc: [O('sawtooth')], filt: { f: 600, q: 10, env: 3500, d: 0.15, s: 0.3 }, amp: { a: 0.003, d: 0.2, s: 0.7, r: 0.08 }, drive: 0.4, lvl: 0.4 });
  S('s_ld_pluck', 'Pluck Lead', 'Lead', { osc: [O('sawtooth', { uni: 2, sp: 8 })], filt: { f: 1500, q: 2, env: 4000, d: 0.08, key: 0.4 }, amp: { a: 0.002, d: 0.2, s: 0.15, r: 0.12 }, width: 1.2, lvl: 0.45 });
  // arps
  S('s_ar_pluck', 'Arp Pluck', 'Arp', { osc: [O('sawtooth', { uni: 2, sp: 8 })], filt: { f: 1200, q: 2, env: 3500, d: 0.08, key: 0.5 }, amp: { a: 0.002, d: 0.14, s: 0, r: 0.06 }, width: 1.3, lvl: 0.45 });
  S('s_ar_bright', 'Bright Arp', 'Arp', { osc: [O('square', { lvl: 0.7 }), O('sawtooth', { lvl: 0.4 })], filt: { f: 2200, q: 2, env: 4000, d: 0.07, key: 0.5 }, amp: { a: 0.002, d: 0.12, s: 0, r: 0.05 }, width: 1.2, lvl: 0.4 });
  S('s_ar_soft', 'Soft Arp', 'Arp', { osc: [O('triangle'), O('sine', { oct: 1, lvl: 0.4 })], filt: { f: 3000, q: 0.8, env: 1500, d: 0.1 }, amp: { a: 0.003, d: 0.2, s: 0, r: 0.1 }, width: 1.2, lvl: 0.55 });
  // bells
  S('s_bl_glass', 'Glass Bell', 'Bell', { osc: [O('sine')], fm: { ratio: 3.5, idx: 2.5, decay: 1.2 }, filt: { f: 9000, q: 0.5 }, amp: { a: 0.002, d: 2, s: 0, r: 1.2 }, width: 1.3, lvl: 0.45 });
  S('s_bl_fm', 'FM Bell', 'Bell', { osc: [O('sine')], fm: { ratio: 1.41, idx: 3, decay: 0.9 }, filt: { f: 8000, q: 0.5 }, amp: { a: 0.002, d: 1.6, s: 0, r: 0.9 }, width: 1.2, lvl: 0.45 });
  S('s_bl_box', 'Music Box', 'Bell', { osc: [O('triangle', { lvl: 0.7 })], fm: { ratio: 4, idx: 1.5, decay: 0.5 }, filt: { f: 7000, q: 0.5 }, amp: { a: 0.002, d: 1.4, s: 0, r: 0.6 }, width: 1.2, lvl: 0.5 });
  S('s_bl_tube', 'Tubular Bell', 'Bell', { osc: [O('sine')], fm: { ratio: 2.76, idx: 2, decay: 1.6 }, filt: { f: 7000, q: 0.5 }, amp: { a: 0.002, d: 3, s: 0, r: 2 }, width: 1.3, lvl: 0.45 });
  // atmospheric
  S('s_at_drone', 'Space Drone', 'Atmosphere', { osc: [O('sawtooth', { uni: 3, sp: 30, oct: -1 })], filt: { f: 450, q: 1 }, lfo: { rate: 0.08, depth: 250 }, amp: { a: 2, d: 1, s: 1, r: 3 }, width: 1.6, lvl: 0.35, prev: [0, 7] });
  S('s_at_wash', 'Noise Wash', 'Atmosphere', { osc: [O('sine', { lvl: 0.3 })], noise: 0.9, filt: { type: 'bandpass', f: 1200, q: 1.5 }, lfo: { rate: 0.12, depth: 800 }, amp: { a: 1.5, d: 1, s: 1, r: 3 }, width: 1.6, lvl: 0.35, prev: [0] });
  S('s_at_shim', 'Shimmer', 'Atmosphere', { osc: [O('glass', { oct: 1, uni: 4, sp: 40, lvl: 0.5 })], filt: { f: 5000, q: 0.6 }, lfo: { rate: 0.2, depth: 1200 }, amp: { a: 1.2, d: 1, s: 0.9, r: 3 }, width: 1.7, lvl: 0.3, prev: [0, 7, 12] });
  S('s_at_dark', 'Dark Atmosphere', 'Atmosphere', { osc: [O('sawtooth', { uni: 2, sp: 20, oct: -1 })], noise: 0.15, filt: { f: 300, q: 1.5 }, lfo: { rate: 0.06, depth: 200 }, amp: { a: 2.5, d: 1, s: 1, r: 3.5 }, width: 1.5, lvl: 0.35, prev: [0, 3, 7] });

  // resolve a preset (project-embedded copy with overrides applied already)
  Presets.get = (id) => Presets.byId[id] || (HD.Lib.byId[id] && HD.Lib.byId[id].preset) || null;

  // ---------- Effect definitions ----------
  const FD = (HD.FXDEF = {});
  const pr = (k, n, min, max, def, o = {}) => ({ k, n, min, max, def, curve: 'lin', ...o });
  FD.reverb = { name: 'Reverb', params: [pr('size', 'Size', 0.1, 1, 0.5), pr('decay', 'Decay', 0.2, 8, 2, { u: 's', curve: 'log' }), pr('pre', 'Pre-delay', 0, 120, 15, { u: 'ms' }), pr('damp', 'Damping', 0, 1, 0.5), pr('wet', 'Wet', 0, 1, 0.3), pr('dry', 'Dry', 0, 1, 1)] };
  FD.delay = { name: 'Delay', params: [pr('time', 'Time', 0.0625, 2, 0.75, { u: 'beat', curve: 'log' }), pr('fb', 'Feedback', 0, 0.92, 0.4), pr('wet', 'Wet', 0, 1, 0.3), pr('stereo', 'Stereo', 0, 1, 0.6), pr('tone', 'Tone', 400, 12000, 6000, { u: 'Hz', curve: 'log' })] };
  FD.eq = { name: 'EQ', params: [pr('low', 'Low', -18, 18, 0, { u: 'dB' }), pr('mid', 'Mid', -18, 18, 0, { u: 'dB' }), pr('midf', 'Mid Freq', 200, 5000, 1000, { u: 'Hz', curve: 'log' }), pr('high', 'High', -18, 18, 0, { u: 'dB' })] };
  FD.comp = { name: 'Compressor', params: [pr('thr', 'Threshold', -60, 0, -18, { u: 'dB' }), pr('ratio', 'Ratio', 1, 20, 4), pr('attack', 'Attack', 0.001, 0.2, 0.01, { u: 's', curve: 'log' }), pr('release', 'Release', 0.02, 1, 0.15, { u: 's', curve: 'log' }), pr('makeup', 'Makeup', 0, 24, 0, { u: 'dB' })] };
  FD.sat = { name: 'Saturation', params: [pr('drive', 'Drive', 0, 1, 0.3), pr('mix', 'Mix', 0, 1, 1)] };
  FD.filter = { name: 'Filter', params: [pr('mode', 'Mode', 0, 1, 0, { curve: 'choice', opts: ['Low pass', 'High pass'] }), pr('freq', 'Frequency', 20, 20000, 1000, { u: 'Hz', curve: 'log' }), pr('res', 'Resonance', 0.1, 20, 1, { curve: 'log' })] };
  FD.limiter = { name: 'Limiter', params: [pr('thr', 'Threshold', -30, 0, -1, { u: 'dB' }), pr('release', 'Release', 0.01, 1, 0.1, { u: 's', curve: 'log' })] };
  FD.chorus = { name: 'Chorus', params: [pr('rate', 'Rate', 0.05, 8, 0.8, { u: 'Hz', curve: 'log' }), pr('depth', 'Depth', 0, 1, 0.5), pr('mix', 'Mix', 0, 1, 0.5)] };
  FD.phaser = { name: 'Phaser', params: [pr('rate', 'Rate', 0.05, 6, 0.4, { u: 'Hz', curve: 'log' }), pr('depth', 'Depth', 0, 1, 0.6), pr('fb', 'Feedback', 0, 0.9, 0.4), pr('mix', 'Mix', 0, 1, 0.5)] };
  FD.dist = { name: 'Distortion', params: [pr('drive', 'Drive', 0, 1, 0.5), pr('mix', 'Mix', 0, 1, 0.6)] };
  FD.pump = { name: 'Pump (sidechain-style)', params: [pr('depth', 'Depth', 0, 1, 0.6), pr('release', 'Release', 0.1, 0.95, 0.55), pr('curve', 'Curve', 0.3, 3, 1.2, { curve: 'log' })] };
  FD.width = { name: 'Stereo Width', params: [pr('width', 'Width', 0, 2, 1.3)] };
  FD.defaults = (type) => { const o = {}; FD[type].params.forEach((p) => (o[p.k] = p.def)); return o; };
  FD.types = ['reverb', 'delay', 'eq', 'comp', 'sat', 'filter', 'limiter', 'chorus', 'phaser', 'dist', 'pump', 'width'];

  // ---------- House FX chains (applied to a track's insert rack) ----------
  HD.FXPRESETS = [
    { name: 'Deep House Reverb', for: 'any', chain: [['reverb', { size: 0.55, decay: 2.4, pre: 18, damp: 0.55, wet: 0.28 }]] },
    { name: 'Huge Club Reverb', for: 'any', chain: [['reverb', { size: 0.9, decay: 5.2, pre: 30, damp: 0.4, wet: 0.4 }]] },
    { name: 'Vocal Space', for: 'any', chain: [['reverb', { size: 0.6, decay: 2, pre: 40, damp: 0.5, wet: 0.22 }], ['delay', { time: 0.75, fb: 0.35, wet: 0.2, tone: 5000, stereo: 0.7 }]] },
    { name: 'Dark Delay', for: 'any', chain: [['delay', { time: 0.75, fb: 0.52, wet: 0.35, tone: 2300, stereo: 0.7 }]] },
    { name: 'Wide Synth', for: 'any', chain: [['chorus', { rate: 0.6, depth: 0.6, mix: 0.45 }], ['width', { width: 1.5 }], ['eq', { low: -2, mid: 0, high: 1.5 }]] },
    { name: 'Punchy Kick', for: 'any', chain: [['eq', { low: 2.5, mid: -2, midf: 300, high: 1.5 }], ['comp', { thr: -14, ratio: 4, attack: 0.02, release: 0.12, makeup: 3 }], ['sat', { drive: 0.25, mix: 0.5 }]] },
    { name: 'Bass Glue', for: 'any', chain: [['comp', { thr: -18, ratio: 3, attack: 0.03, release: 0.2, makeup: 2 }], ['sat', { drive: 0.3, mix: 0.6 }], ['eq', { low: 1.5, mid: 0, high: -2 }]] },
    { name: 'House Master', for: 'master', chain: [['eq', { low: 1, mid: -0.5, high: 1 }], ['comp', { thr: -14, ratio: 2, attack: 0.03, release: 0.2, makeup: 2 }], ['sat', { drive: 0.15, mix: 0.5 }], ['limiter', { thr: -1, release: 0.1 }]] },
    { name: 'Club Master', for: 'master', chain: [['eq', { low: 2.5, mid: 0, high: 1.5 }], ['comp', { thr: -16, ratio: 3, attack: 0.02, release: 0.15, makeup: 3 }], ['sat', { drive: 0.3, mix: 0.6 }], ['limiter', { thr: -0.8, release: 0.08 }]] },
    { name: 'Dirty Bass', for: 'any', chain: [['dist', { drive: 0.55, mix: 0.5 }], ['filter', { mode: 0, freq: 1800, res: 2 }], ['eq', { low: 2, mid: 0, high: -1 }]] },
    { name: 'Bright Hats', for: 'any', chain: [['filter', { mode: 1, freq: 400, res: 0.7 }], ['eq', { low: 0, mid: 0, high: 4.5 }], ['width', { width: 1.3 }]] },
    { name: 'Atmospheric', for: 'any', chain: [['reverb', { size: 0.85, decay: 5, pre: 25, damp: 0.5, wet: 0.5 }], ['phaser', { rate: 0.15, depth: 0.7, fb: 0.4, mix: 0.35 }], ['delay', { time: 1.5, fb: 0.5, wet: 0.25, tone: 4000, stereo: 0.8 }]] },
    { name: 'Sidechain Pump', for: 'any', chain: [['pump', { depth: 0.65, release: 0.55, curve: 1.2 }]] },
    { name: 'Deep Pump', for: 'any', chain: [['pump', { depth: 0.8, release: 0.7, curve: 1.6 }], ['eq', { low: 1, mid: 0, high: -1.5 }]] },
  ];

  // mastering presets
  HD.MASTER_PRESETS = {
    Clean: { loud: 0.15, bass: 0, treble: 0.5, punch: 0.1, width: 1.0 },
    Club: { loud: 0.4, bass: 2.5, treble: 1.5, punch: 0.45, width: 1.1 },
    Deep: { loud: 0.25, bass: 3.5, treble: -1.5, punch: 0.3, width: 0.95 },
    Punchy: { loud: 0.4, bass: 1.5, treble: 1, punch: 0.8, width: 1.05 },
    Loud: { loud: 0.8, bass: 2, treble: 2, punch: 0.6, width: 1.15 },
  };
})();
