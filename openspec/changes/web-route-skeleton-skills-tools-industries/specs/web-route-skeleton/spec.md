# Spec: Web 一级路由骨架

## Requirement: 独立一级资源路由

Web 应用必须为 Skills、Tools、Industries 暴露独立一级路由。

### Scenario: Skills 路由通过应用壳渲染

Given 用户打开 `/skills`
When Web 应用 router 解析该路由
Then 页面必须在 `MainLayout` 内渲染
And 页面必须展示占位级 Skills 内容
And 侧边导航必须包含 Skills 入口
And 面包屑必须显示 `Skills`。

### Scenario: Tools 路由通过应用壳渲染

Given 用户打开 `/tools`
When Web 应用 router 解析该路由
Then 页面必须在 `MainLayout` 内渲染
And 页面必须展示占位级 Tool Registry 内容
And 侧边导航必须包含 Tools 入口
And 面包屑必须显示 `Tools`。

### Scenario: Industries 路由通过应用壳渲染

Given 用户打开 `/industries`
When Web 应用 router 解析该路由
Then 页面必须在 `MainLayout` 内渲染
And 页面必须展示占位级 Industries 内容
And 侧边导航必须包含 Industries 入口
And 面包屑必须显示 `Industries`。

## Requirement: 只做路由骨架

Web 应用必须把本 change 限制在路由骨架和导航入口范围内。

### Scenario: 路由页面不实现管理工作流

Given 用户打开 `/skills`、`/tools` 或 `/industries`
Then 页面不能暴露安装、启用、停用、市场浏览、授权或 mutation 工作流
And 页面不能依赖后端 API 数据
And 页面不能依赖 TanStack Query hooks、WebSocket 消息或 contracts 生成类型。

## Requirement: 保持资源边界独立

Skills、Tools、Industries 必须保持为独立路由资源。

### Scenario: 路由不能折叠成共享 tab 页面

Given 应用暴露 Skills、Tools、Industries
Then 每类资源都必须有自己的一级路由
And 实现不能把它们替换成一个共享路由或 tab 容器。
