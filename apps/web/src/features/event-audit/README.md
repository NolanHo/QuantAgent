## event-audit feature

负责 `/events/:eventId/audit` 事件级审计时间线。

MVP 暴露边界：

- 当前后端没有稳定的 `/events/{eventId}/audit` read model，页面只保留深链可达，不进入正式导航、事件列表按钮、审批详情入口或 Dashboard。
- 正式业务入口应优先使用 `/events/:eventId` 事件详情中的 Router timeline、Agent stage 和 trace refs。
- 后续只有在后端补齐稳定事件级 audit contract 后，才恢复事件中心、审批详情或其他页面的显式入口。

入口：

- route: `src/routes/_app/(workspace)/events/$eventId/audit.tsx`
- page: `components/page/EventAuditPage.tsx`
- page hook: `hooks/use-event-audit-page.ts`

子目录：

- `api/`: 事件审计读取 API 和前端局部 contract。
- `queries/`: query key 与 TanStack Query hook。
- `hooks/`: 页面级业务编排，只组合 query、mock fallback、关联入口和页面状态。
- `components/`: 页面、timeline 和状态组件。
- `types/`: UI 展示类型。
- `utils/`: 节点排序、分组、格式化和降级判断等纯函数。
- `mocks/`: 后端事件审计接口未接通时的结构化占位数据。

不负责：

- 不定义后端 `audit_logs` contract、数据库查询、generated client 或跨语言 schema。
- 不替代 Runtime、插件 Audit tab 或全局日志平台。
- 不在前端补写、编辑或伪造真实审计历史。

不要继续放入：

- 不要把 route、API、query、hook、timeline JSX 和 mock 数据重新合并到一个文件。
- 不要把 mock fallback 文案写成真实后端审计记录。
