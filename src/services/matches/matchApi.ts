import { httpClient } from '../api/httpClient';
import type { CompletedMatch } from '../../game/types';
import type { MatchRecord, PagedResult, RankingEntry } from '../../types/matches';
import { getLocalMatches, getNetworkScenario } from './matchRepository';

export const matchQueryKeys = {
  ranking: (page: number) => ['ranking', page] as const,
  history: (page: number, playerId: string) => ['match-history', playerId, page] as const,
};

export async function fetchRanking(
  page: number,
  configuration: { durationSeconds: number; spawnIntervalSeconds: number },
  pageSize = 5,
): Promise<PagedResult<RankingEntry>> {
  const scenario = getNetworkScenario();
  const response = await httpClient.get<PagedResult<RankingEntry>>('/ranking', {
    params: { page: 1, pageSize: 20, ...configuration, scenario },
  });
  const local = (scenario === 'empty' ? [] : getLocalMatches())
    .filter(
      (match) =>
        match.submissionState === 'confirmed' &&
        match.configuration.durationSeconds === configuration.durationSeconds &&
        match.configuration.spawnIntervalSeconds === configuration.spawnIntervalSeconds,
    )
    .map((match) => ({
      playerId: match.playerId,
      playerName: 'Local Captain',
      score: match.score,
      completedAt: match.completedAt,
      configuration: match.configuration,
    }));
  const merged = [...response.data.items, ...local].sort(
    (a, b) =>
      b.score - a.score ||
      a.completedAt.localeCompare(b.completedAt) ||
      a.playerId.localeCompare(b.playerId),
  );
  const unique = merged.filter(
    (entry, index) =>
      merged.findIndex(
        (candidate) =>
          candidate.playerId === entry.playerId &&
          candidate.completedAt === entry.completedAt &&
          candidate.score === entry.score,
      ) === index,
  );
  const start = (page - 1) * pageSize;
  return { items: unique.slice(start, start + pageSize), page, pageSize, total: unique.length };
}

export async function fetchMatchHistory(
  page: number,
  playerId = 'local-captain',
  pageSize = 5,
): Promise<PagedResult<MatchRecord>> {
  const scenario = getNetworkScenario();
  const response = await httpClient.get<PagedResult<MatchRecord>>('/matches', {
    params: { page: 1, pageSize: 20, playerId, scenario },
  });
  const merged = [
    ...(scenario === 'empty' ? [] : getLocalMatches(playerId)),
    ...response.data.items,
  ];
  const unique = merged.filter(
    (entry, index) => merged.findIndex((other) => other.id === entry.id) === index,
  );
  const start = (page - 1) * pageSize;
  return { items: unique.slice(start, start + pageSize), page, pageSize, total: unique.length };
}

export async function recordMatch(match: CompletedMatch): Promise<MatchRecord> {
  const response = await httpClient.post<MatchRecord>('/matches', match, {
    headers: { 'Idempotency-Key': match.id },
    params: { scenario: getNetworkScenario() },
  });
  return response.data;
}
