# Architecture

## React and PixiJS boundary

React owns the main menu, controls and options screens, accessible status, HUD, pause/result panels, and responsive layout. The menu stores duration and enemy spawn interval in `localStorage`. It mounts `GameArena` only after the player chooses Play, passing an immutable settings snapshot for that session. Returning to the menu unmounts the arena.

`GameArena` owns PixiJS initialization, asset loading, canvas mounting, `ResizeObserver`, fullscreen state, and teardown. It passes infrequent HUD, pause, and result updates to React. The runtime reports one typed completed-match payload from its guarded game-over path. Combat feedback reuses the supplied explosion texture and tinted ship sprites; effect sprites are updated in the ticker and removed after their short lifetime or on disposal. PixiJS is integrated directly; the asynchronous initialization is cancelled on unmount, the observer and runtime listeners are removed, and the application is destroyed once. React Strict Mode remains enabled.

## Game simulation

`src/game/gameRuntime.ts` owns continuous match state and advances it from the Pixi ticker delta. `gameMath.ts` contains pure movement, collision, bounds, and timing helpers. `keyboardControls.ts` owns keyboard and touch input, including automatic pause on blur or hidden document. `arenaScene.ts`, `enemySpawner.ts`, `projectiles.ts`, and `healthIndicator.ts` own scene placement, safe enemy creation, projectile construction, and Pixi health bars.

Pausing stops the ticker and clears held input. Respawn countdowns use active simulation time, so they freeze with the match. Game over stops the ticker and clears pending respawns. Restart creates a new runtime through a new arena session; returning to the menu unmounts the current one.

## Performance diagnostics

`src/game/performanceProfiler.ts` is an opt-in runtime observer. Only a Vite development session opened with `?profile=1` creates it. It records `performance.now()` intervals between PixiJS ticker callback starts, per-second callback/entity/memory windows, and a fixed-capacity interval buffer. The game runtime provides active enemy, projectile, and effect counts from its existing ownership lists; managed entities count the player plus those active dynamic objects and exclude static scenery and health indicators. The observer does not change simulation rules or publish per-frame React state. Its browser-console API and export formats are documented in `DELIVERY_READINESS.md`.

`src/config/gameConfig.ts` contains gameplay defaults. Match duration (60–180 seconds) and enemy spawn interval (1–12 seconds) are selected in the menu and passed into each runtime. Changing settings affects the next match only. The original technical challenge specification is preserved in `CHALLENGE_SPEC.md`.

## Data layer

`src/services/api/httpClient.ts` exports the shared Axios client. `MatchCenter` queries ranking and player history with TanStack Query. The mock API handlers in `src/mocks/handlers/matchHandlers.ts` implement paged GET endpoints and an idempotent POST backed by a shared in-memory match collection; ranking and history read the same accepted results. Fixture ranking entries use a fixed configuration and deterministic score/date/player-id ordering.

Before posting, `App` saves a completed record into the local outbox in `src/services/matches/matchRepository.ts`. On acceptance the record is marked confirmed in local storage and both query families are invalidated. Pending records survive refresh and are resubmitted with the same match id as the idempotency key. The result screen and main menu allow manual retry, and pending submission does not block a new match. The mock collection is in memory in the service worker, while the client's outbox and confirmed history are local storage; there is no real backend.

Selectable MSW scenarios cover success, empty responses, fixed and variable deterministic delays, deliberately out-of-order latency, connection failure, HTTP 400/503 query failures, HTTP 503 submission failure, and a submission response delayed past the Axios timeout. Reset clears local match data and the worker-side collection.

## Assets and project structure

Original assets remain under `assets/` and are imported by URL so Vite includes only referenced files in the build. The menu, HUD, controls, ships, water, islands, cannon projectiles, and explosion effects reuse supplied sprites.

- `src/app/`: application screens and shared providers.
- `src/components/`: React arena integration and API status panel.
- `src/config/`: typed gameplay defaults.
- `src/game/`: simulation, input, entities, scene, projectiles, and indicators.
- `src/services/`, `src/types/`, and `src/mocks/`: HTTP client, contracts, and demo MSW integration.
- `tests/unit/`, `tests/components/`, and `e2e/`: pure logic, mocked Pixi/React components, and browser flows.

## Known gaps

Ranking, history, result records, pending recovery, and selectable API scenarios are demo-only. Other captains are fixtures, and confirmed mock API data is not durable across service-worker restarts; local completed records remain durable in the browser. The deterministic latency scenarios are intended for repeatable UI checks, not to reproduce every browser/network race. The visual feedback currently uses sprite tint and a short explosion sprite animation; there are no sound effects. Windows Chromium visual baselines now cover the menu, paused arena, and result panel. A real three-minute gameplay profile and memory-cycle evidence remain outstanding. The user reports a public Vercel deployment, but its current availability was not independently verified in this update. E2E scenarios require an environment where Playwright can access its local preview server.
