/* HouseDAW — piano roll (canvas, virtualised). */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const el = HD.el, UI = HD.UI, S = HD.State, M = HD.Music, A = HD.Actions;
  const PR = (HD.PianoRoll = { clipId: null, ppb: 64, rowH: 15, hi: 107, lo: 24, grid: 0.25, tool: 'draw', chord: 'off', scaleLock: false, sel: [], lastLen: 0.5, KW: 58, clipboard: [] });
  const GRIDS = [['1/4 (beat)', 1], ['1/8', 0.5], ['1/16', 0.25], ['1/32', 0.125], ['1/8 triplet', 1 / 3], ['1/16 triplet', 1 / 6], ['Off', 0]];

  const clip = () => (PR.clipId ? S.clip(PR.clipId) : null);
  const track = () => { const c = clip(); return c ? S.track(c.track) : null; };
  const cl = () => { const c = clip(); return c ? Math.max(0.25, c.cl || c.len) : 4; };
  const snapB = (b, e) => (PR.grid && !(e && (e.ctrlKey || e.metaKey)) ? Math.round(b / PR.grid) * PR.grid : b);
  const rows = () => PR.hi - PR.lo + 1;
  const keyCss = (n) => (HD.isBlack(n) ? '#1b1d24' : '#262932');

  PR.init = (root) => {
    PR.root = root; root.innerHTML = '';
    PR.title = el('span', { class: 'pr-title', text: 'No clip selected' });
    const gridSel = UI.select(GRIDS.map(([l, v]) => [v, l]), PR.grid, (v) => { PR.grid = parseFloat(v); PR.draw(); });
    const chordSel = UI.select([['off', 'Chord assist: off'], ...Object.keys(M.CHORDS).map((k) => [k, 'Chord: ' + M.CHORD_LABEL[k]])], PR.chord, (v) => (PR.chord = v));
    PR.lenSel = UI.select([[1, '1 bar'], [2, '2 bars'], [4, '4 bars'], [8, '8 bars'], [16, '16 bars']], 4, (v) => PR.setLoopBars(parseInt(v, 10)));
    const tools = el('div', { class: 'seg' }, ['draw', 'select'].map((t) => el('button', { class: 'seg-b' + (PR.tool === t ? ' on' : ''), 'data-t': t, text: t === 'draw' ? '✎ Draw' : '▭ Select', onclick: () => { PR.tool = t; tools.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === t)); } })));
    PR.keySel = UI.select(HD.NOTE_NAMES.map((n, i) => [i, n]), S.project ? S.project.key.root : 9, (v) => S.mutate('Key', (p) => (p.key.root = parseInt(v, 10)), 'transport'), 'small');
    PR.scaleSel = UI.select(Object.keys(M.SCALES), S.project ? S.project.key.scale : 'minor', (v) => S.mutate('Scale', (p) => (p.key.scale = v), 'transport'), 'small');
    const bar = el('div', { class: 'pr-toolbar' }, PR.title, tools, el('span', { class: 'lbl', text: 'Grid' }), gridSel, chordSel,
      el('label', { class: 'chk', title: 'Snap new notes to the project scale' }, el('input', { type: 'checkbox', onchange: (e) => (PR.scaleLock = e.target.checked) }), ' Scale lock'),
      el('span', { class: 'lbl', text: 'Key' }), PR.keySel, PR.scaleSel, el('span', { class: 'lbl', text: 'Loop' }), PR.lenSel,
      el('button', { class: 'btn small', text: 'Quantize', title: 'Snap selected (or all) notes to the grid (Q)', onclick: () => PR.quantize() }),
      el('button', { class: 'btn small', text: 'Humanize', onclick: () => PR.humanize() }),
      el('button', { class: 'btn small', text: 'Oct −', title: 'Transpose selection down an octave', onclick: () => PR.transpose(-12) }), el('button', { class: 'btn small', text: 'Oct +', onclick: () => PR.transpose(12) }),
      el('button', { class: 'btn small', text: '⌂ View C3', title: 'Scroll to C3–C5', onclick: () => PR.scrollTo(72) }),
      el('button', { class: 'btn small', text: '－', onclick: () => { PR.ppb = Math.max(16, PR.ppb / 1.3); PR.layout(); } }), el('button', { class: 'btn small', text: '＋', onclick: () => { PR.ppb = Math.min(300, PR.ppb * 1.3); PR.layout(); } }));
    PR.scroll = el('div', { class: 'pr-scroll', tabindex: '0' });
    PR.spacer = el('div', { class: 'pr-spacer' }); PR.cv = el('canvas', { class: 'pr-cv' }); PR.ov = el('canvas', { class: 'pr-ov' });
    PR.spacer.append(PR.cv, PR.ov); PR.scroll.append(PR.spacer);
    PR.velCv = el('canvas', { class: 'pr-vel' });
    root.append(bar, PR.scroll, PR.velCv);
    new ResizeObserver(() => PR.layout()).observe(PR.scroll);
    PR.scroll.addEventListener('scroll', () => PR.draw());
    PR.scroll.addEventListener('wheel', (e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); PR.ppb = HD.clamp(PR.ppb * (e.deltaY < 0 ? 1.12 : 0.89), 16, 300); PR.layout(); } }, { passive: false });
    PR.cv.addEventListener('pointerdown', PR.down); PR.cv.addEventListener('contextmenu', (e) => e.preventDefault());
    PR.velCv.addEventListener('pointerdown', PR.velDown);
    PR.scroll.addEventListener('keydown', PR.key);
    HD.bus.on('change', (e) => { if (!clip() && PR.clipId) { PR.clipId = null; } if (e.kind !== 'mixer') { PR.sync(); PR.draw(); } });
    HD.bus.on('project', () => { PR.sel = []; PR.sync(); PR.draw(); });
    HD.bus.on('transport', () => PR.draw());
    PR.loop();
  };
  PR.sync = () => {
    const c = clip(); PR.title.textContent = c ? (track() ? track().name : '') + ' · ' + (c.name || 'Clip') : 'Select or double-click a MIDI clip to edit it';
    if (c) { const bars = Math.round(cl() / 4); PR.lenSel.value = [1, 2, 4, 8, 16].includes(bars) ? bars : 4; }
    if (S.project) { PR.keySel.value = S.project.key.root; PR.scaleSel.value = S.project.key.scale; }
  };
  PR.open = (id) => {
    PR.clipId = id; PR.sel = []; const c = clip();
    if (c && c.notes) { if (c.notes.length) { const ps = c.notes.map((n) => n.p), mid = (Math.min(...ps) + Math.max(...ps)) / 2; PR.layout(); PR.scrollTo(mid); } else { PR.layout(); PR.scrollTo(60); } }
    PR.sync(); PR.draw();
  };
  PR.scrollTo = (pitch) => { PR.scroll.scrollTop = Math.max(0, (PR.hi - pitch) * PR.rowH - PR.scroll.clientHeight / 2); PR.draw(); };
  PR.setLoopBars = (bars) => { const c = clip(); if (!c) return; S.mutate('Loop length', () => { c.cl = bars * 4; if (c.len < c.cl) c.len = c.cl; }); };

  PR.layout = () => {
    const sc = PR.scroll, W = sc.clientWidth, H = sc.clientHeight; if (!W) return;
    PR.spacer.style.width = PR.KW + cl() * PR.ppb + 40 + 'px'; PR.spacer.style.height = rows() * PR.rowH + 'px';
    for (const c of [PR.cv, PR.ov]) { c.width = W * devicePixelRatio; c.height = H * devicePixelRatio; c.style.width = W + 'px'; c.style.height = H + 'px'; }
    PR.ov.style.marginTop = -H + 'px'; // overlay sits on top of the main canvas
    PR.velCv.width = W * devicePixelRatio; PR.velCv.height = 70 * devicePixelRatio; PR.velCv.style.width = W + 'px'; PR.velCv.style.height = '70px';
    PR.draw();
  };

  // ---------- drawing ----------
  PR.draw = () => {
    if (PR.pending) return; PR.pending = true;
    requestAnimationFrame(() => { PR.pending = false; PR.paint(); PR.paintVel(); });
  };
  PR.paint = () => {
    const cv = PR.cv, g = cv.getContext('2d'), dpr = devicePixelRatio, W = cv.width / dpr, H = cv.height / dpr; if (!W) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const sl = PR.scroll.scrollLeft, st = PR.scroll.scrollTop, KW = PR.KW, rh = PR.rowH, ppb = PR.ppb, c = clip(), key = S.project.key, len = cl();
    g.fillStyle = '#15171d'; g.fillRect(0, 0, W, H);
    // rows
    const r0 = Math.floor(st / rh), r1 = Math.min(rows() - 1, Math.ceil((st + H) / rh));
    for (let r = r0; r <= r1; r++) {
      const p = PR.hi - r, y = r * rh - st, inS = M.inScale(p, key), root = (((p - key.root) % 12) + 12) % 12 === 0;
      g.fillStyle = root ? '#2b2547' : inS ? (HD.isBlack(p) ? '#20232c' : '#262a35') : HD.isBlack(p) ? '#13151a' : '#181b22'; g.fillRect(KW, y, W - KW, rh);
      g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(KW, y + rh - 1, W - KW, 1);
    }
    // vertical grid
    const b0 = Math.max(0, Math.floor(sl / ppb)), b1 = Math.min(len, Math.ceil((sl + W - KW) / ppb));
    const sub = PR.grid || 0.25;
    if (sub * ppb >= 6) for (let b = Math.ceil(b0 / sub) * sub; b <= b1 + 1e-6; b += sub) { const x = KW + b * ppb - sl; g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x, 0, 1, H); }
    for (let b = b0; b <= b1; b++) { const x = KW + b * ppb - sl; g.fillStyle = b % 4 === 0 ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.12)'; g.fillRect(x, 0, 1, H); if (b % 4 === 0) { g.fillStyle = '#7a7f90'; g.font = '10px sans-serif'; g.fillText(b / 4 + 1, x + 3, 10); } }
    // dim beyond loop end
    const endX = KW + len * ppb - sl; if (endX < W) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(Math.max(KW, endX), 0, W, H); }
    // notes
    if (c && c.notes) {
      const col = (track() && track().color) || '#7cf';
      for (const n of c.notes) {
        const x = KW + n.s * ppb - sl, y = (PR.hi - n.p) * rh - st, w = Math.max(3, n.l * ppb - 1);
        if (x + w < KW || x > W || y + rh < 0 || y > H) continue;
        const s = PR.sel.includes(n);
        g.fillStyle = col; g.globalAlpha = 0.35 + 0.65 * n.v; g.fillRect(x, y + 1, w, rh - 2);
        g.globalAlpha = 1; if (s) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(x + 1, y + 2, w - 2, rh - 4); } else { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + w - 3, y + 1, 3, rh - 2); }
        if (w > 28) { g.fillStyle = '#0a0a0e'; g.font = '9px sans-serif'; g.fillText(HD.noteName(n.p), x + 3, y + rh - 4); }
      }
    }
    // keys (drawn last, fixed at left)
    g.fillStyle = '#101216'; g.fillRect(0, 0, KW, H);
    for (let r = r0; r <= r1; r++) {
      const p = PR.hi - r, y = r * rh - st, black = HD.isBlack(p);
      g.fillStyle = black ? '#23262e' : '#d9dce6'; g.fillRect(0, y, black ? KW * 0.62 : KW - 1, rh - 1);
      if (black) { g.fillStyle = '#d9dce6'; g.fillRect(KW * 0.62, y + rh / 2 - 0.5, KW * 0.38 - 1, 1); }
      if (p % 12 === 0) { g.fillStyle = '#333'; g.font = '9px sans-serif'; g.fillText('C' + (p / 12 - 1), KW - 22, y + rh - 4); }
      if (M.inScale(p, key) && !black) { g.fillStyle = 'rgba(124,108,240,.45)'; g.fillRect(KW - 5, y, 4, rh - 1); }
    }
    PR.paintOv();
  };
  PR.paintOv = () => {
    const ov = PR.ov, g = ov.getContext('2d'), dpr = devicePixelRatio, W = ov.width / dpr, H = ov.height / dpr; if (!W) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const c = clip(); if (!c) return; const b = HD.Transport.beat();
    if (b >= c.start && b < c.start + c.len) { const rel = (b - c.start) % cl(), x = PR.KW + rel * PR.ppb - PR.scroll.scrollLeft; if (x >= PR.KW && x <= W) { g.fillStyle = '#ffd166'; g.fillRect(x, 0, 2, H); } }
  };
  PR.loop = () => { const f = () => { if (PR.clipId && HD.Dock && HD.Dock.tab === 'editor') PR.paintOv(); requestAnimationFrame(f); }; requestAnimationFrame(f); };

  PR.paintVel = () => {
    const cv = PR.velCv, g = cv.getContext('2d'), dpr = devicePixelRatio, W = cv.width / dpr, H = 70; if (!W) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#12141a'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#7a7f90'; g.font = '9px sans-serif'; g.fillText('Velocity', 6, 12);
    const c = clip(); if (!c || !c.notes) return; const sl = PR.scroll.scrollLeft, col = (track() && track().color) || '#7cf';
    for (const n of c.notes) { const x = PR.KW + n.s * PR.ppb - sl; if (x < PR.KW - 4 || x > W) continue; const h = n.v * (H - 8); g.fillStyle = PR.sel.includes(n) ? '#fff' : col; g.globalAlpha = PR.sel.includes(n) ? 1 : 0.85; g.fillRect(x, H - h, 4, h); g.beginPath(); g.arc(x + 2, H - h, 3, 0, 7); g.fill(); }
    g.globalAlpha = 1;
  };

  // ---------- interaction ----------
  const pos = (e) => { const r = PR.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; return { x, y, beat: (x - PR.KW + PR.scroll.scrollLeft) / PR.ppb, pitch: PR.hi - Math.floor((y + PR.scroll.scrollTop) / PR.rowH) }; };
  const hit = (p) => { const c = clip(); if (!c) return null; for (let i = c.notes.length - 1; i >= 0; i--) { const n = c.notes[i]; if (p.beat >= n.s && p.beat <= n.s + n.l && p.pitch === n.p) return n; } return null; };
  const snapPitch = (p) => { if (!PR.scaleLock) return p; for (let d = 0; d < 7; d++) { if (M.inScale(p + d, S.project.key)) return p + d; if (M.inScale(p - d, S.project.key)) return p - d; } return p; };
  PR.audition = (p, v) => { const t = track(); if (t && HD.engine.ctx.state === 'running') HD.engine.auditionNote(t.id, p, v || 0.8, 0.3); else if (t) HD.engine.ctx.resume().then(() => HD.engine.auditionNote(t.id, p, v || 0.8, 0.3)); };

  PR.down = (e) => {
    PR.scroll.focus({ preventScroll: true }); const c = clip(); if (!c || c.type !== 'midi') return; const p = pos(e);
    // piano keys
    if (p.x < PR.KW) { PR.audition(p.pitch); return; }
    if (p.beat < 0 || p.beat > cl() + 0.001) return;
    const snap = S.begin(), n = hit(p);
    if (e.button === 2) { if (n) { c.notes.splice(c.notes.indexOf(n), 1); PR.sel = PR.sel.filter((x) => x !== n); S.end(snap, 'Delete note', 'notes'); } return; }
    if (n) {
      if (e.shiftKey) { PR.sel = PR.sel.includes(n) ? PR.sel.filter((x) => x !== n) : PR.sel.concat(n); PR.draw(); S.end(snap, 'x', 'notes'); return; }
      if (!PR.sel.includes(n)) PR.sel = [n];
      const resize = (n.s + n.l) * PR.ppb - (p.beat * PR.ppb) < 7 && n.l * PR.ppb > 14, startB = p.beat, startP = p.pitch;
      let moved = false, copied = false; const orig = PR.sel.map((x) => ({ n: x, s: x.s, l: x.l, p: x.p })); PR.audition(n.p, n.v);
      const mv = (ev) => {
        const q = pos(ev); moved = true;
        if (resize) { const dl = snapB(q.beat, ev) - snapB(startB, ev); orig.forEach((o) => { o.n.l = Math.max(PR.grid || 0.0625, HD.round(o.l + dl, 4)); }); PR.lastLen = n.l; }
        else {
          if (ev.altKey && !copied) { copied = true; orig.forEach((o) => { const nn = { ...o.n }; c.notes.push(nn); }); }
          const dB = snapB(q.beat - startB, ev) , dP = q.pitch - startP; let lastP = n.p;
          orig.forEach((o) => { o.n.s = Math.max(0, Math.min(cl() - 0.0625, HD.round(o.s + dB, 4))); o.n.p = HD.clamp(snapPitch(o.p + dP), PR.lo, PR.hi); });
          if (n.p !== lastP) PR.audition(n.p, n.v);
        }
        PR.draw(); HD.bus.emit('change-live');
      };
      const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); S.end(snap, moved ? 'Edit notes' : 'x', 'notes'); };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); PR.draw(); return;
    }
    // empty space
    if (PR.tool === 'select' || e.shiftKey) {
      const base = e.shiftKey ? PR.sel.slice() : []; PR.sel = base; const x0 = p.x, y0 = p.y;
      const mv = (ev) => {
        const q = pos(ev), b0 = Math.min(p.beat, q.beat), b1 = Math.max(p.beat, q.beat), p0 = Math.min(p.pitch, q.pitch), p1 = Math.max(p.pitch, q.pitch);
        PR.sel = base.concat(c.notes.filter((n) => !base.includes(n) && n.s + n.l > b0 && n.s < b1 && n.p >= p0 && n.p <= p1));
        PR.draw(); const g = PR.ov.getContext('2d'); PR.paintOv(); g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); g.strokeStyle = '#fff'; g.setLineDash([4, 3]); g.strokeRect(Math.min(x0, q.x), Math.min(y0, q.y), Math.abs(q.x - x0), Math.abs(q.y - y0)); g.setLineDash([]);
      };
      const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); PR.draw(); };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); PR.draw(); return;
    }
    // draw a note (and chord stack)
    const s = Math.max(0, Math.min(cl() - 0.0625, snapB(p.beat, e))), pitch = snapPitch(p.pitch), root = pitch;
    const stack = PR.chord === 'off' ? [0] : M.CHORDS[PR.chord].map((i) => (i > 12 ? i : i)), created = stack.map((iv) => ({ p: HD.clamp(root + iv, PR.lo, PR.hi), s: HD.round(s, 4), l: PR.lastLen, v: 0.8 }));
    created.forEach((n) => c.notes.push(n)); PR.sel = created.slice(); stack.forEach((iv, i) => setTimeout(() => PR.audition(root + iv), i * 8));
    const mv = (ev) => { const q = pos(ev); const l = Math.max(PR.grid || 0.0625, snapB(q.beat, ev) - s); created.forEach((n) => (n.l = HD.round(l, 4))); PR.lastLen = created[0].l; PR.draw(); };
    const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); S.end(snap, 'Add note', 'notes'); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); PR.draw();
  };

  PR.velDown = (e) => {
    const c = clip(); if (!c || !c.notes) return; const r = PR.velCv.getBoundingClientRect(), snap = S.begin();
    const velAt = (ev) => HD.clamp(1 - (ev.clientY - r.top - 4) / 62, 0.03, 1);
    const near = (ev) => { const b = (ev.clientX - r.left - PR.KW + PR.scroll.scrollLeft) / PR.ppb; let best = null, bd = 1e9; for (const n of c.notes) { const d = Math.abs(n.s - b) * PR.ppb; if (d < bd) { bd = d; best = n; } } return bd < 10 ? best : null; };
    const first = near(e); if (!first) return;
    let targets = PR.sel.includes(first) ? PR.sel : [first]; if (!PR.sel.includes(first)) PR.sel = [first];
    const set = (ev) => { const v = HD.round(velAt(ev), 2); if (targets.length > 1) { const d = v - first.v; const base = targets.map((n) => n.v); targets.forEach((n, i) => (n.v = HD.clamp(HD.round(base[i] + d, 2), 0.03, 1))); } else first.v = v; PR.draw(); };
    set(e); const mv = (ev) => { const n = near(ev); if (targets.length === 1 && n && n !== first && ev.buttons) { first.v = first.v; targets = [n]; } set(ev); };
    const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); S.end(snap, 'Velocity', 'notes'); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
  };

  PR.selected = () => { const c = clip(); return c ? (PR.sel.length ? PR.sel : c.notes) : []; };
  PR.quantize = () => { const c = clip(); if (!c) return; const g = PR.grid || 0.25; S.mutate('Quantize', () => { PR.selected().forEach((n) => { n.s = HD.round(Math.max(0, Math.round(n.s / g) * g), 4); n.l = Math.max(g, HD.round(Math.round(n.l / g) * g, 4)); }); }, 'notes'); HD.toast('Quantized to grid'); };
  PR.humanize = () => { const c = clip(); if (!c) return; const r = HD.rng(Date.now() & 0xffff); S.mutate('Humanize', () => { PR.selected().forEach((n) => { n.s = HD.round(Math.max(0, n.s + (r() - 0.5) * 0.04), 4); n.v = HD.clamp(HD.round(n.v + (r() - 0.5) * 0.18, 2), 0.2, 1); }); }, 'notes'); };
  PR.transpose = (d) => { const c = clip(); if (!c) return; S.mutate('Transpose', () => PR.selected().forEach((n) => (n.p = HD.clamp(n.p + d, PR.lo, PR.hi))), 'notes'); };

  PR.key = (e) => {
    const c = clip(); if (!c || c.type !== 'midi') return; const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); if (PR.sel.length) S.mutate('Delete notes', () => { c.notes = c.notes.filter((n) => !PR.sel.includes(n)); PR.sel = []; }, 'notes'); }
    else if (ctrl && e.key === 'a') { e.preventDefault(); PR.sel = c.notes.slice(); PR.draw(); }
    else if (ctrl && e.key === 'c') { PR.clipboard = PR.sel.map((n) => ({ ...n })); }
    else if (ctrl && e.key === 'x') { PR.clipboard = PR.sel.map((n) => ({ ...n })); S.mutate('Cut notes', () => { c.notes = c.notes.filter((n) => !PR.sel.includes(n)); PR.sel = []; }, 'notes'); }
    else if (ctrl && e.key === 'v') { if (!PR.clipboard.length) return; e.preventDefault(); const m0 = Math.min(...PR.clipboard.map((n) => n.s)), at = Math.max(0, Math.min(cl() - 0.25, snapB(((HD.Transport.beat() - c.start) % cl() + cl()) % cl(), null))); S.mutate('Paste notes', () => { const nn = PR.clipboard.map((n) => ({ ...n, s: HD.round(n.s - m0 + at, 4) })); nn.forEach((n) => c.notes.push(n)); PR.sel = nn; }, 'notes'); }
    else if (e.key === 'q' || e.key === 'Q') PR.quantize();
    else if (e.key.startsWith('Arrow') && PR.sel.length) {
      e.preventDefault(); const g = PR.grid || 0.25, dx = e.key === 'ArrowRight' ? g : e.key === 'ArrowLeft' ? -g : 0, dy = e.key === 'ArrowUp' ? (e.shiftKey ? 12 : 1) : e.key === 'ArrowDown' ? (e.shiftKey ? -12 : -1) : 0;
      S.mutate('Nudge notes', () => PR.sel.forEach((n) => { n.s = Math.max(0, HD.round(n.s + dx, 4)); n.p = HD.clamp(n.p + dy, PR.lo, PR.hi); }), 'notes'); if (dy) PR.audition(PR.sel[0].p);
    } else if (e.key === ' ') { e.preventDefault(); HD.Transport.toggle(); }
  };
})();
