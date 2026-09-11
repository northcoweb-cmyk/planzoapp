/**
 * Port the CommonJS engine to ESM for the bundler.
 *
 * The engine is the tested core and must stay a single source of truth, so
 * this converts mechanically rather than by hand. The require/export patterns
 * in engine/ are uniform (three shapes), which is what makes a codemod safe
 * here — the output is then imported and smoke-tested before anything ships.
 */
import fs from 'fs';
import path from 'path';

const SRC = path.resolve('../');           // planzo/
const OUT = path.resolve('./src/lib/engine');
fs.mkdirSync(OUT, { recursive: true });

const FILES = [
  ['engine/catalog.js',   'catalog.js'],
  ['engine/consensus.js', 'consensus.js'],
  ['engine/questions.js', 'questions.js'],
  ['engine/intent.js',    'intent.js'],
  ['engine/plan.js',      'plan.js'],
  ['engine/memory.js',    'memory.js'],
  ['engine/expenses.js',  'expenses.js'],
  ['engine/calendar.js',  'calendar.js'],
  ['engine/hosting.js',   'hosting.js'],
  ['engine/trips.js',     'trips.js'],
  ['services/weather.js', 'weather.js'],
];

/** Map a CommonJS require path to the flat ESM layout. */
function remap(spec) {
  const base = spec.replace(/^\.\.?\//, '').replace(/^(engine|services|lib)\//, '');
  return './' + base + '.js';
}

function toEsm(src, name) {
  let out = src;

  // const { a, b } = require('x')   →   import { a, b } from 'x'
  out = out.replace(/const\s*\{([^}]+)\}\s*=\s*require\(['"]([^'"]+)['"]\);?/g,
    (_, names, spec) => `import {${names}} from '${remap(spec)}';`);

  // const x = require('y')          →   import x from 'y'
  out = out.replace(/const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\);?/g,
    (_, id, spec) => `import ${id} from '${remap(spec)}';`);

  // Inline require() left anywhere else is a hard error, not something to
  // paper over — it would silently become undefined at runtime.
  if (/\brequire\s*\(/.test(out)) {
    throw new Error(`${name}: an inline require() survived the codemod`);
  }

  // module.exports = { ... }        →   named exports + a default
  out = out.replace(/module\.exports\s*=\s*\{([\s\S]*?)\};?\s*$/m, (_, body) => {
    const names = body.split(',').map(s => s.trim()).filter(Boolean)
      .map(s => (s.includes(':') ? s.split(':')[0].trim() : s));
    return `export { ${names.join(', ')} };\nexport default { ${names.join(', ')} };`;
  });

  if (/module\.exports/.test(out)) throw new Error(`${name}: module.exports survived`);

  // 'use strict' is implicit in a module.
  out = out.replace(/^'use strict';\n/, '');

  // process.env is not defined in the browser; the bundle defines only what
  // it needs, so read defensively.
  out = out.replace(/process\.env\.(\w+)/g, "(globalThis.__PLANZO_ENV__?.$1)");

  // These are generated from JS that is already covered by the Node test
  // suite. TypeScript infers wrong shapes from plain JS (it reads an early
  // return as the whole return type), and hand-annotating generated files
  // would be overwritten on the next port.
  return `// @ts-nocheck\n/* AUTO-GENERATED from planzo/${name} — edit the source, then run scripts-port.mjs */\n` + out;
}

/**
 * Emit a .d.ts beside each ported module.
 *
 * @ts-nocheck silences errors inside a file but callers still get the shapes
 * TypeScript guessed from plain JS, which are wrong (it reads an early return
 * as the entire return type). A generated declaration is the honest fix: the
 * engine's real contract is enforced by the Node test suite, not by inference.
 */
function emitTypes(esm, to) {
  const m = esm.match(/export \{ ([^}]+) \};/);
  const names = m ? m[1].split(',').map(s => s.trim()).filter(Boolean) : [];
  const lines = names.map(n => `export declare const ${n}: any;`);
  lines.push('declare const _default: any;', 'export default _default;');
  fs.writeFileSync(path.join(OUT, to.replace(/\.js$/, '.d.ts')), lines.join('\n') + '\n');
}

let n = 0;
for (const [from, to] of FILES) {
  const src = fs.readFileSync(path.join(SRC, from), 'utf8');
  const esm = toEsm(src, from);
  fs.writeFileSync(path.join(OUT, to), esm);
  emitTypes(esm, to);
  n++;
}
// The hand-written browser adapters need declarations too.
for (const [file, names] of [
  ['store.js',  ['get','set','del','incrBy','setIfAbsent','push']],
  ['cache.js',  ['wrap','TTL']],
  ['ids.js',    ['token','planCode','hash','sign','verify']],
  ['cost.js',   ['reserve','record','report','estimateAiCost','PLACES_PRICES','LIMITS']],
  ['places.js', ['search','photoFor','details','enabled']],
  ['ai.js',     ['ask','askJson','enabled','CHEAP','SMART']],
  ['events.js', ['search','byId','idFromUrl','enabled']],
]) {
  const lines = names.map(x => `export declare const ${x}: any;`);
  lines.push('declare const _default: any;', 'export default _default;');
  fs.writeFileSync(path.join(OUT, file.replace(/\.js$/, '.d.ts')), lines.join('\n') + '\n');
}
console.log(`ported ${n} modules → src/lib/engine/`);
