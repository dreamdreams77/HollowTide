// Grim Fandango / Dia de los Muertos set dressing, still all clay and paper:
// papel picado banners, marigolds and falling petals, ofrenda candles, a sugar-skull moon,
// buzzing neon, fog banks, window shafts and art-deco trim. Stage painters and the UI pull from here.

import { blob, slab, limb, glow, shade, rgba, FONT_DECO } from './clay.js';
import { hash, TAU } from './rng.js';

export const PAPEL = ['#e8528f', '#2fb8a8', '#f4a53a', '#f3dc62', '#8a64d8', '#ef6f4a'];
export const MARIGOLD = ['#f08a24', '#f6a62e', '#ffc94a'];
export const BONE = '#f4ecd8';
export const DECO_GOLD = '#d9b25a';

// point on the quadratic sag between two anchors (t 0..1); sag is the deepest drop in px
function sagPoint(x0, y0, x1, y1, sag, t) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2 + sag * 2;
  const u = 1 - t;
  return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1];
}

function drawString(ctx, x0, y0, x1, y1, sag, color, fr, width = 1.6) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const j = (hash(fr, 5) - 0.5) * 0.8;
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2 + j, x1, y1);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ papel picado
function flagShape(ctx, w, h, kind) {
  const hw = w / 2;
  ctx.beginPath();
  // scalloped paper outline
  ctx.moveTo(-hw, 0);
  ctx.lineTo(hw, 0);
  ctx.lineTo(hw, h - 7);
  const sc = 4;
  for (let i = 0; i < sc; i++) {
    const xa = hw - ((i + 1) * w) / sc;
    const xm = hw - ((i + 0.5) * w) / sc;
    ctx.quadraticCurveTo(xm, h + 3, xa, h - 7);
  }
  ctx.closePath();
  // cut-outs (even-odd holes)
  const d = (cx, cy, r) => {
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.78, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r * 0.78, cy);
    ctx.closePath();
  };
  const c = (cx, cy, r) => {
    ctx.moveTo(cx + r, cy);
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.closePath();
  };
  if (kind === 0) {
    d(0, h * 0.4, w * 0.3);
    d(0, h * 0.4, w * 0.12);
    c(-hw * 0.62, h * 0.14, 2.2);
    c(hw * 0.62, h * 0.14, 2.2);
    for (let i = -1; i <= 1; i++) c(i * w * 0.24, h - 15, 1.9);
  } else if (kind === 1) {
    c(0, h * 0.4, w * 0.26);
    c(0, h * 0.4, w * 0.1);
    for (let i = 0; i < 6; i++) c(Math.cos((i / 6) * TAU) * w * 0.36, h * 0.4 + Math.sin((i / 6) * TAU) * w * 0.36, 1.7);
    d(0, h * 0.14, 4);
  } else {
    for (let r = 0; r < 3; r++) {
      for (let k = -1; k <= 1; k++) d(k * w * 0.26, h * 0.2 + r * h * 0.2, 4.4);
    }
  }
}

// A string of cut-paper flags hung between two anchors; each flutters a little every frame.
export function papelPicado(ctx, x0, y0, x1, y1, sag, fr, o = {}) {
  const n = o.n ?? 10;
  const w = o.w ?? 34;
  const h = o.h ?? 44;
  const seed = o.seed ?? 1;
  const colors = o.colors || PAPEL;
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  drawString(ctx, x0, y0, x1, y1, sag, '#d9c89c', fr);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const [px, py] = sagPoint(x0, y0, x1, y1, sag, t);
    const col = colors[Math.floor(hash(seed, i, 1) * colors.length)];
    const rot = Math.sin(fr * 0.42 + i * 1.7 + seed) * 0.07 + (hash(fr, i, seed) - 0.5) * 0.05;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    flagShape(ctx, w, h, Math.floor(hash(seed, i, 2) * 3));
    ctx.fillStyle = col;
    ctx.fill('evenodd');
    // light from the left falling off to the right, then the same path again as a cheap outline
    const g = ctx.createLinearGradient(-w / 2, 0, w / 2, h);
    g.addColorStop(0, 'rgba(255,246,222,0.3)');
    g.addColorStop(0.5, 'rgba(255,246,222,0)');
    g.addColorStop(1, 'rgba(27,16,56,0.32)');
    ctx.fillStyle = g;
    ctx.fill('evenodd');
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(shade(col, -0.5), 0.7);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ marigolds
export function marigold(ctx, x, y, r, fr, seed = 1, o = {}) {
  const np = o.petals ?? (r < 12 ? 6 : 8);
  const lite = r < 12; // small flowers: no need for the full clay shader per petal
  for (let i = 0; i < np; i++) {
    const a = (i / np) * TAU + hash(seed, i) * 0.35;
    blob(ctx, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.54, r * 0.52, r * 0.42, {
      color: i % 2 ? MARIGOLD[0] : MARIGOLD[1], seed: seed * 13 + i, frame: fr, rot: a, outline: 0.7, tex: 0.5, wobble: 0.1, gloss: 0.4, boil: 0.25, lite,
    });
  }
  const ni = r < 12 ? 3 : 5;
  for (let i = 0; i < ni; i++) {
    const a = (i / ni) * TAU + 0.6 + hash(seed, 40 + i) * 0.4;
    blob(ctx, x + Math.cos(a) * r * 0.28, y + Math.sin(a) * r * 0.25, r * 0.32, r * 0.26, {
      color: MARIGOLD[2], seed: seed * 17 + i, frame: fr, rot: a, outline: 0.5, tex: 0.4, wobble: 0.1, gloss: 0.5, boil: 0.2, drop: 0, lite,
    });
  }
  blob(ctx, x, y, r * 0.18, r * 0.16, { color: '#c4661a', seed: seed * 19, frame: fr, outline: 0.4, tex: 0.3, drop: 0, boil: 0.15, lite: true });
}

// A garland of flowers and leaves hung between two anchors.
export function garland(ctx, x0, y0, x1, y1, sag, fr, o = {}) {
  const n = o.n ?? 8;
  const r = o.r ?? 11;
  const seed = o.seed ?? 3;
  drawString(ctx, x0, y0, x1, y1, sag, '#3a5a3a', fr, 2.4);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const [px, py] = sagPoint(x0, y0, x1, y1, sag, t);
    blob(ctx, px + (i % 2 ? 9 : -9), py + 5, r * 0.8, r * 0.34, { color: '#4f8a4a', seed: seed + i, frame: fr, rot: i % 2 ? 0.6 : -0.6, outline: 0.7, tex: 0.5, drop: 0, lite: true });
  }
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const [px, py] = sagPoint(x0, y0, x1, y1, sag, t);
    marigold(ctx, px, py + 2, r * (0.9 + hash(seed, i) * 0.3), fr, seed * 31 + i);
  }
}

// Marigold petals drifting down through a region (a trail for lost spirits).
export function petals(ctx, fr, o = {}) {
  const n = o.n ?? 12;
  const { x0 = 0, x1 = 960, y0 = 0, y1 = 540, seed = 6 } = o;
  for (let i = 0; i < n; i++) {
    const t = (fr * (0.006 + hash(seed, i) * 0.007) + hash(seed, i, 1)) % 1;
    const x = x0 + hash(seed, i, 2) * (x1 - x0) + Math.sin(fr * 0.25 + i * 2) * 16 + t * 24;
    const y = y0 + t * (y1 - y0);
    const fade = Math.min(1, t * 6, (1 - t) * 4);
    blob(ctx, x, y, 4.6 + hash(seed, i, 3) * 2, 2.4 + hash(seed, i, 3), {
      color: MARIGOLD[i % 3], alpha: 0.9 * fade, seed: seed * 50 + i, frame: fr, rot: fr * 0.35 + i, flat: true, outline: 0, noRim: true, gloss: 0, boil: 0.3,
    });
  }
}

// A few petals dropped on the floor, as if someone walked through carrying flowers.
export function petalPath(ctx, fr, x0, y0, x1, y1, n, seed = 9) {
  for (let i = 0; i < n; i++) {
    const t = (i + hash(seed, i)) / n;
    const x = x0 + (x1 - x0) * t + (hash(seed, i, 1) - 0.5) * 16;
    const y = y0 + (y1 - y0) * t + (hash(seed, i, 2) - 0.5) * 10;
    blob(ctx, x, y, 5 + hash(seed, i, 3) * 2, 2.6, { color: MARIGOLD[i % 3], seed: seed * 40 + i, frame: fr, rot: hash(seed, i, 4) * 3, outline: 0.5, tex: 0.4, drop: 0.6, boil: 0.25, gloss: 0.4, lite: true });
  }
}

// ------------------------------------------------------------------ candles and altars
export function candle(ctx, x, y, h, fr, seed = 1, o = {}) {
  const on = o.on ?? true;
  if (on) glow(ctx, x, y - h - 6, 46 + Math.sin(fr * 1.3 + seed) * 3, '#ffb65c', 0.5);
  slab(ctx, x - 5, y - h, 10, h, { color: o.color || '#efe4c8', seed: seed + 1, frame: fr, outline: 0.8, wobble: 0.04, square: 3.5 });
  blob(ctx, x + 2, y - h + 2, 2, 5, { color: '#fff4dc', seed: seed + 2, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0, alpha: 0.9 });
  if (on) {
    const lean = Math.sin(fr * 0.9 + seed * 2) * 1.6;
    blob(ctx, x + lean * 0.4, y - h - 6, 3.4, 6.4 + (fr % 2), { color: '#ffd27a', seed: seed + 3, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0, rot: lean * 0.08, boil: 0.3 });
    blob(ctx, x + lean * 0.3, y - h - 4, 1.7, 3.4, { color: '#fff4c8', seed: seed + 4, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0, boil: 0.2 });
  }
}

// Little stepped altar with candles, marigolds and a sugar skull.
export function ofrenda(ctx, x, y, fr, seed = 1, o = {}) {
  const s = o.s ?? 1;
  slab(ctx, x - 52 * s, y - 14 * s, 104 * s, 16 * s, { color: '#6b3f5a', seed: seed + 1, frame: fr, outline: 1 });
  slab(ctx, x - 36 * s, y - 30 * s, 72 * s, 18 * s, { color: '#8a4f6c', seed: seed + 2, frame: fr, outline: 1 });
  // deco trim along the step
  ctx.save();
  ctx.strokeStyle = rgba(DECO_GOLD, 0.75);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - 30 * s, y - 20 * s);
  ctx.lineTo(x + 30 * s, y - 20 * s);
  ctx.stroke();
  ctx.restore();
  candle(ctx, x - 30 * s, y - 30 * s, 22 * s, fr, seed * 3 + 1);
  candle(ctx, x + 30 * s, y - 30 * s, 26 * s, fr, seed * 3 + 2);
  marigold(ctx, x - 14 * s, y - 36 * s, 9 * s, fr, seed * 5 + 1);
  marigold(ctx, x + 12 * s, y - 36 * s, 9 * s, fr, seed * 5 + 2);
  sugarSkull(ctx, x, y - 46 * s, 11 * s, fr, { seed: seed * 7, simple: true });
}

// ------------------------------------------------------------------ sugar skulls
// A clay calavera. `simple` skips the finer decoration for small sizes.
export function sugarSkull(ctx, x, y, s, fr, o = {}) {
  const seed = o.seed ?? 1;
  const bone = o.bone || BONE;
  const hues = o.hues || ['#e8528f', '#2fb8a8'];
  const k = (i) => ({ seed: seed * 23 + i, frame: fr });
  // jaw first, then cranium over it
  blob(ctx, x, y + s * 0.82, s * 0.62, s * 0.34, { color: shade(bone, -0.06), ...k(1), outline: 0.9, boil: 0.3 });
  blob(ctx, x, y, s * 0.98, s * 1.04, { color: bone, ...k(2), outline: 1, wobble: 0.04, gloss: 0.6 });
  // eye sockets ringed with petals
  for (const sx of [-1, 1]) {
    const ex = x + sx * s * 0.4;
    const ey = y + s * 0.02;
    if (!o.simple) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        blob(ctx, ex + Math.cos(a) * s * 0.4, ey + Math.sin(a) * s * 0.42, s * 0.13, s * 0.09, { color: hues[i % 2], ...k(10 + i + (sx > 0 ? 9 : 0)), rot: a, outline: 0.4, tex: 0.3, drop: 0, boil: 0.25, gloss: 0.5, lite: true });
      }
    }
    blob(ctx, ex, ey, s * 0.3, s * 0.34, { color: '#1c1226', ...k(30 + (sx > 0 ? 1 : 0)), flat: true, outline: 0.6, noRim: true, gloss: 0, boil: 0.3 });
    blob(ctx, ex + sx * s * 0.04, ey - s * 0.05, s * 0.09, s * 0.1, { color: '#ffe3a0', ...k(32 + (sx > 0 ? 1 : 0)), flat: true, outline: 0, noRim: true, gloss: 0, boil: 0.2 });
  }
  // nose and teeth
  blob(ctx, x, y + s * 0.4, s * 0.1, s * 0.15, { color: '#1c1226', ...k(40), flat: true, outline: 0, noRim: true, gloss: 0, rot: 0.1, boil: 0.2 });
  ctx.save();
  ctx.strokeStyle = 'rgba(28,18,38,0.75)';
  ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y + s * 0.72);
  ctx.quadraticCurveTo(x, y + s * 0.84 + (fr % 2 ? 0.3 : 0), x + s * 0.5, y + s * 0.72);
  ctx.stroke();
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * s * 0.2, y + s * 0.74);
    ctx.lineTo(x + i * s * 0.2, y + s * 0.92);
    ctx.stroke();
  }
  ctx.restore();
  if (!o.simple) {
    marigold(ctx, x, y - s * 0.62, s * 0.2, fr, seed * 3 + 7);
    for (let i = -1; i <= 1; i += 2) blob(ctx, x + i * s * 0.72, y + s * 0.38, s * 0.1, s * 0.1, { color: hues[i > 0 ? 1 : 0], ...k(50 + i), outline: 0.4, drop: 0, boil: 0.2 });
    for (let i = 0; i < 3; i++) blob(ctx, x - s * 0.2 + i * s * 0.2, y - s * 0.38, s * 0.05, s * 0.05, { color: hues[i % 2], ...k(60 + i), flat: true, outline: 0, noRim: true, gloss: 0, boil: 0.15 });
  }
}

// Subtle skull in the craters of the moon: two sockets, a nose, a row of pits for teeth.
export function moonFace(ctx, x, y, r, fr, seed = 700) {
  const pit = { outline: 0.6, tex: 0.3, noRim: true, gloss: 0, boil: 0.35, drop: 0 };
  for (const sx of [-1, 1]) {
    blob(ctx, x + sx * r * 0.34, y - r * 0.1, r * 0.22, r * 0.26, { color: '#cbb585', seed: seed + 20 + sx, frame: fr, ...pit });
    blob(ctx, x + sx * r * 0.34, y - r * 0.08, r * 0.13, r * 0.16, { color: '#9f8a63', seed: seed + 23 + sx, frame: fr, ...pit, outline: 0 });
    // sugar-skull petals around each socket, very pale
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      blob(ctx, x + sx * r * 0.34 + Math.cos(a) * r * 0.3, y - r * 0.1 + Math.sin(a) * r * 0.33, r * 0.045, r * 0.03, { color: i % 2 ? '#e8a0b8' : '#9fd8cf', alpha: 0.7, seed: seed + 30 + i + sx, frame: fr, rot: a, flat: true, outline: 0, noRim: true, gloss: 0, boil: 0.2 });
    }
  }
  blob(ctx, x, y + r * 0.22, r * 0.07, r * 0.1, { color: '#a69068', seed: seed + 40, frame: fr, ...pit, outline: 0 });
  for (let i = -2; i <= 2; i++) {
    blob(ctx, x + i * r * 0.13, y + r * 0.52 + Math.abs(i) * r * 0.025, r * 0.045, r * 0.07, { color: '#bba679', seed: seed + 50 + i, frame: fr, ...pit });
  }
}

// ------------------------------------------------------------------ neon
export function neonText(ctx, str, x, y, size, color, fr, o = {}) {
  ctx.save();
  ctx.font = `${size}px ${FONT_DECO}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const chars = [...str];
  const track = o.tracking ?? size * 0.08;
  const widths = chars.map((c) => ctx.measureText(c).width + track);
  const total = widths.reduce((a, b) => a + b, 0) - track;
  let cx = o.align === 'left' ? x : o.align === 'right' ? x - total : x - total / 2;
  const mid = cx + total / 2;
  glow(ctx, mid, y, total * 0.6 + size, color, 0.22 * (o.glow ?? 1));
  const dead = o.dead ?? -1;
  const base0 = ctx.globalAlpha;
  chars.forEach((c, i) => {
    // one tired letter stutters on and off
    const lit = i !== dead || hash(fr, i, 4) > 0.55;
    const base = lit ? 1 : 0.18;
    const buzz = 0.92 + hash(fr, i, 7) * 0.08;
    const a = base * buzz;
    ctx.globalAlpha = base0 * a * 0.13;
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.52;
    ctx.strokeText(c, cx, y);
    ctx.globalAlpha = base0 * a * 0.3;
    ctx.lineWidth = size * 0.26;
    ctx.strokeText(c, cx, y);
    ctx.globalAlpha = base0 * a;
    ctx.lineWidth = size * 0.1;
    ctx.strokeStyle = shade(color, 0.15);
    ctx.strokeText(c, cx, y);
    ctx.fillStyle = shade(color, 0.78);
    ctx.fillText(c, cx, y);
    cx += widths[i];
  });
  ctx.restore();
  return total;
}

// A neon sign on a clay board: dark backing, tube border, two brackets.
export function neonSign(ctx, x, y, w, h, str, color, fr, o = {}) {
  slab(ctx, x - w / 2, y - h / 2, w, h, { color: '#2a1c3a', seed: o.seed ?? 8800, frame: fr, outline: 1.2, wobble: 0.02 });
  for (const sx of [-1, 1]) limb(ctx, x + sx * w * 0.32, y + h / 2 - 2, x + sx * w * 0.32, y + h / 2 + 26, 2.6, 2.6, { color: '#3a2a46', seed: (o.seed ?? 8800) + 3 + sx, frame: fr, outline: 0.7 });
  const lit = o.on ?? true;
  if (lit) {
    ctx.save();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = rgba(color, 0.85);
    ctx.lineJoin = 'round';
    const j = (hash(fr, 9) - 0.5) * 0.5;
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + 12, y - h / 2 + 6 + j);
    ctx.lineTo(x + w / 2 - 12, y - h / 2 + 6);
    ctx.lineTo(x + w / 2 - 6, y - h / 2 + 12);
    ctx.lineTo(x + w / 2 - 6, y + h / 2 - 12);
    ctx.lineTo(x + w / 2 - 12, y + h / 2 - 6);
    ctx.lineTo(x - w / 2 + 12, y + h / 2 - 6 + j);
    ctx.lineTo(x - w / 2 + 6, y + h / 2 - 12);
    ctx.lineTo(x - w / 2 + 6, y - h / 2 + 12);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    neonText(ctx, str, x, y + 1, Math.min(h * 0.5, 26), o.textColor || '#ff8fc0', fr, { dead: o.dead });
  }
}

// ------------------------------------------------------------------ atmosphere
// Low drifting fog: soft squashed ellipses that crawl at their own pace.
export function fogBank(ctx, fr, o = {}) {
  const { y = 470, h = 70, n = 7, a = 0.13, color = '#a8d6d4', seed = 3, speed = 0.55, x0 = -240, x1 = 1200 } = o;
  const span = x1 - x0;
  const [r, g, b] = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
  ctx.save();
  for (let i = 0; i < n; i++) {
    const x = x0 + ((hash(seed, i, 1) * span + fr * speed * (0.4 + hash(seed, i, 2) * 1.2)) % span);
    const yy = y + (hash(seed, i, 3) - 0.5) * h;
    const rx = 160 + hash(seed, i, 4) * 170;
    const ry = 20 + hash(seed, i, 5) * 22;
    ctx.save();
    ctx.translate(x, yy);
    ctx.scale(1, ry / rx);
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, `rgba(${r},${g},${b},${a})`);
    gr.addColorStop(0.55, `rgba(${r},${g},${b},${a * 0.5})`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// Slanted beams of light (window slats, a street lamp through venetian blinds).
// Each: { x, y, ang, len, w0, w1, color, a }  ang in radians, 0 = right, PI/2 = down
export function shafts(ctx, list, fr) {
  ctx.save();
  for (const [i, s] of list.entries()) {
    const dx = Math.cos(s.ang);
    const dy = Math.sin(s.ang);
    const nx = -dy;
    const ny = dx;
    const sway = Math.sin(fr * 0.1 + i) * 0.5;
    const x1 = s.x + dx * s.len;
    const y1 = s.y + dy * s.len;
    const g = ctx.createLinearGradient(s.x, s.y, x1, y1);
    const c = s.color || '#ffe8b0';
    g.addColorStop(0, rgba(c, (s.a ?? 0.18) * (0.9 + sway * 0.1)));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(s.x + nx * s.w0 / 2, s.y + ny * s.w0 / 2);
    ctx.lineTo(x1 + nx * s.w1 / 2, y1 + ny * s.w1 / 2);
    ctx.lineTo(x1 - nx * s.w1 / 2, y1 - ny * s.w1 / 2);
    ctx.lineTo(s.x - nx * s.w0 / 2, s.y - ny * s.w0 / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Floating motes lit by a shaft.
export function motes(ctx, fr, o = {}) {
  const { n = 14, x0 = 0, x1 = 960, y0 = 60, y1 = 440, seed = 21, color = '#fff0c8' } = o;
  for (let i = 0; i < n; i++) {
    const x = x0 + hash(seed, i, 1) * (x1 - x0) + Math.sin(fr * 0.15 + i) * 8;
    const y = y0 + ((hash(seed, i, 2) * (y1 - y0) + fr * (0.25 + hash(seed, i, 3) * 0.4)) % (y1 - y0));
    blob(ctx, x, y, 1.5, 1.5, { color, alpha: 0.5, seed: seed * 9 + i, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0, boil: 0.2 });
  }
}

// ------------------------------------------------------------------ art deco trim
// Stepped fan ("sunburst") spreading up from a point: rays, rings, and a gilt rim.
export function decoFan(ctx, x, y, r, fr, o = {}) {
  const n = o.n ?? 13;
  const c1 = o.c1 || DECO_GOLD;
  const c2 = o.c2 || '#c9503f';
  const a0 = o.a0 ?? Math.PI;
  const a1 = o.a1 ?? TAU;
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  const base = ctx.globalAlpha;
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n;
    const t1 = a0 + ((a1 - a0) * (i + 1)) / n;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r * (i % 2 ? 0.86 : 1), t0, t1);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? c2 : c1;
    ctx.globalAlpha = base * 0.5;
    ctx.fill();
    ctx.globalAlpha = base;
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = rgba(c1, 0.7);
    ctx.stroke();
  }
  for (const k of [0.3, 0.55]) {
    ctx.beginPath();
    ctx.arc(x, y, r * k, a0, a1);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = rgba(c1, 0.8);
    ctx.stroke();
  }
  void fr;
  ctx.restore();
}

// Double gilt line inset in a panel, with little diamonds at the corners. Hand-wobbled per frame.
export function decoFrame(ctx, x, y, w, h, fr, o = {}) {
  const inset = o.inset ?? 9;
  const color = o.color || DECO_GOLD;
  const rad = Math.min(o.radius ?? 12, w / 4, h / 4);
  const a = o.alpha ?? 0.7;
  const seed = o.seed ?? 1;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const path = (ins) => {
    const l = x + ins;
    const t = y + ins;
    const rr = x + w - ins;
    const b = y + h - ins;
    const j = (i) => (hash(seed, i, fr) - 0.5) * 0.9;
    ctx.beginPath();
    // chamfered (deco) corners rather than round ones
    ctx.moveTo(l + rad, t + j(1));
    ctx.lineTo(rr - rad, t + j(2));
    ctx.lineTo(rr, t + rad + j(3));
    ctx.lineTo(rr + j(4), b - rad);
    ctx.lineTo(rr - rad, b + j(5));
    ctx.lineTo(l + rad, b + j(6));
    ctx.lineTo(l, b - rad + j(7));
    ctx.lineTo(l + j(8), t + rad);
    ctx.closePath();
  };
  ctx.strokeStyle = rgba(color, a);
  ctx.lineWidth = 1.6;
  path(inset);
  ctx.stroke();
  ctx.strokeStyle = rgba(color, a * 0.55);
  ctx.lineWidth = 1;
  path(inset + 4.5);
  ctx.stroke();
  // corner diamonds
  ctx.fillStyle = rgba(color, Math.min(1, a + 0.2));
  const dm = (cx, cy, s) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s, cy);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx - s, cy);
    ctx.closePath();
    ctx.fill();
  };
  if (o.corners !== false) {
    const s = 2.8;
    dm(x + inset + rad * 0.5, y + inset + rad * 0.5, s);
    dm(x + w - inset - rad * 0.5, y + inset + rad * 0.5, s);
    dm(x + inset + rad * 0.5, y + h - inset - rad * 0.5, s);
    dm(x + w - inset - rad * 0.5, y + h - inset - rad * 0.5, s);
  }
  ctx.restore();
}

// A thin horizontal rule with a diamond in the middle and tapered ends.
export function decoRule(ctx, cx, y, w, fr, o = {}) {
  const color = o.color || DECO_GOLD;
  const a = o.alpha ?? 0.8;
  ctx.save();
  const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(0.2, rgba(color, a));
  g.addColorStop(0.8, rgba(color, a));
  g.addColorStop(1, rgba(color, 0));
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, y);
  ctx.lineTo(cx - 8, y);
  ctx.moveTo(cx + 8, y);
  ctx.lineTo(cx + w / 2, y);
  ctx.stroke();
  ctx.fillStyle = rgba(color, a);
  ctx.beginPath();
  ctx.moveTo(cx, y - 4.5);
  ctx.lineTo(cx + 5, y);
  ctx.lineTo(cx, y + 4.5);
  ctx.lineTo(cx - 5, y);
  ctx.closePath();
  ctx.fill();
  void fr;
  ctx.restore();
}

// The lamps of the room currently on stage ({x, y, r, a} each). The game hands them over after the set is painted, so a
// figure's shadow can swing away from whichever lamp is nearest instead of everyone sharing one fixed angle.
let KEYS = [];
export function setKeyLights(list) {
  KEYS = list || [];
}
// nearest lamp that actually reaches (x, y): { s: -1..1 which side it is on, close: 0..1 how near, d: distance }
function keyFor(x, y) {
  let best = null;
  let bs = Infinity;
  for (const L of KEYS) {
    const reach = (L.r || 120) * (0.7 + (L.a || 0.3));
    const d = Math.hypot(x - L.x, (y - L.y) * 1.3);
    const score = d / reach;
    if (score < bs) {
      bs = score;
      best = { L, d, reach };
    }
  }
  if (!best || bs > 2.2) return null;
  const s = Math.max(-1, Math.min(1, (x - best.L.x) / 70));
  return { s, close: 1 - Math.min(1, bs / 2.2), d: best.d };
}

// Long cast shadow: a thin dark smear dragged along the floor away from the nearest lamp (or the old fixed key light
// when the room has none registered, like the battle backdrops).
export function castShadow(ctx, x, y, rx, fr, o = {}) {
  let len = o.len ?? 2.6;
  let a = o.a ?? 0.28;
  const key = keyFor(x, y);
  let side = 1;
  let off = rx * 0.5;
  if (key) {
    // right under a lamp the shadow pools and shortens; far from it, it stretches away; near a bright one it is darker
    const away = Math.abs(key.s);
    side = key.s >= 0 ? 1 : -1;
    len = Math.max(0.8, len * (0.45 + 0.75 * away + 0.2 * (1 - key.close)));
    a = a * (0.7 + 0.6 * key.close);
    off = rx * 0.5 * key.s;
  }
  ctx.save();
  ctx.translate(x + off, y + 2);
  ctx.scale(side, 1);
  ctx.rotate(0.035 + (hash(fr, 2) - 0.5) * 0.01);
  ctx.scale(1, 0.13);
  const g = ctx.createLinearGradient(-rx * 0.4, 0, rx * len, 0);
  g.addColorStop(0, `rgba(10,4,28,${a})`);
  g.addColorStop(1, 'rgba(10,4,28,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(rx * len * 0.4, 0, rx * len * 0.9, rx * 0.8, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}
