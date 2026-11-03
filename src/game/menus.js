// The two menu tabs that are not the journal, party or satchel: the Almanac (what now, loose threads, a bestiary) and
// Settings. Both are laid out as one column that is happy at 960 wide or 540 wide, so there is no separate phone version.
// ui.js draws the frame and tabs and hands these two a ctx; the Game passes them in so the files never import each other.

import { panel, text, wrap, button, UI } from './ui.js';
import { ENEMIES, TEXT_SPEEDS, ENDING_KEYS } from './data.js';
import { nextHint, looseThreads } from './hints.js';

const ELEM_COLOR = { fire: '#e8742f', water: '#3aa0c9' };

function box(g) {
  const v = g.view;
  return v.portrait ? { x: 28, y: 96, w: v.w - 56, h: v.h - 96 - 28, portrait: true } : { x: 52, y: 104, w: 856, h: 392, portrait: false };
}

// ------------------------------------------------------------------ almanac
export function drawAlmanac(ctx, g, fr) {
  const b = box(g);
  const hint = nextHint(g);
  const threads = looseThreads(g);
  const m = g.menu;
  const seen = Object.keys(g.state.bestiary || {}).filter((k) => ENEMIES[k]);
  const sel = m.sel2 && seen.includes(m.sel2) ? m.sel2 : seen[0] || null;

  // left (or top): what now + loose threads
  const lw = b.portrait ? b.w : 430;
  const lh = b.portrait ? Math.round(b.h * 0.44) : b.h;
  panel(ctx, b.x, b.y, lw, lh, fr, { color: '#241f50', seed: 801 });
  text(ctx, 'WHAT NOW?', b.x + 22, b.y + 28, 12, '#7fd3d0', { weight: '800' });
  text(ctx, hint.where, b.x + lw - 22, b.y + 28, 12, UI.dim, { align: 'right', weight: '600', italic: true });
  const fs = b.portrait ? 16 : 15;
  const hl = wrap(ctx, hint.text, lw - 44, fs, '500');
  hl.slice(0, 5).forEach((ln, i) => text(ctx, ln, b.x + 22, b.y + 54 + i * (fs + 6), fs, UI.ink, { weight: '500' }));
  let y = b.y + 54 + Math.min(5, hl.length) * (fs + 6) + 14;
  text(ctx, threads.length ? `LOOSE THREADS · ${threads.length}` : 'LOOSE THREADS', b.x + 22, y, 12, '#e8c24a', { weight: '800' });
  y += 22;
  if (!threads.length) text(ctx, 'Nothing you have walked past is still waiting.', b.x + 22, y, 14, UI.dim, { weight: '500', italic: true });
  const room = Math.floor((b.y + lh - 14 - y) / 20);
  threads.slice(0, Math.max(0, room)).forEach((t, i) => {
    const ln = wrap(ctx, t.text, lw - 44 - 70, 13, '500')[0];
    text(ctx, t.where, b.x + 22, y + i * 20, 12, UI.dim, { weight: '700' });
    text(ctx, ln, b.x + 92, y + i * 20, 13, UI.ink, { weight: '500' });
  });
  if (threads.length > room && room > 0) text(ctx, `…and ${threads.length - room} more`, b.x + lw - 22, b.y + lh - 14, 12, UI.dim, { align: 'right', weight: '600' });

  // right (or bottom): the bestiary
  const rx = b.portrait ? b.x : b.x + lw + 14;
  const ry = b.portrait ? b.y + lh + 10 : b.y;
  const rw = b.portrait ? b.w : b.w - lw - 14;
  const rh = b.portrait ? b.h - lh - 10 : b.h;
  panel(ctx, rx, ry, rw, rh, fr, { color: '#2a2660', seed: 802 });
  text(ctx, `BESTIARY · ${seen.length} of ${Object.keys(ENEMIES).length}`, rx + 22, ry + 28, 12, '#7fd3d0', { weight: '800' });
  if (!seen.length) {
    text(ctx, 'Nothing has tried to eat you yet.', rx + rw / 2, ry + rh / 2, 16, UI.dim, { align: 'center', italic: true });
    return;
  }
  // chips for each foe, then the selected entry
  const chipH = b.portrait ? 38 : 34;
  const cols = b.portrait ? 3 : 2;
  const cw = (rw - 44 - 8 * (cols - 1)) / cols;
  seen.forEach((k, i) => {
    const cx = rx + 22 + (i % cols) * (cw + 8);
    const cy = ry + 40 + Math.floor(i / cols) * (chipH + 6);
    button(ctx, g, fr, `bestiary-${k}`, ENEMIES[k].name, cx, cy, cw, chipH, () => { g.menu.sel2 = k; g.dirty = true; }, { size: b.portrait ? 13 : 14, color: k === sel ? '#7a6ad6' : '#3d3a80' });
  });
  const rows = Math.ceil(seen.length / cols);
  let ey = ry + 40 + rows * (chipH + 6) + 14;
  const e = ENEMIES[sel];
  const k = g.state.bestiary[sel] || { weak: [], resist: [] };
  text(ctx, e.name, rx + 22, ey, 20, '#ffe9a0', { weight: '800' });
  ey += 24;
  wrap(ctx, e.blurb, rw - 44, 14, '600', true).slice(0, 2).forEach((ln, i) => text(ctx, ln, rx + 22, ey + i * 18, 14, UI.dim, { weight: '600', italic: true }));
  ey += 22 + (wrap(ctx, e.blurb, rw - 44, 14, '600', true).length > 1 ? 18 : 0);
  // what the party has actually learned: weaknesses you have not seen are shown as question marks
  const learned = [
    ['Weak', k.weak, '#ffcf5a'],
    ['Resists', k.resist, '#bdb2da'],
  ];
  learned.forEach(([label, list], i) => {
    text(ctx, label, rx + 22, ey + i * 22, 13, UI.dim, { weight: '700' });
    if (list.length) text(ctx, list.join(' · '), rx + 100, ey + i * 22, 14, list.length ? ELEM_COLOR[list[0]] || UI.ink : UI.ink, { weight: '700' });
    else text(ctx, 'not seen yet', rx + 100, ey + i * 22, 13, UI.dim, { weight: '500', italic: true });
  });
  ey += 56;
  // lore opens once you have beaten this kind of foe's weakness on the table; until then a hint of what it does
  const lines = wrap(ctx, e.lore, rw - 44, b.portrait ? 14 : 13, '500');
  const maxLines = Math.max(1, Math.floor((ry + rh - 16 - ey) / (b.portrait ? 19 : 18)));
  lines.slice(0, maxLines).forEach((ln, i) => text(ctx, ln, rx + 22, ey + i * (b.portrait ? 19 : 18), b.portrait ? 14 : 13, UI.ink, { weight: '500' }));
}

// ------------------------------------------------------------------ settings
export function drawSettings(ctx, g, fr) {
  const b = box(g);
  const s = g.settings;
  panel(ctx, b.x, b.y, b.w, b.h, fr, { color: '#241f50', seed: 811 });
  const rowH = b.portrait ? 98 : 60;
  const labelX = b.x + 26;
  const rows = [
    {
      label: 'Sound', note: 'Music and effects.',
      opts: [['On', s.sound !== false], ['Off', s.sound === false]],
      pick: (i) => g.setSetting('sound', i === 0),
    },
    {
      label: 'Text speed', note: 'How fast dialogue types out.',
      opts: TEXT_SPEEDS.map((t, i) => [t.label, s.textSpeed === i]),
      pick: (i) => g.setSetting('textSpeed', i),
    },
    {
      label: 'Stop-motion boil', note: 'Calm holds every shape still between moves.',
      opts: [['Boil', !s.calm], ['Calm', !!s.calm]],
      pick: (i) => g.setSetting('calm', i === 1),
    },
    {
      label: 'Battle pace', note: 'Wait: time crawls while you choose. Active: it does not.',
      opts: [['Wait', !s.active], ['Active', !!s.active]],
      pick: (i) => g.setSetting('active', i === 1),
    },
  ];
  rows.forEach((r, i) => {
    const y = b.y + 20 + i * rowH;
    text(ctx, r.label, labelX, y + 22, 18, UI.ink, { weight: '700' });
    text(ctx, r.note, labelX, y + 44, 12, UI.dim, { weight: '500' });
    const n = r.opts.length;
    const bw = b.portrait ? Math.min(98, (b.w - 52 - 6 * (n - 1)) / n) : 104;
    const bx0 = b.portrait ? labelX : b.x + b.w - 26 - n * (bw + 8) + 8;
    const by = b.portrait ? y + 50 : y + 6;
    r.opts.forEach(([label, on], j) => button(ctx, g, fr, `set-${i}-${j}`, label, bx0 + j * (bw + 8), by, bw, b.portrait ? 38 : 40, () => r.pick(j), { size: 15, color: on ? '#7a6ad6' : '#3d3a80' }));
  });
  // endings found, and the way back to the title
  const y = b.y + 20 + rows.length * rowH + (b.portrait ? 6 : 4);
  text(ctx, `Endings found: ${g.endingsSeen.length} of ${ENDING_KEYS.length}`, labelX, y + 22, 15, '#e8c24a', { weight: '700' });
  const found = ENDING_KEYS.map((k) => (g.endingsSeen.includes(k) ? k : '???')).join('  ·  ');
  wrap(ctx, found, b.w - 52, 12, '500').slice(0, 2).forEach((ln, i) => text(ctx, ln, labelX, y + 44 + i * 16, 12, UI.dim, { weight: '500' }));
  const by = b.y + b.h - (b.portrait ? 64 : 56);
  text(ctx, 'Progress is saved at every scene change and after every battle.', b.x + b.w / 2, by - 12, 12, UI.dim, { align: 'center', weight: '500' });
  button(ctx, g, fr, 'set-title', 'Save and return to title', b.x + b.w / 2 - 150, by, 300, b.portrait ? 48 : 44, () => { g.save(); g.closeMenu(); g.toTitle(); }, { size: 17, color: '#8a3f4a', hover: '#b05060' });
}
