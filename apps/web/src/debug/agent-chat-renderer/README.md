# agent-chat-renderer

`agent-chat-renderer` 是 `/debug/agent-chat-renderer` 的开发态消息渲染 playground。

## 负责什么

- 用固定的英伟达财报全流程 mock 数据预览 Agent Chat 消息渲染。
- 验证可复用 renderer 对 `text`、`reasoning`、`tool`、`tasks`、`sources`、`decision`、`artifact` 和 `notice` 的展示效果。
- 帮助后续把正式 `/agent-chat` 从原始 JSON 调试展示迁移到结构化消息组件。

## 边界

- 不调用真实 AgentRuntime、DeepAgents、后端 API 或 broker。
- 不承接真实 session / run 状态管理。
- mock 数据只能用于 UI 预览，不能作为产品数据真源。
