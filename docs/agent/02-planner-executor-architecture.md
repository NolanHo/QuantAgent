# 02. PlannerExecutor 架构

## 核心思路

本方案不自建 LangGraph 式状态机。行业 MainAgent 应围绕 DeepAgents 的现成能力实现 PlannerExecutor 纪律：

- `write_todos`：MainAgent 用 DeepAgents 内置 TodoListMiddleware 规划和更新任务。
- `task`：MainAgent 用 DeepAgents SubAgentMiddleware 调用行业 SubAgent。
- workspace / artifact：MainAgent 和 SubAgent 通过受控 backend 或 run artifact 传递中间产物。
- skills：行业知识通过 DeepAgents SkillsMiddleware 按需加载。
- tools：外部能力通过 ToolRegistry 包装后注入 Deep Agent。
- checkpointer / store：只承接运行恢复、interrupt 和可选记忆，不替代业务数据库真源。

因此这里的 PlannerExecutor 不是我们另写一套 executor loop，而是对 DeepAgents harness 的使用纪律和平台边界约束。

## DeepAgents 映射

| 方案概念 | DeepAgents 能力 | QuantAgent 约束 |
| --- | --- | --- |
| Planner | `write_todos` + MainAgent instructions | todo 必须反映分析阶段、工具预算和停止条件 |
| Executor | DeepAgents tool loop | 工具必须来自 ToolRegistry wrapper |
| SubAgent | `task` tool | SubAgent 是无状态调用，单次 instruction 必须完整 |
| 工作区 / artifact | FilesystemMiddleware backend + run artifact | 存放 bounded context、证据、报告和最终输出；业务工具不要求模型手填任意路径 |
| Skill | SkillsMiddleware | 行业包 Skill 必须注册、授权、按需加载 |
| HITL | HumanInTheLoopMiddleware / 平台 Approval | 高风险工具必须 interrupt 或进入 Approval / Policy Gate |
| 记忆 | StoreBackend / MemoryMiddleware | 第一版只做可选，不作为决策真源 |

## Run Workspace

不要把主运行上下文设计成一个庞大 `IndustryRunState`。建议把一次 MainAgent 运行表达为受控 workspace：

```text
/input/
  event.json                 # Router / Intake 后的 bounded event snapshot
  route_context.json
  source_article.json?
/context/
  industry_profile.md
  market_mapping.json
  risk_policy.json
  tool_allowlist.json
/todos/
  current.json               # write_todos 的镜像摘要，供审计或调试读取
/evidence/
  evidence_board.json
  gaps.json
  conflicts.json
/reports/
  evidence_research_report.json
  extension_reports/           # 后续专家 SubAgent 报告，MVP 可为空
  score_summary.json?
/output/
  industry_analysis.json
  action_plan.json?
  submission_result.json?
/audit/
  run_manifest.json
  tool_invocations.jsonl
```

workspace 文件是 Agent 内部协作材料，不等于数据库真源。工具返回的大结果可以由 runtime 自动保存为 run artifact，并返回 `artifact_id`。真正的业务状态仍以 REST、数据库、审计记录和 Event Bus 为准。

## Backend 选择

第一版建议：

- 服务端运行默认使用 DeepAgents 的 ephemeral backend 或平台提供的 sandbox backend。
- 本地开发可以使用 virtual filesystem backend 观察文件，但不能把生产工作区直接暴露给真实磁盘。
- 持久记忆后置；如需要，只允许把经过脱敏和压缩的经验写入 `/memories/`。
- 不把完整 prompt、完整 provider raw response、secret 或 chain-of-thought 写入 backend。

## Planning 纪律

MainAgent 的第一步必须用 `write_todos` 建立计划。计划不需要单独发明复杂 schema，但至少应覆盖：

- 事件相关性确认。
- 证据收集。
- 是否需要调用 Research SubAgent。
- 是否需要评分。
- 是否生成交易计划草案。
- 是否请求 Decision、监控、通知或审批。
- 停止条件和降级策略。

第一版建议默认限制：

```text
max_todo_revisions = 2
max_tool_calls = 12
max_subagent_tasks = 1
max_provider_calls = 8
```

这些限制应进入 AgentRuntime policy，而不是只写在 prompt 里。

## SubAgent 调用纪律

DeepAgents 的 custom subagent 调用是无状态的。MainAgent 每次调用 `task` 时，必须给出完整 instruction：

- 本次事件摘要。
- 需要读取哪些 run context section、workspace 文件或 artifact。
- 允许使用哪些工具。
- 输出方式：直接返回 `SubAgentReport`，或写入 workspace / artifact。
- 输出 schema。
- 必须包含哪些风险或不确定性字段。

不要这样设计：

```text
task(evidence_research_analyst, "先搜一下")
task(evidence_research_analyst, "你刚才发现了什么")
```

应该这样设计：

```text
task(
  evidence_research_analyst,
  "读取当前 run 的 event 和 route_context，围绕一手来源、对照材料、冲突证据做最多 5 次 search_web，
   输出 EvidenceResearchReport 和 EvidenceBoard artifact_id，禁止读取账户或生成交易计划。"
)
```

custom subagent 不默认继承 MainAgent skills。行业包声明 SubAgent 时必须显式声明所需 skills 和工具。

## 工具执行纪律

DeepAgents 可以接收工具，但工具治理不能交给 Agent 自己。

AgentRuntime 注入工具前必须完成：

- ToolRegistry 查询。
- tool allowlist 解析。
- run context 绑定：`agent_run_id`、`event_id`、`industry_id`、`agent_id`、`subagent_id?`。
- input / output schema 绑定。
- risk level 和 interrupt policy 绑定。
- timeout、重试和限流策略绑定。
- 审计 metadata 注入。

MainAgent 和 SubAgent 只能看到各自 tool profile 授权后的工具。高风险工具必须要求 human approval、Decision / Policy Gate 或 dry-run/mock 边界。

## 失败路径

| 失败 | 处理 |
| --- | --- |
| 输入事件缺少关键字段 | 写入 `/output/industry_analysis.json`，状态为 `review` 或 `failed`，不进入交易计划 |
| 证据工具失败 | 写入 `/evidence/gaps.json`，允许 degraded analysis |
| SubAgent 输出 schema 无效 | 允许一次修复任务；仍失败则记录该角色不可用 |
| Debate 失败 | 不阻塞 `IndustryAnalysis`，但降低 confidence |
| Scoring 失败 | 输出未评分分析，交给 Decision 或人工复核 |
| Decision request 失败 | 禁止 broker 请求，记录 runtime failure |
| Broker dry-run 工具不可用 | 只保留 trade plan draft，不表达执行完成 |

## 审计与持久化

MainAgent 每次运行至少应记录：

- `agent_run_id`
- `industry_plugin_id`
- `main_agent_definition_id`
- `provider_policy`
- todo 摘要
- workspace 输出文件摘要
- 每个 tool invocation 的状态、耗时、工具 ID 和安全输入输出摘要
- 每个 `task` subagent 的状态、耗时、subagent ID 和报告路径
- 最终 `IndustryAnalysis`
- 降级原因和未验证风险

不默认记录：

- 完整 prompt。
- 完整 provider raw response。
- chain-of-thought。
- secret、私有策略、完整敏感上下文。
