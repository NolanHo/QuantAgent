# Discord 通知与 Web 审批真实测试

本文说明当前 NVDA / Semiconductor MainAgent 真实测试路径。Discord 本轮只负责 webhook 通知；人工授权在 Web `/approvals` 完成。

```text
Agent submit_action_plan
-> action.requested
-> worker 创建 approval
-> notification.requested
-> Discord webhook send
-> 用户打开 Web /approvals
-> approve / reject / request-reanalysis
-> approval.input_received
-> approval.completed 或安全终态
```

## 前置条件

1. 启动 API、worker、web、数据库和事件总线。
2. 在 Web 插件详情页打开 `quantagent.official.notification.discord`。
3. 在插件配置表单中填写 `webhook_url` 并保存。
4. 确认 worker 能读取同一个数据库和 `MODEL_CONFIG_ENCRYPTION_KEY`，否则无法解密 sensitive 插件配置。

不要在 `.env` 中配置 Discord webhook URL：

```text
DISCORD_WEBHOOK_URL=...
NOTIFICATION_DISPATCH_PLUGIN_CONFIG=...
```

这两个入口不属于生产 Agent approval notification path。

## 默认 notification 配置

`.env.example` 只保留 dispatcher 开关和默认插件选择：

```bash
NOTIFICATION_DISPATCH_ENABLED=true
NOTIFICATION_DISPATCH_PLUGIN_ID=quantagent.official.notification.discord
NOTIFICATION_DISPATCH_CHANNEL=discord
```

真实 webhook URL 必须通过 Web 插件配置管理保存到插件配置表。API 查询配置时只应看到 masked / unset 状态，不能返回明文。

## 真实 NVDA 验收

1. 打开 Agent Chat debug 页面，选择 semiconductor MainAgent 和 NVDA earnings routed event。
2. 触发一次重大利好或重大利空分析，让 Agent 在判断值得行动时调用 `submit_action_plan`。
3. 确认 Agent Chat 处理记录中能看到 action submission 工具调用和 `dispatch_status=action_requested`。
4. 启动 worker 消费事件。
5. 在 Discord 频道中确认收到 webhook 通知。
6. 打开 Web `/approvals`。
7. 找到对应 approval，查看 action request、风险摘要、Agent Chat session / run 引用和处理过程。
8. 在 Web 页面执行 approve / reject / request-reanalysis。
9. 确认 approval 进入 completed / rejected / escalated / policy-blocked 等安全终态。

本轮不验证 Discord `/notify`、interaction endpoint、public key、application id、guild/channel allowlist 或 Discord 文本 approve。

## 本地 approval harness

仓库仍保留一个本地 harness，用来验证 approval 事件编排和 debug 路由，不发送真实 Discord webhook：

```bash
uv run api-discord-approval-smoke
```

启动后访问：

```bash
curl http://127.0.0.1:8000/api/v1/debug/fullflow
```

预期看到一条本地 fake notification completed：

```json
{
  "approval_id": "approval-fullflow",
  "approval_status": "pending",
  "notification_completed_count": 1,
  "notification_completed_payloads": [
    {
      "accepted": true,
      "code": "LOCAL_SMOKE_SENT"
    }
  ]
}
```

这个 harness 不读取 `DISCORD_WEBHOOK_URL`，也不代表真实 Discord 发送成功。真实发送只能通过 Web 插件配置 + worker 链路验证。

## 常见问题

### Discord 没收到通知

优先检查：

- Web 插件配置里是否已保存 `webhook_url`。
- worker 是否连接同一个数据库。
- worker 是否配置了正确的 `MODEL_CONFIG_ENCRYPTION_KEY`。
- worker 日志中是否出现 `Discord notification plugin config unavailable`。
- `notification.completed` 的 payload 是否为 failed，并且错误码是否指向插件未配置、插件缺失或网络失败。

### Web /approvals 没有审批项

先确认 Agent 是否真的调用了 `submit_action_plan`。如果 Agent 初步判断不是重大利好 / 重大利空，它应该直接总结，不会提交 action plan，也不会创建 approval。

### Discord 回复 approve 没反应

这是当前预期行为。本轮不启用 Discord receive；Discord 文本不进入 approval state machine。请在 Web `/approvals` 页面审批。
