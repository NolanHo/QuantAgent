## Context

当前仓库已经有稳定的前端路由与登录能力：

- `router-layout` 规定了管理台壳、导航和根路径默认入口。
- `web-login-cookie-session-auth` 规定了 `/login`、受保护路由和默认首页流。

但这两层 stable spec 仍然把“默认首页流”当作抽象入口，没有把首页究竟是 Dashboard 还是 `/events` 写成稳定契约。代码现状也仍然把根路径 `/` 导向 `/events`，与 issue #127 和当前页面 PRD 已确认的主链路不一致。

本 change 不是重写页面 PRD，而是把已经确认的 P0 主链路结论收成稳定契约，并纠正现有 stable 路由语义。

## Goals / Non-Goals

**Goals:**

- 固化 P0 主链路的五个核心页面职责：Dashboard、Events、Event Detail / Decision、Event Audit Timeline、Approvals。
- 明确五个页面的主对象、主任务和禁止职责。
- 明确事件级审计页主对象是 Event，主任务是回放建议生成、变更、reanalysis 和人工动作，而不是提供全局日志或 Runtime 镜像。
- 把根路径 `/` 的默认首页语义从 `/events` 收口为 Dashboard。
- 为 #129、#130、#131、#132 提供一个可复用的统一上游 change。
- 让后续实现者能够在不重新做产品判断的情况下进入页面实现。

**Non-Goals:**

- 不在本 change 中实现 React 页面、路由代码、后端 API contract、generated client、数据库 schema 或组件样式。
- 不重新设计 Runtime、Plugins、Models、Settings 等非 P0 页面。
- 不把“相关历史事件”“真实执行流程”“首页外独立系统健康页”“全局日志平台”“完整原始推理回放”拉进 V1 主链路。
- 不把事件审计页扩展成 audit_logs 后端查询 contract、不可篡改存证设计或完整 payload diff 工具。
- 不修改登录、会话、CSRF 或 capability guard 的既有行为契约，除非它们与默认首页入口直接相关。

## Decisions

### 1. 用新的页面 capability 承接 P0 主链路，而不是继续堆进 `router-layout`

`router-layout` 适合承载“路由壳、导航、默认入口”这类稳定布局语义，但不适合同时承载每个业务页面的主对象、页面任务和非目标。把所有页面边界都继续塞进 `router-layout`，会让该 spec 演变成混合路由、布局和产品信息架构的大杂烩。

因此本 change 采用两层处理：

- `router-layout` 只修改根路径默认入口这一条稳定路由语义。
- 新增 `web-p0-mainflow-pages` 能力，专门定义 Dashboard、Events、Event Detail / Decision、Event Audit Timeline、Approvals 的行为边界。

这样后续页面实现 issue 可以直接引用页面能力 spec，而不必从布局 spec 中拆意图。

### 2. Dashboard 必须是独立默认首页，而不是 `/events` 的别名或重皮肤

这是 issue #127 的核心决策。Dashboard 需要同时容纳高价值事件、待审批摘要和关键健康提醒，承担“今天先看什么、接下来处理什么、系统是否影响判断质量”的总控职责。`/events` 只负责浏览、筛选和扩展事件视野。

替代方案是继续让 `/events` 兼任总首页。该方案会把事件列表、筛选工具条和首页总控职责混在一起，使 Dashboard 的独立价值消失，也会让 #129、#130、#131 对首页入口产生不同假设，因此不采用。

### 3. `/events` 不是首页，因为它解决的是“浏览更多事件”，不是“给出第一判断”

`/events` 的主任务是让用户在 Dashboard 之外浏览、筛选和扩展重点事件视野。它回答的是“还有哪些事件值得看”“如何收窄事件集合”，而不是“今天第一眼先看什么、有哪些审批待处理、系统是否影响判断质量”。

如果让 `/events` 继续承担首页职责，事件中心就会被迫同时容纳首页总控摘要、事件筛选工具和后续详情入口，最终既不像首页，也不像事件中心。因此本 change 将 `/events` 固定为从 Dashboard 进入的事件中心，而不是默认首页。

### 4. 页面边界用“主对象 + 主任务 + 禁止职责”定义，而不是枚举最终组件

仅靠“页面名称和路由”不足以避免后续实现漂移。本 change 以三件套固定页面边界：

- 主对象：页面围绕什么资源组织。
- 主任务：用户进入该页首先要完成什么判断。
- 禁止职责：明确哪些动作或信息不应出现在该页。

例如：

- Dashboard：主对象聚焦高价值事件；禁止承担审批执行和插件治理。
- Events：主对象是事件集合；禁止承担首页总控和审批动作。
- Event Detail：主对象是单条事件；禁止直接批准或执行高风险动作。
- Event Audit Timeline：主对象是单条事件的审计回放；禁止变成全局日志页、插件日志中心或 Runtime 替代品。
- Approvals：主对象是 ApprovalRequest；禁止把批准语义写成真实执行完成。

这种定义方式与现有页面 PRD 的结构一致，也更适合转成验收场景。相反，如果在 OpenSpec 中枚举最终组件名、字段和布局细节，会抢掉 #129、#130、#131 的实现设计空间，并让 spec 过早绑定尚未稳定的 API contract，因此不采用。

### 5. 把 V1 非目标写进 spec，而不是只留在 issue 或 PRD 文字里

`issue #127` 评论已经明确“相关历史事件不进入 V1 主链路”，但现有页面 PRD 和代码骨架之外还没有一个稳定契约来约束后续实现。如果只把这个结论放在 issue 里，后续 Web issue 很容易重新把它带回来。

因此本 change 直接将以下边界写入 spec：

- Dashboard 不拆独立系统健康页面，只展示影响判断质量的关键提醒。
- Event Detail 不把相关历史事件作为 P0 必须展示内容。
- P0 主链路不引入真实执行流程、插件治理入口或完整运行时排障台。

### 6. `router-layout` 只改默认入口，不重复登录和受限访问契约

本 change 需要修改 `router-layout` 中根路径 `/` 的默认入口，但不应把 `/login`、受保护路由、capability-limited forbidden 等行为重新定义一遍。这些行为已经由 `web-login-cookie-session-auth` 和后续 capability guard 类 spec 负责。

替代方案是在本 change 的 `router-layout` delta 中同时复制登录恢复、403 和 capability snapshot 语义。该方案会让归档后的 `router-layout` 变成认证和权限真源，造成职责重叠，因此不采用。

### 7. PRD 回链只同步真源映射，不重写页面附录

当前 `docs/prd/08-frontend-pages-overview.md` 已经列出 Event Audit Timeline 作为 P0 主链路页面，但 OpenSpec 真源映射仍停留在 Dashboard / Events / Event Detail / Approvals。为了避免 PRD 与 OpenSpec 分叉，本轮只同步真源映射，不重写页面附录正文。

因此本轮保持窄文档边界：

- OpenSpec artifacts 承接页面行为契约。
- `docs/prd/08-frontend-pages-overview.md` 只更新 OpenSpec 真源映射。
- 不大改 `00-dashboard.md`、`02-events-home.md`、`03-event-detail.md`、`04-approvals-index.md`、`16-event-audit-timeline.md`，除非后续实现或评审发现与 stable spec 直接冲突的语句。

### 8. `/events/:eventId/audit` 以 Event 为主对象，不做全局日志平台

Issue #132 和 `docs/prd/pages/16-event-audit-timeline.md` 已经明确，事件级审计时间线要回答“这条建议为什么变成现在这样，谁在什么时候做过什么”。这与 Runtime 的运行排障、插件详情 Audit tab 或后续全局运营报表不同。

因此本 change 将 `/events/:eventId/audit` 收进 P0 主链路页面契约：

- 时间线按 Event 组织，不按插件、全局日志或审批动作分散浏览。
- V1 至少表达事件状态变化、分析完成、建议生成 / 变更、reanalysis、人工动作和关键运行错误。
- 建议变更展示摘要级 before / after、变更原因和分数变化，不展示完整原始推理、secret、私有策略或敏感 payload。
- 事件详情和审批详情必须提供回到当前事件审计页的稳定入口。

替代方案是把审计页留作 `EventPages.tsx` 里的静态占位，等后端 contract 完全接通后再整理。该方案会继续让 route、mock、节点归并和页面主体混在一起，也无法约束后续实现不要退化成全局日志列表，因此不采用。

### 9. 事件审计 V1 预留前端 API / query 边界，但不新增后端 contract

当前仓库没有事件级审计 REST contract。Issue #132 要求“若后端 contract 尚未完全接通，前端只表达结构化占位和降级态，不在页面层发明新的 audit 真相”，同时要求实现符合 Web gate 的 route / api / query / hook / component / README 分层。

因此后续实现采用前端预留 API + 降级策略：

- `apps/web` 新增事件审计 feature，前端 API 预留 `GET /events/{eventId}/audit` 的调用边界。
- 服务端状态通过 TanStack Query 承接；route 只传入 `eventId`。
- 当接口未接通、返回不可用或无数据时，页面展示明确标识的结构化降级态和 mock fallback，不能把 fallback 写成真实审计记录。
- 不在本 change 中新增 `apps/api` router、数据库表、`packages/contracts` schema 或 generated client。

替代方案一是同步新增后端事件审计接口。该方案会扩大到后端 contract、持久化和审计记录真源，超出 #132 的前端页面收口范围。替代方案二是只保留 mock-only 组件拆分，但它无法满足 TanStack Query 和 API 分层要求，也会削弱未来接入真实 contract 的边界，因此不采用。

### 10. 后续 Web 实现的职责蓝图

本 change 不提交业务实现，但 #132 的实现 PR 必须按 Web gate 把审计页拆到可 review 的职责边界：

```text
apps/web/src/routes/_app/(workspace)/events/$eventId/audit.tsx
apps/web/src/features/event-audit/
  README.md
  api/
    event-audit.api.ts
    event-audit.contracts.ts
  queries/
    event-audit.keys.ts
    use-event-audit-timeline.ts
  hooks/
    use-event-audit-page.ts
  components/
    page/
    timeline/
    states/
  types/
    event-audit.types.ts
  utils/
    event-audit-node.ts
  mocks/
    event-audit.mock.ts
```

职责边界：

- route 只读取 `eventId` 并装配 feature page，不直接请求、组装节点或渲染时间线主体。
- feature API 只封装事件审计读取 endpoint 和局部 contract 类型；query key、`useQuery`、toast、页面状态不能放进 API 文件。
- query hook 通过 `app/runtime` 的稳定 `apis` 对象访问 feature API，不直接创建 `apiClient` 或 `EventAuditApi`。
- 页面 hook 只组合 query 结果、事件摘要、相关入口和降级态，不承载底层 HTTP、DTO envelope 或复杂 JSX。
- components 只渲染稳定 props，覆盖 loading、empty、error、only system nodes、only human nodes、degraded fallback 和 sensitive masked 状态。
- README 说明 feature 职责、route 入口、公开 page/hook、子目录含义、不负责后端 audit contract 和不要继续往根目录平铺什么。

### 11. 数据流、失败路径和安全边界

目标数据流：

```text
route eventId
  -> useEventAuditPage(eventId)
  -> useEventAuditTimeline(eventId)
  -> runtime apis.eventAudit.getEventAuditTimeline(eventId)
  -> EventAuditPage / timeline components
```

当后端事件审计接口未接通、返回 404/501/不可用或暂无记录时，页面进入结构化降级态：

- 明确展示“后端事件审计接口未接通”或“当前事件暂无审计记录”，不得写成真实历史已经发生。
- 可以使用 mock fallback 解释页面结构，但必须标识为占位数据。
- 读取失败展示错误摘要和 request_id / trace_id；缺少 trace 的节点只展示可用摘要，不阻断整条时间线。
- 权限不足展示 capability 缺失或不可见原因，不用 mock 数据绕过权限。

安全和审计边界：

- REST / 数据库 / append-only audit 记录是业务状态真源；WebSocket 只可用于提醒或 query invalidation。
- `before_state` / `after_state` 只展示脱敏摘要，不展示完整模型推理链、secret、token、私有策略或完整敏感 payload。
- 审计页只读，不提供编辑历史、补写 audit、批准、执行或策略绕过入口。
- 后端 `audit_logs` contract、持久化查询、generated client 和跨语言 schema 需要后续独立 change 收口。

### 8. issue #130 先收口事件详情 feature，而不是顺手重写整个事件中心

`issue #130` 的目标是把 `/events/:eventId` 收口为可进入真实 API 接入前的事件详情 / 决策页 V1，而不是把 `/events` 事件中心、Dashboard 和评分实现一次性重写。当前 `apps/web` 已有 `features/mainflow/pages/EventPages.tsx` 骨架，但它不应继续承载事件详情页的长期职责。

因此本轮实现输入需要固定为：

- `/events` 继续承担事件中心骨架，不要求与详情页迁移绑成一次性目录大重构。
- `/events/:eventId` 与 `/events/:eventId/audit` 迁出到独立事件详情 feature 边界，避免在 `mainflow` 骨架里继续追加真实页面状态和复杂 JSX。
- route 文件保持薄层，只负责参数读取和页面装配；事件事实、行业影响分析、最佳动作、支持 / 反方观点、运行摘要和审计入口进入 feature 内部职责目录。
- 详情页首屏阅读顺序固定为“左栏事实、右栏分析与最佳动作、下方辅助摘要”，不因为实现 convenience 把运行摘要或审计入口抬到首屏主判断位。

这里不在 `web-p0-mainflow-pages` 中发明最终 API contract、query key 或 DTO 字段；这些属于 `event-scoring-v1` 与后续真实 API/contracts change 的职责。但页面级目录职责、主阅读顺序和 `mainflow` 迁移边界必须在这里先固定，否则实现者仍需要自行决定应该拆到哪里、哪些页面一起迁。

### 9. 事件详情实现先以 mock 适配层为边界，而不是在 route 或视图里硬编码临时字段

`issue #130` 当前没有要求同时交付真实事件详情 API DTO、`packages/contracts` 或 generated client。现有 `event-scoring-v1` 也把“真实 DTO 来源”保留为后续 gate。因此事件详情首版实现应允许先基于现有 mock contract 收口页面结构，但不能把这些临时结构直接扩散成 route 或 view 的长期依赖。

实现蓝图应固定为：

- 事件详情 feature 至少包含 `README.md`、`components/`、`hooks/`、`types/`、`utils/`；如果未来真实 API ready，再在同一边界补 `api/`、`queries/`。
- feature 内通过 page model / adapter 把当前 mock 数据映射成页面消费模型；展示组件不直接依赖原始 mock DTO 结构。
- `features/mainflow` 保留静态骨架入口，不继续承担事件详情的数据适配、评分解释或审计摘要拼装。
- 中文注释需要落在“评分不是执行放行”“运行摘要只做辅助复核”“审计入口不替代审计页”这类非显然边界上，避免后续实现误把高分当作可执行结论。

## Risks / Trade-offs

- [Risk] 只修改 OpenSpec 而不立刻改路由代码，短期内仓库实现仍然保持 `/ -> /events`。
  -> Mitigation：在 tasks 中明确实现 PR 必须先处理默认首页入口，再进入 Dashboard UI 或详情/审批页面实现。

- [Risk] 新增 `web-p0-mainflow-pages` capability 后，reviewer 可能质疑和现有页面 PRD 的边界重复。
  -> Mitigation：proposal 和 design 中明确 PRD 是页面附录，OpenSpec 是行为真源；本轮只同步 `docs/prd/08` 的真源映射，不重写页面附录正文。

- [Risk] 事件详情页当前 PRD 提到了更多信息块，spec 若写得过细会抢掉 #130 的设计空间。
  -> Mitigation：spec 只固定主阅读顺序、关键入口和 P0 非目标，不发明最终字段 contract 或交互细节。

- [Risk] 修改 `router-layout` 默认入口会与 `web-login-cookie-session-auth` 的“默认首页流”表述形成歧义。
  -> Mitigation：在 `router-layout` 中显式把默认首页流指向 Dashboard；登录 spec 继续保留“进入默认首页流”的抽象，不重复写死路由细节。

- [Risk] 事件审计页预留前端 API 后，reviewer 可能误以为本 change 已定义后端 audit contract。
  -> Mitigation：spec 和 tasks 明确本轮只定义页面行为与前端分层，后端事件审计 contract 需要后续窄范围 change 单独收口。

- [Risk] mock fallback 容易被误读成真实历史记录。
  -> Mitigation：实现任务要求页面显式标识接口未接通 / 降级来源，PR 说明中列为未接通风险，不允许把 fallback 文案写成真实审计事实。
