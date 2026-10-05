/* HouseDAW — synth voice engine. A preset (oscillators / unison / FM / filter / envelopes) is turned into
   native Web Audio nodes per note, so it works identically on live and offline contexts. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const Inst = (HD.Inst = {});
  const waveCache = new WeakMap(), noiseCache = new WeakMap();

  Inst.wave = (ctx, name) => {
    if (['sine', 'square', 'sawtooth', 'triangle'].includes(name)) return name;
    let m = waveCache.get(ctx); if (!m) waveCache.set(ctx, (m = {}));
    if (!m[name]) {
      const amps = HD.WAVES[name] || HD.WAVES.warm;
      if (name === 'pulse') { /* narrow pulse spectrum already in table */ }
      m[name] = ctx.createPeriodicWave(new Float32Array(amps.length), Float32Array.from(amps), { disableNormalization: false });
    }
    return m[name];
  };
  Inst.noise = (ctx) => {
    let b = noiseCache.get(ctx);
    if (!b) { b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = b.getChannelData(0), r = HD.rng(99); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; noiseCache.set(ctx, b); }
    return b;
  };

  // per-track instrument bus: drive -> compression -> stereo width
  Inst.makeBus = (ctx, live) => {
    const input = ctx.createGain(), shaper = ctx.createWaveShaper(), post = ctx.createGain(), comp = ctx.createDynamicsCompressor(), wid = HD.makeWidener(ctx, live);
    shaper.oversample = '2x';
    input.connect(shaper); shaper.connect(post); post.connect(comp); comp.connect(wid.input);
    const bus = { input, output: wid.output, preset: null };
    bus.setPreset = (p) => {
      bus.preset = p;
      const d = p.drive || 0; shaper.curve = d > 0.001 ? HD.tanhCurve(1 + d * 6) : null; post.gain.value = 1 / (1 + d * 1.1);
      const c = p.comp || 0;
      comp.threshold.value = c > 0 ? -10 - c * 14 : 0; comp.ratio.value = c > 0 ? 2 + c * 6 : 1; comp.attack.value = 0.006; comp.release.value = 0.14; comp.knee.value = 8;
      wid.width.value = p.width == null ? 1 : p.width;
    };
    return bus;
  };

  // play one note. t = start (ctx time), dur = gate length in seconds, vel 0..1
  Inst.play = (ctx, dest, p, midi, t, dur, vel = 0.8) => {
    dur = Math.max(0.03, dur);
    const f0 = HD.mtof(midi), amp = ctx.createGain(), filt = ctx.createBiquadFilter(), mix = ctx.createGain();
    const e = p.amp, r = Math.max(0.01, e.r), tg = t + dur, end = tg + r * 1.6 + 0.05, stops = [];
    mix.connect(filt); filt.connect(amp); amp.connect(dest);
    const peak = (p.lvl == null ? 0.7 : p.lvl) * Math.pow(vel, 1.2) * 0.55;
    // amplitude envelope (analytic value at gate end keeps release click-free)
    const a = Math.min(Math.max(0.0015, e.a), dur), dtc = Math.max(0.005, e.d) / 3;
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(peak, t + a);
    let vEnd;
    if (dur <= e.a) vEnd = peak * (dur / a);
    else { amp.gain.setTargetAtTime(peak * e.s, t + a, dtc); vEnd = peak * (e.s + (1 - e.s) * Math.exp(-(dur - a) / dtc)); }
    amp.gain.setValueAtTime(vEnd, tg); amp.gain.setTargetAtTime(0, tg, r / 3);

    // filter
    const F = p.filt; filt.type = F.type || 'lowpass'; filt.Q.value = F.q;
    const base = Math.min(18000, F.f * Math.pow(2, ((midi - 60) / 12) * (F.key || 0)));
    filt.frequency.setValueAtTime(base, t);
    if (F.env) {
      const top = Math.min(19000, base + F.env * (0.4 + 0.6 * vel)), fa = Math.min(F.a || 0.003, dur);
      filt.frequency.linearRampToValueAtTime(top, t + fa);
      filt.frequency.setTargetAtTime(base + (top - base) * (F.s || 0), t + fa, Math.max(0.01, F.d) / 3);
    }
    if (p.lfo) {
      const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = p.lfo.rate; lg.gain.value = p.lfo.depth;
      l.connect(lg); lg.connect(filt.frequency); l.start(t); stops.push(l);
    }

    const connectOsc = (o, lvl, pan) => {
      const g = ctx.createGain(); g.gain.value = lvl; o.connect(g);
      if (pan) { const pn = ctx.createStereoPanner(); pn.pan.value = pan; g.connect(pn); pn.connect(mix); } else g.connect(mix);
      o.start(t); stops.push(o);
    };
    let first = true;
    for (const L of p.osc) {
      const uni = Math.max(1, L.uni || 1), f = HD.mtof(midi + (L.oct || 0) * 12);
      for (let u = 0; u < uni; u++) {
        const o = ctx.createOscillator(), x = uni > 1 ? (u / (uni - 1)) * 2 - 1 : 0;
        const w = Inst.wave(ctx, L.w); if (typeof w === 'string') o.type = w; else o.setPeriodicWave(w);
        o.frequency.value = f; o.detune.value = (L.det || 0) + x * (L.sp || 0);
        if (p.fm && first && u === 0) {
          const m = ctx.createOscillator(), mg = ctx.createGain(), I = p.fm.idx * f;
          m.frequency.value = f * p.fm.ratio; mg.gain.setValueAtTime(I, t); mg.gain.setTargetAtTime(I * 0.04, t, Math.max(0.02, p.fm.decay) / 3);
          m.connect(mg); mg.connect(o.frequency); m.start(t); stops.push(m);
        }
        connectOsc(o, (L.lvl == null ? 1 : L.lvl) / Math.sqrt(uni), x * 0.7 * Math.min(1, (p.width == null ? 1 : p.width)));
      }
      first = false;
    }
    if (p.sub) { const o = ctx.createOscillator(); o.type = p.subW || 'sine'; o.frequency.value = HD.mtof(midi - 12); connectOsc(o, p.sub, 0); }
    if (p.noise) {
      const n = ctx.createBufferSource(); n.buffer = Inst.noise(ctx); n.loop = true;
      const ng = ctx.createGain(); ng.gain.value = p.noise; n.connect(ng); ng.connect(mix); n.start(t, Math.random() * 1.5); stops.push(n);
    }
    stops.forEach((o) => { try { o.stop(end); } catch (err) { /* noop */ } });
    const last = stops[stops.length - 1]; if (last) last.onended = () => { try { amp.disconnect(); } catch (err) { /* noop */ } };
    return end;
  };

  // render one note offline to an AudioBuffer (for waveform thumbnails + bounce-to-audio)
  Inst.bounce = async (preset, midi, dur, sr = 44100, chordIntervals = [0]) => {
    const total = dur + preset.amp.r * 1.6 + 0.1, ctx = new OfflineAudioContext(2, Math.ceil(total * sr), sr);
    const bus = Inst.makeBus(ctx, false); bus.setPreset(preset); bus.output.connect(ctx.destination);
    chordIntervals.forEach((iv) => Inst.play(ctx, bus.input, preset, midi + iv, 0.005, dur, 0.9));
    return ctx.startRendering();
  };
})();
