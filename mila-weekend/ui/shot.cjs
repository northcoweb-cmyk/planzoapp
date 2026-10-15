let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  for (const v of ['oh', 'sh']) { await p.goto('file://' + path.join(__dirname, 'screen.html') + '?theme=light&v=' + v); await p.waitForFunction(() => window.__ready); await p.waitForTimeout(200); await p.screenshot({ path: path.join(__dirname, `screen_${v}_light.png`) }); }
  const q = await b.newPage({ viewport: { width: 1160, height: 1000 } });
  await q.goto('file://' + path.join(__dirname, 'screen.html') + '?theme=light&v=sh'); await q.waitForFunction(() => window.__ready); await q.waitForTimeout(200);
  await q.screenshot({ path: path.join(__dirname, 'screen_sh_window.png') });
  await b.close(); })();
