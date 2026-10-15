import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ fetchRanking: vi.fn(), fetchMatchHistory: vi.fn() }));
vi.mock('../../src/services/matches/matchApi', () => ({
  fetchRanking: api.fetchRanking,
  fetchMatchHistory: api.fetchMatchHistory,
  matchQueryKeys: {
    ranking: (page: number) => ['ranking', page],
    history: (page: number, player: string) => ['history', player, page],
  },
}));
vi.mock('../../src/services/matches/matchRepository', () => ({
  clearLocalMatches: vi.fn(),
  getNetworkScenario: () => 'success',
  setNetworkScenario: vi.fn(),
}));
vi.mock('../../src/services/api/httpClient', () => ({ httpClient: { post: vi.fn() } }));

import { MatchCenter } from '../../src/components/MatchCenter/MatchCenter';

function renderCenter(tab: 'ranking' | 'history' = 'ranking') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MatchCenter
        configuration={{ durationSeconds: 60, spawnIntervalSeconds: 4 }}
        tab={tab}
        onTabChange={() => undefined}
      />
    </QueryClientProvider>,
  );
}

describe('ranking and match history screens', () => {
  it('shows sorted, paginated ranking results from the query layer', async () => {
    api.fetchRanking.mockResolvedValue({
      items: [
        {
          playerId: 'ada',
          playerName: 'Ada',
          score: 4,
          completedAt: '2026-10-15T10:00:00Z',
          configuration: { durationSeconds: 60, spawnIntervalSeconds: 4 },
        },
      ],
      page: 1,
      pageSize: 5,
      total: 6,
    });
    renderCenter();

    expect(await screen.findByText('Ada')).toBeVisible();
    expect(screen.getByText('4 pts')).toBeVisible();
    expect(screen.getByText('Página 1 de 2')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeEnabled();
  });

  it('shows empty history', async () => {
    api.fetchMatchHistory.mockResolvedValue({ items: [], page: 1, pageSize: 5, total: 0 });
    renderCenter('history');
    expect(await screen.findByText('Nenhuma partida registrada nesta página.')).toBeVisible();
  });

  it('shows a recoverable query error', async () => {
    api.fetchMatchHistory.mockRejectedValue(new Error('offline'));
    renderCenter('history');
    expect(await screen.findByRole('alert')).toHaveTextContent('O jogo continua disponível');
  });
});
