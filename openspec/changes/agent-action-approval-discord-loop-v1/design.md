## Context

当前仓库已经具备局部能力：

- `add-semiconductor-mainagent-nvda-fixture` 与 `replace-debug-agent-chat-with-real-agent-chat` 让 NVDA Agent Chat 能生成 ActionPlan 并调用 `submit_action_plan`。
- `hitl-approval-orchestration-v1` 已经在 core 中实现 `ActionRequestedHandler`、`ApprovalInputReceivedHandler`、`ApprovalOrchestrationService`、Policy Gate port 和 `ApprovalNotificationHandoffAdapter`。
- `approval-persistence-api-v1` 已经提供 SQLAlchemy approval repository 与 `/api/v1/approvals` REST API。
- `notification-discord-approval-loop-v1` 已经提供 notification dispatcher、Discord 消息 builder、`notification.completed` 发布语义和 notification receive handoff seam。
- Web `features/approvals` 仍是 mock 工作台；worker 只消费 `source.event.captured` 和 `industry.analysis.requested`。

本 change 的职责是生产装配，不重新定义 approval 状态机、Discord 插件协议或真实 broker 语义。

## Goals / Non-Goals

**Goals:**

- 让 Agent Chat 的 `submit_action_plan` 发布真实 `action.requested`，而不是只返回本地 fake 摘要。
- 让 worker 常驻消费 approval / notification 相关 topic，并使用数据库 repository 落库。
- 让 notification ingress 在有 event bus runtime 时把 Discord 回流发布为 `approval.input_received`。
- 让 Web 审批工作台默认读取真实 approval API，并保留 mock 仅作为测试 fixture。
- 用单元测试和 memory event bus smoke 覆盖从 action request 到 approval、notification、Discord receive handoff、approval completed 的关键路径。

**Non-Goals:**

- 不实现真实 broker、live trading、真实成交或生产账户状态更新。
- 不新增 outbox、DLQ、notification delivery 持久化表或生产重试队列。
- 不让 API 进程承担后台常驻 notification dispatcher。
- 不让 Discord 插件理解 approval 状态机或直接发布 `approval.*` topic。
- 不在本 change 中实现完整 WebSocket realtime；Web 通过 REST query 恢复状态。

## Decisions

### 1. 后台闭环归属 worker，而不是 API lifespan

生产消费入口放在 `apps/worker`：

```text
worker
  -> EventBusRuntime.consumer
  -> source / analysis handlers
  -> action.requested handler
  -> approval.input_received handler
  -> notification.requested handler
```

原因：

- 根规则要求 WebSocket/事件只做状态提醒，业务状态以 REST、数据库和审计恢复。
- API 应保持 HTTP 边界，不长期托管后台 dispatcher。
- worker 已经是事件消费 composition root，可以复用 DB session factory、PluginRegistry、PluginRuntimeService 和 EventBusRuntime。

### 2. Agent Chat 只发布 action.requested，不同步创建 approval

`submit_action_plan` 增加 action submission port。API Agent Chat service 在构造 tools 时注入 Event Bus publisher backed port；测试可注入 in-memory recording port。

输出新增字段：

```text
action_request_id
dispatch_status = action_requested | action_request_failed | action_submission_unavailable
approval_status_hint = pending_dispatch | unavailable | failed
notification_status_hint = pending_dispatch | unavailable | failed
```

工具不得声称 approval 已创建、notification 已发送、Discord 已送达或 broker 已执行。ActionPlan 到 `ActionRequest` 的映射只保留人工审批和审计所需的脱敏摘要：symbol、side、notional、risk controls、monitoring summary、idempotency key、confidence/risk flags 和 source artifact ids；不得保存完整 prompt、secret、broker credential 或 provider raw response。

### 3. Worker 每条消息使用短生命周期 DB session

worker 新增 production handlers：

```text
action.requested
  -> SQLAlchemyApprovalRepository(session)
  -> ApprovalOrchestrationService(event_publisher=ApprovalEventPublisher(runtime.publisher))
  -> submit_action()
  -> session.commit()

approval.input_received
  -> SQLAlchemyApprovalRepository(session)
  -> ApprovalOrchestrationService(...)
  -> submit_input()
  -> session.commit()

notification.requested
  -> NotificationRequestedHandler
  -> NotificationDispatchService(registry, runtime, config)
  -> NotificationEventPublisher(runtime.publisher)
```

approval 写入和 audit 写入在同一个 DB transaction 中提交；事件发布使用已有 publisher。第一刀不引入 outbox，因此实现必须在 README / PR 中明确：进程崩溃可能导致 DB 已提交但事件未发布的残余风险，后续由 outbox change 收敛。

### 4. API notification ingress 使用 publisher 模式 handoff

`NotificationIngressHostService` 默认从 app state 取得 EventBusRuntime publisher，组装 `ApprovalNotificationHandoffAdapter(publisher=...)`。如果没有 event bus runtime 或 `NOTIFICATION_INGRESS_ENABLED=false`，保留 no-op / disabled 语义。

API host 不解析 Discord 文本，不调用 approval service，不持有 DB approval repository，不判定 approve/reject/reanalysis。这样 webhook 响应不被长事务、Policy Gate 或 executor 阻塞。

### 5. Web approvals 使用 runtime API + TanStack Query

目标结构：

```text
apps/web/src/features/approvals/
  api/
    approval-workbench.api.ts
    approval-workbench.contracts.ts
  queries/
    approval-workbench.keys.ts
    use-approval-workbench-list.ts
    use-approval-workbench-detail.ts
    use-approval-workbench-overview.ts
    use-approval-link-context.ts
  mutations/
    use-approval-workbench-action.ts
  hooks/
    use-approval-workbench-page.ts
    use-approval-workbench-actions.ts
  types/
  utils/
```

`ApprovalWorkbenchApi` 只封装 endpoint 与 DTO 映射；query/mutation hook 通过 `useApis()` 获取 runtime-scoped API。mock 文件保留给 unit test 或 Story-like fixture，不再是默认 query source。

### 6. 配置保持显式

新增或确认配置：

```text
NOTIFICATION_DISPATCH_ENABLED=false
NOTIFICATION_DISPATCH_PLUGIN_ID=quantagent.official.notification.discord
NOTIFICATION_DISPATCH_PLUGIN_CONFIG={}
NOTIFICATION_DISPATCH_CHANNEL=discord
```

生产发送需要显式启用 dispatcher。禁用时 worker 应发布 failed/disabled `notification.completed` 或记录结构化 disabled 结果，不静默声称发送完成。

## Risks / Trade-offs

- [Risk] 第一刀没有 outbox，DB commit 与 event publish 不是原子事务。→ Mitigation：保守记录为 residual risk；测试覆盖正常链路，后续单独引入 outbox / retry。
- [Risk] API webhook 发布 `approval.input_received` 后 worker 未运行，用户以为审批已处理。→ Mitigation：handoff result 只表达已移交，不表达 completed；Web 以 REST approval 状态为真源。
- [Risk] Discord 文本 approve 对强确认场景造成误解。→ Mitigation：approval evaluator 保留弱确认边界，manual-only / strong / link confirm 可 escalated。
- [Risk] Web mock 到 API 的切换暴露旧 UI 字段假设。→ Mitigation：新增 contracts mapper，把 API DTO 映射到现有 `ApprovalWorkbenchItem`，避免组件直接依赖后端 DTO。
- [Risk] Worker topic 扩展影响现有 source/analysis 消费。→ Mitigation：使用 topic dispatch handler 分支，新增 handler tests 覆盖未知 topic 和既有 topic 不回归。

## Migration Plan

1. 先提交 OpenSpec-only PR；维护者明确评论“没问题”或批准后再进入代码实现。
2. 实现顺序：Agent action port → worker handlers → API ingress handoff → Web API 接入 → 端到端 smoke。
3. 本地使用 `EVENT_BUS_BACKEND=memory` 覆盖单进程 worker tests；跨进程 smoke 使用 Kafka。
4. Rollback 时可以关闭 `NOTIFICATION_DISPATCH_ENABLED`，并保持 Web 只显示 DB 中已有 approval；不影响 source/analysis 既有 worker topic。

## Open Questions

- 无。
