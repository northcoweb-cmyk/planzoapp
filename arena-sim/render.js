'use strict';
/* ====================================================================
   render.js — ISOMETRIC PIXEL RENDERER.  All visuals live here.
   Sections: 1 basics · 2 logo · 3 seats & 3-level bowl · 4 static world
             5 crowd · 6 rink · (r2) people, booths, gates, shows · (r3) frame
   ==================================================================== */
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let VW = 0, VH = 0, CW = 0, CH = 0, dark = 0, LV = 0;      // LV = level view: 0 all levels, 1 hide upper deck, 2 lower bowl only
const PX = 2, OX = 1210, OY = 170;                           // PX = chunkiness of the pixels
const BLDS = [], TREES = [];
function resize() { VW = innerWidth; VH = innerHeight; CW = Math.ceil(VW / PX); CH = Math.ceil(VH / PX); cv.width = CW; cv.height = CH; ctx.imageSmoothingEnabled = false; }
addEventListener('resize', resize);

/* ---------- 1. basics ---------- */
const iso = (x, y, z = 0) => [(x - y) * 0.5, (x + y) * 0.25 - z * 0.5];
const camIso = () => iso(cam.x, cam.y, 0);
function toWorld(sx, sy) { const [cx, cy] = camIso(); const X = (sx / PX - CW / 2) / cam.z + cx, Y = (sy / PX - CH / 2) / cam.z + cy; return { x: X + 2 * Y, y: 2 * Y - X }; }
function viewRect() {
  const p = [toWorld(0, 0), toWorld(VW, 0), toWorld(0, VH), toWorld(VW, VH)];
  return { x0: Math.min(...p.map(q => q.x)) - 60, x1: Math.max(...p.map(q => q.x)) + 60, y0: Math.min(...p.map(q => q.y)) - 60, y1: Math.max(...p.map(q => q.y)) + 60 };
}
function poly(c, pts, col) { c.fillStyle = col; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); }
function box(c, x, y, w, h, z0, z1, top, left, right) {           // +x face = right side, +y face = left side
  poly(c, [iso(x + w, y, z0), iso(x + w, y + h, z0), iso(x + w, y + h, z1), iso(x + w, y, z1)], right);
  poly(c, [iso(x, y + h, z0), iso(x + w, y + h, z0), iso(x + w, y + h, z1), iso(x, y + h, z1)], left);
  poly(c, [iso(x, y, z1), iso(x + w, y, z1), iso(x + w, y + h, z1), iso(x, y + h, z1)], top);
}
const boxC = (c, x, y, w, h, z0, z1, hex) => box(c, x, y, w, h, z0, z1, shade(hex, 14), shade(hex, -14), shade(hex, -36));
// "oriented" boxes: U runs along a counter/wall, V points out the front
const axisDir = (dx, dy) => Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dy) || 1];
const mkO = (cx, cy, V) => ({ cx, cy, V, U: [-V[1], V[0]] });
const opt = (o, u, v) => [o.cx + o.U[0] * u + o.V[0] * v, o.cy + o.U[1] * u + o.V[1] * v];
function obox(c, o, u0, u1, v0, v1, z0, z1, hex, top) {
  const a = opt(o, u0, v0), b = opt(o, u1, v1);
  box(c, Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), z0, z1, top || shade(hex, 18), shade(hex, -14), shade(hex, -38));
}
function oquad(c, o, u0, u1, v0, v1, z, col) { const a = opt(o, u0, v0), b = opt(o, u1, v0), d = opt(o, u1, v1), e = opt(o, u0, v1); poly(c, [iso(a[0], a[1], z), iso(b[0], b[1], z), iso(d[0], d[1], z), iso(e[0], e[1], z)], col); }
function owall(c, o, u0, u1, v, z0, z1, col) { const a = opt(o, u0, v), b = opt(o, u1, v); poly(c, [iso(a[0], a[1], z0), iso(b[0], b[1], z0), iso(b[0], b[1], z1), iso(a[0], a[1], z1)], col); }
const wd = (o, u, v) => { const q = opt(o, u, v); return q[0] + q[1]; };      // depth key of a local point
function satCol(s) { const t = clamp((s - 30) / 60, 0, 1); return 'hsl(' + (t * 120) + ',85%,52%)'; }
function txtC(c, s, x, y, col, size, align) { c.fillStyle = col; c.font = 'bold ' + size + 'px system-ui'; c.textAlign = align || 'center'; c.fillText(s, x, y); }

/* ---------- 2. team logo (a lynx) ---------- */
function drawLogo(c, x, y, r) {
  c.save(); c.translate(x, y); c.scale(r, r);
  const P = (pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); };
  c.fillStyle = '#14213d'; c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.fill();
  c.fillStyle = '#d42a44'; c.beginPath(); c.arc(0, 0, 0.9, 0, TAU); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 0.07; c.beginPath(); c.arc(0, 0, 0.8, 0, TAU); c.stroke();
  for (const s of [-1, 1]) {
    P([[s * 0.56, -0.66], [s * 0.26, -0.2], [s * 0.64, -0.08]], '#f4efe6');            // ears
    P([[s * 0.56, -0.66], [s * 0.5, -0.86], [s * 0.4, -0.58]], '#14213d');             // ear tufts
    P([[s * 0.5, 0.2], [s * 0.74, 0.36], [s * 0.4, 0.42]], '#f4efe6');                 // cheek ruffs
  }
  P([[-0.56, -0.1], [-0.5, 0.22], [-0.28, 0.5], [0, 0.64], [0.28, 0.5], [0.5, 0.22], [0.56, -0.1], [0.28, -0.24], [-0.28, -0.24]], '#f4efe6');   // face
  c.strokeStyle = '#14213d'; c.lineWidth = 0.05; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 0.12, -0.22); c.lineTo(s * 0.08, -0.06); c.moveTo(s * 0.26, -0.2); c.lineTo(s * 0.2, -0.05); c.stroke(); }
  for (const s of [-1, 1]) { c.fillStyle = '#f2c230'; c.beginPath(); c.ellipse(s * 0.27, 0.07, 0.15, 0.09, s * -0.25, 0, TAU); c.fill(); c.fillStyle = '#14213d'; c.fillRect(s * 0.27 - 0.025, -0.01, 0.05, 0.17); }
  P([[0, 0.34], [-0.1, 0.22], [0.1, 0.22]], '#e8728a');
  c.strokeStyle = '#14213d'; c.lineWidth = 0.04; c.beginPath(); c.moveTo(0, 0.34); c.lineTo(0, 0.42); c.moveTo(-0.14, 0.5); c.quadraticCurveTo(0, 0.44, 0.14, 0.5); c.stroke();
  c.restore();
}

/* ---------- 3. seats & the 3-level bowl ---------- */
const R1 = 10, R2 = 9, T_LOW = 0.46, T_CLUB = 0.54;                  // rows in lower / upper bowl; radial split of the three levels
const fAng = a => (Math.cos(a) + Math.sin(a)) / 1.4142;               // +1 = near side (cut away, low), -1 = far side (tall)
const lvStep = a => { const u = (fAng(a) + 1) / 2; return { sL: lerp(3.4, 1.7, u), sU: lerp(5.0, 2.4, u), gap: lerp(17, 8, u) }; };
const zLow = (a, r) => 3 + r * lvStep(a).sL;
const zClubFloor = a => zLow(a, R1);
const suiteH = a => Math.min(11, lvStep(a).gap - 2);
const zUp = (a, r) => zClubFloor(a) + lvStep(a).gap + r * lvStep(a).sU;
const rowT = (lvl, r) => lvl === 0 ? r / R1 * T_LOW : T_CLUB + r / R2 * (1 - T_CLUB);
const bowlPt = (a, t) => ep(a, lerp(RING.seatIn[0], RING.seatOut[0], t), lerp(RING.seatIn[1], RING.seatOut[1], t));
const topZ = a => LV === 0 ? zUp(a, R2) : LV === 1 ? zClubFloor(a) + suiteH(a) : zLow(a, R1);
let SEATS = [], SEC_SEATS = [], ROW_SEATS = {}, CLUB_SPOTS = [], occCur = [];
const seatKey = (i, l, r) => (i * 2 + l) * 16 + r;
function buildSeats() {
  SEATS = []; SEC_SEATS = []; ROW_SEATS = {}; CLUB_SPOTS = [];
  const dens = S.capacity / 8000, w = TAU / NSEC;
  for (let i = 0; i < NSEC; i++) SEC_SEATS[i] = [];
  for (let lvl = 0; lvl < 2; lvl++) {
    const RR = lvl ? R2 : R1, n = Math.round((lvl ? 22 : 18) * dens);
    for (let i = 0; i < NSEC; i++) for (let r = 0; r < RR; r++) {
      const list = ROW_SEATS[seatKey(i, lvl, r)] = [];
      for (let c = 0; c < n; c++) {
        const sa = secCenter(i) - w / 2, m = 0.016, a = sa + m + (c + 0.5) / n * (w - 2 * m), p = bowlPt(a, rowT(lvl, r + 0.5));
        const s = { x: p.x, y: p.y, z: lvl ? zUp(a, r + 1) : zLow(a, r + 1), a, sec: i, lvl, r, idx: SEATS.length }; s.h = ((s.idx * 2654435761) >>> 0) / 4294967296; s.h2 = ((s.idx * 40503 + 977) % 9973) / 9973;
        SEATS.push(s); SEC_SEATS[i].push(s); list.push(s);
      }
    }
    // suites: three people in each box
  }
  for (let i = 0; i < NSEC; i++) for (let k = 0; k < 3; k++) { const a = secCenter(i) + (k - 1) * 0.036, p = bowlPt(a, lerp(T_LOW + 0.03, T_CLUB - 0.012, 0.3 + (k % 2) * 0.4)); CLUB_SPOTS.push({ x: p.x, y: p.y, z: zClubFloor(a) + 1, sec: i, k }); }
}
function zAt(x, y) {                                                   // how high is the floor here? (fans climb the stairs)
  const dx = x - C.x, dy = y - C.y;
  if (Math.hypot(dx / RING.seatOut[0], dy / RING.seatOut[1]) > 1 || Math.hypot(dx / RING.seatIn[0], dy / RING.seatIn[1]) < 1) return 0;
  let lo = 0, hi = 1;
  for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (Math.hypot(dx / lerp(RING.seatIn[0], RING.seatOut[0], m), dy / lerp(RING.seatIn[1], RING.seatOut[1], m)) > 1) lo = m; else hi = m; }
  const t = (lo + hi) / 2, a = Math.atan2(dy / lerp(RING.seatIn[1], RING.seatOut[1], t), dx / lerp(RING.seatIn[0], RING.seatOut[0], t));
  return t < T_LOW ? zLow(a, t / T_LOW * R1) : t < T_CLUB ? zClubFloor(a) : zUp(a, (t - T_CLUB) / (1 - T_CLUB) * R2);
}
const TOWERS = [0.785, 2.356, 3.927, 5.498].map(a => ep(a, RING.wall[0] + 90, RING.wall[1] + 70));
const LAMPS = [];                                                      // parking-lot light poles (filled in buildIso)

/* ---------- 4. static world — pre-rendered ---------- */
let isoCv = null;
function treeIso(c, x, y) {
  const [X, Y] = iso(x, y, 0), h = ((x * 7 + y * 3) | 0) % 5;
  c.fillStyle = '#00000038'; c.fillRect(X - 4, Y - 1, 8, 3);
  c.fillStyle = '#5a3b22'; c.fillRect(X - 1, Y - 5, 2, 5);
  c.fillStyle = ['#235f2c', '#2a6b2c', '#b8681e', '#2a6b2c', '#8a8a2a'][h]; c.beginPath(); c.arc(X, Y - 9, 6, 0, TAU); c.fill();
  c.fillStyle = ['#2f7d37', '#38873a', '#d98a2e', '#38873a', '#aaa83a'][h]; c.beginPath(); c.arc(X - 1.5, Y - 11, 4, 0, TAU); c.fill();
}
function bldgIso(c, b) {
  const z = b.flat ? 7 : Math.max(12, b.ht * 0.75 + 10);
  box(c, b.x, b.y, b.w, b.h, 0, z, shade(b.col, 16), shade(b.col, -14), shade(b.col, -34));
  const lit = (i, j) => (((i * 73856093) ^ (j * 19349663)) >>> 0) % 7 < 3;
  if (!b.flat) {
    for (let xx = b.x + 5, i = 0; xx < b.x + b.w - 7; xx += 9, i++) for (let zz = 5, j = 0; zz < z - 5; zz += 8, j++) poly(c, [iso(xx, b.y + b.h, zz), iso(xx + 4, b.y + b.h, zz), iso(xx + 4, b.y + b.h, zz + 4), iso(xx, b.y + b.h, zz + 4)], lit(i, j) ? '#ffe9a8' : '#2c3340');
    for (let yy = b.y + 5, i = 0; yy < b.y + b.h - 7; yy += 9, i++) for (let zz = 5, j = 0; zz < z - 5; zz += 8, j++) poly(c, [iso(b.x + b.w, yy, zz), iso(b.x + b.w, yy + 4, zz), iso(b.x + b.w, yy + 4, zz + 4), iso(b.x + b.w, yy, zz + 4)], lit(i + 3, j) ? '#e8cf8a' : '#262c38');
    if (b.w > 70 && b.h > 70) { box(c, b.x + b.w * 0.3, b.y + b.h * 0.3, 16, 12, z, z + 6, '#9aa0a8', '#6a7078', '#50565e'); box(c, b.x + b.w * 0.6, b.y + b.h * 0.55, 10, 10, z, z + 4, '#8c939b', '#6a7078', '#50565e'); }
  }
  if (b.label) { c.save(); const [px, py] = iso(b.x + b.w / 2, b.y + b.h / 2, z); c.translate(px, py); c.transform(0.5, 0.25, -0.5, 0.25, 0, 0); c.fillStyle = '#fff'; c.font = 'bold 13px system-ui'; c.textAlign = 'center'; c.fillText(b.label, 0, 5); c.restore(); }
}
const SEAT_RED = '#c42f2f', SEAT_BLUE = '#2b4f9e', SEAT_GOLD = '#c9a23a';
function addRow(L, c, i, lvl, r) {
  const w = TAU / NSEC, a0 = secCenter(i) - w / 2, a1 = a0 + w, t0 = rowT(lvl, r), t1 = rowT(lvl, r + 1);
  const zf = lvl ? zUp : zLow;
  const p00 = bowlPt(a0, t0), p10 = bowlPt(a1, t0), p11 = bowlPt(a1, t1), p01 = bowlPt(a0, t1);
  const col = i === 0 ? SEAT_GOLD : r % 4 === 3 ? (lvl ? '#d9b33a' : '#e6e6e6') : (lvl ? SEAT_BLUE : SEAT_RED), dk = shade(col, -42);
  const seats = ROW_SEATS[seatKey(i, lvl, r)] || [];
  L.push({ k: (p00.x + p10.x + p11.x + p01.x + p00.y + p10.y + p11.y + p01.y) / 4, f: () => {
    poly(c, [iso(p00.x, p00.y, zf(a0, r)), iso(p10.x, p10.y, zf(a1, r)), iso(p10.x, p10.y, zf(a1, r + 1)), iso(p00.x, p00.y, zf(a0, r + 1))], '#6a6f7a');          // riser
    poly(c, [iso(p00.x, p00.y, zf(a0, r + 1)), iso(p10.x, p10.y, zf(a1, r + 1)), iso(p11.x, p11.y, zf(a1, r + 1)), iso(p01.x, p01.y, zf(a0, r + 1))], '#8d929d');    // tread
    for (const s of seats) { const [X, Y] = iso(s.x, s.y, s.z); c.fillStyle = col; c.fillRect(X - 1.1, Y - 3.2, 2.2, 2.4); c.fillStyle = dk; c.fillRect(X - 1.1, Y - 0.9, 2.2, 1.0); }
  } });
}
function addClub(L, c, i) {
  const w = TAU / NSEC, m = 0.012, a0 = secCenter(i) - w / 2 + m, a1 = secCenter(i) + w / 2 - m, tm = lerp(T_LOW, T_CLUB, 0.35);
  const pA = bowlPt(a0, T_LOW), pB = bowlPt(a1, T_LOW), pC = bowlPt(a1, T_CLUB), pD = bowlPt(a0, T_CLUB), sA = bowlPt(a0, tm), sB = bowlPt(a1, tm);
  const za = zClubFloor(a0), zb = zClubFloor(a1), sh = suiteH(a0);
  L.push({ k: (pA.x + pB.x + pC.x + pD.x + pA.y + pB.y + pC.y + pD.y) / 4, f: () => {
    poly(c, [iso(pA.x, pA.y, za), iso(pB.x, pB.y, zb), iso(pC.x, pC.y, zb), iso(pD.x, pD.y, za)], '#4a4f5c');                                   // club concourse floor
    poly(c, [iso(sA.x, sA.y, za), iso(sB.x, sB.y, zb), iso(pC.x, pC.y, zb), iso(pD.x, pD.y, za)], '#2b2f3a');                                    // suite interior
    poly(c, [iso(sA.x, sA.y, za), iso(sB.x, sB.y, zb), iso(sB.x, sB.y, zb + sh), iso(sA.x, sA.y, za + sh)], 'rgba(130,190,230,0.42)');          // glass front
    c.strokeStyle = '#d9b33a'; c.lineWidth = 0.5; for (let k = 0; k <= 4; k++) { const q = (u, z) => iso(lerp(sA.x, sB.x, u), lerp(sA.y, sB.y, u), z + (zb - za) * u); const p1 = q(k / 4, za), p2 = q(k / 4, za + sh); c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.stroke(); }
    poly(c, [iso(sA.x, sA.y, za + sh), iso(sB.x, sB.y, zb + sh), iso(pC.x, pC.y, zb + sh), iso(pD.x, pD.y, za + sh)], '#59616f');                // suite roof
    const zu0 = zUp(a0, 0), zu1 = zUp(a1, 0);
    poly(c, [iso(pD.x, pD.y, za + sh), iso(pC.x, pC.y, zb + sh), iso(pC.x, pC.y, zu1), iso(pD.x, pD.y, zu0)], '#0e1117');                       // LED ribbon board under the upper deck
    for (let k = 0; k < 7; k++) { const u0 = (k + 0.15) / 7, u1 = (k + 0.7) / 7, q = (u, f) => iso(lerp(pD.x, pC.x, u), lerp(pD.y, pC.y, u), lerp(za + sh, zu0, 0.3) + (zb - za) * u + (lerp(zu0, zu1, u) - lerp(zu0, zu1, 0)) * 0); poly(c, [q(u0), q(u1), [q(u1)[0], q(u1)[1] - 0.8], [q(u0)[0], q(u0)[1] - 0.8]], k % 3 === 1 ? '#ffffff' : '#ffb000'); }
  } });
}
function buildIso() {
  const c0 = document.createElement('canvas'); c0.width = 2800; c0.height = 1700;
  const c = c0.getContext('2d'); c.translate(OX, OY);
  poly(c, [iso(W, 0, 0), iso(W, H, 0), iso(W, H, -24), iso(W, 0, -24)], '#4a3826');       // island cliff
  poly(c, [iso(0, H, 0), iso(W, H, 0), iso(W, H, -24), iso(0, H, -24)], '#66503a');
  c.save(); c.transform(0.5, 0.25, -0.5, 0.25, 0, 0); c.drawImage(cityCv, 0, 0);          // flat city map becomes the ground
  c.fillStyle = '#2e3440'; c.beginPath(); c.ellipse(C.x, C.y, RING.wall[0] + 34, RING.wall[1] + 28, 0, 0, TAU); c.fill();
  c.fillStyle = '#a8a39a'; c.beginPath(); c.ellipse(C.x, C.y, RING.wall[0], RING.wall[1], 0, 0, TAU); c.fill();
  c.strokeStyle = '#968f84'; c.lineWidth = 1;
  for (let i = 0; i < 110; i++) { const a = i * TAU / 110, p1 = ep(a, RING.seatOut[0], RING.seatOut[1]), p2 = ep(a, RING.wall[0], RING.wall[1]); c.beginPath(); c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.stroke(); }
  for (let i = 0; i < 8; i++) { c.strokeStyle = '#b8b2a6'; c.beginPath(); c.ellipse(C.x, C.y, RING.seatOut[0] + 10 + i * 14, RING.seatOut[1] + 8 + i * 10.5, 0, 0, TAU); c.stroke(); }
  c.fillStyle = '#00000050'; c.font = 'bold 11px system-ui'; c.textAlign = 'center';
  for (let i = 0; i < NSEC; i++) { const p = ep(secCenter(i), RING.seatOut[0] + 22, RING.seatOut[1] + 16); c.fillText(i ? 101 + i : 'VIP', p.x, p.y + 4); }
  if (S.decor.floorlogo) for (let g = 0; g < 4; g++) { const p = ep(GATE_A[g], RING.conc[0] - 40, RING.conc[1] - 29); c.save(); c.translate(p.x, p.y); drawLogo(c, 0, 0, 26); c.restore(); }
  // parking-lot detail: lane arrows are in the map; add poles + driveway booths below
  c.restore();
  const L = [];
  BLDS.forEach(b => L.push({ k: b.x + b.w / 2 + b.y + b.h / 2, f: () => bldgIso(c, b) }));
  TREES.forEach(t => { if (Math.pow((t[0] - C.x) / (RING.wall[0] + 80), 2) + Math.pow((t[1] - C.y) / (RING.wall[1] + 70), 2) > 1) L.push({ k: t[0] + t[1], f: () => treeIso(c, t[0], t[1]) }); });
  // ---- the three-level bowl ----
  for (let i = 0; i < NSEC; i++) {
    for (let r = 0; r < R1; r++) addRow(L, c, i, 0, r);
    if (LV <= 1) addClub(L, c, i);
    if (LV === 0) for (let r = 0; r < R2; r++) addRow(L, c, i, 1, r);
    const w = TAU / NSEC, a0 = secCenter(i) - w / 2, a1 = a0 + w, pA = bowlPt(a0, 1), pB = bowlPt(a1, 1), pm = bowlPt(secCenter(i), 1), q1 = bowlPt(secCenter(i) - 0.016, 1), q2 = bowlPt(secCenter(i) + 0.016, 1);
    L.push({ k: (pA.x + pB.x + pA.y + pB.y) / 2 + 0.5, f: () => {                                                                    // outer concrete face + portal doorway
      poly(c, [iso(pA.x, pA.y, 0), iso(pB.x, pB.y, 0), iso(pB.x, pB.y, topZ(a1)), iso(pA.x, pA.y, topZ(a0))], '#767d8a');
      poly(c, [iso(q1.x, q1.y, 0), iso(q2.x, q2.y, 0), iso(q2.x, q2.y, 13), iso(q1.x, q1.y, 13)], '#0e1218');
      poly(c, [iso(q1.x, q1.y, 13), iso(q2.x, q2.y, 13), iso(q2.x, q2.y, 15), iso(q1.x, q1.y, 15)], '#f0c94a');
      const [X, Y] = iso(pm.x, pm.y, 20); c.fillStyle = '#fff'; c.font = 'bold 5px system-ui'; c.textAlign = 'center'; c.fillText(i ? 101 + i : 'VIP', X, Y);
    } });
  }
  // ---- brick outer wall with white roof rim (tall on the far side, low cut-away on the near side) ----
  const WR = [RING.wall[0] + 6, RING.wall[1] + 5], gf = [0, 1, 2, 3].map(gateFrame), PEX = playerExit();
  for (let k = 0; k < 110; k++) {
    const a0 = k * TAU / 110, a1 = (k + 1) * TAU / 110, am = (a0 + a1) / 2, mp = ep(am, WR[0], WR[1]);
    if (gf.some(f => { const u = (mp.x - f.cx) * f.U[0] + (mp.y - f.cy) * f.U[1], v = (mp.x - f.cx) * f.V[0] + (mp.y - f.cy) * f.V[1]; return Math.abs(v) < 60 && u > -104 && u < 112; })) continue;
    if (Math.hypot(mp.x - PEX.x, mp.y - PEX.y) < 30) continue;
    const Hh = lerp(62, 10, (fAng(am) + 1) / 2), pA = ep(a0, WR[0], WR[1]), pB = ep(a1, WR[0], WR[1]), iA = ep(a0, WR[0] - 14, WR[1] - 10), iB = ep(a1, WR[0] - 14, WR[1] - 10);
    const brick = fAng(am) > 0 ? '#8f4d37' : '#7a3f2c';
    L.push({ k: (pA.x + pB.x + pA.y + pB.y) / 2, f: () => {
      poly(c, [iso(pA.x, pA.y, 0), iso(pB.x, pB.y, 0), iso(pB.x, pB.y, Hh), iso(pA.x, pA.y, Hh)], brick);
      if (Hh > 16) for (const zf of [0.3, 0.62]) { const q = (u, v) => iso(lerp(pA.x, pB.x, u), lerp(pA.y, pB.y, u), Hh * v); poly(c, [q(0.25, zf), q(0.75, zf), q(0.75, zf + 0.16), q(0.25, zf + 0.16)], k % 3 ? '#e8cf8a' : '#c9b06a'); }
      poly(c, [iso(pA.x, pA.y, Hh), iso(pB.x, pB.y, Hh), iso(iB.x, iB.y, Hh + 2), iso(iA.x, iA.y, Hh + 2)], '#f2f0ec');
    } });
  }
  // ---- gate buildings ----
  [0, 1, 2, 3].forEach(i => {
    const f = gf[i], o = mkO(f.cx, f.cy, f.V), U0 = -104, U1 = 112;
    L.push({ k: wd(o, 0, 0) + 1, f: () => {
      obox(c, o, U0, U0 + 12, -8, 14, 0, 32, '#8f4d37'); obox(c, o, U1 - 12, U1, -8, 14, 0, 32, '#8f4d37'); obox(c, o, G_E + 40, G_E + 48, -6, 10, 0, 28, '#8f4d37');
      obox(c, o, U0, U1, -8, 14, 28, 36, '#8f4d37', '#f2f0ec');
      oquad(c, o, U0 + 14, U1 - 14, -8, 14, 22, '#00000030');
    } });
  });
  // players' tunnel door (west side)
  { const p = PEX, n = p.n, tx = -n[1], ty = n[0]; L.push({ k: p.x + p.y, f: () => {
    const a = [p.x - tx * 15, p.y - ty * 15], b = [p.x + tx * 15, p.y + ty * 15];
    poly(c, [iso(a[0], a[1], 0), iso(b[0], b[1], 0), iso(b[0], b[1], 20), iso(a[0], a[1], 20)], '#0d1016');
    poly(c, [iso(a[0] - tx * 3, a[1] - ty * 3, 20), iso(b[0] + tx * 3, b[1] + ty * 3, 20), iso(b[0] + tx * 3, b[1] + ty * 3, 25), iso(a[0] - tx * 3, a[1] - ty * 3, 25)], '#d42a44');
    const [X, Y] = iso(p.x, p.y, 23); c.fillStyle = '#fff'; c.font = 'bold 4px system-ui'; c.textAlign = 'center'; c.fillText('PLAYERS', X, Y + 1);
  } }); }
  TOWERS.forEach(p => L.push({ k: p.x + p.y, f: () => {
    const [X, Y] = iso(p.x, p.y, 0), [, Y2] = iso(p.x, p.y, 125);
    c.fillStyle = '#00000040'; c.fillRect(X - 5, Y - 1, 12, 3); c.fillStyle = '#8c939d'; c.fillRect(X - 1, Y2, 2, Y - Y2);
    c.fillStyle = '#d7dbe0'; c.fillRect(X - 14, Y2 - 6, 28, 7); c.fillStyle = '#fff6c8'; for (let k = 0; k < 5; k++) c.fillRect(X - 12 + k * 5.5, Y2 - 5, 4, 4);
  } }));
  // parking lot lamps + driveway booths + tailgate tents
  LAMPS.length = 0;
  const lots = [[975, 2030, 1490, 2030]]; for (let x = 1000; x < 2000; x += 250) for (const y of [1500, 1750, 1980]) LAMPS.push({ x, y });
  if (S.lotB) for (let x = 2250; x < 2700; x += 220) for (const y of [1500, 1750, 1980]) LAMPS.push({ x, y });
  LAMPS.forEach(p => L.push({ k: p.x + p.y, f: () => { const [X, Y] = iso(p.x, p.y, 0), [, Y2] = iso(p.x, p.y, 44); c.fillStyle = '#00000030'; c.fillRect(X - 2, Y - 1, 5, 2); c.fillStyle = '#7d848e'; c.fillRect(X - 0.6, Y2, 1.2, Y - Y2); c.fillStyle = '#e9eef5'; c.fillRect(X - 3, Y2 - 2, 6, 2); } }));
  [1150, 1850].forEach(x => L.push({ k: x + 1460, f: () => { boxC(c, x + 20, 1448, 12, 12, 0, 12, '#d9d4c8'); box(c, x + 18, 1446, 16, 16, 12, 14, '#c0392b', '#a52e22', '#8a251b'); box(c, x - 22, 1470, 40, 2, 4, 6, '#fff', '#e8e8e8', '#d0d0d0'); box(c, x - 22, 1470, 14, 2, 4, 6, '#c0392b', '#a52e22', '#8a251b'); } }));
  [[1010, 1985], [1200, 1990], [1420, 1985], [1640, 1990], [1860, 1985]].forEach(([x, y], k) => L.push({ k: x + y, f: () => {
    const cols = ['#d42a44', '#2f63e0', '#e9c232', '#fff'][k % 4]; boxC(c, x - 8, y - 8, 16, 16, 12, 15, cols); obox(c, mkO(x, y, [0, 1]), -8, -7, -8, -7, 0, 12, '#888888'); boxC(c, x + 10, y - 4, 7, 7, 0, 5, '#2b2f38'); boxC(c, x - 14, y + 4, 5, 5, 0, 3, '#b8302a');
  } }));
  L.sort((p, q) => p.k - q.k); L.forEach(o => o.f());
  isoCv = c0;
}
function playerExit() { const a = 2.52, p = ep(a, RING.wall[0] + 6, RING.wall[1] + 5), gx = Math.cos(a) / RING.wall[0], gy = Math.sin(a) / RING.wall[1], l = Math.hypot(gx, gy); return { x: p.x, y: p.y, n: [gx / l, gy / l] }; }
function setLevelView(v) { LV = v; buildIso(); crowdDirty = true; buildCrowd(); }

/* ---------- 5. crowd: every seat is a real seat, and the people in them react ---------- */
const CB = { ox: -110, oy: 300, w: 760, h: 600 };
const crowd = {};
for (const k of ['base', 'armsH', 'armsA', 'angry']) { const c = document.createElement('canvas'); c.width = CB.w; c.height = CB.h; crowd[k] = c; }
const HOME_SHIRTS = ['#d42a44', '#d42a44', '#b01d35', '#f2f2f2', '#222733', '#d42a44', '#f0c94a'], SKIN2 = ['#e0a46c', '#b97a48', '#f1d3b5', '#7a4a2a'], HAIR = ['#3b2a1a', '#1c1c22', '#8a5a2b', '#e8c27a', '#9a9aa2'];
const isAwayFan = s => (s.sec === 12 || s.sec === 13) ? s.h2 < 0.86 : s.h2 < 0.03;
function awayCol() { return (G ? G.opp : OPPS[S.opp % OPPS.length]).color; }
function buildCrowd() {
  crowdDirty = false;
  const occ = occCur = occupancy(), cs = {};
  for (const k in crowd) { cs[k] = crowd[k].getContext('2d'); cs[k].clearRect(0, 0, CB.w, CB.h); cs[k].translate(0, 0); }
  const ac = awayCol();
  for (const s of SEATS) {
    if (s.lvl === 1 && LV > 0) continue;
    if (s.h >= occ[s.sec]) continue;
    const [X0, Y0] = iso(s.x, s.y, s.z), X = X0 - CB.ox, Y = Y0 - CB.oy, away = isAwayFan(s);
    const shirt = away ? ac : HOME_SHIRTS[(s.idx * 7) % HOME_SHIRTS.length], skin = SKIN2[s.idx & 3], b = cs.base;
    b.fillStyle = shirt; b.fillRect(X - 1, Y - 3.6, 2, 2.2);
    b.fillStyle = skin; b.fillRect(X - 0.7, Y - 5.2, 1.4, 1.5);
    b.fillStyle = HAIR[(s.idx * 3) % HAIR.length]; b.fillRect(X - 0.7, Y - 5.5, 1.4, 0.7);
    const arm = away ? cs.armsA : cs.armsH; arm.fillStyle = skin; arm.fillRect(X - 2.2, Y - 8.6, 1.1, 4.6); arm.fillRect(X + 1.1, Y - 8.6, 1.1, 4.6); arm.fillStyle = shirt; arm.fillRect(X - 2.2, Y - 4.2, 1.1, 1); arm.fillRect(X + 1.1, Y - 4.2, 1.1, 1);
    if (!away) { const g = cs.angry; g.fillStyle = skin; g.fillRect(X + 1.1, Y - 7.6, 1.1, 4); g.fillStyle = '#c0392b'; g.fillRect(X + 0.9, Y - 8.9, 1.5, 1.5); g.fillStyle = '#e0503a'; g.fillRect(X - 0.7, Y - 5.2, 1.4, 1.5); g.fillStyle = '#ff2d2d'; g.fillRect(X - 0.4, Y - 8.2, 0.8, 1.7); g.fillRect(X - 0.4, Y - 6.2, 0.8, 0.7); }
  }
  if (G && ph !== 0 && LV <= 1) for (const q of CLUB_SPOTS) {                  // suite guests, glass in hand
    const [X0, Y0] = iso(q.x, q.y, q.z), X = X0 - CB.ox, Y = Y0 - CB.oy, b = cs.base;
    b.fillStyle = ['#1c2433', '#7a2a3a', '#e8e0d0', '#2a4a6a'][(q.sec + q.k) % 4]; b.fillRect(X - 1.1, Y - 4, 2.2, 3); b.fillStyle = SKIN2[(q.sec + q.k) & 3]; b.fillRect(X - 0.8, Y - 5.8, 1.6, 1.8); b.fillStyle = '#ffe9a8'; b.fillRect(X + 1.2, Y - 3.6, 0.8, 1.2);
  }
}
function drawCrowd(c) {
  if (G && ph !== 0 && crowdDirty && performance.now() - (drawCrowd.last || 0) > 400) { drawCrowd.last = performance.now(); buildCrowd(); }   // rebuilt at most ~2×/second
  c.drawImage(crowd.base, CB.ox, CB.oy);
  const r = react;
  if (r.t > 0) {
    const hop = Math.sin(T * 16) > 0 ? -1 : 0, blink = Math.sin(T * 9) > -0.3;
    if ((r.type === 'homeGoal' || r.type === 'cheerPen') && blink) c.drawImage(crowd.armsH, CB.ox, CB.oy + hop);
    if (r.type === 'awayGoal') { c.drawImage(crowd.angry, CB.ox, CB.oy); if (blink) c.drawImage(crowd.armsA, CB.ox, CB.oy + hop); }
    if (r.type === 'boo') c.drawImage(crowd.angry, CB.ox, CB.oy);
    if (r.type === 'wave') {                                                     // the wave rolls around the bowl
      c.fillStyle = '#e0a46c';
      for (let i = 0; i < NSEC; i++) {
        const ph_ = (((T * 2.4 - i * 0.4) % 8) + 8) % 8; if (ph_ > 1.1) continue;
        for (const s of SEC_SEATS[i]) { if (s.h >= (occCur[i] || 0) || (s.lvl === 1 && LV > 0)) continue; const [X, Y] = iso(s.x, s.y, s.z); c.fillRect(X - 1.9, Y - 6.5 - (ph_ < 0.5 ? 0.6 : 0), 0.8, 2.8); c.fillRect(X + 1.1, Y - 6.5 - (ph_ < 0.5 ? 0.6 : 0), 0.8, 2.8); }
      }
    }
  }
}

/* ---------- 6. rink ---------- */
function rinkPath(c, inset = 0) {
  const x0 = RK.x0 + inset, y0 = RK.y0 + inset, x1 = RK.x1 - inset, y1 = RK.y1 - inset, r = RK.r - inset;
  c.beginPath(); c.moveTo(x0 + r, y0); c.lineTo(x1 - r, y0); c.arcTo(x1, y0, x1, y0 + r, r); c.lineTo(x1, y1 - r); c.arcTo(x1, y1, x1 - r, y1, r);
  c.lineTo(x0 + r, y1); c.arcTo(x0, y1, x0, y1 - r, r); c.lineTo(x0, y0 + r); c.arcTo(x0, y0, x0 + r, y0, r); c.closePath();
}
let PERIM = null, PERIM_K = null;
function rinkPerim() {
  if (PERIM) return PERIM;
  const pts = [], r = RK.r;
  [[RK.x1 - r, RK.y0 + r, -Math.PI / 2], [RK.x1 - r, RK.y1 - r, 0], [RK.x0 + r, RK.y1 - r, Math.PI / 2], [RK.x0 + r, RK.y0 + r, Math.PI]].forEach(([cx, cy, a0]) => { for (let k = 0; k <= 6; k++) { const a = a0 + k * (Math.PI / 2) / 6; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } });
  const out = [];
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; out.push(p); const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d > 30) { const n = Math.ceil(d / 24); for (let k = 1; k < n; k++) out.push([lerp(p[0], q[0], k / n), lerp(p[1], q[1], k / n)]); } }
  PERIM_K = out.map((p, i) => { const q = out[(i + 1) % out.length]; return (p[0] + q[0] + p[1] + q[1]) / 2; });
  return PERIM = out;
}
function drawBoard(i) {
  const P = rinkPerim(), p = P[i], q = P[(i + 1) % P.length], c = ctx;
  poly(c, [iso(p[0], p[1], 0), iso(q[0], q[1], 0), iso(q[0], q[1], 5), iso(p[0], p[1], 5)], '#e8eef4');
  poly(c, [iso(p[0], p[1], 0), iso(q[0], q[1], 0), iso(q[0], q[1], 1.6), iso(p[0], p[1], 1.6)], '#a9b6c4');
  if (i % 4 === 0) poly(c, [iso(p[0], p[1], 1.8), iso(q[0], q[1], 1.8), iso(q[0], q[1], 4.2), iso(p[0], p[1], 4.2)], '#d42a44');          // ad panels
  poly(c, [iso(p[0], p[1], 5), iso(q[0], q[1], 5), iso(q[0], q[1], 11), iso(p[0], p[1], 11)], 'rgba(170,215,255,0.28)');
  c.strokeStyle = '#fff'; c.lineWidth = 0.7; c.beginPath(); const a = iso(p[0], p[1], 11), b = iso(q[0], q[1], 11); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
}
function drawRinkFlat() {                 // drawn on the ground plane (squashed into isometric by the caller)
  const c = ctx;
  c.fillStyle = '#1b1f27'; rinkPath(c, -8); c.fill();
  const q = S.ice / 100;
  c.fillStyle = 'rgb(' + Math.round(lerp(196, 238, q)) + ',' + Math.round(lerp(205, 246, q)) + ',' + Math.round(lerp(208, 252, q)) + ')';
  rinkPath(c); c.fill();
  c.save(); rinkPath(c); c.clip();
  if (q < 0.7) { c.strokeStyle = 'rgba(120,130,140,' + (0.7 - q) + ')'; c.lineWidth = 1; for (let i = 0; i < 40; i++) { const x = RK.x0 + ((i * 97) % 400), y = RK.y0 + ((i * 53) % 170); c.beginPath(); c.moveTo(x, y); c.lineTo(x + 18, y + 4); c.stroke(); } }
  c.fillStyle = '#c8102e'; c.fillRect(C.x - 2, RK.y0, 4, 170);
  c.fillStyle = '#1f4fbf'; c.fillRect(C.x - 52, RK.y0, 5, 170); c.fillRect(C.x + 47, RK.y0, 5, 170);
  c.fillStyle = '#c8102e'; c.fillRect(C.x - 179, RK.y0, 1.5, 170); c.fillRect(C.x + 177.5, RK.y0, 1.5, 170);
  c.strokeStyle = '#c8102e'; c.lineWidth = 1.4;
  [[-128, -44], [-128, 44], [128, -44], [128, 44]].forEach(([dx, dy]) => { c.beginPath(); c.arc(C.x + dx, C.y + dy, 30, 0, TAU); c.stroke(); c.fillStyle = '#c8102e'; c.beginPath(); c.arc(C.x + dx, C.y + dy, 2.5, 0, TAU); c.fill(); });
  c.strokeStyle = '#1f4fbf'; c.beginPath(); c.arc(C.x, C.y, 30, 0, TAU); c.stroke();
  c.fillStyle = '#7fb2ff66'; [-1, 1].forEach(d => { c.beginPath(); c.arc(C.x + d * 178, C.y, 12, d > 0 ? Math.PI / 2 : -Math.PI / 2, d > 0 ? Math.PI * 1.5 : Math.PI / 2); c.fill(); });
  drawLogo(c, C.x, C.y, 29);
  [-1, 1].forEach(d => { c.save(); c.translate(C.x + d * 118, C.y); c.globalAlpha = 0.55; drawLogo(c, 0, 0, 13); c.restore(); });
  c.restore();
  c.strokeStyle = '#c8102e'; c.lineWidth = 2; [-1, 1].forEach(d => c.strokeRect(d > 0 ? C.x + 178 : C.x - 186, C.y - 9, 8, 18));
  c.fillStyle = '#20262f'; c.fillRect(C.x - 110, RK.y0 - 22, 70, 12); c.fillRect(C.x + 40, RK.y0 - 22, 70, 12); c.fillRect(C.x - 30, RK.y1 + 8, 60, 14);
  c.fillStyle = '#9aa'; c.font = '8px system-ui'; c.textAlign = 'center'; c.fillText('HOME', C.x - 75, RK.y0 - 13); c.fillText('AWAY', C.x + 75, RK.y0 - 13); c.fillText('PENALTY BOX', C.x, RK.y1 + 18);
}

/* ---------- people: fans, players, staff ---------- */
const SKIN = ['#e0a46c', '#b97a48', '#f1d3b5', '#7a4a2a'];
function drawFan(a) {
  const c = ctx, seated = a.state === 'seated';
  if (seated && !heat) return;                              // seated fans are drawn by the crowd layer
  const z = zAt(a.x, a.y), [X, Y] = iso(a.x, a.y, z);
  const col = heat ? satCol(a.sat) : a.vip ? '#f5cf55' : a.away ? G.opp.color : HOME.color;
  const hop = a.jump > 0 ? Math.abs(Math.sin(a.jump * 12)) * 2.5 : 0, skin = SKIN[((a.x * 13 + a.y * 7) | 0) & 3];
  c.fillStyle = '#00000040'; c.fillRect(X - 2, Y - 0.5, 4, 1.2);
  if (!seated) { const st = Math.sin(T * 10 + a.x) > 0 ? 1 : 0; c.fillStyle = '#2a2f3c'; c.fillRect(X - 1.5, Y - 2.5, 1.2, 2.5 - st * 0.6); c.fillRect(X + 0.3, Y - 2.5, 1.2, 1.9 + st * 0.6); }
  c.fillStyle = col; c.fillRect(X - 1.8, Y - 5.5 - hop, 3.6, seated ? 3.5 : 3);
  c.fillStyle = skin; c.fillRect(X - 1, Y - 8 - hop, 2, 2.2);
  if (a.state === 'queue' && a.qt > 30) { c.fillStyle = '#c0392b'; c.fillRect(X - 0.5, Y - 10.4, 1, 1.3); }   // impatient fans get a little red mark
}
function drawPerson(x, y, body, head, pants, label) {
  const c = ctx, [X, Y] = iso(x, y, 0);
  c.fillStyle = '#00000045'; c.fillRect(X - 3, Y - 0.5, 6, 1.5);
  c.fillStyle = pants; c.fillRect(X - 1.8, Y - 3, 1.6, 3); c.fillRect(X + 0.2, Y - 3, 1.6, 3);
  c.fillStyle = body; c.fillRect(X - 2.5, Y - 8, 5, 5.2);
  c.fillStyle = '#e8c9a8'; c.fillRect(X - 1.5, Y - 11, 3, 3); c.fillStyle = head; c.fillRect(X - 1.8, Y - 11.6, 3.6, 1.6);
  if (label) { c.fillStyle = '#f0c94a'; c.font = 'bold 5px system-ui'; c.textAlign = 'center'; c.fillText(label, X, Y - 14); }
}
function drawWorker(x, y, o) {                              // cooks, bartenders, cashiers
  const c = ctx, [X, Y] = iso(x, y, 0), sw = Math.sin(T * (o.act ? 9 : 3) + o.ph), up = o.act ? Math.max(0, sw) * 1.6 : 0;
  c.fillStyle = '#00000040'; c.fillRect(X - 2.4, Y - 0.4, 4.8, 1.3);
  c.fillStyle = '#262b36'; c.fillRect(X - 1.8, Y - 3, 1.6, 3); c.fillRect(X + 0.2, Y - 3, 1.6, 3);
  c.fillStyle = o.shirt || '#f4f4f0'; c.fillRect(X - 2.4, Y - 7.6, 4.8, 4.8);
  if (o.apron) { c.fillStyle = o.apron; c.fillRect(X - 1.7, Y - 6.6, 3.4, 3.8); }
  c.fillStyle = '#e8c9a8'; c.fillRect(X - 3.4, Y - 7.2 - up * 0.4, 1, 3.2); c.fillRect(X + 2.4, Y - 7.2 - up, 1, 3.2);
  if (o.item) { c.fillStyle = o.item; c.fillRect(X + 2.2, Y - 8.8 - up, 1.8, 1.8); }
  c.fillStyle = '#e8c9a8'; c.fillRect(X - 1.5, Y - 10.8, 3, 3.2);
  if (o.hat === 'chef') { c.fillStyle = '#fff'; c.fillRect(X - 2, Y - 14, 4, 3.4); c.fillRect(X - 1.4, Y - 14.8, 2.8, 1); }
  else if (o.hat === 'cap') { c.fillStyle = o.cap || '#d42a44'; c.fillRect(X - 1.9, Y - 11.8, 3.8, 1.6); c.fillRect(X - 1.9, Y - 10.9, 5, 0.8); }
  else { c.fillStyle = '#3b2a1a'; c.fillRect(X - 1.6, Y - 11.4, 3.2, 1.2); }
}
function drawGuard(x, y, ph, wand) {                         // security staff: navy uniform, hi-vis vest
  const c = ctx, [X, Y] = iso(x, y, 0), sw = Math.sin(T * 4 + ph);
  c.fillStyle = '#00000040'; c.fillRect(X - 2.4, Y - 0.4, 4.8, 1.3);
  c.fillStyle = '#161a24'; c.fillRect(X - 1.8, Y - 3, 1.6, 3); c.fillRect(X + 0.2, Y - 3, 1.6, 3);
  c.fillStyle = '#1f2d4f'; c.fillRect(X - 2.5, Y - 7.8, 5, 5); c.fillStyle = '#f2c230'; c.fillRect(X - 1.6, Y - 7.4, 3.2, 4.4);
  c.fillStyle = '#e8c9a8'; c.fillRect(X - 1.5, Y - 10.8, 3, 3);
  c.fillStyle = '#1f2d4f'; c.fillRect(X - 1.9, Y - 11.8, 3.8, 1.6); c.fillStyle = '#f0c94a'; c.fillRect(X - 0.4, Y - 11.5, 0.8, 0.8);
  if (wand) { c.strokeStyle = '#111'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(X + 2.5, Y - 6); c.lineTo(X + 6 + sw * 2, Y - 9 + sw); c.stroke(); }
}
function drawPlayer(p, boxed) {
  const c = ctx, col = p.t === 0 ? HOME.color : G.opp.color, g = p.r === 'G';
  let X, Y;
  if (boxed) { [X, Y] = iso(C.x + (p.t ? 10 : -10), RK.y1 + 15, 0); } else [X, Y] = iso(p.x, p.y, 0);
  const mv = !boxed && Math.hypot(p.vx, p.vy) > 12, st = mv && Math.sin(T * 14 + p.num) > 0 ? 1 : 0;
  c.fillStyle = '#00000050'; c.fillRect(X - 4, Y - 0.6, 8, 2);
  c.fillStyle = '#16181f'; c.fillRect(X - 2, Y - 3.4, 1.8, 3.4 - st * 0.8); c.fillRect(X + 0.4, Y - 3.4, 1.8, 2.6 + st * 0.8);
  if (g) { c.fillStyle = '#d9dde3'; c.fillRect(X - 3.2, Y - 5, 6.4, 3.6); }
  c.fillStyle = col; c.fillRect(X - 2.8, Y - 9, 5.6, 5.8); c.fillStyle = '#ffffff55'; c.fillRect(X - 2.8, Y - 6.4, 5.6, 0.9);
  c.fillStyle = '#f1d3b5'; c.fillRect(X - 1.5, Y - 11.8, 3, 3); c.fillStyle = g ? '#cfd5dc' : '#ffffff'; c.fillRect(X - 2, Y - 12.6, 4, 1.8);
  if (!boxed) { c.strokeStyle = '#8a5a2b'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(X + 2.6, Y - 6); c.lineTo(X + 6, Y - 0.4); c.stroke(); }
  if (boxed) { c.fillStyle = '#ffd34a'; c.font = 'bold 5px system-ui'; c.textAlign = 'center'; c.fillText(Math.ceil(p.pen * 4 / 60) + ':' + String(Math.ceil(p.pen * 4) % 60).padStart(2, '0'), X, Y - 15); }
}

/* ---------- concession booths: real kitchens with working staff ---------- */
function ropes(st, c) {
  const n = st._q ? st._q.length : 0; if (!n) return;
  const cols = Math.max(1, Math.ceil(n / 8)), a = SLOTS[st.slot];
  const pt = (lat, row) => { const r = RING.stand[0] - 28 - row * 8, q = ep(a + lat, r, r * RING.stand[1] / RING.stand[0]); return q; };
  c.strokeStyle = '#c0392b'; c.lineWidth = 0.9;
  for (let k = 0; k <= cols; k++) {
    const lat = (k - 0.5) * 0.05, p0 = pt(lat, -0.4), p1 = pt(lat, 7.6), A = iso(p0.x, p0.y, 3.4), B = iso(p1.x, p1.y, 3.4);
    c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke();
    for (const row of [-0.4, 3.6, 7.6]) { const q = pt(lat, row), [X, Y] = iso(q.x, q.y, 0), [, Y2] = iso(q.x, q.y, 4); c.fillStyle = '#9aa3ad'; c.fillRect(X - 0.5, Y2, 1, Y - Y2); c.fillStyle = '#f0c94a'; c.fillRect(X - 1, Y2 - 0.8, 2, 1); }
  }
}
function puff(x, y, z, ph) { const c = ctx; for (let k = 0; k < 3; k++) { const t = ((T * 0.7 + ph + k / 3) % 1), [X, Y] = iso(x, y, z + t * 12); c.fillStyle = 'rgba(240,240,240,' + (0.5 * (1 - t)) + ')'; c.beginPath(); c.arc(X + Math.sin(t * 6 + k) * 1.4, Y, 1 + t * 1.6, 0, TAU); c.fill(); } }
const BOTTLES = ['#2f9a3f', '#8a4b1b', '#d9b33a', '#3a6ea5', '#b0302a'];
function drawBooth(si, a, p) {
  const st = S.stands.find(s => s.slot === si); if (!st) return;
  const c = ctx, ty = TYPES[st.type], closed = !st.open || st._closedT > 0, lvl = st.lvl, t = st.type;
  const o = mkO(p.x, p.y, axisDir(C.x - p.x, C.y - p.y));
  const big = t === 'store' || t === 'vip', L = big ? 66 + lvl * 5 : t === 'restroom' ? 42 : 40 + lvl * 5, D = big ? 46 : t === 'restroom' ? 30 : 27;
  const col = closed ? '#666666' : ty.color, serving = T - (st._fx || -9) < 0.9;
  obox(c, o, -L / 2 - 2, L / 2 + 2, -D / 2 - 2, D / 2 + 4, 0, 1, '#8b8478', '#a39b8c');
  if (t === 'vip') obox(c, o, -L / 2, L / 2, -D / 2, D / 2, 1, 1.4, '#7a2a3a', '#8e3447');
  const parts = [];
  const add = (u0, u1, v0, v1, z0, z1, hex, top) => parts.push({ k: wd(o, (u0 + u1) / 2, (v0 + v1) / 2) + z0 * 0.02, f: () => obox(c, o, u0, u1, v0, v1, z0, z1, hex, top) });
  const spr = (u, v, fn) => { const w = opt(o, u, v); parts.push({ k: w[0] + w[1] + 0.6, f: () => fn(w[0], w[1]) }); };
  const wk = (u, v, opts) => spr(u, v, (x, y) => drawWorker(x, y, opts));
  const wallC = '#d8cdb4', nW = Math.min(5, 1 + lvl);
  const regs = () => { add(L / 2 - 12, L / 2 - 4, D / 2 - 9, D / 2 - 3.5, 6, 10, '#222222', '#3a3f4a'); add(L / 2 - 11, L / 2 - 8.5, D / 2 - 8.6, D / 2 - 7, 10, 11, serving ? '#ffffff' : '#3fcf7a'); };
  if (t === 'hotdog' || t === 'pizza' || t === 'nachos') {
    add(-L / 2, -L / 2 + 2, -D / 2, D / 2, 0, 9, wallC); add(L / 2 - 2, L / 2, -D / 2, D / 2, 0, 9, wallC);
    add(-L / 2 + 2, L / 2 - 2, -D / 2, -D / 2 + 3, 0, 15, '#6b4a2a');
    for (let k = 0; k < 7; k++) { const u = -L / 2 + 5 + k * (L - 10) / 6; add(u - 1.2, u + 1.2, -D / 2 + 0.3, -D / 2 + 2.5, 15, 18, ['#c0392b', '#f2c230', '#e8e0d0', '#3fa86b'][k % 4]); }
    add(-L / 2 + 4, L / 2 - 4, -3, 2, 0, 7, '#bfc3c9', '#dfe3e8');
    add(-L / 2, L / 2, D / 2 - 3.5, D / 2, 0, 6, col, '#e9dfc6'); regs();
    if (t === 'hotdog') { add(-L / 4 - 8, -L / 4 + 8, -3, 2, 7, 9.5, '#4a4f58'); for (let k = 0; k < 4; k++) add(-L / 4 - 6 + k * 4, -L / 4 - 4.6 + k * 4, -1.6, 0.4, 9.5, 10.8, '#b0302a'); add(L / 4 - 6, L / 4 + 6, -2, 3, 7, 10, '#9aa3ad'); spr(-L / 4, -1, (x, y) => puff(x, y, 10, 0.1)); }
    if (t === 'pizza') { add(-L / 2 + 4, -L / 2 + 18, -D / 2 + 1, -D / 2 + 12, 0, 13, '#a9482a', '#c0603a'); add(-L / 2 + 6, -L / 2 + 16, -D / 2 + 3, -D / 2 + 10, 13, 17, '#a9482a', '#c0603a'); add(-L / 2 + 9, -L / 2 + 13, -D / 2 + 5, -D / 2 + 8, 17, 26, '#555c66');
      const fire = 0.7 + 0.3 * Math.sin(T * 7); add(-L / 2 + 8, -L / 2 + 14, -D / 2 + 12, -D / 2 + 12.8, 2, 8, 'rgb(255,' + ((150 + fire * 80) | 0) + ',40)', '#ffcf70'); add(L / 2 - 14, L / 2 - 5, -D / 2 + 3, -D / 2 + 12, 0, 10, '#f1e6cf', '#fff6e0'); spr(-L / 2 + 11, -D / 2 + 6, (x, y) => puff(x, y, 26, 0.4)); }
    if (t === 'nachos') { for (let k = 0; k < 4; k++) add(-L / 2 + 6 + k * 8, -L / 2 + 11 + k * 8, -1, 2, 7, 9, ['#c0392b', '#3fa86b', '#f2c230', '#e07a2b'][k], '#ffffff'); add(L / 4 - 6, L / 4 + 6, -D / 2 + 3, -D / 2 + 10, 0, 8, '#4a4f58'); spr(L / 4, -D / 2 + 6, (x, y) => puff(x, y, 8, 0.7)); }
    wk(-L / 4, 3, { apron: '#f4f4f0', shirt: col, hat: 'chef', ph: 0, act: !closed, item: '#c0392b' });
    wk(L / 2 - 9, D / 2 - 11, { apron: '#2b2f38', shirt: '#f4f4f0', hat: 'cap', cap: col, ph: 1.7, act: serving, item: serving ? '#f2c230' : null });
    if (nW > 2) wk(0, -4, { apron: '#f4f4f0', shirt: '#e8e0d0', hat: 'chef', ph: 2.3, act: !closed });
    if (nW > 3) wk(L / 4 + 4, -4, { apron: '#f4f4f0', shirt: col, hat: 'cap', cap: '#ffffff', ph: 3.1, act: !closed });
    if (nW > 4) wk(-L / 2 + 10, D / 2 - 11, { apron: '#2b2f38', shirt: '#f4f4f0', hat: 'cap', cap: col, ph: 4.4, act: serving });
    add(-L / 2 - 2, L / 2 + 2, -D / 2 - 2, -D / 2 + 6, 22, 24, col, shade(col, 30));
    add(-L / 2 - 1, -L / 2 + 1, -D / 2 - 1, -D / 2 + 1, 0, 22, '#9aa3ad'); add(L / 2 - 1, L / 2 + 1, -D / 2 - 1, -D / 2 + 1, 0, 22, '#9aa3ad');
  } else if (t === 'bar') {
    add(-L / 2, -L / 2 + 2, -D / 2, D / 2, 0, 9, '#3a2a20'); add(L / 2 - 2, L / 2, -D / 2, D / 2, 0, 9, '#3a2a20');
    add(-L / 2 + 2, L / 2 - 2, -D / 2, -D / 2 + 3, 0, 13, '#3a2a20', '#5a4030'); add(-L / 2 + 2, L / 2 - 2, -D / 2, -D / 2 + 2.5, 13, 14, '#5a4030');
    for (let k = 0; k < 9; k++) { const u = -L / 2 + 5 + k * (L - 10) / 8; add(u - 0.8, u + 0.8, -D / 2 + 0.4, -D / 2 + 2, 14, 19, BOTTLES[k % 5], '#ffffff'); }
    add(-L / 2 + 4, L / 2 - 4, -D / 2, -D / 2 + 0.8, 19, 27, '#a9c7d8');
    add(-L / 2 + 3, -L / 2 + 11, -D / 2 + 4, -D / 2 + 11, 0, 7, '#9aa3ad', '#d0d5db'); add(-L / 2 + 4, -L / 2 + 10, -D / 2 + 5, -D / 2 + 10, 7, 12, '#9aa3ad', '#d0d5db');
    add(L / 2 - 12, L / 2 - 3, -D / 2 + 3, -D / 2 + 10, 0, 12, '#dfe5ea');
    add(-L / 2, L / 2, D / 2 - 3.5, D / 2, 0, 6, '#5a3a22', '#e9dfc6'); regs();
    for (let k = 0; k < 4; k++) { const u = -9 + k * 5; add(u - 0.7, u + 0.7, D / 2 - 9, D / 2 - 7.6, 6, 11, '#c8ccd2'); add(u - 1, u + 1, D / 2 - 9.3, D / 2 - 7.3, 11, 12.6, ['#c0392b', '#2f9a3f', '#d9b33a', '#2f63e0'][k]); }
    wk(-4, D / 2 - 12, { apron: '#161a24', shirt: '#f4f4f0', ph: 0, act: !closed, item: '#f2c230' });
    wk(8, D / 2 - 12, { apron: '#161a24', shirt: '#f4f4f0', hat: 'cap', cap: '#161a24', ph: 1.9, act: serving, item: serving ? '#f2c230' : null });
    if (nW > 2) wk(-14, D / 2 - 12, { apron: '#161a24', shirt: '#f4f4f0', ph: 3.3, act: !closed });
    if (nW > 3) wk(18, D / 2 - 12, { apron: '#161a24', shirt: '#f4f4f0', ph: 4.2, act: !closed });
    add(-L / 2 - 2, L / 2 + 2, -D / 2 - 2, -D / 2 + 5, 22, 24, '#3a2a20', '#5a4030');
  } else if (t === 'restroom') {
    add(-L / 2, L / 2, -D / 2, D / 2 - 6, 0, 18, '#c9ced6', '#e6eaef');
    add(-L / 4 - 5, -L / 4 + 5, D / 2 - 6, D / 2 - 5, 0, 12, '#1b222c'); add(L / 4 - 5, L / 4 + 5, D / 2 - 6, D / 2 - 5, 0, 12, '#1b222c');
    add(-L / 4 - 4, -L / 4 + 4, D / 2 - 6, D / 2 - 4.8, 13, 17, '#3b82f6'); add(L / 4 - 4, L / 4 + 4, D / 2 - 6, D / 2 - 4.8, 13, 17, '#ec6aa0');
    add(L / 2 - 10, L / 2 - 3, D / 2 - 5, D / 2 - 0.5, 0, 6, '#3fa86b', '#8fd9a8');
    wk(L / 2 - 14, D / 2 - 2, { apron: '#3fa86b', shirt: '#e8e0d0', hat: 'cap', cap: '#3fa86b', ph: 2, act: serving });
    add(-L / 2 - 1, L / 2 + 1, -D / 2 - 1, D / 2 - 6, 18, 20, '#5f86b3', '#7ea0c8');
  } else if (t === 'store') {                                         // the LYNX PRO SHOP
    add(-L / 2, L / 2, -D / 2, -D / 2 + 3, 0, 22, '#2a2e3a', '#3b4150'); add(-L / 2, -L / 2 + 2.5, -D / 2, D / 2, 0, 14, '#2a2e3a'); add(L / 2 - 2.5, L / 2, -D / 2, D / 2, 0, 14, '#2a2e3a');
    const jc = ['#d42a44', '#f2f2f2', '#14213d', '#d42a44', '#f0c94a'];
    for (let k = 0; k < 11; k++) { const u = -L / 2 + 4 + k * (L - 8) / 11; add(u, u + (L - 8) / 11 - 1.2, -D / 2 + 3, -D / 2 + 5, 7, 19, jc[k % 5], '#ffffff'); }
    add(-L / 2 + 4, L / 2 - 4, -D / 2 + 3, -D / 2 + 5, 4, 6, '#6b4a2a');
    for (const [cu, cv] of [[-L / 4, -2], [L / 8, 2]]) { add(cu - 9, cu + 9, cv - 5, cv + 5, 0, 6, '#3a3f4a', '#d8cdb4'); for (let k = 0; k < 4; k++) add(cu - 8 + k * 4.2, cu - 5 + k * 4.2, cv - 3, cv + 3, 6, 8 + (k % 2), jc[k % 5]); }
    for (const [mu, mv, mc] of [[-L / 2 + 10, 6, '#d42a44'], [-L / 2 + 22, 6, '#f2f2f2']]) { add(mu - 0.6, mu + 0.6, mv - 0.6, mv + 0.6, 0, 7, '#8c939d'); add(mu - 2.6, mu + 2.6, mv - 1.6, mv + 1.6, 7, 14, mc); add(mu - 1.2, mu + 1.2, mv - 1, mv + 1, 14, 16.5, '#e8c9a8'); }
    add(L / 4 - 2, L / 2 - 5, D / 2 - 15, D / 2 - 5, 0, 8, '#2a2e3a', '#e9dfc6'); add(L / 4, L / 4 + 5, D / 2 - 12, D / 2 - 8, 8, 11, '#222222'); add(L / 4 + 8, L / 4 + 13, D / 2 - 12, D / 2 - 8, 8, 11, '#222222');
    wk(L / 4 + 2, D / 2 - 17, { apron: '#d42a44', shirt: '#d42a44', hat: 'cap', cap: '#14213d', ph: 0, act: serving, item: serving ? '#f2f2f2' : null });
    wk(L / 4 + 12, D / 2 - 17, { apron: '#d42a44', shirt: '#d42a44', hat: 'cap', cap: '#14213d', ph: 1.5, act: serving });
    wk(-L / 8, 9, { apron: '#14213d', shirt: '#d42a44', ph: 2.2, act: true, item: '#f2f2f2' });
    if (lvl > 1) wk(-L / 2 + 16, -8, { apron: '#14213d', shirt: '#d42a44', ph: 3.5, act: true, item: '#f0c94a' });
    if (lvl > 2) wk(L / 2 - 16, -8, { apron: '#14213d', shirt: '#d42a44', ph: 4.5, act: true, item: '#d42a44' });
    parts.push({ k: wd(o, 0, D / 2) + 3, f: () => { const q1 = opt(o, -L / 2, D / 2), q2 = opt(o, L / 2, D / 2); poly(c, [iso(q1[0], q1[1], 0), iso(q2[0], q2[1], 0), iso(q2[0], q2[1], 14), iso(q1[0], q1[1], 14)], 'rgba(150,200,230,0.22)'); } });
    add(-L / 2 - 2, L / 2 + 2, -D / 2 - 2, -D / 2 + 8, 24, 27, col, shade(col, 30));
  } else if (t === 'vip') {                                           // club lounge
    add(-L / 2, L / 2, -D / 2, -D / 2 + 3, 0, 20, '#2a2330', '#3b2f45'); add(-L / 2, -L / 2 + 2.5, -D / 2, D / 2, 0, 14, '#2a2330'); add(L / 2 - 2.5, L / 2, -D / 2, D / 2, 0, 14, '#2a2330');
    add(-L / 2 + 6, L / 2 - 6, -D / 2 + 4, -D / 2 + 9, 0, 8, '#4a3320', '#d9b33a');
    for (let k = 0; k < 8; k++) add(-L / 2 + 9 + k * (L - 18) / 7, -L / 2 + 10.6 + k * (L - 18) / 7, -D / 2 + 4.5, -D / 2 + 6.5, 8, 13, BOTTLES[k % 5], '#ffffff');
    for (const tu of [-L / 4, L / 4]) { add(tu - 4, tu + 4, 0, 8, 0, 6, '#e8e0d0', '#ffffff'); add(tu - 0.7, tu + 0.7, 3, 4, 6, 8, '#ffcf70'); for (const sv of [-1, 1]) add(tu + sv * 8 - 1.5, tu + sv * 8 + 1.5, 2, 5, 0, 4, '#7a2a3a'); add(tu - 1, tu + 1, 3, 5, 16, 20, '#ffe9a8'); }
    wk(-6, -D / 2 + 11, { apron: '#161a24', shirt: '#f4f4f0', ph: 0, act: !closed, item: '#f2f2f2' });
    wk(L / 2 - 12, 8, { apron: '#161a24', shirt: '#f4f4f0', ph: 2, act: serving, item: '#d9b33a' });
    parts.push({ k: wd(o, 0, D / 2) + 3, f: () => { const q1 = opt(o, -L / 2, D / 2), q2 = opt(o, L / 2, D / 2); poly(c, [iso(q1[0], q1[1], 0), iso(q2[0], q2[1], 0), iso(q2[0], q2[1], 14), iso(q1[0], q1[1], 14)], 'rgba(255,215,130,0.18)'); } });
    add(-L / 2 - 2, L / 2 + 2, -D / 2 - 2, -D / 2 + 8, 24, 27, '#b8912f', '#e0b84a');
  }
  parts.sort((p, q) => p.k - q.k); parts.forEach(q => q.f());
  // signage
  const [X, Y] = iso(...opt(o, 0, -D / 2), big ? 50 : 44);
  const nm = t === 'store' ? 'LYNX PRO SHOP' : t === 'vip' ? 'VIP CLUB' : t === 'restroom' ? 'RESTROOMS' : ty.label.toUpperCase();
  const sw = Math.max(34, nm.length * 3.7 + 8), sy = Y - 6;
  c.fillStyle = '#0d1016'; c.fillRect(X - sw / 2, sy, sw, 9); c.fillStyle = closed ? '#999' : (t === 'bar' ? ((T * 0.8) % 2 < 1 ? '#ff5fa2' : '#5fd7ff') : '#ffd34a'); c.font = 'bold 6px system-ui'; c.textAlign = 'center'; c.fillText(closed ? nm + ' · CLOSED' : nm, X + (t === 'store' ? 4 : 0), sy + 6.6);
  if (t === 'store') drawLogo(c, X - sw / 2 + 5, sy + 4.5, 3.8);
  for (let k = 0; k < lvl; k++) { c.fillStyle = '#f0c94a'; c.fillRect(X - sw / 2 + 1 + k * 3, sy + 10, 2, 2); }
  if (t !== 'restroom' && cam.z > 1.15 && !closed) {
    const P = S.prices, it = { hotdog: [['HOT DOG', P.food * 0.8], ['PRETZEL', P.food * 0.6]], pizza: [['SLICE', P.food * 1.1], ['WINGS', P.food * 1.2]], nachos: [['NACHOS', P.food * 0.9], ['TACOS', P.food]], bar: [['BEER', P.beer], ['COCKTAIL', P.beer * 1.4]], store: [['JERSEY', P.merch * 2], ['HAT', P.merch * 0.6]], vip: [['CHAMPAGNE', P.beer * 3], ['SLIDERS', P.food * 2]] }[t];
    c.fillStyle = '#10131acc'; c.fillRect(X - 20, sy - 14, 40, 12); c.font = '4.4px system-ui'; c.textAlign = 'left'; it.forEach(([n, v], i) => { c.fillStyle = '#e8e0d0'; c.fillText(n, X - 18, sy - 9 + i * 5); c.fillStyle = '#4ee07a'; c.textAlign = 'right'; c.fillText('$' + Math.round(v), X + 18, sy - 9 + i * 5); c.textAlign = 'left'; });
  }
  const n = st._q ? st._q.length : 0;
  c.fillStyle = st.cond > 60 ? '#3fcf7a' : st.cond > 30 ? '#ffb340' : '#ff5c5c'; c.fillRect(X - sw / 2, sy - 2, sw * st.cond / 100, 1.2);
  if (n) { const bc = n > 12 ? '#ff5c5c' : n > 6 ? '#ffb340' : '#3fcf7a'; c.fillStyle = bc; c.beginPath(); c.arc(X + sw / 2 + 5, sy + 4, 4.4, 0, TAU); c.fill(); c.fillStyle = '#000'; c.font = 'bold 6px system-ui'; c.textAlign = 'center'; c.fillText(n, X + sw / 2 + 5, sy + 6.2); }
}

/* ---------- security checkpoints & exits ---------- */
function drawGate(i, g) {
  const c = ctx, f = gateFrame(i), o = mkO(f.cx, f.cy, f.V), n = S.lanes[i], w = n * 6.5 + 10, bad = G && G.metalDetectorDown === i;
  obox(c, o, G_E - w, G_E + w, -2, 52, 0, 0.9, '#8d8a82', '#a8a49a');
  obox(c, o, G_X - 18, G_X + 18, -2, 40, 0, 0.9, '#8d8a82', '#a8a49a');
  const parts = [];
  const add = (u0, u1, v0, v1, z0, z1, hex, top) => parts.push({ k: wd(o, (u0 + u1) / 2, (v0 + v1) / 2) + z0 * 0.02, f: () => obox(c, o, u0, u1, v0, v1, z0, z1, hex, top) });
  const spr = (u, v, fn) => { const q = opt(o, u, v); parts.push({ k: q[0] + q[1] + 0.6, f: () => fn(q[0], q[1]) }); };
  for (let l = 0; l < n; l++) {
    const u = laneU(i, l), fx = scanFx.find(s => s.g === i && s.l === l), blink = Math.sin(T * 6 + l) > 0;
    add(u - 2, u + 2, 36, 40, 0, 8, '#2b2f38', '#4b5361'); add(u - 1.4, u + 1.4, 36.2, 37.6, 8, 9.6, fx ? '#4ee07a' : '#3b82f6');                          // ticket scanner
    add(u - 6, u - 4.2, 25, 27, 0, 16, '#4a5568'); add(u + 4.2, u + 6, 25, 27, 0, 16, '#4a5568'); add(u - 6, u + 6, 25, 27, 14, 16, '#4a5568'); add(u - 1, u + 1, 25.4, 26.6, 16, 17.6, bad ? '#ff5c5c' : fx ? '#4ee07a' : (blink ? '#4ee07a' : '#1f6b3a'));   // metal detector
    add(u - 5, u + 5, 6, 22, 0, 4, '#20242c', '#32373f'); add(u - 5, u + 5, 10, 18, 4, 9, '#3a4048', '#50565e');                                                // bag x-ray
    if (fx) add(u - 3, u - 1, 12, 14, 4.2, 5.4, '#c0392b');                                                                                                      // a bag going through
    if (l % 2 === 0) spr(u + 7, 31, (x, y) => drawGuard(x, y, l, true));
    else spr(u + 7, 12, (x, y) => drawGuard(x, y, l + 2, false));
  }
  spr(G_E - w - 6, 30, (x, y) => drawGuard(x, y, 9, false));
  add(G_X - 14, G_X - 11, -6, 4, 0, 14, '#8f4d37'); add(G_X + 11, G_X + 14, -6, 4, 0, 14, '#8f4d37'); add(G_X - 14, G_X + 14, -6, 4, 14, 17, '#1d6b3a');      // EXIT doors
  spr(G_X + 18, 8, (x, y) => drawGuard(x, y, 5, false));
  parts.sort((p, q) => p.k - q.k); parts.forEach(q => q.f());
  c.globalAlpha = 0.36; obox(c, o, G_E - w, G_E + w, 3, 46, 24, 26, '#3c5078', '#8fb0e0'); c.globalAlpha = 1;                                                    // see-through canopy
  const L = g.lq.reduce((s, q) => s + q.length, 0), rows = Math.max(...g.lq.map(q => q.length), 0);
  if (rows) { c.strokeStyle = '#c0392b'; c.lineWidth = 0.9; for (let l = 0; l <= n; l++) { const u = G_E + (l - n / 2) * 13, p0 = opt(o, u, 42), p1 = opt(o, u, 46 + rows * 6.2), A = iso(p0[0], p0[1], 3.4), B = iso(p1[0], p1[1], 3.4); c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke(); const [X, Y] = iso(p0[0], p0[1], 0), [, Y2] = iso(p0[0], p0[1], 4); c.fillStyle = '#9aa3ad'; c.fillRect(X - 0.5, Y2, 1, Y - Y2); } }
  const gx = iso(...opt(o, G_E, 0), 40), ex = iso(...opt(o, G_X, 0), 22);
  c.fillStyle = '#0d1016'; c.fillRect(gx[0] - 27, gx[1] - 9, 54, 17); c.textAlign = 'center'; txtC(c, 'GATE ' + GATE_N[i].split(' ')[0].toUpperCase(), gx[0], gx[1] - 2.5, '#fff', 6);
  txtC(c, 'SECURITY CHECK · ' + n + ' LANES', gx[0], gx[1] + 3, '#9fd3ff', 4); txtC(c, L ? 'LINE ' + L * FPA : 'NO WAIT', gx[0], gx[1] + 7.6, L * FPA > 120 ? '#ff7070' : '#4ee07a', 4.4);
  c.fillStyle = '#1d6b3a'; c.fillRect(ex[0] - 9, ex[1] - 3.6, 18, 7); txtC(c, 'EXIT', ex[0], ex[1] + 1.6, '#fff', 5.4);
  for (const fx of scanFx) if (fx.g === i) { const u = laneU(i, fx.l), q = opt(o, u, 36), [X, Y] = iso(q[0], q[1], 12 + (0.55 - fx.t) * 6); c.globalAlpha = Math.min(1, fx.t * 3); txtC(c, '✓', X, Y, '#4ee07a', 7); c.globalAlpha = 1; }
}

/* ---------- misc props ---------- */
function drawCar(x, y, col, vert) {
  const c = ctx, w = vert ? 10 : 18, h = vert ? 18 : 10;
  boxC(c, x - w / 2, y - h / 2, w, h, 0.6, 4.2, col.length === 7 ? col : '#999999');
  const [X, Y] = iso(x, y, 4.3); c.fillStyle = '#9fd3ff88'; c.fillRect(X - 2, Y - 1, 4, 1.6);
}
function drawZam() {
  const t = zam.t / 70, lap = t * 5, a = lap * TAU, sh = 1 - (lap | 0) / 6, zx = C.x + Math.cos(a) * 170 * sh, zy = C.y + Math.sin(a) * 66 * sh;
  box(ctx, zx - 9, zy - 6, 18, 12, 0, 7, '#f2f2f2', '#d4d8dd', '#9aa3ad'); box(ctx, zx - 9, zy - 6, 7, 12, 7, 11, '#2f63e0', '#244fb5', '#1b3b88');
}
function drawJumbo() {
  const c = ctx, x = C.x, y = C.y;
  c.strokeStyle = '#555'; c.lineWidth = 0.7; for (const [dx, dy] of [[-20, -10], [20, -10], [-20, 10], [20, 10]]) { const a = iso(x + dx, y + dy, 76), b = iso(x + dx * 3, y + dy * 3, 110); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  box(c, x - 20, y - 10, 40, 20, 62, 78, '#2a2f3a', '#0b0e14', '#0b0e14');
  const [X, Y] = iso(x, y + 10, 70); c.textAlign = 'center'; c.fillStyle = '#ffcf40'; c.font = 'bold 6px ui-monospace,monospace'; c.fillText(HOME.short + ' ' + score[0] + '-' + score[1] + ' ' + (G ? G.opp.short : ''), X - 7, Y - 1.5);
  c.fillStyle = '#fff'; c.font = '5px ui-monospace,monospace'; c.fillText(clockStr(), X - 7, Y + 4.5); c.fillStyle = '#4da3ff'; c.fillText(isInt() ? 'KISS CAM' : 'MAKE NOISE', X - 7, Y + 9.5);
  drawLogo(c, X + 17, Y + 2, 5);
}
function drawArenaSign() {                       // big sign over the main (south) gate
  const c = ctx, f = gateFrame(1), [X, Y] = iso(f.cx - 20, f.cy + 8, 78);
  c.fillStyle = '#0d1016'; c.fillRect(X - 46, Y - 8, 92, 16); c.strokeStyle = '#d42a44'; c.lineWidth = 1; c.strokeRect(X - 46, Y - 8, 92, 16);
  drawLogo(c, X - 36, Y, 6.2); txtC(c, 'LAKEVIEW LYNX', X + 6, Y - 0.5, '#ffffff', 6.6); txtC(c, 'A R E N A', X + 6, Y + 6, '#ffd34a', 4.4);
}
function drawAttendant(x, y, ph) {
  const c = ctx, [X, Y] = iso(x, y, 0), sw = Math.sin(T * 5 + ph);
  c.fillStyle = '#00000040'; c.fillRect(X - 2.4, Y - 0.4, 4.8, 1.3); c.fillStyle = '#16181f'; c.fillRect(X - 1.8, Y - 3, 3.6, 3);
  c.fillStyle = '#ff7a1a'; c.fillRect(X - 2.5, Y - 7.8, 5, 5); c.fillStyle = '#e8c9a8'; c.fillRect(X - 1.5, Y - 10.8, 3, 3);
  c.strokeStyle = '#ffb347'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(X + 2.5, Y - 6.5); c.lineTo(X + 4 + sw * 3, Y - 12 + sw * 1.5); c.stroke();
}

/* ---------- after the game: players leave by their own door, fans wait for them, the bus pulls away ---------- */
function showGeom() { const p = playerExit(), n = p.n, t = [-n[1], n[0]]; return { p, n, t, D0: { x: p.x + n[0] * 10, y: p.y + n[1] * 10 }, D1: { x: p.x + n[0] * 66 + t[0] * 34, y: p.y + n[1] * 66 + t[1] * 34 } }; }
function showBus(g) { const base = { x: g.D1.x + g.t[0] * 40 + g.n[0] * 8, y: g.D1.y + g.t[1] * 40 + g.n[1] * 8 }, t = exitShow.t; return { x: base.x, y: base.y + (t < 14 ? (14 - t) * 16 : t > 120 ? (t - 120) * 22 : 0) }; }
function pushShow(E) {
  if (!exitShow) return;
  const g = showGeom(), t = exitShow.t, roster = players.filter(p => p.t === 0).concat([{ num: 0, name: 'Coach', coach: 1 }, { num: 0, name: 'Coach', coach: 1 }]);
  const walk = (i) => { const t0 = 24 + i * 2.8, tau = t - t0; if (tau < 0 || tau > 13) return null; return { s: tau < 4 ? 0.5 * tau / 4 : tau < 9 ? 0.5 : 0.5 + 0.5 * (tau - 9) / 4, sign: tau >= 4 && tau < 9 }; };
  let signing = false; roster.forEach((p, i) => { const w = walk(i); if (w && w.sign) signing = true; if (w) E.push({ k: lerp(g.D0.x, g.D1.x, w.s) + lerp(g.D0.y, g.D1.y, w.s), t: 10, o: { p, w, g } }); });
  for (let i = 0; i < exitShow.n; i++) { const appear = 6 + i * 0.55, gone = 135 + (i % 7) * 5; if (t < appear || t > gone) continue; const row = (i / 11) | 0, s = ((i * 7) % 11) / 10, jx = ((i * 37) % 7) - 3; const x = lerp(g.D0.x, g.D1.x, 0.1 + s * 0.85) - g.t[0] * (13 + row * 7) + jx * 0.7, y = lerp(g.D0.y, g.D1.y, 0.1 + s * 0.85) - g.t[1] * (13 + row * 7); E.push({ k: x + y, t: 11, o: { i, x, y, signing, win: exitShow.win } }); }
  const b = showBus(g); E.push({ k: b.x + b.y + 20, t: 12, o: b });
  const fence = []; for (let s = 0; s <= 1.001; s += 0.125) fence.push({ x: lerp(g.D0.x, g.D1.x, s) - g.t[0] * 7, y: lerp(g.D0.y, g.D1.y, s) - g.t[1] * 7 });
  fence.forEach(q => E.push({ k: q.x + q.y, t: 13, o: q }));
}
function drawShowPlayer(o) {
  const c = ctx, { p, w, g } = o, x = lerp(g.D0.x, g.D1.x, w.s), y = lerp(g.D0.y, g.D1.y, w.s);
  drawPerson(x, y, p.coach ? '#3b3f4a' : '#1c2230', p.coach ? '#9a9aa2' : '#2a1f14', '#14161c');
  const [X, Y] = iso(x, y, 0); c.fillStyle = '#d42a44'; c.fillRect(X - 1.6, Y - 7.6, 3.2, 1.2); c.fillStyle = '#2b2f38'; c.fillRect(X + 3.2, Y - 3.6, 3.6, 3.4);
  if (w.sign) { c.fillStyle = '#fff'; c.fillRect(X - 2, Y - 14.5, 4, 2.4); c.fillStyle = '#d42a44'; c.fillRect(X - 1.2, Y - 14, 2.4, 1); }
  if (!p.coach && w.sign) txtC(c, '#' + p.num, X, Y - 16.5, '#ffd34a', 5);
}
function drawShowFan(o) {
  const c = ctx, [X, Y] = iso(o.x, o.y, 0), cheer = o.signing || Math.sin(T * 2 + o.i) > 0.8, hop = cheer ? Math.abs(Math.sin(T * 9 + o.i)) * 1.8 : 0, skin = SKIN[o.i & 3];
  c.fillStyle = '#00000040'; c.fillRect(X - 2, Y - 0.5, 4, 1.2);
  c.fillStyle = '#2a2f3c'; c.fillRect(X - 1.5, Y - 2.5, 3, 2.5);
  c.fillStyle = o.i % 9 === 0 ? '#2f63e0' : o.i % 3 === 0 ? '#f2f2f2' : '#d42a44'; c.fillRect(X - 1.8, Y - 5.5 - hop, 3.6, 3);
  c.fillStyle = skin; c.fillRect(X - 1, Y - 8 - hop, 2, 2.2);
  if (cheer) { c.fillStyle = skin; c.fillRect(X - 3, Y - 8.4 - hop, 1, 3); c.fillRect(X + 2, Y - 8.4 - hop, 1, 3); }
  if (o.i % 4 === 0) { c.fillStyle = '#eef'; c.fillRect(X + 1.4, Y - 10.2 - hop, 1.6, 2.4); }                                    // phone up
  if (o.i % 6 === 1) { c.fillStyle = '#ffffff'; c.fillRect(X - 3.4, Y - 14.5 - hop, 6.8, 4); c.fillStyle = '#d42a44'; c.fillRect(X - 2.6, Y - 13.5 - hop, 5.2, 2); c.fillStyle = '#fff'; c.fillRect(X - 0.4, Y - 10.6 - hop, 0.8, 2.6); }   // sign
}
function drawBus(b) {
  const c = ctx;
  box(c, b.x - 12, b.y - 32, 24, 64, 1, 17, '#f2f2f2', '#d8dde2', '#aab2bb');
  box(c, b.x - 12, b.y - 32, 24, 64, 11, 17, '#14213d', '#14213d', '#0b1426');
  for (let k = 0; k < 6; k++) { const y0 = b.y - 28 + k * 9; poly(c, [iso(b.x + 12, y0, 9), iso(b.x + 12, y0 + 6, 9), iso(b.x + 12, y0 + 6, 15), iso(b.x + 12, y0, 15)], '#9fd3ff'); poly(c, [iso(b.x - 12 + 24 * 0 + 2 * k * 0, b.y + 32, 9), iso(b.x - 6, b.y + 32, 9), iso(b.x - 6, b.y + 32, 15), iso(b.x - 12, b.y + 32, 15)], '#9fd3ff'); }
  poly(c, [iso(b.x + 12, b.y - 32, 4), iso(b.x + 12, b.y + 32, 4), iso(b.x + 12, b.y + 32, 9), iso(b.x + 12, b.y - 32, 9)], '#d42a44');
  const [X, Y] = iso(b.x + 12, b.y, 7); drawLogo(c, X, Y, 3.2);
  for (const wy of [-20, 20]) { const [WX, WY] = iso(b.x + 12, b.y + wy, 0); c.fillStyle = '#111'; c.fillRect(WX - 2.4, WY - 2.4, 4.8, 2.8); }
}

/* ---------- concourse upgrades you can buy ---------- */
const DEC_SCREEN = [0.52, 1.05, 2.09, 2.62, 3.67, 4.19, 5.24, 5.76], DEC_PLANT = [0.26, 3.4, 6.02, 3.93], DEC_LOUNGE = [1.31, 2.88, 4.45, 4.97], DEC_BAN = []; for (let k = 0; k < 30; k++) DEC_BAN.push(k * TAU / 30 + 0.1);
function pushDecor(E, vis) {
  const d = S.decor, sp = (ang, r, ry) => ep(ang, r, ry);
  if (d.banners) for (const a of DEC_BAN) { const p = ep(a, RING.wall[0] - 18, RING.wall[1] - 13); if (GATE_A.some(g => Math.abs(normA(a - g)) < 0.22)) continue; E.push({ k: p.x + p.y, t: 20, o: { p, a } }); }
  if (d.screens) for (const a of DEC_SCREEN) { const p = ep(a, RING.stand[0] - 4, RING.stand[1] - 3); E.push({ k: p.x + p.y, t: 21, o: { p } }); }
  if (d.lounge) for (const a of DEC_LOUNGE) { const p = ep(a, RING.stand[0] - 6, RING.stand[1] - 4); E.push({ k: p.x + p.y, t: 22, o: { p, a } }); }
  if (d.garden) { for (const a of DEC_PLANT) { const p = ep(a, RING.stand[0] - 4, RING.stand[1] - 3); E.push({ k: p.x + p.y, t: 23, o: { p } }); } for (const q of [{ x: 1990, y: 1345 }, { x: 1010, y: 1345 }]) E.push({ k: q.x + q.y, t: 24, o: q }); }
  if (d.arcade) { const p = ep(0.785, RING.stand[0] - 2, RING.stand[1] - 2); E.push({ k: p.x + p.y, t: 25, o: { p } }); }
  if (d.photo) { const p = ep(2.356, RING.stand[0] - 2, RING.stand[1] - 2); E.push({ k: p.x + p.y, t: 26, o: { p } }); }
  if (d.mobile) { const p = ep(1.83, RING.stand[0] - 2, RING.stand[1] - 2); E.push({ k: p.x + p.y, t: 27, o: { p } }); }
}
function drawDecor(e) {
  const c = ctx, p = e.o.p || e.o, o = mkO(p.x, p.y, axisDir(C.x - p.x, C.y - p.y));
  switch (e.t) {
    case 20: { const [X, Y] = iso(p.x, p.y, 0), [, Y2] = iso(p.x, p.y, 30); c.fillStyle = '#8c939d'; c.fillRect(X - 0.5, Y2, 1, Y - Y2); const sw = Math.sin(T * 1.5 + e.o.a * 3) * 0.6; c.fillStyle = '#d42a44'; c.fillRect(X + 0.5 + sw, Y2 + 1, 5, 17); c.fillStyle = '#f2f2f2'; c.fillRect(X + 0.5 + sw, Y2 + 7, 5, 2); c.fillStyle = '#14213d'; c.fillRect(X + 0.5 + sw, Y2 + 17, 5, 1.5); break; }
    case 21: { obox(c, o, -9, 9, -1.5, 1.5, 0, 9, '#2b2f38'); obox(c, o, -11, 11, -1.5, 1.5, 9, 22, '#0b0e14', '#222831'); const T3 = T * 3; owall(c, o, -9.6, 9.6, 1.6, 10, 21, '#c8e2f2'); for (let k = 0; k < 4; k++) { const u = -7 + ((T3 + k * 4.5) % 14); owall(c, o, u, u + 1.4, 1.7, 14 + (k % 2) * 3, 16 + (k % 2) * 3, k % 2 ? '#2f63e0' : '#d42a44'); } owall(c, o, -9.6, 9.6, 1.7, 19.6, 21, '#d42a44'); break; }
    case 22: for (const [du, dv] of [[-9, 0], [9, 2]]) { const q = opt(o, du, dv); boxC(c, q[0] - 3, q[1] - 3, 6, 6, 0, 9, '#4a4f58'); box(c, q[0] - 3.6, q[1] - 3.6, 7.2, 7.2, 9, 10, '#e8e0d0', '#c8c0b0', '#a8a090'); for (const [sx, sy] of [[-6, 0], [6, 1], [0, 6]]) boxC(c, q[0] + sx - 1.4, q[1] + sy - 1.4, 2.8, 2.8, 0, 5, '#7a2a3a'); drawPerson(q[0] + 5, q[1] - 5, '#d42a44', '#3b2a1a', '#2a2f3c'); drawPerson(q[0] - 5, q[1] - 4, '#f2f2f2', '#9a9aa2', '#2a2f3c'); } break;
    case 23: { boxC(c, p.x - 11, p.y - 4, 22, 8, 0, 5, '#6b4a2a'); for (const du of [-7, 0, 7]) { const [X, Y] = iso(p.x + du, p.y, 5); c.fillStyle = '#235f2c'; c.beginPath(); c.arc(X, Y - 4, 4.4, 0, TAU); c.fill(); c.fillStyle = '#38873a'; c.beginPath(); c.arc(X - 1, Y - 6, 2.8, 0, TAU); c.fill(); } break; }
    case 24: { const [X, Y] = iso(p.x, p.y, 0); c.fillStyle = '#8f8a80'; c.beginPath(); c.ellipse(X, Y - 1, 15, 7, 0, 0, TAU); c.fill(); c.fillStyle = '#2f7fc4'; c.beginPath(); c.ellipse(X, Y - 2, 12.5, 5.6, 0, 0, TAU); c.fill(); c.fillStyle = '#cfe8f7'; c.fillRect(X - 1, Y - 12, 2, 10); for (let k = 0; k < 5; k++) { const t = (T * 0.9 + k / 5) % 1; c.fillStyle = 'rgba(207,232,247,' + (1 - t) + ')'; c.fillRect(X - 6 + k * 3, Y - 4 - Math.sin(t * Math.PI) * 5, 1.2, 1.2); } c.strokeStyle = '#e8f4fc'; c.lineWidth = 0.8; c.beginPath(); c.ellipse(X, Y - 2, 12.5 + Math.sin(T * 2) * 0.5, 5.6, 0, 0, TAU); c.stroke(); break; }
    case 25: { obox(c, o, -26, 26, -14, 14, 0, 1, '#2a1f45', '#3a2d5a'); for (const u of [-18, -9, 0]) { obox(c, o, u - 3, u + 3, -12, -7, 0, 14, '#2a2f55'); obox(c, o, u - 2.2, u + 2.2, -7.2, -6.6, 6, 12, (Math.sin(T * 4 + u) > 0) ? '#5fd7ff' : '#ff5fa2'); } obox(c, o, 8, 24, -12, -3, 0, 9, '#c0392b', '#ffffff'); obox(c, o, 12, 20, -4, -3, 1, 8, '#ffffffaa'); const [X, Y] = iso(...opt(o, 0, 0), 28), glow = (Math.sin(T * 3) > 0) ? '#ff5fa2' : '#5fd7ff'; c.fillStyle = '#0d1016'; c.fillRect(X - 17, Y - 5, 34, 9); txtC(c, 'FAN ZONE', X, Y + 1.8, glow, 7); drawPerson(...opt(o, -14, 6), '#2f63e0', '#3b2a1a', '#2a2f3c'); drawPerson(...opt(o, 14, 4), '#d42a44', '#e8c27a', '#2a2f3c'); const [bx, by] = iso(...opt(o, 14, 4), 6 + Math.abs(Math.sin(T * 4)) * 3); c.fillStyle = '#111'; c.fillRect(bx + 4, by, 1.6, 1.6); break; }
    case 26: { obox(c, o, -22, 22, -10, 10, 0, 1, '#7a2a3a', '#8e3447'); obox(c, o, -18, 18, -10, -8, 0, 22, '#2a2e3a'); const [X, Y] = iso(...opt(o, 0, -9), 14); drawLogo(c, X, Y, 9); const m = opt(o, 0, 2), [MX, MY] = iso(m[0], m[1], 0), wv = Math.sin(T * 4); c.fillStyle = '#00000040'; c.fillRect(MX - 5, MY - 1, 10, 2); c.fillStyle = '#c9a56b'; c.fillRect(MX - 4.4, MY - 12, 8.8, 9); c.fillStyle = '#f4efe6'; c.fillRect(MX - 3, MY - 9, 6, 5); c.fillStyle = '#c9a56b'; c.fillRect(MX - 4.4, MY - 19.6, 8.8, 7.6); c.fillStyle = '#f4efe6'; c.fillRect(MX - 3.4, MY - 17.6, 6.8, 4.4); c.fillStyle = '#c9a56b'; c.fillRect(MX - 4.4, MY - 22, 2.2, 3); c.fillRect(MX + 2.2, MY - 22, 2.2, 3); c.fillStyle = '#111'; c.fillRect(MX - 2.4, MY - 16.4, 1.4, 1.4); c.fillRect(MX + 1, MY - 16.4, 1.4, 1.4); c.fillStyle = '#c9a56b'; c.fillRect(MX + 4.6, MY - 12 - Math.max(0, wv) * 4, 1.8, 6); for (let k = 0; k < 3; k++) drawPerson(...opt(o, -12 + k * 3, 12 + k * 5), ['#d42a44', '#2f63e0', '#f2c230'][k], '#3b2a1a', '#2a2f3c'); break; }
    case 27: { for (let k = 0; k < 8; k++) { const u = -16 + k * 4.4; obox(c, o, u, u + 4, -3, 2, 0, 16, k % 2 ? '#3b82f6' : '#d42a44'); obox(c, o, u + 1.4, u + 2.6, 2, 2.5, 11, 12.4, (Math.sin(T * 2 + k) > -0.2) ? '#4ee07a' : '#1f6b3a'); } const [X, Y] = iso(...opt(o, 0, -3), 24); c.fillStyle = '#0d1016'; c.fillRect(X - 19, Y - 4, 38, 8); txtC(c, 'MOBILE ORDER PICKUP', X, Y + 1.6, '#4ee07a', 4.6); break; }
  }
}

/* ---------- 7. the frame ---------- */
function render() {
  const c = ctx, z = cam.z, [cx, cy] = camIso();
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#1f4f80'; c.fillRect(0, 0, CW, CH);
  c.setTransform(z, 0, 0, z, Math.round(CW / 2 - cx * z), Math.round(CH / 2 - cy * z));
  c.drawImage(isoCv, -OX, -OY);
  drawCrowd(c);
  const vis = viewRect(), inV = (x, y) => x > vis.x0 && x < vis.x1 && y > vis.y0 && y < vis.y1;
  // ground-level layer
  c.save(); c.transform(0.5, 0.25, -0.5, 0.25, 0, 0);
  drawRinkFlat();
  SLOTS.forEach((a, si) => { if (S.stands.some(s => s.slot === si)) return; const p = slotPos(si); c.save(); c.translate(p.x, p.y); c.rotate(a + Math.PI / 2); c.strokeStyle = '#ffffff99'; c.setLineDash([5, 4]); c.lineWidth = 2; c.strokeRect(-24, -13, 48, 26); c.setLineDash([]); c.fillStyle = '#ffffffcc'; c.font = 'bold 20px system-ui'; c.textAlign = 'center'; c.fillText('+', 0, 7); c.restore(); });
  c.fillStyle = '#f2f2e6'; for (const t of trash) c.fillRect(t.x - 1.5, t.y - 1.5, 3, 3);
  c.fillStyle = '#ffffffaa'; c.font = 'bold 15px system-ui'; c.textAlign = 'center'; for (const l of LABELS) c.fillText(l.t, l.x, l.y);
  if (inspected && inspected.hl) { c.strokeStyle = '#4da3ff'; c.lineWidth = 3; c.setLineDash([7, 5]); c.beginPath(); c.arc(inspected.hl.x, inspected.hl.y, inspected.hl.r, 0, TAU); c.stroke(); c.setLineDash([]); }
  c.restore();
  // everything that stands up, sorted back-to-front
  const E = [];
  rinkPerim(); PERIM.forEach((_, i) => E.push({ k: PERIM_K[i], t: 0, o: i }));
  SLOTS.forEach((a, si) => { const p = slotPos(si); if (inV(p.x, p.y)) E.push({ k: p.x + p.y, t: 1, o: si, a, p }); });
  gates.forEach((g, i) => { const p = gateDoor(i); E.push({ k: p.x + p.y + 30, t: 2, o: i, g }); });
  for (const a of agents) { if (a.state === 'pending' || a.state === 'done' || !inV(a.x, a.y)) continue; if (a.state === 'seated' && !heat) continue; E.push({ k: a.x + a.y, t: 3, o: a }); }
  if (isPeriod() || phK() === 'SO') for (const p of players) { if (!p.off) E.push({ k: p.x + p.y, t: 4, o: p }); else if (p.pen > 0) E.push({ k: C.x + C.y + RK.y1, t: 16, o: p }); }
  for (const j of janitors) E.push({ k: j.x + j.y, t: 5, o: j });
  E.push({ k: me.x + me.y, t: 6, o: me });
  for (const st of stalls) if (st.car && !st.hidden && inV(st.x, st.y)) E.push({ k: st.x + st.y, t: 7, o: st });
  for (const t of traffic) { const x = t.vert ? t.line : t.p, y = t.vert ? t.p : t.line; if (inV(x, y)) E.push({ k: x + y, t: 8, o: t, x, y }); }
  if (zam) { const t = zam.t / 70, lap = t * 5, a = lap * TAU, sh = 1 - (lap | 0) / 6; E.push({ k: C.x + Math.cos(a) * 170 * sh + C.y + Math.sin(a) * 66 * sh, t: 9 }); }
  pushShow(E); pushDecor(E, vis);
  if (ph !== 0) for (const q of [[1128, 1470], [1172, 1470], [1828, 1470], [1872, 1470]]) E.push({ k: q[0] + q[1], t: 15, o: q });
  const sf = gateFrame(1); E.push({ k: sf.cx + sf.cy + 600, t: 14 });
  E.sort((p, q) => p.k - q.k);
  for (const e of E) switch (e.t) {
    case 0: drawBoard(e.o); break;
    case 1: drawBooth(e.o, e.a, e.p); ropes(S.stands.find(s => s.slot === e.o) || { _q: [] }, c); break;
    case 2: drawGate(e.o, e.g); break;
    case 3: drawFan(e.o); break;
    case 4: drawPlayer(e.o, false); break;
    case 5: drawPerson(e.o.x, e.o.y, '#1e9e5a', '#1e9e5a', '#2a2f3c'); break;
    case 6: drawPerson(me.x, me.y, '#1b2433', '#f0c94a', '#10131a', 'OWNER'); break;
    case 7: { const k = e.o.car, al = Math.min(1, k.t * 2) * (k.leaving ? Math.max(0, 1 - k.lt / 2) : 1); c.globalAlpha = al; drawCar(e.o.x, e.o.y, k.col, true); c.globalAlpha = 1; break; }
    case 8: drawCar(e.x, e.y, e.o.col, e.o.vert); break;
    case 9: drawZam(); break;
    case 10: drawShowPlayer(e.o); break;
    case 11: drawShowFan(e.o); break;
    case 12: drawBus(e.o); break;
    case 13: { const [X, Y] = iso(e.o.x, e.o.y, 0); c.fillStyle = '#f2c230'; c.fillRect(X - 1, Y - 5, 2, 5); c.fillStyle = '#111'; c.fillRect(X - 3.5, Y - 4.4, 7, 1.2); c.fillStyle = '#f2c230'; c.fillRect(X - 3.5, Y - 3.2, 7, 1); break; }
    case 14: drawArenaSign(); break;
    case 15: drawAttendant(e.o[0], e.o[1], e.o[0]); break;
    case 16: drawPlayer(e.o, true); break;
    default: if (e.t >= 20) drawDecor(e);
  }
  if (isPeriod() || phK() === 'SO') { const [X, Y] = iso(puck.x, puck.y, puck.owner ? 1 : 2.5); c.fillStyle = '#000'; c.fillRect(X - 1.2, Y - 1, 2.4, 1.6); }
  if (S.jumbotron) drawJumbo();
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.kind === 'txt') { const [X, Y] = iso(p.x, p.y, 14 + (1.6 - p.life) * 12); c.globalAlpha = Math.min(1, p.life); c.fillStyle = p.col; c.font = 'bold 7px system-ui'; c.textAlign = 'center'; c.fillText(p.text, X, Y); c.globalAlpha = 1; }
    else { const [X, Y] = iso(p.x, p.y, 0); c.fillStyle = p.col; c.fillRect(X - 2, Y - 1, p.kind === 'hat' ? 4 : 2, 2); }
  }
  // dusk / night: darken the city, keep the arena lit
  const tgt = { DOWN: 0, DOORS: 0.15, P1: 0.35, INT1: 0.4, P2: 0.5, INT2: 0.55, P3: 0.65, EGRESS: 0.75, OT: 0.7, SO: 0.7 }[phK()];
  dark += (tgt - dark) * 0.01;
  if (dark > 0.02) {
    c.save(); c.beginPath(); c.rect(-3000, -400, 7000, 3000);
    for (let k = 0; k <= 48; k++) { const [X, Y] = iso(C.x + Math.cos(k * TAU / 48) * (RING.wall[0] + 44), C.y + Math.sin(k * TAU / 48) * (RING.wall[1] + 38), 0); k ? c.lineTo(X, Y) : c.moveTo(X, Y); }
    c.clip('evenodd'); c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgb(' + Math.round(255 - dark * 175) + ',' + Math.round(255 - dark * 150) + ',' + Math.round(255 - dark * 70) + ')'; c.fillRect(-3000, -400, 7000, 3000); c.restore();
    c.save(); c.globalCompositeOperation = 'lighter';
    const glow = (X, Y, r, col, a) => { const g = c.createRadialGradient(X, Y, 1, X, Y, r); g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(1, 'rgba(' + col + ',0)'); c.fillStyle = g; c.fillRect(X - r, Y - r, r * 2, r * 2); };
    for (const p of TOWERS) { const [X, Y] = iso(p.x, p.y, 122); glow(X, Y, 90, '255,240,180', dark * 0.55); }
    for (const p of LAMPS) { if (!inV(p.x, p.y)) continue; const [X, Y] = iso(p.x, p.y, 44); glow(X, Y, 34, '255,236,170', dark * 0.5); }
    if (S.decor.neon) for (let k = 0; k < 40; k++) { const a = k * TAU / 40, q = ep(a, RING.wall[0] + 4, RING.wall[1] + 3), [X, Y] = iso(q.x, q.y, lerp(62, 10, (fAng(a) + 1) / 2) + 3); if (GATE_A.some(g => Math.abs(normA(a - g)) < 0.2)) continue; c.fillStyle = 'rgba(' + ((k + (T * 2 | 0)) % 3 === 0 ? '255,70,160' : (k + (T * 2 | 0)) % 3 === 1 ? '70,220,255' : '255,200,60') + ',' + (0.8 * dark) + ')'; c.fillRect(X - 3, Y - 1, 6, 1.6); }
    c.restore();
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  if (banner && banner.t > 0) {
    const w = 236, h = 38, x = CW / 2 - w / 2, y = 44; c.globalAlpha = Math.min(1, banner.t); c.fillStyle = banner.col; c.fillRect(x, y, w, h); c.fillStyle = '#00000055'; c.fillRect(x, y + h - 3, w, 3);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '900 19px system-ui'; c.fillText(banner.text, CW / 2, y + 20); c.font = '600 7px system-ui'; c.fillText(banner.sub, CW / 2, y + 31); c.globalAlpha = 1;
  }
  if (horn > 0) { c.fillStyle = 'rgba(255,40,60,' + (0.12 * Math.abs(Math.sin(horn * 8))) + ')'; c.fillRect(0, 0, CW, CH); }
}

function clockStr() {
  if (!isPeriod()) return PH[ph].n.split('·')[0].trim();
  const r = Math.max(0, PH[ph].d - pt), m = (r / 60) | 0, s = (r % 60) | 0;
  return phK() + ' ' + m + ':' + String(s).padStart(2, '0');
}

/* ---------------- minimap ---------------- */
const mm = document.getElementById('mm'), mx = mm.getContext('2d');
function drawMini() {
  const sx = mm.width / W, sy = mm.height / H;
  mx.drawImage(cityCv, 0, 0, mm.width, mm.height);
  mx.fillStyle = '#a8a39a'; mx.beginPath(); mx.ellipse(C.x * sx, C.y * sy, RING.wall[0] * sx, RING.wall[1] * sy, 0, 0, TAU); mx.fill();
  mx.fillStyle = '#eef'; mx.fillRect(RK.x0 * sx, RK.y0 * sy, 400 * sx, 170 * sy);
  mx.fillStyle = HOME.color;
  for (let i = 0; i < agents.length; i += 3) { const a = agents[i]; if (a.state !== 'pending' && a.state !== 'done') mx.fillRect(a.x * sx, a.y * sy, 1.2, 1.2); }
  const v = viewRect(); mx.strokeStyle = '#fff'; mx.lineWidth = 1; mx.strokeRect(v.x0 * sx, v.y0 * sy, (v.x1 - v.x0) * sx, (v.y1 - v.y0) * sy);
  mx.fillStyle = '#f0c94a'; mx.beginPath(); mx.arc(me.x * sx, me.y * sy, 3, 0, TAU); mx.fill();
}
mm.addEventListener('click', e => { const r = mm.getBoundingClientRect(); me.x = (e.clientX - r.left) / mm.width * W; me.y = (e.clientY - r.top) / mm.height * H; cam.follow = true; });
