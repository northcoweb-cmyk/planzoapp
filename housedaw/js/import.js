/* HouseDAW — local audio import: decode (WAV/MP3/OGG/AAC/FLAC… whatever the browser supports, plus a built-in
   AIFF decoder), analyse, store in IndexedDB, add to MY SOUNDS. Files never leave the browser. */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const Imp = (HD.Import = {});
  const Lib = HD.Lib, St = HD.Store;

  Imp.pick = () => {
    const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.accept = 'audio/*,.wav,.mp3,.aif,.aiff,.aifc,.ogg,.m4a,.flac,.aac,.opus,.webm';
    i.onchange = async () => { const items = await Imp.files(i.files); if (items.length) HD.toast('Imported ' + items.length + ' file' + (items.length > 1 ? 's' : '') + ' → MY SOUNDS (drag them into the timeline)'); };
    i.click();
  };

  // minimal AIFF / AIFF-C (PCM, 'sowt') decoder for browsers that can't decode AIFF natively
  Imp.decodeAiff = (ab) => {
    const v = new DataView(ab); const tag = (o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
    if (tag(0) !== 'FORM') throw new Error('Not an AIFF file'); const aifc = tag(8) === 'AIFC';
    let o = 12, ch = 2, frames = 0, bits = 16, sr = 44100, le = false, dataOff = 0;
    while (o + 8 <= v.byteLength) {
      const id = tag(o), size = v.getUint32(o + 4), body = o + 8;
      if (id === 'COMM') {
        ch = v.getUint16(body); frames = v.getUint32(body + 2); bits = v.getUint16(body + 6);
        const exp = ((v.getUint8(body + 8) & 0x7f) << 8) | v.getUint8(body + 9), hi = v.getUint32(body + 10), lo = v.getUint32(body + 14);
        sr = Math.round((hi * 4294967296 + lo) * Math.pow(2, exp - 16383 - 63));
        if (aifc) { const comp = tag(body + 18); if (comp === 'sowt') le = true; else if (comp !== 'NONE' && comp !== 'twos') throw new Error('Compressed AIFF-C is not supported'); }
      } else if (id === 'SSND') { dataOff = body + 8 + v.getUint32(body); }
      o = body + size + (size % 2);
    }
    if (!dataOff) throw new Error('AIFF has no audio data');
    const bytes = bits / 8, chans = Array.from({ length: ch }, () => new Float32Array(frames));
    for (let i = 0; i < frames; i++) for (let c = 0; c < ch; c++) {
      const p = dataOff + (i * ch + c) * bytes; let x;
      if (bits === 8) x = v.getInt8(p) / 128; else if (bits === 16) x = v.getInt16(p, le) / 32768;
      else if (bits === 24) { x = le ? (v.getUint8(p) | (v.getUint8(p + 1) << 8) | (v.getInt8(p + 2) << 16)) : ((v.getInt8(p) << 16) | (v.getUint8(p + 1) << 8) | v.getUint8(p + 2)); x /= 8388608; }
      else x = v.getInt32(p, le) / 2147483648;
      chans[c][i] = x;
    }
    return { chans, sr };
  };

  Imp.decode = async (ab, name) => {
    const ctx = HD.engine.ctx;
    try { return await ctx.decodeAudioData(ab.slice(0)); }
    catch (e) {
      if (/\.(aif|aiff|aifc)$/i.test(name)) {
        const { chans, sr } = Imp.decodeAiff(ab), b = ctx.createBuffer(chans.length, chans[0].length, sr); chans.forEach((d, i) => b.copyToChannel(d, i)); return b;
      }
      throw new Error('This browser can’t decode “' + name + '”. Try WAV or MP3.');
    }
  };

  // analysis: duration, peak/RMS and a rough tempo estimate (onset autocorrelation)
  Imp.analyze = (buf) => {
    const n = buf.length, a = buf.getChannelData(0), b = buf.numberOfChannels > 1 ? buf.getChannelData(1) : a;
    let pk = 0, sum = 0; for (let i = 0; i < n; i += 2) { const x = (a[i] + b[i]) / 2; const ax = Math.abs(x); if (ax > pk) pk = ax; sum += x * x; }
    const meta = { duration: buf.duration, sr: buf.sampleRate, ch: buf.numberOfChannels, peakDb: HD.gainToDb(pk), rmsDb: HD.gainToDb(Math.sqrt(sum / (n / 2))), bpm: null };
    if (buf.duration > 2.5 && buf.duration < 600) {
      const hop = 512, nf = Math.floor(n / hop), env = new Float32Array(nf), mono = (i) => (a[i] + b[i]) * 0.5;
      let prev = 0; for (let f = 0; f < nf; f++) { let e = 0; for (let i = 0; i < hop; i += 4) { const x = mono(f * hop + i); e += x * x; } e = Math.sqrt(e / (hop / 4)); env[f] = Math.max(0, e - prev); prev = e; }
      const fps = buf.sampleRate / hop; let best = 0, bl = 0;
      for (let bpm = 70; bpm <= 175; bpm += 0.5) { const lag = (60 / bpm) * fps; let s = 0, c = 0; for (let k = 1; k <= 4; k++) { const L = lag * k; for (let f = 0; f + L < nf; f += 2) { const i0 = f, i1 = Math.round(f + L); s += env[i0] * env[i1]; c++; } } s /= c || 1; const w = 1 - Math.abs(bpm - 124) / 400; if (s * w > best) { best = s * w; bl = bpm; } }
      if (bl) meta.bpm = Math.round(bl * 2) / 2;
    }
    return meta;
  };

  Imp.files = async (fileList) => {
    const out = [];
    for (const file of fileList) {
      try {
        if (HD.engine.ctx.state !== 'running') { try { await HD.engine.ctx.resume(); } catch (e) { /* noop */ } }
        const ab = await file.arrayBuffer(), buf = await Imp.decode(ab, file.name), meta = Imp.analyze(buf);
        const id = 'imp_' + HD.hash(file.name + file.size + file.lastModified).toString(36), name = file.name.replace(/\.[^.]+$/, '');
        const created = Date.now(); await St.saveAsset({ id, name, bytes: ab, fileName: file.name, meta, created });
        const it = Lib.addImport(id, name, buf, meta); it.created = created; out.push(it);
        HD.toast(`Imported “${name}” · ${HD.fmtDur(meta.duration)}${meta.bpm ? ' · ~' + meta.bpm + ' BPM (estimate)' : ''}`);
      } catch (e) { console.error(e); HD.toast('Import failed: ' + e.message, 4500); }
    }
    if (out.length && HD.Browser && HD.Browser.root) { HD.Browser.cat = 'MY SOUNDS'; HD.Browser.sub = 'All'; HD.Browser.render(); }
    return out;
  };

  Imp.remove = async (it) => {
    const used = HD.State.project && HD.State.usedSounds().includes(it.id);
    if (used && !confirm('“' + it.name + '” is used in this project. Delete it anyway? (Those clips will go silent.)')) return;
    if (it.type === 'import') await St.deleteAsset(it.id); else await St.deleteSound(it.id);
    delete Lib.byId[it.id]; Lib.items = Lib.items.filter((x) => x !== it); delete Lib.bufs[it.id]; delete Lib.thumbs[it.id];
    HD.Browser.renderList(); HD.toast('Removed “' + it.name + '”');
  };

  // restore everything from IndexedDB at startup
  Imp.loadAll = async () => {
    try {
      for (const a of await St.loadAssets()) {
        try { const buf = await Imp.decode(a.bytes, a.fileName || a.name); const it = Lib.addImport(a.id, a.name, buf, a.meta || Imp.analyze(buf)); it.created = a.created; } catch (e) { console.warn('asset restore failed', a.name, e); }
      }
      for (const s of await St.loadSounds()) {
        if (s.kind === 'preset') { const it = Lib.add({ id: s.id, name: s.name, cat: 'MY SOUNDS', sub: s.sub || 'Instrument', type: 'inst', user: true, preset: s.preset, tags: ['generated', 'instrument'] }); it.created = s.created; }
        else { const it = Lib.addUserSample(s.id, s.name, s.spec, s.sub || 'Generated'); it.created = s.created; }
      }
    } catch (e) { console.warn('restore failed', e); }
  };

  // drag & drop files anywhere in the window
  Imp.hookWindow = () => {
    window.addEventListener('dragover', (e) => { if ([...(e.dataTransfer.types || [])].includes('Files')) e.preventDefault(); });
    window.addEventListener('drop', async (e) => { if (e.defaultPrevented) return; if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); await Imp.files(e.dataTransfer.files); } });
  };
})();
