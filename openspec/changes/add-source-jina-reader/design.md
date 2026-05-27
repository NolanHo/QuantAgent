## Context

当前 Source Plugin 体系已经明确：

- 插件开发者只声明插件能力和 `config.schema.json`
- 平台负责配置校验、保存、启停、调度、审计和生命周期
- 插件只消费平台传入的 DTO / `effective_config` 并返回标准 DTO
- 平台负责 `RawEvent` 入库、去重、`SourceBinding`、Event Bus 和权限控制

在这个边界下，`Jina Reader` 更适合作为一个可复用的官方 Source Plugin 能力单独落地，再被新闻、财报、搜索等 crawler 插件复用。当前 issue `#169` 已经明确本轮不做 Runtime 接入、不做 `tool.read_url`、不做业务抓取插件，因此需要用 design 固化“只做 reader 插件包能力”的边界，避免后续实现时扩 scope。

## Goals / Non-Goals

**Goals:**

- 定义官方 `Jina Reader` Source Plugin 的最小插件包契约。
- 明确插件输出直接贴齐现有 `RawEventDraft` 兼容 DTO。
- 明确插件消费最小公开配置字段集合，并由平台传入 `effective_config`。
- 明确外部 reader 鉴权信息由平台统一控制，不进入插件公开 schema。
- 明确私有或不应外发的 URL 默认禁止进入外部 reader 请求路径。
- 定义最小插件级验证方式，优先使用 mock / fixture / 受控响应。

**Non-Goals:**

- 不修改 `Readability` 插件的边界、实现或验收口径。
- 不同时暴露 `tool.read_url` 查询工具。
- 不实现新闻聚合、RSS 轮询、搜索、财报、X/Twitter 或行情抓取。
- 不实现 API、Runtime、Scheduler、SourceBinding、RawEvent 入库、Event Bus 发布或前端管理台接入。
- 不引入 Playwright、浏览器自动化、复杂反爬、代理池或网页快照存储。
- 不实现自动 fallback 到 `Readability` 或其他 reader 的运行时编排。

## Decisions

### Decision 1: 本轮只收住 `source/read` 插件形态

`Jina Reader` 本轮只作为官方 Source Plugin 交付，不同时暴露 `tool.read_url` 查询工具。

原因：

- issue `#169` 目标是先收住插件包能力和最小交付物。
- 同时引入 tool 形态会扩展到 ToolRegistry input/output schema、风险级别和更广的运行时契约。
- 后续如果确认有 Agent / UI 直接调用需要，再为 `tool.read_url` 开独立 issue 或 change。

### Decision 2: 插件输出直接使用 `RawEventDraft` 兼容 DTO

插件输出不引入新的轻量 reader DTO，而是直接返回现有 source 运行时可消费的 `RawEventDraft` 兼容形态。

原因：

- `packages/core/src/quantagent/core/events/dto.py` 已定义 `RawEventDraft`，当前 `rss-source`、`placeholder-source` 和 `packages/core/tests/test_core.py` 已围绕该 DTO 建立最小契约。
- issue `#169` 明确本轮要给后续 crawler / search 插件提供与 `Readability` 平行的可复用基础件，直接贴齐现有 DTO 能减少后续适配层。
- 这也符合当前文档已明确的“插件返回标准 DTO，由平台写入事件链路”的边界。

当前 `RawEventDraft` 最小字段集合为：

- `source_plugin_id`
- `source_type`
- `title`
- 可选 `external_id`
- 可选 `url`
- 可选 `canonical_url`
- 可选 `content`
- 可选 `author`
- 可选 `published_at`
- `captured_at`
- `raw_payload`
- `metadata`
- 可选 `dedupe_hint`

### Decision 3: 外部 reader 鉴权由平台统一控制

插件公开 `config.schema.json` 只覆盖最小非敏感字段，不直接暴露原始 token、私有账号或其他外部 reader 鉴权秘密。

原因：

- issue `#169` 明确不提交真实 token、cookie、付费服务账号或生产 URL 白名单。
- 外部 reader 调用属于插件实现细节，但鉴权仍应受平台统一 secret / policy 边界约束。
- 这能避免插件 schema 直接变成真实敏感配置入口，降低后续控制台和 API 配置泄露风险。

### Decision 4: 私有或默认不应外发的 URL 本轮默认禁止请求外部 reader

插件对私有链接、受限内容或默认不应外发的 URL，不进入外部 reader 请求路径，而是返回清晰拒绝或失败信息。

原因：

- `docs/design/06-source-plugin-design.md` 已明确敏感或私有链接不应默认走外部 reader。
- issue `#169` 目标是先收住安全边界，不把真实外部服务账号、配额和组织级策略混进本轮。
- 如果后续确实需要例外放行，应由平台权限 / policy / 审批边界单独承接，而不是由 reader 插件自行决定。

### Decision 5: 外部 reader 失败只清晰报错，不做自动 fallback 编排

本轮对限流、服务不可用、超时或外部 reader 返回失败，只要求插件清晰失败返回，不要求自动切换到 `Readability` 或其他 reader。

原因：

- 自动 fallback 会扩展到多 reader 编排、优先级和失败恢复策略，已经超出当前插件包边界。
- issue `#169` 明确本轮不做运行时编排和复杂抓取链路。
- 保持清晰失败返回，足以为后续实现层或 runtime 层单独设计 fallback 提供稳定契约。

## Risks / Trade-offs

- 外部服务依赖会带来可用性、限流和超时风险 -> 本轮通过清晰失败返回和最小验证收住，不做自动恢复。
- 默认禁止敏感 URL 外发可以降低数据泄露风险 -> 但也会让部分需要例外放行的场景延后到后续 policy issue。
- 不暴露 `tool.read_url` 会让 Agent / UI 直接调用场景延后 -> 但能保持本轮 reader 插件边界清晰。
- 直接输出 `RawEventDraft` 能减少适配层 -> 但要求 `Jina Reader` 插件较早理解 source runtime DTO 约束。

## Migration Plan

1. 本 change 审核通过后，先创建 OpenSpec-only PR。
2. 获得维护者明确认可后，再进入实现分支。
3. 实现阶段新增官方 `jina` 插件目录和最小测试。
4. 如果需要访问外部 reader 服务，在实现 PR 中说明平台统一鉴权策略、网络假设和最小本地验证方式。

## Open Questions

- 平台后续以什么 secret / policy 入口向 `Jina Reader` 提供外部服务鉴权，而不暴露为插件公开 schema？
- 敏感 URL 的判定规则后续是否需要独立 policy / allowlist change？
