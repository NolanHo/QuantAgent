# Agent 方案索引

本目录用于沉淀 AgentRuntime 与行业 MainAgent 的方案草案，重点服务后续 OpenSpec、实现切片和行业包开发。这里不是最终稳定 spec；当方案收敛后，应同步回 `docs/design/05-agent-workflow-design.md`、`docs/design/07-industry-package-design.md` 或对应 OpenSpec change。

## 文档列表

| 文档 | 作用 |
| --- | --- |
| [01. MainAgent 总览](01-main-agent-overview.md) | 说明 MainAgent 在主链路中的定位、职责和非职责 |
| [02. PlannerExecutor 架构](02-planner-executor-architecture.md) | 定义围绕 DeepAgents 的 planning、task delegation、workspace、失败路径和审计边界 |
| [03. 行业包开发模型](03-industry-package-development-model.md) | 说明通用框架与行业包资产如何分层，降低行业包开发成本 |
| [04. 半导体 MainAgent 样例](04-semiconductor-main-agent.md) | 以半导体 / 内存行业包为例设计 Prompt、SubAgent、工具和输出 |
| [05. 工具与输出契约](05-tooling-and-output-contracts.md) | 收敛 MainAgent 可调用工具、结构化输出和 Policy Gate 边界 |
| [06. 通知与 HITL 流程](06-notification-and-hitl-flow.md) | 区分通知触达与人类授权，定义 MainAgent 如何请求决策、审批和通知 |
| [07. 英伟达财报事件链路样例](07-nvidia-earnings-flow-example.md) | 用 NVDA 第一手财报公告和后续媒体报道串起补充对照证据、行动提交、去重和通知抑制 |
| [08. Run 绑定的上下文工具机制](08-run-scoped-context-tools.md) | 定义工具如何绑定 AgentRun、如何返回 artifact、MainAgent 与 SubAgent 如何配置不同上下文工具 |
| [09. Agent 产物归属与协作边界](09-agent-artifact-ownership.md) | 定义 MainAgent、SubAgent 和工具分别产出什么，哪些 artifact 值得保存和传递 |

## 当前结论

- 行业 MainAgent 采用统一 DeepAgents PlannerExecutor 纪律。
- MainAgent 使用 DeepAgents 内置 planning、task delegation、skills 和 workspace 能力完成规划、调度、收敛输出；平台行动只通过 `submit_action_plan` 提交，通知、审批、Policy Gate、broker 和监控由它统一编排。
- MVP 只固定一个可选 Research SubAgent：专业检索交给 `evidence_research_analyst`；市场反应、产业链影响、风险挑战和交易计划草案先由 MainAgent、行业 skill、`evaluate_thesis` 和 `build_action_plan` 承接，后续按真实瓶颈再拆 SubAgent。
- 上下文获取工具按 Agent 角色配置；MVP 以 Tavily `search_web` 为轻量搜索工具，不把 `collect_evidence` 作为复杂万能工具。
- MainAgent 只产出 `IndustryAnalysis` 和可选 `ActionPlan`；`ActionRequest`、Approval、Notification、Broker 和 Monitor 是 `submit_action_plan` 内部平台对象。
- 行业包只声明 AgentDefinition、SubAgent、Skill、工具、market mapping、scoring hints 和 eval fixtures；通用 PlannerExecutor 框架放在共享 Agent package。

## 维护约定

- 文档主体使用中文；代码标识、schema 字段、工具 ID 和协议字段保留英文。
- 新增长期边界时，需要判断是否同步到 `docs/design/` 或创建 OpenSpec change。
- 不把 prompt-only 规则当作系统真源；关键行为必须有 schema、工具契约或策略边界承接。
