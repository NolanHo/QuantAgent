# 04. 半导体 MainAgent 样例

## 目标

半导体 / 内存行业 MainAgent 的目标，是把一条已路由的新闻、公告或行业信号，转换为结构化 `IndustryAnalysis`，并在证据足够时提出可提交的 `ActionPlan`。

第一版不要追求完整半导体知识图谱。重点是跑通：

```text
事件事实
  -> 半导体相关性判断
  -> 证据补充
  -> 评分 / 风险检查
  -> 行业分析输出
  -> 行动计划草案
```

MVP 只固定一个可选 SubAgent：`EvidenceResearchAnalyst`。其他专家角色先由 MainAgent 的行业 skill、`evaluate_thesis` 和 `build_action_plan` 承接，等真实运行证明有必要再拆。

## MainAgent 职责 Prompt 草案

`agents/main.md` 应聚焦编排纪律。运行配置真源也在 Markdown frontmatter 中；也就是说 MainAgent 定义和 system prompt 合并为一个文件。工具通过 frontmatter `tools` 声明工具 ID，工具描述、schema 和风险元数据由平台工具定义 / ToolRegistry 提供。详细合同见 [11. Agent 资产 Manifest 与 Loader 合同](11-agent-asset-manifest-loader-contract.md)。

```markdown
---
id: quantagent.official.industry.semiconductor.agent.main
name: Semiconductor Main Agent
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

你是 QuantAgent 的半导体行业 MainAgent。

你的职责是规划并编排半导体行业分析，不是直接给出最终交易执行结论。

你必须：
- 先判断事件属于直接、间接、上下文相关还是无关。
- 先读取 run context，再决定是轻量自处理还是安排 SubAgent。
- 对可能触发交易、监控或用户通知的一手事件，优先把深度检索交给 EvidenceResearchAnalyst。
- 市场反应、需求链条、供应链影响和反方观点，MVP 先由 MainAgent 结合行业 skill 合成，并交给 `evaluate_thesis` 检查。
- 调用 SubAgent 时必须一次性写清任务目标、可用工具、搜索预算、输出 schema、停止条件和禁止事项；不要假设 SubAgent 记得前一次任务。
- 对一手来源、二手报道、市场数据和模型推断分别标注证据角色。
- 做行动前必须读取近期动作、通知和监控任务，判断本次事件是否已被覆盖。
- 区分事实、推断和不确定性。
- 明确影响链条：供给、需求、价格、公司暴露、市场标的。
- 只接收 SubAgent 的压缩报告、关键发现、缺口、反方观点和 artifact id，不把完整搜索结果或 scratch notes 继续传给下游。
- 输出符合 IndustryAnalysis schema 的结构化结果。
- 交易相关内容只能形成 ActionPlan，并通过 submit_action_plan 提交。
- 后续报道如果没有新增实质信息，只记录评分和证据关联，不重复生成交易动作或通知。
- 不直接调用通知、审批、broker 或监控底层工具；这些由 submit_action_plan 编排。

你不得：
- 因单条新闻直接请求真实交易。
- 把推荐度、分析置信度或事件可信度写成执行放行。
- 在证据不足时强行生成交易计划。
- 复述完整敏感上下文或保存 chain-of-thought。
```

## SubAgent 设计

SubAgent 不必和 MainAgent 拿同一套工具。行业包应给每个 SubAgent 声明最小 tool profile，并由 AgentRuntime 按 run 绑定上下文。

SubAgent 是 DeepAgents `task` 创建的一次性执行单元。MainAgent 必须给完整任务说明，包括：当前事件摘要、目标、允许工具、预算、输出格式、要保存的 artifact 类型、不能做的事。自定义 SubAgent 不自动继承 MainAgent 的 skills / tools，行业包必须显式配置。

MVP 只实现一个 SubAgent，避免第一版过度编排。

### EvidenceResearchAnalyst

职责：

- 为一手事件补充对照材料、历史基准、冲突证据和来源关系。
- 设计多次窄 query，而不是只搜一次。
- 把原始搜索结果压缩为 `EvidenceBoard` 或 `EvidenceResearchReport`。
- 区分 `raw_fact`、`reference_point`、`interpretation`、`conflict` 和 `market_reaction`。

建议工具：

- `get_run_context`
- `search_web`

禁止：

- 不读账户上下文。
- 不生成交易计划。
- 不把 Tavily answer 当作事实本身。

## 后续可扩展 SubAgent

以下不是 MVP 必做项。只有当真实运行发现 MainAgent 在对应维度反复不稳定、上下文过大或需要专属工具时，再拆。

### MarketReactionAnalyst

职责：

- 判断公告后市场反应、盘后价格、成交量、波动和已定价风险。
- 在行情源不可用时，用 `search_web` 降级查公开盘后报道，并标记数据缺口。
- 产出 `MarketReactionReport`，供风险评估和交易计划使用。

建议工具：

- `get_run_context`
- `search_web`
- `get_market_snapshot`，当 runtime 已配置行情源时启用。

### SupplyChainAnalyst

职责：

- 判断事件对晶圆制造、先进封装、设备、材料、产能和交期的影响。
- 标记受影响环节：foundry、memory、packaging、equipment、EDA、materials。
- 输出供应链影响、证据、反方观点和风险。

建议工具：

- `get_run_context`
- `search_web`
- 后续可选：`lookup_supply_chain_relation`

### DemandAnalyst

职责：

- 判断事件对 AI server、HBM、DRAM、NAND、data center capex、GPU supply chain 的需求影响。
- 区分短期订单、长期 capex、库存周期和价格弹性。
- 输出需求强度、时间窗口和不确定性。

建议工具：

- `get_run_context`
- `search_web`
- 后续可选：`lookup_capex_signal`

### CompanyMappingAnalyst

职责：

- 把事件映射到公司、产品、技术和可交易标的。
- 区分直接受益、间接受益、潜在受损和仅主题相关。
- 标记映射是否来自 `mappings/instruments.yaml`，还是模型推测。

建议工具：

- `get_run_context`
- 后续可选：`lookup_company_exposure`

### RiskChallengeAnalyst

职责：

- 生成反方观点和风险清单。
- 识别来源可信度、已定价风险、政策限制、出口管制、周期高点、估值拥挤和噪音。
- 判断是否需要人工复核或更多证据。

建议工具：

- `get_run_context`
- `search_web`
- `get_market_snapshot`，当 runtime 已配置行情源时启用。

### TradePlanAnalyst

职责：

- 在 MainAgent 已确认事件重要、证据质量足够、且读取过账户摘要后，生成风险受控的交易计划草案。
- 给出目标方向、仓位大小、最大亏损、止损、止盈复核、失效条件和监控触发器。
- 明确哪些约束来自账户风险限制，哪些来自事件风险。

建议工具：

- `get_run_context`
- 只读账户摘要或 `account_context_id`，由 MainAgent 先获取后按最小必要原则传入。
- 后续可选：组合风险计算工具。

禁止：

- 不调用 broker。
- 不创建审批。
- 不发送通知。
- 不自行判定自动审批是否通过。

## 推荐工具

第一版 MainAgent 核心工具：

| 工具 | 风险 | 说明 |
| --- | --- | --- |
| `get_run_context` | low | 读取当前 run 绑定的事件、路由、行业 profile、mapping、risk policy 和工具配置摘要 |
| `search_web` | medium | Tavily 搜索工具；MainAgent 可用于轻量核验，复杂检索交给 EvidenceResearchAnalyst |
| `get_account_context` | low / medium | 读取仓位、风险预算、近期动作、通知、用户自动审批策略和 broker 模式 |
| `evaluate_thesis` | medium | 评分、反方检查和风险归类 |
| `build_action_plan` | high | 生成做多 / 做空 / 减仓 / 平仓 / 监控计划草案 |
| `submit_action_plan` | high / critical | 唯一行动提交入口，内部编排通知、审批、Policy Gate、监控和 dry-run/mock |

可选工具：

| 工具 | 默认可见对象 | 说明 |
| --- | --- | --- |
| `get_market_snapshot` | 可按配置给 MainAgent，后续也可给 Market / Risk SubAgent | 读取行情、盘后反应、成交量和波动，不读账户 |

MainAgent 不需要默认拥有所有细工具。工具多会让边界变模糊，也会让模型倾向于自己做完所有事情。更好的默认是：MainAgent 保留总控工具，专门 SubAgent 获得更细工具和更详细的 skill。

MVP 不单独实现 Market / Demand / SupplyChain / Risk / TradePlan SubAgent。先把它们作为 prompt 规则、skill 内容、`evaluate_thesis` 检查项和 `build_action_plan` 输出约束。

半导体专用工具可以后置：

- `lookup_company_exposure`
- `lookup_memory_price_snapshot`
- `lookup_capex_signal`
- `lookup_export_control_timeline`
- `lookup_supply_chain_relation`

这些第一版可以先用静态 mapping 或 fixture 实现，不要一开始接复杂付费数据源。

## Market Mapping 草案

`mappings/instruments.yaml` 应至少表达：

```yaml
companies:
  - name: TSMC
    tickers: ["TSM"]
    exposure: ["foundry", "advanced_process"]
  - name: Micron
    tickers: ["MU"]
    exposure: ["DRAM", "NAND", "HBM"]
  - name: SK hynix
    tickers: []
    exposure: ["DRAM", "HBM"]
  - name: ASML
    tickers: ["ASML"]
    exposure: ["lithography", "equipment"]
  - name: NVIDIA
    tickers: ["NVDA"]
    exposure: ["AI GPU", "HBM demand"]

themes:
  - id: hbm_supply
    related_exposure: ["HBM", "advanced packaging", "AI server"]
  - id: foundry_capacity
    related_exposure: ["foundry", "wafer capacity", "advanced_process"]
```

映射文件是 Decision 和 UI 的结构化来源，不能只写在 Prompt。

## 输出重点

半导体 `IndustryAnalysis` 至少要回答：

- 事件摘要是什么。
- 半导体相关性是 direct、indirect、contextual 还是 none。
- 一阶影响：直接影响哪个环节、公司或产品。
- 二阶影响：价格、订单、capex、库存、竞争格局。
- 证据有哪些，证据质量如何。
- 反方观点是什么。
- 影响时间窗口是什么。
- 受影响标的是否来自 mapping。
- 置信度和风险标记。
- 是否需要验证，以及是否生成并提交 ActionPlan。

## Evals

第一版 fixture 至少覆盖：

- direct：HBM 供应、DRAM 价格、foundry capacity、chip equipment。
- indirect：AI server capex、GPU supply chain、data center buildout。
- irrelevant：普通消费电子评测、SEO 噪音、无半导体事实的股票推广。
- degraded：只有 RSS summary，没有完整正文。
- conflicting：多个来源对同一事件影响方向不同。
