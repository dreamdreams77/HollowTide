// Browser entry: wires canvas, input and the stop-motion render loop.
// The game world is drawn to an offscreen layer only when the stop-motion frame changes (12 fps), when something
// was clicked, or at 24 fps while things are moving; the layer is blitted every animation frame together with a
// smooth 60fps cursor. The logical canvas follows the screen: 960x540 sideways, 540 wide x taller upright.

import { Game } from './game/game.js';
import { Sound } from './engine/audio.js';
import { frameAt } from './engine/clay.js';
import { setupInstall } from './install.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('wrap');
const boot = document.getElementById('boot');
const MAX_SCALE = Math.min(2, window.devicePixelRatio || 1);

const layer = document.createElement('canvas');
const lctx = layer.getContext('2d');

let storage = null;
try {
  storage = window.localStorage;
  storage.getItem('hollow-tide.probe');
} catch {
  storage = null;
}

const sound = new Sound();
const game = new Game({ sound, storage });
window.__game = game; // handy for debugging and automated screenshots

// ---- sizing: logical size from the stage's shape, backing-store scale from the screen (and how fast we can draw)
let renderScale = MAX_SCALE;
let vw = 960;
let vh = 540;

function logicalSize() {
  const cw = stage.clientWidth || window.innerWidth;
  const ch = stage.clientHeight || window.innerHeight;
  if (ch > cw) return [540, Math.max(720, Math.min(1200, Math.round((540 * ch) / cw)))];
  return [960, 540];
}

function applySize() {
  const [w, h] = logicalSize();
  vw = w;
  vh = h;
  const pw = Math.round(w * renderScale);
  const ph = Math.round(h * renderScale);
  // size each surface on its own: the visible canvas starts at 960x540 (from the HTML), the layer at the 300x150 default
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  if (layer.width !== pw || layer.height !== ph) {
    layer.width = pw;
    layer.height = ph;
  }
  stage.style.setProperty('--ar', String(w / h));
  game.setViewport(w, h);
  game.dirty = true;
}

function toLogical(ev) {
  const r = canvas.getBoundingClientRect();
  return [((ev.clientX - r.left) / r.width) * vw, ((ev.clientY - r.top) / r.height) * vh];
}

canvas.addEventListener('pointermove', (ev) => {
  game.touch = ev.pointerType === 'touch';
  game.pointerMove(...toLogical(ev));
});
canvas.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  game.touch = ev.pointerType === 'touch';
  game.pointerDown(...toLogical(ev));
});
canvas.addEventListener('pointerleave', () => {
  game.pointer = { x: -100, y: -100 };
  game.dirty = true;
});
window.addEventListener('keydown', (ev) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(ev.key)) ev.preventDefault();
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return; // browser shortcuts are not ours
  // a held Enter must not machine-gun through the dialogue (or pick a choice twice)
  if (ev.repeat && (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'z' || ev.key === 'Escape')) return;
  game.key(ev.key.length === 1 ? ev.key.toLowerCase() : ev.key);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) sound.ctx?.suspend();
  else if (sound.enabled) sound.ctx?.resume();
});
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(applySize).observe(stage);
window.addEventListener('resize', applySize);
window.addEventListener('orientationchange', () => setTimeout(applySize, 120));

// ---- loop
let last = performance.now();
let lastFrame = -1;
let lastDraw = 0;
let costEma = 8; // average ms per world render
let nextTune = last + 2500;

function tuneScale(now) {
  if (now < nextTune) return;
  nextTune = now + 2500;
  if (costEma > 34 && renderScale > 1) {
    renderScale = Math.max(1, renderScale - 0.25); // too slow: draw fewer pixels
    applySize();
  } else if (costEma < 11 && renderScale < MAX_SCALE) {
    renderScale = Math.min(MAX_SCALE, renderScale + 0.25); // plenty of headroom: sharpen up again
    applySize();
  }
}

function loop(now) {
  const dt = (now - last) / 1000;
  last = now;
  game.update(dt);
  const rawFr = frameAt(game.time);
  const fr = game.settings.calm ? 0 : rawFr; // calm: redraw at 12 fps for text and motion, but hold every shape still
  const moving = game.moving || game.camMoving;
  if (rawFr !== lastFrame || game.dirty || (moving && now - lastDraw > 38)) {
    lastFrame = rawFr;
    lastDraw = now;
    const t0 = performance.now();
    lctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    try {
      game.render(lctx, fr);
    } catch (e) {
      console.error('render error', e);
    }
    costEma += (performance.now() - t0 - costEma) * 0.08;
  }
  tuneScale(now);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layer, 0, 0);
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  game.drawCursor(ctx);
  requestAnimationFrame(loop);
}

applySize();
// Canvas text only uses a web font once it is loaded, so give Poppins a moment (it falls back gracefully offline).
const fontsReady = Promise.race([
  Promise.all([500, 600, 700, 800].map((w) => document.fonts.load(`${w} 16px Poppins`)).concat(document.fonts.load('italic 600 16px Poppins'), document.fonts.load('20px Limelight'))).catch(() => {}),
  new Promise((r) => setTimeout(r, 1800)),
]);
fontsReady.then(() => {
  boot?.remove();
  setupInstall(() => game.mode, storage);
  requestAnimationFrame(loop);
});
