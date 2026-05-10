# QuantAgent 文档中心

本文档目录用于沉淀 EventDrive-QuantAgent 的产品需求、模块说明、技术约束和后续设计文档。

## 文档索引

| 分类 | 文档 | 用途 |
| --- | --- | --- |
| PRD | [PRD 总索引](prd/README.md) | 查看产品需求文档的模块化入口 |
| PRD | [产品概览](prd/01-overview.md) | 了解产品定位、目标用户、核心愿景和范围边界 |
| PRD | [行业场景与插件包](prd/02-industry-scenarios.md) | 查看石油、半导体/内存等行业包的事件推理场景 |
| PRD | [功能模块](prd/03-functional-modules.md) | 查看 Router Agent、行业插件、决策与 HITL 的功能要求 |
| PRD | [技术架构](prd/04-technical-architecture.md) | 查看后端、前端、数据层、MCP 集成等技术规格 |
| PRD | [UX 与界面需求](prd/05-ux-requirements.md) | 查看核心界面、交互路径和状态展示要求 |
| PRD | [风控、约束与异常处理](prd/06-risk-constraints.md) | 查看幻觉校验、隐私保护、熔断等系统约束 |
| PRD | [验收标准与待确认项](prd/07-acceptance-open-questions.md) | 查看跨模块验收标准、风险缺口和关键待确认问题 |

## 维护约定

- 新增产品需求优先补充到 `docs/prd/` 对应模块，不再堆叠到单一 PRD 文件。
- 涉及跨模块变更时，同步更新 [PRD 总索引](prd/README.md) 的范围说明和依赖关系。
- 未确认的信息放入 [验收标准与待确认项](prd/07-acceptance-open-questions.md)，不要混入已确认需求。
