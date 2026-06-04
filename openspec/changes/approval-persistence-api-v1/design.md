## Context

issue #272 位于 HITL approval、Discord handoff、API REST 真源和持久化审计四个边界的交汇处：

- `packages/core/src/quantagent/core/approval/README.md` 已明确 `InMemoryApprovalRepository` 只用于 harness / 单元测试，不能作为 API / Web 数据真源。
- `hitl-approval-orchestration-v1` 已提供 Approval domain model、orchestration service、repository protocol、evaluator、Policy Gate port 和 terminal 状态幂等语义。
- `notification-discord-approval-loop-v1` 已把 Discord interactive approval 回流接到 notification handoff，再转换为 approval input。
- `docs/design/04-database-and-persistence-design.md` 要求 Approval、Decision、Audit 这类关键状态支持主表当前状态 + append-only 历史回放。
- `docs/design/08-api-and-websocket-design.md` 要求 REST 作为业务状态真源，副作用能力放在资源下的 `actions` 路径，实时通道只做刷新提醒。

本 change 影响 `packages/core` 与 `apps/api`，必须同时满足 core/package 依赖方向和 API 薄 router 约束：核心状态机、幂等、Policy Gate、持久化和审计在 core service / repository 内完成；API 只做 DTO、鉴权、request id / actor context、HTTP 错误映射和 `ApiResponse[T]` envelope。

## Goals / Non-Goals

**Goals:**

- 建立 Approval 生产级持久化真源，覆盖 action request 摘要、approval request 当前状态、inputs、evaluations、decisions 和 approval scoped append-only audit records。
- 暴露受保护的 `/api/v1/approvals` REST 资源，支持队列查询、详情查询和 `approve` / `reject` / `request-reanalysis` actions。
- 保持现有 evaluator、Policy Gate、terminal 状态幂等、Discord handoff 安全语义和 fake executor / dry-run 安全边界。
- 明确 API DTO、core domain model、ORM model、approval event payload 和 audit payload 分层，避免公开内部 ORM shape 或敏感 payload。
- 为后续 Web 审批工作台、审批详情页、Discord 回流和 audit timeline 提供同一个可恢复状态真源。

**Non-Goals:**

- 不实现 Web 审批工作台、审批详情页、TanStack Query hooks 或前端组件。
- 不实现 `/approval-link/:token`、一次性链接 token、签名链接或外部强确认页面。
- 不实现 `amend`；修改 proposed payload、diff、确认等级和审计语义需要单独 issue / OpenSpec。
- 不接入真实 broker、live trading、真实账户、真实密钥或生产交易执行结果页。
- 不生成静态 OpenAPI artifact、TypeScript client、Zod schema 或 `packages/contracts` 生成链路。
- 不生成静态契约产物不代表跳过契约验证；FastAPI `/openapi.json` runtime schema 与本 OpenSpec spec 是 V1 公开 API 契约依据。
- 不在 action endpoint 内触发新的 Agent run、worker 任务、scheduler 任务或重分析事件桥接。
- 不在本 change 内落地通用 `audit_logs` 平台；V1 只做 approval scoped append-only records，并保留后续迁移边界。

## Decisions

### 1. Approval 持久化归属在 `packages/core`，API 只做 HTTP 边界

实现应在 `packages/core` 中新增或扩展以下职责：

- `quantagent.core.db.models.approval`：Approval 相关 SQLAlchemy ORM model，只负责表字段、关系、索引和约束。
- `quantagent.core.db.repositories.approval_repository`：SQLAlchemy repository，实现 approval aggregate 的持久化查询和写入。
- `quantagent.core.approval.repository`：保留现有 `ApprovalRepository` protocol，并按生产查询 / 审计需要补齐最小方法；`InMemoryApprovalRepository` 继续只服务 harness 和单测。
- `quantagent.core.approval.service`：继续承载 `submit_action()`、`submit_input()`、`expire_approval()` 等状态机语义；生产组合通过 SQLAlchemy repository 提供真实持久化。
- `quantagent.core.approval.query_service` / `api_models` 或等价模块：提供 API 需要的 list/detail read model，避免 API 直接拼 ORM 查询。

API 侧新增：

- `quantagent.api.schemas.approvals`：request/response DTO 与公开枚举，独立于 ORM 和 core domain object。
- `quantagent.api.services.approval_api`：从请求级 `Session` 组装 core repository、query service 和 action service，转换 actor/request context。
- `quantagent.api.routers.v1.approvals`：HTTP path/query/body、capability/CSRF、response envelope 和领域异常到 HTTP 错误的映射。
- `quantagent.api.routers.v1.register`：把 approvals router 注册为 protected API v1 router。

替代方案是把 `InMemoryApprovalRepository` 挂到 API app state 或让 router 直接操作 SQLAlchemy session。该方案会让 Web / Discord / audit 恢复读取不同状态，且违反 API 薄层和 core 持久化边界，因此不采用。

### 2. 数据模型采用主表当前状态 + approval scoped append-only 历史

V1 使用 approval scoped records，而不是一次性引入全局 `audit_logs`：

- `approval_action_requests`：保存 `ActionRequest` 的查询摘要与必要 JSON-safe payload；敏感 policy/prompt/payload 只保存脱敏摘要或字段级 masked marker。
- `approval_requests`：保存 approval 当前状态、风险、确认等级、过期策略、目标摘要、version、created/updated/finalized 时间。
- `approval_inputs`：append-only 保存人工输入元数据、channel、actor、received_at、structured payload 和 raw text 摘要；不保存 secret、token 或完整敏感 payload。
- `approval_evaluations`：append-only 保存 input 解释结果、confidence、extracted changes 摘要、是否需要更强确认和 reason summary。
- `approval_decisions`：append-only 保存 decision status、intent、policy gate status、execution status、reason summary、correlation/request id 和与 input 的可选关联。
- `approval_audit_records`：append-only 保存 actor、action、resource、before/after status、request id、channel、reason summary 和 record refs。

关键约束：

- 所有 append-only records 必须有稳定 `record_id`、`approval_id` 和 `created_at`；`approval_inputs.input_id` 对同一输入幂等唯一。
- `approval_decisions` 必须支持 nullable `input_id` 关联，用于表达自动过期、blocked、notify-only 等非人工输入 decision；latest decision 按 `created_at` + `record_id` 或显式 sequence 稳定排序。
- `approval_requests` 当前状态表保存 latest decision ref 或可由稳定排序恢复 latest decision，避免 API list/detail 临场猜测历史顺序。
- 同一个业务动作中，主表当前状态更新、input/evaluation/decision 写入和 audit record 必须在同一数据库事务内完成。
- terminal 状态后续输入不得覆盖最终 decision，也不得触发 executor 副作用；只允许返回 ignored 摘要并可追加审计。
- 重复 input id 必须复用既有 input/evaluation/decision 结果，避免重复执行 Policy Gate 或 executor。
- 并发更新 approval 当前状态时使用 version 字段或 `SELECT ... FOR UPDATE`，防止先读后写覆盖。

替代方案是直接新建通用 `audit_logs`。它符合长期方向，但会把跨模块 actor taxonomy、payload schema、迁移策略和 audit API 一起拉入本 issue，阻塞 Approval API 真源，因此 V1 先采用 scoped records，并在字段语义上保留后续并入 `audit_logs` 的映射空间。

### 3. REST 契约只覆盖 Approval 队列、详情和三个 V1 actions

V1 公开路径：

```text
GET  /api/v1/approvals
GET  /api/v1/approvals/{approval_id}

POST /api/v1/approvals/{approval_id}/actions/approve
POST /api/v1/approvals/{approval_id}/actions/reject
POST /api/v1/approvals/{approval_id}/actions/request-reanalysis
```

`GET /api/v1/approvals` 只支持最小队列筛选：

- `status`
- `risk_level`
- `required_confirmation_level`
- `expires_before`
- `cursor`
- `limit`
- `sort`

列表 summary 至少包含：

- `id`
- `status`
- `target_type`
- `target_id`
- `action_type`
- `action_side`
- `risk_level`
- `urgency`
- `summary`
- `required_confirmation_level`
- `expires_at`
- `expiration_action`
- `created_at`
- `updated_at`
- `latest_decision_summary`
- `allowed_actions`

详情在 summary 基础上增加：

- 脱敏 `action_request_summary`
- `allowed_channels`
- `policy_source`
- `inputs`
- `evaluations`
- `decisions`
- `audit_refs`

action request body 至少包含：

- `input_id` 可选；不传时由后端生成，传入时用于幂等。
- `channel` 固定为 `web` 或后续 API 支持的受控 channel。
- `reason` 或 `comment` 摘要。
- `structured_payload` 可携带非敏感 UI 元数据，但 path action 是 intent 真源；客户端不得通过 body 覆盖 action intent。

API action service 必须把 path action 映射为现有 core evaluator 能识别的 `ApprovalInput`：

- `approve` -> `ApprovalInput(channel="web", actor_ref=<actor>, raw_text=<reason/comment summary>, structured_payload={"intent": "approve", ...})`
- `reject` -> `ApprovalInput(channel="web", actor_ref=<actor>, raw_text=<reason/comment summary>, structured_payload={"intent": "reject", ...})`
- `request-reanalysis` -> `ApprovalInput(channel="web", actor_ref=<actor>, raw_text=<reason/comment summary>, structured_payload={"intent": "request_reanalysis", ...})`

如果请求 body 传入 `structured_payload.intent` 且与 path action 不一致，API 必须拒绝为 400，或者忽略 body intent 并写入 path action；V1 采用拒绝为 400，避免审计中出现双重意图。

所有响应使用 `ApiResponse[T]` envelope；错误响应带 `error.request_id`，不返回 traceback、数据库连接串、secret、token、完整 prompt 或 broker credential。

替代方案是首版加入 event/source/industry/risk_direction/recommendation_score 等复杂筛选。该方案依赖 Event、scoring、analysis 关联真源，容易把 Approval API 扩成跨聚合查询，因此不进入 V1。

### 4. `request_reanalysis` V1 只记录意图，不触发 AgentRuntime

`request-reanalysis` action 转换为 `ApprovalInput(structured_payload={"intent": "request_reanalysis"})`，经 evaluator 生成 `ApprovalEvaluation`，最终写入 `ApprovalDecisionStatus.REANALYSIS_REQUESTED` 和 audit record。V1 不发布 reanalysis event、不创建 Agent run、不调用 worker/scheduler，也不在 HTTP 请求内同步启动分析。

这样做的原因：

- Approval API 的职责是可靠记录人工意图与审批状态，不应越界编排 AgentRuntime。
- 重分析触发需要单独定义事件桥接、幂等 key、失败补偿、运行时状态和 Web 反馈。
- 先保证人工意图可恢复，后续再由独立 change 设计 `reanalysis requested -> worker/runtime` 链路。

替代方案是在 action endpoint 内同步或异步触发新的 Agent run。该方案会把审批、事件分析、worker/scheduler 和失败补偿混进同一个 issue，因此不采用。

### 5. Capability、CSRF、Policy Gate 与脱敏是强约束

- `/approvals` list/detail 需要新增 `approval.read` capability；actions 需要现有 `approval.approve` capability，并通过现有 protected router 认证。实现必须更新 API auth capability 常量、默认开发 actor capability set 和相关测试；`approval.amend` 不在本 change 使用。
- mutation action 必须要求 CSRF 与 actor audit context，沿用 API 现有 `require_csrf` / `build_actor_audit_context` 风格。
- approve 仍必须经过后端 evaluator 和 Policy Gate；文本确认、Discord 回流和前端按钮都不能直接把 action 标记为执行成功。
- 缺少 Policy Gate 或 Policy Gate unavailable 时，高风险 approve 默认阻断，decision 使用既有 `POLICY_GATE_FAILED` / `POLICY_BLOCKED` 类语义。
- API DTO 与日志只返回脱敏摘要，不能暴露完整 proposed payload、完整 prompt、私有策略、token、secret、broker credential 或真实账户信息。

替代方案是把前端按钮点击直接映射为 approved decision。该方案绕过现有 HITL 安全边界，必须禁止。

## Risks / Trade-offs

- [Risk] scoped audit records 后续需要并入统一 `audit_logs`。→ Mitigation：字段命名保留 actor/action/resource/request_id/before-after/status/payload_summary，PR 说明后续迁移边界。
- [Risk] Approval service 现有 protocol 是 harness 优先，SQL repository 可能暴露缺口。→ Mitigation：只补 production 必需的最小 protocol 方法，并保留 in-memory repository 测试入口。
- [Risk] terminal 幂等与并发输入可能产生竞态。→ Mitigation：写事务内使用 version 或 row lock；重复 input id 唯一约束；终态状态检查在锁内完成。
- [Risk] DTO 字段过早承诺完整 Web 体验。→ Mitigation：V1 只承诺审批队列和详情恢复所需字段，event/source/industry/scoring 关联筛选留后续 change。
- [Risk] migration 在本地缺少数据库时无法完整验证。→ Mitigation：至少保证 migration 文件可解析；PR 中明确是否运行 `upgrade` / `downgrade -1`。

## Migration Plan

1. 新增 Alembic migration 创建 approval 相关表、索引、唯一约束和外键 / 逻辑关联字段。
2. 实现 SQLAlchemy repository 与 query/action service；不迁移已有 in-memory harness 数据。
3. 注册 API router，补 OpenAPI / runtime tests。
4. 部署时先运行 `uv run quantagent-db upgrade`；需要回滚时使用 `uv run quantagent-db downgrade -1` 回退本 change migration。
5. 如果生产环境已有未持久化 approval harness 数据，本 change 不做自动 backfill；该数据不作为业务真源承诺。

## Open Questions

无。本 change 已锁定 V1 决策：approval scoped audit、`request_reanalysis` 只记录意图、列表筛选保持最小队列维度。
