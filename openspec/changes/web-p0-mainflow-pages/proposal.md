## Why

QuantAgent Web 的 P0 页面 PRD 已经收口出一条明确的操盘主链路，但当前 stable OpenSpec 仍停留在“有这些路由和管理台壳”的层面，没有把 `/`、`/events`、`/events/:eventId`、`/events/:eventId/audit`、`/approvals` 的职责差异固化成统一契约。继续让后续 issue 各自实现，会把首页角色、事件详情焦点、审计回放边界和审批入口边界重新打散。

Issue #127 以及其评论已经明确三个产品结论：根路径必须保留独立 Dashboard、系统健康提醒先作为 Dashboard 模块存在、V1 主链路不纳入相关历史事件展示。Issue #132 进一步要求把已有 `/events/:eventId/audit` 骨架收口为事件级审计时间线，回答“建议为什么变了”，并避免退化成全局日志或 Runtime 替代品。本 change 只固化这些页面契约，作为 #129、#130、#131、#132 的统一上游真源。

## What Changes

- 新增 `web-p0-mainflow-pages` capability，定义 Dashboard、`/events`、`/events/:eventId`、`/events/:eventId/audit`、`/approvals` 的页面契约。
- 修改 `router-layout` capability，只调整根路径 `/` 的默认首页语义：从直接进入 `/events` 收口为进入独立 Dashboard 首页流。
- 固化 Dashboard 首版边界：只承接重点事件、待审批摘要、关键健康提醒和主工作入口。
- 固化 `/events` 边界：承接事件浏览、筛选和扩展重点事件视野，不承担系统总首页职责。
- 固化 `/events/:eventId` 边界：围绕单条事件组织事实、行业影响分析、最佳动作和审批入口。
- 固化 `/events/:eventId/audit` 边界：围绕单条事件回放状态变化、建议生成 / 变更、reanalysis 和人工动作，不退化为全局日志页。
- 固化 `/approvals` 边界：集中处理 ApprovalRequest，并严格区分“批准”与“真实执行完成”。
- 固化事件审计页首版数据边界：后端事件审计 contract 未完全接通时，前端只能展示结构化降级态和明确标识的 mock fallback，不在页面层发明新的 audit 真相。
- 将“V1 不纳入相关历史事件展示”“系统健康提醒不拆独立首页外治理页”等范围写入页面行为契约。

## Capabilities

### New Capabilities
- `web-p0-mainflow-pages`: 定义 QuantAgent Web P0 主链路页面的职责边界、默认阅读顺序、入口出口和首版非目标。

### Modified Capabilities
- `router-layout`: 根路径 `/` 的默认入口从事件中心收口为独立 Dashboard 首页流。

## Impact

- OpenSpec stable spec：后续归档会新增 `web-p0-mainflow-pages`，并更新 `router-layout` 的根路径默认入口语义。
- Web 实现输入：后续实现阶段需要调整 `apps/web` 的根路由、Dashboard 入口、导航/面包屑、默认入口策略，以及事件级审计页的 route / API / query / hook / component 分层。
- PRD 对齐：`docs/prd/08-frontend-pages-overview.md` 已回链本 change 承接 Event Audit Timeline 页面职责；后端节点 contract、diff 摘要 schema 和 generated client 仍需后续独立 change。
- 下游 issue：#129、#130、#131、#132 需以本 change 作为统一上游，不再各自发明首页、主链路和事件级审计边界。
- 非影响范围：本 change 不实现 React 页面、后端事件审计 API contract、generated client、数据模型、audit_logs 持久化或真实审批执行链路。
