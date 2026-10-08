/* HouseDAW — Auto-mix & level matching. Renders a few bars offline, measures band balance with HD.Analyze and nudges
   track levels toward a target profile (the built-in house profile, or the balance of a reference track you loaded). */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const S = HD.State, Lib = HD.Lib, An = HD.Analyze;
  const Mix = (HD.Mix = {});

  // what a track *is*, from its type / instrument / name
  Mix.role = (t) => {
    const n = t.name.toLowerCase();
    if (t.type === 'drum') return /kick/.test(n) ? 'kick' : /open/.test(n) ? 'open' : /clap|snare/.test(n) ? 'clap' : /hat/.test(n) ? 'hats' : 'perc';
    if (t.type === 'inst') {
      const it = (t.inst && Lib.byId[t.inst.presetId]) || {};
      if (it.cat === 'BASS' || /bass/.test(n)) return 'bass';
      if (it.sub === 'Vocal Chop' || /chop|vox|vocal/.test(n)) return 'lead';
      if (it.sub === 'Pad' || it.sub === 'Atmosphere' || /pad/.test(n)) return 'pad';
      if (it.sub === 'Lead' || it.sub === 'Arp' || /lead/.test(n)) return 'lead';
      return 'chords';
    }
    if (t.type === 'audio') return /fx/.test(n) ? 'fx' : 'audio';
    return 'bus';
  };

  // a representative stretch to analyse: first drop (or the loop / start), up to `bars` bars
  Mix.region = (P, bars = 6) => {
    const d = P.markers.find((m) => /drop|groove/i.test(m.name)), start = d ? d.beat : P.loop.on ? P.loop.s : 0, len = d ? Math.min(d.bars, bars) * 4 : Math.min(bars * 4, Math.max(8, S.endBeat ? 32 : 32));
    return [start, start + len];
  };

  Mix.measure = async (P, region, opts = {}) => {
    const [a, z] = region || Mix.region(P), buf = await HD.renderProject(P, { start: a, end: z, tail: 0.15 });
    return An.analyze(buf, { winSec: Math.min(4, buf.duration - 0.2), maxWins: 2, ...opts });
  };

  const clampVol = (v) => Math.max(0.04, Math.min(1.6, v));
  const gainDb = (t, db) => { t.vol = clampVol(t.vol * Math.pow(10, db / 20)); };

  // adjust track levels so the band balance approaches `target` (object keyed like An.BANDS). Returns a log of changes.
  Mix.autoMix = async (P, o = {}) => {
    const target = o.target || An.TARGETS.house, iters = o.iterations == null ? 3 : o.iterations, region = o.region || Mix.region(P, o.bars || 4), log = [];
    const by = (...rs) => P.tracks.filter((t) => rs.includes(Mix.role(t)));
    const before = P.tracks.map((t) => t.vol);
    let a = null, rms0 = null;
    for (let i = 0; i < iters; i++) {
      if (o.onProgress) o.onProgress(i / (iters + 1), 'Balancing mix… pass ' + (i + 1) + '/' + iters);
      a = await Mix.measure(P, region); if (rms0 == null) rms0 = o.holdRms != null ? o.holdRms : a.rms;
      if (An.distance(a, target) < 1.2) break; // already close enough
      const e = {}; for (const [k] of An.BANDS) e[k] = target[k] - a.bands[k];
      const damp = 0.75, cl = (x) => Math.max(-6, Math.min(6, x));
      by('kick').forEach((t) => gainDb(t, cl(damp * (e.sub - 0.25 * e.bass))));
      by('bass').forEach((t) => gainDb(t, cl(damp * (e.bass - 0.25 * e.sub + 0.15 * e.lowmid))));
      by('chords', 'pad', 'lead').forEach((t) => gainDb(t, cl(0.9 * (0.7 * e.lowmid + 0.3 * e.mid))));
      by('clap', 'perc').forEach((t) => gainDb(t, cl(damp * e.himid)));
      by('chords', 'lead').forEach((t) => gainDb(t, cl(damp * 0.4 * e.himid)));
      by('hats', 'open').forEach((t) => gainDb(t, cl(damp * (0.6 * e.air + 0.4 * e.himid))));
      by('fx').forEach((t) => gainDb(t, cl(damp * 0.3 * (e.air + e.himid) / 2)));
    }
    // final check + hold the overall loudness steady: rebalancing should change the *mix*, not just make it louder or quieter
    a = await Mix.measure(P, region);
    // loudness: hold the pre-edit level when asked (AI edits), otherwise settle on the reference-typical level so the limiter isn't over-worked.
    // (the master limiter/compressors make level changes non-linear, so measure and correct a couple of times)
    const want = o.holdRms != null ? o.holdRms : target.rms != null ? Math.max(-13, Math.min(-8.5, target.rms)) : rms0;
    if (want != null) for (let k = 0; k < 3; k++) { const err = want - a.rms; if (Math.abs(err) < 0.6) break; const trim = Math.max(-9, Math.min(9, err * (k === 0 ? 1.6 : 1.2))); P.tracks.forEach((t) => gainDb(t, trim)); a = await Mix.measure(P, region); }
    P.tracks.forEach((t, i) => { const d = 20 * Math.log10(t.vol / before[i]); if (Math.abs(d) >= 0.5) log.push(`${t.name} ${d > 0 ? '+' : ''}${d.toFixed(1)} dB`); });
    return { log, analysis: a, distance: An.distance(a, target) };
  };

  // loudness match: returns dB trim to apply on master volume so `after` plays as loud as `before` (limited to ±6 dB)
  Mix.matchTrimDb = (before, after) => Math.max(-6, Math.min(6, before.rms - after.rms));

  // ---- reference tracks: analyse a loaded reference once, then steer the mix toward its balance ----
  HD.Ref = {
    current: null,
    // buf: decoded AudioBuffer of the reference. Stores a compact profile (no audio is kept in the project).
    set(name, buf) {
      const a = An.analyze(buf, { loudest: true, maxWins: 8, winSec: 3 }), t = {}; An.BANDS.forEach(([k]) => (t[k] = a.bands[k]));
      HD.Ref.current = { name, buf, profile: { ...t, crest: a.crestMed, sideHi: a.side.himid, rms: a.rms }, rms: a.rms, crest: a.crestMed, side: a.side, tempo: An.tempo(buf, 100, 150), dur: buf.duration };
      return HD.Ref.current;
    },
  };
})();
