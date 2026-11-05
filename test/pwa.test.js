// Static checks for the installable-app files, and that the build ships them correctly.
// (tools/smoke.py repeats these in a real Chromium: installability, offline relaunch, rotation.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));

function pngSize(file) {
  const b = readFileSync(file);
  assert.equal(b.subarray(1, 4).toString('latin1'), 'PNG', `${file} is not a PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

test('manifest is installable: name, start url, standalone, both orientations, theme colours', () => {
  assert.ok(manifest.name && manifest.short_name);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'any'); // rotating the phone must be allowed
  assert.match(manifest.start_url, /index\.html$/);
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
});

test('manifest icons exist at their declared sizes, with 192 and 512 in both "any" and "maskable"', () => {
  for (const ic of manifest.icons) {
    const [w, h] = pngSize(join(ROOT, ic.src));
    assert.equal(`${w}x${h}`, ic.sizes, ic.src);
  }
  for (const purpose of ['any', 'maskable']) {
    for (const size of ['192x192', '512x512']) {
      assert.ok(manifest.icons.some((i) => i.purpose === purpose && i.sizes === size), `${purpose} ${size}`);
    }
  }
  assert.deepEqual(pngSize(join(ROOT, 'apple-touch-icon.png')), [180, 180]);
});

test('the source page links the manifest and Apple touch icon but does NOT register the service worker', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /rel="apple-touch-icon"/);
  assert.match(html, /name="theme-color"/);
  assert.doesNotMatch(html, /serviceWorker/, 'dev (npm start) must never be cached');
});

test('build ships page + manifest + icons + a stamped service worker, and only the built page registers it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ht-build-'));
  try {
    execFileSync('node', [join(ROOT, 'tools/build.mjs'), '--out', join(dir, 'index.html')], { stdio: 'pipe' });
    for (const f of ['index.html', 'manifest.webmanifest', 'sw.js']) assert.ok(existsSync(join(dir, f)), f);
    const icons = readdirSync(dir);
    assert.ok(icons.includes('icon-512.png') && icons.includes('icon-maskable-512.png') && icons.includes('apple-touch-icon.png'));

    const sw = readFileSync(join(dir, 'sw.js'), 'utf8');
    assert.doesNotMatch(sw, /const BUILD = '__BUILD__'/, 'build stamp was not applied');
    assert.doesNotMatch(sw, /= __PRECACHE__/, 'precache list was not applied');
    assert.doesNotMatch(sw, /'__FONT_CSS__'/, 'font url was not applied');
    const list = JSON.parse(sw.match(/const PRECACHE = (\[.*\]);/)[1]);
    for (const f of list) {
      if (f === './') continue;
      assert.ok(existsSync(join(dir, f)), `precached file is missing from the build: ${f}`);
    }
    for (const ic of manifest.icons) assert.ok(list.includes('./' + ic.src), `${ic.src} should be precached`);

    const html = readFileSync(join(dir, 'index.html'), 'utf8');
    assert.match(html, /serviceWorker\.register\('\.\/sw\.js', \{ updateViaCache: 'none' \}\)/);
    assert.doesNotMatch(html, /src="\.\/src\/main\.js"/, 'built page must be self-contained');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the build stamp (the cache name) is a reproducible content hash', () => {
  const stamp = (out) => {
    execFileSync('node', [join(ROOT, 'tools/build.mjs'), '--out', join(out, 'index.html')], { stdio: 'pipe' });
    return readFileSync(join(out, 'sw.js'), 'utf8').match(/const BUILD = '([0-9a-f]+)'/)[1];
  };
  const a = mkdtempSync(join(tmpdir(), 'ht-a-'));
  const b = mkdtempSync(join(tmpdir(), 'ht-b-'));
  try {
    const s1 = stamp(a);
    const s2 = stamp(b);
    assert.equal(s1, s2, 'identical source must give an identical stamp (reproducible)');
    assert.match(s1, /^[0-9a-f]{10}$/);
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
});

test('every icon <link> in the page resolves to a file in the source tree and in the build', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const hrefs = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 2, 'expected favicon and apple-touch-icon links');
  const dir = mkdtempSync(join(tmpdir(), 'ht-links-'));
  try {
    execFileSync('node', [join(ROOT, 'tools/build.mjs'), '--out', join(dir, 'index.html')], { stdio: 'pipe' });
    for (const h of hrefs) {
      assert.ok(existsSync(join(ROOT, h)), `icon link ${h} is missing from the source tree`);
      assert.ok(existsSync(join(dir, h)), `icon link ${h} is missing from the build`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
