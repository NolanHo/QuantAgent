## MODIFIED Requirements

### Requirement: AgentRuntime 统一入口
系统 SHALL 在 `packages/agent` 提供统一 `AgentRuntime`，业务代码、行业包、API service 和 Worker 必须通过该入口运行 DeepAgents，不得绕过 runtime 直接创建 DeepAgents 实例；AgentRuntime request MUST 显式区分 session、thread、workspace 和 run。

#### Scenario: 调用方通过 runtime 启动 run
- **WHEN** 调用方传入 `AgentRunRequest`
- **THEN** `AgentRuntime` 基于请求中的 `AgentDefinition`、`RunContextSnapshot`、`ToolProfile` 和 `RuntimePolicy` 创建并运行 DeepAgents
- **AND** 调用方获得结构化 `AgentRunResult` 或 `AgentRunEvent` 流
- **AND** DeepAgents config 使用 `thread_id=request.thread_id`，而不是 `agent_run_id`

#### Scenario: 行业包不直接创建 DeepAgents
- **WHEN** 行业包提供 MainAgent 或 SubAgent 资产
- **THEN** 行业包只声明 definition、prompt、skills、tool profile 和 fixture
- **AND** 行业包不得直接调用 `create_deep_agent()` 绕过 `AgentRuntime`

### Requirement: AgentRunEvent 流式输出
系统 SHALL 提供 `run_stream` 或等价 async streaming 入口，将 DeepAgents / LangGraph 运行过程转换为稳定的 `AgentRunEvent` 流，并 MUST 使用 DeepAgents `stream_mode=["updates", "messages"]` 获取真实 message 与 state updates。

#### Scenario: Run 输出真实 assistant delta
- **WHEN** DeepAgents 以 `messages` stream mode 输出 assistant token 或 message chunk
- **THEN** runtime 产出 `model.delta` 或等价 assistant display event
- **AND** event payload 包含可展示 delta 或 message content
- **AND** event 不只是结构 chunk key summary

#### Scenario: Run 输出结构化 updates
- **WHEN** DeepAgents 以 `updates` stream mode 输出 todo、tool、SubAgent、artifact、interrupt 或 state snapshot
- **THEN** runtime 将其映射为稳定 `AgentRunEvent`
- **AND** 未识别 chunk 保留结构信息，可识别的 assistant/tool/update 内容进入 runtime event

#### Scenario: Run 完成输出真实 final
- **WHEN** 一次 Agent run 正常完成
- **THEN** runtime 产出 `run.output` 和 `run.completed`
- **AND** `run.output.content` 来自最终 assistant message 或 final state
- **AND** `run.output.content` 不得是 `DeepAgents stream completed.` 或其他占位成功文案

### Requirement: ToolAdapter 注入 run-scoped hidden context
系统 SHALL 通过 ToolAdapter 将平台工具包装为 DeepAgents 可调用工具，并在执行时注入 run-scoped hidden context；hidden context MUST 包含 `session_id`、`thread_id`、`workspace_id` 和 `agent_run_id` 的可审计关联。

#### Scenario: 工具执行自动获得 session context
- **WHEN** DeepAgents 调用一个已包装工具
- **THEN** ToolAdapter 将模型输入与 `ToolRuntimeContext` 合并后调用平台工具
- **AND** 工具调用摘要能关联 session、thread、workspace、run、event、agent、tool profile 和 trace

#### Scenario: 工具 schema 不要求模型传运行 ID
- **WHEN** 模型查看工具 schema
- **THEN** schema 不要求填写 `session_id`、`thread_id`、`workspace_id`、`agent_run_id`、`event_id`、`trace_id` 或本地文件路径
- **AND** 这些值由 runtime 自动注入
