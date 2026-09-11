'use strict';
/**
 * QR encoder — byte mode, ECC level M, versions 1–10.
 *
 * Written from scratch because the standalone build must carry its own
 * encoder: a downloadable single file cannot depend on a CDN, and a ticket
 * that only renders when the venue has wifi is not a ticket.
 *
 * Emits a boolean matrix. Callers render it (canvas in the browser, SVG on
 * the server). ISO/IEC 18004.
 */

// ── Galois field GF(256), generator 0x11D ────────────────────────────
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(function initGF(){
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11D;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const gmul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

/** Reed–Solomon error-correction codewords for one block. */
function rsEncode(data, ecLen) {
  // Generator polynomial for ecLen symbols.
  let gen = [1];
  for (let i = 0; i < ecLen; i++) {
    const next = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= gmul(gen[j], EXP[i]);
    }
    gen = next;
  }
  const res = new Uint8Array(data.length + ecLen);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const factor = res[i];
    if (!factor) continue;
    for (let j = 0; j < gen.length; j++) res[i + j] ^= gmul(gen[j], factor);
  }
  return res.slice(data.length);
}

// ── Version tables (byte mode, ECC M) ────────────────────────────────
// [ total codewords, ec codewords per block, group1 blocks, group1 data cw,
//   group2 blocks, group2 data cw ]
const VERSIONS = {
  1:  [26,   10, 1, 16,  0, 0],
  2:  [44,   16, 1, 28,  0, 0],
  3:  [70,   26, 1, 44,  0, 0],
  4:  [100,  18, 2, 32,  0, 0],
  5:  [134,  24, 2, 43,  0, 0],
  6:  [172,  16, 4, 27,  0, 0],
  7:  [196,  18, 4, 31,  0, 0],
  8:  [242,  22, 2, 38,  2, 39],
  9:  [292,  22, 3, 36,  2, 37],
  10: [346,  26, 4, 43,  1, 44],
};

const ALIGN = {
  1: [], 2: [6,18], 3: [6,22], 4: [6,26], 5: [6,30],
  6: [6,34], 7: [6,22,38], 8: [6,24,42], 9: [6,26,46], 10: [6,28,50],
};

// Format information for ECC M, mask 0–7 (pre-computed BCH, XOR 0x5412).
const FORMAT_M = [0x5412,0x5125,0x5E7C,0x5B4B,0x45F9,0x40CE,0x4F97,0x4AA0];

// Version information for versions ≥ 7 (BCH 18,6).
const VERSION_INFO = { 7:0x07C94, 8:0x085BC, 9:0x09A99, 10:0x0A4D3 };

function capacity(version) {
  const [total, ecPerBlock, g1, g1cw, g2, g2cw] = VERSIONS[version];
  return g1 * g1cw + g2 * g2cw;
}

function pickVersion(byteLen) {
  for (let v = 1; v <= 10; v++) {
    const charCountBits = v < 10 ? 8 : 16;
    const needed = 4 + charCountBits + byteLen * 8;
    if (needed <= capacity(v) * 8) return v;
  }
  throw new Error('qr: payload too long (max ~270 bytes at ECC M)');
}

/** @returns {{size:number, modules:boolean[][], version:number}} */
function encode(text) {
  const bytes = new TextEncoder().encode(String(text));
  const version = pickVersion(bytes.length);
  const [, ecPerBlock, g1, g1cw, g2, g2cw] = VERSIONS[version];
  const dataCapacity = capacity(version);

  // ── Bit stream: mode (0100) + length + payload + terminator + pad ──
  const bits = [];
  const push = (value, len) => { for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);

  const capBits = dataCapacity * 8;
  for (let i = 0; i < 4 && bits.length < capBits; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const PAD = [0xEC, 0x11];
  for (let i = 0; bits.length < capBits; i++) push(PAD[i % 2], 8);

  const dataCw = new Uint8Array(dataCapacity);
  for (let i = 0; i < dataCapacity; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j];
    dataCw[i] = b;
  }

  // ── Split into blocks, compute EC, then interleave ────────────────
  const blocks = [];
  let offset = 0;
  for (let i = 0; i < g1; i++) { blocks.push(dataCw.slice(offset, offset + g1cw)); offset += g1cw; }
  for (let i = 0; i < g2; i++) { blocks.push(dataCw.slice(offset, offset + g2cw)); offset += g2cw; }
  const ecBlocks = blocks.map(b => rsEncode(b, ecPerBlock));

  const final = [];
  const maxData = Math.max(...blocks.map(b => b.length));
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.length) final.push(b[i]);
  for (let i = 0; i < ecPerBlock; i++) for (const e of ecBlocks) final.push(e[i]);

  // ── Matrix ────────────────────────────────────────────────────────
  const size = version * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(null));  // null = free
  const set = (r, c, v) => { if (r >= 0 && r < size && c >= 0 && c < size) m[r][c] = v; };

  const finder = (r, c) => {
    for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      const inRing = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
      const dark = inRing && (dr === 0 || dr === 6 || dc === 0 || dc === 6
        || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
      set(rr, cc, dark);
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

  for (const a of ALIGN[version]) for (const b of ALIGN[version]) {
    if ((a === 6 && b === 6) || (a === 6 && b === size - 7) || (a === size - 7 && b === 6)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      set(a + dr, b + dc, Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0));
    }
  }

  for (let i = 8; i < size - 8; i++) {
    if (m[6][i] === null) m[6][i] = i % 2 === 0;
    if (m[i][6] === null) m[i][6] = i % 2 === 0;
  }
  set(size - 8, 8, true);   // dark module

  // Reserve format areas so data placement skips them.
  const reserved = [];
  for (let i = 0; i < 9; i++) { reserved.push([8, i], [i, 8]); }
  for (let i = 0; i < 8; i++) { reserved.push([8, size - 1 - i], [size - 1 - i, 8]); }
  for (const [r, c] of reserved) if (m[r][c] === null) m[r][c] = false;
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const r = Math.floor(i / 3), c = i % 3;
      if (m[r][size - 11 + c] === null) m[r][size - 11 + c] = false;
      if (m[size - 11 + c][r] === null) m[size - 11 + c][r] = false;
    }
  }

  // ── Place data, zig-zag from bottom right ─────────────────────────
  const free = Array.from({ length: size }, (_, r) => m[r].map(v => v === null));
  let bit = 0;
  const bitAt = i => (final[i >> 3] >> (7 - (i & 7))) & 1;
  const totalBits = final.length * 8;

  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;                       // skip the vertical timing line
    for (let i = 0; i < size; i++) {
      const up = ((size - 1 - col) & 2) === 0;  // direction alternates per column pair
      const row = up ? size - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (!free[row][c]) continue;
        m[row][c] = bit < totalBits ? bitAt(bit) === 1 : false;
        bit++;
      }
    }
  }

  // ── Masking: try all 8, keep the lowest penalty ───────────────────
  const MASKS = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  let best = null, bestScore = Infinity;
  for (let maskId = 0; maskId < 8; maskId++) {
    const cand = m.map((row, r) => row.map((v, c) => free[r][c] ? (v !== MASKS[maskId](r, c)) : v));
    applyFormat(cand, size, maskId, version);
    const score = penalty(cand, size);
    if (score < bestScore) { bestScore = score; best = cand; }
  }

  return { size, modules: best, version };
}

function applyFormat(mat, size, maskId, version) {
  const fmt = FORMAT_M[maskId];
  for (let i = 0; i < 15; i++) {
    const b = ((fmt >> i) & 1) === 1;
    if (i < 6)       mat[i][8] = b;
    else if (i < 8)  mat[i + 1][8] = b;
    else if (i === 8) mat[8][7] = b;
    else             mat[8][14 - i] = b;

    if (i < 8)       mat[8][size - 1 - i] = b;
    else             mat[size - 15 + i][8] = b;
  }
  mat[size - 8][8] = true;

  if (version >= 7) {
    const vi = VERSION_INFO[version];
    for (let i = 0; i < 18; i++) {
      const b = ((vi >> i) & 1) === 1;
      const r = Math.floor(i / 3), c = i % 3;
      mat[r][size - 11 + c] = b;
      mat[size - 11 + c][r] = b;
    }
  }
}

/** Standard penalty rules 1–4, used to choose the mask. */
function penalty(mat, size) {
  let p = 0;
  // Rule 1 — runs of 5+
  for (let i = 0; i < size; i++) {
    for (const line of [mat[i], mat.map(r => r[i])]) {
      let run = 1;
      for (let j = 1; j < size; j++) {
        if (line[j] === line[j - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
        else run = 1;
      }
    }
  }
  // Rule 2 — 2x2 blocks
  for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
    const v = mat[r][c];
    if (v === mat[r][c + 1] && v === mat[r + 1][c] && v === mat[r + 1][c + 1]) p += 3;
  }
  // Rule 3 — finder-like patterns
  const PAT = [true,false,true,true,true,false,true,false,false,false,false];
  for (let i = 0; i < size; i++) {
    for (const line of [mat[i], mat.map(r => r[i])]) {
      for (let j = 0; j <= size - 11; j++) {
        let fwd = true, rev = true;
        for (let k = 0; k < 11; k++) {
          if (line[j + k] !== PAT[k]) fwd = false;
          if (line[j + k] !== PAT[10 - k]) rev = false;
        }
        if (fwd || rev) p += 40;
      }
    }
  }
  // Rule 4 — dark/light balance
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (mat[r][c]) dark++;
  p += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
  return p;
}

/** Scalable SVG path — used server-side and for printing. */
function toSvg(text, { size: px = 240, margin = 4 } = {}) {
  const { size, modules } = encode(text);
  const total = size + margin * 2;
  let d = '';
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (modules[r][c]) d += `M${c + margin} ${r + margin}h1v1h-1z`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${px}" height="${px}" shape-rendering="crispEdges">`
    + `<rect width="${total}" height="${total}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

module.exports = { encode, toSvg };
