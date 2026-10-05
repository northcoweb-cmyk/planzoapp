// iPhone simulator: streams a real (Chromium) browser running in iPhone emulation
// to a browser tab. Works for any URL because it is a real browser, not an iframe,
// so X-Frame-Options, cookies, logins, OAuth popups etc. all behave normally.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright-core');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT || 4321);
const HOST = process.env.HOST || '127.0.0.1'; // keep local: this server can open any URL
const PROFILE_DIR = path.join(__dirname, 'profile');
const PUBLIC = path.join(__dirname, 'public');

// Full-screen iPhone sizes (CSS px). DPR 3 like the real devices.
const MODELS = {
  'iphone-15-pro':     { label: 'iPhone 15 Pro',     w: 393, h: 852, base: 'iPhone 15 Pro' },
  'iphone-15-pro-max': { label: 'iPhone 15 Pro Max', w: 430, h: 932, base: 'iPhone 15 Pro Max' },
  'iphone-13':         { label: 'iPhone 13',         w: 390, h: 844, base: 'iPhone 13' },
  'iphone-se':         { label: 'iPhone SE',         w: 375, h: 667, base: 'iPhone SE' },
};

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  try {
    const p = chromium.executablePath();
    if (p && fs.existsSync(p)) return p;
  } catch {}
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  try { // any installed Playwright chromium build
    for (const d of fs.readdirSync(root || '').filter((n) => /^chromium-\d+$/.test(n)).sort().reverse())
      for (const sub of ['chrome-linux/chrome', 'chrome-linux64/chrome']) {
        const p = path.join(root, d, sub); if (fs.existsSync(p)) return p;
      }
  } catch {}
  for (const c of [root && path.join(root, 'chromium', 'chrome-linux', 'chrome'),
                   '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
                   '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']) {
    if (c && fs.existsSync(c)) return c;
  }
  return undefined;
}

function normalizeUrl(input) {
  let u = String(input || '').trim();
  if (!u) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  try {
    const parsed = new URL(u);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    return parsed.href;
  } catch { return null; }
}

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const file = path.join(PUBLIC, p === '/' ? 'index.html' : p);
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('Not found');
  }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  res.writeHead(200, { 'Content-Type': (types[path.extname(file)] || 'text/plain') + '; charset=utf-8' });
  fs.createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server, path: '/ws' });
let active = null; // only one live session (they share one persistent profile = saved logins)

wss.on('connection', (ws) => {
  if (active) active.close();
  const session = new Session(ws);
  active = session;
  ws.on('close', () => { session.close(); if (active === session) active = null; });
  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    // handle strictly in order (a tap must finish before the keystrokes that follow it)
    session.queue = session.queue.then(() => session.handle(msg))
      .catch((e) => session.send({ t: 'error', message: String(e.message || e) }));
  });
});

class Session {
  constructor(ws) { this.ws = ws; this.queue = Promise.resolve(); this.context = null; this.page = null; this.cdp = null; this.model = null; this.closed = false; }
  send(o) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }

  async start(modelKey, url) {
    await this.teardown();
    const m = MODELS[modelKey] || MODELS['iphone-15-pro'];
    this.model = m;
    const base = devices[m.base] || devices['iPhone 15 Pro'];
    this.context = await chromium.launchPersistentContext(PROFILE_DIR, {
      executablePath: findChromium(),
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
      userAgent: base.userAgent,
      viewport: { width: m.w, height: m.h },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      locale: 'en-US',
      acceptDownloads: false,
    });
    // OAuth / target=_blank popups: follow the newest page, return when it closes.
    this.context.on('page', (p) => this.attach(p));
    const first = this.context.pages()[0] || await this.context.newPage();
    await this.attach(first);
    this.send({ t: 'ready', w: m.w, h: m.h, label: m.label });
    if (url) await this.goto(url);
  }

  async attach(page) {
    if (this.closed) return;
    this.page = page;
    page.on('close', () => {
      if (this.page !== page || this.closed) return;
      const rest = this.context.pages().filter((p) => !p.isClosed());
      if (rest.length) this.attach(rest[rest.length - 1]);
    });
    page.on('framenavigated', (f) => { if (f === page.mainFrame() && this.page === page) this.send({ t: 'url', url: page.url() }); });
    page.on('dialog', async (d) => { this.send({ t: 'toast', message: `${d.type()}: ${d.message()}` }); try { await d.accept(d.defaultValue()); } catch {} });
    page.on('load', () => this.send({ t: 'url', url: page.url() }));
    try { await page.waitForLoadState('commit', { timeout: 3000 }); } catch {}
    await this.startScreencast(page);
    this.send({ t: 'url', url: page.url() });
  }

  async startScreencast(page) {
    if (this.cdp) { try { await this.cdp.detach(); } catch {} }
    const cdp = await this.context.newCDPSession(page);
    this.cdp = cdp;
    cdp.on('Page.screencastFrame', async (f) => {
      if (this.cdp !== cdp) return;
      this.send({ t: 'frame', data: f.data });
      try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 75, maxWidth: this.model.w * 2, maxHeight: this.model.h * 2, everyNthFrame: 1 });
  }

  async goto(raw) {
    const url = normalizeUrl(raw);
    if (!url) return this.send({ t: 'error', message: 'That does not look like a valid URL.' });
    this.send({ t: 'loading', loading: true });
    try { await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }); }
    catch (e) { this.send({ t: 'error', message: `Could not load ${url}: ${String(e.message).split('\n')[0]}` }); }
    this.send({ t: 'loading', loading: false });
  }

  async handle(m) {
    switch (m.t) {
      case 'start': return this.start(m.model, m.url);
      case 'goto': return this.goto(m.url);
      case 'back': return void (await this.page.goBack({ timeout: 15000 }).catch(() => {}));
      case 'forward': return void (await this.page.goForward({ timeout: 15000 }).catch(() => {}));
      case 'reload': return void (await this.page.reload({ timeout: 30000 }).catch(() => {}));
      case 'screenshot': {
        const buf = await this.page.screenshot({ type: 'png' });
        return this.send({ t: 'screenshot', data: buf.toString('base64') });
      }
      case 'clear': {
        const model = this.model && Object.keys(MODELS).find((k) => MODELS[k] === this.model);
        await this.teardown();
        fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
        this.send({ t: 'toast', message: 'Cleared cookies, logins and storage.' });
        return this.start(model);
      }
    }
    if (!this.cdp) return;
    const cdp = this.cdp;
    switch (m.t) {
      case 'touch': // phase: start | move | end
        return void (await cdp.send('Input.dispatchTouchEvent', {
          type: { start: 'touchStart', move: 'touchMove', end: 'touchEnd', cancel: 'touchCancel' }[m.phase],
          touchPoints: m.phase === 'end' || m.phase === 'cancel' ? [] : [{ x: m.x, y: m.y }],
        }));
      case 'wheel':
        return void (await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: m.x, y: m.y, deltaX: m.dx, deltaY: m.dy }));
      case 'key': return void (await this.page.keyboard.press(m.key));
      case 'text': return void (await this.page.keyboard.insertText(m.text));
    }
  }

  async teardown() {
    this.cdp = null;
    if (this.context) { try { await this.context.close(); } catch {} this.context = null; }
    this.page = null;
  }
  async close() { this.closed = true; await this.teardown(); }
}

server.listen(PORT, HOST, () => {
  const arg = process.argv[2];
  console.log(`\n  iPhone simulator running → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/${arg ? '?url=' + encodeURIComponent(arg) : ''}\n`);
});
process.on('SIGINT', async () => { if (active) await active.close(); process.exit(0); });
