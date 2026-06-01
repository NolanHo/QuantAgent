## 1. OpenSpec 评审与范围锁定

- [ ] 1.1 提交 OpenSpec-only PR，只包含 `web-query-boundary-v1` 的 proposal、design、spec 和 tasks。
- [ ] 1.2 在 PR 说明中链接 `issue #13`、`docs/design/09-frontend-architecture-design.md`、`apps/web/AGENTS.md` 和 Web gate，说明本 PR 只收口 Web query 基础边界，不进入具体页面 UI。
- [ ] 1.3 运行 `openspec validate web-query-boundary-v1 --type change --strict --json`。
- [ ] 1.4 等维护者在 OpenSpec PR 下明确评论“没问题”或批准后，再进入实现 PR。

## 2. QueryClient 默认策略收口

- [ ] 2.1 在 `apps/web/src/app/providers.tsx` 继续以 `createAppQueryClient()` 作为唯一 QueryClient 工厂，显式补齐 `queries.gcTime` 默认值。
- [ ] 2.2 保持 `createAppQueryClient()` 的覆盖入口，确保测试和运行时可以覆盖默认策略，而不需要绕过工厂自行创建 QueryClient。
- [ ] 2.3 为 QueryClient 默认策略补最小单元测试，覆盖默认值存在、覆盖生效和独立测试实例可复用。
- [ ] 2.4 在相关代码位置补中文短注释，说明为什么 `gcTime` 需要显式收住以及为什么保留覆盖入口。

## 3. shared/query 基础入口落地

- [ ] 3.1 新增 `apps/web/src/shared/query/`，提供共享 root key 导出、最小类型安全 helper 和统一 index 入口。
- [ ] 3.2 在 `shared/query` 中先定义 `models`、`events`、`plugins`、`runtime`、`approvals`、`skills`、`tools`、`industries`、`settings` 的一级资源 root key。
- [ ] 3.3 为 `shared/query` 补 README / usage note，说明负责什么、公开导出是什么、不要继续往里面放什么。
- [ ] 3.4 确保 `shared/query` 不承载业务 queryFn、FeatureApi endpoint、页面状态、业务 invalidate 规则或具体 feature DTO。

## 4. Feature Query 对齐样板

- [ ] 4.1 以 `features/models` 为样板，将其 query key 根层级对齐到共享 root key，同时保留 feature-local 的 detail keys、queries、mutations 和 invalidation 组织方式。
- [ ] 4.2 在 `features/models/README.md` 或等价 usage note 中补充“shared root key + feature detail keys”的职责说明，避免后续实现者把根层级重新收回 feature 内。
- [ ] 4.3 盘点 `features/plugins/config-form` 的局部 key 使用现状，保留其局部 schema/config 查询边界，但在代码或 README 中明确它属于待插件更大范围查询能力触及时再统一对齐的历史样本。
- [ ] 4.4 为共享 root key 和 `models` 样板补最小测试，覆盖 key 稳定输出和 feature 继续可用的 invalidate 片段。

## 5. Query 调用链与页面 Gate 对齐

- [ ] 5.1 检查受本轮影响的 query hooks 只通过 runtime `apis` 访问 FeatureApi，不在 hook 内局部创建业务 API 实例。
- [ ] 5.2 检查 route、page component 和 shared UI 没有新增业务 `useQuery`、业务 query key、envelope unwrap 或底层 transport 访问。
- [ ] 5.3 为未来 `/plugins`、`/runtime`、`/events` 页面 issue 补最小迁移规则说明：新增一级资源查询必须先登记共享 root key，再落 feature-local detail keys。
- [ ] 5.4 对非显然边界补中文短注释，尤其是 runtime `apis` ownership、历史 key 渐进迁移和 shared/query 非目标。

## 6. 验证与实现后审核

- [ ] 6.1 `openspec validate web-query-boundary-v1 --type change --strict --json`
- [ ] 6.2 `bun run --cwd apps/web test:unit`
- [ ] 6.3 `bun run --cwd apps/web lint`
- [ ] 6.4 `bun run --cwd apps/web build`
- [ ] 6.5 人工检查新增 route/page/component 没有裸业务查询、局部 API 实例化或临时根层级 key。
- [ ] 6.6 在实现 PR 说明中写清 `shared/query` 边界、`createAppQueryClient()` 默认策略、`models` 样板对齐范围，以及未在本轮迁移的历史 query 债务。
