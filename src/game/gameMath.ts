export type Position = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export function checkCollision(
  positionA: Position,
  radiusA: number,
  positionB: Position,
  radiusB: number,
): boolean {
  const distance = Math.sqrt(
    Math.pow(positionB.x - positionA.x, 2) + Math.pow(positionB.y - positionA.y, 2),
  );
  return radiusA + radiusB >= distance;
}

export function forwardDirection(rotation: number): Position {
  return { x: -Math.sin(rotation), y: Math.cos(rotation) };
}

export function forwardMovement(rotation: number, speed: number, deltaSeconds: number): Position {
  const direction = forwardDirection(rotation);
  return {
    x: direction.x * speed * deltaSeconds,
    y: direction.y * speed * deltaSeconds,
  };
}

export function rotateBy(
  rotation: number,
  direction: -1 | 1,
  rotationSpeed: number,
  deltaSeconds: number,
): number {
  return rotation + direction * rotationSpeed * deltaSeconds;
}

export function rotatedHalfExtents(size: Size, rotation: number): Size {
  return {
    width:
      (Math.abs(Math.cos(rotation)) * size.width + Math.abs(Math.sin(rotation)) * size.height) / 2,
    height:
      (Math.abs(Math.sin(rotation)) * size.width + Math.abs(Math.cos(rotation)) * size.height) / 2,
  };
}

export function clampToArena(position: Position, halfExtents: Size, arena: Size): Position {
  return {
    x: Math.max(halfExtents.width, Math.min(arena.width - halfExtents.width, position.x)),
    y: Math.max(halfExtents.height, Math.min(arena.height - halfExtents.height, position.y)),
  };
}

export function resolveMovement(
  previous: Position,
  next: Position,
  isBlocked: (position: Position) => boolean,
): Position {
  return isBlocked(next) ? previous : next;
}

export function isNewKeyPress(isPressed: boolean, wasPressed: boolean): boolean {
  return isPressed && !wasPressed;
}

export function reduceToZero(value: number, amount: number): number {
  return Math.max(0, value - amount);
}

export function formatTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function isOutOfBounds(position: Position, arena: Size): boolean {
  return position.x < 0 || position.x > arena.width || position.y < 0 || position.y > arena.height;
}
