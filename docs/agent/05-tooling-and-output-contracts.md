# 05. MainAgent 工具与输出契约

## 设计目标

MVP 不把 `collect_evidence` 设计成复杂的“证据全能工具”。第一版只有 Tavily 搜索插件时，证据获取应保持轻量：

- 搜索工具只负责搜索和返回结果，不负责替 Agent 建完整证据板。
- EvidenceBoard 是 MainAgent 或 SubAgent 基于多次搜索、上下文读取和行情查询后形成的结构化产物。
- 工具调用默认绑定当前 `agent_run_id`、`event_id`、`industry_id`、`agent_definition_id` 和授权上下文，这些不应该由模型手填。
- 小结果直接返回给 Agent；大结果或可复用结果由 runtime 自动保存为 run artifact，并返回 `artifact_id`。
- DeepAgents workspace 可作为 Agent 内部工作区，但业务工具 schema 不要求 Agent 输入任意文件路径。

## ID-first 传递规则

工具之间传递信息应优先使用 ID，而不是让 Agent 复制大 JSON。领域对象自己的 ID 使用 `*_id`，run artifact 引用使用 `*_artifact_id`；不要让同一个字段同时接收两种 namespace。

推荐优先级：

1. 传 `*_artifact_id`、`context_id`、`evaluation_id`、`action_plan_id`、`submission_id` 等稳定 ID。
2. 传压缩摘要，例如 `recent_activity_summary` 或 `safe_summary`。
3. 只在对象很小、一次性、尚未持久化时直接传结构化对象。

这样可以降低 token 成本、减少模型复制字段时的错误，并让工具实现从 run artifact / 数据库中读取可信对象。工具 input schema 中出现对象字段时，通常都应同时提供对应的 `*_id` 或 `*_artifact_id` 字段；平台实现时优先解析 ID。

## Schema 写法约定

后端工具 schema 文档优先用 Pydantic 风格表达，类似前端用 Zod 写 schema 和 `describe()`。文档里的模型不是最终代码文件，但应足够接近实现，方便后续迁移到 `packages/agent` 或 `packages/core`。

约定：

- 使用 `BaseModel` + `ConfigDict(extra="forbid")` 禁止模型随意多传字段。
- 使用 `Literal[...]` 表达枚举。
- 使用 `Field(description=...)` 写字段语义、边界和 Agent 使用注意事项。
- runtime 自动注入的上下文不进入工具 input schema，只进入权限、审计和 artifact 归属。

```python
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
```

## 工具分层

MainAgent 可见工具不等于系统全部工具。不同 Agent 应按职责拿到不同工具集。

| MVP 层级 | 默认可见工具 | 说明 |
| --- | --- | --- |
| MainAgent | `get_run_context`、`search_web`、`get_account_context`、`evaluate_thesis`、`build_action_plan`、`submit_action_plan` | 负责总控、收敛和行动提交 |
| Research SubAgent | `get_run_context`、`search_web` | 可多次检索，产出压缩报告 |
| Execution / Approval | 不直接暴露给 Agent；由 `submit_action_plan` 内部调用 | broker、审批、通知和监控统一受控 |

后续如果接入稳定行情源或更复杂行业 mapping，可以新增 Market / Risk / Mapping SubAgent profile，但它们不是 MVP 默认层级。

`collect_evidence` 可以作为后续便捷聚合器出现，但不进入 MVP 核心工具。第一版先让 Agent 用 `search_web` 和 `get_run_context` 组合出证据板；`get_market_snapshot` 是可选行情工具，不应让一个工具过早承载搜索、正文读取、行情、mapping、去重、评分和通知判断。

## 运行绑定

工具实现可以从 ToolRuntime / AgentRuntime 读取隐藏上下文，这些字段不要求模型填写：

```python
class ToolRuntimeContext(StrictModel):
    agent_run_id: str = Field(description="当前 AgentRun ID，由 AgentRuntime 注入，用于审计、预算和 artifact 归属。")
    event_id: str = Field(description="当前 run 绑定的 Event ID，由 Router / Intake 创建。")
    raw_event_id: str | None = Field(default=None, description="原始事件 ID；只有需要回查 source 原始摘要时使用。")
    industry_id: str = Field(description="当前行业包 ID，用于 tool profile、mapping 和权限判断。")
    agent_id: str = Field(description="当前主 Agent 或 SubAgent 定义 ID。")
    subagent_id: str | None = Field(default=None, description="SubAgent 调用时注入；MainAgent 运行时为空。")
    account_scope: str | None = Field(default=None, description="当前允许读取的账户范围；不由模型自由指定。")
    tool_profile_id: str = Field(description="本次注入工具集的 profile ID。")
    permission_scope: str = Field(description="权限解析后的安全范围摘要。")
    trace_id: str = Field(description="贯穿工具调用、审计和日志的 trace ID。")
```

模型只输入业务意图，例如 query、symbols、sections、time_window。

## get_run_context

职责：读取当前 run 已绑定的上下文切片。它不是数据库自由查询工具，也不是文件读取工具。

```python
ContextSection = Literal[
    "event",
    "route_context",
    "raw_event_summary",
    "industry_profile",
    "market_mapping",
    "risk_policy",
    "tool_profile",
    "recent_activity_summary",
]


class GetRunContextInput(StrictModel):
    sections: list[ContextSection] = Field(
        min_length=1,
        description="需要读取的上下文切片；只能读取当前 run 已绑定或授权的内容。",
    )
    symbols: list[str] = Field(
        default_factory=list,
        description="可选标的过滤器，用于压缩 market_mapping 或 recent_activity_summary。",
    )
    max_tokens: int | None = Field(
        default=None,
        ge=256,
        le=8000,
        description="期望返回的最大文本预算；runtime 可进一步收紧。",
    )


class RunContextSection(StrictModel):
    name: ContextSection = Field(description="上下文切片名称。")
    summary: str = Field(min_length=1, description="给 Agent 阅读的压缩摘要。")
    data: dict[str, Any] = Field(default_factory=dict, description="结构化上下文；不得包含 secret 原文。")
    artifact_id: str | None = Field(default=None, description="上下文较大时保存为当前 run artifact 后返回的 ID。")


class GetRunContextOutput(StrictModel):
    context_id: str = Field(description="本次上下文读取结果 ID，用于审计和后续引用。")
    sections: list[RunContextSection] = Field(description="按请求返回的上下文切片。")
    warnings: list[str] = Field(default_factory=list, description="降级、截断、权限过滤等提示。")
    safe_summary: str = Field(description="不含敏感信息的摘要，供日志和审计展示。")
```

边界：

- 默认读取当前 run，不让 Agent 输入 `event_ref` 或文件路径。
- 可以返回压缩后的 event、mapping、risk policy 和近期活动摘要。
- 不执行搜索、行情查询、账户查询或交易动作。

## search_web

职责：调用 Tavily 搜索插件，按当前 run 记录查询、去重和审计。

```python
SearchTopic = Literal["news", "general", "finance", "company", "regulation"]
SearchTimeWindow = Literal["1h", "24h", "7d", "30d", "custom"]


class SearchWebInput(StrictModel):
    query: str = Field(
        min_length=3,
        max_length=500,
        description="自然语言搜索 query；Agent 可围绕同一事件多次发起窄查询。",
    )
    topic: SearchTopic = Field(
        default="general",
        description="搜索意图分类，用于 Tavily 参数、缓存 key 和审计分组。",
    )
    time_window: SearchTimeWindow | None = Field(
        default=None,
        description="搜索时间窗口；MVP 用枚举约束，custom 由工具实现结合 runtime policy 解释。",
    )
    max_results: int | None = Field(
        default=None,
        ge=1,
        le=10,
        description="期望结果数量；runtime 可根据 tool budget 降低上限。",
    )
    include_answer: bool = Field(
        default=False,
        description="是否请求 Tavily 返回简短 answer；answer 只能作为线索，不直接当事实。",
    )
    include_raw_content: bool = Field(
        default=False,
        description="MVP 默认关闭，避免大正文挤爆上下文；需要正文时后续接 reader 工具。",
    )
    domains_allowlist: list[str] = Field(default_factory=list, description="可选域名白名单。")
    domains_blocklist: list[str] = Field(default_factory=list, description="可选域名黑名单。")


class SearchWebItem(StrictModel):
    result_id: str = Field(description="单条搜索结果 ID。")
    title: str = Field(description="搜索结果标题。")
    url: str = Field(description="结果 URL。")
    source: str | None = Field(default=None, description="来源名称或域名。")
    published_at: datetime | None = Field(default=None, description="来源发布时间；搜索插件无法确定时为空。")
    snippet: str = Field(description="搜索结果摘要片段。")
    score: float | None = Field(default=None, ge=0, le=1, description="搜索插件返回的相关性分数。")


class SearchWebOutput(StrictModel):
    search_id: str = Field(description="本次搜索调用 ID。")
    query: str = Field(description="实际执行的 query。")
    answer_summary: str | None = Field(default=None, description="搜索插件返回的简短 answer；仅作为线索。")
    results: list[SearchWebItem] = Field(description="搜索结果列表。")
    artifact_id: str | None = Field(default=None, description="结果较大时自动保存为 run artifact。")
    dedupe_summary: str = Field(description="同 run 内 query / URL 去重摘要。")
    safe_summary: str = Field(description="不含敏感信息的搜索摘要。")
```

运行机制：

- Agent 可以多次调用，用不同 query 补充对照材料、冲突证据或后续报道来源。
- runtime 应按 run 维护 search ledger，记录 query、结果 URL、耗时、缓存命中和预算消耗。
- 相同 run 内相同 query 可缓存；不同 query 的重复 URL 应去重并保留来源关系。
- 搜索结果不是事实本身，Agent 必须在 EvidenceBoard 中标注哪些是事实、引用、推断和冲突。

## get_market_snapshot

职责：读取行情和市场状态。MVP 可以先没有真实实现；如果接 Alpaca 或其他行情源，应作为独立工具，不混进搜索工具。

```python
MarketField = Literal["quote", "prev_close", "intraday_change", "after_hours", "bars", "volume", "volatility"]


class MarketSnapshotInput(StrictModel):
    symbols: list[str] = Field(min_length=1, description="要读取行情的标的代码。")
    fields: list[MarketField] = Field(min_length=1, description="需要返回的行情字段。")
    time_window: str | None = Field(default=None, description="行情窗口，例如 intraday、1d、5d；具体支持由行情源决定。")


class SymbolMarketSnapshot(StrictModel):
    symbol: str = Field(description="标的代码。")
    quote: float | None = Field(default=None, description="最新可用报价。")
    prev_close: float | None = Field(default=None, description="前收盘价。")
    intraday_change_pct: float | None = Field(default=None, description="日内涨跌幅。")
    after_hours_change_pct: float | None = Field(default=None, description="盘后涨跌幅；源不支持时为空。")
    volume: float | None = Field(default=None, description="成交量。")
    bars_summary: str | None = Field(default=None, description="K 线数据较大时返回压缩摘要。")


class MarketSnapshotOutput(StrictModel):
    snapshot_id: str = Field(description="行情快照 ID。")
    as_of: datetime = Field(description="行情快照时间。")
    symbols: list[SymbolMarketSnapshot] = Field(description="按 symbol 返回的行情摘要。")
    artifact_id: str | None = Field(default=None, description="bars 或大结果保存为 artifact 后的 ID。")
    safe_summary: str = Field(description="不含敏感信息的行情摘要。")
```

边界：

- 只读行情和市场状态。
- 不读取账户，不生成订单。
- 是否暴露给 MainAgent 由 tool profile 决定；MVP 可以不实现该工具，后续也不必因为接入行情工具就立即新增 Market / Risk SubAgent。

## get_account_context

职责：读取行动计划所需的账户、仓位、风险预算、近期动作和用户策略。

```python
BrokerMode = Literal["disabled", "mock", "dry_run", "live_disabled"]
ActionType = Literal["notify", "monitor", "trade", "block"]


class RelationHint(StrictModel):
    key: str = Field(description="关联维度，例如 issuer、event_family、topic_key。")
    value: str = Field(description="关联维度的值。")


class AccountContextInput(StrictModel):
    symbols: list[str] = Field(default_factory=list, description="需要读取账户上下文的标的。")
    include_positions: bool = Field(default=True, description="是否返回当前持仓。")
    include_open_orders: bool = Field(default=True, description="是否返回未完成订单。")
    include_risk_limits: bool = Field(default=True, description="是否返回风险预算。")
    include_user_policy: bool = Field(default=True, description="是否返回用户自动审批策略摘要。")
    include_broker_mode: bool = Field(default=True, description="是否返回 broker 当前模式。")
    include_recent_activity: bool = Field(default=False, description="是否返回近期动作、通知和监控任务，用于去重。")
    activity_lookback_window: str | None = Field(default=None, description="近期活动窗口，例如 2h、24h。")
    relation_hints: list[RelationHint] = Field(default_factory=list, description="用于查找同主题历史动作的关联 hint。")


class PositionSnapshot(StrictModel):
    symbol: str = Field(description="标的代码。")
    quantity: float = Field(description="持仓数量。")
    market_value: float | None = Field(default=None, description="持仓市值。")
    average_cost: float | None = Field(default=None, description="平均成本。")
    unrealized_pnl: float | None = Field(default=None, description="未实现盈亏。")
    exposure_pct: float = Field(description="该标的占组合权益的比例。")


class RecentActionSummary(StrictModel):
    action_id: str = Field(description="近期动作 ID。")
    event_id: str = Field(description="动作关联的事件 ID。")
    action_type: ActionType = Field(description="动作类型。")
    symbols: list[str] = Field(default_factory=list, description="动作涉及标的。")
    status: str = Field(description="动作当前状态。")
    created_at: datetime = Field(description="动作创建时间。")
    idempotency_key: str | None = Field(default=None, description="动作幂等键。")
    relation_summary: str = Field(description="该动作与当前事件的关联说明。")


class RecentNotificationSummary(StrictModel):
    notification_id: str = Field(description="通知 ID。")
    event_id: str = Field(description="通知关联事件 ID。")
    topic_key: str | None = Field(default=None, description="通知主题 key，用于去重和串联。")
    title: str = Field(description="通知标题。")
    sent_at: datetime = Field(description="发送时间。")
    status: str = Field(description="发送状态。")


class MonitoringTaskSummary(StrictModel):
    task_id: str = Field(description="监控任务 ID。")
    symbols: list[str] = Field(default_factory=list, description="监控涉及标的。")
    trigger_summary: str = Field(description="触发条件摘要。")
    status: str = Field(description="任务状态。")


class RiskLimitsSnapshot(StrictModel):
    max_single_position_pct: float = Field(description="单标的最大持仓比例。")
    max_new_trade_notional: float = Field(description="单次新增交易最大名义金额。")
    max_daily_loss_pct: float | None = Field(default=None, description="单日最大亏损比例。")
    allow_short: bool = Field(description="是否允许做空。")
    allow_options: bool = Field(description="是否允许期权。")


class AutomationPolicySnapshot(StrictModel):
    auto_approve_enabled: bool = Field(description="是否启用自动审批。")
    auto_approve_min_confidence: float = Field(ge=0, le=1, description="自动审批最低置信度。")
    auto_approve_max_risk_level: str = Field(description="自动审批允许的最高风险等级。")
    auto_approve_max_notional: float = Field(description="自动审批允许的最大名义金额。")
    require_human_for_short: bool = Field(description="做空是否必须人工确认。")
    require_human_for_leverage: bool = Field(description="杠杆是否必须人工确认。")


class AccountContextOutput(StrictModel):
    account_scope: str = Field(description="当前账户范围摘要。")
    broker_mode: BrokerMode = Field(description="broker 当前模式。")
    cash_available: float | None = Field(default=None, description="可用现金；权限或源不可用时为空。")
    positions: list[PositionSnapshot] = Field(default_factory=list, description="当前持仓摘要。")
    open_orders: list[dict[str, Any]] = Field(default_factory=list, description="未完成订单摘要；MVP 可先保留 dict。")
    recent_actions: list[RecentActionSummary] = Field(default_factory=list, description="近期动作摘要。")
    recent_notifications: list[RecentNotificationSummary] = Field(default_factory=list, description="近期通知摘要。")
    existing_monitoring_tasks: list[MonitoringTaskSummary] = Field(default_factory=list, description="现有监控任务摘要。")
    risk_limits: RiskLimitsSnapshot | None = Field(default=None, description="风险限制摘要。")
    automation_policy: AutomationPolicySnapshot | None = Field(default=None, description="用户自动审批策略摘要。")
    safe_summary: str = Field(description="不含敏感信息的账户上下文摘要。")
```

边界：

- 只读。
- 不执行交易。
- 不修改用户策略。
- 默认只给 MainAgent；普通 Research SubAgent 不应看到完整账户上下文。

## EvidenceBoard

EvidenceBoard 不是工具，而是 Agent 产物。MainAgent 或 Research SubAgent 可以把多次搜索、行情快照、run context 和行业 mapping 收敛成统一结构。

```python
SourceKind = Literal["event", "search_result", "market_snapshot", "run_context", "prior_analysis", "industry_mapping"]
ClaimRole = Literal["raw_fact", "reference_point", "market_reaction", "interpretation", "conflict", "mapping"]
EventRelationship = Literal["new_information", "follow_up", "duplicate", "stale", "conflicting_update", "unknown"]


class EvidenceSourceItem(StrictModel):
    source_item_id: str = Field(description="证据来源项 ID。")
    source_kind: SourceKind = Field(description="来源类型。")
    title: str = Field(description="来源标题。")
    url: str | None = Field(default=None, description="来源 URL。")
    published_at: datetime | None = Field(default=None, description="来源发布时间。")
    observed_at: datetime | None = Field(default=None, description="系统观察到该来源的时间。")
    summary: str = Field(description="来源摘要。")
    reliability_score: float = Field(ge=0, le=1, description="来源可靠性评分。")
    freshness_score: float = Field(ge=0, le=1, description="来源时效性评分。")


class EvidenceClaim(StrictModel):
    claim_id: str = Field(description="证据 claim ID。")
    statement: str = Field(description="可被引用的结构化陈述。")
    role: ClaimRole = Field(description="该 claim 在分析中的角色。")
    source_item_ids: list[str] = Field(description="支持该 claim 的来源项 ID。")
    confidence_score: float = Field(ge=0, le=1, description="该 claim 的置信度。")


class EvidenceRelationSummary(StrictModel):
    relation_type: EventRelationship = Field(description="当前事件相对历史事件 / 动作的关系。")
    related_event_ids: list[str] = Field(default_factory=list, description="相关事件 ID。")
    reason_summary: str = Field(description="关系判断摘要。")


class EvidenceBoard(StrictModel):
    evidence_board_id: str = Field(description="EvidenceBoard ID。")
    source_items: list[EvidenceSourceItem] = Field(description="证据来源项。")
    claims: list[EvidenceClaim] = Field(description="从来源项中整理出的可引用 claim。")
    relation_summary: EvidenceRelationSummary = Field(description="事件关系摘要。")
    gaps: list[str] = Field(default_factory=list, description="缺口和未验证信息。")
    conflicts: list[str] = Field(default_factory=list, description="冲突证据或反方线索。")
    safe_summary: str = Field(description="不含敏感信息的证据板摘要。")
    artifact_id: str | None = Field(default=None, description="保存为 run artifact 后的 ID。")
```

## evaluate_thesis

职责：把 MainAgent 的投资论证、SubAgent 报告和 EvidenceBoard 转成可决策的评分和风险摘要。

```python
Direction = Literal["long", "short", "reduce", "close", "neutral"]
RiskLevel = Literal["low", "medium", "high", "critical"]
VerificationStatus = Literal["verified", "partial", "conflicting", "insufficient"]
PriorCoverageStatus = Literal["none", "partially_covered", "fully_covered", "conflicting"]
SuggestedIntent = Literal["record_only", "notify_only", "monitor", "propose_trade", "update_existing_plan", "block"]


class EvaluateThesisInput(StrictModel):
    industry_analysis_draft_id: str | None = Field(default=None, description="行业分析草案 artifact ID；优先使用，避免传大 JSON。")
    industry_analysis_draft: dict[str, Any] | None = Field(default=None, description="小草案可直接传；实现应优先使用 industry_analysis_draft_id。")
    evidence_board_artifact_id: str | None = Field(default=None, description="EvidenceBoard artifact ID；优先使用。")
    evidence_board: EvidenceBoard | None = Field(default=None, description="小证据板可直接传；大对象应传 evidence_board_artifact_id。")
    subagent_report_artifact_ids: list[str] = Field(default_factory=list, description="SubAgentReport artifact ID 列表；优先使用。报告 schema 以 09-agent-artifact-ownership.md 为准。")
    proposed_direction: Direction = Field(description="待评估方向。")
    target_symbols: list[str] = Field(default_factory=list, description="目标标的。")
    time_horizon: str = Field(description="投资论证的时间窗口。")
    recent_activity_summary: str | None = Field(default=None, description="近期动作覆盖摘要。")


class PriorCoverage(StrictModel):
    status: PriorCoverageStatus = Field(description="当前事件是否已被历史动作 / 通知覆盖。")
    related_action_ids: list[str] = Field(default_factory=list, description="相关动作 ID。")
    related_notification_ids: list[str] = Field(default_factory=list, description="相关通知 ID。")
    reason_summary: str = Field(description="覆盖判断摘要。")


class ThesisEvaluation(StrictModel):
    evaluation_id: str = Field(description="评估结果 ID。")
    confidence_score: float = Field(ge=0, le=1, description="投资论证置信度。")
    recommendation_score: float = Field(ge=0, le=1, description="推荐强度，不等于执行放行。")
    evidence_quality: str = Field(description="证据质量摘要。")
    upside_case: str = Field(description="正向论证摘要。")
    downside_case: str = Field(description="反向论证摘要。")
    counter_arguments: list[str] = Field(default_factory=list, description="反方观点。")
    risk_level: RiskLevel = Field(description="风险等级。")
    risk_flags: list[str] = Field(default_factory=list, description="风险标签。")
    verification_status: VerificationStatus = Field(description="验证状态。")
    materiality_score: float = Field(ge=0, le=1, description="事件重要性评分。")
    novelty_score: float = Field(ge=0, le=1, description="相对历史事件的新信息评分。")
    event_relationship: EventRelationship = Field(description="当前事件与历史主题的关系。")
    prior_coverage: PriorCoverage = Field(description="历史动作和通知覆盖情况。")
    suggested_intent: SuggestedIntent = Field(description="建议下一步意图。")
    reason_summary: str = Field(description="评估理由摘要。")
    artifact_id: str | None = Field(default=None, description="评估结果保存为 artifact 后的 ID；后续工具应优先引用它。")
```

边界：

- 可以内部运行评分、辩论和风险检查。
- 不输出具体订单。
- 不决定是否自动审批。

## build_action_plan

职责：把已评估的投资论证转成结构化行动计划草案。它负责计算“做多少、怎么做、止盈止损、什么情况下调整”，但仍不提交执行。

```python
IntendedAction = Literal["open_long", "open_short", "add", "reduce", "close", "monitor", "notify_only"]
ActionPlanIntent = Literal["notify_only", "monitor", "trade"]
ActionSide = Literal["increase_risk", "reduce_risk", "neutral"]
OrderSide = Literal["buy", "sell", "sell_short", "buy_to_cover"]
OrderIntent = Literal["open", "add", "reduce", "close"]
OrderType = Literal["market", "limit", "stop", "stop_limit"]
DeliveryPolicy = Literal["send", "suppress_duplicate", "update_existing_thread"]


class BuildActionPlanInput(StrictModel):
    industry_analysis_artifact_id: str | None = Field(default=None, description="IndustryAnalysis artifact ID；优先使用。")
    industry_analysis: dict[str, Any] | None = Field(default=None, description="小型 IndustryAnalysis 可直接传；实现应优先使用 industry_analysis_artifact_id。")
    thesis_evaluation_artifact_id: str | None = Field(default=None, description="ThesisEvaluation artifact ID；优先使用。")
    thesis_evaluation_id: str | None = Field(default=None, description="ThesisEvaluation 领域 ID；仅在评估结果已进入领域存储时使用。")
    thesis_evaluation: ThesisEvaluation | None = Field(default=None, description="小型评估对象可直接传；实现应优先使用 thesis_evaluation_artifact_id。")
    account_context_id: str | None = Field(default=None, description="AccountContext context ID；优先使用。")
    account_context: AccountContextOutput | None = Field(default=None, description="小型账户上下文可直接传；实现应优先使用 account_context_id。")
    target_symbols: list[str] = Field(min_length=1, description="行动涉及标的。")
    intended_action: IntendedAction = Field(description="MainAgent 希望构造的行动类型。")
    conviction: str = Field(description="定性 conviction，例如 low / medium / high。")
    time_horizon: str = Field(description="行动计划预期时间窗口。")
    max_risk_budget: float | None = Field(default=None, ge=0, description="可选最大风险预算。")
    constraints: list[str] = Field(default_factory=list, description="额外约束，例如 no leverage、dry-run only。")


class OrderDraft(StrictModel):
    symbol: str = Field(description="订单标的。")
    side: OrderSide = Field(description="订单方向。")
    order_intent: OrderIntent = Field(description="开仓、加仓、减仓或平仓意图。")
    quantity: float | None = Field(default=None, gt=0, description="数量；与 notional 可二选一。")
    notional: float | None = Field(default=None, gt=0, description="名义金额；与 quantity 可二选一。")
    portfolio_pct: float | None = Field(default=None, ge=0, le=1, description="交易后或目标组合占比。")
    order_type: OrderType = Field(description="订单类型。")
    limit_price: float | None = Field(default=None, gt=0, description="限价；仅限价类订单使用。")
    time_in_force: str | None = Field(default=None, description="订单有效期。")


class RiskControls(StrictModel):
    stop_loss: str | None = Field(default=None, description="止损规则，可先用自然语言表达。")
    take_profit: str | None = Field(default=None, description="止盈或止盈复核规则。")
    max_loss_amount: float | None = Field(default=None, ge=0, description="最大可承受损失金额。")
    max_position_pct_after_trade: float | None = Field(default=None, ge=0, le=1, description="交易后最大持仓比例。")
    invalidation_conditions: list[str] = Field(default_factory=list, description="行动失效条件。")


class MonitoringTrigger(StrictModel):
    metric: str = Field(description="监控指标。")
    condition: str = Field(description="触发条件。")
    action: str = Field(description="触发后的动作意图，例如 notify、reanalyze、reduce、close。")


class MonitoringPlan(StrictModel):
    triggers: list[MonitoringTrigger] = Field(default_factory=list, description="监控触发器。")
    review_after: str | None = Field(default=None, description="复核时间，例如 next_market_close。")


class UserNotificationDraft(StrictModel):
    title: str = Field(description="用户通知标题。")
    summary: str = Field(description="用户可读摘要。")
    key_points: list[str] = Field(default_factory=list, description="关键点。")
    risk_summary: str = Field(description="风险摘要。")
    delivery_policy: DeliveryPolicy = Field(description="发送、抑制重复或更新已有线程。")
    suppress_reason: str | None = Field(default=None, description="抑制通知的原因。")


class ActionPlan(StrictModel):
    action_plan_id: str = Field(description="行动计划 ID。")
    intent: ActionPlanIntent = Field(description="行动计划意图。")
    action_side: ActionSide = Field(description="对组合风险的影响。")
    target_symbols: list[str] = Field(default_factory=list, description="行动涉及标的。")
    related_event_ids: list[str] = Field(default_factory=list, description="相关事件 ID。")
    related_action_ids: list[str] = Field(default_factory=list, description="相关历史动作 ID。")
    orders: list[OrderDraft] = Field(default_factory=list, description="订单草案；submit 前不会执行。")
    risk_controls: RiskControls = Field(description="风险控制规则。")
    monitoring_plan: MonitoringPlan = Field(description="后续监控计划。")
    user_notification: UserNotificationDraft = Field(description="用户通知草案，由 submit_action_plan 决定是否触达。")
    confidence_score: float = Field(ge=0, le=1, description="计划所依据分析的置信度。")
    risk_level: RiskLevel = Field(description="计划风险等级。")
    risk_flags: list[str] = Field(default_factory=list, description="风险标签。")
    idempotency_key: str = Field(description="行动幂等键，用于防重复提交。")
    artifact_id: str | None = Field(default=None, description="行动计划保存为 artifact 后的 ID；submit_action_plan 应优先引用它。")
```

边界：

- 不调用 broker。
- 不创建审批。
- 不发送通知。
- 输出必须足够让 `submit_action_plan` 做统一决策。

## submit_action_plan

职责：MainAgent 唯一的行动提交工具。它接收 `ActionPlan`，内部完成 Decision、ApprovalPolicyResolver、Policy Gate、HITL、通知、监控任务和 broker dry-run/mock 编排。

```python
SubmitModeHint = Literal["notify_only", "approval_required", "auto_if_allowed", "block_if_risky"]
ResolvedMode = Literal["notify_only", "approval_required", "approval_with_timeout", "execute_then_notify", "manual_only", "blocked"]
PolicyGateStatus = Literal["not_required", "allowed", "denied", "unavailable", "failed"]
ExecutionStatus = Literal["not_requested", "mock_requested", "dry_run_requested", "request_failed"]
NotificationStatus = Literal["not_required", "sent", "suppressed", "failed"]


class SubmitActionPlanInput(StrictModel):
    action_plan_artifact_id: str | None = Field(default=None, description="ActionPlan artifact ID；优先使用，避免传大 JSON。")
    action_plan_id: str | None = Field(default=None, description="ActionPlan 领域 ID；仅在计划已进入领域存储时使用。")
    action_plan: ActionPlan | None = Field(default=None, description="仅当计划很小或尚未保存时直接传；实现应优先使用 action_plan_artifact_id。")
    industry_analysis_artifact_id: str | None = Field(default=None, description="IndustryAnalysis artifact ID；优先使用。")
    industry_analysis_id: str | None = Field(default=None, description="IndustryAnalysis 领域 ID；仅在分析已进入领域存储时使用。")
    industry_analysis: dict[str, Any] | None = Field(default=None, description="可选小型 IndustryAnalysis 对象；实现应优先使用 industry_analysis_artifact_id。")
    evidence_artifact_ids: list[str] = Field(default_factory=list, description="关联证据 artifact ID。")
    requested_mode_hint: SubmitModeHint | None = Field(default=None, description="MainAgent 对提交模式的提示，不代表最终审批结果。")
    dry_run_allowed: bool = Field(default=True, description="是否允许 dry-run / paper 请求。")
    idempotency_key: str = Field(description="提交幂等键。")


class ExecutedChangeSummary(StrictModel):
    symbol: str = Field(description="执行请求涉及标的。")
    side: str = Field(description="请求方向。")
    quantity: float | None = Field(default=None, description="请求数量。")
    notional: float | None = Field(default=None, description="请求名义金额。")
    status: str = Field(description="执行请求状态。")


class UserMessage(StrictModel):
    title: str = Field(description="最终用户消息标题。")
    summary: str = Field(description="最终用户消息摘要。")
    details: list[str] = Field(default_factory=list, description="用户可读细节。")


class SubmitActionPlanOutput(StrictModel):
    submission_id: str = Field(description="行动提交 ID。")
    resolved_mode: ResolvedMode = Field(description="平台解析后的提交模式。")
    policy_gate_status: PolicyGateStatus = Field(description="Policy Gate 状态。")
    approval_id: str | None = Field(default=None, description="需要人工审批时返回审批 ID。")
    execution_status: ExecutionStatus = Field(description="broker / dry-run 请求状态。")
    broker_request_id: str | None = Field(default=None, description="broker 请求 ID。")
    monitoring_task_ids: list[str] = Field(default_factory=list, description="创建或关联的监控任务 ID。")
    notification_ids: list[str] = Field(default_factory=list, description="创建或关联的通知 ID。")
    notification_status: NotificationStatus = Field(description="通知状态。")
    notification_suppression_reason: str | None = Field(default=None, description="通知被抑制时的原因。")
    executed_changes: list[ExecutedChangeSummary] = Field(default_factory=list, description="已请求的 mock / dry-run 变化。")
    user_message: UserMessage | None = Field(default=None, description="最终用户消息。")
    reason_summary: str = Field(description="平台决策摘要。")
    safe_audit_summary: str = Field(description="不含敏感信息的审计摘要。")
```

边界：

- 这是唯一会触发外部行动的 MainAgent 工具。
- 用户通知、审批提醒、执行结果通知都由它内部编排。
- 自动审批只来自用户策略和 Policy Gate，不来自 MainAgent 自己判断。
- 真实交易第一版仍不开放；broker 只允许 disabled、dry-run 或 mock。

## MainAgent 输出

MainAgent 最终仍必须产出 `IndustryAnalysis`。

```python
RelevanceRelationship = Literal["direct", "indirect", "contextual", "none"]


class RelevanceSummary(StrictModel):
    relationship: RelevanceRelationship = Field(description="事件与行业的关系。")
    reason_summary: str = Field(description="相关性理由摘要。")


class IndustryAnalysis(StrictModel):
    event_id: str = Field(description="当前事件 ID。")
    industry_plugin_id: str = Field(description="行业包 ID。")
    industry_plugin_version: str = Field(description="行业包版本。")
    analysis_run_id: str = Field(description="AgentRun ID。")
    impact_summary: str = Field(description="行业影响摘要。")
    relevance: RelevanceSummary = Field(description="行业相关性。")
    first_order_impacts: list[str] = Field(default_factory=list, description="一阶影响。")
    second_order_impacts: list[str] = Field(default_factory=list, description="二阶影响。")
    affected_markets: list[str] = Field(default_factory=list, description="受影响市场。")
    affected_symbols: list[str] = Field(default_factory=list, description="受影响标的。")
    evidence_artifact_ids: list[str] = Field(default_factory=list, description="关联证据 artifact。")
    counter_arguments: list[str] = Field(default_factory=list, description="反方观点。")
    confidence_score: float = Field(ge=0, le=1, description="分析置信度，不是执行放行分数。")
    recommended_actions: list[str] = Field(default_factory=list, description="建议动作摘要。")
    thesis_evaluation_artifact_id: str | None = Field(default=None, description="ThesisEvaluation artifact ID。")
    action_plan_artifact_id: str | None = Field(default=None, description="ActionPlan artifact ID；不是执行结果。")
    submission_id: str | None = Field(default=None, description="submit_action_plan 返回的提交 ID。")
    risk_flags: list[str] = Field(default_factory=list, description="风险标签。")
    requires_verification: bool = Field(description="是否需要进一步验证。")
    degradation_reason: str | None = Field(default=None, description="降级原因。")
    metadata: dict[str, Any] = Field(default_factory=dict, description="非核心扩展字段。")
```

约束：

- `confidence_score` 是分析置信度，不是执行放行分数。
- `action_plan_artifact_id` 是行动草案，不是执行结果。
- `submission_id` 指向 `submit_action_plan` 返回结果。
- `affected_symbols` 必须来自 market mapping，或明确标记为 inferred。
- `requires_verification=true` 时，`submit_action_plan` 应倾向 notify-only、monitor 或 approval，不应自动执行。

## 审计摘要

所有工具和 Agent step 的审计摘要至少包含：

```python
class ToolInvocationAuditSummary(StrictModel):
    agent_run_id: str = Field(description="AgentRun ID。")
    step_id: str = Field(description="Agent step ID。")
    tool_id: str | None = Field(default=None, description="工具 ID。")
    subagent_id: str | None = Field(default=None, description="SubAgent ID。")
    started_at: datetime = Field(description="开始时间。")
    ended_at: datetime | None = Field(default=None, description="结束时间。")
    status: str = Field(description="调用状态。")
    duration_ms: int | None = Field(default=None, ge=0, description="耗时。")
    input_summary: str = Field(description="脱敏输入摘要。")
    output_summary: str | None = Field(default=None, description="脱敏输出摘要。")
    artifact_ids: list[str] = Field(default_factory=list, description="本次调用产生或引用的 artifact。")
    error_code: str | None = Field(default=None, description="错误码。")
    safe_error_summary: str | None = Field(default=None, description="脱敏错误摘要。")
```

审计摘要不得包含 secret、完整 prompt、完整 provider raw response 或 chain-of-thought。
