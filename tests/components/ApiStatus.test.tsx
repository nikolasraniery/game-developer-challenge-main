import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiStatus } from '../../src/components/ApiStatus/ApiStatus';
import { fetchDemoStatus } from '../../src/services/matches/demoStatus';

vi.mock('../../src/services/matches/demoStatus', () => ({
  fetchDemoStatus: vi.fn(),
}));

const fetchDemoStatusMock = vi.mocked(fetchDemoStatus);

function renderApiStatus() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ApiStatus />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  fetchDemoStatusMock.mockReset();
});

describe('ApiStatus', () => {
  it('shows an accessible loading state until the query resolves', async () => {
    let resolveRequest: ((value: { message: string; source: string }) => void) | undefined;
    fetchDemoStatusMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    renderApiStatus();
    expect(screen.getByRole('status')).toHaveTextContent('Checking the sample endpoint');

    await act(async () => {
      resolveRequest?.({
        message: 'The sample API is responding through the browser mock.',
        source: 'msw',
      });
    });

    expect(
      await screen.findByText('The sample API is responding through the browser mock.'),
    ).toBeVisible();
  });

  it('shows the returned API status', async () => {
    fetchDemoStatusMock.mockResolvedValue({
      message: 'Status fixture received.',
      source: 'msw',
    });

    renderApiStatus();

    expect(await screen.findByText('Status fixture received.')).toBeVisible();
    expect(screen.getByText('MSW')).toBeVisible();
  });

  it('shows an accessible error when the status request fails', async () => {
    fetchDemoStatusMock.mockRejectedValue(new Error('service unavailable'));

    renderApiStatus();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The sample endpoint could not be reached.',
    );
  });
});
