import type { RankingEntry } from '../../types/matches';

const standardConfig = { durationSeconds: 60, spawnIntervalSeconds: 4 };
export const rankingFixtures: RankingEntry[] = [
  {
    playerId: 'captain-ada',
    playerName: 'Ada',
    score: 8,
    completedAt: '2026-09-21T12:00:00.000Z',
    configuration: standardConfig,
  },
  {
    playerId: 'captain-lin',
    playerName: 'Lin',
    score: 5,
    completedAt: '2026-09-20T12:00:00.000Z',
    configuration: standardConfig,
  },
  {
    playerId: 'captain-jo',
    playerName: 'Jo',
    score: 3,
    completedAt: '2026-09-19T12:00:00.000Z',
    configuration: standardConfig,
  },
  {
    playerId: 'captain-kai',
    playerName: 'Kai',
    score: 1,
    completedAt: '2026-09-18T12:00:00.000Z',
    configuration: standardConfig,
  },
  {
    playerId: 'captain-mia',
    playerName: 'Mia',
    score: 0,
    completedAt: '2026-09-17T12:00:00.000Z',
    configuration: standardConfig,
  },
  {
    playerId: 'captain-noa',
    playerName: 'Noa',
    score: 0,
    completedAt: '2026-09-16T12:00:00.000Z',
    configuration: standardConfig,
  },
];
