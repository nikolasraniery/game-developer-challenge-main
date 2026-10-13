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

Open the local URL printed by Vite. The first screen shows a static PixiJS arena preview and a status request intercepted by MSW. No API server, credentials, or environment variables are required.

The application enables browser mocks by default in both development and production. To intentionally disable the mock worker, set `VITE_ENABLE_MOCK_API=false`; the demo endpoint will then show an error because no real backend is configured.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Run TypeScript project checks and create the optimized `dist/` build. |
| `npm run preview` | Serve the most recent build locally. Run `npm run build` first. |
| `npm run lint` | Run ESLint. |
| `npm run format` | Format source, tests, and root configuration files with Prettier. |
| `npm run format:check` | Check formatting without changing files. |
| `npm run typecheck` | Run strict TypeScript checks. |
| `npm run test:e2e` | Build the app, serve the production output, and run the Chromium end-to-end smoke test. |
| `npm run msw:init` | Generate or refresh `public/mockServiceWorker.js` from the installed MSW package. |

Install the browser once if Playwright cannot find it:

```sh
npx playwright install chromium
```

The E2E test builds the application, starts Vite Preview against `dist/`, and checks the initial screen, rendered canvas, and mocked status response. This also checks that the service worker and request handler work in the production build. It does not cover gameplay or visual regression yet. The HTML report is written to `playwright-report/`; failure screenshots and traces are written under `test-results/`.

## Assets and deployment

Original assets stay in the root `assets/` directory. Vite bundles the imported logo, title image, ship, and island sprite without moving or modifying the source files.

For a static deployment, publish the generated `dist/` directory and retain `mockServiceWorker.js` at the site root. The mock worker is enabled by default in the production build so the sample API request works without a backend. Browser service workers require HTTPS on a deployed origin; localhost is allowed for local development.

## Current limits

The arena is a static rendering preview. Player controls, gameplay rules, collisions, enemies, options, results, ranking, match history, network scenarios, and visual baselines have not been implemented.
