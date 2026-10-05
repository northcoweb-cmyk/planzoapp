/* HouseDAW — transport: look-ahead scheduler, loop handling and a playhead that follows the audio clock. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const S = HD.State;
  const T = (HD.Transport = { playing: false, pos: 0, segs: [], timer: null, schedTime: 0, cursor: 0, segStart: true, startBeat: 0 });
  const LOOKAHEAD = 0.16, TICK = 25;

  T.init = (engine) => { T.engine = engine; T.ctx = engine.ctx; };
  T.spb = () => 60 / S.project.bpm;

  T.play = async (from) => {
    if (T.playing) return;
    const ctx = T.ctx; if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) { /* noop */ } }
    if (from != null) T.pos = from;
    T.startBeat = T.pos; T.begin(T.pos); HD.bus.emit('transport', { playing: true });
  };
  T.begin = (beat) => {
    const e = T.engine; e.newSession(); e.playing = true; e.sync();
    T.playing = true; T.segs = []; T.cursor = beat; T.segStart = true; T.schedTime = T.ctx.currentTime + 0.07; T.bpmAt = S.project.bpm;
    HD.Lib.pin(S.usedSounds());
    clearInterval(T.timer); T.tick(); T.timer = setInterval(T.tick, TICK);
  };
  T.tick = () => {
    if (!T.playing) return;
    const p = S.project, e = T.engine, ctx = T.ctx, spb = 60 / p.bpm;
    if (p.bpm !== T.bpmAt) { T.reanchor(); return; }
    const horizon = ctx.currentTime + LOOKAHEAD;
    let guard = 0;
    while (T.schedTime < horizon && guard++ < 8) {
      const b0 = T.cursor; let b1 = b0 + (horizon - T.schedTime) / spb, wrap = false;
      const L = p.loop;
      if (L.on && L.e > L.s + 0.25 && b0 < L.e - 1e-6 && b1 >= L.e) { b1 = L.e; wrap = true; }
      if (b1 - b0 < 1e-6) { b1 = b0 + 1e-6; }
      const t0 = T.schedTime;
      e.scheduleRange(b0, b1, (b) => t0 + (b - b0) * spb, { segStart: T.segStart, cap: wrap ? b1 : Infinity, metro: p.metro });
      T.segs.push({ t0, b0, b1, spb });
      T.schedTime += (b1 - b0) * spb; T.cursor = b1; T.segStart = false;
      if (wrap) { T.cursor = L.s; T.segStart = true; }
    }
  };
  T.beat = () => {
    if (!T.playing) return T.pos;
    const now = T.ctx.currentTime - (T.ctx.outputLatency || 0), segs = T.segs;
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i];
      if (now >= s.t0) { if (i > 2) segs.splice(0, i - 2); return Math.min(s.b1, s.b0 + (now - s.t0) / s.spb); }
    }
    return T.startBeat;
  };
  T.reanchor = () => { const b = T.beat(); T.pos = b; T.startBeat = b; T.begin(b); };
  T.stop = (returnToStart = true) => {
    if (!T.playing) { T.pos = returnToStart ? (S.project.loop.on ? S.project.loop.s : 0) : T.pos; HD.bus.emit('transport', { playing: false }); return; }
    const b = T.beat();
    T.playing = false; clearInterval(T.timer); T.engine.playing = false; T.engine.newSession();
    T.pos = returnToStart ? T.startBeat : b;
    T.engine.sync(true);
    HD.bus.emit('transport', { playing: false });
  };
  T.toggle = () => (T.playing ? T.stop() : T.play());
  T.seek = (beat) => {
    beat = Math.max(0, beat);
    if (T.playing) { T.pos = beat; T.startBeat = beat; T.begin(beat); } else T.pos = beat;
    HD.bus.emit('transport', { seek: true });
  };
  T.pause = () => { if (T.playing) T.stop(false); };
})();
