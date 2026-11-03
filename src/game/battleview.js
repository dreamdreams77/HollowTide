// Battle presentation + input. The logic lives in battle.js; this file animates events,
// draws the diorama, and turns taps / keys into commands.

import { Battle } from './battle.js';
import { ENCOUNTERS, ENEMIES, CHARACTERS, FX, GLAZES, GLAZE_NOTES, grantXp, grantAp, apFor } from './data.js';
import { drawFigure, drawEnemy, figureBounds, ENEMY_BOUNDS } from '../engine/actors.js';
import { paintBattleBG, GRADES } from '../engine/stage.js';
import { setKeyLights } from '../engine/noir.js';
import { drawClay, slab, clayText, filmFinish, glow, FONT } from '../engine/clay.js';
import { panel, text, button, bar, wrap, UI } from './ui.js';
import { TAU } from '../engine/rng.js';

const FOE_SLOTS = {
  1: [[250, 414]],
  2: [[190, 378], [335, 422]],
  3: [[150, 366], [300, 388], [215, 422]],
  4: [[140, 358], [290, 380], [190, 420], [400, 404]],
};
const PARTY_SLOTS = [[740, 358], [810, 392], [725, 422]];
const FOE_SCALE = { husk: 1.15, kilnwright: 1.05, eel: 1.1, moth: 1.1, auditor: 1.05, warden: 1.0 };
const FX_ORDER = ['scorched', 'hushed', 'soaked', 'brittle', 'haste'];
const PANEL_Y = 428; // bottom bar top; the bar is 108 tall so command buttons can be finger-sized
const PANEL_H = 108;

// Portrait battle: a tall diorama (foes above, party below), a row of status plates, then a big command panel.
export function battleLayout(v) {
  if (!v.portrait) return { portrait: false };
  const cmdH = 250;
  const cmdY = v.h - 14 - cmdH;
  const plateH = 92;
  const plateY = cmdY - 8 - plateH;
  const d = plateY - 6; // bottom of the diorama
  const top = 70;
  const room = d - top;
  const ps = Math.max(0.7, Math.min(1.3, room / 480));
  const foeY = top + room * 0.5;
  return { portrait: true, cmdY, cmdH, plateY, plateH, d, top, room, ps, foeY, horizon: top + room * 0.3 };
}

function portraitSlots(L, v, nFoes) {
  const w = v.w;
  const y = L.foeY;
  const foes = {
    1: [[w / 2, y + 30]],
    2: [[w * 0.27, y - 4], [w * 0.73, y + 34]],
    3: [[w * 0.2, y - 18], [w * 0.8, y - 18], [w * 0.5, y + 40]],
    4: [[w * 0.2, y - 24], [w * 0.8, y - 24], [w * 0.34, y + 38], [w * 0.66, y + 38]],
  }[Math.min(4, Math.max(1, nFoes))];
  const py = L.d - 22;
  const party = [[w * 0.17, py - 6], [w * 0.5, py + 12], [w * 0.83, py - 6]];
  return { foes, party };
}

export function describeFoes(foes) {
  const counts = {};
  for (const k of foes) counts[k] = (counts[k] || 0) + 1;
  const parts = Object.entries(counts).map(([k, n]) => `${ENEMIES[k].name}${n > 1 ? ' ×' + n : ''}`);
  return parts.join(' & ') + (foes.length > 1 || parts[0].includes('×') ? ' appear!' : ' appears!');
}

export class BattleView {
  constructor(game, encId, done) {
    const enc = ENCOUNTERS[encId];
    this.g = game;
    this.encId = encId;
    this.theme = enc.theme;
    this.boss = !!enc.boss;
    this.done = done;
    this.b = new Battle({
      party: game.state.party, foes: enc.foes, inv: game.state.inv, seed: (Math.random() * 1e9) | 0,
      mastery: game.state.glazeAp || (game.state.glazeAp = {}), mods: enc.mods || [], yieldAt: enc.yieldAt || 0, waitScale: game.settings?.active ? 1 : undefined,
    });
    this.known = game.state.bestiary || (game.state.bestiary = {}); // weaknesses you have seen with your own eyes
    for (const f of enc.foes) this.known[f] = this.known[f] || { weak: [], resist: [] }; // meeting a foe is enough to open its almanac page
    this.kick = 0; // camera punch on heavy hits
    this.b.lock = 1.5;
    this.vis = {};
    this.b.foes.forEach((f) => {
      this.vis[f.uid] = { x: 0, y: 0, lunge: 0, flash: 0, hurt: 0, dead: 0, gone: false, cast: 0, scale: 1 };
    });
    this.b.party.forEach((p) => {
      this.vis[p.uid] = { x: 0, y: 0, lunge: 0, flash: 0, hurt: 0, dead: 0, gone: false, cast: 0, scale: 1, ko: !p.alive };
    });
    this.relayout();
    this.popups = [];
    this.banner = { text: describeFoes(enc.foes), t: 1.9 };
    this.menu = { stage: 'root', idx: 0, list: [], pend: null, tIdx: 0, tlist: [] };
    this.t = 0;
    this.result = null; // {outcome, xp, ups}
    this.finalized = false;
    this.hintShown = !game.flag('battle_tutorial');
    game.sound?.music(this.boss ? 'boss' : 'battle');
  }

  // Place every combatant for the current orientation (also called when the screen rotates mid-fight).
  relayout() {
    const v = this.g.view;
    this.L = battleLayout(v);
    this.layoutKey = `${v.w}x${v.h}`;
    const L = this.L;
    const slots = L.portrait ? portraitSlots(L, v, this.b.foes.length) : null;
    this.b.foes.forEach((f, i) => {
      const e = this.vis[f.uid];
      const base = FOE_SCALE[f.kind] || 1;
      if (L.portrait) {
        e.x = slots.foes[i][0];
        e.y = slots.foes[i][1] + (f.boss ? 18 : 0);
        e.scale = base * L.ps * (f.boss ? 0.92 : 0.95);
      } else {
        const sl = FOE_SLOTS[this.b.foes.length] || FOE_SLOTS[4];
        e.x = sl[i][0];
        e.y = sl[i][1];
        e.scale = base;
      }
    });
    this.b.party.forEach((p, i) => {
      const e = this.vis[p.uid];
      if (L.portrait) {
        e.x = slots.party[i][0];
        e.y = slots.party[i][1];
        e.scale = 1.06 * L.ps * 1.12;
      } else {
        e.x = PARTY_SLOTS[i][0];
        e.y = PARTY_SLOTS[i][1];
        e.scale = 1.06;
      }
    });
  }

  // ------------------------------------------------------------ update
  update(dt) {
    this.t += dt;
    const b = this.b;
    if (!this.result) b.tick(dt);
    else b.clock += dt;
    for (const e of b.drain()) this.onEvent(e);
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }
    for (const v of Object.values(this.vis)) {
      v.lunge = Math.max(0, v.lunge - dt);
      v.flash = Math.max(0, v.flash - dt);
      v.hurt = Math.max(0, v.hurt - dt);
      v.cast = Math.max(0, v.cast - dt);
      if (v.dying) v.dead = Math.min(1, v.dead + dt / 0.8);
    }
    this.popups = this.popups.filter((p) => (p.t -= dt) > 0);
    this.kick = Math.max(0, this.kick - dt * 1.6);
    this.tellT = (this.tellT || 0) + dt;
    // command menu follows whoever is ready
    const cur = b.current;
    if (cur && !b.result) {
      if (this.menuFor !== cur.uid) {
        this.menuFor = cur.uid;
        this.menu = { stage: 'root', idx: 0, list: [], pend: null, tIdx: 0, tlist: [] };
        this.g.sound?.play('ready');
      }
    } else {
      this.menuFor = null;
    }
    if (b.finished && !this.result) this.finish();
  }

  onEvent(e) {
    const g = this.g;
    const v = this.vis[e.target];
    const a = this.vis[e.actor];
    if (e.type === 'act') {
      const actor = this.b.get(e.actor);
      if (e.kind === 'phys') {
        a.lunge = 0.45;
        a.lungeDir = actor.side === 'party' ? -1 : 1;
        g.sound?.play('click');
      } else if (['magic', 'heal', 'guard', 'slow', 'crack', 'haste', 'status', 'drain', 'itemthrow', 'itemcleanse'].includes(e.kind)) {
        a.cast = 0.7;
        g.sound?.play(e.kind === 'heal' ? 'heal' : 'magic');
      }
      if (e.charged) {
        this.banner = { text: e.name, t: 1.4, warn: true };
        this.kick = 0.5;
      } else if (e.name === 'Fracture' || ['Thumbprint Crush', "Tidemother's Lull", 'Slipstream'].includes(e.name)) {
        g.sound?.play('limit');
        this.banner = { text: e.name, t: 1.5, gold: true };
        this.kick = 0.45;
      } else if (actor.side === 'foe' || (e.kind !== 'phys' && e.kind !== 'itemheal' && e.kind !== 'itemmp')) {
        this.banner = { text: e.name, t: 1.1 };
      }
      return;
    }
    if (e.type === 'tell') {
      this.banner = { text: e.text, t: 2.6, warn: true };
      this.tellT = 0;
      g.sound?.play('limit');
      return;
    }
    if (!v) return;
    const pos = this.popupPos(e.target);
    if (e.type === 'hit') {
      v.flash = 0.26;
      v.hurt = 0.4;
      const sub = e.steam ? 'STEAM!' : e.shatter ? 'SHATTER!' : e.weak ? 'weak!' : e.resist ? 'resists' : '';
      const target = this.b.get(e.target);
      if (target.side === 'foe' && (e.weak || e.resist) && e.elem) {
        const k = (this.known[target.kind] = this.known[target.kind] || { weak: [], resist: [] });
        const list = e.weak ? k.weak : k.resist;
        if (!list.includes(e.elem)) list.push(e.elem);
      }
      this.popups.push({ x: pos.x, y: pos.y, text: String(e.amount), color: e.steam ? '#bfe8ff' : e.shatter ? '#ffe39a' : e.weak ? '#ffcf5a' : e.crit ? '#ff9a5a' : '#ffffff', big: e.crit || e.weak || e.steam || e.shatter, t: 1.0, max: 1.0, sub });
      if (e.steam || e.shatter) this.kick = Math.max(this.kick, 0.3);
      g.sound?.play(e.crit || e.shatter ? 'crit' : 'hit');
    } else if (e.type === 'dot') {
      v.hurt = 0.2;
      this.popups.push({ x: pos.x, y: pos.y + 10, text: String(e.amount), color: '#ff9a4a', t: 0.8, max: 0.8 });
    } else if (e.type === 'douse') {
      this.kick = 0.35;
      g.sound?.play('crit');
    } else if (e.type === 'heal') {
      this.popups.push({ x: pos.x, y: pos.y, text: '+' + e.amount, color: '#7fe07f', t: 1.0, max: 1.0 });
    } else if (e.type === 'mp') {
      this.popups.push({ x: pos.x, y: pos.y, text: (e.amount > 0 ? '+' : '') + e.amount + ' MP', color: e.amount > 0 ? '#6ab4e8' : '#b07ad6', t: 1.0, max: 1.0 });
    } else if (e.type === 'status') {
      this.popups.push({ x: pos.x, y: pos.y, text: e.text, color: '#d9c9ff', t: 1.2, max: 1.2 });
    } else if (e.type === 'ko') {
      const c = this.b.get(e.target);
      if (c.side === 'foe') v.dying = true;
      else v.ko = true;
      g.sound?.play('ko');
    }
  }

  popupPos(uid) {
    const v = this.vis[uid];
    const c = this.b.get(uid);
    const h = c.side === 'foe' ? (ENEMY_BOUNDS[c.kind]?.h || 100) * v.scale * 0.75 : 110;
    return { x: v.x, y: v.y - h };
  }

  finish() {
    const b = this.b;
    const r = { outcome: b.result.outcome, xp: b.result.xp, ups: [], lines: [] };
    const party = this.g.state.party;
    b.snapshot().forEach((s) => {
      const m = party.find((p) => p.id === s.id);
      m.hp = r.outcome === 'win' ? Math.max(1, s.hp) : s.hp;
      m.mp = s.mp;
      m.limit = s.limit;
    });
    r.spared = !!b.result.spared;
    r.glazeUps = [];
    if (r.outcome === 'win') {
      for (const m of party) r.ups.push(...grantXp(m, r.xp));
      // every slotted glaze learns from the fight, whether or not it was cast
      const worn = party.flatMap((m) => m.glazes.filter(Boolean));
      r.ap = apFor(r.xp);
      r.glazeUps = grantAp(this.g.state.glazeAp || (this.g.state.glazeAp = {}), worn, r.ap);
      this.g.sound?.music(this.theme === 'kiln' ? 'kiln' : this.theme === 'chapel' ? 'chapel' : this.theme === 'archive' ? 'archive' : 'sea');
      this.g.sound?.play('win');
    } else {
      this.g.sound?.play('ko');
    }
    this.result = r;
    this.g.flags.battle_tutorial = true;
  }

  // ------------------------------------------------------------ commands
  rootList() {
    const b = this.b;
    const a = b.current;
    const list = [
      { id: 'attack', label: 'Attack' },
      { id: 'glaze', label: 'Glaze', disabled: !a.glazes.length },
      { id: 'item', label: 'Item', disabled: !b.itemsFor().length },
      { id: 'guard', label: 'Guard' },
    ];
    if (b.canLimit(a)) list.push({ id: 'limit', label: b.limitFor(a).name, fracture: true });
    return list;
  }

  choose(id) {
    const b = this.b;
    const a = b.current;
    const g = this.g;
    if (!a) return;
    g.sound?.play('confirm');
    if (id === 'guard') {
      b.command(a, { type: 'guard' });
    } else if (id === 'attack') {
      this.beginTarget({ type: 'attack', spec: { target: 'foe' } });
    } else if (id === 'glaze') {
      this.menu = { ...this.menu, stage: 'skill', idx: 0 };
    } else if (id === 'item') {
      this.menu = { ...this.menu, stage: 'item', idx: 0 };
    } else if (id === 'limit') {
      const lim = b.limitFor(a);
      if (lim.target === 'foe') this.beginTarget({ type: 'limit', spec: lim });
      else b.command(a, { type: 'limit' });
    }
  }

  beginTarget(pend) {
    const b = this.b;
    const a = b.current;
    const spec = pend.spec;
    if (spec.target === 'allFoes' || spec.target === 'allAllies' || spec.target === 'self') {
      b.command(a, { type: pend.type, skill: pend.skill, item: pend.item });
      return;
    }
    const tlist = b.targetsFor(a, spec);
    if (!tlist.length) return;
    const tIdx = Math.max(0, tlist.findIndex((t) => t.uid === pend.last));
    this.menu = { ...this.menu, stage: 'target', pend, tlist, tIdx };
  }

  confirmTarget(uid) {
    const b = this.b;
    const a = b.current;
    const p = this.menu.pend;
    if (!a || !p) return;
    this.g.sound?.play('confirm');
    b.command(a, { type: p.type, skill: p.skill, item: p.item, target: uid });
  }

  back() {
    const m = this.menu;
    this.g.sound?.play('cancel');
    if (m.stage === 'target') this.menu = { ...m, stage: m.pend && m.pend.type === 'skill' ? 'skill' : m.pend && m.pend.type === 'item' ? 'item' : 'root', pend: null };
    else if (m.stage !== 'root') this.menu = { ...m, stage: 'root', idx: 0 };
  }

  pickSkill(s) {
    if (!s.ok) return;
    this.g.sound?.play('confirm');
    this.beginTarget({ type: 'skill', skill: s.id, spec: s });
  }
  pickItem(it) {
    this.g.sound?.play('confirm');
    this.beginTarget({ type: 'item', item: it.id, spec: { target: it.target || 'ally' } });
  }

  key(k) {
    if (this.result) {
      if (k === 'Enter' || k === ' ' || k === 'z') this.leave();
      return;
    }
    const b = this.b;
    if (!b.current) return;
    const m = this.menu;
    if (k === 'Escape' || k === 'x') {
      this.back();
      return;
    }
    if (m.stage === 'root') {
      const list = this.rootList();
      if (k === 'ArrowDown' || k === 'ArrowRight') m.idx = (m.idx + 1) % list.length;
      else if (k === 'ArrowUp' || k === 'ArrowLeft') m.idx = (m.idx + list.length - 1) % list.length;
      else if ((k === 'Enter' || k === ' ' || k === 'z') && !list[m.idx].disabled) this.choose(list[m.idx].id);
    } else if (m.stage === 'skill') {
      const skills = b.skillsFor(b.current);
      if (k === 'ArrowDown') m.idx = (m.idx + 1) % skills.length;
      else if (k === 'ArrowUp') m.idx = (m.idx + skills.length - 1) % skills.length;
      else if (k === 'Enter' || k === ' ' || k === 'z') this.pickSkill(skills[m.idx]);
    } else if (m.stage === 'item') {
      const items = b.itemsFor();
      if (k === 'ArrowDown') m.idx = (m.idx + 1) % items.length;
      else if (k === 'ArrowUp') m.idx = (m.idx + items.length - 1) % items.length;
      else if (k === 'Enter' || k === ' ' || k === 'z') this.pickItem(items[m.idx]);
    } else if (m.stage === 'target') {
      const n = m.tlist.length;
      if (k === 'ArrowRight' || k === 'ArrowDown') m.tIdx = (m.tIdx + 1) % n;
      else if (k === 'ArrowLeft' || k === 'ArrowUp') m.tIdx = (m.tIdx + n - 1) % n;
      else if (k === 'Enter' || k === ' ' || k === 'z') this.confirmTarget(m.tlist[m.tIdx].uid);
    }
  }

  leave() {
    if (!this.result) return;
    const r = this.result;
    this.done(r.outcome, r);
  }

  // tapping a sprite while choosing a target
  tapWorld(x, y) {
    if (this.result) {
      this.leave();
      return true;
    }
    const m = this.menu;
    if (m.stage !== 'target') return false;
    for (let i = 0; i < m.tlist.length; i++) {
      const c = m.tlist[i];
      const r = this.boundsOf(c);
      if (x >= r.x - 10 && x <= r.x + r.w + 10 && y >= r.y - 10 && y <= r.y + r.h + 10) {
        m.tIdx = i;
        this.confirmTarget(c.uid);
        return true;
      }
    }
    return false;
  }

  boundsOf(c) {
    const v = this.vis[c.uid];
    if (c.side === 'party') return figureBounds(c.id, v.x, v.y, v.scale);
    const eb = ENEMY_BOUNDS[c.kind] || { w: 90, h: 100 };
    const w = eb.w * v.scale;
    const h = eb.h * v.scale;
    return { x: v.x - w / 2, y: v.y - h - (c.kind === 'eel' ? 30 : eb.float || 0), w, h };
  }

  // ------------------------------------------------------------ conditions on screen
  chipsOf(c) {
    const out = [];
    if (c.charging) out.push({ label: 'STOKING', color: '#e8452a', ink: '#fff0d8' });
    for (const k of FX_ORDER) if (c.fx[k] > 0) out.push({ label: FX[k].label, color: FX[k].color, ink: k === 'haste' || k === 'brittle' ? '#2a1a10' : '#fff' });
    if (c.slow > 0) out.push({ label: 'Slow', color: '#9a8ad6', ink: '#fff' });
    if (c.guard) out.push({ label: 'Braced', color: '#b9a05a', ink: '#2a1a10' });
    return out;
  }

  drawChips(ctx, c, fr) {
    const chips = this.chipsOf(c);
    if (!chips.length) return;
    const r = this.boundsOf(c);
    const cx = r.x + r.w / 2;
    const y = r.y - 6;
    ctx.save();
    ctx.font = `800 10px ${FONT}`;
    ctx.textAlign = 'center';
    const ws = chips.map((k) => Math.ceil(ctx.measureText(k.label).width) + 12);
    const gap = 4;
    // two lines at most, wrapped by width, so a pile of conditions never spills off a phone
    const rows = [[]];
    let rw = 0;
    chips.forEach((k, i) => {
      if (rw + ws[i] > 150 && rows[rows.length - 1].length) {
        rows.push([]);
        rw = 0;
      }
      rows[rows.length - 1].push(i);
      rw += ws[i] + gap;
    });
    rows.reverse().forEach((row, ri) => {
      const total = row.reduce((a, i) => a + ws[i] + gap, -gap);
      let x = cx - total / 2;
      const yy = y - ri * 16;
      for (const i of row) {
        const k = chips[i];
        const bob = k.label === 'STOKING' ? Math.sin(fr * 1.4) * 1.5 : 0;
        ctx.fillStyle = 'rgba(14,8,30,0.7)';
        ctx.beginPath();
        ctx.roundRect(x - 1, yy - 12 + bob - 1, ws[i] + 2, 16, 8);
        ctx.fill();
        ctx.fillStyle = k.color;
        ctx.beginPath();
        ctx.roundRect(x, yy - 12 + bob, ws[i], 14, 7);
        ctx.fill();
        ctx.fillStyle = k.ink;
        ctx.fillText(k.label, x + ws[i] / 2, yy - 2 + bob);
        x += ws[i] + gap;
      }
    });
    ctx.restore();
  }

  // small, cheap marks on the sprite itself: drips, cracks, embers, a stamp, speed lines, a banked fire
  drawFxOverlay(ctx, c, fr) {
    const fx = c.fx;
    if (!(c.charging || fx.soaked > 0 || fx.brittle > 0 || fx.scorched > 0 || fx.hushed > 0 || fx.haste > 0)) return;
    const r = this.boundsOf(c);
    const cx = r.x + r.w / 2;
    ctx.save();
    if (c.charging) {
      const pulse = 0.5 + 0.5 * Math.sin(this.tellT * 7);
      glow(ctx, cx, r.y + r.h * 0.55, Math.max(r.w, r.h) * (0.8 + 0.1 * pulse), '#ff3a1a', 0.22 + 0.14 * pulse);
    }
    if (fx.soaked > 0) {
      for (let i = 0; i < 5; i++) {
        const t = ((fr * 0.09 + i * 0.37) % 1);
        const x = r.x + r.w * (0.15 + 0.7 * ((i * 0.37 + 0.13) % 1));
        const y = r.y + r.h * (0.1 + t * 0.85);
        ctx.fillStyle = `rgba(120,200,255,${0.75 * (1 - t * 0.6)})`;
        ctx.beginPath();
        ctx.ellipse(x, y, 2.2, 3.6, 0, 0, TAU);
        ctx.fill();
      }
    }
    if (fx.brittle > 0) {
      ctx.strokeStyle = 'rgba(40,18,8,0.7)';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const x0 = cx - r.w * 0.12;
      const y0 = r.y + r.h * 0.28;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + 7, y0 + 12);
      ctx.lineTo(x0 - 2, y0 + 22);
      ctx.lineTo(x0 + 9, y0 + 36);
      ctx.moveTo(x0 + 7, y0 + 12);
      ctx.lineTo(x0 + 19, y0 + 16);
      ctx.stroke();
    }
    if (fx.scorched > 0) {
      for (let i = 0; i < 4; i++) {
        const t = ((fr * 0.12 + i * 0.29) % 1);
        const x = r.x + r.w * (0.2 + 0.6 * ((i * 0.41 + 0.2) % 1)) + Math.sin(fr * 0.8 + i) * 3;
        ctx.fillStyle = `rgba(255,${140 + i * 20},60,${0.9 * (1 - t)})`;
        ctx.beginPath();
        ctx.ellipse(x, r.y + r.h * (0.85 - t * 0.7), 3, 4.4, 0, 0, TAU);
        ctx.fill();
      }
    }
    if (fx.hushed > 0) {
      ctx.translate(cx + r.w * 0.2, r.y + r.h * 0.12);
      ctx.rotate(-0.2);
      ctx.strokeStyle = 'rgba(201,80,63,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-22, -8, 44, 16);
      ctx.fillStyle = 'rgba(201,80,63,0.9)';
      ctx.font = `800 9px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('DENIED', 0, 3.5);
    }
    if (fx.haste > 0 && c.side === 'party') {
      ctx.strokeStyle = 'rgba(255,230,120,0.7)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const y = r.y + r.h * (0.3 + i * 0.22);
        const o = (fr * 3 + i * 5) % 16;
        ctx.beginPath();
        ctx.moveTo(r.x + r.w + 4 + o, y);
        ctx.lineTo(r.x + r.w + 18 + o, y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // what the party has actually seen of this enemy: "weak fire · resists water"
  knownNote(f) {
    const k = this.known[f.kind];
    if (!k) return '';
    const parts = [];
    if (k.weak.length) parts.push('weak ' + k.weak.join('/'));
    if (k.resist.length) parts.push('resists ' + k.resist.join('/'));
    return parts.join(' · ');
  }

  // ------------------------------------------------------------ render
  render(ctx, fr) {
    const b = this.b;
    const v = this.g.view;
    if (this.layoutKey !== `${v.w}x${v.h}`) this.relayout();
    const L = this.L;
    ctx.save();
    if (this.kick > 0.01) {
      // heavy moments shove the camera: a tiny push-in and a stop-motion jolt
      const k = this.kick;
      ctx.translate(v.w / 2, v.h / 2);
      ctx.scale(1 + k * 0.02, 1 + k * 0.02);
      ctx.translate(Math.sin(fr * 7.1) * k * 5 - v.w / 2, Math.cos(fr * 5.3) * k * 3.4 - v.h / 2);
    }
    if (L.portrait) paintBattleBG(ctx, this.theme, fr, { w: v.w, h: v.h, horizon: L.horizon });
    else paintBattleBG(ctx, this.theme, fr);
    if (this.boss) {
      const bf = b.foes[0];
      glow(ctx, v.w / 2, L.portrait ? L.horizon + 40 : 330, L.portrait ? 300 : 380, bf.enraged ? '#ff3a1a' : '#ff6a2a', bf.enraged ? 0.18 : 0.08);
    }
    // the fight is lit from the middle of the floor, so every shadow leans away from the centre
    setKeyLights([{ x: v.w / 2, y: L.portrait ? L.horizon + 120 : 360, r: Math.max(260, v.w * 0.4), a: 0.5 }]);
    const sprites = [];
    for (const f of b.foes) if (!this.vis[f.uid].gone) sprites.push(f);
    for (const p of b.party) sprites.push(p);
    sprites.sort((a, c) => this.vis[a.uid].y - this.vis[c.uid].y);
    const curUid = b.current?.uid;
    for (const c of sprites) {
      const v = this.vis[c.uid];
      const lungeAmt = v.lunge > 0 ? Math.sin((1 - v.lunge / 0.45) * Math.PI) * 64 * (v.lungeDir || 1) : 0;
      // sideways when the sides face each other across the screen, towards/away from the camera when stacked
      const lunge = L.portrait ? 0 : lungeAmt;
      const lungeY = L.portrait ? lungeAmt * 0.9 : 0;
      if (c.side === 'foe') {
        if (v.dead >= 1) {
          v.gone = true;
          continue;
        }
        drawEnemy(ctx, c.kind, v.x, v.y + lungeY, { frame: fr, flash: v.flash > 0, dead: v.dead, lunge, enraged: c.enraged, scale: v.scale });
      } else {
        const ready = c.uid === curUid;
        if (ready) {
          ctx.save();
          ctx.translate(v.x, v.y + 4);
          ctx.scale(1, 0.28);
          const rg = ctx.createRadialGradient(0, 0, 10, 0, 0, 52);
          rg.addColorStop(0, 'rgba(255,214,120,0.0)');
          rg.addColorStop(0.7, 'rgba(255,214,120,0.7)');
          rg.addColorStop(1, 'rgba(255,214,120,0)');
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.arc(0, 0, 52, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
        if (v.cast > 0) glow(ctx, v.x, v.y - 60, 90, CHARACTERS[c.id].color, 0.5);
        const mood = v.ko ? 'ko' : v.hurt > 0 ? 'hurt' : this.result?.outcome === 'win' ? 'cheer' : 'idle';
        const hop = ready ? -Math.abs(Math.sin(fr * 0.6)) * 4 : 0;
        drawFigure(ctx, c.id, v.x + lunge, v.y + hop + lungeY, { frame: fr, facing: -1, scale: v.scale, mood, squash: v.cast > 0 ? 0.94 : 1 });
      }
    }
    // conditions: what is wrong with each of them, written on the clay
    for (const c of sprites) {
      if (!c.alive || this.vis[c.uid].gone) continue;
      this.drawFxOverlay(ctx, c, fr);
    }
    for (const c of sprites) {
      if (!c.alive || this.vis[c.uid].gone || this.result) continue;
      this.drawChips(ctx, c, fr);
    }
    // target arrows
    const m = this.menu;
    if (m.stage === 'target' && !this.result) {
      m.tlist.forEach((c, i) => {
        const r = this.boundsOf(c);
        const bob = Math.sin(fr * 0.8) * 3;
        const x = r.x + r.w / 2;
        const y = r.y - 14 - (this.chipsOf(c).length ? 20 : 0) + bob;
        const sel = i === m.tIdx;
        drawClay(ctx, [[x - 12, y - 18], [x + 12, y - 18], [x, y + 2]], { color: sel ? UI.gold : '#cbbfe8', seed: 900 + i, frame: fr, outline: 1.4, gloss: 0.8 });
        if (sel) glow(ctx, x, y - 8, 40, UI.gold, 0.45);
      });
    }
    // popups
    for (const p of this.popups) {
      const k = 1 - p.t / p.max;
      const y = p.y - k * 34;
      const size = p.big ? 38 : 28;
      clayText(ctx, p.text, p.x, y, size, p.color, { align: 'center', frame: fr, jitter: 1, depth: 2 });
      if (p.sub) text(ctx, p.sub, p.x, y + 20, 15, '#ffe9a0', { align: 'center', weight: '800' });
    }
    ctx.restore();
    filmFinish(ctx, v.w, v.h, fr, { vignette: 0.5, ...GRADES[this.theme] });
    if (L.portrait) this.renderUIPortrait(ctx, fr);
    else this.renderUI(ctx, fr);
  }

  renderUI(ctx, fr) {
    const g = this.g;
    const b = this.b;
    // boss bar
    if (this.boss && b.foes[0].alive) {
      const f = b.foes[0];
      panel(ctx, 230, 14, 500, 38, fr, { color: '#2a1020', seed: 701 });
      text(ctx, f.name, 246, 39, 17, UI.gold, { weight: '800' });
      bar(ctx, 370, 24, 346, 16, f.hp / f.maxHp, f.enraged ? '#ff5a3a' : '#e8745c', fr);
    }
    if (this.banner) {
      const w = 56 + this.banner.text.length * 12;
      panel(ctx, 480 - w / 2, 66, w, 42, fr, { color: this.banner.warn ? '#6a1a20' : this.banner.gold ? '#6a4a10' : '#2a2660', seed: 702 });
      text(ctx, this.banner.text, 480, 95, 22, this.banner.warn ? '#ffc9a0' : this.banner.gold ? '#ffe9a0' : UI.ink, { align: 'center', weight: '800' });
    }
    // bottom: enemies | command | party
    panel(ctx, 12, PANEL_Y, 222, PANEL_H, fr, { color: '#2a2660', seed: 710 });
    const alive = b.foes.filter((f) => f.alive).slice(0, 4);
    alive.forEach((f, i) => {
      const dy = alive.length > 3 ? 22 : 29; // three enemies get a line of what we know about each
      text(ctx, f.name, 26, PANEL_Y + 24 + i * dy, 14, f.slow > 0 ? '#d9c9ff' : UI.ink, { weight: '700' });
      const note = alive.length > 3 ? '' : this.knownNote(f);
      if (note) text(ctx, note, 26, PANEL_Y + 35 + i * dy, 9, UI.dim, { weight: '600' });
    });
    if (!b.foes.some((f) => f.alive)) text(ctx, '—', 26, PANEL_Y + 48, 16, UI.dim);

    panel(ctx, 242, PANEL_Y, 236, PANEL_H, fr, { color: '#2a2660', seed: 711 });
    this.renderCommands(ctx, fr);

    panel(ctx, 486, PANEL_Y, 462, PANEL_H, fr, { color: '#2a2660', seed: 712 });
    const cur = b.current;
    // column captions sit on their own line so three rows never collide with them
    text(ctx, 'HP', 596, PANEL_Y + 18, 10, UI.dim, { weight: '600' });
    text(ctx, 'MP', 664, PANEL_Y + 18, 10, UI.dim, { weight: '600' });
    text(ctx, 'TIME', 756, PANEL_Y + 18, 10, UI.dim, { weight: '600' });
    text(ctx, 'FRACTURE', 884, PANEL_Y + 18, 10, UI.dim, { weight: '600' });
    b.party.forEach((p, i) => {
      const y = PANEL_Y + 24 + i * 27;
      const col = CHARACTERS[p.id].color;
      const isCur = cur && cur.uid === p.uid;
      if (isCur) {
        slab(ctx, 492, y - 1, 450, 25, { color: '#5a4eb0', seed: 720 + i, frame: fr, alpha: 0.55, noRim: true, outline: 0, tex: 0 });
      }
      text(ctx, p.name, 502, y + 17, 15, p.alive ? col : '#8a84a8', { weight: '800' });
      text(ctx, `${p.hp}`, 626, y + 17, 15, p.hp / p.maxHp < 0.3 ? UI.red : UI.ink, { align: 'right', weight: '700' });
      text(ctx, `/${p.maxHp}`, 626, y + 17, 11, UI.dim, { weight: '500' });
      bar(ctx, 664, y + 5, 52, 8, p.mp / Math.max(1, p.maxMp), '#4a9ae0', fr);
      text(ctx, `${p.mp}`, 722, y + 14, 11, UI.blue, { weight: '600' });
      const full = p.atb >= 100;
      bar(ctx, 756, y + 4, 120, 12, p.atb / 100, full ? '#ffd27a' : p.slow > 0 ? '#9a8ad6' : '#6ac46a', fr);
      bar(ctx, 884, y + 6, 50, 8, p.limit / 100, p.limit >= 100 ? '#ffe9a0' : '#ff9a3a', fr);
    });

    const banking = b.foes.find((f) => f.alive && f.charging);
    if (banking && !this.result) {
      text(ctx, 'The fire is banked. Water puts it out!', 480, 136, 18, '#ffc9a0', { align: 'center', weight: '800' });
    } else if (this.hintShown && cur && !this.result) {
      text(ctx, 'Tap a command when a name glows. Weak points hurt double.', 480, 136, 16, UI.ink, { align: 'center', weight: '600' });
    }
    if (this.menu.stage === 'target') {
      text(ctx, 'Choose a target', 480, 128, 20, UI.gold, { align: 'center', weight: '800' });
    }
    if (this.result) this.renderResult(ctx, fr);
    void g;
  }

  renderCommands(ctx, fr) {
    const g = this.g;
    const b = this.b;
    const a = b.current;
    const m = this.menu;
    if (!a || b.result) {
      text(ctx, b.result ? '' : 'Gauges filling…', 360, PANEL_Y + 50, 15, UI.dim, { align: 'center', weight: '500' });
      return;
    }
    text(ctx, a.name, 256, PANEL_Y + 20, 14, CHARACTERS[a.id].color, { weight: '800' });
    const BH = 38; // finger-sized: about 27 CSS px on a phone held sideways
    if (m.stage === 'target') {
      button(ctx, g, fr, 'cmd-cancel', 'Cancel', 252, PANEL_Y + 26, 216, BH * 2 + 4, () => this.back(), { size: 18, color: '#6a3f4a', hover: '#8a5060' });
      return;
    }
    if (m.stage === 'root') {
      const list = this.rootList();
      list.forEach((o, i) => {
        const sel = m.idx === i;
        if (o.fracture) {
          // the limit move floats above the panel as a big gold button, impossible to miss
          button(ctx, g, fr, `cmd-${o.id}`, o.label, 242, PANEL_Y - 50, 236, 42, () => { m.idx = i; this.choose(o.id); }, { size: 17, color: '#a8641a', hover: '#d08a2a' });
          return;
        }
        const col = i % 2;
        const row = Math.floor(i / 2);
        button(ctx, g, fr, `cmd-${o.id}`, o.label, 252 + col * 110, PANEL_Y + 26 + row * (BH + 4), 106, BH, () => { m.idx = i; this.choose(o.id); }, { size: 15, disabled: o.disabled, color: sel ? '#7a6ad6' : UI.panel2, hover: '#6a62c4' });
      });
      return;
    }
    // submenu floats above the command panel
    const rows = m.stage === 'skill' ? b.skillsFor(a) : b.itemsFor();
    const h = 52 + rows.length * 42;
    const x = 242;
    const y = PANEL_Y - h - 6;
    panel(ctx, x, y, 236, h, fr, { color: '#2a2660', seed: 730 });
    text(ctx, m.stage === 'skill' ? 'Glazes' : 'Items', x + 118, y + 28, 17, UI.gold, { align: 'center', weight: '800' });
    rows.forEach((r, i) => {
      const label = m.stage === 'skill' ? (r.hushed ? `${r.name}  (hushed)` : `${r.name}${r.lv > 1 ? ' Lv' + r.lv : ''}   ${r.mp} MP`) : `${r.name} ×${r.count}`;
      button(ctx, g, fr, `sub-${i}`, label, x + 12, y + 40 + i * 42, 212, BH, () => { m.idx = i; if (m.stage === 'skill') this.pickSkill(r); else this.pickItem(r); }, { size: 15, disabled: m.stage === 'skill' && !r.ok, color: m.idx === i ? '#7a6ad6' : UI.panel2 });
    });
    button(ctx, g, fr, 'cmd-back', 'Back', 252, PANEL_Y + 26, 216, BH * 2 + 4, () => this.back(), { size: 18, color: '#6a3f4a', hover: '#8a5060' });
  }

  renderResult(ctx, fr) {
    const r = this.result;
    const v = this.g.view;
    const cx = v.w / 2;
    const pw = Math.min(520, v.w - 40);
    const py = v.portrait ? Math.round(v.h * 0.2) : 110;
    ctx.fillStyle = 'rgba(10,5,26,0.55)';
    ctx.fillRect(0, 0, v.w, v.h);
    const won = r.outcome === 'win';
    const ph = v.portrait ? 340 : 280;
    panel(ctx, cx - pw / 2, py, pw, ph, fr, { color: '#2a2660', seed: 740 });
    clayText(ctx, won ? (r.spared ? 'A TRUCE' : 'VICTORY') : 'DEFEATED', cx, py + 68, v.portrait ? 52 : 58, won ? '#f2d9a0' : '#c98a9a', { align: 'center', frame: fr, tracking: 4 });
    if (won) {
      text(ctx, `Everyone gains ${r.xp} XP${r.ap ? `  ·  glazes +${r.ap} AP` : ''}`, cx, py + 112, 20, UI.ink, { align: 'center', weight: '700' });
      const rows = [];
      for (const u of r.ups) rows.push({ main: `${CHARACTERS[u.id].name} reached Lv ${u.level}`, sub: `HP +${u.gains.hp}  MP +${u.gains.mp}  ATK +${u.gains.atk}  MAG +${u.gains.mag}`, color: UI.gold });
      for (const u of r.glazeUps || []) rows.push({ main: `${GLAZES[u.glaze].name} glaze reached Lv ${u.level}!`, sub: GLAZE_NOTES[u.glaze][u.level - 1].replace(/^Lv \d: /, ''), color: GLAZES[u.glaze].color });
      rows.slice(0, 4).forEach((row, i) => {
        if (v.portrait) {
          text(ctx, row.main, cx, py + 152 + i * 40, 17, row.color, { align: 'center', weight: '700' });
          text(ctx, row.sub, cx, py + 171 + i * 40, 13, row.color, { align: 'center', weight: '500' });
        } else {
          text(ctx, `${row.main}   ${row.sub}`, cx, py + 148 + i * 24, 14, row.color, { align: 'center', weight: '600' });
        }
      });
      if (!rows.length) text(ctx, 'Wet clay holds its shape.', cx, py + 152, 16, UI.dim, { align: 'center', weight: '500' });
    } else {
      const lines = wrap(ctx, 'The tide takes you… and, a little ashamed, gives you back.', pw - 60, 17, '600');
      lines.forEach((ln, i) => text(ctx, ln, cx, py + 122 + i * 24, 17, UI.ink, { align: 'center', weight: '600' }));
    }
    text(ctx, 'tap to continue', cx, py + ph - 18, 15, UI.dim, { align: 'center', weight: '500' });
  }

  // ------------------------------------------------------------ portrait interface
  renderUIPortrait(ctx, fr) {
    const g = this.g;
    const b = this.b;
    const v = g.view;
    const L = this.L;
    const cur = b.current;
    const m = this.menu;
    // foe names stand under their feet
    for (const f of b.foes) {
      const e = this.vis[f.uid];
      if (!f.alive || e.gone) continue;
      text(ctx, f.name, e.x, e.y + 22, 15, f.slow > 0 ? '#d9c9ff' : UI.ink, { align: 'center', weight: '700' });
      const note = this.knownNote(f);
      if (note) text(ctx, note, e.x, e.y + 36, 11, UI.dim, { align: 'center', weight: '600' });
    }
    // boss bar / action banner
    if (this.boss && b.foes[0].alive) {
      const f = b.foes[0];
      panel(ctx, 14, 12, v.w - 28, 42, fr, { color: '#2a1020', seed: 701 });
      text(ctx, f.name, 30, 40, 18, UI.gold, { weight: '800' });
      bar(ctx, 160, 24, v.w - 190, 18, f.hp / f.maxHp, f.enraged ? '#ff5a3a' : '#e8745c', fr);
    }
    if (this.banner) {
      const w = Math.min(v.w - 28, 56 + this.banner.text.length * 13);
      const by = this.boss ? 66 : 20;
      panel(ctx, v.w / 2 - w / 2, by, w, 46, fr, { color: this.banner.warn ? '#6a1a20' : this.banner.gold ? '#6a4a10' : '#2a2660', seed: 702 });
      text(ctx, this.banner.text, v.w / 2, by + 32, 23, this.banner.warn ? '#ffc9a0' : this.banner.gold ? '#ffe9a0' : UI.ink, { align: 'center', weight: '800' });
    }
    const banking = b.foes.find((f) => f.alive && f.charging);
    if (banking && !this.result) text(ctx, 'The fire is banked. Water puts it out!', v.w / 2, this.boss ? 140 : 100, 18, '#ffc9a0', { align: 'center', weight: '800' });
    else if (this.hintShown && cur && !this.result) text(ctx, 'Tap a command when a name glows.', v.w / 2, this.boss ? 140 : 100, 17, UI.ink, { align: 'center', weight: '600' });
    if (m.stage === 'target' && !this.result) text(ctx, 'Choose a target', v.w / 2, this.boss ? 140 : 100, 24, UI.gold, { align: 'center', weight: '800' });

    // status plates: one per party member, under their feet
    const gap = 6;
    const pw = Math.floor((v.w - 16 - gap * 2) / 3);
    b.party.forEach((p, i) => {
      const x = 8 + i * (pw + gap);
      const y = L.plateY;
      const isCur = cur && cur.uid === p.uid;
      panel(ctx, x, y, pw, L.plateH, fr, { color: isCur ? '#4a3f9a' : '#2a2660', seed: 710 + i });
      const col = CHARACTERS[p.id].color;
      text(ctx, p.name, x + 12, y + 24, 16, p.alive ? col : '#8a84a8', { weight: '800' });
      text(ctx, `${p.hp}`, x + pw - 12, y + 24, 15, p.hp / p.maxHp < 0.3 ? UI.red : UI.ink, { align: 'right', weight: '700' });
      bar(ctx, x + 12, y + 32, pw - 24, 10, p.hp / p.maxHp, '#5cc46a', fr);
      bar(ctx, x + 12, y + 48, pw - 24 - 30, 8, p.mp / Math.max(1, p.maxMp), '#4a9ae0', fr);
      text(ctx, `${p.mp}`, x + pw - 12, y + 57, 11, UI.blue, { align: 'right', weight: '600' });
      const full = p.atb >= 100;
      bar(ctx, x + 12, y + 64, pw - 24 - 54, 14, p.atb / 100, full ? '#ffd27a' : p.slow > 0 ? '#9a8ad6' : '#6ac46a', fr);
      bar(ctx, x + pw - 12 - 46, y + 67, 46, 8, p.limit / 100, p.limit >= 100 ? '#ffe9a0' : '#ff9a3a', fr);
    });

    // command panel
    panel(ctx, 14, L.cmdY, v.w - 28, L.cmdH, fr, { color: '#2a2660', seed: 711 });
    this.renderCommandsPortrait(ctx, fr);
    if (this.result) this.renderResult(ctx, fr);
    void m;
  }

  renderCommandsPortrait(ctx, fr) {
    const g = this.g;
    const b = this.b;
    const v = g.view;
    const L = this.L;
    const a = b.current;
    const m = this.menu;
    const x0 = 30;
    const iw = v.w - 60;
    const top = L.cmdY + 44;
    const availH = L.cmdH - 44 - 16;
    if (!a || b.result) {
      text(ctx, b.result ? '' : 'Gauges filling…', v.w / 2, L.cmdY + L.cmdH / 2 + 6, 18, UI.dim, { align: 'center', weight: '500' });
      return;
    }
    text(ctx, a.name, x0, L.cmdY + 32, 19, CHARACTERS[a.id].color, { weight: '800' });
    if (m.stage === 'target') {
      button(ctx, g, fr, 'cmd-cancel', 'Cancel', x0, top, iw, availH, () => this.back(), { size: 22, color: '#6a3f4a', hover: '#8a5060' });
      return;
    }
    const lay = (n, cols) => {
      const rows = Math.ceil(n / cols);
      const bh = Math.min(84, (availH - (rows - 1) * 8) / rows);
      return { rows, bh };
    };
    if (m.stage === 'root') {
      const list = this.rootList();
      const normal = list.filter((o) => !o.fracture);
      const lim = list.find((o) => o.fracture);
      const { bh } = lay(normal.length + (lim ? 2 : 0), 2);
      const bw = (iw - 10) / 2;
      normal.forEach((o, i) => {
        const sel = m.idx === list.indexOf(o);
        button(ctx, g, fr, `cmd-${o.id}`, o.label, x0 + (i % 2) * (bw + 10), top + Math.floor(i / 2) * (bh + 8), bw, bh, () => { m.idx = list.indexOf(o); this.choose(o.id); }, { size: 21, disabled: o.disabled, color: sel ? '#7a6ad6' : UI.panel2, hover: '#6a62c4' });
      });
      if (lim) {
        const idx = list.indexOf(lim);
        button(ctx, g, fr, `cmd-${lim.id}`, lim.label, x0, top + 2 * (bh + 8), iw, bh, () => { m.idx = idx; this.choose(lim.id); }, { size: 21, color: '#a8641a', hover: '#d08a2a' });
      }
      return;
    }
    // glaze / item list inside the panel, with Back as the last row
    const rows = m.stage === 'skill' ? b.skillsFor(a) : b.itemsFor();
    const { bh } = lay(rows.length + 1, 1);
    rows.forEach((r, i) => {
      const label = m.stage === 'skill' ? (r.hushed ? `${r.name}  (hushed)` : `${r.name}${r.lv > 1 ? ' Lv' + r.lv : ''}   ${r.mp} MP`) : `${r.name} ×${r.count}`;
      button(ctx, g, fr, `sub-${i}`, label, x0, top + i * (bh + 8), iw, bh, () => { m.idx = i; if (m.stage === 'skill') this.pickSkill(r); else this.pickItem(r); }, { size: 20, disabled: m.stage === 'skill' && !r.ok, color: m.idx === i ? '#7a6ad6' : UI.panel2 });
    });
    button(ctx, g, fr, 'cmd-back', 'Back', x0, top + rows.length * (bh + 8), iw, bh, () => this.back(), { size: 20, color: '#6a3f4a', hover: '#8a5060' });
  }
}
