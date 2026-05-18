# Design: 页面级 Loading / Empty 状态组件

## 背景

issue #52 将前端真实数据接入前的 UI 基础能力收敛为一个小范围切片：页面级 loading 与 empty 状态表达。

当前 `apps/web` 已具备 React + Vite、TanStack Router、`MainLayout`、侧边导航、面包屑和多个一级占位页面。Events 页面仍通过 `PlaceholderPanel` 展示三个静态分区。后续接入 API Client、TanStack Query、列表、筛选和详情入口时，如果各 route 各自手写 loading / empty 状态，会导致布局、文案层级、CTA 位置和可访问语义分叉。

本设计只固定页面级状态组件和 Events 首个验证点，不引入真实数据流，也不扩展测试基础设施。

相关当前基线：

- `apps/web/src/app/components/PlaceholderPanel.tsx`：当前占位面板组件。
- `apps/web/src/routes/events/index.tsx`：本 change 的首个接入页面。
- `apps/web/src/styles/pages.css`：页面标题、占位网格和错误页面样式所在文件。
- `apps/web/AGENTS.md`：要求可复用 UI 先检查 `src/app/` 与 `src/shared/` 边界，路由页面放在 `src/routes/`。

## 目标

- 固定 `PageLoading` 和 `PageEmpty` 两个页面级共享组件。
- 让 `PageLoading` 表达整页或主内容区加载中，并具备基本可访问 loading 语义。
- 让 `PageEmpty` 表达空内容状态，支持标题、说明和可选 CTA。
- 在 Events 页面通过查询参数稳定预览 loading 和 empty 状态。
- 保持现有管理台视觉方向、CSS token 和页面布局节奏。

## 非目标

- 不接入 API Client、TanStack Query hooks、WebSocket、contracts 或真实后端数据。
- 不实现 error、forbidden、retry、审批失败、网络失败或权限态。
- 不实现真实 Event Inbox、表格、筛选、分页或详情入口。
- 不迁移所有页面，也不替换 `PlaceholderPanel` 的全部用途。
- 不新增全局状态管理、请求封装、mock 数据层或 UI 库。
- 不新增 Playwright、Vitest 或 React Testing Library 基础设施。

## 规范分层与决策状态

### 规范分层

本 change 的规范分层固定如下：

- `specs/web-page-status-components/spec.md` 定义必须满足的外部行为与验收场景。
- `proposal.md` 定义当前 phase 的范围、非目标和验收意图。
- `design.md` 解释本 phase 已做出的实现决策、边界、失败路径和禁止路径。
- `tasks.md` 定义执行顺序、并行关系和写入边界。

以下内容是派生证据，不是本 change 的契约真源：

- Events 页面中的具体预览文案。
- CSS class 的内部命名。
- 本地手动打开页面时的视觉截图。

### 本阶段已定

- 组件名称固定为 `PageLoading` 和 `PageEmpty`。
- 组件位置固定为 `apps/web/src/app/components/`。
- 样式补充位置固定为 `apps/web/src/styles/pages.css`。
- Events 页面预览方式固定为查询参数：`/events?state=loading` 与 `/events?state=empty`。
- `PageEmpty` 必须支持无 CTA 和有 CTA 两种使用方式。
- 查询参数预览在所有环境可用，但只表达本地可复现的 UI 预览状态，不代表业务状态真源。
- Events empty 预览首版传入一个非业务 CTA，用于验证 CTA 插槽；无 CTA 路径通过组件 API 和实现检查验证。

### 待定但不阻塞实现

- `PageLoading` 的默认文案可以是通用文案；Events 页面可传入页面语境文案。
- CTA 的具体 React 节点由调用方传入；本组件只负责布局，不负责业务跳转语义。
- 后续是否拆出 `PageError`、`PageForbidden` 或局部 skeleton，由后续 issue 决定。

## 关键决策

### 页面级状态组件放在 `src/app/components`

`PageLoading` 和 `PageEmpty` 是应用级 UI 基础组件，既不属于某个 route，也不是 API、配置或领域共享逻辑。因此放在 `apps/web/src/app/components/`，与现有 `PlaceholderPanel` 保持同一层级。

影响：后续 Runtime、Approvals、Plugins 等页面可以直接复用，不需要从 Events route 反向引用。

### `PageLoading` 只表达页面主区域加载

`PageLoading` 只覆盖整页或主内容区加载中状态。它不提供表格行 skeleton、按钮 pending、卡片局部 skeleton 或 Query 状态适配器。

影响：组件 API 保持小而稳定，不提前绑定未来列表、表格或数据获取框架。

### `PageEmpty` 接收 CTA 节点但不拥有业务动作

`PageEmpty` 的公开输入是标题、说明和可选 CTA。CTA 由调用方传入 React 节点，组件只提供位置和视觉容器，不决定按钮文案、跳转地址、权限判断或 mutation 行为。

影响：组件可以覆盖无 CTA 和有 CTA 两种页面空态，同时避免绑定 Events 私有业务。

### Events 预览使用查询参数

本地预览采用查询参数而不是源码常量、页面内隐藏控件或全局状态：

- `/events?state=loading` 展示 loading。
- `/events?state=empty` 展示 empty。
- 无有效 `state` 时保持当前 Events 占位概览。

影响：开发者可以稳定复现状态；预览逻辑只留在 Events route 内，不扩散到业务 JSX 或全局 store。

### 保持现有视觉体系

状态组件样式复用 `pages.css` 和已有 `--qa-*` token。布局应延续当前后台管理台的克制风格：清晰、可扫描、不过度装饰。

禁止路径：

- 为状态组件引入新 UI 库或新的视觉 token。
- 把空态做成营销落地页式说明。
- 用该 change 重绘 Events 页面或替换所有占位页面。

## 契约边界

### Component API 边界

`PageLoading` 的最小契约：

- 可渲染页面级 loading 状态。
- 支持默认文案与调用方传入文案。
- loading 容器使用 `role="status"` 和 `aria-live="polite"`。
- loading 容器在加载状态下暴露 `aria-busy="true"`。
- 装饰性 loading 标识使用 `aria-hidden="true"`。

`PageEmpty` 的最小契约：

- 必须接收 `title` 和 `description`。
- 可选接收 `cta?: ReactNode`。
- 未传 CTA 时不渲染 action 区域。
- 组件只负责 CTA action 区域布局，不改写调用方传入节点的语义。
- 不依赖 Events 文案、Events URL 或后端数据。

### Route 边界

Events route 只负责将查询参数映射到预览状态：

- `state=loading` -> `PageLoading`
- `state=empty` -> `PageEmpty`
- 其他值或缺省 -> 现有 placeholder overview

该 route 不创建 API 请求、Query hook、mock 数据服务、全局状态或持久化状态。查询参数预览可以在 production build 中被访问，但它只影响当前页面渲染分支，不写入业务状态，也不宣称真实数据状态。

### Style 边界

样式只补充页面状态块、loading 标识、empty 标识和 CTA 容器所需 class。响应式行为应跟随当前页面内容区，不新增 layout shell 规则。移动端下状态块不得溢出主内容区，标题、说明和 CTA 不得重叠，CTA 需要允许换行。

## 数据流与控制流

预览控制流：

```text
developer opens /events?state=loading|empty
  -> TanStack Router renders Events route
  -> Events route validates local search state
  -> route chooses PageLoading, PageEmpty, or existing placeholder overview
  -> component renders using static props and CSS token styles
```

组件渲染流：

```text
route
  -> PageLoading({ message? })
  -> accessible loading section
```

```text
route
  -> PageEmpty({ title, description, cta? })
  -> empty section
  -> optional action area only when cta exists
```

本 change 没有服务端数据流、缓存更新、重试、mutation 或跨页面状态同步。

## 同步模型、失败路径与可观测性

### 同步模型

本 change 全部是同步渲染逻辑。查询参数决定预览分支，组件仅根据 props 渲染。

### 失败路径

本阶段只设计以下失败路径：

- 未知查询参数值不报错，回退到现有 Events overview。
- 未传 CTA 时 `PageEmpty` 不渲染空 action 容器。
- 缺少真实后端或 Query provider 状态时，loading / empty 预览仍可渲染。

禁止的失败处理方式：

- 为了预览 loading 而增加定时器、fake request 或全局 store。
- 在组件里吞掉业务错误并展示 empty。
- 把 empty 当成 error / forbidden / retry 的替代状态。

### 可观测性边界

本 change 不新增日志、埋点、审计或监控。状态组件是展示层基础能力，不表达业务状态真源。

## 备选方案

### 继续在每个 route 手写状态

不采用。该方案短期文件更少，但后续接入真实数据时会快速分叉，违背 issue #52 的主要目标。

### 只增强 `PlaceholderPanel`

不采用。`PlaceholderPanel` 表达占位内容分区，不适合同时承载页面级 loading 和 empty 语义。直接扩展会模糊占位面板与页面状态的职责。

### 使用页面内开发控件切换状态

不采用。页面内控件会增加不属于本 issue 的交互表面，也容易让预览入口与真实业务 UI 混在一起。

### 使用源码常量切换状态

不采用。源码常量简单，但每次预览都需要改代码，不利于开发者稳定复现。

## 风险与缓解

- 风险：`PageEmpty` 被写成 Events 专用组件。
  缓解：组件 API 只接受通用标题、说明和 CTA；Events 文案只留在 route 调用处。

- 风险：loading 预览演变成 fake data flow。
  缓解：查询参数只做渲染分支，不发请求、不建 Query hook、不新增 mock 数据层。

- 风险：状态样式打破现有页面视觉。
  缓解：只复用 `pages.css` 和已有 CSS token，保持管理台密度与当前 card/placeholder 风格一致。

- 风险：未来局部 skeleton 需求误用页面级组件。
  缓解：design 明确 `PageLoading` 只处理页面或主内容区加载，局部 loading 后续单独设计。

## 迁移与发布

不需要数据迁移或部署配置变更。

实现应作为一个小型 Web change 交付：

1. 增加 `PageLoading` 和 `PageEmpty`。
2. 增加状态组件样式。
3. 在 Events 页面接入查询参数预览。
4. 验证其他占位页面行为不变。
5. 运行 `bun run lint` 与 `bun run build`。如果本地依赖缺失导致 build 无法启动，需要在最终说明中记录具体缺失依赖或环境原因。

## Harness 策略

主要验证：

- `cd apps/web && bun run lint`
- `cd apps/web && bun run build`

手动验证：

- 打开 `/events?state=loading`，确认展示页面级 loading。
- 打开 `/events?state=empty`，确认展示页面级 empty，并显示用于验证 CTA 插槽的非业务 CTA。
- 打开 `/events`，确认仍展示原 placeholder overview。
- 打开 `/events?state=unknown`，确认回退到原 placeholder overview。
- 打开 Runtime、Approvals、Plugins、Settings、Skills、Tools、Industries，确认仍保持原占位行为。

验证不应要求真实 API、PostgreSQL、WebSocket、Playwright、Vitest、生产部署或外部网络。

## 决策待办

以下问题留给后续 issue：

- 真实 Event Inbox 接入后，empty 状态如何与 Query cache、筛选条件和分页状态组合。
- error / forbidden / retry 等页面级状态是否独立抽象。
- 表格行、卡片和按钮级 loading skeleton 如何设计。
- 是否为状态组件补充 component test 或 visual regression。
