## MODIFIED Requirements

### Requirement: Fixed First-Batch Debug Subroutes

`/debug` 首批 SHALL 固定提供 `page-states`、`runtime-config`、`error-fallback`、`route-playground`、`plugin-config-form` 五个子路由。

#### Scenario: All first-batch routes exist in development

- **WHEN** 开发者在 development 环境检查 `/debug` 工作台
- **THEN** `/debug/page-states`、`/debug/runtime-config`、`/debug/error-fallback`、`/debug/route-playground`、`/debug/plugin-config-form` 都可访问
- **AND** `/debug` 根页展示插件配置表单调试入口和用途说明

### Requirement: Debug Workbench Has Explicit Admission Boundary

`/debug` 工作台 SHALL 只承接开发态本地调试能力，不承接正式业务功能或敏感诊断面板。

#### Scenario: Debug capability stays within development boundary

- **WHEN** 开发者为前端新增本地调试入口
- **THEN** 可以把页面状态预览、route playground、runtime config 可视化和插件配置 schema-driven form 验证页纳入 `/debug`
- **AND** 不应把真实业务流程、权限绕过、敏感信息展示或运营后台功能纳入 `/debug`
- **AND** 插件配置调试页不得演变成正式插件管理台、插件自定义前端宿主或通用 API 调试器
