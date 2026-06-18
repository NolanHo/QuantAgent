## Why

NVDA Agent Chat 已经能在调试链路中生成 ActionPlan 和 `submit_action_plan` 摘要，core 也已经具备 approval、notification dispatcher、Discord plugin、notification ingress handoff 和 approval persistence API 的局部能力。当前缺口是这些能力尚未以生产链路连通：Agent 行动提交不会发布 `action.requested`，worker 不消费 approval / notification topic，API notification ingress 默认不会把 Discord 回流交给 approval input，Web 审批工作台仍读 mock。

如果不单独收口这条总装配链路，后续调试会继续把 `submit_action_plan` 的本地摘要误当成审批和通知闭环完成，也容易让 API 或 Discord 插件绕过 core Approval / Policy Gate / audit 边界。

## What Changes

- 新增生产闭环能力 `agent-action-approval-discord-loop-v1`，把 Agent 行动提交、worker approval handler、notification dispatcher、Discord ingress handoff 和 Web 审批工作台接到同一条链路。
- Agent Chat 运行时为 `submit_action_plan` 注入 action submission port；工具将 ActionPlan 映射为脱敏 `ActionRequest` 并发布 `action.requested`，返回 `action_request_id`、`dispatch_status=action_requested`、`approval_status_hint` 和 `notification_status_hint`。
- Worker 默认常驻 consumer 扩展消费 `action.requested`、`approval.input_received` 和 `notification.requested`，并用 SQLAlchemy approval repository、ApprovalOrchestrationService 和 NotificationDispatchService 完成生产处理。
- API notification ingress 默认可以组装 `ApprovalNotificationHandoffAdapter`，以 publisher 模式发布 `approval.input_received`，不在 webhook 请求内直接执行审批状态机。
- Web 审批工作台新增 `features/approvals/api/` 契约与 `ApprovalWorkbenchApi`，list/detail/overview/actions 改为读取真实 `/api/v1/approvals`。
- 保留真实 broker / live trading 为非目标；所有执行语义仍只能表达 mock、dry-run 或 request 摘要。

## Capabilities

### New Capabilities

- `agent-action-approval-discord-loop-v1`: 定义 AI 行动提交到 approval persistence、Web 控制台、Discord 发送和 Discord 回流输入的生产闭环。

### Modified Capabilities

- `kafka-event-bus-v1`: 复用既有 topic policy，不新增 topic；本 change 要求 worker 生产入口实际订阅 `action.requested`、`approval.input_received` 和 `notification.requested`。
- `hitl-approval-orchestration-v1`: 复用 `ActionRequestedHandler`、`ApprovalInputReceivedHandler` 和 `ApprovalNotificationHandoffAdapter`，将其从 core harness 扩展到 worker/API production composition。
- `notification-discord-approval-loop-v1`: 复用 dispatcher、message builder 和 ingress handoff 语义，将发送侧 consumer 与 API handoff 装配到生产路径。
- `approval-persistence-api-v1`: 复用真实 approval repository 与 REST API；Web 工作台改为消费该 API，不再默认使用 mock。
- `agent-chat-session`: 复用 Agent Chat runtime，将 NVDA 调试行动提交改为发布生产 `action.requested`。

## Impact

- OpenSpec：新增 `openspec/changes/agent-action-approval-discord-loop-v1/`。
- Agent / API：影响 `packages/agent` 的 action submission seam、`apps/api` Agent Chat service 的 runtime 注入、notification ingress service 和 README 配置说明。
- Worker / Core：影响 `apps/worker` composition root、worker tests、core approval / notification handler 组装与 event bus 验证。
- Web：影响 `apps/web/src/features/approvals/**`、app runtime API 挂载和相关 unit tests。
- Runtime / 配置：新增或确认 `NOTIFICATION_DISPATCH_ENABLED`、`NOTIFICATION_DISPATCH_PLUGIN_ID`、`NOTIFICATION_DISPATCH_PLUGIN_CONFIG`、`NOTIFICATION_DISPATCH_CHANNEL`。
- Review：本 change 属于跨模块行为与架构变更；OpenSpec artifacts 需要先单独 review，通过后再进入实现 PR。
