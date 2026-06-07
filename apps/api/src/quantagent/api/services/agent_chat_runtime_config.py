from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from quantagent.agent.definitions.assets import (
    filter_agent_assets_by_available_tools,
    load_agent_assets_from_directory,
)
from quantagent.agent.definitions.models import AgentDefinition
from quantagent.agent.runtime.context import RunContextSection, RunContextSnapshot
from quantagent.agent.tools import GET_RUN_CONTEXT_TOOL_ID, SEARCH_WEB_TOOL_ID
from quantagent.agent.tools.profiles import ToolProfile
from quantagent.core.db.models.agent_chat import AgentChatRunORM, AgentChatSessionORM

SEMICONDUCTOR_INDUSTRY_ID = "quantagent.official.industry.semiconductor"
SEMICONDUCTOR_MAIN_AGENT_ID = "quantagent.official.industry.semiconductor.agent.main"
NVDA_EARNINGS_ROUTED_EVENT = "nvda-earnings"
NVDA_MEDIA_FOLLOWUP_ROUTED_EVENT = "nvda-media-followup"

_SUPPORTED_ROUTED_EVENTS = {NVDA_EARNINGS_ROUTED_EVENT, NVDA_MEDIA_FOLLOWUP_ROUTED_EVENT}
_AVAILABLE_AGENT_CHAT_TOOL_IDS = {GET_RUN_CONTEXT_TOOL_ID, SEARCH_WEB_TOOL_ID}


@dataclass(frozen=True)
class AgentChatRuntimeAssets:
    agent_definition: AgentDefinition
    tool_profile: ToolProfile
    subagent_tool_profiles: dict[str, ToolProfile]


def default_industry_id() -> str:
    return SEMICONDUCTOR_INDUSTRY_ID


def default_agent_id() -> str:
    return SEMICONDUCTOR_MAIN_AGENT_ID


def default_routed_event_preset() -> str:
    return NVDA_EARNINGS_ROUTED_EVENT


def normalize_routed_event_preset(value: str | None) -> str | None:
    if value in _SUPPORTED_ROUTED_EVENTS:
        return value
    return None


def build_agent_chat_assets(*, industry_id: str, agent_id: str) -> AgentChatRuntimeAssets:
    if industry_id != SEMICONDUCTOR_INDUSTRY_ID or agent_id != SEMICONDUCTOR_MAIN_AGENT_ID:
        raise ValueError(f"unsupported Agent Chat industry/agent selection: {industry_id} / {agent_id}")

    loaded = _load_semiconductor_assets()
    agent_definition, tool_profile, subagent_profiles = filter_agent_assets_by_available_tools(
        loaded.agent_definition,
        loaded.tool_profile,
        loaded.subagent_tool_profiles,
        available_tool_ids=_AVAILABLE_AGENT_CHAT_TOOL_IDS,
    )
    return AgentChatRuntimeAssets(
        agent_definition=_agent_definition_for_chat_mvp(agent_definition),
        tool_profile=tool_profile,
        subagent_tool_profiles=subagent_profiles,
    )


def build_agent_chat_run_context(row: AgentChatSessionORM, run: AgentChatRunORM, *, message: str) -> RunContextSnapshot:
    routed_event = _routed_event_preset(row)
    sections = [
        _event_context_section(routed_event, message),
        RunContextSection(
            name="route_context",
            summary=_route_summary(routed_event),
            data={
                "session_id": row.session_id,
                "thread_id": row.thread_id,
                "workspace_id": row.workspace_id,
                "agent_run_id": run.agent_run_id,
                "routed_event_preset": routed_event,
                **_route_data(routed_event),
            },
        ),
        RunContextSection(
            name="industry_profile",
            summary=(
                "半导体 MVP MainAgent 需要识别事件时效性、一手证据、市场预期缺口、市场反应、重复报道，"
                "并判断是否需要行动计划和用户通知。"
            ),
            data={"industry_id": row.industry_id, "primary_symbols": ["NVDA"], "default_agent_id": row.agent_id},
        ),
        RunContextSection(
            name="market_mapping",
            summary="NVDA 对应半导体 AI 加速器供应链敞口，是本次调试事件的主 ticker。",
            data={"symbols": ["NVDA"], "issuer": "NVIDIA", "sector": "semiconductors", "topic_key": "nvda_earnings"},
        ),
        RunContextSection(
            name="risk_policy",
            summary=(
                "MVP Agent Chat 不执行真实 broker 操作。如果事件看起来需要行动，只输出分析和行动计划草案，"
                "并说明完整交易闭环中哪些内容需要进入 Policy Gate 或人工审批。"
            ),
            data={"broker_mode": "disabled", "real_trade_execution": False, "approval_required_for_live_trade": True},
        ),
        RunContextSection(
            name="tool_profile",
            summary="当前 Agent Chat 已注册业务工具是 get_run_context 和 search_web。DeepAgents 内置工具存在，但不作为业务上下文来源。",
            data={"tools": [GET_RUN_CONTEXT_TOOL_ID, SEARCH_WEB_TOOL_ID]},
        ),
        _recent_activity_section(routed_event),
    ]
    return RunContextSnapshot(
        context_id=f"context_{run.run_id}",
        sections=sections,
        content="\n".join(f"{section.name}: {section.summary}" for section in sections),
    )


@dataclass(frozen=True)
class _LoadedAssets:
    agent_definition: AgentDefinition
    tool_profile: ToolProfile
    subagent_tool_profiles: dict[str, ToolProfile]


@lru_cache(maxsize=1)
def _load_semiconductor_assets() -> _LoadedAssets:
    agent_dir = _repo_root() / "plugins" / "industries" / "semiconductor-industry" / "agents"
    agent_definition, tool_profile, subagent_profiles = load_agent_assets_from_directory(agent_dir)
    return _LoadedAssets(
        agent_definition=agent_definition,
        tool_profile=tool_profile,
        subagent_tool_profiles=subagent_profiles,
    )


def _repo_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "plugins" / "industries").is_dir() and (parent / "pyproject.toml").is_file():
            return parent
    raise RuntimeError("repo root with plugins/industries not found")


def _agent_definition_for_chat_mvp(agent_definition: AgentDefinition) -> AgentDefinition:
    suffix = (
        "\n\n"
        "Agent Chat MVP 运行约束：当前真实调试链路只注册 get_run_context 和 search_web 两个业务工具。"
        "如果完整行业 prompt 中提到 get_account_context、evaluate_thesis、build_action_plan 或 submit_action_plan，"
        "本轮只能把它们视为后续正式行动闭环能力，不要尝试调用。"
        "当你判断需要行动计划或通知时，请输出草案和缺失工具说明，而不是声明已经提交、审批、通知或成交。"
    )
    return agent_definition.model_copy(update={"system_prompt": f"{agent_definition.system_prompt}{suffix}"})


def _routed_event_preset(row: AgentChatSessionORM) -> str | None:
    metadata = row.metadata_json if isinstance(row.metadata_json, dict) else {}
    value = metadata.get("routed_event_preset") or metadata.get("debug_preset")
    return normalize_routed_event_preset(value if isinstance(value, str) else None)


def _event_context_section(routed_event: str | None, message: str) -> RunContextSection:
    if routed_event == NVDA_EARNINGS_ROUTED_EVENT:
        return RunContextSection(
            name="event",
            summary=(
                "已路由调试事件：绑定 NVIDIA 官方 FY2027 Q1 财报公告。该公告由 NVIDIA Investor Relations "
                "于 2026-05-20 发布，并在发布后 5 分钟内进入 Agent Chat 链路。"
            ),
            data={
                "event_id": "evt_debug_nvda_fy2027_q1_earnings_official",
                "raw_event_id": "raw_debug_nvda_fy2027_q1_earnings_press_release",
                "source_kind": "official_investor_relations_press_release",
                "event_kind": "first_party_earnings_release",
                "event_family": "quarterly_earnings",
                "issuer": "NVIDIA",
                "symbols": ["NVDA"],
                "related_symbols": ["SMH", "SOX", "AMD", "INTC", "TSM", "ASML"],
                "freshness": "within_5_minutes",
                "published_at": "2026-05-20T20:20:00Z",
                "detected_at": "2026-05-20T20:25:00Z",
                "source": {
                    "publisher": "NVIDIA Investor Relations",
                    "title": "NVIDIA Announces Financial Results for First Quarter Fiscal 2027",
                    "url": "https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-First-Quarter-Fiscal-2027/default.aspx",
                },
                "reported_metrics": {
                    "quarter": "FY2027 Q1",
                    "revenue_usd_billion": 81.6,
                    "revenue_yoy_growth_pct": 85,
                    "revenue_qoq_growth_pct": 12,
                    "gaap_gross_margin_pct": 60.5,
                    "non_gaap_gross_margin_pct": 71.3,
                    "gaap_diluted_eps_usd": 0.76,
                    "non_gaap_diluted_eps_usd": 0.81,
                    "data_center_revenue_usd_billion": 75.2,
                    "data_center_revenue_yoy_growth_pct": 92,
                    "gaming_revenue_usd_billion": 3.8,
                },
                "guidance": {
                    "next_quarter_revenue_usd_billion": 91.0,
                    "guidance_note": "公司提到 H20 出口管制影响，并给出不包含 H20 对中国出货的展望。",
                },
                "expected_missing_context": ["consensus_expectations", "after_hours_or_premarket_reaction"],
                "routing_decision": {
                    "decision": "route",
                    "target_industry": "semiconductor",
                    "target_agent": "industry_main_agent",
                    "reason": "半导体 AI 加速器发行人的官方一手财报事件。",
                },
                "user_message": message,
            },
        )
    if routed_event == NVDA_MEDIA_FOLLOWUP_ROUTED_EVENT:
        return RunContextSection(
            name="event",
            summary=(
                "调试事件：媒体跟进报道在 NVIDIA 官方财报发布约 30 分钟后进入系统。"
                "Agent 需要先检查它是否重复覆盖已经处理过的一手事件，再决定是否通知或提出行动。"
            ),
            data={
                "event_kind": "media_followup",
                "issuer": "NVIDIA",
                "symbols": ["NVDA"],
                "freshness": "about_30_minutes_after_first_party_release",
                "duplicate_check_required": True,
                "user_message": message,
            },
        )
    return RunContextSection(
        name="event",
        summary="用户手动提交的 Agent Chat 事件分析请求。",
        data={"event_kind": "manual_agent_chat_message", "user_message": message},
    )


def _recent_activity_section(routed_event: str | None) -> RunContextSection:
    if routed_event == NVDA_MEDIA_FOLLOWUP_ROUTED_EVENT:
        summary = (
            "模拟近期活动：同一 NVIDIA 财报主题已有 prior run 处理过官方一手公告，已发送摘要通知，"
            "并可能已经产出行动计划判断。除非出现新增事实，否则应把媒体跟进视为高概率重复信息。"
        )
        data = {
            "recent_same_topic_run": True,
            "prior_event_kind": "first_party_earnings_release",
            "prior_notification_sent": True,
            "prior_action_considered": True,
        }
    else:
        summary = "本次 MVP 调试 run 没有绑定已确认的同主题历史 Agent Chat 行动。"
        data = {"recent_same_topic_run": False, "prior_notification_sent": False}
    return RunContextSection(name="recent_activity_summary", summary=summary, data=data)


def _route_summary(routed_event: str | None) -> str:
    if routed_event == NVDA_EARNINGS_ROUTED_EVENT:
        return (
            "Router / Intake 已将 NVIDIA 官方 FY2027 Q1 财报公告识别为高时效的一手半导体事件，"
            "并路由给 Industry MainAgent。Debug Chat 正在复现路由后的交接。"
        )
    return (
        "当前 Agent Chat session 表示路由后的 Industry MainAgent 入口。"
        "正常运行时，routed topic / event payload 会自动创建或复用 session，并启动一次 run。"
    )


def _route_data(routed_event: str | None) -> dict[str, object]:
    if routed_event == NVDA_EARNINGS_ROUTED_EVENT:
        return {
            "route_decision": "route",
            "target_industries": ["semiconductor"],
            "target_main_agent": "semiconductor_main_agent",
            "priority": "high",
            "freshness_bucket": "0_5m",
            "dedupe_key": "nvda:quarterly_earnings:fy2027q1:official",
            "requires_first_party_analysis": True,
            "requires_expectation_lookup": True,
            "requires_market_reaction_lookup": True,
        }
    return {}
