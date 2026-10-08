/* HouseDAW — real-time audio effects built from native Web Audio nodes.
   The same code runs on AudioContext (live) and OfflineAudioContext (export), so exports match playback. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});

  // ---------- helpers ----------
  const smooth = (ctx, live, param, v) => {
    if (live) { param.cancelScheduledValues(ctx.currentTime); param.setTargetAtTime(v, ctx.currentTime, 0.012); } else param.value = v;
  };
  HD.setParam = smooth;
  const G = (ctx, v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const dbg = (db) => Math.pow(10, db / 20);

  HD.tanhCurve = (k, n = 2048) => {
    const c = new Float32Array(n), d = Math.tanh(k);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * k) / d; }
    return c;
  };
  const atanCurve = (k, n = 2048) => {
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = (2 / Math.PI) * Math.atan(x * k); }
    return c;
  };

  // mid/side stereo widener: width 0 = mono, 1 = unchanged, 2 = extra wide
  HD.makeWidener = (ctx, live) => {
    const input = G(ctx); input.channelCount = 2; input.channelCountMode = 'explicit'; input.channelInterpretation = 'speakers';
    const sp = ctx.createChannelSplitter(2), mg = ctx.createChannelMerger(2), mid = G(ctx), side = G(ctx, 1), inv = G(ctx, -1);
    const lm = G(ctx, 0.5), rm = G(ctx, 0.5), ls = G(ctx, 0.5), rs = G(ctx, -0.5), midL = G(ctx), midR = G(ctx), sideL = G(ctx), sideR = G(ctx);
    input.connect(sp);
    sp.connect(lm, 0); sp.connect(ls, 0); sp.connect(rm, 1); sp.connect(rs, 1);
    lm.connect(mid); rm.connect(mid); ls.connect(side); rs.connect(side);
    mid.connect(midL); mid.connect(midR); side.connect(sideL); side.connect(inv); inv.connect(sideR);
    midL.connect(mg, 0, 0); sideL.connect(mg, 0, 0); midR.connect(mg, 0, 1); sideR.connect(mg, 0, 1);
    return { input, output: mg, setWidth: (w) => smooth(ctx, live, side.gain, w), width: side.gain };
  };

  // generated impulse response: damped, diffuse noise tail (deterministic)
  function makeIR(ctx, size, decay, damp) {
    const sr = ctx.sampleRate, dur = Math.min(9, Math.max(0.2, decay * (0.75 + size * 0.5)) + 0.05), n = Math.floor(dur * sr);
    const ir = ctx.createBuffer(2, n, sr), r = HD.rng(1234);
    const onset = 0.003 + size * 0.03;
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch); let y = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, env = Math.pow(10, (-3 * t) / decay) * Math.min(1, t / onset);
        const fc = 16000 * Math.pow(Math.max(0.03, 0.9 - damp * 0.88) * 0.45 + 0.02, Math.min(1, t / Math.max(0.3, decay * 0.9)) * 1.0) ;
        const c = 1 - Math.exp((-2 * Math.PI * Math.min(fc, 18000)) / sr);
        y += ((r() * 2 - 1) - y) * c; d[i] = y * env * 2.2;
      }
      for (let k = 0; k < 10; k++) { const idx = Math.floor((r() * size * 0.09 + 0.002) * sr); if (idx < n) d[idx] += (r() * 2 - 1) * 0.7 * (1 - k / 12); }
    }
    return ir;
  }

  HD.makeFx = (ctx, type, p, live = true, bpm = 124) => {
    const fx = { type, p: { ...p }, ap: {}, bpm };
    const set = (param, v) => smooth(ctx, live, param, v);
    fx.dispose = () => { try { fx.input.disconnect(); fx.output.disconnect(); } catch (e) { /* noop */ } if (fx._stop) fx._stop(); };
    fx.setBpm = (b) => { fx.bpm = b; if (fx._bpm) fx._bpm(); };
    fx.sched = (k, v, t) => { const list = fx.ap[k]; if (list) for (const [par, conv] of list) par.linearRampToValueAtTime(conv ? conv(v) : v, t); };
    fx.anchor = (k, v, t) => { const list = fx.ap[k]; if (list) for (const [par, conv] of list) par.setValueAtTime(conv ? conv(v) : v, t); };
    fx.resetAuto = (t) => { for (const k in fx.ap) fx.ap[k].forEach(([par]) => par.cancelScheduledValues(t)); };
    let custom = () => {};
    fx.set = (k, v) => {
      fx.p[k] = v;
      const list = fx.ap[k]; if (list) for (const [par, conv] of list) set(par, conv ? conv(v) : v);
      custom(k, v);
    };

    switch (type) {
      case 'reverb': {
        const input = G(ctx), output = G(ctx), dry = G(ctx, p.dry), wet = G(ctx, p.wet), pre = ctx.createDelay(0.5), conv = ctx.createConvolver();
        pre.delayTime.value = p.pre / 1000;
        input.connect(dry); dry.connect(output); input.connect(pre); pre.connect(conv); conv.connect(wet); wet.connect(output);
        let timer = null, cur = null;
        const build = () => { const key = [fx.p.size, fx.p.decay, fx.p.damp].join(); if (key === cur) return; cur = key; conv.buffer = makeIR(ctx, fx.p.size, fx.p.decay, fx.p.damp); };
        build();
        fx.ap = { wet: [[wet.gain]], dry: [[dry.gain]], pre: [[pre.delayTime, (v) => v / 1000]] };
        custom = (k) => { if (k === 'size' || k === 'decay' || k === 'damp') { if (live) { clearTimeout(timer); timer = setTimeout(build, 140); } else build(); } };
        fx._stop = () => clearTimeout(timer);
        Object.assign(fx, { input, output }); break;
      }
      case 'delay': {
        const input = G(ctx), output = G(ctx), dry = G(ctx, 1), wet = G(ctx, p.wet), dl = ctx.createDelay(4.5), dr = ctx.createDelay(4.5);
        const lpL = ctx.createBiquadFilter(), lpR = ctx.createBiquadFilter(), fbL = G(ctx, p.fb), fbR = G(ctx, p.fb), pl = ctx.createStereoPanner(), pr = ctx.createStereoPanner();
        lpL.type = lpR.type = 'lowpass'; lpL.frequency.value = lpR.frequency.value = p.tone;
        const upd = () => { const t = Math.min(4, Math.max(0.005, (fx.p.time * 60) / fx.bpm)); dl.delayTime.value = t; dr.delayTime.value = t; };
        fx._bpm = upd; fx.p.time = p.time; upd();
        input.connect(output); input.connect(dl);
        dl.connect(lpL); lpL.connect(fbL); fbL.connect(dr); dr.connect(lpR); lpR.connect(fbR); fbR.connect(dl);
        lpL.connect(pl); lpR.connect(pr); pl.pan.value = -p.stereo; pr.pan.value = p.stereo; pl.connect(wet); pr.connect(wet); wet.connect(output);
        fx.ap = { wet: [[wet.gain]], fb: [[fbL.gain], [fbR.gain]], tone: [[lpL.frequency], [lpR.frequency]], stereo: [[pl.pan, (v) => -v], [pr.pan]] };
        custom = (k) => { if (k === 'time') upd(); };
        Object.assign(fx, { input, output }); break;
      }
      case 'eq': {
        const input = G(ctx), lo = ctx.createBiquadFilter(), mid = ctx.createBiquadFilter(), hi = ctx.createBiquadFilter();
        lo.type = 'lowshelf'; lo.frequency.value = 110; lo.gain.value = p.low; mid.type = 'peaking'; mid.frequency.value = p.midf; mid.Q.value = 0.9; mid.gain.value = p.mid;
        hi.type = 'highshelf'; hi.frequency.value = 8000; hi.gain.value = p.high;
        input.connect(lo); lo.connect(mid); mid.connect(hi);
        fx.ap = { low: [[lo.gain]], mid: [[mid.gain]], midf: [[mid.frequency]], high: [[hi.gain]] };
        Object.assign(fx, { input, output: hi }); break;
      }
      case 'comp': {
        const c = ctx.createDynamicsCompressor(), out = G(ctx, dbg(p.makeup));
        c.threshold.value = p.thr; c.ratio.value = p.ratio; c.attack.value = p.attack; c.release.value = p.release; c.knee.value = 6; c.connect(out);
        fx.ap = { thr: [[c.threshold]], ratio: [[c.ratio]], attack: [[c.attack]], release: [[c.release]], makeup: [[out.gain, dbg]] };
        Object.assign(fx, { input: c, output: out }); break;
      }
      case 'sat': case 'dist': {
        const input = G(ctx), output = G(ctx), dry = G(ctx, 1 - p.mix), wet = G(ctx, p.mix), pre = G(ctx), ws = ctx.createWaveShaper(), post = G(ctx), tone = ctx.createBiquadFilter();
        const isD = type === 'dist';
        ws.oversample = '4x'; tone.type = 'lowpass'; tone.frequency.value = isD ? 7000 : 16000;
        const upd = () => { const d = fx.p.drive, g = 1 + d * (isD ? 24 : 6); pre.gain.value = g; post.gain.value = (isD ? 0.9 : 0.9) / Math.pow(g, isD ? 0.55 : 0.45); };
        ws.curve = isD ? atanCurve(2.5) : HD.tanhCurve(2);
        upd();
        const dd = ctx.createDelay(0.05); dd.delayTime.value = 192 / ctx.sampleRate; // match the 4x-oversampled wet path (no comb filtering when mixed)
        input.connect(dd); dd.connect(dry); dry.connect(output); input.connect(pre); pre.connect(ws); ws.connect(post); post.connect(tone); tone.connect(wet); wet.connect(output);
        fx.ap = { mix: [[wet.gain], [dry.gain, (v) => 1 - v]] };
        custom = (k) => { if (k === 'drive') upd(); };
        Object.assign(fx, { input, output }); break;
      }
      case 'filter': {
        const f = ctx.createBiquadFilter(); f.type = p.mode ? 'highpass' : 'lowpass'; f.frequency.value = p.freq; f.Q.value = p.res;
        fx.ap = { freq: [[f.frequency]], res: [[f.Q]] };
        custom = (k, v) => { if (k === 'mode') f.type = v >= 0.5 ? 'highpass' : 'lowpass'; };
        Object.assign(fx, { input: f, output: f }); break;
      }
      case 'limiter': {
        const c = ctx.createDynamicsCompressor(); c.threshold.value = p.thr; c.knee.value = 0; c.ratio.value = 20; c.attack.value = 0.002; c.release.value = p.release;
        fx.ap = { thr: [[c.threshold]], release: [[c.release]] };
        Object.assign(fx, { input: c, output: c }); break;
      }
      case 'chorus': {
        const input = G(ctx), output = G(ctx), dry = G(ctx, 1), wet = G(ctx, p.mix);
        const mkv = (ph, pan) => {
          const d = ctx.createDelay(0.1), lfo = ctx.createOscillator(), dg = G(ctx, p.depth * 0.006), pn = ctx.createStereoPanner();
          d.delayTime.value = 0.018; lfo.frequency.value = p.rate * ph; lfo.connect(dg); dg.connect(d.delayTime); pn.pan.value = pan; input.connect(d); d.connect(pn); pn.connect(wet); lfo.start(); return { lfo, dg, ph };
        };
        const v1 = mkv(1, -0.8), v2 = mkv(1.13, 0.8);
        input.connect(dry); dry.connect(output); wet.connect(output);
        fx.ap = { mix: [[wet.gain]], depth: [[v1.dg.gain, (v) => v * 0.006], [v2.dg.gain, (v) => v * 0.006]], rate: [[v1.lfo.frequency], [v2.lfo.frequency, (v) => v * 1.13]] };
        fx._stop = () => { try { v1.lfo.stop(); v2.lfo.stop(); } catch (e) { /* noop */ } };
        Object.assign(fx, { input, output }); break;
      }
      case 'phaser': {
        const input = G(ctx), output = G(ctx), dry = G(ctx, 1), wet = G(ctx, p.mix), fb = G(ctx, p.fb), fd = ctx.createDelay(0.05), lfo = ctx.createOscillator(), lg = G(ctx, p.depth * 900);
        fd.delayTime.value = 0.004; lfo.frequency.value = p.rate; lfo.connect(lg);
        const stages = []; let prev = input;
        for (let i = 0; i < 4; i++) { const a = ctx.createBiquadFilter(); a.type = 'allpass'; a.frequency.value = 1100; a.Q.value = 0.7; lg.connect(a.frequency); prev.connect(a); prev = a; stages.push(a); }
        prev.connect(wet); prev.connect(fb); fb.connect(fd); fd.connect(input);
        input.connect(dry); dry.connect(output); wet.connect(output); lfo.start();
        fx.ap = { mix: [[wet.gain]], fb: [[fb.gain]], depth: [[lg.gain, (v) => v * 900]], rate: [[lfo.frequency]] };
        fx._stop = () => { try { lfo.stop(); } catch (e) { /* noop */ } };
        Object.assign(fx, { input, output }); break;
      }
      case 'width': {
        const w = HD.makeWidener(ctx, live); w.setWidth(p.width);
        fx.ap = { width: [[w.width]] };
        Object.assign(fx, { input: w.input, output: w.output }); break;
      }
      case 'pump': {
        const g = G(ctx, 1);
        // tempo-locked ducking (a stand-in for sidechain compression): one gain dip on every beat
        fx.duck = (t, spb) => {
          const depth = fx.p.depth, rel = Math.min(0.95, fx.p.release) * spb, n = 24, c = new Float32Array(n);
          for (let i = 0; i < n; i++) c[i] = 1 - depth * Math.pow(1 - i / (n - 1), fx.p.curve);
          try { g.gain.setValueCurveAtTime(c, t, rel); } catch (e) { /* overlapping curve; skip */ }
        };
        fx.resetAuto = (t) => g.gain.cancelScheduledValues(t);
        Object.assign(fx, { input: g, output: g }); break;
      }
      default: { const g = G(ctx); Object.assign(fx, { input: g, output: g }); }
    }
    return fx;
  };
})();
