/* HouseDAW — utilities. Classic script; everything hangs off the global HD namespace
   so the app also runs from file:// and is loadable in Node for DSP tests. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});

  HD.uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  HD.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  HD.lerp = (a, b, t) => a + (b - a) * t;
  HD.mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  HD.dbToGain = (db) => Math.pow(10, db / 20);
  HD.gainToDb = (g) => (g <= 0.00001 ? -100 : 20 * Math.log10(g));
  HD.round = (v, d = 3) => { const k = Math.pow(10, d); return Math.round(v * k) / k; };
  HD.clone = (o) => JSON.parse(JSON.stringify(o));
  HD.NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  HD.noteName = (m) => HD.NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  HD.isBlack = (m) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

  HD.hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  HD.rng = (seed) => {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  HD.pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

  // tiny event bus
  const handlers = {};
  HD.bus = {
    on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return () => HD.bus.off(ev, fn); },
    off(ev, fn) { handlers[ev] = (handlers[ev] || []).filter((f) => f !== fn); },
    emit(ev, d) { (handlers[ev] || []).slice().forEach((f) => { try { f(d); } catch (e) { console.error('bus', ev, e); } }); },
  };

  // DOM helper
  HD.el = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (v[sk] == null) continue; if (sk.startsWith('--')) e.style.setProperty(sk, v[sk]); else e.style[sk] = v[sk]; } }
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return e;
  };

  HD.toast = (msg, ms = 2600) => {
    if (typeof document === 'undefined') return;
    let box = document.getElementById('toasts');
    if (!box) { box = HD.el('div', { id: 'toasts' }); document.body.append(box); }
    const t = HD.el('div', { class: 'toast', text: msg });
    box.append(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, ms);
  };

  HD.fmtTime = (sec) => {
    sec = Math.max(0, sec);
    const m = Math.floor(sec / 60), s = sec - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  };
  HD.fmtDur = (sec) => (sec < 10 ? sec.toFixed(2) + 's' : HD.fmtTime(sec));

  // Peaks: min/max pairs for waveform drawing
  HD.computePeaks = (chans, bins, startFrac = 0, endFrac = 1) => {
    const n = chans[0].length;
    const s0 = Math.floor(n * startFrac), s1 = Math.max(s0 + 1, Math.floor(n * endFrac));
    const out = new Float32Array(bins * 2);
    const per = (s1 - s0) / bins;
    const stride = Math.max(1, Math.floor(per / 24));
    for (let b = 0; b < bins; b++) {
      let mn = 0, mx = 0;
      const a = s0 + Math.floor(b * per), z = Math.min(n, s0 + Math.floor((b + 1) * per) + 1);
      for (let ch = 0; ch < chans.length; ch++) {
        const d = chans[ch];
        for (let i = a; i < z; i += stride) { const v = d[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
      }
      out[b * 2] = mn; out[b * 2 + 1] = mx;
    }
    return out;
  };

  HD.drawPeaks = (canvas, peaks, color = '#7cf', opts = {}) => {
    const w = canvas.width, h = canvas.height, g = canvas.getContext('2d');
    g.clearRect(0, 0, w, h);
    if (opts.bg) { g.fillStyle = opts.bg; g.fillRect(0, 0, w, h); }
    g.fillStyle = color;
    const bins = peaks.length / 2, mid = h / 2;
    for (let x = 0; x < w; x++) {
      const b = Math.min(bins - 1, Math.floor((x / w) * bins));
      const mn = peaks[b * 2], mx = peaks[b * 2 + 1];
      const y0 = mid - mx * mid * 0.95, y1 = mid - mn * mid * 0.95;
      g.fillRect(x, y0, 1, Math.max(1, y1 - y0));
    }
  };
})();
