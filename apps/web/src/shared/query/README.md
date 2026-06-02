# query

`shared/query` 是 `apps/web` 的共享查询基础入口。

它只负责这些内容：

- 一级资源 root key，例如 `models`、`events`、`plugins`、`runtime`
- root key 之上的最小类型安全 helper
- 共享 query 基础边界的 usage note

公开入口：

- [index.ts](./index.ts)
- [root-keys.ts](./root-keys.ts)

推荐用法：

1. 先从 `shared/query` 取一级资源 root key
2. 再在所属 feature 的 `queries/*.keys.ts` 中扩展 detail/list/schema/config 等细粒度 key
3. mutation invalidate 继续留在 feature 内，不下沉到 `shared/query`

后续 `/plugins`、`/runtime`、`/events` 等页面新增一级资源查询时，也先在这里登记共享 root key，再回到各自 feature 扩展 detail keys。

最小示例：

```ts
import { extendQueryKey, queryRootKeys } from '@/shared/query';

export const modelQueryKeys = {
  all: queryRootKeys.models,
  providers: () => extendQueryKey(queryRootKeys.models, 'providers'),
};
```

不负责：

- `useQuery` / `useMutation` 实现
- FeatureApi endpoint
- 业务 DTO、页面状态、权限状态
- mutation invalidate 规则
- 具体页面语义或 view model

不要继续放入：

- 不要把某个 feature 的 queryFn、request 参数、筛选状态或业务 hook 塞进这里
- 不要把“共享 query”误做成通用 mutation registry 或页面状态容器
- 不要在这里重写 route、component 或 shared UI 的业务查询逻辑
