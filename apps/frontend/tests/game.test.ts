import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGame, gameToText, PLAYER_Y, ROUND_SECONDS, stepGame, WORLD_WIDTH, WORLD_HEIGHT } from '../src/game/engine.ts';

test('ready, paused and terminal rounds freeze the simulation', () => {
  for (const mode of ['ready', 'paused', 'won', 'lost'] as const) {
    const game = createGame(42); game.mode = mode;
    const before = structuredClone(game);
    stepGame(game, 1 / 60, 1);
    assert.deepEqual(game, before);
  }
});

test('movement stays inside both screen boundaries', () => {
  const game = createGame(42); game.mode = 'playing'; game.spawnIn = 100;
  for (let i = 0; i < 100; i++) stepGame(game, 1 / 60, -1);
  assert.equal(game.playerX, 28);
  for (let i = 0; i < 200; i++) stepGame(game, 1 / 60, 1);
  assert.equal(game.playerX, WORLD_WIDTH - 28);
});

test('hits remove the drop and temporary immunity prevents double damage', () => {
  const game = createGame(42); game.mode = 'playing'; game.spawnIn = 100;
  game.drops = [1, 2].map((id) => ({ id, x: game.playerX, y: PLAYER_Y, radius: 16, speed: 0 }));
  stepGame(game, 1 / 60, 0);
  assert.equal(game.lives, 2); assert.equal(game.drops.length, 1); assert.equal(game.invincible, 1);
  stepGame(game, 1 / 60, 0);
  assert.equal(game.lives, 2);
});

test('the third hit ends the round and the result stays stable', () => {
  const game = createGame(42); game.mode = 'playing'; game.spawnIn = 100;
  for (let id = 1; id <= 3; id++) {
    game.invincible = 0;
    game.drops = [{ id, x: game.playerX, y: PLAYER_Y, radius: 16, speed: 0 }];
    stepGame(game, 1 / 60, 0);
  }
  assert.equal(game.mode, 'lost'); assert.equal(game.lives, 0);
  const before = structuredClone(game); stepGame(game, 1 / 60, 1); assert.deepEqual(game, before);
});

test('clearing a drop scores once; near misses do not cost a life', () => {
  const game = createGame(42); game.mode = 'playing'; game.spawnIn = 100;
  game.drops = [{ id: 1, x: game.playerX + 40, y: PLAYER_Y, radius: 16, speed: 0 },
    { id: 2, x: 24, y: WORLD_HEIGHT + 20, radius: 16, speed: 0 }];
  stepGame(game, 1 / 60, 0);
  assert.equal(game.lives, 3); assert.equal(game.score, 10); assert.equal(game.dodged, 1);
  stepGame(game, 1 / 60, 0); assert.equal(game.score, 10);
});

test('surviving thirty seconds wins and grants the bonus once', () => {
  const game = createGame(42); game.mode = 'playing'; game.spawnIn = 100;
  for (let i = 0; i < 1801; i++) stepGame(game, 1 / 60, 0);
  assert.equal(game.mode, 'won'); assert.equal(game.elapsed, ROUND_SECONDS); assert.equal(game.score, 175);
  stepGame(game, 1 / 60, 0); assert.equal(game.score, 175);
});

test('the same seed and inputs produce the same drops and game state', () => {
  const first = createGame(42); const second = createGame(42);
  first.mode = second.mode = 'playing';
  for (let i = 0; i < 120; i++) {
    stepGame(first, 1 / 60, i < 30 ? 1 : 0); stepGame(second, 1 / 60, i < 30 ? 1 : 0);
  }
  assert.deepEqual(first, second); assert.ok(first.drops.length > 0);
  const text = JSON.parse(gameToText(first));
  assert.equal(text.mode, first.mode); assert.equal(text.lives, first.lives); assert.match(text.coordinates, /top-left/);
});

test('invalid time steps and input cannot corrupt state', () => {
  const game = createGame(42); game.mode = 'playing';
  const before = structuredClone(game);
  for (const seconds of [-1, NaN, Infinity, 0.1]) assert.throws(() => stepGame(game, seconds, 0));
  assert.throws(() => stepGame(game, 1 / 60, NaN)); assert.deepEqual(game, before);
});
