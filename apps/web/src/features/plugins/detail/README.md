# Plugin Detail Feature

本目录承接 `/plugins` 与 `/plugins/:pluginId` 的插件治理前端实现。

- `api/` 只放 Plugin Detail V1 endpoint class 与前端消费的 API contract 类型。
- `queries/` 只放 TanStack Query key 与 query hook，通过 runtime `apis` 访问后端。
- `hooks/` 放页面级组合逻辑；当前配置编辑 tab 在这里收口真实 schema + mock config/save/validate 的桥接。
- `components/page/` 只做页面组合，不直接拼 endpoint 或处理 API envelope。
- `components/config/` 放详情页配置 tab；当前先渲染 schema-driven mock 编辑页，不直接依赖 debug 路由目录。
- `components/sections/` 放 Overview、Config/Dependencies、Capabilities、Health/Audit/Ops 等只读区块。
- `components/states/` 放 loading、empty、error 等状态组件。
- `utils/` 放纯格式化函数。

当前约束：

- `/plugins/:pluginId` 的配置 tab 先复用真实 `GET /config-schema` 渲染字段结构。
- 当前配置读取、校验和保存仍由 feature 内 mock adapter 承接，页面必须明确标识 Mock 状态。
- 后端补齐 `GET/PUT /config` 与 `POST /config:validate` 后，应只替换 `hooks/` 和 `utils/` 中的数据 adapter，不重写表单 UI。

不负责：真实配置保存后端、插件启停、reload、卸载、SourceBinding 写操作、插件市场、Skill/Tool 顶层管理。SourceBinding 作为 Industry Plugin Detail 的内嵌子域，具体查询和状态展示放在 `features/plugins/source-bindings/`。
