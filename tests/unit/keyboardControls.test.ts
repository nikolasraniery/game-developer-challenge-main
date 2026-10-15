import { afterEach, describe, expect, it, vi } from 'vitest';
import { createKeyboardControls } from '../../src/game/keyboardControls';

describe('keyboard controls', () => {
  const activeControls: ReturnType<typeof createKeyboardControls>[] = [];

  const createControls = (options = { togglePause: vi.fn(), pauseGame: vi.fn() }) => {
    const controls = createKeyboardControls(options);
    activeControls.push(controls);
    return { controls, ...options };
  };

  afterEach(() => {
    activeControls.splice(0).forEach((controls) => controls.dispose());
    vi.restoreAllMocks();
  });

  it('tracks movement and Space keys, and tracks the side-shot keys until release', () => {
    const { controls } = createControls();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
    const spacePress = new KeyboardEvent('keydown', { code: 'Space', cancelable: true });
    window.dispatchEvent(spacePress);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'q' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e' }));

    expect(controls.keysPressed).toEqual(new Set(['ArrowUp', 'Space', 'KeyQ', 'KeyE']));
    expect(spacePress.defaultPrevented).toBe(true);
    expect(controls.isFiringLeft).toBe(true);
    expect(controls.isFiringRight).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', key: 'q' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e' }));

    expect(controls.keysPressed.has('ArrowUp')).toBe(false);
    expect(controls.keysPressed.has('Space')).toBe(true);
    expect(controls.isFiringLeft).toBe(false);
    expect(controls.isFiringRight).toBe(false);
  });

  it('clears keyboard and side-fire inputs when a pause ends the active input context', () => {
    const { controls } = createControls();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));

    controls.releaseAll();

    expect(controls.keysPressed.size).toBe(0);
    expect(controls.isFiringLeft).toBe(false);
    expect(controls.isFiringRight).toBe(false);
  });

  it('toggles pause on P and Escape, ignoring repeated keydown events', () => {
    const { controls, togglePause } = createControls();
    const firstPress = new KeyboardEvent('keydown', {
      code: 'KeyP',
      key: 'p',
      cancelable: true,
    });

    window.dispatchEvent(firstPress);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', key: 'p', repeat: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyP', key: 'p' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', key: 'Escape' }));

    expect(firstPress.defaultPrevented).toBe(true);
    expect(togglePause).toHaveBeenCalledTimes(2);
    expect(controls.keysPressed).toEqual(new Set());
  });

  it('pauses on focus loss and removes all listeners when disposed', () => {
    const { controls, pauseGame, togglePause } = createControls();

    window.dispatchEvent(new Event('blur'));
    expect(pauseGame).toHaveBeenCalledOnce();

    controls.dispose();
    controls.dispose();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));

    expect(togglePause).not.toHaveBeenCalled();
    expect(pauseGame).toHaveBeenCalledOnce();
    expect(controls.isFiringLeft).toBe(false);
  });
});
