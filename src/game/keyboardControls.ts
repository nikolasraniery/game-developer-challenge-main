export type KeyboardControls = {
  keysPressed: Set<string>;
  readonly isFiringLeft: boolean;
  readonly isFiringRight: boolean;
  stopSideFire: () => void;
  releaseAll: () => void;
  setVirtualKey: (code: string, pressed: boolean) => void;
  dispose: () => void;
};

type KeyboardControlsOptions = {
  togglePause: () => void;
  pauseGame: () => void;
};

export function createKeyboardControls({
  togglePause,
  pauseGame,
}: KeyboardControlsOptions): KeyboardControls {
  const keysPressed = new Set<string>();
  let isFiringLeft = false;
  let isFiringRight = false;
  let disposed = false;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'Space') event.preventDefault();
    keysPressed.add(event.code);
  };
  const handleKeyUp = (event: KeyboardEvent) => {
    keysPressed.delete(event.code);
  };
  const handlePauseKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if ((key !== 'p' && key !== 'escape') || event.repeat) return;

    event.preventDefault();
    togglePause();
  };
  const handleWindowBlur = () => pauseGame();
  const handleVisibilityChange = () => {
    if (document.hidden) pauseGame();
  };
  const handleSideShotKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();

    if (key === 'q') {
      isFiringLeft = true;
      event.preventDefault();
    }
    if (key === 'e') {
      isFiringRight = true;
      event.preventDefault();
    }
  };
  const handleSideShotKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (key === 'q') isFiringLeft = false;
    if (key === 'e') isFiringRight = false;
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('keydown', handlePauseKeyDown);
  window.addEventListener('blur', handleWindowBlur);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('keydown', handleSideShotKeyDown);
  window.addEventListener('keyup', handleSideShotKeyUp);

  return {
    keysPressed,
    get isFiringLeft() {
      return isFiringLeft;
    },
    get isFiringRight() {
      return isFiringRight;
    },
    stopSideFire: () => {
      isFiringLeft = false;
      isFiringRight = false;
    },
    releaseAll: () => {
      keysPressed.clear();
      isFiringLeft = false;
      isFiringRight = false;
    },
    setVirtualKey: (code, pressed) => {
      if (pressed) keysPressed.add(code);
      else keysPressed.delete(code);

      if (code === 'KeyQ') isFiringLeft = pressed;
      if (code === 'KeyE') isFiringRight = pressed;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;

      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('keydown', handlePauseKeyDown);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleSideShotKeyDown);
      window.removeEventListener('keyup', handleSideShotKeyUp);
    },
  };
}
