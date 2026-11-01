// Set dressing that lives *in the room* rather than on the backdrop: things a character can walk behind or in front of.
// Each prop draws itself with (0,0) at the middle of its base on the floor; the game sorts props in with the actors by
// that base line, so Marl disappears behind a crate when he walks past it and covers a stool when he walks in front.
// Heights are in the same units as the figures (an adult is about 120 tall at scale 1).

import { blob, slab, limb, glow, shadow, drawClay } from './clay.js';
import { hash } from './rng.js';

const base = (ctx, w) => shadow(ctx, 0, 3, w, 7, 0.28);

// a straight-edged lump (roofs, wedges): corners are given, edges are subdivided so the clay smoothing only rounds them
function poly(ctx, corners, o = {}) {
  const pts = [];
  corners.forEach((c, i) => {
    const n = corners[(i + 1) % corners.length];
    for (let k = 0; k < 4; k++) pts.push([c[0] + ((n[0] - c[0]) * k) / 4, c[1] + ((n[1] - c[1]) * k) / 4]);
  });
  drawClay(ctx, pts, o);
}

// half the width of each prop on the floor, so the game can tell when someone is standing behind it
export const PROP_W = { post: 14, crates: 44, cart: 52, stool: 20, confessional: 60, pew: 58, coalcart: 48, anvil: 22 };

export const PROPS = {
  // a mooring post with its turns of rope, and a loose end lying on the planks
  post(ctx, fr) {
    base(ctx, 24);
    slab(ctx, -12, -62, 24, 62, { color: '#4b3b45', seed: 9101, frame: fr, outline: 1, tex: 0.4, occlusion: 0.5, wobble: 0.02 });
    blob(ctx, 0, -63, 15, 7, { color: '#5e4a56', seed: 9102, frame: fr, outline: 0.9, occlusion: 0.4 });
    for (let i = 0; i < 3; i++) blob(ctx, 0, -24 - i * 11, 15.5, 5.2, { color: '#8a7a62', seed: 9103 + i, frame: fr, outline: 0.8, tex: 0.3, occlusion: 0.4 });
    limb(ctx, 10, -20, 34, -4, 3.4, 3, { color: '#8a7a62', seed: 9110, frame: fr, outline: 0.7, tex: 0.3 });
  },
  // two crates and a coil of rope; the top one is not quite square
  crates(ctx, fr) {
    base(ctx, 44);
    slab(ctx, -34, -34, 68, 34, { color: '#7a5a3a', seed: 9201, frame: fr, outline: 1.1, tex: 0.5, occlusion: 0.5, wobble: 0.02 });
    for (const x of [-22, 0, 22]) slab(ctx, x - 3, -32, 6, 30, { color: '#5e432a', seed: 9202 + x, frame: fr, outline: 0.5, noRim: true, alpha: 0.7 });
    slab(ctx, -22, -64, 46, 30, { color: '#8a6a44', seed: 9210, frame: fr, outline: 1.1, tex: 0.5, occlusion: 0.5, rot: -0.04 });
    for (const x of [-12, 8]) slab(ctx, x - 3, -62, 6, 26, { color: '#6a4c30', seed: 9211 + x, frame: fr, outline: 0.5, noRim: true, alpha: 0.7, rot: -0.04 });
    blob(ctx, 34, -8, 15, 8, { color: '#8a7a62', seed: 9220, frame: fr, outline: 0.9, tex: 0.3 });
    blob(ctx, 34, -9, 8, 4, { color: '#5e4a40', seed: 9221, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
  },
  // a book cart: shelves of tablets on two wheels and a long handle
  cart(ctx, fr) {
    base(ctx, 50);
    slab(ctx, -44, -34, 88, 22, { color: '#5a4636', seed: 9301, frame: fr, outline: 1.1, tex: 0.5, occlusion: 0.5 });
    for (let i = 0; i < 6; i++) slab(ctx, -40 + i * 13, -58 + (i % 3) * 2, 11, 24 - (i % 3) * 2, { color: ['#b9a58a', '#a8957a', '#c4b296'][i % 3], seed: 9310 + i, frame: fr, outline: 0.8, tex: 0.4, occlusion: 0.4, rot: (i - 2.5) * 0.015 });
    slab(ctx, -44, -36, 88, 4, { color: '#3a2c22', seed: 9320, frame: fr, outline: 0.6, noRim: true });
    for (const x of [-30, 30]) {
      blob(ctx, x, -10, 11, 11, { color: '#2e2630', seed: 9321 + x, frame: fr, outline: 1.1, occlusion: 0.4 });
      blob(ctx, x, -10, 3.6, 3.6, { color: '#8a7a8a', seed: 9323 + x, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    }
    limb(ctx, 44, -34, 66, -54, 3.2, 2.8, { color: '#3a2c22', seed: 9330, frame: fr, outline: 0.7 });
  },
  // a three-legged stool with a candle stub, because every archive has one
  stool(ctx, fr) {
    base(ctx, 20);
    for (const x of [-13, 0, 13]) limb(ctx, x * 0.8, -24, x * 1.25, 0, 3.4, 2.8, { color: '#5a4636', seed: 9401 + x, frame: fr, outline: 0.8 });
    blob(ctx, 0, -26, 20, 6, { color: '#7a5e44', seed: 9410, frame: fr, outline: 1, tex: 0.4, occlusion: 0.4 });
    blob(ctx, 4, -36, 4.6, 9, { color: '#eadfc4', seed: 9411, frame: fr, outline: 0.8, occlusion: 0.2 });
    glow(ctx, 4, -50, 26, '#ffc86a', 0.55);
    blob(ctx, 4, -47 - (fr & 1), 2.6, 5 + (fr % 3), { color: '#ffe08a', seed: 9412, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
  },
  // the confessional: one piece of driftwood, hollowed by something that was not a priest. About 132 wide, 172 tall.
  confessional(ctx, fr) {
    base(ctx, 64);
    // the body: two compartments, a door on the left and a grilled window on the right
    slab(ctx, -56, -140, 112, 140, { color: '#5b4a3c', seed: 9501, frame: fr, outline: 1.4, tex: 0.7, occlusion: 0.55, wobble: 0.015 });
    for (const x of [-18, 16]) slab(ctx, x - 1.5, -136, 3, 130, { color: '#3e3026', seed: 9505 + x, frame: fr, outline: 0.3, noRim: true, alpha: 0.55 }); // plank seams
    // a gabled roof with an overhang, and a crooked fish for a weathervane
    poly(ctx, [[-66, -134], [0, -160], [66, -134], [60, -126], [-60, -126]], { color: '#6a5646', seed: 9502, frame: fr, outline: 1.3, tex: 0.6, occlusion: 0.45, rot: -0.01 });
    slab(ctx, -62, -134, 124, 10, { color: '#4a3c30', seed: 9503, frame: fr, outline: 0.9, tex: 0.5, noRim: true });
    limb(ctx, 0, -157, 1, -168, 2.2, 1.8, { color: '#3e3026', seed: 9504, frame: fr, outline: 0.6 });
    blob(ctx, 7, -169, 9, 3.8, { color: '#7fd8d0', seed: 9506, frame: fr, outline: 0.7, gloss: 0.5, rot: -0.2 });
    // left: the door, a dark arch with the curtain half drawn across it
    slab(ctx, -46, -112, 34, 104, { color: '#120a18', seed: 9510, frame: fr, flat: true, outline: 0.8, noRim: true, gloss: 0 });
    blob(ctx, -29, -112, 17, 14, { color: '#120a18', seed: 9513, frame: fr, flat: true, outline: 0.8, noRim: true, gloss: 0 });
    slab(ctx, -48, -118, 20, 110, { color: '#7a3a4a', seed: 9511, frame: fr, outline: 1.1, tex: 0.5, occlusion: 0.4, wobble: 0.04 });
    for (let i = 0; i < 3; i++) slab(ctx, -46 + i * 6, -112, 1.6, 100, { color: '#4a1e2c', seed: 9514 + i, frame: fr, outline: 0.3, noRim: true, alpha: 0.7 }); // folds
    // right: the grille you speak through, with something warm breathing behind it
    slab(ctx, 10, -104, 34, 44, { color: '#120a18', seed: 9512, frame: fr, flat: true, outline: 0.9, noRim: true, gloss: 0 });
    glow(ctx, 27, -82, 34, '#7fd8d0', 0.3);
    for (let i = 0; i < 5; i++) slab(ctx, 13.5 + i * 6.4, -102, 2.4, 40, { color: '#a89478', seed: 9520 + i, frame: fr, outline: 0.4, noRim: true });
    slab(ctx, 8, -106, 38, 5, { color: '#7a6452', seed: 9525, frame: fr, outline: 0.7, noRim: true });
    // a little wooden step, and barnacles + a streak of kelp: it was underwater once
    slab(ctx, -50, -8, 100, 8, { color: '#4a3c30', seed: 9526, frame: fr, outline: 0.9, tex: 0.5 });
    for (let i = 0; i < 6; i++) blob(ctx, -50 + hash(9530, i) * 100, -12 - hash(9531, i) * 90, 2.4 + hash(9532, i) * 2, 2, { color: '#a8a08a', seed: 9540 + i, frame: fr, outline: 0.5, noRim: true, alpha: 0.7 });
    limb(ctx, 48, -130, 52 + Math.sin(fr * 0.25) * 2, -62, 3, 2, { color: '#2f7a66', seed: 9550, frame: fr, outline: 0.6, boil: 0.2 });
  },
  // a pew that gave up: one end on the floor, one propped on a drowned hymnal
  pew(ctx, fr) {
    base(ctx, 58);
    slab(ctx, -58, -30, 116, 12, { color: '#6a5646', seed: 9601, frame: fr, outline: 1, tex: 0.6, occlusion: 0.4, rot: -0.03 });
    slab(ctx, -58, -52, 116, 10, { color: '#5b4a3c', seed: 9602, frame: fr, outline: 1, tex: 0.6, occlusion: 0.4, rot: -0.03 });
    for (const x of [-48, 0, 46]) slab(ctx, x - 4, -34, 8, 34, { color: '#4a3c30', seed: 9610 + x, frame: fr, outline: 0.8, tex: 0.5 });
    blob(ctx, 30, -6, 10, 6, { color: '#7a6a8a', seed: 9620, frame: fr, outline: 0.9, tex: 0.3 });
    limb(ctx, -52, -22, -62, -4, 3, 2, { color: '#2f7a66', seed: 9621, frame: fr, outline: 0.6, boil: 0.2 });
  },
  // a coal cart with a glow in it
  coalcart(ctx, fr) {
    base(ctx, 50);
    slab(ctx, -42, -46, 84, 34, { color: '#3a2e34', seed: 9701, frame: fr, outline: 1.2, tex: 0.5, occlusion: 0.5, wobble: 0.02 });
    for (let i = 0; i < 7; i++) blob(ctx, -34 + i * 11.5, -50 - (i % 3) * 3, 8 + (i % 2) * 2, 6, { color: i % 3 ? '#1e1820' : '#2a2128', seed: 9710 + i, frame: fr, outline: 0.8, occlusion: 0.3 });
    glow(ctx, 0, -52, 44, '#ff7a2a', 0.5);
    for (let i = 0; i < 3; i++) blob(ctx, -16 + i * 16, -54 - ((fr * 2 + i * 3) % 9), 3, 3, { color: '#ffb04a', seed: 9720 + i, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0, alpha: 0.9 });
    for (const x of [-28, 28]) blob(ctx, x, -10, 11, 11, { color: '#2a2128', seed: 9730 + x, frame: fr, outline: 1.1, occlusion: 0.4 });
    limb(ctx, -42, -44, -64, -62, 3.2, 2.8, { color: '#2a2128', seed: 9740, frame: fr, outline: 0.7 });
  },
  // an anvil on a stump, black as a bad mood
  anvil(ctx, fr) {
    base(ctx, 34);
    slab(ctx, -16, -26, 32, 26, { color: '#5a4636', seed: 9801, frame: fr, outline: 1.1, tex: 0.6, occlusion: 0.5 });
    slab(ctx, -20, -42, 40, 16, { color: '#2e2a36', seed: 9802, frame: fr, outline: 1.2, tex: 0.3, occlusion: 0.4, gloss: 0.6 });
    blob(ctx, 26, -38, 14, 6, { color: '#2e2a36', seed: 9803, frame: fr, outline: 1, gloss: 0.6 });
    slab(ctx, -14, -49, 28, 8, { color: '#3a3644', seed: 9804, frame: fr, outline: 1, gloss: 0.7, noRim: true });
    glow(ctx, 0, -46, 26, '#ff7a2a', 0.2);
  },
};
