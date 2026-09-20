/**
 * Assemble the static site.
 *
 * Copies the shell, styles, compiled client, icons, manifest and service
 * worker into `public/`, which is what a static host (Vercel included)
 * serves at the root. The standalone server reads `web/` directly and does
 * not need this.
 */

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const web = join(root, 'web');
const out = join(root, 'public');

if (!existsSync(join(web, 'dist'))) {
  console.error('web/dist is missing — run `npm run build:client` first.');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const entry of ['index.html', 'manifest.webmanifest', 'sw.js', 'styles', 'icons', 'dist']) {
  const source = join(web, entry);
  if (!existsSync(source)) continue;
  cpSync(source, join(out, entry), { recursive: true });
}

console.log(`public/ assembled from web/`);
