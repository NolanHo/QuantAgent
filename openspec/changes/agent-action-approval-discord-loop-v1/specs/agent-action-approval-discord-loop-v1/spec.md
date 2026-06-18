## ADDED Requirements

### Requirement: Agent action submission SHALL publish production action events

系统 SHALL 将 Agent Chat 中的 `submit_action_plan` 行动提交转换为生产 `action.requested` 事件，并返回可追踪但不夸大状态的提交摘要。

#### Scenario: NVDA ActionPlan publishes action.requested
- **WHEN** NVDA Agent Chat 调用 `submit_action_plan`
- **THEN** 工具通过 action submission port 生成 `ActionRequest`
- **AND** 系统发布 `action.requested`
- **AND** 工具返回 `action_request_id`、`dispatch_status=action_requested`、`approval_status_hint=pending_dispatch` 和 `notification_status_hint=pending_dispatch`

#### Scenario: Agent output does not claim approval or delivery
- **WHEN** `submit_action_plan` 已成功发布 `action.requested`
- **THEN** 工具输出不得声称 approval 已创建
- **AND** 不得声称 Discord 通知已送达
- **AND** 不得声称 broker、dry-run 或 live trading 已执行成功

#### Scenario: ActionRequest is redacted
- **WHEN** ActionPlan 或 runtime payload 包含 prompt、secret、token、cookie、私有策略、broker credential 或 provider raw response
- **THEN** `ActionRequest.proposed_payload` 只包含脱敏摘要
- **AND** `action.requested` payload 不包含这些敏感原文

#### Scenario: Submission unavailable is safe
- **WHEN** action submission port 未配置或发布失败
- **THEN** `submit_action_plan` 返回 `dispatch_status=action_submission_unavailable` 或 `action_request_failed`
- **AND** 不创建 fake approved 状态
- **AND** 不声称 notification 或 broker 已执行

### Requirement: Worker SHALL consume approval and notification production topics

系统 SHALL 在 worker 常驻入口消费 `action.requested`、`approval.input_received` 和 `notification.requested`，并保持现有 source / analysis topic 行为不回归。

#### Scenario: Worker consumes action.requested into DB approval
- **WHEN** worker 收到 `action.requested`
- **THEN** worker 使用 `SQLAlchemyApprovalRepository`
- **AND** 调用 `ApprovalOrchestrationService.submit_action()`
- **AND** 在同一事务中保存 action、approval、decision 或 audit 记录
- **AND** 提交后发布对应 `approval.requested`、`notification.requested` 或 `approval.completed`

#### Scenario: Worker consumes approval.input_received into evaluation
- **WHEN** worker 收到 `approval.input_received`
- **THEN** worker 调用 `ApprovalInputReceivedHandler`
- **AND** 使用数据库 repository 保存 input、evaluation、decision 和 audit
- **AND** 根据 approval evaluator 与 Policy Gate 生成安全终态或 pending 摘要

#### Scenario: Worker consumes notification.requested into dispatcher
- **WHEN** worker 收到 `notification.requested`
- **AND** `NOTIFICATION_DISPATCH_ENABLED=true`
- **THEN** worker 使用 `NotificationRequestedHandler`
- **AND** 通过 Registry + Runtime 调用已配置 notification 插件的 `notification.send`
- **AND** 发布 `notification.completed`

#### Scenario: Notification dispatch disabled is explicit
- **WHEN** worker 收到 `notification.requested`
- **AND** `NOTIFICATION_DISPATCH_ENABLED=false`
- **THEN** worker 不调用 notification 插件
- **AND** 结果明确表达 dispatch disabled
- **AND** 不声称外部 provider 已送达

### Requirement: API notification ingress SHALL hand off to approval input by event

系统 SHALL 在 notification ingress 成功记录外部回复后，通过 approval handoff adapter 发布 `approval.input_received`，而不是在 API 请求内直接执行审批状态机。

#### Scenario: Discord receive publishes approval.input_received
- **WHEN** Discord interaction webhook 通过 notification ingress 生成 `NotificationReceiveFact`
- **AND** 回复文本包含可解析的 `approval_id`
- **THEN** API 组装的 handoff adapter 发布 `approval.input_received`
- **AND** webhook 响应不等待 approval evaluation 完成

#### Scenario: API host remains transport-only
- **WHEN** API host 处理 notification ingress 请求
- **THEN** API host 不解析 approve、reject 或 reanalysis intent
- **AND** 不调用 Policy Gate
- **AND** 不调用 ActionExecutor
- **AND** 不直接写 approval decision

#### Scenario: Missing event runtime does not fake completion
- **WHEN** notification ingress 没有可用 Event Bus publisher
- **THEN** handoff 返回 ignored、disabled 或 unavailable 摘要
- **AND** 不发布 `approval.completed`
- **AND** 不声称审批已进入 worker evaluation

### Requirement: Web approval workbench SHALL use real approval API

系统 SHALL 让 Web 审批工作台默认从 `/api/v1/approvals` 读取和提交审批动作，mock 只能作为测试 fixture 或显式开发辅助。

#### Scenario: Approval list uses REST data
- **WHEN** 用户打开 `/approvals`
- **THEN** Web 通过 runtime-scoped `ApprovalWorkbenchApi` 调用 `/api/v1/approvals`
- **AND** TanStack Query 使用真实 API response 映射 `ApprovalWorkbenchItem`
- **AND** 默认 query 不读取 mock store

#### Scenario: Approval detail uses REST data
- **WHEN** 用户打开 `/approvals/:approvalId`
- **THEN** Web 调用 `/api/v1/approvals/{approval_id}`
- **AND** 页面展示 API 返回的 approval summary、decision、history 和 audit refs 映射摘要

#### Scenario: Approval actions call REST endpoints
- **WHEN** 用户在 Web 触发 approve、reject 或 request_reanalysis
- **THEN** mutation 调用对应 `/api/v1/approvals/{approval_id}/actions/*`
- **AND** 成功后 invalidate approval list、overview 和 detail query
- **AND** UI 不把 action response 表达为真实交易成功

#### Scenario: API errors are visible
- **WHEN** approval API 返回 403、404、400 或网络错误
- **THEN** Web 展示可排查的错误状态
- **AND** 如果响应包含 request id，UI 保留 request id 供排查

### Requirement: Production loop SHALL preserve dry-run and Policy Gate safety

系统 SHALL 在整条 Agent 到 Discord 回流链路中保持 dry-run/mock 边界，并禁止任何路径表达 live trading 或绕过 Policy Gate。

#### Scenario: Discord approve remains weak confirmation
- **WHEN** Discord 回复表达 approve
- **THEN** 回复只生成 approval input
- **AND** approval evaluator 判断确认等级
- **AND** manual-only、strong confirm 或 link confirm 不得被普通 Discord 文本直接满足

#### Scenario: Approved input still requires Policy Gate
- **WHEN** approval evaluator 得到 approve intent
- **THEN** 系统必须调用 Policy Gate
- **AND** Policy Gate 不可用、拒绝或失败时 executor 不被调用

#### Scenario: Completed payload is safe summary
- **WHEN** 系统发布 `approval.completed`
- **THEN** payload 只能表达 approval status、intent、policy gate status 和 mock/dry-run/requested execution summary
- **AND** 不表达真实 broker 成功、真实成交或 live trading

### Requirement: Production loop SHALL be verifiable without external Discord by default

系统 SHALL 提供默认不依赖真实 Discord 网络的自动化验证，并允许 env-gated smoke 验证真实 Discord。

#### Scenario: Unit tests use fake runtime
- **WHEN** 运行 core、worker、API 和 Web 默认测试
- **THEN** 测试不需要真实 Discord webhook URL
- **AND** 不需要真实 Discord public key 或 private key
- **AND** 不需要外部网络

#### Scenario: End-to-end smoke proves loop shape
- **WHEN** 使用 memory event bus 或测试 harness 创建 NVDA action request
- **THEN** 测试能观察 approval DB record
- **AND** 能观察 notification dispatch result
- **AND** 能通过 approval input 完成 rejected、escalated、policy blocked 或 dry-run requested 等安全结果

#### Scenario: Real Discord smoke is supplemental
- **WHEN** 开发者提供真实 Discord 环境变量并手动运行 smoke
- **THEN** 可以验证 Discord send / receive
- **AND** smoke 通过不表示生产级重试、DLQ、真实 broker 或 live trading 已完成
