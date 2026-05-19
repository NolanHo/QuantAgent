# Change: 页面级 Loading / Empty 状态组件

## 背景

本 change 对应 GitHub issue #52。

当前 `apps/web` 已完成应用壳、一级路由、`MainLayout` 和占位页面。Events、Runtime、Approvals、Plugins、Settings、Skills、Tools、Industries 仍主要通过 `PlaceholderPanel` 表达页面内容。后续页面接入 API Client、TanStack Query、列表和详情入口前，需要先把页面级 loading 和 empty 状态收敛成共享组件，避免各 route 分散实现加载态、空态文案和 CTA。

## 目标

- 新增页面级 `PageLoading` 组件，用于表达整页或主要内容区加载中。
- 新增页面级 `PageEmpty` 组件，用于表达当前页面没有可展示内容。
- `PageEmpty` 支持标题、说明和可选 CTA。
- 在 Events 页面接入 `PageLoading` / `PageEmpty`，验证组件 API 和页面布局可用。
- 使用查询参数提供受控本地预览：`/events?state=loading` 和 `/events?state=empty`。
- Events empty 预览首版提供一个非业务 CTA，用于验证 `PageEmpty` 的 CTA 插槽；无 CTA 用法通过组件 API 与实现检查确认。
- 保持现有页面视觉方向和 CSS token，不做设计重绘。

## 非目标

本 change 不实现：

- 真实 API、API Client、TanStack Query hooks、WebSocket 或 contracts 生成类型。
- 错误态、权限态、审批失败态、网络失败态或重试交互。
- 表格、列表、筛选、分页或真实 Event Inbox。
- 所有页面迁移到新组件。
- 替换 `PlaceholderPanel` 的所有用途。
- 新的全局状态管理、请求封装或 UI 库。
- Playwright、Vitest 或 React Testing Library 测试基础设施。

## 实现范围

实现范围只包含：

- `apps/web/src/app/components/` 下新增 `PageLoading` 和 `PageEmpty`。
- `apps/web/src/styles/pages.css` 中补充状态组件样式。
- `apps/web/src/routes/events/index.tsx` 使用查询参数接入 loading / empty 预览。

## 验收摘要

- Events 页面可以稳定展示 `PageLoading` 状态。
- Events 页面可以稳定展示 `PageEmpty` 状态。
- `PageLoading` 和 `PageEmpty` 不依赖真实后端数据。
- `PageEmpty` 支持无 CTA 和有 CTA 两种使用方式。
- 无效 `state` 查询参数回退到 Events 当前占位概览，不报错。
- 新组件不绑定 Events 私有业务语义，可以被其他页面复用。
- `bun run lint` 和 `bun run build` 在 `apps/web` 下通过。

## 参考

- GitHub issue: #52
