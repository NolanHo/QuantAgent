import { describe, expect, it } from 'vitest';

import { queryRootKeys } from '@/shared/query';

import { modelQueryKeys } from './model-provider.keys';

describe('modelQueryKeys', () => {
  it('reuses the shared models root key as the feature alignment sample', () => {
    expect(modelQueryKeys.all).toBe(queryRootKeys.models);
    expect(modelQueryKeys.providers()).toEqual(['models', 'providers']);
    expect(modelQueryKeys.provider(7)).toEqual(['models', 'provider', 7]);
    expect(modelQueryKeys.presets()).toEqual(['models', 'presets']);
    expect(modelQueryKeys.invocations(7, 'general_text')).toEqual([
      'models',
      'invocations',
      7,
      'general_text',
    ]);
    expect(modelQueryKeys.remoteModels(7)).toEqual(['models', 'remote-models', 7]);
  });
});
