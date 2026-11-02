// Backdrops and set pieces. Each painter draws a whole tabletop diorama out of clay lumps, now as a stack of
// planes (see depth.js): the sky, the far shore, the back wall and the pillars each slide at their own speed when
// the camera moves, the floors run into the picture in perspective, lamps throw pools of light, and a few
// out-of-focus things hang in front of the lens.
// Layout constants are exported so scene hotspots line up with what is painted. Everything that has a hotspot
// stays on the action plane (k = 1) so a tap always lands on what you see.

import { blob, slab, limb, glow, shade, mix, rgba, clayText, shadow, setAmbient } from './clay.js';
import { hash, TAU } from './rng.js';
import { papelPicado, marigold, garland, petals, petalPath, candle, ofrenda, sugarSkull, moonFace, neonSign, fogBank, shafts, motes } from './noir.js';
import { plane, planeShift, haze, bokeh, lightPool, lightWash, streak, ripples, glints, perspRows, trapezoid, farther } from './depth.js';

export const W = 960;
export const H = 540;

// Extra world units of floor to paint below y=540 (tall phones show more floor under the diorama).
let EXT = 0;
export function setStageExtend(px) {
  EXT = Math.max(0, Math.min(400, Math.round(px)));
}

// Each painter registers its lamps here; paintAtmos washes them over the actors after the sprites are down.
let LIT = [];
// the lamps the last painter registered; the game passes them to the shadow code once the set is down
export const lightsNow = () => LIT;
function lamp(x, y, color, r, a) {
  LIT.push({ x, y, color, r, a });
}
// A pool of light on the floor under a lamp (squashed by perspective).
function pool(ctx, fr, x, y, r, color, a) {
  lightPool(ctx, x, y, r, r * 0.17, color, a, fr);
}

// What each set does to the frame: the colour of the bounce light on every lump, and the grade of the shadows/lights.
const BOUNCE = {
  pier: 'rgba(255,128,156,0.21)',
  archive: 'rgba(255,178,96,0.21)',
  chapel: 'rgba(92,232,208,0.18)',
  kiln: 'rgba(255,108,44,0.32)',
  title: 'rgba(255,150,170,0.18)',
};
export const GRADES = {
  pier: { cool: [30, 36, 118], warm: [176, 60, 104] },
  archive: { cool: [26, 32, 104], warm: [176, 112, 42] },
  chapel: { cool: [6, 104, 112], warm: [38, 146, 122] },
  kiln: { cool: [62, 14, 72], warm: [210, 72, 20] },
  title: { cool: [24, 40, 120], warm: [160, 50, 110] },
};

function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [t, c] of stops) g.addColorStop(t, c);
  ctx.fillStyle = g;
  ctx.fillRect(-140, y0, W + 280, y1 - y0);
}

export const LAYOUT = {
  pier: {
    walk: { x0: 50, x1: 915, y0: 418, y1: 522 },
    wall: [300, 334, 224, 74],
    ferry: [46, 316, 214, 86],
    hatch: [500, 458, 96, 42],
    barrel: [838, 418, 64, 62],
    lighthouseDoor: [780, 302, 40, 46],
    keeper: [716, 452],
    ochre: [196, 462],
  },
  archive: {
    walk: { x0: 120, x1: 905, y0: 418, y1: 522 },
    desk: [50, 300, 190, 112],
    panel: [270, 168, 132, 142],
    vault: [445, 118, 222, 296],
    rack: [698, 130, 206, 214],
    jar: [800, 372, 96, 90],
    stairs: [8, 404, 108, 128],
  },
  chapel: {
    walk: { x0: 70, x1: 905, y0: 424, y1: 522 },
    tiles: [226, 354, 482, 610],
    tileY: 150,
    tileW: 112,
    tileH: 142,
    mural: [26, 160, 180, 190],
    gate: [772, 144, 160, 262],
    bowl: [406, 446, 62, 40],
    confessional: [588, 298, 104, 156], // the prop stands on y=452
  },
  kiln: {
    walk: { x0: 110, x1: 850, y0: 440, y1: 522 },
    door: [300, 96, 360, 340],
  },
};

// ------------------------------------------------------------------ shared props
export function stars(ctx, fr, n, ymax, seed = 5) {
  for (let i = 0; i < n; i++) {
    const x = -50 + hash(seed, i, 1) * (W + 100);
    const y = hash(seed, i, 2) * ymax;
    const tw = hash(seed, i, fr >> 1) > 0.18 ? 1 : 0.35;
    blob(ctx, x, y, 1.6 + hash(seed, i, 3) * 1.6, 1.6 + hash(seed, i, 3) * 1.4, { color: '#fff3c9', alpha: 0.85 * tw, seed: i + 300, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0, boil: 0.3 });
  }
}

export function moon(ctx, x, y, r, fr, seed = 700) {
  glow(ctx, x, y, r * 3.2, '#ffe8b0', 0.35);
  blob(ctx, x, y, r, r, { color: '#f6e9c4', seed, frame: fr, gloss: 0.7 });
  // the craters happen to make a face: a calavera moon, watching the harbor
  moonFace(ctx, x, y, r, fr, seed);
}

export function cloud(ctx, x, y, s, color, fr, seed) {
  const parts = [
    [0, 0, 60, 20],
    [-46, 6, 38, 15],
    [44, 8, 42, 16],
    [14, -14, 38, 16],
  ];
  parts.forEach(([dx, dy, rx, ry], i) => blob(ctx, x + dx * s, y + dy * s, rx * s, ry * s, { color, seed: seed + i, frame: fr, outline: 0.8, wobble: 0.06 }));
}

// Rows of wave lumps. Each row is a plane of its own: the far rows barely slide, the near ones slide almost with the pier.
export function waves(ctx, y0, y1, c0, c1, fr, o = {}) {
  const rows = o.rows || 7;
  const gap = (y1 - y0) / rows;
  for (let k = 0; k < rows; k++) {
    const t = k / (rows - 1);
    const y = y0 + k * gap + gap * 0.5;
    const col = mix(c0, c1, t);
    const spacing = 96 + k * 14;
    const dir = k % 2 ? -1 : 1;
    const off = (((fr * (2 + k * 0.6) * dir) % spacing) + spacing) % spacing + planeShift(0.55 + t * 0.4);
    for (let x = -spacing * 1.2 + off; x < W + spacing; x += spacing) {
      const rx = spacing * 0.62;
      blob(ctx, x, y + Math.sin(fr * 0.6 + x * 0.02 + k) * 2, rx, gap * 0.62 + k * 0.5, {
        color: col, seed: 900 + k * 40 + Math.floor((x - off) / spacing) * 3, frame: fr, wobble: 0.08, outline: 0.7, tex: 0.5, occlusion: 0.25,
      });
    }
  }
}

export function lantern(ctx, x, y, fr, on = true, color = '#ffc86a', size = 1) {
  if (on) glow(ctx, x, y, 70 * size + Math.sin(fr * 0.9 + x) * 3, color, 0.55);
  limb(ctx, x, y - 30 * size, x, y - 11 * size, 1.6, 1.6, { color: '#3a2a40', seed: Math.floor(x), frame: fr, outline: 0.6, boil: 0.2 });
  blob(ctx, x, y, 9 * size, 11 * size, { color: on ? shade(color, 0.3) : '#4a3f55', seed: Math.floor(x + y), frame: fr, gloss: 0.8, occlusion: on ? 0.1 : 0.4 });
}

export function bubbles(ctx, fr, n = 14, seed = 4) {
  for (let i = 0; i < n; i++) {
    const t = ((fr * (0.012 + hash(seed, i) * 0.012) + hash(seed, i, 1)) % 1);
    const x = hash(seed, i, 2) * W + Math.sin(fr * 0.4 + i) * 5;
    const y = H - t * (H + 40);
    const r = 2.5 + hash(seed, i, 3) * 6;
    blob(ctx, x, y, r, r, { color: '#bff3f0', alpha: 0.38, seed: seed * 10 + i, frame: fr, flat: true, outline: 0.7, noRim: true, gloss: 0.9, boil: 0.25 });
  }
}

export function dust(ctx, fr, n = 18, seed = 8, color = '#ffe2a0') {
  for (let i = 0; i < n; i++) {
    const x = (hash(seed, i, 1) * W + fr * (0.4 + hash(seed, i, 2) * 0.6)) % W;
    const y = 80 + hash(seed, i, 3) * 340 + Math.sin(fr * 0.3 + i) * 6;
    blob(ctx, x, y, 1.8, 1.8, { color, alpha: 0.5, seed: i + 800, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0, boil: 0.2 });
  }
}

export function embers(ctx, fr, n = 26, seed = 12) {
  for (let i = 0; i < n; i++) {
    const t = ((fr * (0.016 + hash(seed, i) * 0.02) + hash(seed, i, 1)) % 1);
    const x = 120 + hash(seed, i, 2) * 720 + Math.sin(fr * 0.5 + i * 2) * 14;
    const y = 520 - t * 520;
    const r = 1.8 + hash(seed, i, 3) * 3;
    blob(ctx, x, y, r, r, { color: hash(seed, i, 4) < 0.5 ? '#ffb040' : '#ff6a28', alpha: 0.9 * (1 - t), seed: i + 1200, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0, boil: 0.3 });
  }
}

// A hanging chain: alternating links that sway a little, ending where the caller hangs something.
export function chain(ctx, x, y0, y1, fr, seed = 1, color = '#4a4458') {
  const n = Math.max(2, Math.round((y1 - y0) / 11));
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const sway = Math.sin(fr * 0.14 + seed + t * 2.2) * 2.4 * t;
    const flat = i % 2;
    blob(ctx, x + sway, y0 + (i + 0.5) * ((y1 - y0) / n), flat ? 2.2 : 5, flat ? 5.4 : 2.6, { color, seed: seed * 17 + i, frame: fr, outline: 0.6, occlusion: 0.5, boil: 0.25, tex: 0.3 });
  }
}

// A frond of drowned kelp rooted at (x, yBase), leaning and swaying in the current.
export function kelp(ctx, x, yBase, h, fr, seed = 1, lean = 1) {
  const n = Math.max(4, Math.ceil(h / 34));
  let px = x;
  let py = yBase;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const nx = x + lean * t * 24 + Math.sin(fr * 0.17 + seed + i * 0.72) * (3 + t * 13);
    const ny = yBase - t * h;
    const w0 = 9 * (1 - 0.72 * ((i - 1) / n)) + 2;
    const w1 = 9 * (1 - 0.72 * t) + 2;
    limb(ctx, px, py, nx, ny, w0, w1, { color: mix('#0f423e', '#2a8a66', t * 0.9), seed: seed * 13 + i, frame: fr, outline: 0.6, tex: 0.3, occlusion: 0.55, boil: 0.4 });
    px = nx;
    py = ny;
  }
}

// A heap of dark lumps (coal, rubble) with the odd live ember in it.
export function heap(ctx, x, y, w, fr, seed = 1, o = {}) {
  const n = Math.max(4, Math.round(w / 15));
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const px = x + (t - 0.5) * w;
    const r = 11 + hash(seed, i, 1) * 12;
    const py = y - Math.sin(t * Math.PI) * (o.h ?? 18) - hash(seed, i, 2) * 6;
    blob(ctx, px, py, r, r * 0.78, { color: mix(o.dark || '#241418', o.light || '#4a2a2a', hash(seed, i, 3)), seed: seed * 7 + i, frame: fr, wobble: 0.1, outline: 0.7, occlusion: 0.55, tex: 0.35 });
    if (o.embers && hash(seed, i, 4) < 0.55) glow(ctx, px + 2, py - 2, 14, '#ff7a2a', 0.45 + 0.2 * Math.sin(fr * 0.8 + i));
  }
}

// ------------------------------------------------------------------ glyphs (the four signs)
export const GLYPHS = ['mouth', 'hand', 'eye', 'tide'];

export function glyph(ctx, kind, x, y, s, color, fr, seed = 1) {
  const o = (k, extra = {}) => ({ color, seed: seed + k, frame: fr, outline: 1, ...extra });
  if (kind === 'mouth') {
    blob(ctx, x, y - 0.17 * s, 0.56 * s, 0.2 * s, o(1));
    blob(ctx, x, y + 0.16 * s, 0.52 * s, 0.22 * s, o(2));
    blob(ctx, x, y, 0.42 * s, 0.07 * s, { color: '#2a1230', seed: seed + 3, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
  } else if (kind === 'hand') {
    blob(ctx, x, y + 0.16 * s, 0.3 * s, 0.28 * s, o(1));
    for (let i = 0; i < 4; i++) {
      const a = -1.95 + i * 0.42;
      const len = (i === 1 || i === 2 ? 0.62 : 0.5) * s;
      limb(ctx, x + Math.cos(a) * 0.2 * s, y + 0.02 * s + Math.sin(a) * 0.12 * s, x + Math.cos(a) * len, y + 0.02 * s + Math.sin(a) * len, 0.085 * s, 0.065 * s, o(4 + i));
    }
    limb(ctx, x + 0.22 * s, y + 0.2 * s, x + 0.5 * s, y - 0.02 * s, 0.09 * s, 0.07 * s, o(9));
  } else if (kind === 'eye') {
    blob(ctx, x, y, 0.62 * s, 0.3 * s, o(1));
    blob(ctx, x, y, 0.22 * s, 0.24 * s, { color: shade(color, -0.5), seed: seed + 2, frame: fr, outline: 0.8 });
    blob(ctx, x, y, 0.09 * s, 0.14 * s, { color: '#1a0a22', seed: seed + 3, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
  } else if (kind === 'tide') {
    for (let r = 0; r < 3; r++) {
      let px = x - 0.52 * s;
      let py = y + (r - 1) * 0.26 * s;
      for (let i = 1; i <= 8; i++) {
        const nx = x - 0.52 * s + (i / 8) * 1.04 * s;
        const ny = y + (r - 1) * 0.26 * s + Math.sin((i / 8) * TAU + r) * 0.1 * s;
        limb(ctx, px, py, nx, ny, 0.055 * s, 0.055 * s, o(20 + r * 10 + i, { outline: 0.8 }));
        px = nx;
        py = ny;
      }
    }
  }
}

// ------------------------------------------------------------------ sleeper (the drowned god)
export function sleeperFace(ctx, x, y, s, fr, eyeOpen = 0, alpha = 0.55) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  blob(ctx, x, y, 170 * s, 44 * s, { color: '#7596aa', seed: 2201, frame: fr, wobble: 0.05, tex: 0.4 });
  blob(ctx, x, y + 6 * s, 20 * s, 26 * s, { color: '#6a8aa0', seed: 2202, frame: fr, rot: 0, tex: 0.4 }); // nose ridge
  for (const sx of [-1, 1]) {
    blob(ctx, x + sx * 62 * s, y - 6 * s, 42 * s, 13 * s + eyeOpen * 10 * s, { color: '#8fb0c0', seed: 2203 + sx, frame: fr, tex: 0.4 });
    if (eyeOpen > 0.05) {
      blob(ctx, x + sx * 62 * s, y - 6 * s, 26 * s * eyeOpen, 8 * s * eyeOpen, { color: '#ffe9a0', seed: 2210 + sx, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    } else {
      ctx.save();
      ctx.strokeStyle = 'rgba(30,50,70,0.6)';
      ctx.lineWidth = 2.2 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + sx * 62 * s - 30 * s, y - 4 * s);
      ctx.quadraticCurveTo(x + sx * 62 * s, y + 6 * s, x + sx * 62 * s + 30 * s, y - 4 * s);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ PIER
function thumbTile(ctx, x, y, w, h, fr, seed) {
  slab(ctx, x, y, w, h, { color: '#a7a7bb', seed, frame: fr, outline: 0.9, wobble: 0.03, tex: 0.5 });
  ctx.save();
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    ctx.strokeStyle = i % 2 ? 'rgba(40,30,70,0.38)' : 'rgba(255,250,235,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2 + 1, y + h / 2, i * 2.2, i * 2.8, 0.2, 0.3 + i * 0.1, 0.3 + i * 0.1 + Math.PI * 1.6);
    ctx.stroke();
  }
  ctx.restore();
}

const PIER_FOG = '#c98aa4';

export function paintPier(ctx, fr, st = {}) {
  LIT = [];
  setAmbient({ bounce: BOUNCE.pier });
  // sky, moon and clouds: the far planes, barely sliding
  plane(ctx, 0.35, () => {
    vgrad(ctx, 0, 292, [[0, '#1f2060'], [0.5, '#6b3f93'], [0.85, '#d97c7e'], [1, '#f2b78a']]);
    stars(ctx, fr, 46, 190, 5);
    moon(ctx, 690, 104, 54, fr);
  });
  plane(ctx, 0.42, () => {
    cloud(ctx, 220, 150, 1.2, '#7b4c9b', fr, 400);
    cloud(ctx, 880, 168, 1.1, '#7b4c9b', fr, 420);
  });
  plane(ctx, 0.55, () => cloud(ctx, 520, 196, 0.9, '#9a5a9c', fr, 410));
  // festival bunting strung over the harbor (papel picado), nearer than the action so it slides the other way
  plane(ctx, 1.12, () => papelPicado(ctx, -10, 14, 970, 28, 24, fr, { n: 14, w: 36, h: 46, seed: 11 }));
  plane(ctx, 1.06, () => papelPicado(ctx, -10, 132, 440, 118, 16, fr, { n: 7, w: 28, h: 36, seed: 23, alpha: 0.92 }));

  // distant islands, washed toward the horizon glow
  plane(ctx, 0.7, () => {
    blob(ctx, 120, 280, 130, 32, { color: farther('#4a2f6e', PIER_FOG, 0.12), seed: 450, frame: fr, wobble: 0.1 });
    blob(ctx, 470, 284, 90, 20, { color: farther('#52387a', PIER_FOG, 0.2), seed: 451, frame: fr, wobble: 0.1 });
    blob(ctx, 910, 278, 120, 36, { color: farther('#4a2f6e', PIER_FOG, 0.12), seed: 452, frame: fr, wobble: 0.1 });
  });
  haze(ctx, 246, 300, '#f2a07a', 0.34, { peak: 0.8 });
  // the Sleeper, half-sunk in the shallows
  plane(ctx, 0.72, () => sleeperFace(ctx, 330, 292, 1, fr, st.eyeOpen || 0, 0.6));

  // sea: far rows fade into the horizon, near rows are saturated and slide with the pier
  vgrad(ctx, 286, 420, [[0, '#d8896f'], [0.12, '#4a7a9a'], [1, '#1a3d66']]);
  waves(ctx, 288, 412, '#3f93ab', '#1d4a73', fr, { rows: 7 });
  haze(ctx, 286, 340, '#e7a285', 0.3, { peak: 0.15 });
  // moon road, with sparks where the wave tops catch it
  plane(ctx, 0.35, () => {
    for (let i = 0; i < 6; i++) {
      blob(ctx, 690 + Math.sin(fr * 0.5 + i) * 6, 296 + i * 19, 60 - i * 5, 5, { color: '#ffe8b0', alpha: 0.5 - i * 0.05, seed: 460 + i, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    }
    glints(ctx, fr, 610, 770, 298, 392, 14, 7);
  });

  // Broken, hand-painted reflections connect the bright harbour lights to the moving water.
  // Keep them faint and irregular so they read as ripples, not solid mirrored columns.
  streak(ctx, 800, 356, 56, 22, '#ffd27a', 0.18, fr, 481);
  streak(ctx, 128, 378, 34, 18, '#ff6f9f', 0.13, fr, 882);

  // lighthouse on its rock, rings spreading from the foot
  ripples(ctx, 800, 372, 84, 9, fr, { a: 0.32 });
  blob(ctx, 800, 352, 112, 30, { color: '#5a4a6e', seed: 470, frame: fr, wobble: 0.08 });
  const lx = 800;
  const segs = [
    [64, 62, '#f1e6cf'], [58, 56, '#c9503f'], [52, 50, '#f1e6cf'], [46, 44, '#c9503f'], [40, 38, '#f1e6cf'],
  ];
  let ty = 346;
  segs.forEach(([wb, ht, col], i) => {
    slab(ctx, lx - wb / 2, ty - ht * 0.8, wb, ht * 0.9, { color: farther(col, PIER_FOG, 0.1), seed: 480 + i, frame: fr, square: 4, wobble: 0.015 });
    ty -= ht * 0.78;
  });
  glow(ctx, lx, ty - 8, 120, '#ffd27a', 0.5);
  slab(ctx, lx - 28, ty - 30, 56, 30, { color: '#ffe3a0', seed: 490, frame: fr, gloss: 0.8, occlusion: 0.1 });
  blob(ctx, lx, ty - 40, 36, 18, { color: '#4a3a60', seed: 491, frame: fr });
  limb(ctx, lx, ty - 56, lx, ty - 72, 2, 2, { color: '#4a3a60', seed: 492, frame: fr });
  blob(ctx, lx, 326, 17, 22, { color: '#2a1838', seed: 493, frame: fr, outline: 1.2, square: 3.4, flat: true, noRim: true, gloss: 0 }); // door at the base
  blob(ctx, lx + 7, 328, 2.4, 2.4, { color: '#c9a64a', seed: 494, frame: fr, flat: true, outline: 0, noRim: true });
  lamp(lx, ty - 14, '#ffd27a', 300, 0.3);
  // the beam
  ctx.save();
  const bm = ctx.createLinearGradient(lx, ty - 22, lx - 420, ty - 22);
  bm.addColorStop(0, 'rgba(255,230,160,0.28)');
  bm.addColorStop(1, 'rgba(255,230,160,0)');
  ctx.fillStyle = bm;
  ctx.beginPath();
  ctx.moveTo(lx - 20, ty - 26);
  ctx.lineTo(lx - 440, ty - 70);
  ctx.lineTo(lx - 440, ty + 20);
  ctx.lineTo(lx - 20, ty - 14);
  ctx.fill();
  ctx.restore();

  // ferry, with its own wake
  ripples(ctx, 150, 394, 124, 7, fr, { a: 0.3, n: 3 });
  blob(ctx, 150, 394, 100, 14, { color: '#10284e', alpha: 0.55, seed: 500, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
  // hull: a wide soft bowl, prow lifting on the right
  blob(ctx, 150, 372, 98, 24, { color: '#8a3b34', seed: 501, frame: fr, square: 3 });
  blob(ctx, 240, 358, 18, 14, { color: '#8a3b34', seed: 506, frame: fr, rot: -0.4 });
  slab(ctx, 58, 352, 190, 8, { color: '#e5d5b0', seed: 507, frame: fr, outline: 1, noRim: true });
  slab(ctx, 104, 322, 64, 36, { color: '#e5d5b0', seed: 502, frame: fr });
  // a neon sign nobody remembers paying for
  neonSign(ctx, 128, 282, 112, 34, 'FERRY', '#ff4f9a', fr, { seed: 8801, dead: 3 });
  lamp(128, 292, '#ff4f9a', 150, 0.3);
  slab(ctx, 114, 332, 16, 16, { color: '#ffd98a', seed: 503, frame: fr, outline: 0.8, gloss: 0.8 });
  glow(ctx, 122, 340, 34, '#ffc86a', 0.45);
  slab(ctx, 140, 332, 16, 16, { color: '#7fa8c8', seed: 508, frame: fr, outline: 0.8, gloss: 0.8 });
  limb(ctx, 200, 366, 200, 306, 3, 2.4, { color: '#5a3a28', seed: 504, frame: fr });
  blob(ctx, 214 + Math.sin(fr * 0.7) * 3, 314, 15, 8, { color: '#e8c24a', seed: 505, frame: fr, outline: 1 });
  for (let i = 0; i < 5; i++) blob(ctx, 74 + i * 38, 370 + (i % 2) * 6, 6, 6, { color: '#e8c24a', seed: 509 + i, frame: fr, outline: 0.8, gloss: 0.8 });

  // harbor wall with the founders' thumbs
  slab(ctx, 296, 330, 232, 80, { color: '#8a8aa0', seed: 510, frame: fr, wobble: 0.015 });
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 7; c++) thumbTile(ctx, 306 + c * 31, 340 + r * 34, 25, 28, fr, 520 + r * 10 + c);
  }

  // pier floor: planks run into the picture, each row taller and longer than the one behind it
  slab(ctx, -20, 398, W + 40, 160 + EXT, { color: '#6e4b38', seed: 530, frame: fr, wobble: 0.01 });
  const plank = ['#a07652', '#8f6a4b', '#ad8258', '#98704f'];
  for (const { i, y, h, s, t } of perspRows(402, H + EXT + 40, 17, 1.12)) {
    let x = -((i * 61) % Math.round(110 * s)) - 24;
    let c = 0;
    const murk = 0.3 * (1 - Math.min(1, t * 1.7)); // far planks sink into the dusk
    while (x < W + 40) {
      const w = (96 + hash(i, c, 7) * 60) * s;
      slab(ctx, x, y, w - 5 * s, h - 3, { color: farther(plank[(i + c) % 4], '#5a3f62', murk), seed: 540 + i * 20 + c, frame: fr, outline: 1, wobble: 0.025, tex: 0.6 });
      x += w;
      c++;
    }
  }
  // posts + rope
  for (const px of [36, 196, 372, 548, 724, 890]) {
    slab(ctx, px - 9, 380, 18, 40, { color: '#4a3326', seed: 600 + px, frame: fr, outline: 1 });
    blob(ctx, px, 380, 11, 6, { color: '#5e4331', seed: 650 + px, frame: fr, outline: 1 });
  }
  const sag = [36, 196, 372, 548, 724, 890];
  for (let i = 0; i < sag.length - 1; i++) {
    const a = sag[i];
    const b = sag[i + 1];
    limb(ctx, a, 382, (a + b) / 2, 396, 2.2, 2.2, { color: '#cdb98a', seed: 700 + i, frame: fr, outline: 0.6, boil: 0.2 });
    limb(ctx, (a + b) / 2, 396, b, 382, 2.2, 2.2, { color: '#cdb98a', seed: 720 + i, frame: fr, outline: 0.6, boil: 0.2 });
  }
  lantern(ctx, 372, 356, fr, true, '#ffc86a', 0.9);
  lamp(372, 356, '#ffc86a', 230, 0.5);
  // marigold petals dropped on the planks, trailing toward the hatch
  petalPath(ctx, fr, 250, 492, 488, 486, 9, 13);
  // an ofrenda for the founders, in the foreground corner
  ofrenda(ctx, 66, 514, fr, 4, { s: 0.85 });
  lamp(66, 500, '#ffb040', 120, 0.36);

  // hatch (sunken stair)
  const [hx, hy, hw, hh] = LAYOUT.pier.hatch;
  if (st.hatchOpen) {
    slab(ctx, hx, hy, hw, hh, { color: '#0d0618', seed: 760, frame: fr, flat: true, outline: 1.5 });
    glow(ctx, hx + hw / 2, hy + hh / 2, 70, '#7ff0e0', 0.45);
    slab(ctx, hx - 14, hy + hh - 6, hw * 0.45, 12, { color: '#4a3a52', seed: 761, frame: fr, rot: -0.25 });
    lamp(hx + hw / 2, hy + 14, '#7ff0e0', 200, 0.42);
  } else {
    slab(ctx, hx, hy, hw, hh, { color: '#4a3a52', seed: 760, frame: fr });
    for (let i = 0; i < 3; i++) slab(ctx, hx + 6, hy + 6 + i * 12, hw - 12, 6, { color: '#5a4a64', seed: 762 + i, frame: fr, outline: 0.7, noRim: true });
    blob(ctx, hx + hw / 2, hy + hh / 2, 10, 7, { color: '#c9a64a', seed: 770, frame: fr, gloss: 0.8 });
    blob(ctx, hx + hw / 2, hy + hh / 2, 4.4, 3, { color: '#2a1838', seed: 771, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
  }
  // barrel + coil
  const [bx, by] = LAYOUT.pier.barrel;
  blob(ctx, bx + 32, by + 34, 30, 34, { color: '#8a5a3a', seed: 780, frame: fr });
  for (const k of [-16, 0, 16]) slab(ctx, bx + 4, by + 34 + k - 3, 56, 6, { color: '#3a2a30', seed: 781 + k, frame: fr, outline: 0.7, noRim: true, alpha: 0.85 });
  blob(ctx, bx - 18, by + 56, 20, 9, { color: '#cdb98a', seed: 790, frame: fr, outline: 1 });

  // the planks are wet: lamp light lies on them in pools and a long broken streak
  pool(ctx, fr, 372, 458, 210, '#ffc86a', 0.24);
  streak(ctx, 372, 408, 64, 18, '#ffd88a', 0.2, fr, 3);
  pool(ctx, fr, 66, 512, 96, '#ffb040', 0.2);
  if (st.hatchOpen) pool(ctx, fr, hx + hw / 2, hy + hh + 10, 150, '#7ff0e0', 0.22);
}

// ------------------------------------------------------------------ ARCHIVE
export function paintArchive(ctx, fr, st = {}) {
  LIT = [];
  setAmbient({ bounce: BOUNCE.archive });
  // the back wall is a plane of its own, with tall windows high up where the shafts of light begin
  plane(ctx, 0.8, () => {
    vgrad(ctx, 0, 420, [[0, '#1c1530'], [1, '#33274a']]);
    slab(ctx, -70, 0, W + 140, 420, { color: '#46385f', seed: 1001, frame: fr, wobble: 0.004, outline: 0, occlusion: 0.5 });
    // wall stones
    for (let r = 0; r < 7; r++) {
      for (let c = -1; c < 12; c++) {
        slab(ctx, c * 92 - (r % 2) * 46, 10 + r * 58, 86, 52, { color: hash(r, c, 3) < 0.5 ? '#4f4068' : '#42355a', seed: 1010 + r * 14 + c + 1, frame: fr, alpha: 0.55, outline: 0.7, tex: 0.3, noRim: true });
      }
    }
    // clerestory windows: the night outside, and where each shaft starts
    for (const wx of [150, 330, 720]) {
      blob(ctx, wx, 34, 17, 30, { color: '#9fb8ff', seed: 1090 + wx, frame: fr, square: 3, outline: 1.1, gloss: 0.5, occlusion: 0.1 });
      glow(ctx, wx, 36, 64, '#cfe4ff', 0.4);
      slab(ctx, wx - 1.5, 6, 3, 60, { color: '#2a2036', seed: 1095 + wx, frame: fr, outline: 0.4, noRim: true, tex: 0 });
      lamp(wx, 46, '#cfe4ff', 230, 0.2);
    }
  });
  // the wall sits back in the dark
  haze(ctx, 20, 424, '#2b2144', 0.3, { peak: 0.35, fade: false });

  // arches + pillars, one step nearer the lens than the wall
  plane(ctx, 0.92, () => {
    for (const px of [96, 380, 640, 880]) {
      slab(ctx, px - 28, 40, 56, 380, { color: '#5b4a77', seed: 1200 + px, frame: fr, wobble: 0.01 });
      blob(ctx, px, 40, 40, 16, { color: '#6a5888', seed: 1300 + px, frame: fr });
      blob(ctx, px, 420, 44, 14, { color: '#6a5888', seed: 1400 + px, frame: fr });
    }
    // bunting between the pillars, a dusty remnant of some long-ago feast day
    papelPicado(ctx, 96, 52, 380, 58, 20, fr, { n: 7, w: 28, h: 36, seed: 31, alpha: 0.9 });
    papelPicado(ctx, 380, 58, 640, 52, 18, fr, { n: 6, w: 28, h: 36, seed: 37, alpha: 0.9 });
    papelPicado(ctx, 640, 52, 880, 58, 18, fr, { n: 6, w: 28, h: 36, seed: 41, alpha: 0.9 });
  });
  // hanging lanterns
  [[220, 150], [560, 90], [790, 120]].forEach(([x, y], i) => {
    limb(ctx, x, 0, x, y - 28, 1.4, 1.4, { color: '#2a2036', seed: 1500 + i, frame: fr, boil: 0.2, outline: 0.5 });
    lantern(ctx, x, y, fr, true, '#ffb65c', 1);
    lamp(x, y, '#ffb65c', 220, 0.42);
  });

  // desk + ledger (left)
  const [dx, dy, dw, dh] = LAYOUT.archive.desk;
  slab(ctx, dx, dy + 44, dw, 18, { color: '#7a5540', seed: 1600, frame: fr });
  slab(ctx, dx + 14, dy + 58, 18, dh - 56, { color: '#5e4331', seed: 1601, frame: fr });
  slab(ctx, dx + dw - 32, dy + 58, 18, dh - 56, { color: '#5e4331', seed: 1602, frame: fr });
  blob(ctx, dx + 74, dy + 38, 40, 9, { color: '#e8d7ae', seed: 1603, frame: fr, outline: 1 });
  blob(ctx, dx + 74, dy + 33, 36, 8, { color: '#f1e4c0', seed: 1604, frame: fr, outline: 1 });
  glow(ctx, dx + 150, dy + 22, 60, '#ffb65c', 0.5);
  slab(ctx, dx + 144, dy + 24, 10, 20, { color: '#efe4c8', seed: 1605, frame: fr, outline: 0.8 });
  blob(ctx, dx + 149, dy + 20 + Math.sin(fr) * 0.6, 3.6, 6, { color: '#ffd27a', seed: 1606, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
  lamp(dx + 149, dy + 20, '#ffb65c', 150, 0.4);

  // lamp panel
  const [px, py, pw, ph] = LAYOUT.archive.panel;
  slab(ctx, px, py, pw, ph, { color: '#6d7380', seed: 1700, frame: fr });
  for (let i = 0; i < 9; i++) {
    const cx = px + 26 + (i % 3) * 40;
    const cy = py + 30 + Math.floor(i / 3) * 40;
    const on = st.lamps ? st.lamps[i] : i % 2 === 0;
    if (on) glow(ctx, cx, cy, 40, '#ffd98a', 0.5);
    blob(ctx, cx, cy, 14, 14, { color: on ? '#ffe3a0' : '#3d3350', seed: 1710 + i, frame: fr, gloss: on ? 0.9 : 0.3, occlusion: on ? 0.08 : 0.4 });
    if (!on) blob(ctx, cx, cy, 6, 6, { color: '#2a2238', alpha: 0.6, seed: 1730 + i, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
  }

  // vault door
  const [vx, vy, vw, vh] = LAYOUT.archive.vault;
  const vcx = vx + vw / 2;
  const vcy = vy + vh / 2;
  blob(ctx, vcx, vcy, vw / 2 + 12, vh / 2 + 10, { color: '#5b6070', seed: 1800, frame: fr, wobble: 0.015, square: 2.4 });
  if (st.vaultOpen) {
    blob(ctx, vcx, vcy, vw / 2 - 8, vh / 2 - 8, { color: '#06121c', seed: 1801, frame: fr, flat: true, outline: 1.4, noRim: true, gloss: 0, square: 2.4 });
    glow(ctx, vcx, vcy + 20, 150, '#5fe0d8', 0.5);
    for (let i = 0; i < 5; i++) slab(ctx, vcx - 50 + i * 3, vcy + 90 - i * 18, 100 - i * 6, 14, { color: '#3a5a66', seed: 1810 + i, frame: fr, alpha: 0.9, outline: 0.7, noRim: true });
    blob(ctx, vx + 18, vcy, 22, vh / 2 - 12, { color: '#6d7380', seed: 1820, frame: fr, wobble: 0.02, square: 3 });
    lamp(vcx, vcy + 60, '#5fe0d8', 300, 0.42);
  } else {
    blob(ctx, vcx, vcy, vw / 2 - 8, vh / 2 - 8, { color: '#6d7380', seed: 1801, frame: fr, wobble: 0.015, square: 2.4 });
    for (let i = 1; i <= 3; i++) {
      blob(ctx, vcx, vcy, vw / 2 - 8 - i * 20, vh / 2 - 8 - i * 22, { color: i % 2 ? '#5e6474' : '#767c8a', seed: 1802 + i, frame: fr, outline: 1.2, noRim: i > 1, alpha: 0.9, square: 2.4, wobble: 0.01 });
    }
    // thumb-shaped keyhole
    blob(ctx, vcx, vcy, 24, 32, { color: '#2a2036', seed: 1830, frame: fr, flat: true, outline: 1.2, noRim: true, gloss: 0 });
    ctx.save();
    ctx.lineWidth = 1.1;
    for (let i = 1; i < 6; i++) {
      ctx.strokeStyle = 'rgba(180,170,210,0.35)';
      ctx.beginPath();
      ctx.ellipse(vcx, vcy + 2, i * 3.3, i * 4.5, 0, 0.3, 0.3 + Math.PI * 1.7);
      ctx.stroke();
    }
    ctx.restore();
    // barred glow when all lamps lit but not open yet
    if (st.lamps && st.lamps.every(Boolean)) {
      glow(ctx, vcx, vcy, 120, '#7ff0e0', 0.35);
      lamp(vcx, vcy, '#7ff0e0', 260, 0.3);
    }
  }

  // a stone calavera keystone over the vault
  sugarSkull(ctx, vcx, vy - 2, 15, fr, { seed: 61, bone: '#cfc8d8', hues: ['#8a64d8', '#2fb8a8'] });

  // tablet rack
  const [rx, ry, rw, rh] = LAYOUT.archive.rack;
  slab(ctx, rx, ry, rw, rh, { color: '#3a2d4f', seed: 1900, frame: fr });
  for (let r = 0; r < 3; r++) {
    slab(ctx, rx + 6, ry + 62 + r * 68, rw - 12, 8, { color: '#6a5540', seed: 1910 + r, frame: fr, outline: 0.8, noRim: true });
    for (let c = 0; c < 4; c++) {
      const lit = r === 1 && c === 2;
      if (lit) glow(ctx, rx + 18 + c * 48 + 20, ry + 30 + r * 68 + 18, 50, '#7ff0e0', 0.45);
      slab(ctx, rx + 14 + c * 48, ry + 16 + r * 68, 40, 46, { color: lit ? '#bfe9e3' : ['#b9a58a', '#a8957a', '#c4b296'][(r + c) % 3], seed: 1920 + r * 5 + c, frame: fr, outline: 0.9, tex: 0.5 });
      for (let l = 0; l < 3; l++) slab(ctx, rx + 20 + c * 48, ry + 24 + r * 68 + l * 11, 26 - (l % 2) * 8, 3.4, { color: '#5a4636', seed: 1960 + r * 20 + c * 4 + l, frame: fr, alpha: 0.7, outline: 0, noRim: true, tex: 0 });
    }
  }

  // floor: flagstones run into the picture, rows growing toward the lens
  slab(ctx, -20, 412, W + 40, 160 + EXT, { color: '#3d3150', seed: 2000, frame: fr, wobble: 0.01 });
  for (const { i, y, h, s, t } of perspRows(416, H + EXT + 40, 22, 1.14)) {
    const tw = 106 * s;
    const murk = 0.34 * (1 - Math.min(1, t * 1.6));
    for (let c = -1; c * 112 * s - (i % 2) * 56 * s < W + 60; c++) {
      slab(ctx, c * 112 * s - (i % 2) * 56 * s, y, tw, h - 4, { color: farther(hash(i, c, 9) < 0.5 ? '#4a3d60' : '#3f3354', '#2a2040', murk), seed: 2010 + i * 10 + ((c + 3) % 12), frame: fr, alpha: 0.8, outline: 0.7, tex: 0.5, noRim: true });
    }
  }
  // the runner narrows toward the vault, so the room has a far end
  const rcx = 492;
  const half = (y) => 98 + (y - 420) * 0.5;
  const yb = H + EXT + 30;
  trapezoid(ctx, rcx - half(420), rcx + half(420), 420, rcx - half(yb), rcx + half(yb), yb, { color: '#7a3a45', seed: 2100, frame: fr, alpha: 0.88, outline: 1 });
  trapezoid(ctx, rcx - half(420) + 14, rcx + half(420) - 14, 424, rcx - half(yb) + 22, rcx + half(yb) - 22, yb, { color: '#8e4a55', seed: 2101, frame: fr, alpha: 0.6, outline: 0.8, noRim: true });
  ctx.save();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = rgba('#d9b25a', 0.45);
  for (const sg of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(rcx + sg * (half(420) - 7), 424);
    ctx.lineTo(rcx + sg * (half(yb) - 11), yb);
    ctx.stroke();
  }
  ctx.fillStyle = rgba('#d9b25a', 0.55);
  for (let y = 438; y < yb - 10; ) {
    const s = 1 + (y - 420) / 190;
    ctx.beginPath();
    ctx.moveTo(rcx, y - 7 * s);
    ctx.lineTo(rcx + 10 * s, y);
    ctx.lineTo(rcx, y + 7 * s);
    ctx.lineTo(rcx - 10 * s, y);
    ctx.closePath();
    ctx.fill();
    y += 38 * s;
  }
  ctx.restore();

  // stairs up (bottom-left)
  for (let i = 0; i < 4; i++) slab(ctx, 6 + i * 6, 420 + i * 26, 118 - i * 6, 28, { color: ['#5e4f78', '#6a5a84', '#76668f', '#82729a'][i], seed: 2200 + i, frame: fr, outline: 1 });

  // jar with something inside
  const [jx, jy, jw, jh] = LAYOUT.archive.jar;
  if (st.jarBroken) {
    for (let i = 0; i < 5; i++) blob(ctx, jx + 14 + i * 16, jy + jh - 8 - (i % 2) * 5, 11, 6, { color: '#a86a45', seed: 2300 + i, frame: fr, rot: (i - 2) * 0.4, outline: 1 });
  } else {
    blob(ctx, jx + jw / 2, jy + jh / 2 + 6, jw * 0.46, jh * 0.54, { color: '#a86a45', seed: 2300, frame: fr });
    slab(ctx, jx + 22, jy - 4, jw - 44, 14, { color: '#8a5434', seed: 2301, frame: fr });
    const blinkOn = fr % 14 < 12;
    if (blinkOn) {
      glow(ctx, jx + jw / 2, jy + jh / 2, 50, '#7ff0d0', 0.35);
      eyeDot(ctx, jx + jw / 2 - 12, jy + jh / 2, fr, 2310);
      eyeDot(ctx, jx + jw / 2 + 12, jy + jh / 2, fr, 2311);
    }
    // wax seal in the Guild's colour
    blob(ctx, jx + jw / 2, jy + 22, 9, 7, { color: '#c9503f', seed: 2320, frame: fr, outline: 1, gloss: 0.8 });
  }

  // each lantern lights the flagstones under it; the vault, when open, lights the runner teal
  pool(ctx, fr, 220, 478, 150, '#ffb65c', 0.2);
  pool(ctx, fr, 560, 470, 200, '#ffb65c', 0.24);
  pool(ctx, fr, 790, 486, 150, '#ffb65c', 0.2);
  pool(ctx, fr, dx + 130, 440, 90, '#ffb65c', 0.16);
  if (st.vaultOpen) pool(ctx, fr, vcx, 470, 190, '#5fe0d8', 0.26);

  dust(ctx, fr, 20, 8);
}

function eyeDot(ctx, x, y, fr, seed) {
  blob(ctx, x, y, 5, 6, { color: '#e8fff0', seed, frame: fr, outline: 0.6, flat: true, noRim: true, gloss: 0.2 });
  blob(ctx, x + 1, y, 2.4, 3.2, { color: '#1a0a22', seed: seed + 1, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
}

// ------------------------------------------------------------------ CHAPEL
export const CHAPEL_LAYOUT = ['eye', 'tide', 'mouth', 'hand']; // left -> right on the wall

export function paintChapel(ctx, fr, st = {}) {
  LIT = [];
  setAmbient({ bounce: BOUNCE.chapel });
  // water, and light shafts from the surface, far back
  plane(ctx, 0.5, () => {
    vgrad(ctx, 0, H, [[0, '#0d4350'], [0.55, '#0a2c44'], [1, '#08182e']]);
    for (let i = 0; i < 5; i++) {
      const sx = 110 + i * 190 + Math.sin(fr * 0.12 + i) * 14;
      ctx.save();
      const g = ctx.createLinearGradient(sx, 0, sx + 60, 440);
      g.addColorStop(0, 'rgba(180,255,240,0.16)');
      g.addColorStop(1, 'rgba(180,255,240,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx - 30, 0);
      ctx.lineTo(sx + 40, 0);
      ctx.lineTo(sx + 130, 440);
      ctx.lineTo(sx - 70, 440);
      ctx.fill();
      ctx.restore();
    }
  });
  // back wall + great arch, with more chapel receding through it
  plane(ctx, 0.8, () => {
    slab(ctx, -70, 60, W + 140, 360, { color: '#1f5a62', seed: 3001, frame: fr, wobble: 0.004, outline: 0, occlusion: 0.5, alpha: 0.9 });
    blob(ctx, 480, 232, 330, 190, { color: '#18484f', seed: 3002, frame: fr, square: 3, wobble: 0.015, occlusion: 0.5 });
  });
  // the nave beyond the arch: three nested arches and a far lit doorway, on their own slow plane, clipped to the opening
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(480, 232, 318, 180, 0, 0, TAU);
  ctx.clip();
  plane(ctx, 0.62, () => {
    blob(ctx, 480, 240, 300, 172, { color: '#0e3a46', seed: 3040, frame: fr, square: 3, wobble: 0.012, occlusion: 0.4, outline: 0.8 });
    blob(ctx, 480, 252, 230, 130, { color: '#0b3040', seed: 3041, frame: fr, square: 3, wobble: 0.012, occlusion: 0.4, outline: 0.8 });
    blob(ctx, 480, 266, 150, 88, { color: '#082634', seed: 3042, frame: fr, square: 3, wobble: 0.012, occlusion: 0.4, outline: 0.8 });
    blob(ctx, 480, 300, 40, 52, { color: '#165a62', seed: 3043, frame: fr, square: 3, outline: 0.8, occlusion: 0.2 });
    glow(ctx, 480, 300, 96, '#7fd8d0', 0.32);
  });
  ctx.restore();
  // murk: the wall and the nave sit in green water
  haze(ctx, 50, 440, '#0b3340', 0.32, { peak: 0.45 });

  // columns, one plane nearer
  plane(ctx, 0.92, () => {
    for (const cx of [74, 178, 748]) {
      slab(ctx, cx - 26, 40, 52, 400, { color: '#2f7a74', seed: 3100 + cx, frame: fr, wobble: 0.012 });
      for (let k = 0; k < 7; k++) blob(ctx, cx - 18 + hash(cx, k) * 36, 60 + k * 54 + hash(cx, k, 1) * 18, 5 + hash(cx, k, 2) * 4, 4, { color: '#4a9a58', alpha: 0.7, seed: 3150 + cx + k, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
      // Small pale barnacles cling to the shadow side of each drowned column.
      for (let k = 0; k < 3; k++) {
        const side = k % 2 ? 1 : -1;
        const bx = cx + side * (18 + (k % 2) * 5);
        const by = 306 + k * 34 + hash(cx, k, 7) * 10;
        blob(ctx, bx, by, 7, 5, { color: '#9ac5ae', seed: 3260 + cx + k, frame: fr, alpha: 0.78, outline: 0.4, tex: 0.25 });
        blob(ctx, bx + side * 5, by - 4, 4, 3, { color: '#c4d8b6', seed: 3270 + cx + k, frame: fr, alpha: 0.72, outline: 0, gloss: 0 });
      }
      blob(ctx, cx, 44, 38, 14, { color: '#3a8a82', seed: 3200 + cx, frame: fr });
      blob(ctx, cx, 438, 40, 13, { color: '#3a8a82', seed: 3250 + cx, frame: fr });
    }
    // drowned marigold garland across the glyph wall
    garland(ctx, 178, 64, 748, 64, 34, fr, { n: 14, r: 10, seed: 71 });
  });

  // mural (left)
  const [mx, my, mw, mh] = LAYOUT.chapel.mural;
  slab(ctx, mx, my, mw, mh, { color: '#2b6f70', seed: 3300, frame: fr });
  slab(ctx, mx + 8, my + 8, mw - 16, mh - 16, { color: '#c9b78a', seed: 3301, frame: fr, outline: 1, alpha: 0.9 });
  // tide chart: sun, then a long fall of the wave line, then a face under it
  blob(ctx, mx + 36, my + 40, 15, 15, { color: '#e8b84a', seed: 3302, frame: fr, outline: 1 });
  let px = mx + 20;
  let py = my + 98;
  for (let i = 1; i <= 12; i++) {
    const nx = mx + 20 + i * 12.2;
    const ny = my + 98 + Math.sin(i * 0.9) * 8 + (i > 6 ? (i - 6) * 7 : 0);
    limb(ctx, px, py, nx, ny, 3, 3, { color: '#2b6f70', seed: 3310 + i, frame: fr, outline: 0.6, boil: 0.3 });
    px = nx;
    py = ny;
  }
  blob(ctx, mx + 90, my + 154, 40, 13, { color: '#7596aa', seed: 3330, frame: fr, outline: 1 });
  for (const s of [-1, 1]) blob(ctx, mx + 90 + s * 18, my + 150, 11, 5, { color: '#8fb0c0', seed: 3331 + s, frame: fr, outline: 0.8 });

  // glyph wall
  const { tiles, tileY, tileW, tileH } = LAYOUT.chapel;
  const prog = st.progress || 0;
  const pressed = st.pressed || [];
  tiles.forEach((tx, i) => {
    const kind = CHAPEL_LAYOUT[i];
    const lit = pressed.includes(kind) || st.solved;
    if (lit) {
      glow(ctx, tx + tileW / 2, tileY + tileH / 2, 110, '#ffe39a', 0.5);
      lamp(tx + tileW / 2, tileY + tileH / 2, '#ffe39a', 190, 0.3);
    }
    slab(ctx, tx, tileY, tileW, tileH, { color: lit ? '#6a8f7a' : '#3d6f75', seed: 3400 + i, frame: fr, outline: 1.3 });
    slab(ctx, tx + 8, tileY + 8, tileW - 16, tileH - 16, { color: lit ? '#86ab90' : '#2f5f66', seed: 3410 + i, frame: fr, alpha: 0.7, outline: 0.8, noRim: true });
    glyph(ctx, kind, tx + tileW / 2, tileY + tileH / 2, 66, lit ? '#fff0b8' : '#c9e8dc', fr, 3420 + i * 40);
  });
  void prog;

  // gate (right)
  const [gx, gy, gw, gh] = LAYOUT.chapel.gate;
  if (st.gateOpen) {
    slab(ctx, gx, gy, gw, gh, { color: '#1a0a10', seed: 3500, frame: fr, flat: true, outline: 1.5 });
    glow(ctx, gx + gw / 2, gy + gh * 0.6, 190, '#ff7a2a', 0.8);
    slab(ctx, gx - 8, gy, 36, gh, { color: '#5a4a6a', seed: 3501, frame: fr });
    lamp(gx + gw / 2, gy + gh * 0.6, '#ff7a2a', 340, 0.5);
  } else {
    slab(ctx, gx, gy, gw, gh, { color: '#5a4a6a', seed: 3500, frame: fr });
    slab(ctx, gx + 10, gy + 10, gw - 20, gh - 20, { color: '#6d5c80', seed: 3501, frame: fr, outline: 1, noRim: true, alpha: 0.9 });
    for (let i = 0; i < 3; i++) glow(ctx, gx + gw / 2, gy + 60 + i * 70, 26, '#ff7a2a', 0.28);
    // a kiln-shaped seal
    blob(ctx, gx + gw / 2, gy + gh / 2, 34, 40, { color: '#3a2d4f', seed: 3510, frame: fr, outline: 1.2 });
    blob(ctx, gx + gw / 2, gy + gh / 2 + 8, 15, 17, { color: '#120818', seed: 3511, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    glow(ctx, gx + gw / 2, gy + gh / 2 + 8, 30, '#ff7a2a', 0.5);
    lamp(gx + gw / 2, gy + gh / 2 + 8, '#ff7a2a', 150, 0.26);
  }

  // floor: tiles run into the picture
  slab(ctx, -20, 436, W + 40, 130 + EXT, { color: '#1d5560', seed: 3600, frame: fr, wobble: 0.01 });
  for (const { i, y, h, s, t } of perspRows(440, H + EXT + 40, 22, 1.15)) {
    const tw = 106 * s;
    const murk = 0.36 * (1 - Math.min(1, t * 1.6));
    for (let c = -1; c * 112 * s - (i % 2) * 56 * s < W + 60; c++) {
      slab(ctx, c * 112 * s - (i % 2) * 56 * s, y, tw, h - 4, { color: farther(hash(i, c, 5) < 0.5 ? '#256a72' : '#1f5c66', '#0b3340', murk), seed: 3610 + i * 10 + ((c + 3) % 12), frame: fr, alpha: 0.8, outline: 0.7, tex: 0.5, noRim: true });
    }
  }
  // caustics: rippling light cast on the floor by the water above, wider apart the nearer they are
  ctx.save();
  ctx.strokeStyle = 'rgba(190,255,240,0.14)';
  ctx.lineWidth = 2;
  perspRows(448, H + EXT, 20, 1.15).forEach(({ i, y, s }) => {
    ctx.beginPath();
    for (let x = -40; x <= W + 40; x += 30) {
      const yy = y + Math.sin(x * 0.03 / Math.sqrt(s) + fr * 0.5 + i * 2) * 6 * s;
      if (x === -40) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  });
  ctx.restore();

  // candles still burning down here, and flowers
  candle(ctx, 372, 492, 24, fr, 91);
  candle(ctx, 502, 494, 30, fr, 92);
  marigold(ctx, 352, 494, 9, fr, 93);
  marigold(ctx, 524, 496, 9, fr, 94);
  marigold(ctx, 388, 500, 7, fr, 95);
  lamp(372, 478, '#ffb65c', 120, 0.34);
  lamp(502, 474, '#ffb65c', 130, 0.36);

  // offering bowl
  const [bx, by, bw, bh] = LAYOUT.chapel.bowl;
  blob(ctx, bx + bw / 2, by + bh * 0.6, bw / 2, bh * 0.5, { color: '#b9744a', seed: 3700, frame: fr });
  blob(ctx, bx + bw / 2, by + bh * 0.38, bw * 0.4, bh * 0.16, { color: '#3a2d4f', seed: 3701, frame: fr, flat: true, outline: 0.8, noRim: true, gloss: 0 });
  if (!st.bowlTaken) {
    glow(ctx, bx + bw / 2, by + 8, 36, '#ffc86a', 0.4);
    blob(ctx, bx + bw / 2, by + 8, 6, 8, { color: '#ffd27a', seed: 3702, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
  }

  // fish silhouettes drifting past the arch, in the middle distance
  plane(ctx, 0.7, () => {
    for (let i = 0; i < 4; i++) {
      const fx = ((fr * (1.2 + i * 0.5) + i * 260) % (W + 200)) - 100;
      const fy = 80 + i * 34 + Math.sin(fr * 0.3 + i) * 5;
      blob(ctx, fx, fy, 16, 6, { color: '#0b2f40', alpha: 0.6, seed: 3800 + i, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
      blob(ctx, fx - 17, fy, 7, 6, { color: '#0b2f40', alpha: 0.6, seed: 3810 + i, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0, rot: 0.6 });
    }
  });
  bubbles(ctx, fr, 16, 4);

  pool(ctx, fr, 372, 496, 100, '#ffb65c', 0.22);
  pool(ctx, fr, 502, 498, 110, '#ffb65c', 0.22);
  if (st.gateOpen) pool(ctx, fr, gx + gw / 2 - 40, 470, 220, '#ff7a2a', 0.3);
}

// ------------------------------------------------------------------ KILN
export function paintKiln(ctx, fr, st = {}) {
  LIT = [];
  setAmbient({ bounce: BOUNCE.kiln });
  plane(ctx, 0.8, () => {
    vgrad(ctx, 0, H, [[0, '#1a0a14'], [0.6, '#3a1418'], [1, '#2a0f14']]);
    glow(ctx, 480, 300, 520, '#ff5a1a', 0.22);
    // brick wall
    for (let r = 0; r < 9; r++) {
      for (let c = -1; c < 14; c++) {
        slab(ctx, c * 80 - (r % 2) * 40 - 10, r * 52 - 6, 74, 46, { color: hash(r, c, 2) < 0.5 ? '#5a2a26' : '#4a2022', seed: 4000 + r * 15 + c + 1, frame: fr, alpha: 0.7, outline: 0.7, tex: 0.4, noRim: true });
      }
    }
  });
  // heat shimmers off the wall
  haze(ctx, 60, 440, '#ff6a2a', 0.1, { peak: 0.7 });
  // arch frame
  const [dx, dy, dw, dh] = LAYOUT.kiln.door;
  blob(ctx, dx + dw / 2, dy + dh / 2 + 6, dw / 2 + 36, dh / 2 + 28, { color: '#7a3a2b', seed: 4200, frame: fr, square: 3.2, wobble: 0.015 });
  if (st.open) {
    blob(ctx, dx + dw / 2, dy + dh / 2 + 6, dw / 2 - 6, dh / 2 - 4, { color: '#0a0610', seed: 4201, frame: fr, square: 3.2, flat: true, outline: 1.5, noRim: true, gloss: 0 });
    // the Sleeper's eye, finally looking
    const e = st.eye ?? 0;
    const ex = dx + dw / 2;
    const ey = dy + dh / 2;
    glow(ctx, ex, ey, 220, '#ffe9a0', 0.25 + e * 0.35);
    blob(ctx, ex, ey, 130, 20 + e * 70, { color: '#d8e4ea', seed: 4210, frame: fr, wobble: 0.03 });
    blob(ctx, ex, ey, 48 * Math.min(1, e + 0.2), 20 + e * 62, { color: '#e8b84a', seed: 4211, frame: fr, outline: 1 });
    blob(ctx, ex, ey, 14, 12 + e * 48, { color: '#120810', seed: 4212, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    blob(ctx, ex, ey - 12 - e * 36, 140, 22, { color: '#8fa7b4', seed: 4213, frame: fr, alpha: 1 - e * 0.5 });
    lamp(ex, ey, '#ffe9a0', 420, 0.2 + e * 0.35);
  } else {
    blob(ctx, dx + dw / 2, dy + dh / 2 + 6, dw / 2 - 6, dh / 2 - 4, { color: '#8a4a38', seed: 4201, frame: fr, square: 3.2, wobble: 0.015 });
    for (let i = 0; i < 4; i++) {
      slab(ctx, dx + 40, dy + 44 + i * 70, dw - 80, 10, { color: '#5a2a26', seed: 4220 + i, frame: fr, outline: 1, alpha: 0.9 });
    }
    glow(ctx, dx + dw / 2, dy + dh / 2 + 20, 180, '#ff7a2a', 0.5 + Math.sin(fr * 0.9) * 0.05);
    glow(ctx, dx + dw / 2, dy + dh / 2, 120, '#ffd060', 0.5 + Math.sin(fr * 0.9) * 0.05);
    // rivets around the hatch, and a chimney so it reads as a kiln
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      blob(ctx, dx + dw / 2 + Math.cos(a) * (dw / 2 - 20), dy + dh / 2 + 6 + Math.sin(a) * (dh / 2 - 18), 5, 5, { color: '#b9743f', seed: 4260 + i, frame: fr, outline: 0.8, gloss: 0.9 });
    }
    slab(ctx, dx + dw / 2 - 30, dy - 60, 60, 52, { color: '#6a2f26', seed: 4250, frame: fr });
    // thumb-shaped lock
    blob(ctx, dx + dw / 2, dy + dh / 2 + 10, 40, 52, { color: '#3a1a1c', seed: 4240, frame: fr, outline: 1.4 });
    ctx.save();
    ctx.lineWidth = 1.2;
    for (let i = 1; i < 8; i++) {
      ctx.strokeStyle = 'rgba(255,170,90,0.4)';
      ctx.beginPath();
      ctx.ellipse(dx + dw / 2, dy + dh / 2 + 12, i * 4.2, i * 5.6, 0, 0.3, 0.3 + Math.PI * 1.7);
      ctx.stroke();
    }
    ctx.restore();
    lamp(dx + dw / 2, dy + dh / 2 + 20, '#ff7a2a', 440, 0.4);
  }
  // marigolds draped over the kiln arch
  garland(ctx, dx - 20, dy + 24, dx + dw + 20, dy + 24, 36, fr, { n: 12, r: 12, seed: 81 });
  // floor of dark kiln-tile, running into the picture, with glowing cracks
  slab(ctx, -20, 436, W + 40, 130 + EXT, { color: '#2a1016', seed: 4300, frame: fr, wobble: 0.01 });
  for (const { i, y, h, s, t } of perspRows(440, H + EXT + 40, 22, 1.15)) {
    const tw = 106 * s;
    const murk = 0.3 * (1 - Math.min(1, t * 1.6));
    for (let c = -1; c * 112 * s - (i % 2) * 56 * s < W + 60; c++) {
      slab(ctx, c * 112 * s - (i % 2) * 56 * s, y, tw, h - 4, { color: farther(hash(i, c, 4) < 0.5 ? '#3a161c' : '#30121a', '#1a0a14', murk), seed: 4310 + i * 10 + ((c + 3) % 12), frame: fr, alpha: 0.8, outline: 0.7, tex: 0.5, noRim: true });
    }
  }
  candle(ctx, 150, 490, 26, fr, 101);
  candle(ctx, 810, 492, 30, fr, 102);
  marigold(ctx, 128, 496, 9, fr, 103);
  marigold(ctx, 832, 498, 9, fr, 104);
  lamp(150, 476, '#ffb040', 130, 0.36);
  lamp(810, 476, '#ffb040', 130, 0.36);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,120,40,0.55)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  for (let k = 0; k < 5; k++) {
    ctx.beginPath();
    let x = 60 + k * 190;
    let y = 440;
    ctx.moveTo(x, y);
    for (let i = 0; i < 5; i++) {
      x += (hash(k, i, 1) - 0.4) * 50;
      y += 14 + hash(k, i, 2) * 6;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  // the door throws its heat across the floor, and the candles their small gold
  pool(ctx, fr, dx + dw / 2, 478, 340, '#ff7a2a', st.open ? 0.16 : 0.34);
  pool(ctx, fr, 150, 494, 90, '#ffb040', 0.22);
  pool(ctx, fr, 810, 496, 90, '#ffb040', 0.22);
  // Short, broken molten highlights catch on the uneven kiln tiles.
  // They sit below the actors and stay dim enough to preserve floor detail.
  streak(ctx, dx + dw / 2 - 34, 466, 52, 30, '#ff9a42', st.open ? 0.11 : 0.18, fr, 4318);
  streak(ctx, 150, 486, 28, 16, '#ffd080', 0.12, fr, 4319);
  streak(ctx, 810, 488, 30, 17, '#ffd080', 0.12, fr, 4320);
  embers(ctx, fr, 30, 12);
}

// ------------------------------------------------------------------ TITLE
export function paintTitle(ctx, fr) {
  setAmbient({ bounce: BOUNCE.title });
  vgrad(ctx, 0, 330, [[0, '#120a2e'], [0.55, '#3b2468'], [1, '#8a4a8a']]);
  stars(ctx, fr, 70, 250, 9);
  moon(ctx, 700, 130, 70, fr);
  cloud(ctx, 200, 190, 1.4, '#4a2f6e', fr, 5000);
  cloud(ctx, 820, 230, 1.2, '#5a3a80', fr, 5010);
  papelPicado(ctx, -10, 6, 970, 20, 16, fr, { n: 16, w: 30, h: 38, seed: 17 });
  blob(ctx, 120, 318, 150, 38, { color: '#2b1a4a', seed: 5100, frame: fr, wobble: 0.1 });
  blob(ctx, 880, 316, 160, 42, { color: '#2b1a4a', seed: 5101, frame: fr, wobble: 0.1 });
  vgrad(ctx, 312, H, [[0, '#6a4a8a'], [0.1, '#2f5f86'], [1, '#0e2448']]);
  waves(ctx, 330, H, '#3a86a3', '#12305a', fr, { rows: 8 });
  haze(ctx, 296, 356, '#d79ab0', 0.3, { peak: 0.25 });
  // the Sleeper lies just under the surface; ripples ride over its brow
  sleeperFace(ctx, 400, 392, 1.5, fr, 0, 0.42);
  for (let i = 0; i < 5; i++) blob(ctx, 330 + i * 38 + Math.sin(fr * 0.6 + i) * 5, 372 + (i % 2) * 8, 34, 5, { color: '#cfe8f0', alpha: 0.22, seed: 5250 + i, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
  for (let i = 0; i < 6; i++) blob(ctx, 700 + Math.sin(fr * 0.5 + i) * 7, 336 + i * 26, 70 - i * 6, 5, { color: '#ffe8b0', alpha: 0.45 - i * 0.05, seed: 5200 + i, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
  glints(ctx, fr, 620, 790, 338, 470, 12, 9);
  // mist
  for (let i = 0; i < 7; i++) {
    blob(ctx, ((i * 190 + fr * 1.4) % 1200) - 120, 312 + (i % 3) * 14, 150, 14, { color: '#c8b8e0', alpha: 0.16, seed: 5300 + i, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
  }
  // out-of-focus lamps of the harbor town, drifting in front of the lens
  bokeh(ctx, fr, { n: 7, y0: 330, y1: 540, seed: 51, a: 0.09, colors: ['#ffb870', '#ff7fa8', '#8ad8e8'], r0: 26, r1: 62, drift: 0.7 });
}

// ------------------------------------------------------------------ BATTLE BACKDROP
export const THEMES = {
  pier: { sky: ['#2a2b6e', '#c97c80'], far: '#4a2f6e', ground: '#6e4b38', floor: '#7f5a43', kind: 'sea', glow: '#ffc86a' },
  archive: { sky: ['#1c1530', '#3a2d52'], far: '#46385f', ground: '#3d3150', floor: '#4a3d60', kind: 'hall', glow: '#ffb65c' },
  chapel: { sky: ['#0d4350', '#08182e'], far: '#1f5a62', ground: '#1d5560', floor: '#256a72', kind: 'hall', glow: '#7fd8d0' },
  kiln: { sky: ['#2a0c14', '#5a1c1c'], far: '#4a2022', ground: '#2a1016', floor: '#3a161c', kind: 'fire', glow: '#ff7a2a' },
};

// `o` lets the portrait battle reuse the same set with a different canvas size and horizon:
//   { w, h, horizon }  (defaults reproduce the landscape 960x540 backdrop exactly)
export function paintBattleBG(ctx, themeName, fr, o = {}) {
  const t = THEMES[themeName] || THEMES.pier;
  setAmbient({ bounce: BOUNCE[themeName] || BOUNCE.pier });
  const Wd = o.w ?? W;
  const Hd = o.h ?? H;
  const hz = o.horizon ?? 318; // top of the floor
  const sx = Wd / W;
  const g = ctx.createLinearGradient(0, 0, 0, hz + 12);
  g.addColorStop(0, t.sky[0]);
  g.addColorStop(1, t.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, Wd, hz + 12);
  if (t.kind === 'sea') {
    stars(ctx, fr, 30, hz - 158, 5);
    moon(ctx, 760 * sx, hz - 228, 42, fr);
    blob(ctx, 200 * sx, hz + 4, 220, 40, { color: farther(t.far, PIER_FOG, 0.14), seed: 5400, frame: fr, wobble: 0.1 });
    blob(ctx, 820 * sx, hz + 6, 200, 34, { color: farther(t.far, PIER_FOG, 0.14), seed: 5401, frame: fr, wobble: 0.1 });
  } else {
    const xs = o.w ? [0.1, 0.32, 0.68, 0.9].map((k) => k * Wd) : [90, 300, 660, 870];
    for (const cx of xs) {
      const key = Math.round(cx);
      slab(ctx, cx - 30, hz - 278, 60, 300, { color: farther(t.far, t.sky[1], 0.25), seed: 5410 + key, frame: fr, wobble: 0.01 });
      blob(ctx, cx, hz - 276, 42, 14, { color: shade(t.far, 0.12), seed: 5460 + key, frame: fr });
    }
    if (t.kind === 'fire') {
      glow(ctx, Wd / 2, hz + 12, 460, '#ff5a1a', 0.3);
      embers(ctx, fr, 24, 15);
    } else if (themeName === 'chapel') {
      bubbles(ctx, fr, 12, 6);
    } else {
      dust(ctx, fr, 14, 5);
    }
  }
  if (t.kind !== 'sea') {
    // slatted light falling through the hall, a noir staple
    const warm = t.kind === 'fire' ? '#ff9a5a' : themeName === 'chapel' ? '#9ff0e0' : '#ffe0a0';
    shafts(ctx, [
      { x: Wd * 0.22, y: -10, ang: 1.2, len: hz * 1.1, w0: 26, w1: 90, color: warm, a: 0.12 },
      { x: Wd * 0.46, y: -10, ang: 1.2, len: hz * 1.1, w0: 20, w1: 70, color: warm, a: 0.09 },
    ], fr);
  }
  // air between the wall and the floor
  haze(ctx, hz - 70, hz + 16, t.sky[1], 0.4, { peak: 0.7 });
  slab(ctx, -20, hz, Wd + 40, Hd - hz + 40, { color: t.ground, seed: 5500, frame: fr, wobble: 0.008 });
  for (const { i, y, h, s, t: near } of perspRows(hz + 4, Hd + 40, 28, 1.13)) {
    const tw = 106 * s;
    const murk = 0.3 * (1 - Math.min(1, near * 1.6));
    for (let c = -1; c * 112 * s - (i % 2) * 56 * s < Wd + 60; c++) {
      slab(ctx, c * 112 * s - (i % 2) * 56 * s, y, tw, h - 4, { color: farther(hash(i, c, 6) < 0.5 ? t.floor : shade(t.floor, -0.1), t.sky[1], murk), seed: 5510 + (i % 12) * 10 + ((c + 3) % 12), frame: fr, alpha: 0.75, outline: 0.7, tex: 0.5, noRim: true });
    }
  }
  // the fight is lit from the middle of the floor
  lightPool(ctx, Wd / 2, hz + (Hd - hz) * 0.5, Wd * 0.55, Wd * 0.1, t.glow, 0.2, fr, { flicker: 0.06 });
}

// ------------------------------------------------------------------ LIGHT + ATMOSPHERE (after the sprites)
// Drawn after the actors, still inside the world camera: the lamps' light falls on whoever stands near them, low fog
// creeps across the floor, slatted light, drifting petals. Cheap, and it is what makes the sets feel like a noir.
export function paintAtmos(ctx, id, fr) {
  for (const L of LIT) lightWash(ctx, L.x, L.y, L.r, L.color, L.a, fr);
  // A restrained veil across the action plane makes distant scenery recede while
  // keeping the foreground figures crisp. Each room gets its own bounced-light tint.
  const air = { pier: '#d99ab0', archive: '#b3a6d8', chapel: '#71cfc5', kiln: '#ed895d' }[id];
  if (air) haze(ctx, 250, 520, air, 0.045, { peak: 0.58 });
  if (id === 'pier') {
    fogBank(ctx, fr, { y: 452, h: 90, n: 6, a: 0.12, color: '#b8d8e0', seed: 3, speed: 0.5 });
    petals(ctx, fr, { n: 8, x0: 200, x1: 900, y0: 120, y1: 520, seed: 6 });
  } else if (id === 'archive') {
    shafts(ctx, [
      { x: 150, y: -10, ang: 1.15, len: 560, w0: 34, w1: 120, color: '#cfe4ff', a: 0.11 },
      { x: 330, y: -10, ang: 1.15, len: 560, w0: 26, w1: 96, color: '#cfe4ff', a: 0.08 },
      { x: 720, y: -10, ang: 1.15, len: 560, w0: 30, w1: 110, color: '#cfe4ff', a: 0.09 },
    ], fr);
    motes(ctx, fr, { n: 16, x0: 80, x1: 900, y0: 40, y1: 430, seed: 21 });
    fogBank(ctx, fr, { y: 476, h: 70, n: 5, a: 0.1, color: '#b8a8d8', seed: 5, speed: 0.4 });
  } else if (id === 'chapel') {
    fogBank(ctx, fr, { y: 478, h: 70, n: 5, a: 0.1, color: '#7fd8d0', seed: 7, speed: 0.35 });
    petals(ctx, fr, { n: 9, x0: 60, x1: 900, y0: 60, y1: 500, seed: 8 });
  } else if (id === 'kiln') {
    fogBank(ctx, fr, { y: 484, h: 60, n: 5, a: 0.09, color: '#ff9a6a', seed: 9, speed: 0.45 });
  }
}

// ------------------------------------------------------------------ FOREGROUND (in front of everything, out of focus)
// Things nearer the lens than the actors: they slide against the set when the camera moves, which is what sells the space.
// They stay at the edges and the top so they never hide something you can tap.
export function paintFore(ctx, id, fr) {
  if (id === 'pier') {
    plane(ctx, 1.15, () => {
      // a mooring bollard with its turns of rope, at the right-hand edge
      slab(ctx, 924, 432, 46, 130 + EXT, { color: '#33262c', seed: 8101, frame: fr, outline: 0.7, tex: 0.35, occlusion: 0.6, wobble: 0.02 });
      blob(ctx, 947, 432, 30, 12, { color: '#4a3640', seed: 8102, frame: fr, outline: 0.8, occlusion: 0.5 });
      for (let i = 0; i < 3; i++) blob(ctx, 947, 462 + i * 17, 27, 7.5, { color: '#7d6d5e', seed: 8103 + i, frame: fr, outline: 0.8, occlusion: 0.5, tex: 0.3 });
    });
    plane(ctx, 1.4, () => bokeh(ctx, fr, { n: 6, y0: 340, y1: 540, seed: 41, a: 0.09, colors: ['#ffb870', '#ff7fa8'], r0: 24, r1: 58 }));
  } else if (id === 'archive') {
    plane(ctx, 1.15, () => {
      // a roof beam across the top of the frame, and a chain with a lantern, hanging close to the lens
      slab(ctx, -60, -34, W + 120, 40, { color: '#241c30', seed: 8201, frame: fr, outline: 0.8, tex: 0.3, occlusion: 0.6 });
      chain(ctx, 52, 4, 108, fr, 8202);
      lantern(ctx, 52, 120, fr, true, '#ffb65c', 1.3);
      chain(ctx, 930, 4, 70, fr, 8203);
      // Uneven tablet stacks at both lower corners make the lens feel tucked into the archive.
      for (let i = 0; i < 4; i++) {
        slab(ctx, 924 - (i % 2) * 6, 520 - i * 12 + EXT, 46, 14, { color: ['#b9a58a', '#a8957a', '#c4b296'][i % 3], seed: 8210 + i, frame: fr, outline: 0.8, occlusion: 0.5, tex: 0.4 });
        slab(ctx, 2 + (i % 2) * 5, 526 - i * 11 + EXT, 40, 13, { color: ['#aa987f', '#c0ad91', '#95846f'][i % 3], seed: 8220 + i, frame: fr, outline: 0.8, occlusion: 0.5, tex: 0.4 });
      }
    });
    plane(ctx, 1.4, () => bokeh(ctx, fr, { n: 6, y0: 60, y1: 520, seed: 43, a: 0.07, colors: ['#ffe0a8', '#cfe4ff'], r0: 22, r1: 52 }));
  } else if (id === 'chapel') {
    plane(ctx, 1.15, () => {
      const base = H + EXT + 24;
      kelp(ctx, 6, base, base - 392, fr, 61, 1);
      kelp(ctx, 34, base, base - 430, fr, 62, 0.6);
      kelp(ctx, 54, base, base - 470, fr, 63, 1.2);
      kelp(ctx, 944, base, base - 400, fr, 64, -1);
      kelp(ctx, 920, base, base - 460, fr, 65, -0.7);
    });
    plane(ctx, 1.4, () => bokeh(ctx, fr, { n: 7, y0: 60, y1: 520, seed: 45, a: 0.08, colors: ['#9ff0e0', '#ffe39a'], r0: 20, r1: 50, drift: 0.5 }));
  } else if (id === 'kiln') {
    plane(ctx, 1.15, () => {
      chain(ctx, 70, -10, 150, fr, 8301);
      blob(ctx, 70, 160, 9, 12, { color: '#4a4458', seed: 8302, frame: fr, outline: 0.7, occlusion: 0.5 });
      chain(ctx, 892, -10, 118, fr, 8303);
      blob(ctx, 892, 128, 9, 12, { color: '#4a4458', seed: 8304, frame: fr, outline: 0.7, occlusion: 0.5 });
      heap(ctx, 44, 540 + EXT, 110, fr, 8305, { embers: true });
      heap(ctx, 918, 540 + EXT, 110, fr, 8306, { embers: true });
    });
    plane(ctx, 1.4, () => bokeh(ctx, fr, { n: 7, y0: 240, y1: 540, seed: 47, a: 0.1, colors: ['#ff9a4a', '#ff6a2a'], r0: 20, r1: 54, drift: 0.8 }));
  }
}
