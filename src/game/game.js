// The Game: owns state, input, the scripting helpers scenes use (say / ask / battle / go ...),
// saving, and the render order. Rendering takes a ctx and a stop-motion frame number, so the same
// code drives the live game, the screenshot tool and the tests.

import { SCENES } from './scenes.js';
import { BANTER } from './banter.js';
import { BattleView } from './battleview.js';
import { CLUES, DEDUCTIONS, dedFor, ITEMS, GLAZES, CHARACTERS, newMember, statsAt } from './data.js';
import { scrambleLamps, pressLamp, isLit } from './puzzles.js';
import { drawFigure, figureBounds } from '../engine/actors.js';
import { PROPS, PROP_W } from '../engine/props.js';
import { setKeyLights } from '../engine/noir.js';
import { filmFinish } from '../engine/clay.js';
import { paintTitle, paintAtmos, paintFore, setStageExtend, lightsNow, GRADES } from '../engine/stage.js';
import { setParallax } from '../engine/depth.js';
import { clamp, lerp, mulberry32 } from '../engine/rng.js';
import { drawHud, drawHover, drawToasts, drawDialogue, drawChoice, drawMenu, drawLampPuzzle, drawTitleUI, drawEnding, drawEdgeHints, sparkle } from './ui.js';

// The logical canvas is 960x540 in landscape, or 540 wide by (up to ~1200) tall in portrait. In portrait the world
// (always painted as a 960x540 diorama) is shown through a follow camera, zoomed up to 1.6x, under a HUD bar.
export const WORLD_W = 960;
export const WORLD_H = 540;
export function makeView(w = 960, h = 540) {
  const portrait = h > w;
  const top = portrait ? 92 : 0;
  const z = portrait ? clamp((h - top) / WORLD_H, 0.85, 1.6) : 1;
  // `ext`: world units of extra floor painted under the diorama when the phone is taller than the band
  const ext = portrait ? Math.max(0, (h - top) / z - WORLD_H) : 0;
  return { w, h, portrait, top, z, bandH: WORLD_H * z, ext };
}

// Where a figure's eyes should point, in the figure's own mirrored space (+x is the way it faces, +y is down).
function gaze(sp, at) {
  if (!at) return [0.55, 0];
  const dx = at[0] - sp.x;
  const dy = at[1] - 62 - (sp.y - 100 * (sp.scale || 1)); // aim at the other one's face, from this one's eyes
  const d = Math.max(70, Math.hypot(dx, dy));
  return [clamp((dx / d) * 1.25 * sp.face, -1, 1), clamp((dy / d) * 1.1, -1, 1)];
}

const SAVE_KEY = 'hollow-tide.save.v1';
const ENDING_KEY = 'hollow-tide.ending';
const SPEED = 215;

export class Game {
  constructor({ sound = null, storage = null, seed = null } = {}) {
    this.sound = sound;
    this.storage = storage;
    this.time = 0;
    this.dirty = true;
    this.pointer = { x: -100, y: -100 };
    this.touch = false;
    this.buttons = [];
    this.mode = 'title';
    this.state = this.freshState();
    this.dialogue = null;
    this.choice = null;
    this.menu = null;
    this.puzzle = null;
    this.bv = null;
    this.ending = null;
    this.toasts = [];
    this.fade = { a: 1, to: 0, speed: 1.4, resolve: null };
    this.waits = [];
    this.tweens = [];
    this.script = false;
    this.walk = null;
    this.moving = false;
    this.walkT = 0;
    this.stepAcc = 0;
    this.trail = [];
    this.hoverName = '';
    this.hoverHot = false;
    this.danger = { dist: 0, cd: 2 };
    this.rng = mulberry32(seed ?? (Date.now() & 0xffffff));
    this.view = makeView(960, 540);
    this.cam = { x: 0 };
    this.camMoving = false;
    this.para = 0; // how far the camera sits from the middle of the set: drives the multiplane parallax
    this.dolly = 0; // 0..1: how much of a dialogue shot we are in (vignette, hides the sparkles)
    this.zoomK = 0; // the lean-in on whoever is talking (extra scale)
    this.lift = 0; // how far the set is tilted up so the speaker clears the dialogue box (world units)
    this.liftFull = 0;
    this.boxTop = 392; // top of the dialogue box on screen; ui.js keeps it current
    this.dollyAt = [480, 400];
    this.hoverAt = null; // world position of the hotspot under the pointer, so the lead can glance at it
    this.lastEnding = this.read(ENDING_KEY);
    this.sound?.music('title');
  }

  // ------------------------------------------------------------------ viewport + camera
  get portrait() {
    return this.view.portrait;
  }
  setViewport(w, h) {
    const v = this.view;
    if (v.w === w && v.h === h) return;
    this.view = makeView(w, h);
    this.snapCamera();
    if (this.bv) this.bv.relayout?.();
    this.dirty = true;
  }
  camTarget() {
    const v = this.view;
    const visW = v.w / v.z;
    const max = Math.max(0, WORLD_W - visW);
    return clamp(this.state.px + this.state.facing * 36 - visW / 2, 0, max);
  }
  snapCamera() {
    this.cam.x = this.camTarget();
    this.para = this.paraTarget();
  }
  // Portrait pans a real camera across the set; landscape (the whole set is in frame) sways a little with the lead,
  // as if the animation stand were being nudged to follow them. Either way the planes of the set slide at their own speeds.
  paraTarget() {
    const v = this.view;
    if (v.portrait) return this.cam.x + v.w / v.z / 2 - 480;
    return clamp((this.state.px - 480) / 480, -1, 1) * 22;
  }
  updateCamera(dt) {
    const d = this.camTarget() - this.cam.x;
    this.camMoving = Math.abs(d) > 0.3;
    if (Math.abs(d) >= 0.05) this.cam.x += d * (1 - Math.exp(-dt * 6));
    const pt = this.paraTarget();
    const pd = pt - this.para;
    if (Math.abs(pd) > 0.15) this.camMoving = true;
    this.para = Math.abs(pd) < 0.02 ? pt : this.para + pd * (1 - Math.exp(-dt * 3.4));
    // Dialogue framing. While someone talks the camera leans in on them (zoom) and tilts the set up so they stand clear of
    // the dialogue box (lift); narration only breathes in a little. Everything eases back out afterwards.
    const dlg = this.mode === 'explore' ? this.dialogue : null;
    const ease = 1 - Math.exp(-dt * 2.6);
    const approach = (key, want) => {
      const d = want - this[key];
      if (Math.abs(d) > 0.004) {
        this[key] += d * ease;
        this.camMoving = true;
      } else this[key] = want;
    };
    approach('dolly', dlg ? 1 : 0);
    approach('zoomK', dlg ? (dlg.who === 'narr' ? 0.03 : 0.085) : 0);
    approach('lift', dlg && dlg.who !== 'narr' ? this.liftFull : 0);
  }
  // screen (logical canvas) coordinates -> world (diorama) coordinates, and back
  toWorld(sx, sy) {
    const v = this.view;
    return [this.cam.x + sx / v.z, (sy - v.top) / v.z];
  }
  toScreen(wx, wy) {
    const v = this.view;
    return [(wx - this.cam.x) * v.z, wy * v.z + v.top];
  }
  // draw `fn` in world coordinates through the camera, clipped to the world band
  inWorld(ctx, fn) {
    const v = this.view;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, v.top, v.w, v.portrait ? v.h - v.top : v.bandH);
    ctx.clip();
    ctx.translate(-this.cam.x * v.z, v.top);
    ctx.scale(v.z, v.z);
    fn();
    ctx.restore();
  }

  // ------------------------------------------------------------------ state
  freshState() {
    return {
      scene: 'pier', px: 480, py: 478, facing: 1,
      flags: {}, clues: [], inv: { wetclay: 0, slipdraught: 0 }, glazes: ['ember'],
      party: [newMember('marl', 4, ['ember', null])],
      lamps: scrambleLamps(17, 5).grid, signPos: 0, signFails: 0, seen: {}, eyeT: 0,
      glazeAp: {}, bestiary: {}, bond: {}, said: {}, deduced: [],
    };
  }
  get flags() {
    return this.state.flags;
  }
  flag(k) {
    return !!this.state.flags[k];
  }
  setFlag(k, v = true) {
    this.state.flags[k] = v;
    this.dirty = true;
  }
  get scene() {
    return SCENES[this.state.scene];
  }

  read(key) {
    try {
      return this.storage ? this.storage.getItem(key) : null;
    } catch {
      return null;
    }
  }
  write(key, val) {
    try {
      if (this.storage) this.storage.setItem(key, val);
    } catch {
      /* private mode etc. */
    }
  }
  hasSave() {
    return !!this.read(SAVE_KEY);
  }
  save() {
    if (this.mode === 'title') return;
    this.write(SAVE_KEY, JSON.stringify({ v: 1, state: this.state }));
  }

  // ------------------------------------------------------------------ lifecycle
  newGame() {
    this.sound?.init();
    this.sound?.resume();
    this.state = this.freshState();
    this.startPlaying();
  }
  continueGame() {
    this.sound?.init();
    this.sound?.resume();
    try {
      const data = JSON.parse(this.read(SAVE_KEY));
      this.state = { ...this.freshState(), ...data.state };
    } catch {
      this.state = this.freshState();
    }
    this.startPlaying();
  }
  startPlaying() {
    this.mode = 'explore';
    this.dialogue = null;
    this.choice = null;
    this.menu = null;
    this.ending = null;
    this.loadScene(this.state.scene, this.state.px, this.state.py);
    this.fade = { a: 1, to: 0, speed: 1.2, resolve: null };
    this.run(async () => {
      await this.scene.enter?.(this);
    });
  }
  toTitle() {
    if (this.ending) {
      this.write(ENDING_KEY, this.ending.key);
      this.lastEnding = this.ending.key;
      const r = this.ending.resolve;
      this.ending = null;
      r?.();
    }
    this.mode = 'title';
    this.dialogue = null;
    this.menu = null;
    this.fade = { a: 1, to: 0, speed: 1.2, resolve: null };
    this.sound?.music('title');
    this.dirty = true;
  }

  loadScene(id, x, y) {
    const sc = SCENES[id];
    this.state.scene = id;
    this.state.px = x ?? sc.start.x;
    this.state.py = y ?? sc.start.y;
    this.trail = [{ x: this.state.px, y: this.state.py }];
    this.walk = null;
    this.moving = false;
    this.danger = { dist: 0, cd: 2 };
    this.snapCamera();
    this.sound?.music(sc.music);
    this.dirty = true;
  }

  // ------------------------------------------------------------------ script helpers
  run(fn) {
    if (this.script) return;
    this.script = true;
    this.walk = null;
    Promise.resolve()
      .then(fn)
      .catch((e) => console.error('script error', e))
      .finally(() => {
        this.script = false;
        this.dirty = true;
      });
  }
  say(who, text, mood) {
    // Spoken lines should read cleanly aloud. Replace dash punctuation with a natural pause.
    const spoken = String(text).replace(/[—–]/g, ',').replace(/\s-\s/g, ', ');
    return new Promise((resolve) => {
      this.dialogue = { who, text: spoken, mood, acc: 0, shown: 0, done: false, resolve };
      this.dirty = true;
    });
  }
  advance() {
    const d = this.dialogue;
    if (!d) return;
    if (!d.done) {
      d.shown = 9999;
      d.done = true;
    } else {
      this.dialogue = null;
      this.sound?.play('click');
      d.resolve();
    }
    this.dirty = true;
  }
  ask(prompt, options) {
    return new Promise((resolve) => {
      this.choice = { prompt, options, resolve };
      this.dirty = true;
    });
  }
  pick(i) {
    const c = this.choice;
    if (!c) return;
    this.choice = null;
    c.resolve(i);
  }
  wait(sec) {
    return new Promise((resolve) => this.waits.push({ t: sec, resolve }));
  }
  fadeTo(a, dur = 0.5) {
    return new Promise((resolve) => {
      if (this.fade.resolve) this.fade.resolve();
      this.fade = { a: this.fade.a, to: a, speed: 1 / Math.max(0.01, dur), resolve };
    });
  }
  tween(key, to, dur) {
    this.tweens.push({ key, from: this.state[key] || 0, to, t: 0, dur });
  }
  sfx(name) {
    this.sound?.play(name);
  }
  toast(text, ttl = 3.2) {
    this.toasts.push({ text, ttl, max: ttl });
    if (this.toasts.length > 3) this.toasts.shift();
    this.dirty = true;
  }

  async go(id, x, y) {
    await this.fadeTo(1, 0.45);
    this.loadScene(id, x, y);
    this.save();
    await this.fadeTo(0, 0.45);
    await SCENES[id].enter?.(this);
  }

  battle(encId) {
    return new Promise((resolve) => {
      this.fadeTo(1, 0.35).then(() => {
        this.mode = 'battle';
        this.dialogue = null;
        this.menu = null;
        this.bv = new BattleView(this, encId, (outcome, result) => this.endBattle(outcome, resolve, result));
        this.fadeTo(0, 0.35);
      });
    });
  }
  async endBattle(outcome, resolve, result) {
    this.lastBattle = result || null; // scripts read this for things like a spared foe
    await this.fadeTo(1, 0.35);
    this.bv = null;
    this.mode = 'explore';
    this.sound?.music(this.scene.music);
    if (outcome === 'lose') {
      await this.gameOver();
      resolve('lose');
      return;
    }
    this.save();
    await this.fadeTo(0, 0.35);
    resolve('win');
  }
  async gameOver() {
    for (const m of this.state.party) {
      const s = statsAt(m.id, m.level);
      m.hp = s.hp;
      m.mp = s.mp;
    }
    await this.say('narr', 'The tide takes you... and, a little ashamed, gives you back.');
    this.loadScene(this.state.scene);
    await this.fadeTo(0, 0.5);
    await this.scene.enter?.(this);
  }

  // ------------------------------------------------------------------ inventory / party helpers
  hasItem(id) {
    return (this.state.inv[id] || 0) > 0;
  }
  give(id, n = 1) {
    this.state.inv[id] = (this.state.inv[id] || 0) + n;
    this.toast(`Got ${ITEMS[id].name}${n > 1 ? ' ×' + n : ''}`);
    this.sfx('item');
  }
  hasClue(id) {
    return this.state.clues.includes(id);
  }
  addClue(id) {
    if (this.hasClue(id)) return;
    this.state.clues.push(id);
    this.toast(`Pinned to the board: ${CLUES[id].title}`);
    this.sfx('solve');
    this.save();
  }
  inParty(id) {
    return this.state.party.some((m) => m.id === id);
  }
  joinParty(id) {
    if (this.inParty(id)) return;
    const level = Math.max(...this.state.party.map((m) => m.level));
    const start = id === 'ochre' ? ['mend', null] : [null, null];
    const m = newMember(id, level, start);
    this.state.party.push(m);
    if (id === 'ochre' && !this.state.glazes.includes('mend')) this.state.glazes.push('mend');
    this.toast(`${CHARACTERS[id].name} joined the party!`);
    this.sfx('win');
  }
  giveGlaze(id, to) {
    if (!this.state.glazes.includes(id)) this.state.glazes.push(id);
    const m = this.state.party.find((p) => p.id === to);
    let note = '';
    if (m) {
      const slot = m.glazes.findIndex((x) => !x);
      if (slot >= 0) {
        m.glazes[slot] = id;
        note = ` (equipped to ${CHARACTERS[m.id].name})`;
      } else {
        note = ' (slots full: swap it in from Party)';
      }
    }
    this.toast(`Glaze found: ${GLAZES[id].name}${note}`);
    this.sfx('item');
  }
  partyHurt() {
    return this.state.party.some((m) => {
      const s = statsAt(m.id, m.level);
      return m.hp < s.hp || m.mp < s.mp;
    });
  }
  healParty() {
    for (const m of this.state.party) {
      const s = statsAt(m.id, m.level);
      m.hp = s.hp;
      m.mp = s.mp;
    }
    this.toast('Everyone is restored.');
    this.sfx('heal');
  }
  useItem(itemId, memberId) {
    const it = ITEMS[itemId];
    const m = this.state.party.find((p) => p.id === memberId);
    if (!it || !m || !(this.state.inv[itemId] > 0)) return;
    const s = statsAt(m.id, m.level);
    if (it.kind === 'heal') {
      if (m.hp >= s.hp) return this.toast(`${CHARACTERS[m.id].name} is already fine.`);
      m.hp = Math.min(s.hp, m.hp + it.amount);
      this.sfx('heal');
    } else if (it.kind === 'cleanse') {
      if (m.hp >= s.hp) return this.toast(`${CHARACTERS[m.id].name} is already fine.`);
      m.hp = Math.min(s.hp, m.hp + it.amount);
      this.sfx('heal');
    } else if (it.kind === 'throw') {
      return this.toast('Save it for a fight: it is made to be thrown.');
    } else if (it.kind === 'mp') {
      if (m.mp >= s.mp) return this.toast(`${CHARACTERS[m.id].name} is already full.`);
      m.mp = Math.min(s.mp, m.mp + it.amount);
      this.sfx('item');
    }
    this.state.inv[itemId] -= 1;
    this.dirty = true;
  }
  cycleGlaze(memberId, slot) {
    const m = this.state.party.find((p) => p.id === memberId);
    if (!m) return;
    const equipped = new Set();
    for (const p of this.state.party) for (const gl of p.glazes) if (gl) equipped.add(gl);
    const cur = m.glazes[slot];
    const list = [null, ...this.state.glazes.filter((id) => !equipped.has(id) || id === cur)];
    const idx = list.indexOf(cur);
    m.glazes[slot] = list[(idx + 1) % list.length];
    this.sfx('click');
    this.dirty = true;
  }

  // ------------------------------------------------------------------ menu & puzzle
  openMenu(tab = 'journal') {
    if (this.script || this.dialogue || this.mode !== 'explore') return;
    this.menu = { tab, sel: this.state.clues[this.state.clues.length - 1] || null };
    this.sfx('click');
    this.dirty = true;
  }
  closeMenu() {
    this.menu = null;
    this.dirty = true;
  }
  setTab(t) {
    if (this.menu) this.menu.tab = t;
  }
  selectClue(id) {
    const m = this.menu;
    if (!m) return;
    const prev = m.sel;
    m.sel = id;
    m.ded = null;
    // tapping a second note while one is open tries to connect the two
    if (prev && prev !== id && this.hasClue(prev) && this.hasClue(id)) {
      const d = this.connect(prev, id);
      if (d) m.ded = d.id;
      else if (dedFor(prev, id) && this.deduced(dedFor(prev, id).id)) m.ded = dedFor(prev, id).id; // already worked out: show it again
    }
  }
  selectDed(id) {
    if (this.menu) this.menu.ded = id;
  }
  deduced(id) {
    return (this.state.deduced || []).includes(id);
  }
  // Notes that could still be connected to this one (you hold both, and have not worked it out yet)
  pendingFor(clueId) {
    return Object.values(DEDUCTIONS).filter((d) => d.needs.includes(clueId) && d.needs.every((c) => this.hasClue(c)) && !this.deduced(d.id));
  }
  pendingCount() {
    return Object.values(DEDUCTIONS).filter((d) => d.needs.every((c) => this.hasClue(c)) && !this.deduced(d.id)).length;
  }
  connect(a, b) {
    const d = dedFor(a, b);
    if (!d || !this.hasClue(a) || !this.hasClue(b) || this.deduced(d.id)) return null;
    (this.state.deduced = this.state.deduced || []).push(d.id);
    this.setFlag('d_' + d.id);
    this.toast(`Connected: ${d.title}`, 4);
    this.sfx('solve');
    this.save();
    return d;
  }
  // how much a companion has come to trust Marl (small integers, raised by kindness in conversations)
  bond(who) {
    return (this.state.bond && this.state.bond[who]) || 0;
  }
  raiseBond(who, n = 1) {
    this.state.bond = this.state.bond || {};
    this.state.bond[who] = (this.state.bond[who] || 0) + n;
  }

  // Party banter: each line plays once, only if its speaker is in the party and its condition holds. Defined in banter.js.
  async banter(key) {
    const lines = BANTER[key];
    if (!lines) return;
    this.state.said = this.state.said || {};
    let n = 0;
    for (let i = 0; i < lines.length && n < 3; i++) {
      const l = lines[i];
      const id = `${key}#${i}`;
      if (this.state.said[id]) continue;
      if (l.who !== 'marl' && !this.inParty(l.who)) continue;
      if (l.needs && !l.needs(this)) continue;
      this.state.said[id] = true;
      n++;
      await this.say(l.who, l.text, l.mood);
    }
  }
  toggleSound() {
    if (!this.sound) return;
    this.sound.init();
    this.sound.resume();
    this.sound.setEnabled(!this.sound.enabled);
    this.dirty = true;
  }

  openLampPuzzle() {
    return new Promise((resolve) => {
      this.puzzle = { grid: this.state.lamps.slice(), solved: false, resolve };
      this.mode = 'puzzle';
      this.dirty = true;
    });
  }
  pressLampCell(i) {
    const p = this.puzzle;
    if (!p || p.solved) return;
    p.grid = pressLamp(p.grid, i);
    this.state.lamps = p.grid.slice();
    this.sfx('lamp');
    if (isLit(p.grid)) {
      p.solved = true;
      this.sfx('solve');
      this.wait(1.4).then(() => this.finishPuzzle(true));
    }
  }
  closePuzzle() {
    this.finishPuzzle(false);
  }
  finishPuzzle(ok) {
    const p = this.puzzle;
    if (!p) return;
    this.puzzle = null;
    this.mode = 'explore';
    p.resolve(ok);
  }

  showEnding(e) {
    return new Promise((resolve) => {
      this.ending = { ...e, t: 0, resolve };
      this.sound?.music('title');
    });
  }

  // ------------------------------------------------------------------ world model
  depthScale(y) {
    const sc = this.scene;
    const w = sc.walk;
    return lerp(sc.scale[0], sc.scale[1], clamp((y - w.y0) / (w.y1 - w.y0), 0, 1));
  }
  clampWalk(x, y) {
    const w = this.scene.walk;
    return [clamp(x, w.x0, w.x1), clamp(y, w.y0, w.y1)];
  }
  npcs() {
    return this.scene.npcs ? this.scene.npcs(this) : [];
  }
  hotspots() {
    const out = [];
    for (const n of this.npcs()) {
      const b = figureBounds(n.kind, n.x, n.y, this.depthScale(n.y));
      const side = this.state.px < n.x ? -58 : 58;
      out.push({ id: 'npc-' + n.id, name: n.name, rect: [b.x - 6, b.y - 6, b.w + 12, b.h + 12], stand: [clamp(n.x + side, 60, 900), clamp(n.y + 8, this.scene.walk.y0, this.scene.walk.y1)], use: n.use, npc: true, anchor: [n.x, b.y - 10] });
    }
    for (const h of this.scene.hotspots(this)) {
      if (h.visible && !h.visible(this)) continue;
      out.push({ ...h, name: typeof h.name === 'function' ? h.name(this) : h.name });
    }
    return out;
  }
  hotspotAt(x, y) {
    const list = this.hotspots();
    for (const h of list) {
      const [rx, ry, rw, rh] = h.rect;
      if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) return h;
    }
    return null;
  }
  followers() {
    const out = [];
    this.state.party.slice(1).forEach((m, i) => {
      const idx = Math.max(0, this.trail.length - 1 - 11 * (i + 1));
      const p = this.trail[idx] || this.trail[0];
      const prev = this.trail[Math.max(0, idx - 3)] || p;
      const next = this.trail[Math.min(this.trail.length - 1, idx + 3)] || p;
      const face = next.x === prev.x ? this.state.facing : next.x > prev.x ? 1 : -1;
      out.push({ kind: m.id, x: p.x, y: p.y, face });
    });
    return out;
  }

  walkTo(x, y, then) {
    const [cx, cy] = this.clampWalk(x, y);
    this.walk = { x: cx, y: cy, then };
    this.sound?.play('click');
  }
  interact(h) {
    const [sx, sy] = h.stand;
    const go = () => {
      this.state.seen[h.id] = true;
      const where = this.state.scene;
      this.run(async () => {
        await h.use(this);
        // friends have opinions about whatever you just did (only if you stayed in the same room)
        if (this.state.scene === where && this.mode === 'explore') await this.banter(`${where}/${h.id}`);
      });
    };
    if (Math.hypot(sx - this.state.px, sy - this.state.py) < 14) {
      this.walk = null;
      go();
    } else {
      this.walkTo(sx, sy, go);
    }
  }

  // ------------------------------------------------------------------ input
  pointerMove(x, y) {
    this.pointer = { x, y };
    this.updateHover();
  }
  updateHover() {
    this.hoverName = '';
    this.hoverHot = false;
    this.hoverAt = null;
    if (this.mode !== 'explore' || this.dialogue || this.choice || this.menu || this.script || this.ending) return;
    if (this.view.portrait && this.pointer.y < this.view.top) return;
    const [wx, wy] = this.toWorld(this.pointer.x, this.pointer.y);
    const h = this.hotspotAt(wx, wy);
    this.hoverAt = h ? [h.rect[0] + h.rect[2] / 2, h.rect[1] + h.rect[3] / 2] : null;
    if (h) {
      this.hoverName = h.name;
      this.hoverHot = true;
    }
  }
  pointerDown(x, y) {
    this.pointer = { x, y };
    this.sound?.init();
    this.sound?.resume();
    this.dirty = true;
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        this.sound?.play('click');
        b.onClick();
        return;
      }
    }
    if (this.mode === 'title' || this.mode === 'puzzle' || this.menu || this.ending || this.choice) return;
    if (this.mode === 'battle') {
      this.bv?.tapWorld(x, y);
      return;
    }
    if (this.dialogue) {
      this.advance();
      return;
    }
    if (this.script) return;
    if (this.view.portrait && y < this.view.top) return; // the HUD bar is not part of the world
    const [wx, wy] = this.toWorld(x, y);
    const h = this.hotspotAt(wx, wy);
    if (h) this.interact(h);
    else this.walkTo(wx, wy);
  }
  key(k) {
    this.sound?.init();
    this.sound?.resume();
    this.dirty = true;
    const confirm = k === 'Enter' || k === ' ' || k === 'z';
    if (this.mode === 'title') {
      if (confirm) (this.hasSave() ? this.continueGame() : this.newGame());
      return;
    }
    if (this.mode === 'battle') {
      this.bv?.key(k);
      return;
    }
    if (this.ending) {
      if (confirm && this.ending.t > 3) this.toTitle();
      return;
    }
    if (this.mode === 'puzzle') {
      if (k === 'Escape' && !this.puzzle?.solved) this.closePuzzle();
      return;
    }
    if (this.menu) {
      if (k === 'Escape' || k === 'j' || k === 'm') this.closeMenu();
      return;
    }
    if (this.choice) {
      const n = this.choice.options.length;
      if (k === '1' || k === '2' || k === '3' || k === '4') {
        const i = Number(k) - 1;
        if (i < n) this.pick(i);
      }
      return;
    }
    if (this.dialogue) {
      if (confirm) this.advance();
      return;
    }
    if (this.script) return;
    if (k === 'j' || k === 'm') {
      this.openMenu('journal');
      return;
    }
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] };
    if (dirs[k]) {
      const [dx, dy] = dirs[k];
      this.walkTo(this.state.px + dx * 90, this.state.py + dy * 60);
      return;
    }
    if (confirm || k === 'e') {
      let best = null;
      let bd = 200;
      for (const h of this.hotspots()) {
        const d = Math.hypot(h.stand[0] - this.state.px, h.stand[1] - this.state.py);
        if (d < bd) {
          bd = d;
          best = h;
        }
      }
      if (best) this.interact(best);
    }
  }

  // ------------------------------------------------------------------ update
  update(dt) {
    dt = Math.min(dt, 0.1);
    this.time += dt;
    const f = this.fade;
    if (f.a !== f.to) {
      const d = f.speed * dt;
      f.a = f.a < f.to ? Math.min(f.to, f.a + d) : Math.max(f.to, f.a - d);
      if (f.a === f.to && f.resolve) {
        const r = f.resolve;
        f.resolve = null;
        r();
      }
    }
    for (const w of this.waits) w.t -= dt;
    if (this.waits.some((w) => w.t <= 0)) {
      const due = this.waits.filter((w) => w.t <= 0);
      this.waits = this.waits.filter((w) => w.t > 0);
      due.forEach((w) => w.resolve());
    }
    for (const tw of this.tweens) {
      tw.t += dt;
      this.state[tw.key] = lerp(tw.from, tw.to, Math.min(1, tw.t / tw.dur));
    }
    this.tweens = this.tweens.filter((t) => t.t < t.dur);
    for (const t of this.toasts) t.ttl -= dt;
    this.toasts = this.toasts.filter((t) => t.ttl > 0);
    if (this.ending) this.ending.t += dt;

    if (this.mode === 'battle') {
      this.bv?.update(dt);
      return;
    }
    const d = this.dialogue;
    if (d && !d.done) {
      const before = Math.floor(d.acc / 3);
      d.acc += dt * 58;
      d.shown = Math.floor(d.acc);
      if (Math.floor(d.acc / 3) !== before && d.who !== 'narr') this.sound?.play('blip');
      if (d.shown >= d.text.length + 8) d.done = true;
    }
    if (this.mode === 'explore') this.updateWalk(dt);
    this.updateCamera(dt);
    this.updateHover();
  }

  updateWalk(dt) {
    const w = this.walk;
    const s = this.state;
    if (!w) {
      this.moving = false;
      return;
    }
    const dx = w.x - s.px;
    const dy = w.y - s.py;
    const dist = Math.hypot(dx, dy);
    const step = SPEED * this.depthScale(s.py) * dt;
    if (Math.abs(dx) > 2) s.facing = dx > 0 ? 1 : -1;
    if (dist <= step) {
      s.px = w.x;
      s.py = w.y;
      this.walk = null;
      this.moving = false;
      this.trail.push({ x: s.px, y: s.py });
      w.then?.();
      return;
    }
    s.px += (dx / dist) * step;
    s.py += (dy / dist) * step;
    this.moving = true;
    this.walkT += dt;
    this.stepAcc += dt;
    if (this.stepAcc > 0.33) {
      this.stepAcc = 0;
      this.sound?.play('step');
    }
    const last = this.trail[this.trail.length - 1];
    if (Math.hypot(s.px - last.x, s.py - last.y) > 5) this.trail.push({ x: s.px, y: s.py });
    if (this.trail.length > 400) this.trail.splice(0, 100);
    // wandering monsters
    const dg = this.scene.danger ? this.scene.danger(this) : null;
    if (dg && !this.script) {
      this.danger.dist += step;
      if (this.danger.dist > 280) {
        this.danger.dist = 0;
        this.danger.cd -= 1;
        if (this.danger.cd <= 0 && this.rng() < dg.rate) {
          const enc = dg.enc[Math.floor(this.rng() * dg.enc.length)];
          this.danger.cd = 3;
          const pending = this.walk; // pick the walk back up after the fight
          this.run(async () => {
            this.sfx('squelch');
            this.toast('Something stirs in the shadows...');
            await this.wait(0.7);
            const r = await this.battle(enc);
            if (r === 'win' && pending) this.walk = pending;
          });
        }
      }
    }
  }

  // ------------------------------------------------------------------ render
  render(ctx, fr) {
    const v = this.view;
    this.buttons = [];
    ctx.clearRect(0, 0, v.w, v.h);
    setParallax(0); // only the explore view pans; the title and battle sets are static
    if (this.mode === 'title') {
      this.paintCover(ctx, () => paintTitle(ctx, fr), 520);
      filmFinish(ctx, v.w, v.h, fr, GRADES.title);
      drawTitleUI(ctx, this, fr);
    } else if (this.mode === 'battle' && this.bv) {
      this.bv.render(ctx, fr);
    } else {
      this.renderWorld(ctx, fr);
    }
    drawToasts(ctx, this, fr);
    if (this.fade.a > 0.001) {
      ctx.fillStyle = `rgba(10,5,26,${this.fade.a})`;
      ctx.fillRect(0, 0, v.w, v.h);
    }
    this.dirty = false;
  }

  // Paint a 960x540 diorama so it covers the whole logical canvas (title and battle backdrops), centred on `focus`.
  paintCover(ctx, fn, focus = 480, y0 = 0, y1 = this.view.h) {
    const v = this.view;
    const z = Math.max(v.w / WORLD_W, (y1 - y0) / WORLD_H);
    const visW = v.w / z;
    const camX = clamp(focus - visW / 2, 0, WORLD_W - visW);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, v.w, y1 - y0);
    ctx.clip();
    ctx.translate(0, y0);
    ctx.scale(z, z);
    ctx.translate(-camX, 0);
    fn();
    ctx.restore();
  }

  renderWorld(ctx, fr) {
    const sc = this.scene;
    const s = this.state;
    const v = this.view;
    if (v.portrait) {
      ctx.fillStyle = '#120a24';
      ctx.fillRect(0, 0, v.w, v.h);
    }
    setParallax(this.para);

    // who is on stage, who is talking, and where everyone is looking
    const step = Math.floor(this.walkT * 6);
    const dlg = this.dialogue;
    const speaker = dlg ? dlg.who : null;
    const typing = !!dlg && !dlg.done;
    const sprites = [];
    sprites.push({ kind: s.party[0].id, x: s.px, y: s.py, face: s.facing, moving: this.moving, lead: true });
    this.followers().forEach((f) => sprites.push({ ...f, moving: this.moving }));
    for (const n of this.npcs()) sprites.push({ kind: n.kind, x: n.x, y: n.y, face: s.px < n.x ? -1 : 1, moving: false, npc: true });
    const spk = sprites.find((p) => p.kind === speaker) || null;
    const REACT = { angry: 'worried', sad: 'sad', awe: 'awe', sly: 'curious', cheer: 'cheer', worried: 'worried' };
    for (const sp of sprites) {
      const sc2 = this.depthScale(sp.y);
      sp.scale = sc2;
      sp.talk = typing && sp === spk;
      // a speaker shows their line's mood; everyone else reacts a little to it
      sp.mood = sp === spk ? dlg.mood || 'idle' : dlg && spk && dlg.mood ? REACT[dlg.mood] || 'idle' : 'idle';
      let at = null;
      if (spk && sp !== spk) at = [spk.x, spk.y];
      else if (spk === sp) {
        const other = sp.lead ? sprites.find((p) => p.npc) : sprites[0];
        if (other) at = [other.x, other.y];
      } else if (sp.lead) at = this.hoverAt || (this.walk ? [this.walk.x, this.walk.y] : null);
      else at = [sprites[0].x, sprites[0].y];
      sp.look = gaze(sp, at);
    }
    sprites.sort((a, b) => a.y - b.y);
    // set dressing that stands in the room: people go behind it and in front of it by where their feet are
    const lead = sprites.find((p) => p.lead);
    const dressing = (sc.props ? sc.props(this) : []).map((p) => {
      const scl = this.depthScale(p.y) * (p.s ?? 1);
      // if the lead is hidden right behind it, the prop turns see-through so you never lose Marl
      const peek = !!lead && lead.y < p.y && p.y - lead.y < 70 && Math.abs(lead.x - p.x) < (PROP_W[p.prop] || 40) * scl + 14;
      return { ...p, scale: scl, peek };
    });
    const drawList = dressing.length ? sprites.concat(dressing).sort((a, b) => a.y - b.y) : sprites;
    const focus = spk || sprites.find((p) => p.lead);
    if (dlg && focus) {
      this.dollyAt = [focus.x, focus.y - 96 * focus.scale];
      // how far to tilt the set so the speaker's feet land just above the dialogue box
      const fy = this.dollyAt[1];
      const feet = fy + (focus.y - fy) * 1.085;
      this.liftFull = clamp(feet - ((this.boxTop - 16 - v.top) / v.z), 0, 170);
    }
    // paint extra floor under the set wherever the camera has tilted up past its bottom edge
    setStageExtend(v.ext + Math.ceil(this.lift) + 4);

    this.inWorld(ctx, () => {
      // lean in on the speaker: lift the set, then scale it about their head
      if (this.zoomK > 0.001 || this.lift > 0.5) {
        const k = 1 + this.zoomK;
        const [fx, fy] = this.dollyAt;
        ctx.translate(0, -this.lift);
        ctx.translate(fx, fy);
        ctx.scale(k, k);
        ctx.translate(-fx, -fy);
      }
      sc.paint(ctx, this, fr);
      setKeyLights(lightsNow()); // shadows now fall away from this room's nearest lamp
      if (sc.wet) {
        // a wet floor holds a faint upside-down copy of whoever stands on it
        for (const sp of sprites) {
          ctx.save();
          ctx.translate(0, sp.y * 2 + 3);
          ctx.scale(1, -1);
          drawFigure(ctx, sp.kind, sp.x, sp.y, { frame: fr, facing: sp.face, moving: sp.moving, step, scale: sp.scale, mood: 'idle', alpha: 0.15, noShadow: true });
          ctx.restore();
        }
      }
      for (const sp of drawList) {
        if (sp.prop) {
          ctx.save();
          ctx.translate(sp.x, sp.y);
          ctx.scale(sp.scale, sp.scale);
          if (sp.peek) ctx.globalAlpha = 0.5;
          PROPS[sp.prop](ctx, fr);
          ctx.restore();
          continue;
        }
        drawFigure(ctx, sp.kind, sp.x, sp.y, { frame: fr, facing: sp.face, moving: sp.moving, step, scale: sp.scale, talk: sp.talk, mood: sp.mood, look: sp.look });
      }
      paintAtmos(ctx, sc.id, fr);
      paintFore(ctx, sc.id, fr);
    });
    filmFinish(ctx, v.w, v.h, fr, { vignette: (sc.id === 'kiln' ? 0.62 : 0.5) + 0.14 * this.dolly, ...GRADES[sc.id] });

    // "look here" sparkles
    const live = this.mode === 'explore' && !this.script && !this.dialogue && !this.menu && !this.ending && this.fade.a < 0.4 && this.dolly < 0.06;
    if (live) {
      this.inWorld(ctx, () => {
        this.hotspots().forEach((h, i) => {
          if (s.seen[h.id] || h.id === 'back' || h.id === 'stairs') return;
          if (h.id.startsWith('tile-') && !s.seen['mural']) return;
          const [rx, ry, rw, rh] = h.rect;
          const sx = h.anchor ? h.anchor[0] : rx + rw / 2;
          const sy = h.anchor ? h.anchor[1] : ry + Math.min(rh / 2, 40);
          sparkle(ctx, sx, sy, fr, i + 1);
        });
      });
      drawEdgeHints(ctx, this, fr);
    }

    drawHover(ctx, this, fr);
    drawHud(ctx, this, fr);
    drawDialogue(ctx, this, fr);
    drawChoice(ctx, this, fr);
    if (this.mode === 'puzzle') drawLampPuzzle(ctx, this, fr);
    drawMenu(ctx, this, fr);
    drawEnding(ctx, this, fr);
  }

  // 60fps overlay: a little clay thumb that follows the pointer
  drawCursor(ctx) {
    if (this.touch || this.pointer.x < 0) return;
    const { x, y } = this.pointer;
    ctx.save();
    ctx.translate(x, y);
    const hot = this.hoverHot;
    ctx.fillStyle = hot ? 'rgba(255,226,140,0.95)' : 'rgba(240,215,170,0.9)';
    ctx.strokeStyle = 'rgba(40,20,60,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, hot ? 10 : 7, hot ? 11 : 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(60,30,40,0.5)';
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, i * 2.2, i * 2.6, 0, 0.4, 0.4 + Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- debug / test hooks (used by tools/game_shots.py)
  debugJump(sceneId, flags = {}, extra = {}) {
    Object.assign(this.state.flags, flags);
    Object.assign(this.state, extra);
    this.mode = 'explore';
    this.dialogue = null;
    this.choice = null;
    this.menu = null;
    this.script = false;
    this.toasts = [];
    this.loadScene(sceneId);
    this.fade = { a: 0, to: 0, speed: 1, resolve: null };
    this.dirty = true;
  }
}
