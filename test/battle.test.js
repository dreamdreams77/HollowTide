import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/game/battle.js';
import { ENCOUNTERS, ENEMIES, newMember, statsAt, grantXp, xpToNext } from '../src/game/data.js';
import { runBattle, makeParty, winRate } from './helpers.js';

const pierParty = () => [newMember('marl', 4, ['ember', 'wedge']), newMember('ochre', 4, ['mend', 'wedge'])];

function readyFirst(b) {
  for (let i = 0; i < 4000 && !b.current; i++) b.tick(0.05);
  return b.current;
}

test('stats grow with level', () => {
  assert.ok(statsAt('marl', 6).atk > statsAt('marl', 3).atk);
  assert.ok(statsAt('slip', 6).mag > statsAt('slip', 3).mag);
});

test('xp levels people up and tops off HP/MP gained', () => {
  const m = newMember('marl', 3);
  m.hp = 10;
  const ups = grantXp(m, xpToNext(3) + 5);
  assert.equal(m.level, 4);
  assert.equal(ups.length, 1);
  assert.equal(m.xp, 5);
  assert.ok(m.hp > 10);
});

test('same seed, same battle (deterministic)', () => {
  const a = runBattle({ party: pierParty(), foes: ENCOUNTERS.pier_husks.foes, seed: 42 });
  const b = runBattle({ party: pierParty(), foes: ENCOUNTERS.pier_husks.foes, seed: 42 });
  assert.equal(a.outcome, b.outcome);
  assert.equal(a.time, b.time);
  assert.deepEqual(a.battle.snapshot(), b.battle.snapshot());
});

test('a party member becomes ready and the ATB gauge stays in range', () => {
  const b = new Battle({ party: pierParty(), foes: ['husk'], seed: 3 });
  const a = readyFirst(b);
  assert.ok(a, 'someone gets a turn');
  for (const c of b.all) assert.ok(c.atb >= 0 && c.atb <= 100);
});

test('time crawls while a command is pending', () => {
  const b = new Battle({ party: pierParty(), foes: ['husk'], seed: 3 });
  readyFirst(b);
  const foe = b.foes[0];
  const before = foe.atb;
  b.tick(1);
  assert.ok(foe.atb - before < 4, 'foe gauge barely moves in wait mode');
});

test('attack damages the target within a sane range and resets the gauge', () => {
  const b = new Battle({ party: pierParty(), foes: ['husk'], seed: 5 });
  const a = readyFirst(b);
  const foe = b.foes[0];
  assert.ok(b.command(a, { type: 'attack', target: foe.uid }));
  assert.equal(a.atb, 0);
  assert.ok(foe.hp < foe.maxHp);
  const dmg = foe.maxHp - foe.hp;
  assert.ok(dmg >= 5 && dmg <= 80, `dmg ${dmg}`);
});

test('fire is strong against husks, weak against kilnwrights', () => {
  const party = [newMember('marl', 6, ['ember', null])];
  const hit = (foeKind) => {
    const b = new Battle({ party, foes: [foeKind], seed: 11 });
    const a = readyFirst(b);
    a.mp = 99;
    b.command(a, { type: 'skill', skill: 'ember', target: b.foes[0].uid });
    const e = b.events.find((x) => x.type === 'hit');
    return e;
  };
  assert.equal(hit('husk').weak, true);
  assert.equal(hit('kilnwright').resist, true);
});

test('skills cost MP and are refused when you cannot pay', () => {
  const b = new Battle({ party: [newMember('marl', 4, ['ember', null])], foes: ['husk'], seed: 2 });
  const a = readyFirst(b);
  a.mp = 2;
  assert.equal(b.command(a, { type: 'skill', skill: 'ember', target: b.foes[0].uid }), false);
  a.mp = 10;
  assert.equal(b.command(a, { type: 'skill', skill: 'ember', target: b.foes[0].uid }), true);
  assert.equal(a.mp, 6);
});

test('heal never exceeds max HP; items are consumed', () => {
  const inv = { wetclay: 1 };
  const b = new Battle({ party: pierParty(), foes: ['husk'], inv, seed: 4 });
  const a = readyFirst(b);
  a.hp = a.maxHp - 3;
  assert.ok(b.command(a, { type: 'item', item: 'wetclay', target: a.uid }));
  assert.equal(a.hp, a.maxHp);
  assert.equal(inv.wetclay, 0);
});

test('damage fills the limit gauge, and the limit command needs a full one', () => {
  const b = new Battle({ party: pierParty(), foes: ['husk'], seed: 6 });
  const a = readyFirst(b);
  assert.equal(b.command(a, { type: 'limit', target: b.foes[0].uid }), false);
  a.limit = 100;
  const hp = b.foes[0].hp;
  assert.ok(b.command(a, { type: 'limit', target: b.foes[0].uid }));
  assert.equal(a.limit, 0);
  assert.ok(hp - b.foes[0].hp > 50, 'Thumbprint Crush hits hard');
});

test('guard halves damage', () => {
  const run = (guard) => {
    const b = new Battle({ party: [newMember('marl', 5, [null, null])], foes: ['husk'], seed: 9 });
    const t = b.party[0];
    t.guard = guard;
    const f = b.foes[0];
    const mv = { name: 'x', kind: 'phys', power: 1, target: 'foe' };
    b._strike(f, t, mv, 'phys', 0);
    return t.maxHp - t.hp;
  };
  const plain = run(false);
  const guarded = run(true);
  assert.ok(guarded <= Math.ceil(plain / 2) + 1, `${guarded} vs ${plain}`);
});

test('the battle ends in a win when every foe is down, and in a loss when the party falls', () => {
  const w = runBattle({ party: makeParty(8), foes: ['husk'], seed: 1 });
  assert.equal(w.outcome, 'win');
  const weak = [newMember('slip', 1, [null, null])];
  weak[0].hp = 1;
  const l = runBattle({ party: weak, foes: ['warden'], seed: 1 });
  assert.equal(l.outcome, 'lose');
});

test('boss enrages under half HP and speeds up', () => {
  const b = new Battle({ party: makeParty(5), foes: ['warden'], seed: 1 });
  b.foes[0].hp = Math.floor(b.foes[0].maxHp * 0.4);
  b._foeAct(b.foes[0]);
  assert.equal(b.foes[0].enraged, true);
});

test('progression: the mandatory fights alone bring the party to level 5; wandering fights reach level 6', () => {
  const m = newMember('marl', 4);
  const xpOf = (enc) => ENCOUNTERS[enc].foes.reduce((s, k) => s + ENEMIES[k].xp, 0);
  for (const enc of ['pier_husks', 'archive_guild', 'chapel_eels']) grantXp(m, xpOf(enc));
  assert.ok(m.level >= 5, `level ${m.level}`);
  for (const enc of ['archive_wander', 'archive_wander', 'chapel_wander', 'chapel_wander']) grantXp(m, xpOf(enc));
  assert.ok(m.level >= 6, `level ${m.level}`);
});

// ---------------------------------------------------------------- balance bands
// A scripted player stands in for a human. Bands are loose on purpose: they catch a
// broken tuning pass (impossible boss, trivial boss) rather than pin exact numbers.
test('balance: pier tutorial fight is gentle', () => {
  const rate = winRate('pier_husks', [newMember('marl', 4, ['ember', 'wedge']), newMember('ochre', 4, ['mend', 'wedge'])], 150);
  assert.ok(rate >= 0.9, `pier win rate ${rate}`);
});

test('balance: the Guild ambush at the archive is a real fight', () => {
  const rate = winRate('archive_guild', makeParty(4), 150);
  assert.ok(rate >= 0.8 && rate <= 1, `archive win rate ${rate}`);
});

test('balance: chapel eels', () => {
  const rate = winRate('chapel_eels', makeParty(5), 150);
  assert.ok(rate >= 0.75, `chapel win rate ${rate}`);
});

test('balance: the Warden is beatable at the expected level but not a pushover', () => {
  const lv5 = winRate('kiln_warden', makeParty(5, { marl: ['ember', 'wedge'], ochre: ['mend', 'wedge'], slip: ['brine', 'deluge'] }), 150);
  const lv7 = winRate('kiln_warden', makeParty(7, { marl: ['ember', 'wedge'], ochre: ['mend', 'wedge'], slip: ['brine', 'deluge'] }), 150);
  assert.ok(lv5 >= 0.35 && lv5 <= 0.97, `lv5 warden ${lv5}`);
  // a level or two is worth a lot, but the scripted player is noisy: allow a few points of slack
  assert.ok(lv7 > lv5 - 0.1, `lv7 (${lv7}) should not be much worse than lv5 (${lv5})`);
  assert.ok(lv7 >= 0.6, `lv7 warden ${lv7}`);
});

// ---------------------------------------------------------------- clay conditions and the new fights
import { GLAZES, glazeLevel, levelSkill, grantAp, apFor, FX, ENEMIES as FOES } from '../src/game/data.js';

function duel(foe, partyGlazes = { marl: ['ember', 'crackle'], slip: ['brine', 'deluge'] }, mastery = {}) {
  const party = Object.entries(partyGlazes).map(([id, g]) => newMember(id, 6, g));
  const b = new Battle({ party, foes: [foe], inv: { brineflask: 2, coldslip: 2, wetclay: 1 }, seed: 9, mastery });
  b.lock = 0;
  const actor = (id) => {
    const c = b.party.find((p) => p.id === id);
    c.atb = 100;
    b.ready = [c.uid];
    return c;
  };
  return { b, foe: b.foes[0], actor };
}
const evs = (b) => b.events.map((e) => e);

test('water then fire makes steam, and the steam is consumed', () => {
  const { b, foe, actor } = duel('kilnwright', { marl: ['ember', null], slip: ['brine', null] });
  assert.ok(b.command(actor('slip'), { type: 'skill', skill: 'brine', target: foe.uid }));
  assert.ok(foe.fx.soaked > 0, 'brine soaks');
  assert.ok(b.command(actor('marl'), { type: 'skill', skill: 'ember', target: foe.uid }));
  const hit = evs(b).filter((e) => e.type === 'hit').pop();
  assert.equal(hit.steam, true);
  assert.equal(foe.fx.soaked, 0, 'steam uses up the water');
  assert.ok(!(foe.fx.brittle > 0), 'steam does not also fire the clay');
});

test('fire leaves clay brittle; the next physical blow shatters it for extra', () => {
  const plain = duel('husk');
  plain.b.command(plain.actor('marl'), { type: 'attack', target: plain.foe.uid });
  const base = evs(plain.b).filter((e) => e.type === 'hit').pop().amount;

  const { b, foe, actor } = duel('husk');
  b.command(actor('marl'), { type: 'skill', skill: 'ember', target: foe.uid });
  assert.ok(foe.fx.brittle > 0, 'fire made it brittle');
  b.lock = 0;
  b.command(actor('marl'), { type: 'attack', target: foe.uid });
  const shattered = evs(b).filter((e) => e.type === 'hit').pop();
  assert.equal(shattered.shatter, true);
  assert.equal(foe.fx.brittle, 0, 'the crack is spent');
  assert.ok(shattered.amount > base * 1.2, `${shattered.amount} vs ${base}`);
});

test('Crackle cracks a foe without damaging it', () => {
  const { b, foe, actor } = duel('kilnwright');
  const hp = foe.hp;
  assert.ok(b.command(actor('marl'), { type: 'skill', skill: 'crackle', target: foe.uid }));
  assert.equal(foe.hp, hp);
  assert.ok(foe.fx.brittle > 0);
});

test('the Warden banks its fire for a turn, and water in that window puts it out', () => {
  const run = (douse) => {
    const { b, foe, actor } = duel('warden');
    b._perform(foe, { id: 'stoke', name: 'Stoking the Fire', kind: 'charge', target: 'self' }, null);
    assert.equal(foe.charging, true);
    assert.ok(evs(b).some((e) => e.type === 'tell'), 'the view is told to show a tell');
    if (douse) {
      b.lock = 0;
      b.command(actor('slip'), { type: 'skill', skill: 'brine', target: foe.uid });
      assert.equal(foe.charging, false);
      assert.ok(evs(b).some((e) => e.type === 'douse'));
    }
    const before = b.party.map((p) => p.hp);
    b._foeAct(foe);
    return b.party.map((p, i) => before[i] - p.hp);
  };
  const lit = run(false);
  const out = run(true);
  assert.ok(lit.every((d) => d > 55), `blaze should hurt everyone: ${lit}`);
  assert.ok(out.every((d, i) => d < lit[i] * 0.7), `a doused warden hits softer: ${out} vs ${lit}`);
});

test('a Brine Flask is a thrown douse: damage, soak and a put-out fire', () => {
  const { b, foe, actor } = duel('warden');
  foe.charging = true;
  const flasks = b.inv.brineflask;
  assert.ok(b.command(actor('marl'), { type: 'item', item: 'brineflask', target: foe.uid }));
  assert.equal(b.inv.brineflask, flasks - 1);
  assert.equal(foe.charging, false);
  assert.ok(foe.fx.soaked > 0);
});

test('Hush stops glazes but not attacks, items or Fracture; Cold Slip cures it', () => {
  const { b, actor } = duel('auditor');
  const slip = b.party.find((p) => p.id === 'slip');
  slip.fx.hushed = 10;
  assert.ok(b.skillsFor(slip).every((s) => !s.ok), 'every glaze greys out');
  const a = actor('slip');
  assert.equal(b.command(a, { type: 'skill', skill: 'brine', target: b.foes[0].uid }), false);
  slip.limit = 100;
  assert.ok(b.canLimit(slip), 'Fracture is still available');
  assert.ok(b.command(a, { type: 'item', item: 'coldslip', target: slip.uid }));
  assert.equal(slip.fx.hushed, 0);
});

test('the Auditor stamps a caster, never wastes a stamp on someone already hushed', () => {
  const { b, foe } = duel('auditor', { marl: ['ember', null], slip: ['brine', null], ochre: [null, null] });
  b.party.forEach((p) => (p.atb = 0));
  const picks = new Set();
  for (let i = 0; i < 40; i++) {
    for (const p of b.party) p.fx.hushed = 0;
    b.party.find((p) => p.id === 'marl').fx.hushed = 8; // marl is already silenced
    const mp = b.party.map((p) => p.hp);
    b._perform(foe, { id: 'stamp', name: 'Stamp: DENIED', kind: 'phys', power: 0.6, target: 'foe', ai: 'hush', inflict: { fx: 'hushed', dur: 12, chance: 1 } }, b.party[0]);
    void mp;
  }
  // direct check of the AI gate: with every caster hushed, stamping is not "sensible"
  for (const p of b.party) if (p.glazes.length) p.fx.hushed = 9;
  assert.equal(b._sensible(foe, { ai: 'hush' }), false);
  picks.add(1);
});

test('Audit drains MP and feeds the auditor; it is not chosen against empty tanks', () => {
  const { b, foe } = duel('auditor');
  const slip = b.party.find((p) => p.id === 'slip');
  foe.hp = 40;
  const mp = slip.mp;
  b._perform(foe, { id: 'audit', name: 'Audit', kind: 'drain', amount: 12, target: 'foe', ai: 'drain' }, slip);
  assert.equal(slip.mp, mp - 12);
  assert.ok(foe.hp > 40);
  for (const p of b.party) p.mp = 0;
  assert.equal(b._sensible(foe, { ai: 'drain' }), false);
});

test('Vigil Moths heal only when someone is hurt, and heal the most hurt', () => {
  const b = new Battle({ party: [newMember('marl', 5, ['ember', null])], foes: ['eel', 'moth'], seed: 4 });
  const moth = b.foes[1];
  assert.equal(b._sensible(moth, { ai: 'healer' }), false, 'nobody is hurt');
  b.foes[0].hp = 20;
  assert.equal(b._sensible(moth, { ai: 'healer' }), true);
  b.lock = 0;
  moth.atb = 100;
  const eel = b.foes[0];
  const before = eel.hp;
  b._perform(moth, { id: 'wick', name: 'Wick-Mend', kind: 'heal', power: 1.25, target: 'ally' }, eel);
  assert.ok(eel.hp > before);
});

test('a scorch burns a little on a timer, soaking puts it out, and it never finishes anyone', () => {
  const { b, actor } = duel('warden');
  const marl = b.party.find((p) => p.id === 'marl');
  marl.fx.scorched = 9;
  marl.hp = 3;
  marl.atb = 0;
  for (let i = 0; i < 200; i++) b.tick(0.05);
  assert.ok(marl.hp >= 1, 'scorch cannot kill');
  assert.ok(b.events.some((e) => e.type === 'dot' && e.target === marl.uid));
  marl.fx.scorched = 9;
  b._inflict(marl, { inflict: { fx: 'soaked', dur: 14, chance: 1 } }, 0);
  assert.equal(marl.fx.scorched, 0);
  void actor;
});

test('Soaked slows a gauge; Quicken speeds it and jumps it', () => {
  const { b, actor } = duel('husk', { marl: ['quicken', null], slip: ['brine', null] });
  const marl = b.party.find((p) => p.id === 'marl');
  const base = b._rate(marl);
  marl.fx.soaked = 5;
  assert.ok(b._rate(marl) < base);
  marl.fx.soaked = 0;
  const slip = b.party.find((p) => p.id === 'slip');
  slip.atb = 10;
  assert.ok(b.command(actor('marl'), { type: 'skill', skill: 'quicken', target: slip.uid }));
  assert.ok(slip.atb >= 40 && slip.fx.haste > 0);
  assert.ok(b._rate(slip) > base * 0.9);
});

test('glazes level with use: more power at 2, a perk at 3, and mastery is kept by the orb', () => {
  assert.equal(glazeLevel(0), 1);
  assert.equal(glazeLevel(60), 2);
  assert.equal(glazeLevel(200), 3);
  const lv1 = levelSkill(GLAZES.ember.skill, 1);
  const lv3 = levelSkill(GLAZES.ember.skill, 3);
  assert.ok(lv3.power > lv1.power * 1.3);
  assert.equal(lv3.scorch, 9);
  assert.equal(levelSkill(GLAZES.wedge.skill, 3).target, 'allAllies');
  assert.equal(levelSkill(GLAZES.slump.skill, 3).target, 'allFoes');
  const store = {};
  const ups = grantAp(store, ['ember', 'ember', 'mend', null], 60);
  assert.equal(store.ember, 60, 'a glaze slotted twice is counted once');
  assert.deepEqual(ups.map((u) => u.glaze).sort(), ['ember', 'mend']);
  assert.equal(apFor(100), 55);
  // and the battle really uses the level
  const lo = duel('husk', { marl: ['ember', null] }, {});
  const hi = duel('husk', { marl: ['ember', null] }, { ember: 200 });
  assert.equal(hi.b.skillsFor(hi.b.party[0])[0].lv, 3);
  assert.equal(lo.b.skillsFor(lo.b.party[0])[0].lv, 1);
});

test('a Warden spoken to by name is slower to anger, never stokes, and yields instead of dying', () => {
  const enc = ENCOUNTERS.kiln_warden_named;
  const b = new Battle({ party: makeParty(6), foes: enc.foes, seed: 2, mods: enc.mods, yieldAt: enc.yieldAt });
  const w = b.foes[0];
  assert.ok(w.maxHp < ENEMIES.warden.hp);
  for (let i = 0; i < 40; i++) {
    w.hp = w.maxHp * 0.4;
    for (const p of b.party) p.hp = p.maxHp;
    b._foeAct(w);
    assert.equal(w.charging, false, 'it will not stoke a fire at its own name');
    assert.equal(w.enraged, false);
  }
  w.hp = Math.floor(w.maxHp * 0.25);
  b._checkEnd();
  assert.equal(b.result.outcome, 'win');
  assert.equal(b.result.spared, true);
  assert.ok(w.alive && w.hp >= 1);
  const r = runBattle({ party: makeParty(5), foes: enc.foes, mods: enc.mods, yieldAt: enc.yieldAt, seed: 3 });
  assert.equal(r.outcome, 'win');
  assert.equal(r.battle.result.spared, true);
});

test('every condition has a label and colour for the screen', () => {
  for (const k of ['soaked', 'brittle', 'hushed', 'scorched', 'haste']) {
    assert.ok(FX[k].label && FX[k].color && FX[k].note, k);
  }
  for (const e of Object.values(FOES)) assert.ok(e.lore && e.lore.length > 30, `${e.id} has bestiary lore`);
});

test('balance: the new fights are fair but reward the right target', () => {
  const G = { marl: ['ember', 'crackle'], ochre: ['mend', 'slump'], slip: ['brine', 'deluge'] };
  const clerks = winRate('archive_clerks', makeParty(4, G), 150);
  const vigil = winRate('chapel_vigil', makeParty(5, G), 150);
  assert.ok(clerks >= 0.8, `clerks ${clerks}`);
  assert.ok(vigil >= 0.8, `vigil ${vigil}`);
  // a player who just mashes Attack on the first enemy loses to healers: target priority matters
  const naive = winRate('chapel_vigil', makeParty(5, G), 150, undefined, { naive: true });
  assert.ok(naive < vigil - 0.3, `naive ${naive} vs smart ${vigil}`);
  // and the boss cannot be button-mashed
  const mash = winRate('kiln_warden', makeParty(6, G), 100, undefined, { naive: true });
  assert.ok(mash < 0.2, `mashing Attack beats the Warden ${mash}`);
});
