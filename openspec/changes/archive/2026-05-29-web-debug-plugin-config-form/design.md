## Context

`apps/web` 已经固定采用 React + Vite + TanStack Router + TanStack Query，且根目录与 `apps/web/AGENTS.md` 都要求本地调试能力优先收口到 `/debug` 工作台。另一方面，前端架构文档已经把插件配置表单方向收敛为 schema-driven form，不允许插件注入自定义前端组件。

当前缺口不在“是否做插件配置表单”，而在“先在哪里、按什么边界验证它”。如果直接把首版能力放进正式 `/plugins` 页面，会和插件管理台信息架构、后端 readiness、审计入口以及只读/可写权限边界同时耦合，导致本轮范围失控。issue #119 和维护者评论进一步把首版约束收紧为：必须优先验证 `Zod authoring -> zod-to-json-schema` 这条来源链路，而不是只在过于简单的手写 JSON Schema 上通过。

## Goals / Non-Goals

**Goals:**

- 在 development `/debug` 下提供独立的插件配置表单调试页和入口索引。
- 通过共享 API / query 边界消费 `config-schema`、当前配置、校验、保存，不在页面组件中散落请求逻辑。
- 明确首版对复杂 `zod-to-json-schema` 输出的支持边界，至少覆盖嵌套对象、数组、record、discriminated union、default 和敏感字段掩码。
- 定义 loading、empty、validation error、save pending、save success、save failure 的统一调试态语义。
- 允许在后端接口未 ready 时接入隔离 mock，但保持 mock 只存在于 debug/测试边界内。

**Non-Goals:**

- 不把该表单直接交付到正式 `/plugins` 页面。
- 不实现插件 enable / disable / reload / install / uninstall。
- 不引入插件自定义前端组件、通用 schema playground 或任意 JSON Schema 方言全兼容承诺。
- 不绕过 `shared/api`、统一错误 envelope、鉴权与 401/403 收口边界。

## Decisions

### 1. 使用独立 `/debug/plugin-config-form` 子路由，而不是把表单塞进现有业务页

调试页 SHALL 作为 `/debug` 下的独立子路由存在，并在 `/debug` 根页提供索引入口。这样可以把调试态表单状态机、schema inspect 辅助视图和 mock/真实接口切换边界集中在一个开发态入口内，而不会污染正式插件管理台。

备选方案是直接在 `/plugins` 页面用 query 参数或隐藏入口调试。该方案违反 `apps/web/AGENTS.md` 对 `/debug` 收口的要求，也会让未完成的后端契约和正式信息架构相互耦合，因此不采用。

### 2. 用编译期 development 分支控制 debug 路由注册与代码打包

`/debug/plugin-config-form` SHALL 与现有 `/debug` 工作台保持同一生产排除策略：production router 不注册该路由，且对应页面模块不进入 production bundle。实现上应复用现有 debug route gating 模式，以避免运行时隐藏但代码仍被打包的假隔离。

备选方案是始终注册路由、只在运行时隐藏导航。该方案不能满足现有 `web-debug-route-workbench` 对 production code exclusion 的要求，因此不采用。

### 3. 表单数据流统一走共享 API / query 边界，mock 通过 adapter 隔离

调试页的数据路径 SHALL 仍然遵守正式边界：schema、当前配置、校验、保存都从 feature query/mutation 或 shared API client 进入页面。若后端接口未 ready，可以在 debug 专用 adapter 或测试 mock 层提供稳定数据，但页面组件本身不直接判断“真实接口 vs mock”，也不散落裸 `fetch`。

备选方案是在页面里直接写 mock 常量或临时请求逻辑。该方案会把 debug 验证与最终实现边界混在一起，也不利于后续把能力迁移到正式页面，因此不采用。

### 4. 首版显式声明 Zod 来源兼容清单，而不是默认承诺“通用 JSON Schema 表单”

首版 renderer SHALL 围绕仓库当前计划采用的来源链路定义兼容范围：优先保证 `zod-to-json-schema` 输出的复杂样例可被稳定消费。对于 `describe()` 元信息映射、record key pattern、discriminated union 分支切换、default 初始值、mask-sensitive 字段等结构，需要给出 supported / degraded / unsupported 结果；不支持的结构必须显式暴露降级说明，不能静默错渲染。

备选方案是把目标定义为“兼容所有 JSON Schema 7 特性”。该方案既超出 issue 范围，也缺少当前仓库的真实来源真源，因此不采用。

### 5. 敏感字段采用“掩码展示 + 显式替换”语义，不回显明文

敏感字段 SHALL 在加载已有配置时展示掩码或受控摘要，而不是回显真实 secret。保存时允许输入新的明文值替换旧值，但“不修改”路径必须保留掩码语义。调试页可以展示结构化字段元信息帮助开发定位，但不得在页面、日志、错误提示或测试快照中输出 secret 原文。

备选方案是调试页为了方便直接回显真实值。该方案违反根目录和 `apps/web` 的敏感信息规则，因此不采用。

### 6. 可提供受控 schema inspect 辅助区，但不扩展成 playground

为了定位 `zod-to-json-schema` 兼容问题，调试页 MAY 提供一个受控的 schema inspect / preview 视图，帮助开发者对照 JSON Schema 结构与表单渲染结果。该视图必须围绕当前 plugin 示例与已消费 schema 工作，不允许演变成接受任意 schema 输入、任意渲染配置或任意脚本执行的通用 playground。

备选方案是完全不提供 inspect 视图。该方案会降低调试复杂 union/record/default 问题时的定位效率，因此不作为默认路径。

## Risks / Trade-offs

- [风险] 后端 `config-schema` / `config` / `validate` / `update` 接口未 ready，前端可能长时间停留在 mock 上。
  -> 缓解：spec 和 tasks 明确 mock 只作为隔离适配层，PR 必须记录真实接口未接通的边界和未验证项。

- [风险] `zod-to-json-schema` 复杂样例覆盖过重，首版 renderer 范围容易扩张成通用 schema form 引擎。
  -> 缓解：spec 只承诺 issue 中列出的关键结构，并要求 unsupported 结构显式降级，不把“全兼容”当目标。

- [风险] 调试页为了方便排查而泄露敏感字段或内部诊断细节。
  -> 缓解：敏感字段 requirement 明确禁止明文回显；错误和 inspect 视图只展示结构化摘要。

- [风险] `/debug` 准入边界继续扩大，逐步演变为完整插件工作台。
  -> 缓解：同时修改 `web-debug-route-workbench` spec，把新子路由限定为开发态 schema-driven form 验证页，而不是正式插件管理功能。

## Migration Plan

1. 先提交本 change 的 OpenSpec-only PR，等待维护者明确认可。
2. 审核通过后，在当前 issue 分支上实现 `/debug/plugin-config-form`、共享 query/api 边界和最小 renderer。
3. 若后端接口已 ready，优先接正式契约；若未 ready，先接稳定 mock 并在 PR 里显式注明。
4. 首版验证完成后，再通过后续 issue / change 决定如何把已验证能力迁入正式 `/plugins` 页面。

## Open Questions

- `config-schema` / `config` / `validate` / `update` 的正式 API 是否会在 #116 内一次性稳定，还是首版需要阶段性只接部分接口。
- 是否已经存在可复用的前端 schema form 基础设施；如果没有，首版是否仅在 `apps/web` 内引入最小受控 renderer。
- debug 页是否需要内置一个以上的 schema fixture；当前默认至少应有一个复杂 Zod 样例和一个较小样例。
