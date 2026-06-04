# core approval

`quantagent.core.approval` 承载 HITL 行为请求审批编排的 core-only 边界。它把 `action.requested`、审批策略解析、人工输入评估、Policy Gate 调用点、fake executor 摘要和 `approval.completed` 收到一条可测试链路里。

## 职责

这个目录负责：

- 定义 JSON-safe approval domain models。
- 解析保守审批策略，覆盖 notify-only、execute-then-notify、approval-required、timeout、manual-only 和 blocked。
- 保存 action / approval / input / evaluation / decision 的 repository contract；`InMemoryApprovalRepository` 只用于 harness / 单元测试，生产持久化由 `quantagent.core.db.repositories.approval_repository` 提供。
- 生成 approval scoped append-only audit record，记录状态变化、人工输入、decision 和 ignored 输入的可回放摘要。
- 定义 `PolicyGate` 与 `ActionExecutor` port。
- 发布 `approval.requested`、`notification.requested` 和 `approval.completed`。
- 通过 `notification_handoff.py` 消费 notification ingress 已记录的 handoff fact，并转成 `ApprovalInput` 或 `approval.input_received`。
- 提供 Event Bus handler 和本地 fake harness。

这个目录不负责：

- FastAPI route、HTTP 状态码、API envelope 或 OpenAPI。
- FastAPI 请求级 session、HTTP commit/rollback、OpenAPI DTO 或 response envelope。
- 通用 `audit_logs` 平台、outbox、DLQ、跨模块 audit taxonomy 或 replay API。
- Web 页面、React 状态、前端 DTO 或 generated client。
- 真实 notification provider、真实 broker、真实密钥、生产账户或 live trading。
- 具体插件实现或插件间 import。

## 入口

- `ApprovalOrchestrationService.submit_action()`：处理 `ActionRequest`。
- `ApprovalOrchestrationService.submit_input()`：处理 `ApprovalInput`。
- `ApprovalOrchestrationService.expire_approval()`：处理 timeout 收敛。
- `ActionRequestedHandler` / `ApprovalInputReceivedHandler`：只做 EventEnvelope 到 service 的适配。
- `ApprovalNotificationHandoffAdapter`：只做 notification handoff request 到 approval input 的适配。
- `harness.py`：测试专用 fake producer、fake notification consumer、fake human input producer、fake PolicyGate 和 fake executor。

## Event Bus topic

当前 approval 链路使用 Event Bus V1 的默认 topic policy。topic 是模块间状态变化和输入事实的异步边界，不是数据库、审计或执行结果真源。新增、重命名或改变 payload 语义时，必须先更新对应 OpenSpec / design 真源、`quantagent.core.events` topic policy 和 contract tests。

### `action.requested`

- 发布方：Agent、Decision、工具或测试 harness 中的行为请求生产者。
- 消费方：`ActionRequestedHandler`。
- 处理入口：handler 将 JSON-safe payload 映射为 `ActionRequest`，再调用 `ApprovalOrchestrationService.submit_action()`。
- 语义：表达“系统产生了一个待审批 / 待处理动作请求”，例如调仓、执行订单、通知或重分析意图。
- 最小 payload：`ActionRequest.to_mapping()` 输出，包含 `id`、`action_type`、`action_side`、`target_type`、`target_id`、`risk_flags`、`urgency`、`proposed_payload` 摘要、policy hint 和 `correlation_id`。
- 边界：payload 必须 JSON-safe，不得包含 ORM model、DB session、插件实例、不可序列化对象、secret、token、完整 prompt、私有策略或 broker credential。
- 不代表：不代表 approval 已持久化、通知已发送、Policy Gate 已通过或 broker 已执行。

### `approval.requested`

- 发布方：`ApprovalEventPublisher.publish_approval_requested()`。
- 消费方：Approval REST / Web / realtime / notification 编排的后续消费者；当前测试可通过 recording handler 观察。
- 触发条件：`ApprovalOrchestrationService.submit_action()` 解析策略后确认需要人工介入。
- 语义：表达“已创建待人工处理的 `ApprovalRequest`”。
- 最小 payload：`approval_id`、`action_request_id`、`target_type`、`target_id`、`action_type`、`action_side`、`risk_level`、`urgency`、`required_confirmation_level`、`expires_at`、`expiration_action`、`summary` 和 `safe_context`。
- 边界：这是脱敏状态摘要；`safe_context` 只保留人工判断所需的安全上下文，不携带完整 `proposed_payload`。
- 不代表：不代表通知 provider 已投递、不代表 audit 已落库、不代表该事件本身可替代 `approval_requests` 当前状态表。

### `notification.requested`

- 发布方：`ApprovalEventPublisher.publish_notification_requested()`。
- 消费方：notification dispatcher / sender 或测试 harness 中的 `HumanAuthorizationMessageBuilder` / fake notification consumer。
- 触发条件：approval 需要通知人工处理，或 notify-only / execute-then-notify / timeout 分支需要发出通知请求。
- 语义：表达“approval 编排请求发送一条通知”，用于把脱敏审批摘要交给 notification 侧处理。
- 最小 payload：`approval_id`、`action_request_id`、`message_type=approval_request`、`summary`、`risk_level`、`required_confirmation_level`、`expires_at`、`expiration_action`、`allowed_channels`、`safe_context` 和 `reason_summary`。
- 边界：只表示平台请求发送通知。真实 provider 选择、插件调用、外部送达和失败重试属于 notification dispatcher / sender 边界。
- 不代表：不代表 `notification.send` 已调用，不代表外部 IM / webhook 已送达，不代表 `notification.completed` 已发布，也不代表审批已经完成。

### `approval.input_received`

- 发布方：Web / CLI / fake human input producer，或 `ApprovalNotificationHandoffAdapter` 在 publisher 模式下由 notification receive handoff 转换后发布。
- 消费方：`ApprovalInputReceivedHandler`。
- 处理入口：handler 将 JSON-safe payload 映射为 `ApprovalInput`，再调用 `ApprovalOrchestrationService.submit_input()`。
- 语义：表达“某个人工输入事实已进入 approval 域”，来源可以是 Web、approval link、Discord / IM、邮件或本地 CLI。
- 最小 payload：`ApprovalInput.to_mapping()` 输出，包含 `id`、`approval_id`、`channel`、`actor_ref`、`raw_text`、`structured_payload` 和 `received_at`。
- 边界：文本输入和弱确认通道必须经过 evaluator；`structured_payload.intent` 只能表达输入意图，不能绕过 Policy Gate 或直接写最终 decision。
- 不代表：不代表输入已被批准、不代表最终 decision 已生成、不代表 executor 或 broker 已被调用。

### `approval.completed`

- 发布方：`ApprovalEventPublisher.publish_approval_completed()`。
- 消费方：实时提醒、后续状态同步、测试 harness 或未来 worker / audit timeline 消费者。
- 触发条件：approval 编排生成 terminal 或安全完成摘要，包括 not-required、rejected、reanalysis-requested、blocked、policy-gate-failed、execution-requested 等。
- 语义：表达“本次 approval 编排已经收敛为一个安全完成摘要”。
- 最小 payload：`approval_id`、`action_request_id`、`status`、`intent`、`policy_gate_status`、`execution_status`、`reason_summary` 和 `correlation_id`。
- 边界：`status` 来自 `ApprovalDecisionStatus`；`execution_status` 只能表达 not-requested、mock / dry-run requested 或 request failed 这类请求摘要。
- 不代表：不代表真实 broker 成功、不代表 live trading、真实成交、真实账户状态或 notification provider 已送达；也不代表该事件可替代 `approval_decisions` 或 `approval_audit_records`。

## Topic 数据流

典型人工审批链路：

```text
action.requested
  -> ActionRequestedHandler
  -> ApprovalOrchestrationService.submit_action()
  -> approval.requested
  -> notification.requested
  -> notification.receive / NotificationApprovalHandoffPort
  -> approval.input_received
  -> ApprovalInputReceivedHandler
  -> ApprovalOrchestrationService.submit_input()
  -> ApprovalEvaluation
  -> ApprovalDecision
  -> approval.completed
```

REST action 链路不会先发布 `approval.input_received`；API route 会直接调用 approval API service，构造 `ApprovalInput` 后进入同一个 `submit_input()` / evaluator / decision / audit 路径。后续如果需要 outbox 或跨进程异步 action，可以再定义是否改走 `approval.input_received`。

## 状态边界

Event Bus 只表达状态变化，不是审批、审计或 broker 执行真源。生产查询真源是 core DB repository 中的 `approval_requests` 当前状态表，以及 `approval_inputs`、`approval_evaluations`、`approval_decisions`、`approval_audit_records` append-only 历史。主表状态更新、input/evaluation/decision 写入和 approval scoped audit record 应在同一调用方事务内提交。

`ApprovalQueryService` 提供 API 所需的 summary/detail/history/audit refs read model；API 不应直接拼 ORM 查询或返回 core domain object。

## 安全边界

用户 approve 后仍必须经过 `PolicyGate`。未注入 `PolicyGate` 时，任何可能调用 executor 的路径默认阻断。自然语言文本、IM 回复、一次性链接消息和 AI policy hint 都不能直接绕过 evaluation 和 Policy Gate。

`approval.completed` 只表达安全完成摘要和 fake executor 请求状态，不表达真实 broker 成功、live trading、真实成交或真实账户状态。

API、日志和 audit summary 只保存脱敏摘要；不要写入 secret、token、完整 prompt、私有策略、broker credential、真实账户凭证或完整敏感 proposed payload。`request_reanalysis` V1 只记录人工意图、evaluation、decision 和 audit，不触发 AgentRuntime、worker 或 scheduler。
