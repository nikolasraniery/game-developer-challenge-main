import { GAME_CONFIG } from '../config/gameConfig';
import { forwardDirection } from './gameMath';
import { Application, Graphics, Sprite, type Texture } from 'pixi.js';
import type { Projectile } from './types';

export function createProjectile(
  app: Application,
  ship: Sprite,
  color = 0xffffff,
  direction?: { x: number; y: number },
  offset: { x: number; y: number } = { x: 0, y: 0 },
  cannonBallTexture?: Texture,
): Projectile {
  const forward = forwardDirection(ship.rotation);
  const projectile = new Graphics();

  projectile.circle(0, 0, GAME_CONFIG.player.projectileRadius).fill(color);
  if (cannonBallTexture) {
    const cannonBall = new Sprite(cannonBallTexture);
    cannonBall.anchor.set(0.5);
    cannonBall.width = GAME_CONFIG.player.projectileRadius * 2.4;
    cannonBall.height = GAME_CONFIG.player.projectileRadius * 2.4;
    cannonBall.tint = color;
    projectile.addChild(cannonBall);
  }
  projectile.x = ship.x + offset.x;
  projectile.y = ship.y + offset.y;
  app.stage.addChild(projectile);

  return {
    graphic: projectile,
    directionX: direction?.x ?? forward.x,
    directionY: direction?.y ?? forward.y,
  };
}

export function fireSideVolley(
  app: Application,
  ship: Sprite,
  projectiles: Projectile[],
  side: -1 | 1,
  cannonBallTexture?: Texture,
): void {
  const forward = forwardDirection(ship.rotation);
  const sideX = -forward.y * side;
  const sideY = forward.x * side;
  const projectileCount = GAME_CONFIG.player.sideProjectileCount;
  const spacing = GAME_CONFIG.player.sideProjectileSpacing;
  const launchDistance =
    Math.max(ship.width, ship.height) / 2 + GAME_CONFIG.player.projectileRadius + 2;

  for (let i = 0; i < projectileCount; i += 1) {
    const spreadOffset = (i - (projectileCount - 1) / 2) * spacing;
    projectiles.push(
      createProjectile(
        app,
        ship,
        0xffd166,
        { x: sideX, y: sideY },
        {
          x: sideX * launchDistance + forward.x * spreadOffset,
          y: sideY * launchDistance + forward.y * spreadOffset,
        },
        cannonBallTexture,
      ),
    );
  }
}
