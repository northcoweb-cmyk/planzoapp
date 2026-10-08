/* HouseDAW — audio engine. Builds the mixer graph from the project, schedules clip events
   (identical code path for live playback and offline export) and owns metering/preview. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const S = HD.State, EPS = 1e-7;
  const G = (ctx, v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const dbg = (db) => Math.pow(10, db / 20);

  class Engine {
    constructor(ctx, live = true) {
      this.ctx = ctx; this.live = live; this.tracks = new Map(); this.project = null; this.bpm = 124; this.spb = 60 / 124;
      this.sess = new Map(); this.masterFx = new Map(); this.masterKey = ''; this.playing = false; this.instKeys = new Map();
      this.masterIn = G(ctx); this.masterVol = G(ctx, 0.9);
      this.buildMastering();
      this.masterIn.connect(this.mast.input);
      this.mast.out.connect(this.masterVol); this.masterVol.connect(ctx.destination);
      // master meters
      if (live) { this.master = this.makeMeter(this.masterVol); }
      // send buses
      this.sends = {};
      for (const k of ['a', 'b']) {
        const bus = { in: G(ctx), ret: G(ctx, 0.6), fx: null, key: '' };
        bus.ret.connect(this.masterIn); this.sends[k] = bus;
      }
      this.prevS = null; this.prev = null; this.metroBus = G(ctx, 0.5); this.metroBus.connect(ctx.destination);
      this.prevBus = G(ctx, 0.9); const pl = ctx.createDynamicsCompressor(); pl.threshold.value = -3; pl.ratio.value = 20; pl.knee.value = 0; pl.attack.value = 0.002; this.prevBus.connect(pl); pl.connect(ctx.destination);
    }

    makeMeter(node) {
      const ctx = this.ctx, sp = ctx.createChannelSplitter(2), a = ctx.createAnalyser(), b = ctx.createAnalyser();
      a.fftSize = b.fftSize = 1024; node.connect(sp); sp.connect(a, 0); sp.connect(b, 1);
      return { a, b, buf: new Float32Array(1024), hold: [0, 0] };
    }
    readMeter(m) {
      if (!m) return [0, 0];
      const out = [0, 0];
      [m.a, m.b].forEach((an, i) => { an.getFloatTimeDomainData(m.buf); let pk = 0; for (let j = 0; j < m.buf.length; j++) { const v = Math.abs(m.buf[j]); if (v > pk) pk = v; } out[i] = pk; });
      return out;
    }

    buildMastering() {
      const c = this.ctx, m = (this.mast = {});
      m.input = G(c); m.bass = c.createBiquadFilter(); m.bass.type = 'lowshelf'; m.bass.frequency.value = 100; m.treble = c.createBiquadFilter(); m.treble.type = 'highshelf'; m.treble.frequency.value = 9000;
      m.dry = G(c); m.comp = c.createDynamicsCompressor(); m.comp.threshold.value = -24; m.comp.ratio.value = 6; m.comp.attack.value = 0.025; m.comp.release.value = 0.14; m.comp.knee.value = 6;
      m.wet = G(c, 0); m.sum = G(c); m.wid = HD.makeWidener(c, this.live); m.loud = G(c); m.lim = c.createDynamicsCompressor(); m.lim.threshold.value = -1; m.lim.knee.value = 0; m.lim.ratio.value = 20; m.lim.attack.value = 0.001; m.lim.release.value = 0.08;
      m.out = G(c); m.pre = G(c); // m.pre receives master-fx output
      m.hpf = c.createBiquadFilter(); m.hpf.type = 'highpass'; m.hpf.frequency.value = 28; m.hpf.Q.value = 0.7; // remove inaudible rumble
      m.pre.connect(m.hpf); m.hpf.connect(m.bass); m.bass.connect(m.treble); m.dd = c.createDelay(0.05); m.dd.delayTime.value = Math.floor(0.006 * c.sampleRate) / c.sampleRate; // = DynamicsCompressor look-ahead, keeps the parallel 'punch' path in phase
      m.treble.connect(m.dd); m.dd.connect(m.dry); m.dry.connect(m.sum); m.treble.connect(m.comp); m.comp.connect(m.wet); m.wet.connect(m.sum);
      m.sum.connect(m.wid.input); m.wid.output.connect(m.loud); m.loud.connect(m.lim); m.lim.connect(m.out);
      // master fx chain sits between masterIn and mast.pre; mast.input is the chain head
      m.input = G(c); m.input.connect(m.pre);
    }

    set(param, v) { HD.setParam(this.ctx, this.live, param, v); }

    // ---------- project sync ----------
    setProject(p) { this.project = p; this.sync(); }
    setBpm(b) {
      this.bpm = b; this.spb = 60 / b;
      this.masterFx.forEach((f) => f.setBpm(b)); for (const k in this.sends) if (this.sends[k].fx) this.sends[k].fx.setBpm(b);
      this.tracks.forEach((n) => n.fxObjs.forEach((f) => f.setBpm(b)));
    }
    hasAuto(t, key) { return this.playing && t.auto && t.auto[key] && t.auto[key].length > 0; }
    // ---- plugin delay compensation: Web Audio compressors (6 ms) and oversampled shapers add latency; line every track up ----
    chainDelay(t) {
      const sr = this.ctx.sampleRate; let d = 0;
      if (t.type === 'inst' && t.inst) { d += Math.floor(0.006 * sr) / sr; if ((t.inst.preset.drive || 0) > 0.001) d += 128 / sr; }
      for (const f of t.fx) if (!f.bypass) { if (f.type === 'comp' || f.type === 'limiter') d += Math.floor(0.006 * sr) / sr; else if (f.type === 'sat' || f.type === 'dist') d += 192 / sr; }
      return d;
    }
    totalDelay(t, depth = 0) { const bus = t.out && t.out !== 'master' && depth < 6 ? this.project.tracks.find((x) => x.id === t.out) : null; return this.chainDelay(t) + (bus ? this.totalDelay(bus, depth + 1) : 0); }
    masterDelay() {
      const sr = this.ctx.sampleRate, comp = Math.floor(0.006 * sr) / sr; let d = comp * 2; // mastering stage: parallel-punch dry delay + final limiter
      for (const f of this.project.master.fx) if (!f.bypass) { if (f.type === 'comp' || f.type === 'limiter') d += comp; else if (f.type === 'sat' || f.type === 'dist') d += 192 / sr; }
      return d;
    }
    updateLatency() {
      const p = this.project; if (!p || !p.tracks.length) { this.maxLatency = 0; return; }
      const tot = new Map(p.tracks.map((t) => [t.id, this.totalDelay(t)])), mx = Math.max(...tot.values());
      this.maxLatency = mx;
      for (const t of p.tracks) { const n = this.tracks.get(t.id); if (n) n.pdc.delayTime.value = Math.max(0, mx - tot.get(t.id)); }
    }
    soloActive() { return this.project.tracks.some((t) => t.solo); }
    chainSolo(t) { // is this track (or something it feeds / is fed by) soloed
      const tr = this.project.tracks; let cur = t, guard = 0;
      while (cur && guard++ < 8) { if (cur.solo) return true; cur = cur.out && cur.out !== 'master' ? tr.find((x) => x.id === cur.out) : null; }
      return tr.some((x) => x.solo && this.feeds(x, t.id));
    }
    feeds(x, id) { let cur = x, g = 0; const tr = this.project.tracks; while (cur && g++ < 8) { if (cur.out === id) return true; cur = cur.out && cur.out !== 'master' ? tr.find((y) => y.id === cur.out) : null; } return false; }
    audible(t) { if (t.mute) return false; return this.soloActive() ? this.chainSolo(t) : true; }

    createTrack(t) {
      const c = this.ctx, n = { id: t.id, type: t.type, input: G(c), fader: G(c), pan: c.createStereoPanner(), mute: G(c), out: G(c), sendA: G(c, 0), sendB: G(c, 0), dest: G(c), pdc: c.createDelay(0.25), fxObjs: new Map(), chain: '', target: null, openHat: null };
      n.input.connect(n.fader); n.fader.connect(n.pan); n.pan.connect(n.mute); n.mute.connect(n.pdc); n.pdc.connect(n.out);
      n.out.connect(n.dest); n.out.connect(n.sendA); n.out.connect(n.sendB); n.sendA.connect(this.sends.a.in); n.sendB.connect(this.sends.b.in);
      if (t.type === 'inst') { n.bus = HD.Inst.makeBus(c, this.live); n.bus.output.connect(n.input); n.src = n.bus.input; } else n.src = n.input;
      if (this.live) n.meter = this.makeMeter(n.out);
      this.tracks.set(t.id, n); return n;
    }
    disposeTrack(n) {
      try { n.out.disconnect(); n.dest.disconnect(); n.input.disconnect(); n.fxObjs.forEach((f) => f.dispose()); n.sendA.disconnect(); n.sendB.disconnect(); } catch (e) { /* noop */ }
      this.tracks.delete(n.id);
    }

    rebuildChain(owner, fxList, headNode, tailNode, store) {
      const live = fxList.filter((f) => !f.bypass);
      // dispose objects that no longer exist
      const ids = new Set(fxList.map((f) => f.id));
      store.forEach((o, id) => { if (!ids.has(id)) { o.dispose(); store.delete(id); } });
      try { headNode.disconnect(); } catch (e) { /* noop */ }
      store.forEach((o) => { try { o.output.disconnect(); } catch (e) { /* noop */ } });
      let prev = headNode;
      for (const f of live) {
        let o = store.get(f.id);
        if (!o || o.type !== f.type) { if (o) o.dispose(); o = HD.makeFx(this.ctx, f.type, f.p, this.live, this.bpm); store.set(f.id, o); }
        prev.connect(o.input); prev = o.output;
      }
      prev.connect(tailNode);
    }
    syncFxParams(fxList, store) {
      for (const f of fxList) {
        const o = store.get(f.id); if (!o || f.bypass) continue;
        for (const k in f.p) if (o.p[k] !== f.p[k]) o.set(k, f.p[k]);
      }
    }

    sync(forceManual = false) {
      if (this.live) this.project = HD.State.project;
      const p = this.project; if (!p) return;
      this.setBpm(p.bpm);
      const ids = new Set(p.tracks.map((t) => t.id));
      this.tracks.forEach((n, id) => { if (!ids.has(id)) this.disposeTrack(n); });
      for (const t of p.tracks) if (!this.tracks.get(t.id)) this.createTrack(t); // create every node first so routing can target any track
      for (const t of p.tracks) {
        const n = this.tracks.get(t.id);
        const auto = (k) => !forceManual && this.hasAuto(t, k);
        if (!auto('vol')) this.set(n.fader.gain, t.vol);
        if (!auto('pan')) this.set(n.pan.pan, t.pan);
        if (!auto('sendA')) this.set(n.sendA.gain, t.sendA || 0);
        if (!auto('sendB')) this.set(n.sendB.gain, t.sendB || 0);
        this.set(n.mute.gain, this.audible(t) ? 1 : 0);
        // routing
        const tgt = t.out && t.out !== 'master' && this.tracks.get(t.out) && this.tracks.get(t.out) !== n ? t.out : 'master';
        if (n.target !== tgt) {
          try { n.dest.disconnect(); } catch (e) { /* noop */ }
          n.dest.connect(tgt === 'master' ? this.masterIn : this.tracks.get(tgt).input);
          n.target = tgt;
        }
        // inserts
        const key = t.fx.map((f) => f.id + f.type + (f.bypass ? 'b' : '')).join('|');
        if (n.chain !== key) { this.rebuildChain(t, t.fx, n.input, n.fader, n.fxObjs); n.chain = key; }
        this.syncFxParams(t.fx, n.fxObjs);
        if (n.bus && t.inst) {
          const ik = JSON.stringify(t.inst.preset); if (this.instKeys.get(t.id) !== ik) { n.bus.setPreset(t.inst.preset); this.instKeys.set(t.id, ik); }
        }
      }
      // master
      const m = p.master;
      if (!(!forceManual && this.playing && m.auto && m.auto.vol && m.auto.vol.length)) this.set(this.masterVol.gain, m.vol);
      const mk = m.fx.map((f) => f.id + f.type + (f.bypass ? 'b' : '')).join('|');
      if (this.masterKey !== mk) { this.rebuildChain(m, m.fx, this.masterIn, this.mast.input, this.masterFx); this.masterKey = mk; }
      this.syncFxParams(m.fx, this.masterFx);
      this.syncMastering(m.mastering);
      for (const k of ['a', 'b']) {
        const s = p.sends[k], bus = this.sends[k], key = s.fx.type;
        if (bus.key !== key) { if (bus.fx) bus.fx.dispose(); bus.fx = HD.makeFx(this.ctx, s.fx.type, s.fx.p, this.live, this.bpm); bus.in.disconnect(); bus.in.connect(bus.fx.input); bus.fx.output.connect(bus.ret); bus.key = key; }
        for (const kk in s.fx.p) if (bus.fx.p[kk] !== s.fx.p[kk]) bus.fx.set(kk, s.fx.p[kk]);
        this.set(bus.ret.gain, s.ret);
      }
      this.updateLatency();
    }
    syncMastering(ms) {
      const m = this.mast, on = ms.on !== false;
      this.set(m.bass.gain, on ? ms.bass : 0); this.set(m.treble.gain, on ? ms.treble : 0);
      this.set(m.wet.gain, on ? ms.punch * 0.9 : 0); this.set(m.dry.gain, 1);
      m.wid.setWidth(on ? ms.width : 1);
      this.set(m.loud.gain, on ? dbg(ms.loud * 9) : 1);
      this.set(m.lim.threshold, on ? -1 : -0.3);
      this.set(m.comp.threshold, -26 + ms.punch * 6);
    }

    // ---------- sessions (so Stop can really silence scheduled-but-unplayed events) ----------
    newSession() {
      this.sess.forEach((g) => { try { g.gain.cancelScheduledValues(this.ctx.currentTime); g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01); setTimeout(() => { try { g.disconnect(); } catch (e) { /* noop */ } }, 120); } catch (e) { /* noop */ } });
      this.sess = new Map();
      this.tracks.forEach((n) => { n.openHat = null; });
    }
    sessGain(n) {
      let g = this.sess.get(n.id);
      if (!g) { g = G(this.ctx); g.connect(n.src); this.sess.set(n.id, g); }
      return g;
    }

    // ---------- event scheduling ----------
    // schedule every event whose time lies in [b0,b1). tOf(beat) -> ctx time.
    scheduleRange(b0, b1, tOf, o = {}) {
      const p = this.project, spb = this.spb, segStart = !!o.segStart, cap = o.cap == null ? Infinity : o.cap;
      for (const clip of p.clips) {
        if (clip.mute) continue;
        const trk = S.track(clip.track) || p.tracks.find((t) => t.id === clip.track); const n = trk && this.tracks.get(trk.id);
        if (!n || !this.audible(trk)) continue;
        const cs = clip.start, ce = cs + clip.len;
        if (ce <= b0 + EPS || cs >= b1 - EPS) { if (!(segStart && cs < b0 && ce > b0)) continue; }
        const dest = this.sessGain(n);
        if (clip.type === 'audio') this.schedAudio(clip, n, dest, b0, b1, tOf, segStart, cap, spb);
        else this.schedNotes(clip, trk, n, dest, b0, b1, tOf, segStart, cap, spb);
      }
      this.schedAuto(b0, b1, tOf);
      // tempo-locked pump fx + metronome
      const k0 = Math.ceil(b0 - EPS), k1 = Math.ceil(b1 - EPS);
      if (k1 > k0) {
        const pumpers = [];
        this.tracks.forEach((n) => n.fxObjs.forEach((f) => { if (f.type === 'pump') pumpers.push(f); }));
        this.masterFx.forEach((f) => { if (f.type === 'pump') pumpers.push(f); });
        for (let k = k0; k < k1; k++) {
          for (const f of pumpers) f.duck(tOf(k), spb);
          if (o.metro && this.live) this.click(tOf(k), k % 4 === 0);
        }
      }
    }

    swung(s, swing) {
      if (!swing) return s;
      const g = s / 0.25, r = Math.round(g);
      return Math.abs(g - r) < 1e-3 && r % 2 === 1 ? s + swing * 0.12 : s;
    }

    schedNotes(clip, trk, n, dest, b0, b1, tOf, segStart, cap, spb) {
      const cl = Math.max(0.25, clip.cl || clip.len), cs = clip.start, ce = cs + clip.len, swing = clip.swing || 0;
      const isDrum = clip.type === 'drum';
      for (let k = 0; ; k++) {
        const base = cs + k * cl; if (base >= ce - EPS || base > b1) break;
        if (base + cl < b0 - (segStart ? 64 : 0)) continue;
        if (isDrum) {
          for (const row of clip.rows || []) {
            if (row.mute) continue;
            const buf = HD.Lib.buffer(row.snd); if (!buf) continue;
            for (const nt of row.notes) {
              if (nt.s >= cl - EPS) continue;
              const s = base + this.swung(nt.s, swing) + (nt.o || 0);
              if (s >= ce - EPS || s < b0 - EPS || s >= b1 - EPS) continue;
              this.hit(n, dest, buf, tOf(s), nt.v * (row.vol == null ? 1 : row.vol) * (clip.gain == null ? 1 : clip.gain), row.pan || 0, row.snd);
            }
          }
        } else if (trk.inst) {
          const preset = trk.inst.preset;
          for (const nt of clip.notes || []) {
            if (nt.s >= cl - EPS) continue;
            const s0 = base + this.swung(nt.s, swing), e0 = Math.min(s0 + nt.l, base + cl, ce, cap);
            let t = null, dur = 0;
            if (s0 >= b0 - EPS && s0 < b1 - EPS) { t = tOf(s0); dur = (e0 - s0) * spb; }
            else if (segStart && s0 < b0 && e0 > b0 + 0.02) { t = tOf(b0); dur = (e0 - b0) * spb; }
            if (t != null && dur > 0.01) HD.Inst.play(this.ctx, dest, preset, nt.p, t, dur, nt.v * (clip.gain == null ? 1 : clip.gain));
          }
        }
      }
    }

    hit(n, dest, buf, t, vel, pan, snd) {
      const ctx = this.ctx, src = ctx.createBufferSource(), g = G(ctx, Math.min(1.5, vel));
      src.buffer = buf; src.connect(g);
      if (pan) { const pn = ctx.createStereoPanner(); pn.pan.value = pan; g.connect(pn); pn.connect(dest); } else g.connect(dest);
      src.start(t);
      const sub = (HD.Lib.byId[snd] || {}).sub;
      if (sub === 'Open Hat') { n.openHat = { g, src }; }
      else if (sub === 'Closed Hat' && n.openHat && n.openHat.src !== src) { const oh = n.openHat; try { oh.g.gain.setTargetAtTime(0, Math.max(t, ctx.currentTime), 0.004); } catch (e) { /* noop */ } n.openHat = null; }
    }

    schedAudio(clip, n, dest, b0, b1, tOf, segStart, cap, spb) {
      const buf = HD.Lib.buffer(clip.snd) || HD.Lib.bufs[clip.snd]; if (!buf) return;
      const cs = clip.start, ce = cs + clip.len, ctx = this.ctx, rate = clip.rate || 1;
      let t, beatOff = 0;
      if (cs >= b0 - EPS && cs < b1 - EPS) t = tOf(cs);
      else if (segStart && cs < b0 && ce > b0 + 0.01) { t = tOf(b0); beatOff = b0 - cs; } else return;
      const endBeat = Math.min(ce, cap), durSec = (endBeat - cs - beatOff) * spb; if (durSec <= 0.005) return;
      const src = ctx.createBufferSource(), g = G(ctx, 0); src.buffer = buf; src.playbackRate.value = rate;
      const offSrc = (clip.off || 0) + beatOff * spb * rate;
      let off = offSrc; const looping = clip.loop || (clip.len * spb * rate + (clip.off || 0) > buf.duration + 0.01);
      if (looping) { src.loop = true; src.loopStart = clip.off || 0; src.loopEnd = buf.duration; if (off >= buf.duration) off = (clip.off || 0) + ((off - (clip.off || 0)) % Math.max(0.01, buf.duration - (clip.off || 0))); }
      else if (off >= buf.duration) return;
      const gain = clip.gain == null ? 1 : clip.gain, fi = (clip.fi || 0) * spb, fo = (clip.fo || 0) * spb, pos = beatOff * spb;
      const startG = fi > 0 && pos < fi ? gain * (pos / fi) : gain;
      g.gain.setValueAtTime(startG, t);
      let tFi = t; if (fi > 0 && pos < fi) { tFi = t + (fi - pos); g.gain.linearRampToValueAtTime(gain, tFi); }
      const tEnd = t + durSec;
      if (fo > 0 && endBeat >= ce - EPS) { const tf = Math.max(tFi, tEnd - fo); g.gain.setValueAtTime(gain, tf); g.gain.linearRampToValueAtTime(0, tEnd); }
      src.connect(g); g.connect(dest);
      src.start(t, off, looping ? undefined : undefined); src.stop(tEnd + 0.005);
    }

    // automation lanes -> AudioParam events
    autoTargets(n, t, key) {
      if (key === 'vol') return [[n.fader.gain]]; if (key === 'pan') return [[n.pan.pan]];
      if (key === 'sendA') return [[n.sendA.gain]]; if (key === 'sendB') return [[n.sendB.gain]];
      if (key.startsWith('fx:')) { const [, fid, k] = key.split(':'); const f = n.fxObjs.get(fid); return f && f.ap[k] ? f.ap[k] : []; }
      return [];
    }
    schedAuto(b0, b1, tOf) {
      const p = this.project;
      const run = (lane, def, targets) => {
        if (!lane || !lane.length || !targets.length) return;
        const bs = [b0]; for (const pt of lane) if (pt.t > b0 + EPS && pt.t < b1 - EPS) bs.push(pt.t);
        bs.push(b1);
        const sub = [];
        for (let i = 0; i < bs.length - 1; i++) { const a = bs[i], z = bs[i + 1], st = Math.max(1, Math.ceil((z - a) / 0.125)); for (let j = 0; j < st; j++) sub.push(a + ((z - a) * j) / st); }
        sub.push(b1);
        for (const [par, conv] of targets) {
          const val = (b) => { const v = def.toNat(Math.min(1, Math.max(0, S.autoValueAt(lane, b)))); return conv ? conv(v) : v; };
          try {
            par.cancelScheduledValues(tOf(b0)); par.setValueAtTime(val(b0), tOf(b0));
            for (let i = 1; i < sub.length; i++) par.linearRampToValueAtTime(val(sub[i]), tOf(sub[i]));
          } catch (e) { /* noop */ }
        }
      };
      for (const t of p.tracks) {
        if (!t.auto) continue; const n = this.tracks.get(t.id); if (!n) continue;
        for (const key in t.auto) { const def = S.paramDef(t, key); if (def) run(t.auto[key], def, this.autoTargets(n, t, key)); }
      }
      const m = p.master; if (m.auto && m.auto.vol) run(m.auto.vol, { toNat: (v) => S.faderToGain(v) }, [[this.masterVol.gain]]);
    }

    // ---------- live helpers ----------
    click(t, accent) {
      const c = this.ctx, o = c.createOscillator(), g = G(c, 0);
      o.frequency.value = accent ? 1600 : 1000; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(accent ? 0.9 : 0.55, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g); g.connect(this.metroBus); o.start(t); o.stop(t + 0.06);
    }
    stopPreview() {
      if (this.prevS) { const g = this.prevS; try { g.gain.cancelScheduledValues(this.ctx.currentTime); g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.015); } catch (e) { /* noop */ } setTimeout(() => { try { g.disconnect(); } catch (e) { /* noop */ } }, 150); this.prevS = null; }
      this.prev = null; if (this.prevEnd) { clearTimeout(this.prevEnd); this.prevEnd = null; }
    }
    prevSession() { this.stopPreview(); this.prevS = G(this.ctx); this.prevS.connect(this.prevBus); return this.prevS; }
    previewBuffer(buf, onend) {
      const c = this.ctx, sess = this.prevSession(), src = c.createBufferSource();
      src.buffer = buf; src.connect(sess); src.start(); src.onended = () => { if (this.prevS === sess && onend) onend(); };
      this.prev = { src }; return src;
    }
    previewPreset(preset, midi, dur = 0.7, chord = [0]) {
      const sess = this.prevSession(), bus = HD.Inst.makeBus(this.ctx, true); bus.setPreset(preset); bus.output.connect(sess);
      chord.forEach((iv) => HD.Inst.play(this.ctx, bus.input, preset, midi + iv, this.ctx.currentTime + 0.01, dur, 0.85));
    }
    // play a note list (beats) through a preset, optionally on a loop; used to audition chords / bass / melody patterns
    previewNotes(preset, notes, bpm, beats, loops = 1) {
      const sess = this.prevSession(), bus = HD.Inst.makeBus(this.ctx, true), spb = 60 / bpm, t0 = this.ctx.currentTime + 0.05;
      bus.setPreset(preset); bus.output.connect(sess);
      for (let k = 0; k < loops; k++) for (const n of notes) HD.Inst.play(this.ctx, bus.input, preset, n.p, t0 + (k * beats + n.s) * spb, Math.max(0.05, n.l * spb), n.v);
      this.prevEnd = setTimeout(() => { this.prevEnd = null; }, loops * beats * spb * 1000);
    }
    previewHits(rows, swing, bpm, beats, loops = 2) {
      const sess = this.prevSession(), ctx = this.ctx, spb = 60 / bpm, t0 = ctx.currentTime + 0.05;
      for (let k = 0; k < loops; k++) for (const row of rows) {
        const buf = HD.Lib.buffer(row.snd); if (!buf) continue;
        for (const nt of row.notes) { const s = this.swung(nt.s, swing || 0) + (nt.o || 0), src = ctx.createBufferSource(), g = G(ctx, nt.v * (row.vol == null ? 1 : row.vol)); src.buffer = buf; src.connect(g); g.connect(sess); src.start(t0 + (k * beats + s) * spb); }
      }
    }
    auditionNote(trackId, midi, vel = 0.8, dur = 0.35) {
      const n = this.tracks.get(trackId), t = S.track(trackId); if (!n || !t || !t.inst) return;
      HD.Inst.play(this.ctx, n.src, t.inst.preset, midi, this.ctx.currentTime + 0.005, dur, vel);
    }
    auditionDrum(trackId, snd, vel = 0.9) {
      const n = this.tracks.get(trackId), buf = HD.Lib.buffer(snd); if (!n || !buf) return;
      this.hit(n, n.src, buf, this.ctx.currentTime + 0.005, vel, 0, snd);
    }
  }
  HD.Engine = Engine;

  // ---------- offline render (export) ----------
  HD.renderProject = async (project, o = {}) => {
    const sr = o.sr || HD.Lib.sr, spb = 60 / project.bpm;
    const start = o.start || 0, end = o.end != null ? o.end : S.endBeat(), tail = o.tail == null ? 2 : o.tail;
    const eng0 = { lat: 0 };
    // total processing latency (tracks + master) — events are scheduled this much later and the lead-in is trimmed afterwards
    const probe = new Engine(new OfflineAudioContext(2, 128, sr), false); probe.project = project; probe.sync(); eng0.lat = probe.maxLatency + probe.masterDelay();
    const total = Math.max(0.1, (end - start) * spb + tail + eng0.lat), ctx = new OfflineAudioContext(2, Math.ceil(total * sr), sr);
    const eng = new Engine(ctx, false); eng.project = project; eng.sync();
    if (o.onProgress) o.onProgress(0.05, 'Rendering sounds…');
    const ids = new Set(); for (const c of project.clips) { if (c.type === 'audio') ids.add(c.snd); if (c.type === 'drum') (c.rows || []).forEach((r) => ids.add(r.snd)); }
    let i = 0; for (const id of ids) { HD.Lib.buffer(id); if (++i % 4 === 0) await new Promise((r) => setTimeout(r)); }
    if (o.onProgress) o.onProgress(0.2, 'Mixing…');
    // Schedule in 2-bar chunks via suspend(): only nearby nodes are alive at any time, which keeps long exports fast.
    const CH = 8, tOf = (b) => (b - start) * spb, jobs = [];
    const run = (b0, b1, first) => eng.scheduleRange(b0, b1, tOf, { segStart: first, cap: end });
    const chunked = typeof ctx.suspend === 'function';
    run(start, chunked ? Math.min(end, start + CH) : end, true);
    if (chunked) for (let b0 = start + CH; b0 < end; b0 += CH) {
      const b1 = Math.min(end, b0 + CH), tt = Math.floor(tOf(b0) * sr / 128) * 128 / sr;
      jobs.push(ctx.suspend(tt).then(() => { run(b0, b1, false); if (o.onProgress) o.onProgress(0.2 + 0.75 * ((b0 - start) / Math.max(1, end - start)), 'Mixing…'); return ctx.resume(); }));
    }
    const raw = await ctx.startRendering(); await Promise.all(jobs);
    const skip = Math.min(raw.length - 1, Math.round(eng0.lat * sr)), outLen = raw.length - skip, buf = new AudioBuffer({ length: outLen, numberOfChannels: 2, sampleRate: sr });
    for (let c = 0; c < 2; c++) buf.copyToChannel(raw.getChannelData(c).subarray(skip), c);
    if (o.onProgress) o.onProgress(1, 'Done');
    return buf;
  };
})();
