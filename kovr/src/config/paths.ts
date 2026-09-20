/** Locates the KOVR project root regardless of where the entry point lives. */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

function findRoot(start: string): string {
  let current = start;
  for (let depth = 0; depth < 10; depth++) {
    const manifest = join(current, 'package.json');
    if (existsSync(manifest)) {
      try {
        const parsed: unknown = JSON.parse(readFileSync(manifest, 'utf8'));
        if (typeof parsed === 'object' && parsed !== null && 'name' in parsed) {
          if ((parsed as { name?: unknown }).name === 'kovr-sports') return current;
        }
      } catch {
        // A malformed package.json higher up the tree is not ours; keep walking.
      }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error('KOVR project root not found (no package.json named "kovr-sports")');
}

/** Absolute path to `kovr/`. */
export const PROJECT_ROOT = findRoot(dirname(fileURLToPath(import.meta.url)));

/** Resolve a project-relative path; absolute inputs pass through untouched. */
export function fromRoot(...segments: string[]): string {
  const joined = join(...segments);
  return isAbsolute(joined) ? joined : resolve(PROJECT_ROOT, joined);
}
