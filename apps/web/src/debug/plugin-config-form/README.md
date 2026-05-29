# plugin-config-form

`plugin-config-form` 是 `/debug/plugin-config-form` 调试页的本地能力目录，只用于开发态验证插件配置的 `schema-driven form` 路径。

## 负责什么

- 组织调试页卡片、抽屉和本地页面状态
- 提供 debug-only 的 mock 数据读取、校验和保存适配
- 承接“当前抽屉会话”的表单基线、保存提示和调试态文案

## 公开入口

- 统一从 [index.ts](./index.ts) 导出 `PluginConfigDebugPanel`
- route 层只应组合这个入口，不要直接跨目录拼装 `components/`、`data/`、`hooks/`

## 目录说明

- `components/`: 调试页卡片、抽屉和页面壳组件
- `hooks/`: 调试页 view-model 和页面状态编排
- `data/`: debug-only mock fixture、适配器和测试
- `model/`: 调试页状态类型与文案

## 边界

- 这里只承接 debug 工作台下的隔离验证，不承接正式 `/plugins` 页面业务
- `data/` 里的 mock 适配器不能外溢成正式 API 真源
- 共享的 schema form 能力继续放在 `@/features/plugins/config-form`，不要反向把正式共享逻辑堆回 debug 目录
- 如果新增逻辑只对调试页成立，优先放在这里；如果会被正式插件页复用，再评估下沉到 `features/plugins/config-form`
