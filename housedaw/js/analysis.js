/* HouseDAW — audio analysis: octave-ish band balance, loudness, crest, stereo and a rough tempo estimate.
   Used by the Reference A/B panel, the Auto-mix, and to keep AI edits from making the mix worse. Everything is local. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const An = (HD.Analyze = {});
  An.BANDS = [['sub', 20, 60], ['bass', 60, 150], ['lowmid', 150, 500], ['mid', 500, 2000], ['himid', 2000, 6000], ['air', 6000, 16000]];
  An.LABEL = { sub: 'Sub 20–60', bass: 'Bass 60–150', lowmid: 'Low-mid 150–500', mid: 'Mid 0.5–2k', himid: 'Hi-mid 2–6k', air: 'Air 6–16k' };

  // Typical balance of three reference house tracks, measured with this same analyser on their loudest stretches (dB vs total energy).
  An.TARGETS = {
    house: { sub: -7.5, bass: -6.2, lowmid: -10.9, mid: -17.4, himid: -19.6, air: -18, crest: 9.1, sideHi: -8.1, rms: -10.7 },
  };

  const cascade = (type, f, sr) => [new HD.Dsp.Biq(type, f, 0.7071, 0, sr), new HD.Dsp.Biq(type, f, 0.7071, 0, sr)];
  const run = (fs, x) => { for (const b of fs) x = b.p(x); return x; };

  // windows: array of [startSample, endSample]; defaults to up to 6 evenly spaced 3 s windows
  An.analyze = (buf, opts = {}) => {
    const sr = buf.sampleRate, L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L, n = buf.length;
    let wins = opts.windows;
    if (!wins && opts.loudest) { // use the loudest stretches (the drops) so quiet intros/breaks don't skew a reference profile
      const w = Math.floor(sr * (opts.winSec || 3)), cand = [];
      for (let a = 0; a + w <= n; a += w) { let q = 0; for (let i = a; i < a + w; i += 4) { const m = (L[i] + R[i]) * 0.5; q += m * m; } cand.push([a, q]); }
      cand.sort((x, y) => y[1] - x[1]); wins = cand.slice(0, opts.maxWins || 8).map(([a]) => [a, a + w]);
    }
    if (!wins) { const w = Math.min(n, Math.floor(sr * (opts.winSec || 3))), k = n <= w * 1.2 ? 1 : Math.min(opts.maxWins || 6, Math.floor(n / w)); wins = []; for (let i = 0; i < k; i++) { const a = Math.floor(((n - w) * (k === 1 ? 0 : i)) / Math.max(1, k - 1)); wins.push([a, a + w]); } }
    const e = {}, es = {}; let tot = 0, totSide = 0, pk = 0, sq = 0, cnt = 0;
    for (const [nm] of An.BANDS) { e[nm] = 0; es[nm] = 0; }
    for (const [a, z] of wins) {
      const filt = An.BANDS.map(([nm, lo, hi]) => ({ nm, hp: cascade('hp', lo, sr), lp: cascade('lp', hi, sr), hp2: cascade('hp', lo, sr), lp2: cascade('lp', hi, sr) }));
      for (let i = a; i < z; i++) {
        const m = (L[i] + R[i]) * 0.5, s = (L[i] - R[i]) * 0.5; tot += m * m; totSide += s * s; const lv = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (lv > pk) pk = lv; sq += m * m; cnt++;
        for (const f of filt) { const bm = run(f.lp, run(f.hp, m)), bs = run(f.lp2, run(f.hp2, s)); e[f.nm] += bm * bm; es[f.nm] += bs * bs; }
      }
    }
    const db = (x) => 10 * Math.log10(x + 1e-14), out = { bands: {}, side: {} };
    for (const [nm] of An.BANDS) { out.bands[nm] = db(e[nm] / (tot || 1)); out.side[nm] = db(es[nm] / (e[nm] || 1e-14)); }
    out.rms = db(sq / Math.max(1, cnt)); out.peak = 20 * Math.log10(pk + 1e-9); out.crest = out.peak - out.rms;
    // short-term crest (median of 1 s windows) is less sensitive to a single peak
    const cr = []; for (const [a, z] of wins) for (let i = a; i + sr <= z; i += sr) { let p = 0, q = 0; for (let j = i; j < i + sr; j += 2) { const m = (L[j] + R[j]) * 0.5; const v = Math.abs(m); if (v > p) p = v; q += m * m; } cr.push(20 * Math.log10(p + 1e-9) - db(q / (sr / 2))); }
    cr.sort((x, y) => x - y); out.crestMed = cr.length ? cr[Math.floor(cr.length / 2)] : out.crest;
    return out;
  };

  // distance of a balance to a target (mean absolute dB error over the six bands)
  An.distance = (a, t) => An.BANDS.reduce((s, [nm]) => s + Math.abs(a.bands[nm] - t[nm]), 0) / An.BANDS.length;

  // rough tempo estimate from low-band onsets (comb filter with phase search); good to ~0.5 BPM on 4-on-the-floor music
  An.tempo = (buf, lo = 100, hi = 150) => {
    const sr = buf.sampleRate, L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L, n = Math.min(buf.length, sr * 90), hop = 128;
    const hp = cascade('hp', 35, sr), lp = cascade('lp', 130, sr), nf = Math.floor(n / hop), env = new Float32Array(nf);
    for (let f = 0; f < nf; f++) { let s = 0; for (let i = 0; i < hop; i++) { const m = run(lp, run(hp, (L[f * hop + i] + R[f * hop + i]) * 0.5)); s += m * m; } env[f] = Math.sqrt(s / hop); }
    const o = new Float32Array(nf); let mx = 1e-9; for (let f = 1; f < nf; f++) { o[f] = Math.max(0, env[f] - env[f - 1]); if (o[f] > mx) mx = o[f]; } for (let f = 0; f < nf; f++) o[f] /= mx;
    const fps = sr / hop; let best = 0, bb = 0;
    for (let bpm = lo; bpm <= hi; bpm += 0.25) {
      const per = (60 / bpm) * fps, k = Math.floor(nf / per) - 2; if (k < 30) continue; let top = 0;
      for (let ph = 0; ph < per; ph += 1) { let s = 0; for (let b = 0; b < k; b++) { const idx = Math.round(ph + b * per); s += Math.max(o[idx], o[idx + 1] || 0, o[idx - 1] || 0); } if (s > top) top = s; }
      top /= k; if (top > best) { best = top; bb = bpm; }
    }
    return bb;
  };
})();
