'use strict';
/* =====================================================================
   ARENA TYCOON — walk your hockey arena, watch the game, run the business
   ===================================================================== */
const TAU = Math.PI * 2;
const W = 3000, H = 2300;
const C = { x: 1500, y: 960 };                       // arena centre
const RING = { seatIn: [245, 138], seatOut: [405, 288], conc: [466, 338], stand: [500, 366], wall: [532, 392] };
const FPA = 5;   // fans represented by one little person on screen
const RK = { x0: C.x - 200, x1: C.x + 200, y0: C.y - 85, y1: C.y + 85, r: 56 };
const R = Math.random;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rr = (a, b) => a + R() * (b - a);
const pick = a => a[(R() * a.length) | 0];
const money = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();
const kmoney = n => Math.abs(n) >= 1e6 ? (n < 0 ? '-' : '') + '$' + (Math.abs(n) / 1e6).toFixed(2) + 'M' : Math.abs(n) >= 1e4 ? (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n) / 1000) + 'k' : money(n);
const ep = (a, rx, ry) => ({ x: C.x + Math.cos(a) * rx, y: C.y + Math.sin(a) * ry });
const normA = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const angOf = (x, y, rx, ry) => Math.atan2((y - C.y) / ry, (x - C.x) / rx);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
let seed = 1337; const srnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const HOME = { name: 'Lakeview Lynx', short: 'LYNX', color: '#d42a44' };
const OPPS = [
  { name: 'Ironwood Bears', short: 'BEARS', color: '#2f63e0' },
  { name: 'Coastal Sharks', short: 'SHARKS', color: '#12a39c' },
  { name: 'Summit Eagles', short: 'EAGLES', color: '#e3901c' },
  { name: 'Granite Rams', short: 'RAMS', color: '#7a55cc' },
  { name: 'Riverside Otters', short: 'OTTERS', color: '#2f9a3f' },
  { name: 'Northgate Wolves', short: 'WOLVES', color: '#7d8a99' },
];
const BASE = { ticket: 50, vip: 160, food: 10, beer: 11, merch: 40, parking: 20 };
const COGS = { food: 0.32, beer: 0.25, merch: 0.45, vip: 0.3 };

const TYPES = {
  hotdog:   { label: 'Hot Dog Stand', cat: 'food',  tag: 'FOOD', color: '#e39a2e', rate: 0.34, cost: 60000, items: ['Hot Dog', 'Pretzel', 'Fries', 'Combo'] },
  pizza:    { label: 'Pizza Kitchen', cat: 'food',  tag: 'PIZZA', color: '#e2662b', rate: 0.30, cost: 70000, items: ['Pizza Slice', 'Wings', 'Combo'] },
  nachos:   { label: 'Nacho Cantina', cat: 'food',  tag: 'TACO', color: '#c9b12b', rate: 0.32, cost: 65000, items: ['Nachos', 'Tacos', 'Churro'] },
  bar:      { label: 'Bar',           cat: 'beer',  tag: 'BAR',  color: '#c99a2a', rate: 0.38, cost: 70000, items: ['Draft Beer', 'Seltzer', 'Cocktail', 'Tall Can'] },
  store:    { label: 'Team Store',    cat: 'merch', tag: 'SHOP', color: '#d42a44', rate: 0.22, cost: 90000, items: ['Jersey', 'Hat', 'Puck', 'Scarf', 'Hoodie'] },
  restroom: { label: 'Restrooms',     cat: 'restroom', tag: 'WC', color: '#5f86b3', rate: 0.75, cost: 50000, items: [] },
  vip:      { label: 'VIP Club Lounge', cat: 'vip', tag: 'VIP',  color: '#b8912f', rate: 0.30, cost: 150000, items: ['Wagyu Slider', 'Champagne', 'Craft Flight'] },
};
const BUILDABLE = ['hotdog', 'pizza', 'nachos', 'bar', 'store', 'restroom'];

// concourse slots: every 15° skipping gate areas
const GATE_A = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const GATE_N = ['East', 'South (Main)', 'West', 'North'];
const SLOTS = [];
for (let k = 0; k < 24; k++) {
  const deg = 7.5 + 15 * k, a = deg * Math.PI / 180;
  if (GATE_A.some(g => Math.abs(normA(a - g)) < 10 * Math.PI / 180)) continue;
  SLOTS.push(normA(a));
}
const NSEC = 20;
const secCenter = i => -Math.PI / 2 + i * TAU / NSEC;
const secOf = a => ((Math.round(normA(a + Math.PI / 2) / (TAU / NSEC)) % NSEC) + NSEC) % NSEC;

/* ---------------- persistent state ---------------- */
function freshState() {
  return {
    v: 4, cash: 300000, decor: {}, day: 1, rep: 55, hype: 50, w: 0, l: 0, otl: 0,
    capacity: 8000, vipSeats: 400, parking: 480, lotB: false, garage: false,
    lanes: [2, 3, 2, 2], jumbotron: false, crew: 2, marketing: 0, transit: false,
    weather: 0, ice: 92, building: 90, clean: 100,
    prices: { ticket: 55, vip: 175, food: 10, beer: 11, merch: 40, parking: 25 },
    stands: [
      { slot: 0, type: 'hotdog' }, { slot: 2, type: 'restroom' }, { slot: 3, type: 'bar' },
      { slot: 4, type: 'store' }, { slot: 5, type: 'bar' }, { slot: 7, type: 'pizza' },
      { slot: 9, type: 'restroom' }, { slot: 11, type: 'hotdog' }, { slot: 12, type: 'vip' },
      { slot: 14, type: 'bar' },
    ].map(s => ({ ...s, lvl: 1, cond: 85 + (R() * 15 | 0), open: true })),
    history: [], opp: 0, phase: 0, pt: 0,
  };
}
function load() {
  try { const s = JSON.parse(localStorage.getItem('arenaTycoon')); if (s && s.v === 4) { s.phase = 0; s.pt = 0; return s; } } catch (e) {}
  return null;
}
function save() {
  try { localStorage.setItem('arenaTycoon', JSON.stringify(S, (k, v) => k[0] === '_' ? undefined : v)); } catch (e) {}
}
let S = load() || freshState();

/* ---------------- phases ---------------- */
const PH = [
  { k: 'DOWN',   n: 'Downtime · Maintenance', d: 360 },
  { k: 'DOORS',  n: 'Doors Open · Fans Arriving', d: 120 },
  { k: 'P1',     n: '1st Period', d: 300 },
  { k: 'INT1',   n: '1st Intermission', d: 90 },
  { k: 'P2',     n: '2nd Period', d: 300 },
  { k: 'INT2',   n: '2nd Intermission', d: 90 },
  { k: 'P3',     n: '3rd Period', d: 300 },
  { k: 'EGRESS', n: 'Final Horn · Fans Leaving', d: 120 },
  { k: 'OT',     n: 'Overtime · 3-on-3', d: 120 },
  { k: 'SO',     n: 'Shootout', d: 25 },
];
let ph = 0, pt = 0, speed = 1, T = 0;
const phK = () => PH[ph].k;
const isPeriod = () => phK() === 'P1' || phK() === 'P2' || phK() === 'P3' || phK() === 'OT';
const isInt = () => phK().startsWith('INT');
const inGame = () => ph !== 0;

/* ---------------- runtime ---------------- */
let agents = [], trash = [], janitors = [], particles = [], traffic = [], stalls = [], scanFx = [], exitShow = null, crowdDirty = true;
let G = null;        // current game ledger
let heat = false, modalOpen = false, inspected = null, nextEvent = 40, alertsT = 0;
const gates = GATE_A.map((a, i) => ({ i, a, lq: Array.from({ length: S.lanes[i] }, () => []), acc: [], served: 0 }));
const me = { x: C.x, y: C.y + RING.wall[1] + 70, vx: 0, vy: 0, face: -Math.PI / 2 };
const cam = { x: me.x, y: me.y - 60, z: 1.5, zt: 1.5, follow: true };
const keys = {};

function newLedger() {
  return {
    opp: OPPS[S.opp % OPPS.length], att: 0, vipAtt: 0, turned: 0, carAgents: 0,
    rev: { tickets: 0, vip: 0, parking: 0, food: 0, beer: 0, merch: 0, ads: 0, other: 0 },
    cogs: 0, exp: 0, lostSales: 0, walkaways: 0, spark: [0], sparkT: 0, feed: [], mood: 70,
    eventsCost: 0, eventsGain: 0, pens: [0, 0], earlyLeavers: 0, dec: null,
  };
}

/* ---------------- geometry helpers ---------------- */
function slotPos(slot, r = RING.stand) { return ep(SLOTS[slot], r[0], r[1]); }
function concPt(a, lane) { return ep(a, RING.conc[0] + lane, RING.conc[1] + lane * 0.72); }
function ringPath(a1, a2, lane) {
  const d = normA(a2 - a1), n = Math.max(1, Math.ceil(Math.abs(d) / 0.13)), out = [];
  for (let i = 1; i <= n; i++) out.push(concPt(a1 + d * i / n, lane));
  return out;
}
function gateIn(g, lane) { return concPt(GATE_A[g], lane); }
function gateDoor(g) { return ep(GATE_A[g], RING.wall[0] + 4, RING.wall[1] + 4); }
function gateOut(g) { return ep(GATE_A[g], RING.wall[0] + 34, RING.wall[1] + 34); }
function vomPt(a) { return ep(a, RING.seatOut[0] + 6, RING.seatOut[1] + 5); }
function randSeat(sec) {                     // pick a real seat in this section (the seat map is built by render.js)
  const list = (typeof SEC_SEATS !== 'undefined' && SEC_SEATS[sec]) || [];
  if (list.length) { const q = list[(R() * list.length) | 0]; return { a: q.a, t: 0, x: q.x, y: q.y, z: q.z, idx: q.idx }; }
  const a = secCenter(sec) + rr(-0.42, 0.42) * TAU / NSEC;
  return { a, t: 0, x: C.x + Math.cos(a) * 330, y: C.y + Math.sin(a) * 215, z: 10, idx: -1 };
}
/* gate geometry: u runs along the wall, v runs outward from the door */
const GATE_V = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const G_E = -30, G_X = 70;                   // centre of the entry lanes / of the exit doors (along the wall)
function gateFrame(i) { const d = gateDoor(i), V = GATE_V[i]; return { cx: d.x, cy: d.y, V, U: [-V[1], V[0]] }; }
function gatePt(i, u, v) { const f = gateFrame(i); return { x: f.cx + f.U[0] * u + f.V[0] * v, y: f.cy + f.U[1] * u + f.V[1] * v }; }
const laneU = (i, l) => G_E + (l - (S.lanes[i] - 1) / 2) * 13;
function queuePt(st, i) {                    // serpentine line in front of a counter, 8 per column
  const a = SLOTS[st.slot], col = (i / 8) | 0, step = i % 8, row = col % 2 ? 7 - step : step;
  const r = RING.stand[0] - 28 - row * 8;
  return ep(a + col * 0.05, r, r * RING.stand[1] / RING.stand[0]);
}
const DECOR = {
  banners:   { name: 'Team banners & pennants', cost: 25000, d: 'Banners and retired-number flags along the concourse walls. Hype +0.4 per game, happier fans.' },
  floorlogo: { name: 'Polished floors & giant logos', cost: 40000, d: 'Terrazzo floors with the team logo at every gate. Fans stay happier.' },
  screens:   { name: 'Live-game TV screens', cost: 60000, d: 'Wall screens show the game, so fans waiting in line are 25% more patient.' },
  lounge:    { name: 'Fan lounge & high-top tables', cost: 45000, d: 'Somewhere to eat and chat. Better mood, a bit more patience.' },
  garden:    { name: 'Planters, trees & fountain', cost: 35000, d: 'Greenery and a fountain at the main gate. Mood +, reputation +0.3 per game.' },
  arcade:    { name: 'Fan Zone: arcade & shootout game', cost: 90000, d: 'Kids and fans queue up to play. About $1.40 per fan extra every game.' },
  photo:     { name: 'Mascot meet-and-greet & photo booth', cost: 55000, d: 'Lenny the Lynx meets fans. Reputation +0.8 per game.' },
  neon:      { name: 'LED ribbons & neon signs', cost: 30000, d: 'The concourse glows at night. Hype +0.5 per game.' },
  mobile:    { name: 'Mobile-order pickup lockers', cost: 120000, d: 'Fans order from their seat. Every stand serves 15% faster.' },
};

/* ====================================================================
   PEOPLE — every fan has a personality, and a social-media voice
   ==================================================================== */
const FN = ['Mike', 'Sarah', 'Jake', 'Emma', 'Chris', 'Dani', 'Luis', 'Priya', 'Tom', 'Aisha', 'Ben', 'Mia', 'Carlos', 'Hana', 'Owen', 'Zoe', 'Ravi', 'Kim', 'Noah', 'Lena', 'Dave', 'Rosa', 'Sam', 'Tess', 'Omar', 'Gwen', 'Pete', 'Yuki', 'Brad', 'Nora'];
const LN = ['R.', 'S.', 'K.', 'T.', 'M.', 'P.', 'D.', 'L.', 'H.', 'B.', 'C.', 'W.', 'N.', 'J.', 'F.'];
// tol = how far above the "fair" price they'll pay (1.0 = market price). temper = how hard bad things hit their mood. loy = how much the score moves them.
const ARCH = {
  diehard: { label: 'Die-hard fan',  w: 0.12, loy: [0.85, 1.0], temper: [1.1, 1.5], tol: [1.3, 1.8], pat: [0.9, 1.2], app: { food: 1, beer: 1.1, merch: 1.8 }, chat: 0.7, color: '#d42a44' },
  casual:  { label: 'Casual fan',    w: 0.28, loy: [0.35, 0.65], temper: [0.8, 1.1], tol: [1.08, 1.5], pat: [0.9, 1.2], app: { food: 1, beer: 1, merch: 0.7 }, chat: 0.3, color: '#4da3ff' },
  foodie:  { label: 'Foodie',        w: 0.12, loy: [0.4, 0.7], temper: [0.9, 1.2], tol: [1.3, 1.9], pat: [0.8, 1.1], app: { food: 2.2, beer: 0.8, merch: 0.4 }, chat: 0.5, color: '#e39a2e' },
  spender: { label: 'Big spender',   w: 0.08, loy: [0.5, 0.8], temper: [0.7, 1.0], tol: [1.6, 2.3], pat: [0.7, 1.0], app: { food: 1.4, beer: 1.6, merch: 2.4 }, chat: 0.4, color: '#f0c94a' },
  penny:   { label: 'Penny pincher', w: 0.14, loy: [0.4, 0.8], temper: [1.1, 1.5], tol: [0.88, 1.1], pat: [1.0, 1.4], app: { food: 0.7, beer: 0.6, merch: 0.2 }, chat: 0.55, color: '#3fcf7a' },
  grump:   { label: 'Grump',         w: 0.08, loy: [0.3, 0.7], temper: [1.5, 2.1], tol: [1.02, 1.3], pat: [0.55, 0.8], app: { food: 0.9, beer: 1.2, merch: 0.3 }, chat: 0.8, color: '#9a7a5a' },
  family:  { label: 'Family fan',    w: 0.10, loy: [0.5, 0.8], temper: [0.8, 1.2], tol: [1.05, 1.35], pat: [1.1, 1.5], app: { food: 1.5, beer: 0.4, merch: 1.4 }, chat: 0.35, color: '#c9a56b' },
  student: { label: 'College kid',   w: 0.08, loy: [0.5, 0.9], temper: [1.0, 1.4], tol: [0.96, 1.25], pat: [0.6, 0.9], app: { food: 1.2, beer: 1.9, merch: 0.3 }, chat: 0.9, color: '#7a55cc' },
};
const PCACHE = new Map();
function rngSeed(seed) { let t = ((seed * 2654435761) + 1013904223) >>> 0; return () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
function personaFrom(seed) {                       // the same seat always holds the same person
  if (PCACHE.has(seed)) return PCACHE.get(seed);
  const r = rngSeed(seed), rg = ([a, b]) => a + r() * (b - a);
  let x = r(), key = 'casual'; for (const k in ARCH) { x -= ARCH[k].w; if (x <= 0) { key = k; break; } }
  const A = ARCH[key], first = FN[(r() * FN.length) | 0], last = LN[(r() * LN.length) | 0];
  const p = { key, label: A.label, name: first + ' ' + last, handle: '@' + first.toLowerCase() + (r() < 0.5 ? '_' + last[0].toLowerCase() : ((r() * 90 + 10) | 0)), loy: rg(A.loy), temper: rg(A.temper), tol: rg(A.tol), pat: rg(A.pat), app: A.app, chat: A.chat, color: A.color };
  PCACHE.set(seed, p); return p;
}
function priceVerdict(a, cat) {                    // would THIS person pay today's price?
  const key = cat === 'vip' ? 'beer' : cat, ratio = S.prices[key] / BASE[key];
  const tol = a.p.tol * (a.vip ? 1.35 : 1) * (cat === 'merch' ? (a.p.app.merch > 1 ? 1.15 : 0.9) : 1);
  if (ratio <= tol * 0.85) return 'ok';
  if (ratio <= tol) return R() < 0.5 ? 'grumble' : 'ok';
  return 'refuse';
}
function thought(a) {                              // what they'd say if you asked
  const p = a.p;
  if (a.state === 'queue' && a.qt > 25) return 'This line is taking forever.';
  if (a.state === 'gateQ' && a.gw > 25) return 'Come on, let me in already!';
  if (a.why === 'prices' && a.sat < 60) return p.tol < 1.1 ? 'Everything here costs a fortune.' : 'OK these prices are getting silly.';
  if (a.why === 'losing' && a.sat < 55) return 'Defense is asleep tonight...';
  if (a.sat < 35) return 'Not a great night at the arena.';
  if (a.sat > 80) return p.key === 'diehard' ? 'LET\'S GO LYNX!!!' : 'This place is awesome tonight.';
  return p.key === 'foodie' ? 'Where\'s the good food at?' : p.key === 'student' ? 'Anybody got a cheap beer?' : 'Good game so far.';
}

/* ---------- social media: "Chirp" ---------- */
let social = [], chirpCD = {};
const NEWS = [{ name: 'Lakeview Daily', handle: '@LakeviewDaily', verified: 1, color: '#2f63e0' }, { name: 'Puck Insider', handle: '@PuckInsider', verified: 1, color: '#12a39c' }, { name: 'Lynx Official', handle: '@LakeviewLynx', verified: 1, color: '#d42a44' }];
const TAG = { price: '#OverpricedLynx', priceOk: '#EatAtLynx', line: '#LineNightmare', gate: '#SecurityLine', gateFast: '#SmoothEntry', parking: '#NoParking', goalHome: '#GoLynx', goalAway: '#LynxDown', penHome: '#BadCall', penAway: '#PowerPlay', win: '#LynxWin', loss: '#LynxLose', leave: '#Embarrassing', dirty: '#GrossArena', clean: '#CleanArena', food: '#EatAtLynx', decor: '#LynxArena', ticket: '#TicketPrices', auto: '#LynxFamily', ot: '#OvertimeThriller', hat: '#HatTrick', wave: '#TheWave' };
const CDS = { price: 5, priceOk: 40, line: 7, gate: 6, gateFast: 90, parking: 5, goalHome: 3, goalAway: 3, penHome: 12, penAway: 12, win: 1, loss: 1, leave: 14, dirty: 25, clean: 90, food: 30, decor: 30, ticket: 8, auto: 5, ot: 1, hat: 1, wave: 60 };
const TPL = {
  price: [['{pr} for a {item}?? 😤', -1], ['Not paying {pr} for a {item}. I\'m out.', -1], ['{item}: {pr}. Highway robbery.', -1], ['My wallet just cried. {pr} {item} 💸', -1], ['{pr}?! for a {item}?! no thanks', -1], ['Lynx arena prices are a joke. {pr} {item}.', -1]],
  priceOk: [['{item} for only {pr}! Best deal in the league', 1], ['Fair prices at the Lynx — {pr} {item}, no complaints', 1]],
  line: [['been in line {n} min and I\'m missing the game 😡', -1], ['why is there only one register open at the {stand}?!', -1], ['the {stand} line is out of control', -1], ['gave up on the {stand}. {n} min wait. unreal.', -1]],
  gate: [['security line is around the block... {n} min and counting', -1], ['{n} minutes to get through the metal detector 🙄', -1], ['Add more lanes @LakeviewLynx!! puck drop is soon', -1]],
  gateFast: [['In and in my seat in 3 minutes. Smooth entry tonight!', 1], ['Security lanes moving fast — nice work @LakeviewLynx', 1]],
  parking: [['parking lot FULL. turned around and went home 🤦', -1], ['no parking = no ticket money from me', -1], ['Lot A is jammed. Missed the first period!', -1]],
  goalHome: [['GOOOOAL!!! {scorer} 🚨🚨', 1], ['{scorer} scores!! this place is LOUD 🔥', 1], ['LYNX SCORE!! can\'t hear a thing 😂', 1]],
  goalAway: [['ugh. {opp} score. 😩', -1], ['defense asleep again.', -1], ['{opp} on the board. bad vibes in here', -1]],
  penHome: [['that\'s a soft call 🙄', -1], ['ref is blind!!', -1]],
  penAway: [['FINALLY a call our way!', 1], ['power play time!! 💪', 1]],
  win: [['LYNX WIN!!! {score} 🎉', 1], ['what a game! best night at the arena', 1], ['{score}. I love this team', 1]],
  loss: [['{score}. brutal.', -1], ['tough one. see you next game I guess', -1], ['{score}... we have to be better', -1]],
  leave: [['leaving early. this is embarrassing.', -1], ['gonna beat the traffic. {score} isn\'t worth it', -1], ['I\'ve seen enough. out.', -1]],
  dirty: [['bathrooms are disgusting 🤢', -1], ['trash everywhere on the concourse', -1], ['@LakeviewLynx clean this place up please', -1]],
  clean: [['arena is spotless tonight, nice job', 1]],
  food: [['best {item} I\'ve had at a game 😋', 1], ['the {stand} is 🔥 tonight', 1]],
  decor: [['love the new {thing}! 🙌', 1], ['the {thing} is so cool', 1]],
  ticket: [['{pr} for a ticket?? lol', -1], ['Ticket prices are insane now. {pr}!', -1], ['gonna skip this one, {pr} is too much', -1]],
  auto: [['got #{n} to sign my jersey!!! 🥹', 1], ['the players stayed to sign for everyone 🙌', 1], ['best fan night ever', 1]],
  ot: [['OVERTIME!!! my heart can\'t take it', 1]], hat: [['HAT TRICK!!! hats everywhere 🎩', 1]], wave: [['the wave is going around!! 🌊', 1]],
};
const ITEMS = { food: ['hot dog', 'pretzel', 'nachos', 'pizza slice', 'wings'], beer: ['beer', 'seltzer', 'cocktail', 'tall can'], merch: ['jersey', 'hat', 'hoodie', 'scarf'] };
function postObj(author, text, tag, s) {
  const likes = Math.floor(rr(0, 14) * (1 + (author.chat || 0.5) * 3) * (R() < 0.05 ? 25 : 1));
  const p = { t: T, name: author.name, handle: author.handle, color: author.color, verified: author.verified, text, tag, s, likes, id: social.length ? social[0].id + 1 : 1 };
  social.unshift(p); if (social.length > 140) social.pop();
  if (G) { G.sentSum = (G.sentSum || 0) + s; G.sentN = (G.sentN || 0) + 1; }
  return p;
}
function chirp(topic, a, ctx) {
  ctx = ctx || {}; if (T < (chirpCD[topic] || 0)) return;
  const author = a && a.p ? a.p : personaFrom((R() * 1e6) | 0);
  if (R() > 0.2 + author.chat * 0.8) return;
  chirpCD[topic] = T + (CDS[topic] || 6) * rr(0.6, 1.4);
  const [tpl, s] = pick(TPL[topic]);
  const text = tpl.replace('{pr}', '$' + Math.round(ctx.price || (ctx.cat ? S.prices[ctx.cat === 'vip' ? 'beer' : ctx.cat] : S.prices.ticket)))
    .replace('{item}', ctx.cat ? pick(ITEMS[ctx.cat === 'vip' ? 'beer' : ctx.cat]) : pick(ITEMS.food)).replace('{n}', ctx.n || 5).replace('{stand}', ctx.stand ? TYPES[ctx.stand.type].label.toLowerCase() : 'bar')
    .replace('{scorer}', ctx.scorer || 'our guy').replace('{opp}', G ? G.opp.name : 'they').replace('{score}', ctx.score || '').replace('{thing}', ctx.thing || 'concourse');
  return postObj(author, text + ' ' + (TAG[topic] || ''), TAG[topic] || '', s);
}
function official(text, who, s, tag) { return postObj(NEWS[who || 0], text, tag || '', s || 0); }
function someFan() { for (let i = 0; i < 12; i++) { const a = agents[(R() * agents.length) | 0]; if (a && (a.state === 'seated' || a.state === 'queue' || a.state === 'back')) return a; } return null; }
function socialPhase(k) {
  const opp = G ? G.opp : OPPS[S.opp % OPPS.length], sc = HOME.short + ' ' + score[0] + '–' + score[1] + ' ' + opp.short;
  if (k === 'DOORS') official('Doors are open at Lakeview Arena! ' + HOME.name + ' host the ' + opp.name + ' tonight. 🏒', 2, 1, '#GoLynx');
  if (k === 'INT1' || k === 'INT2') official('End of ' + (k === 'INT1' ? '1st' : '2nd') + ' period: ' + sc + '. Shots ' + shotsOn[0] + '–' + shotsOn[1] + '.', 1, 0, '#LynxHockey');
  if (k === 'OT') { official('We\'re going to OVERTIME in Lakeview! ' + sc, 1, 1, '#OvertimeThriller'); chirpCD.ot = 0; chirp('ot', someFan()); }
  if (k === 'EGRESS' && G) { official('FINAL: ' + sc + (G.dec ? ' (' + G.dec + ')' : '') + '. Attendance ' + G.att.toLocaleString() + '.', 0, score[0] > score[1] ? 1 : -1, '#LynxHockey'); chirpCD.win = chirpCD.loss = 0; for (let i = 0; i < 3; i++) { chirpCD.win = chirpCD.loss = 0; chirp(score[0] > score[1] ? 'win' : 'loss', someFan(), { score: sc }); } }
  if (k === 'DOWN') { const o = OPPS[S.opp % OPPS.length], f = demandForecast(); official('Up next: ' + HOME.name + ' vs ' + o.name + '. Ticket demand looks like ' + f.demand.toLocaleString() + ' fans. 🎟️', 2, 0, '#NextGame'); if (S.prices.ticket / BASE.ticket > 1.25) { chirpCD.ticket = 0; chirp('ticket', null, { price: S.prices.ticket }); chirpCD.ticket = 0; chirp('ticket', null, { price: S.prices.ticket }); } }
}


/* ---------------- parking ---------------- */
function buildStalls() {
  stalls = [];
  for (let p = 0; p < 6; p++) for (let row = 0; row < 2; row++) for (let c = 0; c < 40; c++)
    stalls.push({ x: 975 + c * 26, y: 1510 + p * 82 + row * 26, lot: 'A', car: null });
  if (S.lotB) for (let p = 0; p < 6; p++) for (let row = 0; row < 2; row++) for (let c = 0; c < 18; c++)
    stalls.push({ x: 2225 + c * 26, y: 1510 + p * 82 + row * 26, lot: 'B', car: null });
  if (S.garage) for (let i = 0; i < 400; i++) stalls.push({ x: 2350 + (i % 20) * 9, y: 520 + ((i / 20) | 0) * 9, lot: 'G', car: null, hidden: true });
}
const TRANSIT = { x: 560, y: 900 };

/* ====================================================================
   CITY (pre-rendered)
   ==================================================================== */
const roadsX = [250, 850, 2150, 2750], roadsY = [330, 1430, 2080], RW = 56;
let cityCv = null;
const LABELS = [];
function buildCity() {
  seed = 1337; LABELS.length = 0; BLDS.length = 0; TREES.length = 0;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = '#3f5a37'; c.fillRect(0, 0, W, H);
  // river
  c.fillStyle = '#2b5f86'; c.fillRect(0, 2140, W, 200);
  c.fillStyle = '#3a7099'; for (let x = 0; x < W; x += 40) c.fillRect(x + srnd() * 20, 2170 + srnd() * 100, 18, 2);
  c.fillStyle = '#8a8170'; c.fillRect(0, 2128, W, 12);
  // blocks with buildings
  const xs = [0, ...roadsX, W], ys = [0, ...roadsY, 2128];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
    const bx = xs[i] + (i ? RW / 2 : 0), by = ys[j] + (j ? RW / 2 : 0);
    const bw = xs[i + 1] - (i < xs.length - 2 ? RW / 2 : 0) - bx, bh = ys[j + 1] - (j < ys.length - 2 ? RW / 2 : 0) - by;
    if (bw <= 0 || bh <= 0) continue;
    // sidewalk
    c.fillStyle = '#9b9a95'; c.fillRect(bx, by, bw, bh);
    const ix = bx + 10, iy = by + 10, iw = bw - 20, ih = bh - 20;
    const isArena = i === 2 && j === 1, isLot = i === 2 && j === 2, isLotB = i === 3 && j === 2, isWest = i === 1 && j === 1;
    if (isArena) { // plaza
      c.fillStyle = '#b9b5ab'; c.fillRect(ix, iy, iw, ih);
      c.strokeStyle = '#a7a398'; c.lineWidth = 1;
      for (let x = ix; x < ix + iw; x += 30) { c.beginPath(); c.moveTo(x, iy); c.lineTo(x, iy + ih); c.stroke(); }
      for (let y = iy; y < iy + ih; y += 30) { c.beginPath(); c.moveTo(ix, y); c.lineTo(ix + iw, y); c.stroke(); }
      for (let k = 0; k < 26; k++) tree(c, ix + 20 + srnd() * iw * 0.12 + (k % 2) * iw * 0.86, iy + 30 + srnd() * (ih - 60));
      continue;
    }
    if (isLot) { lotSurface(c, ix, iy, iw, ih, 'LOT A'); continue; }
    if (isLotB) {
      if (S.lotB) lotSurface(c, ix, iy, iw, ih, 'LOT B');
      else { c.fillStyle = '#5b6b45'; c.fillRect(ix, iy, iw, ih); c.fillStyle = '#ffffff55'; c.font = 'bold 22px system-ui'; c.textAlign = 'center'; c.fillText('VACANT LOT · buy to expand parking', ix + iw / 2, iy + ih / 2); }
      continue;
    }
    if (isWest) {
      c.fillStyle = '#7d7f84'; c.fillRect(ix, iy, iw, ih);
      bldg(c, 360, 760, 400, 260, 26, '#5d6d84', 'TRANSIT CENTER', true);
      c.fillStyle = '#c7b56b'; for (let t = 0; t < 6; t++) c.fillRect(380 + t * 62, 1040, 50, 6);
      bldg(c, 330, 420, 230, 260, 70, '#6e5a7a', 'GRAND HOTEL');
      bldg(c, 590, 430, 220, 150, 22, '#7a4b35', 'THE BLUE LINE · SPORTS BAR');
      bldg(c, 590, 610, 220, 110, 30, '#5f6f5f', 'PUB & GRILL');
      bldg(c, 330, 1110, 480, 260, 40, '#5a6170', 'ARENA OFFICES');
      continue;
    }
    // generic city fill
    let y = iy;
    while (y < iy + ih - 40) {
      const rowH = Math.min(iy + ih - y, 90 + srnd() * 130);
      let x = ix;
      while (x < ix + iw - 40) {
        const w = Math.min(ix + iw - x, 80 + srnd() * 160);
        if (srnd() < 0.12) { c.fillStyle = '#4c7040'; c.fillRect(x + 4, y + 4, w - 8, rowH - 8); for (let t = 0; t < 4; t++) tree(c, x + 10 + srnd() * (w - 20), y + 10 + srnd() * (rowH - 20)); }
        else bldg(c, x + 5, y + 5, w - 10, rowH - 10, 10 + srnd() * 90, pick2(['#6b7280', '#7c6f64', '#5f6b7a', '#80766a', '#566070', '#8a7f74', '#6c5f6e', '#59636b']));
        x += w;
      }
      y += rowH;
    }
  }
  // garage
  if (S.garage) bldg(c, 2330, 500, 200, 200, 60, '#4e5562', 'PARKING GARAGE');
  // roads
  c.fillStyle = '#34373d';
  roadsX.forEach(x => c.fillRect(x - RW / 2, 0, RW, 2128));
  roadsY.forEach(y => c.fillRect(0, y - RW / 2, W, RW));
  c.strokeStyle = '#d9c35a'; c.lineWidth = 2; c.setLineDash([16, 14]);
  roadsX.forEach(x => { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 2128); c.stroke(); });
  roadsY.forEach(y => { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); });
  c.setLineDash([]);
  // crosswalks
  c.fillStyle = '#e8e8e8';
  roadsX.forEach(x => roadsY.forEach(y => {
    for (let k = -3; k <= 3; k++) { c.fillRect(x + k * 7 - 2, y - RW / 2 - 12, 4, 10); c.fillRect(x + k * 7 - 2, y + RW / 2 + 2, 4, 10); }
  }));
  // lot driveways
  c.fillStyle = '#34373d'; [1150, 1850].forEach(x => c.fillRect(x - 20, 1430, 40, 60));
  cityCv = cv; buildIso();
  LABELS.push({ x: 1500, y: 300, t: 'ARENA AVENUE' }, { x: 1500, y: 1400, t: 'LYNX BOULEVARD' }, { x: 1500, y: 2230, t: 'LAKEVIEW RIVER' });
}
function pick2(a) { return a[(srnd() * a.length) | 0]; }
function tree(c, x, y) { TREES.push([x, y]); c.fillStyle = '#00000033'; c.beginPath(); c.arc(x + 3, y + 3, 9, 0, TAU); c.fill(); c.fillStyle = '#2f6b33'; c.beginPath(); c.arc(x, y, 9, 0, TAU); c.fill(); c.fillStyle = '#3d8541'; c.beginPath(); c.arc(x - 2, y - 2, 5, 0, TAU); c.fill(); }
function bldg(c, x, y, w, h, ht, col, label, flat) {
  BLDS.push({ x, y, w, h, ht, col, label, flat });
  const off = Math.min(ht * 0.25, 24);
  c.fillStyle = '#00000044'; c.fillRect(x + off * 0.7, y + off * 0.7, w, h);
  c.fillStyle = shade(col, -25); c.fillRect(x, y + h - off, w, off);
  c.fillStyle = col; c.fillRect(x, y - off * 0, w, h - off);
  c.fillStyle = shade(col, 14); c.fillRect(x + 4, y + 4, w - 8, h - off - 8);
  if (!flat) { c.fillStyle = '#ffe9a855'; for (let wx = x + 8; wx < x + w - 8; wx += 12) c.fillRect(wx, y + h - off + 4, 5, Math.max(2, off - 8)); }
  c.fillStyle = shade(col, -10); for (let k = 0; k < 2; k++) c.fillRect(x + 10 + srnd() * (w - 30), y + 10 + srnd() * (h - off - 30), 14, 10);
  if (label) { c.fillStyle = '#ffffffdd'; c.font = 'bold 15px system-ui'; c.textAlign = 'center'; c.fillText(label, x + w / 2, y + (h - off) / 2 + 5); }
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  return 'rgb(' + clamp(r, 0, 255) + ',' + clamp(g, 0, 255) + ',' + clamp(b, 0, 255) + ')';
}
function lotSurface(c, x, y, w, h, label) {
  c.fillStyle = '#45484e'; c.fillRect(x, y, w, h);
  c.strokeStyle = '#d8d8d8aa'; c.lineWidth = 1.5;
  const x0 = label === 'LOT A' ? 975 : 2225, cols = label === 'LOT A' ? 40 : 18;
  for (let p = 0; p < 6; p++) for (let row = 0; row < 2; row++) for (let k = 0; k <= cols; k++) {
    const sx = x0 + k * 26 - 13, sy = 1510 + p * 82 + row * 26 - 12;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx, sy + 24); c.stroke();
  }
  c.fillStyle = '#ffffff44'; c.font = 'bold 26px system-ui'; c.textAlign = 'left'; c.fillText(label, x + 12, y + h - 14);
  c.fillStyle = '#c9c9c9'; for (let k = 0; k < 6; k++) c.fillRect(x + 20 + k * (w - 40) / 5, y + h - 50, 4, 4);
}

/* ====================================================================
   TRAFFIC (ambient)
   ==================================================================== */
const CARC = ['#c9c9c9', '#2f3540', '#8b1d1d', '#e6e6e6', '#1d4f8b', '#3b3b3b', '#7a7f87', '#a9431e', '#26603a', '#d6c06a'];
function initTraffic() {
  traffic = [];
  for (let i = 0; i < 46; i++) spawnTraffic();
}
function spawnTraffic() {
  const vert = R() < 0.5, dir = R() < 0.5 ? 1 : -1;
  const line = vert ? pick(roadsX) : pick(roadsY);
  traffic.push({ vert, dir, line: line + dir * 13, p: R() * (vert ? 2128 : W), s: rr(70, 120), col: pick(CARC) });
}

/* ====================================================================
   HOCKEY — 3 × 5-min periods, minor penalties + power plays, pulled
   goalie, 3-on-3 overtime, shootout. Fans react to everything.
   ==================================================================== */
const FIRST = ['Mats', 'Jake', 'Leo', 'Nico', 'Ty', 'Sam', 'Eli', 'Kasper', 'Owen', 'Luca', 'Ryan', 'Theo'];
const LAST = ['Lindqvist', 'Moreau', 'Kowalski', 'Hart', 'Novak', 'Brennan', 'Sato', 'Dubois', 'Becker', 'Ivanov', 'Murphy', 'Larsen'];
const PENALTIES = ['Tripping', 'Hooking', 'Slashing', 'Holding', 'Interference', 'High-sticking', 'Cross-checking'];
const ROLES = ['C', 'LW', 'RW', 'LD', 'RD', 'G', 'X'];     // X = the extra attacker who replaces a pulled goalie
let players = [], puck = {}, score = [0, 0], shotsOn = [0, 0], faceoffT = 0, goalT = 0, banner = null, zam = null, horn = 0;
let penaltyT = 60, otWin = false, pulled = [false, false], react = { type: null, t: 0 };

function setupPlayers() {
  players = []; pulled = [false, false]; otWin = false; penaltyT = rr(90, 200);
  for (let t = 0; t < 2; t++) ROLES.forEach((r, i) => players.push({
    t, r, x: C.x, y: C.y, vx: 0, vy: 0, num: [19, 11, 27, 4, 44, 31, 9][i] + t * 2,
    name: pick(FIRST)[0] + '. ' + pick(LAST), g: 0, a: 0, cd: 0, hold: 0, off: r === 'X', pen: 0,
  }));
  faceoff();
}
const onIce = t => players.filter(p => p.t === t && !p.off);
const teamPlayers = t => onIce(t).filter(p => p.r !== 'G');
const homeEdge = () => clamp((S.hype - 50) / 800 + 0.015, -0.05, 0.05);   // home-ice advantage, kept small
function fullStrength() { pulled = [false, false]; for (const p of players) { p.pen = 0; p.off = p.r === 'X'; } }
function threeOnThree() { fullStrength(); for (const p of players) if (p.r === 'RW' || p.r === 'RD') p.off = true; }
function faceoff() {
  const SPOT = { C: [-9, 0], LW: [-32, -42], RW: [-32, 42], LD: [-72, -30], RD: [-72, 30], G: [-170, 0], X: [-50, 0] };
  for (const p of players) {
    const d = p.t === 0 ? 1 : -1, o = SPOT[p.r];
    p.x = C.x + o[0] * d; p.y = C.y + o[1]; p.vx = p.vy = 0; p.cd = 0; p.hold = 0;
  }
  puck = { x: C.x, y: C.y, vx: 0, vy: 0, owner: null, shot: null };
  faceoffT = 1.4;
}
function shoot(p) {
  const d = p.t === 0 ? 1 : -1, nx = C.x + d * 178, gk = players.find(q => q.t !== p.t && q.r === 'G');
  const adv = teamPlayers(p.t).length - teamPlayers(1 - p.t).length;
  const empty = gk.off, onT = R() < (empty ? 0.82 : 0.58 + adv * 0.04);
  const ty = onT ? C.y + rr(-9, 9) : C.y + (R() < 0.5 ? -1 : 1) * rr(15, 40);
  const ang = Math.atan2(ty - puck.y, nx - puck.x);
  puck.owner = null; puck.vx = Math.cos(ang) * 330; puck.vy = Math.sin(ang) * 330;
  const save = 0.915 - (p.t === 0 ? homeEdge() * 0.25 : -homeEdge() * 0.25);
  puck.shot = { t: p.t, by: p, res: !onT ? 'miss' : empty ? 'goal' : (R() < save ? 'save' : 'goal') };
  if (onT) shotsOn[p.t]++;
  p.cd = 0.5;
}
function pass(p) {
  const mates = teamPlayers(p.t).filter(m => m !== p);
  if (!mates.length) return;
  const d = p.t === 0 ? 1 : -1;
  mates.sort((a, b) => (b.x - a.x) * d + R() * 60 - R() * 60);
  const m = R() < 0.7 ? mates[0] : pick(mates);
  const tx = m.x + m.vx * 0.3, ty = m.y + m.vy * 0.3, ang = Math.atan2(ty - puck.y, tx - puck.x);
  puck.owner = null; puck.vx = Math.cos(ang) * 210; puck.vy = Math.sin(ang) * 210; puck.shot = null;
  p.cd = 0.35; p.hold = 0; p.lastPass = p;
}
function callPenalty() {
  const t = R() < 0.55 ? 1 : 0;
  if (players.some(p => p.t === t && p.pen > 0) || teamPlayers(t).length < 4) return;
  const p = pick(teamPlayers(t).filter(q => q.r !== 'G')); if (!p) return;
  p.pen = 30; p.off = true; G.pens[t]++;
  const team = t === 0 ? HOME : G.opp, nm = pick(PENALTIES);
  banner = { t: 3, text: 'PENALTY', sub: team.short + ' #' + p.num + ' ' + p.name + ' · ' + nm + ' · 2:00', col: '#9a7a14' };
  feed('Penalty on ' + team.short + ' #' + p.num + ' (' + nm + ') — power play for ' + (t ? HOME.short : G.opp.short), 0, 'x');
  react = { type: t === 0 ? 'boo' : 'cheerPen', t: 2.6 }; chirp(t === 0 ? 'penHome' : 'penAway', someFan());
  for (const a of agents) if (a.state === 'seated') a.sat += (t === 0) === !a.away ? -1.5 : 1.5;
  faceoff();
}
function hockey(dt) {
  for (const p of players) if (p.pen > 0) { p.pen -= dt; if (p.pen <= 0) { p.pen = 0; p.off = false; p.x = C.x + (p.t ? 60 : -60); p.y = RK.y1 - 14; p.vx = p.vy = 0; } }
  if (goalT > 0) {
    goalT -= dt;
    for (const p of players) { if (p.off) continue; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; }
    if (goalT <= 0) { if (otWin) { otWin = false; nextPhase(); return; } faceoff(); }
    return;
  }
  if (faceoffT > 0) {
    faceoffT -= dt;
    if (faceoffT <= 0) puck.owner = players.find(p => p.r === 'C' && !p.off && p.t === (R() < 0.5 + homeEdge() ? 0 : 1)) || players.find(p => p.r === 'C' && !p.off);
    return;
  }
  penaltyT -= dt;
  if (penaltyT <= 0) { penaltyT = rr(150, 260); if (PH[ph].d - pt > 25) callPenalty(); }
  if (phK() === 'P3') {                                   // pull the goalie when trailing late
    const left = PH[ph].d - pt;
    for (let t = 0; t < 2; t++) {
      const trail = score[1 - t] - score[t], gk = players.find(q => q.t === t && q.r === 'G'), ex = players.find(q => q.t === t && q.r === 'X'), d = t === 0 ? 1 : -1;
      if (!pulled[t] && left < 80 && trail >= 1 && trail <= 2) { pulled[t] = true; gk.off = true; ex.off = false; ex.x = C.x - d * 70; ex.y = RK.y0 + 6; ex.vx = ex.vy = 0; feed((t ? G.opp.short : HOME.short) + ' pull the goalie — extra attacker!', 0, t ? 'x' : 'goal'); }
      if (pulled[t] && trail < 1) { pulled[t] = false; gk.off = false; ex.off = true; gk.x = C.x - d * 170; gk.y = C.y; }
    }
  }
  const iceF = 0.72 + 0.28 * S.ice / 100;
  const own = puck.owner, poss = own ? own.t : -1;
  const chasers = new Set();
  for (let t = 0; t < 2; t++) if (poss !== t) teamPlayers(t).sort((a, b) => dist(a, puck) - dist(b, puck)).slice(0, own ? 1 : 2).forEach(p => chasers.add(p));
  for (const p of players) {
    if (p.off) continue;
    const d = p.t === 0 ? 1 : -1;
    let tx, ty;
    p.cd -= dt;
    if (p.r === 'G') {
      tx = C.x - d * 170; ty = C.y + clamp(puck.y - C.y, -15, 15);
      if (p === own) { p.hold += dt; if (p.hold > 0.9) pass(p); }
    } else if (p === own) {
      const nx = C.x + d * 178, adv = teamPlayers(p.t).length - teamPlayers(1 - p.t).length;
      tx = nx - d * 34; ty = C.y + Math.sin(T * 1.1 + p.num) * 34;
      const dd = Math.hypot(nx - p.x, C.y - p.y);
      if (dd < 125 && R() < dt * (dd < 65 ? 2.4 : 0.8) * 0.3 * (1 + 0.15 * adv)) shoot(p);
      else if (R() < dt * 0.6) pass(p);
    } else if (chasers.has(p)) { tx = puck.x; ty = puck.y; }
    else {
      const att = poss === p.t;
      const o = { C: [att ? 12 : -28, 0], X: [att ? 20 : -40, 0], LW: [att ? 28 : -18, -46], RW: [att ? 28 : -18, 46], LD: [att ? -48 : -78, -28], RD: [att ? -48 : -78, 28] }[p.r];
      tx = puck.x + o[0] * d; ty = C.y + o[1] * 0.9 + (puck.y - C.y) * 0.35;
    }
    tx = clamp(tx, RK.x0 + 10, RK.x1 - 10); ty = clamp(ty, RK.y0 + 8, RK.y1 - 8);
    const dx = tx - p.x, dy = ty - p.y, dd = Math.hypot(dx, dy) || 1;
    const ms = (p.r === 'G' ? 45 : 64) * iceF * (p === own ? 0.86 : 1) * (p.t === 0 ? 1 + homeEdge() * 0.15 : 1);
    const want = Math.min(ms, dd * 3), k = Math.min(1, dt * 3.2);
    p.vx += (dx / dd * want - p.vx) * k; p.vy += (dy / dd * want - p.vy) * k;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  if (own) {
    const d = own.t === 0 ? 1 : -1;
    puck.x = own.x + d * 6; puck.y = own.y + 2;
    if (own.r !== 'G') for (const o of players) if (!o.off && o.t !== own.t && o.r !== 'G' && o.cd <= 0 && dist(o, own) < 11 && R() < dt * (1.0 + (o.t === 0 ? 1 : -1) * homeEdge())) {
      puck.owner = o; own.cd = 0.7; break;
    }
  } else {
    puck.x += puck.vx * dt; puck.y += puck.vy * dt;
    const f = Math.pow(0.5, dt); puck.vx *= f; puck.vy *= f;
    const sh = puck.shot;
    if (sh) {
      const d = sh.t === 0 ? 1 : -1, nx = C.x + d * 178, gx = nx - d * 9;
      if (sh.res === 'save' && (puck.x - gx) * d >= 0) {
        const g = players.find(p => p.t !== sh.t && p.r === 'G' && !p.off);
        if (g) { puck.owner = g; g.hold = 0; } puck.shot = null;
        if (g && R() < 0.35 && isPeriod()) { react = { type: 'gasp', t: 1.2 }; }
      } else if (sh.res === 'goal' && (puck.x - nx) * d >= 0) { goal(sh.t, sh.by); return; }
      else if (sh.res === 'miss' && (puck.x - nx) * d >= 0) puck.shot = null;
    } else {
      for (const p of players) if (!p.off && p.cd <= 0 && dist(p, puck) < (p.r === 'G' ? 10 : 8)) { puck.owner = p; p.hold = 0; break; }
    }
    if (puck.x < RK.x0 + 3) { puck.x = RK.x0 + 3; puck.vx = Math.abs(puck.vx) * 0.6; }
    if (puck.x > RK.x1 - 3) { puck.x = RK.x1 - 3; puck.vx = -Math.abs(puck.vx) * 0.6; }
    if (puck.y < RK.y0 + 3) { puck.y = RK.y0 + 3; puck.vy = Math.abs(puck.vy) * 0.6; if (R() < 0.04 && isPeriod()) puckInStands(); }
    if (puck.y > RK.y1 - 3) { puck.y = RK.y1 - 3; puck.vy = -Math.abs(puck.vy) * 0.6; }
  }
}
function goal(t, by) {
  score[t]++; by.g++; goalT = 3.2; puck.vx = puck.vy = 0; puck.shot = null; puck.owner = null;
  const team = t === 0 ? HOME : G.opp;
  const mates = teamPlayers(t).filter(m => m !== by), as = mates.length && R() < 0.8 ? pick(mates) : null; if (as) as.a++;
  const pp = players.find(q => q.t !== t && q.pen > 0);
  if (pp && teamPlayers(t).length > teamPlayers(1 - t).length) { pp.pen = 0.01; }          // power-play goal ends the minor
  banner = { t: 3.2, text: 'GOAL! ' + team.short, sub: '#' + by.num + ' ' + by.name + (by.g > 1 ? ' (' + by.g + ')' : '') + (as ? ' · assist #' + as.num : '') + (pp ? ' · power play' : ''), col: team.color };
  for (const p of players) if (p.t === t && !p.off) { p.vx = rr(-40, 40); p.vy = rr(-40, 40); }
  if (phK() === 'OT') otWin = true;
  for (const a of agents) if (a.state === 'seated') {
    const mine = (t === 0) === !a.away;                         // is this fan's team the one that scored?
    a.sat = clamp(a.sat + (mine ? 4 * a.p.loy * 1.5 : -5 * a.p.temper), 0, 100); if (mine) a.jump = 1.6; else a.why = 'losing';
  }
  if (t === 0) {
    horn = 2.5; G.merchBoost = 70; S.hype = clamp(S.hype + 1.2, 0, 100);
    for (let k = 0; k < 3; k++) { chirpCD.goalHome = 0; chirp('goalHome', someFan(), { scorer: '#' + by.num + ' ' + by.name }); }
    react = { type: 'homeGoal', t: 5 };
    feed('GOAL ' + HOME.short + ' — crowd erupts, merch interest up', 0, 'goal');
    if (by.g === 3) { hats(); chirpCD.hat = 0; chirp('hat', someFan()); setTimeout(() => showEvent(EVT.hattrick, { p: by }), 900); }
  } else {
    react = { type: 'awayGoal', t: 5 };
    for (let k = 0; k < 2; k++) { chirpCD.goalAway = 0; chirp('goalAway', someFan()); }
    feed(G.opp.short + ' scores — the home crowd groans', 0, 'x');
  }
  crowdDirty = true;
}
function runShootout() {
  const shot = t => R() < 0.32 + (t === 0 ? homeEdge() * 0.3 : -homeEdge() * 0.3);
  let h = 0, a = 0;
  for (let r = 0; ; r++) { h += shot(0) ? 1 : 0; a += shot(1) ? 1 : 0; if (r >= 2 && h !== a) break; if (r > 14) { h++; break; } }
  score[h > a ? 0 : 1]++; G.dec = 'SO'; G.so = [h, a];
  const w = h > a ? HOME : G.opp;
  banner = { t: 7, text: 'SHOOTOUT', sub: HOME.short + ' ' + h + ' – ' + a + ' ' + G.opp.short + ' · ' + w.short + ' win it', col: '#7a55cc' };
  react = h > a ? { type: 'homeGoal', t: 6 } : { type: 'awayGoal', t: 6 };
  feed('Shootout: ' + HOME.short + ' ' + h + ' – ' + a + ' ' + G.opp.short, 0, 'goal');
  for (const x of agents) if (x.state === 'seated') x.sat = clamp(x.sat + (((h > a) === !x.away) ? 5 : -5), 0, 100);
}
function hats() { for (let i = 0; i < 70; i++) particles.push({ x: rr(RK.x0, RK.x1), y: rr(RK.y0 - 30, RK.y1 + 30), vx: rr(-6, 6), vy: rr(-6, 6), life: 14, col: pick(['#222', '#444', '#d42a44', '#ccc', '#335']), kind: 'hat' }); }
function puckInStands() { if (G && !G.puckEvt) { G.puckEvt = true; showEvent(EVT.puck); } }
function ppStatus() {
  const pen = players.filter(p => p.pen > 0);
  if (!pen.length) return pulled[0] ? HOME.short + ' · 6 on 5' : pulled[1] ? G.opp.short + ' · 6 on 5' : '';
  const p = pen[0]; return 'PP ' + (p.t ? HOME.short : G.opp.short) + ' ' + Math.ceil(p.pen * 4 / 60) + ':' + String(Math.ceil(p.pen * 4) % 60).padStart(2, '0');
}

/* ====================================================================
   GAME FLOW
   ==================================================================== */
function enterPhase(i) {
  ph = i; pt = 0;
  const k = phK();
  if (k === 'DOORS') startGame();
  if (k === 'P1' || k === 'P2' || k === 'P3') { fullStrength(); faceoff(); horn = 1.2; }
  if (k.startsWith('INT')) zam = { t: 0 };
  if (k === 'OT') { threeOnThree(); faceoff(); horn = 1.2; G.dec = 'OT'; banner = { t: 4, text: 'OVERTIME', sub: '3-on-3 · sudden death', col: '#7a55cc' }; feed('Overtime! 3-on-3 — next goal wins', 0, 'goal'); }
  if (k === 'SO') { fullStrength(); runShootout(); }
  if (k === 'EGRESS') endGame();
  if (k === 'DOWN') settle();
  nextEvent = rr(35, 80); crowdDirty = true;
  socialPhase(k);
  toast(PH[ph].n);
}
function nextPhase() {
  const k = phK();
  if (k === 'P3') return enterPhase(score[0] === score[1] ? 8 : 7);
  if (k === 'OT') return enterPhase(score[0] === score[1] ? 9 : 7);
  if (k === 'SO') return enterPhase(7);
  enterPhase((ph + 1) % 8);
}
function demandForecast() {
  const p = S.prices;
  const repF = 0.42 + S.rep / 100 * 0.9, hypeF = 0.62 + S.hype / 100 * 0.76;
  const priceF = clamp(1.6 - 0.6 * (p.ticket / BASE.ticket), 0.15, 1.35);
  const wx = [1, 0.75, 0.8][S.weather] || 1;
  const gen = Math.round(7500 * repF * hypeF * priceF * (1 + S.marketing) * wx);
  const vip = Math.round(S.vipSeats * clamp(0.4 + S.rep / 100 * 0.7, 0, 1.2) * clamp(1.6 - 0.6 * (p.vip / BASE.vip), 0.1, 1.3));
  return { gen: Math.min(gen, S.capacity - S.vipSeats), vip: Math.min(vip, S.vipSeats), demand: gen + vip };
}
function startGame() {
  G = newLedger();
  score = [0, 0]; shotsOn = [0, 0]; setupPlayers(); react = { type: null, t: 0 }; exitShow = null; scanFx = [];
  agents = []; trash = trash.filter(() => R() < 0.3);
  for (const s of S.stands) { s._q = []; s._acc = 0; s._served = 0; s._rev = 0; s._wait = 0; s._lost = 0; s._closedT = 0; s._fx = -9; }
  for (const g of gates) { g.lq = Array.from({ length: S.lanes[g.i] }, () => []); g.acc = []; g.served = 0; }
  for (const st of stalls) st.car = null;
  const f = demandForecast();
  G.att = f.gen + f.vip; G.vipAtt = f.vip; G.demand = f.demand;
  G.rev.tickets = f.gen * S.prices.ticket; G.rev.vip = f.vip * S.prices.vip;
  S.cash += G.rev.tickets + G.rev.vip;
  feed('Box office: ' + f.gen.toLocaleString() + ' tickets + ' + f.vip + ' VIP sold', G.rev.tickets + G.rev.vip, 'tix');
  const nGen = Math.round(f.gen / FPA), nVip = Math.round(f.vip / FPA);
  const carShare = S.transit ? 0.5 : 0.66;
  const free = stalls.map((s, i) => i);
  for (let i = free.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; [free[i], free[j]] = [free[j], free[i]]; }
  free.sort((a, b) => (stalls[a].lot === 'G') - (stalls[b].lot === 'G') || stalls[a].y - stalls[b].y + (R() - 0.5) * 120);
  let used = 0, turned = 0;
  const total = nGen + nVip;
  for (let i = 0; i < total; i++) {
    const vip = i < nVip;
    const a = mkAgent(vip);
    const mode = R() < carShare ? 'car' : (R() < 0.6 ? 'transit' : 'walk');
    if (mode === 'car') {
      if (used < S.parking * 10 / FPA && (used >> 1) < free.length) { a.stall = free[used >> 1]; used++; const st = stalls[a.stall]; a.home = { x: st.x, y: st.y }; }
      else if (R() < 0.5) { turned++; continue; }
      else a.home = edgePoint();
    } else if (mode === 'transit') a.home = { x: TRANSIT.x + rr(-150, 150), y: TRANSIT.y + rr(110, 150) };
    else a.home = edgePoint();
    a.x = a.home.x; a.y = a.home.y;
    agents.push(a);
  }
  G.totSec = new Array(NSEC).fill(0); for (const a of agents) G.totSec[a.sec]++;
  G.turned = turned * FPA; G.carAgents = used;
  if (turned) { feed(turned * FPA + ' fans turned away — parking full', 0, 'x'); for (let k = 0; k < Math.min(3, turned); k++) { chirpCD.parking = 0; chirp('parking', null); } }
  S.marketing = 0; S.weather = 0;
}
function edgePoint() {
  const r = R();
  if (r < 0.25) return { x: rr(900, 2100), y: 330 + rr(-24, 24) };
  if (r < 0.5) return { x: 850 + rr(-24, 24), y: rr(400, 1400) };
  if (r < 0.75) return { x: 2150 + rr(-24, 24), y: rr(400, 1400) };
  return { x: rr(2200, 2700), y: 1430 + rr(-24, 24) };
}
const AWAY_SEC = [12, 13];
function mkAgent(vip) {
  const away = !vip && R() < 0.14;
  let sec = 0;
  if (!vip) { if (away) sec = pick(AWAY_SEC); else do sec = 1 + ((R() * (NSEC - 1)) | 0); while (AWAY_SEC.includes(sec)); }
  const seat = randSeat(sec);
  return {
    x: 0, y: 0, path: [], state: 'pending', vip, away, sec, seat, p: personaFrom(seat.idx >= 0 ? seat.idx : (R() * 1e6 | 0)), spent: 0, why: null, lane: rr(-22, -2),
    arrive: Math.max(0, (vip ? rr(20, 150) : (rr(0, 1) + rr(0, 1) + rr(0, 1)) / 3 * 170 + (R() < 0.06 ? rr(120, 300) : 0))),
    spd: rr(30, 42), sat: 72 + rr(-6, 6), gw: 0, qt: 0, stall: -1, home: null, target: null, pre: false, jump: 0, need: R(), trips: 0, gate: 0, gl: 0,
  };
}
function nearestGate(p) {
  let best = 0, bd = 1e9;
  for (let g = 0; g < 4; g++) { const d = dist(p, gateOut(g)); if (d < bd) { bd = d; best = g; } }
  return best;
}
function endGame() {
  const won = score[0] > score[1], ot = !!G.dec;
  const res = won ? (ot ? 'OTW' : 'W') : (ot ? 'OTL' : 'L');
  G.result = res;
  if (won) { S.w++; S.hype = clamp(S.hype + (ot ? 4 : 6), 0, 100); } else if (ot) { S.otl++; S.hype = clamp(S.hype - 1, 0, 100); } else { S.l++; S.hype = clamp(S.hype - 4, 0, 100); }
  const tag = G.dec === 'SO' ? ' (SO)' : G.dec === 'OT' ? ' (OT)' : '';
  banner = { t: 5, text: won ? HOME.short + ' WIN!' : 'FINAL', sub: HOME.short + ' ' + score[0] + ' – ' + score[1] + ' ' + G.opp.short + tag, col: won ? HOME.color : '#555' };
  for (const a of agents) {
    if (a.state === 'done' || a.state === 'leave') continue;
    if (a.state === 'pending') { a.state = 'done'; continue; }
    a.leaveAt = rr(0, 70);
    if (won && !a.away) a.sat += 8;
  }
  exitShow = { t: 0, win: won, n: Math.round(14 + S.hype * 0.35 + (won ? 8 : 0)) };
  S.ice = Math.max(0, S.ice - 2); crowdDirty = true;
}
function settle() {
  if (!G) return;
  const standStaff = S.stands.reduce((s, st) => s + st.lvl * 1500, 0);
  const ops = 90000, crew = S.crew * 800, teamShare = Math.round(G.rev.tickets * 0.45);
  G.rev.ads = S.jumbotron ? 18000 : 6000;
  if (S.decor.arcade) G.rev.other += Math.round(G.att * 1.4);
  S.cash += G.rev.ads + (S.decor.arcade ? Math.round(G.att * 1.4) : 0);
  G.expBreak = { 'Game-day operations': ops, 'Team share of tickets (45%)': teamShare, 'Concession staff': standStaff, 'Cleaning crew': crew };
  G.exp = ops + teamShare + standStaff + crew;
  S.cash -= G.exp;
  const totalRev = Object.values(G.rev).reduce((a, b) => a + b, 0);
  const mood = G.moodT ? G.moodSum / G.moodT : 70;
  const early = Math.min(4, (G.earlyLeavers || 0) * FPA / Math.max(1, G.att) * 10);
  S.rep = clamp(S.rep + (mood - 62) * 0.22 - (G.turned > 300 ? 2 : 0) - early + (S.decor.photo ? 0.8 : 0) + (S.decor.garden ? 0.3 : 0), 0, 100);
  const buzz = G.sentN ? G.sentSum / G.sentN : 0, angry = clamp((G.priceBalks || 0) / Math.max(1, (G.totSec || []).reduce((x, y) => x + y, 0)) * 3, 0, 3);
  S.rep = clamp(S.rep + buzz * 0.8 - angry, 0, 100);
  S.hype = clamp(S.hype + buzz * 1.5 + (S.decor.banners ? 0.4 : 0) + (S.decor.neon ? 0.5 : 0), 0, 100);
  S.building = Math.max(0, S.building - rr(2, 5));
  S.history.push({ day: S.day, opp: G.opp.short, score: score.slice(), res: G.result, att: G.att, rev: { ...G.rev }, cogs: Math.round(G.cogs), exp: G.exp, profit: Math.round(totalRev - G.cogs - G.exp), mood: Math.round(mood), turned: G.turned, lost: Math.round(G.lostSales), early: (G.earlyLeavers || 0) * FPA, so: G.dec, expBreak: G.expBreak, buzz: Math.round(buzz * 100), refusals: (G.priceBalks || 0) * FPA });
  if (S.history.length > 30) S.history.shift();
  for (const st of stalls) st.car = null;
  agents = [];
  S.day++; S.opp++;
  save();
  setTimeout(() => showReport(S.history[S.history.length - 1]), 400);
}
function moodNow() {
  let s = 0, n = 0;
  for (const a of agents) if (a.state !== 'pending' && a.state !== 'done') { s += a.sat; n++; }
  return n ? s / n : 70;
}
/* seat occupancy by section (the crowd layer draws people in exactly this many seats) */
function occupancy() {
  const out = new Array(NSEC).fill(0);
  if (!G || !G.totSec || ph === 0) return out;
  const seated = new Array(NSEC).fill(0);
  for (const a of agents) if (a.state === 'seated') seated[a.sec]++;
  const fill = clamp(G.att / Math.max(1, SEATS.length * 1.02), 0, 1);
  for (let i = 0; i < NSEC; i++) out[i] = G.totSec[i] ? clamp(seated[i] / G.totSec[i] * fill * 1.04, 0, 1) : 0;
  return out;
}

/* ====================================================================
   FANS
   ==================================================================== */
const patienceMul = () => 1 + (S.decor.screens ? 0.25 : 0) + (S.decor.lounge ? 0.1 : 0);
const moodBonus = () => (S.decor.floorlogo ? 0.01 : 0) + (S.decor.garden ? 0.01 : 0) + (S.decor.lounge ? 0.008 : 0) + (S.decor.banners ? 0.006 : 0) + (S.decor.neon ? 0.006 : 0) + (S.decor.arcade ? 0.006 : 0);
const serviceMul = () => S.decor.mobile ? 1.15 : 1;
function stepAgents(dt) {
  const k = phK(), clean = cleanliness(), pm = patienceMul(), mb = moodBonus(), diff = score[0] - score[1];
  for (const a of agents) {
    if (a.state === 'done') continue;
    if (a.state === 'pending') {
      if (k === 'DOORS' || isPeriod() || isInt()) {
        if (elapsedSinceDoors() >= a.arrive) {
          a.state = 'arrive'; a.gate = nearestGate(a.home);
          const g = gates[a.gate]; syncLanes(g, a.gate);
          let best = 0; g.lq.forEach((q, l) => { if (q.length < g.lq[best].length) best = l; });
          a.gl = best;
          a.path = [gatePt(a.gate, laneU(a.gate, best), 62 + rr(0, 36))];
          if (a.stall >= 0) { stalls[a.stall].car = { col: pick(CARC), t: 0 }; G.rev.parking += 2 * S.prices.parking; S.cash += 2 * S.prices.parking; }
        }
      }
      continue;
    }
    if (a.jump > 0) a.jump -= dt;
    if (mb && a.state !== 'leave') a.sat = Math.min(100, a.sat + mb * dt);
    if (k === 'EGRESS' && a.state !== 'leave' && a.state !== 'arrive' && a.state !== 'gateQ') {
      a.leaveAt -= dt;
      if (a.leaveAt <= 0) startLeave(a);
    } else if (k === 'EGRESS' && (a.state === 'arrive' || a.state === 'gateQ')) {
      removeFromQueues(a); a.state = 'leave'; a.path = [a.home];
    }
    if (a.path.length) {
      const p = a.path[0], dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy), sp = a.spd * dt * (a.state === 'leave' ? 1.15 : 1);
      if (d <= sp) { a.x = p.x; a.y = p.y; a.path.shift(); if (!a.path.length) reached(a); }
      else { a.x += dx / d * sp; a.y += dy / d * sp; }
      continue;
    }
    if (a.state === 'gateQ') { a.gw += dt; if (a.gw > 35) a.sat -= dt * 0.25 * a.p.temper; if (a.gw > 45 && !a.postedGate) { a.postedGate = true; a.why = 'security'; chirp('gate', a, { n: Math.round(a.gw / 4) }); } }
    else if (a.state === 'queue') {
      a.qt += dt;
      const st = a.target;
      if (a.qt > 28) a.sat -= dt * 0.18;
      if (st.type !== 'restroom' && a.qt > a.patience) {
        st._q.splice(st._q.indexOf(a), 1); st._lost++; G.walkaways++;
        const v = estSpend(st); G.lostSales += v; a.sat -= 10 * a.p.temper; a.why = 'lines'; chirp('line', a, { n: Math.round(a.qt / 5), stand: st });
        if (R() < 0.3) feed('Fan gave up in line at ' + st.type.toUpperCase() + ' — lost ' + money(v), 0, 'x');
        goBack(a, st);
      }
    } else if (a.state === 'seated') {
      if (clean < 55) { a.sat -= dt * 0.02 * a.p.temper; if (R() < dt * 0.002) chirp('dirty', a); } else if (clean > 92 && R() < dt * 0.0003) chirp('clean', a);
      const rb = Math.max(S.prices.beer / BASE.beer, S.prices.food / BASE.food); if (rb > a.p.tol) { a.sat -= dt * 0.014 * a.p.temper * (rb - a.p.tol); a.why = 'prices'; }
      if (S.ice < 55 && isPeriod()) a.sat -= dt * 0.006;
      const rate = isInt() ? 0.0125 : isPeriod() ? 0.0013 : k === 'DOORS' ? 0.004 : 0;
      if (a.trips < 4 && R() < rate * dt) tripFrom(a);
      if (!a.vip) {                                   // blowouts: the losing side's fans head for the exits
        const late = k === 'P3' || k === 'INT2' || (k === 'P2' && pt > 150), pain = a.away ? diff - 2 : -diff - 2;
        if (late && pain > 0 && R() < dt * 0.0007 * pain * (k === 'P3' ? 1.6 : 1) * (a.sat < 45 ? 1.8 : 1) * (1.7 - a.p.loy)) {
          a.early = true; G.earlyLeavers = (G.earlyLeavers || 0) + 1; crowdDirty = true;
          if (G.earlyLeavers % 12 === 1) feed('Fans heading for the exits (Sec ' + (101 + a.sec) + ') — ' + (a.away ? G.opp.short : HOME.short) + ' trailing by ' + Math.abs(diff), 0, 'x');
          chirp('leave', a, { score: HOME.short + ' ' + score[0] + '–' + score[1] });
          startLeave(a);
        }
      }
    }
    a.sat = clamp(a.sat, 0, 100);
  }
  for (const st of S.stands) {                        // fans stand in a real serpentine line in front of the counter
    if (!st._q) continue;
    st._q.forEach((a, i) => { const p = queuePt(st, i); a.x += (p.x - a.x) * Math.min(1, dt * 4); a.y += (p.y - a.y) * Math.min(1, dt * 4); });
  }
  for (const g of gates) g.lq.forEach((q, l) => {
    const u = laneU(g.i, l);
    q.forEach((a, i) => { const p = gatePt(g.i, u, 46 + i * 6.2); a.x += (p.x - a.x) * Math.min(1, dt * 4); a.y += (p.y - a.y) * Math.min(1, dt * 4); });
  });
}
function elapsedSinceDoors() { let t = 0; for (let i = 1; i < Math.min(ph, 8); i++) t += PH[i].d; return t + pt; }
function reached(a) {
  switch (a.state) {
    case 'arrive': { const g = gates[a.gate]; if (!g.lq[a.gl]) a.gl = 0; a.state = 'gateQ'; g.lq[a.gl].push(a); break; }
    case 'toSeat': case 'back': a.state = 'seated'; crowdDirty = true; break;
    case 'toStand': {
      const st = a.target;
      if (!st.open || st._closedT > 0 || !S.stands.includes(st)) { goBack(a, st); break; }
      a.state = 'queue'; a.qt = 0; a.patience = rr(55, 110) * patienceMul() * a.p.pat; st._q.push(a); break;
    }
    case 'leave':
      if (a.path.length === 0) {
        a.state = 'done';
        if (a.stall >= 0 && stalls[a.stall].car) { stalls[a.stall].car.leaving = true; if (R() < 0.3) spawnTraffic(); }
        if (R() < 0.25) trash.push({ x: a.seat.x + rr(-4, 4), y: a.seat.y + rr(-4, 4) });
      }
      break;
  }
}
function admit(a) {
  const g = a.gate, lane = a.lane, u = laneU(g, a.gl);
  const s = gatePt(g, u, 36); scanFx.push({ x: s.x, y: s.y, t: 0.55, g, l: a.gl });
  const path = [gatePt(g, u, 36), gatePt(g, u, 20), gatePt(g, u, 6), gatePt(g, u, -8), gateIn(g, lane)];
  if (R() < 0.33 && !a.vip) {
    const st = chooseStand(a, GATE_A[g]);
    if (st) { a.pre = true; a.target = st; a.state = 'toStand'; a.path = path.concat(ringPath(GATE_A[g], SLOTS[st.slot], lane)); return; }
  }
  a.state = 'toSeat'; a.path = path.concat(ringPath(GATE_A[g], a.seat.a, lane), [vomPt(a.seat.a), a.seat]);
}
function tripFrom(a) {
  const st = chooseStand(a, a.seat.a);
  if (!st) return;
  a.trips++; a.target = st; a.state = 'toStand'; a.pre = false; crowdDirty = true;
  a.path = [vomPt(a.seat.a), concPt(a.seat.a, a.lane)].concat(ringPath(a.seat.a, SLOTS[st.slot], a.lane));
}
function goBack(a, st) {
  const from = SLOTS[st.slot];
  a.state = a.pre ? 'toSeat' : 'back'; a.pre = false;
  a.path = ringPath(from, a.seat.a, a.lane).concat([vomPt(a.seat.a), a.seat]);
}
function startLeave(a) {
  removeFromQueues(a);
  const g = nearestGate(a.home);
  const fromA = a.state === 'seated' || a.state === 'toSeat' || a.state === 'back' ? a.seat.a : angOf(a.x, a.y, RING.conc[0], RING.conc[1]);
  const pre = (a.state === 'seated') ? [vomPt(a.seat.a), concPt(a.seat.a, a.lane)] : [concPt(fromA, a.lane)];
  const ex = gatePt(g, G_X, 0), exA = angOf(ex.x, ex.y, RING.conc[0], RING.conc[1]);
  a.state = 'leave';
  a.path = pre.concat(ringPath(fromA, exA, a.lane), [gatePt(g, G_X, -4), gatePt(g, G_X, 24), gatePt(g, G_X, 52), a.home]);
  crowdDirty = true;
}
function removeFromQueues(a) {
  if (a.state === 'queue' && a.target && a.target._q) { const i = a.target._q.indexOf(a); if (i >= 0) a.target._q.splice(i, 1); }
  if (a.state === 'gateQ') { const q = gates[a.gate].lq[a.gl] || [], i = q.indexOf(a); if (i >= 0) q.splice(i, 1); }
}
function willing(cat) {
  const key = cat === 'vip' ? 'beer' : cat, p = S.prices[key], b = BASE[key];
  return clamp(1.15 - 0.55 * (p / b), 0.04, 1);
}
function chooseStand(a, fromA) {
  const intN = isInt() ? 1 : 0;
  const ap = a.p.app;
  let w = { food: 0.4 * ap.food, beer: (a.away ? 0.3 : 0.36) * ap.beer, merch: (0.08 + (G.merchBoost > 0 ? 0.14 : 0) + (G.result === 'W' ? 0.1 : 0)) * ap.merch, restroom: 0.22 + intN * 0.1 };
  if (a.vip) w = { vip: 0.8, restroom: 0.2 };
  let r = R() * Object.values(w).reduce((x, y) => x + y, 0), cat = 'food';
  for (const k in w) { r -= w[k]; if (r <= 0) { cat = k; break; } }
  if (cat !== 'restroom') {
    const v = priceVerdict(a, cat);
    if (v === 'refuse') { G.priceBalks = (G.priceBalks || 0) + 1; a.sat = clamp(a.sat - 5 * a.p.temper, 0, 100); a.why = 'prices'; chirp('price', a, { cat }); return null; }
    if (v === 'grumble') { a.sat -= 2 * a.p.temper; a.why = 'prices'; }
  }
  let best = null, bs = 1e9;
  for (const st of S.stands) {
    const t = TYPES[st.type];
    if (!st.open || st._closedT > 0) continue;
    if (t.cat !== cat && !(a.vip && cat === 'vip' && t.cat === 'beer')) continue;
    const s = Math.abs(normA(SLOTS[st.slot] - fromA)) * 260 + st._q.length * 9 - st.lvl * 6 + R() * 20;
    if (s < bs) { bs = s; best = st; }
  }
  if (!best && cat === 'restroom') a.sat -= 8;
  return best;
}
function standRate(st) {
  return TYPES[st.type].rate * (10 / FPA) * (1 + 0.6 * (st.lvl - 1)) * (st.cond < 40 ? 0.6 : 1) * (G && G.powerOut > 0 ? 0.3 : 1) * serviceMul();
}
function estSpend(st) {
  const t = TYPES[st.type];
  if (t.cat === 'food') return S.prices.food * FPA * 1.2;
  if (t.cat === 'beer') return S.prices.beer * FPA * 1.45;
  if (t.cat === 'merch') return S.prices.merch * FPA * 0.38;
  if (t.cat === 'vip') return S.prices.beer * 2.3 * FPA * 1.5;
  return 0;
}
function stepStands(dt) {
  for (const st of S.stands) {
    if (!st._q) continue;
    if (st._closedT > 0) st._closedT -= dt;
    if (!st._q.length) { st._acc = 0; continue; }
    if (!st.open || st._closedT > 0) continue;
    st._acc += standRate(st) * dt;
    while (st._acc >= 1 && st._q.length) { st._acc -= 1; serve(st, st._q.shift()); }
  }
}
function serve(st, a) {
  const t = TYPES[st.type];
  st._served++; st._wait += a.qt; st._fx = T;
  st.cond = Math.max(0, st.cond - 0.045);
  a.sat += a.qt < 20 ? 4 : a.qt < 45 ? 0 : -4;
  if (t.cat !== 'restroom') {
    const key = t.cat === 'vip' ? 'beer' : t.cat;
    if (S.prices[key] > BASE[key] * 1.25) { a.sat -= 3 * a.p.temper; a.why = 'prices'; }
    else if (S.prices[key] < BASE[key] * 0.95 && a.sat > 65) chirp('priceOk', a, { cat: key });
    let v = estSpend(st) * rr(0.75, 1.3);
    const qty = Math.max(1, Math.round(v / (S.prices[key] * (t.cat === 'vip' ? 2.3 : 1))));
    v = Math.round(v); st._rev += v; a.spent += v / FPA;
    if (a.sat > 72 && R() < 0.04) chirp('food', a, { stand: st, cat: key });
    const catKey = t.cat === 'vip' ? 'vip' : t.cat;
    if (catKey === 'vip') G.rev.other += v; else G.rev[catKey] += v;
    const cg = v * COGS[catKey]; G.cogs += cg;
    S.cash += v - cg;
    G.spark[G.spark.length - 1] += v;
    const pos = slotPos(st.slot);
    particles.push({ x: pos.x, y: pos.y - 14, vx: 0, vy: -18, life: 1.6, text: '+$' + v, col: '#5cff9a', kind: 'txt' });
    feed('Sec ' + (101 + a.sec) + ' · ' + TYPES[st.type].tag + ' · ' + qty + '× ' + pick(t.items), v, catKey);
    if ((t.cat === 'food' || t.cat === 'beer') && R() < 0.22) trash.push({ x: a.seat.x + rr(-5, 5), y: a.seat.y + rr(-5, 5) });
    if (R() < 0.08) { const p = concPt(SLOTS[st.slot] + rr(-0.2, 0.2), rr(-25, 5)); trash.push(p); }
  } else {
    if (st.cond < 30) a.sat -= 6;
  }
  if (st.cond < 12 && R() < 0.02 && !st._brokeEvt) { st._brokeEvt = true; showEvent(EVT.broken, { st }); }
  goBack(a, st);
}
function syncLanes(g, i) {
  const n = S.lanes[i];
  while (g.lq.length < n) g.lq.push([]);
  while (g.lq.length > n) { const q = g.lq.pop(); q.forEach(a => { a.gl = 0; g.lq[0].push(a); }); }
}
const gateLen = g => g.lq.reduce((s, q) => s + q.length, 0);
function stepGates(dt) {
  const k = phK();
  if (k === 'EGRESS' || k === 'DOWN') return;
  for (const g of gates) {
    syncLanes(g, g.i);
    g.lq.forEach((q, l) => {
      if (!q.length) { g.acc[l] = 0; return; }
      g.acc[l] = (g.acc[l] || 0) + 0.6 * (10 / FPA) * dt * (G.metalDetectorDown === g.i ? 0.3 : 1);
      while (g.acc[l] >= 1 && q.length) { g.acc[l] -= 1; g.served++; const a = q.shift(); a.gl = l; admit(a); }
    });
  }
}
function cleanliness() { return clamp(100 - trash.length * 0.22, 0, 100); }

/* ---------------- janitors ---------------- */
function syncJanitors() {
  while (janitors.length < S.crew) { const p = gateIn(1, -10); janitors.push({ x: p.x, y: p.y, tgt: null, t: 0 }); }
  while (janitors.length > S.crew) janitors.pop();
}
function stepJanitors(dt) {
  for (const j of janitors) {
    if (!j.tgt || !trash.includes(j.tgt)) {
      j.tgt = null; let bd = 1e9;
      for (let i = 0; i < trash.length; i += 3) { const d = dist(j, trash[i]); if (d < bd && !janitors.some(o => o !== j && o.tgt === trash[i])) { bd = d; j.tgt = trash[i]; } }
      if (!j.tgt) continue;
    }
    const d = dist(j, j.tgt), sp = 55 * dt;
    if (d < 3) { j.t += dt; if (j.t > 0.4) { trash.splice(trash.indexOf(j.tgt), 1); j.tgt = null; j.t = 0; } }
    else { j.x += (j.tgt.x - j.x) / d * Math.min(sp, d); j.y += (j.tgt.y - j.y) / d * Math.min(sp, d); }
  }
}

/* ====================================================================
   EVENTS ("stuff thrown at you")
   ==================================================================== */
const EVT = {
  fight: { when: 'period', title: 'Fight in the stands!', text: d => 'Two fans in Section ' + d.sec + ' are throwing punches over a spilled beer. Everyone around them is filming.',
    ch: [ { t: 'Send security team', s: 'Costs $2,500 · nearby fans stay happy', f: d => { pay(2500); bumpSec(d.secI, 2); } },
          { t: 'Let the ushers handle it', s: 'Free · risky for reputation', f: d => { if (R() < 0.55) { bumpSec(d.secI, -14); S.rep -= 2; toast('It escalated. Video goes viral. Rep −2'); } else toast('Ushers calmed it down.'); } } ],
    data: () => { const i = 1 + (R() * 19 | 0); return { secI: i, sec: 101 + i }; } },
  keg: { when: 'game', title: 'Bar ran out of kegs', text: d => 'The ' + TYPES[d.st.type].label + ' by Section ' + (101 + secOf(SLOTS[d.st.slot])) + ' is tapped out. The line is getting restless.',
    cond: () => S.stands.some(s => s.type === 'bar'), data: () => ({ st: pick(S.stands.filter(s => s.type === 'bar')) }),
    ch: [ { t: 'Rush delivery from the distributor', s: 'Costs $3,000 · bar stays open', f: () => pay(3000) },
          { t: 'Close the bar for a bit', s: 'Free · bar shuts for ~90s, line walks away', f: d => { d.st._closedT = 90; for (const a of d.st._q.splice(0)) { a.sat -= 8; goBack(a, d.st); } } } ] },
  inspector: { when: 'game', title: 'Health inspector walked in', text: () => 'A surprise health inspection is underway. Concourse cleanliness is ' + Math.round(cleanliness()) + '%.',
    ch: [ { t: 'Give them the tour', s: 'Pass if cleanliness ≥ 60%, otherwise $8,000 fine', f: () => { if (cleanliness() >= 60) { toast('Passed inspection! Rep +1'); S.rep += 1; } else { pay(8000); S.rep -= 3; toast('Failed: $8,000 fine, Rep −3'); } } },
          { t: 'Pull every crew member to clean first', s: 'Costs $1,500 · clears 40% of trash', f: () => { pay(1500); trash.splice(0, Math.ceil(trash.length * 0.4)); toast('Passed inspection.'); } } ] },
  celeb: { when: 'game', title: 'Celebrity spotted in VIP!', text: () => 'A famous musician just sat down in the VIP section. Social media is buzzing.',
    ch: [ { t: 'Put them on the jumbotron', s: S => S.jumbotron ? 'Free · +5 hype' : 'Needs a jumbotron · +2 hype via PA', f: () => { S.hype += S.jumbotron ? 5 : 2; toast('Crowd goes wild. Hype up!'); } },
          { t: 'Send free champagne & ask for a post', s: 'Costs $1,200 · +3 hype, +1 rep', f: () => { pay(1200); S.hype += 3; S.rep += 1; } } ] },
  power: { when: 'game', title: 'Power flicker on the concourse', text: () => 'A breaker tripped. Registers on the concourse are running on backup — service is crawling.',
    ch: [ { t: 'Call the emergency electrician', s: 'Costs $4,000 · fixed fast', f: () => { pay(4000); G.powerOut = 8; } },
          { t: 'Wait for building staff', s: 'Free · concessions run at 30% for ~60s', f: () => { G.powerOut = 60; } } ] },
  jam: { when: 'DOORS', title: 'Traffic jam at the parking lot', text: () => 'Cars are backed up onto Lynx Boulevard. Fans are getting stuck before puck drop.',
    ch: [ { t: 'Hire traffic police', s: 'Costs $2,500 · cars flow', f: () => pay(2500) },
          { t: 'Let it sort itself out', s: 'Free · late arrivals, unhappy drivers', f: () => { for (const a of agents) if (a.state === 'pending' && a.stall >= 0) { a.arrive += rr(30, 90); a.sat -= 6; } } } ] },
  puck: { when: 'period', title: 'Puck flies into the stands!', text: () => 'A deflected puck sailed into the crowd — an 8-year-old caught it with both hands!',
    ch: [ { t: 'Send them a signed jersey', s: 'Costs $150 · +2 rep (it goes on social)', f: () => { pay(150); S.rep += 2; S.hype += 1; } },
          { t: 'Nice moment, move on', s: 'Free', f: () => {} } ] },
  thrown: { when: 'period', title: 'Fans throwing stuff on the ice!', text: () => 'After a bad offside call, cups and a rubber chicken are raining onto the ice. Play is stopped.',
    ch: [ { t: 'PA announcement + ushers to the glass', s: 'Free · −2 mood in lower bowl', f: () => { for (const a of agents) if (a.state === 'seated') a.sat -= 2; } },
          { t: 'Eject the throwers', s: 'Costs $1,000 security · −1 hype, +1 rep', f: () => { pay(1000); S.hype -= 1; S.rep += 1; } } ],
    on: () => { for (let i = 0; i < 30; i++) particles.push({ x: rr(RK.x0, RK.x1), y: rr(RK.y0, RK.y1), vx: 0, vy: 0, life: 10, col: pick(['#fff', '#e3c', '#ff0', '#cde']), kind: 'cup' }); } },
  leak: { when: 'game', title: 'Restroom pipe burst', text: d => 'Water is flooding the restrooms near Section ' + (101 + secOf(SLOTS[d.st.slot])) + '.',
    cond: () => S.stands.some(s => s.type === 'restroom'), data: () => ({ st: pick(S.stands.filter(s => s.type === 'restroom')) }),
    ch: [ { t: 'Emergency plumber', s: 'Costs $3,500', f: () => pay(3500) },
          { t: 'Close them until the game ends', s: 'Free · long lines at other restrooms', f: d => { d.st._closedT = 999; for (const a of d.st._q.splice(0)) { a.sat -= 10; goBack(a, d.st); } } } ] },
  proposal: { when: 'int', title: 'Marriage proposal request', text: () => 'A fan in Section 108 paid for a jumbotron message and wants to propose during the intermission.',
    cond: () => S.jumbotron,
    ch: [ { t: 'Make it happen (+ kiss cam)', s: '+$500 · +3 hype', f: () => { gain(500); S.hype += 3; toast('She said YES! Arena erupts.'); } },
          { t: 'Decline, run sponsor ads', s: '+$2,000 ad revenue', f: () => gain(2000) } ] },
  sponsor: { when: 'DOWN', title: 'Sponsor offer', text: () => 'An energy-drink brand wants their logo on the ice and boards for the next 5 games.',
    ch: [ { t: 'Take the deal', s: '+$45,000 now · −1 rep (fans call it a sellout)', f: () => { gain(45000); S.rep -= 1; } },
          { t: 'Counter for more', s: '50% chance of +$70,000, else nothing', f: () => { if (R() < 0.5) { gain(70000); toast('They accepted!'); } else toast('They walked.'); } },
          { t: 'Decline', s: 'Keep the ice clean', f: () => {} } ] },
  concert: { when: 'DOWN', title: 'Concert promoter calling', text: () => 'A touring band wants to rent the arena tonight during downtime. Covering the ice will damage it.',
    ch: [ { t: 'Book it', s: '+$60,000 · ice −35% · trash in seats', f: () => { gain(60000); S.ice = Math.max(0, S.ice - 35); for (let i = 0; i < 120; i++) { const s = randSeat(R() * 20 | 0); trash.push(s); } } },
          { t: 'Pass', s: 'Protect the ice', f: () => {} } ] },
  storm: { when: 'DOWN', title: 'Snowstorm forecast', text: () => 'Weather service is calling for heavy snow at game time. Walk-up crowds will drop ~25%.',
    ch: [ { t: 'Run a "storm discount" promo', s: 'Costs $12,000 · demand back to normal', f: () => { pay(12000); S.weather = 0; } },
          { t: 'Ride it out', s: '−25% attendance next game', f: () => { S.weather = 1; } } ] },
  corporate: { when: 'DOWN', title: 'Corporate group booking', text: () => 'A tech company wants to buy out an extra block of premium seats for their team outing.',
    ch: [ { t: 'Sell them a block', s: '+$22,000', f: () => gain(22000) }, { t: 'Upsell a VIP package', s: '60%: +$40,000, else +$10,000', f: () => gain(R() < 0.6 ? 40000 : 10000) } ] },
  hattrick: { title: 'HAT TRICK!', text: d => '#' + d.p.num + ' ' + d.p.name + ' just scored their third goal. Hats are raining down on the ice!',
    ch: [ { t: 'Rush the store with hat-trick shirts', s: 'Costs $3,000 · big merch spike', f: () => { pay(3000); G.merchBoost = 200; S.hype += 4; } },
          { t: 'Just enjoy it', s: '+2 hype', f: () => { S.hype += 2; } } ] },
  broken: { title: 'Equipment breakdown', text: d => 'The ' + TYPES[d.st.type].label + ' near Section ' + (101 + secOf(SLOTS[d.st.slot])) + ' is falling apart (' + Math.round(d.st.cond) + '% condition). Fryers and taps are failing.',
    ch: [ { t: 'Emergency repair (3× cost)', s: d => 'Costs ' + money(repairCost(d.st) * 3), f: d => { pay(repairCost(d.st) * 3); d.st.cond = 100; } },
          { t: 'Close it for the rest of the game', s: 'Repair later during downtime', f: d => { d.st._closedT = 999; for (const a of d.st._q.splice(0)) goBack(a, d.st); } } ] },
};
function bumpSec(i, v) { for (const a of agents) if (a.sec === i) a.sat += v; }
function pay(v) { S.cash -= v; if (G) G.eventsCost += v; }
function gain(v) { S.cash += v; if (G) G.eventsGain += v; if (G && inGame()) G.rev.other += v; }
function maybeEvent(dt) {
  if (window.ARENA && ARENA.noEvents) return;
  nextEvent -= dt;
  if (nextEvent > 0) return;
  nextEvent = rr(70, 130);
  const k = phK();
  const list = Object.values(EVT).filter(e => {
    if (!e.when) return false;
    if (e.when === 'period' && !isPeriod()) return false;
    if (e.when === 'int' && !isInt()) return false;
    if (e.when === 'game' && !(isPeriod() || isInt())) return false;
    if (e.when === 'DOORS' && k !== 'DOORS') return false;
    if (e.when === 'DOWN' && k !== 'DOWN') return false;
    if (e.cond && !e.cond()) return false;
    return true;
  });
  if (list.length && (k !== 'DOWN' || R() < 0.7)) showEvent(pick(list));
}
function showEvent(e, d) {
  d = d || (e.data ? e.data() : {});
  if (e.on) e.on(d);
  modalOpen = true;
  const sv = x => typeof x === 'function' ? x(S, d) : x;
  M.innerHTML = '<div class="tag" style="margin:0 0 8px">INCOMING · ' + PH[ph].n + '</div><h2>' + e.title + '</h2><p>' + e.text(d) + '</p>' +
    e.ch.map((c, i) => '<button class="choice" data-ch="' + i + '">' + c.t + '<small>' + (typeof c.s === 'function' ? c.s(d) : sv(c.s)) + '</small></button>').join('');
  MW.style.display = 'flex';
  M.onclick = ev => {
    const b = ev.target.closest('[data-ch]'); if (!b) return;
    e.ch[+b.dataset.ch].f(d); S.rep = clamp(S.rep, 0, 100); S.hype = clamp(S.hype, 0, 100);
    closeModal();
  };
}

/* ====================================================================
   MAIN UPDATE
   ==================================================================== */
function update(dt) {
  T += dt; pt += dt;
  if (pt >= PH[ph].d) nextPhase();
  if (G) {
    G.sparkT += dt; if (G.sparkT > 10) { G.sparkT = 0; G.spark.push(0); if (G.spark.length > 80) G.spark.shift(); }
    if (G.merchBoost > 0) G.merchBoost -= dt;
    if (G.powerOut > 0) G.powerOut -= dt;
  }
  if (isPeriod()) {
    hockey(dt); S.ice = Math.max(0, S.ice - dt * 0.012);
    if (react.t <= 0 && R() < dt * 0.003 && !(score[0] < score[1])) react = { type: 'wave', t: 7 };      // the wave
  }
  if (react.t > 0) react.t -= dt;
  if (zam) { zam.t += dt; S.ice = Math.min(100, S.ice + dt * 0.05); if (zam.t > 70) zam = null; }
  if (G && inGame()) { stepAgents(dt); stepGates(dt); stepStands(dt); }
  if (G && (isPeriod() || isInt())) { G.moodAcc = (G.moodAcc || 0) + dt; if (G.moodAcc > 0.5) { G.moodSum = (G.moodSum || 0) + moodNow() * G.moodAcc; G.moodT = (G.moodT || 0) + G.moodAcc; G.moodAcc = 0; } }   // average mood while the building is full
  stepJanitors(dt);
  for (const t of traffic) { t.p += t.dir * t.s * dt; const L = t.vert ? 2128 : W; if (t.p < -30) t.p = L + 20; if (t.p > L + 30) t.p = -20; }
  for (const st of stalls) if (st.car) { st.car.t += dt; if (st.car.leaving) { st.car.lt = (st.car.lt || 0) + dt; if (st.car.lt > 2) st.car = null; } }
  for (const f of scanFx) f.t -= dt; scanFx = scanFx.filter(f => f.t > 0);
  if (exitShow) { exitShow.t += dt; if (exitShow.t > 175) exitShow = null; }
  if (horn > 0) horn -= dt;
  for (let i = 0; i < Math.min(6, social.length); i++) if (R() < dt * 0.6 * (1 + (social[i].likes > 60 ? 3 : 0))) social[i].likes++;
  if (G && inGame() && R() < dt * 0.0006 * (Object.keys(S.decor).length)) { const ks = Object.keys(S.decor); chirp('decor', someFan(), { thing: DECOR[pick(ks)].name.split(' ').slice(-2).join(' ').toLowerCase() }); }
  if (exitShow && (Math.abs(exitShow.t - 30) < dt || Math.abs(exitShow.t - 48) < dt)) { chirpCD.auto = 0; chirp('auto', null, { n: players.length ? pick(players.filter(p => p.t === 0)).num : 19 }); }
  if (G && phK() === 'DOORS' && pt > 100 && !G.gfChecked) { G.gfChecked = true; if (gates.every(g => gateLen(g) < 6)) { chirpCD.gateFast = 0; chirp('gateFast', someFan()); } }
  maybeEvent(dt);
}
