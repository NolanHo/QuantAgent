from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from langchain.agents.middleware.types import ExtendedModelResponse, ModelRequest, ModelResponse, ResponseT
    from langchain_core.messages import AIMessage
    from langchain_core.tools import BaseTool


DEEPAGENTS_FILESYSTEM_TOOL_NAMES = frozenset(
    {
        "ls",
        "read_file",
        "write_file",
        "edit_file",
        "glob",
        "grep",
        "execute",
    }
)
QUANTAGENT_DEEPAGENTS_PROFILE_PROVIDERS = frozenset(
    {
        "anthropic",
        "openai",
        "openaicompatiblechatmodel",
        "fakelistchatmodel",
    }
)
_REGISTERED_HARNESS_PROFILE_KEYS: set[str] = set()


try:
    from langchain.agents.middleware.types import AgentMiddleware
except Exception:  # noqa: BLE001
    AgentMiddleware = object  # type: ignore[assignment,misc]


class AgentToolVisibilityMiddleware(AgentMiddleware[Any, Any, Any]):
    """过滤 DeepAgents 内置系统工具，确保模型只看到 QuantAgent 授权工具。"""

    def __init__(self, *, excluded_tools: frozenset[str] = DEEPAGENTS_FILESYSTEM_TOOL_NAMES) -> None:
        self._excluded_tools = excluded_tools

    def wrap_model_call(
        self,
        request: "ModelRequest[Any]",
        handler: Callable[["ModelRequest[Any]"], "ModelResponse[Any]"],
    ) -> "ModelResponse[Any]":
        return handler(self._filtered_request(request))

    async def awrap_model_call(
        self,
        request: "ModelRequest[Any]",
        handler: Callable[["ModelRequest[Any]"], Awaitable["ModelResponse[ResponseT]"]],
    ) -> "ModelResponse[ResponseT] | AIMessage | ExtendedModelResponse[ResponseT]":
        return await handler(self._filtered_request(request))

    def _filtered_request(self, request: "ModelRequest[Any]") -> "ModelRequest[Any]":
        if not self._excluded_tools:
            return request
        filtered = [tool for tool in request.tools if _tool_name(tool) not in self._excluded_tools]
        return request.override(tools=filtered)


def configure_quantagent_deepagents_harness(model: Any) -> None:
    """注册 QuantAgent 的 DeepAgents harness 默认值。

    DeepAgents 的文件系统 middleware 属于受保护 scaffolding，不能直接移除；
    这里通过公开 HarnessProfile 关闭默认 general-purpose subagent，显式
    SubAgent 再由 AgentToolVisibilityMiddleware 过滤系统工具。
    """
    try:
        from deepagents import GeneralPurposeSubagentProfile, HarnessProfile, register_harness_profile
    except Exception:  # noqa: BLE001
        return

    profile = HarnessProfile(
        excluded_tools=DEEPAGENTS_FILESYSTEM_TOOL_NAMES,
        general_purpose_subagent=GeneralPurposeSubagentProfile(enabled=False),
    )
    for key in _harness_profile_keys(model):
        if key in _REGISTERED_HARNESS_PROFILE_KEYS:
            continue
        register_harness_profile(key, profile)
        _REGISTERED_HARNESS_PROFILE_KEYS.add(key)


def quantagent_tool_visibility_middleware() -> list[AgentToolVisibilityMiddleware]:
    return [AgentToolVisibilityMiddleware()]


def _tool_name(tool: "BaseTool | dict[str, Any]") -> str | None:
    if isinstance(tool, dict):
        value = tool.get("name")
    else:
        value = getattr(tool, "name", None)
    return value if isinstance(value, str) and value else None


def _harness_profile_keys(model: Any) -> list[str]:
    keys = set(QUANTAGENT_DEEPAGENTS_PROFILE_PROVIDERS)
    if isinstance(model, str):
        keys.add(model)
        provider, sep, model_name = model.partition(":")
        if sep and provider and model_name:
            keys.add(provider)
    else:
        provider = _model_provider(model)
        identifier = _model_identifier(model)
        if provider:
            keys.add(provider)
            if identifier and ":" not in identifier:
                keys.add(f"{provider}:{identifier}")
        if identifier and ":" in identifier:
            keys.add(identifier)
    return sorted(keys)


def _model_provider(model: Any) -> str | None:
    try:
        params = model._get_ls_params()
    except (AttributeError, TypeError, NotImplementedError):
        return None
    if not isinstance(params, dict):
        return None
    provider = params.get("ls_provider")
    return provider if isinstance(provider, str) and provider else None


def _model_identifier(model: Any) -> str | None:
    for name in ("model_name", "model"):
        value = getattr(model, name, None)
        if isinstance(value, str) and value:
            return value
    try:
        params = model._get_ls_params()
    except (AttributeError, TypeError, NotImplementedError):
        return None
    if not isinstance(params, dict):
        return None
    value = params.get("ls_model_name")
    return value if isinstance(value, str) and value else None
