## ADDED Requirements

### Requirement: Agent Chat session can be created
系统 SHALL 提供正式 Agent Chat session 创建 API，并为每个 session 初始化稳定 `session_id`、`thread_id` 和 `workspace_id`。

#### Scenario: 创建新 session
- **WHEN** 受保护客户端请求创建 Agent Chat session
- **THEN** API 返回包含 `session_id`、`thread_id`、`workspace_id`、`status` 和空 display transcript 的成功 envelope
- **AND** 数据库持久化 session metadata，后续请求可按 `session_id` 加载

#### Scenario: 创建 session 不启动 Agent run
- **WHEN** 客户端只创建 session 而不发送消息
- **THEN** 系统不调用 AgentRuntime
- **AND** transcript 中不出现 assistant、tool、SubAgent 或 final message

### Requirement: Agent Chat session can be loaded with transcript
系统 SHALL 支持按 `session_id` 加载历史 Agent Chat session，并返回完整可展示聊天记录；MVP 不维护 transcript/debug/audit 可见性拆分。

#### Scenario: 加载已有 session
- **WHEN** 客户端请求已存在的 `session_id`
- **THEN** API 返回 session metadata 和按 `seq` 排序的 display transcript
- **AND** transcript 包含 user、assistant、tool、SubAgent、todo、artifact、interrupt 和 final/error 等可展示消息

#### Scenario: 加载未知 session
- **WHEN** 客户端请求不存在的 `session_id`
- **THEN** API 返回 404 envelope
- **AND** 系统不创建新 session 或 Agent run

### Requirement: User message starts one Agent run in existing session
系统 SHALL 支持向已有 session 追加 user message，并为该消息启动一个新的 `agent_run_id`，同时复用 session 的 `thread_id`。

#### Scenario: 追加消息并启动 stream
- **WHEN** 客户端向已有 session 发送 user message 并请求 stream
- **THEN** 系统先持久化 user display message
- **AND** 系统创建一条 run metadata，状态为 running
- **AND** AgentRuntime request 包含相同的 `session_id`、该 session 的 `thread_id`、该 session 的 `workspace_id` 和新的 `agent_run_id`

#### Scenario: Stream 完成后 transcript 可恢复
- **WHEN** 一次 message stream 正常完成
- **THEN** run 状态更新为 completed
- **AND** assistant final output 和中间 tool/SubAgent/todo/artifact 摘要已经进入 display transcript
- **AND** 后续加载 session 能看到该次运行产生的完整可展示记录

### Requirement: Agent Chat stream failure is recoverable and debuggable
系统 SHALL 在 Agent run 失败、模型配置失败或客户端断开时保持 session 可加载，并写入可调试错误内容。

#### Scenario: 模型配置缺失
- **WHEN** session message stream 启动时没有可用模型配置
- **THEN** API 返回或 stream 输出错误内容
- **AND** session 和 run 状态仍可恢复

#### Scenario: Runtime 失败
- **WHEN** AgentRuntime 在运行中失败
- **THEN** run 状态更新为 failed
- **AND** transcript 记录可展示 error message 和 trace id
- **AND** runtime 返回的 payload/content 不被 `safe_summary` 替换
