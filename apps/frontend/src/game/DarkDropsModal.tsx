import { useEffect, useRef, useState } from 'react';
import { createGame, gameToText, ROUND_SECONDS, stepGame, WORLD_HEIGHT, WORLD_WIDTH } from './engine';
import type { GameState } from './engine';
import { drawGame } from './draw';
import './game.css';

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (milliseconds: number) => void | Promise<void>;
  }
}

const BEST_KEY = 'do-we-stream-it.dark-drops.best';
const STEP = 1 / 60;

function readBest(): number {
  try {
    const value = Number(localStorage.getItem(BEST_KEY));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch { return 0; }
}

function snapshot(game: GameState) {
  return { mode: game.mode, lives: game.lives, score: game.score, seconds: Math.ceil(ROUND_SECONDS - game.elapsed) };
}

export function DarkDropsModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const gameRef = useRef<GameState | null>(null);
  if (!gameRef.current) gameRef.current = createGame();
  const keys = useRef(new Set<string>());
  const pointers = useRef(new Map<number, number>());
  const syncRef = useRef(() => {});
  const [hud, setHud] = useState(() => snapshot(gameRef.current!));
  const [best, setBest] = useState(readBest);
  const [fullscreenHint, setFullscreenHint] = useState('');

  function togglePlaying() {
    const game = gameRef.current!;
    if (game.mode === 'ready' || game.mode === 'won' || game.mode === 'lost') {
      gameRef.current = createGame();
      gameRef.current.mode = 'playing';
    } else {
      game.mode = game.mode === 'playing' ? 'paused' : 'playing';
    }
    keys.current.clear(); pointers.current.clear();
    syncRef.current();
    canvasRef.current?.focus();
  }

  function restart() {
    gameRef.current = createGame(); gameRef.current.mode = 'playing';
    keys.current.clear(); pointers.current.clear(); syncRef.current();
    canvasRef.current?.focus();
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (canvasRef.current?.requestFullscreen) await canvasRef.current.requestFullscreen();
      else setFullscreenHint('Vollbild ist in diesem Browser nicht verfügbar.');
    } catch { setFullscreenHint('Vollbild ist in diesem Browser nicht verfügbar.'); }
  }

  useEffect(() => {
    const dialog = dialogRef.current!;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    startRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const context = canvas.getContext('2d');
    if (!context) return;
    let frame = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    let manualTime = false;
    let lastHud = '';
    let bestScore = readBest();

    function sync() {
      const game = gameRef.current!;
      const next = snapshot(game);
      const serialized = JSON.stringify(next);
      if (serialized !== lastHud) { lastHud = serialized; setHud(next); }
      if ((game.mode === 'won' || game.mode === 'lost') && game.score > bestScore) {
        bestScore = game.score; setBest(bestScore);
        try { localStorage.setItem(BEST_KEY, String(bestScore)); } catch { /* Storage is optional. */ }
      }
      drawGame(context!, game);
    }

    function direction() {
      const left = keys.current.has('ArrowLeft') || keys.current.has('KeyA') || [...pointers.current.values()].includes(-1);
      const right = keys.current.has('ArrowRight') || keys.current.has('KeyD') || [...pointers.current.values()].includes(1);
      return Number(right) - Number(left);
    }

    function tick(now: number) {
      if (!manualTime) {
        accumulator += Math.min(Math.max((now - lastTime) / 1000, 0), 0.1);
        while (accumulator >= STEP) { stepGame(gameRef.current!, STEP, direction()); accumulator -= STEP; }
      }
      lastTime = now;
      sync();
      frame = requestAnimationFrame(tick);
    }

    const renderText = () => gameToText(gameRef.current!);
    const advanceTime = (milliseconds: number) => {
      if (!Number.isFinite(milliseconds) || milliseconds < 0 || milliseconds > 60_000) {
        throw new Error('advanceTime expects 0–60000 milliseconds.');
      }
      manualTime = true;
      let remaining = milliseconds / 1000;
      while (remaining > 1e-9) {
        const seconds = Math.min(STEP, remaining);
        stepGame(gameRef.current!, seconds, direction()); remaining -= seconds;
      }
      sync();
    };
    const previousText = window.render_game_to_text;
    const previousAdvance = window.advanceTime;
    window.render_game_to_text = renderText;
    window.advanceTime = advanceTime;
    syncRef.current = sync;
    sync(); frame = requestAnimationFrame(tick);

    function keydown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.code === 'Tab') {
        if (document.fullscreenElement === canvas) { event.preventDefault(); canvas.focus(); return; }
        const elements = [...dialogRef.current!.querySelectorAll<HTMLElement>('button:not(:disabled), canvas[tabindex]')];
        const index = elements.indexOf(document.activeElement as HTMLElement);
        if (event.shiftKey && index <= 0) { event.preventDefault(); elements.at(-1)?.focus(); }
        else if (!event.shiftKey && (index < 0 || index === elements.length - 1)) { event.preventDefault(); elements[0]?.focus(); }
      } else if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(event.code)) {
        event.preventDefault(); keys.current.add(event.code);
      } else if (!event.repeat) {
        if (event.code === 'Space' && !(event.target instanceof HTMLButtonElement)) {
          event.preventDefault(); togglePlaying();
        } else if (event.code === 'KeyP') {
          event.preventDefault();
          if (gameRef.current!.mode === 'playing' || gameRef.current!.mode === 'paused') togglePlaying();
        } else if (event.code === 'KeyR') { event.preventDefault(); restart(); }
        else if (event.code === 'KeyF') { event.preventDefault(); void toggleFullscreen(); }
      }
    }
    function keyup(event: KeyboardEvent) { keys.current.delete(event.code); }
    function pause() {
      keys.current.clear(); pointers.current.clear();
      if (gameRef.current!.mode === 'playing') { gameRef.current!.mode = 'paused'; sync(); }
    }
    function visibility() { if (document.hidden) pause(); }
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
    window.addEventListener('blur', pause); document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility);
      keys.current.clear(); pointers.current.clear(); syncRef.current = () => {};
      if (window.render_game_to_text === renderText) {
        if (previousText) window.render_game_to_text = previousText; else delete window.render_game_to_text;
      }
      if (window.advanceTime === advanceTime) {
        if (previousAdvance) window.advanceTime = previousAdvance; else delete window.advanceTime;
      }
    };
  }, []);

  const labels = { ready: 'Runde starten', playing: 'Pause', paused: 'Weiterspielen', won: 'Noch eine Runde', lost: 'Noch eine Runde' };
  const messages = {
    ready: 'Weiche den fallenden Drops aus. Überlebe 30 Sekunden mit drei Leben.',
    playing: 'Runde läuft. Bleib in Bewegung!', paused: 'Pause. Deine Runde wartet auf dich.',
    won: 'Geschafft! Du hast die Wüste überlebt.', lost: 'Keine Leben mehr. Versuch es noch einmal!',
  };

  return (
    <dialog ref={dialogRef} className="game-dialog" aria-labelledby="dark-drops-title"
      aria-describedby="dark-drops-instructions" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <header className="game-header">
        <div><p className="eyebrow">DESERT STRIKES · MINI GAME</p><h2 id="dark-drops-title">Dark Drops</h2></div>
        <button type="button" className="game-secondary" onClick={onClose} aria-label="Minigame schließen">Schließen ×</button>
      </header>
      <p id="dark-drops-instructions" className="game-description">30 Sekunden Wüste. Drei Leben. Ein Himmel voller Drops.</p>
      <div className="game-stats" aria-label="Spielstand">
        <span><strong>{hud.lives}</strong> Leben</span><span><strong>{hud.seconds}s</strong> verbleibend</span>
        <span><strong>{hud.score}</strong> Punkte</span><span><strong>{best}</strong> Rekord</span>
      </div>
      <canvas ref={canvasRef} width={WORLD_WIDTH} height={WORLD_HEIGHT} className="game-canvas" tabIndex={0}
        aria-label="Dark Drops Spielfeld. Mit Pfeiltasten oder A und D nach links und rechts bewegen.">
        Dein Browser unterstützt das Canvas-Spielfeld nicht.
      </canvas>
      <p className="game-message" role="status">{messages[hud.mode]}</p>
      <div className="game-actions">
        <button ref={startRef} id="dark-drops-start" type="button" onClick={togglePlaying}>{labels[hud.mode]}</button>
        <button type="button" className="game-secondary" onClick={restart}>Neustart</button>
        <button type="button" className="game-secondary" onClick={() => void toggleFullscreen()}>Vollbild ↗</button>
      </div>
      <div className="game-steering" aria-label="Touch-Steuerung">
        {([-1, 1] as const).map((direction) => (
          <button key={direction} type="button" aria-label={direction < 0 ? 'Nach links bewegen' : 'Nach rechts bewegen'}
            onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); pointers.current.set(event.pointerId, direction); }}
            onPointerUp={(event) => pointers.current.delete(event.pointerId)}
            onPointerCancel={(event) => pointers.current.delete(event.pointerId)}
            onLostPointerCapture={(event) => pointers.current.delete(event.pointerId)}
            onContextMenu={(event) => event.preventDefault()}>{direction < 0 ? '← Links halten' : 'Rechts halten →'}</button>
        ))}
      </div>
      <p className="game-help">← → / A D bewegen · Leertaste starten oder pausieren · P Pause · R Neustart · F Vollbild · Esc schließen</p>
      {fullscreenHint && <p className="game-help" role="status">{fullscreenHint}</p>}
    </dialog>
  );
}
