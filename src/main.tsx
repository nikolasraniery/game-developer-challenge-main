import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { QueryProvider } from './app/providers/QueryProvider';
import './styles/global.css';

async function enableMockApi() {
  if (import.meta.env.VITE_ENABLE_MOCK_API === 'false') return;

  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}

async function bootstrap() {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('The application root element is missing.');

  try {
    await enableMockApi();
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'Unknown service worker error';
    console.error(`The mock API could not be started: ${detail}`);
  }

  createRoot(rootElement).render(
    <StrictMode>
      <QueryProvider>
        <App />
      </QueryProvider>
    </StrictMode>,
  );
}

void bootstrap();
