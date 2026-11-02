import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENES } from '../src/game/scenes.js';

function miniGameContext(picks, random = 0) {
  const flags = {};
  const rewards = {};
  const lines = [];
  let choice = 0;
  return {
    flags, rewards, lines,
    say: async (who, text) => { lines.push([who, text]); },
    ask: async () => picks[choice++],
    rng: () => random,
    flag: (id) => !!flags[id],
    setFlag: (id) => { flags[id] = true; },
    give: (id, count = 1) => { rewards[id] = (rewards[id] || 0) + count; },
    toast: () => {},
  };
}

function hotspot(scene, id) {
  return SCENES[scene].hotspots().find((item) => item.id === id);
}

test('archive index-card game awards its one-time perfect score prize', async () => {
  const game = miniGameContext([0, 2, 1]);
  await hotspot('archive', 'index-cards').use(game);
  assert.equal(game.rewards.wetclay, 1);
  assert.equal(game.flags.index_cards_prize, true);
  assert.match(game.lines.at(-1)[1], /paperweights/);
});

test('archive index-card game does not award a prize for an imperfect run', async () => {
  const game = miniGameContext([0, 0, 1]);
  await hotspot('archive', 'index-cards').use(game);
  assert.equal(game.rewards.wetclay, undefined);
  assert.equal(game.flags.index_cards_prize, undefined);
});

test('pier shell game awards its one-time perfect score prize', async () => {
  const game = miniGameContext([0, 0, 0], 0.1);
  await hotspot('pier', 'tidepool').use(game);
  assert.equal(game.rewards.wetclay, 2);
  assert.equal(game.flags.tidepool_prize, true);
});

test('pier shell game can be replayed without duplicating its prize', async () => {
  const game = miniGameContext([0, 0, 0], 0.1);
  game.flags.tidepool_prize = true;
  await hotspot('pier', 'tidepool').use(game);
  assert.equal(game.rewards.wetclay, undefined);
  assert.match(game.lines.at(-1)[1], /all out of prizes/);
});

test('Slip’s skipping-stones game awards its one-time perfect score prize', async () => {
  const game = miniGameContext([1, 2, 0]);
  await hotspot('pier', 'stone-skip').use(game);
  assert.equal(game.rewards.wetclay, 1);
  assert.equal(game.flags.stone_skip_prize, true);
});

test('Slip’s skipping-stones game does not award a prize for a rough round', async () => {
  const game = miniGameContext([0, 0, 2]);
  await hotspot('pier', 'stone-skip').use(game);
  assert.equal(game.rewards.wetclay, undefined);
  assert.equal(game.flags.stone_skip_prize, undefined);
});

test('fishing records discovered species and awards a one-time Moonfin reward', async () => {
  const game = miniGameContext([2, 0, 0]);
  const rolls = [0.95, 0.1, 0.1];
  game.rng = () => rolls.shift();
  await hotspot('pier', 'fishing').use(game);
  assert.equal(game.flags.fishing_moonfin_seen, true);
  assert.equal(game.flags.fishing_minnow_seen, true);
  assert.equal(game.flags.moonfin_prize, true);
  assert.equal(game.rewards.wetclay, 1);
  assert.match(game.lines.at(-1)[1], /Silver Minnow/);
  assert.match(game.lines.at(-1)[1], /Moonfin/);
});

test('fishing replay does not award the Moonfin prize twice', async () => {
  const game = miniGameContext([2, 2, 2], 0.99);
  game.flags.moonfin_prize = true;
  game.flags.fishing_moonfin_seen = true;
  await hotspot('pier', 'fishing').use(game);
  assert.equal(game.rewards.wetclay, undefined);
  assert.match(game.lines.at(-2)[1], /Another Moonfin/);
});
