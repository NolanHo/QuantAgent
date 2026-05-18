# Tasks: 页面级 Loading / Empty 状态组件

## 任务图

### 串行阻塞项

1. 确认当前 Events 页面、共享组件目录和页面样式模式。
   - 输入：`PlaceholderPanel`、Events route、`pages.css`、`apps/web/AGENTS.md`。
   - 输出：实现方式遵循当前页面结构、组件目录和 CSS token。
   - 写入边界：无。

2. 建立本 change 的 OpenSpec artifacts。
   - 输入：GitHub issue #52、当前计划。
   - 输出：proposal、tasks、spec requirement。
   - 写入边界：`openspec/changes/web-page-status-components/`。

3. 新增页面级状态组件。
   - 输入：当前共享组件模式。
   - 输出：`PageLoading` 和 `PageEmpty` 可被其他页面复用。
   - 写入边界：
     - `apps/web/src/app/components/PageLoading.tsx`
     - `apps/web/src/app/components/PageEmpty.tsx`

4. 补充页面级状态样式。
   - 输入：现有 `pages.css` 和 CSS token。
   - 输出：加载态、空态和可选 CTA 的布局样式。
   - 写入边界：`apps/web/src/styles/pages.css`。

5. 在 Events 页面接入受控预览。
   - 输入：`PageLoading` / `PageEmpty` API。
   - 输出：`/events?state=loading` 和 `/events?state=empty` 可稳定复现对应状态。
   - 写入边界：`apps/web/src/routes/events/index.tsx`。

6. 验证其他占位页面没有行为变化。
   - 输入：现有 Runtime、Approvals、Plugins、Settings、Skills、Tools、Industries routes。
   - 输出：这些页面继续使用原占位模式。
   - 写入边界：无。

7. 验证 Web 应用健康。
   - 输入：已完成的状态组件和 Events 接入。
   - 输出：lint / build 结果。
   - 写入边界：构建产物不提交。

### 可并行项

本 issue 默认串行实现，不委派子任务。原因是写集很小，且组件 API、样式 class 与 Events route 接入高度耦合；强行并行会增加集成成本。

### 审核点

- 本 spec 创建后、任何 `apps/web` 代码改动前，需要人工审核。
- 实现后如果查询参数预览影响 route 类型或生成文件，需要回看 `routeTree.gen.ts` 生成结果，但不手写维护业务逻辑。

## 清单

- [x] 确认当前 Events 页面、共享组件目录和页面样式模式。
- [x] 建立本 change 的 OpenSpec artifacts。
- [ ] 新增 `PageLoading` 组件。
- [ ] 新增 `PageEmpty` 组件。
- [ ] 补充页面级状态样式。
- [ ] 在 Events 页面接入受控预览。
- [ ] 确认 Runtime、Approvals、Plugins、Settings、Skills、Tools、Industries 页面行为不变。
- [ ] 在 `apps/web` 下运行 `bun run lint`。
- [ ] 在 `apps/web` 下运行 `bun run build`。
- [ ] 手动确认 `/events?state=loading`、`/events?state=empty`、`/events?state=unknown` 和 `/events` 的预览行为。

## 实现护栏

- 不接入真实 API、Query、WebSocket 或 contracts。
- 不新增全局状态管理或业务 mock 数据层。
- 不实现错误态、权限态、重试或真实 Event Inbox。
- 不替换所有 `PlaceholderPanel`。
- 不引入新的视觉体系或 UI 库。
