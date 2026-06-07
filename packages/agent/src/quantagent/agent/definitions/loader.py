from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from quantagent.agent.definitions.models import AgentDefinition


def load_agent_definition_from_mapping(payload: Mapping[str, Any]) -> AgentDefinition:
    """测试适配层的最小入口；行业插件资产使用 assets.py 的 Markdown frontmatter loader。"""

    return AgentDefinition.model_validate(dict(payload))
