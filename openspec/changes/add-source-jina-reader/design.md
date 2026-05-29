## Context

当前 Source Plugin 体系已经明确：

- 插件开发者只声明插件能力和 `config.schema.json`
- 官方插件只能通过 `plugin.yaml` 和 Registry 进入系统
- 平台负责配置校验、保存、启停、调度、审计和生命周期
- 插件只消费平台传入的 DTO / `effective_config` 并返回标准 DTO
- 平台负责 `RawEvent` 入库、去重、`SourceBinding`、Event Bus 和权限控制

在这个边界下，`Jina Reader` 更适合作为一个可复用的官方 Source Plugin 能力单独落地，再被新闻、财报、搜索等 crawler 插件复用。当前 issue `#169` 已经明确本轮不做 Runtime 接入、不做 `tool.read_url`、不做业务抓取插件，因此需要用 design 固化“只做 reader 插件包能力”的边界，避免后续实现时扩 scope。

## Goals / Non-Goals

**Goals:**

- 定义官方 `Jina Reader` Source Plugin 的最小插件包契约。
- 明确插件输出为平台约定的 Source Plugin 输出结构 / source runtime 可消费输出 DTO。
- 明确插件消费最小公开配置字段集合，并由平台传入 `effective_config`。
- 明确外部 reader 鉴权信息由平台统一控制，不进入插件公开 schema。
- 明确外部 reader 是否允许外发由平台策略结果或调用 DTO 传入，插件只执行已授权请求。
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
- 该插件进入系统的方式只应是 `plugin.yaml` 注册和 Registry 发现，不需要核心代码硬编码该插件。

### Decision 2: 插件输出保持在平台约定的 source 输出结构层

插件输出不引入新的 reader 专用 DTO，也不在本 change 中提前绑定某个 core 内部 DTO 名称；这里只约束为平台约定的 Source Plugin 输出结构 / source runtime 可消费输出 DTO。

原因：

- `#155` 已经把 reader 插件输出契约收敛到“平台约定的 source 输出结构 / source runtime 可消费 DTO”这一层，不应在单个 reader change 中重新钉死内部 DTO 名称。
- issue `#169` 明确本轮要给后续 crawler / search 插件提供与 `Readability` 平行的可复用基础件，保持输出层抽象有助于后续统一插件 IO / source runtime 契约。
- 这也符合当前文档已明确的“插件返回标准输出结构，由平台写入事件链路”的边界。

当前 source runtime 最小可消费字段语义为：

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

### Decision 4: 外发允许/禁止由平台策略结果传入，插件只执行已授权请求

插件不负责猜测某个 URL 是否属于私有链接、受限内容或默认不应外发场景；平台负责 secret / policy / allowlist 与相关审批边界，并把允许/禁止外发的结果通过调用 DTO、`effective_config` 或等价运行时上下文传给插件。插件只执行已被平台授权的外部 reader 请求，并在未授权或调用失败时返回清晰拒绝或失败信息。

原因：

- `docs/design/06-source-plugin-design.md`、`docs/design/11-crawler-source-plugin-boundary.md` 和 `plugins/AGENTS.md` 都要求平台负责权限、policy、secret 和运行时控制，插件只消费有效配置与策略结果。
- issue `#169` 目标是先收住安全边界，不把真实外部服务账号、配额和组织级策略混进本轮。
- 如果后续确实需要区分私有链接、受限内容或组织内 allowlist，也应由平台 policy / 审批边界单独承接，而不是由 reader 插件自行决定。

### Decision 5: 外部 reader 失败只清晰报错，不做自动 fallback 编排

本轮对限流、服务不可用、超时或外部 reader 返回失败，只要求插件清晰失败返回，不要求自动切换到 `Readability` 或其他 reader。

原因：

- 自动 fallback 会扩展到多 reader 编排、优先级和失败恢复策略，已经超出当前插件包边界。
- issue `#169` 明确本轮不做运行时编排和复杂抓取链路。
- 保持清晰失败返回，足以为后续实现层或 runtime 层单独设计 fallback 提供稳定契约。

## Risks / Trade-offs

- 外部服务依赖会带来可用性、限流和超时风险 -> 本轮通过清晰失败返回和最小验证收住，不做自动恢复。
- 平台统一控制外发授权可以降低数据泄露风险 -> 但需要后续平台侧 policy / secret / allowlist 契约继续收口。
- 不暴露 `tool.read_url` 会让 Agent / UI 直接调用场景延后 -> 但能保持本轮 reader 插件边界清晰。
- 输出只约束到 source runtime 可消费 DTO 层 -> 统一契约更稳，但具体内部 DTO 名称仍需由后续插件 IO / source runtime change 统一收口。

## Migration Plan

1. 本 change 审核通过后，先创建 OpenSpec-only PR。
2. 获得维护者明确认可后，再进入实现分支。
3. 实现阶段新增官方 `jina` 插件目录和最小测试。
4. 如果需要访问外部 reader 服务，在实现 PR 中说明平台如何把允许/禁止外发结果、鉴权入口和网络假设传给插件，以及最小本地验证方式。

## Open Questions

- 平台后续以什么 secret / policy 入口向 `Jina Reader` 提供外部服务鉴权与外发授权结果，而不暴露为插件公开 schema？
- 外发允许/禁止结果最终通过哪种运行时 DTO 传给 reader 插件，是否需要独立的 policy / allowlist change 承接？
