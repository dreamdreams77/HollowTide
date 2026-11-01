// The Grim Fandango / Dia de los Muertos set dressing and the noir finish: every primitive must draw without
// throwing and leave the canvas state exactly as it found it (a leaked clip or alpha silently ruins every frame after it).

import test from 'node:test';
import assert from 'node:assert/strict';
import { setCanvasFactory, filmFinish, texFill, shadow } from '../src/engine/clay.js';
import * as noir from '../src/engine/noir.js';
import { paintPier, paintArchive, paintChapel, paintKiln, paintTitle, paintAtmos, paintBattleBG, setStageExtend, moon } from '../src/engine/stage.js';
import { drawFigure, drawPortrait, FIGURES } from '../src/engine/actors.js';
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

clean('papel picado bunting', (c, f) => noir.papelPicado(c, 0, 20, 960, 50, 30, f, { n: 12, seed: 3 }));
clean('marigolds, garlands, petals and a petal path', (c, f) => {
  noir.marigold(c, 100, 100, 12, f, 1);
  noir.marigold(c, 140, 100, 8, f, 2);
  noir.garland(c, 100, 50, 500, 50, 30, f, { n: 8 });
  noir.petals(c, f, { n: 6 });
  noir.petalPath(c, f, 10, 400, 300, 420, 6);
});
clean('candle, ofrenda and sugar skulls (full and simple)', (c, f) => {
  noir.candle(c, 50, 200, 24, f, 2);
  noir.ofrenda(c, 200, 300, f, 4, { s: 0.85 });
  noir.sugarSkull(c, 300, 300, 30, f, { seed: 2 });
  noir.sugarSkull(c, 400, 300, 10, f, { seed: 3, simple: true });
  noir.moonFace(c, 500, 200, 54, f);
});
clean('neon text and neon sign, including the dying letter', (c, f) => {
  assert.ok(noir.neonText(c, 'FERRY', 100, 100, 28, '#ff4f9a', f, { dead: 3 }) > 0);
  noir.neonSign(c, 200, 200, 112, 34, 'FERRY', '#ff4f9a', f, { dead: 2 });
  noir.neonSign(c, 200, 300, 112, 34, 'OFF', '#ff4f9a', f, { on: false });
});
clean('fog, light shafts and motes', (c, f) => {
  noir.fogBank(c, f, { y: 460 });
  noir.shafts(c, [{ x: 100, y: -10, ang: 1.2, len: 500, w0: 30, w1: 100, a: 0.1 }], f);
  noir.motes(c, f, {});
});
clean('deco fan, frame, rule and cast shadow', (c, f) => {
  noir.decoFan(c, 480, 300, 300, f, { n: 11, alpha: 0.3 });
  noir.decoFrame(c, 20, 20, 400, 200, f, {});
  noir.decoRule(c, 480, 100, 300, f);
  noir.castShadow(c, 300, 460, 30, f);
});
clean('noir film finish (grade, flicker, grain, hair in the gate)', (c, f) => {
  filmFinish(c, 960, 540, f);
  filmFinish(c, 540, 1170, f + 40, { noir: 0, vignette: 0.3 });
});
clean('every painted set, with and without the tall-phone floor extension', (c, f) => {
  for (const ext of [0, 212]) {
    setStageExtend(ext);
    paintPier(c, f, {});
    paintArchive(c, f, { lamps: [1, 0, 1, 0, 1, 0, 1, 0, 1] });
    paintChapel(c, f, {});
    paintKiln(c, f, {});
    for (const id of ['pier', 'archive', 'chapel', 'kiln']) paintAtmos(c, id, f);
  }
  setStageExtend(0);
  paintTitle(c, f);
  moon(c, 600, 100, 50, f);
  for (const t of ['pier', 'archive', 'chapel', 'kiln']) paintBattleBG(c, t, f);
});
clean('the skeleton archivist, in full and as a portrait, mid-sentence and mid-blink', (c, f) => {
  assert.ok(FIGURES.calaca.skull);
  drawFigure(c, 'calaca', 250, 440, { frame: f, talk: f % 2 === 0, facing: -1 });
  drawFigure(c, 'calaca', 250, 440, { frame: f * 19, mood: 'ko' });
  drawPortrait(c, 'calaca', 80, 80, 40, { frame: f, talk: true });
});
clean('texture fill and contact shadow', (c, f) => {
  texFill(c, 0, 0, 100, 100, 0.4, 3, f);
  shadow(c, 100, 100, 30);
});

test('noir primitives are deterministic per frame (stop-motion, not random)', () => {
  const run = () => {
    const c = stubCtx();
    noir.papelPicado(c, 0, 20, 960, 50, 30, 9, { n: 12, seed: 3 });
    noir.sugarSkull(c, 300, 300, 30, 9, { seed: 2 });
    return c.calls.total;
  };
  assert.equal(run(), run());
});
