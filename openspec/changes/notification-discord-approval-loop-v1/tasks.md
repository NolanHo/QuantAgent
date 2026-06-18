## 1. OpenSpec artifacts

- [x] 1.1 更新 `notification-discord-approval-loop-v1` proposal，明确本轮只做 Discord webhook send，不做 Discord receive / 文本授权。
- [x] 1.2 更新 design，明确 worker dispatcher、插件配置读取、Web `/approvals` 授权入口和失败路径。
- [x] 1.3 更新 spec，覆盖默认 Discord send、`webhook_url` 插件配置、send-only schema、`notification.completed` 语义和 Web 审批边界。
- [x] 1.4 运行 `openspec validate notification-discord-approval-loop-v1 --type change --strict --json`。

## 2. Core / worker notification dispatcher

- [x] 2.1 在 core notification sender 中保留 `NotificationDispatchService`，通过 Registry + Runtime 调用 `notification.send`。
- [x] 2.2 在 core notification message builder 中保持脱敏输出，通知文案不得包含 webhook URL、完整 prompt、secret 或 broker credential。
- [x] 2.3 在 worker 中默认消费 `notification.requested` 并组装 `WorkerNotificationRequestedHandler`。
- [x] 2.4 worker 从 `PluginConfigService.resolve_secret(plugin_id, path="webhook_url")` 获取 Discord webhook，只以内存配置传给插件。
- [x] 2.5 core settings 默认 `NOTIFICATION_DISPATCH_ENABLED=true`、`NOTIFICATION_DISPATCH_PLUGIN_ID=quantagent.official.notification.discord`、`NOTIFICATION_DISPATCH_CHANNEL=discord`。
- [x] 2.6 不新增 `NOTIFICATION_DISPATCH_PLUGIN_CONFIG`，不从 `DISCORD_WEBHOOK_URL` 驱动生产 Agent approval notification path。

## 3. Discord plugin public contract

- [x] 3.1 更新 `plugins/notifications/discord/plugin.yaml`，公开 capability 只保留 `notification.send`，description 收敛为 webhook sender。
- [x] 3.2 更新 `plugins/notifications/discord/config.schema.json`，只暴露 required sensitive `webhook_url` 和可选 `timeout_seconds`。
- [x] 3.3 更新 Discord 插件实现，`send_text` 优先使用 `webhook_url`；旧 `webhook_secret_ref` 仅作为低层兼容路径。
- [x] 3.4 更新 Discord 插件 README，明确真实链路只能通过 Web 插件配置保存 webhook，并通过 Web `/approvals` 审批。

## 4. API / Web configuration and approval surface

- [x] 4.1 更新 `.env.example`，仅保留 notification dispatch enable / plugin id / channel，不提供 webhook env。
- [x] 4.2 更新 `apps/api/README.md`，说明本轮不要求 Discord receive / ingress / public key / application id。
- [x] 4.3 更新 Web 插件配置表单文案，让 `webhook_url` 显示为 Discord Webhook URL。
- [x] 4.4 保持 approvals Web/API 作为人工授权入口，不把 Discord 文本回复作为 approval input。

## 5. Documentation cleanup

- [x] 5.1 更新 `docs/demo/discord-approval-fullflow-smoke.md`，改成 webhook send + Web `/approvals` 真实验收手册。
- [x] 5.2 搜索并清理当前 change / README / demo 中要求 `DISCORD_WEBHOOK_URL`、`NOTIFICATION_DISPATCH_PLUGIN_CONFIG`、Discord public key 或 receive 的默认验收文案。
- [x] 5.3 如保留低层 receive 代码或测试，在文档中标记为历史/兼容/非本轮验收，不作为用户配置路径。

## 6. Tests

- [x] 6.1 worker 测试覆盖从插件配置表读取 `webhook_url` 并注入 runtime。
- [x] 6.2 core notification dispatch 测试覆盖 `webhook_url` 配置、不泄露敏感值和 failed completed 语义。
- [x] 6.3 API 测试覆盖 Discord 插件配置 schema 不暴露 `public_key` / `webhook_secret_ref`。
- [x] 6.4 Web 单元测试覆盖插件配置表单和 approvals workbench。
- [x] 6.5 重新运行本轮最小验证命令。

## 7. Validation

- [x] 7.1 `uv run --package quantagent-worker python -m unittest discover -s apps/worker/src/tests`
- [x] 7.2 `uv run --package quantagent-api python -m unittest apps/api/src/tests/test_app.py apps/api/src/tests/test_discord_approval_smoke_demo.py`
- [x] 7.3 `uv run --package quantagent-core python -m unittest packages/core/tests/test_notification_dispatch.py packages/core/tests/test_approval_harness.py packages/core/tests/test_approval_event_bus_topics.py packages/core/tests/test_approval_persistence.py`
- [x] 7.4 `uv run python -m unittest discover -s plugins/notifications/discord/tests -p 'test_*.py'`
- [x] 7.5 `bun run --cwd apps/web test:unit -- plugins-config plugin-config approval-workbench`
- [x] 7.6 `bun run --cwd apps/web build`
- [x] 7.7 `git diff --check`
