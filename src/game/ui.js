// All the 2D interface. Panels, buttons and bars are clay too, so the UI boils with the rest of
// the world. Buttons register themselves on `g.buttons` while drawing; the Game routes taps to them.

import { blob, slab, limb, glow, drawClay, clayText, shade, mix, rgba, FONT, FONT_DECO } from '../engine/clay.js';
import { decoFrame, decoFan, decoRule, neonText, marigold, sugarSkull } from '../engine/noir.js';
import { drawPortrait, FIGURES } from '../engine/actors.js';
import { strSeed, TAU } from '../engine/rng.js';
import { CHARACTERS, CLUES, DEDUCTIONS, GLAZES, GLAZE_LEVELS, ITEMS, glazeLevel, statsAt, xpToNext } from './data.js';

export const UI = {
  ink: '#fdf4dc',
  dim: '#bdb2da',
  panel: '#34306b',
  panel2: '#4a4690',
  gold: '#ffd27a',
  red: '#e8745c',
  green: '#7fcf6a',
  blue: '#6ab4e8',
};

// Menu tabs. `almanac` and `settings` are drawn by menus.js (passed in by the Game, so this file never imports it back).
export const MENU_TABS = ['journal', 'party', 'items', 'almanac', 'settings'];
const TAB_LABELS = { journal: 'Journal', party: 'Party', items: 'Items', almanac: 'Almanac', settings: 'Settings' };

export const SPEAKER_COLORS = {
  marl: '#e8c24a', ochre: '#d0652e', slip: '#8dd3c0', brine: '#8e9aa6', calaca: '#e8dcc0', warden: '#c9503f', kilnwright: '#c98a4e',
};

// ------------------------------------------------------------------ primitives
export function text(ctx, s, x, y, size, color = UI.ink, o = {}) {
  ctx.save();
  ctx.font = o.deco ? `${size}px ${FONT_DECO}` : `${o.weight || '600'} ${o.italic ? 'italic ' : ''}${size}px ${FONT}`;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(12,6,30,0.75)';
  ctx.fillText(s, x + 1.2, y + 1.5);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  ctx.restore();
}

export function wrap(ctx, s, maxW, size, weight = '600', italic = false) {
  ctx.save();
  ctx.font = `${weight} ${italic ? 'italic ' : ''}${size}px ${FONT}`;
  const out = [];
  for (const para of String(s).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    out.push(line);
  }
  ctx.restore();
  return out;
}

export function panel(ctx, x, y, w, h, fr, o = {}) {
  const seed = o.seed || strSeed(`p${x},${y}`);
  slab(ctx, x, y, w, h, { color: o.color || UI.panel, seed, frame: fr, wobble: 0.012, outline: 1.6, tex: 0.45, occlusion: 0.32, gloss: 0.3, alpha: o.alpha });
  // art-deco gilt inlay on the big panels
  if (o.deco !== false && w >= 200 && h >= 76) decoFrame(ctx, x, y, w, h, fr, { seed, alpha: o.alpha != null ? o.alpha * 0.7 : 0.62 });
}

export function inside(g, x, y, w, h) {
  return g.pointer.x >= x && g.pointer.x <= x + w && g.pointer.y >= y && g.pointer.y <= y + h;
}

export function button(ctx, g, fr, id, label, x, y, w, h, onClick, o = {}) {
  const dis = !!o.disabled;
  const hov = !dis && inside(g, x, y, w, h);
  if (!dis) g.buttons.push({ id, x, y, w, h, onClick });
  const base = dis ? '#37334d' : hov ? o.hover || '#6a62c4' : o.color || UI.panel2;
  slab(ctx, x, y - (hov ? 1.5 : 0), w, h, { color: base, seed: strSeed(id), frame: fr, wobble: 0.015, outline: 1.4, tex: 0.5, gloss: dis ? 0.1 : 0.45 });
  if (label) text(ctx, label, x + w / 2, y + h / 2 + (o.size || 18) * 0.34, o.size || 18, dis ? '#8a84a8' : o.ink || UI.ink, { align: 'center' });
  return hov;
}

export function bar(ctx, x, y, w, h, frac, color, fr, o = {}) {
  slab(ctx, x, y, w, h, { color: '#1c1838', seed: strSeed(`b${x},${y}`), frame: fr, wobble: 0.02, outline: 1, tex: 0.2, noRim: true, gloss: 0 });
  const f = Math.max(0, Math.min(1, frac));
  if (f > 0.01) slab(ctx, x + 1.5, y + 1.5, Math.max(4, (w - 3) * f), h - 3, { color, seed: strSeed(`f${x},${y}`), frame: fr, wobble: 0.02, outline: 0.7, tex: 0.3, gloss: 0.6, alpha: o.alpha });
}

function iconBook(ctx, cx, cy, fr) {
  blob(ctx, cx, cy + 1, 13, 11, { color: '#b9744a', seed: 7771, frame: fr, outline: 1 });
  slab(ctx, cx - 10, cy - 8, 9, 16, { color: '#f1e4c0', seed: 7772, frame: fr, outline: 0.8, noRim: true });
  slab(ctx, cx + 1, cy - 8, 9, 16, { color: '#f1e4c0', seed: 7773, frame: fr, outline: 0.8, noRim: true });
}
function iconSpeaker(ctx, cx, cy, fr, on) {
  blob(ctx, cx - 6, cy, 6, 7, { color: '#e8c24a', seed: 7774, frame: fr, outline: 1 });
  blob(ctx, cx + 1, cy, 8, 11, { color: '#e8c24a', seed: 7775, frame: fr, outline: 1, rot: 0 });
  ctx.save();
  ctx.strokeStyle = on ? '#fdf4dc' : '#e8745c';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (on) {
    ctx.arc(cx + 5, cy, 8, -0.9, 0.9);
    ctx.arc(cx + 5, cy, 13, -0.8, 0.8);
  } else {
    ctx.moveTo(cx + 9, cy - 7);
    ctx.lineTo(cx + 19, cy + 7);
    ctx.moveTo(cx + 19, cy - 7);
    ctx.lineTo(cx + 9, cy + 7);
  }
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ HUD
export function drawHud(ctx, g, fr) {
  if (g.mode !== 'explore' && g.mode !== 'puzzle') return;
  const v = g.view;
  const canJournal = g.mode === 'explore' && !g.dialogue && !g.choice && !g.script && !g.menu;
  const canSound = !g.dialogue && !g.menu;
  const n = g.state.clues.length;
  if (v.portrait) {
    // a clay marquee above the world: where you are, plus the two buttons
    const bh = v.top - 14;
    panel(ctx, 8, 8, v.w - 16, bh, fr, { color: '#241f50', seed: 4501 });
    text(ctx, g.scene.name, 28, 8 + bh / 2 + 9, 27, UI.gold, { deco: true });
    const by = 8 + (bh - 58) / 2;
    if (canSound) {
      button(ctx, g, fr, 'hud-sound', '', v.w - 74, by, 58, 58, () => g.toggleSound(), { color: '#3d3a80' });
      iconSpeaker(ctx, v.w - 74 + 21, by + 29, fr, g.sound?.enabled !== false);
    }
    if (canJournal) {
      button(ctx, g, fr, 'hud-journal', '', v.w - 74 - 70, by, 62, 58, () => g.openMenu('journal'), { color: '#3d3a80' });
      iconBook(ctx, v.w - 74 - 70 + 31, by + 29, fr);
      if (n) {
        blob(ctx, v.w - 74 - 70 + 54, by + 6, 10, 10, { color: '#e8745c', seed: 7780, frame: fr, outline: 1 });
        text(ctx, String(n), v.w - 74 - 70 + 54, by + 11, 13, UI.ink, { align: 'center', weight: '800' });
      }
    }
    return;
  }
  if (canJournal) {
    button(ctx, g, fr, 'hud-journal', '', 842, 14, 50, 46, () => g.openMenu('journal'), { color: '#3d3a80' });
    iconBook(ctx, 867, 37, fr);
    if (n) {
      blob(ctx, 888, 20, 9, 9, { color: '#e8745c', seed: 7780, frame: fr, outline: 1 });
      text(ctx, String(n), 888, 25, 12, UI.ink, { align: 'center', weight: '800' });
    }
  }
  if (canSound) {
    button(ctx, g, fr, 'hud-sound', '', 900, 14, 46, 46, () => g.toggleSound(), { color: '#3d3a80' });
    iconSpeaker(ctx, 920, 37, fr, g.sound?.enabled !== false);
  }
}

// Portrait: the world is wider than the screen. Chevrons at the edges say "there is more this way" (and tap to walk
// that way); they glow when something you have not looked at yet is out of sight in that direction.
export function drawEdgeHints(ctx, g, fr) {
  const v = g.view;
  if (!v.portrait) return;
  const visW = v.w / v.z;
  const maxCam = 960 - visW;
  const left = g.cam.x > 8;
  const right = g.cam.x < maxCam - 8;
  if (!left && !right) return;
  let glowL = false;
  let glowR = false;
  for (const h of g.hotspots()) {
    if (g.state.seen[h.id] || h.id === 'back' || h.id === 'stairs') continue;
    const cx = h.rect[0] + h.rect[2] / 2;
    if (cx < g.cam.x) glowL = true;
    else if (cx > g.cam.x + visW) glowR = true;
  }
  const y = v.top + v.bandH * 0.4;
  const pulse = 0.5 + 0.5 * Math.sin(fr * 0.7);
  const chev = (dir, lit, id) => {
    const x = dir < 0 ? 30 : v.w - 30;
    if (lit) glow(ctx, x, y, 46 + pulse * 10, '#fff3b0', 0.4 + pulse * 0.2);
    g.buttons.push({ id, x: x - 30, y: y - 48, w: 60, h: 96, onClick: () => g.walkTo(g.state.px + dir * 260, g.state.py) });
    drawClay(ctx, [[x + dir * 8, y - 26], [x - dir * 12, y], [x + dir * 8, y + 26], [x + dir * 12, y + 14], [x - dir * 2, y], [x + dir * 12, y - 14]], { color: lit ? '#ffe9a0' : '#cbbfe8', seed: 4600 + dir, frame: fr, outline: 1.4, gloss: 0.8, alpha: lit ? 0.95 : 0.55 + pulse * 0.15 });
  };
  if (left) chev(-1, glowL, 'edge-left');
  if (right) chev(1, glowR, 'edge-right');
}

export function drawHover(ctx, g, fr) {
  if (!g.hoverName || g.dialogue || g.choice || g.menu || g.script || g.mode !== 'explore') return;
  ctx.save();
  ctx.font = `700 17px ${FONT}`;
  const w = ctx.measureText(g.hoverName).width + 28;
  ctx.restore();
  const x = Math.max(8, Math.min(g.view.w - w - 8, g.pointer.x - w / 2));
  const y = Math.max(8, g.pointer.y - 52);
  panel(ctx, x, y, w, 32, fr, { color: '#2b2760', seed: 4242 });
  text(ctx, g.hoverName, x + w / 2, y + 22, 17, UI.gold, { align: 'center', weight: '700' });
}

export function drawToasts(ctx, g, fr) {
  const v = g.view;
  let y = v.portrait ? v.top + 14 : 76;
  for (const t of g.toasts) {
    const size = v.portrait ? 18 : 17;
    const lines = wrap(ctx, t.text, Math.min(760, v.w - 72), size, '600');
    ctx.save();
    ctx.font = `600 ${size}px ${FONT}`;
    const w = Math.min(v.w - 24, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 36);
    ctx.restore();
    const h = 14 + lines.length * (size + 7);
    const a = Math.min(1, t.ttl * 2, (t.max - t.ttl) * 4);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    panel(ctx, v.w / 2 - w / 2, y, w, h, fr, { color: '#2b2760', seed: strSeed(t.text) });
    lines.forEach((ln, i) => text(ctx, ln, v.w / 2, y + 8 + size + i * (size + 7) - 2, size, UI.ink, { align: 'center' }));
    ctx.restore();
    y += h + 6;
  }
}

// ------------------------------------------------------------------ dialogue
function speakerName(who) {
  return FIGURES[who]?.name || (who === 'warden' ? 'The Warden' : who === 'kilnwright' ? 'Kilnwright' : who);
}

export function drawDialogue(ctx, g, fr) {
  const d = g.dialogue;
  if (!d) return;
  const narr = d.who === 'narr';
  const col = SPEAKER_COLORS[d.who] || '#cbbfe8';
  if (g.view.portrait) return drawDialoguePortrait(ctx, g, fr, d, narr, col);
  const x = 36;
  const y = 392;
  const w = 888;
  const h = 130;
  g.boxTop = y; // the camera lifts the speaker clear of the box
  panel(ctx, x, y, w, h, fr, { color: '#2a2660', seed: 111 });
  const tx = narr ? x + 34 : x + 150;
  const tw = narr ? w - 70 : w - 190;
  if (!narr) {
    const cx = x + 76;
    const cy = y + h / 2 + 4;
    blob(ctx, cx, cy, 55, 55, { color: shade(col, -0.25), seed: 112, frame: fr, outline: 1.8 });
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, TAU);
    ctx.clip();
    blob(ctx, cx, cy, 52, 52, { color: mix(col, '#2a2660', 0.6), seed: 113, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    drawPortrait(ctx, d.who, cx, cy + 8, 44, { frame: fr, talk: !d.done, mood: d.mood });
    ctx.restore();
    const name = speakerName(d.who);
    ctx.save();
    ctx.font = `19px ${FONT_DECO}`;
    const nw = ctx.measureText(name).width + 38;
    ctx.restore();
    slab(ctx, x + 126, y - 17, nw, 34, { color: col, seed: 114, frame: fr, outline: 1.4, gloss: 0.5 });
    text(ctx, name, x + 126 + nw / 2, y + 6, 19, '#1b1038', { align: 'center', deco: true });
  }
  const size = 21;
  const lines = wrap(ctx, d.text, tw, size, '600', narr);
  let left = d.shown;
  let ly = y + 44;
  for (const ln of lines) {
    if (left <= 0) break;
    const part = ln.slice(0, left);
    text(ctx, part, tx, ly, size, narr ? '#d9d0f2' : UI.ink, { italic: narr });
    left -= ln.length + 1;
    ly += 30;
  }
  if (d.done) {
    const bob = Math.sin(fr * 0.9) * 3;
    blob(ctx, x + w - 34, y + h - 24 + bob, 10, 9, { color: UI.gold, seed: 115, frame: fr, outline: 1, rot: 0.2 });
  }
}

// Portrait: a full-width box at the bottom. The box is sized from the *whole* line, so it never grows while typing.
function drawDialoguePortrait(ctx, g, fr, d, narr, col) {
  const v = g.view;
  const x = 14;
  const w = v.w - 28;
  const size = 22;
  const lh = 31;
  const lines = wrap(ctx, d.text, w - 56, size, '600', narr);
  const head = narr ? 0 : 76;
  const h = 26 + head + lines.length * lh + 30;
  const y = v.h - h - 14;
  g.boxTop = y;
  panel(ctx, x, y, w, h, fr, { color: '#2a2660', seed: 111 });
  if (!narr) {
    const cx = x + 60;
    const cy = y + 14 + 38;
    blob(ctx, cx, cy, 40, 40, { color: shade(col, -0.25), seed: 112, frame: fr, outline: 1.8 });
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 35, 0, TAU);
    ctx.clip();
    blob(ctx, cx, cy, 38, 38, { color: mix(col, '#2a2660', 0.6), seed: 113, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    drawPortrait(ctx, d.who, cx, cy + 6, 32, { frame: fr, talk: !d.done, mood: d.mood });
    ctx.restore();
    const name = speakerName(d.who);
    ctx.save();
    ctx.font = `21px ${FONT_DECO}`;
    const nw = ctx.measureText(name).width + 40;
    ctx.restore();
    slab(ctx, x + 112, y + 26, nw, 38, { color: col, seed: 114, frame: fr, outline: 1.4, gloss: 0.5 });
    text(ctx, name, x + 112 + nw / 2, y + 26 + 26, 21, '#1b1038', { align: 'center', deco: true });
  }
  let left = d.shown;
  let ly = y + 26 + head + 22;
  for (const ln of lines) {
    if (left <= 0) break;
    text(ctx, ln.slice(0, left), x + 28, ly, size, narr ? '#d9d0f2' : UI.ink, { italic: narr });
    left -= ln.length + 1;
    ly += lh;
  }
  if (d.done) {
    const bob = Math.sin(fr * 0.9) * 3;
    blob(ctx, x + w - 34, y + h - 26 + bob, 11, 10, { color: UI.gold, seed: 115, frame: fr, outline: 1, rot: 0.2 });
  }
}

export function drawChoice(ctx, g, fr) {
  const c = g.choice;
  if (!c) return;
  const v = g.view;
  const bh = v.portrait ? 62 : 46;
  const pitch = bh + (v.portrait ? 12 : 10);
  const w = Math.min(460 + (v.portrait ? 40 : 0), v.w - 32);
  const h = 70 + c.options.length * pitch;
  const x = v.w / 2 - w / 2;
  const y = (v.portrait ? v.h * 0.42 : v.h / 2) - h / 2 - 20;
  panel(ctx, x, y, w, h, fr, { color: '#2a2660', seed: 222 });
  text(ctx, c.prompt, v.w / 2, y + 40, v.portrait ? 24 : 22, UI.gold, { align: 'center', weight: '700' });
  c.options.forEach((o, i) => button(ctx, g, fr, `choice-${i}`, `${g.touch ? '' : i + 1 + '  ·  '}${o}`, x + 28, y + 62 + i * pitch, w - 56, bh, () => g.pick(i), { size: v.portrait ? 21 : 19, color: !g.touch && i === c.sel ? '#7a6ad6' : undefined }));
}

// ------------------------------------------------------------------ menu overlay
export function drawMenu(ctx, g, fr, extra = {}) {
  const m = g.menu;
  if (!m) return;
  const v = g.view;
  ctx.fillStyle = 'rgba(10,5,26,0.62)';
  ctx.fillRect(0, 0, v.w, v.h);
  if (v.portrait) return drawMenuPortrait(ctx, g, fr, extra);
  panel(ctx, 34, 28, 892, 484, fr, { color: '#2a2660', seed: 333 });
  MENU_TABS.forEach((id, i) => button(ctx, g, fr, `tab-${id}`, TAB_LABELS[id], 60 + i * 140, 44, 132, 42, () => g.setTab(id), { color: m.tab === id ? '#7a6ad6' : '#3d3a80', size: 18 }));
  button(ctx, g, fr, 'menu-close', 'Close', 806, 44, 96, 42, () => g.closeMenu(), { color: '#8a3f4a', hover: '#b05060', size: 18 });

  if (m.tab === 'journal') drawJournal(ctx, g, fr);
  else if (m.tab === 'party') drawParty(ctx, g, fr);
  else if (m.tab === 'items') drawItems(ctx, g, fr);
  else extra[m.tab]?.(ctx, g, fr);
}

function boardPos(c) {
  return [80 + (c.x - 120) * 0.8, 130 + (c.y - 100)];
}

// shared by both orientations: strings, then notes, then deduction tags, on a board whose clue positions come from `pos(clue)`
function drawBoard(ctx, g, fr, pos, note) {
  const m = g.menu;
  const found = g.state.clues;
  const ids = Object.keys(CLUES);
  const pts = found.map((id) => pos(CLUES[id]));
  // loose red thread through the notes in the order you found them: decoration
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const mx = (ax + bx) / 2 + Math.sin(fr * 0.7 + i) * 2;
    const my = (ay + by) / 2 + 14;
    ctx.save();
    ctx.globalAlpha *= 0.5;
    limb(ctx, ax, ay - 30, mx, my - 30, 1.6, 1.6, { color: '#a8453a', seed: 350 + i, frame: fr, outline: 0.4, boil: 0.3 });
    limb(ctx, mx, my - 30, bx, by - 30, 1.6, 1.6, { color: '#a8453a', seed: 360 + i, frame: fr, outline: 0.4, boil: 0.3 });
    ctx.restore();
  }
  // gold yarn for every deduction you have actually worked out
  const done = Object.values(DEDUCTIONS).filter((d) => g.deduced(d.id));
  const mids = [];
  done.forEach((d, i) => {
    const [ax, ay] = pos(CLUES[d.needs[0]]);
    const [bx, by] = pos(CLUES[d.needs[1]]);
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2 + 10 + Math.sin(fr * 0.6 + i) * 1.5;
    limb(ctx, ax, ay - 28, mx, my - 28, 3, 3, { color: '#e8c24a', seed: 420 + i * 2, frame: fr, outline: 0.6, boil: 0.25 });
    limb(ctx, mx, my - 28, bx, by - 28, 3, 3, { color: '#e8c24a', seed: 421 + i * 2, frame: fr, outline: 0.6, boil: 0.25 });
    mids.push([d, mx, my - 28]);
  });
  if (found.length === ids.length && pts.length > 2) {
    const [ax, ay] = pts[pts.length - 1];
    const [bx, by] = pts[0];
    limb(ctx, ax, ay - 30, bx, by - 30, 2.2, 2.2, { color: '#e8c24a', seed: 370, frame: fr, outline: 0.5, boil: 0.3 });
  }
  ids.forEach((id, i) => {
    const c = CLUES[id];
    const [bx, by] = pos(c);
    const has = found.includes(id);
    const sel = m.sel === id;
    const w = note.w;
    const h = note.h;
    const x = bx - w / 2;
    const y = by - h / 2;
    if (!has) {
      slab(ctx, x, y, w, h, { color: '#8d6540', seed: 380 + i, frame: fr, outline: 1, alpha: 0.7, tex: 0.6, noRim: true });
      text(ctx, '?', bx, by + 11, 30, '#6a4a2c', { align: 'center', weight: '800' });
      return;
    }
    if (sel) glow(ctx, bx, by, 90, '#ffe9a0', 0.5);
    const pending = g.pendingFor(id).length > 0 && !sel;
    button(ctx, g, fr, `clue-${id}`, '', x, y, w, h, () => g.selectClue(id), { color: sel ? '#fff3cc' : '#f1e4c0', hover: '#fff3cc' });
    const lines = wrap(ctx, c.title, w - 16, note.size, '700').slice(0, 3);
    lines.forEach((ln, k) => text(ctx, ln, bx, by - (lines.length - 1) * (note.size * 0.57) + 5 + k * (note.size + 3), note.size, '#3a2a1c', { align: 'center', weight: '700' }));
    blob(ctx, bx, y + 2, 7, 7, { color: '#c9503f', seed: 390 + i, frame: fr, outline: 1, gloss: 0.9 });
    // a loose end of thread: this note has something it could be tied to
    if (pending) {
      const wag = Math.sin(fr * 0.5 + i) * 2;
      limb(ctx, x + w - 6, y + h - 6, x + w + 6 + wag, y + h + 8, 1.6, 1.2, { color: '#e8c24a', seed: 440 + i, frame: fr, outline: 0.3, boil: 0.3 });
    }
  });
  // the tag where a deduction's yarn crosses: tap it to read what the two notes mean together
  const tk = note.size >= 16 ? 30 : 26;
  for (const [d, mx, my] of mids) {
    const sel = m.ded === d.id;
    if (sel) glow(ctx, mx, my, 44, '#ffe9a0', 0.55);
    button(ctx, g, fr, `ded-${d.id}`, '', mx - tk / 2, my - tk / 2, tk, tk, () => g.selectDed(d.id), { color: sel ? '#ffe9a0' : '#e8c24a', hover: '#fff0b8' });
    text(ctx, '!', mx, my + tk * 0.32, tk * 0.8, '#4a2a10', { align: 'center', weight: '800' });
  }
}

// What the reading panel shows: a deduction if one is open, otherwise the selected note.
function readingFor(g) {
  const m = g.menu;
  if (m.ded && g.deduced(m.ded)) {
    const d = DEDUCTIONS[m.ded];
    return { kind: 'ded', title: d.title, text: d.text, from: d.needs.map((c) => CLUES[c].title) };
  }
  const c = m.sel && g.hasClue(m.sel) ? CLUES[m.sel] : null;
  if (!c) return null;
  const made = Object.values(DEDUCTIONS).filter((d) => d.needs.includes(c.id) && g.deduced(d.id));
  return { kind: 'clue', title: c.title, text: c.text, hint: g.pendingFor(c.id).length > 0, made: made.map((d) => d.title) };
}

function journalFooter(g) {
  const found = g.state.clues.length;
  const total = Object.keys(CLUES).length;
  const nd = (g.state.deduced || []).length;
  return `${found} / ${total} pinned  ·  ${nd} / ${Object.keys(DEDUCTIONS).length} connected`;
}

function drawJournal(ctx, g, fr) {
  slab(ctx, 56, 104, 520, 384, { color: '#a8794a', seed: 340, frame: fr, wobble: 0.01, outline: 2, tex: 0.9, occlusion: 0.25 });
  const found = g.state.clues;
  drawBoard(ctx, g, fr, boardPos, { w: 118, h: 64, size: 14 });
  // reading panel
  panel(ctx, 596, 104, 310, 384, fr, { color: '#241f50', seed: 345 });
  const r = readingFor(g);
  if (r) {
    let y = 140;
    if (r.kind === 'ded') {
      text(ctx, 'WORKED OUT', 616, y - 12, 11, '#7fd3d0', { weight: '800' });
      y += 8;
    }
    const tl = wrap(ctx, r.title, 270, 21, '800');
    tl.forEach((ln, i) => text(ctx, ln, 616, y + i * 26, 21, r.kind === 'ded' ? '#ffe9a0' : UI.gold, { weight: '800' }));
    y += tl.length * 26 + 10;
    const body = wrap(ctx, r.text, 270, r.text.length > 330 ? 14 : 16, '500');
    const lh = r.text.length > 330 ? 20 : 23;
    body.forEach((ln, i) => text(ctx, ln, 616, y + i * lh, r.text.length > 330 ? 14 : 16, UI.ink, { weight: '500' }));
    y += body.length * lh + 8;
    if (r.kind === 'ded') r.from.forEach((t, i) => text(ctx, `· ${t}`, 616, Math.min(y + 8 + i * 18, 462), 13, UI.dim, { weight: '600' }));
    else if (r.made?.length) r.made.slice(0, 2).forEach((t, i) => text(ctx, `Tied to: ${t}`, 616, 420 + i * 17, 13, '#e8c24a', { weight: '700' }));
    if (r.kind === 'clue' && r.hint) text(ctx, 'This note belongs next to another.', 751, 456, 13, '#7fd3d0', { align: 'center', weight: '600', italic: true });
  } else {
    text(ctx, found.length ? 'Tap a note to read it.' : 'Nothing pinned yet.', 751, 290, 18, UI.dim, { align: 'center' });
    text(ctx, found.length ? 'Tap one, then another, to tie them together.' : 'Look closely at things.', 751, 316, 14, UI.dim, { align: 'center', weight: '500' });
    if (g.pendingCount() > 0) text(ctx, 'Some of these belong together.', 751, 342, 14, '#7fd3d0', { align: 'center', weight: '600', italic: true });
  }
  text(ctx, journalFooter(g), 751, 478, 14, UI.dim, { align: 'center' });
}

function drawParty(ctx, g, fr) {
  const party = g.state.party;
  const owned = g.state.glazes;
  party.forEach((mbr, i) => {
    const c = CHARACTERS[mbr.id];
    const y = 108 + i * 126;
    panel(ctx, 52, y, 856, 116, fr, { color: '#322d6a', seed: 400 + i });
    blob(ctx, 112, y + 58, 46, 46, { color: shade(c.color, -0.3), seed: 410 + i, frame: fr, outline: 1.6 });
    ctx.save();
    ctx.beginPath();
    ctx.arc(112, y + 58, 40, 0, TAU);
    ctx.clip();
    blob(ctx, 112, y + 58, 44, 44, { color: mix(c.color, '#2a2660', 0.6), seed: 411 + i, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    drawPortrait(ctx, mbr.id, 112, y + 64, 38, { frame: fr });
    ctx.restore();
    const s = statsAt(mbr.id, mbr.level);
    text(ctx, c.name, 172, y + 34, 25, UI.ink, { deco: true });
    text(ctx, `${c.role}  ·  Lv ${mbr.level}`, 172, y + 56, 14, UI.dim, { weight: '500' });
    text(ctx, `HP ${mbr.hp}/${s.hp}`, 172, y + 80, 15, UI.green);
    bar(ctx, 262, y + 66, 150, 14, mbr.hp / s.hp, '#5cc46a', fr);
    text(ctx, `MP ${mbr.mp}/${s.mp}`, 172, y + 102, 15, UI.blue);
    bar(ctx, 262, y + 88, 150, 14, mbr.mp / s.mp, '#4a9ae0', fr);
    text(ctx, `ATK ${s.atk}   DEF ${s.def}`, 440, y + 40, 15, UI.ink, { weight: '500' });
    text(ctx, `MAG ${s.mag}   SPD ${s.spd}`, 440, y + 62, 15, UI.ink, { weight: '500' });
    text(ctx, `XP ${mbr.xp}/${xpToNext(mbr.level)}`, 440, y + 84, 14, UI.dim, { weight: '500' });
    text(ctx, 'Fracture', 440, y + 104, 13, UI.gold, { weight: '600' });
    bar(ctx, 508, y + 93, 100, 10, (mbr.limit || 0) / 100, '#ffb040', fr);
    // glaze slots
    text(ctx, 'Glazes', 650, y + 30, 14, UI.dim, { weight: '600' });
    [0, 1].forEach((slot) => glazeSlot(ctx, g, fr, mbr, slot, 650 + slot * 112, y + 42, 100, 56, i));
  });
  const spare = owned.filter((id) => !party.some((p) => p.glazes.includes(id)));
  text(ctx, spare.length ? `Spare glazes in the satchel: ${spare.map((id) => GLAZES[id].name).join(', ')}. Tap a slot to swap.` : owned.length ? 'Tap a glaze slot to swap which glaze sits in it.' : '', 480, 500, 14, UI.dim, { align: 'center', weight: '500' });
}

function glazeSlot(ctx, g, fr, mbr, slot, gx, gy, w, h, i) {
  const gid = mbr.glazes[slot];
  const hov = inside(g, gx, gy, w, h);
  g.buttons.push({ id: `slot-${mbr.id}-${slot}`, x: gx, y: gy, w, h, onClick: () => g.cycleGlaze(mbr.id, slot) });
  slab(ctx, gx, gy - (hov ? 1.5 : 0), w, h, { color: hov ? '#4a4690' : '#2b2760', seed: 420 + i * 2 + slot, frame: fr, outline: 1.2, noRim: true, gloss: 0.2 });
  if (gid) {
    const gl = GLAZES[gid];
    const ap = (g.state.glazeAp && g.state.glazeAp[gid]) || 0;
    const lv = glazeLevel(ap);
    glow(ctx, gx + 22, gy + h / 2 - 5, 30, gl.color, 0.4);
    blob(ctx, gx + 22, gy + h / 2 - 5, 13, 13, { color: gl.color, seed: strSeed(gid), frame: fr, outline: 1, gloss: 0.9 });
    text(ctx, gl.name, gx + 42, gy + h / 2 + 1, h > 60 ? 18 : 15, UI.ink, { weight: '700' });
    // mastery: three pips, and a thin bar toward the next level
    for (let k = 0; k < 3; k++) blob(ctx, gx + 46 + k * 11, gy + h / 2 + 12, 3.4, 3.4, { color: k < lv ? '#ffd27a' : '#3a3468', seed: 470 + k, frame: fr, flat: true, outline: 0.5, noRim: true, gloss: 0 });
    if (lv < 3) {
      const lo = GLAZE_LEVELS[lv - 1];
      const hi = GLAZE_LEVELS[lv];
      bar(ctx, gx + 10, gy + h - 11, w - 20, 5, (ap - lo) / (hi - lo), '#ffd27a', fr);
    } else {
      text(ctx, 'mastered', gx + w - 10, gy + h / 2 + 15, 10, UI.gold, { align: 'right', weight: '700' });
    }
  } else {
    text(ctx, 'empty', gx + w / 2, gy + h / 2 + 5, h > 60 ? 16 : 14, UI.dim, { align: 'center', weight: '500' });
  }
}

function itemKeys(g) {
  const inv = g.state.inv;
  return Object.keys(ITEMS).filter((k) => (inv[k] || 0) > 0 || (ITEMS[k].key && g.hasItem(k)));
}

function drawItems(ctx, g, fr) {
  const inv = g.state.inv;
  const keys = itemKeys(g);
  if (!keys.length) {
    text(ctx, 'Your pockets hold lint and good intentions.', 480, 280, 20, UI.dim, { align: 'center' });
    return;
  }
  keys.forEach((k, i) => {
    const it = ITEMS[k];
    const y = 108 + i * 84;
    panel(ctx, 52, y, 856, 74, fr, { color: '#322d6a', seed: 500 + i });
    blob(ctx, 100, y + 37, 20, 20, { color: it.key ? '#c9a64a' : k === 'wetclay' ? '#b9744a' : '#8dd3c0', seed: 510 + i, frame: fr, outline: 1.2, gloss: 0.8 });
    text(ctx, `${it.name}${it.key ? '' : '  ×' + inv[k]}`, 140, y + 32, 20, UI.ink, { weight: '700' });
    text(ctx, it.desc, 140, y + 56, 14, UI.dim, { weight: '500' });
    if (!it.key) {
      g.state.party.forEach((mbr, j) => {
        const label = CHARACTERS[mbr.id].name;
        button(ctx, g, fr, `use-${k}-${mbr.id}`, label, 560 + j * 112, y + 16, 104, 42, () => g.useItem(k, mbr.id), { size: 15 });
      });
    }
  });
}

// ---- portrait versions of the three tabs: one column, finger-sized
function drawMenuPortrait(ctx, g, fr, extra = {}) {
  const m = g.menu;
  const v = g.view;
  panel(ctx, 12, 12, v.w - 24, v.h - 24, fr, { color: '#2a2660', seed: 333 });
  // five tabs and a close cross share the row on a 540-wide phone
  MENU_TABS.forEach((id, i) => button(ctx, g, fr, `tab-${id}`, TAB_LABELS[id], 26 + i * 86, 28, 82, 52, () => g.setTab(id), { color: m.tab === id ? '#7a6ad6' : '#3d3a80', size: 13 }));
  button(ctx, g, fr, 'menu-close', '×', v.w - 26 - 52, 28, 52, 52, () => g.closeMenu(), { color: '#8a3f4a', hover: '#b05060', size: 26 });
  if (m.tab === 'journal') drawJournalPortrait(ctx, g, fr);
  else if (m.tab === 'party') drawPartyPortrait(ctx, g, fr);
  else if (m.tab === 'items') drawItemsPortrait(ctx, g, fr);
  else extra[m.tab]?.(ctx, g, fr);
}

function drawJournalPortrait(ctx, g, fr) {
  const v = g.view;
  const found = g.state.clues;
  const bx0 = 28;
  const by0 = 96;
  const bw = v.w - 56;
  const bh = Math.min(440, Math.round((v.h - by0 - 28) * 0.5));
  slab(ctx, bx0, by0, bw, bh, { color: '#a8794a', seed: 340, frame: fr, wobble: 0.01, outline: 2, tex: 0.9, occlusion: 0.25 });
  // a 3x3 board: three columns of notes, however narrow the phone
  const colW = bw / 3;
  const nh = Math.max(58, Math.min(80, (bh - 36) / 3 - 14));
  const pos = (c) => [bx0 + colW * (c.gx + 0.5), by0 + 14 + nh / 2 + c.gy * ((bh - 28 - nh) / 2)];
  drawBoard(ctx, g, fr, pos, { w: Math.min(124, colW - 8), h: nh, size: colW < 112 ? 13 : 15 });
  const py = by0 + bh + 12;
  const ph = v.h - 28 - py;
  panel(ctx, bx0, py, bw, ph, fr, { color: '#241f50', seed: 345 });
  const r = readingFor(g);
  if (r) {
    let y = py + 38;
    if (r.kind === 'ded') {
      text(ctx, 'WORKED OUT', bx0 + 24, py + 22, 12, '#7fd3d0', { weight: '800' });
      y += 6;
    }
    const long = r.text.length > 330;
    const tl = wrap(ctx, r.title, bw - 48, long ? 22 : 25, '800');
    tl.forEach((ln, i) => text(ctx, ln, bx0 + 24, y + i * (long ? 27 : 30), long ? 22 : 25, r.kind === 'ded' ? '#ffe9a0' : UI.gold, { weight: '800' }));
    y += tl.length * (long ? 27 : 30) + 8;
    const fs = long ? 16 : 19;
    const lh = long ? 23 : 27;
    const body = wrap(ctx, r.text, bw - 48, fs, '500');
    body.forEach((ln, i) => text(ctx, ln, bx0 + 24, y + i * lh, fs, UI.ink, { weight: '500' }));
    y += body.length * lh + 6;
    if (r.kind === 'ded') r.from.forEach((t, i) => text(ctx, `· ${t}`, bx0 + 24, Math.min(y + 12, py + ph - 46 - (r.from.length - 1) * 20) + i * 20, 14, UI.dim, { weight: '600' }));
    else if (r.made?.length) r.made.slice(0, 2).forEach((t, i) => text(ctx, `Tied to: ${t}`, bx0 + 24, py + ph - 86 + i * 20, 14, '#e8c24a', { weight: '700' }));
    if (r.kind === 'clue' && r.hint) text(ctx, 'This note belongs next to another.', v.w / 2, py + ph - 38, 14, '#7fd3d0', { align: 'center', weight: '600', italic: true });
  } else {
    text(ctx, found.length ? 'Tap a note to read it.' : 'Nothing pinned yet.', v.w / 2, py + ph / 2 - 14, 21, UI.dim, { align: 'center' });
    text(ctx, found.length ? 'Tap one, then another, to tie them together.' : 'Look closely at things.', v.w / 2, py + ph / 2 + 14, 16, UI.dim, { align: 'center', weight: '500' });
    if (g.pendingCount() > 0) text(ctx, 'Some of these belong together.', v.w / 2, py + ph / 2 + 42, 15, '#7fd3d0', { align: 'center', weight: '600', italic: true });
  }
  text(ctx, journalFooter(g), v.w / 2, v.h - 40, 15, UI.dim, { align: 'center' });
}

function drawPartyPortrait(ctx, g, fr) {
  const v = g.view;
  const party = g.state.party;
  const top = 96;
  const gap = 10;
  const ch = Math.min(250, Math.floor((v.h - top - 56 - gap * (party.length - 1)) / party.length));
  const x = 28;
  const w = v.w - 56;
  party.forEach((mbr, i) => {
    const c = CHARACTERS[mbr.id];
    const y = top + i * (ch + gap);
    const s = statsAt(mbr.id, mbr.level);
    panel(ctx, x, y, w, ch, fr, { color: '#322d6a', seed: 400 + i });
    const ax = x + 58;
    const ay = y + 62;
    blob(ctx, ax, ay, 42, 42, { color: shade(c.color, -0.3), seed: 410 + i, frame: fr, outline: 1.6 });
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, 36, 0, TAU);
    ctx.clip();
    blob(ctx, ax, ay, 40, 40, { color: mix(c.color, '#2a2660', 0.6), seed: 411 + i, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
    drawPortrait(ctx, mbr.id, ax, ay + 6, 34, { frame: fr });
    ctx.restore();
    text(ctx, c.name, x + 114, y + 48, 28, UI.ink, { deco: true });
    text(ctx, `${c.role}  ·  Lv ${mbr.level}`, x + 114, y + 74, 16, UI.dim, { weight: '500' });
    // bars
    text(ctx, 'HP', x + 24, y + 116, 16, UI.green, { weight: '700' });
    bar(ctx, x + 60, y + 102, 150, 16, mbr.hp / s.hp, '#5cc46a', fr);
    text(ctx, `${mbr.hp}/${s.hp}`, x + 220, y + 116, 15, UI.ink, { weight: '600' });
    text(ctx, 'MP', x + 24, y + 142, 16, UI.blue, { weight: '700' });
    bar(ctx, x + 60, y + 128, 150, 16, mbr.mp / s.mp, '#4a9ae0', fr);
    text(ctx, `${mbr.mp}/${s.mp}`, x + 220, y + 142, 15, UI.ink, { weight: '600' });
    // stats
    text(ctx, `ATK ${s.atk}   DEF ${s.def}`, x + w - 24, y + 112, 16, UI.ink, { align: 'right', weight: '500' });
    text(ctx, `MAG ${s.mag}   SPD ${s.spd}`, x + w - 24, y + 136, 16, UI.ink, { align: 'right', weight: '500' });
    text(ctx, `XP ${mbr.xp}/${xpToNext(mbr.level)}`, x + w - 24, y + 160, 14, UI.dim, { align: 'right', weight: '500' });
    text(ctx, 'Fracture', x + 24, y + 168, 14, UI.gold, { weight: '600' });
    bar(ctx, x + 100, y + 156, 110, 12, (mbr.limit || 0) / 100, '#ffb040', fr);
    // glaze slots
    const sw = (w - 48 - 10) / 2;
    const sh = Math.max(52, Math.min(64, ch - 186));
    [0, 1].forEach((slot) => glazeSlot(ctx, g, fr, mbr, slot, x + 24 + slot * (sw + 10), y + ch - sh - 14, sw, sh, i));
  });
  text(ctx, g.state.glazes.length ? 'Tap a glaze slot to swap which glaze sits in it.' : '', v.w / 2, v.h - 30, 15, UI.dim, { align: 'center', weight: '500' });
}

function drawItemsPortrait(ctx, g, fr) {
  const v = g.view;
  const inv = g.state.inv;
  const keys = itemKeys(g);
  if (!keys.length) {
    text(ctx, 'Your pockets hold lint and good intentions.', v.w / 2, v.h / 2, 22, UI.dim, { align: 'center' });
    return;
  }
  const x = 28;
  const w = v.w - 56;
  keys.forEach((k, i) => {
    const it = ITEMS[k];
    const y = 96 + i * (it.key ? 112 : 168);
    const h = it.key ? 100 : 156;
    panel(ctx, x, y, w, h, fr, { color: '#322d6a', seed: 500 + i });
    blob(ctx, x + 44, y + 44, 22, 22, { color: it.key ? '#c9a64a' : k === 'wetclay' ? '#b9744a' : '#8dd3c0', seed: 510 + i, frame: fr, outline: 1.2, gloss: 0.8 });
    text(ctx, `${it.name}${it.key ? '' : '  ×' + inv[k]}`, x + 84, y + 40, 24, UI.ink, { weight: '700' });
    wrap(ctx, it.desc, w - 110, 16, '500').slice(0, 2).forEach((ln, j) => text(ctx, ln, x + 84, y + 66 + j * 22, 16, UI.dim, { weight: '500' }));
    if (!it.key) {
      const bw = (w - 48 - 8 * (g.state.party.length - 1)) / g.state.party.length;
      g.state.party.forEach((mbr, j) => button(ctx, g, fr, `use-${k}-${mbr.id}`, CHARACTERS[mbr.id].name, x + 24 + j * (bw + 8), y + h - 62, bw, 48, () => g.useItem(k, mbr.id), { size: 17 }));
    }
  });
}

// ------------------------------------------------------------------ lamp puzzle overlay
export function drawLampPuzzle(ctx, g, fr) {
  const p = g.puzzle;
  if (!p) return;
  const v = g.view;
  const k = v.portrait ? 1.08 : 1;
  const cx0 = v.w / 2;
  const cy0 = v.portrait ? v.h * 0.46 : v.h / 2;
  ctx.fillStyle = 'rgba(10,5,26,0.7)';
  ctx.fillRect(0, 0, v.w, v.h);
  panel(ctx, cx0 - 230 * k, cy0 - 230 * k, 460 * k, 460 * k, fr, { color: '#3a3548', seed: 600 });
  text(ctx, 'The Lamp Lock', cx0, cy0 - 188 * k, 28 * k, UI.gold, { align: 'center', weight: '800' });
  text(ctx, 'Press a lamp: it and its neighbours flip.', cx0, cy0 - 162 * k, 15 * k, UI.dim, { align: 'center', weight: '500' });
  for (let i = 0; i < 9; i++) {
    const cx = cx0 + ((i % 3) - 1) * 104 * k;
    const cy = cy0 - 4 * k + (Math.floor(i / 3) - 1) * 100 * k;
    const on = p.grid[i];
    const hov = inside(g, cx - 48 * k, cy - 48 * k, 96 * k, 96 * k);
    if (p.hint === i) glow(ctx, cx, cy, 70 * k, '#7fd3d0', 0.55 + 0.25 * Math.sin(fr * 0.9));
    g.buttons.push({ id: `lamp-${i}`, x: cx - 48 * k, y: cy - 48 * k, w: 96 * k, h: 96 * k, onClick: () => g.pressLampCell(i) });
    if (on) glow(ctx, cx, cy, 80 * k, '#ffd98a', 0.55);
    blob(ctx, cx, cy, (hov ? 42 : 40) * k, (hov ? 42 : 40) * k, { color: on ? '#ffe3a0' : '#3d3350', seed: 610 + i, frame: fr, gloss: on ? 0.9 : 0.3, occlusion: on ? 0.08 : 0.4, outline: 1.6 });
    if (!on) blob(ctx, cx, cy, 16 * k, 16 * k, { color: '#2a2238', alpha: 0.6, seed: 630 + i, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0 });
  }
  text(ctx, p.solved ? 'Every lamp is lit. Something breathes behind the door.' : 'Light every lamp.', cx0, cy0 + 168 * k, 16 * k, p.solved ? UI.gold : UI.ink, { align: 'center' });
  button(ctx, g, fr, 'puzzle-hint', 'Hint', cx0 + 8 * k, cy0 + 178 * k, 120 * k, 46 * k, () => g.lampHint(), { size: 17 * k, disabled: p.solved, color: '#3d6a9a', hover: '#5a8ac0' });
  button(ctx, g, fr, 'puzzle-close', 'Step back', cx0 - 136 * k, cy0 + 178 * k, 136 * k, 46 * k, () => g.closePuzzle(), { size: 17 * k, disabled: p.solved });
}

// ------------------------------------------------------------------ title
export function drawTitleUI(ctx, g, fr) {
  const v = g.view;
  const cx = v.w / 2;
  const hasSave = g.hasSave();
  if (v.portrait) {
    const y0 = Math.round(v.h * 0.2);
    decoFan(ctx, cx, y0 + 190, Math.min(380, v.w * 0.76), fr, { n: 11, alpha: 0.24, c2: '#7a3a6a', a0: Math.PI * 1.08, a1: Math.PI * 1.92 });
    clayText(ctx, 'HOLLOW', cx, y0, 92, '#f2d9a0', { align: 'center', frame: fr, tracking: 4, jitter: 2.2 });
    clayText(ctx, 'TIDE', cx, y0 + 100, 92, '#7fd3d0', { align: 'center', frame: fr, tracking: 16, jitter: 2.2 });
    decoRule(ctx, cx, y0 + 126, v.w * 0.7, fr);
    neonText(ctx, 'a conspiracy of clay', cx, y0 + 156, 26, '#ff5fa8', fr, { dead: 11 });
    const bw = 340;
    const by = Math.round(v.h * 0.58);
    button(ctx, g, fr, 'title-new', g.confirmNew > 0 ? 'Erase save & start?' : 'New Game', cx - bw / 2, by, bw, 76, () => g.requestNewGame(), { size: g.confirmNew > 0 ? 22 : 27, color: g.confirmNew > 0 ? '#8a3f4a' : '#5a4eb0' });
    button(ctx, g, fr, 'title-continue', 'Continue', cx - bw / 2, by + 94, bw, 76, () => g.continueGame(), { size: 27, disabled: !hasSave, color: '#3d6a9a', hover: '#5a8ac0' });
    if (g.lastEnding) text(ctx, `Last ending: ${g.lastEnding}  ·  ${g.endingsSeen.length} of 4 found`, cx, v.h - 70, 15, UI.dim, { align: 'center', weight: '500' });
    text(ctx, 'tap to begin', cx, v.h - 36, 14, 'rgba(255,255,255,0.45)', { align: 'center', weight: '500' });
    button(ctx, g, fr, 'hud-sound', '', v.w - 74, 16, 58, 58, () => g.toggleSound(), { color: '#3d3a80' });
    iconSpeaker(ctx, v.w - 74 + 21, 16 + 29, fr, g.sound?.enabled !== false);
    return;
  }
  decoFan(ctx, 480, 318, 330, fr, { n: 11, alpha: 0.24, c2: '#7a3a6a', a0: Math.PI * 1.08, a1: Math.PI * 1.92 });
  clayText(ctx, 'HOLLOW', 480, 150, 104, '#f2d9a0', { align: 'center', frame: fr, tracking: 6, jitter: 2.2 });
  clayText(ctx, 'TIDE', 480, 252, 104, '#7fd3d0', { align: 'center', frame: fr, tracking: 18, jitter: 2.2 });
  decoRule(ctx, 480, 276, 420, fr);
  neonText(ctx, 'a conspiracy of clay', 480, 302, 28, '#ff5fa8', fr, { dead: 11 });
  const bw = 270;
  button(ctx, g, fr, 'title-new', g.confirmNew > 0 ? 'Erase save & start?' : 'New Game', 480 - bw / 2, 352, bw, 52, () => g.requestNewGame(), { size: g.confirmNew > 0 ? 20 : 23, color: g.confirmNew > 0 ? '#8a3f4a' : '#5a4eb0' });
  button(ctx, g, fr, 'title-continue', 'Continue', 480 - bw / 2, 414, bw, 52, () => g.continueGame(), { size: 23, disabled: !hasSave, color: '#3d6a9a', hover: '#5a8ac0' });
  if (g.lastEnding) text(ctx, `Last ending: ${g.lastEnding}  ·  ${g.endingsSeen.length} of 4 found`, 480, 492, 15, UI.dim, { align: 'center', weight: '500' });
  text(ctx, 'tap · click · enter to continue · N for a new game', 480, 520, 13, 'rgba(255,255,255,0.45)', { align: 'center', weight: '500' });
  button(ctx, g, fr, 'hud-sound', '', 900, 14, 46, 46, () => g.toggleSound(), { color: '#3d3a80' });
  iconSpeaker(ctx, 920, 37, fr, g.sound?.enabled !== false);
}

// ------------------------------------------------------------------ ending card
export function drawEnding(ctx, g, fr) {
  const e = g.ending;
  if (!e) return;
  const v = g.view;
  const cx = v.w / 2;
  ctx.fillStyle = `rgba(10,5,26,${Math.min(0.88, e.t * 0.5)})`;
  ctx.fillRect(0, 0, v.w, v.h);
  if (e.t < 1.2) return;
  // the longer endings (the ones with epilogues) shrink to fit: find the biggest size whose paragraph clears the screen
  const maxW = Math.min(700, v.w - 64);
  const btnH = v.portrait ? 62 : 48;
  let size = v.portrait ? 23 : 21;
  let top = v.portrait ? Math.round(v.h * 0.22) : 190;
  let lines;
  let lh;
  let ty;
  let endY;
  for (;;) {
    lh = Math.round(size * 1.43);
    lines = wrap(ctx, e.text, maxW, size, '500');
    ty = top + (v.portrait ? 64 : 60);
    endY = ty + lines.length * lh + (v.portrait ? 48 : 40);
    if (endY + 32 + btnH <= v.h - 14 || (size <= 14 && top <= 120)) break;
    if (size > 14) size -= 1;
    else top -= 12;
  }
  const sy = top - (v.portrait ? 92 : 98);
  marigold(ctx, cx - 70, sy + 12, 13, fr, 301);
  marigold(ctx, cx + 70, sy + 12, 13, fr, 302);
  sugarSkull(ctx, cx, sy, 34, fr, { seed: 5 });
  clayText(ctx, e.title, cx, top, v.portrait ? 40 : 52, '#f2d9a0', { align: 'center', frame: fr, tracking: v.portrait ? 1 : 3 });
  lines.forEach((ln, i) => text(ctx, ln, cx, ty + i * lh, size, UI.ink, { align: 'center', weight: '500' }));
  clayText(ctx, 'END OF CHAPTER ONE', cx, endY, v.portrait ? 30 : 34, '#7fd3d0', { align: 'center', frame: fr, tracking: v.portrait ? 2 : 4 });
  if (e.t > 3) button(ctx, g, fr, 'ending-title', 'Back to the title', cx - 140, endY + 32, 280, btnH, () => g.toTitle(), { size: 20 });
}

export function sparkle(ctx, x, y, fr, seed = 1) {
  const p = 0.6 + 0.4 * Math.sin(fr * 0.8 + seed);
  glow(ctx, x, y, 22 * p + 8, '#ffcf6a', 0.6);
  const r = 3 + 2 * p;
  blob(ctx, x, y, r, r, { color: '#fff7c8', seed: 800 + seed, frame: fr, flat: true, outline: 0, noRim: true, gloss: 0, boil: 0.4 });
  limb(ctx, x - 8 * p, y, x + 8 * p, y, 1, 1, { color: '#fff7c8', seed: 810 + seed, frame: fr, outline: 0, flat: true, noRim: true, boil: 0.2 });
  limb(ctx, x, y - 8 * p, x, y + 8 * p, 1, 1, { color: '#fff7c8', seed: 820 + seed, frame: fr, outline: 0, flat: true, noRim: true, boil: 0.2 });
}

