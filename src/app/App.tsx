import { lazy, Suspense } from 'react';
import { ApiStatus } from '../components/ApiStatus/ApiStatus';
import jungleLogo from '../../assets/logo_jungle_gaming.svg?url';
import gameTitle from '../../assets/png/default/ui/menu/title_pirate_battle.png?url';

const GameArena = lazy(() =>
  import('../components/GameArena/GameArena').then(({ GameArena: arena }) => ({ default: arena })),
);

export function App() {
  return (
    <main className="page-shell">
      <header className="site-header">
        <a className="brand" href="#home" aria-label="Pirate Battle home">
          <img src={jungleLogo} alt="Jungle Gaming" />
        </a>
        <span className="build-label">FOUNDATION BUILD</span>
      </header>

      <section className="hero" id="home" aria-labelledby="page-title">
        <div className="hero-copy">
          <p className="eyebrow">JUNGLE GAMING · BROWSER GAME CHALLENGE</p>
          <h1 id="page-title">Pirate Battle</h1>
          <p className="hero-description">
            The harbor is ready. This starting screen confirms the rendering and mock-data layers
            are connected before gameplay takes shape.
          </p>
        </div>
        <img className="hero-title-art" src={gameTitle} alt="" />
      </section>

      <div className="workspace-grid">
        <Suspense
          fallback={
            <p className="arena-loading" role="status">
              Preparing the arena preview…
            </p>
          }
        >
          <GameArena />
        </Suspense>
        <ApiStatus />
      </div>

      <footer className="site-footer">
        <span>Assets stay in their supplied location.</span>
        <span>React interface · PixiJS canvas · MSW demo endpoint</span>
      </footer>
    </main>
  );
}
