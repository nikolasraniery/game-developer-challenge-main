import type { CompletedMatch } from '../../game/types';
import type { MatchRecord } from '../../types/matches';

const STORAGE_KEY = 'pirate-battle-match-records';
const SCENARIO_KEY = 'pirate-battle-api-scenario';

export type NetworkScenario =
  | 'success'
  | 'empty'
  | 'slow'
  | 'variable-latency'
  | 'out-of-order'
  | 'connection-error'
  | 'bad-request'
  | 'ranking-error'
  | 'history-error'
  | 'submit-error'
  | 'submit-timeout';

export function getNetworkScenario(): NetworkScenario {
  try {
    const value = localStorage.getItem(SCENARIO_KEY);
    return value === 'empty' ||
      value === 'slow' ||
      value === 'variable-latency' ||
      value === 'out-of-order' ||
      value === 'connection-error' ||
      value === 'bad-request' ||
      value === 'ranking-error' ||
      value === 'history-error' ||
      value === 'submit-error' ||
      value === 'submit-timeout'
      ? value
      : 'success';
  } catch {
    return 'success';
  }
}

export function setNetworkScenario(scenario: NetworkScenario) {
  try {
    localStorage.setItem(SCENARIO_KEY, scenario);
  } catch {
    /* The current view still uses the selected scenario. */
  }
}

function readRecords(): MatchRecord[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter(
      (entry): entry is MatchRecord =>
        typeof entry === 'object' && entry !== null && typeof entry.id === 'string',
    );
  } catch {
    return [];
  }
}

function writeRecords(records: MatchRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Storage can be unavailable in private browsing; API requests still proceed.
  }
}

export function savePendingMatch(match: CompletedMatch) {
  const records = readRecords();
  if (!records.some((entry) => entry.id === match.id)) {
    records.unshift({ ...match, submissionState: 'pending' });
    writeRecords(records);
  }
}

export function markMatchConfirmed(id: string) {
  writeRecords(
    readRecords().map((entry) =>
      entry.id === id ? { ...entry, submissionState: 'confirmed' } : entry,
    ),
  );
}

export function getLocalMatches(playerId?: string): MatchRecord[] {
  return readRecords().filter((entry) => !playerId || entry.playerId === playerId);
}

export function getPendingMatches(): MatchRecord[] {
  return readRecords().filter((entry) => entry.submissionState === 'pending');
}

export function clearLocalMatches() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Best-effort demo reset. */
  }
}
