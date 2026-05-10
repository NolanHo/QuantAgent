# EventDrive-QuantAgent PRD 总索引

**版本**：v1.2.0  
**状态**：正式版整理稿  
**核心架构**：DeepAgents (LangGraph) + FastAPI + React  
**整理日期**：2026-05-10

## 产品摘要

EventDrive-QuantAgent 是一款面向专业交易者和研究员的事件驱动型量化智能系统。系统以 LLM 为推理核心，通过行业插件包监控外部事件，并使用二阶推理分析事件对特定行业、金融工具和交易策略的连锁影响。

系统设计遵循 Plug-and-Play Industry Packages 理念：每个行业包都应形成独立的感知、逻辑与执行闭环，并通过 MCP 与主 Agent 协作。

## 模块化文档

| 序号 | 模块 | 文档 | 核心内容 |
| --- | --- | --- | --- |
| 01 | 产品概览 | [01-overview.md](01-overview.md) | 产品定位、目标用户、核心愿景、范围边界 |
| 02 | 行业场景 | [02-industry-scenarios.md](02-industry-scenarios.md) | 石油行业插件、半导体/内存插件、二阶推理链路 |
| 03 | 功能模块 | [03-functional-modules.md](03-functional-modules.md) | Router Agent、行业插件、决策、人机领航 |
| 04 | 技术架构 | [04-technical-architecture.md](04-technical-architecture.md) | 后端、前端、数据层、MCP、存储与推理加速 |
| 05 | UX 需求 | [05-ux-requirements.md](05-ux-requirements.md) | 思维链视图、行业包管理看板、交易建议弹窗 |
| 06 | 风控约束 | [06-risk-constraints.md](06-risk-constraints.md) | 幻觉校验、隐私保护、噪音熔断、执行约束 |
| 07 | 验收与待确认 | [07-acceptance-open-questions.md](07-acceptance-open-questions.md) | 验收标准、测试重点、顶层风险、待确认问题 |

## 模块依赖

```text
外部事件源
  -> Router Agent 实体提取与行业路由
  -> Industry Package Watcher / Logical Graph / Strategy Adapter
  -> Internal Debate 与置信度评分
  -> HITL / 自动执行 / 仅通知
  -> UI 实时展示与用户反馈
```

## 已确认事实

- 目标用户是专业交易者和研究员。
- 系统关注事件驱动型量化分析，而不是通用新闻聚合。
- 核心差异化能力是二阶推理和行业插件包。
- 行业插件通过 MCP Server 形态暴露工具和资源。
- 决策输出需支持自动执行、人工确认、仅通知三种层级。
- 系统必须包含幻觉校验、隐私保护和噪音熔断机制。

## 关键假设

- v1.2.0 仍处于产品需求定义阶段，尚未在本文档中定义详细接口契约。
- “自动执行”能力仅适用于已明确具备交易 API 权限、合规可执行且风控允许的市场。
- CoT 展示需求应理解为面向用户的推理摘要和可解释链路，不应默认暴露完整模型内部原始推理。

## 阅读建议

- 产品/业务评审：先读 [产品概览](01-overview.md)、[行业场景](02-industry-scenarios.md)、[验收与待确认](07-acceptance-open-questions.md)。
- 技术方案评审：先读 [功能模块](03-functional-modules.md)、[技术架构](04-technical-architecture.md)、[风控约束](06-risk-constraints.md)。
- 设计/前端评审：先读 [UX 需求](05-ux-requirements.md)，再结合 [功能模块](03-functional-modules.md) 确认状态流。
