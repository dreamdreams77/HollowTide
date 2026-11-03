// Regression tests for the release pass: softlocks, retreat, hints, settings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { nextHint, looseThreads } from '../src/game/hints.js';
import { Bot, playToKiln, memoryStorage } from './bot.js';

test('Continue after an ending returns to the last door, and a different ending can be chosen', { timeout: 120000 }, async () => {
  const bot = new Bot({ choice: 0 });
  try {
    await playToKiln(bot);
    const g = bot.g;
    await bot.until(() => g.ending && g.ending.t > 3.2);
    assert.equal(g.ending.key, 'The Long Sleep');
    g.toTitle();
    assert.deepEqual(g.endingsSeen, ['The Long Sleep']);
    const g2 = new Game({ sound: null, storage: g.storage });
    assert.deepEqual(g2.endingsSeen, ['The Long Sleep'], 'endings found survive a reload');
    g2.continueGame();
    bot.g = g2;
    bot.choice = 1;
    await bot.until(() => g2.ending && g2.ending.t > 3.2);
    assert.equal(g2.ending.key, 'The Waking');
    g2.toTitle();
    assert.equal(g2.endingsSeen.length, 2);
  } finally {
    bot.done();
  }
});

test('a save made mid-ending (right after the Warden falls) resumes at the choice', { timeout: 120000 }, async () => {
  const bot = new Bot({ choice: 2 });
  try {
    await playToKiln(bot);
    const g = bot.g;
    await bot.until(() => g.choice && g.choice.prompt.startsWith('What does Marl do'));
    const g2 = new Game({ sound: null, storage: g.storage });
    g2.continueGame();
    assert.equal(g2.state.scene, 'kiln');
    assert.ok(g2.flag('boss_beaten'));
    bot.g = g2;
    await bot.until(() => g2.choice && g2.choice.prompt.startsWith('What does Marl do'));
    assert.ok(g2.choice.options.includes('Not yet'));
    assert.ok(g2.hotspots().some((h) => h.id === 'back'), 'the kiln has a way out');
  } finally {
    bot.done();
  }
});

test('"Not yet" at the last door walks back to the chapel, and the door is still there', { timeout: 120000 }, async () => {
  const bot = new Bot({ choice: 3 }); // index 3 is "Not yet" when the fourth ending is not unlocked
  try {
    await playToKiln(bot);
    const g = bot.g;
    await bot.until(() => g.state.scene === 'chapel' && g.flag('boss_beaten'));
    await bot.idle();
    bot.choice = 0;
    await bot.interact('gate');
    await bot.until(() => g.ending && g.ending.t > 3.2);
    assert.equal(g.ending.key, 'The Long Sleep');
  } finally {
    bot.done();
  }
});

test('the vault will not open while Slip is still in his jar', { timeout: 60000 }, async () => {
  const bot = new Bot();
  try {
    const g = bot.g;
    g.newGame();
    await bot.idle();
    Object.assign(g.state.flags, { intro_done: true, archive_seen: true, lamps_lit: true });
    g.state.scene = 'archive';
    g.loadScene('archive');
    await bot.idle();
    await bot.use('vault');
    assert.ok(!g.flag('vault_open'));
    assert.ok(!g.inParty('slip'));
    await bot.use('jar');
    assert.ok(g.inParty('slip'));
    await bot.use('vault');
    assert.ok(g.flag('vault_open'));
  } finally {
    bot.done();
  }
});

test('losing to the Warden: step back, get coaching and flasks once, and the chapel still has wanderers to fight', { timeout: 120000 }, async () => {
  const bot = new Bot();
  try {
    const g = bot.g;
    g.newGame();
    await bot.idle();
    Object.assign(g.state.flags, { intro_done: true, eels_beaten: true, gate_open: true, chapel_seen: true, warden_met: true });
    g.state.scene = 'chapel';
    g.loadScene('chapel');
    await bot.idle();
    assert.ok(g.scene.danger(g), 'wanderers while the Warden stands');
    g.state.losses = { kiln_warden: 1 };
    g.state.inv.brineflask = 0;
    g.loadScene('kiln');
    g.run(async () => g.scene.enter(g));
    await bot.until(() => g.choice);
    assert.ok(g.choice.options.includes('Step back'));
    assert.ok(g.flag('kiln_coached'));
    assert.equal(g.state.inv.brineflask, 2);
    g.pick(g.choice.options.length - 1);
    await bot.until(() => g.state.scene === 'chapel');
    await bot.idle();
    assert.ok(g.hotspots().some((h) => h.id === 'gate'));
  } finally {
    bot.done();
  }
});

test('hints: always something to say, never about a room you have not been in', { timeout: 120000 }, async () => {
  const bot = new Bot();
  try {
    const g = bot.g;
    g.newGame();
    await bot.idle();
    assert.match(nextHint(g).text, /Brine/);
    assert.ok(looseThreads(g).every((t) => t.where === 'Pier'), 'only pier threads before leaving the pier');
    await playToKiln(bot).catch(() => {});
    const h = nextHint(g);
    assert.ok(h.text.length > 20 && h.where);
    for (const flags of [{}, { met_brine: 1 }, { met_brine: 1, ochre_joined: 1 }, { met_brine: 1, ochre_joined: 1, husks_beaten: 1 }, { husks_beaten: 1, lamps_lit: 1 }, { husks_beaten: 1, lamps_lit: 1, slip_joined: 1 }, { husks_beaten: 1, lamps_lit: 1, slip_joined: 1, vault_open: 1 }, { vault_open: 1, slip_joined: 1, lamps_lit: 1, gate_open: 1 }, { gate_open: 1, boss_beaten: 1 }]) {
      const fake = { flag: (k) => !!flags[k], hasClue: () => false, state: { losses: {} }, pendingCount: () => 0 };
      assert.ok(nextHint(fake).text, JSON.stringify(flags));
    }
  } finally {
    bot.done();
  }
});

test('settings persist, text speed applies, and New Game asks before erasing a save', () => {
  const store = memoryStorage();
  const g = new Game({ sound: null, storage: store });
  g.setSetting('textSpeed', 3);
  g.setSetting('calm', true);
  const g2 = new Game({ sound: null, storage: store });
  assert.equal(g2.settings.textSpeed, 3);
  assert.equal(g2.settings.calm, true);
  assert.equal(g2.settings.sound, true);
  // instant text
  g2.newGame();
  g2.debugJump('pier', { intro_done: true });
  g2.run(async () => {
    await g2.say('narr', 'Hello there, little thumb.');
  });
  return new Promise((r) => setImmediate(r)).then(() => {
    g2.update(0.016);
    assert.ok(g2.dialogue.done, 'instant text is done at once');
    g2.save();
    const g3 = new Game({ sound: null, storage: store });
    assert.ok(g3.hasSave());
    g3.requestNewGame();
    assert.equal(g3.mode, 'title', 'first press only asks');
    g3.requestNewGame();
    assert.equal(g3.mode, 'explore', 'second press starts over');
  });
});

test('choices can be made from the keyboard: numbers, arrows and Enter', async () => {
  const g = new Game({ sound: null, storage: memoryStorage() });
  g.newGame();
  g.debugJump('pier', { intro_done: true });
  let got = null;
  g.run(async () => {
    got = await g.ask('?', ['a', 'b', 'c', 'd', 'e']);
  });
  await new Promise((r) => setImmediate(r));
  g.key('ArrowDown');
  g.key('ArrowDown');
  g.key('Enter');
  await new Promise((r) => setImmediate(r));
  assert.equal(got, 2);
  g.run(async () => {
    got = await g.ask('?', ['a', 'b', 'c', 'd', 'e']);
  });
  await new Promise((r) => setImmediate(r));
  g.key('5');
  await new Promise((r) => setImmediate(r));
  assert.equal(got, 4);
});
