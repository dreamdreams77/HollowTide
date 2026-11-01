import { Battle } from '../src/game/battle.js';
import { ENCOUNTERS, newMember, grantXp } from '../src/game/data.js';

export const KEEP_STYLE = { douse: true };

// A competent-but-not-perfect player: heals when hurt, exploits weaknesses, uses limits.
export function botCommand(b, a, style = KEEP_STYLE) {
  const allies = b.alliesOf(a);
  const foes = b.enemiesOf(a);
  if (style.naive) return { type: 'attack', target: foes[0].uid };
  const lowest = allies.reduce((x, y) => (x.hp / x.maxHp <= y.hp / y.maxHp ? x : y));
  const frac = lowest.hp / lowest.maxHp;
  const skills = b.skillsFor(a);

  if (b.canLimit(a)) {
    if (a.id === 'ochre') {
      if (allies.some((x) => x.hp / x.maxHp < 0.55)) return { type: 'limit' };
    } else {
      const strongest = foes.reduce((x, y) => (x.hp >= y.hp ? x : y));
      return { type: 'limit', target: strongest.uid };
    }
  }
  // the Warden banks its fire for one turn: water thrown in that window puts it out
  const banking = foes.find((f) => f.charging);
  if (banking && style.douse) {
    const water = skills.find((s) => s.ok && s.elem === 'water');
    if (water) return { type: 'skill', skill: water.id, target: banking.uid };
    if (b.inv.brineflask > 0) return { type: 'item', item: 'brineflask', target: banking.uid };
  }
  const mend = skills.find((s) => s.id === 'mend' && s.ok);
  if (mend && frac < 0.5) return { type: 'skill', skill: 'mend', target: lowest.uid };
  if (frac < 0.3 && b.inv.wetclay > 0) return { type: 'item', item: 'wetclay', target: lowest.uid };

  // against a boss that banks its fire, a sensible caster keeps enough MP back to put it out
  const reserve = style.douse && foes.some((f) => f.boss) && skills.some((s) => s.elem === 'water') ? 9 : 0;
  const deluge = skills.find((s) => s.id === 'deluge' && s.ok);
  if (deluge && foes.length >= 2) return { type: 'skill', skill: 'deluge' };
  for (const s of skills) {
    if (!s.ok || s.kind !== 'magic' || s.target !== 'foe') continue;
    if (a.mp - (s.mp || 0) < reserve) continue;
    const t = foes.find((f) => f.weak.includes(s.elem));
    if (t) return { type: 'skill', skill: s.id, target: t.uid };
  }
  const slump = skills.find((s) => s.id === 'slump' && s.ok);
  if (slump && a.mp - slump.mp >= reserve && foes.some((f) => f.boss && f.slow <= 0)) return { type: 'skill', skill: 'slump', target: foes.find((f) => f.boss).uid };
  const weakest = foes.reduce((x, y) => (x.hp <= y.hp ? x : y));
  return { type: 'attack', target: weakest.uid };
}

export function runBattle({ party, foes, inv = { wetclay: 2, slipdraught: 1 }, seed = 1, maxTime = 900, style, mastery = {}, mods = [], yieldAt = 0 }) {
  const b = new Battle({ party, foes, inv: { ...inv }, seed, mastery, mods, yieldAt });
  const dt = 0.05;
  let t = 0;
  while (!b.finished && t < maxTime) {
    b.tick(dt);
    b.drain();
    if (b.current && !b.result) {
      const a = b.current;
      if (!b.command(a, botCommand(b, a, style))) {
        b.command(a, { type: 'attack' });
      }
    }
    t += dt;
  }
  return { battle: b, time: t, outcome: b.result?.outcome || 'timeout' };
}

export function makeParty(level, glazeSets) {
  const sets = glazeSets || {
    marl: ['ember', 'wedge'],
    ochre: ['mend', 'wedge'],
    slip: ['brine', 'slump'],
  };
  return Object.keys(sets).map((id) => newMember(id, level, sets[id]));
}

export function winRate(encounter, party, runs = 200, inv, style, mastery) {
  let wins = 0;
  const enc = ENCOUNTERS[encounter];
  for (let s = 1; s <= runs; s++) {
    const r = runBattle({ party: party.map((m) => ({ ...m, glazes: [...m.glazes] })), foes: enc.foes, seed: s, inv, style, mastery, mods: enc.mods, yieldAt: enc.yieldAt });
    if (r.outcome === 'win') wins++;
  }
  return wins / runs;
}

export { grantXp };
