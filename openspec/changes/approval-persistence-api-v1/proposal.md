## Why

`ActionRequest -> ApprovalRequest -> ApprovalInput -> ApprovalEvaluation -> ApprovalDecision` 的 HITL 链路和 Discord 回流已经打通，但 Approval 仍主要依赖 core 的 in-memory repository / harness 语义，不能作为 Web、API、审计和后续真实运行链路的业务真源。现在需要把 Approval 收敛为可持久化、可查询、可审计、可操作的 REST 资源，避免 Web 工作台、Discord 回流和 audit timeline 各自读取不同状态。

## What Changes

- 在 `packages/core` 为 Approval 建立生产级持久化边界，覆盖 action request 摘要、approval request 当前状态、inputs、evaluations、decisions 和 approval scoped append-only 审计记录。
- 新增受保护的 `/api/v1/approvals` REST 资源，支持队列查询、详情查询和 `approve` / `reject` / `request-reanalysis` actions。
- 保持现有 evaluator、Policy Gate、terminal 状态幂等和 Discord handoff 安全语义；人工文本、Discord 回流和前端按钮都只能转换为后端审批输入，不能绕过后端判断。
- V1 的 `request_reanalysis` 只可靠记录人工意图、evaluation、decision 和审计，不在 action endpoint 内触发新的 Agent run、worker 任务或调度链路。
- V1 的审计采用 approval scoped append-only records；统一 `audit_logs` 平台和跨模块 action taxonomy 留给后续独立 change。
- V1 的列表筛选只覆盖审批队列最小稳定维度：`status`、`risk_level`、`required_confirmation_level`、`expires_before`、分页和排序。
- 新增 `approval.read` capability 用于 `/approvals` list/detail 查询；actions 继续使用现有 `approval.approve` capability，`approval.amend` 仍保留给后续 amend change。
- 不实现 Web 审批工作台、审批详情页、一次性链接 token、amend、真实 broker、live trading、真实账户或静态 OpenAPI / TypeScript client / contracts 生成。

## Capabilities

### New Capabilities

- `approval-persistence-api-v1`: 定义 Approval 持久化真源、REST 查询与 actions、approval scoped append-only 审计、幂等与脱敏安全边界。

### Modified Capabilities

- 无。

## Impact

- 影响 `packages/core` 的 approval domain、repository、SQLAlchemy ORM、Alembic migration、query/action service、README 和测试。
- 影响 `apps/api` 的 schemas、API service/provider seam、`routers/v1`、v1 route registration、capability gate、request id / audit context 映射、OpenAPI runtime schema 和 API 测试。
- 新增公开 API surface：`GET /api/v1/approvals`、`GET /api/v1/approvals/{approval_id}`、`POST /api/v1/approvals/{approval_id}/actions/approve`、`POST /api/v1/approvals/{approval_id}/actions/reject`、`POST /api/v1/approvals/{approval_id}/actions/request-reanalysis`。
- 不新增 Python package、Web package、前端页面、插件类型、真实 broker adapter、外部依赖、静态 OpenAPI artifact 或 generated client；FastAPI `/openapi.json` 与本 OpenSpec 是本轮公开 API 契约依据。
