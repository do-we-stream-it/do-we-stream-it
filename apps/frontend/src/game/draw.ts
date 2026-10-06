import { PLAYER_HEIGHT, PLAYER_WIDTH, PLAYER_Y, ROUND_SECONDS, WORLD_HEIGHT, WORLD_WIDTH } from './engine';
import type { GameState } from './engine';

export function drawGame(ctx: CanvasRenderingContext2D, state: GameState): void {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, '#11182d'); sky.addColorStop(0.6, '#563448'); sky.addColorStop(1, '#dd925b');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  for (let i = 0; i < 35; i++) {
    ctx.fillStyle = i % 3 === 0 ? '#e8d4b5' : '#8f92b0';
    ctx.fillRect((i * 157 + 53) % WORLD_WIDTH, (i * 43 + 24) % 170, i % 3 === 0 ? 2 : 1, 2);
  }
  ctx.fillStyle = '#f9bc7a'; ctx.beginPath(); ctx.arc(558, 155, 49, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#754250'; ctx.beginPath(); ctx.moveTo(0, 266);
  ctx.bezierCurveTo(145, 140, 222, 321, 390, 235);
  ctx.bezierCurveTo(510, 170, 630, 225, 720, 196);
  ctx.lineTo(720, 400); ctx.lineTo(0, 400); ctx.fill();
  ctx.fillStyle = '#a76750'; ctx.beginPath(); ctx.moveTo(0, 282);
  ctx.bezierCurveTo(180, 325, 265, 213, 440, 281);
  ctx.bezierCurveTo(563, 336, 630, 267, 720, 289);
  ctx.lineTo(720, 400); ctx.lineTo(0, 400); ctx.fill();
  ctx.fillStyle = '#d39164'; ctx.beginPath(); ctx.moveTo(0, 370);
  ctx.bezierCurveTo(220, 287, 480, 396, 720, 339);
  ctx.lineTo(720, 400); ctx.lineTo(0, 400); ctx.fill();
  ctx.strokeStyle = '#efb985'; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath(); ctx.moveTo(i * 164, 381); ctx.lineTo(i * 164 + 70, 378); ctx.stroke();
  }

  for (const drop of state.drops) {
    ctx.fillStyle = '#d5a5ff55';
    ctx.beginPath(); ctx.moveTo(drop.x - drop.radius / 2, drop.y);
    ctx.lineTo(drop.x, drop.y - drop.radius * 3); ctx.lineTo(drop.x + drop.radius / 2, drop.y); ctx.fill();
    ctx.fillStyle = '#171b33'; ctx.strokeStyle = '#c9a1ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9a1ff'; ctx.beginPath(); ctx.arc(drop.x - 3, drop.y - 4, 2, 0, Math.PI * 2); ctx.fill();
  }

  ctx.save();
  ctx.globalAlpha = state.invincible > 0 && Math.floor(state.invincible * 12) % 2 === 0 ? 0.45 : 1;
  ctx.fillStyle = '#211d30';
  ctx.beginPath(); ctx.ellipse(state.playerX, PLAYER_Y + 18, 30, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffcb7b'; ctx.strokeStyle = '#392333'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(state.playerX - PLAYER_WIDTH / 2, PLAYER_Y + PLAYER_HEIGHT / 2);
  ctx.lineTo(state.playerX - 12, PLAYER_Y - 4); ctx.lineTo(state.playerX + 10, PLAYER_Y - PLAYER_HEIGHT / 2);
  ctx.lineTo(state.playerX + PLAYER_WIDTH / 2, PLAYER_Y + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#6bc5d8'; ctx.fillRect(state.playerX - 7, PLAYER_Y - 5, 10, 6);
  ctx.fillStyle = '#603841'; ctx.fillRect(state.playerX - 14, PLAYER_Y + 10, 10, 6); ctx.fillRect(state.playerX + 9, PLAYER_Y + 10, 10, 6);
  ctx.restore();

  // Also visible when the canvas is fullscreen.
  ctx.font = '600 14px system-ui'; ctx.fillStyle = '#f8e8da';
  ctx.fillText(`DARK DROPS  /  ${state.score} PUNKTE`, 22, 28);
  ctx.textAlign = 'right'; ctx.fillText(`${state.lives} LEBEN  ·  ${Math.ceil(ROUND_SECONDS - state.elapsed)}s`, WORLD_WIDTH - 22, 28); ctx.textAlign = 'left';

  if (state.mode !== 'playing') {
    ctx.fillStyle = '#11182dcc'; ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffcb7b'; ctx.font = '700 38px system-ui';
    const titles = { ready: 'Die Wüste wartet.', paused: 'Kurz durchatmen.', won: 'Wüste gemeistert!', lost: 'Vom Himmel erwischt.' };
    ctx.fillText(titles[state.mode], WORLD_WIDTH / 2, 173);
    ctx.fillStyle = '#f8e8da'; ctx.font = '17px system-ui';
    const subtitles = {
      ready: 'Weiche den Drops aus. Überlebe 30 Sekunden.',
      paused: 'Mit P oder dem Button weiterfliegen.',
      won: `${state.score} Punkte. Bereit für die nächste Runde?`,
      lost: `${state.score} Punkte. Die nächste Runde gehört dir.`,
    };
    ctx.fillText(subtitles[state.mode], WORLD_WIDTH / 2, 209);
    ctx.font = '13px system-ui'; ctx.fillStyle = '#d5bdd7';
    ctx.fillText('← → / A D bewegen   ·   Leertaste starten / pausieren   ·   R Neustart', WORLD_WIDTH / 2, 247);
    ctx.textAlign = 'left';
  }
}
