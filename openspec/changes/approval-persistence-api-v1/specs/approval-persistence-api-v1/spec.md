## ADDED Requirements

### Requirement: Approval V1 SHALL expose persistent list and detail resources
系统 SHALL 以数据库持久化状态作为 Approval V1 REST 资源的业务真源，并通过 `/api/v1/approvals` 提供队列查询与详情查询。

#### Scenario: List approvals from persistent source
- **WHEN** 调用方请求 `GET /api/v1/approvals`
- **THEN** API 返回 `ApiResponse` envelope，`data` 中包含 cursor-paginated approval summary collection
- **AND** 查询结果来自持久化 approval repository，不来自 `InMemoryApprovalRepository`、mock fixture 或 API app state
- **AND** 列表至少支持 `status`、`risk_level`、`required_confirmation_level`、`expires_before`、`cursor`、`limit` 和 `sort` 查询参数
- **AND** 每条 summary 至少包含当前状态、风险等级、确认等级、过期策略、action 摘要、最新 decision 摘要和 allowed actions

#### Scenario: Read approval detail with recoverable history
- **WHEN** 调用方请求 `GET /api/v1/approvals/{approval_id}`
- **THEN** API 返回 `ApiResponse` envelope，`data` 中包含单条 approval detail
- **AND** detail 包含脱敏 action request 摘要、approval 当前状态、inputs、evaluations、decisions 和 audit refs
- **AND** detail 足以从数据库恢复该 approval 的人工输入、评估和 decision 历史
- **AND** API 不直接返回 ORM model、core domain object 或内部 repository shape

### Requirement: Approval V1 actions SHALL persist input evaluation decision and audit records
系统 SHALL 通过后端 service 处理 `approve`、`reject` 和 `request-reanalysis` actions，并在同一事务内持久化 input、evaluation、decision、approval 当前状态和 approval scoped audit record。

#### Scenario: Approve action goes through evaluator and Policy Gate
- **WHEN** 有权限的调用方请求 `POST /api/v1/approvals/{approval_id}/actions/approve`
- **THEN** 后端 service 保存对应 `ApprovalInput`
- **AND** 该 input 的 `structured_payload.intent` 由 path action 固定为 `approve`
- **AND** evaluator 生成 `ApprovalEvaluation`
- **AND** Policy Gate 按现有 approval 安全语义判断是否允许继续
- **AND** service 写入 `ApprovalDecision`、更新 approval 当前状态并追加 audit record
- **AND** API 响应不把 approve 描述为真实交易成功、真实 broker 成交或 live trading 结果

#### Scenario: Reject action records terminal rejection
- **WHEN** 有权限的调用方请求 `POST /api/v1/approvals/{approval_id}/actions/reject`
- **THEN** 后端 service 保存 input、evaluation、rejected decision 和 audit record
- **AND** 该 input 的 `structured_payload.intent` 由 path action 固定为 `reject`
- **AND** approval 当前状态收敛到 terminal state
- **AND** 后续 executor 或 broker 副作用不会因 reject action 被触发

#### Scenario: Request reanalysis records intent only
- **WHEN** 有权限的调用方请求 `POST /api/v1/approvals/{approval_id}/actions/request-reanalysis`
- **THEN** 后端 service 保存 input、evaluation、`REANALYSIS_REQUESTED` decision 和 audit record
- **AND** 该 input 的 `structured_payload.intent` 由 path action 固定为 `request_reanalysis`
- **AND** API 不同步或异步触发新的 Agent run、worker 任务、scheduler 任务或重分析事件桥接
- **AND** 后续重分析执行链路需要由独立 change 定义

#### Scenario: Body intent cannot override path action
- **WHEN** action request body 包含 `structured_payload.intent` 且该 intent 与 path action 不一致
- **THEN** API 返回 400 错误 envelope
- **AND** 后端不会写入 input、evaluation、decision 或 audit action record
- **AND** 审计中不会出现 path action 与 body intent 冲突的双重意图

### Requirement: Approval V1 SHALL preserve terminal idempotency and duplicate input safety
系统 SHALL 保持 terminal approval 和重复 input id 的幂等语义，避免覆盖最终 decision 或重复触发高风险副作用。

#### Scenario: Terminal approval ignores later input
- **WHEN** approval 已处于 completed、expired、escalated 或 blocked 等 terminal status
- **AND** 调用方再次提交 approve、reject 或 request-reanalysis action
- **THEN** 后端不会覆盖既有最终 decision
- **AND** 后端不会再次调用 executor 或产生交易类副作用
- **AND** API 返回稳定 envelope，说明输入被忽略或 approval 已终态

#### Scenario: Duplicate input id reuses existing result
- **WHEN** 相同 `input_id` 被重复提交到同一个 approval action
- **THEN** 后端返回既有 input/evaluation/decision 结果
- **AND** 不重复写入新的 evaluation 或 final decision
- **AND** 不重复执行 Policy Gate 或 executor

#### Scenario: Concurrent action cannot overwrite final state
- **WHEN** 两个 action 并发尝试更新同一个 pending approval
- **THEN** 持久化层使用 version 字段或 row lock 防止先读后写覆盖
- **AND** 最多一个 action 生成最终 decision
- **AND** 另一个 action 收敛为冲突、ignored 或幂等结果，并保留可审计记录

### Requirement: Approval V1 SHALL use approval scoped append-only audit records
系统 SHALL 为 Approval V1 关键状态变化写入 approval scoped append-only audit records，并保留后续迁移到统一 `audit_logs` 的字段语义。

#### Scenario: Approval action audit is append-only
- **WHEN** approval action 导致 input、evaluation、decision 或当前状态变化
- **THEN** 系统追加 audit record，包含 actor、action、resource、request_id、channel、before status、after status、reason summary 和相关 record refs
- **AND** audit record 不通过 update 覆盖历史记录
- **AND** 主表当前状态更新与 audit 追加在同一事务边界内完成

#### Scenario: Append-only records have stable identity and ordering
- **WHEN** 系统写入 approval input、evaluation、decision 或 audit record
- **THEN** 每条 append-only record 都有稳定 `record_id`、`approval_id` 和 `created_at`
- **AND** `approval_decisions` 支持 nullable `input_id`，用于非人工输入 decision
- **AND** latest decision 可通过主表 ref 或 `created_at` + `record_id` / sequence 稳定恢复

#### Scenario: Audit payload is redacted
- **WHEN** audit record 保存 action request、input 或 decision 摘要
- **THEN** payload 不包含 secret、token、完整 prompt、私有策略、broker credential、真实账户凭证或完整敏感 proposed payload
- **AND** 敏感字段只保存 masked marker、summary 或 reference

### Requirement: Approval V1 API SHALL enforce envelope request id capability and CSRF rules
系统 SHALL 对 Approval V1 查询和 actions 应用统一 API envelope、request id、capability gate、CSRF 和错误映射规则。

#### Scenario: List and detail require read capability
- **WHEN** 调用方缺少 `approval.read` capability 请求 `GET /api/v1/approvals` 或 `GET /api/v1/approvals/{approval_id}`
- **THEN** API 返回 403 错误 envelope
- **AND** 错误 payload 包含 `error.request_id`
- **AND** 响应不暴露内部权限实现、traceback 或敏感配置

#### Scenario: Actions require approval approve capability and CSRF
- **WHEN** 调用方缺少 `approval.approve` capability 或缺少有效 CSRF 上下文请求任一 approval action
- **THEN** API 拒绝该 action，并返回标准错误 envelope
- **AND** 后端不会写入 input、evaluation、decision 或 audit action record
- **AND** 前端按钮、Discord 文本和 ad hoc client 都不能绕过该后端检查

#### Scenario: Unknown approval returns structured not found
- **WHEN** 调用方请求不存在的 `approval_id`
- **THEN** API 返回 404 错误 envelope
- **AND** 错误 payload 包含稳定 error code、resource id 摘要和 request id
- **AND** 响应不暴露数据库查询细节或内部路径

### Requirement: Approval V1 SHALL keep REST as state source of truth
系统 SHALL 以 REST、数据库和 audit records 恢复 Approval 状态；实时通道和 notification handoff 只能表达状态变化或人工输入事实，不能替代 Approval REST 查询真源。

#### Scenario: Discord handoff converges into persistent approval input
- **WHEN** Discord interaction 或 notification handoff 表达人工 approve、reject 或 request_reanalysis 意图
- **THEN** handoff 只能转换为 `ApprovalInput` 并进入同一 evaluator / Policy Gate / repository 链路
- **AND** Discord 回流不直接写最终 decision 或绕过后端 approval service

#### Scenario: Realtime notification does not replace REST recovery
- **WHEN** 后续实时通道发送 approval 状态变化提醒
- **THEN** 客户端仍通过 `GET /api/v1/approvals` 或 `GET /api/v1/approvals/{approval_id}` 恢复权威状态
- **AND** 实时消息不作为 approval 当前状态、history 或 audit 的唯一真源
