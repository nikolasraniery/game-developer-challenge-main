import { delay, http, HttpResponse } from 'msw';
import type { CompletedMatch } from '../../game/types';
import type { MatchRecord, PagedResult, RankingEntry } from '../../types/matches';
import { rankingFixtures } from '../fixtures/matches';

const acceptedMatches = new Map<string, MatchRecord>();
let rankingReadCount = 0;
let historyReadCount = 0;
function getRankingFixtures(url: URL) {
  const durationSeconds = Number(url.searchParams.get('durationSeconds')) || 60;
  const spawnIntervalSeconds = Number(url.searchParams.get('spawnIntervalSeconds')) || 4;
  return rankingFixtures.filter(
    (item) =>
      item.configuration.durationSeconds === durationSeconds &&
      item.configuration.spawnIntervalSeconds === spawnIntervalSeconds,
  );
}
const page = (value: string | null) => Math.max(1, Number(value) || 1);
const pageSize = (value: string | null) => Math.min(20, Math.max(1, Number(value) || 5));

export const matchHandlers = [
  http.get('/api/ranking', ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get('scenario');
    if (scenario === 'connection-error') return HttpResponse.error();
    if (scenario === 'bad-request')
      return HttpResponse.json({ message: 'Invalid ranking query' }, { status: 400 });
    if (scenario === 'ranking-error')
      return HttpResponse.json({ message: 'Ranking temporarily unavailable' }, { status: 503 });
    if (scenario === 'slow')
      return delay(650).then(() => {
        const items = getRankingFixtures(url);
        return HttpResponse.json({ items, page: 1, pageSize: 20, total: items.length });
      });
    if (scenario === 'variable-latency') {
      const wait = [80, 250, 500, 120][rankingReadCount++ % 4] ?? 80;
      return delay(wait).then(() => {
        const items = getRankingFixtures(url);
        return HttpResponse.json({ items, page: 1, pageSize: 20, total: items.length });
      });
    }
    if (scenario === 'out-of-order') {
      const wait = rankingReadCount++ % 2 === 0 ? 900 : 80;
      return delay(wait).then(() => {
        const items = getRankingFixtures(url);
        return HttpResponse.json({ items, page: 1, pageSize: 20, total: items.length });
      });
    }
    if (scenario === 'empty')
      return HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0 });
    const all: RankingEntry[] = [
      ...getRankingFixtures(url),
      ...[...acceptedMatches.values()].map((match) => ({
        playerId: match.playerId,
        playerName: 'Local Captain',
        score: match.score,
        completedAt: match.completedAt,
        configuration: match.configuration,
      })),
    ].sort(
      (a, b) =>
        b.score - a.score ||
        a.completedAt.localeCompare(b.completedAt) ||
        a.playerId.localeCompare(b.playerId),
    );
    const currentPage = page(url.searchParams.get('page'));
    const size = pageSize(url.searchParams.get('pageSize'));
    const result: PagedResult<RankingEntry> = {
      items: all.slice((currentPage - 1) * size, currentPage * size),
      page: currentPage,
      pageSize: size,
      total: all.length,
    };
    return HttpResponse.json(result);
  }),
  http.get('/api/matches', ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get('scenario');
    if (scenario === 'connection-error') return HttpResponse.error();
    if (scenario === 'bad-request')
      return HttpResponse.json({ message: 'Invalid history query' }, { status: 400 });
    if (scenario === 'history-error')
      return HttpResponse.json({ message: 'History temporarily unavailable' }, { status: 503 });
    if (scenario === 'slow')
      return delay(650).then(() =>
        HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0 }),
      );
    if (scenario === 'variable-latency') {
      const wait = [120, 480, 70, 300][historyReadCount++ % 4] ?? 120;
      return delay(wait).then(() =>
        HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0 }),
      );
    }
    if (scenario === 'out-of-order') {
      const wait = historyReadCount++ % 2 === 0 ? 900 : 80;
      return delay(wait).then(() =>
        HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0 }),
      );
    }
    if (scenario === 'empty')
      return HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0 });
    const playerId = url.searchParams.get('playerId') ?? 'local-captain';
    const all = [...acceptedMatches.values()]
      .filter((match) => match.playerId === playerId)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    const currentPage = page(url.searchParams.get('page'));
    const size = pageSize(url.searchParams.get('pageSize'));
    const result: PagedResult<MatchRecord> = {
      items: all.slice((currentPage - 1) * size, currentPage * size),
      page: currentPage,
      pageSize: size,
      total: all.length,
    };
    return HttpResponse.json(result);
  }),
  http.post('/api/matches', async ({ request }) => {
    const match = (await request.json()) as CompletedMatch;
    const scenario = new URL(request.url).searchParams.get('scenario');
    if (scenario === 'connection-error') return HttpResponse.error();
    if (scenario === 'submit-error')
      return HttpResponse.json({ message: 'Match service unavailable' }, { status: 503 });
    const existing = acceptedMatches.get(match.id);
    if (existing) return HttpResponse.json(existing);
    const record: MatchRecord = { ...match, submissionState: 'confirmed' };
    acceptedMatches.set(match.id, record);
    if (scenario === 'submit-timeout') {
      await delay(5_500);
      return HttpResponse.json(record, { status: 201 });
    }
    return HttpResponse.json(record, { status: 201 });
  }),
  http.post('/api/demo-reset', () => {
    acceptedMatches.clear();
    rankingReadCount = 0;
    historyReadCount = 0;
    return HttpResponse.json({ reset: true });
  }),
];
