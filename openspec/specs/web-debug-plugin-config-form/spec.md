# Web Debug Plugin Config Form Specification

## Purpose

定义 QuantAgent Web 管理台开发态 `/debug/plugin-config-form` 的稳定行为契约，用于受控验证插件配置 schema-driven form 的首版边界，包括 Zod authoring 兼容、共享 API/query/mutation 边界、mock 隔离、敏感字段掩码和表单状态机。

## Requirements

### Requirement: Development-Only Plugin Config Form Debug Route

Web 应用 SHALL 在 `/debug` 工作台下提供一个仅 development 可访问的插件配置表单调试子路由，用于受控验证 schema-driven form 首版能力。

#### Scenario: Debug route is reachable from the workbench

- **WHEN** 开发者在 development 环境访问 `/debug`
- **THEN** 根页展示插件配置表单调试入口和用途说明
- **AND** 该入口导航到 `/debug/plugin-config-form`

#### Scenario: Debug route is not formal product navigation

- **WHEN** 开发者检查正式侧边导航和正式插件管理入口
- **THEN** `/debug/plugin-config-form` 不出现在正式导航中
- **AND** 该页面不被描述为正式 `/plugins` 功能

### Requirement: Plugin Config Form Uses Shared Schema And Config Boundaries

调试页 SHALL 通过共享 API / query / mutation 边界消费插件配置 schema、当前配置、校验和保存能力，而不是在页面组件里散落裸请求。

#### Scenario: Page consumes schema and config through shared boundaries

- **WHEN** `/debug/plugin-config-form` 加载目标插件配置表单
- **THEN** 页面通过共享 API / query 边界读取 `config-schema` 和当前配置
- **AND** 页面不直接在组件中调用裸 `fetch`

#### Scenario: Mock data stays behind an explicit adapter

- **WHEN** 后端 `config-schema`、`config`、`validate` 或 `update` 接口尚未 ready
- **THEN** 调试页可以通过隔离的 debug/mock adapter 获取稳定样例数据
- **AND** mock 逻辑不扩散到正式业务页面

### Requirement: First Version Targets Zod Authoring Compatibility

首版 schema-driven form SHALL 优先验证 `Zod authoring -> zod-to-json-schema` 输出链路，而不是承诺兼容任意第三方 JSON Schema 来源。

#### Scenario: Complex Zod-derived schema is accepted as baseline fixture

- **WHEN** 开发者使用维护者提供的复杂 Zod 样例生成 JSON Schema
- **THEN** 调试页可以消费该 schema 并渲染首版表单
- **AND** 验收不依赖仅包含简单平铺字段的手写 schema

#### Scenario: Compatibility result is explicit for key structures

- **WHEN** schema 包含嵌套对象、数组、record、discriminated union、default 或敏感字段描述
- **THEN** 每类结构都有明确的 supported、degraded 或 unsupported 结果
- **AND** unsupported 结构不会被静默错误渲染

### Requirement: Sensitive Fields Stay Masked And Replaceable

调试页 SHALL 对敏感字段采用受控掩码展示与显式替换语义，不得回显真实 secret。

#### Scenario: Existing secret values are not rendered in plain text

- **WHEN** 页面加载包含敏感字段的现有配置
- **THEN** 表单展示掩码值或结构化摘要
- **AND** 页面不展示 secret 原文

#### Scenario: Developer can replace without exposing old secret

- **WHEN** 开发者在调试页编辑敏感字段并提交保存
- **THEN** 页面允许输入新的值覆盖旧值
- **AND** “不修改旧值”路径保持掩码语义
- **AND** 日志、错误提示和测试快照中不泄露旧 secret

### Requirement: Debug Page Covers Form State Machine

调试页 SHALL 提供可验证的表单状态语义，至少覆盖 loading、empty、validation error、save pending、save success 和 save failure。

#### Scenario: Loading and empty states are previewable

- **WHEN** 开发者在调试页加载 schema 或当前配置
- **THEN** 页面可以稳定展示 loading 和 empty 状态
- **AND** 这些状态可以在不依赖真实后端波动的前提下被验证

#### Scenario: Validation and save feedback map to form UI

- **WHEN** 校验或保存返回字段级错误、请求失败或保存成功
- **THEN** 页面将结果稳定映射到字段提示和页面级反馈
- **AND** 页面可区分 validation error、save pending、save success 和 save failure

### Requirement: Debug Page May Expose Controlled Schema Inspect View

调试页 MAY 提供受控的 schema inspect / preview 辅助视图，但该视图 MUST 保持在当前插件配置调试边界内。

#### Scenario: Inspect view helps locate compatibility issues

- **WHEN** 开发者需要定位 `zod-to-json-schema` 输出与表单渲染之间的差异
- **THEN** 调试页可以展示当前已消费 schema 的结构化预览
- **AND** 该视图帮助定位复杂结构的兼容问题

#### Scenario: Inspect view does not become a general playground

- **WHEN** 开发者检查调试页的 inspect 功能边界
- **THEN** 该功能不接受任意未治理 schema 输入
- **AND** 该功能不执行任意脚本或插件自定义前端组件
