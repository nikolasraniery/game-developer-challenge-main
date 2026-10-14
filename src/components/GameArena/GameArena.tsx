import { useEffect, useRef, useState } from 'react';
import { Application, Assets, Graphics, Sprite, Texture, Ticker } from 'pixi.js';
import shipAsset from '../../../assets/png/default/ships/ship_1.png?url';
import islandAsset from '../../../assets/png/default/tiles/tile_50.png?url';

type Position = {
  x: number;
  y: number;
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
        const ship = new Sprite(shipTexture);
        ship.anchor.set(0.5);
        ship.width = 50;
        ship.height = 70;
        ship.rotation = 0.01;
        const shipRadius = Math.sqrt(Math.pow((ship.width / 2), 2) + Math.pow((ship.height / 2), 2));

        const islands = [new Sprite(islandTexture), new Sprite(islandTexture)];
        let islandRadius: number;
        for (const island of islands) {
          island.anchor.set(0.5);
          islandRadius = Math.sqrt(Math.pow((island.width / 2), 2) + Math.pow((island.height / 2), 2));
        }
        app.stage.addChild(background, ...islands, ship);

        const updatePlayer = (ticker: Ticker) => {
          const deltaSeconds = ticker.deltaMS / 1000;
          const rotationSpeed = 2;
          const movementSpeed = 100;
          const previousX = ship.x;
          const previousY = ship.y;

          const halfWidth =
            (Math.abs(Math.cos(ship.rotation)) * ship.width +
              Math.abs(Math.sin(ship.rotation)) * ship.height) / 2;

          const halfHeight =
            (Math.abs(Math.sin(ship.rotation)) * ship.width +
              Math.abs(Math.cos(ship.rotation)) * ship.height) / 2;


          if (keysPressed.has('ArrowRight') || keysPressed.has('KeyD')) {
            ship.rotation += rotationSpeed * deltaSeconds;
          };

          if (keysPressed.has('ArrowLeft') || keysPressed.has('KeyA')) {
            ship.rotation -= rotationSpeed * deltaSeconds;
          };

          if (keysPressed.has('ArrowUp') || keysPressed.has('KeyW')) {
            const directionX = -Math.sin(ship.rotation);
            const directionY = Math.cos(ship.rotation);



            ship.x += directionX * movementSpeed * deltaSeconds;
            ship.y += directionY * movementSpeed * deltaSeconds;

            for (const island of islands) {
              if (checkCollision(
                { x: ship.x, y: ship.y },
                shipRadius * 0.65,
                { x: island.x, y: island.y },
                islandRadius * 0.65
              )) {
                ship.x = previousX;
                ship.y = previousY;
              }
            }
          };

          ship.x = Math.max(
            halfWidth,
            Math.min(app!.screen.width - halfWidth, ship.x),
          );

          ship.y = Math.max(
            halfHeight,
            Math.min(app!.screen.height - halfHeight, ship.y),
          );
        };

        function checkCollision(positionA: Position, radiusA: number, positionB: Position, radiusB: number): boolean {
          const objectsDistance = Math.sqrt(Math.pow((positionB.x - positionA.x), 2) + Math.pow((positionB.y - positionA.y), 2));

          if ((radiusA + radiusB) >= objectsDistance) {
            return true;
          };
          return false;
        };

        app.ticker.add(updatePlayer);
        app.start();

        const resize = () => {
          if (!app || cancelled) return;
          const width = Math.max(host.clientWidth, 1);
          const height = Math.max(host.clientHeight, 1);
          app.renderer.resize(width, height);
          drawPreview(app, background, ship, islands, width, height);
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
