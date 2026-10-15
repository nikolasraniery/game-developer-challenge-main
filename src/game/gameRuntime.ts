import { GAME_CONFIG } from '../config/gameConfig';
import { drawArenaScene } from './arenaScene';
import { createEnemySpawner } from './enemySpawner';
import { createProjectile, fireSideVolley } from './projectiles';
import { createKeyboardControls } from './keyboardControls';
import { createHealthIndicator } from './healthIndicator';
import {
  checkCollision,
  clampToArena,
  forwardMovement,
  isNewKeyPress,
  isOutOfBounds,
  reduceToZero,
  resolveMovement,
  rotateBy,
  rotatedHalfExtents,
} from './gameMath';
import { Application, Sprite, Ticker, TilingSprite, type Texture } from 'pixi.js';
import type { CompletedMatch, EnemyEntity, EnemyKind, GameHudSnapshot, Projectile } from './types';

export type GameRuntimeOptions = {
  isCancelled: () => boolean;
  onHudChange: (snapshot: GameHudSnapshot) => void;
  setGameState: (state: 'playing' | 'paused' | 'gameOver') => void;
  setGameResult: (result: string) => void;
  onMatchComplete?: (match: CompletedMatch) => void;
  durationSeconds?: number;
  spawnIntervalSeconds?: number;
};

export function createGameRuntime(
  app: Application,
  host: HTMLElement,
  shipTextures: { player: Texture; chaser: Texture; shooter: Texture },
  islandTextures: [Texture, Texture],
  waterTexture: Texture,
  cannonBallTexture: Texture,
  explosionTexture: Texture,
  {
    isCancelled,
    onHudChange,
    setGameState,
    setGameResult,
    onMatchComplete,
    durationSeconds = GAME_CONFIG.match.durationSeconds,
    spawnIntervalSeconds = GAME_CONFIG.enemies.spawnIntervalSeconds,
  }: GameRuntimeOptions,
) {
  let cheaserRespawnRemaining: number | undefined;
  let shooterRespawnRemaining: number | undefined;
  let sideShotCooldown = 0;
  const spawnedEnemies: EnemyEntity[] = [];
  const spawnedEnemyProjectiles: Projectile[] = [];
  let nextEnemyId = 1;
  let spawnElapsed = 0;
  const background = new TilingSprite({
    texture: waterTexture,
    width: app.screen.width,
    height: app.screen.height,
    tileScale: { x: 1.15, y: 1.15 },
  });

  const projectiles: Projectile[] = [];
  const shooterProjectiles: Projectile[] = [];

  const projectileSpeed = GAME_CONFIG.player.projectileSpeed;
  const shooterProjectileSpeed = GAME_CONFIG.shooter.projectileSpeed;
  const shooterFireInterval = GAME_CONFIG.shooter.fireIntervalSeconds;
  let shooterFireCooldown: number = GAME_CONFIG.shooter.initialFireCooldownSeconds;

  const contactDamage = GAME_CONFIG.enemies.contactDamage;
  const damageCooldownDuration = GAME_CONFIG.enemies.damageCooldownSeconds;
  let damageCooldown = 0;

  const cheaserSpeed = GAME_CONFIG.chaser.movementSpeed;

  let spaceWasPressed = false;
  const ship = new Sprite(shipTextures.player);
  ship.anchor.set(0.5);
  ship.width = GAME_CONFIG.player.width;
  ship.height = GAME_CONFIG.player.height;
  ship.rotation = 0.01;
  let playerHealth: number = GAME_CONFIG.player.initialHealth;
  let isGameOver = false;
  let isPaused = false;
  let playerDamageFlash = 0;
  const explosionEffects: { sprite: Sprite; elapsed: number; duration: number }[] = [];
  const shipRadius = Math.sqrt(Math.pow(ship.width / 2, 2) + Math.pow(ship.height / 2, 2));

  const cheaser = new Sprite(shipTextures.chaser);
  cheaser.anchor.set(0.5);
  cheaser.width = GAME_CONFIG.enemies.width;
  cheaser.height = GAME_CONFIG.enemies.height;
  cheaser.position.set(app.screen.width * 0.75, app.screen.height * 0.5);
  let cheaserHealth: number = GAME_CONFIG.enemies.initialHealth;
  const shooter = new Sprite(shipTextures.shooter);
  shooter.anchor.set(0.5);
  shooter.width = GAME_CONFIG.enemies.width;
  shooter.height = GAME_CONFIG.enemies.height;
  shooter.position.set(app.screen.width * 0.75, app.screen.height * 0.25);

  let shooterHealth: number = GAME_CONFIG.enemies.initialHealth;
  const playerHealthIndicator = createHealthIndicator(
    GAME_CONFIG.player.initialHealth,
    'health-player',
  );
  const cheaserHealthIndicator = createHealthIndicator(
    GAME_CONFIG.enemies.initialHealth,
    'health-chaser',
  );
  const shooterHealthIndicator = createHealthIndicator(
    GAME_CONFIG.enemies.initialHealth,
    'health-shooter',
  );
  const shooterRadius = Math.sqrt(Math.pow(shooter.width / 2, 2) + Math.pow(shooter.height / 2, 2));
  let score = 0;
  let remainingTime: number = durationSeconds;
  let lastDisplayedSecond = Math.ceil(remainingTime);
  const publishHud = () =>
    onHudChange({ playerHealth, score, remainingSeconds: lastDisplayedSecond });

  const showPlayerDamage = () => {
    playerDamageFlash = 0.2;
    ship.alpha = 0.5;
    ship.tint = playerHealth <= 1 ? 0xff7665 : playerHealth <= 2 ? 0xffc16b : 0xffffff;
  };

  const tintEnemyByHealth = (sprite: Sprite, health: number) => {
    sprite.tint =
      health <= 1 ? 0xff7665 : health < GAME_CONFIG.enemies.initialHealth ? 0xffc16b : 0xffffff;
  };

  const showExplosion = (x: number, y: number) => {
    const effect = new Sprite(explosionTexture);
    effect.anchor.set(0.5);
    effect.position.set(x, y);
    effect.width = 76;
    effect.height = 76;
    effect.alpha = 0.9;
    app.stage.addChild(effect);
    explosionEffects.push({ sprite: effect, elapsed: 0, duration: 0.42 });
  };

  const updateEffects = (deltaSeconds: number) => {
    if (playerDamageFlash > 0) {
      playerDamageFlash = Math.max(0, playerDamageFlash - deltaSeconds);
      ship.alpha = playerDamageFlash === 0 ? 1 : 0.5 + (0.5 * (0.2 - playerDamageFlash)) / 0.2;
    }
    for (let index = explosionEffects.length - 1; index >= 0; index -= 1) {
      const effect = explosionEffects[index];
      if (!effect) continue;
      effect.elapsed += deltaSeconds;
      const progress = Math.min(1, effect.elapsed / effect.duration);
      effect.sprite.scale.set(0.45 + progress * 0.85);
      effect.sprite.alpha = 0.9 * (1 - progress);
      if (progress >= 1) {
        app.stage.removeChild(effect.sprite);
        explosionEffects.splice(index, 1);
      }
    }
  };

  const endGame = (message = 'GAME OVER') => {
    if (isGameOver) return;

    isGameOver = true;
    keyboardControls.releaseAll();
    app?.ticker.stop();
    cheaserRespawnRemaining = undefined;
    shooterRespawnRemaining = undefined;

    setGameResult(message);
    setGameState('gameOver');
    onMatchComplete?.({
      id:
        globalThis.crypto?.randomUUID?.() ??
        `match-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      playerId: 'local-captain',
      completedAt: new Date().toISOString(),
      score,
      configuredDurationSeconds: durationSeconds,
      durationPlayedSeconds: Math.min(
        durationSeconds,
        Math.max(0, durationSeconds - remainingTime),
      ),
      endReason: message === 'TIME UP' ? 'time' : 'player-defeated',
      configuration: { durationSeconds, spawnIntervalSeconds },
    });
  };

  const pauseGame = () => {
    if (isGameOver || isPaused) return;

    isPaused = true;
    keyboardControls.releaseAll();
    spaceWasPressed = false;

    app?.ticker.stop();
    setGameState('paused');
  };

  const resumeGame = () => {
    if (isGameOver || !isPaused) return;

    keyboardControls.releaseAll();
    spaceWasPressed = false;
    isPaused = false;

    app?.ticker.start();
    setGameState('playing');
  };

  const togglePause = () => {
    if (isPaused) {
      resumeGame();
    } else {
      pauseGame();
    }
  };

  const cheaserRadius = Math.sqrt(Math.pow(cheaser.width / 2, 2) + Math.pow(cheaser.height / 2, 2));

  function respawnCheaser() {
    cheaserRespawnRemaining = GAME_CONFIG.enemies.respawnDelayMs / 1_000;
  }

  function respawnShooter() {
    shooterRespawnRemaining = GAME_CONFIG.enemies.respawnDelayMs / 1_000;
  }

  const islands = [new Sprite(islandTextures[0]), new Sprite(islandTextures[1])];

  for (const island of islands) {
    island.anchor.set(0.5);
  }

  const islandRadii = islands.map((island) =>
    Math.sqrt(
      Math.pow((island.width * island.scale.x) / 2, 2) +
        Math.pow((island.height * island.scale.y) / 2, 2),
    ),
  );

  const projectileHitsIsland = (position: { x: number; y: number }, radius: number) =>
    islands.some((island, index) =>
      checkCollision(position, radius, { x: island.x, y: island.y }, islandRadii[index] ?? 0),
    );

  const updateRespawns = (deltaSeconds: number) => {
    if (cheaserRespawnRemaining !== undefined) {
      cheaserRespawnRemaining = reduceToZero(cheaserRespawnRemaining, deltaSeconds);
      if (cheaserRespawnRemaining === 0) {
        cheaserRespawnRemaining = undefined;
        if (!isCancelled() && !isGameOver) {
          const position = getRandomEnemyPosition(cheaserRadius, shooter);
          if (position) {
            cheaser.position.set(position.x, position.y);
            cheaserHealth = GAME_CONFIG.enemies.initialHealth;
            cheaserHealthIndicator.update(cheaser, cheaserHealth);
            app.stage.addChild(cheaser, cheaserHealthIndicator.graphic);
          }
        }
      }
    }

    if (shooterRespawnRemaining !== undefined) {
      shooterRespawnRemaining = reduceToZero(shooterRespawnRemaining, deltaSeconds);
      if (shooterRespawnRemaining === 0) {
        shooterRespawnRemaining = undefined;
        if (!isCancelled() && !isGameOver) {
          const position = getRandomEnemyPosition(shooterRadius, cheaser);
          if (position) {
            shooter.position.set(position.x, position.y);
            shooterHealth = GAME_CONFIG.enemies.initialHealth;
            shooterFireCooldown = GAME_CONFIG.shooter.initialFireCooldownSeconds;
            shooterHealthIndicator.update(shooter, shooterHealth);
            app.stage.addChild(shooter, shooterHealthIndicator.graphic);
          }
        }
      }
    }
  };

  const { getRandomEnemyPosition, spawnAdditionalEnemy } = createEnemySpawner({
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
    shipTextures: { cheaser: shipTextures.chaser, shooter: shipTextures.shooter },
    isCancelled,
    isGameOver: () => isGameOver,
    nextEnemyId: () => nextEnemyId++,
  });

  playerHealthIndicator.update(ship, playerHealth);
  cheaserHealthIndicator.update(cheaser, cheaserHealth);
  shooterHealthIndicator.update(shooter, shooterHealth);
  app.stage.addChild(
    background,
    ...islands,
    ship,
    cheaser,
    shooter,
    playerHealthIndicator.graphic,
    cheaserHealthIndicator.graphic,
    shooterHealthIndicator.graphic,
  );

  const moveEnemyTowardPlayer = (
    sprite: Sprite,
    radius: number,
    speed: number,
    preferredDistance: number,
    deltaSeconds: number,
  ) => {
    const dx = ship.x - sprite.x;
    const dy = ship.y - sprite.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return distance;

    sprite.rotation = Math.atan2(-dx, dy);

    if (distance <= preferredDistance) return distance;

    const travel = Math.min(speed * deltaSeconds, distance - preferredDistance);
    const previous = { x: sprite.x, y: sprite.y };
    const next = {
      x: sprite.x + (dx / distance) * travel,
      y: sprite.y + (dy / distance) * travel,
    };
    const resolved = resolveMovement(previous, next, (position) =>
      islands.some((island, index) =>
        checkCollision(
          position,
          radius * 0.65,
          { x: island.x, y: island.y },
          (islandRadii[index] ?? 0) * 0.65,
        ),
      ),
    );
    const bounded = clampToArena(
      resolved,
      rotatedHalfExtents({ width: sprite.width, height: sprite.height }, sprite.rotation),
      { width: app.screen.width, height: app.screen.height },
    );
    sprite.position.set(bounded.x, bounded.y);
    return distance;
  };

  const updatePlayer = (ticker: Ticker) => {
    if (isGameOver) return;

    const deltaSeconds = ticker.deltaMS / 1000;
    updateEffects(deltaSeconds);

    remainingTime = reduceToZero(remainingTime, deltaSeconds);

    const secondsToDisplay = Math.ceil(remainingTime);

    if (secondsToDisplay !== lastDisplayedSecond) {
      lastDisplayedSecond = secondsToDisplay;
      publishHud();
    }

    if (remainingTime <= 0) {
      endGame('TIME UP');
      return;
    }

    updateRespawns(deltaSeconds);

    spawnElapsed += deltaSeconds;

    if (spawnElapsed >= spawnIntervalSeconds) {
      spawnElapsed -= spawnIntervalSeconds;

      const activeBaseEnemies = (cheaserHealth > 0 ? 1 : 0) + (shooterHealth > 0 ? 1 : 0);

      const activeEnemyCount = activeBaseEnemies + spawnedEnemies.length;

      if (activeEnemyCount < GAME_CONFIG.enemies.maxActiveEnemies) {
        const kind: EnemyKind = Math.random() < 0.5 ? 'cheaser' : 'shooter';

        spawnAdditionalEnemy(kind);
      }
    }

    sideShotCooldown = reduceToZero(sideShotCooldown, deltaSeconds);

    if (
      sideShotCooldown <= 0 &&
      (keyboardControls.isFiringLeft || keyboardControls.isFiringRight)
    ) {
      if (keyboardControls.isFiringLeft) {
        fireSideVolley(app, ship, projectiles, -1, cannonBallTexture);
      }

      if (keyboardControls.isFiringRight) {
        fireSideVolley(app, ship, projectiles, 1, cannonBallTexture);
      }

      sideShotCooldown = GAME_CONFIG.player.sideShotCooldownSeconds;
    }

    damageCooldown = reduceToZero(damageCooldown, deltaSeconds);

    if (cheaserHealth > 0) {
      const dx = ship.x - cheaser.x;
      const dy = ship.y - cheaser.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        cheaser.rotation = Math.atan2(-dx, dy);

        const movementX = (dx / distance) * cheaserSpeed * deltaSeconds;
        const movementY = (dy / distance) * cheaserSpeed * deltaSeconds;

        const nextX = cheaser.x + movementX;
        const nextY = cheaser.y + movementY;

        const collidesWithIsland = (x: number, y: number) =>
          islands.some((island, index) =>
            checkCollision(
              { x, y },
              cheaserRadius * 0.65,
              { x: island.x, y: island.y },
              islandRadii[index] * 0.65,
            ),
          );

        if (!collidesWithIsland(nextX, cheaser.y)) {
          cheaser.x = nextX;
        }

        if (!collidesWithIsland(cheaser.x, nextY)) {
          cheaser.y = nextY;
        }

        const bounded = clampToArena(
          { x: cheaser.x, y: cheaser.y },
          rotatedHalfExtents({ width: cheaser.width, height: cheaser.height }, cheaser.rotation),
          { width: app!.screen.width, height: app!.screen.height },
        );
        cheaser.position.set(bounded.x, bounded.y);
      }

      if (
        cheaserHealth > 0 &&
        damageCooldown === 0 &&
        checkCollision(
          { x: ship.x, y: ship.y },
          shipRadius * 0.5,
          { x: cheaser.x, y: cheaser.y },
          cheaserRadius,
        )
      ) {
        showExplosion(cheaser.x, cheaser.y);
        playerHealth = reduceToZero(playerHealth, contactDamage);
        showPlayerDamage();

        app!.stage.removeChild(cheaser);
        app!.stage.removeChild(cheaserHealthIndicator.graphic);
        cheaserHealth = 0;
        respawnCheaser();

        publishHud();

        if (playerHealth === 0) {
          endGame();
          return;
        }

        damageCooldown = damageCooldownDuration;
      }
    }

    if (shooterHealth > 0) {
      moveEnemyTowardPlayer(
        shooter,
        shooterRadius,
        GAME_CONFIG.shooter.movementSpeed,
        GAME_CONFIG.shooter.preferredDistance,
        deltaSeconds,
      );

      shooterFireCooldown -= deltaSeconds;

      const canFire =
        Math.hypot(ship.x - shooter.x, ship.y - shooter.y) <= GAME_CONFIG.shooter.attackRange;
      if (canFire && shooterFireCooldown <= 0) {
        const projectile = createProjectile(
          app,
          shooter,
          0xffa04a,
          undefined,
          undefined,
          cannonBallTexture,
        );

        shooterProjectiles.push(projectile);
        shooterFireCooldown = shooterFireInterval;
      }
    }
    const rotationSpeed = GAME_CONFIG.player.rotationSpeed;
    const movementSpeed = GAME_CONFIG.player.movementSpeed;
    const previousX = ship.x;
    const previousY = ship.y;

    const halfExtents = rotatedHalfExtents(
      { width: ship.width, height: ship.height },
      ship.rotation,
    );

    if (
      keyboardControls.keysPressed.has('ArrowRight') ||
      keyboardControls.keysPressed.has('KeyD')
    ) {
      ship.rotation = rotateBy(ship.rotation, 1, rotationSpeed, deltaSeconds);
    }

    if (keyboardControls.keysPressed.has('ArrowLeft') || keyboardControls.keysPressed.has('KeyA')) {
      ship.rotation = rotateBy(ship.rotation, -1, rotationSpeed, deltaSeconds);
    }

    if (keyboardControls.keysPressed.has('ArrowUp') || keyboardControls.keysPressed.has('KeyW')) {
      const movement = forwardMovement(ship.rotation, movementSpeed, deltaSeconds);
      const previousPosition = { x: previousX, y: previousY };
      const nextPosition = {
        x: ship.x + movement.x,
        y: ship.y + movement.y,
      };
      const resolvedPosition = resolveMovement(previousPosition, nextPosition, (position) =>
        islands.some((island, index) =>
          checkCollision(
            position,
            shipRadius * 0.65,
            { x: island.x, y: island.y },
            (islandRadii[index] ?? 0) * 0.65,
          ),
        ),
      );

      ship.x = resolvedPosition.x;
      ship.y = resolvedPosition.y;
    }

    const spaceIsPressed = keyboardControls.keysPressed.has('Space');

    if (isNewKeyPress(spaceIsPressed, spaceWasPressed)) {
      const projectile = createProjectile(
        app,
        ship,
        undefined,
        undefined,
        undefined,
        cannonBallTexture,
      );
      projectiles.push(projectile);
    }

    spaceWasPressed = spaceIsPressed;

    for (const enemy of spawnedEnemies) {
      const { sprite } = enemy;

      const dx = ship.x - sprite.x;
      const dy = ship.y - sprite.y;
      const distance = Math.hypot(dx, dy);

      if (distance === 0) continue;

      // Os dois tipos de inimigo apontam para o jogador.
      sprite.rotation = Math.atan2(-dx, dy);

      if (enemy.kind === 'cheaser') {
        const previousX = sprite.x;
        const previousY = sprite.y;

        const movement = GAME_CONFIG.chaser.movementSpeed * deltaSeconds;

        sprite.x += (dx / distance) * movement;
        sprite.y += (dy / distance) * movement;

        for (let islandIndex = 0; islandIndex < islands.length; islandIndex += 1) {
          const island = islands[islandIndex];
          if (!island) continue;

          const islandRadius = islandRadii[islandIndex] ?? 0;
          const enemyRadius = Math.hypot(sprite.width / 2, sprite.height / 2);

          if (
            checkCollision(
              { x: sprite.x, y: sprite.y },
              enemyRadius * 0.65,
              { x: island.x, y: island.y },
              islandRadius * 0.65,
            )
          ) {
            sprite.x = previousX;
            sprite.y = previousY;
            break;
          }
        }

        const bounded = clampToArena(
          { x: sprite.x, y: sprite.y },
          rotatedHalfExtents({ width: sprite.width, height: sprite.height }, sprite.rotation),
          { width: app!.screen.width, height: app!.screen.height },
        );
        sprite.position.set(bounded.x, bounded.y);

        const enemyRadius = Math.hypot(sprite.width / 2, sprite.height / 2);

        if (
          damageCooldown <= 0 &&
          checkCollision(
            { x: ship.x, y: ship.y },
            shipRadius * 0.65,
            { x: sprite.x, y: sprite.y },
            enemyRadius * 0.65,
          )
        ) {
          showExplosion(sprite.x, sprite.y);
          playerHealth = Math.max(0, playerHealth - contactDamage);
          showPlayerDamage();

          publishHud();
          damageCooldown = damageCooldownDuration;

          app!.stage.removeChild(sprite);
          app!.stage.removeChild(enemy.healthIndicator.graphic);

          const enemyIndex = spawnedEnemies.findIndex((item) => item.id === enemy.id);

          if (enemyIndex !== -1) {
            spawnedEnemies.splice(enemyIndex, 1);
          }

          if (playerHealth <= 0) {
            endGame();
            return;
          }
        }
      } else {
        moveEnemyTowardPlayer(
          sprite,
          Math.hypot(sprite.width / 2, sprite.height / 2),
          GAME_CONFIG.shooter.movementSpeed,
          GAME_CONFIG.shooter.preferredDistance,
          deltaSeconds,
        );

        const targetDx = ship.x - sprite.x;
        const targetDy = ship.y - sprite.y;
        const targetDistance = Math.hypot(targetDx, targetDy);
        enemy.fireCooldown -= deltaSeconds;

        if (targetDistance <= GAME_CONFIG.shooter.attackRange && enemy.fireCooldown <= 0) {
          spawnedEnemyProjectiles.push(
            createProjectile(
              app!,
              sprite,
              0xffa04a,
              { x: targetDx / targetDistance, y: targetDy / targetDistance },
              undefined,
              cannonBallTexture,
            ),
          );

          enemy.fireCooldown = GAME_CONFIG.shooter.fireIntervalSeconds;
        }
      }
    }

    for (let i = projectiles.length - 1; i >= 0; i -= 1) {
      projectiles[i].graphic.x += projectiles[i].directionX * projectileSpeed * deltaSeconds;
      projectiles[i].graphic.y += projectiles[i].directionY * projectileSpeed * deltaSeconds;

      if (
        cheaserHealth > 0 &&
        checkCollision(
          { x: projectiles[i].graphic.x, y: projectiles[i].graphic.y },
          GAME_CONFIG.player.projectileRadius,
          { x: cheaser.x, y: cheaser.y },
          cheaserRadius,
        )
      ) {
        cheaserHealth -= 1;
        tintEnemyByHealth(cheaser, cheaserHealth);
        cheaserHealthIndicator.update(cheaser, cheaserHealth);

        app!.stage.removeChild(projectiles[i].graphic);
        projectiles.splice(i, 1);

        if (cheaserHealth === 0) {
          showExplosion(cheaser.x, cheaser.y);
          app!.stage.removeChild(cheaser);
          app!.stage.removeChild(cheaserHealthIndicator.graphic);
          respawnCheaser();
          score += 1;
          publishHud();
        }

        continue;
      }

      if (
        shooterHealth > 0 &&
        checkCollision(
          {
            x: projectiles[i].graphic.x,
            y: projectiles[i].graphic.y,
          },
          GAME_CONFIG.player.projectileRadius,
          { x: shooter.x, y: shooter.y },
          shooterRadius,
        )
      ) {
        shooterHealth -= 1;
        tintEnemyByHealth(shooter, shooterHealth);
        shooterHealthIndicator.update(shooter, shooterHealth);

        app!.stage.removeChild(projectiles[i].graphic);
        projectiles.splice(i, 1);

        if (shooterHealth === 0) {
          showExplosion(shooter.x, shooter.y);
          app!.stage.removeChild(shooter);
          app!.stage.removeChild(shooterHealthIndicator.graphic);
          respawnShooter();
          score += 1;
          publishHud();
        }

        continue;
      }

      let hitSpawnedEnemy = false;

      for (let enemyIndex = spawnedEnemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
        const enemy = spawnedEnemies[enemyIndex];
        if (!enemy) continue;

        const enemyRadius = Math.hypot(enemy.sprite.width / 2, enemy.sprite.height / 2);

        if (
          checkCollision(
            {
              x: projectiles[i]!.graphic.x,
              y: projectiles[i]!.graphic.y,
            },
            GAME_CONFIG.player.projectileRadius,
            { x: enemy.sprite.x, y: enemy.sprite.y },
            enemyRadius,
          )
        ) {
          enemy.health -= 1;
          tintEnemyByHealth(enemy.sprite, enemy.health);
          enemy.healthIndicator.update(enemy.sprite, enemy.health);

          app!.stage.removeChild(projectiles[i]!.graphic);
          projectiles.splice(i, 1);

          if (enemy.health <= 0) {
            showExplosion(enemy.sprite.x, enemy.sprite.y);
            app!.stage.removeChild(enemy.sprite);
            app!.stage.removeChild(enemy.healthIndicator.graphic);
            spawnedEnemies.splice(enemyIndex, 1);

            score += 1;
            publishHud();
          }

          hitSpawnedEnemy = true;
          break;
        }
      }

      if (hitSpawnedEnemy) continue;

      if (
        projectileHitsIsland(
          { x: projectiles[i].graphic.x, y: projectiles[i].graphic.y },
          GAME_CONFIG.player.projectileRadius,
        ) ||
        isOutOfBounds(
          { x: projectiles[i].graphic.x, y: projectiles[i].graphic.y },
          { width: app!.screen.width, height: app!.screen.height },
        )
      ) {
        app!.stage.removeChild(projectiles[i].graphic);
        projectiles.splice(i, 1);
      }
    }

    for (let i = shooterProjectiles.length - 1; i >= 0; i -= 1) {
      const projectile = shooterProjectiles[i];

      projectile.graphic.x += projectile.directionX * shooterProjectileSpeed * deltaSeconds;

      projectile.graphic.y += projectile.directionY * shooterProjectileSpeed * deltaSeconds;

      const hitPlayer = checkCollision(
        {
          x: projectile.graphic.x,
          y: projectile.graphic.y,
        },
        5,
        { x: ship.x, y: ship.y },
        shipRadius,
      );

      const outOfBounds = isOutOfBounds(
        { x: projectile.graphic.x, y: projectile.graphic.y },
        { width: app!.screen.width, height: app!.screen.height },
      );

      if (hitPlayer && damageCooldown === 0) {
        playerHealth = reduceToZero(playerHealth, contactDamage);
        showPlayerDamage();
        playerHealthIndicator.update(ship, playerHealth);

        publishHud();

        if (playerHealth === 0) {
          endGame();
        }

        damageCooldown = damageCooldownDuration;
      }

      const hitsIsland = projectileHitsIsland(
        { x: projectile.graphic.x, y: projectile.graphic.y },
        GAME_CONFIG.shooter.projectileRadius,
      );
      if (hitPlayer || outOfBounds || hitsIsland) {
        app!.stage.removeChild(projectile.graphic);
        shooterProjectiles.splice(i, 1);
      }
      if (isGameOver) return;
    }

    for (let i = spawnedEnemyProjectiles.length - 1; i >= 0; i -= 1) {
      const projectile = spawnedEnemyProjectiles[i];
      if (!projectile) continue;

      projectile.graphic.x +=
        projectile.directionX * GAME_CONFIG.shooter.projectileSpeed * deltaSeconds;

      projectile.graphic.y +=
        projectile.directionY * GAME_CONFIG.shooter.projectileSpeed * deltaSeconds;

      const hitPlayer = checkCollision(
        {
          x: projectile.graphic.x,
          y: projectile.graphic.y,
        },
        GAME_CONFIG.shooter.projectileRadius,
        { x: ship.x, y: ship.y },
        shipRadius * 0.65,
      );

      const outOfBounds = isOutOfBounds(
        { x: projectile.graphic.x, y: projectile.graphic.y },
        { width: app!.screen.width, height: app!.screen.height },
      );

      if (hitPlayer && damageCooldown <= 0) {
        playerHealth = reduceToZero(playerHealth, contactDamage);
        showPlayerDamage();
        playerHealthIndicator.update(ship, playerHealth);

        publishHud();
        damageCooldown = damageCooldownDuration;

        if (playerHealth <= 0) {
          endGame();
        }
      }

      const hitsIsland = projectileHitsIsland(
        { x: projectile.graphic.x, y: projectile.graphic.y },
        GAME_CONFIG.shooter.projectileRadius,
      );
      if (hitPlayer || outOfBounds || hitsIsland || isGameOver) {
        app!.stage.removeChild(projectile.graphic);
        spawnedEnemyProjectiles.splice(i, 1);
      }
      if (isGameOver) return;
    }

    const clampedPosition = clampToArena({ x: ship.x, y: ship.y }, halfExtents, {
      width: app!.screen.width,
      height: app!.screen.height,
    });
    ship.x = clampedPosition.x;
    ship.y = clampedPosition.y;
    playerHealthIndicator.update(ship, playerHealth);
    if (cheaserHealth > 0) cheaserHealthIndicator.update(cheaser, cheaserHealth);
    if (shooterHealth > 0) shooterHealthIndicator.update(shooter, shooterHealth);
    for (const enemy of spawnedEnemies) {
      enemy.healthIndicator.update(enemy.sprite, enemy.health);
    }
  };

  const keyboardControls = createKeyboardControls({ togglePause, pauseGame });
  publishHud();
  app.ticker.add(updatePlayer);
  app.start();

  let hasResized = false;
  const resize = () => {
    if (!app || isCancelled()) return;
    const previousWidth = Math.max(app.screen.width, 1);
    const previousHeight = Math.max(app.screen.height, 1);
    const previousShipPosition = { x: ship.x, y: ship.y };
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    app.renderer.resize(width, height);
    drawArenaScene(app, background, ship, islands, width, height);

    if (hasResized) {
      const scalePosition = (position: { x: number; y: number }) => ({
        x: (position.x / previousWidth) * width,
        y: (position.y / previousHeight) * height,
      });

      const repositionSprite = (sprite: Sprite, position: { x: number; y: number }) => {
        const halfExtents = rotatedHalfExtents(
          { width: sprite.width, height: sprite.height },
          sprite.rotation,
        );
        const bounded = clampToArena(scalePosition(position), halfExtents, { width, height });
        sprite.position.set(bounded.x, bounded.y);
      };

      repositionSprite(ship, previousShipPosition);
      repositionSprite(cheaser, { x: cheaser.x, y: cheaser.y });
      repositionSprite(shooter, { x: shooter.x, y: shooter.y });

      for (const enemy of spawnedEnemies) {
        repositionSprite(enemy.sprite, { x: enemy.sprite.x, y: enemy.sprite.y });
      }

      for (const projectile of [
        ...projectiles,
        ...shooterProjectiles,
        ...spawnedEnemyProjectiles,
      ]) {
        const position = scalePosition({ x: projectile.graphic.x, y: projectile.graphic.y });
        projectile.graphic.position.set(position.x, position.y);
      }
    }

    islands.forEach((island, index) => {
      islandRadii[index] = Math.sqrt(
        Math.pow((island.width * island.scale.x) / 2, 2) +
          Math.pow((island.height * island.scale.y) / 2, 2),
      );
    });
    hasResized = true;
  };

  const dispose = () => {
    cheaserRespawnRemaining = undefined;
    shooterRespawnRemaining = undefined;
    app.ticker.stop();
    if (typeof app.ticker.remove === 'function') {
      app.ticker.remove(updatePlayer);
    }

    keyboardControls.dispose();
    for (const effect of explosionEffects) app.stage.removeChild(effect.sprite);
    explosionEffects.length = 0;
  };

  return {
    resize,
    dispose,
    resume: resumeGame,
    togglePause,
    setVirtualKey: keyboardControls.setVirtualKey,
  };
}
