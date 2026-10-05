/* HouseDAW — sound browser (left panel). */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const el = HD.el, UI = HD.UI, S = HD.State, Lib = HD.Lib, M = HD.Music;
  const B = (HD.Browser = { cat: 'DRUMS', sub: 'All', q: '', sort: 'Name', favOnly: false, playing: null });
  const CATS = ['DRUMS', 'BASS', 'SYNTHS', 'CHORDS', 'VOCALS', 'FX', 'PATTERNS', 'MY SOUNDS'];

  const itemsFor = () => {
    let items = Lib.items.filter((i) => i.cat === B.cat);
    if (B.sub !== 'All') items = items.filter((i) => i.sub === B.sub);
    if (B.favOnly) items = items.filter((i) => Lib.favs.has(i.id));
    if (B.q) { const q = B.q.toLowerCase(); items = items.filter((i) => (i.name + ' ' + i.sub + ' ' + (i.tags || []).join(' ')).toLowerCase().includes(q)); }
    const dur = (i) => (i.spec && i.spec.p && i.spec.p.len) || (i.meta && i.meta.duration) || 0;
    const sorts = {
      Name: (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }),
      Length: (a, b) => dur(a) - dur(b), 'Length ↓': (a, b) => dur(b) - dur(a),
      Favorites: (a, b) => (Lib.favs.has(b.id) ? 1 : 0) - (Lib.favs.has(a.id) ? 1 : 0) || a.name.localeCompare(b.name, undefined, { numeric: true }),
      Newest: (a, b) => (b.created || 0) - (a.created || 0),
    };
    return items.sort(sorts[B.sort] || sorts.Name);
  };
  const subsFor = () => { const s = ['All']; Lib.items.forEach((i) => { if (i.cat === B.cat && !s.includes(i.sub)) s.push(i.sub); }); return s; };

  const chordLabel = (prog) => prog.chords.slice(0, 4).map(([semi, q]) => HD.NOTE_NAMES[(S.project.key.root + semi) % 12] + (q === 'M' ? '' : q)).join('  ');
  const miniPattern = (it) => {
    const c = el('canvas', { width: 160, height: 40, class: 'thumb', style: { width: '80px', height: '20px' } }), g = c.getContext('2d');
    c._draw = () => {
      g.clearRect(0, 0, 160, 40);
      if (it.type === 'drum') { const rows = Object.keys(it.pat.rows), rh = 40 / Math.max(3, rows.length); rows.forEach((r, ri) => { const s = it.pat.rows[r]; for (let i = 0; i < s.length; i++) if (s[i] !== '.') { g.fillStyle = ['#ff5d73', '#ff9f43', '#ffd166', '#7bdc7b', '#4da3ff', '#a78bfa', '#f472b6', '#3ddbd9'][ri % 8]; g.globalAlpha = s[i] === 'o' ? 0.45 : 1; g.fillRect((i / 16) * 160, ri * rh, 8, rh - 1); } }); g.globalAlpha = 1; }
      else if (it.type === 'bass') { g.fillStyle = '#4da3ff'; it.pat.n.forEach(([s, o, l]) => g.fillRect((s / 16) * 160, 34 - (o / 12) * 20, Math.max(3, (l / 16) * 160 - 1), 5)); }
      else if (it.type === 'melody') { g.fillStyle = '#3ddbd9'; M.melody(it.mel.seed, { root: 9, scale: 'minor' }, 1, it.mel.den).forEach((n) => g.fillRect((n.s / 4) * 160, 40 - ((n.p - 60) / 24) * 36 - 5, Math.max(3, (n.l / 4) * 160), 4)); }
    };
    return c;
  };

  B.preview = (it) => {
    const e = HD.engine; if (e.ctx.state !== 'running') e.ctx.resume();
    const P = S.project, bpm = P.bpm;
    if (it.type === 'chords') {
      const pr = { Dark: 's_st_dub', Euphoric: 's_st_euph', Soulful: 's_pn_rhodes', Deep: 's_pn_rhodes', Emotional: 's_ch_warm', Minimal: 's_st_classic', Groovy: 's_pn_house', 'Piano House': 's_pn_house' }[it.sub] || 's_pn_house';
      const { notes, bars } = M.chordNotes(it.prog, P.key); e.previewNotes(Lib.byId[pr].preset, notes, bpm, bars * 4, 1);
    } else if (it.type === 'drum') { const { rows, bars } = M.rowsFromPattern(it.pat, A_flavor()); e.previewHits(rows, it.pat.swing, bpm, bars * 4, 2); }
    else if (it.type === 'bass') {
      const notes = M.bassNotes(it.pat, [0, 0], P.key.root); e.previewNotes(Lib.byId['b_deep'].preset, notes, bpm, 8, 1);
      e.previewHits([{ snd: M.FLAVORS[A_flavor()].kick, vol: 0.9, notes: [0, 1, 2, 3, 4, 5, 6, 7].map((s) => ({ s, v: 1 })) }], 0, bpm, 8, 1);
    } else if (it.type === 'melody') e.previewNotes(Lib.byId['s_ld_soft'].preset, M.melody(it.mel.seed, P.key, 4, it.mel.den), bpm, 16, 1);
    else UI.previewItem(it);
  };
  const A_flavor = () => HD.Actions.flavor();

  B.render = () => {
    const root = B.root; root.innerHTML = '';
    const tabs = el('div', { class: 'b-tabs' }, CATS.map((c) => el('button', { class: 'b-tab' + (c === B.cat ? ' on' : ''), text: c, onclick: () => { B.cat = c; B.sub = 'All'; B.render(); } })));
    const search = el('input', { class: 'inp', placeholder: 'Search ' + Lib.items.length + ' sounds…', value: B.q, oninput: (e) => { B.q = e.target.value; B.renderList(); } });
    const sub = UI.select(subsFor(), B.sub, (v) => { B.sub = v; B.renderList(); });
    const sort = UI.select(['Name', 'Length', 'Length ↓', 'Favorites', 'Newest'], B.sort, (v) => { B.sort = v; B.renderList(); });
    const fav = el('button', { class: 'btn small' + (B.favOnly ? ' on' : ''), text: '★ Favorites', onclick: () => { B.favOnly = !B.favOnly; B.render(); } });
    const tools = el('div', { class: 'b-tools' }, sub, sort, fav);
    root.append(tabs, el('div', { class: 'b-search' }, search), tools);
    if (B.cat === 'MY SOUNDS' || B.cat === 'VOCALS') {
      root.append(el('div', { class: 'b-import' },
        el('button', { class: 'btn small primary', text: '⬆ Import audio…', onclick: () => HD.Import.pick() }),
        B.cat === 'MY SOUNDS' ? el('button', { class: 'btn small', text: '✦ Generate sound', onclick: () => HD.Dialogs.generator() }) : el('span', { class: 'hint', text: 'Drop your own vocal files anywhere in the window' })));
    }
    B.list = el('div', { class: 'b-list' }); root.append(B.list);
    B.renderList();
  };

  B.renderList = () => {
    const list = B.list; list.innerHTML = '';
    const items = itemsFor();
    if (!items.length) { list.append(el('div', { class: 'empty', text: B.cat === 'MY SOUNDS' ? 'Nothing here yet. Import audio or use Generate Sound — saved sounds appear here.' : 'No sounds match.' })); return; }
    const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); const c = en.target._thumb; if (c && c._draw) UI.lazyDraw(() => c._draw()); } }), { root: list, rootMargin: '120px' });
    for (const it of items) {
      let thumb;
      if (it.type === 'sample' || it.type === 'import') thumb = UI.thumbCanvas(it, 80, 20, it.cat === 'FX' ? '#f472b6' : it.cat === 'VOCALS' ? '#a78bfa' : it.cat === 'MY SOUNDS' ? '#7bdc7b' : '#6bd');
      else if (it.type === 'inst') { thumb = UI.thumbCanvas(it, 80, 20, it.cat === 'BASS' ? '#4da3ff' : '#3ddbd9'); thumb._draw = () => { const draw = () => HD.drawPeaks(thumb, it.thumb, it.cat === 'BASS' ? '#4da3ff' : '#3ddbd9'); if (it.thumb) return draw(); HD.Inst.bounce(it.preset, it.preset.pv || 60, 0.5, 22050, it.preset.prev || [0]).then((b) => { it.thumb = HD.computePeaks([b.getChannelData(0)], 72); draw(); }).catch(() => {}); }; }
      else if (it.type === 'chords') thumb = el('div', { class: 'chord-lbl', text: chordLabel(it.prog) });
      else { thumb = miniPattern(it); }
      const play = el('button', { class: 'icon-btn play', text: '▶', title: 'Preview', onclick: (e) => { e.stopPropagation(); if (B.playing === it.id) { HD.engine.stopPreview(); B.playing = null; play.textContent = '▶'; return; } B.playing = it.id; B.preview(it); list.querySelectorAll('.play').forEach((b) => (b.textContent = '▶')); play.textContent = '■'; } });
      const fav = el('button', { class: 'icon-btn fav' + (Lib.favs.has(it.id) ? ' on' : ''), text: '★', title: 'Favorite', onclick: (e) => { e.stopPropagation(); if (Lib.favs.has(it.id)) Lib.favs.delete(it.id); else Lib.favs.add(it.id); fav.classList.toggle('on'); HD.Store.setKV('favs', [...Lib.favs]); } });
      const row = el('div', { class: 'b-row', draggable: 'true', title: 'Drag into the timeline — double-click to add at the playhead' },
        play, el('div', { class: 'b-main' }, el('div', { class: 'b-name', text: it.name }), el('div', { class: 'b-sub', text: it.sub + (it.spec && it.spec.p && it.spec.p.len ? ' · ' + it.spec.p.len.toFixed(2) + 's' : it.meta ? ' · ' + HD.fmtDur(it.meta.duration) : '') })), thumb, fav,
        it.user ? el('button', { class: 'icon-btn del', text: '✕', title: 'Delete from My Sounds', onclick: (e) => { e.stopPropagation(); HD.Import.remove(it); } }) : null);
      row._thumb = thumb; io.observe(row);
      row.addEventListener('dragstart', (e) => { e.dataTransfer.setData('application/x-hd', it.id); e.dataTransfer.setData('text/plain', it.name); e.dataTransfer.effectAllowed = 'copy'; document.body.classList.add('dragging-item'); });
      row.addEventListener('dragend', () => document.body.classList.remove('dragging-item'));
      row.addEventListener('dblclick', () => HD.Actions.addItem(it, { trackId: S.sel.track, beat: Math.round(HD.Transport.beat() * 4) / 4 }));
      list.append(row);
    }
  };

  B.init = (root) => { B.root = root; B.render(); HD.bus.on('project', () => { if (B.cat === 'CHORDS') B.renderList(); }); };
})();
