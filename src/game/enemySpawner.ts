import { GAME_CONFIG } from '../config/gameConfig';
import { checkCollision, type Position } from './gameMath';
import { createHealthIndicator } from './healthIndicator';
import { Sprite, type Application, type Texture } from 'pixi.js';
import type { EnemyEntity, EnemyKind } from './types';

type EnemySpawnerOptions = {
  app: Application;
  ship: Sprite;
  shipRadius: number;
  cheaser: Sprite;
  cheaserRadius: number;
  shooter: Sprite;
  shooterRadius: number;
  islands: Sprite[];
  islandRadii: number[];
  spawnedEnemies: EnemyEntity[];
  shipTextures: Record<EnemyKind, Texture>;
  isCancelled: () => boolean;
  isGameOver: () => boolean;
  nextEnemyId: () => number;
};

export function createEnemySpawner({
  app,
  ship,
  shipRadius,
  cheaser,
  cheaserRadius,
  shooter,
  shooterRadius,
  islands,
  islandRadii,
  spawnedEnemies,
  shipTextures,
  isCancelled,
  isGameOver,
  nextEnemyId,
}: EnemySpawnerOptions) {
  function getRandomEnemyPosition(enemyRadius: number, otherEnemy: Sprite): Position | null {
    const margin = enemyRadius;
    const maxAttempts = GAME_CONFIG.enemies.maxSpawnAttempts;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const position = {
        x: margin + Math.random() * (app.screen.width - margin * 2),
        y: margin + Math.random() * (app.screen.height - margin * 2),
      };

      const overlapsShip = checkCollision(
        position,
        enemyRadius,
        { x: ship.x, y: ship.y },
        shipRadius,
      );
      const overlapsOtherEnemy =
        otherEnemy.visible &&
        checkCollision(
          position,
          enemyRadius,
          { x: otherEnemy.x, y: otherEnemy.y },
          otherEnemy === cheaser ? cheaserRadius : shooterRadius,
        );
      const overlapsIsland = islands.some((island, index) =>
        checkCollision(
          position,
          enemyRadius,
          { x: island.x, y: island.y },
          islandRadii[index] ?? 0,
        ),
      );

      if (!overlapsShip && !overlapsOtherEnemy && !overlapsIsland) return position;
    }

    return null;
  }

  function spawnAdditionalEnemy(kind: EnemyKind): void {
    const width = GAME_CONFIG.enemies.width;
    const height = GAME_CONFIG.enemies.height;
    const radius = Math.hypot(width / 2, height / 2);
    let position: Position | null = null;

    for (let attempt = 0; attempt < GAME_CONFIG.enemies.maxSpawnAttempts; attempt += 1) {
      const candidate = getRandomEnemyPosition(radius, kind === 'cheaser' ? shooter : cheaser);
      if (!candidate) continue;

      const overlapsAnotherSpawnedEnemy = spawnedEnemies.some((enemy) => {
        const otherRadius = Math.hypot(enemy.sprite.width / 2, enemy.sprite.height / 2);
        return checkCollision(
          candidate,
          radius,
          { x: enemy.sprite.x, y: enemy.sprite.y },
          otherRadius,
        );
      });
      const distanceFromPlayer = Math.hypot(candidate.x - ship.x, candidate.y - ship.y);

      if (
        !overlapsAnotherSpawnedEnemy &&
        distanceFromPlayer >= GAME_CONFIG.enemies.minSpawnDistance
      ) {
        position = candidate;
        break;
      }
    }

    if (!position || isCancelled() || isGameOver()) return;

    const sprite = new Sprite(shipTextures[kind]);
    sprite.anchor.set(0.5);
    sprite.width = width;
    sprite.height = height;
    sprite.position.set(position.x, position.y);

    if (kind === 'shooter') sprite.tint = 0xffd8a1;

    const id = nextEnemyId();
    const healthIndicator = createHealthIndicator(
      GAME_CONFIG.enemies.initialHealth,
      `health-${kind}-${id}`,
    );
    healthIndicator.update(sprite, GAME_CONFIG.enemies.initialHealth);

    app.stage.addChild(sprite, healthIndicator.graphic);
    spawnedEnemies.push({
      id,
      kind,
      sprite,
      healthIndicator,
      health: GAME_CONFIG.enemies.initialHealth,
      fireCooldown: GAME_CONFIG.shooter.initialFireCooldownSeconds,
    });
  }

  return { getRandomEnemyPosition, spawnAdditionalEnemy };
}
