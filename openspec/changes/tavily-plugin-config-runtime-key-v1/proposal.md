## Why

当前真实 Agent Chat 中 `search_web` 只能读取 `TAVILY_API_KEY` 环境变量，而插件配置页仍停留在 mock load/save/validate，用户即使在 UI 中看到配置表单，也无法把 Tavily API key 写入后端并注入运行时。Tavily 是半导体 MainAgent MVP 获取市场预期、盘后反应和冲突证据的关键工具，因此需要先把插件配置值、Tavily `api_key`、前端表单和 Agent Chat runtime 注入契约固定下来。

## What Changes

- 新增插件配置值 API 契约，用于读取、校验和保存插件配置值；配置保存必须支持敏感字段加密，响应只返回掩码。
- 调整 Tavily 插件配置契约：人类用户只需要填写 `api_key`，`api_key_ref` 不作为前端主配置字段。
- Agent Chat 在构建 `search_web` 工具时，优先从已保存 Tavily 插件配置解密并注入 API key；未配置时继续把缺 key 视为可恢复工具失败。
- Web 插件配置表单必须消费 Registry JSON Schema 和真实配置 API，不再把 mock load/save/validate 当作产品路径。
- 本 change 只产出 OpenSpec artifacts，不实现代码、不新增 migration、不提交真实 secret 或运行时截图。

## Capabilities

### New Capabilities

- `plugin-config-values`: 插件配置值读取、校验、保存、敏感字段掩码和配置状态契约。
- `tavily-source-plugin-config`: Tavily Source/Data Tool 插件的人类可配置 `api_key` 契约和缺 key 行为。
- `agent-chat-tavily-config`: Agent Chat runtime 使用 Tavily 插件配置注入 `search_web` 工具的契约。
- `web-plugin-config-real-api`: Web 插件配置表单对接真实配置 API 的契约。

### Modified Capabilities

- 无。

## Impact

- 后续实现会影响 `apps/api` 的插件配置 router/service/repository/schema 分层，以及 `packages/core` 的插件配置持久化模型或 repository。
- 后续实现会影响 `plugins/sources/tavily-source` 的 `config.schema.json`、README、插件入口配置读取和插件测试。
- 后续实现会影响 `apps/api` 的 Agent Chat service，使其构建 `search_web` 工具时读取已保存 Tavily 配置。
- 后续实现会影响 `apps/web/src/features/plugins/config-form` 和插件详情页配置编辑面板，使其从 mock 迁移到真实 API。
- 不引入通用 Vault、完整 ToolRegistry 重构、真实 Tavily 网络测试或生产交易闭环。
