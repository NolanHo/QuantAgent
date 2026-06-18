## Context

当前已有四段能力：

- Agent 工具 `submit_action_plan` 可以把行动计划映射成 `action.requested`，并返回 `dispatch_status=action_requested`。
- worker 消费 `action.requested` 后，通过 `ApprovalOrchestrationService` 创建 approval，并在需要通知人类时发布 `notification.requested`。
- 官方 Discord notification 插件可以执行 `notification.send`，把文本发送到 Discord webhook。
- Web `/approvals` 已经有审批工作台和真实 approval API，是本轮人工授权入口。

当前缺口集中在发送侧和配置侧：

- worker 需要默认消费 `notification.requested` 并调度到 Discord `notification.send`。
- Discord webhook URL 不能再来自 `.env`、`DISCORD_WEBHOOK_URL` 或 `NOTIFICATION_DISPATCH_PLUGIN_CONFIG`，必须来自 Web 插件配置管理保存的 `webhook_url`。
- 文档和 OpenSpec 不能再把 Discord receive / interaction 当作当前真实验收路径。

## Goals

- 默认 notification dispatcher 使用 `quantagent.official.notification.discord` 和 `channel=discord`。
- 让 worker 从插件配置表读取 `webhook_url`，解密后以内存配置注入 Discord 插件。
- 让 `notification.completed` 只表达 webhook 发送尝试结果，不表达用户审批或 broker 执行。
- 让用户收到 Discord 通知后，回到 Web `/approvals` 做 approve / reject / request-reanalysis。
- 保持所有消息、日志、审计、stream、transcript 和测试 fixture 不暴露 webhook URL、完整 prompt、私有策略或交易密钥。

## Non-Goals

- 不做 Discord receive、interaction webhook、slash command、文本 approve、button、modal、gateway 或 polling。
- 不把 Discord 通知插件做成 approval service。
- 不把通知 dispatcher 做成插件生命周期管理器、Vault 或通用 provider routing 策略。
- 不新增数据库表、Alembic migration、outbox、DLQ 或投递历史查询 API。
- 不让 API 进程承担 worker consumer loop。
- 不接真实 broker 或 live trading；执行结果仍只能是 mock / dry-run / requested 摘要。

## File Plan

### Core notification sender

- `packages/core/src/quantagent/core/notifications/sender.py`
  - 提供 `NotificationDispatchService`
  - 校验目标插件记录、`notification.send` capability 和插件类型
  - 构造 `NotificationSendInput`
  - 调用 `PluginRuntimeService.invoke(...)`
  - 校验 `NotificationSendResult`
  - 返回 `NotificationDispatchResult`

- `packages/core/src/quantagent/core/notifications/message.py`
  - 提供审批通知文本 builder
  - 输入 JSON-safe 的 `notification.requested` payload
  - 输出脱敏 Discord 文本，必须包含 `approval_id`
  - 文案提示用户到 Web `/approvals` 审批，而不是在 Discord 回复
  - 不依赖 Discord 插件实现，不 import `plugins/**`

- `packages/core/src/quantagent/core/notifications/models.py`
  - 发送侧领域模型：
    - `NotificationDispatchRequest`
    - `NotificationDispatchResult`
    - `NotificationDeliverySummary`
  - 字段保持 JSON-safe，不包含 HTTP status code 常量或 API envelope

- `packages/core/src/quantagent/core/notifications/handlers.py`
  - `NotificationRequestedHandler` 消费 `EventEnvelope(topic="notification.requested")`
  - 调用 `NotificationDispatchService`
  - 通过 `NotificationEventPublisher` 发布 `notification.completed`

### Worker composition

- `apps/worker/src/quantagent/worker/main.py`
  - 默认订阅 `action.requested`、`approval.input_received`、`notification.requested`
  - 组装 `WorkerNotificationRequestedHandler`
  - 从 core settings 读取：
    - `NOTIFICATION_DISPATCH_ENABLED=true`
    - `NOTIFICATION_DISPATCH_PLUGIN_ID=quantagent.official.notification.discord`
    - `NOTIFICATION_DISPATCH_CHANNEL=discord`
  - 不读取 `NOTIFICATION_DISPATCH_PLUGIN_CONFIG`

- `apps/worker/src/quantagent/worker/consumer/notification_handler.py`
  - `WorkerNotificationRequestedHandler`：从 `PluginConfigService.resolve_secret(plugin_id, path="webhook_url")` 获取 webhook URL
  - 只在内存中把 `{"webhook_url": value}` 传给 `NotificationDispatchService`
  - 日志只输出安全错误码和 safe details，不输出 webhook URL

- `apps/worker/src/quantagent/worker/consumer/approval_handler.py`
  - `WorkerApprovalEventHandler.handle_action_requested()`：把 `action.requested` 交给 `ApprovalOrchestrationService`
  - `WorkerApprovalEventHandler.handle_approval_input_received()`：把 Web approval action 产生的 `approval.input_received` 交给同一个 approval 编排

### Discord plugin

- `plugins/notifications/discord/plugin.yaml`
  - 当前公开 capability 只声明 `notification.send`
  - description 说明这是 webhook notification sender

- `plugins/notifications/discord/config.schema.json`
  - `required: ["webhook_url"]`
  - `webhook_url` 标记 `sensitive: true`
  - `timeout_seconds` 可选
  - 不暴露 `webhook_secret_ref`、`public_key`、`public_key_ref`、`application_id`、guild/channel allowlist 或 receive 相关配置

- `plugins/notifications/discord/src/discord_plugin.py`
  - `send_text()` 优先读取 `webhook_url`
  - 低层兼容 `webhook_secret_ref` 只允许服务旧测试或开发脚本，不作为公开 schema 和生产配置契约
  - 插件不 import approval、Event Bus、API 或具体 app

### API / Web

- `apps/api/README.md` 与 `.env.example`
  - 只保留 dispatcher enable / plugin id / channel 默认配置
  - 明确 webhook URL 必须通过 Web 插件配置管理保存
  - 明确本轮不要求 Discord receive 和 public key / application id

- `apps/web/src/features/plugins/config-form/**`
  - 继续使用 schema-driven form 渲染 Discord 插件配置
  - `webhook_url` 按 sensitive 字段处理；展示掩码，保存走插件配置 API

- `apps/web/src/features/approvals/**`
  - 保持 Web `/approvals` 作为人工授权入口
  - approve / reject / request-reanalysis mutation 调真实 approval API

## Layering

发送链路：

```text
Agent submit_action_plan
  -> action.requested
  -> worker WorkerApprovalEventHandler.handle_action_requested()
  -> ApprovalOrchestrationService
  -> notification.requested
  -> worker WorkerNotificationRequestedHandler
  -> PluginConfigService.resolve_secret(webhook_url)
  -> NotificationDispatchService
  -> PluginRegistry.get_plugin(default Discord plugin)
  -> PluginRuntimeService.invoke(capability=notification.send)
  -> notification.completed
  -> user opens Web /approvals
  -> approval action API
  -> approval.input_received
  -> WorkerApprovalEventHandler.handle_approval_input_received()
  -> ApprovalOrchestrationService
```

依赖方向：

```text
apps/api -> packages/core -> packages/plugin-sdk <- plugins/notifications/discord
apps/worker -> packages/core
apps/web -> apps/api REST
```

禁止方向：

- `packages/core` 不 import `apps/api`、FastAPI、Starlette 或 `plugins/**`
- Discord 插件不 import `quantagent.core.approval`
- worker 不从 env/plugin config JSON 读取 Discord webhook URL
- Web 不绕过 approval API 直接改 approval 状态

## Models / Event Drafts

### `NotificationDispatchRequest`

字段草案：

- `request_id`
- `plugin_id`
- `correlation_id`
- `causation_id`
- `approval_id`
- `action_request_id`
- `channel`
- `text`
- `metadata`

说明：

- `text` 是发送给 notification 插件的脱敏文本。
- `metadata` 可包含 `approval_id`、`action_request_id`、`source_topic`，不得包含完整 prompt、secret、token、cookie、私有策略、webhook URL 或 broker credential。

### `NotificationDispatchResult`

字段草案：

- `request_id`
- `plugin_id`
- `accepted`
- `retryable`
- `code`
- `message`
- `correlation_id`
- `causation_id`
- `approval_id`
- `action_request_id`
- `channel`
- `metadata`

说明：

- `accepted=true` 只表示插件接受或 provider 请求成功，不表示用户已看见、不表示审批完成。
- `retryable=true` 表示平台可重试，但第一刀不实现持久化重试队列。

### `notification.completed` payload

最小字段：

- `notification_request_id`
- `plugin_id`
- `accepted`
- `retryable`
- `code`
- `message`
- `approval_id`
- `action_request_id`
- `channel`

禁止字段：

- Discord webhook URL
- public/private key
- signature header
- 完整 prompt
- secret、token、cookie
- 私有策略和 broker credential
- live trading / broker success 语义

## Configuration

默认环境配置只允许控制 dispatcher 是否启用和选择哪个插件：

```bash
NOTIFICATION_DISPATCH_ENABLED=true
NOTIFICATION_DISPATCH_PLUGIN_ID=quantagent.official.notification.discord
NOTIFICATION_DISPATCH_CHANNEL=discord
```

明确禁止：

- `NOTIFICATION_DISPATCH_PLUGIN_CONFIG`
- `DISCORD_WEBHOOK_URL`
- `webhook_secret_ref` 作为用户-facing 配置
- `NOTIFICATION_INGRESS_PLUGIN_CONFIG` 作为本轮 Discord 发送测试配置

用户-facing Discord 插件配置来自 Web 插件详情页：

```json
{
  "webhook_url": "https://discord.example.invalid/api/webhooks/...",
  "timeout_seconds": 5
}
```

平台保存时按 sensitive 字段加密；查询时只返回掩码；worker 运行时解密后只在内存中传给插件。

## Failure Paths

- `notification.requested` payload 非 mapping 或缺少 `approval_id`：dispatcher 拒绝，发布 failed `notification.completed` 或返回结构化失败，不调用插件。
- dispatcher 未启用：handler 返回 disabled 摘要，不调用插件，不影响 approval pending 状态。
- Discord 插件未配置 `webhook_url` 或解密失败：发送失败，`notification.completed.accepted=false`，错误不暴露 webhook URL。
- 插件不存在、状态非法或缺少 `notification.send`：发送失败，结果不泄露本地路径或 secret。
- Runtime invoke 失败或插件返回非法 DTO：发送失败，`retryable` 根据错误类型保守设置。
- Discord webhook 网络超时：插件返回 retryable，dispatcher 不做无限重试。
- 用户没有打开 Web `/approvals`：approval 保持 pending / expired 等审批域状态；Discord 通知发送成功不改变 approval decision。

## Validation Strategy

OpenSpec 校验：

```bash
openspec validate notification-discord-approval-loop-v1 --type change --strict --json
```

实现验证：

```bash
uv run --package quantagent-worker python -m unittest discover -s apps/worker/src/tests
uv run --package quantagent-api python -m unittest apps/api/src/tests/test_app.py apps/api/src/tests/test_discord_approval_smoke_demo.py
uv run --package quantagent-core python -m unittest packages/core/tests/test_notification_dispatch.py packages/core/tests/test_approval_harness.py packages/core/tests/test_approval_event_bus_topics.py packages/core/tests/test_approval_persistence.py
uv run python -m unittest discover -s plugins/notifications/discord/tests -p 'test_*.py'
bun run --cwd apps/web test:unit -- plugins-config plugin-config approval-workbench
bun run --cwd apps/web build
git diff --check
```

真实 NVDA 财报验收：

1. 在 Web 插件详情页为 `quantagent.official.notification.discord` 保存 `webhook_url`。
2. 启动 API、worker、web 和事件总线。
3. 触发 NVDA 财报重大利好 / 重大利空 routed event，使 Semiconductor MainAgent 只在重大事件时调用 `submit_action_plan`。
4. worker 创建 approval 并发送 Discord webhook 通知。
5. 打开 Web `/approvals`，查看 approval 详情、Agent Chat 处理记录和行动计划摘要。
6. 在 Web 页面执行 approve / reject / request-reanalysis。
7. 验证没有真实 broker / live trading 执行。

## Risks / Trade-offs

- [Risk] 第一刀没有持久化 delivery record，进程重启会丢失发送历史。
  Mitigation：本 change 只验证平台通过 Runtime 发起 `notification.send` 调用和事件语义；持久化 delivery / outbox / retry queue 后续单独设计。

- [Risk] Discord webhook 只能单向通知，用户仍要回到 Web 审批。
  Mitigation：这是本轮刻意收窄的安全边界；Discord receive / button / modal 后续独立 change。

- [Risk] `notification.completed` 容易被误读成用户已确认。
  Mitigation：spec、README 和测试明确它只表达发送尝试结果，审批结论仍只看 approval 域。
