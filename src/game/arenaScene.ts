import { Application, Sprite, TilingSprite } from 'pixi.js';

export function drawArenaScene(
  app: Application,
  background: TilingSprite,
  ship: Sprite,
  islands: Sprite[],
  width: number,
  height: number,
) {
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  background.width = safeWidth;
  background.height = safeHeight;

  islands.forEach((island, index) => {
    const positions = [
      { x: safeWidth * 0.25, y: safeHeight * 0.35, scale: 1.25 },
      { x: safeWidth * 0.76, y: safeHeight * 0.68, scale: 1.05 },
    ];
    const position = positions[index];
    if (!position) return;
    island.position.set(position.x, position.y);
    island.scale.set(position.scale);
  });

  ship.position.set(safeWidth * 0.51, safeHeight * 0.53);
  app.renderer.render(app.stage);
}
