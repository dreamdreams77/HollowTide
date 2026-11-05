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
export const PROP_W = { post: 14, crates: 44, cart: 52, stool: 20, confessional: 60, pew: 58, coalcart: 48, anvil: 22, fishrod: 26, flatstones: 34, shells: 40, signal: 24, underpier: 30, ferrylamp: 22, cards: 34, clock: 26, journal: 24, bottles: 32, tidepoolnote: 32, memorybox: 28, garden: 34, clayworkbench: 34 };

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
  // Brine's fishing spot: a rod propped on a little bucket, the line dipping toward the water
  fishrod(ctx, fr) {
    base(ctx, 26);
    blob(ctx, -12, -9, 11, 10, { color: '#6a5a4a', seed: 9501, frame: fr, outline: 1, tex: 0.4, occlusion: 0.5 });
    blob(ctx, -12, -17, 10, 3.4, { color: '#2e2630', seed: 9502, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    limb(ctx, -14, -8, 22, -58, 3.2, 1.6, { color: '#8a6a44', seed: 9503, frame: fr, outline: 0.8, tex: 0.4 });
    limb(ctx, 22, -58, 30 + (fr % 2), -14, 0.8, 0.8, { color: '#e6dcc4', seed: 9504, frame: fr, outline: 0.3, noRim: true, alpha: 0.85 });
    blob(ctx, 30 + (fr % 2), -11, 3.4, 3.4, { color: '#d9553a', seed: 9505, frame: fr, outline: 0.7, occlusion: 0.2 });
  },
  // Slip's skipping stones: a little stack of flat pebbles and one ready to throw
  flatstones(ctx, fr) {
    base(ctx, 34);
    blob(ctx, 0, -6, 26, 7, { color: '#7a7488', seed: 9601, frame: fr, outline: 1, tex: 0.4, occlusion: 0.5 });
    blob(ctx, -2, -13, 20, 6, { color: '#8e889c', seed: 9602, frame: fr, outline: 1, tex: 0.4, occlusion: 0.4 });
    blob(ctx, 2, -19, 14, 5, { color: '#a49eb0', seed: 9603, frame: fr, outline: 0.9, tex: 0.3, occlusion: 0.3 });
    blob(ctx, 30, -4, 11, 4, { color: '#8e889c', seed: 9604, frame: fr, outline: 0.9, tex: 0.4, occlusion: 0.4, rot: 0.1 });
  },
  // the tidepool shell game: three shells in a ring of ripples, one nudged a little by the water
  shells(ctx, fr) {
    for (const [w, a] of [[40, 0.35], [30, 0.5]]) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#cfe0e8';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, -2, w + (fr % 3), w * 0.28 + (fr % 3) * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    [[-22, '#d9a77a'], [0, '#e6c4a0'], [22, '#c98f6a']].forEach(([x, c], i) => {
      blob(ctx, x, -8 - (i === 1 ? fr % 2 : 0), 12, 9, { color: c, seed: 9701 + i, frame: fr, outline: 1, tex: 0.3, occlusion: 0.4 });
      for (const k of [-4, 0, 4]) limb(ctx, x + k * 0.5, -3, x + k, -14, 1, 0.8, { color: '#a07a56', seed: 9710 + i * 3 + k, frame: fr, outline: 0.2, noRim: true, alpha: 0.6 });
    });
  },
  // keeper's signal shutter: a lantern with a slatted shutter on a short post, glowing in a slow code
  signal(ctx, fr) {
    base(ctx, 22);
    slab(ctx, -5, -34, 10, 34, { color: '#4b3b45', seed: 9801, frame: fr, outline: 0.9, tex: 0.4, occlusion: 0.5 });
    slab(ctx, -15, -66, 30, 32, { color: '#6a5a4a', seed: 9802, frame: fr, outline: 1, tex: 0.4, occlusion: 0.5 });
    glow(ctx, 0, -50, 34, '#ffc86a', fr % 4 < 2 ? 0.55 : 0.2);
    for (const y of [-60, -52, -44]) slab(ctx, -12, y, 24, 3.5, { color: '#2e2630', seed: 9803 + y, frame: fr, outline: 0.3, noRim: true, alpha: 0.8 });
    blob(ctx, 0, -68, 17, 5, { color: '#7a5e44', seed: 9810, frame: fr, outline: 0.9, occlusion: 0.3 });
  },
  // something under the pier: two pale eyes and a curious bump of a head, peeking over the planks' edge
  underpier(ctx, fr) {
    shadow(ctx, 0, 2, 26, 6, 0.35);
    blob(ctx, 0, -10, 26, 14, { color: '#6c7f8a', seed: 9901, frame: fr, outline: 1, tex: 0.4, occlusion: 0.5 });
    for (const x of [-9, 9]) {
      blob(ctx, x, -14, 5.5, 5.5, { color: '#f4efe0', seed: 9902 + x, frame: fr, outline: 0.7, occlusion: 0.2 });
      blob(ctx, x + (fr % 2 ? 1 : -1), -14, 2.2, 2.6, { color: '#2e2630', seed: 9904 + x, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    }
    glow(ctx, 0, -12, 30, '#9ad6e6', 0.14);
  },
  // the midnight crossing: a mooring lamp with a coil of ferry rope, lit a pale ghostly blue
  ferrylamp(ctx, fr) {
    base(ctx, 22);
    limb(ctx, 0, 0, 0, -58, 3.4, 2.6, { color: '#3a2c22', seed: 9951, frame: fr, outline: 0.9 });
    slab(ctx, -8, -76, 16, 20, { color: '#8fb6c8', seed: 9952, frame: fr, outline: 0.9, occlusion: 0.3 });
    glow(ctx, 0, -66, 36, '#9ad6ff', 0.4 + (fr % 3) * 0.05);
    blob(ctx, 14, -5, 12, 6, { color: '#8a7a62', seed: 9953, frame: fr, outline: 0.9, tex: 0.3 });
    blob(ctx, 14, -6, 6, 3, { color: '#5e4a40', seed: 9954, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
  },
  // Hueso's loose index cards: a fan of cream cards and a few that fell on the floor
  cards(ctx, fr) {
    base(ctx, 34);
    for (let i = 0; i < 5; i++) slab(ctx, -26 + i * 11, -22 + (i % 2) * 2, 14, 22, { color: ['#ebe0c8', '#e0d4b8', '#f2e8d2'][i % 3], seed: 11001 + i, frame: fr, outline: 0.8, tex: 0.3, occlusion: 0.3, rot: (i - 2) * 0.2 });
    slab(ctx, 22, -4, 14, 6, { color: '#e0d4b8', seed: 11010, frame: fr, outline: 0.7, tex: 0.3, rot: 0.3 });
    slab(ctx, -34, -4, 12, 5, { color: '#ebe0c8', seed: 11011, frame: fr, outline: 0.7, tex: 0.3, rot: -0.2 });
  },
  // the clockmaker's stopped clock: a tall case, a face with hands that do not move, a hanging pendulum
  clock(ctx, fr) {
    base(ctx, 26);
    slab(ctx, -16, -92, 32, 92, { color: '#5a4636', seed: 12001, frame: fr, outline: 1.1, tex: 0.5, occlusion: 0.5 });
    blob(ctx, 0, -72, 12, 12, { color: '#e8dcc0', seed: 12002, frame: fr, outline: 0.9, occlusion: 0.2 });
    limb(ctx, 0, -72, 0, -80, 1.4, 1, { color: '#2e2630', seed: 12003, frame: fr, outline: 0.3, noRim: true });
    limb(ctx, 0, -72, 6, -69, 1.4, 1, { color: '#2e2630', seed: 12004, frame: fr, outline: 0.3, noRim: true });
    slab(ctx, -9, -50, 18, 40, { color: '#3a2c22', seed: 12005, frame: fr, outline: 0.6, noRim: true, alpha: 0.7 });
    limb(ctx, 0, -48, 0, -22, 1, 1, { color: '#b79a5a', seed: 12006, frame: fr, outline: 0.3, noRim: true });
    blob(ctx, 0, -22, 5, 5, { color: '#b79a5a', seed: 12007, frame: fr, outline: 0.7, occlusion: 0.2 });
  },
  // the completion journal: a big open book on a lectern with a ribbon marker
  journal(ctx, fr) {
    base(ctx, 24);
    limb(ctx, 0, 0, 0, -34, 4.4, 3.6, { color: '#5a4636', seed: 13001, frame: fr, outline: 0.9 });
    slab(ctx, -22, -52, 44, 20, { color: '#7a3a3a', seed: 13002, frame: fr, outline: 1, tex: 0.4, occlusion: 0.5, rot: -0.05 });
    slab(ctx, -19, -55, 18, 17, { color: '#eadfc4', seed: 13003, frame: fr, outline: 0.7, tex: 0.3, rot: -0.05 });
    slab(ctx, 1, -55, 18, 17, { color: '#f2e8d2', seed: 13004, frame: fr, outline: 0.7, tex: 0.3, rot: -0.05 });
    limb(ctx, 0, -40, 3, -26, 1.8, 1.2, { color: '#d9553a', seed: 13005, frame: fr, outline: 0.3, noRim: true });
  },
  // messages in bottles: a little heap of green glass bottles, each with a curled scroll inside
  bottles(ctx, fr) {
    base(ctx, 32);
    [[-18, 0.1], [0, -0.05], [18, 0.15]].forEach(([x, r], i) => {
      blob(ctx, x, -14, 8, 14, { color: ['#7fb59a', '#6aa58a', '#8fc5a8'][i], seed: 14001 + i, frame: fr, outline: 0.9, occlusion: 0.2, rot: r });
      blob(ctx, x + r * 10, -30, 3.2, 5, { color: '#7fb59a', seed: 14005 + i, frame: fr, outline: 0.8 });
      blob(ctx, x, -14, 3, 8, { color: '#eadfc4', seed: 14009 + i, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0, alpha: 0.85 });
    });
  },
  // tidepool naturalist: a shallow pool with a little notebook and a magnifier beside it
  tidepoolnote(ctx, fr) {
    shadow(ctx, 0, 2, 32, 7, 0.25);
    blob(ctx, 0, -3, 28, 8, { color: '#4a7a8a', seed: 15001, frame: fr, outline: 1, tex: 0.4, occlusion: 0.4 });
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#cfe0e8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(-6, -4, 8 + (fr % 3), 2.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    slab(ctx, 22, -14, 16, 12, { color: '#eadfc4', seed: 15002, frame: fr, outline: 0.8, tex: 0.3, rot: 0.15 });
    blob(ctx, 32, -6, 5, 5, { color: '#b79a5a', seed: 15003, frame: fr, outline: 0.8, occlusion: 0.2 });
    limb(ctx, 35, -3, 40, 4, 1.4, 1.2, { color: '#5a4636', seed: 15004, frame: fr, outline: 0.4 });
  },
  // the house that remembers: a dollhouse-sized cottage with a warm lit window and a tiny door
  memorybox(ctx, fr) {
    base(ctx, 28);
    slab(ctx, -22, -40, 44, 40, { color: '#a58a6a', seed: 16001, frame: fr, outline: 1.1, tex: 0.5, occlusion: 0.5 });
    poly(ctx, [[-28, -40], [28, -40], [0, -62]], { color: '#7a3a3a', seed: 16002, frame: fr, outline: 1, tex: 0.4, occlusion: 0.4 });
    glow(ctx, -8, -24, 22, '#ffc86a', 0.55);
    slab(ctx, -14, -30, 12, 12, { color: '#ffe08a', seed: 16003, frame: fr, flat: true, outline: 0.6, noRim: true, gloss: 0 });
    slab(ctx, 6, -22, 10, 22, { color: '#5e432a', seed: 16004, frame: fr, outline: 0.7, noRim: true });
  },
  // the garden of lost things: a tiny fenced bed with a mitten, a button and a paper star
  garden(ctx, fr) {
    base(ctx, 34);
    blob(ctx, 0, -6, 32, 9, { color: '#4a3a30', seed: 17001, frame: fr, outline: 1, tex: 0.5, occlusion: 0.5 });
    for (let i = 0; i < 5; i++) slab(ctx, -30 + i * 14, -22, 4, 18, { color: '#8a6a44', seed: 17010 + i, frame: fr, outline: 0.7, tex: 0.4 });
    limb(ctx, -30, -16, 30, -16, 2, 2, { color: '#8a6a44', seed: 17020, frame: fr, outline: 0.6 });
    blob(ctx, -16, -9, 7, 5, { color: '#c0573a', seed: 17030, frame: fr, outline: 0.8, occlusion: 0.3 });
    blob(ctx, 2, -8, 4, 4, { color: '#e8dcc0', seed: 17031, frame: fr, outline: 0.7, occlusion: 0.2 });
    blob(ctx, 18, -10, 6, 6, { color: '#f2d680', seed: 17032, frame: fr, outline: 0.7, occlusion: 0.2, rot: 0.4 });
  },
  // the kilnwright's workshop: a low bench with a lump of clay, a little figure half-shaped, and a pair of tools
  clayworkbench(ctx, fr) {
    base(ctx, 34);
    slab(ctx, -32, -30, 64, 8, { color: '#7a5a3a', seed: 18001, frame: fr, outline: 1, tex: 0.5, occlusion: 0.5 });
    for (const x of [-26, 24]) slab(ctx, x - 3, -22, 6, 22, { color: '#5e432a', seed: 18002 + x, frame: fr, outline: 0.7, tex: 0.4 });
    blob(ctx, -10, -40, 12, 10, { color: '#a8703a', seed: 18005, frame: fr, outline: 1, tex: 0.4, occlusion: 0.4 });
    blob(ctx, 12, -42, 6, 8, { color: '#c4895a', seed: 18006, frame: fr, outline: 0.9, occlusion: 0.3 });
    blob(ctx, 12, -52, 4, 4, { color: '#c4895a', seed: 18007, frame: fr, outline: 0.8, occlusion: 0.2 });
    limb(ctx, 26, -34, 34, -46, 1.8, 1.4, { color: '#8a7a8a', seed: 18008, frame: fr, outline: 0.5 });
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
