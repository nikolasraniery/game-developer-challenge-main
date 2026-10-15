import { describe, expect, it } from 'vitest';
import {
  createEntityCounts,
  createPerformanceProfiler,
  serializeProfileCSV,
  serializeProfileJSON,
  type EntityCounts,
  type ProfileEnvironment,
} from '../../src/game/performanceProfiler';

const environment: ProfileEnvironment = {
  userAgent: 'test browser',
  platform: 'test platform',
  viewportWidth: 1280,
  viewportHeight: 720,
  devicePixelRatio: 1,
  rendererResolution: 1,
};

const makeCounts = (enemies = 2, projectiles = 3, effects = 1): EntityCounts => ({
  enemies: { chaser: 1, shooter: enemies - 1, total: enemies },
  projectiles,
  effects,
  managedEntities: 1 + enemies + projectiles + effects,
});

function makeProfiler({
  now,
  getEntityCounts = () => makeCounts(),
  readMemory = () => null,
  frameBufferCapacity,
  enabled = true,
}: {
  now: { value: number };
  getEntityCounts?: () => EntityCounts;
  readMemory?: () => {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null;
  frameBufferCapacity?: number;
  enabled?: boolean;
}) {
  return createPerformanceProfiler({
    enabled,
    environment,
    configuration: { durationSeconds: 180, spawnIntervalSeconds: 1 },
    getEntityCounts,
    now: () => now.value,
    wallClock: () => new Date(1_800_000_000_000 + now.value),
    readMemory,
    frameBufferCapacity,
  });
}

describe('performance profiler', () => {
  it('counts dynamic game entities once, including the player', () => {
    expect(createEntityCounts(2, 3, 4, 5)).toEqual({
      enemies: { chaser: 2, shooter: 3, total: 5 },
      projectiles: 4,
      effects: 5,
      managedEntities: 15,
    });
  });

  it('collects frame intervals and calculates mean and interpolated percentiles', () => {
    const now = { value: 0 };
    const profiler = makeProfiler({ now });
    profiler?.start(180);

    for (const timestamp of [0, 10, 30, 60, 100]) {
      now.value = timestamp;
      profiler?.recordFrame();
    }
    const result = profiler?.finish();

    expect(result?.frameIntervalsMs).toEqual([10, 20, 30, 40]);
    expect(result?.summary.totalFrameIntervalSamples).toBe(4);
    expect(result?.summary.meanFrameTimeMs).toBe(25);
    expect(result?.summary.p50FrameTimeMs).toBe(25);
    expect(result?.summary.p95FrameTimeMs).toBe(38.5);
    expect(result?.summary.p99FrameTimeMs).toBeCloseTo(39.7);
    expect(result?.summary.averageObservedTickerFps).toBe(40);
    expect(result?.measurement.renderFpsMeasured).toBe(false);
  });

  it('samples entity counts by window and retains peak values', () => {
    const now = { value: 0 };
    let counts = makeCounts(2, 1, 0);
    const profiler = makeProfiler({ now, getEntityCounts: () => counts });
    profiler?.start(180);
    profiler?.recordFrame();

    counts = makeCounts(5, 8, 2);
    now.value = 1_000;
    profiler?.recordFrame();
    const result = profiler?.finish();

    expect(result?.windows[0]?.entities).toEqual(makeCounts(5, 8, 2));
    expect(result?.summary.peakEntities).toEqual(makeCounts(5, 8, 2));
  });

  it('keeps only the newest frame intervals after reaching buffer capacity', () => {
    const now = { value: 0 };
    const profiler = makeProfiler({ now, frameBufferCapacity: 3 });
    profiler?.start(180);

    for (const timestamp of [0, 10, 30, 60, 100]) {
      now.value = timestamp;
      profiler?.recordFrame();
    }
    const result = profiler?.finish();

    expect(result?.frameIntervalsMs).toEqual([20, 30, 40]);
    expect(result?.summary.totalFrameIntervalSamples).toBe(4);
    expect(result?.summary.retainedFrameIntervalSamples).toBe(3);
    expect(result?.summary.frameBufferTruncated).toBe(true);
    expect(result?.summary.meanFrameTimeMs).toBe(30);
  });

  it('does not create a profiler when profiling is disabled', () => {
    const profiler = makeProfiler({ now: { value: 0 }, enabled: false });
    expect(profiler).toBeUndefined();
  });

  it('reports memory as unavailable when the non-standard browser API is absent', () => {
    const now = { value: 0 };
    const profiler = makeProfiler({ now, readMemory: () => null });
    profiler?.start(180);
    now.value = 20;
    profiler?.recordFrame();
    const result = profiler?.finish();

    expect(result?.summary.memory.api).toBe('unavailable');
    expect(result?.summary.memory.sampleCount).toBe(0);
    expect(result?.summary.memory.initial).toBeNull();
    expect(result?.summary.memory.final).toBeNull();
    expect(result?.summary.memory.minimumUsedJSHeapSize).toBeNull();
  });

  it('finalizes once and exports the actual session as JSON and CSV', () => {
    const now = { value: 0 };
    const profiler = makeProfiler({
      now,
      readMemory: () => ({
        usedJSHeapSize: now.value + 100,
        totalJSHeapSize: now.value + 200,
        jsHeapSizeLimit: 1_000,
      }),
    });
    profiler?.start(180);
    profiler?.recordFrame();
    now.value = 50;
    profiler?.recordFrame();
    const result = profiler?.finish();

    expect(profiler?.getStatus()).toBe('finished');
    expect(profiler?.finish()).toBe(result);
    expect(result?.durationMs).toBe(50);
    expect(result?.summary.memory.initial?.usedJSHeapSize).toBe(100);
    expect(result?.summary.memory.final?.usedJSHeapSize).toBe(150);
    expect(result?.summary.memory.minimumUsedJSHeapSize).toBe(100);
    expect(result?.summary.memory.maximumUsedJSHeapSize).toBe(150);

    const json = serializeProfileJSON(result!);
    const csv = serializeProfileCSV(result!);
    expect(JSON.parse(json)).toEqual(result);
    expect(csv).toContain('recordType,elapsedMs,frameIntervalMs');
    expect(csv).toContain('summary,,,,,,,,,,,,,,,p95FrameTimeMs,');
    expect(csv).toContain('window,50');
    expect(csv).toContain('frame,,50');
  });

  it('finishes automatically when the measured target duration elapses', () => {
    const now = { value: 0 };
    const profiler = makeProfiler({ now });
    profiler?.start(1);
    profiler?.recordFrame();
    now.value = 1_000;
    profiler?.recordFrame();

    expect(profiler?.getStatus()).toBe('finished');
    expect(profiler?.getResult()?.durationMs).toBe(1_000);
  });
});
