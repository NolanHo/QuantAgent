# 04. 数据库与持久化设计

## 文档状态

**状态**：占位草案  
**范围**：数据库模型、持久化对象、迁移策略、审计数据  
**当前约定**：数据库使用 PostgreSQL + pgvector，ORM 使用 SQLAlchemy 2.x + Alembic

## 后续需要讨论的问题

1. Event 表是否采用单表加 JSONB，还是拆分原始事件、标准事件、状态流转表？
2. 插件 registry、插件配置、插件版本是否需要独立表？
3. 行业分析结果、ScoredAnalysis、DecisionResult 是否完整入库，还是只保存摘要？
4. 审计日志是否使用 append-only 表？
5. 插件配置中的敏感字段如何处理，是否需要加密或引用外部 secret？
6. pgvector 初版用于哪些对象：事件内容、分析摘要、行业知识、历史案例？
7. Alembic migration 目录放在 `apps/api` 还是 `packages/python/quantagent-core`？
8. 是否需要软删除、数据保留周期和归档策略？

## 暂不决策

- 具体表结构。
- 索引设计。
- 向量维度和 embedding 模型。
- 数据归档策略。
