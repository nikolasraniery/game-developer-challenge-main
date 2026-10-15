export const PROFILE_FRAME_BUFFER_CAPACITY = 65_536;
export const PROFILE_SAMPLE_INTERVAL_MS = 1_000;
export const PROFILE_LONG_FRAME_THRESHOLD_MS = 100;
export const PROFILE_DATA_GAP_THRESHOLD_MS = 1_000;

export type EntityCounts = {
  enemies: {
    chaser: number;
    shooter: number;
    total: number;
  };
  projectiles: number;
  effects: number;
  managedEntities: number;
};

export type ProfileMemorySample = {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
};

export type ProfileEnvironment = {
  userAgent: string;
  platform: string;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  rendererResolution: number;
};

export type ProfileWindow = {
  elapsedMs: number;
  durationMs: number;
  tickerCallbacks: number;
  frameIntervalSamples: number;
  observedTickerFps: number;
  meanFrameTimeMs: number | null;
  maxFrameTimeMs: number | null;
  entities: EntityCounts;
  memory: ProfileMemorySample | null;
};

export type ProfileMetricSummary = {
  durationMs: number;
  totalFrameIntervalSamples: number;
  retainedFrameIntervalSamples: number;
  frameBufferCapacity: number;
  frameBufferTruncated: boolean;
  averageObservedTickerFps: number | null;
  meanFrameTimeMs: number | null;
  p50FrameTimeMs: number | null;
  p95FrameTimeMs: number | null;
  p99FrameTimeMs: number | null;
  maxFrameTimeMs: number | null;
  intervalsOver100Ms: number;
  intervalsOver1000Ms: number;
  peakEntities: EntityCounts;
  memory: {
    api: 'performance.memory (non-standard)' | 'unavailable';
    sampleCount: number;
    initial: ProfileMemorySample | null;
    final: ProfileMemorySample | null;
    minimumUsedJSHeapSize: number | null;
    maximumUsedJSHeapSize: number | null;
  };
};

export type PerformanceProfileSession = {
  schemaVersion: 1;
  sessionId: string;
  startedAt: string;
  endedAt: string;
  targetDurationMs: number;
  durationMs: number;
  samplingIntervalMs: number;
  measurement: {
    frameIntervalSource: 'performance.now() between PixiJS ticker callback starts';
    fpsSource: 'PixiJS ticker callback count per measured wall-clock window';
    renderFpsMeasured: false;
    memorySource: 'performance.memory (non-standard Chromium API), when available';
    entityDefinition: string;
    intervalThresholds: {
      longFrameMs: number;
      dataGapMs: number;
    };
  };
  environment: ProfileEnvironment;
  configuration: {
    durationSeconds: number;
    spawnIntervalSeconds: number;
  };
  summary: ProfileMetricSummary;
  windows: ProfileWindow[];
  frameIntervalsMs: number[];
};

export type PerformanceProfiler = {
  start(targetDurationSeconds: number): void;
  recordFrame(): void;
  finish(): PerformanceProfileSession | undefined;
  getResult(): PerformanceProfileSession | undefined;
  getStatus(): 'ready' | 'recording' | 'finished';
};

export type PerformanceProfileWindowApi = {
  status: () => 'ready' | 'recording' | 'finished';
  stop: () => PerformanceProfileSession | undefined;
  result: () => PerformanceProfileSession | undefined;
  downloadJSON: () => void;
  downloadCSV: () => void;
};

type ProfilerOptions = {
  enabled: boolean;
  environment: ProfileEnvironment;
  configuration: { durationSeconds: number; spawnIntervalSeconds: number };
  getEntityCounts: () => EntityCounts;
  now?: () => number;
  wallClock?: () => Date;
  readMemory?: () => ProfileMemorySample | null;
  frameBufferCapacity?: number;
  sampleIntervalMs?: number;
};

type MemoryPerformance = Performance & {
  memory?: ProfileMemorySample;
};

export function readNonStandardMemory(): ProfileMemorySample | null {
  const memory = (globalThis.performance as MemoryPerformance | undefined)?.memory;
  if (!memory) return null;

  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
  };
}

function emptyEntityCounts(): EntityCounts {
  return {
    enemies: { chaser: 0, shooter: 0, total: 0 },
    projectiles: 0,
    effects: 0,
    managedEntities: 0,
  };
}

export function createEntityCounts(
  activeChasers: number,
  activeShooters: number,
  projectiles: number,
  effects: number,
): EntityCounts {
  const totalEnemies = activeChasers + activeShooters;
  return {
    enemies: { chaser: activeChasers, shooter: activeShooters, total: totalEnemies },
    projectiles,
    effects,
    managedEntities: 1 + totalEnemies + projectiles + effects,
  };
}

function copyEntityCounts(counts: EntityCounts): EntityCounts {
  return {
    enemies: { ...counts.enemies },
    projectiles: counts.projectiles,
    effects: counts.effects,
    managedEntities: counts.managedEntities,
  };
}

function percentile(sortedSamples: number[], fraction: number): number | null {
  if (sortedSamples.length === 0) return null;
  const position = (sortedSamples.length - 1) * fraction;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sortedSamples[lowerIndex];
  const upper = sortedSamples[upperIndex];
  if (lower === undefined || upper === undefined) return null;
  return lower + (upper - lower) * (position - lowerIndex);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

export function createPerformanceProfiler(
  options: ProfilerOptions,
): PerformanceProfiler | undefined {
  if (!options.enabled) return undefined;

  const now = options.now ?? (() => performance.now());
  const wallClock = options.wallClock ?? (() => new Date());
  const readMemory = options.readMemory ?? readNonStandardMemory;
  const capacity = Math.max(
    1,
    Math.floor(options.frameBufferCapacity ?? PROFILE_FRAME_BUFFER_CAPACITY),
  );
  const sampleIntervalMs = Math.max(1, options.sampleIntervalMs ?? PROFILE_SAMPLE_INTERVAL_MS);
  const frameBuffer = new Float64Array(capacity);
  const windows: ProfileWindow[] = [];
  const memorySamples: ProfileMemorySample[] = [];
  let status: 'ready' | 'recording' | 'finished' = 'ready';
  let startedAtMs = 0;
  let lastFrameAtMs: number | undefined;
  let windowStartedAtMs = 0;
  let windowCallbacks = 0;
  let windowIntervalCount = 0;
  let windowIntervalTotal = 0;
  let windowIntervalMaximum = 0;
  let totalFrameIntervals = 0;
  let intervalsOver100Ms = 0;
  let intervalsOver1000Ms = 0;
  let nextFrameBufferIndex = 0;
  let currentDurationMs = 0;
  let startedAt = '';
  let targetDurationMs = 0;
  let initialMemory: ProfileMemorySample | null = null;
  let finalMemory: ProfileMemorySample | null = null;
  let result: PerformanceProfileSession | undefined;

  const sampleMemory = (): ProfileMemorySample | null => {
    const sample = readMemory();
    if (sample) memorySamples.push(sample);
    return sample;
  };

  const appendFrameInterval = (frameIntervalMs: number) => {
    frameBuffer[nextFrameBufferIndex] = frameIntervalMs;
    nextFrameBufferIndex = (nextFrameBufferIndex + 1) % capacity;
    totalFrameIntervals += 1;
    if (frameIntervalMs > PROFILE_LONG_FRAME_THRESHOLD_MS) intervalsOver100Ms += 1;
    if (frameIntervalMs > PROFILE_DATA_GAP_THRESHOLD_MS) intervalsOver1000Ms += 1;
    windowIntervalCount += 1;
    windowIntervalTotal += frameIntervalMs;
    if (frameIntervalMs > windowIntervalMaximum) windowIntervalMaximum = frameIntervalMs;
  };

  const captureWindow = (timestampMs: number) => {
    const elapsedWindowMs = Math.max(0, timestampMs - windowStartedAtMs);
    if (elapsedWindowMs === 0) return;
    const memory = sampleMemory();
    windows.push({
      elapsedMs: Math.max(0, timestampMs - startedAtMs),
      durationMs: elapsedWindowMs,
      tickerCallbacks: windowCallbacks,
      frameIntervalSamples: windowIntervalCount,
      observedTickerFps: (windowCallbacks * 1_000) / elapsedWindowMs,
      meanFrameTimeMs: windowIntervalCount > 0 ? windowIntervalTotal / windowIntervalCount : null,
      maxFrameTimeMs: windowIntervalCount > 0 ? windowIntervalMaximum : null,
      entities: copyEntityCounts(options.getEntityCounts()),
      memory,
    });
    windowStartedAtMs = timestampMs;
    windowCallbacks = 0;
    windowIntervalCount = 0;
    windowIntervalTotal = 0;
    windowIntervalMaximum = 0;
  };

  const getRetainedIntervals = (): number[] => {
    const retainedCount = Math.min(totalFrameIntervals, capacity);
    const firstIndex = (nextFrameBufferIndex - retainedCount + capacity) % capacity;
    const samples = new Array<number>(retainedCount);
    for (let index = 0; index < retainedCount; index += 1) {
      samples[index] = frameBuffer[(firstIndex + index) % capacity] ?? 0;
    }
    return samples;
  };

  const finish = (): PerformanceProfileSession | undefined => {
    if (status === 'finished') return result;
    if (status !== 'recording') return undefined;

    const endedAtMs = now();
    currentDurationMs = Math.max(0, endedAtMs - startedAtMs);
    captureWindow(endedAtMs);
    finalMemory = sampleMemory();
    status = 'finished';

    const frameIntervalsMs = getRetainedIntervals();
    const sortedIntervals = frameIntervalsMs.slice().sort((left, right) => left - right);
    const observedFps =
      currentDurationMs > 0 ? (totalFrameIntervals * 1_000) / currentDurationMs : null;
    const peakEntities = emptyEntityCounts();
    for (const window of windows) {
      peakEntities.enemies.chaser = Math.max(
        peakEntities.enemies.chaser,
        window.entities.enemies.chaser,
      );
      peakEntities.enemies.shooter = Math.max(
        peakEntities.enemies.shooter,
        window.entities.enemies.shooter,
      );
      peakEntities.enemies.total = Math.max(
        peakEntities.enemies.total,
        window.entities.enemies.total,
      );
      peakEntities.projectiles = Math.max(peakEntities.projectiles, window.entities.projectiles);
      peakEntities.effects = Math.max(peakEntities.effects, window.entities.effects);
      peakEntities.managedEntities = Math.max(
        peakEntities.managedEntities,
        window.entities.managedEntities,
      );
    }
    if (windows.length === 0) {
      Object.assign(peakEntities, copyEntityCounts(options.getEntityCounts()));
    }

    let minimumUsedJSHeapSize: number | null = null;
    let maximumUsedJSHeapSize: number | null = null;
    for (const sample of memorySamples) {
      minimumUsedJSHeapSize =
        minimumUsedJSHeapSize === null
          ? sample.usedJSHeapSize
          : Math.min(minimumUsedJSHeapSize, sample.usedJSHeapSize);
      maximumUsedJSHeapSize =
        maximumUsedJSHeapSize === null
          ? sample.usedJSHeapSize
          : Math.max(maximumUsedJSHeapSize, sample.usedJSHeapSize);
    }

    const endedAt = wallClock().toISOString();
    const retainedMean = average(frameIntervalsMs);
    result = {
      schemaVersion: 1,
      sessionId: globalThis.crypto?.randomUUID?.() ?? `profile-${Date.now()}`,
      startedAt,
      endedAt,
      targetDurationMs,
      durationMs: currentDurationMs,
      samplingIntervalMs: sampleIntervalMs,
      measurement: {
        frameIntervalSource: 'performance.now() between PixiJS ticker callback starts',
        fpsSource: 'PixiJS ticker callback count per measured wall-clock window',
        renderFpsMeasured: false,
        memorySource: 'performance.memory (non-standard Chromium API), when available',
        entityDefinition:
          'Managed dynamic entities = player + active enemies + active projectiles + explosion sprites; excludes scenery and health indicators.',
        intervalThresholds: {
          longFrameMs: PROFILE_LONG_FRAME_THRESHOLD_MS,
          dataGapMs: PROFILE_DATA_GAP_THRESHOLD_MS,
        },
      },
      environment: options.environment,
      configuration: options.configuration,
      summary: {
        durationMs: currentDurationMs,
        totalFrameIntervalSamples: totalFrameIntervals,
        retainedFrameIntervalSamples: frameIntervalsMs.length,
        frameBufferCapacity: capacity,
        frameBufferTruncated: totalFrameIntervals > capacity,
        averageObservedTickerFps: observedFps,
        meanFrameTimeMs: retainedMean,
        p50FrameTimeMs: percentile(sortedIntervals, 0.5),
        p95FrameTimeMs: percentile(sortedIntervals, 0.95),
        p99FrameTimeMs: percentile(sortedIntervals, 0.99),
        maxFrameTimeMs: sortedIntervals.length > 0 ? (sortedIntervals.at(-1) ?? null) : null,
        intervalsOver100Ms,
        intervalsOver1000Ms,
        peakEntities,
        memory: {
          api: initialMemory ? 'performance.memory (non-standard)' : 'unavailable',
          sampleCount: memorySamples.length,
          initial: initialMemory,
          final: finalMemory,
          minimumUsedJSHeapSize,
          maximumUsedJSHeapSize,
        },
      },
      windows,
      frameIntervalsMs,
    };
    return result;
  };

  return {
    start(targetDurationSeconds: number) {
      if (status !== 'ready') return;
      status = 'recording';
      startedAtMs = now();
      windowStartedAtMs = startedAtMs;
      targetDurationMs = Math.max(0, targetDurationSeconds) * 1_000;
      startedAt = wallClock().toISOString();
      initialMemory = sampleMemory();
    },
    recordFrame() {
      if (status !== 'recording') return;
      const timestampMs = now();
      windowCallbacks += 1;
      if (lastFrameAtMs !== undefined) {
        const frameIntervalMs = timestampMs - lastFrameAtMs;
        if (Number.isFinite(frameIntervalMs) && frameIntervalMs >= 0) {
          appendFrameInterval(frameIntervalMs);
        }
      }
      lastFrameAtMs = timestampMs;
      if (timestampMs - windowStartedAtMs >= sampleIntervalMs) captureWindow(timestampMs);
      if (timestampMs - startedAtMs >= targetDurationMs) finish();
    },
    finish,
    getResult: () => result,
    getStatus: () => status,
  };
}

function csvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeProfileJSON(session: PerformanceProfileSession): string {
  return JSON.stringify(session, null, 2);
}

export function serializeProfileCSV(session: PerformanceProfileSession): string {
  const columns = [
    'recordType',
    'elapsedMs',
    'frameIntervalMs',
    'observedTickerFps',
    'tickerCallbacks',
    'frameIntervalSamples',
    'meanFrameTimeMs',
    'maxFrameTimeMs',
    'chaserEnemies',
    'shooterEnemies',
    'totalEnemies',
    'projectiles',
    'effects',
    'managedEntities',
    'memoryUsedJSHeapSize',
    'metric',
    'value',
  ];
  const rows: (string | number | null | undefined)[][] = [columns];
  const summaryValues: [string, number | null][] = [
    ['durationMs', session.summary.durationMs],
    ['totalFrameIntervalSamples', session.summary.totalFrameIntervalSamples],
    ['averageObservedTickerFps', session.summary.averageObservedTickerFps],
    ['meanFrameTimeMs', session.summary.meanFrameTimeMs],
    ['p50FrameTimeMs', session.summary.p50FrameTimeMs],
    ['p95FrameTimeMs', session.summary.p95FrameTimeMs],
    ['p99FrameTimeMs', session.summary.p99FrameTimeMs],
    ['maxFrameTimeMs', session.summary.maxFrameTimeMs],
    ['peakProjectiles', session.summary.peakEntities.projectiles],
    ['peakEffects', session.summary.peakEntities.effects],
  ];
  for (const [metric, value] of summaryValues)
    rows.push([
      'summary',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      metric,
      value,
    ]);
  for (const window of session.windows) {
    rows.push([
      'window',
      window.elapsedMs,
      null,
      window.observedTickerFps,
      window.tickerCallbacks,
      window.frameIntervalSamples,
      window.meanFrameTimeMs,
      window.maxFrameTimeMs,
      window.entities.enemies.chaser,
      window.entities.enemies.shooter,
      window.entities.enemies.total,
      window.entities.projectiles,
      window.entities.effects,
      window.entities.managedEntities,
      window.memory?.usedJSHeapSize,
      null,
      null,
    ]);
  }
  for (let index = 0; index < session.frameIntervalsMs.length; index += 1) {
    rows.push([
      'frame',
      null,
      session.frameIntervalsMs[index],
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      'retainedSequence',
      index + 1,
    ]);
  }
  return rows.map((row) => row.map(csvValue).join(',')).join('\n');
}

function downloadText(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function createPerformanceProfileWindowApi(
  profiler: PerformanceProfiler,
): PerformanceProfileWindowApi {
  const getResultOrThrow = () => {
    const result = profiler.getResult();
    if (!result)
      throw new Error('O perfil ainda está em coleta; aguarde 180 segundos ou chame stop().');
    return result;
  };

  return {
    status: () => profiler.getStatus(),
    stop: () => profiler.finish(),
    result: () => profiler.getResult(),
    downloadJSON: () => {
      const result = getResultOrThrow();
      downloadText(
        `pirate-battle-profile-${result.sessionId}.json`,
        serializeProfileJSON(result),
        'application/json',
      );
    },
    downloadCSV: () => {
      const result = getResultOrThrow();
      downloadText(
        `pirate-battle-profile-${result.sessionId}.csv`,
        serializeProfileCSV(result),
        'text/csv;charset=utf-8',
      );
    },
  };
}

declare global {
  interface Window {
    __PIRATE_BATTLE_PROFILE__?: PerformanceProfileWindowApi;
  }
}
