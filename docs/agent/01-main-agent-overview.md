# 01. MainAgent 总览

## 背景

当前主链路已经按事件驱动分层：

```text
Source Plugin
  -> Event Bus
  -> Router / Intake
  -> Industry MainAgent
  -> Scoring / Debate
  -> Decision / Policy Gate
  -> Notification / Approval / Broker
```

这个表达容易让后续实现误以为 `Scoring / Debate` 和 `Decision` 必须是 MainAgent 之后的硬编码流水线节点。更合适的实现方式是：Router / Intake 之后进入行业 MainAgent，由 MainAgent 使用 DeepAgents 的 planning、task delegation 和 skills 编排后续动作；评分和辩论可以作为受控工具或后续 SubAgent，通知、审批、broker dry-run 和监控只通过 `submit_action_plan` 内部平台流程编排。

## 定位

行业 MainAgent 是行业分析运行的总控 Agent。它不是某个具体行业工具，也不是最终交易执行器。

它负责：

- 接收 Router / Intake 后的结构化事件和行业上下文。
- 规划本次行业分析需要哪些证据、SubAgent、工具和输出。
- 调用 Research SubAgent、证据工具、可选辩论工具、评分工具和行动计划工具。
- 收敛为统一 `IndustryAnalysis`。
- 在必要时生成可提交的 `ActionPlan`，包括订单草案、风险控制、监控建议和用户摘要草案。
- 保留审计友好的阶段摘要、工具调用摘要和失败路径。

它不负责：

- 直接启动 Source Plugin 或 scheduler。
- 直接读写数据库。
- 直接调用 provider SDK。
- 直接调用 broker 或表达真实执行完成。
- 绕过 ToolRegistry、Skill Registry、Decision / Policy Gate。
- 保存完整 chain-of-thought、完整 prompt、完整 provider raw response 或 secret-bearing context。

## 主链路重述

推荐把 MainAgent 之后的链路理解成“DeepAgents 受控工具化阶段”，而不是固定外部流水线：

```text
event.routed / industry.analysis.requested
  -> AgentRuntime
      -> create_deep_agent(industry main agent)
      -> write_todos(...)
      -> task(subagent=...)
      -> get_run_context(...)
      -> search_web(...)
      -> get_market_snapshot(...)?
      -> get_account_context(...)
      -> evaluate_thesis(...)
      -> build_action_plan(...)
      -> submit_action_plan(...)
  -> persisted AgentRun / IndustryAnalysis / downstream events
```

这样做的原因：

- 不同行业共享同一套编排框架，行业包只提供差异化资产。
- 评分、辩论和决策仍可审计、可授权、可超时、可降级。
- 行业包开发者不需要理解完整平台内部服务，只需要声明工具和 Prompt 资产。
- 后续可以逐步替换工具实现，而不改 MainAgent 的输出契约。
- 工具由 AgentRuntime 按 tool profile 注入；MainAgent 和 SubAgent 不必看到同一组工具。

## 设计原则

MainAgent 方案只围绕 QuantAgent 自身边界设计：

- 用 run-scoped context tools、artifact 和结构化输出传递阶段结果，而不是依赖长聊天历史或任意文件路径。
- 每个 SubAgent 只产出可校验的压缩报告。
- 辩论和评分都是受控步骤，不是自由文本结论。
- 最终输出必须符合 `IndustryAnalysis`，交易相关只能形成 `ActionPlan`。
- 规则层、审批、通知、监控和 broker 仍由 `submit_action_plan` 与 Policy Gate 统一控制。

## 第一版范围

第一版 MainAgent 不追求复杂自主 Agent。它应该是受限 DeepAgents PlannerExecutor：

- 单事件或单 routed item 触发。
- 用 `write_todos` 形成可审计任务清单，最多少量修订。
- 有最大工具调用数、最大 SubAgent 调用数和最大辩论轮次。
- 输出 `IndustryAnalysis` 为硬性成功条件。
- 交易相关只产出草案或请求，不产出真实执行结果。

## DeepAgents 内置工具边界

MVP 保留 DeepAgents 的 `write_todos` 和显式行业 SubAgent `task` 能力，但 AgentRuntime 默认不向模型暴露 `ls`、`glob`、`grep`、`read_file`、`write_file`、`edit_file` 或 `execute`。业务上下文只能通过 `get_run_context` 等平台工具读取，公开外部证据只能通过授权 source/search 工具读取。
