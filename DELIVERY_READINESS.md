# Delivery readiness audit

Audit run: 2026-10-15. This is a readiness estimate, not an external evaluation. The original challenge statement is preserved in `CHALLENGE_SPEC.md`; the root `README.md` documents the implemented application.

## Validation results

Environment for this turn: Node `v24.14.1`, Vitest `5.0.4`, Playwright `1.64.0`, Prettier `3.9.10`, Windows Chromium. `npm install --ignore-scripts` restored packages already named in the lockfile. It emitted `EBADENGINE` warnings because `jsdom@30.1.2` and related packages require Node `24.15.0` or newer in the 24.x line; the suites below nevertheless completed.

| Command                                                                | Result                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:unit`                                                    | Passed: 28 tests in 4 files, including 8 profiler tests.                                                                                                                                                                         |
| `npm run test:components`                                              | Passed: 43 tests in 4 files.                                                                                                                                                                                                     |
| `npm run typecheck`                                                    | Passed: `tsc -b`.                                                                                                                                                                                                                |
| `npm run lint`                                                         | Passed: ESLint.                                                                                                                                                                                                                  |
| `npm run build`                                                        | Passed: TypeScript project checks and Vite production build.                                                                                                                                                                     |
| `npm run test:e2e -- --workers=1`                                      | Passed: 19 Chromium tests in 4 files, including the production API-hidden check.                                                                                                                                                 |
| `npm run test:e2e` with default 4 workers                              | One run passed 18/18 before the new check. After adding it, a parallel run passed 15/19; four existing timer/snapshot checks failed under concurrent browser load. The 1-worker rerun passed all 19 without changing assertions. |
| `npm run format:check`                                                 | Failed on 32 files listed below. None of those files were edited or mass-formatted in this turn. The prior audit recorded 16 different files, so the reported set changed.                                                       |
| `npx prettier --check README.md ARCHITECTURE.md DELIVERY_READINESS.md` | Passed. The application README and the two supporting documents use the repository's Prettier configuration.                                                                                                                     |
| `git diff --check`                                                     | Passed. Git printed LF-to-CRLF working-copy notices only.                                                                                                                                                                        |
| `node --check scripts/performance-report.mjs`                          | Passed. No authentic exported profile was available to exercise the report command against real data.                                                                                                                            |
| Manual profiler smoke check                                            | Passed checks for percentiles, bounded retention, unavailable memory, and JSON/CSV serialization. This was a direct module smoke check, not a substitute for the Vitest suite.                                                   |

The current formatter warnings are:

`src/app/App.tsx`, `src/components/MatchCenter/MatchCenter.tsx`, `src/config/gameConfig.ts`, `src/game/arenaScene.ts`, `src/game/enemySpawner.ts`, `src/game/gameMath.ts`, `src/game/healthIndicator.ts`, `src/game/keyboardControls.ts`, `src/game/projectiles.ts`, `src/game/types.ts`, `src/mocks/fixtures/matches.ts`, `src/mocks/handlers/index.ts`, `src/mocks/handlers/matchHandlers.ts`, `src/services/matches/matchApi.ts`, `src/services/matches/matchRepository.ts`, `src/styles/global.css`, `src/types/matches.ts`, `tests/components/ApiStatus.test.tsx`, `tests/components/App.test.tsx`, `tests/components/GameArena.test.tsx`, `tests/components/MatchCenter.test.tsx`, `tests/setup.ts`, `tests/unit/gameMath.test.ts`, `tests/unit/keyboardControls.test.ts`, `tests/unit/matchRepository.test.ts`, `e2e/delivery-stability.spec.ts`, `e2e/game.spec.ts`, `e2e/initial-setup.spec.ts`, `package-lock.json`, `playwright.config.ts`, and `tsconfig.node.json`, `vitest.config.ts`.

The 1-worker Playwright run used the local production preview at `127.0.0.1:4173`. The restricted sandbox initially blocked loopback access; the final run was granted local test access. Playwright writes its HTML report and any failure traces/screenshots beneath ignored `playwright-report/` and `test-results/`; do not add these generated files to Git as performance evidence.

## Test evidence added in this stabilization pass

- A controlled browser clock verifies that the visible timer stays still while paused and resumes afterward.
- A completed-player-defeat flow verifies one local result, a stopped timer after game over, and reset health, score, timer, and canvas count after restart.
- Visual baselines cover the main menu, paused arena, and result panel. The arena capture is paused to freeze the Pixi ticker; the result duration line is hidden in the image only because its value depends on the collision frame. Functional assertions still check the result and recorded duration separately in the existing component suite.
- The snapshots were inspected at `1280 × 720` in this Windows Playwright Chromium environment. They do not establish pixel identity on other operating systems or browsers.

These tests do not yet drive browser-level combat to assert projectile hits, health loss, or score changes. Existing unit and component coverage exercises gameplay rules and runtime HUD/result behavior, but this remains an E2E coverage gap. The E2E game-over path currently observes player defeat; the time-expiry branch is covered by component tests, not a browser-clock E2E.

## Performance profiling

### Instrumentation and access

`src/game/performanceProfiler.ts` is enabled only when all of these are true: the page is served by Vite's development server, the URL includes `?profile=1`, and the Pixi arena is mounted. The production build does not expose the diagnostic API. It starts with the runtime and targets the configured match duration; for the requested profile, choose 180 seconds in Options. It finalizes at the target wall-clock duration, game over, or runtime teardown. If the player is defeated early, that run is shorter and must not be described as a complete three-minute profile.

Open the developer console while the arena is mounted. The API is `window.__PIRATE_BATTLE_PROFILE__`:

```js
window.__PIRATE_BATTLE_PROFILE__.status();
window.__PIRATE_BATTLE_PROFILE__.result();
window.__PIRATE_BATTLE_PROFILE__.downloadJSON();
window.__PIRATE_BATTLE_PROFILE__.downloadCSV();
```

`stop()` finalizes a run early. `result()` returns `undefined` while collection is active. Downloads are available after the run finishes. Exports are generated from collected samples; no sample values or duration are fabricated.

### Three-minute protocol

1. Record the device model, CPU/GPU if known, RAM, OS version, browser name/version, and whether the device is on battery or power. These hardware details are not reliably exposed by browser APIs and must be entered by the evaluator alongside the downloaded artifacts.
2. Use the same device, browser version, power mode, and network conditions for both runs. Close unrelated heavy tabs/apps. Avoid browser DevTools performance recording during the measured interval; use the console only to trigger downloads afterward.
3. In the project, run `npm run dev` and open the local app with `?profile=1`. Use the same browser/device planned for evidence. Record the arena viewport width/height and device pixel ratio from the JSON metadata. Pixi renderer resolution is capped at 2 by the current app configuration.
4. From the main menu, open Options. Set match duration to 180 seconds and enemy spawn interval to 1 second. These are existing game options; profiling does not change gameplay rules. Start a new match. The session begins with the Pixi runtime.
5. For the full 180 seconds, keep representative combat active: steer continuously with W/A/D or arrow keys, fire forward with Space, and use Q/E side volleys. Aim at enemies and keep moving to allow the configured spawner, enemy fire, projectiles, collisions, and explosion effects to run. Do not pause or background the tab. If the player loses before the match timer ends, label the export as an incomplete run and repeat; do not extend or synthesize its timestamps.
6. After the timer ends, check `status()` is `finished` and download both JSON and CSV. Preserve the raw files outside Git as evaluation evidence. Record any interruptions, browser throttling, visible hitching, and the device/browser details with the files.
7. Repeat the same protocol once. Compare reports with `npm run profile:report -- run-1.json run-2.json`; the report also compares the first and last thirds of each run. Keep the JSON as the canonical source because it includes raw retained frame intervals.

Enemy kind and spawn positions are random, and combat counts depend on player movement and hits. Browser scheduling, background work, device power/thermal state, and development-server/HMR overhead can also affect runs. The diagnostic is dev-only, so its results characterize that runtime setup and should not be presented as exact production-build FPS.

The profiler emits one window about every 1,000 ms. It keeps up to 65,536 frame intervals (approximately 18 minutes at 60 callbacks/s); if this limit is reached, percentile statistics are based on retained intervals and the export marks truncation. It samples memory at session start, each window, and finish only when `performance.memory` exists. That API is non-standard and often unavailable outside Chromium. Memory is reported in bytes; growth during one short run is a trend, not proof of a leak.

### Metric definitions and limits

- **Observed ticker FPS** is the number of Pixi ticker callbacks divided by measured wall time. It is not presented/rendered FPS and does not prove that a frame reached the display.
- **Frame time** is the interval from one ticker callback start to the next, measured with `performance.now()`. Mean and linearly interpolated p50/p95/p99 are calculated from retained intervals. Ticker `deltaMS` is used by the simulation but is not used for this observed interval metric.
- **Windows** report callback frequency and mean/max frame interval about once per second. A window's entity counts are snapshots at its end, not continuous maxima.
- **Enemies** are active base and spawned Chaser/Shooter instances counted from runtime state. **Projectiles** combine player, base Shooter, and spawned Shooter projectile lists. **Effects** are active explosion sprites. **Managed entities** means one player plus those active enemies, projectiles, and explosion sprites; it excludes health-bar graphics, islands, water, HUD, and other static scene objects to avoid double counting.
- Intervals above 100 ms and above 1,000 ms are reported as explicit screening counts, not universal dropped-frame thresholds. Pausing/backgrounding can produce long gaps; avoid both during a run and annotate any interruptions.
- No per-entity creation/removal event counters are collected. The per-window active counts are enough for this review and avoid instrumenting every entity lifecycle edge.
- `navigator.userAgent`, `navigator.platform`, viewport, DPR, and Pixi resolution are captured. Browser/OS version parsing can be incomplete; hardware model, CPU/GPU, and RAM should be written in the accompanying evidence notes.

### Captured measurements

No real three-minute profile has been captured in this implementation turn. Collection and export are implemented and unit-tested, but this report contains no measured FPS, frame-time, entity, or memory values. The three-minute run and device/browser record still require a human to run the gameplay protocol above. Do not treat this implementation or the previous visual/E2E checks as performance evidence.

## Deployment

The user reports that the game is deployed at [https://piratebattle-beta.vercel.app/](https://piratebattle-beta.vercel.app/) and manually checked on desktop and mobile. This turn did not publish or modify a deployment. The configured web inspection tool could not access the URL, so its current availability and the served build were not independently verified here. The deployed page does not expose the profiling API; run this opt-in tool locally in development.

## Rubric estimate

These two estimates use the challenge's 100-point rubric. “Implementation” is based on inspected source; “evidence” counts only behavior verified by the executed tests or artifacts in this audit. They are separate estimates and are not an official grade.

| Criterion                         | Implementation estimate | Evidence estimate | Remaining evidence gap                                                                                         |
| --------------------------------- | ----------------------: | ----------------: | -------------------------------------------------------------------------------------------------------------- |
| Gameplay (35)                     |                   28/35 |             16/35 | Full combat, scoring, all enemy rules, 60-second timeout, and touch combat need broader E2E coverage.          |
| PixiJS and lifecycle (20)         |                   16/20 |             15/20 | Resource profiling over repeated teardown cycles remains unmeasured.                                           |
| Interface and accessibility (15)  |                   12/15 |             11/15 | Cross-device/browser accessibility and visual review remain manual.                                            |
| Query, Axios, match data (10)     |                    8/10 |              8/10 | The service worker's accepted match store is in-memory demo data.                                              |
| MSW scenarios (5)                 |                     4/5 |               4/5 | Browser tests do not exercise every delay and submission failure scenario.                                     |
| Playwright (10)                   |                    6/10 |              7/10 | 19 Chromium cases pass serially; browser combat and time-expiry evidence remain partial.                       |
| Performance and documentation (5) |                     2/5 |               1/5 | Real 180-second profiles, device records, and independent public-deployment verification are absent.           |
| **Total**                         |              **76/100** |        **62/100** | The public deployment is user-reported; its current response could not be independently verified in this turn. |

The implementation/evidence rubric figures above are the prior audit estimate and have not been recalculated in this profiling update. The main remaining evidence gaps are the real three-minute profiles, device/browser records, and incomplete browser-level combat coverage. The mock ranking/history remains a demonstration service, not durable remote storage.
