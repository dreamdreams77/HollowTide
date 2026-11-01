// Puzzle logic, kept pure so it can be unit-tested.

import { mulberry32 } from '../engine/rng.js';

// ---- Lamp Lock: a 3x3 "press a lamp, flip it and its neighbours" puzzle. Goal: every lamp lit.
const NEIGHBOURS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];

export function pressLamp(grid, i) {
  const g = grid.slice();
  const x = i % 3;
  const y = Math.floor(i / 3);
  for (const [dx, dy] of NEIGHBOURS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < 3 && ny >= 0 && ny < 3) g[ny * 3 + nx] = !g[ny * 3 + nx];
  }
  return g;
}

export const isLit = (grid) => grid.every(Boolean);

// Start from "solved" and press random lamps, so a solution always exists.
export function scrambleLamps(seed, presses = 5) {
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < 50; attempt++) {
    let grid = Array(9).fill(true);
    const used = [];
    while (used.length < presses) {
      const i = Math.floor(rng() * 9);
      if (!used.includes(i)) {
        used.push(i);
        grid = pressLamp(grid, i);
      }
    }
    if (!isLit(grid)) return { grid, solution: used.sort((a, b) => a - b) };
  }
  throw new Error('could not scramble lamps');
}

// Smallest set of presses that solves a grid (pressing twice cancels, so each lamp is 0/1).
export function minimalSolution(grid) {
  let best = null;
  for (let mask = 0; mask < 512; mask++) {
    let g = grid;
    const set = [];
    for (let i = 0; i < 9; i++) {
      if (mask & (1 << i)) {
        g = pressLamp(g, i);
        set.push(i);
      }
    }
    if (isLit(g) && (!best || set.length < best.length)) best = set;
  }
  return best;
}

// ---- Four Signs: press the glyphs in the right order; a wrong one resets.
export class Sequence {
  constructor(order) {
    this.order = order;
    this.pos = 0;
  }
  input(sym) {
    if (sym === this.order[this.pos]) {
      this.pos += 1;
      if (this.pos === this.order.length) return 'done';
      return 'ok';
    }
    this.pos = 0;
    return 'wrong';
  }
  get pressed() {
    return this.order.slice(0, this.pos);
  }
}

export const SIGN_ORDER = ['mouth', 'hand', 'eye', 'tide'];
