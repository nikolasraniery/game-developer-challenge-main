/* global process, console */
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error('Uso: npm run profile:report -- <execucao-1.json> [execucao-2.json]');
  process.exitCode = 1;
} else {
  const sessions = await Promise.all(
    paths.map(async (path) => {
      const session = JSON.parse(await readFile(path, 'utf8'));
      if (session.schemaVersion !== 1 || !session.summary || !Array.isArray(session.windows)) {
        throw new Error(`${path}: arquivo de perfil inválido ou schema não suportado`);
      }
      return { path, session };
    }),
  );

  const format = (value, digits = 2) =>
    typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : 'indisponível';
  const formatBytes = (value) =>
    typeof value === 'number' && Number.isFinite(value)
      ? `${(value / 1_048_576).toFixed(2)} MiB`
      : 'indisponível';
  const percent = (part, whole) => (whole > 0 ? (part / whole) * 100 : 0);

  function segmentSummary(session, startFraction, endFraction) {
    const startMs = session.durationMs * startFraction;
    const endMs = session.durationMs * endFraction;
    const selected = session.windows.filter(
      (window) => window.elapsedMs > startMs && window.elapsedMs <= endMs,
    );
    const durationMs = selected.reduce((total, window) => total + window.durationMs, 0);
    const callbackCount = selected.reduce((total, window) => total + window.tickerCallbacks, 0);
    const intervalWeight = selected.reduce(
      (total, window) =>
        total + (window.meanFrameTimeMs === null ? 0 : window.frameIntervalSamples),
      0,
    );
    const weightedFrameTime = selected.reduce(
      (total, window) => total + (window.meanFrameTimeMs ?? 0) * window.frameIntervalSamples,
      0,
    );
    const maximum = (selector) =>
      selected.reduce((value, window) => Math.max(value, selector(window)), 0);
    return {
      windows: selected.length,
      observedTickerFps: durationMs > 0 ? (callbackCount * 1_000) / durationMs : null,
      meanFrameTimeMs: intervalWeight > 0 ? weightedFrameTime / intervalWeight : null,
      peakEnemies: maximum((window) => window.entities.enemies.total),
      peakProjectiles: maximum((window) => window.entities.projectiles),
      peakEffects: maximum((window) => window.entities.effects),
      memoryFirst: selected.find((window) => window.memory)?.memory?.usedJSHeapSize ?? null,
      memoryLast:
        [...selected].reverse().find((window) => window.memory)?.memory?.usedJSHeapSize ?? null,
    };
  }

  function printSession({ path, session }) {
    const summary = session.summary;
    const memory = summary.memory;
    const first = segmentSummary(session, 0, 1 / 3);
    const last = segmentSummary(session, 2 / 3, 1);
    const firstMemory = first.memoryFirst ?? memory.initial?.usedJSHeapSize ?? null;
    const lastMemory = last.memoryLast ?? memory.final?.usedJSHeapSize ?? null;

    console.log(`## ${basename(path)}`);
    console.log(`- Sessão: ${session.sessionId} · ${session.startedAt} até ${session.endedAt}`);
    console.log(
      `- Duração medida: ${format(session.durationMs / 1_000, 1)} s / alvo ${format(session.targetDurationMs / 1_000, 1)} s`,
    );
    console.log(
      `- Amostras de intervalos: ${summary.totalFrameIntervalSamples} válidas; ${summary.retainedFrameIntervalSamples} retidas${summary.frameBufferTruncated ? ' (buffer circular truncou o histórico)' : ''}`,
    );
    console.log(
      `- Ticker observado: ${format(summary.averageObservedTickerFps)} callbacks/s · tempo entre callbacks média ${format(summary.meanFrameTimeMs)} ms, p50 ${format(summary.p50FrameTimeMs)} ms, p95 ${format(summary.p95FrameTimeMs)} ms, p99 ${format(summary.p99FrameTimeMs)} ms, máximo ${format(summary.maxFrameTimeMs)} ms`,
    );
    console.log(
      `- Intervalos acima dos limites metodológicos: >100 ms ${summary.intervalsOver100Ms}; >1.000 ms ${summary.intervalsOver1000Ms}`,
    );
    console.log(
      `- Picos amostrados: inimigos ${summary.peakEntities.enemies.total} (chaser ${summary.peakEntities.enemies.chaser}, shooter ${summary.peakEntities.enemies.shooter}); projéteis ${summary.peakEntities.projectiles}; efeitos ${summary.peakEntities.effects}; entidades gerenciadas ${summary.peakEntities.managedEntities}`,
    );
    if (memory.api === 'unavailable') {
      console.log('- Heap JS: indisponível neste navegador.');
    } else {
      console.log(
        `- Heap JS (${memory.api}; ${memory.sampleCount} amostras): inicial ${formatBytes(memory.initial?.usedJSHeapSize)}, final ${formatBytes(memory.final?.usedJSHeapSize)}, mínimo ${formatBytes(memory.minimumUsedJSHeapSize)}, máximo ${formatBytes(memory.maximumUsedJSHeapSize)}.`,
      );
    }
    console.log(
      `- Primeiro terço (${first.windows} janelas): ${format(first.observedTickerFps)} callbacks/s, frame médio ${format(first.meanFrameTimeMs)} ms, picos ${first.peakEnemies} inimigos / ${first.peakProjectiles} projéteis / ${first.peakEffects} efeitos, heap ${formatBytes(firstMemory)}.`,
    );
    console.log(
      `- Último terço (${last.windows} janelas): ${format(last.observedTickerFps)} callbacks/s, frame médio ${format(last.meanFrameTimeMs)} ms, picos ${last.peakEnemies} inimigos / ${last.peakProjectiles} projéteis / ${last.peakEffects} efeitos, heap ${formatBytes(lastMemory)}.`,
    );
    console.log(
      `- Renderização apresentada: não medida; esses intervalos são dos callbacks do ticker. Configuração: partida ${session.configuration.durationSeconds}s, surgimento ${session.configuration.spawnIntervalSeconds}s; viewport ${session.environment.viewportWidth}×${session.environment.viewportHeight}, DPR ${session.environment.devicePixelRatio}, resolução Pixi ${session.environment.rendererResolution}.`,
    );
    console.log(
      `- Janelas disponíveis no primeiro/último terço: ${format(percent(first.windows, session.windows.length), 0)}% / ${format(percent(last.windows, session.windows.length), 0)} do total; intervalos longos podem deixar trechos sem janela.`,
    );
    console.log('');
  }

  for (const entry of sessions) printSession(entry);

  if (sessions.length >= 2) {
    const [baseline, ...comparisons] = sessions;
    for (const candidate of comparisons) {
      const before = baseline.session.summary;
      const after = candidate.session.summary;
      const delta = (left, right, digits = 2) =>
        typeof left === 'number' && typeof right === 'number'
          ? `${(right - left).toFixed(digits)} (${left === 0 ? 'base 0' : `${(((right - left) / left) * 100).toFixed(1)}%`})`
          : 'indisponível';
      console.log(`## Comparação: ${basename(candidate.path)} − ${basename(baseline.path)}`);
      console.log(
        `- Duração (s): ${delta(before.durationMs / 1_000, after.durationMs / 1_000, 1)}`,
      );
      console.log(
        `- Ticker observado (callbacks/s): ${delta(before.averageObservedTickerFps, after.averageObservedTickerFps)}`,
      );
      console.log(
        `- Tempo de frame p95 (ms): ${delta(before.p95FrameTimeMs, after.p95FrameTimeMs)}`,
      );
      console.log(
        `- Pico de inimigos / projéteis / efeitos: ${delta(before.peakEntities.enemies.total, after.peakEntities.enemies.total, 0)} / ${delta(before.peakEntities.projectiles, after.peakEntities.projectiles, 0)} / ${delta(before.peakEntities.effects, after.peakEntities.effects, 0)}`,
      );
      console.log('');
    }
  }
}
