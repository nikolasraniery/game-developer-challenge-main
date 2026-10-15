import type { Graphics, Sprite } from 'pixi.js';
import type { HealthIndicator } from './healthIndicator';

export type Projectile = {
  graphic: Graphics;
  directionX: number;
  directionY: number;
};

export type EnemyKind = 'cheaser' | 'shooter';

export type EnemyEntity = {
  id: number;
  kind: EnemyKind;
  sprite: Sprite;
  healthIndicator: HealthIndicator;
  health: number;
  fireCooldown: number;
};

export type GameHudSnapshot = {
  playerHealth: number;
  score: number;
  remainingSeconds: number;
};

export type MatchEndReason = 'time' | 'player-defeated';

export type CompletedMatch = {
  id: string;
  playerId: string;
  completedAt: string;
  score: number;
  configuredDurationSeconds: number;
  durationPlayedSeconds: number;
  endReason: MatchEndReason;
  configuration: {
    durationSeconds: number;
    spawnIntervalSeconds: number;
  };
};
