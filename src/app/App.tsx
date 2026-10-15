import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GAME_CONFIG } from '../config/gameConfig';
import jungleLogo from '../../assets/logo_jungle_gaming.svg?url';
import gameTitle from '../../assets/png/default/ui/menu/title_pirate_battle.png?url';
import { MatchCenter } from '../components/MatchCenter/MatchCenter';
import type { CompletedMatch } from '../game/types';
import { recordMatch } from '../services/matches/matchApi';
import {
  getPendingMatches,
  markMatchConfirmed,
  savePendingMatch,
} from '../services/matches/matchRepository';

const GameArena = lazy(() =>
  import('../components/GameArena/GameArena').then(({ GameArena: arena }) => ({ default: arena })),
);

type Screen = 'menu' | 'controls' | 'settings' | 'playing' | 'ranking' | 'history';
type GameOptions = { durationSeconds: number; spawnIntervalSeconds: number };

const OPTIONS_STORAGE_KEY = 'pirate-battle-options';
const MIN_DURATION_SECONDS = 60;
const MAX_DURATION_SECONDS = 180;
const MIN_SPAWN_INTERVAL_SECONDS = 1;
const MAX_SPAWN_INTERVAL_SECONDS = 12;

function loadOptions(): GameOptions {
  try {
    const saved = localStorage.getItem(OPTIONS_STORAGE_KEY);
    if (!saved) {
      return {
        durationSeconds: GAME_CONFIG.match.durationSeconds,
        spawnIntervalSeconds: GAME_CONFIG.enemies.spawnIntervalSeconds,
      };
    }

    const parsed: unknown = JSON.parse(saved);
    if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid options');
    const values = parsed as Record<string, unknown>;
    const durationSeconds = Number(values.durationSeconds);
    const spawnIntervalSeconds = Number(values.spawnIntervalSeconds);

    return {
      durationSeconds:
        Number.isFinite(durationSeconds) &&
        durationSeconds >= MIN_DURATION_SECONDS &&
        durationSeconds <= MAX_DURATION_SECONDS
          ? durationSeconds
          : GAME_CONFIG.match.durationSeconds,
      spawnIntervalSeconds:
        Number.isFinite(spawnIntervalSeconds) &&
        spawnIntervalSeconds >= MIN_SPAWN_INTERVAL_SECONDS &&
        spawnIntervalSeconds <= MAX_SPAWN_INTERVAL_SECONDS
          ? spawnIntervalSeconds
          : GAME_CONFIG.enemies.spawnIntervalSeconds,
    };
  } catch {
    return {
      durationSeconds: GAME_CONFIG.match.durationSeconds,
      spawnIntervalSeconds: GAME_CONFIG.enemies.spawnIntervalSeconds,
    };
  }
}

export function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const pageShellRef = useRef<HTMLElement>(null);
  const [isAppFullscreen, setIsAppFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const [options, setOptions] = useState<GameOptions>(loadOptions);
  const [matchSubmissionState, setMatchSubmissionState] = useState<
    'idle' | 'pending' | 'confirmed'
  >('idle');
  const [pendingMatchCount, setPendingMatchCount] = useState(() => getPendingMatches().length);
  const activeMatchId = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const { mutate: submitMatchResult } = useMutation({
    mutationFn: recordMatch,
    onSuccess: (record) => {
      markMatchConfirmed(record.id);
      setPendingMatchCount(getPendingMatches().length);
      if (activeMatchId.current === record.id) setMatchSubmissionState('confirmed');
      void queryClient.invalidateQueries({ queryKey: ['ranking'] });
      void queryClient.invalidateQueries({ queryKey: ['match-history'] });
    },
    onError: (_error, record) => {
      setPendingMatchCount(getPendingMatches().length);
      if (activeMatchId.current === record.id) setMatchSubmissionState('pending');
    },
  });

  useEffect(() => {
    getPendingMatches().forEach((match) => submitMatchResult(match));
  }, [submitMatchResult]);

  const handleMatchComplete = useCallback(
    (match: CompletedMatch) => {
      activeMatchId.current = match.id;
      setMatchSubmissionState('pending');
      savePendingMatch(match);
      setPendingMatchCount(getPendingMatches().length);
      submitMatchResult(match);
    },
    [submitMatchResult],
  );

  const retryPendingMatches = useCallback(() => {
    getPendingMatches().forEach((match) => submitMatchResult(match));
  }, [submitMatchResult]);

  const toggleAppFullscreen = useCallback(async () => {
    const pageShell = pageShellRef.current;
    if (!pageShell) return;

    setFullscreenError(null);
    try {
      if (document.fullscreenElement === pageShell) {
        await document.exitFullscreen();
      } else {
        if (document.fullscreenElement) await document.exitFullscreen();
        await pageShell.requestFullscreen();
      }
    } catch {
      setFullscreenError('Não foi possível alterar o modo de tela cheia neste navegador.');
    }
  }, []);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsAppFullscreen(document.fullscreenElement === pageShellRef.current);
    };

    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  const updateOption = (next: GameOptions) => {
    setOptions(next);
    try {
      localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // The selected values still apply to this session if storage is unavailable.
    }
  };

  return (
    <main ref={pageShellRef} className="page-shell">
      <header className="site-header">
        <a className="brand" href="#home" aria-label="Pirate Battle home">
          <img src={jungleLogo} alt="Jungle Gaming" />
        </a>
        <div className="site-header-actions">
          <span className="build-label">EDIÇÃO ARCADE</span>
          {screen !== 'playing' && (
            <button
              type="button"
              className="fullscreen-button"
              aria-label={isAppFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              aria-pressed={isAppFullscreen}
              onClick={() => void toggleAppFullscreen()}
            >
              {isAppFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            </button>
          )}
        </div>
      </header>
      {fullscreenError && (
        <p className="fullscreen-error" role="alert">
          {fullscreenError}
        </p>
      )}

      <section className="hero" id="home" aria-labelledby="page-title">
        <div className="hero-copy">
          <p className="eyebrow">JUNGLE GAMING · BATALHA NAVAL</p>
          <h1 id="page-title">Pirate Battle</h1>
          <p className="hero-description">
            Comande seu navio, desvie do fogo inimigo e sobreviva até o fim da batalha.
          </p>
        </div>
        <img className="hero-title-art" src={gameTitle} alt="" />
      </section>

      <div className="workspace-grid">
        {screen === 'playing' ? (
          <Suspense
            fallback={
              <p className="arena-loading" role="status">
                Preparing the game arena…
              </p>
            }
          >
            <GameArena
              durationSeconds={options.durationSeconds}
              spawnIntervalSeconds={options.spawnIntervalSeconds}
              onReturnToMenu={() => setScreen('menu')}
              onMatchComplete={handleMatchComplete}
              matchSubmissionState={matchSubmissionState}
              onRetryMatchSubmission={() => {
                const pending = getPendingMatches().find(
                  (match) => match.id === activeMatchId.current,
                );
                if (pending) submitMatchResult(pending);
              }}
            />
          </Suspense>
        ) : (
          <section className="main-menu-card" aria-labelledby="menu-heading">
            {screen === 'menu' && (
              <>
                <p className="section-kicker">JORNADA DO CAPITÃO</p>
                <h2 id="menu-heading">Menu principal</h2>
                <p className="menu-description">
                  Prepare seu navio e enfrente Chasers e Shooters em águas perigosas.
                </p>
                <div className="main-menu-actions">
                  <button
                    className="game-action-button menu-primary"
                    onClick={() => {
                      setMatchSubmissionState('idle');
                      setScreen('playing');
                    }}
                  >
                    Jogar
                  </button>
                  <button className="game-action-button" onClick={() => setScreen('controls')}>
                    Controles
                  </button>
                  <button className="game-action-button" onClick={() => setScreen('settings')}>
                    Configurações
                  </button>
                  <button className="game-action-button" onClick={() => setScreen('ranking')}>
                    Ranking
                  </button>
                  <button className="game-action-button" onClick={() => setScreen('history')}>
                    Histórico
                  </button>
                </div>
              </>
            )}

            {screen === 'controls' && (
              <div className="menu-subpage">
                <p className="section-kicker">GUIA DO CAPITÃO</p>
                <h2 id="menu-heading">Controles</h2>
                <ul className="control-instructions">
                  <li>
                    <span>Avançar</span>
                    <kbd>↑</kbd>
                    <kbd>W</kbd>
                  </li>
                  <li>
                    <span>Girar</span>
                    <kbd>←</kbd>
                    <kbd>A</kbd>
                    <kbd>→</kbd>
                    <kbd>D</kbd>
                  </li>
                  <li>
                    <span>Disparo frontal</span>
                    <kbd>Space</kbd>
                  </li>
                  <li>
                    <span>Disparo lateral esquerdo / direito</span>
                    <kbd>Q</kbd>
                    <kbd>E</kbd>
                  </li>
                  <li>
                    <span>Pausar / retomar</span>
                    <kbd>P</kbd>
                    <kbd>Esc</kbd>
                  </li>
                </ul>
                <p className="menu-description">
                  No celular, use os controles por toque abaixo da arena.
                </p>
                <button className="game-action-button" onClick={() => setScreen('menu')}>
                  Voltar ao menu
                </button>
              </div>
            )}

            {screen === 'settings' && (
              <div className="menu-subpage">
                <p className="section-kicker">AJUSTES DA PARTIDA</p>
                <h2 id="menu-heading">Configurações</h2>
                <div className="option-control">
                  <label htmlFor="match-duration">Duração da partida</label>
                  <output htmlFor="match-duration">{options.durationSeconds} segundos</output>
                  <input
                    id="match-duration"
                    type="range"
                    min={MIN_DURATION_SECONDS}
                    max={MAX_DURATION_SECONDS}
                    step="15"
                    value={options.durationSeconds}
                    onChange={(event) =>
                      updateOption({
                        ...options,
                        durationSeconds: Number(event.currentTarget.value),
                      })
                    }
                  />
                  <small>
                    Escolha de 60 a 180 segundos. A alteração vale para a próxima partida.
                  </small>
                </div>
                <div className="option-control">
                  <label htmlFor="spawn-interval">Intervalo de surgimento dos inimigos</label>
                  <output htmlFor="spawn-interval">{options.spawnIntervalSeconds} segundos</output>
                  <input
                    id="spawn-interval"
                    type="range"
                    min={MIN_SPAWN_INTERVAL_SECONDS}
                    max={MAX_SPAWN_INTERVAL_SECONDS}
                    step="1"
                    value={options.spawnIntervalSeconds}
                    onChange={(event) =>
                      updateOption({
                        ...options,
                        spawnIntervalSeconds: Number(event.currentTarget.value),
                      })
                    }
                  />
                  <small>Limites permitidos: 1 a 12 segundos.</small>
                </div>
                <button className="game-action-button" onClick={() => setScreen('menu')}>
                  Voltar ao menu
                </button>
              </div>
            )}

            {(screen === 'ranking' || screen === 'history') && (
              <div className="menu-subpage match-center-page">
                <MatchCenter
                  configuration={options}
                  tab={screen}
                  onTabChange={(tab) => setScreen(tab)}
                />
                <button className="game-action-button" onClick={() => setScreen('menu')}>
                  Voltar ao menu
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      {pendingMatchCount > 0 && screen !== 'playing' && (
        <aside className="pending-match-notice" role="status">
          <span>
            {pendingMatchCount === 1
              ? 'Há 1 resultado aguardando registro.'
              : `Há ${pendingMatchCount} resultados aguardando registro.`}
          </span>
          <button type="button" className="game-action-button" onClick={retryPendingMatches}>
            Tentar enviar novamente
          </button>
        </aside>
      )}

      <footer className="site-footer">
        <span>Jungle Gaming · Pirate Battle</span>
        <span>Navegue · sobreviva · vença</span>
      </footer>
    </main>
  );
}
