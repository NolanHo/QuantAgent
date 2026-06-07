from __future__ import annotations

from quantagent.agent.tools.actions import (
    BUILD_ACTION_PLAN_TOOL_ID,
    EVALUATE_THESIS_TOOL_ID,
    GET_ACCOUNT_CONTEXT_TOOL_ID,
    SUBMIT_ACTION_PLAN_TOOL_ID,
)
from quantagent.agent.tools.context import GET_RUN_CONTEXT_TOOL_ID
from quantagent.agent.tools.profiles import ToolBinding, ToolProfile
from quantagent.agent.tools.search import SEARCH_WEB_TOOL_ID

PUBLIC_TOOL_BINDINGS: dict[str, ToolBinding] = {
    GET_RUN_CONTEXT_TOOL_ID: ToolBinding(
        tool_id=GET_RUN_CONTEXT_TOOL_ID,
        name="get_run_context",
        description=(
            "读取当前 AgentRun 已绑定的 event、route、industry、risk、tool_profile、market_mapping "
            "或 recent_activity 上下文。不要传 run id、thread id、workspace id 或文件路径。"
        ),
        risk_level="low",
    ),
    SEARCH_WEB_TOOL_ID: ToolBinding(
        tool_id=SEARCH_WEB_TOOL_ID,
        name="search_web",
        description=(
            "使用 Tavily 检索公开网页证据，包括市场预期、第一手来源、新闻、盘前/盘后反应或冲突信息。"
            "需要覆盖多个问题时，优先拆成多个窄查询。"
        ),
        risk_level="medium",
    ),
    GET_ACCOUNT_CONTEXT_TOOL_ID: ToolBinding(
        tool_id=GET_ACCOUNT_CONTEXT_TOOL_ID,
        name="get_account_context",
        description="读取已授权的账户、策略、broker 模式、风险预算和近期活动摘要。",
        risk_level="medium",
    ),
    EVALUATE_THESIS_TOOL_ID: ToolBinding(
        tool_id=EVALUATE_THESIS_TOOL_ID,
        name="evaluate_thesis",
        description="评估证据质量、重要性、新颖性、历史覆盖、置信度和风险。",
        risk_level="medium",
    ),
    BUILD_ACTION_PLAN_TOOL_ID: ToolBinding(
        tool_id=BUILD_ACTION_PLAN_TOOL_ID,
        name="build_action_plan",
        description="基于分析、评估和账户上下文 ID 构建受风险约束的 ActionPlan。",
        risk_level="high",
    ),
    SUBMIT_ACTION_PLAN_TOOL_ID: ToolBinding(
        tool_id=SUBMIT_ACTION_PLAN_TOOL_ID,
        name="submit_action_plan",
        description="提交 ActionPlan，进入 policy、approval、notification、monitor 和 broker mock/dry-run 编排。",
        risk_level="critical",
    ),
}


def resolve_tool_profile(
    *,
    profile_id: str,
    tool_ids: list[str],
    max_tool_calls: int = 12,
    permission_scope: str = "agent-frontmatter-tools",
) -> ToolProfile:
    missing = [tool_id for tool_id in tool_ids if tool_id not in PUBLIC_TOOL_BINDINGS]
    if missing:
        raise ValueError(f"unknown tools in agent frontmatter: {', '.join(missing)}")
    return ToolProfile(
        profile_id=profile_id,
        permission_scope=permission_scope,
        max_tool_calls=max_tool_calls,
        tool_bindings=[PUBLIC_TOOL_BINDINGS[tool_id] for tool_id in tool_ids],
    )
