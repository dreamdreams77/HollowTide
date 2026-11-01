#!/usr/bin/env node
// Zero-dependency bundler: inlines every ES module under src/ into ONE self-contained dist/index.html.
//
// It understands exactly the subset of ES module syntax this repo uses (and fails loudly on anything else):
//   - single-line named imports:        import { a, b as c } from './x.js';
//   - named exports:                    export function f / export const x / export class C / export { a, b };
// It also copies manifest.webmanifest, icons/ and a build-stamped sw.js next to the page, which is what makes dist/ installable.
// Each module becomes a function scope that returns its exports, so identically named helpers in different
// files can never collide. Modules are emitted in dependency order starting from src/main.js.
//
// Usage: node tools/build.mjs [--out dist/index.html]

import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync, copyFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv.indexOf('--out');
const OUT = resolve(ROOT, outArg > 0 ? process.argv[outArg + 1] : 'dist/index.html');

const IMPORT_RE = /^import\s*\{([^}]*)\}\s*from\s*'([^']+)';?[ \t]*$/gm;
const EXPORT_DECL_RE = /^export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
const EXPORT_LIST_RE = /^export\s*\{([^}]*)\};?[ \t]*$/gm;

const modules = new Map(); // abs path -> { id, src, imports, exports }
const order = [];
const visiting = new Set();

function fail(msg) {
  console.error('build: ' + msg);
  process.exit(1);
}

function load(abs) {
  if (modules.has(abs)) return modules.get(abs);
  if (visiting.has(abs)) fail(`import cycle through ${relative(ROOT, abs)}`);
  visiting.add(abs);
  const raw = readFileSync(abs, 'utf8');
  if (/^import\s+(?!\{)/m.test(raw)) fail(`${relative(ROOT, abs)}: only "import { named } from '...'" is supported`);
  if (/^export\s+default/m.test(raw)) fail(`${relative(ROOT, abs)}: default exports are not supported`);
  if (/\bimport\s*\(|import\.meta/.test(raw)) fail(`${relative(ROOT, abs)}: dynamic import / import.meta are not supported`);

  const imports = [];
  for (const m of raw.matchAll(IMPORT_RE)) {
    const from = resolve(dirname(abs), m[2]);
    const dep = load(from);
    const names = m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [orig, alias] = s.split(/\s+as\s+/);
        return alias ? `${orig}: ${alias}` : orig;
      });
    imports.push({ dep, names });
  }
  const exports = [];
  for (const m of raw.matchAll(EXPORT_DECL_RE)) exports.push(m[1]);
  for (const m of raw.matchAll(EXPORT_LIST_RE)) {
    for (const s of m[1].split(',')) {
      const t = s.trim();
      if (t) exports.push(t);
    }
  }

  const body = raw
    .replace(IMPORT_RE, '')
    .replace(EXPORT_LIST_RE, '')
    .replace(/^export\s+(?=(?:async\s+)?(?:function|class|const|let|var)\b)/gm, '');
  if (/^\s*(import|export)\s/m.test(body.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''))) {
    // anything left over is syntax we don't handle (multi-line imports, `export *`, ...)
    const line = body.split('\n').find((l) => /^\s*(import|export)\s/.test(l));
    fail(`${relative(ROOT, abs)}: unsupported module syntax near: ${line?.trim()}`);
  }

  const mod = { id: '__m' + modules.size, path: abs, body, imports, exports };
  modules.set(abs, mod);
  visiting.delete(abs);
  order.push(mod);
  return mod;
}

const entry = load(join(ROOT, 'src/main.js'));

const chunks = [];
for (const m of order) {
  const rel = relative(ROOT, m.path);
  const pre = m.imports.map((i) => `const { ${i.names.join(', ')} } = ${i.dep.id};`).join('\n');
  const isEntry = m === entry;
  const ret = isEntry ? '' : `\nreturn { ${[...new Set(m.exports)].join(', ')} };`;
  chunks.push(`// ---- ${rel}\n${isEntry ? '' : `const ${m.id} = `}(() => {\n${pre}\n${m.body}${ret}\n})();`);
}

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const tag = /<script type="module" src="\.\/src\/main\.js"><\/script>/;
if (!tag.test(html)) fail('index.html must contain <script type="module" src="./src/main.js"></script>');
const code = `'use strict';\n${chunks.join('\n\n')}`.replace(/<\/script/gi, '<\\/script');
// Only the built page registers the service worker, so `npm start` (dev) never serves stale cached files.
const REGISTER = `<script>
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
</script>`;
let out = html.replace(tag, () => `<script>\n${code}\n</script>\n${REGISTER}`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out);
const kb = (statSync(OUT).size / 1024).toFixed(0);

// ---- installable app: manifest, icons and the service worker, next to the built page
const outDir = dirname(OUT);
const iconsDir = join(ROOT, 'icons');
const icons = existsSync(iconsDir) ? readdirSync(iconsDir).filter((f) => f.endsWith('.png')).sort() : [];
const manifestSrc = join(ROOT, 'manifest.webmanifest');
const swSrc = join(ROOT, 'sw.js');
if (existsSync(manifestSrc) && existsSync(swSrc)) {
  copyFileSync(manifestSrc, join(outDir, 'manifest.webmanifest'));
  mkdirSync(join(outDir, 'icons'), { recursive: true });
  for (const f of icons) copyFileSync(join(iconsDir, f), join(outDir, 'icons', f));

  const pageName = relative(outDir, OUT).split('\\').join('/');
  const files = ['./', './' + pageName, './manifest.webmanifest', ...icons.map((f) => `./icons/${f}`)];
  const hash = createHash('sha1');
  hash.update(out);
  hash.update(readFileSync(manifestSrc));
  for (const f of icons) hash.update(readFileSync(join(iconsDir, f)));
  const fontLink = html.match(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com[^"]+)"/);
  const fontCss = fontLink ? fontLink[1].replace(/&amp;/g, '&') : '';
  const sw = readFileSync(swSrc, 'utf8')
    .replace('__BUILD__', hash.digest('hex').slice(0, 10))
    .replace('__PRECACHE__', JSON.stringify(files))
    .replace('__FONT_CSS__', fontCss);
  writeFileSync(join(outDir, 'sw.js'), sw);
}
console.log(`built ${relative(ROOT, OUT)}  (${kb} KB, ${order.length} modules, zero dependencies${icons.length ? ', installable' : ''})`);
