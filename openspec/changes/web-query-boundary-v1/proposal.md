## Why

`apps/web` 已经具备 `QueryClientProvider`、runtime `apis` 容器，以及 `features/models`、`features/plugins/config-form` 等局部 query hooks，但这些能力还没有被收口成稳定的 Web 查询基础边界。若继续推进 `/plugins`、`/runtime`、`/events` 等页面而不先统一 query 入口、key 所有权和调用链约束，后续页面会继续在 route、component 和 feature 内各自发明查询规则，导致 invalidation、realtime refresh、测试入口和目录职责持续分叉。

## What Changes

- 新增 `web-query-boundary` capability，作为 `apps/web` TanStack Query 基础边界的真源。
- 固化 `apps/web/src/shared/query/` 的职责边界：共享 query key 入口、QueryClient 默认策略、少量类型安全 helper 和 README/usage note。
- 固化 `createAppQueryClient()` 的默认策略边界，至少明确 `staleTime`、`retry`、`gcTime`、可覆盖方式和测试入口。
- 固化 Web query 调用链：`app/runtime -> FeatureApi -> queries/mutations -> business hooks -> page components`，禁止 route / page / shared UI 直接裸调业务查询或局部创建业务 API。
- 固化一级资源 query key 的共享层级约定，至少覆盖 `models`、`events`、`plugins`、`runtime`、`approvals`、`skills`、`tools`、`industries`、`settings`。
- 固化历史 query 能力的渐进迁移策略：新增页面必须优先走共享入口，现有 feature-local key 允许保留并逐步对齐，不要求本 change 一次性全量重写。
- 固化 `features/models` 作为现有示例 feature 的对齐样板，证明 shared/query 边界可以被后续页面 issue 直接复用。

## Capabilities

### New Capabilities

- `web-query-boundary`: 定义 `apps/web` 的共享 query 入口、QueryClient 默认策略、query key 所有权、runtime/API/query/hook/page 分层和渐进迁移规则。

### Modified Capabilities

- None.

## Impact

- OpenSpec：新增 `openspec/changes/web-query-boundary-v1/specs/web-query-boundary/spec.md`。
- Web 架构：后续 `apps/web/src/shared/query/`、`apps/web/src/app/providers.tsx`、`apps/web/src/app/runtime/**`、`apps/web/src/features/**/queries`、`apps/web/src/features/**/mutations` 的实现和 review 必须回链本 change。
- 页面前置依赖：`/plugins`、`/runtime`、`/events` 及其他新页面的 query 设计需以本 change 为真源，不再各自定义根层级 key 和查询分层规则。
- 验证与测试：后续实现至少需要覆盖 QueryClient 默认策略、共享 query key 稳定输出、route/page 不新增裸业务查询、以及 `models` 示例接入 shared/query 的最小验证。
