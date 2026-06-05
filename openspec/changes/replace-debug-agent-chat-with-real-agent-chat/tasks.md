## 1. OpenSpec / 评审 Gate

- [x] 1.1 创建本 change 的 `proposal.md`、`design.md`、`tasks.md` 和 delta specs。
- [x] 1.2 运行 `openspec validate replace-debug-agent-chat-with-real-agent-chat --type change --strict --json`，失败则先修 artifacts。
- [x] 1.3 实现前再次确认 DeepAgents 官方 frontend docs、本地 `deepagents` 版本和 stream API 签名。

## 2. AgentRuntime 契约与 Streaming

- [x] 2.1 更新 `AgentRunRequest`，新增 `session_id`、`thread_id`、`workspace_id`，并同步测试 fixture 构造。
- [x] 2.2 修改 `AgentRuntime._run_deep_agent`，使用 `request.thread_id` 配置 DeepAgents，不再使用 `agent_run_id` 作为 thread id。
- [x] 2.3 使用 `stream_mode=["updates", "messages"]`，分别处理 message token 和 updates。
- [x] 2.4 扩展 streaming adapter，识别 assistant delta、todo、tool、SubAgent、artifact、interrupt；未知 chunk 保留结构信息，不再使用 `safe_summary`。
- [x] 2.5 移除 `DeepAgents stream completed.` 成功占位，final output 必须来自真实 assistant message 或 final state。
- [x] 2.6 更新 `packages/agent` 单测，覆盖 thread/session/run/workspace id、真实 delta、final output 和 MVP 调试内容完整保留。

## 3. Core Persistence

- [x] 3.1 在 `packages/core` 新增 Agent Chat ORM model：session、run、message。
- [x] 3.2 新增 repository，封装 session 创建、session 查询、run 状态更新、message append 和 transcript 查询。
- [x] 3.3 新增 Alembic migration，并保持 upgrade/downgrade 可运行。
- [x] 3.4 新增 core tests 覆盖创建 session、追加 transcript、按 session 加载和 seq 排序。

## 4. API Agent Chat

- [x] 4.1 新增 `schemas/agent_chat.py`，定义 create session、session detail、display message、stream request 和 stream event DTO。
- [x] 4.2 新增 `services/agent_chat.py`，编排 DB repository、model config、AgentRuntime request 构造、stream event 持久化和错误映射。
- [x] 4.3 新增 `routers/v1/agent_chat.py`，提供正式 `/api/v1/agent-chat/sessions` API，router 保持薄层。
- [x] 4.4 在 `register_api_v1_routes` 注册正式 protected router。
- [x] 4.5 删除旧 `agent_debug` router/service/schema 和对应注册。
- [x] 4.6 更新 API tests，覆盖新 session、老 session、stream、模型配置错误、旧 debug endpoint 不存在和 OpenAPI 契约。

## 5. Web Agent Chat

- [x] 5.1 新增 `features/agent-chat/README.md` 和职责目录。
- [x] 5.2 新增 `api/agent-chat.contracts.ts`、`api/agent-chat.api.ts`、`api/agent-chat.stream.ts`。
- [x] 5.3 更新 `app/runtime`，挂载 runtime-scoped `agentChat` API。
- [x] 5.4 新增 query keys/session query、页面 hook、stream reducer 和展示类型。
- [x] 5.5 新增 ChatApp 页面组件、composer、message list、tool/subagent/todo/artifact/interrupt card、loading/error/empty 状态。
- [x] 5.6 新增正式 route `/agent-chat`，route 只渲染 feature page。
- [x] 5.7 删除 `features/debug/agent-run-chat/**`，Debug 工作台入口改为跳转正式 `/agent-chat` 或移除独立入口。
- [x] 5.8 更新 Web tests，覆盖 transcript、assistant streaming、tool/subagent/todo/artifact、MVP 调试内容完整保留和旧 debug feature 不再引用。

## 6. 验证 / 收口

- [x] 6.1 运行 OpenSpec strict validate。
- [x] 6.2 运行 `uv run python -m unittest discover -s apps/api/src`。
- [x] 6.3 运行 `uv run pytest packages/agent/tests` 或当前可用的最小 agent 测试命令。
- [x] 6.4 运行 `bun run --cwd apps/web test:unit`。
- [x] 6.5 运行 `bun run --cwd apps/web build`。
- [ ] 6.6 手工验证真实 LLM 配置下 `/agent-chat` 能流式输出完整可调试 transcript。
