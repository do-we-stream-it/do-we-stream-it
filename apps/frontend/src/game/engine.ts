export const WORLD_WIDTH = 720;
export const WORLD_HEIGHT = 400;
export const ROUND_SECONDS = 30;
export const PLAYER_Y = 344;
export const PLAYER_WIDTH = 40;
export const PLAYER_HEIGHT = 22;

export type GameMode = 'ready' | 'playing' | 'paused' | 'won' | 'lost';

export interface Drop {
  id: number;
  x: number;
  y: number;
  radius: number;
  speed: number;
}

export interface GameState {
  mode: GameMode;
  elapsed: number;
  playerX: number;
  lives: number;
  score: number;
  dodged: number;
  invincible: number;
  spawnIn: number;
  drops: Drop[];
  seed: number;
  nextDropId: number;
}

export function createGame(seed = Math.floor(Math.random() * 0xffffffff)): GameState {
  return {
    mode: 'ready', elapsed: 0, playerX: WORLD_WIDTH / 2, lives: 3,
    score: 0, dodged: 0, invincible: 0, spawnIn: 0.65, drops: [],
    seed: (seed >>> 0) || 1, nextDropId: 1,
  };
}

function random(state: GameState): number {
  let value = state.seed;
  value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
  state.seed = value >>> 0;
  return state.seed / 0x100000000;
}

function collides(state: GameState, drop: Drop): boolean {
  const dx = Math.max(Math.abs(drop.x - state.playerX) - PLAYER_WIDTH / 2, 0);
  const dy = Math.max(Math.abs(drop.y - PLAYER_Y) - PLAYER_HEIGHT / 2, 0);
  return dx * dx + dy * dy < drop.radius * drop.radius;
}

export function stepGame(state: GameState, seconds: number, direction: number): void {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 0.05 || !Number.isFinite(direction)) {
    throw new Error('Game updates require a finite step between 0 and 0.05 seconds.');
  }
  if (state.mode !== 'playing') return;
  state.elapsed = Math.min(ROUND_SECONDS, state.elapsed + seconds);
  state.invincible = Math.max(0, state.invincible - seconds);
  state.playerX = Math.max(PLAYER_WIDTH / 2 + 8,
    Math.min(WORLD_WIDTH - PLAYER_WIDTH / 2 - 8, state.playerX + Math.sign(direction) * 340 * seconds));
  state.spawnIn -= seconds;
  if (state.spawnIn <= 0) {
    const radius = 12 + random(state) * 7;
    state.drops.push({
      id: state.nextDropId++, x: 24 + random(state) * (WORLD_WIDTH - 48),
      y: -radius, radius, speed: 145 + state.elapsed * 4 + random(state) * 65,
    });
    state.spawnIn += 0.7 - state.elapsed / ROUND_SECONDS * 0.28;
  }

  const remaining: Drop[] = [];
  for (const drop of state.drops) {
    drop.y += drop.speed * seconds;
    if (state.invincible === 0 && collides(state, drop)) {
      state.lives--;
      state.invincible = 1;
      if (state.lives <= 0) state.mode = 'lost';
    } else if (drop.y - drop.radius > WORLD_HEIGHT) {
      state.dodged++;
      state.score += 10;
    } else {
      remaining.push(drop);
    }
  }
  state.drops = remaining;
  if (state.mode === 'playing' && state.elapsed >= ROUND_SECONDS) {
    state.mode = 'won';
    state.score += 100 + state.lives * 25;
  }
}

export function gameToText(state: GameState): string {
  return JSON.stringify({
    mode: state.mode,
    coordinates: 'Origin top-left; x right, y down; world 720 × 400.',
    player: { x: Math.round(state.playerX), y: PLAYER_Y, width: PLAYER_WIDTH, height: PLAYER_HEIGHT },
    lives: state.lives, score: state.score, dodged: state.dodged,
    secondsRemaining: Math.max(0, ROUND_SECONDS - state.elapsed),
    invincible: state.invincible,
    drops: state.drops.map(({ id, x, y, radius, speed }) => ({ id, x, y, radius, speed })),
  });
}
