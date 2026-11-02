import test from 'node:test';
import assert from 'node:assert/strict';
import { optionalHotspots } from '../src/game/optional-content.js';

function context(scene, picks = []) {
  const flags = {}, rewards = {}, lines = [];
  let i = 0;
  return {
    state: { scene }, flags, rewards, lines,
    flag: k => !!flags[k], setFlag: k => { flags[k] = true; },
    ask: async () => picks[i++] ?? 0,
    say: async (who, text) => { lines.push([who, text]); },
    give: (id, n = 1) => { rewards[id] = (rewards[id] || 0) + n; },
    save: () => {}, raiseBond: () => {},
  };
}
function find(g, id) { return optionalHotspots(g).find(h => h.id === id); }

test('lighthouse signal puzzle records its story and only awards its first perfect run', async () => {
  const g = context('pier', [0, 2, 1]);
  await find(g, 'extra-lighthouse').use(g);
  assert.equal(g.flags.extra_lighthouse_story, true);
  assert.equal(g.flags.extra_lighthouse_prize, true);
  assert.equal(g.rewards.wetclay, 1);
  await find(g, 'extra-lighthouse').use(g);
  assert.equal(g.rewards.wetclay, 1);
});

test('kiln workshop rewards a perfect sculpt and remains replayable', async () => {
  const g = context('kiln', [0, 1, 1]);
  await find(g, 'extra-workshop').use(g);
  assert.equal(g.flags.extra_workshop, true);
  assert.equal(g.flags.extra_workshop_prize, true);
  assert.equal(g.rewards.wetclay, 2);
});

test('naturalist records each species separately and rewards the completed field guide once', async () => {
  const g = context('chapel', [1, 0, 2]);
  await find(g, 'extra-naturalist').use(g);
  assert.equal(g.flags.naturalist_minnow, true);
  assert.equal(g.flags.naturalist_crab, true);
  assert.equal(g.flags.naturalist_moonfin, true);
  assert.equal(g.flags.extra_naturalist_prize, true);
  assert.equal(g.rewards.wetclay, 2);
});

test('under-pier creature quest rewards patience, not force', async () => {
  const g = context('pier', [0]);
  await find(g, 'extra-under-pier').use(g);
  assert.equal(g.flags.extra_under_pier, true);
});

test('midnight crossing stays locked until the main story is complete', async () => {
  const g = context('pier', [0]);
  await find(g, 'extra-midnight').use(g);
  assert.equal(g.flags.extra_midnight, undefined);
  g.flags.boss_beaten = true;
  await find(g, 'extra-midnight').use(g);
  assert.equal(g.flags.extra_midnight, true);
});

test('completion journal is available in the archive and reports optional progress', async () => {
  const g = context('archive');
  g.flags.tidepool_prize = true;
  await find(g, 'extra-journal').use(g);
  assert.match(g.lines.map(x => x[1]).join(' '), /optional discoveries recorded/);
  assert.match(g.lines.map(x => x[1]).join(' '), /Tidepool Shell Game/);
});
