# Plugin Detail Feature

本目录承接 `/plugins` 与 `/plugins/:pluginId` 的插件治理前端实现。

- `api/` 只放 Plugin Detail V1 endpoint class 与前端消费的 API contract 类型。
- `queries/` 只放 TanStack Query key 与 query hook，通过 runtime `apis` 访问后端。
- `components/page/` 只做页面组合，不直接拼 endpoint 或处理 API envelope。
- `components/sections/` 放 Overview、Config/Dependencies、Capabilities、Health/Audit/Ops 等只读区块。
- `components/states/` 放 loading、empty、error 等状态组件。
- `utils/` 放纯格式化函数。

不负责：配置保存、插件启停、reload、卸载、SourceBinding 写操作、插件市场、Skill/Tool 顶层管理。SourceBinding 作为 Industry Plugin Detail 的内嵌子域，具体查询和状态展示放在 `features/plugins/source-bindings/`。
