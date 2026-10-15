import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../../src/app/App';

const matchMocks = vi.hoisted(() => ({ recordMatch: vi.fn() }));
vi.mock('../../src/services/matches/matchApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/matches/matchApi')>()),
  recordMatch: matchMocks.recordMatch,
}));

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

vi.mock('../../src/components/ApiStatus/ApiStatus', () => ({
  ApiStatus: () => <aside>API status</aside>,
}));

vi.mock('../../src/components/GameArena/GameArena', () => ({
  GameArena: ({
    durationSeconds,
    spawnIntervalSeconds,
    onReturnToMenu,
    onMatchComplete,
  }: {
    durationSeconds: number;
    spawnIntervalSeconds: number;
    onReturnToMenu: () => void;
    onMatchComplete: (match: import('../../src/game/types').CompletedMatch) => void;
  }) => (
    <section aria-label="Active game">
      <output data-testid="session-duration">{durationSeconds}</output>
      <output data-testid="session-spawn-interval">{spawnIntervalSeconds}</output>
      <button onClick={onReturnToMenu}>Voltar ao menu</button>
      <button
        onClick={() =>
          onMatchComplete({
            id: 'app-match-1',
            playerId: 'local-captain',
            completedAt: '2026-10-15T12:00:00.000Z',
            score: 2,
            configuredDurationSeconds: 60,
            durationPlayedSeconds: 35,
            endReason: 'player-defeated',
            configuration: { durationSeconds: 60, spawnIntervalSeconds: 4 },
          })
        }
      >
        Complete match
      </button>
    </section>
  ),
}));

afterEach(() => localStorage.clear());

describe('main menu', () => {
  it('opens in the menu without mounting the game runtime', () => {
    renderApp();

    expect(screen.getByRole('heading', { name: 'Menu principal' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Jogar' })).toBeVisible();
    expect(screen.queryByLabelText('Active game')).not.toBeInTheDocument();
  });

  it('opens and closes the controls panel with implemented bindings', () => {
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Controles' }));
    expect(screen.getByRole('heading', { name: 'Controles' })).toBeVisible();
    expect(screen.getByText('Disparo lateral esquerdo / direito')).toBeVisible();
    expect(screen.getByText('Pausar / retomar')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao menu' }));
    expect(screen.getByRole('heading', { name: 'Menu principal' })).toBeVisible();
  });

  it('persists validated settings and passes a snapshot to a new session', async () => {
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Configurações' }));
    const duration = screen.getByLabelText('Duração da partida');
    const spawnInterval = screen.getByLabelText('Intervalo de surgimento dos inimigos');
    fireEvent.change(duration, { target: { value: '120' } });
    fireEvent.change(spawnInterval, { target: { value: '3' } });

    expect(JSON.parse(localStorage.getItem('pirate-battle-options') ?? '{}')).toEqual({
      durationSeconds: 120,
      spawnIntervalSeconds: 3,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jogar' }));
    expect(await screen.findByTestId('session-duration')).toHaveTextContent('120');
    expect(screen.getByTestId('session-spawn-interval')).toHaveTextContent('3');
  });

  it('returns from a session to the menu without reloading the page', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Jogar' }));
    await screen.findByLabelText('Active game');
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao menu' }));

    expect(screen.getByRole('heading', { name: 'Menu principal' })).toBeVisible();
    expect(screen.queryByLabelText('Active game')).not.toBeInTheDocument();
  });

  it('stores a completed match once and confirms the outbox after the API accepts it', async () => {
    matchMocks.recordMatch.mockImplementation(async (match) => ({
      ...match,
      submissionState: 'confirmed',
    }));
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Jogar' }));
    await screen.findByLabelText('Active game');
    fireEvent.click(screen.getByRole('button', { name: 'Complete match' }));

    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem('pirate-battle-match-records') ?? '[]')[0].submissionState,
      ).toBe('confirmed'),
    );
    expect(matchMocks.recordMatch).toHaveBeenCalledTimes(1);
  });

  it('keeps a retry action available after leaving a result with a pending submission', async () => {
    matchMocks.recordMatch
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(async (match) => ({ ...match, submissionState: 'confirmed' }));
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Jogar' }));
    await screen.findByLabelText('Active game');
    fireEvent.click(screen.getByRole('button', { name: 'Complete match' }));
    await screen.findByRole('button', { name: 'Voltar ao menu' });
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao menu' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Tentar enviar novamente' }));
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem('pirate-battle-match-records') ?? '[]')[0].submissionState,
      ).toBe('confirmed'),
    );
    expect(matchMocks.recordMatch).toHaveBeenCalledTimes(2);
  });
});
