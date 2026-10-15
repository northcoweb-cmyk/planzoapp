let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  for (const v of ['oh', 'sh']) { await p.goto('file://' + path.join(__dirname, 'screen.html') + '?v=' + v); await p.waitForFunction(() => window.__ready); await p.waitForTimeout(200); await p.screenshot({ path: path.join(__dirname, `screen_${v}.png`) }); }
  await b.close(); })();
