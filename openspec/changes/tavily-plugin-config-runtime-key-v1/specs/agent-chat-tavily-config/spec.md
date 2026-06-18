## ADDED Requirements

### Requirement: Agent Chat 从插件配置注入 Tavily key
Agent Chat runtime SHALL 在构建 `search_web` 工具时读取已保存 Tavily 插件配置，并将解密后的 `api_key` 只作为工具运行时参数注入。

#### Scenario: 已配置 Tavily key
- **WHEN** Agent Chat session 启动 run 且 `quantagent.official.source.tavily` 已保存有效 `api_key`
- **THEN** Agent Chat 构建 `search_web` 工具时使用该 key
- **AND** key 不进入 `RunContextSnapshot`、SSE、DB transcript、artifact、tool input、tool output 或前端响应

#### Scenario: 插件配置优先于环境变量
- **WHEN** 已保存 Tavily 插件配置和 `TAVILY_API_KEY` 环境变量同时存在
- **THEN** Agent Chat runtime 优先使用已保存插件配置
- **AND** 环境变量只作为未保存插件配置时的 fallback

### Requirement: Agent Chat 缺 Tavily key 不崩溃
Agent Chat runtime MUST 在 Tavily key 未配置时保持 run 可继续执行，并把 `search_web` 调用失败作为可恢复工具失败事件交给 Agent 和前端。

#### Scenario: 未配置 Tavily key
- **WHEN** Agent 调用 `search_web` 但既没有已保存插件配置也没有 `TAVILY_API_KEY`
- **THEN** stream 产生结构化 `tool.failed` 或等价运行时事件
- **AND** Agent run 不因该工具配置缺失直接失败
- **AND** Agent 可以继续基于已有上下文输出保守结论
