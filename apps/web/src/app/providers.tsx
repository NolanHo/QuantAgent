import type { PropsWithChildren } from 'react';
import { HeroUIProvider } from '@heroui/system';
import {
  QueryClient,
  QueryClientProvider,
  type QueryClientConfig,
} from '@tanstack/react-query';
import { AuthProvider } from '../shared/auth';
import { RuntimeConfigProvider, type RuntimeConfig } from '../shared/config';
import { heroUITheme } from '../styles/heroui-theme';

export interface AppProvidersProps extends PropsWithChildren {
  config: RuntimeConfig;
  queryClient: QueryClient;
}

function deepMergeRecord(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const baseValue = result[key];

    if (
      baseValue &&
      value &&
      typeof baseValue === 'object' &&
      typeof value === 'object' &&
      !Array.isArray(baseValue) &&
      !Array.isArray(value)
    ) {
      result[key] = deepMergeRecord(
        baseValue as Record<string, unknown>,
        value as Record<string, unknown>,
      );
      continue;
    }

    result[key] = value;
  }

  return result;
}

export function createAppQueryClient(
  config: QueryClientConfig = {},
): QueryClient {
  const { defaultOptions: customDefaultOptions, ...clientConfig } = config;
  const defaultOptions = deepMergeRecord(
    {
      queries: {
        // 中文注释：显式固定 gcTime，避免缓存生命周期继续跟随库默认值漂移。
        gcTime: 5 * 60_000,
        staleTime: 30_000,
        retry: 1,
      },
    },
    (customDefaultOptions ?? {}) as Record<string, unknown>,
  ) as NonNullable<QueryClientConfig['defaultOptions']>;

  return new QueryClient({
    ...clientConfig,
    defaultOptions,
  });
}

export function AppProviders({
  children,
  config,
  queryClient,
}: AppProvidersProps) {
  return (
    <RuntimeConfigProvider value={config}>
      <div className="heroui-theme" data-theme="light" style={heroUITheme}>
        <HeroUIProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>{children}</AuthProvider>
          </QueryClientProvider>
        </HeroUIProvider>
      </div>
    </RuntimeConfigProvider>
  );
}
