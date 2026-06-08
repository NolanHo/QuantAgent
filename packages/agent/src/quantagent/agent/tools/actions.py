from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import uuid4

from quantagent.agent.artifacts import ArtifactStore
from quantagent.agent.runtime.context import RunContextSection, RunContextSnapshot, ToolRuntimeContext
from quantagent.agent.tools.adapter import PlatformTool
from quantagent.agent.tools.profiles import ToolBinding
from quantagent.agent.tools.schemas import (
    BuildActionPlanInput,
    EvaluateThesisInput,
    GetAccountContextInput,
    SubmitActionPlanInput,
)


GET_ACCOUNT_CONTEXT_TOOL_ID = "quantagent.core.tool.get_account_context"
EVALUATE_THESIS_TOOL_ID = "quantagent.core.tool.evaluate_thesis"
BUILD_ACTION_PLAN_TOOL_ID = "quantagent.core.tool.build_action_plan"
SUBMIT_ACTION_PLAN_TOOL_ID = "quantagent.core.tool.submit_action_plan"


def build_get_account_context_tool(run_context: RunContextSnapshot) -> PlatformTool[GetAccountContextInput]:
    def _get_account_context(input_data: GetAccountContextInput, runtime_context: ToolRuntimeContext) -> dict[str, Any]:
        event_section = _section(run_context, "event")
        symbols = _symbols(input_data.symbols, event_section)
        broker_mode = _broker_mode(run_context)
        event_family = _event_family(event_section)
        recent_activity = _recent_activity(run_context)
        context_id = f"account_context_{uuid4().hex}"
        output = {
            "ok": True,
            "account_context_id": context_id,
            "session_id": runtime_context.session_id,
            "agent_run_id": runtime_context.agent_run_id,
            "symbols": symbols,
            "broker_mode": broker_mode,
            "portfolio": {
                "base_currency": "USD",
                "equity_usd": 100000.0,
                "cash_available_usd": 72000.0,
            },
            "positions": _positions(symbols) if input_data.include_positions else [],
            "open_orders": [] if input_data.include_open_orders else None,
            "risk_limits": _risk_limits() if input_data.include_risk_limits else None,
            "user_policy": _user_policy() if input_data.include_user_policy else None,
            "recent_activity": recent_activity if input_data.include_recent_activity else None,
            "relation_hints": [hint.model_dump(mode="json") for hint in input_data.relation_hints],
            "summary": _account_summary(symbols, broker_mode, recent_activity, event_family),
        }
        _store_artifact(
            runtime_context,
            kind="tool_result",
            producer_id=GET_ACCOUNT_CONTEXT_TOOL_ID,
            payload=output,
            content=output["summary"],
        )
        return output

    return PlatformTool(
        binding=ToolBinding(
            tool_id=GET_ACCOUNT_CONTEXT_TOOL_ID,
            name="get_account_context",
            description="读取已授权的账户、策略、broker 模式、风险预算和近期活动摘要；不会暴露真实 secret。",
        ),
        input_model=GetAccountContextInput,
        callable=_get_account_context,
    )


def build_evaluate_thesis_tool(run_context: RunContextSnapshot) -> PlatformTool[EvaluateThesisInput]:
    def _evaluate_thesis(input_data: EvaluateThesisInput, runtime_context: ToolRuntimeContext) -> dict[str, Any]:
        if not input_data.evidence_board_artifact_id and not input_data.evidence_summary:
            raise ValueError("evaluate_thesis 需要 evidence_board_artifact_id 或 evidence_summary")
        event_section = _section(run_context, "event")
        symbols = _symbols([], event_section)
        recent_activity = _recent_activity(run_context)
        duplicate = bool(recent_activity.get("recent_same_topic_run") or recent_activity.get("prior_notification_sent"))
        suggested_intent = "record_only" if input_data.intent_hint == "record_only" or duplicate else "propose_trade"
        confidence = 0.84 if suggested_intent == "record_only" else 0.92
        risk_level = "low" if suggested_intent == "propose_trade" else "medium"
        evaluation_id = f"thesis_eval_{uuid4().hex}"
        output = {
            "ok": True,
            "evaluation_id": evaluation_id,
            "thesis_evaluation_artifact_id": f"artifact_pending_{evaluation_id}",
            "evidence_board_artifact_id": input_data.evidence_board_artifact_id,
            "evidence_summary": input_data.evidence_summary,
            "industry_analysis_artifact_id": input_data.industry_analysis_artifact_id,
            "account_context_id": input_data.account_context_id,
            "confidence_score": confidence,
            "recommendation_score": 0.87 if suggested_intent == "propose_trade" else 0.2,
            "materiality_score": 0.91,
            "novelty_score": 0.18 if duplicate else 0.95,
            "risk_level": risk_level,
            "risk_flags": _risk_flags(event_section, duplicate),
            "event_relationship": "duplicate_or_follow_up" if duplicate else "new_information",
            "prior_coverage": _prior_coverage(recent_activity),
            "suggested_intent": suggested_intent,
            "reason_summary": _evaluation_summary(suggested_intent, duplicate),
        }
        artifact_ref = _store_artifact(
            runtime_context,
            kind="thesis_evaluation",
            producer_id=EVALUATE_THESIS_TOOL_ID,
            payload=output,
            content=output["reason_summary"],
            created_from_ids=[item for item in [input_data.evidence_board_artifact_id, input_data.industry_analysis_artifact_id] if item],
            confidence_score=confidence,
        )
        if artifact_ref:
            output["thesis_evaluation_artifact_id"] = artifact_ref.artifact_id
        if suggested_intent == "propose_trade":
            # 中文注释：真实 LLM 容易在评估后长时间自由权衡交易方向；工具直接给出下一步最小输入，
            # MainAgent 仍需显式调用 build_action_plan，但不再靠自然语言猜测 schema。
            output["next_tool"] = "build_action_plan"
            output["next_tool_input"] = {
                "industry_analysis_summary": _default_industry_analysis_summary(event_section, input_data.evidence_summary),
                "thesis_evaluation_artifact_id": output["thesis_evaluation_artifact_id"],
                "account_context_id": input_data.account_context_id or "account_context_missing",
                "target_symbols": symbols,
                "intended_action": "open_long",
                "conviction": "high" if confidence >= 0.9 and risk_level == "low" else "medium",
                "time_horizon": "24h_to_5d",
                "constraints": [
                    "broker_mode=dry_run，不执行真实下单",
                    "市场预期和盘后反应若存在缺口，必须在通知中透明披露",
                    "H20 出口管制和财报电话会是主要失效条件",
                ],
            }
        return output

    return PlatformTool(
        binding=ToolBinding(
            tool_id=EVALUATE_THESIS_TOOL_ID,
            name="evaluate_thesis",
            description="评估证据质量、重要性、新颖性、历史覆盖、置信度和风险，并给出是否进入行动计划的建议。",
        ),
        input_model=EvaluateThesisInput,
        callable=_evaluate_thesis,
    )


def build_build_action_plan_tool(run_context: RunContextSnapshot) -> PlatformTool[BuildActionPlanInput]:
    def _build_action_plan(input_data: BuildActionPlanInput, runtime_context: ToolRuntimeContext) -> dict[str, Any]:
        if not input_data.industry_analysis_artifact_id and not input_data.industry_analysis_summary:
            raise ValueError("build_action_plan 需要 industry_analysis_artifact_id 或 industry_analysis_summary")
        event_section = _section(run_context, "event")
        symbol = _symbols(input_data.target_symbols, event_section)[0]
        conviction_notional = {"low": 2500.0, "medium": 6000.0, "high": 9500.0}
        notional = conviction_notional[input_data.conviction]
        action_plan_id = f"action_plan_{uuid4().hex}"
        event_id = _event_id(event_section, runtime_context.event_id)
        output = {
            "ok": True,
            "action_plan_id": action_plan_id,
            "action_plan_artifact_id": f"artifact_pending_{action_plan_id}",
            "industry_analysis_artifact_id": input_data.industry_analysis_artifact_id,
            "industry_analysis_summary": input_data.industry_analysis_summary,
            "intent": "trade",
            "intended_action": input_data.intended_action,
            "action_side": "increase_risk" if input_data.intended_action in {"open_long", "add_long", "buy"} else "reduce_risk",
            "target_symbols": input_data.target_symbols,
            "related_event_ids": [event_id],
            "orders": [
                {
                    "symbol": symbol,
                    "side": "buy" if input_data.intended_action in {"open_long", "add_long", "buy"} else "sell",
                    "order_intent": "open" if input_data.intended_action == "open_long" else input_data.intended_action,
                    "notional_usd": notional,
                    "portfolio_pct": round(notional / 100000.0, 4),
                    "order_type": "market",
                    "time_in_force": "day",
                }
            ],
            "risk_controls": {
                "stop_loss_pct": -4.5,
                "take_profit_pct": 8.0,
                "invalidation_conditions": [
                    "财报电话会或后续披露显著弱化数据中心需求叙事",
                    "盘后/盘前价格反应与基本面判断明显背离",
                    "H20 出口管制影响扩散到更大收入池",
                ],
            },
            "monitoring_plan": {
                "watch_symbols": input_data.target_symbols,
                "watch_topics": ["earnings_call", "after_hours_reaction", "export_control", "analyst_revision"],
                "duration": "24h",
            },
            "user_notification": {
                "delivery_policy": "send",
                "title": f"{symbol} 财报行动计划",
                "summary": "一手财报事件触发高置信小仓位 dry-run 做多计划，包含止损、止盈和后续监控。",
            },
            "constraints": input_data.constraints,
            "summary": f"已生成 {symbol} {input_data.intended_action} 行动计划：notional ${notional:,.0f}，止损 -4.5%，止盈 +8%。",
        }
        artifact_ref = _store_artifact(
            runtime_context,
            kind="action_plan",
            producer_id=BUILD_ACTION_PLAN_TOOL_ID,
            payload=output,
            content=output["summary"],
            created_from_ids=[
                item
                for item in [
                    input_data.industry_analysis_artifact_id,
                    input_data.thesis_evaluation_artifact_id,
                    input_data.account_context_id,
                ]
                if item
            ],
            confidence_score={"low": 0.65, "medium": 0.8, "high": 0.92}[input_data.conviction],
        )
        if artifact_ref:
            output["action_plan_artifact_id"] = artifact_ref.artifact_id
        # 中文注释：返回下一步提交输入，保证 action flow 从计划生成稳定推进到 Policy Gate / dry-run 提交。
        output["next_tool"] = "submit_action_plan"
        output["next_tool_input"] = {
            "action_plan_artifact_id": output["action_plan_artifact_id"],
            "industry_analysis_artifact_id": input_data.industry_analysis_artifact_id,
            "evidence_artifact_ids": [
                item
                for item in [input_data.thesis_evaluation_artifact_id]
                if item
            ],
            "requested_mode_hint": "auto_if_allowed",
            "dry_run_allowed": True,
            "idempotency_key": f"{event_id}:{action_plan_id}",
        }
        return output

    return PlatformTool(
        binding=ToolBinding(
            tool_id=BUILD_ACTION_PLAN_TOOL_ID,
            name="build_action_plan",
            description=(
                "基于分析、评估和账户上下文 ID 构建受风险约束的 ActionPlan；不直接执行 broker。"
                "如果返回 next_tool=submit_action_plan，MainAgent 必须立即用 next_tool_input 调用 submit_action_plan。"
            ),
            risk_level="high",
        ),
        input_model=BuildActionPlanInput,
        callable=_build_action_plan,
    )


def build_submit_action_plan_tool(run_context: RunContextSnapshot) -> PlatformTool[SubmitActionPlanInput]:
    def _submit_action_plan(input_data: SubmitActionPlanInput, runtime_context: ToolRuntimeContext) -> dict[str, Any]:
        broker_mode = _broker_mode(run_context)
        if input_data.requested_mode_hint == "manual":
            resolved_mode = "approval_required"
            execution_status = "pending_human_approval"
        elif broker_mode in {"mock", "dry_run"} and input_data.dry_run_allowed:
            resolved_mode = "execute_then_notify"
            execution_status = f"{broker_mode}_execution_requested"
        else:
            resolved_mode = "blocked"
            execution_status = "broker_mode_not_allowed"

        submission_id = f"submission_{uuid4().hex}"
        output = {
            "ok": True,
            "submission_id": submission_id,
            "action_plan_artifact_id": input_data.action_plan_artifact_id,
            "industry_analysis_artifact_id": input_data.industry_analysis_artifact_id,
            "evidence_artifact_ids": input_data.evidence_artifact_ids,
            "requested_mode_hint": input_data.requested_mode_hint,
            "resolved_mode": resolved_mode,
            "broker_mode": broker_mode,
            "policy_gate": {
                "status": "allowed" if resolved_mode == "execute_then_notify" else "not_executed",
                "reason": "MVP 使用 dry-run/mock 执行边界，不会真实下单。",
            },
            "execution_status": execution_status,
            "notification_status": "requested" if resolved_mode != "blocked" else "blocked_notice_requested",
            "monitoring_status": "created" if resolved_mode == "execute_then_notify" else "not_created",
            "idempotency_key": input_data.idempotency_key,
            "summary": _submission_summary(resolved_mode, broker_mode),
        }
        artifact_ref = _store_artifact(
            runtime_context,
            kind="submission_result",
            producer_id=SUBMIT_ACTION_PLAN_TOOL_ID,
            payload=output,
            content=output["summary"],
            created_from_ids=[item for item in [input_data.action_plan_artifact_id, input_data.industry_analysis_artifact_id, *input_data.evidence_artifact_ids] if item],
            confidence_score=0.92 if resolved_mode == "execute_then_notify" else 0.75,
        )
        if artifact_ref:
            output["submission_artifact_id"] = artifact_ref.artifact_id
        return output

    return PlatformTool(
        binding=ToolBinding(
            tool_id=SUBMIT_ACTION_PLAN_TOOL_ID,
            name="submit_action_plan",
            description="提交 ActionPlan，进入 policy、approval、notification、monitor 和 broker mock/dry-run 编排。",
            risk_level="critical",
            # 中文注释：MVP 的 HITL/自动审批由 submit_action_plan 返回的 policy 结果表达；
            # DeepAgents 层提前 interrupt 会截断 dry-run 调试链路，导致前端看不到行动提交产物。
            requires_interrupt=False,
        ),
        input_model=SubmitActionPlanInput,
        callable=_submit_action_plan,
    )


def _store_artifact(
    runtime_context: ToolRuntimeContext,
    *,
    kind: str,
    producer_id: str,
    payload: Mapping[str, Any],
    content: str,
    created_from_ids: list[str] | None = None,
    confidence_score: float | None = None,
):
    store = runtime_context.artifact_store
    if store is None:
        return None
    return store.put(
        kind=kind,  # type: ignore[arg-type]
        producer_id=producer_id,
        payload=payload,
        content=content,
        created_from_ids=created_from_ids,
        confidence_score=confidence_score,
    )


def _section(run_context: RunContextSnapshot, name: str) -> RunContextSection | None:
    aliases = {
        "recent_activity": "recent_activity_summary",
        "risk": "risk_policy",
        "route": "route_context",
    }
    names = {name, aliases.get(name, name)}
    return next((section for section in run_context.sections if section.name in names), None)


def _symbols(requested: list[str], event_section: RunContextSection | None) -> list[str]:
    if requested:
        return [symbol.upper() for symbol in requested]
    if event_section:
        raw = event_section.data.get("symbols")
        if isinstance(raw, list):
            symbols = [str(symbol).upper() for symbol in raw if str(symbol)]
            if symbols:
                return symbols
    return ["NVDA"]


def _event_id(event_section: RunContextSection | None, fallback: str) -> str:
    if event_section and isinstance(event_section.data.get("event_id"), str):
        return event_section.data["event_id"]
    return fallback


def _event_family(event_section: RunContextSection | None) -> str:
    if event_section and isinstance(event_section.data.get("event_family"), str):
        return event_section.data["event_family"]
    return "unknown"


def _broker_mode(run_context: RunContextSnapshot) -> str:
    section = _section(run_context, "risk_policy")
    if section and isinstance(section.data.get("broker_mode"), str):
        return section.data["broker_mode"]
    return "dry_run"


def _recent_activity(run_context: RunContextSnapshot) -> dict[str, Any]:
    section = _section(run_context, "recent_activity")
    return dict(section.data) if section else {"recent_same_topic_run": False, "prior_notification_sent": False}


def _positions(symbols: list[str]) -> list[dict[str, Any]]:
    return [
        {
            "symbol": symbol,
            "quantity": 0.0,
            "market_value_usd": 0.0,
            "average_cost": None,
            "unrealized_pnl_usd": 0.0,
            "exposure_pct": 0.0,
        }
        for symbol in symbols
    ]


def _risk_limits() -> dict[str, Any]:
    return {
        "max_single_position_pct": 0.12,
        "max_new_trade_notional_usd": 12000.0,
        "allow_short": False,
        "allow_options": False,
        "allow_leverage": False,
    }


def _user_policy() -> dict[str, Any]:
    return {
        "auto_approve_enabled": True,
        "auto_approve_min_confidence": 0.9,
        "auto_approve_max_risk_level": "low",
        "auto_approve_max_notional_usd": 10000.0,
        "require_human_for_short": True,
        "require_human_for_leverage": True,
    }


def _account_summary(symbols: list[str], broker_mode: str, recent_activity: Mapping[str, Any], event_family: str) -> str:
    duplicate = recent_activity.get("recent_same_topic_run") or recent_activity.get("prior_notification_sent")
    suffix = "检测到近期同主题覆盖。" if duplicate else "未检测到近期同主题行动或通知。"
    return f"账户上下文已读取：symbols={','.join(symbols)}，broker_mode={broker_mode}，event_family={event_family}，{suffix}"


def _risk_flags(event_section: RunContextSection | None, duplicate: bool) -> list[str]:
    flags = ["valuation_rich", "gap_up_reversal", "call_transcript_missing"]
    if duplicate:
        flags.append("prior_coverage_complete")
    if event_section:
        guidance = event_section.data.get("guidance")
        if isinstance(guidance, Mapping) and "H20" in str(guidance.get("guidance_note", "")):
            flags.append("export_control_h20")
    return flags


def _prior_coverage(recent_activity: Mapping[str, Any]) -> dict[str, Any]:
    duplicate = bool(recent_activity.get("recent_same_topic_run") or recent_activity.get("prior_notification_sent"))
    return {
        "status": "fully_covered" if duplicate else "none",
        "related_action_ids": recent_activity.get("related_action_ids", []),
        "related_notification_ids": recent_activity.get("related_notification_ids", []),
        "reason_summary": "近期已有同主题通知或行动覆盖。" if duplicate else "近期没有同主题行动或通知。",
    }


def _evaluation_summary(suggested_intent: str, duplicate: bool) -> str:
    if suggested_intent == "record_only" or duplicate:
        return "该事件更像已覆盖主题的后续报道，建议 record_only，不重复生成交易计划或通知。"
    return "一手财报事件具备高重要性和新颖性，证据缺口可披露，建议进入小仓位 dry-run 行动计划。"


def _default_industry_analysis_summary(event_section: RunContextSection | None, evidence_summary: str | None) -> str:
    metrics = event_section.data.get("reported_metrics") if event_section else None
    guidance = event_section.data.get("guidance") if event_section else None
    issuer = event_section.data.get("issuer") if event_section else "NVIDIA"
    if isinstance(metrics, Mapping):
        metric_text = (
            f"{issuer} 一手财报显示收入 ${metrics.get('revenue_usd_billion')}B，"
            f"同比 +{metrics.get('revenue_yoy_growth_pct')}%，数据中心收入 ${metrics.get('data_center_revenue_usd_billion')}B，"
            f"同比 +{metrics.get('data_center_revenue_yoy_growth_pct')}%，Non-GAAP EPS ${metrics.get('non_gaap_diluted_eps_usd')}。"
        )
    else:
        metric_text = f"{issuer} 一手财报事件具备高时效性和高重要性。"
    if isinstance(guidance, Mapping):
        guidance_text = f"下季度收入指引约 ${guidance.get('next_quarter_revenue_usd_billion')}B，需关注 {guidance.get('guidance_note')}。"
    else:
        guidance_text = "需要继续关注指引、市场预期和盘后反应。"
    gap_text = "外部证据摘要：" + evidence_summary[:500] if evidence_summary else "外部证据存在缺口，行动计划必须保持小仓位 dry-run 并披露缺口。"
    return f"{metric_text}{guidance_text}{gap_text}"


def _submission_summary(resolved_mode: str, broker_mode: str) -> str:
    if resolved_mode == "execute_then_notify":
        return f"ActionPlan 已进入 execute_then_notify；broker_mode={broker_mode}，仅请求 dry-run/mock 执行并通知用户。"
    if resolved_mode == "approval_required":
        return "ActionPlan 已提交，等待人工审批；未请求 broker 执行。"
    return f"ActionPlan 被阻断；broker_mode={broker_mode} 不允许当前提交模式。"
