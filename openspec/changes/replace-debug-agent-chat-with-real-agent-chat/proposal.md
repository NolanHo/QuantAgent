## Why

当前 Agent 调试链路把真实 DeepAgents ChatApp 问题收窄成了 development-only fixture SSE：后端以安全摘要包装 `AgentRunEvent`，前端以 debug 页面消费 fixture run，最终只能看到 `run.started`、占位 final 和 `run.completed`，无法观察真实 assistant message、tool call、todo、SubAgent、artifact、interrupt 和完整聊天记录。

这与用户目标冲突：Debug 本质应是进入已开发好的真实功能做快捷调试，而不是为 debug 单独维护一套路由、接口、协议和 mock/scripted 数据。旧 change `add-agent-debug-sse-api` 与 `add-web-agent-debug-chat` 适合早期临时 fixture 验证，但不能继续作为产品架构真源。本 change 用正式 Agent Chat session 替代 debug fixture 链路，并把 AgentRuntime 的 DeepAgents stream 映射改成可调试、可恢复、可扩展的产品边界。

## What Changes

- 新增正式 Agent Chat 能力，提供 session 创建、session 加载、追加消息并流式运行 Agent 的 API。
- 调整 `packages/agent` 的 `AgentRunRequest`，显式区分 `session_id`、`thread_id`、`workspace_id` 和每次运行的 `agent_run_id`。
- AgentRuntime 调用 DeepAgents 时使用 `stream_mode=["updates", "messages"]`，并把真实 message token、tool、todo、SubAgent、artifact、interrupt 映射为稳定事件。
- 新增正式 Web `features/agent-chat/`，展示完整聊天记录和 DeepAgents 运行结构；MVP 不做 transcript/debug/audit 可见性拆分，也不在 Agent Chat 链路额外过滤 prompt、工具 payload 或 provider 片段。
- 移除旧 debug fixture API、旧 Web debug Agent Run Chat feature、fixture-as-product 入口和相关测试。
- Debug 工作台只保留快捷入口，跳转或预填正式 Agent Chat，不再维护独立 debug 协议。

## Capabilities

### New Capabilities

- `agent-chat-session`: 正式 Agent Chat session、run、display transcript、stream API 和恢复行为。
- `web-agent-chat`: 正式 ChatApp 页面、完整 transcript、streaming UI 和 Debug 入口复用。

### Modified Capabilities

- `deepagents-agent-runtime`: 将 runtime thread/session/workspace/run id 拆分，并改用 DeepAgents `updates + messages` stream 映射。

### Removed Capabilities

- `agent-debug-fixtures`: 删除 development-only Agent debug fixture SSE API 和 Web Debug Chat 独立协议。

## Impact

- 受影响目录：
  - `openspec/changes/replace-debug-agent-chat-with-real-agent-chat/`
  - `packages/agent/src/quantagent/agent/runtime/`
  - `packages/agent/src/quantagent/agent/streaming/`
  - `apps/api/src/quantagent/api/routers/v1/`
  - `apps/api/src/quantagent/api/schemas/`
  - `apps/api/src/quantagent/api/services/`
  - `apps/web/src/features/agent-chat/`
  - `apps/web/src/debug/`
  - 相关测试目录。
- 后续实现需要删除旧 `agent_debug` API 文件和 `features/debug/agent-run-chat`。
- 本 change 不直接接真实 broker、真实交易、自动下单或生产策略执行；交易相关动作仍必须走 Decision / Policy Gate / Approval。
- MVP 要恢复历史聊天记录；跨 API 重启恢复正在中断的 DeepAgents run、持久化 checkpoint/store 和长期 memory 作为后续增强。

## Non-Goals

- 不要求展示 provider 没有返回的 chain-of-thought，也不在本 change 内实现额外的 provider raw capture；但 runtime 或 provider 已返回的内容不做安全摘要替换。
- 不实现真实交易闭环或绕过 Policy Gate 的任何动作。
- 不为 Debug 继续保留 fixture-specific API、scripted/live mode 切换或 NVDA 专用运行入口。
- 不在本 change 内引入 LangGraph deployment server；FastAPI 可先提供产品级兼容 stream，事件形状向 DeepAgents frontend `messages/subagents/values.todos/tool/interrupts` 收敛。
