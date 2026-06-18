# Discord Notification

这是第一版官方 Discord notification 插件。本轮生产链路只使用 webhook 发送通知；审批授权在 Web `/approvals` 完成，不要求 Discord receive。

## 当前支持

- 使用 `plugin.yaml` + `config.schema.json` 注册为单个官方 `notification` 类型插件。
- 通过 `notification.send` 发送最小文本消息到 Discord webhook。
- 公开配置只暴露 `webhook_url` 和 `timeout_seconds`。
- 运行时由 worker 从插件配置表解密 `webhook_url` 后以内存配置传给插件。
- 低层代码可能保留历史 receive 适配测试能力，但它不属于当前公开 manifest、配置 schema、真实测试或审批授权入口。

## 配置

`config.schema.json` 统一描述用户需要填写的最小字段：

- `webhook_url`: 完整 Discord webhook URL，`sensitive: true`，由平台加密保存并在响应中掩码。
- `timeout_seconds`: 发送请求超时。

示例配置：

```json
{
  "webhook_url": "https://discord.example.invalid/api/webhooks/...",
  "timeout_seconds": 5
}
```

## 独立测试

运行统一插件测试：

```bash
uv run python -m unittest discover -s plugins/notifications/discord/tests -p 'test_*.py'
```

## 真实测试方式

1. 在 Web 插件详情页打开 `quantagent.official.notification.discord`。
2. 在配置表单中填写 `webhook_url` 并保存。
3. 启动 API 和 worker，触发会调用 `submit_action_plan` 的 Agent Chat / routed event。
4. worker 消费 `notification.requested` 后应向 Discord webhook 发送一条审批通知。
5. 用户在 Web `/approvals` 页面完成 approve / reject / request-reanalysis。

不要通过 `.env`、`DISCORD_WEBHOOK_URL` 或 `NOTIFICATION_DISPATCH_PLUGIN_CONFIG` 配置 webhook。

## 非目标

- 不支持 polling、gateway、富消息、附件、多 guild 管理、审批回流、自动执行、统一聊天通道或主事件流接入。
- 不支持 message component、autocomplete、modal submit、followup message 或延迟回调链路。
- 不在 README、schema 或测试样例中暴露真实 webhook URL、私钥或私有频道信息。
