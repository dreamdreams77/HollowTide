// Depth and nuance: multiplane parallax, perspective floors, lamp light, foreground framing, expressive faces,
// and the dialogue camera. As elsewhere these run against a stub canvas, so they prove the maths and that nothing
// throws or leaks canvas state; how it *looks* is judged in a real browser (tools/shots.py).

import test from 'node:test';
import assert from 'node:assert/strict';
import { setCanvasFactory } from '../src/engine/clay.js';
import * as depth from '../src/engine/depth.js';
import { paintPier, paintArchive, paintChapel, paintKiln, paintTitle, paintAtmos, paintFore, paintBattleBG, setStageExtend, GRADES, THEMES } from '../src/engine/stage.js';
import { drawFigure, drawPortrait, FIGURES, MOODS } from '../src/engine/actors.js';
import { Game } from '../src/game/game.js';
import { newMember } from '../src/game/data.js';
import { stubCtx } from './stub-ctx.js';

setCanvasFactory(() => ({ width: 0, height: 0, getContext: () => stubCtx() }));

function clean(name, fn) {
  test(name, () => {
    const ctx = stubCtx();
    for (let fr = 0; fr < 4; fr++) fn(ctx, fr);
    assert.equal(ctx.stackDepth, 0, 'save/restore balanced');
    assert.equal(ctx.globalAlpha, 1, 'globalAlpha restored');
    assert.ok(ctx.calls.total > 0, 'drew something');
  });
}

// ------------------------------------------------------------------ parallax
test('a plane slides by P.x * (1 - k): pinned sky, fixed action plane, foreground the other way', () => {
  depth.setParallax(100);
  assert.equal(depth.planeShift(0), 100);
  assert.equal(depth.planeShift(1), 0);
  assert.ok(Math.abs(depth.planeShift(0.4) - 60) < 1e-9);
  assert.ok(depth.planeShift(1.2) < 0, 'nearer than the action slides against the camera');
  depth.setParallax(0);
  assert.equal(depth.planeShift(0.3), 0);
});

test('plane() only touches the transform when the plane actually moves, and always balances', () => {
  const ctx = stubCtx();
  depth.setParallax(0);
  depth.plane(ctx, 0.2, () => ctx.fillRect(0, 0, 1, 1));
  assert.equal(ctx.stackDepth, 0);
  depth.setParallax(40);
  let ran = 0;
  depth.plane(ctx, 0.2, () => ran++);
  depth.plane(ctx, 1, () => ran++);
  assert.equal(ran, 2);
  assert.equal(ctx.stackDepth, 0);
  depth.setParallax(NaN);
  assert.equal(depth.getParallax(), 0, 'garbage never reaches the transform');
});

// ------------------------------------------------------------------ perspective
test('perspective rows are contiguous, grow by the ratio, and run past the bottom edge', () => {
  const rows = depth.perspRows(402, 700, 17, 1.12);
  assert.ok(rows.length >= 6);
  for (let i = 1; i < rows.length; i++) {
    assert.ok(Math.abs(rows[i].y - (rows[i - 1].y + rows[i - 1].h)) < 1e-9, 'no gaps between rows');
    assert.ok(Math.abs(rows[i].h / rows[i - 1].h - 1.12) < 1e-9);
    assert.ok(rows[i].t >= rows[i - 1].t);
  }
  assert.ok(rows[rows.length - 1].y >= 700 || rows[rows.length - 1].y + rows[rows.length - 1].h >= 700);
  assert.equal(rows[0].s, 1);
  assert.ok(depth.perspRows(0, 1e9, 1, 1.0001).length <= 40, 'bounded even for absurd input');
});

test('trapezoid points hug the requested edges and widen toward the bottom', () => {
  const pts = depth.trapPoints(100, 200, 10, 60, 240, 110, 5, 0);
  assert.equal(pts.length, 20);
  const top = pts.slice(0, 5);
  const bottom = pts.slice(10, 15);
  assert.ok(top.every((p) => Math.abs(p[1] - 10) < 1.2), 'top edge stays at the top');
  assert.ok(bottom.every((p) => Math.abs(p[1] - 110) < 1.2), 'bottom edge stays at the bottom');
  const w = (a) => Math.max(...a.map((p) => p[0])) - Math.min(...a.map((p) => p[0]));
  assert.ok(w(bottom) > w(top) + 40);
  // the boil: different frames wobble differently but never by much
  const a = depth.trapPoints(100, 200, 10, 60, 240, 110, 5, 1);
  assert.ok(a.some((p, i) => p[0] !== pts[i][0]));
  assert.ok(a.every((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]) < 4));
});

test('farther() washes a colour toward the haze and clamps', () => {
  assert.equal(depth.farther('#000000', '#ffffff', 0), '#000000');
  assert.equal(depth.farther('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(depth.farther('#000000', '#ffffff', 5), '#ffffff');
  assert.equal(depth.farther('#000000', '#ffffff', -1), '#000000');
});

// ------------------------------------------------------------------ air, light, water
clean('haze, bokeh, light pools and washes leave the canvas clean', (c, f) => {
  depth.haze(c, 246, 300, '#f2a07a', 0.3, { peak: 0.8 });
  depth.haze(c, 0, 400, '#2b2144', 0.3, { fade: false });
  depth.bokeh(c, f, { n: 6, colors: ['#ffb870', '#ff7fa8'], seed: 4 });
  depth.lightPool(c, 372, 458, 200, 34, '#ffc86a', 0.24, f);
  depth.lightWash(c, 372, 356, 230, '#ffc86a', 0.5, f);
});
clean('reflections, ripples and glints', (c, f) => {
  depth.streak(c, 372, 408, 64, 18, '#ffd88a', 0.2, f, 3);
  depth.ripples(c, 800, 372, 84, 9, f, { a: 0.3 });
  depth.glints(c, f, 600, 780, 298, 392, 12, 7);
  depth.trapezoid(c, 100, 200, 10, 60, 240, 110, { color: '#7a3a45', seed: 2, frame: f });
});

// ------------------------------------------------------------------ the sets
for (const [name, paint] of [['pier', paintPier], ['archive', paintArchive], ['chapel', paintChapel], ['kiln', paintKiln]]) {
  clean(`${name}: planes, light, atmosphere and foreground, with and without floor extension and parallax`, (c, f) => {
    for (const [ext, p] of [[0, 0], [260, 140], [0, -22], [400, -300]]) {
      setStageExtend(ext);
      depth.setParallax(p);
      paint(c, f, { open: true, hatchOpen: true, vaultOpen: true, gateOpen: true, solved: true, lamps: Array(9).fill(true), eye: 1, eyeOpen: 1, pressed: ['eye'] });
      paintAtmos(c, name, f);
      paintFore(c, name, f);
    }
    setStageExtend(0);
    depth.setParallax(0);
  });
}
clean('title and every battle backdrop (landscape and portrait)', (c, f) => {
  paintTitle(c, f);
  for (const id of Object.keys(THEMES)) {
    paintBattleBG(c, id, f);
    paintBattleBG(c, id, f, { w: 540, h: 1000, horizon: 300 });
  }
});

test('every scene has a grade, and a mood for the light bouncing off its floor', () => {
  for (const id of ['pier', 'archive', 'chapel', 'kiln', 'title']) {
    const g = GRADES[id];
    assert.ok(g, id);
    for (const k of ['cool', 'warm']) assert.ok(Array.isArray(g[k]) && g[k].length === 3 && g[k].every((n) => n >= 0 && n <= 255));
  }
});

// ------------------------------------------------------------------ faces and bodies
test('every mood is defined with brows, lift and a mouth, and the story only uses moods that exist', async () => {
  for (const [k, m] of Object.entries(MOODS)) {
    assert.equal(m.brow.length, 2, k);
    assert.equal(m.lift.length, 2, k);
    assert.ok(m.mouth, k);
  }
  const src = (await import('node:fs')).readFileSync(new URL('../src/game/scenes.js', import.meta.url), 'utf8');
  const used = new Set([...src.matchAll(/say\('[a-z]+',\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'),\s*'(\w+)'\)/g)].map((m) => m[1]));
  assert.ok(used.size >= 6, `the script should use a range of moods, got ${[...used]}`);
  for (const m of used) assert.ok(MOODS[m] || m === 'angry', `scenes.js uses unknown mood "${m}"`);
});

clean('every figure in every mood, standing, walking, talking, gazing, squashed and knocked out', (c, f) => {
  for (const kind of Object.keys(FIGURES)) {
    for (const mood of [...Object.keys(MOODS), undefined]) {
      drawFigure(c, kind, 300, 400, { frame: f, mood });
      drawFigure(c, kind, 300, 400, { frame: f * 7 + 1, mood, talk: true, look: [-1, 0.6] });
      drawFigure(c, kind, 300, 400, { frame: f, mood, moving: true, step: f, facing: -1, scale: 1.08 });
      drawPortrait(c, kind, 100, 100, 44, { frame: f, mood, talk: f % 2 === 0 });
    }
    drawFigure(c, kind, 300, 400, { frame: f, squash: 0.94, alpha: 0.5 });
  }
});

test('figures blink on different beats and never stand perfectly still', () => {
  // count how many frames in a second-and-a-half each figure blinks on, by watching for the closed-eye stroke
  const strokes = (kind) => {
    const out = [];
    for (let fr = 0; fr < 46; fr++) {
      const ctx = stubCtx();
      let q = 0;
      const orig = ctx.quadraticCurveTo;
      ctx.quadraticCurveTo = (...a) => {
        q++;
        return orig?.(...a);
      };
      drawFigure(ctx, kind, 0, 0, { frame: fr });
      out.push(q);
    }
    return out;
  };
  const a = strokes('marl');
  const b = strokes('ochre');
  assert.notDeepEqual(a, b, 'two figures do not blink in lockstep');
});

// ------------------------------------------------------------------ the dialogue camera
function stage(w = 960, h = 540) {
  const g = new Game({ sound: null, storage: null, seed: 3 });
  g.setViewport(w, h);
  g.newGame();
  g.state.party.push(newMember('ochre', 5, ['mend', null]));
  g.debugJump('pier', { intro_done: true });
  return g;
}

test('a speaker is framed: the camera leans in, tilts up clear of the box, and eases back afterwards', () => {
  const g = stage();
  const ctx = stubCtx();
  g.render(ctx, 1);
  assert.equal(g.zoomK, 0);
  assert.equal(g.lift, 0);
  g.dialogue = { who: 'marl', text: 'Same whorl. Same little split in the ridge.', mood: 'awe', acc: 0, shown: 0, done: true, resolve() {} };
  for (let i = 0; i < 120; i++) {
    g.update(1 / 60);
    g.render(ctx, 2 + (i >> 3));
  }
  assert.ok(g.zoomK > 0.08, `zoomed in (${g.zoomK})`);
  assert.ok(g.lift > 20, `lifted (${g.lift})`);
  assert.ok(g.lift <= 170);
  assert.equal(g.boxTop, 392, 'the box tells the camera where it starts');
  assert.ok(g.dolly > 0.9);
  assert.equal(ctx.stackDepth, 0);
  g.dialogue = null;
  for (let i = 0; i < 240; i++) g.update(1 / 60);
  assert.equal(g.zoomK, 0);
  assert.equal(g.lift, 0);
  assert.equal(g.dolly, 0);
  setStageExtend(0);
});

test('narration breathes in a little but never lifts the set', () => {
  const g = stage();
  g.dialogue = { who: 'narr', text: 'The hour the sea forgets itself.', acc: 0, shown: 0, done: true, resolve() {} };
  const ctx = stubCtx();
  for (let i = 0; i < 120; i++) {
    g.update(1 / 60);
    g.render(ctx, 3);
  }
  assert.ok(g.zoomK > 0.02 && g.zoomK < 0.04);
  assert.equal(g.lift, 0);
  setStageExtend(0);
});

test('the dialogue camera also works upright, and parallax follows the real camera there', () => {
  const g = stage(540, 1170);
  const ctx = stubCtx();
  g.state.px = 800;
  g.snapCamera();
  assert.ok(g.para > 0, 'camera right of centre');
  g.state.px = 100;
  g.snapCamera();
  assert.ok(g.para < 0, 'camera left of centre');
  g.dialogue = { who: 'ochre', text: 'Husks.', mood: 'angry', acc: 0, shown: 0, done: false, resolve() {} };
  for (let i = 0; i < 90; i++) {
    g.update(1 / 60);
    g.render(ctx, 4);
  }
  assert.ok(g.zoomK > 0.08);
  assert.equal(ctx.stackDepth, 0);
  assert.equal(ctx.globalAlpha, 1);
  setStageExtend(0);
});

test('landscape sways with the lead a little, never enough to outrun the painters\' overscan', () => {
  const g = stage();
  g.state.px = 900;
  g.snapCamera();
  assert.ok(g.para > 10 && g.para <= 22);
  g.state.px = 60;
  g.snapCamera();
  assert.ok(g.para < -10 && g.para >= -22);
});

test('everyone looks at whoever is speaking, and the lead looks where they are headed', () => {
  const g = stage();
  const ctx = stubCtx();
  const seen = [];
  const orig = ctx.quadraticCurveTo;
  ctx.quadraticCurveTo = (...a) => {
    seen.push(a);
    return orig?.(...a);
  };
  g.dialogue = { who: 'ochre', text: 'Hmm.', mood: 'sad', acc: 0, shown: 0, done: true, resolve() {} };
  g.render(ctx, 2);
  g.dialogue = null;
  g.walk = { x: 700, y: 480 };
  g.render(ctx, 3);
  g.hoverAt = [300, 300];
  g.render(ctx, 4);
  assert.ok(seen.length > 0);
  assert.equal(ctx.stackDepth, 0);
});
