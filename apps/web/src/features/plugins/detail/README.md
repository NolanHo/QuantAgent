# Plugin Detail Feature

本目录承接 `/plugins` 与 `/plugins/:pluginId` 的插件治理前端实现。

- `api/` 只放 Plugin Detail V1 endpoint class 与前端消费的 API contract 类型。
- `queries/` 只放 TanStack Query key 与 query hook，通过 runtime `apis` 访问后端。
- `hooks/` 放页面级组合逻辑；配置编辑 tab 在这里收口真实 schema、配置值 query、校验和保存 mutation。
- `components/page/` 只做页面组合，不直接拼 endpoint 或处理 API envelope。
- `components/config/` 放详情页配置 tab；渲染 schema-driven 配置编辑页，不直接依赖 debug 路由目录。
- `components/sections/` 放 Overview、Config/Dependencies、Capabilities、Health/Audit/Ops 等只读区块。
- `components/states/` 放 loading、empty、error 等状态组件。
- `utils/` 放纯格式化函数。

当前约束：

- `/plugins/:pluginId` 的配置 tab 先复用真实 `GET /config-schema` 渲染字段结构。
- 配置值读取/保存走 `GET/PUT /config-values`，校验走 `POST /config:validate`；页面不得在产品路径导入 mock load/save/validate。

不负责：真实配置保存后端、插件启停、reload、卸载、SourceBinding 写操作、插件市场、Skill/Tool 顶层管理。SourceBinding 作为 Industry Plugin Detail 的内嵌子域，具体查询和状态展示放在 `features/plugins/source-bindings/`。
