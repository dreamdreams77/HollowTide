// Render smoke test. Node has no canvas, so we hand the renderer a recording stub context. This cannot judge how
// anything *looks* (tools/shots.py does that in a real browser), but it catches the class of bug where a render
// path throws (a missing import, an undefined variable, a null hover) and silently blanks half the UI.

import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { newMember } from '../src/game/data.js';
import { setCanvasFactory } from '../src/engine/clay.js';
import { SCENES } from '../src/game/scenes.js';
import { stubCtx } from './stub-ctx.js';

setCanvasFactory(() => ({ width: 0, height: 0, getContext: () => stubCtx() }));

const tick = () => new Promise((r) => setImmediate(r));

const VIEWS = [
  ['landscape 960x540', 960, 540],
  ['portrait phone 540x960', 540, 960],
  ['portrait tall phone 540x1170', 540, 1170],
  ['portrait tablet 540x720', 540, 720],
];

function makeGame(w, h) {
  const g = new Game({ sound: null, storage: null, seed: 3 });
  g.setViewport(w, h);
  return g;
}

function draw(g, frames = 3) {
  const ctx = stubCtx();
  for (let f = 0; f < frames; f++) {
    g.render(ctx, 5 + f);
    g.drawCursor(ctx);
  }
  assert.equal(ctx.stackDepth, 0, 'save/restore balanced');
  assert.equal(ctx.globalAlpha, 1, 'globalAlpha restored');
  return ctx;
}

// every button must be reachable: on screen and not absurdly tiny
function checkButtons(g, label) {
  const v = g.view;
  for (const b of g.buttons) {
    assert.ok(b.x >= -1 && b.y >= -1 && b.x + b.w <= v.w + 1 && b.y + b.h <= v.h + 1, `${label}: button ${b.id} on screen (${b.x},${b.y},${b.w},${b.h})`);
    assert.ok(b.w >= 20 && b.h >= 20, `${label}: button ${b.id} big enough`);
  }
}

for (const [name, W, H] of VIEWS) {
  const portrait = H > W;

  test(`[${name}] title screen renders`, () => {
    const g = makeGame(W, H);
    const ctx = draw(g);
    assert.ok(ctx.calls.fillText.length > 0);
    checkButtons(g, 'title');
    assert.ok(g.buttons.some((b) => b.id === 'title-new'));
  });

  test(`[${name}] every scene renders in explore mode, with hover, toast and followers`, () => {
    for (const id of Object.keys(SCENES)) {
      const g = makeGame(W, H);
      g.newGame();
      g.state.party.push(newMember('ochre', 5, ['mend', null]), newMember('slip', 5, ['brine', null]));
      g.debugJump(id, { intro_done: true });
      g.toast('A toast for the road, long enough that a narrow screen has to wrap it onto a second line.');
      for (const h of g.hotspots()) {
        const [sx, sy] = g.toScreen(h.rect[0] + 3, h.rect[1] + 3);
        g.pointerMove(sx, sy);
        draw(g, 1);
      }
      g.update(0.1);
      draw(g);
      checkButtons(g, id);
    }
  });

  test(`[${name}] dialogue, choice and the journal / party / items tabs render`, async () => {
    const g = makeGame(W, H);
    g.newGame();
    g.state.party.push(newMember('ochre', 5, ['mend', null]), newMember('slip', 5, ['brine', 'deluge']));
    g.state.clues = ['same_thumb', 'four_signs', 'ledger', 'tide_chart', 'the_truth'];
    g.state.inv.wetclay = 2;
    g.state.inv.slipdraught = 1;
    g.give('brassthumb');
    g.debugJump('pier', { intro_done: true });
    g.run(async () => {
      await g.say('slip', "The PICKLE is gone, I ate it in year two. No, the problem is the Guild jars every Slip they catch. We remember the tide, you see. They don't like remembering.");
    });
    await tick();
    for (let i = 0; i < 40; i++) g.update(0.05);
    assert.ok(g.dialogue, 'dialogue is up');
    draw(g);
    g.advance();
    g.advance();
    await tick();
    assert.ok(!g.dialogue);
    g.run(async () => {
      await g.ask('What does Marl do?', ['Let it sleep', 'Wake it', 'Press my thumb to the lock']);
    });
    await tick();
    draw(g);
    checkButtons(g, 'choice');
    g.pick(0);
    await tick();
    // meeting foes opens almanac pages; a few are learned about, the rest are not
    g.state.bestiary = { husk: { weak: ['fire'], resist: [] }, kilnwright: { weak: ['water'], resist: ['fire'] }, eel: { weak: [], resist: [] }, moth: { weak: [], resist: ['water'] }, auditor: { weak: [], resist: [] }, warden: { weak: [], resist: [] } };
    for (const tab of ['journal', 'party', 'items', 'almanac', 'settings']) {
      g.openMenu(tab);
      g.setTab(tab);
      g.selectClue('four_signs');
      draw(g);
      checkButtons(g, tab);
      g.closeMenu();
    }
    // the almanac with an empty bestiary, a selected entry, and every setting flipped
    g.state.bestiary = {};
    g.openMenu('almanac');
    g.setTab('almanac');
    draw(g);
    g.state.bestiary = { moth: { weak: [], resist: [] } };
    g.menu.sel2 = 'moth';
    draw(g);
    g.setTab('settings');
    g.setSetting('textSpeed', 3);
    g.setSetting('calm', true);
    g.setSetting('active', true);
    g.setSetting('sound', false);
    draw(g);
    checkButtons(g, 'settings flipped');
    g.closeMenu();
  });

  test(`[${name}] lamp puzzle overlay renders`, async () => {
    const g = makeGame(W, H);
    g.newGame();
    g.debugJump('archive', { intro_done: true });
    g.run(() => g.openLampPuzzle());
    await tick();
    assert.equal(g.mode, 'puzzle');
    draw(g);
    checkButtons(g, 'puzzle');
    assert.equal(g.buttons.filter((b) => b.id.startsWith('lamp-')).length, 9);
  });

  test(`[${name}] battle renders in every menu stage, with every party size, and the result screen`, async () => {
    for (const size of [1, 2, 3]) {
      const g = makeGame(W, H);
      g.newGame();
      const roster = [newMember('marl', 5, ['ember', 'wedge']), newMember('ochre', 5, ['mend', 'slump']), newMember('slip', 5, ['brine', 'deluge'])];
      g.state.party = roster.slice(0, size);
      g.state.inv.wetclay = 2;
      g.debugJump('archive', { intro_done: true });
      g.run(() => g.battle('archive_guild'));
      for (let i = 0; i < 400 && !(g.bv && g.bv.b.current); i++) {
        g.update(0.05);
        if (i % 4 === 0) await tick();
      }
      assert.ok(g.bv && g.bv.b.current, 'a character becomes ready');
      draw(g); // root menu
      checkButtons(g, 'battle root');
      g.bv.choose('glaze');
      draw(g); // glaze list
      checkButtons(g, 'battle glaze');
      g.bv.back();
      g.bv.choose('item');
      draw(g); // item list
      checkButtons(g, 'battle item');
      g.bv.back();
      g.bv.choose('attack');
      draw(g); // target picker
      checkButtons(g, 'battle target');
      g.bv.back();
      g.bv.b.party.forEach((p) => (p.limit = 100));
      draw(g); // fracture button visible
      checkButtons(g, 'battle fracture');
      if (portrait) {
        // finger-sized: every command button at least 50 logical px tall
        for (const b of g.buttons.filter((x) => x.id.startsWith('cmd-'))) assert.ok(b.h >= 50, `${b.id} is ${b.h}px tall`);
      }
      // a sprite tap in target mode must land on a foe
      g.bv.choose('attack');
      const foe = g.bv.b.foes.find((f) => f.alive);
      const r = g.bv.boundsOf(foe);
      assert.ok(r.x >= -20 && r.x + r.w <= W + 20 && r.y >= -20 && r.y + r.h <= H + 20, `foe on screen ${JSON.stringify(r)}`);
      g.bv.back();
      // finish the fight so the result panel renders
      const b = g.bv.b;
      for (let i = 0; i < 4000 && !g.bv.result; i++) {
        if (b.current && !b.result) {
          const a = b.current;
          const f = b.foes.find((x) => x.alive);
          if (!b.command(a, { type: 'attack', target: f.uid })) b.command(a, { type: 'guard' });
          for (const p of b.party) p.hp = p.maxHp; // keep everyone alive; we only care about drawing
        }
        for (const f of b.foes) f.hp = Math.min(f.hp, 1);
        g.update(0.05);
        if (i % 8 === 0) await tick();
      }
      assert.ok(g.bv && g.bv.result, 'battle reaches a result');
      draw(g, 5);
    }
  });

  test(`[${name}] the boss fight (enraged too) and the ending screen render`, async () => {
    const g = makeGame(W, H);
    g.newGame();
    g.state.party = [newMember('marl', 6, ['ember', 'wedge']), newMember('ochre', 6, ['mend', 'slump']), newMember('slip', 6, ['brine', 'deluge'])];
    g.debugJump('kiln', { warden_met: true });
    g.run(() => g.battle('kiln_warden'));
    for (let i = 0; i < 400 && !(g.bv && g.bv.b.current); i++) {
      g.update(0.05);
      if (i % 4 === 0) await tick();
    }
    draw(g);
    const r = g.bv.boundsOf(g.bv.b.foes[0]);
    assert.ok(r.x >= -30 && r.x + r.w <= W + 30, `boss fits across the screen ${JSON.stringify(r)}`);
    g.bv.b.foes[0].hp = Math.floor(g.bv.b.foes[0].maxHp * 0.3);
    for (let i = 0; i < 80; i++) g.update(0.05);
    draw(g);

    const g2 = makeGame(W, H);
    g2.newGame();
    g2.debugJump('kiln', { warden_met: true, boss_beaten: true, kiln_open: true }, { eyeT: 1 });
    g2.run(() => g2.showEnding({ key: 'The Long Sleep', title: 'THE LONG SLEEP', text: 'Marl lays a hand on the great cool lid and hums a ferry song. The eye closes. The tide comes home, gently, over everything.' }));
    await tick();
    for (let i = 0; i < 80; i++) g2.update(0.05);
    draw(g2);
    checkButtons(g2, 'ending');
  });
}

test('rotating mid-game keeps state, re-lays the battle out, and maps taps to the world', async () => {
  const g = makeGame(960, 540);
  g.newGame();
  g.state.party = [newMember('marl', 5, ['ember', 'wedge']), newMember('ochre', 5, ['mend', 'slump'])];
  g.debugJump('pier', { intro_done: true }, { px: 700, py: 470 });
  draw(g);
  g.setViewport(540, 960);
  assert.ok(g.view.portrait);
  assert.ok(g.view.z > 1.4, `portrait zooms the world in (z=${g.view.z})`);
  assert.equal(g.state.scene, 'pier');
  g.snapCamera();
  const visW = g.view.w / g.view.z;
  assert.ok(g.cam.x > 0 && g.cam.x + visW <= 960 + 0.5, 'camera is inside the world');
  assert.ok(g.state.px > g.cam.x && g.state.px < g.cam.x + visW, 'the player is on screen');
  // screen <-> world round trip
  const [sx, sy] = g.toScreen(g.state.px, g.state.py);
  const [wx, wy] = g.toWorld(sx, sy);
  assert.ok(Math.abs(wx - g.state.px) < 1e-6 && Math.abs(wy - g.state.py) < 1e-6);
  // tapping the player's own spot in portrait walks to (about) that world spot, not a screen-sized one
  g.pointerDown(sx - 60, sy);
  assert.ok(g.walk && Math.abs(g.walk.x - (g.state.px - 60 / g.view.z)) < 2, 'tap converts to world coordinates');
  // the HUD bar is not walkable
  g.walk = null;
  g.pointerDown(200, 40);
  assert.equal(g.walk, null);
  // rotate back during a battle
  g.run(() => g.battle('pier_husks'));
  for (let i = 0; i < 400 && !(g.bv && g.bv.b.current); i++) {
    g.update(0.05);
    if (i % 4 === 0) await tick();
  }
  const portraitY = g.bv.vis[g.bv.b.party[0].uid].y;
  draw(g);
  g.setViewport(960, 540);
  draw(g);
  assert.notEqual(g.bv.vis[g.bv.b.party[0].uid].y, portraitY, 'combatants were re-placed for the new orientation');
});
