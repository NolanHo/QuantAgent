# 07. 英伟达财报事件链路样例

## 场景

同一主题会先后出现多条事件：

- T+5 分钟：公司官网发布第一手财报公告，只包含收入、利润率、业务分部、指引等原始数字，不负责告诉我们“是否高于市场预期”。
- T+30 分钟：媒体发布“英伟达财报超预期”的报道，内容更易读，但本质上可能只是对同一财报的二次解释。

半导体 MainAgent 需要利用时效性优势：先基于第一手材料补充对照证据并做决策；后续媒体报道到来时，再检查之前是否已经基于同一主题做过行动和通知。如果没有新增实质信息，后续报道只入库、评分、关联原行动，不重复交易，也不重复通知用户。

这里的“市场预期”不是工具 schema 的专用字段。它只是 Agent 通过 `search_web` 多次检索后整理出的 `EvidenceBoard.claims(role=reference_point)`。其他行业也可以用同一机制补充历史均值、政策原文、同业指标、库存周期、天气基准或价格基准。

## 产物归属概览

这个样例里，MainAgent 不亲自承担所有专业产物。

但 MVP 不拆一堆专家 SubAgent。第一版只固定一个可选 Research SubAgent，其余专业判断由 MainAgent、行业 skill、`evaluate_thesis` 和 `build_action_plan` 承接。

| 产物 | 生产者 | 说明 |
| --- | --- | --- |
| run 计划和停止条件 | MainAgent | 使用 DeepAgents `write_todos` 控制全流程 |
| 财报事实确认 | `get_run_context` + MainAgent | Router / Intake 已绑定一手事件，MainAgent 只读取和确认 |
| 对照材料、冲突证据、来源关系 | `evidence_research_analyst` | 用 Tavily 多次窄查询，产出 `EvidenceBoard` |
| 盘后反应、波动、已定价风险 | Research SubAgent 或 MainAgent | MVP 用搜索公开材料降级，后续再接行情工具 |
| AI GPU 需求链条 | MainAgent | 用半导体 skill 合成 |
| HBM、先进封装、代工链二阶影响 | MainAgent | 用 mapping 和行业 skill 合成 |
| 反方观点和风险挑战 | MainAgent + `evaluate_thesis` | 避免只围绕利好证据生成结论 |
| 账户、近期动作、通知 | MainAgent 调 `get_account_context` | 敏感上下文默认不扩散给普通 SubAgent |
| 仓位、止盈止损、失效条件 | `build_action_plan` | MVP 用结构化工具统一生成 ActionPlan |
| `ActionPlan` | `build_action_plan` | 平台可消费的结构化行动计划 |
| 提交、审批、通知、dry-run、监控 | `submit_action_plan` | 唯一行动提交入口 |
| `IndustryAnalysis` | MainAgent | 最终合成并引用所有关键 artifact |

SubAgent 返回给 MainAgent 的不是完整搜索 dump，而是压缩报告、关键发现、缺口、反方观点和 `artifact_id`。完整工具调用留在 run ledger / audit 中。

## Event A: 第一手财报公告

### Step A1: 输入

```text
/input/event.json
  event_id: "evt_nvda_earnings_release_001"
  title: "NVIDIA reports quarterly results"
  source: "company investor relations"
  source_tier: "primary"
  url: "https://investor.nvidia.com/..."
  published_at: "2026-08-20T20:00:00Z"
  observed_at: "2026-08-20T20:05:00Z"
  structured_news:
    companies: ["NVIDIA"]
    tickers: ["NVDA"]
    event_type: "earnings"
    facts:
      - "Revenue: 46.7B"
      - "Data center revenue: 41.1B"
      - "Gross margin: 73.5%"
      - "Next-quarter revenue guide: 50.0B +/- 2%"
  route_context:
    owner_id: "semiconductor"
    relationship: "direct"
    priority: "urgent"
```

注意：输入没有写“beat expectations”。Router / Intake 只传递它确定知道的事实，不替 MainAgent 做市场解释。

### Step A2: write_todos

MainAgent 使用 DeepAgents `write_todos`：

```text
1. 通过 get_run_context 读取第一手财报事件、路由上下文和半导体 mapping。
2. 判断该一手事件可能触发交易，创建 evidence_research_analyst 任务补充对照材料和冲突证据。
3. 检查近期是否已有同主题动作、通知或监控。
4. MainAgent 结合 EvidenceBoard、半导体 skill 和 mapping 合成需求、供应链、市场反应和反方观点。
5. 调用 evaluate_thesis 检查 surprise、交易重要性、风险和重复覆盖。
6. 若证据足够，读取组合与自动审批策略。
7. 调用 build_action_plan 生成 ActionPlan，包括仓位、止盈止损、失效条件和监控。
8. 通过 submit_action_plan 提交。
9. 写出 IndustryAnalysis。
```

### Step A3: get_run_context

MainAgent 不手写 `/input/event.json` 路径，而是读取当前 run 绑定的上下文。

```text
GetRunContextRequest
  sections: ["event", "route_context", "industry_profile", "market_mapping", "tool_profile"]
  symbols: ["NVDA", "MU", "TSM", "ASML"]
  max_tokens: 2500
```

输出摘要：

```text
RunContext
  sections:
    - event: "公司一手财报公告，包含收入、data center、毛利率和下一季度收入指引。"
    - market_mapping: "NVDA 直接映射 AI GPU；MU/TSM/ASML 为二阶相关标的。"
    - tool_profile: "MainAgent 可调用 search_web、get_account_context、evaluate_thesis、build_action_plan、submit_action_plan。"
  safe_summary: "当前 run 已绑定 NVDA quarterly earnings 一手事件。"
```

### Step A4: evidence_research_analyst

MainAgent 不把搜索策略全塞进自己的 prompt，而是用 DeepAgents `task` 委派给专门 Research SubAgent。这个 SubAgent 可以有更详细的搜索机制和 Tavily 调用预算。

```text
task(
  agent="evidence_research_analyst",
  instruction="
    当前 run 绑定 NVDA 一手财报公告，事件观测时间约为发布后 5 分钟。
    目标：
    1. 确认公司一手公告中的关键数字。
    2. 查找公开市场对照材料，例如收入、data center、毛利率和下一季度指引的可用基准。
    3. 查找冲突证据和短线风险，例如估值、出口管制、电话会未出、跳空风险。
    4. 判断是否存在比当前事件更早或同一主题的已处理材料。
    工具：get_run_context、search_web。
    搜索预算：最多 5 次 Tavily 查询，每次 query 要窄。
    输出：EvidenceResearchReport 和 EvidenceBoard artifact_id。
    禁止：不要读取账户，不要生成交易计划，不要把 Tavily answer 当作最终事实。
  "
)
```

Research SubAgent 内部可能执行这些 query：

```text
NVIDIA quarterly results revenue data center guidance investor relations
NVIDIA revenue consensus current quarter guidance consensus gross margin estimate
NVIDIA earnings risk valuation export control data center demand concerns
```

这些原始 `SearchWebResult` 默认只进 search ledger 和必要 artifact，不直接传给其他 Agent。

### Step A5: 行情反应降级处理

MVP 暂时不拆 `market_reaction_analyst`。如果没有行情工具，就由 Research SubAgent 用 Tavily 查公开盘后报道，并在 EvidenceBoard 里标注 `market_reaction` claim。如果后续接入 `get_market_snapshot`，MainAgent 可以直接调用该工具读取快照，仍不必立刻新增 Market SubAgent。

```text
get_market_snapshot(
  symbols=["NVDA", "SOX"],
  fields=["after_hours", "prev_close", "volume"],
  time_window="intraday"
)
```

如果 MVP 暂时没有行情源，这一步直接跳过，依赖 Research SubAgent 的公开材料，并在 gaps 中标记 market snapshot unavailable。

### Step A6: EvidenceBoard

EvidenceBoard 是 Research SubAgent 产物，不是搜索工具直接返回。MainAgent 可以追加事件关系判断，但不应把原始搜索 dump 复制给下游。

```text
EvidenceBoard
  source_items:
    - source_kind: "event"
      title: "NVIDIA reports quarterly results"
      summary: "公司公告披露收入、data center、毛利率和下一季度收入指引。"
      reliability_score: 0.98
      freshness_score: 0.99
    - source_kind: "search_result"
      title: "公开市场对照材料"
      summary: "收入和下一季度指引预估低于公告值。"
      reliability_score: 0.78
      freshness_score: 0.84
    - source_kind: "market_snapshot"
      title: "NVDA / SOX market reaction"
      summary: "NVDA 盘后上涨，SOX 同步走强。"
  claims:
    - role: "raw_fact"
      statement: "公司一手公告披露收入、data center、毛利率和下一季度收入指引。"
      confidence_score: 0.98
    - role: "reference_point"
      statement: "公告收入和指引高于可获得公开对照材料。"
      confidence_score: 0.86
    - role: "market_reaction"
      statement: "盘后市场反应支持该事件被视为利好。"
      confidence_score: 0.80
    - role: "conflict"
      statement: "估值拥挤和跳空回撤风险仍高。"
      confidence_score: 0.76
  relation_summary:
    relation_type: "new_information"
    related_event_ids: []
    reason_summary: "这是本季度财报主题的第一条一手事件。"
  gaps:
    - "电话会全文尚未发布。"
  safe_summary: "第一手财报数字强，同时补充对照材料显示收入和指引相对市场基准有明显 surprise。"
```

### Step A7: get_account_context

MainAgent 在行动前读取组合和近期活动。

```text
AccountContextRequest
  symbols: ["NVDA"]
  include_positions: true
  include_open_orders: true
  include_risk_limits: true
  include_user_policy: true
  include_broker_mode: true
  include_recent_activity: true
  activity_lookback_window: "24h"
  relation_hints:
    - key: "issuer"
      value: "NVIDIA"
    - key: "event_family"
      value: "quarterly_earnings"
```

输出摘要：

```text
AccountContext
  broker_mode: "dry_run"
  cash_available: 100000
  positions:
    - symbol: "NVDA"
      quantity: 0
      exposure_pct: 0
  recent_actions: []
  recent_notifications: []
  risk_limits:
    max_single_position_pct: 0.12
    max_new_trade_notional: 12000
    allow_short: false
    allow_options: false
  automation_policy:
    auto_approve_enabled: true
    auto_approve_min_confidence: 0.90
    auto_approve_max_risk_level: "low"
    auto_approve_max_notional: 10000
    require_human_for_short: true
    require_human_for_leverage: true
```

### Step A8: MainAgent 合成行业影响和反方观点

MVP 不调用 Demand / SupplyChain / Risk 专家 SubAgent。MainAgent 基于 EvidenceBoard、半导体 skill 和 mapping 合成压缩观点：

```text
IndustryImpactDraft
  demand_summary: "Data center 和指引显示 AI GPU 需求继续强。"
  supply_chain_summary: "二阶利好 HBM、先进封装和相关代工链，但本次直接交易标的仍是 NVDA。"
  counterpoints:
    - "估值偏高。"
    - "盘后跳空后存在回撤风险。"
    - "电话会细节尚未完全验证。"
  risk_flags: ["valuation_rich", "gap_up_reversal", "call_transcript_missing"]
```

这份草案可以直接进入 `IndustryAnalysis` draft，并由 `evaluate_thesis` 做评分、反方检查和重复覆盖判断。后续如果发现这些判断不稳定，再拆对应专家 SubAgent。

### Step A9: evaluate_thesis

```text
ThesisEvaluation
  confidence_score: 0.92
  recommendation_score: 0.87
  evidence_quality: "high"
  upside_case: "第一手财报强，补充对照材料显示收入和指引 surprise，盘后市场反应确认。"
  downside_case: "估值高，电话会未出，短线跳空后可能回撤。"
  risk_level: "low"
  risk_flags: ["valuation_rich", "gap_up_reversal", "call_transcript_missing"]
  verification_status: "partial"
  materiality_score: 0.91
  novelty_score: 0.95
  event_relationship: "new_information"
  prior_coverage:
    status: "none"
    related_action_ids: []
    related_notification_ids: []
    reason_summary: "近期没有同主题行动或通知。"
  suggested_intent: "propose_trade"
  reason_summary: "一手事件 + 通用对照证据支持高置信小仓位做多，但用严格止损和后续电话会监控控制风险。"
```

### Step A10: build_action_plan

交易计划不建议由 MainAgent 在 prompt 中随手写。MVP 不单独暴露 `trade_plan_analyst`，而是在 `build_action_plan` 中完成结构化计划生成。

MainAgent 传入的应是 ID：

```text
BuildActionPlanRequest
  industry_analysis_artifact_id: "artifact_industry_analysis_nvda_001"
  thesis_evaluation_artifact_id: "artifact_thesis_eval_nvda_001"
  account_context_id: "context_account_nvda_001"
  target_symbols: ["NVDA"]
  intended_action: "open_long"
  conviction: "high"
  time_horizon: "short_term"
  constraints:
    - "dry_run only"
    - "no leverage"
    - "notional must stay below auto approval threshold"
```

输出：

```text
ActionPlan
  intent: "trade"
  action_side: "increase_risk"
  target_symbols: ["NVDA"]
  related_event_ids: ["evt_nvda_earnings_release_001"]
  related_action_ids: []
  orders:
    - symbol: "NVDA"
      side: "buy"
      order_intent: "open"
      notional: 9500
      portfolio_pct: 0.095
      order_type: "market"
      time_in_force: "day"
  risk_controls:
    stop_loss: "-4.5% from execution reference price"
    take_profit: "+9% from execution reference price"
    max_loss_amount: 430
    max_position_pct_after_trade: 0.095
    invalidation_conditions:
      - "电话会或后续公告削弱 data center 需求判断"
      - "NVDA 跌回财报发布前收盘价且 SOX 同步走弱"
      - "新的政策或出口管制消息影响当前季度指引"
  monitoring_plan:
    triggers:
      - metric: "NVDA price"
        condition: "drawdown >= 4.5% from execution reference"
        action: "reanalyze_or_reduce"
      - metric: "NVDA price"
        condition: "gain >= 9%"
        action: "notify_take_profit_review"
      - metric: "earnings_call_transcript"
        condition: "available"
        action: "reanalyze"
    review_after: "next_market_close"
  user_notification:
    title: "NVDA 财报一手公告显示强 surprise，建议提交小仓位做多计划"
    summary: "系统在公告发布后约 5 分钟捕获第一手财报，并补充市场对照材料；收入、data center 和指引均支持短期做多。建议提交 9,500 美元 dry-run 买入计划，最终审批和执行状态由平台策略决定。"
    key_points:
      - "证据来自一手公告、通用对照材料和盘后市场反应。"
      - "计划满足自动审批候选条件：置信度 0.92，风险等级 low，金额低于 10,000 美元。"
      - "主要风险是估值偏高、跳空回撤和电话会细节尚未完全验证。"
      - "本次仅是 ActionPlan 草案，不代表已审批、已提交或已成交。"
    risk_summary: "低风险等级，但需要监控电话会和盘后跳空回撤。"
    delivery_policy: "send"
  confidence_score: 0.92
  risk_level: "low"
  risk_flags: ["valuation_rich", "gap_up_reversal", "call_transcript_missing"]
  idempotency_key: "nvda-quarterly-earnings-2026q2-default-paper-open-long"
  artifact_id: "artifact_action_plan_nvda_001"
```

### Step A11: submit_action_plan

```text
SubmitActionPlanRequest
  action_plan_artifact_id: "artifact_action_plan_nvda_001"
  industry_analysis_artifact_id: "artifact_industry_analysis_nvda_001"
  evidence_artifact_ids:
    - "artifact_evidence_board_nvda_001"
  requested_mode_hint: "auto_if_allowed"
  dry_run_allowed: true
  idempotency_key: "nvda-quarterly-earnings-2026q2-default-paper-open-long"
```

`agent_run_id`、`industry_plugin_id` 和 `event_id` 由 AgentRuntime 自动注入，不要求模型作为工具参数填写。

平台内部判断：

```text
auto_approve_enabled = true
confidence_score 0.92 >= 0.90
risk_level low <= low
notional 9500 <= 10000
side = buy/open_long, not short
no leverage
broker_mode = dry_run
Policy Gate = allowed
```

输出：

```text
SubmitActionPlanResult
  resolved_mode: "execute_then_notify"
  policy_gate_status: "allowed"
  execution_status: "dry_run_requested"
  broker_request_id: "dryrun_req_nvda_001"
  monitoring_task_ids:
    - "monitor_nvda_stop_001"
    - "monitor_nvda_takeprofit_001"
    - "monitor_nvda_transcript_001"
  notification_ids:
    - "notify_nvda_action_result_001"
  notification_status: "sent"
  executed_changes:
    - symbol: "NVDA"
      side: "buy"
      notional: 9500
      status: "dry_run_requested"
  user_message:
    title: "NVDA 财报一手公告显示强 surprise，已按自动审批策略提交 dry-run 做多"
    summary: "系统基于第一手财报和补充对照证据，提交了 NVDA 9,500 美元 dry-run 买入请求，占组合约 9.5%。"
    details:
      - "自动审批原因：置信度 0.92，高于用户阈值 0.90；风险等级 low；金额低于 10,000 美元。"
      - "风险控制：4.5% 止损，9% 止盈复核，电话会全文发布后重分析。"
      - "当前 broker_mode=dry_run，不代表真实成交。"
  reason_summary: "ActionPlan satisfied auto approval policy and Policy Gate allowed dry-run request."
```

## Event B: 30 分钟后的媒体报道

### Step B1: 输入

```text
/input/event.json
  event_id: "evt_nvda_media_beat_001"
  title: "NVIDIA beats expectations as AI demand surges"
  source: "financial media"
  source_tier: "secondary"
  url: "https://example-media.com/..."
  published_at: "2026-08-20T20:31:00Z"
  observed_at: "2026-08-20T20:33:00Z"
  structured_news:
    companies: ["NVIDIA"]
    tickers: ["NVDA"]
    event_type: "earnings_media_report"
    facts:
      - "Media reports NVIDIA beat expectations."
      - "Article attributes upside to data center AI demand."
  route_context:
    owner_id: "semiconductor"
    relationship: "direct"
    priority: "high"
```

### Step B2: MainAgent 计划变化

这次不应默认进入交易计划。MainAgent 的计划应先判断事件关系：

```text
1. 通过 get_run_context 读取媒体报道和路由上下文。
2. 先读取 recent_activity_summary，判断是否存在同主题一手事件、动作和通知。
3. 用 get_account_context 查询近期 NVDA / quarterly_earnings 相关动作、通知和监控。
4. 如果 recent activity 已显示完整覆盖，只做一次轻量 search_web 或 Research SubAgent 降级任务，确认报道没有新增事实。
5. 整理轻量 EvidenceBoard，标记该报道与一手财报事件的关系。
6. 评估这条报道是否带来新增实质信息或冲突信息。
7. 如果已被覆盖且无新增信息，只写出评分和关联，不生成 ActionPlan，不通知用户。
```

### Step B3: get_run_context

```text
GetRunContextRequest
  sections: ["event", "route_context", "industry_profile", "market_mapping"]
  symbols: ["NVDA"]
  max_tokens: 1800
```

### Step B4: 轻量检索或 Research SubAgent

```text
search_web(
  query="NVIDIA beats expectations AI demand earnings media report original release",
  topic="finance",
  time_window="2h",
  max_results=5
)

search_web(
  query="NVIDIA earnings follow up new guidance management commentary transcript",
  topic="finance",
  time_window="2h",
  max_results=5
)
```

如果媒体报道包含新的管理层表述、电话会内容或监管风险，MainAgent 应改用 `evidence_research_analyst` 做完整 follow-up research。当前样例中报道只是二手解释，所以不启动完整 SubAgent。

### Step B5: get_account_context

```text
AccountContextRequest
  symbols: ["NVDA"]
  include_positions: true
  include_open_orders: true
  include_risk_limits: false
  include_user_policy: false
  include_broker_mode: true
  include_recent_activity: true
  activity_lookback_window: "2h"
  relation_hints:
    - key: "issuer"
      value: "NVIDIA"
    - key: "event_family"
      value: "quarterly_earnings"
```

输出摘要：

```text
AccountContext
  broker_mode: "dry_run"
  positions:
    - symbol: "NVDA"
      exposure_pct: 0.095
  recent_actions:
    - action_id: "action_nvda_earnings_open_long_001"
      event_id: "evt_nvda_earnings_release_001"
      action_type: "trade"
      symbols: ["NVDA"]
      status: "dry_run_requested"
      created_at: "2026-08-20T20:09:00Z"
      idempotency_key: "nvda-quarterly-earnings-2026q2-default-paper-open-long"
      relation_summary: "基于同一季度财报主题的一手公告做多。"
  recent_notifications:
    - notification_id: "notify_nvda_action_result_001"
      event_id: "evt_nvda_earnings_release_001"
      topic_key: "NVIDIA:quarterly_earnings:2026q2"
      title: "NVDA 财报一手公告显示强 surprise，已按自动审批策略提交 dry-run 做多"
      sent_at: "2026-08-20T20:10:00Z"
      status: "sent"
  existing_monitoring_tasks:
    - task_id: "monitor_nvda_transcript_001"
      symbols: ["NVDA"]
      trigger_summary: "电话会全文发布后重分析。"
      status: "active"
```

### Step B6: EvidenceBoard

```text
EvidenceBoard
  source_items:
    - source_kind: "event"
      title: "NVIDIA beats expectations as AI demand surges"
      summary: "媒体报道称 NVDA 财报超预期。"
    - source_kind: "search_result"
      title: "媒体报道原始引用检查"
      summary: "报道主要引用公司已发布财报和公开对照材料。"
    - source_kind: "prior_analysis"
      title: "NVDA first-party earnings action"
      summary: "系统 28 分钟前已基于一手财报和对照材料提交 NVDA dry-run 做多。"
  claims:
    - role: "interpretation"
      statement: "媒体报道确认 NVDA 财报 surprise。"
      confidence_score: 0.82
    - role: "reference_point"
      statement: "报道覆盖同一份公司财报，没有新增指引、管理层表述或重大冲突事实。"
      confidence_score: 0.88
  relation_summary:
    relation_type: "follow_up"
    related_event_ids: ["evt_nvda_earnings_release_001"]
    reason_summary: "这是同一财报主题的二手报道，晚于第一手事件约 30 分钟。"
  conflicts: []
  gaps: []
  safe_summary: "该媒体报道确认已处理的财报 surprise，没有新增实质信息。"
```

### Step B7: evaluate_thesis

MainAgent 可以让 `evaluate_thesis` 做轻量评分，但不应要求它生成订单。

```text
ThesisEvaluation
  confidence_score: 0.84
  recommendation_score: 0.10
  evidence_quality: "medium"
  upside_case: "媒体报道与此前多头判断一致。"
  downside_case: "没有新信息，重复交易会放大已承担风险。"
  risk_level: "low"
  risk_flags: ["duplicate_coverage"]
  verification_status: "verified"
  materiality_score: 0.18
  novelty_score: 0.06
  event_relationship: "follow_up"
  prior_coverage:
    status: "fully_covered"
    related_action_ids: ["action_nvda_earnings_open_long_001"]
    related_notification_ids: ["notify_nvda_action_result_001"]
    reason_summary: "此前已基于第一手财报和对照材料提交行动并通知用户。"
  suggested_intent: "record_only"
  reason_summary: "该媒体报道确认已覆盖主题，不包含新增实质信息；不加仓、不减仓、不通知。"
```

### Step B8: 输出 IndustryAnalysis，但不提交行动

```text
IndustryAnalysis
  event_id: "evt_nvda_media_beat_001"
  impact_summary: "二手媒体报道确认 NVDA 财报超预期，但内容已被 30 分钟前的一手财报分析覆盖。"
  relevance:
    relationship: "direct"
    reason_summary: "报道主题仍是 NVDA 财报和 AI demand。"
  evidence_artifact_ids:
    - "artifact_evidence_board_nvda_media_001"
  confidence_score: 0.84
  recommended_actions: []
  thesis_evaluation_artifact_id: "artifact_thesis_eval_nvda_media_001"
  action_plan_artifact_id: null
  submission_id: null
  risk_flags: ["duplicate_coverage"]
  requires_verification: false
  metadata:
    event_relationship: "follow_up"
    related_event_ids: ["evt_nvda_earnings_release_001"]
    related_action_ids: ["action_nvda_earnings_open_long_001"]
    related_notification_ids: ["notify_nvda_action_result_001"]
    notification_decision: "suppressed_duplicate"
    trade_decision: "no_action_duplicate"
```

MainAgent 不调用 `build_action_plan`，也不调用 `submit_action_plan`。因为本次没有外部行动、没有审批、没有通知、没有监控变更。`record_only` 是非行动终态，AgentRuntime 只持久化分析、评分、证据和关联关系。

如果后续报道虽然不需要交易，但需要更新已有通知线程或提醒用户新的非交易风险，才生成 `ActionPlan(intent=notify_only)` 并交给 `submit_action_plan`。

## 设计要点

- Router / Intake 只传事实和路由上下文，不替 MainAgent 判断“是否超预期”。
- MainAgent 对一手事件要主动安排 Research SubAgent 补充通用对照证据，不能等媒体半小时后替它解释。
- `search_web` 可以被 MainAgent 轻量调用，也可以被 Research SubAgent 多次调用；市场预期、历史区间和冲突观点都只是 EvidenceBoard 中的 claim，不是搜索工具专用字段。
- `get_account_context(include_recent_activity=true)` 是防止重复交易和重复通知的关键读工具。
- 后续报道如果没有新增事实，只做评分、审计和关联，不生成 ActionPlan。
- 用户已经收到一手事件的行动通知时，二手报道默认不再通知。
- 自动审批仍然只来自用户策略 + Policy Gate；MainAgent 只提出计划，不自行批准。
- 有价值产物通过 `artifact_id` 传递；原始搜索结果、重复 URL、query 尝试和 scratch notes 只进入 ledger / audit。
