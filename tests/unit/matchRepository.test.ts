import { afterEach, describe, expect, it } from 'vitest';
import {
  getLocalMatches,
  getPendingMatches,
  markMatchConfirmed,
  savePendingMatch,
} from '../../src/services/matches/matchRepository';

const completed = {
  id: 'match-1',
  playerId: 'local-captain',
  completedAt: '2026-10-15T12:00:00.000Z',
  score: 4,
  configuredDurationSeconds: 60,
  durationPlayedSeconds: 42,
  endReason: 'player-defeated' as const,
  configuration: { durationSeconds: 60, spawnIntervalSeconds: 4 },
};

afterEach(() => localStorage.clear());

describe('persistent match outbox', () => {
  it('keeps one pending record when a completed result is delivered repeatedly', () => {
    savePendingMatch(completed);
    savePendingMatch(completed);

    expect(getLocalMatches()).toHaveLength(1);
    expect(getPendingMatches()).toHaveLength(1);
  });

  it('recovers pending results and marks them confirmed after API success', () => {
    savePendingMatch(completed);
    markMatchConfirmed(completed.id);

    expect(getPendingMatches()).toHaveLength(0);
    expect(getLocalMatches()[0]?.submissionState).toBe('confirmed');
  });
});
