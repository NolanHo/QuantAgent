import { describe, expect, it } from 'vitest';

import { createAppQueryClient } from './providers';

describe('createAppQueryClient', () => {
  it('uses explicit default query cache policy', () => {
    const queryClient = createAppQueryClient();
    const queryDefaults = queryClient.getDefaultOptions().queries;

    expect(queryDefaults?.staleTime).toBe(30_000);
    expect(queryDefaults?.retry).toBe(1);
    expect(queryDefaults?.gcTime).toBe(5 * 60_000);
  });

  it('allows callers to override defaults without bypassing the factory', () => {
    const queryClient = createAppQueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 60_000,
        },
      },
    });
    const queryDefaults = queryClient.getDefaultOptions().queries;

    expect(queryDefaults?.staleTime).toBe(30_000);
    expect(queryDefaults?.retry).toBe(false);
    expect(queryDefaults?.gcTime).toBe(60_000);
  });

  it('creates isolated query client instances for each caller', () => {
    const firstQueryClient = createAppQueryClient();
    const secondQueryClient = createAppQueryClient();

    expect(firstQueryClient).not.toBe(secondQueryClient);
    expect(firstQueryClient.getQueryCache()).not.toBe(secondQueryClient.getQueryCache());
  });
});
