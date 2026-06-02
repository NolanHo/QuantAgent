# Event Center Feature

该目录负责 `/events` 高价值事件中心的 mock 页面收口。

当前阶段负责：

- 事件概览、今日重点事件、筛选 / 排序入口、全量事件列表和轻量系统提醒的页面装配。
- 将现有 `event-scoring` mock 映射为事件中心可消费的 page model。
- 稳定 `/events` -> `/events/:eventId` 的“查看分析”入口。

当前阶段不负责：

- 真实 Events API、TanStack Query、URL search params 写回或 generated client。
- `/events/:eventId` 事件详情 / 决策页，该能力在 `features/events/event-detail/`。
- 审批 mutation、真实执行、Runtime 深层排障或新闻全文阅读。

不要继续放入：

- 不要把 route 参数、真实请求或 query cache 放进展示组件。
- 不要把事件中心做成审批工作台或执行入口；这里只能进入分析页、审计页和 Runtime 提醒。
