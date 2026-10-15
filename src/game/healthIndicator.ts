import { Graphics, type Sprite } from 'pixi.js';

const BAR_WIDTH = 44;
const BAR_HEIGHT = 5;
const BAR_OFFSET = 9;

export type HealthIndicator = {
  graphic: Graphics;
  update: (sprite: Sprite, health: number) => void;
};

export function createHealthIndicator(maxHealth: number, label: string): HealthIndicator {
  const graphic = new Graphics();
  graphic.label = label;
  let displayedHealth = -1;

  return {
    graphic,
    update: (sprite, health) => {
      const clampedHealth = Math.max(0, Math.min(maxHealth, health));
      if (clampedHealth !== displayedHealth) {
        displayedHealth = clampedHealth;
        const fillWidth = BAR_WIDTH * (clampedHealth / maxHealth);
        graphic
          .clear()
          .roundRect(-BAR_WIDTH / 2, -BAR_HEIGHT / 2, BAR_WIDTH, BAR_HEIGHT, 2)
          .fill(0x351b1b);
        if (fillWidth > 0) {
          graphic
            .roundRect(-BAR_WIDTH / 2, -BAR_HEIGHT / 2, fillWidth, BAR_HEIGHT, 2)
            .fill(clampedHealth <= maxHealth / 3 ? 0xe9574f : 0x7ed17a);
        }
      }

      graphic.position.set(sprite.x, sprite.y - sprite.height / 2 - BAR_OFFSET);
    },
  };
}
