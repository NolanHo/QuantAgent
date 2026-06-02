# Event Detail Feature

该目录负责 `/events/:eventId` 与 `/events/:eventId/audit` 的页面级能力收口。

当前阶段负责：

- 事件详情 / 决策页与事件级审计页的页面模型适配。
- 事件事实、行业影响分析、最佳动作、支持 / 反方观点、运行摘要与审计摘要的页面装配。
- 将现有评分演示契约映射为详情页可消费的稳定模型。
- `components/analysis/` 只放行业影响、最佳动作和证据质量这类展示面板，不放演示数据查找、route 参数或请求逻辑。

当前阶段不负责：

- 真实 API 请求、TanStack Query 或 generated client 接入。
- `/events` 事件中心列表与筛选页的实现。
- 审批变更、真实执行、权限放行或运行态详情页逻辑。

不要继续放入：

- 不要把 route 参数读取和页面主体 JSX 重新堆回 route 文件。
- 不要让视图组件直接依赖 `event-scoring.mock` 的原始字段结构。
- 不要把高分表达成已可执行结论；相关边界应保持中文注释。
