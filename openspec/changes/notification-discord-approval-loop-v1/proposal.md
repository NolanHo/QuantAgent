## Why

`hitl-approval-orchestration-v1` 已经把审批主链路收成 core-only harness：`action.requested -> approval.requested / notification.requested -> approval.input_received -> approval.completed`。Agent Chat 现在可以通过 `submit_action_plan` 发布 `action.requested`，worker 也可以创建 approval，但真实 NVDA 财报测试还缺一段可用的通知发送接线。

当前产品判断是：默认 notification provider 应该就是官方 Discord 插件；用户只需要在 Web 插件配置管理里填写 Discord webhook URL；审批授权仍由 Web `/approvals` 页面完成。本轮不要求 Discord receive、Discord interaction、Discord slash command 或 Discord 文本 approve。继续把 webhook URL、插件配置 JSON 或 Discord public key 放进环境变量，会让真实测试绕过插件配置管理，也会让用户误以为 Discord 回复已经是授权入口。

如果不单独收口这条发送链路，后续会反复出现三个问题：

- 把 `notification.requested` 误当成真实发送完成，跳过 dispatcher / send result / completed 语义。
- 让 worker/API 从 `.env` 或 `NOTIFICATION_DISPATCH_PLUGIN_CONFIG` 读取 webhook，绕过 Web 插件配置管理和敏感字段掩码。
- 把 Discord receive / ingress 当作当前验收路径，导致用户以为可以在 Discord 内审批，而不是去 Web `/approvals`。

本 change 只收“Discord webhook 通知发送”这一刀：把审批产生的脱敏 `notification.requested` 发送到官方 Discord notification 插件，并明确审批动作必须回到 Web 审批工作台完成。

## What Changes

- 新增 `notification-discord-approval-loop-v1` capability，定义审批通知从 `notification.requested` 到默认 Discord `notification.send`，再到 `notification.completed` 的发送链路。
- 在 core / worker 层规划 notification dispatcher：消费 `notification.requested`，构造 `NotificationSendInput`，通过 Registry + Runtime 调用目标 notification 插件；事件处理路径发布 `notification.completed`，但不把它解释为用户已审批。
- Discord notification 插件公开配置只保留 `webhook_url` 和 `timeout_seconds`；`webhook_url` 是用户-facing sensitive 字段，由 Web 插件配置管理保存、掩码展示，worker 运行时解密后以内存配置注入插件。
- 默认运行配置使用 `quantagent.official.notification.discord` 和 `channel=discord`；不存在 `NOTIFICATION_DISPATCH_PLUGIN_CONFIG`，也不通过 `DISCORD_WEBHOOK_URL` 配置生产链路。
- 固定安全边界：Discord 只负责通知送达；approve / reject / request-reanalysis 只能在 Web `/approvals` 调真实 approval API 完成；Discord 文本回复不属于本轮授权入口。

## Out Of Scope

- 不实现 Discord receive、interaction webhook、slash command、message component、button、modal、autocomplete、followup message、deferred response、gateway 或 polling。
- 不让 Discord 文本 approve / reject 进入 approval state machine。
- 不新增通用 Vault、Secret Manager、多 provider dispatcher 策略、多 endpoint binding、生产级 outbox、DLQ、持久化 notification delivery record 或投递历史 API。
- 不接真实 broker、真实下单、live trading、生产账户或 broker credential。
- 不让 Discord 插件、API host 或 dispatcher 直接创建 approved 状态、发布 `approval.completed`、调用 Policy Gate 或调用 executor。
- 不把 `notification.completed` 表达成用户已审批、动作已执行或 broker 已完成。

## Capabilities

### New Capabilities

- `notification-discord-approval-loop-v1`：定义 HITL 审批通知的默认 Discord webhook 发送 dispatcher、发送完成语义、插件配置管理边界、消息脱敏和 Web 审批授权边界。

### Modified Capabilities

- `hitl-approval-orchestration-v1`：承接其后续 notification dispatcher / sender change，不改变 HITL core approval 的安全语义。
- `discord-experimental-plugins`：本轮只把官方 Discord notification 插件作为 `notification.send` webhook 发送适配器使用；低层 receive 兼容能力不作为当前产品配置、默认测试或验收入口。
- `plugin-config-values`：复用已保存、加密、掩码展示的插件配置值，禁止生产通知链路从 env plugin config 注入 webhook。
- `kafka-event-bus-v1`：复用当前 topic policy 中已允许的 `notification.requested` / `notification.completed`；本 change 补充 `notification.completed` payload 只表示发送尝试结果。

## Impact

- OpenSpec：更新 `openspec/changes/notification-discord-approval-loop-v1/`，把验收范围收敛为 send-only。
- Core / worker 实现：主要影响 notification dispatcher、worker notification handler、settings 默认值和 tests。
- API / Web 实现：API 保留插件配置管理和 approvals API；Web 插件配置表单消费 Discord schema 并保存 `webhook_url`；Web `/approvals` 是授权入口。
- Discord 插件：公开 manifest / schema / README 表达 webhook send-only；低层兼容代码不得成为当前生产配置或验收说明。
