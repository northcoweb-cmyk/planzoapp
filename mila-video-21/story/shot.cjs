let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
(async () => { const b = await chromium.launch({ args: ['--force-color-profile=srgb'] }); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + __dirname + '/story.html'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  await p.screenshot({ path: __dirname + '/mila_launch_story_link.png' }); await b.close(); })();
