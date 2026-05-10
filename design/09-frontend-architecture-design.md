# 09. 前端架构设计

## 文档状态

**状态**：占位草案  
**范围**：React Vite 前端目录、状态管理、插件配置表单、事件流 UI  
**当前约定**：前端使用 React + Vite + bun

## 后续需要讨论的问题

1. 前端目录使用 feature-based 还是 route-based？
2. 状态管理使用 TanStack Query、Zustand，还是 React 内置状态为主？
3. WebSocket 事件流如何与本地状态合并？
4. 插件配置表单如何从 JSON Schema 渲染？
5. 是否需要 shadcn/ui 或自定义组件体系？
6. 思维链视图如何展示，是否需要 graph/canvas？
7. Human Approval 交互如何保证安全确认？
8. 前端是否需要权限角色系统？

## 暂不决策

- UI 视觉细节。
- 具体组件库。
- 页面路由结构。
- 状态管理库。
