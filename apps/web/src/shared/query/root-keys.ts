export type QueryRootKey = readonly [string];

export function createQueryRootKey(resource: string): QueryRootKey {
  return [resource] as const;
}

export function extendQueryKey<
  const TRoot extends readonly unknown[],
  const TParts extends readonly unknown[],
>(rootKey: TRoot, ...parts: TParts) {
  return [...rootKey, ...parts] as const;
}

export const queryRootKeys = {
  models: createQueryRootKey('models'),
  events: createQueryRootKey('events'),
  plugins: createQueryRootKey('plugins'),
  runtime: createQueryRootKey('runtime'),
  approvals: createQueryRootKey('approvals'),
  skills: createQueryRootKey('skills'),
  tools: createQueryRootKey('tools'),
  industries: createQueryRootKey('industries'),
  settings: createQueryRootKey('settings'),
} as const;
