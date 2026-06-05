## REMOVED Requirements

### Requirement: Debug Agent SSE endpoint is development-only

**Reason**: 该 requirement 来自旧 `add-agent-debug-sse-api`，只描述 development-only fixture stream。正式 Agent Chat 已提供产品级 session 和 stream API，继续保留 fixture SSE 会制造第二套运行协议，导致 Debug 与真实功能分叉。

**Migration**: 删除 `/api/v1/debug/agent-runs/fixtures/{fixture_id}/stream` 和 fixture list API。开发调试通过正式 `/api/v1/agent-chat/sessions` API 创建或加载 session 后运行 Agent。

### Requirement: Agent Debug Chat route is development-only

**Reason**: 该 requirement 来自旧 `add-web-agent-debug-chat`，把 Agent 调试页面限定在 `/debug/agent-run-chat` 并消费 fixture SSE。用户期望 Debug 是正式功能的快捷入口，不是独立 fake/mock/debug 协议。

**Migration**: 删除 `features/debug/agent-run-chat/**` 和 `/debug/agent-run-chat` 子路由。Debug 工作台只导航到正式 Agent Chat route。

### Requirement: Agent Debug Chat uses streaming SSE

**Reason**: 旧 requirement 绑定 debug fixture SSE endpoint，无法表达正式 session、完整 transcript、老 session 加载和 DeepAgents frontend state。

**Migration**: Web 使用正式 Agent Chat stream adapter，消费正式 API 的 session-scoped stream event。

## ADDED Requirements

### Requirement: Old Agent debug fixture endpoints are absent
系统 SHALL 删除旧 Agent debug fixture API，并确保 development、test 和 production 环境都不再暴露 fixture-as-product Agent run endpoint。

#### Scenario: 旧 fixture stream 不存在
- **WHEN** 客户端请求 `/api/v1/debug/agent-runs/fixtures/semiconductor-nvda-earnings/stream`
- **THEN** API 返回 404 或等价未注册结果
- **AND** 不启动 AgentRuntime 或 scripted fixture runner

#### Scenario: 旧 fixture list 不存在
- **WHEN** 客户端请求 `/api/v1/debug/agent-runs/fixtures`
- **THEN** API 返回 404 或等价未注册结果
- **AND** OpenAPI 不包含旧 Agent debug fixture paths

### Requirement: Testing fixtures stay outside product runtime
系统 SHALL 允许 `packages/agent/testing` 保留 fake/scripted harness 用于单测，但 MUST 禁止 API/Web 产品路径 import testing fixture 作为运行入口。

#### Scenario: API 不依赖 testing fixture
- **WHEN** 正式 Agent Chat API 启动 run
- **THEN** API 通过 AgentRuntime 和正式 agent definition 构造请求
- **AND** API service 不 import `quantagent.agent.testing` 来生成产品运行结果

#### Scenario: Tests can still use fixture harness
- **WHEN** package unit tests 需要无外部模型验证 runtime
- **THEN** 测试可以继续使用 `packages/agent/testing` fake/scripted harness
- **AND** 这些 harness 不被 Web 或正式 API 暴露为用户可选 scenario

