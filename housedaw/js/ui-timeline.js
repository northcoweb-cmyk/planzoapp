/* HouseDAW — arrangement timeline. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const el = HD.el, UI = HD.UI, S = HD.State, Lib = HD.Lib, A = HD.Actions;
  const TL = (HD.Timeline = { ppb: 16, headW: 196, snap: 1, tool: 'select', follow: true });
  const SNAPS = [['Bar', 4], ['1/2 note', 2], ['1/4 note', 1], ['1/8 note', 0.5], ['1/16 note', 0.25], ['1/32 note', 0.125], ['Off', 0]];
  const compat = (clipType, trackType) => (clipType === 'midi' && trackType === 'inst') || (clipType === 'drum' && trackType === 'drum') || (clipType === 'audio' && trackType === 'audio');
  const snapV = (v, e) => { const s = TL.snap; if (!s || (e && (e.ctrlKey || e.metaKey))) return v; return Math.round(v / s) * s; };
  const P = () => S.project;

  TL.totalBeats = () => Math.max(64, Math.ceil((S.endBeat() + 16) / 4) * 4, P().loop.e + 8, 32);
  TL.contentW = () => TL.totalBeats() * TL.ppb;
  TL.laneLeft = () => TL.ruler.getBoundingClientRect().left;
  TL.beatAt = (e) => (e.clientX - TL.laneLeft()) / TL.ppb;
  TL.trackAtY = (y) => { const rows = TL.inner.querySelectorAll('.tl-row[data-track]:not(.auto)'); for (const r of rows) { const b = r.getBoundingClientRect(); if (y >= b.top && y < b.bottom) return r.dataset.track; } return null; };

  // ---------- init + toolbar ----------
  TL.init = (root) => {
    TL.root = root; root.innerHTML = '';
    const snapSel = UI.select(SNAPS.map(([l, v]) => [v, l]), TL.snap, (v) => { TL.snap = parseFloat(v); }, 'small');
    const addMenu = TL.addMenu = (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      UI.menu([
        { label: '＋ Drum track', onClick: () => { S.mutate('Add track', () => { const t = A.newDrumTrack('Drums'); S.sel.track = t.id; }); } },
        { label: '＋ Instrument track (piano)', onClick: () => { S.mutate('Add track', () => { const t = A.newInstTrack('Keys', 's_pn_house', S.TYPE_COLOR.chords); S.sel.track = t.id; }); } },
        { label: '＋ Bass track', onClick: () => { S.mutate('Add track', () => { const t = A.newInstTrack('Bass', 'b_deep', S.TYPE_COLOR.bass); S.sel.track = t.id; }); } },
        { label: '＋ Audio track', onClick: () => { S.mutate('Add track', () => { const t = S.addTrack('audio', S.uniqueName('Audio')); S.sel.track = t.id; }); } },
        { label: '＋ Group (bus) track', onClick: () => { S.mutate('Add track', () => { const t = S.addTrack('bus', S.uniqueName('Group')); S.sel.track = t.id; }); } },
      ], r.left, r.bottom + 2);
    };
    const tb = el('div', { class: 'tl-toolbar' },
      el('button', { class: 'btn small', text: '＋ Track', onclick: addMenu }),
      el('span', { class: 'sep' }), el('span', { class: 'lbl', text: 'Snap' }), snapSel,
      el('button', { class: 'btn small', id: 'tool-split', text: '✂ Split tool', title: 'Click a clip to split it (C)', onclick: () => TL.setTool(TL.tool === 'split' ? 'select' : 'split') }),
      el('button', { class: 'btn small', text: 'Split @ playhead', title: 'S', onclick: () => TL.splitAtPlayhead() }),
      el('button', { class: 'btn small', text: 'Duplicate', title: 'Ctrl+D', onclick: () => A.duplicateClips(S.sel.clips) }),
      el('button', { class: 'btn small', text: 'Delete', title: 'Del', onclick: () => A.deleteClips(S.sel.clips) }),
      el('span', { class: 'grow' }),
      el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: TL.follow, onchange: (e) => (TL.follow = e.target.checked) }), ' Follow'),
      el('button', { class: 'btn small', text: '－', title: 'Zoom out', onclick: () => TL.zoom(0.7) }), el('button', { class: 'btn small', text: '＋', title: 'Zoom in', onclick: () => TL.zoom(1.4) }), el('button', { class: 'btn small', text: 'Fit', title: 'Zoom to fit the song', onclick: () => TL.fit() }));
    TL.scroll = el('div', { class: 'tl-scroll' });
    root.append(tb, TL.scroll);
    TL.scroll.addEventListener('wheel', (e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); TL.zoom(e.deltaY < 0 ? 1.15 : 0.87, e); } }, { passive: false });
    TL.scroll.addEventListener('dragover', TL.dragOver); TL.scroll.addEventListener('dragleave', () => TL.hint(null)); TL.scroll.addEventListener('drop', TL.onDrop);
    HD.bus.on('change', (e) => {
      if (e.kind === 'structure' || e.kind === 'clips') TL.render();
      else if (e.kind === 'notes') TL.refreshSelected();
      else if (e.kind === 'mixer') TL.updateHeads();
      else if (e.kind === 'transport') { TL.renderRuler(); TL.updateLoop(); }
      else if (e.kind === 'auto') TL.render();
    });
    HD.bus.on('selection', () => TL.updateSelection());
    HD.bus.on('project', () => TL.render());
    new ResizeObserver(() => TL.updateGrid()).observe(TL.scroll);
    TL.render();
    TL.raf();
  };
  TL.setTool = (t) => { TL.tool = t; const b = document.getElementById('tool-split'); if (b) b.classList.toggle('on', t === 'split'); TL.scroll.classList.toggle('tool-split', t === 'split'); };
  TL.zoom = (f, e) => {
    const sc = TL.scroll, anchorBeat = e ? TL.beatAt(e) : (sc.scrollLeft + sc.clientWidth / 2 - TL.headW) / TL.ppb, off = e ? e.clientX - sc.getBoundingClientRect().left : sc.clientWidth / 2;
    TL.ppb = HD.clamp(TL.ppb * f, 1, 220); TL.render(); sc.scrollLeft = anchorBeat * TL.ppb + TL.headW - off;
  };
  TL.fit = () => { const w = TL.scroll.clientWidth - TL.headW - 20; TL.ppb = HD.clamp(w / Math.max(32, S.endBeat() + 4), 1, 220); TL.render(); TL.scroll.scrollLeft = 0; };
  TL.splitAtPlayhead = () => { const b = HD.Transport.beat(); if (!A.splitSelected(Math.round(b * 4) / 4)) HD.toast('Select a clip that spans the playhead, then split'); };

  // ---------- render ----------
  TL.render = () => {
    if (!TL.scroll || !P()) return;
    const sc = TL.scroll, ppb = TL.ppb, W = TL.contentW(), hW = TL.headW;
    const st = sc.scrollTop, sl = sc.scrollLeft;
    sc.innerHTML = '';
    TL.inner = el('div', { class: 'tl-inner', style: { width: hW + W + 'px' } });
    // ruler block
    TL.ruler = el('div', { class: 'tl-ruler', style: { left: hW + 'px', width: W + 'px' } });
    TL.markerStrip = el('div', { class: 'tl-markers', style: { left: hW + 'px', width: W + 'px' } });
    TL.loopStrip = el('div', { class: 'tl-loopstrip', style: { left: hW + 'px', width: W + 'px' } });
    const top = el('div', { class: 'tl-top' }, el('div', { class: 'tl-corner', style: { width: hW + 'px' }, html: '<span>Tracks</span>' }), TL.ruler, TL.markerStrip, TL.loopStrip);
    TL.inner.append(top);
    TL.renderRuler(); TL.renderMarkers(); TL.updateLoop();
    TL.ruler.addEventListener('pointerdown', TL.rulerDown); TL.loopStrip.addEventListener('pointerdown', TL.loopDown);
    // tracks
    const rows = el('div', { class: 'tl-tracks' }); TL.inner.append(rows); TL.rows = rows;
    for (const t of P().tracks) {
      rows.append(TL.headRow(t));
      if (t.autoShow) rows.append(TL.autoRow(t));
    }
    rows.append(el('div', { class: 'tl-addrow' }, el('div', { class: 'tl-head add', style: { width: hW + 'px' } }, el('button', { class: 'btn small', text: '＋ Add track', onclick: (e) => TL.addMenu(e) })), el('div', { class: 'tl-lane empty', style: { width: W + 'px' } })));
    TL.playhead = el('div', { class: 'tl-playhead' }); TL.inner.append(TL.playhead);
    TL.hintEl = el('div', { class: 'tl-drop-hint' }); TL.inner.append(TL.hintEl);
    sc.append(TL.inner);
    sc.scrollTop = st; sc.scrollLeft = sl;
    TL.updateGrid(); TL.updateSelection();
    if (!P().tracks.length) TL.emptyState(rows);
  };
  TL.emptyState = (rows) => { rows.prepend(el('div', { class: 'tl-empty' }, el('div', { class: 'big', text: 'Your arrangement is empty' }), el('div', { text: 'Drag sounds from the browser, or build a track instantly:' }), el('div', { class: 'row' }, el('button', { class: 'btn primary', text: '✦ New House Track', onclick: () => HD.Dialogs.wizard() }), el('button', { class: 'btn', text: 'Song Builder', onclick: () => HD.Dialogs.songBuilder() })))); };

  TL.updateGrid = () => {
    if (!TL.inner) return; const ppb = TL.ppb, s = TL.inner.style;
    s.setProperty('--ppb', ppb + 'px'); s.setProperty('--bar', ppb * 4 + 'px'); s.setProperty('--sixteenth', ppb / 4 + 'px');
    TL.inner.classList.toggle('z-fine', ppb >= 40); TL.inner.classList.toggle('z-coarse', ppb < 8);
  };

  TL.renderRuler = () => {
    if (!TL.ruler) return; TL.ruler.innerHTML = '';
    const ppb = TL.ppb, total = TL.totalBeats(), every = ppb >= 40 ? 1 : ppb >= 18 ? 2 : ppb >= 9 ? 4 : ppb >= 3 ? 8 : 16;
    for (let bar = 0; bar * 4 < total; bar += every) TL.ruler.append(el('span', { class: 'rl', style: { left: bar * 4 * ppb + 3 + 'px' }, text: bar + 1 }));
    if (ppb >= 40) for (let b = 0; b < total; b++) if (b % 4) TL.ruler.append(el('span', { class: 'rl beat', style: { left: b * ppb + 2 + 'px' }, text: (b % 4) + 1 }));
  };
  TL.renderMarkers = () => {
    if (!TL.markerStrip) return; TL.markerStrip.innerHTML = '';
    for (const m of P().markers) {
      const d = el('div', { class: 'marker', style: { left: m.beat * TL.ppb + 'px', width: Math.max(20, m.bars * 4 * TL.ppb - 2) + 'px', '--c': m.color || '#888' }, text: m.name, title: 'Click: go to · Right-click: options' });
      d.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.button === 0) HD.Transport.seek(m.beat); });
      d.addEventListener('contextmenu', (e) => { e.preventDefault(); UI.menu([
        { label: 'Loop this section', onClick: () => S.mutate('Loop section', (p) => { p.loop = { on: true, s: m.beat, e: m.beat + m.bars * 4 }; }, 'transport') },
        { label: 'Rename…', onClick: () => { const n = prompt('Section name', m.name); if (n) S.mutate('Rename section', () => (m.name = n), 'structure'); } },
        { label: 'Delete marker', onClick: () => S.mutate('Delete marker', (p) => { p.markers = p.markers.filter((x) => x.id !== m.id); }) },
      ], e.clientX, e.clientY); });
      TL.markerStrip.append(d);
    }
  };
  TL.updateLoop = () => {
    if (!TL.loopStrip) return; TL.loopStrip.innerHTML = ''; const L = P().loop;
    const r = el('div', { class: 'loop-region' + (L.on ? ' on' : ''), style: { left: L.s * TL.ppb + 'px', width: (L.e - L.s) * TL.ppb + 'px' } }, el('div', { class: 'lh l' }), el('span', { text: 'LOOP' }), el('div', { class: 'lh r' }));
    TL.loopStrip.append(r); TL.loopEl = r;
    TL.inner.querySelectorAll('.loop-shade').forEach((x) => x.remove());
  };

  // ---------- headers & lanes ----------
  TL.headRow = (t) => {
    const hW = TL.headW, ppb = TL.ppb, W = TL.contentW();
    const row = el('div', { class: 'tl-row' + (S.sel.track === t.id ? ' sel' : ''), 'data-track': t.id, style: { height: t.h + 'px' } });
    const name = el('div', { class: 'th-name', text: t.name, title: 'Double-click to rename', ondblclick: () => TL.rename(t, name) });
    const typeIc = { drum: '🥁', inst: '🎹', audio: '〰', bus: '⛓' }[t.type];
    const head = el('div', { class: 'tl-head', style: { width: hW + 'px', '--c': t.color } },
      el('div', { class: 'th-color', onclick: () => S.mutate('Track color', () => (t.color = S.COLORS[(S.COLORS.indexOf(t.color) + 1) % S.COLORS.length])) }),
      el('div', { class: 'th-main' }, el('div', { class: 'th-top' }, el('span', { class: 'th-ic', text: typeIc }), name),
        el('div', { class: 'th-btns' },
          el('button', { class: 'tb m' + (t.mute ? ' on' : ''), text: 'M', title: 'Mute', onclick: (e) => { e.stopPropagation(); S.mutate('Mute', () => (t.mute = !t.mute), 'mixer'); } }),
          el('button', { class: 'tb s' + (t.solo ? ' on' : ''), text: 'S', title: 'Solo', onclick: (e) => { e.stopPropagation(); S.mutate('Solo', () => (t.solo = !t.solo), 'mixer'); } }),
          el('button', { class: 'tb a' + (t.autoShow ? ' on' : ''), text: 'A', title: 'Show automation lane', onclick: (e) => { e.stopPropagation(); S.mutate('Automation lane', () => (t.autoShow = t.autoShow ? null : 'vol')); } }),
          el('button', { class: 'tb', text: t.type === 'inst' ? '🎛' : '⋯', title: 'Track options', onclick: (e) => TL.trackMenu(t, e) }))));
    head.addEventListener('pointerdown', () => { if (S.sel.track !== t.id) { S.sel.track = t.id; HD.bus.emit('selection', S.sel); } });
    head.addEventListener('contextmenu', (e) => { e.preventDefault(); TL.trackMenu(t, e); });
    row.append(head);
    const lane = el('div', { class: 'tl-lane t-' + t.type, 'data-track': t.id, style: { width: W + 'px' } });
    for (const c of S.clipsOf(t.id)) lane.append(TL.clipEl(c, t));
    lane.addEventListener('pointerdown', (e) => TL.laneDown(e, t));
    lane.addEventListener('dblclick', (e) => { if (e.target !== lane) return; const b = Math.max(0, snapV(TL.beatAt(e), e)), c = A.addEmptyClip(t.id, Math.floor(b / 4) * 4); if (c) HD.Dock.openEditor(c.id); });
    row.append(lane); return row;
  };
  TL.rename = (t, nameEl) => {
    const i = el('input', { class: 'inp th-edit', value: t.name }); nameEl.replaceWith(i); i.focus(); i.select();
    const done = (ok) => { if (ok && i.value.trim()) S.mutate('Rename track', () => (t.name = i.value.trim())); else TL.render(); };
    i.addEventListener('blur', () => done(true)); i.addEventListener('keydown', (e) => { if (e.key === 'Enter') i.blur(); if (e.key === 'Escape') { i.value = t.name; i.blur(); } });
  };
  TL.trackMenu = (t, e) => {
    e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect ? e.currentTarget.getBoundingClientRect() : { left: e.clientX, bottom: e.clientY };
    const buses = P().tracks.filter((x) => x.type === 'bus' && x.id !== t.id);
    const items = [
      { label: 'Open in Device / FX', onClick: () => { S.sel.track = t.id; HD.Dock.show('device'); HD.bus.emit('selection', S.sel); } },
      { label: 'Rename', onClick: () => TL.rename(t, TL.inner.querySelector(`.tl-row[data-track="${t.id}"] .th-name`)) },
      { label: t.h > 40 ? 'Shrink track' : 'Expand track', onClick: () => S.mutate('Track height', () => (t.h = t.h > 40 ? 30 : 64)) },
      { label: 'Duplicate track', onClick: () => S.mutate('Duplicate track', (p) => { const n = HD.clone(t); n.id = HD.uid('trk'); n.name = S.uniqueName(t.name); n.fx.forEach((f) => (f.id = HD.uid('fx'))); n.auto = {}; n.autoShow = null; p.tracks.splice(p.tracks.indexOf(t) + 1, 0, n); S.clipsOf(t.id).forEach((c) => p.clips.push(S.cloneClip(c, { track: n.id }))); }) },
      { sep: true },
      { label: 'Output: Master' + (t.out === 'master' ? '  ✓' : ''), onClick: () => S.mutate('Routing', () => (t.out = 'master'), 'mixer') },
      ...buses.map((b) => ({ label: 'Output: ' + b.name + (t.out === b.id ? '  ✓' : ''), onClick: () => S.mutate('Routing', () => (t.out = b.id), 'mixer') })),
      { sep: true },
      { label: 'Move up', onClick: () => S.mutate('Move track', (p) => { const i = p.tracks.indexOf(t); if (i > 0) { p.tracks.splice(i, 1); p.tracks.splice(i - 1, 0, t); } }) },
      { label: 'Move down', onClick: () => S.mutate('Move track', (p) => { const i = p.tracks.indexOf(t); if (i < p.tracks.length - 1) { p.tracks.splice(i, 1); p.tracks.splice(i + 1, 0, t); } }) },
      { label: 'Delete track', onClick: () => S.mutate('Delete track', () => S.removeTrack(t.id)) },
    ];
    UI.menu(items, r.left, r.bottom + 2);
  };

  // ---------- clips ----------
  TL.clipEl = (c, t) => {
    const ppb = TL.ppb, w = Math.max(6, c.len * ppb), h = Math.max(20, t.h - 6);
    const d = el('div', { class: 'clip c-' + c.type + (c.mute ? ' mute' : ''), 'data-id': c.id, style: { left: c.start * ppb + 'px', width: w + 'px', height: h + 'px', '--c': t.color } });
    d.append(el('div', { class: 'clip-head' }, el('span', { text: c.name || (c.type === 'audio' ? (Lib.byId[c.snd] || {}).name : 'Clip') })));
    const cv = el('canvas', { class: 'clip-cv' }); cv.width = Math.min(8192, Math.ceil(w)); cv.height = Math.max(10, h - 14); cv.style.width = w + 'px'; d.append(cv);
    d.append(el('div', { class: 'rh' })); if (c.type === 'audio') { d.append(el('div', { class: 'lh' }), el('div', { class: 'fh fi', style: { width: Math.max(8, (c.fi || 0) * ppb) + 'px' } }), el('div', { class: 'fh fo', style: { width: Math.max(8, (c.fo || 0) * ppb) + 'px' } })); }
    d.addEventListener('pointerdown', (e) => TL.clipDown(e, c, t, d));
    d.addEventListener('dblclick', (e) => { e.stopPropagation(); if (c.type !== 'audio') HD.Dock.openEditor(c.id); });
    d.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); if (!S.sel.clips.includes(c.id)) S.select([c.id], t.id); TL.clipMenu(c, e); });
    requestAnimationFrame(() => TL.drawClip(c, cv));
    return d;
  };
  TL.clipMenu = (c, e) => UI.menu([
    c.type !== 'audio' ? { label: 'Open editor', onClick: () => HD.Dock.openEditor(c.id) } : { head: true, label: 'Audio clip' },
    { label: 'Split at playhead', onClick: () => TL.splitAtPlayhead() }, { label: 'Duplicate', onClick: () => A.duplicateClips(S.sel.clips) },
    { label: c.mute ? 'Unmute clip' : 'Mute clip', onClick: () => S.mutate('Mute clip', () => S.sel.clips.forEach((id) => { const x = S.clip(id); if (x) x.mute = !c.mute; })) },
    { label: 'Rename…', onClick: () => { const n = prompt('Clip name', c.name); if (n != null) S.mutate('Rename clip', () => (c.name = n)); } },
    { sep: true }, { label: 'Delete', onClick: () => A.deleteClips(S.sel.clips) },
  ], e.clientX, e.clientY);

  const colorMix = (hex, a) => hex;
  TL.drawClip = (c, cv) => {
    const g = cv.getContext('2d'), w = cv.width, h = cv.height, t = S.track(c.track), col = (t && t.color) || '#888', ppb = TL.ppb, scale = w / Math.max(1, c.len * ppb);
    g.clearRect(0, 0, w, h); g.fillStyle = col;
    if (c.type === 'audio') {
      const buf = Lib.buffer(c.snd) || Lib.bufs[c.snd]; if (!buf) return;
      const spb = 60 / P().bpm, rate = c.rate || 1, off = c.off || 0, dur = buf.duration, segBeats = Math.max(0.01, (dur - off) / (spb * rate)), chs = [buf.getChannelData(0), buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)];
      let x = 0; const mid = h / 2;
      while (x < c.len - 1e-6) {
        const bw = Math.min(segBeats, c.len - x), px0 = Math.floor(x * ppb * scale), pw = Math.max(1, Math.min(w - px0, Math.ceil(bw * ppb * scale)));
        const pk = HD.computePeaks(chs, Math.min(pw, 4096), off / dur, (off + bw * spb * rate) / dur);
        g.globalAlpha = 0.9;
        for (let i = 0; i < pw; i++) { const b = Math.min(pk.length / 2 - 1, Math.floor((i / pw) * (pk.length / 2))); const mn = pk[b * 2], mx = pk[b * 2 + 1]; g.fillRect(px0 + i, mid - mx * mid * 0.92, 1, Math.max(1, (mx - mn) * mid * 0.92)); }
        if (x + segBeats < c.len - 1e-6) { g.globalAlpha = 0.5; g.fillRect(Math.floor((x + segBeats) * ppb * scale), 0, 1, h); }
        x += segBeats; if (!c.loop && x > c.len) break; if (segBeats > c.len) break;
      }
      g.globalAlpha = 1; return;
    }
    const cl = c.cl || c.len;
    if (c.type === 'midi') {
      const ns = c.notes || []; if (!ns.length) return;
      let lo = 127, hi = 0; ns.forEach((n) => { lo = Math.min(lo, n.p); hi = Math.max(hi, n.p); }); const span = Math.max(8, hi - lo + 1), nh = Math.max(2, Math.min(5, h / span));
      for (let k = 0; k * cl < c.len - 1e-6; k++) for (const n of ns) { const s = k * cl + n.s; if (s >= c.len) continue; g.globalAlpha = 0.55 + 0.45 * n.v; g.fillRect(s * ppb * scale, h - ((n.p - lo + 0.5) / span) * (h - nh) - nh, Math.max(1.5, Math.min(n.l, c.len - s, cl - n.s) * ppb * scale - 0.5), nh); }
      g.globalAlpha = 1;
    } else if (c.type === 'drum') {
      const rows = c.rows || [], rh = h / Math.max(3, rows.length);
      for (let k = 0; k * cl < c.len - 1e-6; k++) rows.forEach((r, ri) => r.notes.forEach((n) => { const s = k * cl + n.s; if (s >= c.len || n.s >= cl) return; g.globalAlpha = 0.35 + 0.65 * n.v; g.fillRect(s * ppb * scale, ri * rh + 1, Math.max(2, ppb * scale * 0.2), Math.max(2, rh - 2)); }));
      g.globalAlpha = 1;
    }
    // loop repeat markers
    if (cl < c.len - 1e-6) { g.fillStyle = 'rgba(255,255,255,.35)'; for (let k = 1; k * cl < c.len - 1e-6; k++) g.fillRect(Math.floor(k * cl * ppb * scale), 0, 1, h); }
  };
  TL.refreshSelected = () => {
    for (const id of S.sel.clips) { const c = S.clip(id), d = TL.inner && TL.inner.querySelector(`.clip[data-id="${id}"]`); if (c && d) { const cv = d.querySelector('canvas'); if (cv) TL.drawClip(c, cv); } }
  };
  TL.updateSelection = () => {
    if (!TL.inner) return;
    TL.inner.querySelectorAll('.clip').forEach((d) => d.classList.toggle('sel', S.sel.clips.includes(d.dataset.id)));
    TL.inner.querySelectorAll('.tl-row[data-track]').forEach((r) => r.classList.toggle('sel', r.dataset.track === S.sel.track));
  };
  TL.updateHeads = () => {
    if (!TL.inner) return;
    for (const t of P().tracks) { const r = TL.inner.querySelector(`.tl-row[data-track="${t.id}"]:not(.auto)`); if (!r) continue; r.querySelector('.tb.m').classList.toggle('on', t.mute); r.querySelector('.tb.s').classList.toggle('on', t.solo); }
  };

  // ---------- interactions ----------
  TL.laneDown = (e, t) => {
    if (e.target.classList.contains('clip') || e.target.closest('.clip')) return;
    if (e.button !== 0) return;
    S.sel.track = t.id; const lane = e.currentTarget, rect0 = TL.inner.getBoundingClientRect(), startX = e.clientX, startY = e.clientY, additive = e.shiftKey;
    const base = additive ? S.sel.clips.slice() : [];
    S.select(base, t.id);
    const box = el('div', { class: 'marquee' }); TL.inner.append(box); let moved = false;
    const mv = (ev) => {
      if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 4) moved = true; if (!moved) return;
      const x0 = Math.min(startX, ev.clientX), x1 = Math.max(startX, ev.clientX), y0 = Math.min(startY, ev.clientY), y1 = Math.max(startY, ev.clientY), ir = TL.inner.getBoundingClientRect();
      Object.assign(box.style, { left: x0 - ir.left + 'px', top: y0 - ir.top + 'px', width: x1 - x0 + 'px', height: y1 - y0 + 'px' });
      const ids = base.slice(); TL.inner.querySelectorAll('.clip').forEach((d) => { const r = d.getBoundingClientRect(); if (r.right > x0 && r.left < x1 && r.bottom > y0 && r.top < y1 && !ids.includes(d.dataset.id)) ids.push(d.dataset.id); });
      S.sel.clips = ids; TL.updateSelection();
    };
    const up = () => { box.remove(); document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); HD.bus.emit('selection', S.sel); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
  };

  TL.clipDown = (e, c, t, d) => {
    if (e.button !== 0) return; e.stopPropagation();
    if (TL.tool === 'split') { const b = snapV(TL.beatAt(e), e); const snap = S.begin(); if (A.splitClip(c.id, b)) S.end(snap, 'Split'); return; }
    const spb = 60 / P().bpm;
    const zone = e.target.classList.contains('rh') ? 'r' : e.target.classList.contains('lh') ? 'l' : e.target.classList.contains('fi') ? 'fi' : e.target.classList.contains('fo') ? 'fo' : 'move';
    if (zone === 'move' || zone === 'r' || zone === 'l') {
      if (!S.sel.clips.includes(c.id)) S.select(e.shiftKey ? S.sel.clips.concat(c.id) : [c.id], t.id);
      else if (e.shiftKey && zone === 'move') { S.select(S.sel.clips.filter((x) => x !== c.id)); return; } else S.select(S.sel.clips, t.id);
    }
    const snap = S.begin(), grab = TL.beatAt(e) - c.start; let moved = false, cloned = false;
    const orig = S.sel.clips.map((id) => { const x = S.clip(id); return x && { id, start: x.start, len: x.len, track: x.track, off: x.off || 0, fi: x.fi || 0, fo: x.fo || 0 }; }).filter(Boolean);
    const pri = orig.find((o) => o.id === c.id) || orig[0], tracks = P().tracks, tIdx0 = tracks.findIndex((x) => x.id === pri.track);
    const startX = e.clientX, startY = e.clientY;
    d.setPointerCapture && d.setPointerCapture(e.pointerId);
    const mv = (ev) => {
      if (!moved && Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < 3) return; moved = true;
      const b = TL.beatAt(ev);
      if (zone === 'move') {
        if (ev.altKey && !cloned) { cloned = true; const copies = orig.map((o) => { const x = S.clip(o.id); const n = S.cloneClip(x); P().clips.push(n); return n; }); /* originals stay; drag the clones */ orig.forEach((o, i) => { o.id = copies[i].id; }); S.sel.clips = orig.map((o) => o.id); }
        const ns = Math.max(0, snapV(b - grab, ev)), delta = ns - pri.start;
        const ti = tracks.findIndex((x) => x.id === TL.trackAtY(ev.clientY)), shift = ti >= 0 ? ti - tIdx0 : 0;
        let ok = shift !== 0; if (ok) for (const o of orig) { const x = S.clip(o.id), oi = tracks.findIndex((y) => y.id === o.track), tr = tracks[oi + shift]; if (!tr || !compat(x.type, tr.type)) ok = false; }
        for (const o of orig) { const x = S.clip(o.id); x.start = Math.max(0, HD.round(o.start + delta, 4)); if (ok) x.track = tracks[tracks.findIndex((y) => y.id === o.track) + shift].id; }
        if (cloned || ok) { TL.render(); S.sel.clips = orig.map((o) => o.id); TL.updateSelection(); d = TL.inner.querySelector(`.clip[data-id="${c.id}"]`) || d; }
        else orig.forEach((o) => { const dd = TL.inner.querySelector(`.clip[data-id="${o.id}"]`); if (dd) dd.style.left = S.clip(o.id).start * TL.ppb + 'px'; });
      } else if (zone === 'r') {
        const minL = TL.snap || 0.25, end = Math.max(pri.start + minL, snapV(b, ev)), dl = end - (pri.start + pri.len);
        for (const o of orig) { const x = S.clip(o.id); x.len = Math.max(minL, HD.round(o.len + dl, 4)); const dd = TL.inner.querySelector(`.clip[data-id="${o.id}"]`); if (dd) { dd.style.width = x.len * TL.ppb + 'px'; const cv = dd.querySelector('canvas'); cv.style.width = x.len * TL.ppb + 'px'; cv.width = Math.min(8192, Math.ceil(x.len * TL.ppb)); TL.drawClip(x, cv); } }
      } else if (zone === 'l' && c.type === 'audio') {
        const rate = c.rate || 1, ns = snapV(b, ev); let delta = ns - pri.start; delta = Math.max(delta, -pri.off / (spb * rate), -pri.start); delta = Math.min(delta, pri.len - 0.25);
        c.start = HD.round(pri.start + delta, 4); c.len = HD.round(pri.len - delta, 4); c.off = Math.max(0, pri.off + delta * spb * rate);
        d.style.left = c.start * TL.ppb + 'px'; d.style.width = c.len * TL.ppb + 'px'; const cv = d.querySelector('canvas'); cv.style.width = c.len * TL.ppb + 'px'; cv.width = Math.min(8192, Math.ceil(c.len * TL.ppb)); TL.drawClip(c, cv);
      } else if (zone === 'fi') { c.fi = HD.clamp(HD.round(Math.round((b - c.start) * 4) / 4, 3), 0, c.len * 0.95); d.querySelector('.fi').style.width = Math.max(8, c.fi * TL.ppb) + 'px'; }
      else if (zone === 'fo') { c.fo = HD.clamp(HD.round(Math.round((c.start + c.len - b) * 4) / 4, 3), 0, c.len * 0.95); d.querySelector('.fo').style.width = Math.max(8, c.fo * TL.ppb) + 'px'; }
    };
    const up = () => {
      document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up);
      if (moved) { S.end(snap, zone === 'move' ? (cloned ? 'Duplicate clip' : 'Move clip') : 'Edit clip'); TL.render(); TL.updateSelection(); } else HD.bus.emit('selection', S.sel);
    };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
  };

  // ruler: seek
  TL.rulerDown = (e) => {
    if (e.button !== 0) return; const go = (ev) => { let b = Math.max(0, TL.beatAt(ev)); if (!ev.shiftKey) b = Math.round(b * 4) / 4; HD.Transport.seek(b); };
    go(e); let last = 0; const mv = (ev) => { const n = performance.now(); if (n - last > 50) { last = n; go(ev); } }; const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
  };
  // loop strip: draw / move / resize the loop region
  TL.loopDown = (e) => {
    if (e.button !== 0) return; const L = P().loop, b0 = TL.beatAt(e), sn = (v) => Math.max(0, Math.round(v / (TL.snap || 1)) * (TL.snap || 1));
    const onEdge = e.target.classList.contains('lh') ? (e.target.classList.contains('l') ? 'l' : 'r') : null, inside = e.target.closest('.loop-region');
    const snap = S.begin(); let mode = onEdge || (inside ? 'move' : 'new'), moved = false; const o = { s: L.s, e: L.e };
    if (mode === 'new') { L.s = sn(b0); L.e = L.s; }
    const mv = (ev) => {
      const b = TL.beatAt(ev); moved = true;
      if (mode === 'new') { L.s = Math.min(sn(b0), sn(b)); L.e = Math.max(sn(b0), sn(b)); L.on = true; }
      else if (mode === 'l') L.s = Math.min(sn(b), L.e - 1); else if (mode === 'r') L.e = Math.max(sn(b), L.s + 1);
      else { const d = sn(b) - sn(b0), len = o.e - o.s; L.s = Math.max(0, o.s + d); L.e = L.s + len; }
      TL.updateLoop();
    };
    const up = () => {
      document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up);
      if (!moved || (mode === 'new' && L.e - L.s < 0.5)) { L.s = o.s; L.e = o.e; if (inside || mode === 'new') L.on = !L.on; }
      if (L.e - L.s < 1) { L.s = o.s; L.e = o.e; } S.end(snap, 'Loop region', 'transport'); TL.updateLoop(); HD.bus.emit('loop');
    };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
  };

  // ---------- automation lane ----------
  TL.autoRow = (t) => {
    const key = t.autoShow, def = S.paramDef(t, key) || S.paramDef(t, 'vol'), W = TL.contentW(), hW = TL.headW, H = 60;
    const row = el('div', { class: 'tl-row auto', 'data-track': t.id, style: { height: H + 'px' } });
    const sel = UI.select(S.autoOptions(t).map(([k, l]) => [k, l + (t.auto[k] && t.auto[k].length ? ' ●' : '')]), key, (v) => { S.mutate('Automation param', () => (t.autoShow = v)); }, 'small');
    row.append(el('div', { class: 'tl-head auto', style: { width: hW + 'px', '--c': t.color } }, el('div', { class: 'th-auto' }, el('span', { class: 'lbl', text: 'Automation' }), sel, el('button', { class: 'btn small', text: 'Clear', onclick: () => S.mutate('Clear automation', () => { delete t.auto[key]; }) }))));
    const lane = el('div', { class: 'tl-lane auto', style: { width: W + 'px' } }), ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('width', W); svg.setAttribute('height', H); lane.append(svg); row.append(lane);
    const pts = (t.auto[key] = t.auto[key] || []).sort((a, b) => a.t - b.t);
    const X = (b) => b * TL.ppb, Y = (v) => (1 - v) * (H - 8) + 4, vFromY = (y) => HD.clamp(1 - (y - 4) / (H - 8), 0, 1);
    const draw = () => {
      svg.innerHTML = '';
      const val0 = pts.length ? pts[0].v : def.fromNat(key === 'vol' ? t.vol : key === 'pan' ? t.pan : 0.5);
      let d = ''; if (pts.length) { d = `M0 ${Y(pts[0].v)}`; pts.forEach((p) => (d += ` L${X(p.t)} ${Y(p.v)}`)); d += ` L${W} ${Y(pts[pts.length - 1].v)}`; }
      if (d) { const path = document.createElementNS(ns, 'path'); path.setAttribute('d', d); path.setAttribute('class', 'auto-line'); svg.append(path); }
      else { const tx = document.createElementNS(ns, 'text'); tx.setAttribute('x', 8); tx.setAttribute('y', 34); tx.setAttribute('class', 'auto-hint'); tx.textContent = 'Click to add automation points · drag to move · double-click a point to delete'; svg.append(tx); }
      pts.forEach((p, i) => { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', X(p.t)); c.setAttribute('cy', Y(p.v)); c.setAttribute('r', 5); c.setAttribute('class', 'auto-pt'); c._i = i; svg.append(c); });
    };
    draw();
    svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return; const r = svg.getBoundingClientRect(), snap = S.begin(); let p;
      if (e.target.tagName === 'circle') p = pts[e.target._i];
      else { p = { t: Math.max(0, Math.round(((e.clientX - r.left) / TL.ppb) * 4) / 4), v: vFromY(e.clientY - r.top) }; pts.push(p); pts.sort((a, b) => a.t - b.t); }
      draw(); svg.setPointerCapture(e.pointerId);
      const mv = (ev) => { p.t = Math.max(0, Math.round(((ev.clientX - r.left) / TL.ppb) * 4) / 4); p.v = vFromY(ev.clientY - r.top); pts.sort((a, b) => a.t - b.t); draw(); };
      const up = () => { svg.removeEventListener('pointermove', mv); svg.removeEventListener('pointerup', up); S.end(snap, 'Automation', 'auto'); };
      svg.addEventListener('pointermove', mv); svg.addEventListener('pointerup', up);
    });
    svg.addEventListener('dblclick', (e) => { if (e.target.tagName === 'circle') { S.mutate('Delete point', () => pts.splice(e.target._i, 1), 'auto'); } });
    return row;
  };

  // ---------- drag & drop from the browser / files ----------
  TL.hint = (b, rowEl) => { if (!TL.hintEl) return; if (b == null) { TL.hintEl.style.display = 'none'; return; } const r = rowEl && rowEl.getBoundingClientRect(), ir = TL.inner.getBoundingClientRect(); TL.hintEl.style.display = 'block'; TL.hintEl.style.left = TL.headW + b * TL.ppb + 'px'; TL.hintEl.style.top = (r ? r.top - ir.top : 40) + 'px'; TL.hintEl.style.height = (r ? r.height : 30) + 'px'; };
  TL.dragOver = (e) => {
    const types = [...(e.dataTransfer.types || [])]; if (!types.includes('application/x-hd') && !types.includes('Files')) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
    const b = Math.max(0, snapV(TL.beatAt(e), e)), tid = TL.trackAtY(e.clientY);
    TL.hint(b, tid ? TL.inner.querySelector(`.tl-row[data-track="${tid}"]:not(.auto)`) : null);
  };
  TL.onDrop = async (e) => {
    e.preventDefault(); TL.hint(null);
    const b = Math.max(0, snapV(TL.beatAt(e), e)), tid = TL.trackAtY(e.clientY), id = e.dataTransfer.getData('application/x-hd');
    if (id) { const it = Lib.byId[id]; if (it) A.addItem(it, { trackId: tid, beat: b }); return; }
    if (e.dataTransfer.files && e.dataTransfer.files.length) { const items = await HD.Import.files(e.dataTransfer.files); let beat = b; for (const it of items) { const r = A.addItem(it, { trackId: tid, beat }); beat += 0; } }
  };

  // ---------- playhead ----------
  TL.raf = () => {
    const tick = () => {
      if (TL.playhead) {
        const b = HD.Transport.beat(), x = TL.headW + b * TL.ppb; TL.playhead.style.transform = `translateX(${x}px)`;
        if (HD.Transport.playing && TL.follow) { const sc = TL.scroll, vx = x - sc.scrollLeft; if (vx > sc.clientWidth - 40 || vx < TL.headW) sc.scrollLeft = Math.max(0, x - TL.headW - 30); }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
})();
