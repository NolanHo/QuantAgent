## mainflow feature

负责 QuantAgent V1 操盘主链路占位页面：

- `/`
- `/approvals`
- `/approvals/:approvalId`
- `/approval-link/:token`
- `/runtime`
- `/runtime/agents/:runId`
- `/runtime/tools/:invocationId`
- `/plugins`
- `/plugins/:pluginId`
- `/settings`

入口：

- route: `src/routes/_app/(workspace)/**` 与 `src/routes/(public)/approval-link/$token.tsx`
- page exports: `MainflowSections.tsx`

当前职责：

- `pages/`: 页面级占位内容和页面装配
- `components/`: 主链路复用展示组件
- `hooks/`: Dashboard 等主链路页面的轻量查询编排
- `types/`: Dashboard 局部展示模型，不替代后端 API contract
- `mock-data.ts`: 仅供尚未接真实接口的占位区域使用的静态结构化样例
- `utils/`: 纯展示格式化 helper

Dashboard 事件区边界：

- 首页重点事件通过 `features/events` 的真实 `/api/v1/events` read model 读取。
- `utils/dashboard-event-adapter.ts` 只把真实 `EventListItem` 映射为首页卡片展示模型；当前后端尚未提供正式 scoring read model，因此这里不会伪造 MainAgent 影响评分或交易建议。
- 后续正式事件评分 contract 接入时，应把评分 API / query / hook 收敛到 `features/event-scoring`，Dashboard 只消费稳定展示模型。

事件页面边界：

- `/events` 已迁移到 `src/features/events/event-center/`
- `/events/:eventId` 与 `/events/:eventId/audit` 已迁移到 `src/features/events/event-detail/`
- `mainflow` 保留 Dashboard、Approvals、Runtime、Plugins、Settings 等其他主链路占位页面

不负责：

- `/models` 的真实治理实现
- debug 工作台页面状态预览
- 共享 API、query、mutation 和运行时 client

不要继续放入：

- 不要在 route 文件里直接堆页面主体 JSX
- 不要把插件治理、模型治理以外的新正式页面继续平铺到别的临时目录
- 不要把调试态页面或 query 参数实验混入这里
