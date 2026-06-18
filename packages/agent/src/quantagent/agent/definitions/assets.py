from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from quantagent.agent.definitions.models import AgentDefinition, SubAgentDefinition
from quantagent.agent.tools.catalog import resolve_tool_profile
from quantagent.agent.tools.profiles import ToolBinding
from quantagent.agent.tools.profiles import ToolProfile


def load_agent_assets_from_directory(agent_dir: Path | str) -> tuple[AgentDefinition, ToolProfile, dict[str, ToolProfile]]:
    """从行业包资产目录读取 definition；插件仍只声明资产，runtime 负责执行。"""

    base_dir = Path(agent_dir)
    raw_agent, main_prompt = _read_markdown_asset(base_dir / "main.md")
    if raw_agent.get("type") != "industry_main_agent":
        raise ValueError("main.md frontmatter type must be industry_main_agent")
    main_tool_profile = resolve_tool_profile(
        profile_id=f"{raw_agent['id']}.tools",
        tool_ids=_tool_ids(raw_agent.pop("tools", [])),
        max_tool_calls=_optional_int(raw_agent.pop("max_tool_calls", None), default=12),
    )

    subagents: list[SubAgentDefinition] = []
    subagent_profiles: dict[str, ToolProfile] = {}
    for item in raw_agent.pop("subagents", []):
        if not isinstance(item, dict):
            raise ValueError("main.md frontmatter subagents entries must be objects")
        subagent_path = base_dir / str(item["path"])
        raw_subagent, subagent_prompt = _read_markdown_asset(subagent_path)
        if raw_subagent.get("type") != "research_subagent":
            raise ValueError(f"{subagent_path.name} frontmatter type must be research_subagent")
        subagent_profile = resolve_tool_profile(
            profile_id=f"{raw_subagent['id']}.tools",
            tool_ids=_tool_ids(raw_subagent.pop("tools", [])),
            max_tool_calls=_optional_int(raw_subagent.get("max_tool_calls"), default=12),
        )
        subagent = SubAgentDefinition(
            **_normalize_subagent_payload(base_dir, raw_subagent),
            system_prompt=subagent_prompt,
            tool_ids=[binding.tool_id for binding in subagent_profile.tool_bindings],
        )
        subagents.append(subagent)
        subagent_profiles[subagent.subagent_id] = subagent_profile

    agent = AgentDefinition(
        **_normalize_agent_payload(base_dir, raw_agent),
        system_prompt=main_prompt,
        tool_ids=[binding.tool_id for binding in main_tool_profile.tool_bindings],
        subagents=subagents,
    )
    return agent, main_tool_profile, subagent_profiles


def filter_agent_assets_by_available_tools(
    agent_definition: AgentDefinition,
    main_tool_profile: ToolProfile,
    subagent_tool_profiles: dict[str, ToolProfile],
    *,
    available_tool_ids: set[str],
) -> tuple[AgentDefinition, ToolProfile, dict[str, ToolProfile]]:
    """按当前 runtime 已注册工具收窄 Agent 可见工具，避免 prompt/工具注入漂移。"""

    filtered_main_bindings = _filter_bindings(main_tool_profile.tool_bindings, available_tool_ids)
    filtered_main_profile = main_tool_profile.model_copy(update={"tool_bindings": filtered_main_bindings})

    filtered_subagents: list[SubAgentDefinition] = []
    filtered_subagent_profiles: dict[str, ToolProfile] = {}
    for subagent in agent_definition.subagents:
        profile = subagent_tool_profiles.get(subagent.subagent_id)
        if profile is None:
            filtered_subagents.append(subagent)
            continue
        bindings = _filter_bindings(profile.tool_bindings, available_tool_ids)
        filtered_subagent_profiles[subagent.subagent_id] = profile.model_copy(update={"tool_bindings": bindings})
        filtered_subagents.append(subagent.model_copy(update={"tool_ids": [binding.tool_id for binding in bindings]}))

    filtered_agent = agent_definition.model_copy(
        update={
            "tool_ids": [binding.tool_id for binding in filtered_main_bindings],
            "subagents": filtered_subagents,
        }
    )
    return filtered_agent, filtered_main_profile, filtered_subagent_profiles


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def _read_markdown_asset(path: Path) -> tuple[dict[str, Any], str]:
    text = _read_text(path)
    frontmatter, body = _split_frontmatter(text)
    if not frontmatter:
        raise ValueError(f"agent markdown asset must define frontmatter: {path.name}")
    return frontmatter, body.strip()


def _split_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---", 4)
    if end == -1:
        return {}, text
    raw = text[4:end].strip()
    body_start = end + len("\n---")
    if text[body_start : body_start + 1] == "\n":
        body_start += 1
    payload = yaml.safe_load(raw) or {}
    if not isinstance(payload, dict):
        raise ValueError("agent markdown frontmatter must be a mapping")
    return dict(payload), text[body_start:]


def _normalize_agent_payload(base_dir: Path, payload: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(payload)
    normalized["agent_id"] = normalized.pop("id")
    normalized.pop("type", None)
    normalized["skill_paths"] = _resolve_skill_paths(base_dir, normalized.get("skill_paths", []))
    return normalized


def _normalize_subagent_payload(base_dir: Path, payload: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(payload)
    normalized["subagent_id"] = normalized.pop("id")
    normalized.pop("type", None)
    normalized.pop("version", None)
    normalized["skill_paths"] = _resolve_skill_paths(base_dir, normalized.get("skill_paths", []))
    return normalized


def _resolve_skill_paths(base_dir: Path, skill_paths: Any) -> list[str]:
    if not isinstance(skill_paths, list):
        return []
    return [str((base_dir.parent / str(skill_path)).resolve()) for skill_path in skill_paths]


def _tool_ids(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]


def _optional_int(value: Any, *, default: int) -> int:
    if value is None:
        return default
    return int(value)


def _filter_bindings(bindings: list[ToolBinding], available_tool_ids: set[str]) -> list[ToolBinding]:
    return [binding for binding in bindings if binding.tool_id in available_tool_ids]
