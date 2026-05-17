# Tasks: Skills / Tools / Industries 一级路由骨架

## 任务图

### 串行阻塞项

1. 确认当前 route 和 layout 模式。
   - 输入：现有 route 文件、`MainLayout`、`PlaceholderPanel`。
   - 输出：实现方式遵循当前页面结构和命名风格。
   - 写入边界：无。

2. 新增三个 route 占位页面。
   - 输入：当前占位页面模式。
   - 输出：`/skills`、`/tools`、`/industries` route 文件。
   - 写入边界：
     - `apps/web/src/routes/skills/index.tsx`
     - `apps/web/src/routes/tools/index.tsx`
     - `apps/web/src/routes/industries/index.tsx`

3. 更新导航和面包屑。
   - 输入：新增 route path。
   - 输出：侧边导航和 breadcrumb label 支持三个新入口。
   - 写入边界：`apps/web/src/app/layouts/MainLayout.tsx`。

4. 重新生成或验证 TanStack route tree。
   - 输入：新增 route 文件。
   - 输出：`routeTree.gen.ts` 包含三个新路由。
   - 写入边界：如果本地工具生成变化，则写入 `apps/web/src/routeTree.gen.ts`。

5. 验证 Web 应用健康。
   - 输入：已完成的路由骨架。
   - 输出：lint / build 结果。
   - 写入边界：构建产物不提交。

### 可并行项

在确认当前页面模式后，三个新 route 文件可以并行实现，因为它们的写入文件互不重叠。

导航和面包屑更新必须串行处理，因为它们都修改 `MainLayout.tsx`。

### 审核点

- 本 spec 创建后、任何 `apps/web` 代码改动前，需要人工审核。
- 实现后如果 route tree 生成结果超出预期，需要再次回看变更。

## 清单

- [x] 确认当前 route 和 layout 模式。
- [x] 新增 `apps/web/src/routes/skills/index.tsx`。
- [x] 新增 `apps/web/src/routes/tools/index.tsx`。
- [x] 新增 `apps/web/src/routes/industries/index.tsx`。
- [x] 更新 `MainLayout` 侧边导航。
- [x] 更新 `MainLayout` 面包屑 label。
- [x] 验证 TanStack Router route tree 包含 `/skills`、`/tools`、`/industries`。
- [x] 在 `apps/web` 下运行 `bun run lint`。
- [x] 在 `apps/web` 下运行 `bun run build`。

## 实现护栏

- 新页面只能保持占位级别。
- 不新增 mock 业务数据。
- 不引入 API、Query、WebSocket、contracts 或 mutation 代码。
- 不把 Skills、Tools、Industries 合并成一个 tab 路由。
- 不实现安装、启用、停用、市场浏览或模块管理工作流。
