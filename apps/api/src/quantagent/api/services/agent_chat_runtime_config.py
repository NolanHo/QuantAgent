from __future__ import annotations

from quantagent.agent.definitions.models import AgentDefinition, SubAgentDefinition
from quantagent.agent.runtime.context import RunContextSection, RunContextSnapshot
from quantagent.agent.tools import GET_RUN_CONTEXT_TOOL_ID, SEARCH_WEB_TOOL_ID
from quantagent.agent.tools.profiles import ToolBinding, ToolProfile
from quantagent.core.db.models.agent_chat import AgentChatRunORM, AgentChatSessionORM


def build_agent_chat_definition(agent_id: str) -> AgentDefinition:
    return AgentDefinition(
        agent_id=agent_id,
        version="0.1.0",
        name="Agent Chat MainAgent",
        description="用于产品调试和事件分析的通用行业 MainAgent。",
        system_prompt=(
            "你是 QuantAgent 的行业 MainAgent，当前运行在真实 AgentRuntime / DeepAgents 链路中。"
            "除 ticker、URL、财务指标名、工具名和必要原文引用外，所有思考表达、工具前后说明和最终回答都必须使用中文。"
            "把用户消息视为一次已路由事件的分析请求。第一步必须调用 get_run_context，读取 event、route、industry、risk、tool_profile、market_mapping、recent_activity 等已经绑定到本次 run 的上下文；不要让用户或模型手动传 run_id、thread_id、workspace_id。"
            "对于多步骤任务，使用 DeepAgents 的 write_todos 创建并更新计划；计划内容使用中文，状态要随分析进展更新。"
            "需要补充外部证据时，优先通过 DeepAgents 的 task 工具委派 evidence_research_analyst；任务说明必须一次性写清事件摘要、要检索的市场预期/第一手来源/盘前盘后反应/冲突报道、搜索预算、输出格式和停止条件。"
            "MainAgent 不直接调用 search_web；公开证据检索必须由 Research Agent 执行。"
            "如果 Research Agent 或 search_web 因 Tavily key 缺失或外部错误失败，把它视为可恢复的信息缺口，不要中断整次分析；基于已绑定上下文给出保守结论。"
            "不要使用 ls、grep、read_file 等文件系统工具寻找业务事件上下文，除非用户明确要求分析工作区文件。"
            "最终回答用中文，至少包含：简洁结论、关键依据、信息缺口/风险点、是否需要行动计划、是否需要通知用户。"
            "MVP 调试阶段要明确写出你依赖了哪些上下文和哪些工具缺口。"
        ),
        tool_ids=[GET_RUN_CONTEXT_TOOL_ID],
        subagents=[_build_evidence_research_subagent()],
    )


def build_agent_chat_tool_profile() -> ToolProfile:
    return ToolProfile(
        profile_id="tool_profile_agent_chat",
        tool_bindings=[
            ToolBinding(
                tool_id=GET_RUN_CONTEXT_TOOL_ID,
                name="get_run_context",
                description="读取当前 AgentRun 已绑定的事件、路由、行业、风险、工具、市场映射和近期活动上下文。",
            ),
            ToolBinding(
                tool_id=SEARCH_WEB_TOOL_ID,
                name="search_web",
                description="使用 Tavily 检索公开网页证据；缺少 key 或外部失败属于可恢复的信息缺口。",
            ),
        ],
    )


def _build_evidence_research_subagent() -> SubAgentDefinition:
    return SubAgentDefinition(
        subagent_id="quantagent.agent_chat.subagent.evidence_research_analyst",
        name="evidence_research_analyst",
        description="检索并压缩已路由事件的公开证据，返回中文研究报告、关键发现、反方观点和信息缺口。",
        system_prompt=(
            "你是 QuantAgent Agent Chat 的 Research Agent，由 MainAgent 通过 DeepAgents task 工具创建。"
            "除 ticker、URL、财务指标名、工具名、schema 字段和必要原文引用外，所有思考表达、工具前后说明和最终报告都必须使用中文。"
            "你只负责公开证据检索和压缩，不生成交易计划、不读取账户、不提交动作、不宣称通知或审批状态。"
            "先调用 get_run_context 读取 event、route、industry、tool_profile、market_mapping 和 recent_activity 中与你的研究任务相关的摘要。"
            "使用 search_web 设计多次窄 query，覆盖市场预期、第一手来源、盘前/盘后反应、冲突报道和反方观点；不要只做一个宽泛查询。"
            "不要使用 ls、glob、grep、read_file、write_file、edit_file 等文件系统工具寻找业务上下文；业务上下文只能来自 get_run_context，外部公开证据只能来自 search_web。"
            "如果 search_web 不可用，不要尝试用文件系统工具替代检索。"
            "如果 search_web 因 Tavily key 缺失或外部错误失败，把它视为可恢复的信息缺口，明确说明缺口后返回基于已绑定上下文的保守研究结论。"
            "返回时使用中文，包含：研究结论、已确认事实、参考点、冲突/反方观点、信息缺口、使用过的 search_ids 或上下文 ID。"
            "不要返回完整搜索 dump、secret 或完整 provider raw response。"
        ),
        tool_ids=[GET_RUN_CONTEXT_TOOL_ID, SEARCH_WEB_TOOL_ID],
    )


def build_agent_chat_run_context(row: AgentChatSessionORM, run: AgentChatRunORM, *, message: str) -> RunContextSnapshot:
    preset = _debug_preset(row)
    sections = [
        _event_context_section(preset, message),
        RunContextSection(
            name="route_context",
            summary=(
                _route_summary(preset)
            ),
            data={
                "session_id": row.session_id,
                "thread_id": row.thread_id,
                "workspace_id": row.workspace_id,
                "agent_run_id": run.agent_run_id,
                "debug_preset": preset,
                **_route_data(preset),
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
            summary="当前平台业务工具是 get_run_context 和 search_web。DeepAgents 内置工具存在，但不作为业务上下文来源。",
            data={"tools": [GET_RUN_CONTEXT_TOOL_ID, SEARCH_WEB_TOOL_ID]},
        ),
        _recent_activity_section(preset),
    ]
    return RunContextSnapshot(
        context_id=f"context_{run.run_id}",
        sections=sections,
        content="\n".join(f"{section.name}: {section.summary}" for section in sections),
    )


def _debug_preset(row: AgentChatSessionORM) -> str | None:
    metadata = row.metadata_json if isinstance(row.metadata_json, dict) else {}
    preset = metadata.get("debug_preset")
    return preset if isinstance(preset, str) and preset else None


def _event_context_section(preset: str | None, message: str) -> RunContextSection:
    if preset == "nvda-earnings":
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
    if preset == "nvda-media-followup":
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


def _recent_activity_section(preset: str | None) -> RunContextSection:
    if preset == "nvda-media-followup":
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


def _route_summary(preset: str | None) -> str:
    if preset == "nvda-earnings":
        return (
            "Router / Intake 已将 NVIDIA 官方 FY2027 Q1 财报公告识别为高时效的一手半导体事件，"
            "并路由给 Industry MainAgent。Debug Chat 正在复现路由后的交接。"
        )
    return (
        "当前 Agent Chat session 表示路由后的 Industry MainAgent 入口。"
        "正常运行时，routed topic / event payload 会自动创建或复用 session，并启动一次 run。"
    )


def _route_data(preset: str | None) -> dict[str, object]:
    if preset == "nvda-earnings":
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
