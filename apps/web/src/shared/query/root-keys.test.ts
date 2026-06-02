import { describe, expect, it } from 'vitest';

import { extendQueryKey, queryRootKeys } from './root-keys';

describe('queryRootKeys', () => {
  it('defines stable top-level resource keys', () => {
    expect(queryRootKeys.models).toEqual(['models']);
    expect(queryRootKeys.events).toEqual(['events']);
    expect(queryRootKeys.plugins).toEqual(['plugins']);
    expect(queryRootKeys.runtime).toEqual(['runtime']);
    expect(queryRootKeys.approvals).toEqual(['approvals']);
    expect(queryRootKeys.skills).toEqual(['skills']);
    expect(queryRootKeys.tools).toEqual(['tools']);
    expect(queryRootKeys.industries).toEqual(['industries']);
    expect(queryRootKeys.settings).toEqual(['settings']);
  });

  it('extends a shared root key without changing the base resource boundary', () => {
    expect(extendQueryKey(queryRootKeys.models, 'providers')).toEqual([
      'models',
      'providers',
    ]);
    expect(extendQueryKey(queryRootKeys.plugins, 'config', 'schema', 'plugin-1')).toEqual([
      'plugins',
      'config',
      'schema',
      'plugin-1',
    ]);
  });
});
