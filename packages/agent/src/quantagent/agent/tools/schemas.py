from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ToolInvocationSummary(StrictModel):
    invocation_id: str = Field(description="运行时工具调用 ID。")
    tool_id: str = Field(description="稳定的平台工具 ID。")
    name: str = Field(description="DeepAgents 可见的工具名。")
    status: str = Field(description="工具状态：started、completed 或 failed。")
    content: str = Field(description="本次工具调用的展示 / 运行时内容。")


class GetRunContextInput(StrictModel):
    sections: list[str] = Field(
        min_length=1,
        description="要从当前 run 读取的上下文 sections；event_id 和 run_id 由运行时自动注入。",
    )
    symbols: list[str] = Field(default_factory=list, description="可选 ticker 列表，用于压缩市场映射或近期活动上下文。")
    max_tokens: int | None = Field(default=None, ge=256, le=8000, description="请求的上下文预算；运行时可以进一步收紧。")


class SearchWebInput(StrictModel):
    query: str = Field(min_length=3, max_length=500, description="窄范围公开网页检索 query。")
    topic: Literal["news", "general", "finance", "company", "regulation"] = Field(
        default="general",
        description="业务检索意图；运行时会映射到 provider 支持的 topic，用于缓存和审计分组。",
    )
    time_window: str | None = Field(default=None, description="检索时间窗口，例如 1h、24h、7d；provider 不支持的自定义范围会被忽略。")
    max_results: int | None = Field(default=None, ge=1, le=10, description="请求返回结果数量；运行时可以调低。")
    include_answer: bool = Field(default=False, description="是否请求 provider answer；answer 只能作为线索，不能直接当事实。")
    include_raw_content: bool = Field(default=False, description="MVP 默认不请求 raw content，避免工具结果过大。")
    domains_allowlist: list[str] = Field(default_factory=list, description="可选的检索域名 allowlist。")
    domains_blocklist: list[str] = Field(default_factory=list, description="可选的检索域名 blocklist。")


class RelationHintInput(StrictModel):
    key: str = Field(min_length=1, description="关系维度，例如 issuer、event_family 或 topic_key。")
    value: str = Field(min_length=1, description="用于查找已覆盖 action 或 notification 的关系值。")


class GetAccountContextInput(StrictModel):
    symbols: list[str] = Field(default_factory=list, description="用于限定账户和近期活动摘要范围的 ticker 列表。")
    include_positions: bool = Field(default=True, description="是否包含当前持仓。")
    include_open_orders: bool = Field(default=True, description="是否包含未完成订单。")
    include_risk_limits: bool = Field(default=True, description="是否包含风险限制。")
    include_user_policy: bool = Field(default=True, description="是否包含用户自动化策略摘要。")
    include_broker_mode: bool = Field(default=True, description="是否包含当前 broker 模式。")
    include_recent_activity: bool = Field(default=False, description="是否包含近期 action、notification 和 monitor。")
    activity_lookback_window: str | None = Field(default=None, description="近期活动回看窗口，例如 2h 或 24h。")
    relation_hints: list[RelationHintInput] = Field(default_factory=list, description="同主题 action 查询提示。")


class EvaluateThesisInput(StrictModel):
    evidence_board_artifact_id: str | None = Field(
        default=None,
        description="本次 run 产出的 EvidenceBoard artifact id；优先传 ID，缺失时必须提供 evidence_summary。",
    )
    evidence_summary: str | None = Field(
        default=None,
        min_length=1,
        description="没有 EvidenceBoard artifact id 时的压缩证据摘要；用于 Tavily 缺 key或 SubAgent 只返回文本的降级路径。",
    )
    industry_analysis_artifact_id: str | None = Field(
        default=None,
        description="评估前已有 draft 时可传入 IndustryAnalysis artifact id。",
    )
    account_context_id: str | None = Field(default=None, description="用于新颖性和历史覆盖检查的可选账户上下文 ID。")
    intent_hint: Literal["evaluate", "propose_trade", "record_only"] = Field(
        default="evaluate",
        description="MainAgent 请求的评估模式；最终建议意图仍由工具负责。",
    )


class BuildActionPlanInput(StrictModel):
    industry_analysis_artifact_id: str | None = Field(
        default=None,
        description="IndustryAnalysis draft artifact id；优先传 ID，缺失时必须提供 industry_analysis_summary。",
    )
    industry_analysis_summary: str | None = Field(
        default=None,
        min_length=1,
        description="没有 IndustryAnalysis artifact id 时的压缩分析摘要，用于真实 Chat MVP 的降级路径。",
    )
    thesis_evaluation_artifact_id: str = Field(description="ThesisEvaluation artifact id。")
    account_context_id: str = Field(description="已授权账户上下文 ID。")
    target_symbols: list[str] = Field(min_length=1, description="行动计划覆盖的 ticker 列表。")
    intended_action: str = Field(min_length=1, description="通用行动意图，例如 open_long 或 reduce_risk。")
    conviction: Literal["low", "medium", "high"] = Field(description="已评估 thesis 的置信分桶。")
    time_horizon: str = Field(min_length=1, description="预期行动周期。")
    constraints: list[str] = Field(default_factory=list, description="少量非敏感的风险和执行约束。")


class SubmitActionPlanInput(StrictModel):
    action_plan_artifact_id: str = Field(description="要提交的 ActionPlan artifact id。")
    industry_analysis_artifact_id: str | None = Field(default=None, description="与该 action 关联的 IndustryAnalysis artifact id；MVP 可为空。")
    evidence_artifact_ids: list[str] = Field(default_factory=list, description="支持该 action 的证据 artifact id 列表。")
    requested_mode_hint: Literal["auto_if_allowed", "manual", "dry_run_only"] = Field(
        default="auto_if_allowed",
        description="请求的提交模式提示；最终模式仍由 policy gate 决定。",
    )
    dry_run_allowed: bool = Field(default=True, description="是否允许 dry-run 或 mock execution。")
    idempotency_key: str = Field(min_length=1, description="本次 action request 的稳定幂等键。")
