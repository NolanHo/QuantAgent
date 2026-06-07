# 03. 行业包开发模型

## 目标

行业包应尽可能轻量。开发者不需要为每个行业重写 DeepAgents harness 或 executor loop，只需要提供行业差异化资产：MainAgent instructions、SubAgent definitions、Skill、工具声明、market mapping、scoring hints 和 eval fixtures。

## 分层

```text
packages/agent
  -> DeepAgents adapter / AgentRuntime / schema / harness

packages/core
  -> Event Bus、ToolRegistry、Policy Gate、Approval、审计、持久化端口

plugins/industries/<industry>
  -> 行业包资产、行业专用工具、Skill、mapping、evals
```

依赖方向：

```text
apps/worker or future agent worker
  -> packages/agent
  -> packages/core / packages/plugin-sdk
  -> plugins/industries/* assets via Registry
```

行业包不能反向控制 AgentRuntime，也不能直接 import 平台内部服务。

## 行业包推荐结构

```text
plugins/industries/<industry-name>/
  plugin.yaml
  config.schema.json
  README.md
  agents/
    main.md
    <subagent>.md
  skills/
    <skill-name>/
      SKILL.md
      references/
  tools/
    <tool>.py
  mappings/
    markets.yaml
    instruments.yaml
  scoring/
    hints.yaml
  evals/
    fixture_events.yaml
    expected_shapes.yaml
  templates/
    source_bindings/
      *.yaml
```

不是每个行业第一版都要填满这些目录。最小可用行业包可以只有：

- `plugin.yaml`
- `README.md`
- `agents/main.md`
- `skills/<skill>/SKILL.md`
- `mappings/instruments.yaml`
- `evals/fixture_events.yaml`

## Manifest 建议

```yaml
id: quantagent.official.industry.semiconductor
type: industry
version: 0.1.0
capabilities:
  - industry.analysis

main_agent: agents/main.md
subagents:
  - id: evidence_research_analyst
    path: agents/evidence_research_analyst.md

skills:
  - id: quantagent.official.industry.semiconductor.skill.market-analysis
    path: skills/semiconductor-market-analysis

market_mapping:
  markets: mappings/markets.yaml
  instruments: mappings/instruments.yaml

scoring_hints: scoring/hints.yaml
output_schema: industry_analysis.schema.json
```

## 通用框架提供什么

`packages/agent` 后续应提供：

- `DeepAgentFactory`
- `IndustryAgentRuntime`
- `RunWorkspaceBuilder`
- `DeepAgentsToolAdapter`
- `SkillPathResolver`
- `AgentDefinitionLoader`
- `SubAgentRegistry`
- `ToolAllowlistResolver`
- `ToolProfileResolver`
- `OutputSchemaValidator`
- fake provider / fake tool harness
- eval runner

行业包开发者不需要实现：

- Agent loop。
- DeepAgents backend。
- provider fallback。
- tool invocation 审计。
- Decision / Approval / Broker 编排。
- runtime persistence。
- 通用 artifact 和 output validation。

## 行业包需要提供什么

行业包开发者需要提供：

- MainAgent instructions：说明该行业如何使用 `write_todos`、显式 SubAgent、skills、平台工具和 run artifact 完成分析。
- SubAgent definitions：MVP 只需要可选的 `evidence_research_analyst`；更多专家 SubAgent 等真实瓶颈出现后再加。
- Skill：行业分析规则、术语、常见因果关系。
- Market mapping：候选市场、标的、公司和产品映射。
- Scoring hints：行业置信度、风险因子和证据质量提示。
- Evals：至少一个 happy path、一个无关事件、一个低置信或证据不足事件。

## Agent Frontmatter Tools

行业包不应该把所有工具都声明给 MainAgent。推荐在每个 Agent 的 Markdown frontmatter 里按角色声明最小工具 ID 集：

```yaml
tools:
  - quantagent.core.tool.get_run_context
  - quantagent.official.source.tavily.search_web
  - quantagent.core.tool.get_account_context
  - quantagent.core.tool.evaluate_thesis
  - quantagent.core.tool.build_action_plan
  - quantagent.core.tool.submit_action_plan
max_tool_calls: 12

# agents/evidence_research_analyst.md
tools:
  - quantagent.core.tool.get_run_context
  - quantagent.official.source.tavily.search_web
max_tool_calls: 8
```

frontmatter `tools` 只是需求声明。工具名称、描述、schema、风险等级和 interrupt 元数据来自平台工具定义 / ToolRegistry；最终可见工具仍由 ToolRegistry、用户授权、broker 模式、risk policy 和 runtime budget 决定。

## Prompt 与真源边界

Prompt 只负责行为指导，不能承载以下真源：

- 工具权限。
- 输出 schema。
- market mapping。
- 风险放行条件。
- broker 真实执行规则。
- secret、私有策略或生产配置。

这些必须由 schema、mapping、ToolRegistry、Policy Gate 或 runtime config 承接。
