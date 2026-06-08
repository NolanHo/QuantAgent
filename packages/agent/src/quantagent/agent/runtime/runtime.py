from __future__ import annotations

from collections.abc import AsyncIterator, Awaitable, Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Protocol

from quantagent.agent.artifacts import ArtifactStore, InMemoryArtifactStore
from quantagent.agent.runtime.context import ToolRuntimeContext
from quantagent.agent.runtime.deepagents_harness import (
    DEEPAGENTS_FILESYSTEM_TOOL_NAMES,
    configure_quantagent_deepagents_harness,
    quantagent_tool_visibility_middleware,
)
from quantagent.agent.runtime.errors import AgentRuntimeError, DeepAgentsUnavailableError
from quantagent.agent.runtime.requests import AgentRunRequest, AgentRunResult
from quantagent.agent.streaming.adapter import (
    EventSequencer,
    iter_deepagents_stream_events,
)
from quantagent.agent.streaming.events import AgentRunEvent, AgentRunEventType
from quantagent.agent.streaming.normalizer import AgentRuntimeProtocolState, normalize_agent_run_event
from quantagent.agent.tools.adapter import PlatformTool


class DeepAgentGraph(Protocol):
    def invoke(self, input_data: Mapping[str, Any], config: Mapping[str, Any] | None = None) -> Any: ...

    def stream(self, input_data: Mapping[str, Any], config: Mapping[str, Any] | None = None) -> Iterable[Any]: ...

    async def astream(self, input_data: Mapping[str, Any], config: Mapping[str, Any] | None = None) -> AsyncIterator[Any]: ...


DeepAgentFactory = Callable[[AgentRunRequest, Sequence[Any]], DeepAgentGraph]
ScriptedRunner = Callable[[AgentRunRequest, EventSequencer, ArtifactStore], AsyncIterator[AgentRunEvent]]


@dataclass(frozen=True)
class DeepAgentToolBundle:
    main_tools: list[Any]
    subagent_tools_by_name: dict[str, list[Any]]
    all_tool_ids: list[str]


@dataclass(frozen=True)
class AgentRuntimeDependencies:
    tools: list[PlatformTool[Any]]
    artifact_store: ArtifactStore
    deep_agent_factory: DeepAgentFactory | None = None
    scripted_runner: ScriptedRunner | None = None


class AgentRuntime:
    def __init__(
        self,
        *,
        tools: list[PlatformTool[Any]] | None = None,
        artifact_store: ArtifactStore | None = None,
        deep_agent_factory: DeepAgentFactory | None = None,
        scripted_runner: ScriptedRunner | None = None,
    ) -> None:
        self._deps = AgentRuntimeDependencies(
            tools=tools or [],
            artifact_store=artifact_store or InMemoryArtifactStore(),
            deep_agent_factory=deep_agent_factory,
            scripted_runner=scripted_runner,
        )

    async def run(self, request: AgentRunRequest) -> AgentRunResult:
        events: list[AgentRunEvent] = []
        async for event in self.run_stream(request):
            events.append(event)
        status = "completed" if events and events[-1].type == AgentRunEventType.RUN_COMPLETED else "failed"
        output = next((event.content or "" for event in reversed(events) if event.type == AgentRunEventType.RUN_OUTPUT), "")
        return AgentRunResult(
            agent_run_id=request.agent_run_id,
            status=status,
            output_content=output,
            artifact_refs=self._deps.artifact_store.list_for_run(),
            events=events,
        )

    async def run_stream(self, request: AgentRunRequest) -> AsyncIterator[AgentRunEvent]:
        sequencer = EventSequencer()
        protocol_state = AgentRuntimeProtocolState.create(request)
        yield _with_runtime_protocol(
            sequencer.next(
                agent_run_id=request.agent_run_id,
                trace_id=request.trace_id,
                event_type=AgentRunEventType.RUN_STARTED,
                payload={
                    "session_id": request.session_id,
                    "thread_id": request.thread_id,
                    "workspace_id": request.workspace_id,
                    "event_id": request.event_id,
                    "industry_id": request.industry_id,
                    "agent_id": request.agent_definition.agent_id,
                    "agent_version": request.agent_definition.version,
                    "input_message": request.input_message,
                    "system_prompt": request.agent_definition.system_prompt,
                    "runtime_policy": request.runtime_policy.model_dump(mode="json", exclude={"model"}),
                    "tool_profile": request.tool_profile.model_dump(mode="json"),
                },
                content=f"AgentRun {request.agent_run_id} started.",
            ),
            protocol_state,
        )

        try:
            if self._deps.scripted_runner is not None:
                async for event in self._deps.scripted_runner(request, sequencer, self._deps.artifact_store):
                    yield _with_runtime_protocol(event, protocol_state)
            else:
                async for event in self._run_deep_agent(request, sequencer, protocol_state):
                    yield _with_runtime_protocol(event, protocol_state)

            yield _with_runtime_protocol(
                sequencer.next(
                    agent_run_id=request.agent_run_id,
                    trace_id=request.trace_id,
                    event_type=AgentRunEventType.RUN_COMPLETED,
                    payload={"artifact_ids": [ref.artifact_id for ref in self._deps.artifact_store.list_for_run()]},
                    content=f"AgentRun {request.agent_run_id} completed.",
                ),
                protocol_state,
            )
        except Exception as exc:  # noqa: BLE001
            error = _runtime_error_content(exc)
            yield _with_runtime_protocol(
                sequencer.next(
                    agent_run_id=request.agent_run_id,
                    trace_id=request.trace_id,
                    event_type=AgentRunEventType.RUN_FAILED,
                    payload={"error": str(exc), "error_type": type(exc).__name__},
                    content=error,
                ),
                protocol_state,
            )

    def tool_runtime_context(
        self,
        request: AgentRunRequest,
        *,
        subagent_id: str | None = None,
        subagent_name: str | None = None,
    ) -> ToolRuntimeContext:
        return ToolRuntimeContext(
            session_id=request.session_id,
            thread_id=request.thread_id,
            workspace_id=request.workspace_id,
            agent_run_id=request.agent_run_id,
            event_id=request.event_id,
            industry_id=request.industry_id,
            agent_id=request.agent_definition.agent_id,
            subagent_id=subagent_id,
            subagent_name=subagent_name,
            trace_id=request.trace_id,
            tool_profile_id=request.tool_profile.profile_id,
            artifact_store=self._deps.artifact_store,
        )

    async def _run_deep_agent(
        self,
        request: AgentRunRequest,
        sequencer: EventSequencer,
        protocol_state: AgentRuntimeProtocolState,
    ) -> AsyncIterator[AgentRunEvent]:
        factory = self._deps.deep_agent_factory or self._default_deep_agent_factory
        tool_events: list[AgentRunEvent] = []
        tool_bundle = self._build_deep_agent_tool_bundle(request, sequencer, tool_events)
        if self._deps.deep_agent_factory is not None:
            graph = factory(
                request,
                self._build_langchain_tools(request, sequencer, tool_events, tool_ids=tool_bundle.all_tool_ids),
            )
        else:
            graph = self._default_deep_agent_factory(request, tool_bundle)
        config = {
            "configurable": {
                "thread_id": request.thread_id,
                "session_id": request.session_id,
                "workspace_id": request.workspace_id,
                "agent_run_id": request.agent_run_id,
            }
        }
        recursion_limit = _runtime_recursion_limit(request)
        if recursion_limit is not None:
            config["recursion_limit"] = recursion_limit
        input_data = {"messages": [{"role": "user", "content": request.input_message}]}

        # 中文注释：DeepAgents frontend 需要同时看到 assistant message 流和 state updates，不能只消费默认结构 chunk。
        # 中文注释：MainAgent 和 SubAgent 的平台工具都由 ToolAdapter 产出前端可见事件；
        # DeepAgents message 通道里的同名 tool_call 只作为模型侧原始流，避免重复渲染。
        platform_tool_names = {
            binding.name
            for binding in request.tool_profile.tool_bindings
            if binding.tool_id in tool_bundle.all_tool_ids
        }
        platform_tool_call_names: dict[str, str] = {}
        deepagents_filesystem_tool_call_names: dict[str, str] = {}
        subagent_scope_by_namespace: dict[tuple[str, ...], str] = {}
        pending_task_subagents: dict[str, str] = {}
        pending_message_buffers: dict[str, dict[str, Any]] = {}
        emitted_report_text_by_key: dict[str, str] = {}
        main_report_outputs: list[str] = []
        stream = _open_deepagents_stream(graph, input_data, config)
        last_summary = ""
        async for chunk in stream:
            while tool_events:
                for buffered_event in _flush_message_buffers(
                    pending_message_buffers,
                    emitted_report_text_by_key,
                    request=request,
                    sequencer=sequencer,
                    final_flush=False,
                ):
                    if buffered_event.type == AgentRunEventType.MODEL_DELTA and buffered_event.content and buffered_event.payload.get("actor_type") != "subagent":
                        last_summary += buffered_event.content
                    elif _is_main_intermediate_report_event(buffered_event):
                        main_report_outputs.append(buffered_event.content or "")
                        last_summary = _strip_known_report_outputs(last_summary, main_report_outputs)
                    yield buffered_event
                tool_event = tool_events.pop(0)
                _remember_platform_tool_call(platform_tool_call_names, tool_event)
                yield tool_event
            for event_type, payload, summary in iter_deepagents_stream_events(chunk):
                _remember_subagent_namespace(subagent_scope_by_namespace, pending_task_subagents, event_type, payload, request)
                _bind_pending_task_namespace(subagent_scope_by_namespace, pending_task_subagents, payload)
                payload = _bind_known_subagent_namespace(payload, subagent_scope_by_namespace, request)
                if _is_deepagents_filesystem_tool_event(event_type, payload, deepagents_filesystem_tool_call_names):
                    continue
                if event_type == AgentRunEventType.TOOL_STARTED and payload.get("name") in platform_tool_names:
                    call_id = payload.get("tool_call_id") or payload.get("call_id")
                    if isinstance(call_id, str) and isinstance(payload.get("name"), str):
                        platform_tool_call_names[call_id] = payload["name"]
                    continue
                if _is_platform_tool_message(event_type, payload, platform_tool_names, platform_tool_call_names):
                    continue
                is_subagent_event = payload.get("actor_type") == "subagent" and payload.get("subagent_name")
                if event_type == AgentRunEventType.MODEL_DELTA and summary:
                    if _should_buffer_message_delta(pending_message_buffers, payload=payload, text=summary):
                        _append_message_buffer(pending_message_buffers, payload=payload, text=summary)
                        for buffered_event in _flush_message_buffers(
                            pending_message_buffers,
                            emitted_report_text_by_key,
                            request=request,
                            sequencer=sequencer,
                            final_flush=False,
                        ):
                            if buffered_event.type == AgentRunEventType.MODEL_DELTA and buffered_event.content and buffered_event.payload.get("actor_type") != "subagent":
                                last_summary += buffered_event.content
                            elif _is_main_intermediate_report_event(buffered_event):
                                main_report_outputs.append(buffered_event.content or "")
                                last_summary = _strip_known_report_outputs(last_summary, main_report_outputs)
                            yield buffered_event
                        continue
                drop_current_event = False
                if event_type == AgentRunEventType.RUN_OUTPUT and summary:
                    dropped = _drop_duplicate_message_buffer(pending_message_buffers, emitted_report_text_by_key, payload=payload, text=summary)
                    if not dropped:
                        for buffered_event in _flush_message_buffers(
                            pending_message_buffers,
                            emitted_report_text_by_key,
                            request=request,
                            sequencer=sequencer,
                            final_flush=False,
                        ):
                            if buffered_event.type == AgentRunEventType.MODEL_DELTA and buffered_event.content and buffered_event.payload.get("actor_type") != "subagent":
                                last_summary += buffered_event.content
                            elif _is_main_intermediate_report_event(buffered_event):
                                main_report_outputs.append(buffered_event.content or "")
                                last_summary = _strip_known_report_outputs(last_summary, main_report_outputs)
                            yield buffered_event
                    if _is_intermediate_report_output(payload, summary):
                        _remember_report_output(pending_message_buffers, emitted_report_text_by_key, payload=payload, text=summary)
                        if not is_subagent_event:
                            main_report_outputs.append(summary)
                            last_summary = _strip_known_report_outputs(last_summary, main_report_outputs)
                else:
                    for buffered_event in _flush_message_buffers(
                        pending_message_buffers,
                        emitted_report_text_by_key,
                        request=request,
                        sequencer=sequencer,
                        final_flush=False,
                        ):
                        if buffered_event.type == AgentRunEventType.MODEL_DELTA and buffered_event.content and buffered_event.payload.get("actor_type") != "subagent":
                            last_summary += buffered_event.content
                        elif _is_main_intermediate_report_event(buffered_event):
                            main_report_outputs.append(buffered_event.content or "")
                            last_summary = _strip_known_report_outputs(last_summary, main_report_outputs)
                        yield buffered_event
                if (
                    event_type == AgentRunEventType.MODEL_DELTA
                    and summary
                    and _is_replayed_report_delta(emitted_report_text_by_key, payload=payload, text=summary)
                ):
                    drop_current_event = True
                    if not is_subagent_event:
                        last_summary = _strip_known_report_outputs(last_summary, [summary])
                elif event_type == AgentRunEventType.MODEL_DELTA and summary and not is_subagent_event:
                    last_summary += summary
                elif event_type == AgentRunEventType.RUN_OUTPUT and summary and not is_subagent_event and not _is_intermediate_report_output(payload, summary):
                    last_summary = summary
                if drop_current_event:
                    continue
                yield sequencer.next(
                    agent_run_id=request.agent_run_id,
                    trace_id=request.trace_id,
                    event_type=event_type,
                    payload=payload,
                    content=summary,
                )

        while tool_events:
            for buffered_event in _flush_message_buffers(
                pending_message_buffers,
                emitted_report_text_by_key,
                request=request,
                sequencer=sequencer,
                final_flush=False,
            ):
                if buffered_event.type == AgentRunEventType.MODEL_DELTA and buffered_event.content and buffered_event.payload.get("actor_type") != "subagent":
                    last_summary += buffered_event.content
                elif _is_main_intermediate_report_event(buffered_event):
                    main_report_outputs.append(buffered_event.content or "")
                    last_summary = _strip_known_report_outputs(last_summary, main_report_outputs)
                yield buffered_event
            tool_event = tool_events.pop(0)
            _remember_platform_tool_call(platform_tool_call_names, tool_event)
            yield tool_event
        for buffered_event in _flush_message_buffers(
            pending_message_buffers,
            emitted_report_text_by_key,
            request=request,
            sequencer=sequencer,
            final_flush=True,
        ):
            if buffered_event.type == AgentRunEventType.MODEL_DELTA and buffered_event.content and buffered_event.payload.get("actor_type") != "subagent":
                last_summary += buffered_event.content
            elif _is_main_intermediate_report_event(buffered_event):
                main_report_outputs.append(buffered_event.content or "")
                last_summary = _strip_known_report_outputs(last_summary, main_report_outputs)
            yield buffered_event
        last_summary = _clean_final_summary(last_summary, main_report_outputs)
        yield sequencer.next(
            agent_run_id=request.agent_run_id,
            trace_id=request.trace_id,
            event_type=AgentRunEventType.RUN_OUTPUT,
            payload={"source": "stream", "session_id": request.session_id, "thread_id": request.thread_id},
            content=last_summary,
        )

    @staticmethod
    def _default_deep_agent_factory(request: AgentRunRequest, tools: Sequence[Any] | DeepAgentToolBundle) -> DeepAgentGraph:
        try:
            from deepagents import create_deep_agent
        except Exception as exc:  # noqa: BLE001
            raise DeepAgentsUnavailableError("deepagents dependency is unavailable") from exc

        if request.runtime_policy.model is None:
            raise DeepAgentsUnavailableError("runtime_policy.model is required when no scripted_runner is provided")

        binding_by_tool_id = {binding.tool_id: binding for binding in request.tool_profile.tool_bindings}
        if isinstance(tools, DeepAgentToolBundle):
            main_tools = tools.main_tools
            subagent_tools_by_name = tools.subagent_tools_by_name
        else:
            tool_by_name = {getattr(tool, "name", ""): tool for tool in tools}
            main_tools = [
                tool_by_name[binding_by_tool_id[tool_id].name]
                for tool_id in request.agent_definition.tool_ids
                if tool_id in binding_by_tool_id and binding_by_tool_id[tool_id].name in tool_by_name
            ]
            subagent_tools_by_name = {
                subagent.name: [
                    tool_by_name[binding_by_tool_id[tool_id].name]
                    for tool_id in subagent.tool_ids
                    if tool_id in binding_by_tool_id and binding_by_tool_id[tool_id].name in tool_by_name
                ]
                for subagent in request.agent_definition.subagents
            }
        subagents = []
        for subagent in request.agent_definition.subagents:
            subagent_tools = subagent_tools_by_name.get(subagent.name, [])
            subagents.append(
                {
                    "name": subagent.name,
                    "description": subagent.description,
                    "system_prompt": subagent.system_prompt,
                    "tools": subagent_tools,
                    "skills": subagent.skill_paths or None,
                    "middleware": quantagent_tool_visibility_middleware(),
                }
            )

        required_interrupts = {
            binding.name: True
            for binding in request.tool_profile.tool_bindings
            if binding.requires_interrupt and binding.tool_id in request.agent_definition.tool_ids
        }
        interrupt_on = {**required_interrupts, **request.runtime_policy.interrupt_on}

        checkpointer = None
        if interrupt_on:
            try:
                from langgraph.checkpoint.memory import MemorySaver
            except Exception as exc:  # noqa: BLE001
                raise DeepAgentsUnavailableError("langgraph MemorySaver is unavailable for interrupt_on") from exc
            checkpointer = MemorySaver()

        configure_quantagent_deepagents_harness(request.runtime_policy.model)
        # DeepAgents 负责 planner、tool loop、task/subagent 和 backend；这里仅做平台边界配置。
        return create_deep_agent(
            model=request.runtime_policy.model,
            tools=main_tools,
            system_prompt=request.agent_definition.system_prompt,
            subagents=subagents or None,
            skills=request.agent_definition.skill_paths or None,
            middleware=quantagent_tool_visibility_middleware(),
            interrupt_on=interrupt_on or None,
            checkpointer=checkpointer,
        )

    def _build_deep_agent_tool_bundle(
        self,
        request: AgentRunRequest,
        sequencer: EventSequencer,
        event_buffer: list[AgentRunEvent] | None = None,
    ) -> DeepAgentToolBundle:
        all_tool_ids = _ordered_unique(
            [
                *request.agent_definition.tool_ids,
                *(tool_id for subagent in request.agent_definition.subagents for tool_id in subagent.tool_ids),
            ]
        )
        main_tools = self._build_langchain_tools(
            request,
            sequencer,
            event_buffer,
            tool_ids=request.agent_definition.tool_ids,
        )
        subagent_tools_by_name = {
            subagent.name: self._build_subagent_langchain_tools(
                request,
                sequencer,
                subagent_id=subagent.subagent_id,
                subagent_name=subagent.name,
                tool_ids=subagent.tool_ids,
                event_buffer=event_buffer,
            )
            for subagent in request.agent_definition.subagents
        }
        return DeepAgentToolBundle(
            main_tools=main_tools,
            subagent_tools_by_name=subagent_tools_by_name,
            all_tool_ids=all_tool_ids,
        )

    def _build_langchain_tools(
        self,
        request: AgentRunRequest,
        sequencer: EventSequencer,
        event_buffer: list[AgentRunEvent] | None = None,
        *,
        tool_ids: Sequence[str] | None = None,
        subagent_id: str | None = None,
        subagent_name: str | None = None,
    ) -> list[Any]:
        if not self._deps.tools:
            return []

        try:
            from langchain_core.tools import StructuredTool
        except Exception as exc:  # noqa: BLE001
            raise AgentRuntimeError("langchain_core StructuredTool is unavailable") from exc

        runtime_context = self.tool_runtime_context(request, subagent_id=subagent_id, subagent_name=subagent_name)
        adapter = self._tool_adapter(runtime_context=runtime_context, sequencer=sequencer)
        allowed_bindings = {binding.tool_id: binding for binding in request.tool_profile.tool_bindings}
        resolved_tool_ids = list(request.agent_definition.tool_ids if tool_ids is None else tool_ids)
        requested_tool_ids = set(resolved_tool_ids)
        injected_tools = {tool.binding.tool_id: tool for tool in self._deps.tools}

        unauthorized = requested_tool_ids - set(allowed_bindings)
        missing = requested_tool_ids - set(injected_tools)
        if unauthorized:
            raise AgentRuntimeError(f"unauthorized tools requested: {', '.join(sorted(unauthorized))}")
        if missing:
            raise AgentRuntimeError(f"requested tools unavailable: {', '.join(sorted(missing))}")

        wrapped_tools = []

        for tool_id in resolved_tool_ids:
            platform_tool = injected_tools[tool_id]
            async def _call_tool(_platform_tool: PlatformTool[Any] = platform_tool, **kwargs: Any) -> Mapping[str, Any]:
                result, events = await adapter.invoke(_platform_tool, kwargs)
                if event_buffer is not None:
                    event_buffer.extend(events)
                return result

            def _call_tool_sync(_platform_tool: PlatformTool[Any] = platform_tool, **kwargs: Any) -> Mapping[str, Any]:
                result, events = adapter.invoke_sync(_platform_tool, kwargs)
                if event_buffer is not None:
                    event_buffer.extend(events)
                return result

            wrapped_tools.append(
                StructuredTool.from_function(
                    func=_call_tool_sync,
                    coroutine=_call_tool,
                    name=platform_tool.binding.name,
                    description=platform_tool.binding.description,
                    args_schema=platform_tool.input_model,
                )
            )

        return wrapped_tools

    def _build_subagent_langchain_tools(
        self,
        request: AgentRunRequest,
        sequencer: EventSequencer,
        subagent_id: str,
        subagent_name: str,
        tool_ids: Sequence[str],
        event_buffer: list[AgentRunEvent] | None = None,
    ) -> list[Any]:
        return self._build_langchain_tools(
            request,
            sequencer,
            event_buffer,
            tool_ids=tool_ids,
            subagent_id=subagent_id,
            subagent_name=subagent_name,
        )

    @staticmethod
    def _tool_adapter(*, runtime_context: ToolRuntimeContext, sequencer: EventSequencer) -> Any:
        from quantagent.agent.tools.adapter import ToolAdapter

        return ToolAdapter(runtime_context=runtime_context, sequencer=sequencer)


def _runtime_error_content(exc: Exception) -> str:
    message = str(exc)
    return f"{type(exc).__name__}: {message}" if message else type(exc).__name__


def _with_runtime_protocol(event: AgentRunEvent, state: AgentRuntimeProtocolState) -> AgentRunEvent:
    if isinstance(event.payload.get("runtime_event"), dict):
        return event
    runtime_event = normalize_agent_run_event(event, state).model_dump(mode="json")
    return event.model_copy(update={"payload": {**event.payload, "runtime_event": runtime_event}})


def _remember_platform_tool_call(platform_tool_call_names: dict[str, str], event: AgentRunEvent) -> None:
    if event.type != AgentRunEventType.TOOL_STARTED:
        return
    call_id = event.payload.get("tool_call_id") or event.payload.get("call_id")
    name = event.payload.get("name") or event.payload.get("tool_name")
    if isinstance(call_id, str) and isinstance(name, str):
        platform_tool_call_names[call_id] = name


def _is_platform_tool_message(
    event_type: AgentRunEventType,
    payload: Mapping[str, Any],
    platform_tool_names: set[str],
    platform_tool_call_names: Mapping[str, str],
) -> bool:
    if event_type not in {AgentRunEventType.TOOL_COMPLETED, AgentRunEventType.TOOL_FAILED}:
        return False
    name = payload.get("name") or payload.get("tool_name")
    if isinstance(name, str) and name in platform_tool_names:
        return True
    call_id = payload.get("tool_call_id") or payload.get("call_id")
    return isinstance(call_id, str) and platform_tool_call_names.get(call_id) in platform_tool_names


def _is_deepagents_filesystem_tool_event(
    event_type: AgentRunEventType,
    payload: Mapping[str, Any],
    filesystem_tool_call_names: dict[str, str],
) -> bool:
    if event_type not in {AgentRunEventType.TOOL_STARTED, AgentRunEventType.TOOL_COMPLETED, AgentRunEventType.TOOL_FAILED}:
        return False
    name = payload.get("name") or payload.get("tool_name")
    call_id = payload.get("tool_call_id") or payload.get("call_id")
    if isinstance(name, str) and name in DEEPAGENTS_FILESYSTEM_TOOL_NAMES:
        if isinstance(call_id, str):
            filesystem_tool_call_names[call_id] = name
        return True
    return isinstance(call_id, str) and filesystem_tool_call_names.get(call_id) in DEEPAGENTS_FILESYSTEM_TOOL_NAMES


def _remember_subagent_namespace(
    subagent_scope_by_namespace: dict[tuple[str, ...], str],
    pending_task_subagents: dict[str, str],
    event_type: AgentRunEventType,
    payload: Mapping[str, Any],
    request: AgentRunRequest,
) -> None:
    if event_type != AgentRunEventType.TOOL_STARTED:
        return
    if payload.get("name") != "task":
        return
    subagent_name = _task_subagent_name(payload)
    if not subagent_name or subagent_name not in _configured_subagent_names(request):
        return
    call_id = payload.get("tool_call_id") or payload.get("call_id")
    if isinstance(call_id, str) and call_id:
        pending_task_subagents[call_id] = subagent_name
    namespace = _payload_namespace(payload)
    if not namespace:
        return
    subagent_scope_by_namespace[namespace] = subagent_name


def _bind_pending_task_namespace(
    subagent_scope_by_namespace: dict[tuple[str, ...], str],
    pending_task_subagents: Mapping[str, str],
    payload: Mapping[str, Any],
) -> None:
    namespace = _payload_namespace(payload)
    if not namespace or namespace in subagent_scope_by_namespace:
        return
    # 中文注释：DeepAgents 0.6.x 会先在 root/update chunk 暴露 task(subagent_type)，
    # 再把 SubAgent 内部 messages 放到 tools:<uuid> 子图；两者没有共享 namespace，
    # 这里用最近的 pending task 委派补齐协议 span 归属。
    if not namespace[0].startswith("tools:") or not pending_task_subagents:
        return
    if len(pending_task_subagents) == 1:
        subagent_scope_by_namespace[namespace] = next(iter(pending_task_subagents.values()))


def _bind_known_subagent_namespace(
    payload: Mapping[str, Any],
    subagent_scope_by_namespace: Mapping[tuple[str, ...], str],
    request: AgentRunRequest,
) -> dict[str, Any]:
    scoped = dict(payload)
    # 中文注释：MainAgent 调用 task 的工具事件本身仍属于 Main；只有 task 内部后续 chunk 才进入 SubAgent lane。
    if scoped.get("name") == "task" or scoped.get("tool_name") == "task":
        return scoped
    if scoped.get("actor_type") == "subagent" and scoped.get("subagent_name"):
        return scoped
    namespace = _payload_namespace(scoped)
    subagent_name = _lookup_subagent_namespace(namespace, subagent_scope_by_namespace)
    if not subagent_name:
        return scoped
    configured = {subagent.name: subagent for subagent in request.agent_definition.subagents}
    subagent = configured.get(subagent_name)
    if subagent is None:
        return scoped
    scoped["actor_type"] = "subagent"
    scoped["subagent_name"] = subagent.name
    scoped["subagent_id"] = subagent.subagent_id
    return scoped


def _payload_namespace(payload: Mapping[str, Any]) -> tuple[str, ...] | None:
    namespace = payload.get("graph_namespace")
    if not isinstance(namespace, list):
        return None
    result = tuple(item for item in namespace if isinstance(item, str) and item)
    return result or None


def _lookup_subagent_namespace(
    namespace: tuple[str, ...] | None,
    subagent_scope_by_namespace: Mapping[tuple[str, ...], str],
) -> str | None:
    if namespace is None:
        return None
    for size in range(len(namespace), 0, -1):
        subagent_name = subagent_scope_by_namespace.get(namespace[:size])
        if subagent_name:
            return subagent_name
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


def _configured_subagent_names(request: AgentRunRequest) -> set[str]:
    return {subagent.name for subagent in request.agent_definition.subagents}


def _is_intermediate_report_output(payload: Mapping[str, Any], summary: str) -> bool:
    if payload.get("source") == "stream":
        return False
    stripped = summary.strip()
    if len(stripped) >= 900:
        return True
    return len(stripped) >= 420 and any(marker in stripped for marker in ("# ", "## ", "### ", "|", "- ", "1. "))


def _is_main_intermediate_report_event(event: AgentRunEvent) -> bool:
    return (
        event.type == AgentRunEventType.RUN_OUTPUT
        and event.payload.get("actor_type") != "subagent"
        and _is_intermediate_report_output(event.payload, event.content or "")
    )


def _strip_known_report_outputs(summary: str, reports: Sequence[str]) -> str:
    if not summary or not reports:
        return summary
    result = summary
    for report in reports:
        if not report:
            continue
        result = result.replace(report, "")
        stripped_report = report.strip()
        if stripped_report:
            result = result.replace(stripped_report, "")
    # 中文注释：模型常把“现在进入保守分析”这类过渡句和报告正文连在同一个 delta 里；
    # 报告已产物化后，final 只保留过渡说明，不再重复展示结构化报告正文。
    return _truncate_before_report_body(result).strip()


def _clean_final_summary(summary: str, reports: Sequence[str]) -> str:
    cleaned = _strip_known_report_outputs(summary, reports)
    if _looks_like_compacted_report_replay(cleaned):
        return "报告已生成，详见上方产物卡片。"
    if _report_body_start_index(cleaned) is None:
        return cleaned
    truncated = _truncate_before_report_body(cleaned).strip()
    if truncated:
        return truncated
    return "报告已生成，详见上方产物卡片。"


def _looks_like_compacted_report_replay(text: str) -> bool:
    stripped = text.strip()
    if len(stripped) < 420:
        return False
    compact = _compact_report_marker_text(stripped)
    markers = (
        "IndustryAnalysis",
        "是否需要通知用户",
        "通知建议",
        "行动计划",
        "风险",
        "下一步",
        "evaluate",
        "evaluatethesis",
        "build_action_plan",
        "buildactionplan",
        "submit_action_plan",
        "submitactionplan",
        "get_account_context",
        "getaccountcontext",
        "TAVILY",
        "consensus",
    )
    compact_markers = (
        "industryanalysis",
        "tavily",
        "tavilyikey",
        "searchweb",
        "sarchwb",
        "actionplan",
        "buildactionplan",
        "submitactionplan",
        "getaccountcontext",
        "evaluatethesis",
        "firstparty",
        "firstpartyfficial",
        "rawfact",
        "consensus",
        "consnsus",
        "beat",
        "miss",
        "h20",
        "datacenter",
        "datacnt",
    )
    marker_hits = sum(1 for marker in markers if marker in stripped)
    compact_hits = sum(1 for marker in compact_markers if marker in compact)
    return marker_hits >= 3 or compact_hits >= 4 or _is_report_like_message(stripped)


def _compact_report_marker_text(text: str) -> str:
    return "".join(char.lower() for char in text if char.isalnum())


def _truncate_before_report_body(text: str) -> str:
    if not text:
        return text
    index = _report_body_start_index(text)
    if index is not None:
        return text[:index]
    return text


def _report_body_start_index(text: str) -> int | None:
    markers = (
        "URLinvestor.",
        "URL investor.",
        "URL：investor.",
        "URL: investor.",
        "发布时间",
        "一、第一手材料",
        "## 一、第一手材料",
        "二、核心财务数据",
        "## 二、核心财务数据",
        "核心财务数据摘要",
        "三、信息缺口",
        "## 三、信息缺口",
        "四、已知数据",
        "## 四、已知数据",
        "五、结论",
        "## 五、结论",
        "缺失工具说明",
    )
    indexes = [index for marker in markers if (index := text.find(marker)) >= 0]
    if indexes:
        return min(indexes)
    return None


def _append_message_buffer(pending_message_buffers: dict[str, dict[str, Any]], *, payload: Mapping[str, Any], text: str) -> None:
    key = _message_buffer_key(payload)
    current = pending_message_buffers.get(key)
    if current is None:
        pending_message_buffers[key] = {"emitted_report": False, "last_report_text": "", "payload": dict(payload), "text": text}
        return
    current_text = str(current.get("text") or "")
    if current.get("snapshot_report"):
        if text and text in current_text:
            current["payload"] = {**current.get("payload", {}), **dict(payload)}
            return
        if current_text and current_text in text:
            current["text"] = text
            current["payload"] = {**current.get("payload", {}), **dict(payload)}
            return
        if _overlaps_report_start(current_text, text):
            current["payload"] = {**current.get("payload", {}), **dict(payload)}
            return
    current["text"] = f"{current.get('text', '')}{text}"
    current["payload"] = {**current.get("payload", {}), **dict(payload)}


def _should_buffer_message_delta(pending_message_buffers: Mapping[str, dict[str, Any]], *, payload: Mapping[str, Any], text: str) -> bool:
    key = _message_buffer_key(payload)
    current = pending_message_buffers.get(key)
    if current is not None:
        if current.get("snapshot_report"):
            return not _looks_like_post_report_final_delta(text)
        if not current.get("emitted_report"):
            return True
        return not _looks_like_post_report_final_delta(text)
    stripped = text.lstrip()
    return stripped.startswith(("#", "##", "###")) or _looks_like_report_start(stripped) or _is_report_like_message(stripped)


def _remember_report_output(
    pending_message_buffers: dict[str, dict[str, Any]],
    emitted_report_text_by_key: dict[str, str],
    *,
    payload: Mapping[str, Any],
    text: str,
) -> None:
    key = _message_buffer_key(payload)
    emitted_report_text_by_key[key] = text
    current = pending_message_buffers.get(key)
    if current is None:
        pending_message_buffers[key] = {
            "emitted_report": True,
            "last_report_text": text,
            "payload": dict(payload),
            "snapshot_report": True,
            "text": text,
        }
        return
    # 中文注释：updates 通道提供的是报告快照；记录它是为了吞掉随后 messages 通道
    # 可能再次流出的同一份报告片段，避免报告正文进入 final。
    current["emitted_report"] = True
    current["last_report_text"] = text
    current["payload"] = {**current.get("payload", {}), **dict(payload)}
    current["snapshot_report"] = True
    current["text"] = text


def _looks_like_post_report_final_delta(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False
    final_markers = (
        "最终结论",
        "简洁结论",
        "最终回答",
        "最终输出",
        "结论：",
        "以上",
        "Final",
        "final",
    )
    return any(stripped.startswith(marker) for marker in final_markers)


def _is_replayed_report_delta(emitted_report_text_by_key: Mapping[str, str], *, payload: Mapping[str, Any], text: str) -> bool:
    report_text = emitted_report_text_by_key.get(_message_buffer_key(payload), "")
    if not report_text or not text:
        return False
    if text in report_text or report_text in text:
        return True
    return _report_overlap_ratio(report_text, text) >= 0.72


def _report_overlap_ratio(report_text: str, text: str) -> float:
    report_tokens = set(_report_compare_tokens(report_text))
    text_tokens = set(_report_compare_tokens(text))
    if not report_tokens or not text_tokens:
        return 0.0
    return len(report_tokens & text_tokens) / max(1, min(len(report_tokens), len(text_tokens)))


def _report_compare_tokens(text: str) -> list[str]:
    compact = text.replace("|", " ").replace("#", " ").replace("`", " ")
    return [token for token in compact.split() if len(token) >= 2]


def _overlaps_report_start(current_text: str, next_text: str) -> bool:
    if len(current_text) < 120 or len(next_text) < 120:
        return False
    max_size = min(len(current_text), len(next_text), 2000)
    for size in range(max_size, 119, -1):
        if current_text.startswith(next_text[-size:]):
            return True
    return False


def _drop_duplicate_message_buffer(
    pending_message_buffers: dict[str, dict[str, Any]],
    emitted_report_text_by_key: dict[str, str],
    *,
    payload: Mapping[str, Any],
    text: str,
) -> bool:
    key = _message_buffer_key(payload)
    if _is_replayed_report_delta(emitted_report_text_by_key, payload=payload, text=text):
        return True
    current = pending_message_buffers.get(key)
    if current is None:
        return False
    buffered_text = str(current.get("text") or "")
    if current.get("emitted_report") and _is_report_like_message(text):
        # 中文注释：updates 通道是状态快照，后到的完整报告可能比早期草稿更短，不能按长度保留旧稿。
        current["text"] = text
        current["payload"] = {**current.get("payload", {}), **dict(payload)}
        return False
    if buffered_text == text or buffered_text in text or text in buffered_text:
        pending_message_buffers.pop(key, None)
        return True
    return False


def _flush_message_buffers(
    pending_message_buffers: dict[str, dict[str, Any]],
    emitted_report_text_by_key: dict[str, str],
    *,
    request: AgentRunRequest,
    sequencer: EventSequencer,
    final_flush: bool,
) -> list[AgentRunEvent]:
    events: list[AgentRunEvent] = []
    for key, item in list(pending_message_buffers.items()):
        text = str(item.get("text") or "")
        if not text:
            pending_message_buffers.pop(key, None)
            continue
        payload = dict(item.get("payload") or {})
        if not _is_report_like_message(text):
            if not final_flush:
                continue
            events.append(
                sequencer.next(
                    agent_run_id=request.agent_run_id,
                    trace_id=request.trace_id,
                    event_type=AgentRunEventType.MODEL_DELTA,
                    payload=payload,
                    content=text,
                )
            )
            pending_message_buffers.pop(key, None)
            continue
        if _is_report_like_message(text):
            last_report_text = str(item.get("last_report_text") or "")
            if text == last_report_text:
                if final_flush:
                    pending_message_buffers.pop(key, None)
                continue
            events.append(
                sequencer.next(
                    agent_run_id=request.agent_run_id,
                    trace_id=request.trace_id,
                    event_type=AgentRunEventType.RUN_OUTPUT,
                    payload={**payload, "source": "message_buffer"},
                    content=text,
                )
            )
            item["emitted_report"] = True
            item["last_report_text"] = text
            emitted_report_text_by_key[key] = text
            pending_message_buffers.pop(key, None)
    return events


def _message_buffer_key(payload: Mapping[str, Any]) -> str:
    if payload.get("actor_type") == "subagent":
        subagent_name = payload.get("subagent_name") or payload.get("subagent_id") or "subagent"
        namespace = payload.get("graph_namespace")
        if isinstance(namespace, list) and namespace:
            return f"subagent:{subagent_name}:{'/'.join(str(item) for item in namespace)}"
        return f"subagent:{subagent_name}"
    return "main"


def _is_report_like_message(text: str) -> bool:
    stripped = text.strip()
    title = ""
    for line in text.splitlines():
        cleaned = line.strip().strip("#").strip()
        if cleaned and not cleaned.startswith("|") and set(cleaned) != {"-"}:
            title = cleaned[:180]
            break
    report_terms = ("报告", "简报", "总结", "结论", "分析", "IndustryAnalysis", "Research")
    has_report_title = any(term in title for term in report_terms)
    table_lines = sum(1 for line in stripped.splitlines() if line.strip().startswith("|"))
    heading_lines = sum(1 for line in stripped.splitlines() if line.lstrip().startswith("#"))
    list_lines = sum(1 for line in stripped.splitlines() if line.lstrip().startswith(("- ", "1. ")))
    if table_lines >= 3 and (heading_lines >= 1 or has_report_title):
        return True
    if len(stripped) < 420:
        return False
    return has_report_title or table_lines >= 2 or heading_lines >= 2 or (heading_lines >= 1 and list_lines >= 3)


def _looks_like_report_start(text: str) -> bool:
    first_line = next((line.strip() for line in text.splitlines() if line.strip()), "")
    report_terms = ("报告", "简报", "总结", "结论", "分析", "IndustryAnalysis", "Research")
    return any(term in first_line for term in report_terms)


def _looks_like_report_continuation(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return True
    if len(stripped) >= 120:
        return True
    markdown_markers = ("|", "#", "-", ">", "**", "`")
    if any(marker in stripped for marker in markdown_markers):
        return True
    section_terms = ("缺口", "风险", "行动", "通知", "一手", "市场", "盘后", "指引", "H20", "TAVILY_API_KEY", "MVP")
    return any(term in stripped for term in section_terms)


async def _open_deepagents_stream(graph: DeepAgentGraph, input_data: Mapping[str, Any], config: Mapping[str, Any]) -> AsyncIterator[Any]:
    if hasattr(graph, "astream"):
        try:
            async for chunk in graph.astream(input_data, config=config, stream_mode=["updates", "messages"], subgraphs=True):  # type: ignore[call-arg]
                yield chunk
            return
        except TypeError:
            async for chunk in graph.astream(input_data, config=config):
                yield chunk
            return

    try:
        stream = graph.stream(input_data, config=config, stream_mode=["updates", "messages"], subgraphs=True)  # type: ignore[call-arg]
    except TypeError:
        stream = graph.stream(input_data, config=config)
    for chunk in stream:
        yield chunk


def _ordered_unique(items: Sequence[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        unique.append(item)
    return unique


def _runtime_recursion_limit(request: AgentRunRequest) -> int | None:
    """把平台工具预算转换为 LangGraph 递归预算，避免 action 阶段被循环上限提前截断。"""

    configured = max(request.runtime_policy.max_tool_calls, request.tool_profile.max_tool_calls)
    if configured <= 0:
        return None
    # DeepAgents 的一次工具 loop 通常包含 model/tool 多个 graph step；给出保守余量，
    # 让 Research SubAgent 搜索后仍有预算执行 account/evaluate/plan/submit。
    return max(25, configured * 3 + 8)
