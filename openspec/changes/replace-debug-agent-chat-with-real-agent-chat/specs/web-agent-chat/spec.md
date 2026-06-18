## ADDED Requirements

### Requirement: Web exposes formal Agent Chat route
Web 应用 SHALL 提供正式 Agent Chat 页面，用于创建或加载 Agent Chat session，并通过真实 Agent Chat API 发送消息和接收流式运行结果。

#### Scenario: 打开正式 Agent Chat 页面
- **WHEN** 用户访问正式 Agent Chat route
- **THEN** 页面渲染 ChatApp，而不是 debug fixture workbench
- **AND** 页面可以创建新 session 或加载已有 session

#### Scenario: Debug 入口复用正式页面
- **WHEN** 开发者从 `/debug` 工作台进入 Agent 调试
- **THEN** Debug 入口导航到正式 Agent Chat 页面或预填正式 Agent Chat 参数
- **AND** Debug 不维护独立 Agent run API、fixture selector、scripted/live mode 或自有 stream reducer

### Requirement: Web displays full debug transcript
Web 应用 SHALL 展示完整可调试 transcript，包括 user、assistant、tool、SubAgent、todo、artifact、interrupt 和 final/error display messages；MVP 不做 system prompt、payload 或敏感词过滤。

#### Scenario: Transcript 展示多种消息
- **WHEN** Agent Chat session 包含多次 run 的 display transcript
- **THEN** 页面按顺序展示 user message、assistant message、tool card、SubAgent card、todo/progress、artifact card、interrupt card 和 final/error
- **AND** 页面不是只展示 final summary 或 `run.started/run.completed`

#### Scenario: Runtime content 完整展示
- **WHEN** session 或 run 构造包含 system prompt、developer instruction 或 provider raw payload
- **THEN** 页面展示后端传入的可展示 content/payload
- **AND** 前端测试覆盖 system prompt 或类似调试内容不会被过滤

### Requirement: Web streams assistant output incrementally
Web 应用 SHALL 在收到 Agent Chat stream event 时增量更新 UI，assistant 输出应以 token/message 方式流式追加。

#### Scenario: Assistant delta streaming
- **WHEN** stream 收到 assistant delta event
- **THEN** 页面将 delta 追加到当前 assistant message
- **AND** 用户无需等待 run 完成即可看到模型输出

#### Scenario: Structured events render as cards
- **WHEN** stream 收到 tool、SubAgent、todo、artifact 或 interrupt event
- **THEN** 页面以结构化 card/panel 渲染对应状态
- **AND** 组件不把原始 SSE JSON 作为主内容 dump 出来

### Requirement: Web Agent Chat follows feature responsibility rules
Web Agent Chat SHALL 按 `features/agent-chat` 目录拆分 API、contracts、stream adapter、queries、business hook、components、types、utils 和 README，route 文件 SHALL 只做入口组合。

#### Scenario: Feature 职责清晰
- **WHEN** 维护者查看 `features/agent-chat/README.md`
- **THEN** README 说明 route 入口、公开 API/hook/component、子目录职责和非目标
- **AND** README 明确该 feature 不负责交易策略判断、Policy Gate 绕过、可见性分层或 debug fixture 协议

#### Scenario: Route stays thin
- **WHEN** 正式 Agent Chat route 被注册
- **THEN** route component 只渲染 feature page
- **AND** route 文件不直接执行 API 请求、SSE parsing、message reducer、业务状态编排或复杂 JSX
