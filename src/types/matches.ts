import type { CompletedMatch } from '../game/types';

export type MatchRecord = CompletedMatch & { submissionState?: 'pending' | 'confirmed' };
export type RankingEntry = {
  playerId: string;
  playerName: string;
  score: number;
  completedAt: string;
  configuration: CompletedMatch['configuration'];
};
export type PagedResult<T> = { items: T[]; page: number; pageSize: number; total: number };
