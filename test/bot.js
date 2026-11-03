// Shared headless bot: plays the game with no canvas (title -> pier -> archive -> chapel -> kiln -> ending).

import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { minimalSolution } from '../src/game/puzzles.js';
import { botCommand } from './helpers.js';

export const tick = () => new Promise((r) => setImmediate(r));

export function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

export class Bot {
  constructor(opts = {}) {
    this.g = new Game({ sound: null, storage: memoryStorage() });
    this.choice = opts.choice ?? 0;
    this.noFight = !!opts.noFight; // refuse to act in battle (to test defeat)
    this.errors = [];
    const orig = console.error;
    console.error = (...a) => {
      this.errors.push(a.map(String).join(' '));
      orig(...a);
    };
    this._restore = () => (console.error = orig);
    this.frames = 0;
  }
  done() {
    this._restore();
  }
  // advance the world one small step, reacting to whatever the game wants
  async step() {
    const g = this.g;
    if (g.choice) g.pick(g.choice.prompt.startsWith('What does Marl do') ? this.choice : 0);
    else if (g.dialogue) g.advance();
    else if (g.mode === 'puzzle' && g.puzzle && !g.puzzle.solved) {
      for (const i of minimalSolution(g.puzzle.grid)) g.pressLampCell(i);
    } else if (g.mode === 'battle' && g.bv) {
      const bv = g.bv;
      if (bv.result) bv.leave();
      else if (!this.noFight && bv.b.current && !bv.b.result) {
        const a = bv.b.current;
        if (!bv.b.command(a, botCommand(bv.b, a))) bv.b.command(a, { type: 'attack' });
      }
    }
    g.update(0.05);
    this.frames++;
    if (this.frames % 4 === 0) await tick();
    else await Promise.resolve();
  }
  async until(pred, max = 200000) {
    for (let i = 0; i < max; i++) {
      if (pred()) return true;
      await this.step();
    }
    const g = this.g;
    throw new Error(
      `timed out waiting (scene=${g.state.scene} mode=${g.mode} script=${g.script} dialogue=${!!g.dialogue} choice=${!!g.choice} ` +
        `ending=${!!g.ending} fade=${g.fade.a.toFixed(2)}->${g.fade.to} resolve=${!!g.fade.resolve} waits=${g.waits.length} bv=${!!g.bv} walk=${!!g.walk} ` +
        `flags=${Object.keys(g.state.flags).slice(-4).join(',')})`
    );
  }
  async idle() {
    await this.until(() => !this.g.script && !this.g.walk && !this.g.dialogue && this.g.mode === 'explore' && !this.g.fade.resolve && this.g.fade.a < 0.01);
  }
  // Interact with a hotspot and wait for its script to finish. Instant scripts (a wrong glyph, a one-liner) can
  // start and end between two bot ticks, so we watch the synchronous `seen` flag instead of `script`.
  async interact(id) {
    await this.idle();
    const g = this.g;
    const h = g.hotspots().find((x) => x.id === id);
    assert.ok(h, `hotspot ${id} exists in ${g.state.scene}`);
    g.state.seen[id] = false;
    g.interact(h);
    await this.until(() => g.state.seen[id] === true);
  }
  async use(id) {
    await this.interact(id);
    await this.idle();
  }
}

// `full` walks the optional road as well: the father conversation, the log, the ferry, Hueso's form and thumb, the
// confessional, every deduction. `named` then speaks the Warden's name instead of fighting him.
export async function playToKiln(bot, { full = false } = {}) {
  const g = bot.g;
  g.newGame();
  await bot.idle();
  assert.equal(g.state.scene, 'pier');
  await bot.use('wall');
  await bot.use('barrel');
  await bot.use('npc-brine');
  assert.ok(g.hasItem('brassthumb'));
  if (full) {
    await bot.use('lighthouse');
    assert.ok(g.hasClue('keepers_log'), 'the log is in the lamp room');
    assert.ok(g.hasItem('brineflask'));
  }
  await bot.use('npc-ochre');
  assert.ok(g.inParty('ochre'));
  if (full) {
    await bot.use('ferry');
    assert.ok(g.flag('ochre_rust') && g.bond('ochre') === 2, 'asked about Rust');
  }
  await bot.use('hatch');
  await bot.until(() => g.state.scene === 'archive');
  await bot.idle();
  await bot.use('rack');
  await bot.use('desk');
  if (full) {
    // Hueso: meet, form, thumb (three separate visits)
    await bot.use('npc-hueso');
    assert.ok(g.flag('met_hueso'));
    await bot.use('npc-hueso');
    assert.ok(g.flag('forms_filed') && g.flag('hueso_trust'), 'filled in Form 41-B honestly');
    assert.ok(g.state.glazes.includes('quicken'));
    assert.equal(g.state.inv.coldslip, 2);
    await bot.use('npc-hueso');
    assert.ok(g.hasClue('hueso_file'), 'showed him the thumb');
    // up the stairs to tell Brine what the ledger says, then back down
    await bot.use('stairs');
    await bot.until(() => g.state.scene === 'pier');
    await bot.idle();
    await bot.use('npc-brine');
    assert.ok(g.flag('brine_father'));
    await bot.use('hatch');
    await bot.until(() => g.state.scene === 'archive');
    await bot.idle();
  }
  await bot.use('panel');
  assert.ok(g.flag('lamps_lit'), 'lamp puzzle solved');
  await bot.use('jar');
  assert.ok(g.inParty('slip'));
  assert.ok(g.flag('guild_beaten'));
  await bot.use('vault'); // press thumb
  assert.ok(g.flag('vault_open'));
  await bot.use('vault'); // walk through
  await bot.until(() => g.state.scene === 'chapel');
  await bot.idle();
  await bot.use('mural');
  await bot.use('bowl');
  if (full) {
    await bot.use('confessional');
    assert.equal(g.state.fear, 'unmade');
    assert.ok(g.hasClue('slip_memory'));
    assert.ok(g.state.glazes.includes('crackle'));
  }
  // wrong order first: should reset, not progress
  await bot.use('tile-tide');
  assert.equal(g.state.signPos, 0);
  for (const k of ['mouth', 'hand', 'eye', 'tide']) {
    await bot.use('tile-' + k);
  }
  assert.ok(g.flag('eels_beaten'), 'eels fought');
  assert.ok(g.flag('gate_open'), 'gate opened');
  if (full) {
    // the journal: tie notes together yourself
    g.openMenu('journal');
    g.selectClue('same_thumb');
    g.selectClue('ledger');
    assert.ok(g.deduced('pressed'), 'tapping two notes in a row connects them');
    for (const [a, b] of [['tide_chart', 'ledger'], ['keepers_log', 'hueso_file'], ['hueso_file', 'same_thumb'], ['four_signs', 'slip_memory']]) assert.ok(g.connect(a, b), `${a}+${b}`);
    g.closeMenu();
    assert.equal(g.state.deduced.length, 5);
  }
  await bot.interact('gate'); // the kiln script (boss + ending) keeps running, so don't wait for idle
  await bot.until(() => g.state.scene === 'kiln');
}

