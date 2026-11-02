// Characters and monsters, assembled from clay lumps. Poses are stepped (stop-motion):
// walking uses a 4-key cycle, idling a 2-key breath, and every pose re-rolls its boil per frame.

import { blob, limb, slab, shadow, eye, glow, shade, mix } from './clay.js';
import { strSeed, hash, TAU } from './rng.js';
import { castShadow } from './noir.js';

export const FIGURES = {
  marl: {
    name: 'Marl', skin: '#e3a273', cloth: '#3f74b8', cloth2: '#e8c24a', legs: '#4b3b66',
    head: 21, bw: 18, bh: 22, leg: 34, arm: 30, hat: 'sou',
  },
  ochre: {
    name: 'Ochre', skin: '#b7683e', cloth: '#d0652e', cloth2: '#f0d9a0', legs: '#3a2a44',
    head: 20, bw: 22, bh: 25, leg: 36, arm: 32, hat: 'braid', prop: 'lamp',
  },
  slip: {
    name: 'Slip', skin: '#8dd3c0', cloth: '#7a58b0', cloth2: '#f0a8c8', legs: '#5a4290',
    head: 25, bw: 15, bh: 17, leg: 20, arm: 22, hat: 'tuft', scale: 0.82,
  },
  calaca: {
    name: 'Archivist Hueso', skin: '#f2e9d3', cloth: '#3b3f72', cloth2: '#d9c8a0', legs: '#2a2748',
    head: 21, bw: 18, bh: 24, leg: 36, arm: 30, hat: 'fedora', skull: true,
  },
  brine: {
    name: 'Keeper Brine', skin: '#d7a07c', cloth: '#8e9aa6', cloth2: '#f5f0e1', legs: '#4a4f5c',
    head: 21, bw: 21, bh: 24, leg: 34, arm: 30, hat: 'beard', prop: 'cane',
  },
};

// ------------------------------------------------------------------ expression
// Each mood sets the brows (tilt: + lifts the inner end, - pulls it down; lift: raises the whole brow; two values,
// rear eye then front eye), how far the eyelids come down, how wide the eyes open, the mouth, and how the head sits
// on the neck (tilt: + dips it forward). Brows are what turn a lump with eyes into somebody who is *thinking*.
export const MOODS = {
  idle: { brow: [0.12, 0.12], lift: [0, 0], mouth: 'smile', tilt: 0 },
  cheer: { brow: [0.05, 0.05], lift: [0.35, 0.35], mouth: 'grin', tilt: -0.06 },
  worried: { brow: [0.85, 0.85], lift: [0.2, 0.2], mouth: 'wobble', tilt: 0.05 },
  angry: { brow: [-0.9, -0.9], lift: [-0.15, -0.15], mouth: 'frown', tilt: 0.06 },
  curious: { brow: [0.1, 0.3], lift: [0, 0.6], mouth: 'tiny', tilt: 0.1 },
  sly: { brow: [-0.25, 0.4], lift: [0, 0.3], lid: 0.38, mouth: 'smirk', tilt: -0.05 },
  awe: { brow: [0.2, 0.2], lift: [0.75, 0.75], wide: 1.18, mouth: 'gasp', tilt: -0.08 },
  sad: { brow: [1.0, 1.0], lift: [0, 0], lid: 0.22, mouth: 'frown', tilt: 0.12 },
  hurt: { brow: [0.7, 0.7], lift: [0, 0], mouth: 'smile', tilt: 0 },
  ko: { brow: [0, 0], lift: [0, 0], mouth: 'smile', tilt: 0 },
};

// A blink lasts two stop-motion frames, falls on a different beat for every figure, and sometimes doubles.
function blinkNow(fr, seed) {
  const m = (fr + (seed & 15)) % 23;
  return m < 2 || (m === 5 && hash(seed, fr >> 3) < 0.3);
}

// A drooping eyelid: skin-coloured lump over the top of the eye, with a lash line along its lower edge.
function lid(ctx, x, y, er, amt, skin, seed, fr) {
  const yb = y - er * 1.08 + amt * er * 2.16;
  blob(ctx, x, yb - er * 0.62, er * 1.16, er * 0.62, { color: skin, seed, frame: fr, outline: 0.8, tex: 0.3, noRim: true, gloss: 0, boil: 0.3 });
  ctx.save();
  ctx.strokeStyle = '#2a1428';
  ctx.lineWidth = Math.max(1.2, er * 0.16);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - er * 1.0, yb);
  ctx.lineTo(x + er * 1.0, yb);
  ctx.stroke();
  ctx.restore();
}

// One eyebrow: a short tapered sausage of clay above the eye. `inward` is +1 when the nose is toward +x from this eye.
function brow(ctx, ex, ey, er, inward, side, M, col, thick, seed, fr) {
  const by = ey - er * 1.62 - (M.lift?.[side] ?? 0) * er * 1.1;
  const half = er * 0.95;
  const tilt = M.brow?.[side] ?? 0;
  const inY = by - tilt * er * 0.55;
  const outY = by + tilt * er * 0.3;
  limb(ctx, ex - inward * half, outY, ex + inward * half, inY, er * 0.17 * thick + 0.9, er * 0.2 * thick + 0.9, { color: col, seed, frame: fr, outline: 0.4, noRim: true, gloss: 0, tex: 0.2, boil: 0.3 });
}

// ------------------------------------------------------------------ head
// A calavera face: black sockets with a pinprick of life in each, a nose hole, a stitched grin.
function drawSkullFace(ctx, f, st, hx, hy, r, shift, seed) {
  const fr = st.frame | 0;
  const mood = st.mood || 'idle';
  const look = st.look || [0.6, 0];
  const ink = { flat: true, outline: 0.5, noRim: true, gloss: 0, boil: 0.3 };
  const ey = hy - r * 0.08;
  const closed = mood === 'ko' || blinkNow(fr, seed);
  for (const [i, ex] of [hx + shift - r * 0.32, hx + shift + r * 0.36].entries()) {
    blob(ctx, ex, ey, r * 0.27, r * 0.31, { color: '#1c1226', seed: seed + 6 + i, frame: fr, ...ink });
    if (!closed) blob(ctx, ex + look[0] * r * 0.08, ey + look[1] * r * 0.06, r * 0.085, r * 0.1, { color: '#ffe9a8', seed: seed + 8 + i, frame: fr, ...ink, outline: 0 });
    // sugar-skull dots around the socket
    for (let k = 0; k < 4; k++) {
      const a = -2.4 + k * 0.8;
      blob(ctx, ex + Math.cos(a) * r * 0.38, ey + Math.sin(a) * r * 0.4, r * 0.05, r * 0.05, { color: k % 2 ? '#e8528f' : '#2fb8a8', seed: seed + 12 + k + i * 4, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0, boil: 0.2 });
    }
  }
  blob(ctx, hx + shift + r * 0.1, hy + r * 0.3, r * 0.1, r * 0.14, { color: '#1c1226', seed: seed + 20, frame: fr, ...ink, outline: 0, rot: 0.1 });
  const my = hy + r * 0.6;
  const mx = hx + shift + r * 0.08;
  ctx.save();
  ctx.strokeStyle = 'rgba(28,18,38,0.85)';
  ctx.lineWidth = Math.max(1.2, r * 0.07);
  ctx.lineCap = 'round';
  if (st.talk && fr % 2 === 0) {
    blob(ctx, mx, my + r * 0.04, r * 0.34, r * 0.14, { color: '#1c1226', seed: seed + 21, frame: fr, ...ink, outline: 0 });
  } else {
    // the stitched grin bows up when pleased and flattens when something is wrong
    const bow = mood === 'cheer' || mood === 'sly' ? 0.16 : mood === 'angry' || mood === 'sad' || mood === 'worried' ? -0.04 : 0.08;
    ctx.beginPath();
    ctx.moveTo(mx - r * 0.42, my);
    ctx.quadraticCurveTo(mx, my + r * bow, mx + r * 0.42, my);
    ctx.stroke();
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(mx + i * r * 0.17, my - r * 0.05);
      ctx.lineTo(mx + i * r * 0.17, my + r * 0.12);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawMouth(ctx, M, mood, st, mx, my, r, seed, fr) {
  const ink = { color: '#4a1420', seed: seed + 5, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 };
  if (st.talk && fr % 2 === 0) {
    const gasp = M.mouth === 'gasp';
    blob(ctx, mx, my, r * (gasp ? 0.2 : 0.17), r * (gasp ? 0.19 : 0.14), ink);
    return;
  }
  if (mood === 'hurt' || mood === 'ko') {
    blob(ctx, mx, my, r * 0.12, r * 0.1, ink);
    return;
  }
  if (M.mouth === 'gasp') {
    blob(ctx, mx, my + r * 0.02, r * 0.13, r * 0.17, ink);
    return;
  }
  if (M.mouth === 'tiny') {
    blob(ctx, mx + r * 0.08, my, r * 0.08, r * 0.09, ink);
    return;
  }
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#4a1a22';
  ctx.lineWidth = Math.max(1.6, r * 0.08);
  ctx.beginPath();
  if (M.mouth === 'frown') {
    ctx.moveTo(mx - r * 0.22, my + r * 0.05);
    ctx.quadraticCurveTo(mx, my - r * 0.1, mx + r * 0.22, my + r * 0.05);
  } else if (M.mouth === 'wobble') {
    ctx.moveTo(mx - r * 0.22, my + r * 0.02);
    ctx.quadraticCurveTo(mx - r * 0.11, my - r * 0.06, mx, my + r * 0.02);
    ctx.quadraticCurveTo(mx + r * 0.11, my + r * 0.1, mx + r * 0.22, my + r * 0.01);
  } else if (M.mouth === 'smirk') {
    ctx.moveTo(mx - r * 0.2, my + r * 0.03);
    ctx.quadraticCurveTo(mx + r * 0.06, my + r * 0.09, mx + r * 0.28, my - r * 0.08);
  } else {
    ctx.moveTo(mx - r * 0.2, my);
    ctx.quadraticCurveTo(mx, my + r * (M.mouth === 'grin' ? 0.3 : 0.15), mx + r * 0.2, my);
  }
  ctx.stroke();
  ctx.restore();
}

function drawHead(ctx, f, st, hx, hy, seed) {
  const fr = st.frame | 0;
  const r = f.head;
  const shift = r * 0.22;
  const mood = st.mood || 'idle';
  const M = MOODS[mood] || MOODS.idle;
  const look = st.look || [0.6, 0];
  // the head sits on a neck: it dips with the mood, nods while talking, and never holds perfectly still
  const tilt = M.tilt + (st.talk ? [0, 0.03, 0.012, 0.04][(fr >> 1) & 3] : 0) + Math.sin(fr * 0.19 + seed) * 0.012;
  const pivot = hy + r * 0.9;
  ctx.save();
  ctx.translate(hx, pivot);
  ctx.rotate(tilt);
  ctx.translate(-hx, -pivot);

  // hair / hat parts that sit behind the head
  if (f.hat === 'braid') {
    limb(ctx, hx - r * 0.7, hy - r * 0.1, hx - r * 1.15, hy + r * 0.95, 6, 5, { color: '#2d1b2e', seed: seed + 40, frame: fr });
    blob(ctx, hx - r * 1.15, hy + r * 1.05, 6, 6, { color: '#d0652e', seed: seed + 41, frame: fr, outline: 1 });
  }
  if (f.hat === 'sou') {
    // long back brim of the sou'wester
    blob(ctx, hx - r * 0.6, hy - r * 0.52, r * 1.15, r * 0.24, { color: shade(f.cloth2, -0.08), seed: seed + 42, frame: fr, rot: 0.2 });
  }

  blob(ctx, hx, hy, r, r * 0.96, { color: f.skin, seed: seed + 1, frame: fr, wobble: 0.04 });
  const er = r * 0.23 * (M.wide || 1);
  const ey = hy - r * 0.06;
  const e1 = hx + shift - r * 0.3;
  const e2 = hx + shift + r * 0.34;
  if (f.skull) {
    drawSkullFace(ctx, f, st, hx, hy, r, shift, seed);
  } else {
    // cheeks (they flush when pleased or startled) and nose
    const flush = mood === 'cheer' || mood === 'awe' ? 0.55 : 0.35;
    blob(ctx, hx + shift + r * 0.28, hy + r * 0.32, r * 0.2, r * 0.13, { color: '#e87a7a', alpha: flush, seed: seed + 3, frame: fr, flat: true, noRim: true, outline: 0, gloss: 0 });
    blob(ctx, hx + shift + r * 0.62, hy + r * 0.1, r * 0.17, r * 0.15, { color: shade(f.skin, -0.06), seed: seed + 2, frame: fr, outline: 0.8, tex: 0.3, noRim: true, gloss: 0.3 });

    // eyes
    const closed = mood === 'ko';
    const squint = mood === 'hurt';
    const blink = blinkNow(fr, seed);
    eye(ctx, e1, ey, er, { seed: seed + 6, frame: fr, look, blink: closed || blink, squint, side: -1 });
    eye(ctx, e2, ey, er, { seed: seed + 7, frame: fr, look, blink: closed || blink, squint, side: -1 });
    if (M.lid && !closed && !blink && !squint) {
      lid(ctx, e1, ey, er, M.lid, f.skin, seed + 30, fr);
      lid(ctx, e2, ey, er, M.lid, f.skin, seed + 31, fr);
    }
    // brows (a bearded keeper's are white and bushy)
    if (!closed) {
      const col = f.hat === 'beard' ? f.cloth2 : shade(f.skin, -0.55);
      const thick = f.hat === 'beard' ? 1.7 : 1;
      brow(ctx, e1, ey, er, 1, 0, M, col, thick, seed + 11, fr);
      brow(ctx, e2, ey, er, -1, 1, M, col, thick, seed + 12, fr);
    }

    drawMouth(ctx, M, mood, st, hx + shift + r * 0.12, hy + r * 0.52, r, seed, fr);
  }

  // headgear
  if (f.hat === 'sou') {
    blob(ctx, hx - r * 0.05, hy - r * 0.86, r * 1.02, r * 0.6, { color: f.cloth2, seed: seed + 8, frame: fr });
    blob(ctx, hx + r * 0.72, hy - r * 0.4, r * 0.5, r * 0.14, { color: shade(f.cloth2, -0.1), seed: seed + 9, frame: fr, rot: -0.15, outline: 1 });
  } else if (f.hat === 'braid') {
    blob(ctx, hx - 2, hy - r * 0.82, r * 1.03, r * 0.58, { color: '#2d1b2e', seed: seed + 8, frame: fr });
    slab(ctx, hx - r * 0.95, hy - r * 0.44, r * 1.95, r * 0.15, { color: f.cloth2, seed: seed + 9, frame: fr, outline: 1 });
  } else if (f.hat === 'tuft') {
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * 0.55;
      const wave = Math.sin(fr * 0.8 + i) * 2.5;
      limb(ctx, hx + Math.cos(a) * r * 0.7, hy + Math.sin(a) * r * 0.8, hx + Math.cos(a) * r * 1.35 + wave, hy + Math.sin(a) * r * 1.5, 5, 3.5, { color: f.cloth2, seed: seed + 10 + i, frame: fr });
    }
  } else if (f.hat === 'fedora') {
    // noir fedora: wide brim, pinched crown, red band
    blob(ctx, hx, hy - r * 0.62, r * 1.5, r * 0.22, { color: '#2b2a3d', seed: seed + 8, frame: fr, rot: -0.05 });
    blob(ctx, hx, hy - r * 0.98, r * 0.86, r * 0.5, { color: '#383752', seed: seed + 9, frame: fr });
    slab(ctx, hx - r * 0.84, hy - r * 0.8, r * 1.68, r * 0.17, { color: '#c9503f', seed: seed + 10, frame: fr, outline: 0.8 });
  } else if (f.hat === 'beard') {
    blob(ctx, hx + shift * 0.4, hy + r * 0.78, r * 0.86, r * 0.62, { color: f.cloth2, seed: seed + 8, frame: fr });
    blob(ctx, hx - 1, hy - r * 0.86, r * 0.92, r * 0.36, { color: '#53606e', seed: seed + 13, frame: fr });
  }
  ctx.restore();
}

// ------------------------------------------------------------------ full figure
export function drawFigure(ctx, kind, x, y, st = {}) {
  const f = FIGURES[kind];
  if (!f) return;
  const fr = st.frame | 0;
  const seed = strSeed(kind);
  const sc = (st.scale ?? 1) * (f.scale ?? 1);
  const face = st.facing ?? 1;
  const moving = !!st.moving;
  const step = st.step | 0;
  const mood = st.mood || 'idle';
  const down = mood === 'ko';
  const swing = moving ? [1, 0, -1, 0][step & 3] : 0;
  // standing still is never still: a slow breath, and every few seconds the weight shifts from one foot to the other
  const breathe = moving ? 0 : [0, 0.6, 1, 0.6][((fr + (seed & 7)) >> 2) & 3];
  // every few seconds somebody does something small and human: a short window of fidget, then back to standing
  const fper = 108 + ((seed >>> 0) % 40);
  const fp = (fr + ((seed >>> 0) % 61)) % fper;
  const fid = !moving && !down && !st.talk && mood === 'idle' && fp < 16 ? Math.sin((fp / 16) * Math.PI) : 0;
  const bob = (moving ? [0, -3, 0, -3][step & 3] : -breathe * 1.4) - (kind === 'slip' ? fid * 10 : 0); // Slip hops
  const shift = moving || down ? 0 : Math.floor((fr + (seed & 31)) / 40) % 2 ? 1.6 : -1.2;
  const contact = moving && (step & 1) ? 0.965 : 1; // the body settles a hair each time a foot lands
  const lean = down ? 0 : moving ? 0.06 : st.talk ? -0.025 : 0;
  const gest = st.talk ? [0.15, 1, 0.55, 0.9][(fr >> 1) & 3] : 0; // the free hand makes the point
  const sq = st.squash ?? 1;

  ctx.save();
  if (st.alpha != null) ctx.globalAlpha *= st.alpha;
  if (!down && !st.noShadow) {
    castShadow(ctx, x, y, 30 * sc, fr, { len: 2.8, a: 0.3 });
    shadow(ctx, x, y + 2, 30 * sc, 7 * sc);
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face * sc * (1 + (1 - sq) * 0.5), sc * sq);
  if (down) {
    ctx.rotate(1.45);
    ctx.translate(-6, 6);
  } else if (mood === 'hurt') {
    ctx.rotate(-0.14);
  }

  const L = f.leg;
  const torsoY = -L - f.bh * 0.8 + bob;
  const headY = torsoY - f.bh * 0.9 - f.head * 0.72 + bob * 0.4;
  const hip = f.bw * 0.42;
  const cheer = mood === 'cheer';

  // legs stay planted
  const legFoot = (side, sw) => [side * hip + sw * 11, 0];
  const drawLeg = (side, sw, dark) => {
    const [fx, fy] = legFoot(side, sw);
    const col = dark ? shade(f.legs, -0.2) : f.legs;
    limb(ctx, side * hip, -L + 4, fx, fy - 6, 7.4, 6.4, { color: col, seed: seed + 22 + side, frame: fr });
    blob(ctx, fx + 6, fy - 4, 11.5, 6.4, { color: shade(col, -0.15), seed: seed + 24 + side, frame: fr, outline: 1.2 });
  };
  drawLeg(-1, -swing, true);
  drawLeg(1, swing, false);

  // everything above the hips pivots there: the lean, the weight shift, the settle
  ctx.save();
  ctx.translate(shift, -L);
  ctx.rotate(lean);
  ctx.scale(1 + (1 - contact) * 0.5, contact);
  ctx.translate(0, L);

  // back arm
  const armLen = f.arm;
  const shY = torsoY - f.bh * 0.42;
  const handBack = cheer ? [-f.bw - 8, shY - armLen] : [-f.bw * 0.95 - swing * 5, shY + armLen * 0.9 + breathe * 0.8];
  limb(ctx, -f.bw * 0.8, shY, handBack[0], handBack[1], 6, 5.2, { color: shade(f.cloth, -0.18), seed: seed + 20, frame: fr });
  blob(ctx, handBack[0], handBack[1], 5.6, 5.6, { color: shade(f.skin, -0.12), seed: seed + 21, frame: fr, outline: 1 });

  // torso + collar
  blob(ctx, 0, torsoY, f.bw, f.bh, { color: f.cloth, seed: seed + 26, frame: fr });
  // Fine pressed-in tailoring: tiny curved fold lines catch the light like marks
  // worked into the clay costume, adding scale and form without turning into ink outlines.
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(0.8, f.bw * 0.055);
  ctx.strokeStyle = 'rgba(255,235,198,0.22)';
  ctx.beginPath();
  ctx.moveTo(-f.bw * 0.68, torsoY - f.bh * 0.16);
  ctx.quadraticCurveTo(-f.bw * 0.42, torsoY + f.bh * 0.02, -f.bw * 0.5, torsoY + f.bh * 0.34);
  ctx.moveTo(f.bw * 0.56, torsoY - f.bh * 0.12);
  ctx.quadraticCurveTo(f.bw * 0.36, torsoY + f.bh * 0.12, f.bw * 0.62, torsoY + f.bh * 0.3);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(35,22,48,0.2)';
  ctx.lineWidth = Math.max(0.7, f.bw * 0.04);
  ctx.beginPath();
  ctx.moveTo(-f.bw * 0.55, torsoY + f.bh * 0.39);
  ctx.quadraticCurveTo(0, torsoY + f.bh * 0.52, f.bw * 0.48, torsoY + f.bh * 0.36);
  ctx.stroke();
  ctx.restore();
  blob(ctx, 2, torsoY - f.bh * 0.78, f.bw * 0.72, 6.4, { color: f.cloth2, seed: seed + 27, frame: fr, outline: 1 });
  if (kind === 'marl') {
    blob(ctx, 0, torsoY + f.bh * 0.15, f.bw * 0.14, f.bh * 0.5, { color: f.cloth2, seed: seed + 28, frame: fr, outline: 0.8 });
  }
  if (kind === 'ochre') {
    slab(ctx, -f.bw * 0.95, torsoY + f.bh * 0.25, f.bw * 1.9, 7, { color: '#3a2a44', seed: seed + 28, frame: fr, outline: 1 });
  }
  if (kind === 'slip') {
    for (let i = 0; i < 3; i++) {
      blob(ctx, -8 + i * 8, 2 + ((fr + i * 2) % 6), 2.6, 3.4, { color: f.skin, alpha: 0.7, seed: seed + 30 + i, frame: fr, flat: true, outline: 0.6, noRim: true });
    }
  }

  // head
  drawHead(ctx, f, { ...st, frame: fr, mood }, 0, headY, seed);

  // props held in the front hand
  let handFront = cheer
    ? [f.bw + 8, shY - armLen]
    : [f.bw * 0.95 + swing * 5 + gest * 6, shY + armLen * 0.9 - gest * armLen * 0.55 + breathe * 0.8];
  if (fid > 0) {
    // Marl scratches under his hat, Hueso tips his fedora to nobody, Ochre lifts the lamp to look around (Brine taps his cane)
    const T = kind === 'marl' ? [f.head * 0.82 + Math.sin(fr * 2.6) * 2, headY - f.head * 0.55] : kind === 'calaca' ? [f.head * 0.72, headY - f.head * 0.98] : null;
    if (T) handFront = [handFront[0] + (T[0] - handFront[0]) * fid, handFront[1] + (T[1] - handFront[1]) * fid];
    else if (kind === 'ochre') handFront = [handFront[0], handFront[1] - fid * 12];
  }
  const caneLift = kind === 'brine' && fid > 0 ? Math.abs(Math.sin((fp / 16) * TAU)) * 7 : 0;
  if (f.prop === 'lamp') {
    limb(ctx, handFront[0] + 2, handFront[1] + 6, handFront[0] + 5, handFront[1] - 78, 3.4, 3, { color: '#5a3a28', seed: seed + 50, frame: fr, outline: 1 });
    const lx = handFront[0] + 5;
    const ly = handFront[1] - 86;
    glow(ctx, lx, ly, 62, '#ffc86a', 0.55);
    blob(ctx, lx, ly, 9, 11, { color: '#ffd98a', seed: seed + 51, frame: fr, gloss: 0.8, occlusion: 0.15 });
  } else if (f.prop === 'cane') {
    limb(ctx, handFront[0] + 2, handFront[1] + 4, handFront[0] + 5, -caneLift, 3.6, 3.2, { color: '#6a4a30', seed: seed + 50, frame: fr, outline: 1 });
  }
  // front arm
  limb(ctx, f.bw * 0.8, shY, handFront[0], handFront[1], 6.2, 5.4, { color: f.cloth, seed: seed + 52, frame: fr });
  blob(ctx, handFront[0], handFront[1], 5.8, 5.8, { color: f.skin, seed: seed + 53, frame: fr, outline: 1 });

  ctx.restore(); // end upper body
  ctx.restore();

  // a puff of dust kicked up by each footfall
  if (moving && (step & 1) && (fr & 1) === 0 && !down) {
    for (let i = 0; i < 3; i++) {
      blob(ctx, x - face * (10 + i * 7) * sc, y - (2 + i * 3) * sc, (3.4 + i) * sc, (2.4 + i * 0.6) * sc, { color: '#d8c6ae', alpha: 0.34 - i * 0.06, seed: seed + 60 + i, frame: fr, flat: true, noRim: true, gloss: 0, outline: 0, lite: true });
    }
  }
  ctx.restore();
  return { height: (L + f.bh * 1.8 + f.head * 2.4) * sc, top: y - (L + f.bh * 1.7 + f.head * 2.2) * sc };
}

export function figureBounds(kind, x, y, scale = 1) {
  const f = FIGURES[kind];
  const sc = scale * (f.scale ?? 1);
  const h = (f.leg + f.bh * 1.8 + f.head * 2.4) * sc;
  const w = (f.bw * 2.6 + 14) * sc;
  return { x: x - w / 2, y: y - h, w, h };
}

// ------------------------------------------------------------------ portraits (dialogue)
export function drawPortrait(ctx, who, cx, cy, r, st = {}) {
  const f = FIGURES[who];
  if (f) {
    ctx.save();
    ctx.translate(cx, cy);
    const k = r / (f.head * 1.35);
    ctx.scale(k, k);
    drawHead(ctx, f, { ...st, look: st.look || [0.2, 0.1] }, 0, 0, strSeed(who));
    ctx.restore();
    return;
  }
  if (who === 'kilnwright') {
    const fr = st.frame | 0;
    blob(ctx, cx, cy + r * 0.1, r * 0.95, r * 1.0, { color: '#e6b66a', seed: 95, frame: fr });
    slab(ctx, cx - r * 0.18, cy - r * 1.05, r * 0.36, r * 0.4, { color: '#c98a4e', seed: 96, frame: fr });
    for (const s of [-1, 1]) {
      glow(ctx, cx + s * r * 0.36, cy - r * 0.05, r * 0.5, '#ff8a30', 0.8);
      blob(ctx, cx + s * r * 0.36, cy - r * 0.05, r * 0.2, r * 0.08, { color: '#1a0a12', seed: 97 + s, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0, rot: s * 0.25 });
    }
    blob(ctx, cx, cy + r * 0.5, r * 0.3, r * 0.1, { color: '#2a0d10', seed: 99, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    return;
  }
  if (who === 'warden') {
    const fr = st.frame | 0;
    blob(ctx, cx, cy, r, r * 1.05, { color: '#9a4a35', seed: 91, frame: fr, square: 3.5 });
    blob(ctx, cx, cy + r * 0.25, r * 0.5, r * 0.4, { color: '#2a0d10', seed: 92, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    glow(ctx, cx, cy + r * 0.25, r * 0.7, '#ff7a1f', 0.6);
    eye(ctx, cx - r * 0.38, cy - r * 0.3, r * 0.2, { frame: fr, seed: 93, pupil: '#ff5a1a', white: '#f8e7b0' });
    eye(ctx, cx + r * 0.38, cy - r * 0.3, r * 0.2, { frame: fr, seed: 94, pupil: '#ff5a1a', white: '#f8e7b0' });
  }
}

// ------------------------------------------------------------------ monsters
export const ENEMY_BOUNDS = {
  husk: { w: 90, h: 100 },
  kilnwright: { w: 80, h: 160 },
  eel: { w: 140, h: 120 },
  moth: { w: 110, h: 120, float: 34 },
  auditor: { w: 84, h: 160 },
  warden: { w: 260, h: 300 },
};

function hand(ctx, x, y, r, c, seed, fr) {
  blob(ctx, x, y, r, r * 0.9, { color: c, seed, frame: fr });
  for (let i = 0; i < 3; i++) {
    const a = -0.9 + i * 0.9;
    limb(ctx, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5 + r * 0.4, x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.45 + r * 0.8, r * 0.32, r * 0.24, { color: c, seed: seed + i + 1, frame: fr });
  }
}

export function drawEnemy(ctx, kind, x, y, st = {}) {
  const fr = st.frame | 0;
  const flash = st.flash ? 0.62 : 0;
  const C = (c) => (flash ? mix(c, '#ffffff', flash) : c);
  const dead = st.dead ?? 0;
  const sc = st.scale ?? 1;
  ctx.save();
  ctx.globalAlpha *= 1 - dead;
  if (kind !== 'eel' && kind !== 'moth') {
    castShadow(ctx, x, y, (ENEMY_BOUNDS[kind]?.w || 80) * 0.5 * sc, st.frame | 0, { len: 2.2, a: 0.26 });
    shadow(ctx, x, y + 3, (ENEMY_BOUNDS[kind]?.w || 80) * 0.5 * sc);
  }
  ctx.translate(x + (st.lunge || 0), y + dead * 14);
  ctx.scale(sc, sc * (1 - dead * 0.4));

  if (kind === 'husk') {
    const bob = Math.sin(fr * 0.9) * 2;
    for (const s of [-1, 1]) {
      const sway = Math.sin(fr * 0.8 + s) * 6;
      limb(ctx, s * 30, -50, s * 52 + sway, -28 - Math.abs(sway), 7, 4.4, { color: C('#4f7143'), seed: 11 + s, frame: fr });
      limb(ctx, s * 52 + sway, -28 - Math.abs(sway), s * 58 + sway * 1.4, -6, 4.4, 3, { color: C('#4f7143'), seed: 13 + s, frame: fr });
    }
    blob(ctx, 0, -48 + bob, 36, 44, { color: C('#8b9179'), seed: 5, frame: fr });
    blob(ctx, 2, -52 + bob, 17, 24, { color: '#0d0618', seed: 6, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    for (const ex of [-5, 9]) blob(ctx, ex, -58 + bob, 3.2, 3.6, { color: '#d8f0a0', seed: 7 + ex, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    for (let i = 0; i < 4; i++) blob(ctx, -22 + i * 13, -72 + ((i * 7) % 18) + bob, 4.5, 3.6, { color: C('#c9c2a4'), seed: 20 + i, frame: fr, outline: 0.8 });
    for (let i = 0; i < 2; i++) blob(ctx, -10 + i * 20, -2 + ((fr + i * 3) % 7), 2.6, 3.4, { color: C('#8b9179'), alpha: 0.8, seed: 30 + i, frame: fr, flat: true, outline: 0.6, noRim: true });
  } else if (kind === 'kilnwright') {
    const sway = Math.sin(fr * 0.5) * 2;
    blob(ctx, 0, -62, 30, 58, { color: C('#9a4030'), seed: 41, frame: fr });
    slab(ctx, -35, -16, 70, 18, { color: C('#7d3226'), seed: 42, frame: fr });
    slab(ctx, -27, -74, 54, 10, { color: C('#e0a64a'), seed: 43, frame: fr, outline: 1 });
    limb(ctx, -24, -86, -36, -54, 7, 6, { color: C('#8a392b'), seed: 44, frame: fr });
    limb(ctx, 24, -86, 42, -66, 7, 6, { color: C('#8a392b'), seed: 45, frame: fr });
    // swinging censer
    const ang = Math.sin(fr * 0.6) * 0.5;
    const cx = 42 + Math.sin(ang) * 34;
    const cy = -66 + Math.cos(ang) * 34;
    limb(ctx, 42, -66, cx, cy, 1.8, 1.8, { color: '#6a5a40', seed: 46, frame: fr, outline: 0.6, boil: 0.2 });
    glow(ctx, cx, cy, 34, '#ff8a30', 0.55);
    blob(ctx, cx, cy, 8, 9, { color: C('#8a6a3a'), seed: 47, frame: fr });
    // mask
    slab(ctx, -9, -164, 18, 22, { color: C('#c98a4e'), seed: 48, frame: fr });
    blob(ctx, sway * 0.4, -122, 19, 22, { color: C('#e6b66a'), seed: 49, frame: fr, wobble: 0.03 });
    for (const s of [-1, 1]) {
      glow(ctx, s * 10 + sway * 0.4, -125, 18, '#ff8a30', 0.85);
      limb(ctx, s * 12 + sway * 0.4 - s * 5, -128 + s * 2, s * 12 + sway * 0.4 + s * 5, -123 - s * 2, 3.2, 3.2, { color: '#1a0a12', seed: 50 + s, frame: fr, outline: 0 });
      blob(ctx, s * 10 + sway * 0.4, -125, 2.6, 2.6, { color: '#ffd27a', seed: 55 + s, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    }
    blob(ctx, sway * 0.4 + 1, -108, 7, 3.6, { color: '#2a0d10', seed: 53, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    for (let i = 0; i < 3; i++) {
      const rise = ((fr + i * 4) % 12) / 12;
      blob(ctx, 3 + i * 4 + rise * 6, -176 - rise * 34, 5 + rise * 5, 4 + rise * 4, { color: '#bfb3c6', alpha: 0.5 * (1 - rise), seed: 54 + i, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    }
  } else if (kind === 'eel') {
    const hover = 66 + Math.sin(fr * 0.7) * 5;
    for (let i = 6; i >= 0; i--) {
      const px = 28 - i * 15;
      const py = -hover + Math.sin(fr * 0.9 - i * 0.85) * 11;
      const rad = 24 - i * 2;
      blob(ctx, px, py, rad, rad * 0.86, { color: C(i % 2 ? '#2f8f9b' : '#38a3a8'), seed: 60 + i, frame: fr });
      if (i % 2 === 0 && i > 0) blob(ctx, px, py - rad * 0.9, 8, 10, { color: C('#e08aa8'), seed: 70 + i, frame: fr, rot: 0.2, outline: 1 });
    }
    const hy = -hover + Math.sin(fr * 0.9) * 11;
    blob(ctx, 36, hy, 30, 23, { color: C('#2a808f'), seed: 80, frame: fr });
    eye(ctx, 42, hy - 8, 8.5, { frame: fr, seed: 81, white: '#ffe27a', pupil: '#2a0a10', look: [1, 0] });
    for (let i = 0; i < 3; i++) blob(ctx, 40 + i * 7, hy + 12, 3, 5, { color: '#f3ecd8', seed: 82 + i, frame: fr, outline: 0.6, flat: true, noRim: true });
    shadow(ctx, 0, 6, 46, 7, 0.18);
  } else if (kind === 'moth') {
    // a candle-wick moth: waxy body, a lit wick for a crest, wings that flap in stepped beats
    const hover = 74 + Math.sin(fr * 0.8) * 5;
    const beat = [0.95, 0.55, 0.15, 0.55][fr & 3];
    for (const s of [-1, 1]) {
      const wy = -hover - 8;
      blob(ctx, s * (26 + beat * 4), wy - 14 * beat, 30, 38 * (0.5 + beat * 0.5), { color: C('#e9dcf1'), seed: 200 + s, frame: fr, rot: s * (0.5 + beat * 0.5), outline: 1.1, alpha: 0.95 });
      blob(ctx, s * (30 + beat * 5), wy + 16, 20, 20 * (0.6 + beat * 0.4), { color: C('#f0a03a'), seed: 203 + s, frame: fr, rot: s * 0.4, outline: 0.9 });
      for (let i = 0; i < 2; i++) blob(ctx, s * (24 + beat * 4 + i * 10), wy - 8 + i * 12, 4, 4, { color: '#5a3a6a', seed: 206 + s * 3 + i, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    }
    blob(ctx, 0, -hover + 10, 16, 28, { color: C('#dcc9a0'), seed: 210, frame: fr });
    blob(ctx, 0, -hover - 24, 13, 13, { color: C('#e8d9b4'), seed: 211, frame: fr });
    for (const s of [-1, 1]) {
      limb(ctx, s * 5, -hover - 34, s * (14 + Math.sin(fr * 0.6 + s) * 3), -hover - 56, 1.8, 1.4, { color: '#5a4a60', seed: 212 + s, frame: fr, outline: 0.5, boil: 0.2 });
      eye(ctx, s * 6, -hover - 24, 5.4, { frame: fr, seed: 214 + s, white: '#fff6d8', pupil: '#2a1428', look: [0, 0.4] });
    }
    // the lit wick on its crest
    limb(ctx, 0, -hover - 36, 0, -hover - 46, 1.6, 1.2, { color: '#4a3a30', seed: 216, frame: fr, outline: 0.4, boil: 0.2 });
    glow(ctx, 0, -hover - 54, 26, '#ffb65c', 0.8);
    blob(ctx, 0, -hover - 54 - (fr & 1), 4, 7 + (fr % 3), { color: '#ffe08a', seed: 217, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    shadow(ctx, 0, 6, 38, 6, 0.16);
  } else if (kind === 'auditor') {
    // a pressed clerk: paper-coloured clay, an eyeshade, a ledger under one arm and a stamp that comes down on you
    const sway = Math.sin(fr * 0.45) * 1.5;
    const stampDown = [0, 0.3, 1, 0.45][(fr >> 1) & 3];
    for (const s of [-1, 1]) {
      limb(ctx, s * 9, -48, s * 11 + (s > 0 ? 3 : -3), -4, 5.5, 4.6, { color: C('#3a3552'), seed: 220 + s, frame: fr });
      blob(ctx, s * 12 + (s > 0 ? 6 : -4), -3, 9, 4.6, { color: C('#2a2540'), seed: 222 + s, frame: fr, outline: 1 });
    }
    blob(ctx, sway * 0.3, -86, 22, 44, { color: C('#d3c7a6'), seed: 224, frame: fr });
    for (let i = -2; i <= 2; i++) limb(ctx, i * 7 + sway * 0.3, -122, i * 6.6 + sway * 0.3, -50, 0.9, 0.9, { color: '#7a6f8a', seed: 225 + i, frame: fr, outline: 0, boil: 0.15, alpha: 0.5 });
    blob(ctx, sway * 0.3, -126, 12, 5, { color: C('#c9503f'), seed: 230, frame: fr, outline: 0.8 }); // a very small red tie
    // ledger under the left arm
    limb(ctx, -20, -108, -26, -76, 5, 4.6, { color: C('#d3c7a6'), seed: 231, frame: fr });
    slab(ctx, -42, -88, 26, 34, { color: C('#7a4a3a'), seed: 232, frame: fr, outline: 1.1 });
    slab(ctx, -38, -84, 4, 26, { color: '#e0b84a', seed: 233, frame: fr, outline: 0 });
    // stamp arm
    const sy = -112 + stampDown * 26;
    limb(ctx, 20, -110, 34, sy - 14, 5, 4.6, { color: C('#d3c7a6'), seed: 234, frame: fr });
    blob(ctx, 34, sy - 12, 6, 6, { color: C('#d3c7a6'), seed: 235, frame: fr, outline: 1 });
    slab(ctx, 28, sy - 8, 12, 12, { color: C('#5a3a2a'), seed: 236, frame: fr, outline: 1 });
    slab(ctx, 24, sy + 3, 20, 7, { color: C('#c9503f'), seed: 237, frame: fr, outline: 1 });
    // head, eyeshade, spectacles
    blob(ctx, sway * 0.5, -150, 20, 21, { color: C('#ddd0b2'), seed: 240, frame: fr, wobble: 0.03 });
    slab(ctx, sway * 0.5 - 22, -166, 44, 12, { color: C('#3f7a5a'), seed: 241, frame: fr, outline: 1.1 });
    slab(ctx, sway * 0.5 - 14, -171, 30, 6, { color: C('#2f6a4a'), seed: 242, frame: fr, outline: 0.8 });
    for (const s of [-1, 1]) {
      const ex = sway * 0.5 + s * 8;
      eye(ctx, ex, -149, 5.4, { frame: fr, seed: 243 + s, white: '#fff6d8', pupil: '#1a1428', look: [0.3, 0.25] });
      ctx.save();
      ctx.strokeStyle = 'rgba(60,40,30,0.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(ex, -149, 8, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    blob(ctx, sway * 0.5 + 1, -134, 8, 2.1, { color: '#2a1428', seed: 246, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    // DENIED, faintly, on the forehead of the shade
    ctx.save();
    ctx.fillStyle = 'rgba(201,80,63,0.75)';
    ctx.font = '700 6px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DENIED', sway * 0.5, -163);
    ctx.restore();
  } else if (kind === 'warden') {
    const rage = !!st.enraged;
    // chimney + smoke
    slab(ctx, -42, -318, 84, 70, { color: C('#7d3a2b'), seed: 101, frame: fr });
    for (let i = 0; i < 4; i++) {
      const rise = ((fr + i * 3) % 12) / 12;
      blob(ctx, -10 + i * 12 + rise * 22, -330 - rise * 70, 16 + rise * 16, 12 + rise * 12, { color: rage ? '#5a3a3a' : '#c9bfd0', alpha: 0.6 * (1 - rise), seed: 102 + i, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    }
    // body of the kiln
    slab(ctx, -128, -262, 256, 262, { color: C('#9a4a35'), seed: 110, frame: fr, square: 4.4, wobble: 0.025 });
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 5; c++) {
        if (r >= 2 && r <= 4 && c >= 1 && c <= 3) continue; // leave the mouth area
        const bx = -112 + c * 46 + (r % 2) * 22;
        const by = -246 + r * 40;
        slab(ctx, bx, by, 40, 30, { color: C(hash(r, c, 1) < 0.5 ? '#a9553b' : '#8a402e'), seed: 120 + r * 7 + c, frame: fr, alpha: 0.55, outline: 0.8, tex: 0.3, noRim: true });
      }
    }
    // mouth
    blob(ctx, 0, -92, 74, 66, { color: '#2a0d10', seed: 130, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    glow(ctx, 0, -92, rage ? 150 : 110, rage ? '#ff4a1a' : '#ff8a2a', rage ? 0.95 : 0.8);
    for (let i = 0; i < 4; i++) {
      const fx = -34 + i * 23 + Math.sin(fr * 0.9 + i * 1.7) * 5;
      blob(ctx, fx, -70 - ((fr * 3 + i * 5) % 14), 12 + (i % 2) * 4, 22 + (i % 3) * 5, { color: i % 2 ? '#ffd04a' : '#ff8a2a', alpha: 0.85, seed: 140 + i, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    }
    for (let i = 0; i < 6; i++) {
      slab(ctx, -58 + i * 19, -150 + Math.abs(i - 2.5) * 2.4, 14, 22, { color: C('#e8d8b8'), seed: 150 + i, frame: fr, outline: 1, noRim: true });
    }
    for (let i = 0; i < 5; i++) {
      slab(ctx, -48 + i * 21, -62 - Math.abs(i - 2) * 2.4, 14, 18, { color: C('#e8d8b8'), seed: 160 + i, frame: fr, outline: 1, noRim: true });
    }
    // eyes + brow
    for (const s of [-1, 1]) {
      blob(ctx, s * 58, -200, 25, 23, { color: '#f4e6b8', seed: 170 + s, frame: fr, outline: 1.4 });
      blob(ctx, s * 58 + 4, -198, 11, 12, { color: rage ? '#ff2a10' : '#ff7a1a', seed: 172 + s, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
      blob(ctx, s * 58 + 5, -198, 4.5, 8, { color: '#1a0808', seed: 174 + s, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
      slab(ctx, s * 58 - 28, -228 + (s < 0 ? 4 : 0), 56, 13, { color: C('#7d3a2b'), seed: 176 + s, frame: fr, rot: s * (rage ? 0.25 : 0.1), outline: 1.2 });
    }
    // thumbprint crack
    ctx.save();
    ctx.strokeStyle = 'rgba(30,10,20,0.45)';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-96, -250);
    ctx.lineTo(-80, -220);
    ctx.lineTo(-92, -196);
    ctx.lineTo(-76, -168);
    ctx.stroke();
    ctx.restore();
    // arms
    const sw = Math.sin(fr * 0.45) * 7;
    limb(ctx, -118, -170, -176, -112 + sw, 18, 15, { color: C('#8a402e'), seed: 180, frame: fr });
    limb(ctx, 118, -170, 176, -112 - sw, 18, 15, { color: C('#8a402e'), seed: 181, frame: fr });
    hand(ctx, -184, -96 + sw, 20, C('#9a4a35'), 190, fr);
    hand(ctx, 184, -96 - sw, 20, C('#9a4a35'), 195, fr);
  }
  ctx.restore();
}
