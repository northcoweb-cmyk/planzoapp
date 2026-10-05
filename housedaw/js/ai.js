/* HouseDAW — AI Producer. A local, rule-based "producer brain": it parses plain-English requests and makes
   real edits to the project. It runs entirely offline (no LLM, no network) and only ever reports changes it
   actually made — every reply is built from the list of edits the handlers performed. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const S = HD.State, Lib = HD.Lib, M = HD.Music, C = HD.Compose, A = HD.Actions;
  const AI = (HD.AI = {});

  const role = (t) => {
    const n = t.name.toLowerCase();
    if (t.type === 'drum') return /kick/.test(n) ? 'kick' : /open/.test(n) ? 'open' : /clap|snare/.test(n) ? 'clap' : /hat/.test(n) ? 'hats' : 'perc';
    if (t.type === 'inst') { const it = t.inst && Lib.byId[t.inst.presetId] || {}; if (it.cat === 'BASS' || /bass/.test(n)) return 'bass'; if (it.sub === 'Pad' || /pad/.test(n)) return 'pad'; if (it.sub === 'Lead' || it.sub === 'Arp' || /lead/.test(n)) return 'lead'; return 'chords'; }
    if (t.type === 'audio') return /fx/.test(n) ? 'fx' : 'audio';
    return 'bus';
  };
  const tracks = (...roles) => S.project.tracks.filter((t) => roles.includes(role(t)));
  const synths = () => tracks('chords', 'pad', 'lead');
  const bars = (beat) => Math.round(beat / 4) + 1;
  const fmtHz = (v) => (v >= 1000 ? (v / 1000).toFixed(1) + ' kHz' : Math.round(v) + ' Hz');
  const ensureFx = (t, type, params, log) => {
    let fx = t.fx.find((f) => f.type === type);
    if (!fx) { fx = S.newFx(type, params); t.fx.push(fx); log(`Added ${HD.FXDEF[type].name} to “${t.name}”`); }
    else { Object.assign(fx.p, params); fx.bypass = false; log(`Adjusted ${HD.FXDEF[type].name} on “${t.name}”`); }
    return fx;
  };
  const drumRowsBySub = (...subs) => { const out = []; S.project.clips.filter((c) => c.type === 'drum').forEach((c) => c.rows.forEach((r) => { if (subs.includes((Lib.byId[r.snd] || {}).sub)) out.push([c, r]); })); return out; };
  const dropSections = () => S.project.markers.filter((m) => /drop|groove/i.test(m.name));
  const regionOf = () => { const d = dropSections(); if (d.length) return d.map((m) => [m.beat, m.beat + m.bars * 4, m.name]); const L = S.project.loop; return [[L.on ? L.s : 0, L.on ? L.e : Math.max(32, S.endBeat()), L.on ? 'the loop region' : 'the whole song']]; };
  const fxTrack = () => { let t = tracks('fx')[0]; if (!t) { t = S.addTrack('audio', 'FX', { color: S.TYPE_COLOR.fx, vol: 0.7 }); } return t; };
  const song = () => ({ genre: S.project.genre || 'House', flavor: A.flavor() });

  // ---------- intent handlers: each returns when done; they push human-readable edits into `log` ----------
  const H = [];
  const intent = (re, name, fn) => H.push({ re, name, fn });

  intent(/\b(darker|more dark|dark(en)?|moodier|more sinister|gloomy)\b/, 'darker', (log) => {
    for (const t of synths()) { const f = t.inst.preset.filt, was = f.f; f.f = Math.max(180, Math.round(was * 0.6)); log(`Lowered filter cutoff on “${t.name}” ${fmtHz(was)} → ${fmtHz(f.f)}`); }
    for (const t of tracks('hats', 'open', 'perc')) ensureFx(t, 'eq', { low: 0, mid: 0, high: -3.5 }, log);
    const pad = tracks('pad', 'chords'); pad.forEach((t) => { t.sendA = Math.min(0.6, (t.sendA || 0) + 0.08); }); if (pad.length) log('Raised reverb send on pads/chords for a deeper space');
    const m = S.project.master.fx.find((f) => f.type === 'eq'); if (m) { m.p.high = Math.max(-6, m.p.high - 1.5); log(`Master EQ high shelf → ${m.p.high.toFixed(1)} dB`); }
  });
  intent(/\b(brighter|more bright|brighten|airier|more air|sparkle)\b/, 'brighter', (log) => {
    for (const t of synths()) { const f = t.inst.preset.filt, was = f.f; f.f = Math.min(16000, Math.round(was * 1.5)); log(`Raised filter cutoff on “${t.name}” ${fmtHz(was)} → ${fmtHz(f.f)}`); }
    for (const t of tracks('hats', 'open')) ensureFx(t, 'eq', { low: 0, mid: 0, high: 4 }, log);
    const m = S.project.master.fx.find((f) => f.type === 'eq'); if (m) { m.p.high = Math.min(8, m.p.high + 1.5); log(`Master EQ high shelf → +${m.p.high.toFixed(1)} dB`); }
  });
  intent(/\b(energetic|more energy|energy|harder|bigger drop|bigger|more intense|intense|peak|punch up the drop|drop)\b(?!.*riser)/, 'energy', (log) => {
    const regs = regionOf(); let added = 0, boosted = 0;
    for (const [cs, ce, nm] of regs) {
      for (const [c, r] of drumRowsBySub('Closed Hat', 'Open Hat', 'Percussion')) {
        if (c.start >= ce || c.start + c.len <= cs) continue;
        r.notes.forEach((n) => { const nv = Math.min(1, n.v + 0.12); if (nv !== n.v) { n.v = HD.round(nv, 2); boosted++; } });
        if ((Lib.byId[r.snd] || {}).sub === 'Closed Hat') { const cl = c.cl || 4; for (let i = 0; i < cl * 4; i++) { if (!r.notes.some((n) => Math.abs(n.s - i * 0.25) < 0.1)) { if (i % 2 === 1) { r.notes.push({ s: i * 0.25, v: 0.38, o: 0 }); added++; } } } }
      }
      const fx = fxTrack(); const has = S.project.clips.some((c) => c.track === fx.id && c.start >= cs - 0.01 && c.start <= cs + 2);
      if (!has && nm !== 'the whole song' && nm !== 'the loop region') { const crash = C.fxClip(fx, 'cr_bright_01', cs, 8, S.project.bpm), imp = C.fxClip(fx, 'fx_is_02', cs, 4, S.project.bpm); S.project.clips.push(crash, imp); log(`Added a crash + impact at the start of ${nm} (bar ${bars(cs)})`); }
    }
    if (boosted) log(`Raised velocity of ${boosted} hat/percussion hits in ${regs.map((r) => r[2]).join(', ')}`);
    if (added) log(`Added ${added} ghost 16th hits to the closed hats for more drive`);
    for (const t of tracks('bass')) { const p = t.inst.preset; p.drive = Math.min(1, (p.drive || 0) + 0.12); log(`Bass drive → ${p.drive.toFixed(2)} on “${t.name}”`); }
    const ms = S.project.master.mastering; if (ms.punch < 0.6) { ms.punch = Math.min(0.9, ms.punch + 0.25); ms.preset = null; log(`Mastering punch → ${ms.punch.toFixed(2)}`); }
  });
  intent(/\b(deeper bass|deep(er)? bass|more sub|sub ?bass|bass.*deeper|lower bass|more low end|heavier bass)\b/, 'deeperbass', (log) => {
    const bs = tracks('bass'); if (!bs.length) return;
    for (const t of bs) {
      const cur = Lib.byId[t.inst.presetId] || {}, target = cur.id === 'b_deep' || cur.id === 'b_sub' || cur.id === 'b_warm' ? null : 'b_deep';
      if (target) { S.setInstrument(t, Lib.byId[target].preset); log(`Switched “${t.name}” to the Deep House Bass preset`); }
      const p = t.inst.preset; p.sub = Math.min(1.2, (p.sub || 0) + 0.25); p.filt.f = Math.max(160, Math.round(p.filt.f * 0.8)); log(`Sub layer → ${p.sub.toFixed(2)}, cutoff ${fmtHz(p.filt.f)}`);
      const lows = S.clipsOf(t.id).filter((c) => c.type === 'midi' && c.notes.length); let shifted = 0;
      lows.forEach((c) => { const mn = Math.min(...c.notes.map((n) => n.p)); if (mn > 38) { c.notes.forEach((n) => (n.p -= 12)); shifted++; } });
      if (shifted) log(`Dropped ${shifted} bass clip(s) down an octave`);
      ensureFx(t, 'eq', { low: 2.5, mid: 0, midf: 400, high: -3 }, log);
    }
  });
  intent(/\b(punchier|punchy|more punch|tighter drums|punch.*drums|drums.*punch|snappier)\b/, 'punch', (log) => {
    const k = drumRowsBySub('Kick'); let swapped = 0;
    for (const [, r] of k) { const cur = Lib.byId[r.snd]; if (!/^k_(punch|hard|tight)/.test(r.snd)) { r.snd = 'k_punch_03'; swapped++; } }
    if (swapped) log(`Swapped ${swapped} kick row(s) for “Punchy House Kick 03”`);
    const kt = new Set(k.map(([c]) => c.track)); kt.forEach((id) => { const t = S.track(id); const ch = HD.FXPRESETS.find((p) => p.name === 'Punchy Kick').chain; if (!t.fx.length) { t.fx = ch.map(([ty, pa]) => S.newFx(ty, pa)); log(`Applied the “Punchy Kick” FX chain (EQ → compressor → saturation) to “${t.name}”`); } else { const c = t.fx.find((f) => f.type === 'comp'); if (c) { c.p.ratio = Math.min(10, c.p.ratio + 1.5); c.p.attack = 0.02; log(`Increased compression ratio on “${t.name}” to ${c.p.ratio.toFixed(1)}`); } } });
    const cl = drumRowsBySub('Clap', 'Snare'); cl.forEach(([, r]) => { r.vol = Math.min(1.25, (r.vol || 1) + 0.1); }); const ct = new Set(cl.map(([c]) => c.track)); ct.forEach((id) => { const t = S.track(id); t.vol = Math.min(1.1, t.vol + 0.06); }); if (cl.length) log('Raised clap/snare level slightly');
    const ms = S.project.master.mastering; ms.punch = Math.min(0.9, ms.punch + 0.2); ms.preset = null; log(`Mastering punch → ${ms.punch.toFixed(2)}`);
  });
  intent(/\b(wider|wide|more stereo|stereo width|widen|bigger stereo)\b/, 'wider', (log) => {
    for (const t of synths()) { const p = t.inst.preset; p.width = Math.min(2, (p.width || 1) + 0.3); ensureFx(t, 'chorus', { rate: 0.5, depth: 0.5, mix: 0.35 }, () => {}); log(`Widened “${t.name}” (instrument width ${p.width.toFixed(2)} + chorus)`); }
    const ms = S.project.master.mastering; ms.width = Math.min(1.5, ms.width + 0.15); ms.preset = null; log(`Master stereo width → ${ms.width.toFixed(2)} (bass stays centred via the instrument bus)`);
  });
  intent(/\b(percussion|perc groove|add (some )?perc|percussive|conga|shaker|bongo)\b/, 'perc', (log) => {
    const regs = regionOf(), P = S.project, { flavor } = song(), t = S.addTrack('drum', S.uniqueName('Percussion'), { color: S.TYPE_COLOR.perc, vol: 0.6 }); t.sendB = 0.08;
    for (const [cs, ce, nm] of regs) { const c = C.drumClip(t, cs, (ce - cs) / 4, 'dp_perc', flavor, ['rim', 'shaker', 'conga', 'bongo', 'tom', 'perc'], { name: 'Perc groove' }); if (c) { P.clips.push(c); } log(`Added a conga/shaker/rim percussion groove across ${nm} (bars ${bars(cs)}–${bars(ce) - 1})`); }
  });
  intent(/(\d+)[ -]?bar intro|\bintro\b/, 'intro', (log, text) => {
    const m = text.match(/(\d+)[ -]?bar/), n = HD.clamp(m ? parseInt(m[1], 10) : 16, 4, 64), P = S.project, shift = n * 4, { flavor } = song();
    P.clips.forEach((c) => (c.start += shift)); P.markers.forEach((mk) => (mk.beat += shift)); P.loop.s += shift; P.loop.e += shift;
    P.tracks.forEach((t) => Object.values(t.auto || {}).forEach((l) => l.forEach((p) => (p.t += shift))));
    log(`Moved the existing arrangement ${n} bars later (clips, section markers, loop region and automation)`);
    const mk = (type, name, color, vol) => { let t = tracks(type)[0]; if (!t) { t = S.addTrack('drum', name, { color, vol }); log(`Created “${name}” track`); } return t; };
    const tk = mk('kick', 'Kick', S.TYPE_COLOR.kick, 0.95), th = mk('hats', 'Hats', S.TYPE_COLOR.hat, 0.55), tp = mk('perc', 'Percussion', S.TYPE_COLOR.perc, 0.6);
    const fl = M.FLAVORS[flavor];
    P.clips.push(C.drumClip(tk, 0, n, 'dp_classic', flavor, ['kick'], { sounds: { kick: fl.kick }, name: 'Intro kick' })); log(`Kick groove for bars 1–${n}`);
    P.clips.push(C.drumClip(th, Math.min(4, n / 4) * 4, n - Math.min(4, n / 4), 'dp_classic', flavor, ['chat'], { name: 'Intro hats' })); log(`Hats enter at bar ${Math.min(4, n / 4) + 1}`);
    if (n >= 8) { P.clips.push(C.drumClip(tp, (n / 2) * 4, n / 2, 'dp_deep', flavor, ['shaker', 'conga'], { name: 'Intro perc' })); log(`Percussion enters at bar ${n / 2 + 1}`); }
    const pad = tracks('pad')[0] || tracks('chords')[0];
    if (pad && n >= 8) { const src = S.project.clips.find((c) => c.track === pad.id && c.start >= shift && c.type === 'midi'); if (src) { P.clips.push(S.cloneClip(src, { start: (n / 2) * 4, len: (n / 2) * 4 })); log(`“${pad.name}” fades the harmony in from bar ${n / 2 + 1}`); } }
    const fx = fxTrack(); P.clips.push(C.fxClip(fx, C.fxFit(['fx_rn_', 'fx_rt_'], 8 * 60 / P.bpm * 2, 1), shift - 16, null, P.bpm, 16)); log(`Added a 4-bar riser into the first section (bar ${n - 3}–${n})`);
    P.markers.forEach((mk) => { if (/^intro$/i.test(mk.name)) mk.name = 'Intro 2'; });
    P.markers.push({ id: HD.uid('mk'), name: 'Intro', beat: 0, bars: n, color: '#4da3ff' }); P.markers.sort((a, b) => a.beat - b.beat);
  });
  intent(/\b(riser|build ?up|build)\b/, 'riser', (log) => {
    const P = S.project, drops = P.markers.filter((m) => /drop|groove/i.test(m.name)).sort((a, b) => a.beat - b.beat);
    let target, label;
    if (drops.length) { const ph = HD.Transport.beat(); target = drops.find((d) => d.beat > ph + 1) || drops[0]; label = `the ${target.name} (bar ${bars(target.beat)})`; target = target.beat; }
    else { const ph = Math.round(HD.Transport.beat() / 4) * 4; if (ph < 8) { log.fail('I can’t see a drop section. Put the playhead where the drop starts (or use the Song Builder, which labels sections) and ask again.'); return; } target = ph; label = `the playhead position (bar ${bars(target)})`; }
    const room = target / 4, rb = room >= 8 ? 8 : room >= 4 ? 4 : room >= 2 ? 2 : 1, fx = fxTrack(), secs = rb * 4 * 60 / P.bpm, id = C.fxFit(['fx_rn_', 'fx_rt_', 'fx_rp_'], secs, 0);
    P.clips.push(C.fxClip(fx, id, target - rb * 4, null, P.bpm, rb * 4)); log(`Added “${Lib.byId[id].name}” on “${fx.name}”: bars ${bars(target - rb * 4)}–${bars(target) - 1}, ending at ${label}`);
    const kicks = drumRowsBySub('Kick'); // brief kick drop-out on the last beat for impact
    if (kicks.length && rb >= 2) { /* no destructive edit */ }
  });
  intent(/\b(underground|dub|warehouse|rawer|raw)\b/, 'underground', (log) => {
    const P = S.project, { flavor } = song();
    if (P.bpm > 124) { A.applyBpm(P, 122); log('Tempo → 122 BPM'); }
    const hats = drumRowsBySub('Closed Hat'); hats.forEach(([, r]) => { if (!/^hc_(soft|tech|tight)/.test(r.snd)) r.snd = 'hc_tech_03'; r.vol = Math.min(r.vol || 1, 0.7); }); if (hats.length) log(`Swapped ${hats.length} closed-hat row(s) for a drier “Tech Noise” hat and lowered their level`);
    const cl = drumRowsBySub('Clap'); cl.forEach(([, r]) => { r.snd = 'c_dark_02'; }); if (cl.length) log('Changed the claps to a darker, shorter clap');
    for (const t of tracks('bass')) { S.setInstrument(t, Lib.byId[Math.random() < 0.5 ? 'b_dark' : 'b_min'].preset); log(`“${t.name}” → ${Lib.byId[t.inst.presetId].name}`); }
    for (const t of synths()) { t.inst.preset.filt.f = Math.max(250, Math.round(t.inst.preset.filt.f * 0.65)); } if (synths().length) log('Closed the filter on the chord/pad/lead instruments by ~35%');
    const rim = tracks('perc')[0]; const regs = regionOf(); if (!drumRowsBySub('Percussion').length) { const t = S.addTrack('drum', S.uniqueName('Percussion'), { color: S.TYPE_COLOR.perc, vol: 0.55 }); regs.forEach(([cs, ce]) => { const c = C.drumClip(t, cs, (ce - cs) / 4, 'dp_dub', 'minimal', ['rim', 'perc'], { name: 'Dub perc' }); if (c) P.clips.push(c); }); log('Added a sparse dub percussion track (rim + click)'); }
    for (const t of tracks('chords', 'pad')) { const fx = ensureFx(t, 'delay', { time: 0.75, fb: 0.5, wet: 0.25, tone: 2500, stereo: 0.7 }, () => {}); log(`Added a dark echo to “${t.name}”`); }
  });
  intent(/\b(groov(y|ier)|swing|more bounce|bouncier|shuffle|looser)\b/, 'groove', (log) => {
    let n = 0; S.project.clips.filter((c) => c.type === 'drum').forEach((c) => { c.swing = Math.min(0.5, (c.swing || 0) + 0.15); n++; }); log(`Increased swing on ${n} drum clip(s)`);
  });
  intent(/\b(louder|more volume|hotter|boost the master)\b/, 'louder', (log) => {
    const ms = S.project.master.mastering; ms.loud = Math.min(1, ms.loud + 0.2); ms.preset = null; ms.on = true; log(`Mastering loudness → ${ms.loud.toFixed(2)} (limiter protects against clipping)`);
  });
  intent(/\b(quieter|softer overall|less loud|turn it down)\b/, 'quieter', (log) => {
    const ms = S.project.master.mastering; ms.loud = Math.max(0, ms.loud - 0.2); ms.preset = null; log(`Mastering loudness → ${ms.loud.toFixed(2)}`);
  });
  intent(/\b(more reverb|reverb|spacier|more space|bigger room|wetter)\b(?!.*(less|remove|no))/, 'reverb', (log) => {
    const ts = tracks('pad', 'chords', 'lead', 'perc', 'clap'); ts.forEach((t) => { t.sendA = Math.min(0.7, (t.sendA || 0) + 0.12); }); const s = S.project.sends.a; s.fx.p.decay = Math.min(6, s.fx.p.decay + 0.6); log(`Raised the reverb send on ${ts.length} track(s) and lengthened the reverb tail to ${s.fx.p.decay.toFixed(1)}s`);
  });
  intent(/\b(less reverb|no reverb|drier|dry|remove (the )?reverb|cleaner)\b/, 'dry', (log) => {
    S.project.tracks.forEach((t) => { if (t.sendA) { t.sendA = HD.round(t.sendA * 0.4, 2); } }); S.project.tracks.forEach((t) => t.fx.forEach((f) => { if (f.type === 'reverb' && !f.bypass) { f.bypass = true; log(`Bypassed the reverb on “${t.name}”`); } })); log('Reduced all reverb sends to 40% of their level');
  });
  intent(/\b(faster|speed up|slower|slow down)\b|\b(?:bpm|tempo)\b.*?(\d{2,3})|(\d{2,3})\s*bpm/, 'tempo', (log, text) => {
    const num = text.match(/(\d{2,3})\s*bpm|bpm\D*(\d{2,3})|tempo\D*(\d{2,3})/); let v;
    if (num) v = parseInt(num[1] || num[2] || num[3], 10); else v = S.project.bpm + (/slower|slow/.test(text) ? -4 : 4);
    if (!(v >= 60 && v <= 200)) { log.fail('Tempo must be between 60 and 200 BPM.'); return; }
    const old = S.project.bpm; A.applyBpm(S.project, v); log(`Tempo ${old} → ${S.project.bpm} BPM (percussion loops re-fitted)`);
  });
  intent(/\b(?:key|transpose)\b.*?\b([a-g][#b]?)\s*(major|minor|maj|min)?\b/, 'key', (log, text) => {
    const m = text.match(/\b([a-g])([#b]?)\s*(major|minor|maj|min)?\b/); if (!m) return;
    const NAMES = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }; let root = NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); root = (root + 12) % 12;
    const P = S.project, old = P.key.root; let d = root - old; if (d > 6) d -= 12; if (d < -6) d += 12;
    const scale = m[3] ? (/maj/.test(m[3]) ? 'major' : 'minor') : P.key.scale;
    if (d === 0 && scale === P.key.scale) { log.fail(`The project is already in ${HD.NOTE_NAMES[root]} ${scale}.`); return; }
    let n = 0; P.clips.forEach((c) => { if (c.type === 'midi') { c.notes.forEach((x) => (x.p = HD.clamp(x.p + d, 0, 127))); n++; } });
    P.key = { root, scale }; log(`Transposed ${n} MIDI clip(s) by ${d > 0 ? '+' : ''}${d} semitones; key is now ${HD.NOTE_NAMES[root]} ${scale}`);
  });
  intent(/\badd (?:a |an |some |the )?(kick|clap|hats?|open hats?|percussion|bass(?:line)?|chords?|pad|lead|melody|fx)\b/, 'add', (log, text) => {
    const w = text.match(/\badd (?:a |an |some |the )?(kick|clap|hats?|open hats?|percussion|bass(?:line)?|chords?|pad|lead|melody|fx)\b/)[1];
    const map = { kick: 'kick', clap: 'clap', hat: 'hats', hats: 'hats', 'open hat': 'open', 'open hats': 'open', percussion: 'perc', bass: 'bass', bassline: 'bass', chord: 'chords', chords: 'chords', pad: 'pad', lead: 'lead', melody: 'lead', fx: 'fx' };
    const r = map[w]; if (tracks(r).length) { log.fail(`There is already a ${w} track (“${tracks(r)[0].name}”). Ask me to change it instead — for example “make the ${w} punchier”.`); return; }
    const P = S.project, genre = P.genre || 'House', tmp = (() => { const prev = S.project; const b = C.build({ genre, mood: 'Groovy', energy: 'Medium', bpm: P.bpm, key: P.key, mode: 'groove', seed: 11 }); S.project = prev; return b; })();
    const names = { kick: 'Kick', clap: 'Clap', hats: 'Hats', open: 'Open Hat', perc: 'Percussion', bass: 'Bass', chords: 'Chords', pad: 'Pad', lead: 'Lead', fx: 'FX' }; const src = tmp.tracks.find((t) => t.name === names[r]); if (!src) return;
    const nt = HD.clone(src); nt.id = HD.uid('trk'); nt.fx.forEach((f) => (f.id = HD.uid('fx'))); P.tracks.push(nt);
    const regs = regionOf(); tmp.clips.filter((c) => c.track === src.id).forEach((c) => { for (const [cs, ce] of regs) { const n = S.cloneClip(c, { track: nt.id, start: cs, len: ce - cs }); if (c.type === 'audio') { n.len = c.len; if (cs > 0) n.start = cs; } P.clips.push(n); } });
    log(`Created a “${nt.name}” track with ${w === 'fx' ? 'transition FX' : 'a groove-matched part'} across ${regs.map((x) => x[2]).join(', ')}`);
  });

  const HELP = ['“Make this darker” / “brighter”', '“Make the drop more energetic”', '“Give me a deeper bass”', '“Make the drums punchier”', '“Add a house percussion groove”', '“Make this sound wider”', '“Create a 16-bar intro”', '“Add a riser before the drop”', '“Give me a more underground house groove”', '“Add reverb” / “less reverb”', '“Faster” / “set tempo to 126 BPM”', '“Change the key to F minor”', '“Add a clap / hats / pad / lead”', '“More swing”', '“Make it louder”'];
  AI.examples = ['Make this darker', 'Make the drums punchier', 'Give me a deeper bass', 'Add a house percussion groove', 'Make this sound wider', 'Create a 16-bar intro', 'Add a riser before the drop', 'Give me a more underground house groove', 'Make the drop more energetic'];

  AI.describe = () => {
    const P = S.project; if (!P.tracks.length) return 'The project is empty. Try the “New House Track” wizard or the Song Builder first.';
    return `${P.name}: ${P.bpm} BPM, ${HD.NOTE_NAMES[P.key.root]} ${P.key.scale}, ${Math.ceil(S.endBeat() / 4)} bars, ${P.tracks.length} tracks (${P.tracks.map((t) => t.name).join(', ')}). ` + (P.markers.length ? 'Sections: ' + P.markers.map((m) => `${m.name} (bar ${bars(m.beat)}, ${m.bars} bars)`).join(', ') + '.' : 'No section markers yet.');
  };

  // returns {reply, changes[], ok}
  AI.respond = (raw) => {
    const text = raw.toLowerCase().trim(); if (!text) return null;
    if (!S.project) return { ok: false, reply: 'Open or create a project first.' };
    if (/^(help|what can you do|how|\?)/.test(text) || /what can you/.test(text)) return { ok: true, reply: 'I’m a local, rule-based producer assistant — I run offline and I only report edits I actually made. I can handle requests like:\n• ' + HELP.join('\n• ') };
    if (/\b(describe|summary|summari[sz]e|what do i have|status|analy[sz]e)\b/.test(text)) return { ok: true, reply: AI.describe() };
    if (!S.project.tracks.length && !/intro|add/.test(text)) return { ok: false, reply: 'There’s nothing in the project yet for me to change. Create a groove first (New House Track), then ask again.' };
    const matches = H.filter((h) => h.re.test(text));
    if (!matches.length) return { ok: false, reply: 'I didn’t understand that as an edit, so I changed nothing. I’m a rule-based assistant — try one of these:\n• ' + HELP.slice(0, 8).join('\n• ') };
    // first matching handler, but the 'tempo' / 'key' / 'add' handlers are checked before generic words
    const order = ['intro', 'riser', 'key', 'tempo', 'add', 'perc', 'deeperbass', 'punch', 'underground', 'wider', 'darker', 'brighter', 'dry', 'reverb', 'groove', 'louder', 'quieter', 'energy'];
    matches.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
    const picked = []; const changes = []; let fail = null;
    const snap = S.begin();
    try {
      const todo = matches.length > 1 && !/\band\b|,/.test(text) ? [matches[0]] : matches.slice(0, 3);
      for (const h of todo) {
        const log = (m) => changes.push(m); log.fail = (m) => (fail = m);
        const before = changes.length; h.fn(log, text); if (changes.length > before) picked.push(h.name);
      }
    } catch (e) { console.error(e); S.project = JSON.parse(snap); S.afterReplace(); return { ok: false, reply: 'Something went wrong while editing, so I rolled everything back. (' + e.message + ')' }; }
    if (!changes.length) return { ok: false, reply: fail || 'I understood the request but there was nothing I could change (for example the matching tracks don’t exist yet), so the project is untouched.' };
    S.end(snap, 'AI Producer: ' + raw.slice(0, 40), 'structure');
    return { ok: true, changes, reply: 'Done — here’s exactly what I changed (Ctrl+Z undoes all of it):\n• ' + changes.join('\n• ') };
  };
})();
