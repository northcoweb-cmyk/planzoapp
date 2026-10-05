/* HouseDAW — audio export: WAV (16/24-bit) and MP3 (bundled lamejs, runs locally). */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  const X = (HD.Export = {});

  X.encodeWav = (buf, bits = 16) => {
    const nCh = 2, n = buf.length, bytes = bits / 8, dataLen = n * nCh * bytes, ab = new ArrayBuffer(44 + dataLen), v = new DataView(ab);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nCh, true);
    v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * nCh * bytes, true); v.setUint16(32, nCh * bytes, true); v.setUint16(34, bits, true); w(36, 'data'); v.setUint32(40, dataLen, true);
    const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    let o = 44, seed = 1;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 8) / 8388608 - 1; };
    for (let i = 0; i < n; i++) {
      for (const d of [L, R]) {
        let x = Math.max(-1, Math.min(1, d[i]));
        if (bits === 16) { x = x * 32767 + (rnd() + rnd()) * 0.5; v.setInt16(o, Math.max(-32768, Math.min(32767, Math.round(x))), true); o += 2; }
        else { const q = Math.round(x * 8388607); v.setUint8(o, q & 255); v.setUint8(o + 1, (q >> 8) & 255); v.setUint8(o + 2, (q >> 16) & 255); o += 3; }
      }
    }
    return new Blob([ab], { type: 'audio/wav' });
  };

  X.loadLame = () => new Promise((res, rej) => {
    if (globalThis.lamejs && globalThis.lamejs.Mp3Encoder) return res();
    const s = document.createElement('script'); s.src = 'js/vendor/lame.min.js'; s.onload = () => res(); s.onerror = () => rej(new Error('MP3 encoder failed to load')); document.head.append(s);
  });
  X.encodeMp3 = async (buf, kbps = 192, onProgress) => {
    await X.loadLame();
    const enc = new lamejs.Mp3Encoder(2, buf.sampleRate, kbps), n = buf.length, step = 1152 * 8, out = [];
    const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    const toI16 = (src, a, z) => { const o = new Int16Array(z - a); for (let i = a; i < z; i++) { const x = Math.max(-1, Math.min(1, src[i])); o[i - a] = x < 0 ? x * 32768 : x * 32767; } return o; };
    for (let i = 0; i < n; i += step) {
      const z = Math.min(n, i + step), chunk = enc.encodeBuffer(toI16(L, i, z), toI16(R, i, z));
      if (chunk.length) out.push(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.length));
      if (onProgress && (i / step) % 40 === 0) { onProgress(i / n); await new Promise((r) => setTimeout(r)); }
    }
    const fl = enc.flush(); if (fl.length) out.push(new Uint8Array(fl.buffer, fl.byteOffset, fl.length));
    return new Blob(out, { type: 'audio/mpeg' });
  };
  X.normalize = (buf, db = -1) => {
    let pk = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; } }
    if (pk < 1e-6) return pk; const g = Math.pow(10, db / 20) / pk;
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= g; }
    return pk;
  };
  X.download = (blob, name) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  };
  X.stats = (buf) => {
    let pk = 0, sum = 0, n = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i += 3) { const a = Math.abs(d[i]); if (a > pk) pk = a; sum += d[i] * d[i]; n++; } }
    return { peakDb: HD.gainToDb(pk), rmsDb: HD.gainToDb(Math.sqrt(sum / n)), dur: buf.duration };
  };
})();
