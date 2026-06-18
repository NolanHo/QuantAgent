# Agent Chat

`features/agent-chat` 承载正式 Agent Chat 页面和流式运行展示。Debug 工作台只能跳转到这里，不能维护独立 Agent debug 协议。

## 入口

- Route: `/agent-chat`
- Page: `components/page/AgentChatPage.tsx`
- Hook: `hooks/use-agent-chat-page.ts`
- API: `api/agent-chat.api.ts`

## 子目录职责

- `api/`: Agent Chat endpoint、DTO contract、SSE stream parser，以及 `AgentChatRuntimeTransport`。
- `queries/`: session query key 与 session 加载 hook。
- `hooks/`: 页面级 session、composer，以及基于 `@langchain/react` 的 `useStream` / `useMessages` / `useToolCalls` / `useValues` 编排。
- `components/`: 展示组件，只接收 props，不直接请求后端。
- `types/`: UI display model。
- `utils/`: stream event reducer 和展示格式化。

## DeepAgents / LangChain React 边界

- 后端正式 API 仍是 `/api/v1/agent-chat/sessions/**`，不为 Web 单独维护第二套 debug-only 或 LangGraph-only endpoint。
- `AgentChatRuntimeTransport` 是协议桥：把正式 API 的 AgentRuntime SSE event 转为 `@langchain/react` 能消费的 LangGraph protocol event。
- assistant token 必须走 `messages` channel 的 `message-start`、`content-block-delta`、`message-finish`，避免每个 token 被渲染成一条独立消息。
- `values.messages` 只保存 display transcript 快照，用于历史和回放；实时打字效果由 `useMessages(stream)` 读取。

## 不负责什么

- 不维护 transcript/debug/audit 三套可见性协议；MVP 中后端传来的 runtime 内容、payload、prompt 和 provider 原始片段都应进入可调试界面。
- 不保证展示 provider 未返回的 CoT；如果框架或 provider payload 包含推理片段，前端不做额外过滤。
- 不负责交易决策、Policy Gate 绕过或 broker 执行。
- 不消费 `features/debug/agent-run-chat` 或 fixture-specific API。
