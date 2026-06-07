## ADDED Requirements

### Requirement: Web 插件配置表单使用真实 API
Web 插件配置表单 SHALL 使用后端真实配置 schema 和配置值 API 加载、校验和保存插件配置，不得在产品路径中使用 mock load/save/validate。

#### Scenario: 加载真实配置表单
- **WHEN** 用户打开插件详情页的配置编辑面板
- **THEN** Web 通过 runtime `apis.plugins` 读取 Registry JSON Schema
- **AND** Web 通过真实配置值 API 读取当前配置快照
- **AND** 页面文案不得把配置来源标记为 mock

#### Scenario: 保存真实配置
- **WHEN** 用户在配置表单中提交配置
- **THEN** Web 先按 schema-driven form 的校验结果构造 payload
- **AND** Web 调用真实保存 API
- **AND** 保存成功后刷新配置值和插件 detail 配置摘要

### Requirement: Web 配置表单支持 Tavily schema
Web 插件配置表单 SHALL 能直接渲染 Tavily Registry JSON Schema，不需要 Tavily 专属定制 UI。

#### Scenario: 渲染 Tavily api_key
- **WHEN** Tavily config schema 包含敏感字符串字段 `api_key`
- **THEN** Web 以敏感输入控件展示该字段
- **AND** 已保存的 key 只显示为掩码状态
- **AND** 用户可以重新输入新 key 并保存

#### Scenario: 渲染 Tavily 可选字段
- **WHEN** Tavily config schema 包含 `timeout_seconds`、`default_max_results`、`default_search_depth`、`include_favicon` 或 `include_raw_content`
- **THEN** Web 使用通用 schema-driven 控件渲染这些字段
- **AND** 不需要为 Tavily 编写单独页面或单独表单组件
