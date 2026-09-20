/** Remove build output. Never touches `data/`, which holds the demo ledger. */
import { rmSync } from 'node:fs';
import { fromRoot } from '../src/config/paths.js';

for (const target of ['dist', 'web/dist']) {
  rmSync(fromRoot(target), { recursive: true, force: true });
  console.log(`removed ${target}`);
}
