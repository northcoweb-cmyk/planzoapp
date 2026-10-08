/* HouseDAW — AI Producer. A local, rule-based "producer brain": it parses plain-English requests and makes real edits to
   the project. It runs entirely offline (no LLM, no network) and only reports changes it actually made.

   Safety net (so edits never make the track worse):
   1. every edit is small and bounded, and idempotent (asking twice doesn't pile up duplicates or runaway values);
   2. the mix is measured before and after; levels are re-balanced against the reference profile (shifted on purpose for
      requests like "darker" or "brighter") and loudness is matched so the change isn't just "louder = better";
   3. if the measured balance still ends up clearly worse than before, the edit is rolled back and you're told why. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const S = HD.State, Lib = HD.Lib, M = HD.Music, C = HD.Compose, A = HD.Actions, Mix = HD.Mix, An = HD.Analyze;
  const AI = (HD.AI = {});

  const role = Mix.role;
  const tracks = (...roles) => S.project.tracks.filter((t) => roles.includes(role(t)));
  const synths = () => tracks('chords', 'pad', 'lead');
  const bars = (beat) => Math.round(beat / 4) + 1;
  const fmtHz = (v) => (v >= 1000 ? (v / 1000).toFixed(1) + ' kHz' : Math.round(v) + ' Hz');
  const clampTo = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ensureFx = (t, type, params, log) => {
    let fx = t.fx.find((f) => f.type === type);
    if (!fx) { fx = S.newFx(type, params); t.fx.push(fx); log(`Added ${HD.FXDEF[type].name} to “${t.name}”`); }
    else { Object.assign(fx.p, params); fx.bypass = false; log(`Set ${HD.FXDEF[type].name} on “${t.name}”`); }
    return fx;
  };
  const drumRowsBySub = (...subs) => { const out = []; S.project.clips.filter((c) => c.type === 'drum').forEach((c) => c.rows.forEach((r) => { if (subs.includes((Lib.byId[r.snd] || {}).sub)) out.push([c, r]); })); return out; };
  const dropSections = () => S.project.markers.filter((m) => /drop|groove/i.test(m.name));
  const regionOf = () => { const d = dropSections(); if (d.length) return d.map((m) => [m.beat, m.beat + m.bars * 4, m.name]); const L = S.project.loop; return [[L.on ? L.s : 0, L.on ? L.e : Math.max(32, S.endBeat()), L.on ? 'the loop region' : 'the whole song']]; };
  const fxTrack = () => { let t = tracks('fx')[0]; if (!t) t = S.addTrack('audio', 'FX', { color: S.TYPE_COLOR.fx, vol: 0.5 }); return t; };
  const flavor = () => A.flavor();

  // ---------- intent handlers ----------
  // each handler pushes human-readable edits into `log`; `log.tilt = {band: dB}` says how the balance is *meant* to move.
  const H = [];
  const intent = (re, name, fn) => H.push({ re, name, fn });

  intent(/\b(darker|more dark|dark(en)?|moodier|more sinister|gloomy)\b/, 'darker', (log) => {
    log.tilt = { himid: -2.5, air: -3, mid: -1 };
    for (const t of synths()) { const f = t.inst.preset.filt, was = f.f; if (was <= 500) continue; f.f = Math.max(450, Math.round(was * 0.78)); log(`Closed the filter on “${t.name}” ${fmtHz(was)} → ${fmtHz(f.f)}`); }
    for (const t of tracks('hats', 'open')) ensureFx(t, 'eq', { low: 0, mid: 0, high: -2.5 }, log);
    tracks('pad', 'chords').forEach((t) => { t.sendA = Math.min(0.4, (t.sendA || 0) + 0.06); });
    const m = S.project.master.fx.find((f) => f.type === 'eq'); if (m && m.p.high > -2) { m.p.high = HD.round(Math.max(-3, m.p.high - 1), 1); log(`Master EQ high shelf → ${m.p.high.toFixed(1)} dB`); }
  });
  intent(/\b(brighter|more bright|brighten|airier|more air|sparkle)\b/, 'brighter', (log) => {
    log.tilt = { himid: 2.5, air: 3, mid: 1 };
    for (const t of synths()) { const f = t.inst.preset.filt, was = f.f; if (was >= 9000) continue; f.f = Math.min(12000, Math.round(was * 1.3)); log(`Opened the filter on “${t.name}” ${fmtHz(was)} → ${fmtHz(f.f)}`); }
    for (const t of tracks('hats', 'open')) ensureFx(t, 'eq', { low: 0, mid: 0, high: 3 }, log);
    const m = S.project.master.fx.find((f) => f.type === 'eq'); if (m && m.p.high < 2.5) { m.p.high = HD.round(Math.min(3, m.p.high + 1), 1); log(`Master EQ high shelf → +${m.p.high.toFixed(1)} dB`); }
  });
  intent(/\b(energetic|more energy|energy|harder|bigger drop|bigger|more intense|intense|peak|punch up the drop|drop)\b(?!.*riser)/, 'energy', (log) => {
    log.tilt = { himid: 1, air: 1.5 };
    const regs = regionOf(); let boosted = 0, added = 0;
    for (const [cs, ce, nm] of regs) {
      for (const [c, r] of drumRowsBySub('Closed Hat', 'Open Hat', 'Percussion')) {
        if (c.start >= ce || c.start + c.len <= cs) continue;
        r.notes.forEach((n) => { const nv = Math.min(1, n.v + 0.1); if (nv !== n.v) { n.v = HD.round(nv, 2); boosted++; } });
      }
      // clap layer on the off-beat 16th before beat 4 (ghost clap) if the clap rows are plain
      for (const [c, r] of drumRowsBySub('Clap')) { if (c.start >= ce || c.start + c.len <= cs) continue; const cl = c.cl || 4; for (let b = 0; b < cl / 4; b++) { const s = b * 4 + 3.75; if (!r.notes.some((n) => Math.abs(n.s - s) < 0.1)) { r.notes.push({ s, v: 0.45, o: 0 }); added++; } } }
      const fx = fxTrack(); const has = S.project.clips.some((c) => c.track === fx.id && c.start >= cs - 0.01 && c.start <= cs + 2);
      if (!has && nm !== 'the whole song' && nm !== 'the loop region') { S.project.clips.push(C.fxClip(fx, 'cr_bright_01', cs, 8, S.project.bpm), C.fxClip(fx, 'fx_is_02', cs, 4, S.project.bpm)); log(`Added a crash + impact at the start of ${nm} (bar ${bars(cs)})`); }
    }
    if (boosted) log(`Raised the velocity of ${boosted} hat/percussion hits by ~10% in ${regs.map((r) => r[2]).join(', ')}`);
    if (added) log(`Added ${added} ghost clap(s) on the last 16th of bars for extra drive`);
    for (const t of tracks('bass')) { const p = t.inst.preset; if (p.drive < 0.3) { p.drive = HD.round(Math.min(0.3, p.drive + 0.08), 2); log(`Bass drive → ${p.drive.toFixed(2)} on “${t.name}”`); } }
    const ms = S.project.master.mastering; if (ms.punch < 0.45) { ms.punch = HD.round(Math.min(0.5, ms.punch + 0.15), 2); ms.preset = null; log(`Mastering punch → ${ms.punch.toFixed(2)}`); }
  });
  intent(/\b(deeper bass|deep(er)? bass|more sub|sub ?bass|bass.*deeper|lower bass|more low end|heavier bass)\b/, 'deeperbass', (log) => {
    log.tilt = { sub: 1.5, bass: 1 };
    for (const t of tracks('bass')) {
      const cur = Lib.byId[t.inst.presetId] || {}, deep = ['b_deep', 'b_sub', 'b_warm', 'b_garage'].includes(cur.id);
      if (!deep) { S.setInstrument(t, Lib.byId['b_deep'].preset); log(`Switched “${t.name}” to the Deep House Bass preset`); }
      const p = t.inst.preset; if (p.sub < 0.3) { p.sub = HD.round(Math.min(0.3, (p.sub || 0) + 0.12), 2); log(`Sub layer → ${p.sub.toFixed(2)} on “${t.name}”`); }
      if (p.filt.f > 500) { p.filt.f = Math.max(500, Math.round(p.filt.f * 0.85)); log(`Bass filter → ${fmtHz(p.filt.f)}`); }
      let shifted = 0; S.clipsOf(t.id).filter((c) => c.type === 'midi' && c.notes.length).forEach((c) => { const mn = Math.min(...c.notes.map((n) => n.p)); if (mn > 45) { c.notes.forEach((n) => (n.p -= 12)); shifted++; } });
      if (shifted) log(`Dropped ${shifted} bass clip(s) down an octave (they were sitting high)`);
    }
  });
  intent(/\b(punchier|punchy|more punch|tighter drums|punch.*drums|drums.*punch|snappier)\b/, 'punch', (log) => {
    log.tilt = { sub: -0.5, himid: 1 };
    const k = drumRowsBySub('Kick'); let swapped = 0;
    for (const [, r] of k) { if (!/^k_(punch|hard|tight)/.test(r.snd)) { r.snd = 'k_punch_03'; swapped++; } }
    if (swapped) log(`Swapped ${swapped} kick row(s) for the tighter “Punchy House Kick 03”`);
    const kt = new Set(k.map(([c]) => c.track));
    kt.forEach((id) => {
      const t = S.track(id), kicksOnly = t.fx.length === 0;
      if (kicksOnly) { t.fx = [S.newFx('eq', { low: 1.5, mid: -1.5, midf: 300, high: 1 }), S.newFx('comp', { thr: -14, ratio: 4, attack: 0.02, release: 0.12, makeup: 1 }), S.newFx('sat', { drive: 0.15, mix: 0.4 })]; log(`Added a gentle punch chain to “${t.name}” (EQ → compressor → light saturation)`); }
      else { const c = t.fx.find((f) => f.type === 'comp'); if (c && c.p.ratio < 5) { c.p.ratio = HD.round(Math.min(5, c.p.ratio + 1), 1); c.p.attack = 0.02; log(`Compression ratio on “${t.name}” → ${c.p.ratio.toFixed(1)}`); } }
    });
    const cl = drumRowsBySub('Clap', 'Snare'); cl.forEach(([, r]) => { r.vol = Math.min(1.15, (r.vol || 1) + 0.06); }); if (cl.length) log('Raised clap/snare level slightly for snap');
    const ms = S.project.master.mastering; if (ms.punch < 0.5) { ms.punch = HD.round(Math.min(0.5, ms.punch + 0.12), 2); ms.preset = null; log(`Mastering punch → ${ms.punch.toFixed(2)}`); }
  });
  intent(/\b(wider|wide|more stereo|stereo width|widen|bigger stereo)\b/, 'wider', (log) => {
    for (const t of synths()) { const p = t.inst.preset; if ((p.width || 1) >= 1.6) continue; p.width = HD.round(Math.min(1.6, (p.width || 1) + 0.25), 2); if (!t.fx.some((f) => f.type === 'chorus')) ensureFx(t, 'chorus', { rate: 0.5, depth: 0.45, mix: 0.3 }, () => {}); log(`Widened “${t.name}” (width ${p.width.toFixed(2)}, subtle chorus)`); }
    log.note = 'Bass, kick and the low mids stay mono on purpose — that keeps the club low end tight.';
  });
  intent(/\b(percussion|perc groove|add (some )?perc|percussive|conga|shaker|bongo)\b/, 'perc', (log) => {
    const P = S.project, regs = regionOf(), flavorId = flavor();
    let t = P.tracks.find((x) => x.name === 'Perc Groove'); const fresh = !t;
    if (!t) { t = S.addTrack('drum', 'Perc Groove', { color: S.TYPE_COLOR.perc, vol: 0.45 }); t.sendB = 0.08; } else P.clips = P.clips.filter((c) => c.track !== t.id); // asking again swaps in a different pattern instead of stacking
    const pats = ['dp_perc', 'dp_afro', 'dp_bounce', 'dp_dusty'], used = (P.percIdx = ((P.percIdx || 0) + 1) % pats.length), pat = pats[used];
    for (const [cs, ce, nm] of regs) { const c = C.drumClip(t, cs, (ce - cs) / 4, pat, flavorId, ['rim', 'shaker', 'conga', 'bongo', 'tom', 'perc'], { name: 'Perc groove' }); if (c) P.clips.push(c); log(`${fresh ? 'Added' : 'Swapped in'} a ${M.DRUMPATS.find((p) => p.id === pat).name} percussion layer across ${nm} (bars ${bars(cs)}–${bars(ce) - 1})`); }
  });
  intent(/(\d+)[ -]?bar intro|\bintro\b/, 'intro', (log, text) => {
    const m = text.match(/(\d+)[ -]?bar/), n = HD.clamp(m ? parseInt(m[1], 10) : 16, 4, 64), P = S.project, shift = n * 4, flavorId = flavor();
    if (P.markers.some((mk) => mk.beat === 0 && /intro/i.test(mk.name) && mk.bars >= n)) { log.fail(`There is already an intro of ${P.markers.find((mk) => mk.beat === 0).bars} bars at the start.`); return; }
    P.clips.forEach((c) => (c.start += shift)); P.markers.forEach((mk) => (mk.beat += shift)); P.loop.s += shift; P.loop.e += shift;
    P.tracks.forEach((t) => Object.values(t.auto || {}).forEach((l) => l.forEach((p) => (p.t += shift))));
    log(`Moved the existing arrangement ${n} bars later (clips, section markers, loop region and automation)`);
    const mk = (type, name, color, vol) => { let t = tracks(type)[0]; if (!t) { t = S.addTrack('drum', name, { color, vol }); log(`Created “${name}” track`); } return t; };
    const tk = mk('kick', 'Kick', S.TYPE_COLOR.kick, 0.4), th = mk('hats', 'Hats', S.TYPE_COLOR.hat, 0.7), tp = mk('perc', 'Percussion', S.TYPE_COLOR.perc, 0.6);
    const kickSnd = (drumRowsBySub('Kick')[0] || [0, { snd: M.FLAVORS[flavorId].kick }])[1].snd, hatSnd = (drumRowsBySub('Closed Hat')[0] || [0, { snd: M.FLAVORS[flavorId].chat }])[1].snd;
    P.clips.push(C.drumClip(tk, 0, n, 'dp_classic', flavorId, ['kick'], { sounds: { kick: kickSnd }, name: 'Intro kick' })); log(`Kick groove for bars 1–${n}`);
    P.clips.push(C.drumClip(th, Math.min(4, n / 4) * 4, n - Math.min(4, n / 4), 'dp_classic', flavorId, ['chat'], { sounds: { chat: hatSnd }, name: 'Intro hats' })); log(`Hats enter at bar ${Math.min(4, n / 4) + 1}`);
    if (n >= 8) { P.clips.push(C.drumClip(tp, (n / 2) * 4, n / 2, 'dp_dusty', flavorId, ['shaker', 'conga'], { name: 'Intro perc' })); log(`Percussion enters at bar ${n / 2 + 1}`); }
    const pad = tracks('pad')[0] || tracks('chords')[0];
    if (pad && n >= 8) { const src = P.clips.find((c) => c.track === pad.id && c.start >= shift && c.type === 'midi'); if (src) { P.clips.push(S.cloneClip(src, { start: (n / 2) * 4, len: (n / 2) * 4 })); log(`“${pad.name}” fades the harmony in from bar ${n / 2 + 1}`); } }
    const fx = fxTrack(); P.clips.push(C.fxClip(fx, C.fxFit(['fx_rn_', 'fx_rt_'], 4 * 4 * 60 / P.bpm, 1), shift - 16, null, P.bpm, 16)); log(`Added a 4-bar riser into the first section (bars ${n - 3}–${n})`);
    P.markers.forEach((x) => { if (/^intro$/i.test(x.name)) x.name = 'Intro 2'; });
    P.markers.push({ id: HD.uid('mk'), name: 'Intro', beat: 0, bars: n, color: '#4da3ff' }); P.markers.sort((a, b) => a.beat - b.beat);
  });
  intent(/\b(riser|build ?up|build)\b/, 'riser', (log) => {
    const P = S.project, drops = P.markers.filter((m) => /drop|groove/i.test(m.name)).sort((a, b) => a.beat - b.beat);
    let target, label;
    if (drops.length) { const ph = HD.Transport.beat(); const d = drops.find((x) => x.beat > ph + 1) || drops[0]; label = `the ${d.name} (bar ${bars(d.beat)})`; target = d.beat; }
    else { const ph = Math.round(HD.Transport.beat() / 4) * 4; if (ph < 8) { log.fail('I can’t see a drop section. Put the playhead where the drop starts (or use the Song Builder, which labels sections) and ask again.'); return; } target = ph; label = `the playhead position (bar ${bars(target)})`; }
    const fx = fxTrack(), already = P.clips.find((c) => c.track === fx.id && c.type === 'audio' && /^fx_r[ntpg]_/.test(c.snd) && Math.abs(c.start + c.len - target) < 0.6);
    if (already) { log.fail(`There is already a riser ending at ${label}.`); return; }
    const room = target / 4, rb = room >= 8 ? 8 : room >= 4 ? 4 : room >= 2 ? 2 : 1, secs = rb * 4 * 60 / P.bpm, id = C.fxFit(['fx_rn_', 'fx_rt_', 'fx_rp_'], secs, 0);
    P.clips.push(C.fxClip(fx, id, target - rb * 4, null, P.bpm, rb * 4)); log(`Added “${Lib.byId[id].name}” on “${fx.name}”: bars ${bars(target - rb * 4)}–${bars(target) - 1}, ending at ${label}`);
  });
  intent(/\b(underground|dub|warehouse|rawer|raw)\b/, 'underground', (log) => {
    log.tilt = { air: -2, himid: -1.5 };
    const P = S.project, flavorId = flavor();
    if (P.bpm > 130) { A.applyBpm(P, 128); log('Tempo → 128 BPM'); }
    const hats = drumRowsBySub('Closed Hat').filter(([, r]) => !/^hc_(soft|tech|tight)/.test(r.snd)); hats.forEach(([, r]) => { r.snd = 'hc_tech_03'; }); if (hats.length) log(`Swapped ${hats.length} closed-hat row(s) for a drier “Tech Noise” hat`);
    const cl = drumRowsBySub('Clap').filter(([, r]) => r.snd !== 'c_dark_02'); cl.forEach(([, r]) => { r.snd = 'c_dark_02'; }); if (cl.length) log('Changed the claps to a darker, shorter clap');
    for (const t of tracks('bass')) { const want = Math.random() < 0.5 ? 'b_dark' : 'b_min'; if (!['b_dark', 'b_min', 'b_wob', 'b_acid'].includes(t.inst.presetId)) { S.setInstrument(t, Lib.byId[want].preset); log(`“${t.name}” → ${Lib.byId[t.inst.presetId].name}`); } }
    for (const t of synths()) { const f = t.inst.preset.filt; if (f.f > 700) { f.f = Math.max(700, Math.round(f.f * 0.8)); } } if (synths().length) log('Closed the chord/pad/lead filters ~20% for a deeper, murkier tone');
    if (!P.tracks.some((t) => t.name === 'Perc Groove') && !drumRowsBySub('Percussion').length) { const t = S.addTrack('drum', 'Perc Groove', { color: S.TYPE_COLOR.perc, vol: 0.45 }); regionOf().forEach(([cs, ce]) => { const c = C.drumClip(t, cs, (ce - cs) / 4, 'dp_dub', 'minimal', ['rim', 'perc'], { name: 'Dub perc' }); if (c) P.clips.push(c); }); log('Added a sparse dub percussion track (rim + click)'); }
    for (const t of tracks('chords', 'pad')) { if (!t.fx.some((f) => f.type === 'delay')) { ensureFx(t, 'delay', { time: 0.75, fb: 0.4, wet: 0.18, tone: 3000, stereo: 0.7 }, () => {}); log(`Added a dark echo to “${t.name}”`); } }
  });
  intent(/\b(groov(y|ier)|swing|more bounce|bouncier|shuffle|looser)\b/, 'groove', (log) => {
    let n = 0; S.project.clips.filter((c) => c.type === 'drum' && (c.swing || 0) < 0.3).forEach((c) => { c.swing = HD.round(Math.min(0.3, (c.swing || 0) + 0.08), 2); n++; });
    if (n) log(`Added a touch of swing to ${n} drum clip(s) (max 30% — beyond that it starts to sound sloppy)`);
  });
  intent(/\b(louder|more volume|hotter|boost the master)\b/, 'louder', (log) => {
    const ms = S.project.master.mastering; if (ms.loud >= 0.8) { log.fail('The mastering loudness is already near its maximum — pushing further would only squash the dynamics.'); return; }
    ms.loud = HD.round(Math.min(0.8, ms.loud + 0.15), 2); ms.preset = null; ms.on = true; log(`Mastering loudness → ${ms.loud.toFixed(2)} (the limiter protects against clipping)`); log.noLevelMatch = true;
  });
  intent(/\b(quieter|softer overall|less loud|turn it down)\b/, 'quieter', (log) => {
    const ms = S.project.master.mastering; ms.loud = HD.round(Math.max(0, ms.loud - 0.15), 2); ms.preset = null; log(`Mastering loudness → ${ms.loud.toFixed(2)}`); log.noLevelMatch = true;
  });
  intent(/\b(more reverb|reverb|spacier|more space|bigger room|wetter)\b(?!.*(less|remove|no))/, 'reverb', (log) => {
    const ts = tracks('pad', 'chords', 'lead', 'perc', 'clap'); let n = 0; ts.forEach((t) => { if ((t.sendA || 0) < 0.45) { t.sendA = HD.round(Math.min(0.45, (t.sendA || 0) + 0.1), 2); n++; } });
    const s = S.project.sends.a; if (s.fx.p.decay < 3.6) s.fx.p.decay = HD.round(Math.min(3.6, s.fx.p.decay + 0.5), 1);
    if (n) log(`Raised the reverb send on ${n} track(s); reverb tail ${s.fx.p.decay.toFixed(1)}s (kept below the point where it turns to mush)`);
  });
  intent(/\b(less reverb|no reverb|drier|dry|remove (the )?reverb|cleaner)\b/, 'dry', (log) => {
    S.project.tracks.forEach((t) => { if (t.sendA) t.sendA = HD.round(t.sendA * 0.5, 2); t.fx.forEach((f) => { if (f.type === 'reverb' && !f.bypass) { f.bypass = true; log(`Bypassed the reverb on “${t.name}”`); } }); }); log('Halved all reverb sends');
  });
  intent(/\b(faster|speed up|slower|slow down)\b|\b(?:bpm|tempo)\b.*?(\d{2,3})|(\d{2,3})\s*bpm/, 'tempo', (log, text) => {
    const num = text.match(/(\d{2,3})\s*bpm|bpm\D*(\d{2,3})|tempo\D*(\d{2,3})/); let v;
    if (num) v = parseInt(num[1] || num[2] || num[3], 10); else v = S.project.bpm + (/slower|slow/.test(text) ? -2 : 2);
    if (!(v >= 60 && v <= 200)) { log.fail('Tempo must be between 60 and 200 BPM.'); return; }
    const old = S.project.bpm; A.applyBpm(S.project, v); log(`Tempo ${old} → ${S.project.bpm} BPM (percussion loops re-fitted)`); log.noLevelMatch = true;
  });
  intent(/\b(?:key|transpose)\b.*?\b([a-g][#b]?)\s*(major|minor|maj|min)?\b/, 'key', (log, text) => {
    const m = text.match(/\b([a-g])([#b]?)\s*(major|minor|maj|min)?\b/); if (!m) return;
    const NAMES = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }; let root = NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); root = (root + 12) % 12;
    const P = S.project, old = P.key.root; let d = root - old; if (d > 6) d -= 12; if (d < -6) d += 12;
    const scale = m[3] ? (/maj/.test(m[3]) ? 'major' : 'minor') : P.key.scale;
    if (d === 0 && scale === P.key.scale) { log.fail(`The project is already in ${HD.NOTE_NAMES[root]} ${scale}.`); return; }
    let n = 0; P.clips.forEach((c) => { if (c.type === 'midi') { c.notes.forEach((x) => (x.p = HD.clamp(x.p + d, 0, 127))); n++; } });
    P.key = { root, scale }; log(`Transposed ${n} MIDI clip(s) by ${d > 0 ? '+' : ''}${d} semitones; key is now ${HD.NOTE_NAMES[root]} ${scale}`); log.noLevelMatch = true;
  });
  intent(/\badd (?:a |an |some |the )?(kick|clap|hats?|open hats?|percussion|bass(?:line)?|chords?|pad|lead|melody|fx)\b/, 'add', (log, text) => {
    const w = text.match(/\badd (?:a |an |some |the )?(kick|clap|hats?|open hats?|percussion|bass(?:line)?|chords?|pad|lead|melody|fx)\b/)[1];
    const map = { kick: 'kick', clap: 'clap', hat: 'hats', hats: 'hats', 'open hat': 'open', 'open hats': 'open', percussion: 'perc', bass: 'bass', bassline: 'bass', chord: 'chords', chords: 'chords', pad: 'pad', lead: 'lead', melody: 'lead', fx: 'fx' };
    const r = map[w]; if (tracks(r).length) { log.fail(`There is already a ${w} track (“${tracks(r)[0].name}”). Ask me to change it instead — for example “make the ${w} punchier”.`); return; }
    const P = S.project, genre = P.genre || 'House', tmp = (() => { const prev = S.project; const b = C.build({ genre, vibe: P.vibe, mood: 'Groovy', energy: 'Medium', bpm: P.bpm, key: P.key, mode: 'groove', seed: 11 }); S.project = prev; return b; })();
    const names = { kick: 'Kick', clap: 'Clap', hats: 'Hats', open: 'Open Hat', perc: 'Percussion', bass: 'Bass', chords: 'Chords', pad: 'Pad', lead: ['Lead', 'Vocal Chops'], fx: 'FX' };
    const nm = names[r], src = tmp.tracks.find((t) => (Array.isArray(nm) ? nm.includes(t.name) : t.name === nm)); if (!src) return;
    const nt = HD.clone(src); nt.id = HD.uid('trk'); nt.fx.forEach((f) => (f.id = HD.uid('fx'))); P.tracks.push(nt);
    const regs = regionOf(); tmp.clips.filter((c) => c.track === src.id).forEach((c) => { for (const [cs, ce] of regs) { const n = S.cloneClip(c, { track: nt.id, start: cs, len: ce - cs }); if (c.type === 'audio') { n.len = c.len; if (cs > 0) n.start = cs; } P.clips.push(n); } });
    log(`Created a “${nt.name}” track with ${w === 'fx' ? 'transition FX' : 'a groove-matched part'} across ${regs.map((x) => x[2]).join(', ')}`);
  });

  const HELP = ['“Make this darker” / “brighter”', '“Make the drop more energetic”', '“Give me a deeper bass”', '“Make the drums punchier”', '“Add a house percussion groove”', '“Make this sound wider”', '“Create a 16-bar intro”', '“Add a riser before the drop”', '“Give me a more underground house groove”', '“Add reverb” / “less reverb”', '“Faster” / “set tempo to 126 BPM”', '“Change the key to F minor”', '“Add a clap / hats / pad / lead”', '“More swing”', '“Make it louder”'];
  AI.examples = ['Make this darker', 'Make the drums punchier', 'Give me a deeper bass', 'Add a house percussion groove', 'Make this sound wider', 'Create a 16-bar intro', 'Add a riser before the drop', 'Give me a more underground house groove', 'Make the drop more energetic'];

  AI.describe = () => {
    const P = S.project; if (!P.tracks.length) return 'The project is empty. Try the “New House Track” wizard or the Song Builder first.';
    return `${P.name}: ${P.bpm} BPM, ${HD.NOTE_NAMES[P.key.root]} ${P.key.scale}${P.vibe ? ', vibe: ' + P.vibe : ''}, ${Math.ceil(S.endBeat() / 4)} bars, ${P.tracks.length} tracks (${P.tracks.map((t) => t.name).join(', ')}). ` + (P.markers.length ? 'Sections: ' + P.markers.map((m) => `${m.name} (bar ${bars(m.beat)}, ${m.bars} bars)`).join(', ') + '.' : 'No section markers yet.');
  };

  // ---------- main entry (async: it measures the mix before and after) ----------
  AI.respond = async (raw, onStatus) => {
    const text = raw.toLowerCase().trim(); if (!text) return null;
    if (!S.project) return { ok: false, reply: 'Open or create a project first.' };
    if (/^(help|what can you do|how|\?)/.test(text) || /what can you/.test(text)) return { ok: true, reply: 'I’m a local, rule-based producer assistant — I run offline and I only report edits I actually made. Every edit is measured before/after and level-matched, and rolled back if it makes the mix worse. I can handle requests like:\n• ' + HELP.join('\n• ') };
    if (/\b(describe|summary|summari[sz]e|what do i have|status|analy[sz]e)\b/.test(text)) {
      if (/analy[sz]e|status/.test(text) && S.project.tracks.length) { const a = await Mix.measure(S.project), T = An.TARGETS.house; return { ok: true, reply: AI.describe() + '\nMeasured balance vs the reference house profile (dB, + = more than the profile): ' + Object.keys(a.bands).map((k) => `${k} ${(a.bands[k] - T[k] > 0 ? '+' : '') + (a.bands[k] - T[k]).toFixed(1)}`).join(', ') + `. Average error ${An.distance(a, T).toFixed(1)} dB.` }; }
      return { ok: true, reply: AI.describe() };
    }
    if (!S.project.tracks.length && !/intro|add/.test(text)) return { ok: false, reply: 'There’s nothing in the project yet for me to change. Create a groove first (New House Track), then ask again.' };
    const matches = H.filter((h) => h.re.test(text));
    if (!matches.length) return { ok: false, reply: 'I didn’t understand that as an edit, so I changed nothing. I’m a rule-based assistant — try one of these:\n• ' + HELP.slice(0, 8).join('\n• ') };
    const order = ['intro', 'riser', 'key', 'tempo', 'add', 'perc', 'deeperbass', 'punch', 'underground', 'wider', 'darker', 'brighter', 'dry', 'reverb', 'groove', 'louder', 'quieter', 'energy'];
    matches.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
    const todo = matches.length > 1 && !/\band\b|,/.test(text) ? [matches[0]] : matches.slice(0, 3);
    const changes = [], tilt = {}; let fail = null, noMatch = false;
    const snap = S.begin(), P0 = S.project;
    let before = null; const region = Mix.region(P0, 4), canMeasure = P0.tracks.length > 0 && P0.clips.length > 0;
    try {
      if (canMeasure) { if (onStatus) onStatus('Measuring the mix…'); before = await Mix.measure(P0, region); }
      for (const h of todo) {
        const log = (m) => changes.push(m); log.fail = (m) => (fail = m);
        const n0 = changes.length; h.fn(log, text); if (log.tilt) for (const k in log.tilt) tilt[k] = (tilt[k] || 0) + log.tilt[k]; if (log.noLevelMatch) noMatch = true; if (log.note) changes.note = log.note; void n0;
      }
    } catch (e) { console.error(e); S.project = JSON.parse(snap); S.afterReplace(); return { ok: false, reply: 'Something went wrong while editing, so I rolled everything back. (' + e.message + ')' }; }
    if (!changes.length) return { ok: false, reply: fail || 'I understood the request but there was nothing I could change (for example the matching tracks don’t exist yet, or the setting is already at its safe limit), so the project is untouched.' };

    // ---- safety net: re-balance, match loudness, and roll back if the result is measurably worse ----
    let verdict = '';
    if (canMeasure && P0.clips.length) {
      try {
        if (onStatus) onStatus('Checking the result…');
        const T0 = An.TARGETS.house, T1 = { ...T0 }; for (const k in tilt) if (T1[k] != null) T1[k] += tilt[k];
        const d0 = An.distance(before, T0); let re = null;
        if (!noMatch) { re = await Mix.autoMix(P0, { target: T1, iterations: 1, region, bars: 4, holdRms: before.rms }); changes.push(...re.log.map((l) => `Re-balanced: ${l}`)); } // also holds loudness steady
        const after = re ? re.analysis : await Mix.measure(P0, region), d1 = An.distance(after, T1);
        if (d1 > d0 + 2.0 && d1 > 2.5) { S.project = JSON.parse(snap); S.afterReplace(); return { ok: false, reply: `I tried “${raw}” but, measured against the reference house profile, it made the mix worse (average balance error ${d0.toFixed(1)} dB → ${d1.toFixed(1)} dB), so I undid it and left your project exactly as it was. Try a smaller step, or tell me which element to change.` }; }
        verdict = `\nChecked: balance error vs the reference profile ${d0.toFixed(1)} dB → ${d1.toFixed(1)} dB; loudness ${noMatch ? 'changed on purpose' : `held within ${Math.abs(before.rms - after.rms).toFixed(1)} dB of before`}.`;
      } catch (e) { console.warn('post-check skipped', e); }
    }
    S.end(snap, 'AI Producer: ' + raw.slice(0, 40), 'structure');
    return { ok: true, changes, reply: 'Done — here’s exactly what I changed (Ctrl+Z undoes all of it):\n• ' + changes.join('\n• ') + (changes.note ? '\n' + changes.note : '') + verdict };
  };
})();
