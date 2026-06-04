# SourceBinding Feature

本目录承接 SourceBinding 在插件治理里的前端子域。V1 只作为 Industry Plugin Detail 内嵌面板展示，不提供顶层导航。

- `api/` 只封装 `/source-bindings` 只读列表 endpoint 与 contract 类型。
- `queries/` 只放 query key 与 `useSourceBindingsQuery`。
- `components/` 放内嵌面板和表格状态。
- `utils/` 放展示摘要格式化。

不负责：bind/unbind、pause/resume/run-now 前端操作、SchedulerRun 详情页、Source 插件抓取流程、后端状态机或兼容性规则。接口不可用、权限不足或未持久化绑定时，页面必须显示 unavailable/empty state，不能伪造 SourceBinding 数据。
