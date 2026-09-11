/**
 * Wraps the built single-file app in an iPhone chassis for desktop viewing.
 *
 * The app goes inside an <iframe srcdoc>, deliberately — not a scaled div.
 * An iframe gets its OWN viewport, so `100dvh`, `position: fixed`, safe-area
 * insets and every width media query resolve against 393x852 exactly as they
 * would on the device. A CSS-transformed div would report the desktop
 * viewport to all of them and quietly lie about the layout.
 */
import fs from 'fs';

const app = fs.readFileSync('dist-single/index.html', 'utf8');

// srcdoc is an HTML attribute, so only " and & need escaping. Escaping < or >
// would corrupt the document.
const srcdoc = app.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Planzo — iPhone preview</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100dvh;
    display: flex; flex-direction: column; align-items: center; gap: 18px;
    padding: 18px 16px 28px;
    background:
      radial-gradient(60% 55% at 25% 15%, #241a4d 0%, transparent 60%),
      radial-gradient(50% 50% at 80% 85%, #3b1044 0%, transparent 60%),
      #08080e;
    font: 500 14px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #9BA0B5;
  }

  .stage { display: flex; flex-direction: column; align-items: center; gap: 18px; }
  /* The chassis is scaled to fit a short window. Scaling the ELEMENT keeps the
     iframe's logical viewport at 393x852 — only its on-screen size changes —
     so the app still lays out as the device while the controls stay reachable. */
  .fit { transform-origin: top center; transition: transform .18s ease-out; }

  /* iPhone 15 Pro: 393x852pt of SCREEN. The bezel adds around that rather
     than eating into it — otherwise the iframe viewport comes out 371x830
     and every measurement the app makes is quietly 22px short. */
  .phone {
    --w: 393px; --h: 852px; --bezel: 11px;
    position: relative;
    width: calc(var(--w) + var(--bezel) * 2);
    height: calc(var(--h) + var(--bezel) * 2);
    padding: var(--bezel);
    border-radius: 66px;
    background: linear-gradient(145deg, #6c6c72 0%, #2b2b30 22%, #4a4a51 50%, #232327 78%, #5e5e65 100%);
    box-shadow:
      0 0 0 1px rgba(255,255,255,.10),
      0 45px 90px -20px rgba(0,0,0,.85),
      0 12px 30px -10px rgba(0,0,0,.6);
    flex: none;
  }
  .screen {
    position: relative;
    width: var(--w); height: var(--h);
    border-radius: 55px;
    overflow: hidden;
    background: #000;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.9);
  }
  .screen iframe { width: 100%; height: 100%; border: 0; display: block; }

  /* Dynamic Island sits above the page, so the app's safe-area padding is
     what keeps content clear of it — same as the real device. */
  .island {
    position: absolute; top: 13px; left: 50%; transform: translateX(-50%);
    width: 125px; height: 36px; border-radius: 20px;
    background: #000; z-index: 5; pointer-events: none;
  }
  .island::after {
    content: ''; position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
    width: 9px; height: 9px; border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #2b3a4a, #05070a 70%);
  }
  .home {
    position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
    width: 140px; height: 5px; border-radius: 3px;
    background: rgba(255,255,255,.5); z-index: 5; pointer-events: none;
  }

  .side { position: absolute; background: linear-gradient(90deg,#1d1d21,#5b5b62); border-radius: 2px; }
  .side.pwr   { right: -3px; top: 208px; width: 3px; height: 96px; }
  .side.up    { left: -3px;  top: 168px; width: 3px; height: 62px; }
  .side.down  { left: -3px;  top: 242px; width: 3px; height: 62px; }
  .side.act   { left: -3px;  top: 112px; width: 3px; height: 34px; }

  .bar {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center;
    padding: 10px 12px; margin: -10px -12px 0;
    border-radius: 999px;
    background: rgba(10,10,18,.72);
    backdrop-filter: blur(14px);
  }
  button {
    appearance: none; cursor: pointer; font: inherit;
    padding: 9px 16px; border-radius: 999px;
    border: 1px solid rgba(255,255,255,.12);
    background: rgba(255,255,255,.06); color: #e8e9f0;
    backdrop-filter: blur(10px);
    transition: background .15s, transform .12s;
  }
  button:hover { background: rgba(255,255,255,.13); }
  button:active { transform: scale(.97); }
  button[aria-pressed="true"] {
    background: linear-gradient(135deg,#6366F1,#A855F7);
    border-color: transparent; color: #fff;
  }
  .hint { font-size: 12.5px; color: #6b7085; text-align: center; max-width: 460px; }

  /* On an actual phone the chassis is nonsense — hand over the whole screen. */
  @media (max-width: 900px), (pointer: coarse) {
    body { padding: 0; gap: 0; }
    .bar, .hint { display: none; }
    .fit { transform: none !important; height: auto !important; }
    .phone { --w: 100dvw; --h: 100dvh; --bezel: 0px; border-radius: 0; box-shadow: none; }
    .screen { border-radius: 0; }
    .island, .home, .side { display: none; }
  }
</style>
</head>
<body>
<div class="stage">
  <div class="bar">
    <button data-size="393,852" aria-pressed="true">iPhone 15 Pro</button>
    <button data-size="430,932">15 Pro Max</button>
    <button data-size="375,667">SE</button>
    <button data-size="820,1180">iPad</button>
    <button id="reload">Reload</button>
    <button id="wipe">Reset app data</button>
    <span id="readout" style="font-variant-numeric:tabular-nums;color:#6b7085;padding-left:4px"></span>
  </div>

  <div class="fit" id="fit">
  <div class="phone" id="phone">
    <div class="side act"></div><div class="side up"></div>
    <div class="side down"></div><div class="side pwr"></div>
    <div class="screen">
      <div class="island"></div>
      <iframe id="app" title="Planzo" allow="geolocation; gyroscope; accelerometer"
        srcdoc="${srcdoc}"></iframe>
      <div class="home"></div>
    </div>
  </div>
  </div>

  <p class="hint">
    The app runs in a real iframe viewport, so layout, safe areas and media queries
    behave exactly as they do on the device. Open this file on your iPhone and the
    chassis disappears — you get the app full screen.
  </p>
</div>

<script>
  // Devices, with the safe-area insets each one actually reports. Without
  // these the app draws under the Dynamic Island: an iframe has no notch, so
  // env(safe-area-inset-*) resolves to 0 and the simulation quietly lies.
  const DEVICES = {
    '393,852': { top: 59, bottom: 34 },   // 15 Pro
    '430,932': { top: 59, bottom: 34 },   // 15 Pro Max
    '375,667': { top: 20, bottom: 0  },   // SE — home button, no notch
    '820,1180': { top: 24, bottom: 20 },  // iPad
  };

  const phone = document.getElementById('phone');
  const fit = document.getElementById('fit');
  const frame = document.getElementById('app');
  const doc = frame.getAttribute('srcdoc');
  let current = '393,852';

  /** Push the device's real insets into the app's own --safe-t / --safe-b. */
  function applyInsets() {
    const d = DEVICES[current] || DEVICES['393,852'];
    try {
      const idoc = frame.contentDocument;
      if (!idoc?.documentElement) return;
      let tag = idoc.getElementById('planzo-frame-insets');
      if (!tag) {
        tag = idoc.createElement('style');
        tag.id = 'planzo-frame-insets';
        idoc.head.appendChild(tag);
      }
      tag.textContent = ':root{--safe-t:' + d.top + 'px;--safe-b:' + d.bottom + 'px}';
    } catch {}
  }

  document.querySelectorAll('[data-size]').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-size]').forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      current = b.dataset.size;
      const [w, h] = current.split(',').map(Number);
      phone.style.setProperty('--w', w + 'px');
      phone.style.setProperty('--h', h + 'px');
      applyInsets();
      const tablet = w > 600;
      phone.style.borderRadius = tablet ? '38px' : '66px';
      phone.querySelector('.screen').style.borderRadius = tablet ? '28px' : '55px';
      phone.querySelectorAll('.island, .side').forEach(el => el.style.display = tablet ? 'none' : '');
    });
  });

  // Report the viewport the app actually sees, measured from inside it —
  // not the number on the button, so a sizing mistake is visible rather than
  // hidden behind a label that says the right thing.
  const readout = document.getElementById('readout');
  const measure = () => {
    try {
      const w = frame.contentWindow.innerWidth, h = frame.contentWindow.innerHeight;
      readout.textContent = \`\${w} x \${h}\`;
    } catch { readout.textContent = ''; }
  };
  /** Shrink the chassis only as much as the window demands, never enlarge. */
  function fitToWindow() {
    fit.style.transform = 'scale(1)';
    const bar = document.querySelector('.bar').getBoundingClientRect().height;
    const hint = document.querySelector('.hint').getBoundingClientRect().height;
    const avail = window.innerHeight - (bar + hint + 82);
    const need = phone.getBoundingClientRect().height;
    const scale = Math.min(1, avail / need);
    fit.style.transform = 'scale(' + Math.max(0.4, scale) + ')';
    // A scaled element still reserves its unscaled height, so claim it back.
    fit.style.height = (need * Math.max(0.4, scale)) + 'px';
  }

  frame.addEventListener('load', () => { applyInsets(); setTimeout(measure, 60); });
  applyInsets();
  window.addEventListener('resize', fitToWindow);
  new ResizeObserver(fitToWindow).observe(phone);
  fitToWindow();
  new ResizeObserver(() => setTimeout(measure, 60)).observe(phone);

  // Re-setting srcdoc is what actually reboots the iframe; reload() on a
  // srcdoc document is a no-op in some engines.
  const reboot = () => { frame.removeAttribute('srcdoc'); frame.setAttribute('srcdoc', doc); };
  document.getElementById('reload').addEventListener('click', reboot);
  document.getElementById('wipe').addEventListener('click', () => {
    try { frame.contentWindow.localStorage.clear(); } catch (e) {}
    reboot();
  });
</script>
</body>
</html>
`;

fs.mkdirSync('../dist', { recursive: true });
fs.writeFileSync('../dist/planzo-iphone.html', html);
console.log(`wrote dist/planzo-iphone.html — ${(html.length / 1024).toFixed(0)} KB`);
