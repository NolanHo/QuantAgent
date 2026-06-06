from __future__ import annotations

from typing import Any
from uuid import uuid4

from quantagent.agent.runtime.context import RunContextSection, RunContextSnapshot, ToolRuntimeContext
from quantagent.agent.tools.adapter import PlatformTool
from quantagent.agent.tools.profiles import ToolBinding
from quantagent.agent.tools.schemas import GetRunContextInput


GET_RUN_CONTEXT_TOOL_ID = "quantagent.core.tool.get_run_context"


def build_get_run_context_tool(run_context: RunContextSnapshot) -> PlatformTool[GetRunContextInput]:
    def _get_run_context(input_data: GetRunContextInput, runtime_context: ToolRuntimeContext) -> dict[str, Any]:
        section_by_name = _section_aliases(run_context.sections)
        selected_sections: list[dict[str, Any]] = []
        warnings: list[str] = []

        for section_name in input_data.sections:
            section = section_by_name.get(section_name)
            if section is None:
                warnings.append(f"上下文 section 不可用：{section_name}")
                continue
            selected_sections.append(
                {
                    "name": section.name,
                    "summary": _truncate(section.summary, input_data.max_tokens),
                    "data": _filter_symbols(section.data, input_data.symbols),
                    "artifact_id": section.artifact_ref.artifact_id if section.artifact_ref else None,
                }
            )

        if not selected_sections:
            selected_sections.append(
                {
                    "name": "run_context",
                    "summary": _truncate(run_context.content, input_data.max_tokens),
                    "data": {
                        "context_id": run_context.context_id,
                        "requested_sections": input_data.sections,
                    },
                    "artifact_id": None,
                }
            )
            warnings.append("请求的 sections 均不可用；已返回压缩版 run_context 内容")

        # 中文注释：这些 ID 由 AgentRuntime 注入，模型不需要也不应该手动传 run/thread/workspace。
        return {
            "ok": True,
            "context_id": f"context_read_{uuid4().hex}",
            "bound_context_id": run_context.context_id,
            "session_id": runtime_context.session_id,
            "thread_id": runtime_context.thread_id,
            "workspace_id": runtime_context.workspace_id,
            "agent_run_id": runtime_context.agent_run_id,
            "event_id": runtime_context.event_id,
            "industry_id": runtime_context.industry_id,
            "sections": selected_sections,
            "warnings": warnings,
            "summary": _build_summary(selected_sections, warnings),
        }

    return PlatformTool(
        binding=ToolBinding(
            tool_id=GET_RUN_CONTEXT_TOOL_ID,
            name="get_run_context",
            description=(
                "读取当前 AgentRun 已绑定的 event、route、industry、risk、tool_profile、market_mapping "
                "或 recent_activity 上下文。不要传 run id、thread id、workspace id 或文件路径。"
            ),
        ),
        input_model=GetRunContextInput,
        callable=_get_run_context,
    )


def _section_aliases(sections: list[RunContextSection]) -> dict[str, RunContextSection]:
    aliases = {
        "market-mapping": "market_mapping",
        "recent-activity": "recent_activity_summary",
        "recent_activity": "recent_activity_summary",
        "risk": "risk_policy",
        "route": "route_context",
        "industry": "industry_profile",
        "tool-profile": "tool_profile",
    }
    section_by_name = {section.name: section for section in sections}
    for alias, canonical in aliases.items():
        if alias not in section_by_name and canonical in section_by_name:
            section_by_name[alias] = section_by_name[canonical]
        if canonical not in section_by_name and alias in section_by_name:
            section_by_name[canonical] = section_by_name[alias]
    return section_by_name


def _filter_symbols(data: dict[str, Any], symbols: list[str]) -> dict[str, Any]:
    if not symbols:
        return data
    selected = {symbol.upper() for symbol in symbols}
    filtered = dict(data)
    for key in ("symbols", "tickers", "covered_symbols"):
        value = filtered.get(key)
        if isinstance(value, list):
            filtered[key] = [item for item in value if str(item).upper() in selected]
    return filtered


def _truncate(value: str, max_tokens: int | None) -> str:
    if max_tokens is None:
        return value
    # 中文注释：这里按字符粗略限长即可，真实 token budget 后续由 runtime budget 统一收敛。
    max_chars = max(256, max_tokens * 4)
    if len(value) <= max_chars:
        return value
    return f"{value[:max_chars]}..."


def _build_summary(sections: list[dict[str, Any]], warnings: list[str]) -> str:
    names = ", ".join(str(section["name"]) for section in sections)
    suffix = f"；警告 {len(warnings)} 条" if warnings else ""
    return f"已读取 run context sections：{names}{suffix}。"
