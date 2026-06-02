## 1. OpenSpec-only 文档补强

- [x] 1.1 补齐 `proposal.md` 的 why now、影响范围、非目标和 #127 / #132 / PRD 关系。
- [x] 1.2 补齐 `design.md` 的页面职责边界、事件审计取舍、后续 Web 文件职责蓝图、数据流、失败路径和安全边界。
- [x] 1.3 补齐 `specs/web-p0-mainflow-pages/spec.md` 的事件级审计时间线 requirement，覆盖事件主对象、建议变更解释、系统/人工节点、关联入口、降级态和权限/trace 边界。
- [x] 1.4 保持 `specs/router-layout/spec.md` 只修改根路径 Dashboard 默认首页语义，不混入事件审计页面细节。
- [x] 1.5 同步 `docs/prd/08-frontend-pages-overview.md` 的 OpenSpec 真源映射，只回链 Event Audit Timeline 页面职责，不细化后端节点 contract。

## 2. 后续实现 Gate

- [ ] 2.1 在维护者明确认可本 OpenSpec-only PR 后，再进入 #132 Web 实现；实现 PR 不混入新的 OpenSpec 范围扩张。
- [ ] 2.2 #132 实现必须保持 `/events/:eventId/audit` 为事件级审计时间线，不退化成全局日志、插件日志页或 Runtime 镜像页。
- [ ] 2.3 #132 Web 实现必须新增 `features/event-audit/`，并按 route / API / contracts / query keys / queries / hook / components / types / utils / mocks / README 拆分；route 只读取 `eventId` 并装配页面。
- [ ] 2.4 #132 前端 API 只预留事件审计读取边界；后端事件审计 contract、generated client、数据库和真实 audit_logs 持久化必须后续另开窄范围 change。
- [ ] 2.5 #132 降级态必须明确标识接口未接通、无记录或权限不足，mock fallback 不能写成真实后端审计事实。

## 3. 验证

- [x] 3.1 运行 `openspec validate web-p0-mainflow-pages --type change --strict --json`。
- [x] 3.2 文档 PR 只包含本 change 的 OpenSpec artifacts 和 `docs/prd/08-frontend-pages-overview.md` 真源映射更新，不包含 `apps/web` 实现、依赖升级、生成物或无关 PRD 修改。
- [ ] 3.3 #132 实现 PR 需要运行 `bun run --cwd apps/web test:unit` 和 `bun run --cwd apps/web build`，并人工走读 `/events/:eventId`、`/approvals/:approvalId`、`/events/:eventId/audit` 的入口与返回链路。
