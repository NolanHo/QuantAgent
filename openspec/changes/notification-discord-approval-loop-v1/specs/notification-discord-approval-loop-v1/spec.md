## ADDED Requirements

### Requirement: 平台 SHALL 默认调度审批通知到 Discord send 插件

系统 SHALL 在收到 `notification.requested` 后，通过平台 dispatcher 选择默认 Discord notification 插件并调用 `notification.send`。

#### Scenario: notification.requested 调用默认 Discord send
- **WHEN** approval 编排发布包含 `approval_id` 的 `notification.requested`
- **AND** notification dispatcher 已启用
- **THEN** dispatcher 使用默认插件 `quantagent.official.notification.discord`
- **AND** dispatcher 构造 `NotificationSendInput`
- **AND** 通过 Registry record 与 Runtime invoke 调用 `notification.send`
- **AND** 不直接 import Discord 插件实现

#### Scenario: dispatcher 不把 requested 当作已送达
- **WHEN** 系统发布 `notification.requested`
- **THEN** 该事件仍只表示发送请求
- **AND** 只有 dispatcher 完成插件调用后才可以发布 `notification.completed`
- **AND** `notification.completed` 不表示用户已审批、不表示 broker 已执行

#### Scenario: dispatcher 缺配置时安全降级
- **WHEN** dispatcher 未启用、目标插件不存在、插件状态非法、缺少 `notification.send` 或缺少 webhook 配置
- **THEN** 系统不调用插件或让插件返回结构化失败
- **AND** 事件处理路径发布 failed `notification.completed`
- **AND** 同步 service 路径返回 failed `NotificationDispatchResult`
- **AND** 错误不暴露本地路径、webhook URL、secret、token 或 traceback

### Requirement: Discord webhook SHALL 只来自插件配置管理

系统 SHALL 把 Discord webhook URL 作为 Discord notification 插件的用户-facing sensitive 配置字段保存和读取，而不是通过环境变量或 dispatcher plugin config 传入。

#### Scenario: Web 插件配置保存 webhook_url
- **WHEN** 用户在 Web 插件详情页配置 `quantagent.official.notification.discord`
- **THEN** 表单基于插件 `config.schema.json` 展示 `webhook_url`
- **AND** `webhook_url` 被标记为 sensitive
- **AND** 保存后平台加密存储
- **AND** 后续读取配置时只返回掩码或 unset 状态

#### Scenario: Worker 运行时解密并内存注入
- **WHEN** worker 处理 `notification.requested`
- **THEN** worker 通过插件配置服务读取并解密 `webhook_url`
- **AND** 只以内存配置传给 `NotificationDispatchService`
- **AND** 不把 webhook URL 写入 event、transcript、日志、API response 或 `notification.completed`

#### Scenario: 环境变量不承载 Discord webhook
- **WHEN** 系统启动 notification dispatcher
- **THEN** 可以读取 `NOTIFICATION_DISPATCH_ENABLED`
- **AND** 可以读取 `NOTIFICATION_DISPATCH_PLUGIN_ID`
- **AND** 可以读取 `NOTIFICATION_DISPATCH_CHANNEL`
- **AND** MUST NOT require or consume `NOTIFICATION_DISPATCH_PLUGIN_CONFIG`
- **AND** MUST NOT require or consume `DISCORD_WEBHOOK_URL` for the production Agent approval notification path

### Requirement: Discord 插件公开配置 SHALL 是 webhook send-only

系统 SHALL 让官方 Discord notification 插件的公开 manifest/schema 表达当前生产测试范围：只发送 webhook 通知。

#### Scenario: 公开 schema 只包含发送配置
- **WHEN** 平台读取 Discord notification 插件 `config.schema.json`
- **THEN** schema 包含 required `webhook_url`
- **AND** schema 可以包含 `timeout_seconds`
- **AND** schema 不包含 `webhook_secret_ref`
- **AND** schema 不包含 `public_key`、`public_key_ref`、`application_id`、guild allowlist 或 channel allowlist

#### Scenario: 公开 capability 不要求 receive
- **WHEN** 平台扫描 Discord notification 插件 manifest
- **THEN** 当前产品验收只依赖 `notification.send`
- **AND** 不要求 `notification.receive`、Discord interaction 或 slash command capability

#### Scenario: 低层兼容不成为产品契约
- **WHEN** 插件代码保留旧测试或低层兼容路径
- **THEN** 这些路径不得出现在公开 schema、默认配置、真实测试手册或产品验收条件中
- **AND** 不得要求用户配置 public key、application id 或 secret reference

### Requirement: Discord 通知消息 SHALL 脱敏并引导 Web 审批

系统 SHALL 将审批通知转换为适合 Discord webhook 发送的脱敏消息，并引导用户到 Web `/approvals` 完成人工授权。

#### Scenario: 消息包含最小审批上下文
- **WHEN** dispatcher 构造 Discord 审批通知文本
- **THEN** 文本包含 `approval_id`
- **AND** 文本包含动作摘要、风险方向、确认等级和可选过期时间
- **AND** 文本说明用户应打开 Web `/approvals` 审批

#### Scenario: 消息不泄露敏感信息
- **WHEN** `notification.requested` 来源 action 包含 prompt、secret、token、cookie、私有策略、webhook URL 或 broker credential
- **THEN** Discord 文本不包含这些原文
- **AND** `NotificationSendInput.metadata` 也不包含这些原文

#### Scenario: 文本消息不是放行凭证
- **WHEN** 用户收到 Discord 审批通知
- **THEN** 该消息本身不表示 action approved
- **AND** 该消息本身不表示 dry-run、broker 或 live trading 已执行成功

### Requirement: 平台 SHALL 发布发送完成摘要

系统 SHALL 在 notification 插件调用完成后生成发送完成摘要，用于区分发送请求、插件调用结果和审批结果。

#### Scenario: 成功发送生成 completed 摘要
- **WHEN** Discord 插件返回 `NotificationSendResult(accepted=true)`
- **THEN** dispatcher 发布 `notification.completed`
- **AND** payload 至少包含 notification request id、plugin id、accepted、retryable、code、message、approval id 和 action request id

#### Scenario: 发送失败保留 retryable 语义
- **WHEN** Discord 插件返回网络超时、网络错误或上游拒绝
- **THEN** dispatcher 在结果中保留 `retryable`
- **AND** 第一刀不要求生产级重试队列或 DLQ

#### Scenario: completed payload 不表达审批或执行结果
- **WHEN** 系统发布 `notification.completed`
- **THEN** payload 不包含 `approval.completed` 的 decision status
- **AND** payload 不表达用户 approve/reject
- **AND** payload 不表达真实 broker 成交或执行成功
- **AND** payload 不包含 Discord webhook URL

### Requirement: Web approvals SHALL be the authorization surface

系统 SHALL 把 Web `/approvals` 作为本轮人工授权入口，Discord 只负责通知。

#### Scenario: 用户在 Web 审批
- **WHEN** Discord webhook 通知已经发送
- **THEN** 用户通过 Web `/approvals` 查看 approval 列表和详情
- **AND** 用户通过 Web approve、reject 或 request-reanalysis mutation 提交授权输入
- **AND** 后端通过 approval API 或 worker topic 进入 `approval.input_received`

#### Scenario: Discord 文本不进入审批状态机
- **WHEN** 用户在 Discord 中回复 approve、reject 或 reanalysis
- **THEN** 本轮系统不把该文本作为正式授权输入
- **AND** 不发布 `approval.input_received`
- **AND** 不调用 Policy Gate 或 executor

#### Scenario: 通知送达不改变审批状态
- **WHEN** `notification.completed.accepted=true`
- **THEN** approval 仍保持审批域状态
- **AND** 只有 Web approval action 或后续明确授权入口才能改变 approval decision

### Requirement: 插件边界 SHALL 保持协议适配职责

系统 SHALL 保持 Discord 插件只负责 Discord webhook 协议适配，不承担平台审批业务。

#### Scenario: Discord 插件不依赖 approval 域
- **WHEN** 实现官方 Discord notification 插件
- **THEN** 插件不得 import `quantagent.core.approval`
- **AND** 插件不得直接发布 Event Bus topic
- **AND** 插件不得写 approval request、approval input、decision 或 audit record

#### Scenario: Core 不依赖具体 Discord 插件
- **WHEN** 实现 notification dispatcher
- **THEN** `packages/core` 不得 import `plugins.notifications.discord`
- **AND** 只能通过 Registry、Runtime 和 plugin-sdk DTO 调用插件

### Requirement: 默认验证 SHALL 不依赖真实 Discord 网络

系统 SHALL 用单元测试覆盖平台发送链路，并将真实 Discord webhook send 保持为人工补充验收。

#### Scenario: 单元测试使用 fake runtime 或 mock transport
- **WHEN** 运行默认 core / worker / API / Web 单元测试
- **THEN** 测试不需要真实 Discord webhook URL
- **AND** 不需要真实 Discord public key
- **AND** 不需要外部网络

#### Scenario: 真实测试使用 Web 插件配置
- **WHEN** 开发者要用 NVDA 财报案例做真实测试
- **THEN** 开发者先在 Web 插件配置管理保存 Discord `webhook_url`
- **AND** 不通过 `.env` 设置 `DISCORD_WEBHOOK_URL`
- **AND** 不通过 `NOTIFICATION_DISPATCH_PLUGIN_CONFIG` 设置 webhook
- **AND** 真实测试通过不表示生产级重试、投递持久化、审批执行或 broker 执行已完成
