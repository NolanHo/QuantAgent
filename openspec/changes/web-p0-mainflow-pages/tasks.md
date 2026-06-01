## 1. OpenSpec 收口

- [x] 1.1 完成 `proposal.md`、`design.md`、`tasks.md`、`specs/web-p0-mainflow-pages/spec.md` 和 `specs/router-layout/spec.md`。
- [x] 1.2 核对 proposal 的 capabilities 与 specs 目录一一对应，且 `router-layout` delta 只修改默认首页入口语义。
- [x] 1.3 明确 `router-layout` delta 不复制 `/login`、会话恢复、CSRF、403 或 capability guard 契约。
- [x] 1.4 明确 Dashboard、Events、Event Detail、Approvals 的主对象、主任务和禁止职责。
- [x] 1.5 明确 issue #130 的事件详情 feature 边界、薄 route 要求、mock adapter / page model 边界和首屏阅读顺序。
- [x] 1.6 收敛 `docs/prd/08-frontend-pages-overview.md` 的 OpenSpec 建议范围，只保留当前 change 已实际承接的页面契约边界。

## 2. 后续实现输入

- [ ] 2.1 将 `apps/web` 根路径默认入口从 `/events` 调整为独立 Dashboard 首页流。
- [ ] 2.2 为 Dashboard 增加受保护工作区入口，并更新导航、面包屑与默认入口策略。
- [ ] 2.3 保持 `/login`、受保护路由和 capability-limited forbidden 语义与既有登录和权限 spec 一致。
- [ ] 2.4 issue #129 的实现必须以 Dashboard 为独立默认首页，并保持首页只承接重点事件、待审批摘要、关键健康提醒和主工作入口。
- [ ] 2.5 issue #130 的实现必须保持 `/events` 只承担事件中心职责，并让 `/events/:eventId` 首屏优先展示行业影响分析与最佳动作。
- [ ] 2.5.1 issue #130 必须把 `routes/_app/(workspace)/events/$eventId` 与 `$eventId/audit` 保持为薄 route，只负责参数读取与页面装配。
- [ ] 2.5.2 issue #130 必须将事件详情 / 审计页从 `features/mainflow/pages/EventPages.tsx` 迁出到独立事件详情 feature 边界，不在主链路骨架文件里继续堆真实页面职责。
- [ ] 2.5.3 issue #130 的事件详情 feature 至少补 `README.md`、`components/`、`hooks/`、`types/`、`utils/`，并明确哪些职责暂不进入 `api/`、`queries/`。
- [ ] 2.5.4 issue #130 必须固定首屏阅读顺序为“事件事实 -> 行业影响分析 / 最佳动作 -> 支持 / 反方观点与运行 / 审计摘要”，不把辅助诊断信息抬成首屏主对象。
- [ ] 2.6 issue #131 的实现必须保持 `/approvals` 为独立人类确认工作台，并严格区分“批准”与“真实执行完成”。

## 3. 验证

- [x] 3.1 运行 `openspec validate web-p0-mainflow-pages --type change --strict --json`。
- [x] 3.2 人工核对 OpenSpec artifacts、PRD 真源映射和 `apps/web` 页面骨架已经同步到同一主链路语义。
- [x] 3.3 人工核对 issue #129、#130、#131 可直接回链到本 change，而不再各自假设不同首页入口。
- [x] 3.4 收敛 `docs/prd/08-frontend-pages-overview.md` 的 OpenSpec 真源映射，只保留 Dashboard、Events、Event Detail、Approvals 和 `/` 默认入口语义。
- [x] 3.5 运行 `cd apps/web && bun run build`，确认当前页面骨架、路由和导航收口可以正常构建。
