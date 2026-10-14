import { useEffect, useRef, useState } from 'react';
import { Application, Assets, Graphics, Sprite, Texture, Ticker, Text } from 'pixi.js';
import shipAsset from '../../../assets/png/default/ships/ship_1.png?url';
import islandAsset from '../../../assets/png/default/tiles/tile_50.png?url';

type Position = {
  x: number;
  y: number;
};

type Projectile = {
  graphic: Graphics;
  directionX: number;
  directionY: number;
};

function drawPreview(
  app: Application,
  background: Graphics,
  ship: Sprite,
  islands: Sprite[],
  width: number,
  height: number,
) {
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  background.clear().rect(0, 0, safeWidth, safeHeight).fill(0x0a3549);

  for (let row = 0; row < 7; row += 1) {
    const y = ((row + 1) * safeHeight) / 8;
    const offset = row % 2 === 0 ? 0 : 32;
    for (let column = 0; column < 9; column += 1) {
      const x = ((column + 0.5) * safeWidth) / 9 + offset;
      background
        .moveTo(x - 9, y)
        .quadraticCurveTo(x, y - 5, x + 9, y)
        .stroke({ color: 0x5f9c9f, alpha: 0.18, width: 1.5 });
    }
  }

  background
    .roundRect(20, 20, Math.max(safeWidth - 40, 1), Math.max(safeHeight - 40, 1), 18)
    .stroke({ color: 0xb2d6b8, alpha: 0.2, width: 2 });

  islands.forEach((island, index) => {
    const positions = [
      { x: safeWidth * 0.25, y: safeHeight * 0.35, scale: 0.78 },
      { x: safeWidth * 0.76, y: safeHeight * 0.68, scale: 0.62 },
    ];
    const position = positions[index];
    if (!position) return;
    island.position.set(position.x, position.y);
    island.scale.set(position.scale);
  });

  ship.position.set(safeWidth * 0.51, safeHeight * 0.53);
  app.renderer.render(app.stage);
}

export function GameArena() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    let app: Application | undefined;
    let respawnTimeout: number | undefined;
    let shooterRespawnTimeout: number | undefined;

    const keysPressed = new Set<string>();

    const handleKeyDown = (event: KeyboardEvent) => {
      keysPressed.add(event.code);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      keysPressed.delete(event.code);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const initialize = async () => {
      try {
        const [shipTexture, islandTexture] = await Promise.all([
          Assets.load<Texture>(shipAsset),
          Assets.load<Texture>(islandAsset),
        ]);
        if (cancelled) return;

        app = new Application();
        await app.init({
          width: Math.max(host.clientWidth, 1),
          height: Math.max(host.clientHeight, 1),
          background: '#0a3549',
          antialias: true,
          autoDensity: true,
          autoStart: false,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          preference: 'webgl',
        });
        if (cancelled) {
          app.destroy(true, { children: true });
          return;
        }

        app.canvas.setAttribute('aria-label', 'Static Pirate Battle arena preview');
        app.canvas.className = 'arena-canvas';
        host.appendChild(app.canvas);

        const background = new Graphics();

        const projectiles: Projectile[] = [];
        const shooterProjectiles: Projectile[] = [];

        const projectileSpeed = 300;
        const shooterProjectileSpeed = 220;
        const shooterFireInterval = 1.5;
        let shooterFireCooldown = 1.0;

        const contactDamage = 1;
        const damageCooldownDuration = 1;
        let damageCooldown = 0;

        const cheaserSpeed = 45;
        let spaceWasPressed = false;
        const ship = new Sprite(shipTexture);
        ship.anchor.set(0.5);
        ship.width = 50;
        ship.height = 70;
        ship.rotation = 0.01;
        let playerHealth = 5;
        let isGameOver = false;
        const shipRadius = Math.sqrt(Math.pow(ship.width / 2, 2) + Math.pow(ship.height / 2, 2));

        const cheaser = new Sprite(shipTexture);
        cheaser.anchor.set(0.5);
        cheaser.width = 50;
        cheaser.height = 70;
        cheaser.position.set(app.screen.width * 0.75, app.screen.height * 0.5);
        let cheaserHealth = 3;
        const shooter = new Sprite(shipTexture);
        shooter.anchor.set(0.5);
        shooter.width = 50;
        shooter.height = 70;
        shooter.position.set(app.screen.width * 0.75, app.screen.height * 0.25);
        shooter.tint = 0xffa04a;

        let shooterHealth = 3;
        const shooterRadius = Math.sqrt(
          Math.pow(shooter.width / 2, 2) + Math.pow(shooter.height / 2, 2),
        );
        let score = 0;
        const scoreText = new Text({
          text: `Pontuação: ${score}`,
          style: {
            fill: '#ffffff',
            fontSize: 20,
          },
        });
        scoreText.position.set(30, 30);
        const healthText = new Text({
          text: `Vida: ${playerHealth}`,
          style: {
            fill: '#ffffff',
            fontSize: 20,
          },
        });
        healthText.position.set(30, 60);
        const gameOverText = new Text({
          text: 'GAME OVER',
          style: {
            fill: '#ff5555',
            fontSize: 42,
            fontWeight: 'bold',
          },
        });

        gameOverText.anchor.set(0.5);
        gameOverText.position.set(app.screen.width / 2, app.screen.height / 2);
        gameOverText.visible = false;

        function endGame() {
          if (isGameOver) return;

          isGameOver = true;
          gameOverText.visible = true;
        }

        const cheaserRadius = Math.sqrt(
          Math.pow(cheaser.width / 2, 2) + Math.pow(cheaser.height / 2, 2),
        );

        function respawnCheaser() {
          respawnTimeout = window.setTimeout(() => {
            if (cancelled || !app || isGameOver) return;

            const position = getRandomEnemyPosition(cheaserRadius, shooter);

            if (!position) return;

            cheaser.position.set(position.x, position.y);

            cheaserHealth = 3;
            app.stage.addChild(cheaser);
          }, 800);
        }

        function respawnShooter() {
          shooterRespawnTimeout = window.setTimeout(() => {
            if (cancelled || !app || isGameOver) return;

            const position = getRandomEnemyPosition(shooterRadius, cheaser);

            if (!position) return;

            shooterHealth = 3;

            shooter.position.set(position.x, position.y);

            app.stage.addChild(shooter);
          }, 800);
        }

        const islands = [new Sprite(islandTexture), new Sprite(islandTexture)];

        for (const island of islands) {
          island.anchor.set(0.5);
        }

        const islandRadii = islands.map((island) =>
          Math.sqrt(
            Math.pow((island.width * island.scale.x) / 2, 2) +
              Math.pow((island.height * island.scale.y) / 2, 2),
          ),
        );

        app.stage.addChild(
          background,
          ...islands,
          ship,
          cheaser,
          shooter,
          scoreText,
          healthText,
          gameOverText,
        );

        function createProjectile(app: Application | undefined, ship: Sprite, color = 0xffffff) {
          const d = ship.height / 2 + 5;

          const directionX = -Math.sin(ship.rotation);
          const directionY = Math.cos(ship.rotation);

          const projectile: Projectile = {
            graphic: new Graphics(),
            directionX,
            directionY,
          };

          projectile.graphic.x = ship.x + directionX * d;
          projectile.graphic.y = ship.y + directionY * d;

          projectile.graphic.circle(0, 0, 5).fill(color);
          app?.stage.addChild(projectile.graphic);

          return projectile;
        }

        const updatePlayer = (ticker: Ticker) => {
          if (isGameOver) return;
          const deltaSeconds = ticker.deltaMS / 1000;
          damageCooldown = Math.max(0, damageCooldown - deltaSeconds);
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
              playerHealth = Math.max(0, playerHealth - contactDamage);

              app!.stage.removeChild(cheaser);
              respawnCheaser();

              healthText.text = `Vida: ${playerHealth}`;

              if (playerHealth === 0) {
                endGame();
              }

              damageCooldown = damageCooldownDuration;
            }

            if (shooterHealth > 0) {
              const dx = ship.x - shooter.x;
              const dy = ship.y - shooter.y;
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance > 0) {
                shooter.rotation = Math.atan2(-dx, dy);
              }

              shooterFireCooldown -= deltaSeconds;

              if (shooterFireCooldown <= 0) {
                const projectile = createProjectile(app, shooter, 0xffa04a);

                shooterProjectiles.push(projectile);
                shooterFireCooldown = shooterFireInterval;
              }
            }
          }
          const rotationSpeed = 2;
          const movementSpeed = 100;
          const previousX = ship.x;
          const previousY = ship.y;

          const halfWidth =
            (Math.abs(Math.cos(ship.rotation)) * ship.width +
              Math.abs(Math.sin(ship.rotation)) * ship.height) /
            2;

          const halfHeight =
            (Math.abs(Math.sin(ship.rotation)) * ship.width +
              Math.abs(Math.cos(ship.rotation)) * ship.height) /
            2;

          if (keysPressed.has('ArrowRight') || keysPressed.has('KeyD')) {
            ship.rotation += rotationSpeed * deltaSeconds;
          }

          if (keysPressed.has('ArrowLeft') || keysPressed.has('KeyA')) {
            ship.rotation -= rotationSpeed * deltaSeconds;
          }

          if (keysPressed.has('ArrowUp') || keysPressed.has('KeyW')) {
            const directionX = -Math.sin(ship.rotation);
            const directionY = Math.cos(ship.rotation);

            ship.x += directionX * movementSpeed * deltaSeconds;
            ship.y += directionY * movementSpeed * deltaSeconds;

            for (let i = 0; i < islands.length; i += 1) {
              const island = islands[i];

              if (
                checkCollision(
                  { x: ship.x, y: ship.y },
                  shipRadius * 0.65,
                  { x: island.x, y: island.y },
                  islandRadii[i] * 0.65,
                )
              ) {
                ship.x = previousX;
                ship.y = previousY;
              }
            }
          }

          const spaceIsPressed = keysPressed.has('Space');

          if (spaceIsPressed && !spaceWasPressed) {
            const projectile = createProjectile(app, ship);
            projectiles.push(projectile);
          }

          spaceWasPressed = spaceIsPressed;

          for (let i = projectiles.length - 1; i >= 0; i -= 1) {
            projectiles[i].graphic.x += projectiles[i].directionX * projectileSpeed * deltaSeconds;
            projectiles[i].graphic.y += projectiles[i].directionY * projectileSpeed * deltaSeconds;

            if (
              cheaserHealth > 0 &&
              checkCollision(
                { x: projectiles[i].graphic.x, y: projectiles[i].graphic.y },
                5,
                { x: cheaser.x, y: cheaser.y },
                cheaserRadius,
              )
            ) {
              cheaserHealth -= 1;

              app!.stage.removeChild(projectiles[i].graphic);
              projectiles.splice(i, 1);

              if (cheaserHealth === 0) {
                app!.stage.removeChild(cheaser);
                score += 1;
                scoreText.text = `Pontuação: ${score}`;

                respawnCheaser();
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
                5,
                { x: shooter.x, y: shooter.y },
                shooterRadius,
              )
            ) {
              shooterHealth -= 1;

              app!.stage.removeChild(projectiles[i].graphic);
              projectiles.splice(i, 1);

              if (shooterHealth === 0) {
                app!.stage.removeChild(shooter);
                score += 1;
                scoreText.text = `Pontuação: ${score}`;

                respawnShooter();
              }

              continue;
            }

            if (
              projectiles[i].graphic.x < 0 ||
              projectiles[i].graphic.x > app!.screen.width ||
              projectiles[i].graphic.y < 0 ||
              projectiles[i].graphic.y > app!.screen.height
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

            const outOfBounds =
              projectile.graphic.x < 0 ||
              projectile.graphic.x > app!.screen.width ||
              projectile.graphic.y < 0 ||
              projectile.graphic.y > app!.screen.height;

            if (hitPlayer && damageCooldown === 0) {
              playerHealth = Math.max(0, playerHealth - 1);

              healthText.text = `Vida: ${playerHealth}`;

              if (playerHealth === 0) {
                endGame();
              }

              damageCooldown = damageCooldownDuration;
            }

            if (hitPlayer || outOfBounds) {
              app!.stage.removeChild(projectile.graphic);
              shooterProjectiles.splice(i, 1);
            }
          }

          ship.x = Math.max(halfWidth, Math.min(app!.screen.width - halfWidth, ship.x));

          ship.y = Math.max(halfHeight, Math.min(app!.screen.height - halfHeight, ship.y));
        };

        function getRandomEnemyPosition(enemyRadius: number, otherEnemy: Sprite): Position | null {
          const margin = enemyRadius;
          const maxAttempts = 100;

          for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const position = {
              x: margin + Math.random() * (app!.screen.width - margin * 2),
              y: margin + Math.random() * (app!.screen.height - margin * 2),
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
                islandRadii[index],
              ),
            );

            if (!overlapsShip && !overlapsOtherEnemy && !overlapsIsland) {
              return position;
            }
          }

          // Não encontrou uma posição livre após todas as tentativas.
          return null;
        }

        function checkCollision(
          positionA: Position,
          radiusA: number,
          positionB: Position,
          radiusB: number,
        ): boolean {
          const objectsDistance = Math.sqrt(
            Math.pow(positionB.x - positionA.x, 2) + Math.pow(positionB.y - positionA.y, 2),
          );

          if (radiusA + radiusB >= objectsDistance) {
            return true;
          }
          return false;
        }

        app.ticker.add(updatePlayer);
        app.start();

        const resize = () => {
          if (!app || cancelled) return;
          const width = Math.max(host.clientWidth, 1);
          const height = Math.max(host.clientHeight, 1);
          app.renderer.resize(width, height);
          drawPreview(app, background, ship, islands, width, height);
          islands.forEach((island, index) => {
            islandRadii[index] = Math.sqrt(
              Math.pow((island.width * island.scale.x) / 2, 2) +
                Math.pow((island.height * island.scale.y) / 2, 2),
            );
          });
        };

        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
        resize();
        setIsReady(true);
      } catch (error: unknown) {
        if (!cancelled) {
          const detail = error instanceof Error ? error.message : 'Unknown rendering error';
          setErrorMessage(`The arena preview could not be initialized. ${detail}`);
        }
        if (app) {
          app.destroy(true, { children: true });
          app = undefined;
        }
      }
    };

    void initialize();

    return () => {
      cancelled = true;
      if (respawnTimeout !== undefined) {
        window.clearTimeout(respawnTimeout);
      }
      if (shooterRespawnTimeout !== undefined) {
        window.clearTimeout(shooterRespawnTimeout);
      }
      resizeObserver?.disconnect();
      if (app) {
        if (host.contains(app.canvas)) host.removeChild(app.canvas);
        app.destroy(true, { children: true });
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <section className="arena-card" aria-labelledby="arena-heading">
      <div className="arena-heading-row">
        <div>
          <div className="section-kicker">RENDERING TEST</div>
          <h2 id="arena-heading">Arena preview</h2>
        </div>
        <span className={`render-badge${isReady ? ' is-ready' : ''}`} role="status">
          <span className="status-indicator" aria-hidden="true" />
          {isReady ? 'PixiJS ready' : errorMessage ? 'Needs attention' : 'Loading assets'}
        </span>
      </div>
      <div className="arena-frame" ref={hostRef}>
        {!isReady && !errorMessage && (
          <p className="arena-message">Loading supplied ship and island art…</p>
        )}
        {errorMessage && (
          <p className="arena-message status-error" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
      <p className="arena-caption">
        Static scene for setup verification. Gameplay systems are not implemented.
      </p>
    </section>
  );
}
