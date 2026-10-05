/* HouseDAW — shared UI components: knob, menu, modal, select, sound picker. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const el = HD.el, UI = (HD.UI = {});

  UI.fmtParam = (d, v) => {
    if (d.curve === 'choice') return d.opts[Math.round(v)] || '';
    const a = Math.abs(v);
    let s = a >= 1000 ? (v / 1000).toFixed(1) + 'k' : a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2);
    if (d.u === 'dB') s = (v > 0 ? '+' : '') + (a >= 10 ? v.toFixed(1) : v.toFixed(1));
    if (d.u === 'Hz') s = v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0);
    return s + (d.u && d.u !== 'Hz' ? (d.u === 'beat' ? '' : ' ' + d.u) : d.u === 'Hz' ? 'Hz' : '');
  };

  // rotary knob. d: {min,max,def,curve,n,u,opts}
  UI.knob = (d, value, o = {}) => {
    const size = o.size || 38, R = size / 2 - 5, cx = size / 2, cy = size / 2, A0 = 0.75 * Math.PI, A1 = 2.25 * Math.PI;
    const toN = (v) => (d.curve === 'log' ? Math.log(v / d.min) / Math.log(d.max / d.min) : (v - d.min) / (d.max - d.min));
    const fromN = (n) => { n = Math.max(0, Math.min(1, n)); let v = d.curve === 'log' ? d.min * Math.pow(d.max / d.min, n) : d.min + (d.max - d.min) * n; if (d.curve === 'choice') v = Math.round(v); return v; };
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('width', size); svg.setAttribute('height', size); svg.setAttribute('class', 'knob-svg');
    const mkp = (cls) => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('class', cls); svg.append(p); return p; };
    const track = mkp('k-track'), arc = mkp('k-arc'), needle = mkp('k-needle');
    const pt = (a, r) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const arcPath = (a0, a1) => { const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R); return `M${x0} ${y0} A${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`; };
    track.setAttribute('d', arcPath(A0, A1));
    const val = el('div', { class: 'k-val' }), lab = el('div', { class: 'k-lab', text: o.label || d.n });
    const root = el('div', { class: 'knob' + (o.cls ? ' ' + o.cls : ''), title: (d.n || '') + ' — drag, wheel, double-click to reset' }, svg, val, lab);
    let cur = value;
    const draw = () => {
      const n = toN(cur), a = A0 + (A1 - A0) * n; arc.setAttribute('d', arcPath(A0, Math.max(A0 + 0.001, a)));
      const [x0, y0] = pt(a, R * 0.35), [x1, y1] = pt(a, R + 1); needle.setAttribute('d', `M${x0} ${y0} L${x1} ${y1}`);
      val.textContent = UI.fmtParam(d, cur);
    };
    root.set = (v) => { cur = v; draw(); }; root.get = () => cur;
    const apply = (v) => { if (v === cur) return; cur = v; draw(); if (o.onInput) o.onInput(v); };
    let startY = 0, startN = 0, active = false;
    root.addEventListener('pointerdown', (e) => {
      if (e.button === 2) return; e.preventDefault(); active = true; startY = e.clientY; startN = toN(cur); root.setPointerCapture(e.pointerId); root.classList.add('active');
      if (o.onStart) o.onStart();
    });
    root.addEventListener('pointermove', (e) => {
      if (!active) return; const dy = startY - e.clientY, sens = e.shiftKey ? 600 : (d.curve === 'choice' ? 40 : 160);
      let v = fromN(startN + dy / sens); if (d.step) v = Math.round(v / d.step) * d.step; apply(v);
    });
    const end = () => { if (!active) return; active = false; root.classList.remove('active'); if (o.onEnd) o.onEnd(); };
    root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
    root.addEventListener('dblclick', () => { if (o.onStart) o.onStart(); apply(d.def); if (o.onEnd) o.onEnd(); });
    root.addEventListener('wheel', (e) => { e.preventDefault(); if (o.onStart) o.onStart(); apply(fromN(toN(cur) + (e.deltaY < 0 ? 1 : -1) * (d.curve === 'choice' ? 1 : 0.03))); if (o.onEnd) o.onEnd(); }, { passive: false });
    if (o.onContext) root.addEventListener('contextmenu', (e) => { e.preventDefault(); o.onContext(e); });
    draw(); return root;
  };

  // context menu
  UI.menu = (items, x, y) => {
    UI.closeMenu();
    const m = el('div', { class: 'ctx-menu' });
    for (const it of items) {
      if (it === '-' || it.sep) { m.append(el('div', { class: 'ctx-sep' })); continue; }
      const row = el('div', { class: 'ctx-item' + (it.disabled ? ' disabled' : '') + (it.head ? ' head' : ''), text: it.label });
      if (!it.disabled && !it.head) row.addEventListener('click', () => { UI.closeMenu(); it.onClick(); });
      m.append(row);
    }
    document.body.append(m);
    const w = m.offsetWidth, h = m.offsetHeight; m.style.left = Math.min(x, innerWidth - w - 6) + 'px'; m.style.top = Math.min(y, innerHeight - h - 6) + 'px';
    setTimeout(() => { UI._mc = (e) => { if (!m.contains(e.target)) UI.closeMenu(); }; document.addEventListener('pointerdown', UI._mc, true); }, 0);
    UI._menu = m; return m;
  };
  UI.closeMenu = () => { if (UI._menu) { UI._menu.remove(); UI._menu = null; } if (UI._mc) { document.removeEventListener('pointerdown', UI._mc, true); UI._mc = null; } };

  UI.modal = ({ title, body, buttons = [], width = 560, cls = '', onClose }) => {
    const back = el('div', { class: 'modal-back' });
    const box = el('div', { class: 'modal ' + cls, style: { width: Math.min(width, innerWidth - 24) + 'px' } });
    const close = () => { back.remove(); document.removeEventListener('keydown', esc); if (onClose) onClose(); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    const head = el('div', { class: 'modal-head' }, el('div', { class: 'modal-title', text: title }), el('button', { class: 'icon-btn', text: '✕', title: 'Close', onclick: close }));
    const foot = buttons.length ? el('div', { class: 'modal-foot' }, buttons.map((b) => el('button', { class: 'btn ' + (b.cls || ''), text: b.label, onclick: () => b.onClick(close) }))) : null;
    box.append(head, el('div', { class: 'modal-body' }, body)); if (foot) box.append(foot);
    back.append(box); document.body.append(back);
    back.addEventListener('pointerdown', (e) => { if (e.target === back && !cls.includes('sticky')) close(); });
    document.addEventListener('keydown', esc);
    return { el: box, close, back };
  };

  UI.select = (options, value, onChange, cls = '') => {
    const s = el('select', { class: 'sel ' + cls });
    for (const o of options) { const [v, l] = Array.isArray(o) ? o : [o, o]; const op = el('option', { value: v, text: l }); if (String(v) === String(value)) op.selected = true; s.append(op); }
    s.addEventListener('change', () => onChange(s.value)); return s;
  };
  UI.chips = (options, value, onChange) => {
    const wrap = el('div', { class: 'chips' });
    const draw = (v) => [...wrap.children].forEach((c) => c.classList.toggle('on', c.dataset.v === String(v)));
    for (const o of options) { const [v, l] = Array.isArray(o) ? o : [o, o]; wrap.append(el('button', { class: 'chip', 'data-v': v, text: l, onclick: () => { draw(v); onChange(v); } })); }
    draw(value); wrap.set = draw; return wrap;
  };
  UI.slider = (min, max, value, step, onInput, onEnd) => {
    const i = el('input', { type: 'range', min, max, step, class: 'range' }); i.value = value;
    i.addEventListener('input', () => onInput(parseFloat(i.value))); if (onEnd) i.addEventListener('change', onEnd); return i;
  };

  // ---- waveform thumbnails for list rows (drawn lazily) ----
  UI.thumbCanvas = (item, w = 80, h = 24, color = '#6bd') => {
    const c = el('canvas', { width: w * 2, height: h * 2, class: 'thumb', style: { width: w + 'px', height: h + 'px' } });
    c._draw = () => {
      const peaks = item.type === 'inst' ? item.thumb : HD.Lib.thumb(item.id);
      if (peaks) HD.drawPeaks(c, peaks, color);
    };
    return c;
  };
  UI.lazyDraw = (() => {
    const q = []; let busy = false;
    const run = () => { if (busy) return; busy = true; const step = () => { const j = q.shift(); if (!j) { busy = false; return; } try { j(); } catch (e) { console.warn(e); } setTimeout(step, 4); }; step(); };
    return (fn) => { q.push(fn); run(); };
  })();

  // generic sound picker modal (used for drum row sounds)
  UI.pickSound = (cats, onPick, title = 'Choose a sound') => {
    const subs = ['All']; HD.Lib.items.filter((i) => i.type !== 'inst' && i.type !== 'chords' && i.type !== 'drum' && i.type !== 'bass' && i.type !== 'melody' && (!cats || cats.includes(i.cat) || (cats.includes('MY') && i.cat === 'MY SOUNDS'))).forEach((i) => { if (!subs.includes(i.sub)) subs.push(i.sub); });
    let sub = cats && cats.sub ? cats.sub : 'All', q = '';
    const list = el('div', { class: 'pick-list' }), search = el('input', { class: 'inp', placeholder: 'Search sounds…' });
    const sel = UI.select(subs, sub, (v) => { sub = v; draw(); });
    const m = UI.modal({ title, width: 520, body: el('div', { class: 'pick' }, el('div', { class: 'pick-bar' }, search, sel), list) });
    const draw = () => {
      list.innerHTML = '';
      const items = HD.Lib.items.filter((i) => (i.type === 'sample' || i.type === 'import') && (sub === 'All' || i.sub === sub) && (!cats || cats.includes(i.cat)) && (!q || (i.name + ' ' + i.tags.join(' ')).toLowerCase().includes(q)));
      items.slice(0, 200).forEach((it) => {
        const th = UI.thumbCanvas(it, 70, 20), row = el('div', { class: 'pick-row' }, el('button', { class: 'icon-btn', text: '▶', onclick: (e) => { e.stopPropagation(); HD.UI.previewItem(it); } }), el('span', { class: 'nm', text: it.name }), th);
        row.addEventListener('click', () => { m.close(); onPick(it); }); list.append(row); UI.lazyDraw(() => th._draw());
      });
      if (!items.length) list.append(el('div', { class: 'empty', text: 'No sounds match.' }));
    };
    search.addEventListener('input', () => { q = search.value.toLowerCase(); draw(); }); draw(); setTimeout(() => search.focus(), 30);
  };

  UI.previewItem = (it) => {
    const e = HD.engine; if (!e) return;
    if (e.ctx.state !== 'running') e.ctx.resume();
    if (it.type === 'sample' || it.type === 'import') { const b = HD.Lib.buffer(it.id) || HD.Lib.bufs[it.id]; if (b) e.previewBuffer(b); }
    else if (it.type === 'inst') e.previewPreset(it.preset, it.preset.pv || 60, it.cat === 'BASS' ? 0.9 : 0.8, it.preset.prev || [0]);
  };
})();
