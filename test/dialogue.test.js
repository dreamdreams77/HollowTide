import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';

test('spoken dialogue replaces dash punctuation with natural pauses', () => {
  const game = new Game();
  game.say('marl', 'Wait — listen - the tide changed.');
  assert.equal(game.dialogue.text, 'Wait, listen, the tide changed.');
  assert.doesNotMatch(game.dialogue.text, /[—–]/);
  assert.doesNotMatch(game.dialogue.text, /\s-\s/);
});
