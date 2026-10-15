import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONFIG } from '../../src/config/gameConfig';
import { GameArena } from '../../src/components/GameArena/GameArena';

const mockPixi = vi.hoisted(() => ({
  loadAsset: vi.fn(),
  initializeApplication: vi.fn(),
  destroyApplication: vi.fn(),
  applicationConstructor: vi.fn(),
  applications: [] as unknown[],
  sprites: [] as unknown[],
  projectileGraphics: [] as unknown[],
}));

let fullscreenElement: Element | null = null;
let requestFullscreenMock: ReturnType<typeof vi.fn>;
let exitFullscreenMock: ReturnType<typeof vi.fn>;
const fullscreenElementDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
const requestFullscreenDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'requestFullscreen',
);
const exitFullscreenDescriptor = Object.getOwnPropertyDescriptor(document, 'exitFullscreen');

vi.mock('pixi.js', () => {
  class DisplayObject {
    label = '';
    x = 0;
    y = 0;
    rotation = 0;
    width = 64;
    height = 64;
    visible = true;
    alpha = 1;
    anchor = { set: () => undefined };
    position = {
      set: (x: number, y: number) => {
        this.x = x;
        this.y = y;
      },
    };
    scale = {
      x: 1,
      y: 1,
      set: (x: number, y = x) => {
        this.scale.x = x;
        this.scale.y = y;
      },
    };
  }

  class Graphics extends DisplayObject {
    children: unknown[] = [];
    addChild(child: unknown) {
      this.children.push(child);
      return child;
    }
    clear() {
      return this;
    }
    rect() {
      return this;
    }
    roundRect() {
      return this;
    }
    moveTo() {
      return this;
    }
    quadraticCurveTo() {
      return this;
    }
    stroke() {
      return this;
    }
    fill() {
      return this;
    }
    circle() {
      mockPixi.projectileGraphics.push(this);
      return this;
    }
  }

  class Sprite extends DisplayObject {
    tint = 0xffffff;
    constructor() {
      super();
      mockPixi.sprites.push(this);
    }
  }

  class TilingSprite extends DisplayObject {
    tileScale = { x: 1, y: 1 };
    constructor(options: { width?: number; height?: number }) {
      super();
      this.width = options.width ?? 64;
      this.height = options.height ?? 64;
    }
  }

  class Ticker {
    callback: ((ticker: { deltaMS: number }) => void) | undefined;
    running = false;
    add(callback: (ticker: { deltaMS: number }) => void) {
      this.callback = callback;
    }
    start() {
      this.running = true;
    }
    stop() {
      this.running = false;
    }
    remove(callback: (ticker: { deltaMS: number }) => void) {
      if (this.callback === callback) this.callback = undefined;
    }
    tick(deltaMS: number) {
      if (this.running) this.callback?.({ deltaMS });
    }
  }

  class Application {
    canvas = document.createElement('canvas');
    screen = { width: 1, height: 1 };
    stage = {
      children: [] as unknown[],
      addChild: (...children: unknown[]) => {
        this.stage.children.push(...children);
      },
      removeChild: (child: unknown) => {
        this.stage.children = this.stage.children.filter((item) => item !== child);
      },
    };
    ticker = new Ticker();
    renderer = {
      resize: (width: number, height: number) => {
        this.screen.width = width;
        this.screen.height = height;
      },
      render: vi.fn(),
    };
    destroyed = false;

    constructor() {
      mockPixi.applicationConstructor();
      mockPixi.applications.push(this);
    }

    async init(options: { width: number; height: number }) {
      await mockPixi.initializeApplication();
      this.screen.width = options.width;
      this.screen.height = options.height;
    }
    start() {
      this.ticker.start();
    }
    destroy() {
      mockPixi.destroyApplication();
      this.destroyed = true;
      this.stage.children = [];
    }
  }

  return {
    Assets: { load: mockPixi.loadAsset },
    Application,
    Graphics,
    Sprite,
    TilingSprite,
    Texture: class {},
    Ticker,
  };
});

type TestApplication = {
  canvas: HTMLCanvasElement;
  screen: { width: number; height: number };
  stage: { children: unknown[] };
  ticker: {
    running: boolean;
    callback: ((ticker: { deltaMS: number }) => void) | undefined;
    tick: (deltaMS: number) => void;
  };
  destroyed: boolean;
};

type TestSprite = {
  x: number;
  y: number;
  position: { set: (x: number, y: number) => void };
};

const applications = () => mockPixi.applications as TestApplication[];
const sprites = () => mockPixi.sprites as TestSprite[];

let resizeObservers: Array<{ disconnected: boolean }> = [];

beforeEach(() => {
  mockPixi.loadAsset.mockReset().mockResolvedValue({});
  mockPixi.initializeApplication.mockReset().mockResolvedValue(undefined);
  mockPixi.destroyApplication.mockClear();
  mockPixi.applicationConstructor.mockClear();
  mockPixi.applications.length = 0;
  mockPixi.sprites.length = 0;
  mockPixi.projectileGraphics.length = 0;
  resizeObservers = [];
  fullscreenElement = null;
  requestFullscreenMock = vi.fn(() => {
    fullscreenElement = document.querySelector('[data-testid="arena-container"]');
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  });
  exitFullscreenMock = vi.fn(() => {
    fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  });

  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => fullscreenElement,
  });
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
    configurable: true,
    value: requestFullscreenMock,
  });
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    value: exitFullscreenMock,
  });

  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      disconnected = false;
      callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        resizeObservers.push(this);
      }
      observe() {}
      disconnect() {
        this.disconnected = true;
      }
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (fullscreenElementDescriptor) {
    Object.defineProperty(document, 'fullscreenElement', fullscreenElementDescriptor);
  } else {
    Reflect.deleteProperty(document, 'fullscreenElement');
  }
  if (requestFullscreenDescriptor) {
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', requestFullscreenDescriptor);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen');
  }
  if (exitFullscreenDescriptor) {
    Object.defineProperty(document, 'exitFullscreen', exitFullscreenDescriptor);
  } else {
    Reflect.deleteProperty(document, 'exitFullscreen');
  }
});

async function renderReadyArena(
  props: {
    durationSeconds?: number;
    spawnIntervalSeconds?: number;
    onReturnToMenu?: () => void;
    onMatchComplete?: (match: import('../../src/game/types').CompletedMatch) => void;
  } = {},
) {
  const result = render(<GameArena {...props} />);
  await screen.findByText('PixiJS ready');
  return { ...result, app: applications()[0]! };
}

describe('GameArena loading and resource lifecycle', () => {
  it('renders the accessible fullscreen control', async () => {
    await renderReadyArena();

    expect(screen.getByRole('button', { name: 'Tela cheia' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('enters and exits fullscreen from the arena control', async () => {
    await renderReadyArena();

    fireEvent.click(screen.getByRole('button', { name: 'Tela cheia' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sair da tela cheia' })).toBeVisible(),
    );
    expect(requestFullscreenMock).toHaveBeenCalledOnce();
    expect(fullscreenElement).toBe(screen.getByTestId('arena-container'));
    expect(screen.getByRole('button', { name: 'Sair da tela cheia' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sair da tela cheia' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tela cheia' })).toBeVisible());
    expect(exitFullscreenMock).toHaveBeenCalledOnce();
    expect(fullscreenElement).toBeNull();
  });

  it('reports entry and exit failures without changing the actual fullscreen state', async () => {
    await renderReadyArena();
    requestFullscreenMock.mockRejectedValueOnce(new Error('denied'));

    fireEvent.click(screen.getByRole('button', { name: 'Tela cheia' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível entrar em tela cheia neste navegador.',
    );
    expect(screen.getByRole('button', { name: 'Tela cheia' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    fullscreenElement = screen.getByTestId('arena-container');
    document.dispatchEvent(new Event('fullscreenchange'));
    await screen.findByRole('button', { name: 'Sair da tela cheia' });
    exitFullscreenMock.mockRejectedValueOnce(new Error('denied'));

    fireEvent.click(screen.getByRole('button', { name: 'Sair da tela cheia' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível sair da tela cheia.',
    );
    expect(screen.getByRole('button', { name: 'Sair da tela cheia' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('removes the fullscreenchange listener when unmounted', async () => {
    const addListener = vi.spyOn(document, 'addEventListener');
    const removeListener = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<GameArena />);
    await screen.findByText('PixiJS ready');

    const registration = addListener.mock.calls.find(([type]) => type === 'fullscreenchange');
    expect(registration).toBeDefined();

    unmount();

    expect(removeListener).toHaveBeenCalledWith('fullscreenchange', registration?.[1]);
  });

  it('announces loading before the supplied assets finish loading', () => {
    mockPixi.loadAsset.mockImplementation(() => new Promise(() => {}));

    render(<GameArena />);

    expect(screen.getByText('Loading the game arena…')).toBeVisible();
    expect(screen.getByText('Loading assets')).toBeVisible();
  });

  it('shows an accessible error if an asset fails to load', async () => {
    mockPixi.loadAsset.mockRejectedValue(new Error('texture unavailable'));

    render(<GameArena />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The game arena could not be initialized. texture unavailable',
    );
    expect(screen.getByText('Needs attention')).toBeVisible();
  });

  it('does not create an application or canvas when unmounted during asset loading', async () => {
    const pendingLoads: Array<(texture: object) => void> = [];
    mockPixi.loadAsset.mockImplementation(
      () =>
        new Promise((resolve) => {
          pendingLoads.push(resolve);
        }),
    );

    const { unmount } = render(<GameArena />);
    unmount();

    await act(async () => {
      pendingLoads.forEach((resolve) => resolve({}));
      await Promise.resolve();
    });

    expect(mockPixi.applicationConstructor).not.toHaveBeenCalled();
    expect(document.querySelector('canvas.arena-canvas')).toBeNull();
  });

  it('destroys Pixi only once when unmounted while initialization is pending', async () => {
    let finishInitialization: (() => void) | undefined;
    mockPixi.initializeApplication.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishInitialization = resolve;
        }),
    );

    const { unmount } = render(<GameArena />);
    await waitFor(() => expect(mockPixi.initializeApplication).toHaveBeenCalledOnce());
    const app = applications()[0]!;

    unmount();
    expect(mockPixi.destroyApplication).toHaveBeenCalledOnce();

    await act(async () => {
      finishInitialization?.();
      await Promise.resolve();
    });

    expect(mockPixi.destroyApplication).toHaveBeenCalledOnce();
    expect(app.destroyed).toBe(true);
    expect(app.canvas.isConnected).toBe(false);
    expect(app.ticker.running).toBe(false);
    expect(app.ticker.callback).toBeUndefined();
  });

  it('destroys Pixi and disconnects the observer on unmount', async () => {
    const { app, unmount } = await renderReadyArena();
    expect(app.canvas.isConnected).toBe(true);
    const projectileCount = mockPixi.projectileGraphics.length;

    unmount();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
      app.ticker.tick(1_000);
    });

    expect(app.destroyed).toBe(true);
    expect(app.canvas.isConnected).toBe(false);
    expect(app.ticker.running).toBe(false);
    expect(app.ticker.callback).toBeUndefined();
    expect(mockPixi.projectileGraphics).toHaveLength(projectileCount);
    expect(resizeObservers).toHaveLength(1);
    expect(resizeObservers[0]?.disconnected).toBe(true);
  });

  it('preserves the paused match and HUD while resizing the arena', async () => {
    const { app } = await renderReadyArena();
    const ship = sprites()[0]!;
    ship.position.set(200, 200);
    const arenaFrame = app.canvas.parentElement!;
    Object.defineProperty(arenaFrame, 'clientWidth', { configurable: true, value: 1_200 });
    Object.defineProperty(arenaFrame, 'clientHeight', { configurable: true, value: 900 });

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' })));
    act(() => {
      const observer = resizeObservers[0] as unknown as {
        callback: ResizeObserverCallback;
        notify: () => void;
      };
      observer.callback([], observer as unknown as ResizeObserver);
    });

    expect(app.screen).toEqual({ width: 1_200, height: 900 });
    expect(ship.x).toBe(300);
    expect(ship.y).toBe(300);
    expect(screen.getByTestId('game-state')).toHaveTextContent('paused');
    expect(screen.getByTestId('hud-health')).toHaveTextContent(
      String(GAME_CONFIG.player.initialHealth),
    );
    expect(screen.getByTestId('hud-score')).toHaveTextContent('0');
    expect(screen.getByTestId('hud-time')).toHaveTextContent('01:00');
    expect(
      app.stage.children.filter((child) =>
        (child as { label?: string }).label?.startsWith('health-'),
      ),
    ).toHaveLength(3);
  });

  it('does not create duplicate canvases when React StrictMode remounts the effect', async () => {
    const { container } = render(
      <StrictMode>
        <GameArena />
      </StrictMode>,
    );

    await screen.findByText('PixiJS ready');

    expect(mockPixi.applications).toHaveLength(1);
    expect(container.querySelectorAll('canvas.arena-canvas')).toHaveLength(1);
  });
});

describe('GameArena game loop', () => {
  it('shows the initial gameplay values in the HUD', async () => {
    await renderReadyArena();

    expect(screen.getByTestId('hud-health')).toHaveTextContent(
      String(GAME_CONFIG.player.initialHealth),
    );
    expect(screen.getByTestId('hud-score')).toHaveTextContent('0');
    expect(screen.getByTestId('hud-time')).toHaveTextContent('01:00');
  });

  it('applies the selected duration to a fresh runtime', async () => {
    await renderReadyArena({ durationSeconds: 120, spawnIntervalSeconds: 3 });
    expect(screen.getByTestId('hud-time')).toHaveTextContent('02:00');
  });

  it('records one completed match with the runtime result when time expires', async () => {
    const onMatchComplete = vi.fn();
    const { app } = await renderReadyArena({ durationSeconds: 1, onMatchComplete });

    act(() => app.ticker.tick(1_000));

    expect(onMatchComplete).toHaveBeenCalledTimes(1);
    expect(onMatchComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: 'local-captain',
        score: 0,
        configuredDurationSeconds: 1,
        durationPlayedSeconds: 1,
        endReason: 'time',
        configuration: {
          durationSeconds: 1,
          spawnIntervalSeconds: GAME_CONFIG.enemies.spawnIntervalSeconds,
        },
      }),
    );
    expect(screen.getByTestId('match-submission-status')).toHaveTextContent('Salvando resultado');
    expect(screen.getByText(/Tempo jogado: 1s/)).toBeVisible();
  });

  it('fires once while Space is held and fires again after release', async () => {
    const { app } = await renderReadyArena();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
      app.ticker.tick(16);
      app.ticker.tick(16);
    });
    expect(mockPixi.projectileGraphics).toHaveLength(1);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' }));
      app.ticker.tick(16);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
      app.ticker.tick(16);
    });
    expect(mockPixi.projectileGraphics).toHaveLength(2);
  });

  it('respects the Shooter fire interval and pauses its timer during pause', async () => {
    const { app } = await renderReadyArena();
    const timer = screen.getByTestId('hud-time');

    act(() => {
      app.ticker.tick(500);
      app.ticker.tick(490);
    });
    expect(mockPixi.projectileGraphics).toHaveLength(0);

    act(() => app.ticker.tick(20));
    expect(mockPixi.projectileGraphics).toHaveLength(1);
    const timerBeforePause = timer.textContent;

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
      app.ticker.tick(5_000);
    });
    expect(app.ticker.running).toBe(false);
    expect(timer.textContent).toBe(timerBeforePause);
    expect(screen.getByText('Partida pausada')).toBeVisible();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
      app.ticker.tick(1_000);
    });
    expect(app.ticker.running).toBe(true);
    expect(timer.textContent).toBe('00:58');
    expect(screen.queryByText('Partida pausada')).toBeNull();
  });

  it('resumes the paused match from the arena overlay button', async () => {
    const { app } = await renderReadyArena();

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' })));
    expect(screen.getByTestId('game-state')).toHaveTextContent('paused');
    expect(app.ticker.running).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByTestId('game-state')).toHaveTextContent('playing');
    expect(app.ticker.running).toBe(true);
    expect(screen.queryByText('Partida pausada')).toBeNull();
  });

  it('does not resume held movement after an automatic focus pause', async () => {
    const { app } = await renderReadyArena();
    const ship = sprites()[0]!;
    ship.position.set(300, 300);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
      app.ticker.tick(100);
    });
    const pausedPosition = { x: ship.x, y: ship.y };

    act(() => window.dispatchEvent(new Event('blur')));
    expect(screen.getByTestId('game-state')).toHaveTextContent('paused');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
      app.ticker.tick(100);
    });

    expect(screen.getByTestId('game-state')).toHaveTextContent('playing');
    expect({ x: ship.x, y: ship.y }).toEqual(pausedPosition);
  });

  it('removes a player projectile when it hits an island', async () => {
    const { app } = await renderReadyArena();
    const [ship, , , island] = sprites();
    ship!.position.set(island!.x, island!.y + 80);
    (ship as TestSprite & { rotation: number }).rotation = Math.PI;

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
      app.ticker.tick(16);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' }));
      app.ticker.tick(300);
    });

    const projectile = mockPixi.projectileGraphics[0];
    expect(projectile).toBeDefined();
    expect(app.stage.children).not.toContain(projectile);
    expect(screen.getByTestId('hud-score')).toHaveTextContent('0');
  });

  it('moves the Shooter toward the player and stops at its firing distance', async () => {
    const { app } = await renderReadyArena();
    const [ship, , shooter] = sprites();
    const initialDistance = Math.hypot(ship!.x - shooter!.x, ship!.y - shooter!.y);

    act(() => app.ticker.tick(500));

    const updatedDistance = Math.hypot(ship!.x - shooter!.x, ship!.y - shooter!.y);
    expect(updatedDistance).toBeLessThan(initialDistance);
    expect(updatedDistance).toBeGreaterThanOrEqual(GAME_CONFIG.shooter.preferredDistance - 1);
  });

  it('removes an enemy projectile when it hits an island', async () => {
    const { app } = await renderReadyArena();
    const [, , shooter, island] = sprites();
    shooter!.position.set(island!.x, island!.y + 80);
    const ship = sprites()[0]!;
    ship.position.set(island!.x, island!.y - 100);

    act(() => {
      for (let frame = 0; frame < 11; frame += 1) app.ticker.tick(100);
    });

    const projectile = mockPixi.projectileGraphics[0];
    expect(projectile).toBeDefined();
    expect(app.stage.children).not.toContain(projectile);
    expect(screen.getByTestId('hud-health')).toHaveTextContent(
      String(GAME_CONFIG.player.initialHealth),
    );
  });

  it('pauses the Chaser respawn countdown with the rest of the match', async () => {
    const { app } = await renderReadyArena();
    const [ship, chaser] = sprites();

    for (let shot = 0; shot < GAME_CONFIG.enemies.initialHealth; shot += 1) {
      chaser!.position.set(ship!.x, ship!.y + 75);
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
        app.ticker.tick(16);
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' }));
        app.ticker.tick(100);
      });
    }

    expect(app.stage.children).not.toContain(chaser);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' })));
    act(() => app.ticker.tick(2_000));
    expect(app.stage.children).not.toContain(chaser);

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' })));
    act(() => app.ticker.tick(GAME_CONFIG.enemies.respawnDelayMs - 1));
    expect(app.stage.children).not.toContain(chaser);

    act(() => app.ticker.tick(5));
    expect(app.stage.children).toContain(chaser);
  });

  it('moves the ship while a touch control is held and stops on release', async () => {
    const { app } = await renderReadyArena();
    const ship = sprites()[0]!;
    ship.position.set(300, 300);
    const forwardButton = screen.getByRole('button', { name: 'Mover para frente' });

    fireEvent.pointerDown(forwardButton);
    act(() => app.ticker.tick(100));
    expect(ship.y).toBeCloseTo(310);

    fireEvent.pointerUp(forwardButton);
    act(() => app.ticker.tick(100));
    expect(ship.y).toBeCloseTo(310);
  });

  it('keeps the Shooter active while the base Chaser is waiting to respawn', async () => {
    const { app } = await renderReadyArena();
    const [ship, chaser, shooter] = sprites();

    for (let shot = 0; shot < GAME_CONFIG.enemies.initialHealth; shot += 1) {
      chaser!.position.set(ship!.x, ship!.y + 75);
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
        app.ticker.tick(16);
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' }));
        app.ticker.tick(100);
      });
    }

    expect(app.stage.children).not.toContain(chaser);
    const distanceBefore = Math.hypot(ship!.x - shooter!.x, ship!.y - shooter!.y);

    act(() => app.ticker.tick(400));

    expect(app.stage.children).not.toContain(chaser);
    expect(Math.hypot(ship!.x - shooter!.x, ship!.y - shooter!.y)).toBeLessThan(distanceBefore);
  });

  it('applies player damage once during the damage cooldown', async () => {
    const { app } = await renderReadyArena();
    const [ship, chaser] = sprites();
    const health = screen.getByTestId('hud-health');

    chaser!.position.set(ship!.x, ship!.y);

    act(() => app.ticker.tick(16));
    expect(health).toHaveTextContent(String(GAME_CONFIG.player.initialHealth - 1));

    act(() => app.ticker.tick(500));
    expect(health).toHaveTextContent(String(GAME_CONFIG.player.initialHealth - 1));
  });

  it('removes each player projectile after one hit and awards one point for a defeated Chaser', async () => {
    const { app } = await renderReadyArena();
    const [ship, chaser] = sprites();
    const score = screen.getByTestId('hud-score');

    for (let shot = 0; shot < GAME_CONFIG.enemies.initialHealth; shot += 1) {
      chaser!.position.set(ship!.x, ship!.y + 75);

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
        app.ticker.tick(16);
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' }));
        app.ticker.tick(100);
      });
    }

    expect(score).toHaveTextContent('1');
    expect(app.stage.children).not.toContain(chaser);
    expect(mockPixi.projectileGraphics).toHaveLength(GAME_CONFIG.enemies.initialHealth);
    expect(app.stage.children).not.toContain(mockPixi.projectileGraphics.at(-1));

    act(() => app.ticker.tick(16));
    expect(score).toHaveTextContent('1');
  });

  it('awards one point for a defeated Shooter without scoring again on later frames', async () => {
    const { app } = await renderReadyArena();
    const [ship, chaser, shooter] = sprites();
    const score = screen.getByTestId('hud-score');

    chaser!.position.set(100, 100);
    for (let shot = 0; shot < GAME_CONFIG.enemies.initialHealth; shot += 1) {
      shooter!.position.set(ship!.x, ship!.y + 75);
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
        app.ticker.tick(16);
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' }));
        app.ticker.tick(100);
      });
    }

    expect(score).toHaveTextContent('1');
    expect(app.stage.children).not.toContain(shooter);
    act(() => app.ticker.tick(16));
    expect(score).toHaveTextContent('1');
  });

  it('ends the match at zero health and starts a fresh session on restart', async () => {
    const { app } = await renderReadyArena();
    const [ship, chaser] = sprites();
    const health = screen.getByTestId('hud-health');
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    vi.useFakeTimers();

    for (let hit = 0; hit < GAME_CONFIG.player.initialHealth; hit += 1) {
      if (hit > 0) act(() => app.ticker.tick(1_000));
      chaser!.position.set(ship!.x, ship!.y);
      act(() => app.ticker.tick(1_000));
    }

    expect(health).toHaveTextContent('0');
    expect(screen.getByTestId('game-state')).toHaveTextContent('gameOver');
    expect(screen.getByRole('button', { name: 'Jogar novamente' })).toBeVisible();
    expect(app.ticker.running).toBe(false);

    const projectileCountAtGameOver = mockPixi.projectileGraphics.length;
    const playerPositionAtGameOver = { x: ship!.x, y: ship!.y };
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
      app.ticker.tick(1_000);
    });
    expect({ x: ship!.x, y: ship!.y }).toEqual(playerPositionAtGameOver);
    expect(mockPixi.projectileGraphics).toHaveLength(projectileCountAtGameOver);
    expect(health).toHaveTextContent('0');

    fireEvent.click(screen.getByRole('button', { name: 'Jogar novamente' }));
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(app.destroyed).toBe(true);
    expect(mockPixi.applications).toHaveLength(2);
    expect(screen.getByTestId('game-state')).toHaveTextContent('playing');
    expect(screen.queryByRole('button', { name: 'Jogar novamente' })).toBeNull();
    expect(document.querySelectorAll('canvas.arena-canvas')).toHaveLength(1);
    expect(screen.getByTestId('hud-score')).toHaveTextContent('0');
    expect(screen.getByTestId('hud-health')).toHaveTextContent(
      String(GAME_CONFIG.player.initialHealth),
    );
    expect(screen.getByTestId('hud-time')).toHaveTextContent('01:00');
  });

  it('ends the match when the configured active time expires', async () => {
    const { app } = await renderReadyArena();
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    act(() => app.ticker.tick(GAME_CONFIG.match.durationSeconds * 1_000));

    expect(screen.getByTestId('game-state')).toHaveTextContent('gameOver');
    expect(screen.getByText('Tempo esgotado!')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Jogar novamente' })).toBeVisible();
    expect(app.ticker.running).toBe(false);
  });

  it('allows returning to the menu after a finished match', async () => {
    const onReturnToMenu = vi.fn();
    const { app } = await renderReadyArena({ durationSeconds: 1, onReturnToMenu });

    act(() => app.ticker.tick(1_000));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao menu' }));

    expect(onReturnToMenu).toHaveBeenCalledOnce();
    expect(app.ticker.running).toBe(false);
  });

  it('does not spawn or fire during the frame that ends the match', async () => {
    const { app } = await renderReadyArena();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));
      app.ticker.tick(GAME_CONFIG.match.durationSeconds * 1_000);
    });

    expect(screen.getByTestId('game-state')).toHaveTextContent('gameOver');
    expect(mockPixi.projectileGraphics).toHaveLength(0);
    expect(sprites()).toHaveLength(5);
    expect(app.ticker.running).toBe(false);
  });
});
