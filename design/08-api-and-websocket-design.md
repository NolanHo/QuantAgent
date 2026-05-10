# 08. API 与 WebSocket 设计

## 文档状态

**状态**：占位草案  
**范围**：FastAPI REST API、WebSocket 事件流、前后端契约  
**当前约定**：后端使用 FastAPI，前端通过 contracts 生成类型和 client

## 后续需要讨论的问题

1. API 是否按资源划分：events、plugins、approvals、notifications、runtime？
2. WebSocket 事件流是否按 topic 推送？
3. 前端是否需要断线重连后的状态恢复接口？
4. OpenAPI 生成的 client 放在 `packages/contracts/generated/typescript` 吗？
5. 插件配置表单需要哪些 API？
6. Human Approval 的确认、拒绝、重分析 API 如何定义？
7. API 鉴权初版是否需要做？
8. 错误响应是否统一结构？

## 暂不决策

- 具体 endpoint。
- 认证方案。
- WebSocket 消息格式。
- API 分页和过滤规范。
