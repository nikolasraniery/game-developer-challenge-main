# Pirate Battle application

This guide describes the implemented application. The original technical challenge specification is preserved in [`CHALLENGE_SPEC.md`](./CHALLENGE_SPEC.md).

## Overview

Pirate Battle is a browser-based, single-player naval shooter built with React, strict TypeScript, and PixiJS. The player steers a ship around islands, fights Chaser and Shooter enemies, and tries to survive until time expires. The application also includes a responsive menu, persistent match options, touch controls, HUD, pause/restart, fullscreen, result handling, and demonstration ranking and match history backed by MSW, Axios, and TanStack Query.

## Requirements and setup

- Node.js `>=22.12.0`, as declared in `package.json`.
- npm and the checked-in `package-lock.json`.
- Chromium for the Playwright E2E suite.

Install the locked dependencies and start the development server:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The menu appears first; the PixiJS arena and its assets initialize after choosing **Jogar**. A loading state is shown while the arena is prepared. No API server, credentials, or required environment variables are needed.

MSW starts in development and production by default. The optional `VITE_ENABLE_MOCK_API=false` setting disables the worker; because no real API is configured, the demo status, ranking, and history requests then fail. Ranking and history are mock API behavior, not a remote backend.

## Gameplay, controls, and options

Use the **Controles** panel in the menu or the hints below the arena for the in-game commands:

- **W** or **↑**: move forward.
- **A** or **←**: turn left; **D** or **→**: turn right.
- **Space**: fire the forward weapon.
- **Q** / **E**: fire the left / right side volleys.
- **P** or **Esc**: pause or resume. The game also pauses when the browser window loses focus or its tab is hidden; resume with **P**, **Esc**, or the on-screen button.
- On mobile, press and hold the touch buttons below the arena to move, turn, and fire. Use the touch pause/resume button for pause control.

Choose **Jogar** to start a match. **Configurações** stores the options in browser `localStorage`: duration from 60 to 180 seconds in 15-second steps, and enemy spawn interval from 1 to 12 seconds in 1-second steps. Each new match receives a snapshot; edits apply to the next match. The defaults are 60 seconds and 4 seconds. At game over, **Jogar novamente** starts a fresh arena; **Voltar ao menu** leaves the arena. The arena also has a fullscreen button.

During combat the PixiJS canvas displays the player, Chaser and Shooter ships, islands, projectiles, health indicators, and explosion effects. The semantic HUD reports player health, score, and remaining time. Enemy defeats by player fire award one point; the match ends on timeout or when player health reaches zero. Pause suspends active simulation time. A completed match shows its score, duration, end reason, and recording state.

## Build and local production preview

```sh
npm run build
npm run preview
```

The build runs TypeScript project checks and writes the optimized static site to `dist/`. Preview serves that build locally; open the URL printed by Vite Preview and check that the menu, arena, and mock API views load. Rebuild after changing source before previewing.

## Commands

| Command                                              | Purpose                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                                        | Start the Vite development server.                                                                                             |
| `npm run build`                                      | TypeScript checks and optimized production build.                                                                              |
| `npm run preview`                                    | Serve the latest `dist/` build locally.                                                                                        |
| `npm run typecheck`                                  | Run `tsc -b`.                                                                                                                  |
| `npm run lint`                                       | Run ESLint.                                                                                                                    |
| `npm run test:unit`                                  | Run deterministic Vitest logic, input, repository, and profiler tests.                                                         |
| `npm run test:components`                            | Run React component tests with PixiJS mocked; no WebGL is required.                                                            |
| `npm run test:e2e`                                   | Build the app and run the Chromium Playwright suite against Vite Preview.                                                      |
| `npm run test:e2e -- --workers=1`                    | Run that suite serially; useful for reducing timing variation on constrained machines.                                         |
| `npm run format` / `npm run format:check`            | Format or check the configured source, tests, and root config globs. Markdown files are not included by these package scripts. |
| `npm run msw:init`                                   | Generate or refresh `public/mockServiceWorker.js` from the installed MSW package.                                              |
| `npm run profile:report -- run.json [baseline.json]` | Summarize a genuine JSON profile export and, optionally, compare it with a baseline.                                           |

Install Playwright's browser once if it is missing:

```sh
npx playwright install chromium
```

E2E coverage includes menu/options navigation and persistence, arena setup and keyboard controls, pause timing, resize, API error states, ranking pagination, history empty/error states, a completed-match/restart flow, and visual baselines for the menu, a paused arena, and the result panel. Current browser E2E coverage does not verify all combat rules by driving real attacks. The test command writes an HTML report under `playwright-report/` and failure artifacts such as screenshots and traces under `test-results/`; these generated directories are ignored by Git.

## Architecture

- `src/app/` contains the React screens, menu state, options storage, and TanStack Query provider.
- `src/components/GameArena/` owns PixiJS setup, asset loading, canvas sizing, fullscreen, semantic HUD, touch controls, and teardown.
- `src/game/` contains the ticker-driven simulation, movement/collision math, keyboard and virtual input, enemy spawning, projectiles, health indicators, and the opt-in performance profiler.
- `src/services/` contains the shared Axios client and match repository/API; `src/mocks/` contains MSW handlers and fixtures.
- `tests/` covers pure logic and React components; `e2e/` contains Playwright flows and checked-in Windows Chromium snapshots.

React handles menus and infrequent HUD, pause, and result updates; PixiJS owns continuous combat state and rendering. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for lifecycle, simulation, and data-flow detail.

## Ranking, history, and network scenarios

Ranking is filtered by the selected match duration and spawn interval, sorted by score descending, then completion time and player ID for deterministic ties. The displayed ranking and local player's history are paginated in groups of five. The client requests up to 20 mock records at a time, merges them with local records, and slices the combined list into UI pages.

The MSW service worker provides the demo API. Other captains are fixtures; it does not represent a remote service. A completed result is first saved to the local pending outbox, then submitted by Axios with the match ID as its idempotency key. Pending and confirmed local records and options use browser `localStorage`; pending submissions are retried on app startup or with **Tentar registrar novamente**. The in-memory collection maintained by the MSW worker is lost when that worker restarts, while the browser's local records remain. The history view is for the local player; other ranking entries are fixtures. Clearing browser storage removes local records and options.

Open **Ranking** or **Histórico** and select **Cenário de rede (MSW)** to reproduce these cases:

| Scenario                            | Behavior                                                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sucesso                             | Normal mock API responses and match recording.                                                                                                         |
| Listas vazias                       | Empty ranking and history responses.                                                                                                                   |
| Resposta lenta                      | Fixed 650 ms delay for list requests.                                                                                                                  |
| Latência variável                   | Repeatable sequence of different delays.                                                                                                               |
| Respostas fora de ordem             | Alternating 900 ms and 80 ms list-response delays.                                                                                                     |
| Falha de conexão                    | MSW returns a network error for list and submission requests.                                                                                          |
| Resposta HTTP 400                   | Query returns HTTP 400.                                                                                                                                |
| Erro no ranking / Erro no histórico | The selected list endpoint returns HTTP 503.                                                                                                           |
| Falha ao registrar                  | Match submission returns HTTP 503 and remains pending locally.                                                                                         |
| Timeout no registro                 | MSW accepts the match, then delays its response beyond Axios's 5-second timeout; retrying uses the same ID and does not duplicate the accepted record. |

Choose **Restaurar dados de demonstração** to clear the MSW worker's accepted collection and the local match outbox, and reset its deterministic delay counters. The selected scenario and game options are stored separately and are not reset by this button. These are fixed, repeatable demonstrations; they do not model arbitrary latency distributions or every real browser/network race. The worker's records are in-memory rather than durable server storage, so this is not equivalent to remote persistence.

## Performance profiling

Profiling is available only from the Vite development server. Run `npm run dev`, open the app with `?profile=1`, set duration to 180 seconds and spawn interval to 1 second in **Configurações**, then start a match. Collection begins with the PixiJS runtime. It ends at the configured duration or earlier on defeat, arena teardown, or a manual `stop()`; an early-ended session is not a complete three-minute run.

While the arena is mounted, use the browser developer console:

```js
window.__PIRATE_BATTLE_PROFILE__.status();
window.__PIRATE_BATTLE_PROFILE__.result();
window.__PIRATE_BATTLE_PROFILE__.downloadJSON();
window.__PIRATE_BATTLE_PROFILE__.downloadCSV();
```

`stop()` finalizes early; `result()` is available after collection finishes. JSON contains per-second windows and retained ticker intervals; CSV contains summary, window, and interval rows. Analyze actual exports with `npm run profile:report -- run-1.json run-2.json`. The reported FPS counts PixiJS ticker callbacks, not frames confirmed as presented by the browser. `performance.memory` is a non-standard API and may be unavailable. The tool is dev-only, so its results describe that development runtime and are not production-build measurements.

**No real three-minute profile or five-cycle memory evidence has been collected yet.** Do not treat implementation or automated tests as performance results. See [`DELIVERY_READINESS.md`](./DELIVERY_READINESS.md) for the full collection protocol, evidence gaps, test results, and metric definitions.

## Deployment

The reported public URL is [https://piratebattle-beta.vercel.app/](https://piratebattle-beta.vercel.app/). Its current availability and correspondence to this checkout were not independently verified during this audit, and this task did not publish a deployment.

To reproduce a static production build, run `npm ci` followed by `npm run build`, then publish the generated `dist/` directory. Keep `mockServiceWorker.js` at the site root; the default production build enables MSW and requires a secure origin for service workers (HTTPS, or localhost for local testing). After deployment, open or reload the public URL and verify the menu, arena, and mock ranking/history. This repository has no provider-specific deployment configuration.

## Known limits and delivery evidence

- The ranking and history APIs are MSW demonstrations, not a backend; worker-accepted records live in memory. Local options, pending submissions, and completed local records use browser storage.
- Other captains are fixtures. The UI's history page is local-player only. Browser-storage restrictions can prevent local persistence.
- A page reload returns to the menu; it does not restore the result overlay, though the completed record remains in local history when local storage is available.
- Asset loading presents a visible status but no percentage progress indicator. There are no sound effects.
- The touch interface is available below the arena and the layout responds to resizing; Playwright coverage is Chromium desktop, not a full mobile/browser matrix.
- Real three-minute gameplay profiling, evidence over five start/play/exit cycles, and an independent check of the public deployment remain pending. The user-reported deployment URL is not treated as verified evidence.
- The default parallel Playwright run showed timer/snapshot failures under concurrent browser load after a prior 18/18 pass; a single-worker rerun passed all 19 tests. No test assertions were weakened.
- The current Node `v24.14.1` environment emitted `EBADENGINE` warnings for locked `jsdom` dependencies requesting Node `24.15.0` or newer in the 24.x line. Typecheck, lint, build, and the recorded tests still passed in that environment.
