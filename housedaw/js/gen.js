/* HouseDAW — procedural sound generator (the “sound factory”): parameter sets per sound type → real audio specs / instrument presets. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const Gen = (HD.Gen = {});
  const d = (k, n, min, max, def, o = {}) => ({ k, n, min, max, def, curve: 'lin', ...o });
  const lg = { curve: 'log' };

  Gen.KINDS = {
    KICK: { audio: true, sub: 'Kick', defs: [d('f0', 'Pitch', 80, 400, 170, { ...lg, u: 'Hz' }), d('dec', 'Decay', 0.05, 1, 0.3, { ...lg, u: 's' }), d('att', 'Attack', 0, 0.02, 0.001, { u: 's' }), d('click', 'Click', 0, 1.3, 0.4), d('sub', 'Sub', 0, 1.5, 0.9), d('body', 'Body', 0, 1.3, 1), d('drive', 'Saturation', 0, 1, 0.3)],
      build: (p) => ({ kind: 'kick', p: { f0: p.f0, f1: 40 + Math.min(20, p.f0 / 12), pt: 0.012 + 0.03 * Math.min(1, 200 / p.f0), dec: p.dec, subDec: p.dec * 1.25, att: p.att, click: p.click, ckF: 3000 + p.click * 1500, sub: p.sub, body: p.body, drive: p.drive, tone: 12000, len: Math.min(2, p.dec * 4.4 + 0.05) } }) },
    CLAP: { audio: true, sub: 'Clap', defs: [d('fc', 'Tone', 700, 3200, 1500, { ...lg, u: 'Hz' }), d('tail', 'Decay', 0.04, 0.4, 0.14, { ...lg, u: 's' }), d('nb', 'Layers', 2, 6, 4, { step: 1 }), d('sp', 'Spacing', 0.005, 0.02, 0.011, { u: 's' }), d('room', 'Room', 0, 1, 0.25), d('st', 'Stereo', 0, 1, 0.8), d('drive', 'Snap', 0, 0.6, 0.1)],
      build: (p) => ({ kind: 'clap', p: { fc: p.fc, q: 1, tail: p.tail, tailLvl: 0.5, nb: Math.round(p.nb), sp: p.sp, room: p.room, st: p.st, drive: p.drive } }) },
    HAT: { audio: true, sub: 'Closed Hat', defs: [d('ts', 'Tone', 0.7, 1.5, 1, {}), d('dec', 'Decay', 0.008, 0.5, 0.03, { ...lg, u: 's' }), d('noise', 'Noise', 0, 1, 0.5), d('hp', 'Brightness', 4000, 11000, 7500, { ...lg, u: 'Hz' }), d('st', 'Stereo', 0, 1, 0.6), d('metal', 'Metal', 0, 1, 0.7)],
      build: (p) => ({ kind: 'hat', p: { ts: p.ts, dec: p.dec, noise: p.noise, metal: p.metal, hp: p.hp, bright: (p.hp - 7000) / 500, st: p.st } }), subFor: (p) => (p.dec > 0.09 ? 'Open Hat' : 'Closed Hat') },
    SNARE: { audio: true, sub: 'Snare', defs: [d('f', 'Tone', 140, 330, 190, { u: 'Hz' }), d('snap', 'Snap', 0, 1.2, 0.8), d('nd', 'Decay', 0.05, 0.45, 0.15, { ...lg, u: 's' }), d('drop', 'Pitch drop', 0, 1.2, 0.7), d('drive', 'Drive', 0, 0.8, 0.2), d('room', 'Room', 0, 1, 0.2)],
      build: (p) => ({ kind: 'snare', p: { f: p.f, td: 0.06 + p.nd * 0.3, nd: p.nd, hp: 1800, snap: p.snap, drop: p.drop, drive: p.drive, room: p.room } }) },
    PERCUSSION: { audio: true, sub: 'Percussion', defs: [d('type', 'Type', 0, 8, 0, { curve: 'choice', opts: ['Shaker', 'Rim', 'Tom', 'Conga', 'Bongo', 'Click', 'Metal', 'Cowbell', 'Noise hit'], step: 1 }), d('f', 'Pitch', 70, 2400, 300, { ...lg, u: 'Hz' }), d('dec', 'Decay', 0.01, 0.6, 0.12, { ...lg, u: 's' }), d('tone', 'Tone', 0, 1, 0.5), d('noise', 'Noise', 0, 1, 0.3), d('st', 'Stereo', 0, 1, 0.3)],
      build: (p) => { const t = ['shaker', 'rim', 'tom', 'conga', 'bongo', 'click', 'metal', 'cowbell', 'nhit'][Math.round(p.type)]; return { kind: 'perc', p: { type: t, f: p.f, fc: 2500 + p.tone * 6500, dec: p.dec, att: 0.012, len: Math.min(1.5, p.dec * 5 + 0.04), noise: p.noise, slap: p.noise, click: p.noise, lp: 3000 + p.tone * 6000, q: 1 + p.tone * 3, st: p.st, drop: undefined, idx: 2 + p.tone * 4, ratio: 1.41 + p.tone, sweep: p.tone } }; } },
    BASS: { inst: true, cat: 'BASS', sub: 'Generated Bass', defs: [d('osc', 'Oscillator', 0, 3, 2, { curve: 'choice', opts: ['Sine', 'Triangle', 'Saw', 'Square'], step: 1 }), d('cut', 'Filter', 80, 4000, 500, { ...lg, u: 'Hz' }), d('res', 'Resonance', 0.3, 14, 2, lg), d('env', 'Env amount', 0, 5000, 1000, { u: 'Hz' }), d('dec', 'Decay', 0.05, 0.6, 0.2, { ...lg, u: 's' }), d('drive', 'Drive', 0, 1, 0.25), d('sub', 'Sub', 0, 1.2, 0.5)],
      buildPreset: (p) => ({ osc: [{ w: ['sine', 'triangle', 'sawtooth', 'square'][Math.round(p.osc)], oct: 0, det: 0, lvl: 0.9, uni: 1, sp: 0 }], sub: p.sub, subW: 'sine', noise: 0, filt: { type: 'lowpass', f: p.cut, q: p.res, env: p.env, key: 0.3, a: 0.003, d: p.dec, s: 0.15 }, amp: { a: 0.003, d: p.dec * 1.6, s: 0.5, r: 0.08 }, drive: p.drive, comp: 0.45, width: 0.2, lvl: 0.8, fm: null, lfo: null, pv: 36, prev: [0] }) },
    SYNTH: { inst: true, cat: 'SYNTHS', sub: 'Generated Synth', defs: [d('osc', 'Oscillator', 0, 4, 2, { curve: 'choice', opts: ['Sine', 'Triangle', 'Saw', 'Square', 'Organ'], step: 1 }), d('cut', 'Cutoff', 200, 12000, 2500, { ...lg, u: 'Hz' }), d('res', 'Resonance', 0.3, 12, 1.5, lg), d('att', 'Attack', 0.002, 1.5, 0.01, { ...lg, u: 's' }), d('rel', 'Release', 0.05, 3, 0.4, { ...lg, u: 's' }), d('uni', 'Unison', 1, 7, 3, { step: 1 }), d('spread', 'Detune', 0, 50, 14), d('width', 'Width', 0, 2, 1.3)],
      buildPreset: (p) => ({ osc: [{ w: ['sine', 'triangle', 'sawtooth', 'square', 'organ'][Math.round(p.osc)], oct: 0, det: 0, lvl: 1, uni: Math.round(p.uni), sp: p.spread }], sub: 0, subW: 'sine', noise: 0, filt: { type: 'lowpass', f: p.cut, q: p.res, env: p.cut * 1.2, key: 0.4, a: 0.003, d: 0.2, s: 0.4 }, amp: { a: p.att, d: 0.3, s: 0.7, r: p.rel }, drive: 0.1, comp: 0, width: p.width, lvl: 0.5, fm: null, lfo: null, pv: 60, prev: [0, 3, 7] }) },
    FX: { audio: true, sub: 'Generated FX', defs: [d('type', 'Type', 0, 6, 0, { curve: 'choice', opts: ['Riser', 'Downlifter', 'Impact', 'Sweep', 'Sub drop', 'Whoosh', 'Atmosphere'], step: 1 }), d('len', 'Length', 0.3, 15, 4, { ...lg, u: 's' }), d('pitch', 'Pitch', 40, 800, 180, { ...lg, u: 'Hz' }), d('noise', 'Noise', 0, 1, 0.7), d('sweep', 'Sweep', 1000, 14000, 8000, { ...lg, u: 'Hz' }), d('st', 'Stereo', 0, 1, 0.7), d('dec', 'Decay', 0.1, 3, 1, { ...lg, u: 's' })],
      build: (p) => {
        const t = Math.round(p.type), base = { len: p.len, st: p.st };
        if (t === 0 || t === 1) return { kind: 'riser', p: { ...base, type: p.noise > 0.5 ? 'noise' : 'tone', reverse: t === 1, f0: 250, f1: p.sweep, tf0: p.pitch * 0.6, tf1: p.pitch * 5, tone: 1 - p.noise, q: 2, shape: 1.6, curve: 2 } };
        if (t === 2) return { kind: 'impact', p: { len: Math.max(0.5, p.len), f0: p.pitch, f1: 38, pt: 0.15, dec: p.dec, noise: p.noise, lp: p.sweep, verb: p.dec * 1.5, vmix: 0.5, cd: 0.1 } };
        if (t === 3) return { kind: 'sweep', p: { ...base, dir: 'up', f0: 250, f1: p.sweep, q: 4 + p.noise * 5, bell: 1.2, verb: 1 } };
        if (t === 4) return { kind: 'drop', p: { len: p.len, f0: p.pitch * 2, f1: 30, k: 5, dec: p.dec, drive: 0.3, noise: p.noise * 0.4 } };
        if (t === 5) return { kind: 'whoosh', p: { ...base, dir: 'updown', f0: 300, f1: p.sweep, q: 1.6 } };
        return { kind: 'atmos', p: { len: Math.max(3, p.len), type: p.noise > 0.5 ? 'noise' : 'drone', f: p.pitch / 2, fc: p.sweep / 8, verb: p.dec * 2 } };
      }, subFor: (p) => ['Riser', 'Downlifter', 'Impact', 'Sweep', 'Drop', 'Whoosh', 'Atmosphere'][Math.round(p.type)] },
  };
  Gen.defaults = (kind) => { const o = {}; Gen.KINDS[kind].defs.forEach((x) => (o[x.k] = x.def)); return o; };
  // GENERATE: a fresh musical variation (random within sensible per-parameter windows around the defaults)
  Gen.randomize = (kind, rnd = Math.random) => {
    const o = {}; for (const x of Gen.KINDS[kind].defs) {
      if (x.curve === 'choice') { o[x.k] = x.k === 'type' && kind === 'PERCUSSION' ? Math.floor(rnd() * 9) : x.k === 'type' ? Math.floor(rnd() * (x.max + 1)) : Math.floor(rnd() * (x.max + 1)); continue; }
      const lo = x.min, hi = x.max, def = x.def, span = x.curve === 'log' ? Math.log(hi / lo) : hi - lo, c = x.curve === 'log' ? Math.log(def / lo) : def - lo;
      const t = HD.clamp(c / span + (rnd() - 0.5) * 0.7, 0, 1); let v = x.curve === 'log' ? lo * Math.exp(span * t) : lo + span * t; if (x.step) v = Math.round(v / x.step) * x.step; o[x.k] = v;
    }
    if (kind === 'PERCUSSION') { const dflt = [[6500, 0.05], [800, 0.025], [120, 0.3], [260, 0.18], [480, 0.1], [3500, 0.008], [1200, 0.2], [600, 0.2], [4000, 0.06]][o.type]; o.f = dflt[0] * (0.8 + rnd() * 0.5); o.dec = dflt[1] * (0.8 + rnd() * 0.5); }
    return o;
  };
  Gen.specFor = (kind, vals, seed) => { const k = Gen.KINDS[kind]; const s = k.build(vals); s.seed = seed; return s; };
  Gen.subFor = (kind, vals) => { const k = Gen.KINDS[kind]; return k.subFor ? k.subFor(vals) : k.sub; };

  Gen.saveUserSample = async (name, kind, vals, seed) => {
    const spec = Gen.specFor(kind, vals, seed), id = 'gen_' + Date.now().toString(36) + Math.floor(Math.random() * 999), sub = Gen.subFor(kind, vals);
    const it = HD.Lib.addUserSample(id, name, spec, sub); it.created = Date.now();
    await HD.Store.saveSound({ id, name, sub, kind: 'sample', spec, created: it.created }); return it;
  };
  Gen.saveUserPreset = async (name, preset) => {
    const id = 'ugp_' + Date.now().toString(36), pr = HD.clone(preset); pr.name = name; delete pr.id;
    const it = HD.Lib.add({ id, name, cat: 'MY SOUNDS', sub: 'Instrument', type: 'inst', user: true, preset: pr, tags: ['generated', 'instrument'] }); it.created = Date.now();
    await HD.Store.saveSound({ id, name, sub: 'Instrument', kind: 'preset', preset: pr, created: it.created }); HD.toast('Saved “' + name + '” to MY SOUNDS'); if (HD.Browser.root) HD.Browser.renderList(); return it;
  };
})();
