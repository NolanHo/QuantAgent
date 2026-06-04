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
- [x] 2.5 issue #130 的实现必须保持 `/events` 只承担事件中心职责，并让 `/events/:eventId` 首屏优先展示行业影响分析与最佳动作。
- [x] 2.5.1 issue #130 必须把 `routes/_app/(workspace)/events/$eventId` 与 `$eventId/audit` 保持为薄 route，只负责参数读取与页面装配。
- [x] 2.5.2 issue #130 必须将事件详情 / 审计页从 `features/mainflow/pages/EventPages.tsx` 迁出到独立事件详情 feature 边界，不在主链路骨架文件里继续堆真实页面职责。
- [x] 2.5.3 issue #130 的事件详情 feature 至少补 `README.md`、`components/`、`hooks/`、`types/`、`utils/`，并明确哪些职责暂不进入 `api/`、`queries/`。
- [x] 2.5.4 issue #130 必须固定首屏阅读顺序为“事件事实 -> 行业影响分析 / 最佳动作 -> 支持 / 反方观点与运行 / 审计摘要”，不把辅助诊断信息抬成首屏主对象。
- [ ] 2.6 issue #131 的实现必须保持 `/approvals` 为独立人类确认工作台，并严格区分“批准”与“真实执行完成”。
- [x] 2.7 在维护者明确认可本 OpenSpec-only PR 后，再进入 #132 Web 实现；实现 PR 不混入新的 OpenSpec 范围扩张。
- [x] 2.8 #132 实现必须保持 `/events/:eventId/audit` 为事件级审计时间线，不退化成全局日志、插件日志页或 Runtime 镜像页。
- [x] 2.9 #132 Web 实现必须新增 `features/event-audit/`，并按 route / API / contracts / query keys / queries / hook / components / types / utils / mocks / README 拆分；route 只读取 `eventId` 并装配页面。
- [x] 2.10 #132 前端 API 只预留事件审计读取边界；后端事件审计 contract、generated client、数据库和真实 audit_logs 持久化必须后续另开窄范围 change。
- [x] 2.11 #132 降级态必须明确标识接口未接通、无记录或权限不足，mock fallback 不能写成真实后端审计事实。

## 3. issue #131 审批工作台 V1 结构与行为

- [x] 3.1 运行 `openspec validate web-p0-mainflow-pages --type change --strict --json`。
- [x] 3.2 人工核对 OpenSpec artifacts、PRD 真源映射和 `apps/web` 页面骨架已经同步到同一主链路语义。
- [x] 3.3 人工核对 issue #129、#130、#131 可直接回链到本 change，而不再各自假设不同首页入口。
- [x] 3.4 收敛 `docs/prd/08-frontend-pages-overview.md` 的 OpenSpec 真源映射，只保留 Dashboard、Events、Event Detail、Approvals 和 `/` 默认入口语义。
- [x] 3.5 运行 `cd apps/web && bun run build`，确认当前页面骨架、路由和导航收口可以正常构建。
- [x] 3.6 文档 PR 只包含本 change 的 OpenSpec artifacts 和 `docs/prd/08-frontend-pages-overview.md` 真源映射更新，不包含 `apps/web` 实现、依赖升级、生成物或无关 PRD 修改。
- [x] 3.7 #132 实现 PR 需要运行 `bun run --cwd apps/web test:unit` 和 `bun run --cwd apps/web build`，并人工走读 `/events/:eventId`、`/approvals/:approvalId`、`/events/:eventId/audit` 的入口与返回链路。
- [x] 3.1 在 `apps/web/src/features/approvals/` 下建立独立 feature 目录，至少拆分 `README.md`、`mock/`、`hooks/`、`components/`、`types/`、`utils/`，不继续把审批列表、详情、授权页和动作状态堆在 `features/mainflow/pages/ApprovalPages.tsx`。
- [x] 3.2 `src/routes/_app/(workspace)/approvals/index.tsx` 只负责 `validateSearch`、search 默认值、读取 `Route.useSearch()` 和装配审批工作台页面；业务筛选、排序、批量选择和动作状态进入 feature hook。
- [x] 3.3 `src/routes/_app/(workspace)/approvals/$approvalId.tsx` 与 `src/routes/(public)/approval-link/$token.tsx` 只负责 params 读取和页面装配；详情与授权页主体进入审批 feature 组件。
- [x] 3.4 固定 mock 驱动边界：审批列表与动作反馈由 `features/approvals/mock/` 提供，不伪造真实执行成功、broker 下单结果或后端 endpoint contract。
- [x] 3.5 审批工作台首屏必须展示队列概览、筛选/排序工具条、审批列表和受限批量操作区；列表字段至少包含关联事件、建议动作、推荐度、风险摘要、触发信息来源摘要、确认等级、到期策略和详情/事件入口。
- [x] 3.6 默认排序为 AI 推荐度优先；同时提供即将过期优先、风险最高优先和最新创建优先的切换。
- [x] 3.7 逐条动作至少支持 `approve`、`reject`、`request_reanalysis`；其中 `request_reanalysis` 要求简短原因输入，动作反馈文案必须强调“人工确认”而不是“真实执行完成”。
- [x] 3.8 批量处理区只保留“受限批量边界说明 + disabled UI”；继续解释相同 `risk_direction`、相同 `confirmation_level`、非 `manual_only`、未过期、非即将自动过期等禁入条件，但不交付可执行批量动作。
- [x] 3.9 审批工作台、审批详情和事件详情之间必须保持稳定回跳入口；审批详情还需补 Runtime / audit 入口；Dashboard 审批摘要可复用审批卡片，但审批 feature 拥有这些组件的业务语义。
- [x] 3.10 审批详情动作区必须明确 `approve` / `reject` / `request_reanalysis` / `amend` 的边界，其中 `amend` 只作为后续 contract 边界说明，不伪造提交成功。
- [x] 3.11 一次性授权页必须只表达 `link_confirm` 的最小上下文，不暴露完整 token 原文，不绕过 `manual_only` 或强确认边界。
- [x] 3.12 页面状态至少覆盖空态、权限不足、部分动作失败、实时降级和已过期占位；错误反馈保留 `request_id` / `trace_id` 占位文案。

## 4. 验证

- [x] 4.1 运行 `openspec validate web-p0-mainflow-pages --type change --strict --json`。
- [x] 4.2 人工核对 OpenSpec artifacts、PRD 真源映射和 `apps/web` 页面骨架已经同步到同一主链路语义。
- [x] 4.3 人工核对 issue #129、#130、#131 可直接回链到本 change，而不再各自假设不同首页入口。
- [x] 4.4 收敛 `docs/prd/08-frontend-pages-overview.md` 的 OpenSpec 真源映射，只保留 Dashboard、Events、Event Detail、Approvals 和 `/` 默认入口语义。
- [x] 4.5 issue #131 实现完成后运行 `bun run --cwd apps/web build`，确认审批工作台 route、审批详情、授权页与主链路导航可构建。
- [x] 4.6 issue #131 实现完成后运行与审批页相关的最小单测或组件测试，覆盖默认排序、批量 disabled 边界、`request_reanalysis` 原因输入和授权页强确认限制。
- [ ] 4.7 #132 实现 PR 需要运行 `bun run --cwd apps/web test:unit` 和 `bun run --cwd apps/web build`，并人工走读 `/events/:eventId`、`/approvals/:approvalId`、`/events/:eventId/audit` 的入口与返回链路。
