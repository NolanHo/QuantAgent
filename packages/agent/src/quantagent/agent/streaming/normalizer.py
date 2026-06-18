from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from quantagent.agent.definitions.models import AgentDefinition, SubAgentDefinition
from quantagent.agent.runtime.requests import AgentRunRequest
from quantagent.agent.streaming.events import AgentRunEvent, AgentRunEventType
from quantagent.agent.streaming.protocol import (
    AgentRuntimeActor,
    AgentRuntimeContent,
    AgentRuntimeEventV1,
    AgentRuntimeRender,
    AgentRuntimeSpan,
    AgentRuntimeSubagent,
    AgentRuntimeTool,
)


@dataclass
class SubagentSpan:
    span_id: str
    subagent_id: str
    name: str
    display_name: str
    task_call_id: str
    input: str | None = None
    output: str | None = None


@dataclass
class AgentRuntimeProtocolState:
    request: AgentRunRequest
    main_span_id: str
    subagent_by_task_call_id: dict[str, SubagentSpan] = field(default_factory=dict)
    subagent_by_name: dict[str, SubagentSpan] = field(default_factory=dict)
    subagent_by_namespace: dict[tuple[str, ...], SubagentSpan] = field(default_factory=dict)

    @classmethod
    def create(cls, request: AgentRunRequest) -> "AgentRuntimeProtocolState":
        return cls(request=request, main_span_id=f"span_main_{request.agent_run_id}")


def normalize_agent_run_event(event: AgentRunEvent, state: AgentRuntimeProtocolState) -> AgentRuntimeEventV1:
    if event.type == AgentRunEventType.RUN_STARTED:
        return _event(
            event,
            state,
            event_type="run.started",
            actor=_main_actor(state.request.agent_definition),
            span=_main_span(state),
            render=_render("runtime", state.main_span_id, "side_panel", "notice"),
            content=_content_text(event.content),
            raw=event.payload,
        )
    if event.type == AgentRunEventType.RUN_COMPLETED:
        return _event(
            event,
            state,
            event_type="run.completed",
            actor=_runtime_actor(),
            span=_runtime_span(state),
            render=_render("runtime", state.main_span_id, "side_panel", "notice"),
            content=_content_text(event.content),
            raw=event.payload,
        )
    if event.type == AgentRunEventType.RUN_FAILED:
        return _event(
            event,
            state,
            event_type="run.failed",
            actor=_runtime_actor(),
            span=_runtime_span(state),
            render=_render("runtime", state.main_span_id, "side_panel", "notice"),
            content=_content_text(event.content),
            raw=event.payload,
        )
    if event.type == AgentRunEventType.MODEL_REASONING:
        owner = _owner_from_event(event, state)
        return _event(
            event,
            state,
            event_type="agent.reasoning.delta",
            actor=owner_actor(owner, state.request.agent_definition),
            span=owner_span(owner, state),
            render=_owner_render(owner, state, "cot", "reasoning"),
            content=AgentRuntimeContent(format="markdown", text=event.content or _read_string(event.payload.get("reasoning")), delta_mode="append"),
            subagent=_subagent_payload(owner),
            raw=_raw_payload(event.payload),
        )
    if event.type == AgentRunEventType.MODEL_DELTA:
        owner = _owner_from_event(event, state)
        return _event(
            event,
            state,
            event_type="agent.message.delta",
            actor=owner_actor(owner, state.request.agent_definition),
            span=owner_span(owner, state),
            render=_owner_render(owner, state, "cot", "message"),
            content=AgentRuntimeContent(format="markdown", text=event.content or _read_string(event.payload.get("delta")), delta_mode="append"),
            subagent=_subagent_payload(owner),
            raw=_raw_payload(event.payload),
        )
    if event.type == AgentRunEventType.RUN_OUTPUT:
        owner = _owner_from_event(event, state)
        if owner is not None:
            owner.output = event.content or owner.output
            if _is_report_like_content(event.content):
                return _report_artifact_event(event, state, owner=owner, source="subagent_run_output")
            return _event(
                event,
                state,
                event_type="subagent.completed",
                actor=owner_actor(owner, state.request.agent_definition),
                span=owner_span(owner, state),
                render=_owner_render(owner, state, "cot", "notice"),
                content=AgentRuntimeContent(format="markdown", text=event.content or "", delta_mode="snapshot"),
                subagent=_subagent_payload(owner),
                raw=_raw_payload(event.payload),
            )
        if _is_intermediate_run_output(event) and _is_report_like_content(event.content):
            return _report_artifact_event(event, state, owner=None, source="main_intermediate_output")
        return _event(
            event,
            state,
            event_type="agent.message.final",
            actor=_main_actor(state.request.agent_definition),
            span=_main_span(state),
            render=_render("main", state.main_span_id, "final", "message"),
            content=AgentRuntimeContent(format="markdown", text=event.content or "", delta_mode="snapshot"),
            raw=_raw_payload(event.payload),
        )
    if event.type == AgentRunEventType.TODO_UPDATED:
        owner = _owner_from_event(event, state)
        return _event(
            event,
            state,
            event_type="todo.updated",
            actor=owner_actor(owner, state.request.agent_definition),
            span=owner_span(owner, state),
            render=_owner_render(owner, state, "cot", "todo"),
            content=AgentRuntimeContent(format="json", json=event.payload.get("todos"), delta_mode="snapshot"),
            subagent=_subagent_payload(owner),
            raw=_raw_payload(event.payload),
        )
    if event.type in {AgentRunEventType.TOOL_STARTED, AgentRunEventType.TOOL_COMPLETED, AgentRunEventType.TOOL_FAILED}:
        runtime_event = _normalize_tool_event(event, state)
        _remember_task_subagent(event, state, runtime_event)
        return runtime_event
    if event.type in {AgentRunEventType.SUBAGENT_STARTED, AgentRunEventType.SUBAGENT_COMPLETED}:
        subagent = _owner_from_event(event, state)
        if event.type == AgentRunEventType.SUBAGENT_COMPLETED and subagent is not None and _is_report_like_content(event.content):
            subagent.output = event.content or subagent.output
            return _report_artifact_event(event, state, owner=subagent, source="subagent_completed_output")
        return _event(
            event,
            state,
            event_type="subagent.started" if event.type == AgentRunEventType.SUBAGENT_STARTED else "subagent.completed",
            actor=owner_actor(subagent, state.request.agent_definition),
            span=owner_span(subagent, state),
            render=_owner_render(subagent, state, "cot", "notice"),
            content=_content_text(event.content),
            subagent=_subagent_payload(subagent),
            raw=_raw_payload(event.payload),
        )
    if event.type == AgentRunEventType.ARTIFACT_CREATED:
        owner = _owner_from_event(event, state)
        return _event(
            event,
            state,
            event_type="artifact.created",
            actor=owner_actor(owner, state.request.agent_definition),
            span=owner_span(owner, state),
            render=_owner_render(owner, state, "cot", "artifact"),
            content=AgentRuntimeContent(format="json", json=event.payload, delta_mode="snapshot"),
            subagent=_subagent_payload(owner),
            raw=_raw_payload(event.payload),
        )
    if event.type == AgentRunEventType.INTERRUPT_REQUESTED:
        owner = _owner_from_event(event, state)
        return _event(
            event,
            state,
            event_type="interrupt.requested",
            actor=owner_actor(owner, state.request.agent_definition),
            span=owner_span(owner, state),
            render=_owner_render(owner, state, "cot", "notice"),
            content=_content_text(event.content),
            subagent=_subagent_payload(owner),
            raw=_raw_payload(event.payload),
        )
    return _event(
        event,
        state,
        event_type="runtime.raw",
        actor=_runtime_actor(),
        span=_runtime_span(state),
        render=_render("runtime", state.main_span_id, "side_panel", "notice"),
        content=_content_text(event.content),
        raw=event.payload,
    )


def _normalize_tool_event(event: AgentRunEvent, state: AgentRuntimeProtocolState) -> AgentRuntimeEventV1:
    call_id = _tool_call_id(event.payload) or event.event_id
    tool_name = _read_string(event.payload.get("name")) or _read_string(event.payload.get("tool_name")) or "tool"
    task_delegate = tool_name == "task"
    # 中文注释：DeepAgents 的 task 工具调用属于 MainAgent 委派动作；
    # 即使它带有已绑定的 task namespace，也不能把 task.completed 归入 SubAgent 内部过程。
    owner = None if task_delegate else _owner_from_event(event, state)
    tool_span = AgentRuntimeSpan(
        span_id=f"span_tool_{call_id}",
        parent_span_id=owner_span(owner, state).span_id,
        kind="tool_call",
    )
    error = None
    if event.type == AgentRunEventType.TOOL_FAILED:
        error = {
            "type": _read_string(event.payload.get("error_type")) or "ToolError",
            "message": _read_string(event.payload.get("error")) or event.content or "Tool failed.",
        }
    return _event(
        event,
        state,
        event_type=_tool_runtime_event_type(event.type),
        actor=AgentRuntimeActor(type="tool", id=tool_name, name=tool_name, display_name=tool_name),
        span=tool_span,
        render=_owner_render(owner, state, "cot", "tool"),
        content=_task_tool_content(event) if task_delegate else _content_text(event.content),
        tool=AgentRuntimeTool(
            call_id=call_id,
            name=tool_name,
            input=event.payload.get("input") if "input" in event.payload else event.payload.get("args"),
            output=None if task_delegate else event.payload.get("result") if "result" in event.payload else event.payload.get("output"),
            error=error,
        ),
        subagent=_subagent_payload(owner),
        raw=_raw_payload(event.payload),
    )


def _remember_task_subagent(event: AgentRunEvent, state: AgentRuntimeProtocolState, runtime_event: AgentRuntimeEventV1) -> None:
    if event.type != AgentRunEventType.TOOL_STARTED or runtime_event.tool is None or runtime_event.tool.name != "task":
        return
    subagent_name = _task_subagent_name(event.payload)
    if subagent_name is None:
        return
    subagent = next((candidate for candidate in state.request.agent_definition.subagents if candidate.name == subagent_name), None)
    if subagent is None:
        return
    span = SubagentSpan(
        span_id=f"span_subagent_{runtime_event.tool.call_id}",
        subagent_id=subagent.subagent_id,
        name=subagent.name,
        display_name=_subagent_display_name(subagent),
        task_call_id=runtime_event.tool.call_id,
        input=_task_instruction(event.payload),
    )
    state.subagent_by_task_call_id[runtime_event.tool.call_id] = span
    state.subagent_by_name[span.name] = span
    namespace = _payload_namespace(event.payload)
    if namespace:
        state.subagent_by_namespace[namespace] = span


def _owner_from_event(event: AgentRunEvent, state: AgentRuntimeProtocolState) -> SubagentSpan | None:
    subagent_name = _read_string(event.payload.get("subagent_name"))
    if subagent_name:
        span = state.subagent_by_name.get(subagent_name)
        if span is not None:
            return span
        subagent = next((candidate for candidate in state.request.agent_definition.subagents if candidate.name == subagent_name), None)
        if subagent is not None:
            return SubagentSpan(
                span_id=f"span_subagent_{subagent.name}",
                subagent_id=subagent.subagent_id,
                name=subagent.name,
                display_name=_subagent_display_name(subagent),
                task_call_id=_tool_call_id(event.payload) or subagent.name,
            )
    namespace = _payload_namespace(event.payload)
    if namespace:
        for size in range(len(namespace), 0, -1):
            span = state.subagent_by_namespace.get(namespace[:size])
            if span is not None:
                return span
    return None


def owner_actor(owner: SubagentSpan | None, definition: AgentDefinition) -> AgentRuntimeActor:
    if owner is None:
        return _main_actor(definition)
    return AgentRuntimeActor(type="subagent", id=owner.subagent_id, name=owner.name, display_name=owner.display_name)


def owner_span(owner: SubagentSpan | None, state: AgentRuntimeProtocolState) -> AgentRuntimeSpan:
    if owner is None:
        return _main_span(state)
    return AgentRuntimeSpan(span_id=owner.span_id, parent_span_id=state.main_span_id, kind="subagent_run")


def _owner_render(owner: SubagentSpan | None, state: AgentRuntimeProtocolState, target: str, content_kind: str) -> AgentRuntimeRender:
    if owner is None:
        return _render("main", state.main_span_id, target, content_kind)
    return _render("subagent", owner.span_id, target, content_kind)


def _event(
    event: AgentRunEvent,
    state: AgentRuntimeProtocolState,
    *,
    event_type: str,
    actor: AgentRuntimeActor,
    span: AgentRuntimeSpan,
    render: AgentRuntimeRender,
    content: AgentRuntimeContent | None = None,
    tool: AgentRuntimeTool | None = None,
    subagent: AgentRuntimeSubagent | None = None,
    raw: Any | None = None,
) -> AgentRuntimeEventV1:
    return AgentRuntimeEventV1(
        event_id=event.event_id,
        session_id=state.request.session_id,
        thread_id=state.request.thread_id,
        workspace_id=state.request.workspace_id,
        agent_run_id=event.agent_run_id,
        seq=event.seq,
        event_type=event_type,  # type: ignore[arg-type]
        actor=actor,
        span=span,
        render=render,
        content=content,
        tool=tool,
        subagent=subagent,
        raw=raw,
    )


def _report_artifact_event(
    event: AgentRunEvent,
    state: AgentRuntimeProtocolState,
    *,
    owner: SubagentSpan | None,
    source: str,
) -> AgentRuntimeEventV1:
    markdown = event.content or ""
    title = f"{owner.display_name} 报告" if owner is not None else f"{state.request.agent_definition.name} 报告"
    summary = _report_summary(markdown)
    group_id = owner.span_id if owner is not None else state.main_span_id
    report_key = "run_report"
    payload = {
        "artifact_id": f"artifact_report_{group_id}_{report_key}",
        "artifact_type": "report",
        "report_key": report_key,
        "title": title,
        "summary": summary,
        "content_markdown": markdown,
        "agent_name": owner.name if owner is not None else state.request.agent_definition.name,
        "agent_display_name": owner.display_name if owner is not None else state.request.agent_definition.name,
        "group_id": group_id,
        "source": source,
        "source_event_id": event.event_id,
        "source_seq": event.seq,
    }
    # 中文注释：长报告在协议层产物化，前端只按 artifact.created 渲染卡片，
    # 不再用正文长度或 namespace 猜测“这是不是报告”。
    return _event(
        event,
        state,
        event_type="artifact.created",
        actor=owner_actor(owner, state.request.agent_definition),
        span=owner_span(owner, state),
        render=_owner_render(owner, state, "cot", "artifact"),
        content=AgentRuntimeContent(format="json", text=summary, json=payload, delta_mode="snapshot"),
        subagent=_subagent_payload(owner),
        raw={**_raw_payload(event.payload), "artifact": payload},
    )


def _main_actor(definition: AgentDefinition) -> AgentRuntimeActor:
    return AgentRuntimeActor(
        type="main_agent",
        id=definition.agent_id,
        name=definition.name,
        display_name=definition.name or "MainAgent",
    )


def _runtime_actor() -> AgentRuntimeActor:
    return AgentRuntimeActor(type="runtime", id="agent_runtime", name="AgentRuntime", display_name="AgentRuntime")


def _main_span(state: AgentRuntimeProtocolState) -> AgentRuntimeSpan:
    return AgentRuntimeSpan(span_id=state.main_span_id, parent_span_id=None, kind="main_run")


def _runtime_span(state: AgentRuntimeProtocolState) -> AgentRuntimeSpan:
    return AgentRuntimeSpan(span_id=f"span_runtime_{state.request.agent_run_id}", parent_span_id=state.main_span_id, kind="runtime")


def _render(lane: str, group_id: str, target: str, content_kind: str) -> AgentRuntimeRender:
    return AgentRuntimeRender(lane=lane, group_id=group_id, target=target, content_kind=content_kind)  # type: ignore[arg-type]


def _tool_runtime_event_type(event_type: AgentRunEventType) -> str:
    if event_type == AgentRunEventType.TOOL_STARTED:
        return "tool.started"
    if event_type == AgentRunEventType.TOOL_COMPLETED:
        return "tool.completed"
    return "tool.failed"


def _content_text(text: str | None) -> AgentRuntimeContent | None:
    if text is None:
        return None
    return AgentRuntimeContent(format="markdown", text=text, delta_mode="append")


def _task_tool_content(event: AgentRunEvent) -> AgentRuntimeContent | None:
    if event.type == AgentRunEventType.TOOL_STARTED:
        return _content_text("开始委派 SubAgent。")
    if event.type == AgentRunEventType.TOOL_COMPLETED:
        return _content_text("SubAgent 已返回结果；详细执行过程在 SubAgent 节点中展示。")
    return _content_text(event.content)


def _is_intermediate_run_output(event: AgentRunEvent) -> bool:
    return event.payload.get("source") != "stream"


def _is_report_like_content(text: str | None) -> bool:
    if not text:
        return False
    stripped = text.strip()
    title = _report_summary(stripped)
    report_terms = ("报告", "简报", "总结", "结论", "分析", "IndustryAnalysis", "Research")
    has_report_title = any(term in title for term in report_terms)
    has_complete_table = _has_complete_markdown_table(stripped)
    heading_lines = sum(1 for line in stripped.splitlines() if line.lstrip().startswith("#"))
    list_lines = sum(1 for line in stripped.splitlines() if line.lstrip().startswith(("- ", "1. ")))
    if has_complete_table and (heading_lines >= 1 or has_report_title):
        return True
    if len(stripped) < 420:
        return False
    # 中文注释：只把结构化长文产物化；普通长段落继续作为 COT 正文，避免过程内容被误吞成报告。
    return has_report_title or has_complete_table or heading_lines >= 2 or (heading_lines >= 1 and list_lines >= 3)


def _has_complete_markdown_table(text: str) -> bool:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for index, line in enumerate(lines[:-2]):
        if not _is_markdown_table_row(line):
            continue
        separator = lines[index + 1]
        data_row = lines[index + 2]
        if _is_markdown_table_separator(separator) and _is_markdown_table_row(data_row):
            return True
    return False


def _is_markdown_table_row(line: str) -> bool:
    return line.startswith("|") and line.endswith("|") and line.count("|") >= 2


def _is_markdown_table_separator(line: str) -> bool:
    if not _is_markdown_table_row(line):
        return False
    cells = [cell.strip() for cell in line.strip("|").split("|")]
    return bool(cells) and all(cell and set(cell) <= {"-", ":"} and "-" in cell for cell in cells)


def _report_summary(markdown: str) -> str:
    for line in markdown.splitlines():
        cleaned = line.strip().strip("#").strip()
        if cleaned and not cleaned.startswith("|") and set(cleaned) != {"-"}:
            return cleaned[:180]
    compact = " ".join(markdown.split())
    return compact[:180] if compact else "报告已生成。"


def _subagent_payload(owner: SubagentSpan | None) -> AgentRuntimeSubagent | None:
    if owner is None:
        return None
    return AgentRuntimeSubagent(
        subagent_id=owner.subagent_id,
        name=owner.name,
        task_call_id=owner.task_call_id,
        input=owner.input,
        output=owner.output,
    )


def _tool_call_id(payload: Mapping[str, Any]) -> str | None:
    for key in ("tool_call_id", "call_id", "invocation_id"):
        value = payload.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def _task_subagent_name(payload: Mapping[str, Any]) -> str | None:
    tool_input = payload.get("input")
    if not isinstance(tool_input, Mapping):
        tool_input = payload.get("args")
    if not isinstance(tool_input, Mapping):
        return None
    for key in ("agent", "agent_name", "subagent", "subagent_name", "subagent_type"):
        value = tool_input.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def _task_instruction(payload: Mapping[str, Any]) -> str | None:
    tool_input = payload.get("input")
    if not isinstance(tool_input, Mapping):
        tool_input = payload.get("args")
    if not isinstance(tool_input, Mapping):
        return None
    for key in ("instruction", "task", "input"):
        value = tool_input.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def _payload_namespace(payload: Mapping[str, Any]) -> tuple[str, ...] | None:
    namespace = payload.get("graph_namespace")
    if not isinstance(namespace, list):
        return None
    result = tuple(item for item in namespace if isinstance(item, str) and item)
    return result or None


def _read_string(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None


def _subagent_display_name(subagent: SubAgentDefinition) -> str:
    if subagent.name == "evidence_research_analyst":
        return "Research Agent"
    return subagent.name


def _raw_payload(payload: Mapping[str, Any]) -> dict[str, Any]:
    raw = dict(payload)
    raw.pop("runtime_event", None)
    return raw
