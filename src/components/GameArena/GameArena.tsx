import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Application, Assets, Texture } from 'pixi.js';
import { GAME_CONFIG } from '../../config/gameConfig';
import { createGameRuntime } from '../../game/gameRuntime';
import { formatTime } from '../../game/gameMath';
import type { CompletedMatch, GameHudSnapshot } from '../../game/types';
import playerShipAsset from '../../../assets/png/default/ships/ship_1.png?url';
import chaserShipAsset from '../../../assets/png/default/ships/ship_2.png?url';
import shooterShipAsset from '../../../assets/png/default/ships/ship_3.png?url';
import islandAsset from '../../../assets/png/default/tiles/tile_85.png?url';
import islandSecondAsset from '../../../assets/png/default/tiles/tile_86.png?url';
import waterAsset from '../../../assets/png/default/tiles/tile_73.png?url';
import cannonBallAsset from '../../../assets/png/default/ship_parts/cannon_ball.png?url';
import explosionAsset from '../../../assets/png/default/effects/explosion_1.png?url';
import heartIcon from '../../../assets/png/default/ui/hud/icon_heart.png?url';
import scoreIcon from '../../../assets/png/default/ui/hud/icon_score.png?url';
import timeIcon from '../../../assets/png/default/ui/hud/icon_time.png?url';
import counterPanel from '../../../assets/png/default/ui/hud/counter_panel.png?url';
import forwardIcon from '../../../assets/png/default/ui/controls/icon_forward.png?url';
import turnLeftIcon from '../../../assets/png/default/ui/controls/icon_turn_left.png?url';
import turnRightIcon from '../../../assets/png/default/ui/controls/icon_turn_right.png?url';
import fireFrontIcon from '../../../assets/png/default/ui/controls/icon_fire_front.png?url';
import fireLeftIcon from '../../../assets/png/default/ui/controls/icon_fire_left.png?url';
import fireRightIcon from '../../../assets/png/default/ui/controls/icon_fire_right.png?url';
import pauseIcon from '../../../assets/png/default/ui/controls/icon_pause.png?url';
import playIcon from '../../../assets/png/default/ui/controls/icon_play.png?url';
import restartIcon from '../../../assets/png/default/ui/controls/icon_restart.png?url';

type GameArenaProps = {
  durationSeconds?: number;
  spawnIntervalSeconds?: number;
  onReturnToMenu?: () => void;
  onMatchComplete?: (match: CompletedMatch) => void;
  matchSubmissionState?: 'idle' | 'pending' | 'confirmed';
  onRetryMatchSubmission?: () => void;
};

export function GameArena({
  durationSeconds = GAME_CONFIG.match.durationSeconds,
  spawnIntervalSeconds = GAME_CONFIG.enemies.spawnIntervalSeconds,
  onReturnToMenu,
  onMatchComplete,
  matchSubmissionState = 'idle',
  onRetryMatchSubmission,
}: GameArenaProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLElement>(null);
  const fullscreenMountedRef = useRef(false);
  const runtimeRef = useRef<ReturnType<typeof createGameRuntime> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [gameSession, setGameSession] = useState(0);
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [completedMatch, setCompletedMatch] = useState<CompletedMatch | null>(null);
  const [hud, setHud] = useState<GameHudSnapshot | null>(null);
  const [gameState, setGameState] = useState<
    'loading' | 'playing' | 'paused' | 'gameOver' | 'error'
  >('loading');

  const setVirtualKey = useCallback((code: string, pressed: boolean) => {
    runtimeRef.current?.setVirtualKey(code, pressed);
  }, []);

  const handleMatchComplete = useCallback(
    (match: CompletedMatch) => {
      setCompletedMatch(match);
      onMatchComplete?.(match);
    },
    [onMatchComplete],
  );

  const virtualKeyHandlers = (code: string) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (typeof event.currentTarget.setPointerCapture === 'function') {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      setVirtualKey(code, true);
    },
    onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
      setVirtualKey(code, false);
      if (typeof event.currentTarget.releasePointerCapture === 'function') {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    onPointerCancel: () => setVirtualKey(code, false),
    onLostPointerCapture: () => setVirtualKey(code, false),
    onBlur: () => setVirtualKey(code, false),
  });

  useEffect(() => {
    fullscreenMountedRef.current = true;

    const syncFullscreenState = () => {
      const fullscreenElement = document.fullscreenElement;
      const arena = fullscreenRef.current;
      setIsFullscreen(Boolean(arena && fullscreenElement === arena));
      setFullscreenError(null);
    };

    document.addEventListener('fullscreenchange', syncFullscreenState);
    syncFullscreenState();
    return () => {
      fullscreenMountedRef.current = false;
      document.removeEventListener('fullscreenchange', syncFullscreenState);
    };
  }, []);

  const toggleFullscreen = async () => {
    const arena = fullscreenRef.current;
    if (!arena) return;

    setFullscreenError(null);
    try {
      const fullscreenElement = document.fullscreenElement;
      if (fullscreenElement === arena) {
        await document.exitFullscreen();
      } else {
        await arena.requestFullscreen();
      }
    } catch {
      if (fullscreenMountedRef.current) {
        setFullscreenError(
          document.fullscreenElement === arena
            ? 'Não foi possível sair da tela cheia.'
            : 'Não foi possível entrar em tela cheia neste navegador.',
        );
      }
    }
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    let app: Application | undefined;
    let appDestroyed = false;
    let runtime: ReturnType<typeof createGameRuntime> | undefined;

    const destroyApp = () => {
      if (!app || appDestroyed) return;
      appDestroyed = true;
      app.destroy(true, { children: true });
    };

    const initialize = async () => {
      try {
        const [
          playerShip,
          chaserShip,
          shooterShip,
          island,
          secondIsland,
          water,
          cannonBall,
          explosion,
        ] = await Promise.all([
          Assets.load<Texture>(playerShipAsset),
          Assets.load<Texture>(chaserShipAsset),
          Assets.load<Texture>(shooterShipAsset),
          Assets.load<Texture>(islandAsset),
          Assets.load<Texture>(islandSecondAsset),
          Assets.load<Texture>(waterAsset),
          Assets.load<Texture>(cannonBallAsset),
          Assets.load<Texture>(explosionAsset),
        ]);
        if (cancelled) return;

        app = new Application();
        await app.init({
          width: Math.max(host.clientWidth, 1),
          height: Math.max(host.clientHeight, 1),
          background: '#0a3549',
          antialias: true,
          autoDensity: true,
          autoStart: false,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          preference: 'webgl',
        });
        if (cancelled) {
          destroyApp();
          return;
        }

        setGameState('playing');

        app.canvas.setAttribute('aria-label', 'Pirate Battle game arena');
        app.canvas.className = 'arena-canvas';
        host.appendChild(app.canvas);

        runtime = createGameRuntime(
          app,
          host,
          { player: playerShip, chaser: chaserShip, shooter: shooterShip },
          [island, secondIsland],
          water,
          cannonBall,
          explosion,
          {
            isCancelled: () => cancelled,
            onHudChange: setHud,
            setGameState,
            setGameResult,
            onMatchComplete: handleMatchComplete,
            durationSeconds,
            spawnIntervalSeconds,
          },
        );
        runtimeRef.current = runtime;
        resizeObserver = new ResizeObserver(runtime.resize);
        resizeObserver.observe(host);
        runtime.resize();
        setIsReady(true);
      } catch (error: unknown) {
        if (!cancelled) {
          const detail = error instanceof Error ? error.message : 'Unknown rendering error';
          setGameState('error');
          setErrorMessage(`The game arena could not be initialized. ${detail}`);
        }
        runtime?.dispose();
        runtime = undefined;
        runtimeRef.current = null;
        resizeObserver?.disconnect();
        resizeObserver = undefined;
        if (app && host.contains(app.canvas)) host.removeChild(app.canvas);
        destroyApp();
      }
    };

    void initialize();

    return () => {
      cancelled = true;
      runtime?.dispose();
      runtimeRef.current = null;
      resizeObserver?.disconnect();
      if (app && host.contains(app.canvas)) host.removeChild(app.canvas);
      destroyApp();
    };
  }, [durationSeconds, gameSession, handleMatchComplete, spawnIntervalSeconds]);

  return (
    <section
      className="arena-card"
      aria-labelledby="arena-heading"
      ref={fullscreenRef}
      data-testid="arena-container"
    >
      <div className="arena-heading-row">
        <div>
          <div className="section-kicker">PIRATE BATTLE</div>
          <h2 id="arena-heading">Game arena</h2>
        </div>
        <p className="visually-hidden" role="status" aria-live="polite" data-testid="game-state">
          {gameState}
        </p>
        <div className="arena-heading-actions">
          <span className={`render-badge${isReady ? ' is-ready' : ''}`} role="status">
            <span className="status-indicator" aria-hidden="true" />
            {isReady ? 'PixiJS ready' : errorMessage ? 'Needs attention' : 'Loading assets'}
          </span>
          <button
            className="fullscreen-button"
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          </button>
        </div>
      </div>
      {fullscreenError && (
        <p className="fullscreen-error" role="alert">
          {fullscreenError}
        </p>
      )}
      <div className="arena-frame" ref={hostRef}>
        {!isReady && !errorMessage && <p className="arena-message">Loading the game arena…</p>}
        {errorMessage && (
          <p className="arena-message status-error" role="alert">
            {errorMessage}
          </p>
        )}
        {isReady && hud && (
          <div className="game-hud" aria-label="Informações da partida" data-testid="game-hud">
            <img className="game-hud-panel" src={counterPanel} alt="" aria-hidden="true" />
            <div className="game-hud-stat" role="group" aria-label="Vida do jogador">
              <img src={heartIcon} alt="" aria-hidden="true" />
              <output data-testid="hud-health" aria-label="Vida do jogador">
                {hud.playerHealth}
              </output>
            </div>
            <div className="game-hud-stat" role="group" aria-label="Pontuação">
              <img src={scoreIcon} alt="" aria-hidden="true" />
              <output data-testid="hud-score" aria-label="Pontuação">
                {hud.score}
              </output>
            </div>
            <div className="game-hud-stat" role="group" aria-label="Tempo restante">
              <img src={timeIcon} alt="" aria-hidden="true" />
              <output data-testid="hud-time" aria-label="Tempo restante">
                {formatTime(hud.remainingSeconds)}
              </output>
            </div>
          </div>
        )}
        {gameState === 'paused' && (
          <div className="arena-paused-overlay" role="status">
            <div className="game-state-panel">
              <strong>Partida pausada</strong>
              <span>A batalha aguarda seu retorno.</span>
              <button
                className="game-action-button"
                type="button"
                onClick={() => runtimeRef.current?.resume()}
              >
                <img src={playIcon} alt="" aria-hidden="true" />
                Continuar
              </button>
              <small>ou pressione P / Esc</small>
            </div>
          </div>
        )}
      </div>
      {gameResult && (
        <div className="game-result-actions" role="status">
          <div className="game-result-copy">
            <p>{gameResult === 'TIME UP' ? 'Tempo esgotado!' : 'Fim de jogo!'}</p>
            <span>Pontuação final: {hud?.score ?? 0}</span>
            {completedMatch && (
              <span>
                Tempo jogado: {Math.floor(completedMatch.durationPlayedSeconds)}s ·{' '}
                {completedMatch.endReason === 'time' ? 'tempo esgotado' : 'vida esgotada'}
              </span>
            )}
            <span role="status" data-testid="match-submission-status">
              {matchSubmissionState === 'confirmed'
                ? 'Resultado registrado'
                : matchSubmissionState === 'pending'
                  ? 'Registro pendente — será enviado quando a conexão voltar.'
                  : 'Salvando resultado…'}
            </span>
            {matchSubmissionState === 'pending' && onRetryMatchSubmission && (
              <button type="button" className="game-action-button" onClick={onRetryMatchSubmission}>
                Tentar registrar novamente
              </button>
            )}
          </div>

          <div className="game-result-buttons">
            <button
              type="button"
              onClick={() => {
                setGameResult(null);
                setCompletedMatch(null);
                setErrorMessage(null);
                setIsReady(false);
                setHud(null);
                setGameState('loading');
                setGameSession((current) => current + 1);
              }}
              className="game-action-button"
            >
              <img src={restartIcon} alt="" aria-hidden="true" />
              Jogar novamente
            </button>
            <button
              type="button"
              onClick={onReturnToMenu}
              className="game-action-button"
              disabled={!onReturnToMenu}
            >
              Voltar ao menu
            </button>
          </div>
        </div>
      )}
      <div className="arena-controls" aria-label="Controles do jogo">
        <span className="control-hint">
          <img src={forwardIcon} alt="" /> <kbd>↑</kbd> / <kbd>W</kbd> mover
        </span>
        <span className="control-hint">
          <img src={turnLeftIcon} alt="" />
          <img src={turnRightIcon} alt="" /> <kbd>←/A</kbd> <kbd>→/D</kbd> girar
        </span>
        <span className="control-hint">
          <img src={fireFrontIcon} alt="" /> <kbd>Space</kbd> disparar
        </span>
        <span className="control-hint">
          <img src={fireLeftIcon} alt="" />
          <img src={fireRightIcon} alt="" /> <kbd>Q</kbd> / <kbd>E</kbd> laterais
        </span>
        <span className="control-hint">
          <img src={pauseIcon} alt="" /> <kbd>P</kbd> / <kbd>Esc</kbd> pausar
        </span>
      </div>
      <div className="touch-controls" aria-label="Controles por toque">
        <div className="touch-control-row">
          <button
            type="button"
            aria-label="Virar à esquerda"
            disabled={!isReady || gameState !== 'playing'}
            {...virtualKeyHandlers('ArrowLeft')}
          >
            <img src={turnLeftIcon} alt="" />
          </button>
          <button
            type="button"
            aria-label="Mover para frente"
            disabled={!isReady || gameState !== 'playing'}
            {...virtualKeyHandlers('ArrowUp')}
          >
            <img src={forwardIcon} alt="" />
          </button>
          <button
            type="button"
            aria-label="Virar à direita"
            disabled={!isReady || gameState !== 'playing'}
            {...virtualKeyHandlers('ArrowRight')}
          >
            <img src={turnRightIcon} alt="" />
          </button>
        </div>
        <div className="touch-control-row">
          <button
            type="button"
            aria-label="Disparar à esquerda"
            disabled={!isReady || gameState !== 'playing'}
            {...virtualKeyHandlers('KeyQ')}
          >
            <img src={fireLeftIcon} alt="" />
          </button>
          <button
            type="button"
            aria-label="Disparar à frente"
            disabled={!isReady || gameState !== 'playing'}
            {...virtualKeyHandlers('Space')}
          >
            <img src={fireFrontIcon} alt="" />
          </button>
          <button
            type="button"
            aria-label="Disparar à direita"
            disabled={!isReady || gameState !== 'playing'}
            {...virtualKeyHandlers('KeyE')}
          >
            <img src={fireRightIcon} alt="" />
          </button>
        </div>
        <button
          className="touch-pause-button"
          type="button"
          aria-label={gameState === 'paused' ? 'Retomar partida' : 'Pausar partida'}
          disabled={!isReady || gameState === 'gameOver'}
          onClick={() => runtimeRef.current?.togglePause()}
        >
          <img src={gameState === 'paused' ? playIcon : pauseIcon} alt="" />
          {gameState === 'paused' ? 'Retomar' : 'Pausar'}
        </button>
      </div>
    </section>
  );
}
