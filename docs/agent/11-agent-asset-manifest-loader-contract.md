# 11. Agent 资产 Manifest 与 Loader 合同

## 目标

行业包开发者应该只提供行业差异化资产，而不重写 AgentRuntime、DeepAgents harness 或 Web Chat 协议。本合同定义行业 Agent 资产如何组织、哪些文件是运行真源、Loader 如何把资产解析为 `AgentDefinition` 和运行时 `ToolProfile`。

MVP 采用 **frontmatter-first**：`agents/main.md` 和 SubAgent `.md` 同时承载机器可读 manifest 与 system prompt。定义一个 Agent 只需要一个 Markdown 文件。工具在 frontmatter 的 `tools` 字段中声明工具 ID；工具名称、描述、schema、风险等级和 interrupt 元数据来自平台工具定义 / ToolRegistry，不在行业包里重复写。

## 目录形态

```text
plugins/industries/<industry-plugin>/
  plugin.yaml
  agents/
    main.md
    subagents/
      evidence_research_analyst.md
  skills/
    market-analysis/SKILL.md
    evidence-research/SKILL.md
```

## 文件职责

| 文件 | 职责 | 不负责 |
| --- | --- | --- |
| `plugin.yaml` | 插件发现和行业包元信息 | 不直接配置 DeepAgents prompt 或工具运行细节 |
| `agents/main.md` | MainAgent 运行 manifest + system prompt；frontmatter 声明 id、version、tools、skills、SubAgent、输出 schema | 不重复工具描述、schema 或实现 |
| `agents/subagents/*.md` | SubAgent 运行 manifest + system prompt；frontmatter 声明自己的 tools、skills、输出 schema | 不继承 MainAgent 工具 |
| `skills/*/SKILL.md` | DeepAgents SkillsMiddleware 可按需加载的行业知识和方法 | 不替代工具权限和 runtime policy |

## MainAgent Markdown

`agents/main.md` 是 `AgentDefinition` 的资产入口：

```markdown
---
id: quantagent.official.industry.semiconductor.agent.main
name: Semiconductor MainAgent
type: industry_main_agent
version: 0.1.0
description: 半导体行业事件分析的 PlannerExecutor 总控 Agent。
tools:
  - quantagent.core.tool.get_run_context
  - quantagent.official.source.tavily.search_web
  - quantagent.core.tool.get_account_context
  - quantagent.core.tool.evaluate_thesis
  - quantagent.core.tool.build_action_plan
  - quantagent.core.tool.submit_action_plan
max_tool_calls: 12
skill_paths:
  - skills/market-analysis
subagents:
  - path: subagents/evidence_research_analyst.md
output_schema_id: quantagent.schema.industry_analysis.v1
---

你是 QuantAgent 的半导体行业 MainAgent……
```

Loader SHALL：

- 以 `agents/main.md` 为入口。
- 用 YAML 解析 Markdown frontmatter。
- 相对 `agents/` 解析 `subagents[].path`。
- 相对行业包根目录解析 `skill_paths`。
- 递归加载 SubAgent markdown。
- 将 frontmatter `tools` 作为 `AgentDefinition.tool_ids`。
- 通过 ToolRegistry 或当前 MVP 的公共工具 catalog 把 tool ids 解析为运行时 `ToolProfile`。
- 把 Markdown body 作为 `system_prompt`。

Loader SHALL NOT：

- 读取 `agents/main.json`、SubAgent json 或 `tool_profile_path` 作为 Agent 定义入口。
- 在行业包里重复维护公共工具描述和 schema。
- 直接 import 具体插件实现。
- 因 MainAgent 有某个工具就自动把该工具授予 SubAgent。

## SubAgent Markdown

SubAgent 使用自己的 Markdown frontmatter：

```markdown
---
id: quantagent.official.industry.semiconductor.subagent.evidence_research_analyst
name: evidence_research_analyst
type: research_subagent
version: 0.1.0
description: 为已路由的半导体事件检索公开证据，并返回压缩后的证据产物。
tools:
  - quantagent.core.tool.get_run_context
  - quantagent.official.source.tavily.search_web
skill_paths:
  - skills/evidence-research
max_tool_calls: 6
output_schema_id: quantagent.schema.evidence_research_report.v1
---

你是半导体行业 Research SubAgent……
```

SubAgent 的 `tools` 必须显式声明。它不会继承 MainAgent 工具，这避免 Research Agent 意外获得账户、审批、broker 或提交行动工具。

## Tool 解析

`tools` 字段只表达需求，不是最终授权结果。

```yaml
tools:
  - quantagent.core.tool.get_run_context
  - quantagent.official.source.tavily.search_web
```

运行时 SHALL：

- 从平台工具定义 / ToolRegistry 读取工具名称、描述、input schema、风险等级和 interrupt 元数据。
- 按当前部署已注册工具、用户授权、broker 模式、risk policy 和 runtime budget 过滤可见工具。
- 过滤后同步收窄 `AgentDefinition.tool_ids` 和 `ToolProfile.tool_bindings`，否则 DeepAgents 会看到不可调用工具。

MVP 中可以先用静态公共工具 catalog 解析 `get_run_context`、`search_web` 等公共工具；后续接入 ToolRegistry 后替换解析来源。

## Agent Chat 选择规则

正式 Agent Chat session 创建时应携带：

- `industry_id`：行业包 ID。
- `agent_id`：MainAgent ID。
- `routed_event_preset`：开发调试用的 routed event fixture。真实 worker 消费 routed topic 时应使用真实 event id 和 event payload，不依赖 preset。

Debug 页面只能提供快捷参数面板，最终仍调用正式 Agent Chat API 创建 session 和运行 AgentRuntime。
