## Context

当前实现里有三类问题叠加：

- `AgentRuntime` 使用 `agent_run_id` 作为 DeepAgents `thread_id`，导致每次 run 都像新线程，无法自然恢复 session 历史。
- DeepAgents 默认 stream chunk 被压缩成摘要，结构性 `updates` 被忽略，`messages` token 没有稳定进入前端。
- Web 页面位于 `features/debug/agent-run-chat/`，通过 fixture SSE 协议消费 debug-only endpoint，无法作为真实 ChatApp 复用。

DeepAgents 官方 frontend 文档强调前端应展示 coordinator messages、subagents、`values.todos`、tool-call state 和 interrupts。QuantAgent 的实现应围绕 DeepAgents 能力配置和适配，不自研 tool loop，也不把 debug fixture 当成产品 runtime。

## Goals / Non-Goals

**Goals:**

- 正式 API 支持创建 session、加载 session、追加消息并流式运行 Agent。
- Web 展示完整可调试 transcript：user、assistant、tool、SubAgent、todo、artifact、interrupt、final output。
- AgentRuntime 传入稳定 `thread_id`，每次 user submit 单独生成 `agent_run_id`。
- Stream 映射使用 DeepAgents `stream_mode=["updates", "messages"]`，最终输出来自真实 assistant message 或 final state。
- 删除旧 debug-only Agent fixture API 和前端 feature。

**Non-Goals:**

- 不做跨进程 durable checkpoint 恢复；DB 先作为 transcript 与 run metadata 真源。
- 不做真实交易执行、真实 broker 接入或自动审批策略。
- 不做 transcript/debug/audit 可见性拆分；MVP 调试链路保留 runtime 能拿到的 prompt、payload、provider 片段和工具错误。CoT 只有在 provider 或框架真实返回时才可能展示。

## Backend Architecture

目标分层：

```text
apps/api/src/quantagent/api/
  routers/v1/agent_chat.py       # HTTP 入口，只做 DTO、DI、StreamingResponse / ApiResponse
  schemas/agent_chat.py          # request/response DTO 与 SSE event DTO
  services/agent_chat.py         # session/run 编排、模型配置、AgentRuntime 调用、stream persistence
  repositories/agent_chat.py     # DB 查询与写入边界

packages/core/src/quantagent/core/db/models/agent_chat.py
packages/core/src/quantagent/core/db/repositories/agent_chat_repository.py
packages/core/alembic/versions/<revision>_agent_chat_sessions.py

packages/agent/src/quantagent/agent/runtime/requests.py
packages/agent/src/quantagent/agent/runtime/runtime.py
packages/agent/src/quantagent/agent/streaming/adapter.py
packages/agent/src/quantagent/agent/streaming/events.py
```

Router：

- `POST /api/v1/agent-chat/sessions`
- `GET /api/v1/agent-chat/sessions/{session_id}`
- `POST /api/v1/agent-chat/sessions/{session_id}/messages/stream`

Router 不直接访问数据库、不创建 DeepAgents、不解析 model config、不拼 prompt。所有流程进入 `AgentChatService`。

Service：

- 创建 session：生成 `session_id`、`thread_id`、`workspace_id`，解析默认 industry/agent definition 和 model config，写入 session metadata。
- 加载 session：读取 session 和 display transcript，返回完整可展示历史。
- 追加消息 stream：写入 user display message，创建 `agent_run_id`，构造 `AgentRunRequest`，调用 `AgentRuntime.run_stream`，把 runtime event 转换成前端 stream event 并增量落库。
- 失败处理：配置缺失、provider disabled、decrypt failed、runtime failed、client disconnect 均进入 transcript/run 状态；MVP 中错误内容保留原始异常文本以便调试。

Repository：

- 只封装 ORM 查询和写入。
- session 查询必须按 `session_id` 过滤，transcript 查询按 `session_id` 和 `seq` 排序。
- display message append 使用单调 `seq`，为并发写入预留唯一约束或事务保护。

## Persistence

MVP DB 表草案：

```text
agent_chat_sessions
  session_id            string pk
  thread_id             string unique not null
  workspace_id          string not null
  industry_id           string not null
  agent_id              string not null
  title                 string nullable
  status                string not null
  created_at            datetime
  updated_at            datetime
  metadata              json not null

agent_chat_runs
  run_id                string pk
  session_id            string indexed not null
  agent_run_id          string unique not null
  trace_id              string not null
  status                string not null
  started_at            datetime
  completed_at          datetime nullable
  error_summary         string nullable
  metadata              json not null

agent_chat_messages
  message_id            string pk
  session_id            string indexed not null
  run_id                string nullable
  seq                   integer not null
  role                  string not null  # user / assistant / tool / subagent / system_event
  kind                  string not null  # message / delta / tool / todo / artifact / interrupt / final / error
  content               text not null
  payload               json not null
  created_at            datetime
```

MVP 调试边界：

- `agent_chat_messages` 保存 display transcript 和 runtime payload。
- Agent Chat MVP 不维护 `visibility: transcript/debug/audit`，不把 `safe_summary` 作为主协议字段。
- 如果 runtime event、tool result 或 provider chunk 包含 prompt、错误、raw 片段或推理片段，服务层不额外过滤；后续生产安全边界可通过新的 OpenSpec 引入。

## AgentRuntime Changes

`AgentRunRequest` 新增：

```python
session_id: str
thread_id: str
workspace_id: str
```

并保留：

```python
agent_run_id: str
event_id: str
industry_id: str
trace_id: str
agent_definition: AgentDefinition
run_context: RunContextSnapshot
tool_profile: ToolProfile
runtime_policy: RuntimePolicy
input_message: str
```

运行配置：

```python
config = {
    "configurable": {
        "thread_id": request.thread_id,
        "session_id": request.session_id,
        "workspace_id": request.workspace_id,
        "agent_run_id": request.agent_run_id,
    }
}
```

DeepAgents stream：

- 调用 `graph.stream(input_data, config=config, stream_mode=["updates", "messages"])`。
- `messages` chunk 映射为 `model.delta`，payload 包含 `delta`、`message_id?`、`role="assistant"`。
- `updates` chunk 映射 todo/tool/subagent/artifact/interrupt/state snapshot。
- `run.output` 使用最后完整 assistant message 或 final state，不允许使用 `DeepAgents stream completed.` 作为成功输出。

SubAgent 说明：

- 自定义 SubAgent 仍通过 `AgentDefinition.subagents` 注入。
- SubAgent 结果应作为结构化 card 和 artifact ref 进入 display transcript。
- MainAgent 负责全流程操控；SubAgent 专职检索、风险/交易计划等能力由后续行业包 definition 决定，本 change 不新增复杂行业 SubAgent。

## Frontend Architecture

目标目录：

```text
apps/web/src/features/agent-chat/
  README.md
  api/
    agent-chat.api.ts
    agent-chat.contracts.ts
    agent-chat.stream.ts
    index.ts
  queries/
    agent-chat.keys.ts
    use-agent-chat-session.ts
    index.ts
  hooks/
    use-agent-chat-page.ts
    index.ts
  components/
    page/AgentChatPage.tsx
    composer/AgentChatComposer.tsx
    conversation/AgentMessageList.tsx
    conversation/AgentMessageBubble.tsx
    events/AgentToolCard.tsx
    events/AgentSubagentCard.tsx
    events/AgentTodoPanel.tsx
    events/AgentArtifactCard.tsx
    events/AgentInterruptCard.tsx
    states/AgentChatStates.tsx
    index.ts
  types/
    agent-chat.types.ts
    index.ts
  utils/
    agent-chat-event-reducer.ts
    agent-chat-event-format.ts
    index.ts
```

Runtime：

- `createAppRuntime()` 挂载 `agentChat: AgentChatApi`。
- feature hook 通过 `useApis()` 获取 API。
- `agent-chat.stream.ts` 是唯一 SSE/stream parser 适配层；组件不直接 `fetch`。

Route：

- 正式 route 建议为 `/agent-chat`。
- Debug 工作台入口只导航到 `/agent-chat`，可通过 search param 预填 event/session，不 import debug-specific agent run feature。

UI：

- 显示完整 transcript，包括后端传来的 system/runtime event content 和 payload。
- 主线显示 user/assistant message。
- tool/subagent/todo/artifact/interrupt 以结构化 card 或侧栏显示。
- 失败状态显示错误内容和 trace id，保留调试所需 payload。

## Deletion Strategy

删除：

- `apps/api/src/quantagent/api/routers/v1/agent_debug.py`
- `apps/api/src/quantagent/api/schemas/agent_debug.py`
- `apps/api/src/quantagent/api/services/agent_debug.py`
- `apps/api/src/tests/test_agent_debug_service.py`
- `apps/web/src/features/debug/agent-run-chat/**`
- Debug route 中 `/debug/agent-run-chat` 子路由和 workbench 文案按钮。

保留：

- `packages/agent/testing/**` 中的 fake/scripted harness，仅用于单测和 fixture，不被 API/Web 产品路径 import。

## Failure Paths

- 无 DB session：创建/加载 session 返回 service unavailable；stream 不启动 runtime。
- 模型配置缺失：返回错误，transcript 记录可展示 error message。
- Provider 调用失败：runtime 输出 `run.failed`，service 持久化 run failed。
- Client disconnect：停止继续向客户端写 stream；已落库 transcript 保持可恢复。
- Unknown session：返回 404 envelope，不创建 run。
- Runtime chunk 未知：保留结构信息；可识别的 assistant/tool/update 内容进入 transcript。

## Validation

- `openspec validate replace-debug-agent-chat-with-real-agent-chat --type change --strict --json`
- `uv run python -m unittest discover -s apps/api/src`
- `uv run pytest packages/agent/tests` 或当前 package 等价命令。
- `bun run --cwd apps/web test:unit`
- `bun run --cwd apps/web build`
- 手工验收：配置真实 LLM 后从 `/agent-chat` 输入“分析这个事件”，能看到 user、assistant streaming、tool/todo/subagent/artifact 状态和最终回答。
