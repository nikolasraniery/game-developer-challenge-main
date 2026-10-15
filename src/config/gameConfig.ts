export const GAME_CONFIG = {
  arena: {
    backgroundColor: '#0a3549',
  },

  match: {
    durationSeconds: 60,
  },

  player: {
    width: 50,
    height: 70,
    initialHealth: 5,
    movementSpeed: 100,
    rotationSpeed: 2,
    projectileSpeed: 300,
    projectileRadius: 5,
    sideShotCooldownSeconds: 0.45,
    sideProjectileCount: 3,
    sideProjectileSpacing: 18,
  },

  enemies: {
    width: 50,
    height: 70,
    initialHealth: 3,
    respawnDelayMs: 800,
    maxSpawnAttempts: 100,
    contactDamage: 1,
    damageCooldownSeconds: 1,
    spawnIntervalSeconds: 4,
    maxActiveEnemies: 6,
    minSpawnDistance: 180,
  },

  chaser: {
    movementSpeed: 45,
  },

  shooter: {
    movementSpeed: 35,
    preferredDistance: 220,
    projectileSpeed: 220,
    fireIntervalSeconds: 1.5,
    initialFireCooldownSeconds: 1,
    projectileRadius: 5,
    attackRange: 320,
  },
} as const;
