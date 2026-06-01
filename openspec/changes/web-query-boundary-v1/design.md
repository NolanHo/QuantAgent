## Context

`apps/web` 当前已经具备 TanStack Query 的运行基础，但边界仍然分散：

- `src/app/providers.tsx` 已经提供 `createAppQueryClient()` 和 `QueryClientProvider`，当前只显式收住 `staleTime: 30_000` 与 `retry: 1`，`gcTime` 仍依赖隐式默认值。
- `src/app/runtime/runtime.factory.ts` 已经创建 runtime-scoped `apiClient` 和稳定 `apis` 对象，`models`、`plugins`、`auth` 等业务 API 已经可以通过 runtime 访问。
- `features/models/queries` 已经具备相对完整的 query keys、`useQuery` hooks 和 mutation invalidation，说明 feature-local 查询边界是可行的。
- `features/plugins/config-form/queries` 也已经使用 TanStack Query，但其 key root 仍是局部命名如 `plugin-current-config`、`plugin-config-schema`，没有和更高层资源根 key 收口。
- 仓库规则已经通过 `AGENTS.md`、`apps/web/AGENTS.md`、`web-architecture-gate.md` 和 `web-file-responsibility-and-feature-structure.md` 明确要求：route/page 不能继续散落查询实现，query key 必须集中定义，业务查询必须通过 runtime `apis` 和 FeatureApi。

问题不在于“能不能继续写 query”，而在于“后续页面应该从哪里拿共享 query 入口、一级资源 key、默认策略和调用链约束”。如果这一层不先落到 OpenSpec，`/plugins`、`/runtime`、`/events` 等页面的实现会继续在 feature 和 route 内各自发明根 key、默认 options 和 API 调用习惯，后续要再统一会演变成跨页面迁移。

## Goals / Non-Goals

**Goals:**

- 为 `apps/web` 固化共享 query 基础边界，明确 `shared/query` 负责什么、不负责什么。
- 固化 `createAppQueryClient()` 的默认策略、覆盖方式和测试入口，避免关键缓存行为继续依赖 TanStack 默认值漂移。
- 固化一级资源 query key 的共享层级和所有权，让后续页面在 `models`、`events`、`plugins`、`runtime`、`approvals`、`skills`、`tools`、`industries`、`settings` 这些资源下遵循同一根层级。
- 固化 `app/runtime -> FeatureApi -> queries/mutations -> business hooks -> page components` 的调用链，禁止 route/page/shared UI 继续裸调业务查询。
- 固化渐进迁移策略：新增页面必须先走共享入口；历史 feature-local key 可以保留，但要有明确迁移口径。
- 固化 `features/models` 作为对齐样板，让后续实现者有现成参照，而不是只拿抽象口号。

**Non-Goals:**

- 不在本 change 内实现 `/plugins`、`/runtime`、`/events`、`/approvals` 等完整页面。
- 不在本 change 内实现 realtime invalidation、WebSocket topic client、局部 patch 策略或统一 mutation registry。
- 不要求一次性迁移全部历史 query keys、queries、mutations。
- 不把 `shared/query` 扩张成业务 API 层、query option builder 工厂、页面状态容器或通用 invalidation orchestrator。
- 不修改 API contracts 生成链路、DTO 类型来源或后端接口行为；这些仍由各自 capability 或后续实现 change 收口。

## Decisions

### 1. `shared/query` 采用轻量基础层，而不是重型 query abstraction

本 change 约束未来实现必须新增 `apps/web/src/shared/query/` 作为共享 query 基础入口，并提供最小职责集：

- 一级资源 root key 的统一定义与导出。
- root key 拼接的少量类型安全 helper。
- 共享 query 约定的 README / usage note。
- 与 `createAppQueryClient()` 对齐的测试入口说明。

它不负责：

- FeatureApi endpoint 封装。
- 业务 queryFn 或 `useQuery` 实现。
- mutation invalidation registry。
- 业务 DTO、页面筛选参数、权限状态或 UI 派生逻辑。

选择轻量基础层而不是统一 `queryOptions()` builder 的原因：

- 当前仓库里只有 `features/models` 与 `features/plugins/config-form` 两类有限样本，直接抽象出更高层 query option 工厂会把尚未稳定的 feature 差异过早固化。
- 本轮的主要缺口是“共享根层级和默认策略没有真源”，不是“所有 query 选项写法必须立即模板化”。
- 轻量层足以防止页面继续自发明一级资源 key，同时保留 feature 内部对 `enabled`、`refetchOnWindowFocus`、局部 invalidation 的独立控制。

替代方案是把 `shared/query` 扩展为 query option builder、invalidate helper 甚至 mutation registry。该方案能更快统一写法，但会在样本不足时引入重型 abstraction，并把 feature 差异和业务策略提前压平，因此本 change 不采用。

### 2. QueryClient 默认策略必须显式收住，且允许调用方覆盖

后续实现必须继续以 `src/app/providers.tsx` 内的 `createAppQueryClient()` 作为 QueryClient 构建入口，并将 `gcTime` 一并显式收住，而不是依赖 TanStack 默认值。默认策略至少包括：

- `queries.staleTime`
- `queries.retry`
- `queries.gcTime`

同时保留当前 `QueryClientConfig` 合并入口，使测试或特定运行场景可以覆盖默认值。这样做的原因：

- `renderWithProviders`、runtime bootstrap、页面实现和测试都已经依赖 `createAppQueryClient()`，继续复用同一入口能避免测试环境和正式运行时的缓存语义分叉。
- `gcTime` 属于会影响缓存生命周期和测试稳定性的全局行为，若不显式收住，不同 TanStack 版本或默认行为变化会让实现者误以为仓库已经定义了稳定策略。

替代方案是仅保留 `staleTime/retry`，继续依赖库默认 `gcTime`。该方案实现最轻，但无法满足 issue 对“默认策略边界显式收住”的要求，因此不采用。

### 3. 一级资源 root key 归 `shared/query` 所有，feature-local key 只负责资源内部细分

后续实现需要将一级资源根层级统一收口到 `shared/query`，至少覆盖：

- `events`
- `models`
- `plugins`
- `runtime`
- `approvals`
- `skills`
- `tools`
- `industries`
- `settings`

推荐的职责边界是：

- `shared/query` 负责导出这些一级资源 root key，例如 `['events']`、`['plugins']`。
- `features/<domain>/queries/*.keys.ts` 基于共享 root key 继续扩展资源内部细分，例如 list/detail/config/schema/timeline/health/overview。
- mutation invalidation 继续在 feature 内使用这些稳定 key 片段，不把业务 invalidate 语义上收进 `shared/query`。

这样做的原因：

- `features/models/queries/model-provider.keys.ts` 已经证明 feature 内部细分 key 可行，但它当前把根资源和细分层级都放在同一个文件，难以被其他页面复用“同一一级资源”的共享语义。
- `plugins/config-form` 当前的局部 key 名称没有明显落在统一的 `plugins` 根层级下，如果未来插件列表页、详情页、配置页并行推进，很容易再次出现平行 key 命名。

替代方案是维持“每个 feature 自己定义全部 key root”。该方案看似灵活，但无法满足 issue 对共享入口和一级资源层级真源的要求，因此不采用。

### 4. Web query 调用链固定为 runtime `apis` 驱动，route/page/shared UI 不得直接持有业务查询职责

本 change 固定后续实现的调用链：

```text
app/runtime -> FeatureApi -> queries/mutations -> business hooks -> page components
```

具体约束：

- runtime 仍由 `src/app/runtime/runtime.factory.ts` 创建稳定 `apis` 对象；业务 query hook 通过 `useApis()` 或 `useAppRuntime()` 访问，不在 hook 内局部 `new XxxApi(apiClient)`。
- route 文件只做页面入口、search params、loader、beforeLoad 和组件装配，不新增业务 `useQuery`、query keys、envelope unwrap 或 API 实例创建。
- page component 和 shared UI 不直接调用业务 query，也不直接依赖 `ApiResponse`、业务 DTO envelope 或底层 transport。
- `shared/query` 不导出 feature 业务 hooks，避免共享基础层反向持有业务语义。

选择固定 runtime `apis` 调用链的原因：

- 现有 `runtime.factory.ts` 已经提供了稳定对象，继续沿用它比让每个 query hook 单独创建 API 实例更符合 `web-architecture-gate.md`。
- route/page/shared UI 一旦继续直连业务查询，会迅速回到 issue 所要防止的“页面各自补一套查询边界”状态。

替代方案是允许 feature query hook 内按需 `new XxxApi(apiClient)`，或在 route/page 中直接 `useQuery` 调用 runtime `apiClient`。该方案短期写起来更快，但会破坏 runtime ownership 和测试入口一致性，因此不采用。

### 5. 迁移策略采用“新增强约束、历史渐进迁移”，并以 `models` 作为正式样板

本 change 不要求全量历史迁移，而是要求未来实现遵守以下分层策略：

- 新增页面、feature 或新的一级资源查询边界时，必须优先使用 `shared/query` 提供的共享 root key。
- 已存在的 feature-local keys 可以保留，但当对应资源在当前 PR 被新增 query、mutation、README 或结构重组触及时，应同步对齐共享 root key。
- `features/models` 作为正式样板：
  - 保留 feature 内的 query keys、queries、mutations 和 invalidation 组织方式。
  - 未来实现时将其根层级从当前 feature 自有 `all: ['models']` 对齐到共享 root key 入口。
  - 用它说明“shared root + feature detail keys + feature-local invalidation” 的目标结构。
- `features/plugins/config-form` 作为较小历史样本允许暂存局部 key，不要求本 change 内强制升级成统一 `plugins` root，但后续触碰插件列表/详情/配置并行能力时必须统一。

这样做的原因：

- `models` 已经具备 README、api、queries、mutations、hooks、components 的完整骨架，最适合做样板。
- 直接要求所有历史查询能力一次性迁移会把边界收口 issue 误做成大规模页面重构，超出本轮 scope。

### 6. README 和中文注释属于边界的一部分，不是实现后的可选补充

由于 `shared/query` 是新的共享能力目录，后续实现必须附带最小 README / usage note，说明：

- 负责什么。
- 公开导出是什么。
- 不要往里面继续放什么。
- 新资源 root key、feature-local key、business hooks 各自的责任边界。

此外，在以下非显然位置必须用中文短注释说明“为什么这样做”：

- QueryClient 默认策略与覆盖点。
- 历史兼容迁移，例如从 feature-local root key 对齐到共享 root key。
- 任何为了避免提前抽象而刻意保留在 feature 内的 invalidation 或 query option 决策。

## Risks / Trade-offs

- [Risk] 轻量 `shared/query` 可能被实现者误解为“规范太弱，后续仍可继续随意定义 query key”。  
  Mitigation：spec 明确要求新增一级资源必须先登记共享 root key，route/page/shared UI 不得继续自发明业务查询边界。

- [Risk] 渐进迁移策略会在一段时间内同时存在共享 root key 和历史局部 key。  
  Mitigation：spec 明确“新增强约束、旧能力按触碰迁移”，并以 `models` 作为正式样板，避免实现者误解为可以无限期拖延。

- [Risk] 显式固定 `gcTime` 后，部分现有测试或调试预期可能变化。  
  Mitigation：将默认策略和覆盖方式都写入 change，后续实现时通过 unit test 锁定行为，并允许测试按入口覆盖。

- [Risk] `shared/query` 若被继续扩张，可能反向承载业务 queryFn、invalidate 甚至页面状态。  
  Mitigation：spec 和 README 明确其非目标，后续 review 以此作为 must-fix gate。

## Migration Plan

本 change 本身是 OpenSpec-only 收口，不直接变更代码。后续实施顺序应为：

1. 先提交 OpenSpec-only PR，等待维护者明确评论“没问题”或批准。
2. 在实现 PR 中新增 `src/shared/query/`，先落共享 root key、README 和最小 helper。
3. 在 `src/app/providers.tsx` 显式补齐 `gcTime` 和相关测试。
4. 以 `features/models` 作为样板接入共享 root key，证明 feature-local 细分 keys、mutations 和 invalidation 仍可保留在 feature 内。
5. 后续页面 issue 再按各自资源接入，不在本 change 内顺手混入具体页面 UI。

回滚策略：

- 若 OpenSpec 审核阶段发现共享 root key 粒度或 QueryClient 默认策略不合适，直接在该 change 文档内修订，不进入实现。
- 若实现阶段发现某个历史 feature 的迁移成本超出预期，可保留局部 key 并在对应实现 PR 中记录 defer，但不得放松新增页面必须接共享入口的规则。

## Open Questions

无。本 change 已确认以下默认决策：

- `shared/query` 采用轻量基础层。
- `features/models` 作为正式迁移样板。
- 历史 feature-local key 采用“新增强约束、旧能力渐进迁移”的对齐策略。
