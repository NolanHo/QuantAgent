## Context

当前 Tavily 链路存在三处断点：第一，`plugins/sources/tavily-source/config.schema.json` 面向平台注入设计为 `api_key_ref`，对人类用户不直观；第二，插件详情页配置编辑面板仍通过 mock load/save/validate 模拟闭环，后端没有正式保存配置值的 API；第三，Agent Chat 的 `search_web` 工具只读取构造参数或 `TAVILY_API_KEY` 环境变量，未从插件配置读取 key。结果是用户即使在控制台看到 Tavily 配置表单，真实 Agent Chat 运行时仍会因为缺 key 产生工具失败。

本 change 固定的是正式契约，不直接实施代码。后续实现必须遵守 API、Web、Core/Plugin 分层：router 保持薄层，配置保存与校验进入 service，持久化进入 repository / ORM；Web 继续复用 `features/plugins/config-form` 的 schema-driven renderer；插件能力仍通过 `plugin.yaml` 和 Registry 发现，不在核心代码硬编码插件实现。

## Goals / Non-Goals

**Goals:**

- 让 Tavily 成为人类可配置的官方 Source/Data Tool 插件：用户只需要填写 `api_key`。
- 提供真实插件配置值 API，支持读取、校验、保存、敏感字段掩码和配置状态恢复。
- 让 Agent Chat runtime 能从已保存 Tavily 插件配置解密 API key 并注入 `search_web` 工具。
- 让 Web 插件配置表单消费 Registry JSON Schema 和真实配置 API，删除产品路径中的 mock load/save/validate。
- 保证 API、日志、stream transcript 和前端响应不返回 Tavily API key 明文。

**Non-Goals:**

- 不做通用 Vault、组织级 secret manager 或跨环境 secret reference UI。
- 不做完整 ToolRegistry 重构；本轮只固定 Tavily 配置到 Agent Chat `search_web` 的最小运行时注入。
- 不依赖真实 Tavily 网络测试；测试使用 fake HTTP/client 或构造配置。
- 不改变旧 SourceBinding effective config 的整体模型；如需兼容旧 `api_key_ref`，只作为运行时兼容，不作为前端主配置。
- 不提交真实 secret、运行时数据库、日志或截图。

## Decisions

### 1. Tavily 用户配置字段采用 `api_key`

Tavily 的配置 schema SHALL 暴露 `api_key` 作为唯一必填的人类输入字段，并标记为敏感字段。`api_key_ref` 不再作为前端主配置字段，因为 MVP 私有部署场景需要用户能直接完成配置，而不是理解平台 secret reference。

备选方案是继续使用 `api_key_ref` 或同时展示 `api_key` / `api_key_ref`。前者不符合当前用户体验目标；后者会扩大表单、校验和运行时分支复杂度。实现时可以在 Tavily 插件入口保留旧 `api_key_ref` 兼容读取，但 README 和 schema 主路径应转向 `api_key`。

### 2. 新增 `config-values` API，保留 detail config view

`GET /api/v1/plugins/{plugin_id}/config` 当前用于插件详情只读配置视图，包含 entries、display_mode 和可见性裁剪。为了避免破坏现有页面语义，表单值 API 使用新路径：

- `GET /api/v1/plugins/{plugin_id}/config-values`
- `PUT /api/v1/plugins/{plugin_id}/config-values`
- `POST /api/v1/plugins/{plugin_id}/config:validate`

Router 只负责 HTTP DTO、鉴权、CSRF 和 envelope；service 负责读取 Registry schema、校验 payload、识别敏感字段、加密/解密、配置状态和审计摘要；repository 负责 ORM 查询与写入。写操作必须最小事务包裹，不在事务内做外部网络调用。

### 3. 配置值持久化采用加密存储和掩码回显

插件配置值需要可恢复用于运行时注入，因此后端必须保存可解密的敏感值。敏感字段写入时加密保存，读取时只返回固定掩码和 `masked_paths`；非敏感字段可按 JSON 值保存和回填。配置响应不得携带明文 `api_key`，错误响应、日志、审计摘要和测试断言也不得泄露。

后续实现可复用现有模型供应商配置中的加密能力或抽取 API 私有加密 helper；如果抽取到 `packages/core`，必须保持 core 不依赖 `apps/api`。本 change 不规定具体加密算法，只要求配置能够按当前应用加密 key 加密保存并在 Agent Chat runtime 内部解密。

### 4. Web 复用 schema-driven config-form，不做 Tavily 定制 UI

前端继续通过 Registry JSON Schema 创建 `PluginConfigSchemaSnapshot`，并复用 `features/plugins/config-form` 的字段渲染、前端校验和 JSON 降级编辑能力。Tavily schema 是扁平 object，现有 renderer 应能覆盖 string/number/integer/boolean/enum/sensitive string。

插件详情页配置编辑 hook 改为调用 runtime `apis.plugins` 的真实 `fetchConfig/updateConfig/validateConfig`，不再导入 `plugin-config-mock.ts`。Mutation 成功后按 query key 刷新配置值和 detail summary，页面 summary 文案显示真实配置状态。

### 5. Agent Chat runtime 按配置优先级注入 Tavily key

Agent Chat 构建 `search_web` 工具时，优先读取已保存的 `quantagent.official.source.tavily` 插件配置并解密 `api_key`，再 fallback 到 `TAVILY_API_KEY` 环境变量。未配置或解密失败时，`search_web` 仍以可恢复工具失败形式暴露给 Agent，不应让整个 run 崩溃。

这个注入发生在 API service 构建 AgentRuntime 的边界，不把 Tavily key 放进 `RunContextSnapshot`、SSE、DB transcript、artifact、tool input/output 或前端 payload。

## Risks / Trade-offs

- [Risk] 使用可解密加密存储比 secret reference 更直接，但扩大了后端对 secret 生命周期的责任。→ Mitigation：响应、日志、审计和 stream 明确禁止明文；后续可在 Vault 成熟后迁移存储后端。
- [Risk] 新增 `config-values` 端点会与现有 `config` 详情视图并存。→ Mitigation：OpenSpec 明确两条路径职责，前端 form API 只消费 `config-values`，detail view 继续消费 `config`。
- [Risk] Tavily 插件 schema 从 `api_key_ref` 转为 `api_key` 可能影响旧测试或 SourceBinding fixture。→ Mitigation：实现阶段更新插件测试和 README；如确有旧 runtime 依赖，插件入口可兼容读取旧字段，但不作为新 UI 主路径。
- [Risk] Agent Chat 直接从插件配置读取 key 是最小接线，尚未完成 ToolRegistry 统一注入。→ Mitigation：本 change 标注为 MVP 运行时注入；后续 ToolRegistry 统一治理时再把该读取逻辑下沉。

## Migration Plan

1. 先合入本 OpenSpec-only change，完成 review gate。
2. 实现阶段先新增后端 `config-values` API 和持久化，再调整 Tavily schema / 插件实现。
3. 后端完成后再切换 Web 配置编辑面板到真实 API，删除产品路径 mock。
4. 最后接入 Agent Chat runtime key 注入，并补缺 key 可恢复失败和已配置 key 的测试。
5. 回滚策略：如果运行时注入出现问题，可暂时只保留 `TAVILY_API_KEY` fallback；配置 API 和 Web 保存能力不影响 Agent Chat 旧行为。

## Open Questions

- 旧 `api_key_ref` 是否需要在 Tavily 插件入口长期兼容，还是只在一个迁移窗口内兼容，由实现 PR 根据现有 fixture 和 SourceBinding 使用面确认。
- 插件配置加密能力是复用现有 model config crypto 还是抽取新的 core service，由实现阶段根据依赖方向和复用范围选择，但不能让 core 依赖 API。
