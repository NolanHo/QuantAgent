## 1. OpenSpec Review Gate

- [ ] 1.1 运行 `openspec validate tavily-plugin-config-runtime-key-v1 --type change --strict --json`，失败则先修 artifacts。
- [ ] 1.2 提交 OpenSpec-only commit；该提交只包含 `openspec/changes/tavily-plugin-config-runtime-key-v1/**`。
- [ ] 1.3 等待维护者确认本 change 后再进入实现；实现 PR 不混入无关格式化、runtime 截图或真实 secret。

## 2. 后端插件配置值能力

- [ ] 2.1 在 API/Core 边界设计并实现插件配置值持久化模型、migration、repository 和 service，保持 router → service → repository 分层。
- [ ] 2.2 新增 `GET /api/v1/plugins/{plugin_id}/config-values`、`PUT /api/v1/plugins/{plugin_id}/config-values`、`POST /api/v1/plugins/{plugin_id}/config:validate` 的 request/response DTO 和 router。
- [ ] 2.3 使用 Registry JSON Schema 做服务端校验；识别 schema `sensitive: true` 和字段名敏感 token，敏感字段加密保存、掩码回显。
- [ ] 2.4 更新插件 detail 配置摘要，使已保存配置能反映 valid / missing_required / not_configured 状态。
- [ ] 2.5 补 API 单测：读取空配置、校验失败不写入、保存成功、敏感字段不泄露、未知插件和无 schema 插件错误 envelope。

## 3. Tavily 插件配置契约

- [ ] 3.1 调整 `plugins/sources/tavily-source/config.schema.json`，将 `api_key` 设为必填敏感字段，保留 timeout/defaults 等可选字段。
- [ ] 3.2 调整 Tavily 插件入口读取 `api_key`；如实现阶段确认需要兼容旧 fixture，则仅作为运行时兼容读取 `api_key_ref`。
- [ ] 3.3 更新 Tavily README，说明用户只需要配置 `api_key`，插件仍不负责配置保存、调度、ToolRegistry 或事件链路。
- [ ] 3.4 补插件单测：`api_key` 正常调用 fake client、缺 key 结构化失败、错误不泄露 key。

## 4. Agent Chat Tavily 注入

- [ ] 4.1 在 Agent Chat service 构建 runtime 前读取 Tavily 插件配置，解密后只传给 `build_search_web_tool(api_key=...)`。
- [ ] 4.2 固定优先级：已保存插件配置优先，`TAVILY_API_KEY` 环境变量只作为 fallback。
- [ ] 4.3 确保 Tavily key 不进入 `RunContextSnapshot`、SSE、DB transcript、artifact、tool input/output 或前端 payload。
- [ ] 4.4 补 Agent Chat / tool 单测：已配置 key 注入成功、未配置 key 产生可恢复 `tool.failed`、run 不崩溃。

## 5. Web 插件配置真实 API

- [ ] 5.1 调整 `features/plugins` API contract，使配置值读取/保存走 `/config-values`，校验走 `/config:validate`。
- [ ] 5.2 改造插件详情页配置编辑 hook，删除产品路径中的 mock load/save/validate，改用 runtime `apis.plugins` 和 TanStack Query / mutation。
- [ ] 5.3 保留 `features/plugins/config-form` 的 JSON Schema renderer；确保 Tavily `api_key` 以敏感输入控件和掩码状态展示。
- [ ] 5.4 保存成功后刷新配置值 query 和插件 detail 配置摘要；页面 summary 文案不得显示 mock 来源。
- [ ] 5.5 补 Web 单测：真实 API 调用、Tavily schema 渲染、敏感字段掩码、保存后刷新、mock util 不再被详情页使用。

## 6. 验证与手工验收

- [ ] 6.1 运行插件配置和 Agent Chat 相关 Python 测试：`uv run python -m unittest apps.api.src.tests.test_app plugins/sources/tavily-source/tests/test_tavily_source.py packages.agent.tests.test_context_and_search_tools`。
- [ ] 6.2 运行 Web 配置表单相关测试：`bun run --cwd apps/web test:unit -- plugin-config`。
- [ ] 6.3 运行 `bun run --cwd apps/web build` 和 `git diff --check`。
- [ ] 6.4 手工验收：在插件详情页保存 Tavily key 后，打开 `/agent-chat?preset=nvda-earnings`，Research Agent 调用 `search_web` 不再因缺少 key 失败。
- [ ] 6.5 手工验收缺 key 降级：删除或不配置 Tavily key 后运行同一事件，前端能看到可恢复工具失败，Agent 继续输出保守结论。
