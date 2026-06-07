from __future__ import annotations

from unittest import TestCase

from quantagent.api.services.agent_chat_runtime_config import (
    SEMICONDUCTOR_INDUSTRY_ID,
    SEMICONDUCTOR_MAIN_AGENT_ID,
    build_agent_chat_assets,
)


class AgentChatRuntimeConfigTest(TestCase):
    def test_semiconductor_agent_chat_assets_expose_action_tools_to_main_agent_only(self) -> None:
        assets = build_agent_chat_assets(
            industry_id=SEMICONDUCTOR_INDUSTRY_ID,
            agent_id=SEMICONDUCTOR_MAIN_AGENT_ID,
        )

        main_tool_ids = set(assets.agent_definition.tool_ids)
        self.assertIn("quantagent.core.tool.get_account_context", main_tool_ids)
        self.assertIn("quantagent.core.tool.evaluate_thesis", main_tool_ids)
        self.assertIn("quantagent.core.tool.build_action_plan", main_tool_ids)
        self.assertIn("quantagent.core.tool.submit_action_plan", main_tool_ids)
        self.assertIn("get_account_context", assets.agent_definition.system_prompt)
        self.assertIn("完整行动链路验收案例", assets.agent_definition.system_prompt)
        self.assertNotIn("不要尝试调用", assets.agent_definition.system_prompt)

        research = next(subagent for subagent in assets.agent_definition.subagents if subagent.name == "evidence_research_analyst")
        self.assertEqual(
            research.tool_ids,
            [
                "quantagent.core.tool.get_run_context",
                "quantagent.official.source.tavily.search_web",
            ],
        )
