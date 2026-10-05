/* HouseDAW — procedural sample synthesis (pure JS, no AudioContext needed).
   Every sound in the starter library is a small JSON "spec" rendered here into real stereo audio,
   deterministically (same spec + sample rate => same samples). */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const D = (HD.Dsp = {});
  const TAU = Math.PI * 2, PI = Math.PI;
  const exp = Math.exp, sin = Math.sin, abs = Math.abs, pow = Math.pow, tanh = Math.tanh;
  const mk = (n) => new Float32Array(n);

  // ---------- filters ----------
  class Biq {
    constructor(type, f, q, g, sr) { this.set(type, f, q, g, sr); this.x1 = this.x2 = this.y1 = this.y2 = 0; }
    set(type, f, q = 0.707, g = 0, sr = 44100) {
      f = Math.max(10, Math.min(f, sr * 0.45));
      const w = (TAU * f) / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q), A = pow(10, g / 40), sA = 2 * Math.sqrt(A) * al;
      let b0, b1, b2, a0, a1, a2;
      switch (type) {
        case 'hp': b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; break;
        case 'bp': b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; break;
        case 'peak': b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; break;
        case 'ls': b0 = A * (A + 1 - (A - 1) * c + sA); b1 = 2 * A * (A - 1 - (A + 1) * c); b2 = A * (A + 1 - (A - 1) * c - sA); a0 = A + 1 + (A - 1) * c + sA; a1 = -2 * (A - 1 + (A + 1) * c); a2 = A + 1 + (A - 1) * c - sA; break;
        case 'hs': b0 = A * (A + 1 + (A - 1) * c + sA); b1 = -2 * A * (A - 1 + (A + 1) * c); b2 = A * (A + 1 + (A - 1) * c - sA); a0 = A + 1 - (A - 1) * c + sA; a1 = 2 * (A - 1 - (A + 1) * c); a2 = A + 1 - (A - 1) * c - sA; break;
        default: b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; // lp
      }
      this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    }
    p(x) {
      const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
      this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y;
    }
  }
  D.Biq = Biq;
  D.filt = (a, type, f, q, g, sr) => { const b = new Biq(type, f, q, g, sr); for (let i = 0; i < a.length; i++) a[i] = b.p(a[i]); return a; };

  // zero-delay-feedback state-variable filter, cutoff can change every sample
  class SVF {
    constructor(sr) { this.sr = sr; this.s1 = 0; this.s2 = 0; this.lp = 0; this.bp = 0; this.hp = 0; }
    p(x, fc, q) {
      fc = Math.min(Math.max(fc, 20), this.sr * 0.45);
      const g = Math.tan((PI * fc) / this.sr), k = 1 / q, a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
      const v3 = x - this.s2, v1 = a1 * this.s1 + a2 * v3, v2 = this.s2 + a2 * this.s1 + a3 * v3;
      this.s1 = 2 * v1 - this.s1; this.s2 = 2 * v2 - this.s2;
      this.lp = v2; this.bp = v1 * k; this.hp = x - k * v1 - v2; // bp normalised to unity peak gain
      return this.lp;
    }
  }
  D.SVF = SVF;

  // ---------- helpers ----------
  D.noise = (n, r) => { const a = mk(n); for (let i = 0; i < n; i++) a[i] = r() * 2 - 1; return a; };
  D.sat = (a, drive) => { const k = Math.max(0.001, drive), d = tanh(k); for (let i = 0; i < a.length; i++) a[i] = tanh(a[i] * k) / d; return a; };
  D.peak = (...chs) => { let m = 0; for (const c of chs) for (let i = 0; i < c.length; i++) { const v = abs(c[i]); if (v > m) m = v; } return m; };
  D.norm = (L, R, db) => {
    const pk = D.peak(L, R); if (pk < 1e-9) return;
    const g = pow(10, db / 20) / pk;
    for (let i = 0; i < L.length; i++) { L[i] *= g; R[i] *= g; }
  };
  D.fadeOut = (a, n) => { n = Math.min(n, a.length); for (let i = 0; i < n; i++) a[a.length - 1 - i] *= 0.5 - 0.5 * Math.cos((PI * i) / n); };
  D.fadeIn = (a, n) => { n = Math.min(n, a.length); for (let i = 0; i < n; i++) a[i] *= 0.5 - 0.5 * Math.cos((PI * i) / n); };
  D.reverse = (a) => a.reverse();
  D.addInto = (dst, src, gain = 1, off = 0) => { for (let i = 0; i < src.length && i + off < dst.length; i++) if (i + off >= 0) dst[i + off] += src[i] * gain; };
  // mono -> stereo using a short Haas delay (highs only should be passed here)
  D.widen = (M, sr, st, r) => {
    const L = Float32Array.from(M), R = mk(M.length);
    const d = Math.max(0, Math.floor(sr * 0.00025 * (1 + st * 5)));
    for (let i = 0; i < M.length; i++) R[i] = i >= d ? M[i - d] * (1 - 0.15 * st) : 0;
    return [L, R];
  };
  // compact Schroeder/Moorer room: 6 damped combs + 2 allpasses per channel
  D.verb = (L, R, sr, o = {}) => {
    const decay = o.decay || 1.2, mix = o.mix == null ? 0.25 : o.mix, size = o.size || 1, damp = o.damp == null ? 0.4 : o.damp;
    const n = L.length, base = [0.0297, 0.0371, 0.0411, 0.0437, 0.0503, 0.0571];
    const outs = [L, R].map((src, ch) => {
      const inp = mk(n); for (let i = 0; i < n; i++) inp[i] = (L[i] + R[i]) * 0.5;
      const wet = mk(n);
      base.forEach((b, j) => {
        const d = Math.max(8, Math.floor(b * size * sr) + ch * 23 + j * 3), buf = mk(d), g = pow(10, (-3 * d) / sr / decay);
        let ptr = 0, lp = 0;
        for (let i = 0; i < n; i++) {
          const y = buf[ptr]; lp = y * (1 - damp) + lp * damp;
          buf[ptr] = inp[i] + lp * g; if (++ptr >= d) ptr = 0;
          wet[i] += y * 0.28;
        }
      });
      for (const [ms, g] of [[5.0, 0.5], [1.7, 0.5]]) {
        const d = Math.floor((ms / 1000) * sr) + ch * 3, buf = mk(d); let ptr = 0;
        for (let i = 0; i < n; i++) { const bo = buf[ptr], x = wet[i] - g * bo; buf[ptr] = x; wet[i] = bo + g * x; if (++ptr >= d) ptr = 0; }
      }
      const out = mk(n); for (let i = 0; i < n; i++) out[i] = src[i] + wet[i] * mix; return out;
    });
    L.set(outs[0]); R.set(outs[1]);
  };
  const lenSamples = (sr, s) => Math.max(8, Math.ceil(sr * s));

  // ---------- drums ----------
  const K = (D.kinds = {});

  K.kick = (p, sr) => {
    const len = p.len || Math.min(2.2, Math.max(0.14, Math.max(p.dec, p.subDec || 0) * 5)), n = lenSamples(sr, len), L = mk(n);
    let ph = 0, phs = 0, phc = 0, seed = 12345;
    const bpk = new Biq('bp', p.ckF || 3200, 0.9, 0, sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const f = p.f1 + (p.f0 - p.f1) * exp(-t / p.pt);
      ph += (TAU * f) / sr;
      const a = p.att > 0 ? Math.min(1, t / p.att) : 1;
      let x = sin(ph) * exp(-t / p.dec) * a * (p.body == null ? 1 : p.body);
      const fs = p.f1 * (1 + 0.12 * exp(-t / 0.045));
      phs += (TAU * fs) / sr;
      x += sin(phs) * exp(-t / (p.subDec || p.dec * 1.2)) * (1 - exp(-t / 0.0015)) * (p.sub || 0);
      if (p.click) {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        const nz = bpk.p(((seed >>> 8) / 8388608 - 1));
        phc += (TAU * (p.ckF || 3200) * (1 + 1.5 * exp(-t / 0.002))) / sr;
        x += (nz * 0.9 + sin(phc) * 0.5) * exp(-t / (p.ckDec || 0.0028)) * p.click;
      }
      L[i] = x;
    }
    if (p.drive) D.sat(L, 1 + p.drive * 7);
    D.filt(L, 'lp', p.tone || 14000, 0.7, 0, sr);
    D.filt(L, 'hp', 24, 0.7, 0, sr);
    D.fadeOut(L, Math.floor(sr * 0.008));
    return [L, Float32Array.from(L)];
  };

  K.clap = (p, sr, r) => {
    const len = p.len || Math.min(1.5, (p.nb || 4) * (p.sp || 0.011) + (p.tail || 0.12) * 5 + 0.05), n = lenSamples(sr, len);
    const nb = p.nb || 4, sp = p.sp || 0.011, tail = p.tail || 0.12, tl = p.tailLvl == null ? 0.5 : p.tailLvl, st = p.st == null ? 0.8 : p.st;
    const n1 = D.noise(n, r), n2 = D.noise(n, r), chans = [mk(n), mk(n)];
    for (let c = 0; c < 2; c++) {
      const src = c ? n2 : n1, o = chans[c];
      for (let i = 0; i < n; i++) {
        const t = i / sr; let e = 0;
        for (let k = 0; k < nb; k++) { const tt = t - k * sp * (1 + (c ? 0.04 * st : 0)); if (tt >= 0) e += exp(-tt / (k === nb - 1 ? 0.006 : 0.0032)) * (k === nb - 1 ? 1.1 : 0.9); }
        const tt = t - (nb - 1) * sp; if (tt >= 0) e += exp(-tt / tail) * tl;
        const nz = src[i] * (1 - st * 0.5) + (c ? n1 : n2)[i] * st * 0.0 + src[i] * st * 0.5;
        o[i] = nz * e;
      }
      D.filt(o, 'bp', p.fc || 1500, p.q || 0.9, 0, sr);
      D.filt(o, 'hp', 450, 0.7, 0, sr);
      if (p.drive) D.sat(o, 1 + p.drive * 3);
    }
    if (p.room) D.verb(chans[0], chans[1], sr, { decay: 0.35 + p.room * 0.5, mix: p.room * 0.55, size: 0.6, damp: 0.5 });
    D.fadeOut(chans[0], Math.floor(sr * 0.01)); D.fadeOut(chans[1], Math.floor(sr * 0.01));
    return chans;
  };

  K.snare = (p, sr, r) => {
    const len = p.len || Math.min(1.2, Math.max(p.nd, p.td) * 5 + 0.05), n = lenSamples(sr, len);
    const L = mk(n), nz = D.noise(n, r), nz2 = D.noise(n, r), R = mk(n);
    D.filt(nz, 'hp', p.hp || 1800, 0.7, 0, sr); D.filt(nz2, 'hp', p.hp || 1800, 0.7, 0, sr);
    let ph = 0, ph2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, f = p.f * (1 + (p.drop == null ? 0.7 : p.drop) * exp(-t / 0.012));
      ph += (TAU * f) / sr; ph2 += (TAU * f * 1.62) / sr;
      const tone = (sin(ph) + 0.4 * sin(ph2)) * exp(-t / p.td) * (p.tone == null ? 0.9 : p.tone);
      const e = exp(-t / p.nd) * (p.snap == null ? 0.8 : p.snap), a = Math.min(1, t / 0.0004);
      L[i] = (tone + nz[i] * e) * a; R[i] = (tone + (nz[i] * 0.5 + nz2[i] * 0.5) * e) * a;
    }
    for (const c of [L, R]) { if (p.drive) D.sat(c, 1 + p.drive * 4); D.filt(c, 'hp', 120, 0.7, 0, sr); D.filt(c, 'lp', p.lp || 14000, 0.7, 0, sr); }
    if (p.room) D.verb(L, R, sr, { decay: 0.3 + p.room * 0.4, mix: p.room * 0.5, size: 0.5, damp: 0.5 });
    D.fadeOut(L, Math.floor(sr * 0.01)); D.fadeOut(R, Math.floor(sr * 0.01));
    return [L, R];
  };

  const METAL = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];
  K.hat = (p, sr, r) => {
    const n = lenSamples(sr, p.len || Math.min(2, p.dec * 6 + 0.02)), M = mk(n);
    const ph = METAL.map(() => r()), inc = METAL.map((f) => (f * (p.ts || 1) * (1 + (r() - 0.5) * 0.03)) / sr);
    const nz = D.noise(n, r), mt = p.metal == null ? 0.6 : p.metal, nzl = p.noise == null ? 0.5 : p.noise;
    for (let i = 0; i < n; i++) {
      let m = 0; for (let k = 0; k < 6; k++) { ph[k] += inc[k]; if (ph[k] > 1) ph[k] -= 1; m += ph[k] < 0.5 ? 1 : -1; }
      const t = i / sr, e = Math.min(1, t / 0.0005) * (0.82 * exp(-t / p.dec) + 0.18 * exp(-t / (p.dec * 3.2)));
      M[i] = (m * 0.16 * mt + nz[i] * nzl) * e;
    }
    D.filt(M, 'bp', 9500 * (p.ts || 1), 0.55, 0, sr);
    D.filt(M, 'hp', p.hp || 7000, 0.8, 0, sr);
    D.filt(M, 'lp', 17000, 0.7, 0, sr);
    if (p.bright) D.filt(M, 'hs', 10000, 0.7, p.bright, sr);
    D.fadeOut(M, Math.floor(sr * (p.dec > 0.1 ? 0.02 : 0.004)));
    return D.widen(M, sr, p.st == null ? 0.5 : p.st, r);
  };

  K.crash = (p, sr, r) => {
    const n = lenSamples(sr, p.len), L = D.noise(n, r), R = D.noise(n, r);
    const ts = p.ts || 1, ph = [], inc = [];
    for (let k = 0; k < 8; k++) { ph.push(r()); inc.push((300 * ts * [1, 1.47, 1.93, 2.43, 2.97, 3.52, 4.1, 4.7][k]) / sr); }
    const m = p.metal == null ? 0.35 : p.metal;
    for (let i = 0; i < n; i++) {
      let mm = 0; for (let k = 0; k < 8; k++) { ph[k] += inc[k]; if (ph[k] > 1) ph[k] -= 1; mm += ph[k] < 0.5 ? 1 : -1; }
      const t = i / sr, e = (1 - exp(-t / (p.att || 0.004))) * (0.55 * exp(-t / (p.dec * 0.3)) + 0.45 * exp(-t / p.dec));
      L[i] = (L[i] * (1 - m) + mm * 0.1 * m) * e; R[i] = (R[i] * (1 - m) + mm * 0.1 * m * 0.9) * e;
    }
    for (const c of [L, R]) { D.filt(c, 'hp', p.hp || 3800, 0.7, 0, sr); D.filt(c, 'lp', p.lp || 15500, 0.7, 0, sr); if (p.bright) D.filt(c, 'hs', 8000, 0.7, p.bright, sr); D.fadeOut(c, Math.floor(sr * 0.03)); }
    return [L, R];
  };

  // percussion family: shaker, rim, tom, conga, bongo, click, metal, cowbell, nhit, wood
  K.perc = (p, sr, r) => {
    const type = p.type, n = lenSamples(sr, p.len || Math.min(1.5, p.dec * 6 + 0.03)), L = mk(n);
    const nz = D.noise(n, r);
    if (type === 'shaker') {
      const att = p.att || 0.01;
      for (let i = 0; i < n; i++) { const t = i / sr; L[i] = nz[i] * Math.min(1, pow(t / att, 1.5)) * exp(-t / p.dec); }
      D.filt(L, 'bp', p.fc || 6500, p.q || 1, 0, sr); D.filt(L, 'hp', 2500, 0.7, 0, sr);
    } else if (type === 'rim') {
      let a = 0, b = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr; a += (TAU * p.f * (1 + 0.05 * exp(-t / 0.004))) / sr; b += (TAU * p.f * (p.ratio || 1.83)) / sr;
        L[i] = (sin(a) * 0.7 + sin(b) * 0.5) * exp(-t / p.dec) + nz[i] * exp(-t / 0.0015) * (p.click == null ? 0.5 : p.click);
      }
      D.filt(L, 'bp', p.f * 1.4, 0.6, 0, sr); D.filt(L, 'hp', 300, 0.7, 0, sr);
    } else if (type === 'tom' || type === 'conga' || type === 'bongo') {
      const drop = p.drop == null ? (type === 'tom' ? 0.9 : 0.25) : p.drop, pt = type === 'tom' ? 0.03 : 0.012;
      let a = 0, b = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr; a += (TAU * p.f * (1 + drop * exp(-t / pt))) / sr; b += (TAU * p.f * (type === 'tom' ? 1.58 : 2.4) * (1 + drop * 0.5 * exp(-t / pt))) / sr;
        L[i] = (sin(a) + (p.over == null ? 0.25 : p.over) * sin(b) * exp(-t / (p.dec * 0.4))) * exp(-t / p.dec) + nz[i] * exp(-t / (type === 'tom' ? 0.004 : 0.005)) * (p.slap == null ? 0.35 : p.slap);
      }
      D.filt(L, 'hp', 60, 0.7, 0, sr); D.filt(L, 'lp', p.lp || 7000, 0.7, 0, sr);
    } else if (type === 'click') {
      let a = 0;
      for (let i = 0; i < n; i++) { const t = i / sr; a += (TAU * p.f) / sr; L[i] = (sin(a) * 0.8 + nz[i] * (p.noise == null ? 0.3 : p.noise)) * exp(-t / p.dec); }
      D.filt(L, 'hp', 800, 0.7, 0, sr);
    } else if (type === 'metal' || type === 'cowbell') {
      let a = 0, b = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        if (type === 'cowbell') { a += (TAU * p.f) / sr; b += (TAU * p.f * 1.4815) / sr; L[i] = ((sin(a) > 0 ? 1 : -1) * 0.5 + (sin(b) > 0 ? 1 : -1) * 0.5) * (0.7 * exp(-t / (p.dec * 0.25)) + 0.3 * exp(-t / p.dec)); }
        else { const idx = (p.idx || 4) * exp(-t / (p.dec * 0.6)); a += (TAU * p.f) / sr; b += (TAU * p.f * (p.ratio || 1.41)) / sr; L[i] = sin(a + idx * sin(b)) * exp(-t / p.dec); }
      }
      if (type === 'cowbell') D.filt(L, 'bp', p.f * 1.6, 1.2, 0, sr);
      D.filt(L, 'hp', 350, 0.7, 0, sr); D.filt(L, 'lp', 12000, 0.7, 0, sr);
    } else if (type === 'wood') {
      let a = 0;
      for (let i = 0; i < n; i++) { const t = i / sr; a += (TAU * p.f * (1 + 0.15 * exp(-t / 0.008))) / sr; L[i] = sin(a) * exp(-t / p.dec) + nz[i] * exp(-t / 0.001) * 0.4; }
      D.filt(L, 'bp', p.f * 1.2, 1.5, 0, sr);
    } else { // nhit: short noise hit
      for (let i = 0; i < n; i++) { const t = i / sr; L[i] = nz[i] * exp(-t / p.dec) * Math.min(1, t / 0.0006); }
      const sv = new SVF(sr);
      for (let i = 0; i < n; i++) { const t = i / sr; sv.p(L[i], (p.fc || 4000) * (1 + (p.sweep || 0) * (t / (p.dec * 4))), p.q || 2.5); L[i] = sv.bp * 2; }
    }
    D.fadeOut(L, Math.floor(sr * 0.006));
    if (p.drive) D.sat(L, 1 + p.drive * 3);
    return p.st ? D.widen(L, sr, p.st, r) : [L, Float32Array.from(L)];
  };

  // ---------- FX ----------
  K.riser = (p, sr, r) => {
    const n = lenSamples(sr, p.len), L = mk(n), R = mk(n), sL = new SVF(sr), sR = new SVF(sr), tL = new SVF(sr), tR = new SVF(sr);
    const type = p.type || 'noise', f0 = p.f0 || 250, f1 = p.f1 || 9000, shape = p.shape || 1.6, curve = p.curve || 2, q = p.q || 2, st = p.st == null ? 0.7 : p.st;
    let tph = 0, gph = 0, gs = 0;
    for (let i = 0; i < n; i++) {
      const u = i / n, t = i / sr, sw = pow(u, shape), fc = f0 * pow(f1 / f0, sw), amp = pow(u, curve) * 0.95 + 0.02;
      const pan = sin(TAU * (p.panRate || 0.3) * t) * st, gl = 0.5 - 0.5 * pan, gr = 0.5 + 0.5 * pan;
      let x = r() * 2 - 1, y = r() * 2 - 1;
      if (type === 'noise' || type === 'tone') { sL.p(x, fc, q); sR.p(y, fc, q); x = sL.bp; y = sR.bp; }
      if (type === 'tone' || type === 'pitch') {
        const tf = (p.tf0 || 110) * pow((p.tf1 || 880) / (p.tf0 || 110), sw);
        tph += tf / sr; if (tph > 1) tph -= 1; const saw = tph * 2 - 1;
        tL.p(saw, fc * 1.5, 1.2); const tone = tL.lp;
        if (type === 'pitch') { const sub = sin(TAU * tph) * 0.6 + sin(TAU * tph * 2) * 0.3; x = tone * 0.7 + sub * 0.5 + x * 0.02; y = x; }
        else { x = x * (1 - (p.tone || 0.4)) + tone * (p.tone || 0.4) * 1.2; y = y * (1 - (p.tone || 0.4)) + tone * (p.tone || 0.4) * 1.2; }
      }
      if (type === 'gate') {
        const rate = (p.r0 || 3) + ((p.r1 || 30) - (p.r0 || 3)) * u * u;
        gph += rate / sr; const g = gph % 1 < (p.duty || 0.5) ? 1 : 0; gs += (g - gs) * 0.06;
        sL.p(x, fc, q); sR.p(y, fc, q); x = sL.bp * gs; y = sR.bp * gs;
      }
      L[i] = x * amp * (0.5 + gl); R[i] = y * amp * (0.5 + gr);
    }
    if (p.reverse) { L.reverse(); R.reverse(); }
    D.fadeOut(L, Math.floor(sr * 0.004)); D.fadeOut(R, Math.floor(sr * 0.004)); D.fadeIn(L, 8); D.fadeIn(R, 8);
    for (const c of [L, R]) D.filt(c, 'hp', 120, 0.7, 0, sr);
    return [L, R];
  };

  K.impact = (p, sr, r) => {
    const n = lenSamples(sr, p.len), L = mk(n), R = mk(n), nz = D.noise(n, r), nz2 = D.noise(n, r);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr; ph += (TAU * (p.f1 + (p.f0 - p.f1) * exp(-t / (p.pt || 0.18)))) / sr;
      const sub = sin(ph) * exp(-t / p.dec) * (1 - exp(-t / 0.002));
      const crack = exp(-t / (p.cd || 0.09)) * (p.noise == null ? 0.7 : p.noise);
      L[i] = sub + nz[i] * crack; R[i] = sub + nz2[i] * crack;
    }
    for (const c of [L, R]) { D.filt(c, 'lp', p.lp || 5500, 0.7, 0, sr); D.filt(c, 'hp', 22, 0.7, 0, sr); if (p.drive) D.sat(c, 1 + p.drive * 3); }
    D.verb(L, R, sr, { decay: p.verb || 1.5, mix: p.vmix == null ? 0.6 : p.vmix, size: 1.4, damp: 0.5 });
    D.fadeOut(L, Math.floor(sr * 0.05)); D.fadeOut(R, Math.floor(sr * 0.05));
    return [L, R];
  };

  K.sweep = (p, sr, r) => {
    const n = lenSamples(sr, p.len), L = mk(n), R = mk(n), sL = new SVF(sr), sR = new SVF(sr), dir = p.dir || 'up';
    for (let i = 0; i < n; i++) {
      const u = i / n, t = i / sr, s = dir === 'up' ? u : dir === 'down' ? 1 - u : sin(PI * u);
      const fc = p.f0 * pow(p.f1 / p.f0, s), env = pow(sin(PI * Math.min(1, u * (p.skew || 1))), p.bell || 1.2);
      const pan = sin(TAU * (p.panRate || 0.5) * t) * (p.st == null ? 0.6 : p.st);
      sL.p(r() * 2 - 1, fc, p.q || 5); sR.p(r() * 2 - 1, fc * 1.02, p.q || 5);
      L[i] = sL.bp * env * (0.6 - 0.4 * pan); R[i] = sR.bp * env * (0.6 + 0.4 * pan);
    }
    if (p.verb) D.verb(L, R, sr, { decay: p.verb, mix: 0.35, size: 1, damp: 0.5 });
    D.fadeOut(L, Math.floor(sr * 0.01)); D.fadeOut(R, Math.floor(sr * 0.01));
    return [L, R];
  };

  K.drop = (p, sr, r) => {
    const n = lenSamples(sr, p.len), L = mk(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, u = t / p.len, f = p.f1 + (p.f0 - p.f1) * exp(-u * (p.k || 5));
      ph += (TAU * f) / sr; L[i] = sin(ph) * (1 - exp(-t / 0.004)) * exp(-t / (p.dec || p.len * 0.5));
    }
    if (p.drive) D.sat(L, 1 + p.drive * 4);
    D.filt(L, 'hp', 20, 0.7, 0, sr); D.fadeOut(L, Math.floor(sr * 0.03));
    const R = Float32Array.from(L);
    if (p.noise) { const nz = D.noise(n, r), nz2 = D.noise(n, r); D.filt(nz, 'bp', 2500, 1, 0, sr); D.filt(nz2, 'bp', 2500, 1, 0, sr); for (let i = 0; i < n; i++) { const e = exp(-(i / sr) / 0.12) * p.noise; L[i] += nz[i] * e; R[i] += nz2[i] * e; } }
    return [L, R];
  };

  K.whoosh = (p, sr, r) => K.sweep({ q: 1.6, bell: 1.8, skew: 1, st: 0.8, ...p }, sr, r);

  K.zap = (p, sr, r) => {
    const n = lenSamples(sr, p.len), L = mk(n); let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, u = t / p.len, f = p.f1 + (p.f0 - p.f1) * exp(-u * (p.k || 6));
      ph += f / sr; const s = p.wave === 'saw' ? (ph % 1) * 2 - 1 : p.wave === 'square' ? ((ph % 1) < 0.5 ? 1 : -1) : sin(TAU * ph);
      L[i] = s * exp(-t / p.dec) * Math.min(1, t / 0.001);
    }
    D.filt(L, 'lp', p.lp || 9000, 1.2, 0, sr); D.filt(L, 'hp', 150, 0.7, 0, sr);
    const R = Float32Array.from(L); if (p.verb) D.verb(L, R, sr, { decay: p.verb, mix: 0.4, size: 0.8, damp: 0.5 });
    D.fadeOut(L, Math.floor(sr * 0.01)); D.fadeOut(R, Math.floor(sr * 0.01));
    return [L, R];
  };

  K.synhit = (p, sr, r) => {
    const n = lenSamples(sr, p.len), L = mk(n), R = mk(n), iv = p.chord || [0, 7, 12], voices = [];
    for (const semi of iv) for (let u = 0; u < 3; u++) voices.push({ inc: (p.f * pow(2, semi / 12) * pow(2, ((u - 1) * (p.det || 12)) / 1200)) / sr, ph: r(), pan: (u - 1) * 0.6 });
    const sL = new SVF(sr), sR = new SVF(sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr; let l = 0, rr = 0;
      for (const v of voices) { v.ph += v.inc; if (v.ph > 1) v.ph -= 1; const s = v.ph * 2 - 1; l += s * (0.5 - 0.5 * v.pan); rr += s * (0.5 + 0.5 * v.pan); }
      const fc = p.fc1 + (p.fc0 - p.fc1) * exp(-t / (p.fd || 0.12)), e = exp(-t / p.dec) * Math.min(1, t / 0.002);
      sL.p(l / voices.length, fc, 1.1); sR.p(rr / voices.length, fc, 1.1); L[i] = sL.lp * e; R[i] = sR.lp * e;
    }
    D.verb(L, R, sr, { decay: p.verb || 1.3, mix: 0.4, size: 1, damp: 0.5 });
    D.fadeOut(L, Math.floor(sr * 0.03)); D.fadeOut(R, Math.floor(sr * 0.03));
    return [L, R];
  };

  K.atmos = (p, sr, r) => {
    const n = lenSamples(sr, p.len), L = mk(n), R = mk(n), type = p.type;
    if (type === 'crackle') {
      const rate = p.rate || 60;
      for (let i = 0; i < n; i++) {
        if (r() < rate / sr) { const a = (r() * 2 - 1) * (r() < 0.1 ? 1 : 0.35); L[i] += a; R[i] += (r() < 0.5 ? a : -a * 0.5); }
        if (r() < rate * 4 / sr) { L[i] += (r() * 2 - 1) * 0.04; R[i] += (r() * 2 - 1) * 0.04; }
      }
      D.filt(L, 'hp', 900, 0.7, 0, sr); D.filt(R, 'hp', 900, 0.7, 0, sr); D.filt(L, 'lp', 9000, 0.7, 0, sr); D.filt(R, 'lp', 9000, 0.7, 0, sr);
    } else if (type === 'drone') {
      const ph = [], inc = [];
      for (let k = 0; k < 6; k++) { ph.push(r()); inc.push((p.f * pow(2, [0, 0, 7, 12, 12, 19][k] / 12) * pow(2, ((k % 2 ? 1 : -1) * (6 + k * 3)) / 1200)) / sr); }
      const sL = new SVF(sr), sR = new SVF(sr);
      for (let i = 0; i < n; i++) {
        const t = i / sr; let l = 0, rr = 0;
        for (let k = 0; k < 6; k++) { ph[k] += inc[k]; if (ph[k] > 1) ph[k] -= 1; const s = ph[k] * 2 - 1; if (k % 2) rr += s; else l += s; }
        const fc = (p.fc || 700) * (1 + 0.6 * sin(TAU * (p.lfo || 0.13) * t));
        sL.p(l / 3, fc, 0.9); sR.p(rr / 3, fc * 1.05, 0.9); L[i] = sL.lp; R[i] = sR.lp;
      }
    } else if (type === 'shimmer') {
      const base = p.f || 880, ph = [], inc = [];
      for (let k = 0; k < 8; k++) { ph.push(r()); inc.push(base * [1, 1.5, 2, 2.5, 3, 4, 5, 6][k] * (1 + (r() - 0.5) * 0.004) / sr); }
      for (let i = 0; i < n; i++) {
        const t = i / sr; let l = 0, rr = 0;
        for (let k = 0; k < 8; k++) { ph[k] += inc[k]; const trem = 0.5 + 0.5 * sin(TAU * (0.07 + k * 0.031) * t + k); const s = sin(TAU * ph[k]) * trem / (1 + k * 0.4); if (k % 2) l += s; else rr += s; }
        L[i] = l * 0.3; R[i] = rr * 0.3;
      }
    } else { // noise wash / wind
      const sL = new SVF(sr), sR = new SVF(sr);
      for (let i = 0; i < n; i++) {
        const t = i / sr, fc1 = (p.fc || 900) * (1 + 0.7 * sin(TAU * (p.lfo || 0.11) * t)), fc2 = (p.fc || 900) * (1 + 0.7 * sin(TAU * (p.lfo || 0.11) * 1.3 * t + 1));
        sL.p(r() * 2 - 1, fc1, p.q || 1.2); sR.p(r() * 2 - 1, fc2, p.q || 1.2);
        const g = 0.7 + 0.3 * sin(TAU * 0.09 * t); L[i] = (type === 'wind' ? sL.lp : sL.bp) * g; R[i] = (type === 'wind' ? sR.lp : sR.bp) * g;
      }
    }
    if (p.verb) D.verb(L, R, sr, { decay: p.verb, mix: 0.4, size: 1.3, damp: 0.6 });
    const fi = Math.floor(sr * Math.min(2, p.len * 0.3));
    D.fadeIn(L, fi); D.fadeIn(R, fi); D.fadeOut(L, fi); D.fadeOut(R, fi);
    return [L, R];
  };

  K.reverse = (p, sr, r) => {
    const src = D.render(p.src, sr, true), L = src.L, R = src.R;
    // add a reverb wash so the reverse swell has body
    if (p.verb) { D.verb(L, R, sr, { decay: p.verb, mix: 0.8, size: 1.3, damp: 0.5 }); }
    let keep = L.length; const lim = Math.floor(sr * p.len);
    if (lim < keep) keep = lim;
    const oL = mk(keep), oR = mk(keep);
    for (let i = 0; i < keep; i++) { oL[i] = L[keep - 1 - i]; oR[i] = R[keep - 1 - i]; }
    D.fadeIn(oL, 16); D.fadeIn(oR, 16);
    return [oL, oR];
  };

  // ---------- vocal-like (formant) synthesis ----------
  const VOW = { a: [800, 1150, 2900], e: [400, 1600, 2700], i: [350, 1700, 2700], o: [450, 800, 2830], u: [325, 700, 2530], ae: [660, 1720, 2410] };
  K.vox = (p, sr, r) => {
    const n = lenSamples(sr, p.len), L = mk(n), R = mk(n), v1 = VOW[p.v1 || 'a'], v2 = VOW[p.v2 || p.v1 || 'a'];
    const fs = [0, 1, 2].map(() => [new SVF(sr), new SVF(sr)]), gains = [1, 0.55, 0.3], qs = [7, 9, 12];
    let ph = 0, ph2 = 0, vib = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, u = t / p.len;
      vib += (TAU * 5.4) / sr; const f = p.f * (1 + (p.vib || 0.008) * sin(vib) * Math.min(1, t / 0.2)) * (1 + (p.glide || 0) * (1 - u));
      ph += f / sr; if (ph > 1) ph -= 1; ph2 += (f * 1.004) / sr; if (ph2 > 1) ph2 -= 1;
      const glot1 = (ph * 2 - 1) - (ph < 0.5 ? 0 : 0), glot2 = ph2 * 2 - 1;
      const br = (p.breath == null ? 0.12 : p.breath) * (r() * 2 - 1), gl = glot1 * (1 - (p.whisper || 0)) + br, gr = glot2 * (1 - (p.whisper || 0)) + br;
      const mixu = Math.min(1, u * (p.morph == null ? 1.5 : p.morph));
      let l = 0, rr = 0;
      for (let k = 0; k < 3; k++) {
        const fc = v1[k] + (v2[k] - v1[k]) * mixu;
        fs[k][0].p(gl, fc, qs[k]); fs[k][1].p(gr, fc, qs[k]);
        l += fs[k][0].bp * gains[k]; rr += fs[k][1].bp * gains[k];
      }
      const a = Math.min(1, t / (p.att || 0.012)), e = a * (p.sus ? Math.min(1, (p.len - t) / (p.rel || 0.15)) : exp(-t / (p.dec || 0.18)));
      const cons = p.hard ? (r() * 2 - 1) * exp(-t / 0.012) * p.hard : 0;
      L[i] = (l * 3.2 + cons) * e; R[i] = (rr * 3.2 + cons) * e;
    }
    if (p.verb) D.verb(L, R, sr, { decay: p.verb, mix: 0.35, size: 1, damp: 0.5 });
    D.filt(L, 'hp', 110, 0.7, 0, sr); D.filt(R, 'hp', 110, 0.7, 0, sr);
    D.fadeOut(L, Math.floor(sr * 0.02)); D.fadeOut(R, Math.floor(sr * 0.02));
    return [L, R];
  };

  // ---------- percussion loops (audio loops rendered from the one-shot engine) ----------
  K.loop = (p, sr, r) => {
    const spb = 60 / p.bpm, n = lenSamples(sr, p.bars * 4 * spb), L = mk(n), R = mk(n), step = spb / 4;
    p.voices.forEach((v, vi) => {
      const smp = D.render(v.spec, sr, true), pat = v.steps;
      for (let s = 0; s < pat.length; s++) {
        const ch = pat[s]; if (ch === '.') continue;
        const vel = ch === 'X' ? 1 : ch === 'o' ? 0.4 : 0.8;
        const off = Math.floor((s * step + (s % 2 ? (p.swing || 0) * step * 0.5 : 0)) * sr), pan = v.pan || 0, gl = Math.cos((pan + 1) * PI / 4), gr = Math.sin((pan + 1) * PI / 4);
        D.addInto(L, smp.L, vel * (v.g || 1) * gl * 1.41, off); D.addInto(R, smp.R, vel * (v.g || 1) * gr * 1.41, off);
      }
    });
    return [L, R];
  };

  // ---------- render dispatch ----------
  const TARGET_DB = { kick: -0.8, clap: -3.5, snare: -3.5, hat: -7, crash: -6, perc: -5, riser: -3, impact: -2, sweep: -4, drop: -1.5, whoosh: -4, zap: -4, synhit: -3, atmos: -9, reverse: -3, vox: -4, loop: -4 };
  D.render = (spec, sr = 44100, raw = false) => {
    const fn = K[spec.kind]; if (!fn) throw new Error('unknown sound kind ' + spec.kind);
    const r = HD.rng(spec.seed == null ? 1 : spec.seed);
    const [L, R] = fn(spec.p || {}, sr, r);
    for (let i = 0; i < L.length; i++) { if (!(L[i] === L[i])) L[i] = 0; if (!(R[i] === R[i])) R[i] = 0; }
    if (!raw) { D.norm(L, R, (TARGET_DB[spec.kind] == null ? -3 : TARGET_DB[spec.kind]) + (spec.gain || 0)); }
    else D.norm(L, R, -3);
    return { L, R, sr };
  };
  D.thumb = (smp, bins = 64) => HD.computePeaks([smp.L, smp.R], bins);
})();
