# Components

`src/components` 放通过外部组件 CLI 安装进项目源码的跨页面基础组件，目前主要承接 `ai-elements` 与其必要的 `ui` primitive。

## 边界

- `ai-elements/`: 由 `ai-elements` CLI 安装的官方组件源码。业务功能只 import 使用，不在 feature 内复制一套同名 primitive。
- `ui/`: `ai-elements` / shadcn 组件依赖的最小基础 primitive，例如 `badge`、`collapsible`。

## 不放什么

- 不放 QuantAgent 的 Agent Chat 消息结构转换、run 语义、tool/subagent/todo 业务规则。
- 不放页面状态、API 请求、TanStack Query hook 或 debug fixture。
- Agent Chat 的业务 adapter 继续放在 `features/agent-chat/components/rendering/`。
