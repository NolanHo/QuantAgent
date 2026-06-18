from __future__ import annotations

import asyncio
from unittest import TestCase
from unittest.mock import patch

from quantagent.agent.artifacts import InMemoryArtifactStore
from quantagent.agent.runtime.context import RunContextSection, RunContextSnapshot, ToolRuntimeContext
from quantagent.agent.streaming.adapter import EventSequencer
from quantagent.agent.streaming.events import AgentRunEventType
from quantagent.agent.tools import (
    ActionSubmissionResult,
    build_build_action_plan_tool,
    build_evaluate_thesis_tool,
    build_get_account_context_tool,
    build_get_run_context_tool,
    build_search_web_tool,
    build_submit_action_plan_tool,
)
from quantagent.agent.tools.adapter import ToolAdapter
from quantagent.agent.tools.schemas import SearchWebInput
from quantagent.agent.tools.search import _request_payload


class ContextAndSearchToolsTest(TestCase):
    def test_get_run_context_returns_bound_sections_and_runtime_ids(self) -> None:
        async def _run() -> None:
            run_context = RunContextSnapshot(
                context_id="context_1",
                sections=[
                    RunContextSection(
                        name="event",
                        summary="NVIDIA official earnings entered within 5 minutes.",
                        data={"symbols": ["NVDA"], "event_kind": "first_party_earnings_release"},
                    )
                ],
                content="fallback context",
            )
            adapter = ToolAdapter(runtime_context=_runtime_context(), sequencer=EventSequencer())

            result, events = await adapter.invoke(
                build_get_run_context_tool(run_context),
                {"sections": ["event"], "symbols": ["NVDA"]},
            )

            self.assertTrue(result["ok"])
            self.assertEqual(result["bound_context_id"], "context_1")
            self.assertEqual(result["session_id"], "session_1")
            self.assertEqual(result["thread_id"], "thread_1")
            self.assertEqual(result["workspace_id"], "workspace_1")
            self.assertEqual(result["agent_run_id"], "run_1")
            self.assertEqual(result["sections"][0]["name"], "event")
            self.assertEqual(result["sections"][0]["data"]["symbols"], ["NVDA"])
            self.assertEqual([event.type for event in events], [AgentRunEventType.TOOL_STARTED, AgentRunEventType.TOOL_COMPLETED])

        asyncio.run(_run())

    def test_get_run_context_accepts_section_aliases(self) -> None:
        async def _run() -> None:
            run_context = RunContextSnapshot(
                context_id="context_1",
                sections=[
                    RunContextSection(name="route_context", summary="Routed to semiconductor MainAgent.", data={"decision": "route"}),
                    RunContextSection(name="risk_policy", summary="Broker disabled.", data={"broker_mode": "disabled"}),
                    RunContextSection(name="recent_activity_summary", summary="No prior action.", data={"recent_same_topic_run": False}),
                ],
                content="fallback context",
            )
            adapter = ToolAdapter(runtime_context=_runtime_context(), sequencer=EventSequencer())

            result, _events = await adapter.invoke(
                build_get_run_context_tool(run_context),
                {"sections": ["route", "risk", "recent_activity"], "symbols": []},
            )

            self.assertEqual([section["name"] for section in result["sections"]], ["route_context", "risk_policy", "recent_activity_summary"])
            self.assertEqual(result["warnings"], [])

        asyncio.run(_run())

    def test_search_web_missing_tavily_key_is_recoverable_tool_failure(self) -> None:
        async def _run() -> None:
            adapter = ToolAdapter(runtime_context=_runtime_context(), sequencer=EventSequencer())

            with patch.dict("os.environ", {}, clear=True):
                result, events = await adapter.invoke(
                    build_search_web_tool(),
                    {"query": "NVIDIA earnings consensus", "topic": "finance"},
                )

            self.assertFalse(result["ok"])
            self.assertIn("未配置 TAVILY_API_KEY", result["error"])
            self.assertEqual([event.type for event in events], [AgentRunEventType.TOOL_STARTED, AgentRunEventType.TOOL_FAILED])
            self.assertEqual(events[-1].payload["name"], "search_web")
            self.assertEqual(events[-1].payload["input"]["query"], "NVIDIA earnings consensus")

        asyncio.run(_run())

    def test_search_web_maps_business_topic_and_time_window_to_tavily_payload(self) -> None:
        input_data = SearchWebInput(
            query="NVIDIA H20 export control China impact outlook May 2026",
            topic="regulation",
            time_window="7d",
            max_results=5,
            include_answer=False,
            include_raw_content=False,
            domains_allowlist=[],
            domains_blocklist=[],
        )

        payload = _request_payload(input_data, "test-key")

        self.assertEqual(payload["topic"], "news")
        self.assertEqual(payload["time_range"], "week")
        self.assertNotIn("include_domains", payload)
        self.assertNotIn("exclude_domains", payload)

    def test_search_web_maps_company_topic_to_finance_without_unsupported_time_range(self) -> None:
        input_data = SearchWebInput(
            query="NVIDIA company guidance data center outlook",
            topic="company",
            time_window="custom:earnings-window",
        )

        payload = _request_payload(input_data, "test-key")

        self.assertEqual(payload["topic"], "finance")
        self.assertNotIn("time_range", payload)

    def test_action_tools_complete_dry_run_submission_flow_and_emit_artifacts(self) -> None:
        async def _run() -> None:
            store = InMemoryArtifactStore()
            runtime_context = _runtime_context(artifact_store=store)
            adapter = ToolAdapter(runtime_context=runtime_context, sequencer=EventSequencer())
            run_context = _nvda_run_context()

            account, account_events = await adapter.invoke(
                build_get_account_context_tool(run_context),
                {
                    "symbols": ["NVDA"],
                    "include_recent_activity": True,
                    "relation_hints": [{"key": "issuer", "value": "NVIDIA"}],
                },
            )
            self.assertTrue(account["ok"])
            self.assertEqual(account["broker_mode"], "dry_run")

            evaluation, evaluation_events = await adapter.invoke(
                build_evaluate_thesis_tool(run_context),
                {
                    "evidence_board_artifact_id": "artifact_evidence_1",
                    "account_context_id": account["account_context_id"],
                    "intent_hint": "propose_trade",
                },
            )
            self.assertEqual(evaluation["suggested_intent"], "propose_trade")
            self.assertTrue(str(evaluation["thesis_evaluation_artifact_id"]).startswith("artifact_"))
            self.assertEqual(evaluation["next_tool"], "build_action_plan")
            self.assertEqual(evaluation["next_tool_input"]["thesis_evaluation_artifact_id"], evaluation["thesis_evaluation_artifact_id"])
            self.assertEqual(evaluation["next_tool_input"]["account_context_id"], account["account_context_id"])
            self.assertEqual(evaluation["next_tool_input"]["target_symbols"], ["NVDA"])
            self.assertEqual(evaluation["next_tool_input"]["intended_action"], "open_long")

            action_plan, action_events = await adapter.invoke(
                build_build_action_plan_tool(run_context),
                {
                    "industry_analysis_artifact_id": "artifact_analysis_1",
                    "thesis_evaluation_artifact_id": evaluation["thesis_evaluation_artifact_id"],
                    "account_context_id": account["account_context_id"],
                    "target_symbols": ["NVDA"],
                    "intended_action": "open_long",
                    "conviction": "high",
                    "time_horizon": "short_term",
                    "constraints": ["dry_run only"],
                },
            )
            self.assertEqual(action_plan["intent"], "trade")
            self.assertTrue(str(action_plan["action_plan_artifact_id"]).startswith("artifact_"))
            self.assertEqual(action_plan["next_tool"], "submit_action_plan")
            self.assertEqual(action_plan["next_tool_input"]["action_plan_artifact_id"], action_plan["action_plan_artifact_id"])
            self.assertEqual(action_plan["next_tool_input"]["requested_mode_hint"], "auto_if_allowed")
            self.assertTrue(action_plan["next_tool_input"]["dry_run_allowed"])

            submission_port = _RecordingActionSubmissionPort()

            submission, submission_events = await adapter.invoke(
                build_submit_action_plan_tool(run_context, action_submission_port=submission_port),
                {
                    "action_plan_artifact_id": action_plan["action_plan_artifact_id"],
                    "industry_analysis_artifact_id": "artifact_analysis_1",
                    "evidence_artifact_ids": ["artifact_evidence_1"],
                    "requested_mode_hint": "auto_if_allowed",
                    "dry_run_allowed": True,
                    "idempotency_key": "nvda-earnings-open-long",
                },
            )

            self.assertEqual(submission["dispatch_status"], "action_requested")
            self.assertEqual(submission["approval_status_hint"], "pending_dispatch")
            self.assertEqual(submission["notification_status_hint"], "pending_dispatch")
            self.assertEqual(submission["resolved_mode"], "action_requested")
            self.assertEqual(submission["execution_status"], "not_executed")
            self.assertEqual(submission["policy_gate"]["status"], "pending_worker_evaluation")
            self.assertEqual(submission["action_request"]["target_id"], "NVDA")
            self.assertEqual(submission["action_plan_summary"]["orders"][0]["symbol"], "NVDA")
            self.assertEqual(submission["action_plan_summary"]["risk_controls"]["stop_loss_pct"], -4.5)
            self.assertEqual(submission_port.requests[0].action_request["proposed_payload"]["action_plan_summary"]["orders"][0]["notional_usd"], 9500.0)
            self.assertEqual(submission_port.requests[0].action_request["proposed_payload"]["action_plan_summary"]["monitoring_plan"]["duration"], "24h")
            self.assertNotIn("prompt", str(submission["action_request"]))
            self.assertNotIn("secret", str(submission["action_request"]))
            self.assertGreaterEqual(len(store.list_for_run()), 4)
            emitted_types = [event.type for event in [*account_events, *evaluation_events, *action_events, *submission_events]]
            self.assertGreaterEqual(emitted_types.count(AgentRunEventType.ARTIFACT_CREATED), 4)

        asyncio.run(_run())

    def test_submit_action_plan_publishes_through_submission_port(self) -> None:
        async def _run() -> None:
            store = InMemoryArtifactStore()
            runtime_context = _runtime_context(artifact_store=store)
            action_plan_ref = store.put(
                kind="action_plan",
                producer_id="test",
                payload={
                    "action_plan_artifact_id": "artifact_action",
                    "action_side": "increase_risk",
                    "orders": [{"symbol": "NVDA", "side": "buy", "notional_usd": 9500.0}],
                    "risk_controls": {"stop_loss_pct": -4.5, "secret": "do-not-leak"},
                    "summary": "NVDA dry-run action plan.",
                },
                content="NVDA dry-run action plan.",
                confidence_score=0.92,
            )
            port = _RecordingActionSubmissionPort()
            adapter = ToolAdapter(runtime_context=runtime_context, sequencer=EventSequencer())

            result, _events = await adapter.invoke(
                build_submit_action_plan_tool(_nvda_run_context(), action_submission_port=port),
                {
                    "action_plan_artifact_id": action_plan_ref.artifact_id,
                    "industry_analysis_artifact_id": "artifact_analysis_1",
                    "evidence_artifact_ids": ["artifact_evidence_1"],
                    "requested_mode_hint": "auto_if_allowed",
                    "dry_run_allowed": True,
                    "idempotency_key": "nvda-earnings-open-long",
                },
            )

            self.assertEqual(result["dispatch_status"], "action_requested")
            self.assertEqual(result["approval_status_hint"], "pending_dispatch")
            self.assertEqual(result["notification_status_hint"], "pending_dispatch")
            self.assertEqual(len(port.requests), 1)
            self.assertEqual(port.requests[0].action_request["target_id"], "NVDA")
            self.assertNotIn("do-not-leak", str(port.requests[0].action_request))

        asyncio.run(_run())

    def test_evaluate_thesis_accepts_evidence_summary_when_artifact_id_is_missing(self) -> None:
        async def _run() -> None:
            adapter = ToolAdapter(runtime_context=_runtime_context(artifact_store=InMemoryArtifactStore()), sequencer=EventSequencer())

            result, events = await adapter.invoke(
                build_evaluate_thesis_tool(_nvda_run_context()),
                {
                    "evidence_summary": "NVIDIA 一手财报强劲，但 Tavily 缺 key，市场预期和盘后反应缺失。",
                    "intent_hint": "propose_trade",
                },
            )

            self.assertTrue(result["ok"])
            self.assertEqual(result["suggested_intent"], "propose_trade")
            self.assertIsNone(result["evidence_board_artifact_id"])
            self.assertIn("Tavily", result["evidence_summary"])
            self.assertEqual(result["next_tool"], "build_action_plan")
            self.assertIn("industry_analysis_summary", result["next_tool_input"])
            self.assertEqual(result["next_tool_input"]["target_symbols"], ["NVDA"])
            self.assertIn(AgentRunEventType.ARTIFACT_CREATED, [event.type for event in events])

        asyncio.run(_run())

    def test_build_action_plan_accepts_industry_summary_when_artifact_id_is_missing(self) -> None:
        async def _run() -> None:
            adapter = ToolAdapter(runtime_context=_runtime_context(artifact_store=InMemoryArtifactStore()), sequencer=EventSequencer())

            result, events = await adapter.invoke(
                build_build_action_plan_tool(_nvda_run_context()),
                {
                    "industry_analysis_summary": "NVDA 一手财报收入和数据中心业务显著强劲，风险是市场预期缺失、盘后反应缺失和 H20 管制。",
                    "thesis_evaluation_artifact_id": "artifact_eval_1",
                    "account_context_id": "account_context_1",
                    "target_symbols": ["NVDA"],
                    "intended_action": "open_long",
                    "conviction": "high",
                    "time_horizon": "short_term",
                    "constraints": ["dry_run only"],
                },
            )

            self.assertTrue(result["ok"])
            self.assertIsNone(result["industry_analysis_artifact_id"])
            self.assertIn("NVDA", result["industry_analysis_summary"])
            self.assertTrue(str(result["action_plan_artifact_id"]).startswith("artifact_"))
            self.assertEqual(result["next_tool"], "submit_action_plan")
            self.assertEqual(result["next_tool_input"]["action_plan_artifact_id"], result["action_plan_artifact_id"])
            self.assertIn(AgentRunEventType.ARTIFACT_CREATED, [event.type for event in events])

        asyncio.run(_run())


def _runtime_context(*, artifact_store: InMemoryArtifactStore | None = None) -> ToolRuntimeContext:
    return ToolRuntimeContext(
        session_id="session_1",
        thread_id="thread_1",
        workspace_id="workspace_1",
        agent_run_id="run_1",
        event_id="event_1",
        industry_id="industry_semiconductor",
        agent_id="agent_main",
        trace_id="trace_1",
        tool_profile_id="tool_profile_1",
        artifact_store=artifact_store,
    )


def _nvda_run_context() -> RunContextSnapshot:
    return RunContextSnapshot(
        context_id="context_nvda",
        sections=[
            RunContextSection(
                name="event",
                summary="NVIDIA official FY2027 Q1 earnings entered within 5 minutes.",
                data={
                    "event_id": "evt_debug_nvda_fy2027_q1_earnings_official",
                    "event_family": "quarterly_earnings",
                    "symbols": ["NVDA"],
                    "guidance": {"guidance_note": "H20 出口管制影响，不含对中国出货。"},
                },
            ),
            RunContextSection(
                name="risk_policy",
                summary="Dry-run broker mode.",
                data={"broker_mode": "dry_run"},
            ),
            RunContextSection(
                name="recent_activity_summary",
                summary="No prior action.",
                data={"recent_same_topic_run": False, "prior_notification_sent": False},
            ),
        ],
        content="NVDA run context",
    )


class _RecordingActionSubmissionPort:
    def __init__(self) -> None:
        self.requests = []

    async def submit(self, request):
        self.requests.append(request)
        return ActionSubmissionResult(
            action_request_id=request.action_request_id,
            submission_id=request.submission_id,
            dispatch_status="action_requested",
            approval_status_hint="pending_dispatch",
            notification_status_hint="pending_dispatch",
        )
