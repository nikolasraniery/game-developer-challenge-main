import { describe, expect, it } from 'vitest';
import {
  checkCollision,
  clampToArena,
  forwardDirection,
  forwardMovement,
  formatTime,
  isNewKeyPress,
  isOutOfBounds,
  reduceToZero,
  resolveMovement,
  rotateBy,
  rotatedHalfExtents,
} from '../../src/game/gameMath';

describe('checkCollision', () => {
  it('does not collide when objects are clearly separated', () => {
    expect(checkCollision({ x: 0, y: 0 }, 2, { x: 10, y: 0 }, 2)).toBe(false);
  });

  it('detects overlapping circles', () => {
    expect(checkCollision({ x: 0, y: 0 }, 4, { x: 5, y: 0 }, 3)).toBe(true);
  });

  it('treats exact contact at the radius boundary as a collision', () => {
    expect(checkCollision({ x: 0, y: 0 }, 4, { x: 7, y: 0 }, 3)).toBe(true);
  });

  it('handles coincident centers and zero-radius boundary inputs', () => {
    expect(checkCollision({ x: 5, y: 5 }, 0, { x: 5, y: 5 }, 0)).toBe(true);
    expect(checkCollision({ x: 0, y: 0 }, 0, { x: 1, y: 0 }, 0)).toBe(false);
  });
});

describe('movement and bounds', () => {
  it('moves forward along the ship heading', () => {
    expect(forwardDirection(0).x).toBeCloseTo(0);
    expect(forwardDirection(0).y).toBeCloseTo(1);
    expect(forwardDirection(Math.PI / 2).x).toBeCloseTo(-1);
    expect(forwardDirection(Math.PI / 2).y).toBeCloseTo(0);
  });

  it('scales movement proportionally to ticker delta', () => {
    const shortFrame = forwardMovement(0, 100, 0.1);
    const longFrame = forwardMovement(0, 100, 0.2);
    expect(longFrame.y).toBeCloseTo(shortFrame.y * 2);
  });

  it('rotates in opposite directions for left and right controls', () => {
    const left = rotateBy(0, -1, 2, 0.5);
    const right = rotateBy(0, 1, 2, 0.5);
    expect(left).toBe(-1);
    expect(right).toBe(1);
  });

  it('clamps the ship within arena edges using its rotated extents', () => {
    const halfExtents = rotatedHalfExtents({ width: 50, height: 70 }, 0);
    expect(halfExtents).toEqual({ width: 25, height: 35 });
    expect(clampToArena({ x: -100, y: 500 }, halfExtents, { width: 400, height: 300 })).toEqual({
      x: 25,
      y: 265,
    });
  });

  it('uses current arena dimensions after a resize', () => {
    const halfExtents = { width: 20, height: 20 };
    const position = { x: 250, y: 180 };
    expect(clampToArena(position, halfExtents, { width: 300, height: 200 })).toEqual(position);
    expect(clampToArena(position, halfExtents, { width: 200, height: 120 })).toEqual({
      x: 180,
      y: 100,
    });
  });

  it('rejects a movement destination blocked by an island', () => {
    const previous = { x: 10, y: 10 };
    const next = { x: 20, y: 10 };
    expect(resolveMovement(previous, next, ({ x }) => x >= 20)).toEqual(previous);
    expect(resolveMovement(previous, next, () => false)).toEqual(next);
  });

  it('fires only on a fresh Space press, allowing a second press after release', () => {
    expect(isNewKeyPress(true, false)).toBe(true);
    expect(isNewKeyPress(true, true)).toBe(false);
    expect(isNewKeyPress(false, true)).toBe(false);
    expect(isNewKeyPress(true, false)).toBe(true);
  });
});

describe('projectile, damage, cooldown, and timer bounds', () => {
  it('treats the arena border as in bounds and removes positions beyond it', () => {
    const arena = { width: 300, height: 200 };
    expect(isOutOfBounds({ x: 0, y: 200 }, arena)).toBe(false);
    expect(isOutOfBounds({ x: 301, y: 100 }, arena)).toBe(true);
  });

  it('never lets health, cooldowns, or remaining time fall below zero', () => {
    expect(reduceToZero(5, 1)).toBe(4);
    expect(reduceToZero(1, 5)).toBe(0);
    expect(reduceToZero(0, 1)).toBe(0);
  });

  it('formats the remaining time as minutes and seconds', () => {
    expect(formatTime(65)).toBe('01:05');
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(-5)).toBe('00:00');
  });
});
