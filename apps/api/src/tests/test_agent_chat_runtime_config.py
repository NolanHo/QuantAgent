from __future__ import annotations

from unittest import TestCase

from quantagent.api.services.agent_chat_runtime_config import (
    NVDA_EARNINGS_ROUTED_EVENT,
    SEMICONDUCTOR_INDUSTRY_ID,
    SEMICONDUCTOR_MAIN_AGENT_ID,
    build_agent_chat_assets,
    build_agent_chat_run_context,
)
from quantagent.core.db.models.agent_chat import AgentChatRunORM, AgentChatSessionORM


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
        self.assertGreaterEqual(assets.tool_profile.max_tool_calls, 24)
        self.assertIn("get_account_context", assets.agent_definition.system_prompt)
        self.assertIn("完整行动链路验收案例", assets.agent_definition.system_prompt)
        self.assertIn("行动阶段必须通过独立工具调用", assets.agent_definition.system_prompt)
        self.assertIn("行动链路的工具调用优先级高于中途报告输出", assets.agent_definition.system_prompt)
        self.assertNotIn("不要尝试调用", assets.agent_definition.system_prompt)

        research = next(subagent for subagent in assets.agent_definition.subagents if subagent.name == "evidence_research_analyst")
        self.assertIn("最终报告不超过 900 中文字", research.system_prompt)
        self.assertIn("最多调用 1 次综合 `search_web`", research.system_prompt)
        self.assertEqual(
            research.tool_ids,
            [
                "quantagent.core.tool.get_run_context",
                "quantagent.official.source.tavily.search_web",
            ],
        )

    def test_nvda_earnings_context_marks_action_flow_smoke_test_budget(self) -> None:
        session = AgentChatSessionORM(
            session_id="chat_sess_test",
            thread_id="chat_thread_test",
            workspace_id="chat_workspace_test",
            title="NVDA",
            industry_id=SEMICONDUCTOR_INDUSTRY_ID,
            agent_id=SEMICONDUCTOR_MAIN_AGENT_ID,
            metadata_json={"routed_event_preset": NVDA_EARNINGS_ROUTED_EVENT},
        )
        run = AgentChatRunORM(
            run_id="chat_run_test",
            session_id=session.session_id,
            agent_run_id="agent_run_test",
            trace_id="trace_test",
            status="running",
        )

        context = build_agent_chat_run_context(session, run, message="分析事件")

        route_context = next(section for section in context.sections if section.name == "route_context")
        self.assertTrue(route_context.data["action_flow_required"])
        self.assertTrue(route_context.data["action_flow_smoke_test"])
        self.assertEqual(route_context.data["research_budget_for_action_flow"]["max_search_web_calls"], 1)
