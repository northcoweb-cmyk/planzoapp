/* HouseDAW — drum step sequencer / pattern editor. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const el = HD.el, UI = HD.UI, S = HD.State, M = HD.Music, Lib = HD.Lib, A = HD.Actions;
  const D = (HD.DrumSeq = { clipId: null, selRow: 0, mode: 'vel', stepW: 26 });
  const clip = () => (D.clipId ? S.clip(D.clipId) : null);
  const stepsOf = (c) => Math.round(Math.max(0.25, c.cl || c.len) * 4);
  const noteAt = (row, i) => row.notes.find((n) => Math.abs(n.s - i * 0.25) < 0.124);

  D.init = (root) => {
    D.root = root; D.render();
    HD.bus.on('change', (e) => { if (e.kind !== 'mixer' && e.kind !== 'transport') { if (D.clipId && !clip()) D.clipId = null; D.render(); } });
    HD.bus.on('project', () => D.render());
    D.loop();
  };
  D.open = (id) => { D.clipId = id; D.selRow = 0; D.render(); };

  D.render = () => {
    const root = D.root, c = clip(); if (!root) return; const keep = root.querySelector('.ds-rows'), st = keep ? keep.scrollTop : 0; root.innerHTML = '';
    if (!c || c.type !== 'drum') { root.append(el('div', { class: 'empty big', text: 'Double-click a drum clip in the arrangement — or drag a drum pattern from the browser — to edit it here.' })); return; }
    const t = S.track(c.track), n = stepsOf(c);
    const patSel = UI.select([['', 'Load pattern…'], ...M.DRUMPATS.map((p) => [p.id, p.name])], '', (v) => { if (!v) return; D.loadPattern(v); patSel.value = ''; }, 'small');
    const swing = UI.slider(0, 100, Math.round((c.swing || 0) * 100), 1, (v) => { c.swing = v / 100; sw.textContent = v + '%'; }, () => { S.touch('notes'); });
    swing.addEventListener('pointerdown', () => (D.swingSnap = S.begin())); swing.addEventListener('change', () => { if (D.swingSnap) { c.swing = parseFloat(swing.value) / 100; S.end(D.swingSnap, 'Swing', 'notes'); D.swingSnap = null; } });
    const sw = el('span', { class: 'val', text: Math.round((c.swing || 0) * 100) + '%' });
    const bars = UI.select([[1, '1 bar'], [2, '2 bars'], [4, '4 bars']], Math.max(1, Math.round(n / 16)), (v) => S.mutate('Pattern length', () => { c.cl = parseInt(v, 10) * 4; if (c.len < c.cl) c.len = c.cl; }, 'notes'), 'small');
    const bar = el('div', { class: 'ds-toolbar' }, el('span', { class: 'pr-title', text: (t ? t.name : '') + ' · ' + (c.name || 'Pattern') }), patSel, el('span', { class: 'lbl', text: 'Swing' }), swing, sw, el('span', { class: 'lbl', text: 'Loop' }), bars,
      el('button', { class: 'btn small', text: 'Humanize', title: 'Random tiny timing + velocity variations', onclick: () => D.humanize() }),
      el('button', { class: 'btn small', text: 'Clear', onclick: () => S.mutate('Clear pattern', () => c.rows.forEach((r) => (r.notes = [])), 'notes') }),
      el('button', { class: 'btn small', text: '＋ Row', onclick: () => UI.pickSound(['DRUMS', 'FX', 'VOCALS', 'MY SOUNDS'], (it) => S.mutate('Add row', () => c.rows.push({ id: HD.uid('row'), name: it.sub, snd: it.id, vol: 1, pan: 0, notes: [] }), 'notes'), 'Add a row') }),
      el('button', { class: 'btn small', text: 'Split rows → tracks', title: 'Put every row on its own track so each can be mixed separately', onclick: () => D.split() }),
      el('span', { class: 'hint', text: 'Click/drag steps · right-click a step to cycle velocity' }));
    const rowsEl = el('div', { class: 'ds-rows' });
    c.rows.forEach((row, ri) => rowsEl.append(D.rowEl(c, row, ri, n)));
    D.lane = el('canvas', { class: 'ds-lane' });
    const laneBar = el('div', { class: 'ds-lanebar' }, el('div', { class: 'seg' }, [['vel', 'Velocity'], ['time', 'Timing']].map(([k, l]) => el('button', { class: 'seg-b' + (D.mode === k ? ' on' : ''), text: l, onclick: () => { D.mode = k; D.render(); } }))), el('span', { class: 'hint', text: D.mode === 'vel' ? 'Drag bars to set velocity for the selected row' : 'Drag bars up/down to push hits late/early (micro-timing)' }));
    root.append(bar, rowsEl, laneBar, D.lane);
    rowsEl.scrollTop = st; D.layoutLane(c, n); D.hookPaint(rowsEl, c);
    D.lane.addEventListener('pointerdown', (e) => D.laneDown(e, c, n));
    // drop a sample on a row head to swap it
  };

  D.rowEl = (c, row, ri, n) => {
    const head = el('div', { class: 'ds-head' + (ri === D.selRow ? ' sel' : '') },
      el('button', { class: 'tb m' + (row.mute ? ' on' : ''), text: 'M', onclick: () => S.mutate('Mute row', () => (row.mute = !row.mute), 'notes') }),
      el('button', { class: 'ds-name', title: 'Click to hear · drop a sound here to swap', text: (Lib.byId[row.snd] || {}).name || row.name, onclick: () => { D.selRow = ri; const t = S.track(c.track); HD.engine.ctx.resume(); HD.engine.auditionDrum(t.id, row.snd, row.vol); D.render(); } }),
      el('button', { class: 'icon-btn', text: '⇄', title: 'Change sound', onclick: () => UI.pickSound(['DRUMS', 'FX', 'VOCALS', 'MY SOUNDS'], (it) => S.mutate('Change sound', () => { row.snd = it.id; row.name = row.name || it.sub; }, 'notes'), 'Change sound for ' + (row.name || 'row')) }),
      el('input', { type: 'range', class: 'range mini', min: 0, max: 1.3, step: 0.01, value: row.vol == null ? 1 : row.vol, title: 'Row volume', oninput: (e) => (row.vol = parseFloat(e.target.value)), onchange: () => S.touch('notes') }),
      el('input', { type: 'range', class: 'range mini', min: -1, max: 1, step: 0.05, value: row.pan || 0, title: 'Row pan', oninput: (e) => (row.pan = parseFloat(e.target.value)), onchange: () => S.touch('notes') }),
      el('button', { class: 'icon-btn', text: '✕', title: 'Remove row', onclick: () => S.mutate('Remove row', () => c.rows.splice(ri, 1), 'notes') }));
    head.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('application/x-hd')) { e.preventDefault(); head.classList.add('drop'); } });
    head.addEventListener('dragleave', () => head.classList.remove('drop'));
    head.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); head.classList.remove('drop'); const it = Lib.byId[e.dataTransfer.getData('application/x-hd')]; if (it && (it.type === 'sample' || it.type === 'import')) S.mutate('Change sound', () => { row.snd = it.id; }, 'notes'); });
    const steps = el('div', { class: 'ds-steps' });
    for (let i = 0; i < n; i++) {
      const nt = noteAt(row, i), b = el('div', { class: 'step' + (nt ? ' on' : '') + (Math.floor(i / 4) % 2 ? ' alt' : '') + (i % 16 === 0 ? ' bar' : ''), 'data-i': i, style: nt ? { '--v': nt.v } : null });
      steps.append(b);
    }
    return el('div', { class: 'ds-row' + (ri === D.selRow ? ' sel' : ''), 'data-ri': ri }, head, steps);
  };

  // painting steps
  D.hookPaint = (rowsEl, c) => {
    let painting = null, snap = null, rowIdx = 0;
    const apply = (b) => {
      const i = parseInt(b.dataset.i, 10), ri = parseInt(b.closest('.ds-row').dataset.ri, 10); if (ri !== rowIdx) return; const row = c.rows[ri], nt = noteAt(row, i);
      if (painting === 'add' && !nt) { row.notes.push({ s: i * 0.25, v: 0.85, o: 0 }); b.classList.add('on'); b.style.setProperty('--v', 0.85); const t = S.track(c.track); if (i === D.lastAud) return; HD.engine.ctx.resume(); HD.engine.auditionDrum(t.id, row.snd, 0.8); }
      else if (painting === 'remove' && nt) { row.notes.splice(row.notes.indexOf(nt), 1); b.classList.remove('on'); }
    };
    rowsEl.addEventListener('contextmenu', (e) => { const b = e.target.closest('.step'); if (!b) return; e.preventDefault(); const i = parseInt(b.dataset.i, 10), ri = parseInt(b.closest('.ds-row').dataset.ri, 10), nt = noteAt(c.rows[ri], i); if (!nt) return; S.mutate('Velocity', () => { nt.v = nt.v < 0.5 ? 0.82 : nt.v < 0.9 ? 1 : 0.45; }, 'notes'); });
    rowsEl.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.step'); if (!b || e.button !== 0) return; e.preventDefault();
      const i = parseInt(b.dataset.i, 10), ri = parseInt(b.closest('.ds-row').dataset.ri, 10), row = c.rows[ri], nt = noteAt(row, i); rowIdx = ri; D.selRow = ri;
      snap = S.begin(); painting = e.shiftKey && nt ? 'vel' : nt ? 'remove' : 'add';
      if (painting === 'vel') { nt.v = nt.v < 0.5 ? 0.82 : nt.v < 0.9 ? 1 : 0.45; S.end(snap, 'Velocity', 'notes'); return; }
      apply(b);
      const over = (ev) => { const t = document.elementFromPoint(ev.clientX, ev.clientY); const bb = t && t.closest && t.closest('.step'); if (bb) apply(bb); };
      const up = () => { document.removeEventListener('pointermove', over); document.removeEventListener('pointerup', up); painting = null; S.end(snap, 'Edit pattern', 'notes'); };
      document.addEventListener('pointermove', over); document.addEventListener('pointerup', up);
    });
  };

  // velocity / timing lane for the selected row
  D.layoutLane = (c, n) => {
    const cvs = D.lane, headW = 306, W = headW + n * D.stepW + 8, H = 64; cvs.width = W; cvs.height = H; cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
    const g = cvs.getContext('2d'); g.fillStyle = '#12141a'; g.fillRect(0, 0, W, H);
    const row = c.rows[D.selRow]; if (!row) return;
    g.fillStyle = '#7a7f90'; g.font = '10px sans-serif'; g.fillText((Lib.byId[row.snd] || {}).name || row.name, 8, 14);
    for (let i = 0; i < n; i++) { g.fillStyle = i % 4 === 0 ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.03)'; g.fillRect(headW + i * D.stepW, 0, 1, H); }
    if (D.mode === 'time') { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(headW, H / 2, n * D.stepW, 1); }
    for (const nt of row.notes) {
      const i = Math.round(nt.s / 0.25), x = headW + i * D.stepW + D.stepW / 2;
      if (D.mode === 'vel') { const h = nt.v * (H - 10); g.fillStyle = '#ff9f43'; g.fillRect(x - 4, H - h, 8, h); }
      else { const off = (nt.o || 0) / 0.125, y = H / 2 - off * (H / 2 - 6); g.fillStyle = '#4da3ff'; g.fillRect(x - 3, Math.min(y, H / 2), 6, Math.abs(y - H / 2) + 1); g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    }
  };
  D.laneDown = (e, c, n) => {
    const row = c.rows[D.selRow]; if (!row) return; const r = D.lane.getBoundingClientRect(), headW = 306, snap = S.begin();
    const set = (ev) => {
      const x = ev.clientX - r.left - headW, i = Math.floor(x / D.stepW), nt = noteAt(row, i); if (!nt) return;
      const y = ev.clientY - r.top;
      if (D.mode === 'vel') nt.v = HD.clamp(HD.round(1 - (y - 4) / 54, 2), 0.05, 1); else nt.o = HD.clamp(HD.round(((64 / 2 - y) / (64 / 2 - 6)) * 0.125, 4), -0.125, 0.125);
      D.layoutLane(c, n);
    };
    set(e); const mv = (ev) => set(ev); const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); S.end(snap, D.mode === 'vel' ? 'Velocity' : 'Timing', 'notes'); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
  };

  D.humanize = () => { const c = clip(); if (!c) return; const r = HD.rng(Date.now() & 0xffff); S.mutate('Humanize', () => c.rows.forEach((row) => row.notes.forEach((n) => { n.v = HD.clamp(HD.round(n.v + (r() - 0.5) * 0.2, 2), 0.2, 1); n.o = HD.round((r() - 0.5) * 0.03, 4); })), 'notes'); };
  D.loadPattern = (id) => {
    const c = clip(); if (!c) return; const pat = M.DRUMPATS.find((p) => p.id === id), { rows, bars } = M.rowsFromPattern(pat, A.flavor());
    S.mutate('Load pattern', () => { c.rows = rows; c.cl = bars * 4; c.swing = pat.swing; c.name = pat.name; if (c.len < c.cl) c.len = c.cl; }, 'notes');
  };
  D.split = () => {
    const c = clip(); if (!c || c.rows.length < 2) { HD.toast('Nothing to split — need two or more rows'); return; }
    S.mutate('Split rows to tracks', (p) => {
      const t0 = S.track(c.track), idx = p.tracks.indexOf(t0), made = [];
      c.rows.forEach((row) => {
        const it = Lib.byId[row.snd] || {}, nm = it.sub === 'Closed Hat' ? 'Hats' : it.sub === 'Percussion' ? (row.name || 'Perc') : it.sub || row.name;
        const tr = S.newTrack('drum', S.uniqueName(nm.replace(/^./, (x) => x.toUpperCase())), { color: S.TYPE_COLOR[/kick/i.test(nm) ? 'kick' : /clap|snare/i.test(nm) ? 'clap' : /hat/i.test(nm) ? 'hat' : 'perc'] });
        const nc = S.cloneClip(c, { track: tr.id, rows: [{ ...HD.clone(row), id: HD.uid('row') }] }); made.push([tr, nc]);
      });
      p.clips = p.clips.filter((x) => x.id !== c.id); made.forEach(([tr, nc], i) => { p.tracks.splice(idx + 1 + i, 0, tr); p.clips.push(nc); });
      if (!S.clipsOf(t0.id).length) p.tracks = p.tracks.filter((t) => t.id !== t0.id);
      D.clipId = made[0][1].id; S.sel.clips = [D.clipId];
    });
  };

  D.loop = () => {
    let last = -1;
    const f = () => {
      const c = clip();
      if (c && c.type === 'drum' && D.root && HD.Dock && HD.Dock.tab === 'editor') {
        const b = HD.Transport.beat(); let idx = -1;
        if (HD.Transport.playing && b >= c.start && b < c.start + c.len) idx = Math.floor((((b - c.start) % Math.max(0.25, c.cl || c.len)) * 4));
        if (idx !== last) { D.root.querySelectorAll('.step.now').forEach((s) => s.classList.remove('now')); if (idx >= 0) D.root.querySelectorAll(`.step[data-i="${idx}"]`).forEach((s) => s.classList.add('now')); last = idx; }
      }
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  };
})();
