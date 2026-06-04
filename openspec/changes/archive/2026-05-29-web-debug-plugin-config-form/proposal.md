## Why

当前仓库已经把插件配置表单收敛为 schema-driven form，但前端还缺少一个稳定、隔离、仅开发态可见的入口来验证这条边界。`issue #119` 现在需要先在 `/debug` 工作台内收住首版插件配置表单行为，优先验证 `Zod authoring -> zod-to-json-schema` 这条来源链路，避免直接把未验证的表单能力耦合进正式 `/plugins` 页面。

## What Changes

- 在 `/debug` 工作台下新增开发态专用的插件配置表单调试页和入口索引，用于受控验证 schema-driven form。
- 定义前端首版插件配置表单的受控输入边界：通过共享 API / query 边界消费 `config-schema`、当前配置、校验和保存能力，不允许页面散落裸请求。
- 明确首版必须优先兼容 `zod-to-json-schema` 输出的复杂样例，并对嵌套对象、数组、record、discriminated union、default、敏感字段掩码给出 supported / degraded / unsupported 结果。
- 规定 debug 页需要覆盖 loading、empty、validation error、save pending、save success、save failure 等调试态语义，并在后端未就绪时允许隔离的稳定 mock。
- 保持该能力仅存在于 development `/debug` 路由中，不进入正式导航，也不作为正式插件管理台交付。

## Capabilities

### New Capabilities
- `web-debug-plugin-config-form`: 定义 `/debug` 下插件配置 schema-driven 表单首版的调试入口、表单边界、Zod 来源兼容范围、敏感字段语义和状态机。

### Modified Capabilities
- `web-debug-route-workbench`: 扩展 `/debug` 首批固定子路由和准入边界，允许受控加入插件配置表单调试页，但仍禁止把 `/debug` 扩展成正式插件管理台。

## Impact

- `apps/web/src/routes/**`：新增 `/debug/plugin-config-form` 路由与 `/debug` 根页入口索引。
- `apps/web/src/features/plugins/**`、`apps/web/src/shared/api/**`、`apps/web/src/shared/forms/**`：新增或扩展插件配置 schema/query/mutation/form renderer 边界。
- `apps/web/tests/**`、`apps/web/e2e/**`：补充复杂 schema、状态机、敏感字段和 mock/真实接口切换验证。
- `openspec/specs/web-debug-route-workbench/spec.md`：更新 `/debug` 工作台允许的首批子路由集合与边界说明。
