# Web 页面状态组件规格

## ADDED Requirements

### Requirement: 可复用页面级 Loading 状态

Web 应用 SHALL 提供可复用的页面级 loading 组件，用于表达整页或主内容区加载中状态。

#### Scenario: Loading 状态不依赖数据流即可渲染

- **WHEN** 某个 route 渲染 `PageLoading`
- **THEN** 组件展示 loading 文案，且不需要 API 数据、TanStack Query hooks 或全局状态
- **AND** loading 容器使用 `role="status"` 和 `aria-live="polite"`
- **AND** loading 容器暴露 `aria-busy="true"`
- **AND** 装饰性 loading 视觉元素对辅助技术隐藏

### Requirement: 可复用页面级 Empty 状态

Web 应用 SHALL 提供可复用的页面级 empty 组件，用于表达当前 route 没有可展示内容。

#### Scenario: Empty 状态不带 CTA 渲染

- **WHEN** 某个 route 使用标题和说明渲染 `PageEmpty`
- **THEN** 组件展示标题和说明
- **AND** 不渲染 action 区域

#### Scenario: Empty 状态带 CTA 渲染

- **WHEN** 某个 route 使用标题、说明和 CTA 渲染 `PageEmpty`
- **THEN** 组件展示标题、说明和 CTA action
- **AND** 组件不把 CTA 绑定到 Events 私有业务语义
- **AND** 组件保留调用方传入的 CTA 节点语义

### Requirement: Events 页面预览状态

Events route SHALL 提供受控的本地预览方式，用于展示页面级 loading 和 empty 状态。

#### Scenario: Loading 预览

- **WHEN** 开发者打开 `/events?state=loading`
- **THEN** Events 页面在主内容区渲染 `PageLoading`
- **AND** 不需要真实后端数据

#### Scenario: Empty 预览

- **WHEN** 开发者打开 `/events?state=empty`
- **THEN** Events 页面在主内容区渲染 `PageEmpty`
- **AND** 渲染出的 empty 状态包含一个非业务 CTA，用于验证 CTA 插槽
- **AND** 不需要真实后端数据

#### Scenario: 无效预览状态回退

- **WHEN** 开发者打开 `/events?state=unknown`
- **THEN** Events 页面渲染现有 Events placeholder overview
- **AND** route 不展示错误

#### Scenario: 默认 overview 保持不变

- **WHEN** 开发者打开 `/events`，且没有有效预览状态
- **THEN** Events 页面渲染现有 Events placeholder overview

#### Scenario: 其他页面保持占位行为

- **WHEN** 开发者打开 Runtime、Approvals、Plugins、Settings、Skills、Tools 或 Industries 页面
- **THEN** 这些页面保持现有占位行为

### Requirement: 页面状态响应式布局

页面级状态组件 SHALL 在支持的视口宽度下适配现有主内容区。

#### Scenario: 移动端状态布局不溢出

- **WHEN** 页面级 loading 或 empty 状态在窄视口下渲染
- **THEN** 状态块保持在主内容区内
- **AND** 标题、说明和 CTA 内容不重叠
- **AND** CTA 内容可以换行，而不是溢出
