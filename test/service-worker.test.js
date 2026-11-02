import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('service worker extracts Google Fonts URLs from CSS url() declarations', () => {
  const source = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  assert.ok(source.includes('css.matchAll(/url\\((https:[^)]+)\\)/g)'), 'font URL matcher must match normal CSS url(...) syntax');
  const css = '@font-face { src: url(https://fonts.gstatic.com/s/example.woff2); }';
  const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]);
  assert.deepEqual(urls, ['https://fonts.gstatic.com/s/example.woff2']);
});
