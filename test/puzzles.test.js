import test from 'node:test';
import assert from 'node:assert/strict';
import { pressLamp, scrambleLamps, isLit, minimalSolution, Sequence, SIGN_ORDER } from '../src/game/puzzles.js';

test('pressing a lamp twice is a no-op', () => {
  const g = Array(9).fill(true);
  for (let i = 0; i < 9; i++) assert.deepEqual(pressLamp(pressLamp(g, i), i), g);
});

test('corner press flips 3 lamps, centre flips 5', () => {
  const g = Array(9).fill(true);
  assert.equal(pressLamp(g, 0).filter((x) => !x).length, 3);
  assert.equal(pressLamp(g, 4).filter((x) => !x).length, 5);
});

test('every scramble is solvable, and not already solved', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const { grid, solution } = scrambleLamps(seed, 5);
    assert.equal(isLit(grid), false);
    let g = grid;
    for (const i of solution) g = pressLamp(g, i);
    assert.equal(isLit(g), true, `seed ${seed}`);
    const min = minimalSolution(grid);
    assert.ok(min && min.length <= solution.length);
  }
});

test('the shipped puzzle (seed 17) takes at least 3 presses', () => {
  const { grid } = scrambleLamps(17, 5);
  assert.ok(minimalSolution(grid).length >= 3);
});

test('sign sequence: right order completes, a wrong sign resets', () => {
  const s = new Sequence(SIGN_ORDER);
  assert.equal(s.input('mouth'), 'ok');
  assert.equal(s.input('hand'), 'ok');
  assert.equal(s.input('tide'), 'wrong');
  assert.equal(s.pos, 0);
  for (const sym of SIGN_ORDER.slice(0, 3)) assert.equal(s.input(sym), 'ok');
  assert.equal(s.input('tide'), 'done');
});
