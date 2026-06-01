import type { ModelPresetKey } from '../api';
import { extendQueryKey, queryRootKeys } from '@/shared/query';

export const modelQueryKeys = {
  // 中文注释：models 作为 shared/query 接入样板，根层级统一从共享入口取，细分 key 仍留在 feature 内部。
  all: queryRootKeys.models,
  providers: () => extendQueryKey(modelQueryKeys.all, 'providers'),
  provider: (providerId: number | null) => extendQueryKey(modelQueryKeys.all, 'provider', providerId),
  presets: () => extendQueryKey(modelQueryKeys.all, 'presets'),
  invocations: (providerId: number | null, presetKey: ModelPresetKey | null) =>
    extendQueryKey(modelQueryKeys.all, 'invocations', providerId, presetKey),
  remoteModels: (providerId: number | null) =>
    extendQueryKey(modelQueryKeys.all, 'remote-models', providerId),
};
