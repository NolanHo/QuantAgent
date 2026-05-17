# Change: Skills / Tools / Industries 一级路由骨架

## 背景

本 change 对应 GitHub issue #65，用来补齐当前前端应用壳和前端架构设计之间的一个小缺口。

当前 `apps/web` 已经具备 TanStack Router、`MainLayout`、侧边导航、面包屑，以及以下一级占位页面：

- `/events`
- `/runtime`
- `/approvals`
- `/plugins`
- `/settings`

前端架构设计 `docs/design/09-frontend-architecture-design.md` 也把 Skills、Tools、Industries 视为一级运行管理入口。但当前 route tree 和侧边导航里还没有这些入口。

## 目标

新增以下独立一级路由骨架：

- `/skills`
- `/tools`
- `/industries`

这些页面必须复用现有应用壳、侧边导航、面包屑和占位页面模式。

## 路由方案决策

Skills、Tools、Industries 使用独立一级路由。

本 change 不把它们合并成一个统一 registry 路由、tab 容器或 marketplace 页面。

## 非目标

本 change 不实现：

- Skill Registry 真实列表、详情页、启用、停用或授权状态。
- Tool Registry schema 展示、授权状态、启用、停用或插件来源关系。
- Industry package 安装、停用、SourceBinding、market mapping 或依赖状态。
- 市场浏览、插件安装、模块安装或模块管理工作流。
- API Client、TanStack Query hooks、WebSocket 或 contracts 生成类型。
- `/skills/:skillId`、`/tools/:toolId`、`/industries/:industryId` 等详情路由。
- 新视觉设计、新 UI 库或 layout 重构。

## 实现范围

实现范围只包含：

- `apps/web/src/routes` 下新增三个 route 文件。
- 更新 `MainLayout` 侧边导航。
- 更新 `MainLayout` 面包屑 label 映射。
- 由新增 route 文件触发的 TanStack Router route tree 更新。

## 验收摘要

- `/skills`、`/tools`、`/industries` 可以正常渲染。
- 侧边导航包含 Skills、Tools、Industries。
- 三个新路由的面包屑显示可读 label。
- 页面保持占位级别，不依赖后端数据。
- Web lint 和 build 通过。

## 参考

- GitHub issue: #65
- 前端架构设计：`docs/design/09-frontend-architecture-design.md`
