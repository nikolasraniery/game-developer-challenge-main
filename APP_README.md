# Pirate Battle application setup

This file documents the runnable application scaffold. The root `README.md` is the original Jungle Gaming challenge specification and has been preserved unchanged.

## Requirements

- Node.js 22.12 or newer (Node.js 24 is used for the initial setup).
- npm.
- Chromium installed for the Playwright E2E command.

## Install and run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The main menu is shown first; the PixiJS arena is created only after selecting **Jogar**. The API status request is intercepted by MSW. No API server, credentials, or environment variables are required.

The application enables browser mocks by default in both development and production. To intentionally disable the mock worker, set `VITE_ENABLE_MOCK_API=false`; the demo endpoint and ranking/history APIs will show errors because no real backend is configured. Ranking and history are demonstration APIs simulated by MSW, not a remote service.

## Commands

| Command                   | Purpose                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`             | Start the Vite development server.                                                                                   |
| `npm run build`           | Run TypeScript project checks and create the optimized `dist/` build.                                                |
| `npm run preview`         | Serve the most recent build locally. Run `npm run build` first.                                                      |
| `npm run lint`            | Run ESLint.                                                                                                          |
| `npm run format`          | Format source, tests, and root configuration files with Prettier.                                                    |
| `npm run format:check`    | Check formatting without changing files.                                                                             |
| `npm run typecheck`       | Run strict TypeScript checks.                                                                                        |
| `npm run test:unit`       | Run deterministic Vitest tests for collision, movement, bounds, input edges, damage, cooldowns, and time formatting. |
| `npm run test:components` | Run React component tests with a PixiJS mock; no WebGL is used.                                                      |
| `npm run test:e2e`        | Build the app, serve the production output, and run the Chromium end-to-end suite.                                   |
| `npm run msw:init`        | Generate or refresh `public/mockServiceWorker.js` from the installed MSW package.                                    |

Install the browser once if Playwright cannot find it:

```sh
npx playwright install chromium
```

The E2E suite builds the application and starts Vite Preview against `dist/`. It checks the initial menu, controls and options navigation, duration persistence, arena initialization, keyboard controls, pause/resume, viewport resizing, API failure handling, ranking pagination, and empty/error history states. It also checks pause timing, a completed match and clean restart with a controlled browser clock. Menu, paused-arena, and result-panel visual baselines are stored under `e2e/delivery-stability.spec.ts-snapshots/`. Playwright writes a console summary and HTML report (`playwright-report/`); failure screenshots and traces are written under `test-results/`.

## Match results and network scenarios

When a match ends by timeout or player defeat, the PixiJS runtime emits one typed result with an idempotency key, player, score, elapsed time, end reason, timestamp, and settings snapshot. The app stores it in a local pending outbox before posting it through Axios. Confirmed records remain in local storage; pending records are retried on the next app load or with **Tentar registrar novamente** on the result screen or menu. Ranking and history use TanStack Query and share the mock API's accepted records. If the network fails, gameplay and settings remain available.

Open **Ranking** or **Histórico** in the menu to select an MSW network scenario: success, empty lists, fixed or variable delay, deterministic out-of-order latency, connection failure, HTTP 400/503 query errors, submission HTTP 503, or a delayed submission response that times out on the client after the mock has accepted it. Retrying that submission uses the same idempotency key. **Restaurar dados de demonstração** clears confirmed mock data and the local outbox. The service worker keeps its accepted collection in memory; the client outbox is persisted in local storage.

## Assets and deployment

Original assets stay in the root `assets/` directory. Vite bundles the imported logo, title image, ship, island, HUD, control, and explosion sprites without moving or modifying the source files.

For a static deployment, publish the generated `dist/` directory and retain `mockServiceWorker.js` at the site root. The mock worker is enabled by default in the production build so the sample API request works without a backend. Browser service workers require HTTPS on a deployed origin; localhost is allowed for local development.

No deployment provider configuration or public deployment URL is present in this checkout. Vercel is a compatible static host: import the repository, use `npm run build` as the build command and `dist` as the output directory, then verify the published root serves both `index.html` and `mockServiceWorker.js`. Netlify and Cloudflare Pages can use the same build and output directory. A deployment still needs to be created and checked before delivery.

## Current limits

The application includes a main menu, controls panel, persistent match-duration and spawn-interval options, responsive PixiJS combat, health, score, timer, pause, restart, return to menu, fullscreen, match results, local outbox recovery, and demo ranking/history. Match history is local-player only; other player results are fixtures. Network scenarios do not yet model arbitrary out-of-order responses, variable latency distributions, or connection-level failures. The checked-in visual baselines cover the menu, paused arena, and result panel on Windows Chromium; they do not establish cross-platform pixel identity. A three-minute gameplay performance profile, memory-cycle evidence, and public deployment evidence remain pending. E2E scenarios require a host where the Playwright process can reach its local preview server.
