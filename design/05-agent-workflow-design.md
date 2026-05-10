# 05. Agent Workflow 设计

## 文档状态

**状态**：占位草案  
**范围**：DeepAgents 工作流、Router Agent、行业 Agent、Debate、Scoring  
**当前约定**：Agent / Workflow 框架使用 DeepAgents

## 后续需要讨论的问题

1. Router Agent 的输入输出结构是否需要严格 schema 化？
2. 行业 Agent 是由行业包自带，还是由核心系统统一提供模板？
3. Debate 是所有行业包统一流程，还是行业包可自定义？
4. Scoring 置信度使用 0-100 还是 0-1？
5. Agent 的 prompt 存放在 `packages/prompts` 还是插件内部？
6. Agent 工作流状态是否需要入库？
7. 失败重试、超时、中断和人工介入如何设计？
8. 是否需要评估集和回归测试来验证 Agent 输出稳定性？

## 暂不决策

- 具体 DeepAgents graph。
- prompt 内容。
- scoring 公式。
- 模型供应商和模型版本。
