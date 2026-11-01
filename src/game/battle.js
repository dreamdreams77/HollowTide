// Active-time battle engine (FF7-flavoured, deliberately light).
//  - every combatant has an ATB gauge that fills with speed; a full party gauge opens a command
//  - while a command is pending time crawls (a soft "Wait" mode, friendly to touch screens)
//  - taking damage fills your Limit gauge; at 100 you may use your Fracture
//  - fire/water weaknesses, guard, slow, heal, items
//  - clay conditions (see FX in data.js): Soaked, Brittle, Hushed, Scorched, Quick. They are what make the elements talk
//    to each other: water then fire makes STEAM, fire or Crackle then a physical hit makes SHATTER, water puts out a fire
//    that a boss is stoking, a Hush silences your glazes until you burn the clerk who stamped it.
//  - glazes level up with use (mastery lives in `mastery`, keyed by glaze id)
// Pure logic with a seeded RNG: the view reads `events` and `drain()`; tests just call tick().

import { mulberry32 } from '../engine/rng.js';
import { CHARACTERS, ENEMIES, GLAZES, ITEMS, LIMITS, MOVES, statsAt, glazeLevel, levelSkill } from './data.js';

export const TIMING = { hit: 0.38, move: 1.05, multi: 1.4 };
const WAIT_SCALE = 0.12;
const FX_KEYS = ['soaked', 'brittle', 'hushed', 'scorched', 'haste'];
const SCORCH_EVERY = 1.5;
const STEAM = 1.35;
const SHATTER = 1.35;

export function makePartyCombatant(m) {
  const s = statsAt(m.id, m.level);
  const hp = m.hp ?? s.hp;
  return {
    uid: 'p_' + m.id, side: 'party', id: m.id, kind: m.id, name: CHARACTERS[m.id].name, level: m.level,
    maxHp: s.hp, hp: Math.min(hp, s.hp), maxMp: s.mp, mp: Math.min(m.mp ?? s.mp, s.mp),
    atk: s.atk, def: s.def, mag: s.mag, spd: s.spd,
    atb: 0, limit: m.limit || 0, guard: false, slow: 0, alive: hp > 0, turn: 0, fx: {}, tick: 0, charging: false,
    glazes: (m.glazes || []).filter(Boolean), weak: [], resist: [],
  };
}

export function makeFoeCombatant(kind, index, mod = {}) {
  const d = ENEMIES[kind];
  const hp = Math.round(d.hp * (mod.hp ?? 1));
  return {
    uid: `f_${kind}_${index}`, side: 'foe', id: kind, kind, name: d.name, level: 1,
    maxHp: hp, hp, maxMp: 0, mp: 0, atk: d.atk, def: d.def, mag: d.mag, spd: d.spd,
    atb: 0, limit: 0, guard: false, slow: 0, alive: true, turn: 0, boss: !!d.boss, enraged: false,
    fx: {}, tick: 0, charging: false, pattern: mod.pattern || null, noEnrage: mod.enrage === false,
    glazes: [], weak: d.weak || [], resist: d.resist || [], xp: d.xp,
  };
}

export class Battle {
  // mods: one object per foe (see ENCOUNTERS.*.mods); yieldAt: the Warden-spoken-to-by-name fight ends at this HP fraction
  constructor({ party, foes, inv = {}, seed = 1, mastery = {}, mods = [], yieldAt = 0 }) {
    this.rng = mulberry32(seed);
    this.party = party.map(makePartyCombatant);
    this.foes = foes.map((k, i) => makeFoeCombatant(k, i, mods[i]));
    this.all = [...this.party, ...this.foes];
    this.inv = inv;
    this.mastery = mastery;
    this.yieldAt = yieldAt;
    this.clock = 0;
    this.lock = 0.7;
    this.events = [];
    this.ready = [];
    this.result = null;
    for (const c of this.all) c.atb = this.rng() * 45;
  }

  get(uid) {
    return this.all.find((c) => c.uid === uid);
  }
  alive(side) {
    return (side === 'party' ? this.party : this.foes).filter((c) => c.alive);
  }
  enemiesOf(a) {
    return this.alive(a.side === 'party' ? 'foe' : 'party');
  }
  alliesOf(a) {
    return this.alive(a.side);
  }
  get waiting() {
    return this.ready.length > 0;
  }
  get current() {
    return this.ready.length ? this.get(this.ready[0]) : null;
  }
  get finished() {
    return !!this.result && this.lock <= 0 && this.events.length === 0;
  }

  _rate(c) {
    let r = 8 + c.spd * 0.7;
    if (c.slow > 0) r *= 0.5;
    if (c.fx.soaked > 0) r *= 0.8;
    if (c.fx.haste > 0) r *= 1.5;
    if (c.enraged) r *= ENEMIES[c.kind].enrage?.speed || 1;
    return r;
  }

  tick(dt) {
    this.clock += dt;
    if (this.lock > 0) {
      this.lock -= dt;
      return;
    }
    if (this.result) return;
    const scale = this.waiting ? WAIT_SCALE : 1;
    for (const c of this.all) {
      if (!c.alive) continue;
      if (c.slow > 0) c.slow = Math.max(0, c.slow - dt * scale);
      for (const k of FX_KEYS) if (c.fx[k] > 0) c.fx[k] = Math.max(0, c.fx[k] - dt * scale);
      if (c.fx.scorched > 0) {
        c.tick += dt * scale;
        if (c.tick >= SCORCH_EVERY) {
          c.tick -= SCORCH_EVERY;
          this._burn(c);
          if (!c.alive) continue;
        }
      } else c.tick = 0;
      if (c.atb < 100) c.atb = Math.min(100, c.atb + this._rate(c) * dt * scale);
      if (c.atb >= 100) {
        if (c.side === 'party') {
          if (!this.ready.includes(c.uid)) this.ready.push(c.uid);
        } else {
          this._foeAct(c);
          return;
        }
      }
    }
  }

  // events whose time has come (the view animates them)
  drain() {
    const due = [];
    this.events = this.events.filter((e) => {
      if (e.at <= this.clock) {
        due.push(e);
        return false;
      }
      return true;
    });
    return due;
  }

  // ---- what can this actor do?
  levelOf(glaze) {
    return glazeLevel(this.mastery[glaze] || 0);
  }
  skillsFor(actor) {
    const hushed = actor.fx.hushed > 0;
    return actor.glazes
      .map((g) => ({ ...levelSkill({ ...GLAZES[g].skill }, this.levelOf(g)), glaze: g }))
      .map((s) => ({ ...s, ok: !hushed && actor.mp >= (s.mp || 0), hushed }));
  }
  limitFor(actor) {
    return LIMITS[CHARACTERS[actor.id].limit];
  }
  itemsFor() {
    return Object.keys(this.inv)
      .filter((k) => this.inv[k] > 0 && ITEMS[k] && !ITEMS[k].key)
      .map((k) => ({ ...ITEMS[k], count: this.inv[k] }));
  }
  canLimit(actor) {
    return actor.limit >= 100;
  }
  targetsFor(actor, spec) {
    switch (spec.target) {
      case 'foe': return this.enemiesOf(actor);
      case 'ally': return this.alliesOf(actor);
      default: return [];
    }
  }

  // ---- issuing a command to a ready party member. action = {type, skill?, item?, target?}
  command(actor, action) {
    if (this.result || !actor || !actor.alive || this.ready[0] !== actor.uid) return false;
    let move;
    let target = action.target ? this.get(action.target) : null;
    switch (action.type) {
      case 'attack': move = MOVES.attack; break;
      case 'guard':
        move = { id: 'guardself', name: 'Guard', kind: 'guard', target: 'self' };
        break;
      case 'skill': {
        const s = this.skillsFor(actor).find((x) => x.id === action.skill);
        if (!s || !s.ok) return false;
        move = s;
        break;
      }
      case 'item': {
        const it = ITEMS[action.item];
        if (!it || it.key || !(this.inv[action.item] > 0)) return false;
        const kinds = { heal: 'itemheal', mp: 'itemmp', cleanse: 'itemcleanse', throw: 'itemthrow' };
        move = { ...it, kind: kinds[it.kind] || 'itemheal', name: it.name };
        break;
      }
      case 'limit':
        if (!this.canLimit(actor)) return false;
        move = this.limitFor(actor);
        break;
      default: return false;
    }
    if (move.target === 'foe' || move.target === 'ally') {
      if (!target || !target.alive || (move.target === 'foe') !== (target.side !== actor.side)) target = this.targetsFor(actor, move)[0];
      if (!target) return false;
    }
    this.ready.shift();
    if (action.type === 'item') this.inv[action.item] -= 1;
    if (action.type === 'limit') actor.limit = 0;
    this._perform(actor, move, target);
    return true;
  }

  // ---- monsters
  _pattern(c) {
    const d = ENEMIES[c.kind];
    if (!d.pattern && !c.pattern) return null;
    const enraged = c.enraged && d.enrage?.pattern;
    return enraged || c.pattern || d.pattern;
  }

  // Is this move worth making right now? Healers wait until someone is hurt; a Hush needs a caster to silence.
  _sensible(c, move) {
    if (move.ai === 'healer') return this.alliesOf(c).some((a) => a.hp / a.maxHp < 0.75);
    if (move.ai === 'hush') return this.enemiesOf(c).some((p) => p.glazes.length && !(p.fx.hushed > 0));
    if (move.ai === 'drain') return this.enemiesOf(c).some((p) => p.mp > 0);
    return true;
  }

  _foeAct(c) {
    const d = ENEMIES[c.kind];
    const wasEnraged = c.enraged;
    c.enraged = !c.noEnrage && !!(d.enrage && c.hp / c.maxHp < d.enrage.hp);
    if (c.enraged && !wasEnraged) this.events.push({ type: 'status', target: c.uid, text: 'Enraged!', at: this.clock });
    let id;
    if (c.charging) {
      id = 'blaze';
      c.charging = false;
    } else {
      const pat = this._pattern(c);
      if (pat) {
        id = pat[c.turn % pat.length];
      } else {
        const pool = d.moves.filter(([mid]) => this._sensible(c, MOVES[mid]));
        const total = pool.reduce((s, m) => s + m[1], 0);
        let r = this.rng() * total;
        id = pool[0][0];
        for (const [mid, w] of pool) {
          r -= w;
          if (r <= 0) {
            id = mid;
            break;
          }
        }
      }
      c.turn += 1;
    }
    const move = MOVES[id];
    let target = null;
    if (move.target === 'foe') {
      let foes = this.enemiesOf(c);
      if (!foes.length) return;
      // a Hush goes to somebody with glazes to lose; a drain goes to somebody with MP
      if (move.ai === 'hush') foes = foes.filter((p) => p.glazes.length && !(p.fx.hushed > 0));
      if (move.ai === 'drain') foes = foes.filter((p) => p.mp > 0);
      if (!foes.length) foes = this.enemiesOf(c);
      target = this.rng() < 0.4 ? foes.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b)) : foes[Math.floor(this.rng() * foes.length)];
    } else if (move.target === 'ally') {
      const allies = this.alliesOf(c);
      target = allies.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b));
    }
    this._perform(c, move, target);
  }

  _targets(actor, move, target) {
    switch (move.target) {
      case 'foe': return [target];
      case 'ally': return [target];
      case 'self': return [actor];
      case 'allFoes': return this.enemiesOf(actor);
      case 'allAllies': return this.alliesOf(actor);
      default: return [];
    }
  }

  _cleanse(t) {
    t.slow = 0;
    t.fx.hushed = 0;
    t.fx.scorched = 0;
    t.fx.soaked = 0;
  }

  _status(t, text, at) {
    this.events.push({ type: 'status', target: t.uid, text, at });
  }

  _perform(actor, move, target) {
    actor.guard = false;
    actor.atb = 0;
    if (move.mp) actor.mp = Math.max(0, actor.mp - move.mp);
    const targets = this._targets(actor, move, target);
    const multi = targets.length > 1 || (move.hits || 1) > 1;
    this.events.push({ type: 'act', actor: actor.uid, name: move.name, kind: move.kind, at: this.clock, charged: !!move.charged });
    targets.forEach((t, i) => {
      const base = this.clock + TIMING.hit + i * 0.09;
      switch (move.kind) {
        case 'phys':
          for (let h = 0; h < (move.hits || 1); h++) this._strike(actor, t, move, 'phys', base + h * 0.26);
          break;
        case 'magic':
        case 'itemthrow':
          this._strike(actor, t, move, 'magic', base);
          break;
        case 'heal': {
          const amt = move.healPct ? Math.round(t.maxHp * move.healPct) : Math.round(actor.mag * 1.6 * move.power * (0.92 + this.rng() * 0.16));
          if (t.alive) {
            t.hp = Math.min(t.maxHp, t.hp + amt);
            if (move.cleanse) this._cleanse(t);
            this.events.push({ type: 'heal', target: t.uid, amount: amt, at: base });
          }
          break;
        }
        case 'itemheal':
          t.hp = Math.min(t.maxHp, t.hp + move.amount);
          this.events.push({ type: 'heal', target: t.uid, amount: move.amount, at: base });
          break;
        case 'itemcleanse':
          t.hp = Math.min(t.maxHp, t.hp + move.amount);
          this._cleanse(t);
          this.events.push({ type: 'heal', target: t.uid, amount: move.amount, at: base });
          break;
        case 'itemmp':
          t.mp = Math.min(t.maxMp, t.mp + move.amount);
          this.events.push({ type: 'mp', target: t.uid, amount: move.amount, at: base });
          break;
        case 'drain': {
          const took = Math.min(t.mp, move.amount);
          if (took > 0) {
            t.mp -= took;
            actor.hp = Math.min(actor.maxHp, actor.hp + Math.round(took * 1.5));
            this.events.push({ type: 'mp', target: t.uid, amount: -took, at: base });
          }
          break;
        }
        case 'slow':
          t.slow = move.dur ?? 14;
          this._status(t, 'Slowed', base);
          break;
        case 'crack':
          t.fx.brittle = move.dur ?? 14;
          this._status(t, 'Brittle', base);
          break;
        case 'haste':
          t.fx.haste = move.dur ?? 12;
          if (t.side === 'party') t.atb = Math.min(100, t.atb + 30);
          this._status(t, 'Quick', base);
          break;
        case 'guard':
          t.guard = true;
          if (move.limit && t.side === 'party') t.limit = Math.min(100, t.limit + move.limit);
          this._status(t, 'Braced', base);
          break;
        case 'status':
          this._inflict(t, move, base);
          break;
        case 'charge':
          actor.charging = true;
          this.events.push({ type: 'tell', actor: actor.uid, text: `${actor.name} banks the fire…`, at: this.clock + 0.1 });
          break;
        default: break;
      }
    });
    this.lock = multi ? TIMING.multi : TIMING.move;
    this._checkEnd();
  }

  _inflict(t, move, at) {
    const inf = move.inflict;
    if (!inf || !t.alive) return;
    if (inf.chance != null && inf.chance < 1 && this.rng() >= inf.chance) return;
    if (inf.fx === 'soaked' && t.fx.scorched > 0) {
      t.fx.scorched = 0;
      this._status(t, 'Doused', at);
    }
    t.fx[inf.fx] = inf.dur;
    this._status(t, { soaked: 'Soaked', hushed: 'Hushed', scorched: 'Scorched', brittle: 'Brittle', haste: 'Quick' }[inf.fx], at + 0.05);
  }

  _burn(c) {
    const d = Math.max(3, Math.round(c.maxHp * 0.035));
    c.hp = Math.max(1, c.hp - d);
    // a scorch can hurt but never finishes anyone off: it is a threat, not a coin-flip
    this.events.push({ type: 'dot', target: c.uid, amount: d, at: this.clock });
  }

  _strike(actor, t, move, mode, at) {
    if (!t.alive) return;
    const roll = 0.9 + this.rng() * 0.2;
    let d;
    let crit = false;
    if (move.kind === 'itemthrow') {
      d = move.amount * roll;
    } else if (mode === 'phys') {
      d = actor.atk * 1.15 * (move.power ?? 1) * roll - (move.ignoreDef ? 0 : t.def * 0.5);
      if (this.rng() < 0.08) {
        crit = true;
        d *= 1.5;
      }
    } else {
      d = actor.mag * 1.45 * (move.power ?? 1) * roll - t.def * 0.3;
    }
    let weak = false;
    let resist = false;
    let steam = false;
    let shatter = false;
    if (move.elem) {
      if (t.weak.includes(move.elem)) {
        d *= 1.5;
        weak = true;
      } else if (t.resist.includes(move.elem)) {
        d *= 0.5;
        resist = true;
      }
    }
    // water then fire: the water flashes to steam
    if (move.elem === 'fire' && t.fx.soaked > 0) {
      d *= STEAM;
      steam = true;
      t.fx.soaked = 0;
    }
    // cracked or fired clay shatters under a heavy blow (a thrown flask is not a heavy blow)
    if (mode === 'phys' && t.fx.brittle > 0) {
      d *= SHATTER;
      shatter = true;
      t.fx.brittle = 0;
    }
    if (t.guard) d *= 0.5;
    d = Math.max(1, Math.round(d));
    t.hp = Math.max(0, t.hp - d);
    if (t.side === 'party') t.limit = Math.min(100, t.limit + Math.min(40, (d / t.maxHp) * 110));
    this.events.push({ type: 'hit', target: t.uid, amount: d, crit, weak, resist, steam, shatter, elem: move.elem || null, at });
    if (t.hp <= 0) {
      t.alive = false;
      t.atb = 0;
      t.guard = false;
      t.charging = false;
      t.fx = {};
      this.ready = this.ready.filter((u) => u !== t.uid);
      this.events.push({ type: 'ko', target: t.uid, at: at + 0.12 });
      return;
    }
    this._aftermath(actor, t, move, resist, steam, at);
  }

  // What a landed hit leaves behind: wet, brittle, scorched, a drained gauge, a dead fire.
  _aftermath(actor, t, move, resist, steam, at) {
    if (move.elem === 'water') {
      if (t.charging) {
        t.charging = false;
        this._status(t, 'DOUSED!', at + 0.1);
        this.events.push({ type: 'douse', target: t.uid, at: at + 0.1 });
      }
      if (t.fx.scorched > 0) {
        t.fx.scorched = 0;
        this._status(t, 'Doused', at + 0.12);
      }
      t.fx.soaked = 14;
      if (!steam) this._status(t, 'Soaked', at + 0.15);
    } else if (move.elem === 'fire' && !resist && !steam && !(t.fx.soaked > 0)) {
      t.fx.brittle = 12;
      this._status(t, 'Brittle', at + 0.15);
    }
    if (move.scorch && !(t.fx.soaked > 0)) {
      t.fx.scorched = move.scorch;
      this._status(t, 'Scorched', at + 0.2);
    }
    if (move.drain) t.atb = Math.max(0, t.atb - move.drain);
    if (move.inflict) this._inflict(t, move, at + 0.1);
  }

  _checkEnd() {
    if (this.result) return;
    // a foe that has been spoken to by name yields rather than dies
    if (this.yieldAt) {
      const f = this.foes.find((x) => x.alive && x.hp / x.maxHp < this.yieldAt);
      if (f) {
        f.hp = Math.max(1, f.hp);
        f.yielded = true;
        const xp = this.foes.reduce((s, x) => s + (x.xp || 0), 0);
        this.result = { outcome: 'win', xp, spared: true };
        this.events.push({ type: 'status', target: f.uid, text: 'Yields', at: this.clock + 1.2 });
        return;
      }
    }
    if (!this.alive('foe').length) {
      const xp = this.foes.reduce((s, f) => s + (f.xp || 0), 0);
      this.result = { outcome: 'win', xp };
    } else if (!this.alive('party').length) {
      this.result = { outcome: 'lose', xp: 0 };
    }
  }

  // persistent state to write back to the party records
  snapshot() {
    return this.party.map((c) => ({ id: c.id, hp: c.hp, mp: c.mp, limit: Math.round(c.limit) }));
  }
}
