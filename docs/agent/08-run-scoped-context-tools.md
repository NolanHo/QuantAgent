# 08. Run 绑定的上下文工具机制

## 核心结论

一次事件会绑定一次 `AgentRun`。工具不应该要求模型手动输入 `agent_run_id`、`event_id`、`industry_id`、`/input/event.json` 或任意文件路径。AgentRuntime 在注入工具时应自动绑定运行上下文，工具实现从 runtime 读取这些隐藏字段。

模型只需要表达业务问题：

```text
search_web(query="NVIDIA revenue consensus current quarter guidance")
get_market_snapshot(symbols=["NVDA"], fields=["after_hours", "volume"])
get_account_context(symbols=["NVDA"], include_recent_activity=true)
```

而不是：

```text
collect_evidence(event_ref="/input/event.json", industry_id="semiconductor", ...)
```

## 为什么不把所有信息传递都做成文件

DeepAgents workspace 适合存放中间产物，例如 evidence board、subagent report、draft analysis。它不适合成为所有业务工具的参数协议。

推荐规则：

| 内容 | 传递方式 |
| --- | --- |
| 当前事件、路由上下文、行业 profile、tool profile | `get_run_context` 从 run 绑定上下文读取 |
| Tavily 搜索结果 | `search_web` 直接返回；结果大时自动保存为 artifact |
| 行情快照 | `get_market_snapshot` 直接返回；bars 较大时保存为 artifact |
| 账户、仓位、近期动作、通知 | `get_account_context` 直接返回压缩摘要 |
| SubAgent 报告、EvidenceBoard、IndustryAnalysis | Agent 产物，可写入 workspace 或 run artifact |
| 审批、通知、broker 请求 | 只通过 `submit_action_plan` 进入平台状态机 |

这样能减少模型手写路径和 ref 的错误，同时保留 DeepAgents workspace 对复杂推理的帮助。

## Run Artifact

建议平台提供轻量 artifact 机制，作为 DeepAgents workspace 和业务数据库之间的桥。

```text
RunArtifact
  artifact_id
  agent_run_id
  event_id
  kind                    # search_result | market_snapshot | evidence_board | subagent_report | action_plan | industry_analysis
  producer                # tool:<id> | agent:<id> | subagent:<id>
  summary
  payload
  created_at
  safe_audit_summary
```

原则：

- 工具可以自动写 artifact，但不让 Agent 指定任意落盘路径。
- Agent 可以用 `artifact_id` 引用大结果。
- 小结果优先直接返回，避免把简单对话强行文件化。
- artifact 是 run 内产物，不等于长期业务真源；需要长期保存的最终结果由 AgentRuntime 持久化。

## ID-first 工具传递

工具之间传递上下文时，默认传 ID，不复制大 JSON。

推荐模式：

```text
search_web -> SearchWebOutput(artifact_id="artifact_search_001")
MainAgent -> EvidenceBoard(artifact_id="artifact_evidence_001")
evaluate_thesis(evidence_board_artifact_id="artifact_evidence_001")
evaluate_thesis -> ThesisEvaluation(artifact_id="artifact_eval_001")
build_action_plan(thesis_evaluation_artifact_id="artifact_eval_001", account_context_id="context_account_001")
build_action_plan -> ActionPlan(artifact_id="artifact_plan_001")
submit_action_plan(action_plan_artifact_id="artifact_plan_001")
```

只有以下情况才直接传对象：

- 对象很小，复制成本低。
- 对象是一次性草稿，还没有保存为 artifact。
- 工具需要模型即时编辑后的草稿，而 runtime 还没有持久化入口。

工具实现应优先解析 `*_id` / `*_artifact_id`，再解析直接对象。这样可以节省 token、加快调用、减少模型复制字段错误，并确保工具读取的是当前 run 中被审计过的产物。

## 工具调用运行时

工具调用由 AgentRuntime 包装：

```text
DeepAgent tool call
  -> DeepAgentsToolAdapter
  -> ToolRegistry permission check
  -> inject ToolRuntimeContext
  -> execute plugin/core tool
  -> normalize output
  -> optional artifact save
  -> append audit record
  -> return compact result to Agent
```

`ToolRuntimeContext` 至少包含：

```text
agent_run_id
event_id
industry_id
agent_id
subagent_id?
account_scope?
tool_profile_id
permission_scope
budget
trace_id
```

这些字段不进入工具 input schema，但进入权限、限流、审计、缓存和 artifact 归属。

## 多次检索

Agent 不应被限制为一次检索。合理流程通常是多次窄查询：

1. 查第一手来源或原文。
2. 查对照材料，例如市场共识、历史区间、政策原文或同业指标。
3. 查冲突观点或风险因素。
4. 查后续报道是否只是重复同一事件。

限制不应该写死在工具 schema，而应由 runtime budget 控制：

```text
ToolBudget
  max_tool_calls: 12
  max_search_calls: 5
  max_market_calls: 3
  max_account_context_calls: 2
  max_total_wall_time: "90s"
```

超出预算时，工具返回结构化失败，MainAgent 写入 degraded analysis。

## 不同 Agent 的工具配置

工具 profile 应按 Agent 角色配置，不要把所有工具都塞给 MainAgent。

MVP 只需要 MainAgent 和一个 Research SubAgent profile：

```yaml
tool_profiles:
  main_agent:
    tools:
      - quantagent.core.tool.get_run_context
      - quantagent.official.source.tavily.search_web
      - quantagent.core.tool.get_account_context
      - quantagent.core.tool.evaluate_thesis
      - quantagent.core.tool.build_action_plan
      - quantagent.core.tool.submit_action_plan
    budgets:
      max_search_calls: 4

  research_subagent:
    tools:
      - quantagent.core.tool.get_run_context
      - quantagent.official.source.tavily.search_web
    budgets:
      max_search_calls: 5
```

后续接入稳定行情源、并且市场反应分析反复成为瓶颈时，再新增 Market / Risk profile：

```yaml
tool_profiles:
  market_risk_subagent:
    enabled_after_mvp: true

    tools:
      - quantagent.core.tool.get_run_context
      - quantagent.official.source.tavily.search_web
      - quantagent.core.tool.get_market_snapshot
    budgets:
      max_search_calls: 3
      max_market_calls: 3
```

规则：

- MainAgent 负责规划和收敛，不一定拥有最多细工具。
- SubAgent 可以拥有更细的领域工具，但只能返回压缩报告或 artifact。
- 账户、策略和审批相关上下文默认只给 MainAgent。
- broker、通知、审批和监控底层工具不直接给任何 Agent，由 `submit_action_plan` 内部编排。

## Tavily MVP

MVP 只有 Tavily 搜索插件时，建议只暴露一个搜索工具：

```text
quantagent.official.source.tavily.search_web
```

不建议同时提供多个语义相近的搜索包装：

- `search_news`
- `search_consensus`
- `search_company`
- `collect_evidence`

这些语义可以由 query、topic 和 Agent 指令表达。等真实需求出现后，再把高频能力沉淀成更专用的工具或 Skill。

## 与 DeepAgents 的关系

DeepAgents 的 `write_todos`、`task`、workspace 和 skills 仍然是编排核心：

- `write_todos` 规划多次检索、SubAgent 调用和停止条件。
- `task` 把搜索、行情或行业映射任务交给专门 SubAgent。
- workspace 保存 Agent 自己整理出的 evidence board 和报告。
- skills 告诉 Agent 如何判断证据质量、行业影响链和风险。

平台工具负责外部世界访问和动作边界；DeepAgents workspace 负责 Agent 内部协作材料。两者不要混成一个“大 State”。
