// Depth cues. The dioramas are painted as flat planes of clay; this file is what turns them into a *space*:
//  - multiplane parallax: every layer slides at its own speed when the camera moves, like a real animation stand
//  - air: hazy bands that wash far things toward the horizon colour
//  - light: pools on the floor under lamps, soft-light washes that also tint whoever stands near them
//  - water: reflections and ripples that answer the lights above them
//  - perspective: floor rows that grow as they come toward the lens
// Pure drawing helpers over a Canvas2D context, no state except the current parallax offset.

import { blob, rgba, mix, drawClay } from './clay.js';
import { hash, TAU, clamp } from './rng.js';

const W = 960;

// ------------------------------------------------------------------ parallax
// `P.x` is how far the camera sits from the middle of the set, in world units. A plane at depth k slides by
// P.x * (1 - k): k = 0 is pinned to the lens (infinitely far), k = 1 is the action plane (does not slide at all),
// k > 1 is in front of the actors and slides the other way. Always safe from gaps for 0 <= k <= 1 when the camera
// really pans, and the landscape sway is small enough for the painters' overscan.
const P = { x: 0 };
export function setParallax(x) {
  P.x = Number.isFinite(x) ? x : 0;
}
export function getParallax() {
  return P.x;
}
export function planeShift(k) {
  return P.x * (1 - k);
}
export function plane(ctx, k, fn) {
  const dx = planeShift(k);
  if (Math.abs(dx) < 0.05) {
    fn();
    return;
  }
  ctx.save();
  ctx.translate(dx, 0);
  fn();
  ctx.restore();
}

// ------------------------------------------------------------------ air
// A band of haze: transparent at both edges, `a` at `peak` (0..1 down the band). `fade: false` keeps it to the bottom.
export function haze(ctx, y0, y1, color, a, o = {}) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(o.peak ?? 0.5, rgba(color, a));
  g.addColorStop(1, rgba(color, o.fade === false ? a : 0));
  ctx.fillStyle = g;
  ctx.fillRect(-140, y0, W + 280, y1 - y0);
}

// Large, soft, out-of-focus discs of light drifting in front of the lens (lamp bokeh, floating pollen).
export function bokeh(ctx, fr, o = {}) {
  const { n = 7, x0 = 0, x1 = W, y0 = 0, y1 = 540, seed = 3, color = '#ffd9a0', a = 0.1, r0 = 18, r1 = 46 } = o;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const r = r0 + hash(seed, i, 1) * (r1 - r0);
    const span = x1 - x0;
    const x = x0 + ((hash(seed, i, 2) * span + fr * (0.12 + hash(seed, i, 3) * 0.22) * (o.drift ?? 1)) % span);
    const y = y0 + hash(seed, i, 4) * (y1 - y0) + Math.sin(fr * 0.07 + i * 1.7) * 6;
    const c = o.colors ? o.colors[i % o.colors.length] : color;
    const al = a * (0.55 + 0.45 * hash(seed, i, 5)) * (0.88 + 0.12 * Math.sin(fr * 0.2 + i));
    const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
    g.addColorStop(0, rgba(c, al * 0.4));
    g.addColorStop(0.78, rgba(c, al * 0.75));
    g.addColorStop(0.93, rgba(c, Math.min(1, al * 1.2)));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ light
// A pool of light lying on the floor (additive, squashed by perspective). Flickers per stop-motion frame.
export function lightPool(ctx, x, y, rx, ry, color, a, fr = 0, o = {}) {
  const fk = o.flicker ?? 0.1;
  const flick = 1 + fk * Math.sin(fr * 0.9 + x * 0.13) + (hash(fr, x | 0, 5) - 0.5) * fk;
  ctx.save();
  ctx.globalCompositeOperation = o.op || 'lighter';
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgba(color, a * flick));
  g.addColorStop(0.55, rgba(color, a * 0.38 * flick));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

// Light that falls on *everything* around a lamp, backdrop and actors alike (soft-light keeps shape and texture).
export function lightWash(ctx, x, y, r, color, a, fr = 0, o = {}) {
  const fk = o.flicker ?? 0.12;
  const fl = 1 + fk * (hash(fr, x | 0, 6) - 0.5) * 2;
  ctx.save();
  ctx.globalCompositeOperation = o.op || 'soft-light';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, Math.min(1, a * fl)));
  g.addColorStop(0.5, rgba(color, a * 0.34 * fl));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

// ------------------------------------------------------------------ water
// A reflection hanging under a bright thing: a stack of flat bars that wobble sideways and fade with depth.
export function streak(ctx, x, y0, len, w, color, a, fr, seed = 1) {
  const n = Math.max(2, Math.ceil(len / 6));
  ctx.save();
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const ww = w * (1 - t * 0.55) * (0.72 + 0.28 * hash(seed, i, fr >> 1));
    const dx = Math.sin(fr * 0.55 + i * 0.95 + seed) * (1.5 + t * 6);
    ctx.fillStyle = rgba(color, a * (1 - t * 0.85));
    ctx.beginPath();
    ctx.ellipse(x + dx, y0 + i * 6, ww / 2, 1.8 + t * 0.8, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// Rings spreading from a point on the water.
export function ripples(ctx, x, y, rx, ry, fr, o = {}) {
  const n = o.n ?? 3;
  const color = o.color || '#dff3ff';
  ctx.save();
  ctx.lineWidth = o.width ?? 1.2;
  for (let i = 0; i < n; i++) {
    const t = ((fr * (o.speed ?? 0.045) + i / n) % 1 + 1) % 1;
    ctx.strokeStyle = rgba(color, (o.a ?? 0.4) * (1 - t));
    ctx.beginPath();
    ctx.ellipse(x, y, rx * (0.3 + t * 0.9), ry * (0.3 + t * 0.9), 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

// Tiny bright slivers where the light catches the wave tops.
export function glints(ctx, fr, x0, x1, y0, y1, n, seed = 7, color = '#fff0c8') {
  for (let i = 0; i < n; i++) {
    const t = hash(seed, i, fr >> 1);
    if (t < 0.45) continue; // each one blinks on and off with the boil
    const x = x0 + hash(seed, i, 1) * (x1 - x0);
    const y = y0 + hash(seed, i, 2) * (y1 - y0);
    blob(ctx, x, y, 3.5 + hash(seed, i, 3) * 6, 1.1, { color, alpha: 0.65, seed: seed * 31 + i, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0, boil: 0.2, lite: true });
  }
}

// ------------------------------------------------------------------ perspective
// Rows that grow as they come toward the viewer: [{ i, y, h, s, t }]. `s` is the size relative to the first row, `t` how
// near the row is (0 at the horizon, 1 at the bottom of the standard 540px frame, more on tall phones).
export function perspRows(y0, y1, h0, g) {
  const rows = [];
  let y = y0;
  let h = h0;
  for (let i = 0; i < 40 && y < y1; i++) {
    rows.push({ i, y, h, s: h / h0, t: Math.max(0, (y - y0) / Math.max(1, 540 - y0)) });
    y += h;
    h *= g;
  }
  return rows;
}

// A flat-fronted trapezoid of clay (a carpet running into the picture, a stair): top edge narrower than the bottom.
export function trapPoints(xtl, xtr, ytop, xbl, xbr, ybot, seed, frame, n = 5) {
  const corners = [[xtl, ytop], [xtr, ytop], [xbr, ybot], [xbl, ybot]];
  const pts = [];
  const ts = [0.1, 0.32, 0.5, 0.68, 0.9].slice(0, Math.max(3, n));
  let k = 0;
  for (let c = 0; c < 4; c++) {
    const a = corners[c];
    const b = corners[(c + 1) % 4];
    for (const t of ts) {
      const j = (hash(seed, k, frame + 1, 7) - 0.5) * 1.6;
      const j2 = (hash(seed, k, frame + 1, 9) - 0.5) * 1.6;
      pts.push([a[0] + (b[0] - a[0]) * t + j, a[1] + (b[1] - a[1]) * t + j2]);
      k++;
    }
  }
  return pts;
}
export function trapezoid(ctx, xtl, xtr, ytop, xbl, xbr, ybot, o = {}) {
  drawClay(ctx, trapPoints(xtl, xtr, ytop, xbl, xbr, ybot, o.seed || 1, o.frame || 0), o);
}

// ------------------------------------------------------------------ far things lose colour
// Wash a colour toward the haze by `amt`: what the painters use for anything that is supposed to be far away.
export function farther(color, fog, amt) {
  return mix(color, fog, clamp(amt, 0, 1));
}
