#!/usr/bin/env node
/* Frame-exact renderer for the Mila launch film.
 *
 *   node render.cjs --format square              -> out/mila_launch_1080x1080_60fps.mp4
 *   node render.cjs --format portrait            -> out/mila_launch_1080x1920_60fps.mp4
 *   node render.cjs --format landscape           -> out/mila_launch_1920x1080_60fps.mp4
 *   node render.cjs --format square --stills 3.6,8.9   (PNG stills for review)
 *
 * How it works: index.html exposes renderFrame(t), a pure function of time.
 * We capture at 120 fps (4 headless Chromium workers in parallel, lossless),
 * then average each pair of frames down to 60 fps. That is a real 180-degree
 * shutter, so fast moves get natural motion blur. Final encode: H.264 High,
 * yuv420p, BT.709, CRF 12, with the -14 LUFS / 48 kHz mix as AAC 320 kbps.
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const ROOT = __dirname;
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.concat([[v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]]) : a), []));
const FORMAT = args.format || 'square';
const CAP_FPS = +(args.capfps || 120);
const OUT_FPS = 60;
const WORKERS = +(args.workers || 4);
const SIZES = { square: [1080, 1080], portrait: [1080, 1920], landscape: [1920, 1080] };
const [W, H] = SIZES[FORMAT];
const tl = JSON.parse(fs.readFileSync(path.join(ROOT, 'timeline.json'), 'utf8'));
const N_OUT = Math.ceil(tl.duration * OUT_FPS);              // 1218 frames = 20.30 s
const N_CAP = N_OUT * (CAP_FPS / OUT_FPS);
const TMP = path.join(ROOT, 'out', `.tmp_${FORMAT}`);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.wav': 'audio/wav' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

function run(cmd, a, stdin) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, a, { stdio: [stdin ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
    let err = ''; p.stderr.on('data', d => (err += d));
    p.on('close', c => (c === 0 ? res() : rej(new Error(`${cmd} exited ${c}\n${err.slice(-2000)}`))));
    if (stdin) stdin(p);
  });
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?render&format=${FORMAT}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const cdp = await page.context().newCDPSession(page);
  const shot = async t => {
    await page.evaluate(tt => window.renderFrame(tt), t);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, captureBeyondViewport: false });
    return Buffer.from(data, 'base64');
  };
  return { page, shot };
}

(async () => {
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none', '--hide-scrollbars'] });

  if (args.stills) {
    const { shot } = await openPage(browser, port);
    const dir = path.join(ROOT, 'out', 'stills'); fs.mkdirSync(dir, { recursive: true });
    for (const t of String(args.stills).split(',').map(Number)) {
      const f = path.join(dir, `${FORMAT}_${t.toFixed(3)}.png`);
      fs.writeFileSync(f, await shot(t)); console.log(f);
    }
    await browser.close(); srv.close(); return;
  }

  fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
  const t0 = Date.now();
  const per = Math.ceil(N_CAP / WORKERS);
  let done = 0;
  await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
    const a = w * per, b = Math.min(N_CAP, a + per);
    if (a >= b) return;
    const { shot } = await openPage(browser, port);
    const seg = path.join(TMP, `seg${w}.mkv`);
    await run('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(CAP_FPS), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264rgb', '-qp', '0', '-preset', 'ultrafast', seg], async p => {
      for (let i = a; i < b; i++) {
        const buf = await shot(i / CAP_FPS);
        if (!p.stdin.write(buf)) await new Promise(r => p.stdin.once('drain', r));
        if (++done % 120 === 0) process.stdout.write(`  ${FORMAT}: ${done}/${N_CAP} frames  (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
      }
      p.stdin.end();
    });
  }));
  await browser.close(); srv.close();

  const list = path.join(TMP, 'list.txt');
  fs.writeFileSync(list, Array.from({ length: WORKERS }, (_, w) => `file 'seg${w}.mkv'`).filter((_, w) => w * per < N_CAP).join('\n'));
  const out = path.join(ROOT, 'out', `mila_launch_${W}x${H}_60fps.mp4`);
  const step = CAP_FPS / OUT_FPS;
  const vf = [
    step > 1 ? `tmix=frames=${step}:weights='${Array(step).fill(1).join(' ')}'` : null,   // 180-degree shutter
    step > 1 ? `select='not(mod(n+1\\,${step}))'` : null,
    `setpts=N/${OUT_FPS}/TB`,
    'scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int',
    'format=yuv420p',
  ].filter(Boolean).join(',');
  await run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-i', path.join(ROOT, 'audio', 'mix.wav'),
    '-vf', vf, '-r', String(OUT_FPS), '-frames:v', String(N_OUT),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-tune', 'film', '-profile:v', 'high', '-level', '4.2',
    '-x264-params', 'keyint=60:min-keyint=60:aq-mode=3',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out]);
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`wrote ${out} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})().catch(e => { console.error(e); process.exit(1); });
