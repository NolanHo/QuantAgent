## ADDED Requirements

### Requirement: Tavily 使用人类可填写 API key
Tavily Source/Data Tool 插件 SHALL 将 `api_key` 作为前端主配置字段，用户只需要填写一个 Tavily API key 即可完成 MVP 配置。

#### Scenario: Tavily schema 暴露 api_key
- **WHEN** 客户端读取 `quantagent.official.source.tavily` 的 config schema
- **THEN** schema 包含必填字段 `api_key`
- **AND** `api_key` 被标记为敏感字段
- **AND** `api_key_ref` 不作为前端主配置字段出现

#### Scenario: Tavily 插件读取已注入 api_key
- **WHEN** Runtime 调用 Tavily 插件并传入包含 `api_key` 的已校验配置
- **THEN** Tavily 插件使用该 key 调用 Tavily 第三方 API
- **AND** 插件错误、日志和输出不得泄露该 key 明文

### Requirement: Tavily 缺 key 可恢复失败
Tavily Source/Data Tool 插件 MUST 在缺少 API key 时返回结构化、可诊断、可恢复的配置错误，而不是产生不可控异常或泄露内部实现。

#### Scenario: 缺少 api_key
- **WHEN** Runtime 调用 Tavily 插件但配置中没有可用 `api_key`
- **THEN** 插件返回配置缺失错误
- **AND** 错误详情包含缺失配置字段名
- **AND** 错误详情不得包含任何 secret 值
