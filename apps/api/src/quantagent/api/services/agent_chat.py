from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from contextlib import suppress
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from quantagent.agent.definitions.models import RuntimePolicy
from quantagent.agent.models import OpenAICompatibleChatModel
from quantagent.agent.runtime import AgentRuntime
from quantagent.agent.runtime.requests import AgentRunRequest
from quantagent.agent.streaming.events import AgentRunEvent, AgentRunEventType
from quantagent.agent.tools import build_get_run_context_tool, build_search_web_tool
from quantagent.api.http.errors import NotFoundError, ServiceUnavailableError
from quantagent.api.schemas.agent_chat import AgentChatMessageResponse, AgentChatSessionResponse, AgentChatStreamEvent
from quantagent.api.services.agent_chat_runtime_config import (
    build_agent_chat_assets,
    build_agent_chat_run_context,
    normalize_routed_event_preset,
)
from quantagent.core.db.models.agent_chat import AgentChatRunORM, AgentChatSessionORM
from quantagent.core.db.repositories.agent_chat_repository import AgentChatRepository
from quantagent.core.model_config import (
    ModelConfigCrypto,
    ModelConfigCryptoError,
    ModelConfigServiceError,
    ModelPresetKey,
    ModelProviderORM,
    ModelProviderModelORM,
)
from quantagent.core.model_config.repository import ModelProviderRepository
from quantagent.core.plugin_config import PluginConfigService, PluginConfigServiceError


TAVILY_PLUGIN_ID = "quantagent.official.source.tavily"
TAVILY_API_KEY_PATH = "api_key"


class AgentChatService:
    def __init__(self, *, session: Session, encryption_key: str | None = None) -> None:
        self._session = session
        self._repo = AgentChatRepository(session)
        self._encryption_key = encryption_key

    def create_session(
        self,
        *,
        industry_id: str,
        agent_id: str,
        title: str | None = None,
        debug_preset: str | None = None,
        routed_event_preset: str | None = None,
    ) -> AgentChatSessionResponse:
        session_id = f"chat_sess_{uuid4().hex}"
        now = datetime.now(UTC)
        resolved_routed_event = normalize_routed_event_preset(routed_event_preset or debug_preset)
        metadata: dict[str, object] = {}
        if resolved_routed_event:
            metadata["routed_event_preset"] = resolved_routed_event
        if debug_preset:
            metadata["debug_preset"] = debug_preset
        row = AgentChatSessionORM(
            session_id=session_id,
            thread_id=f"chat_thread_{uuid4().hex}",
            workspace_id=f"chat_workspace_{uuid4().hex}",
            industry_id=industry_id,
            agent_id=agent_id,
            title=title,
            status="active",
            metadata_json=metadata,
            created_at=now,
            updated_at=now,
        )
        self._repo.create_session(row)
        self._session.commit()
        return self._session_response(row, [])

    def get_session(self, session_id: str) -> AgentChatSessionResponse:
        row = self._repo.get_session(session_id)
        if row is None:
            raise NotFoundError("Agent Chat session not found")
        return self._session_response(row, self._repo.list_messages(session_id))

    def ensure_session_exists(self, session_id: str) -> None:
        if self._repo.get_session(session_id) is None:
            raise NotFoundError("Agent Chat session not found")

    async def stream_message(self, *, session_id: str, message: str) -> AsyncIterator[str]:
        row = self._repo.get_session(session_id)
        if row is None:
            raise NotFoundError("Agent Chat session not found")

        user_message = self._repo.append_message(
            session_id=row.session_id,
            role="user",
            kind="message",
            content=message,
            payload={},
        )
        run_id = f"chat_run_{uuid4().hex}"
        agent_run_id = f"agent_run_{uuid4().hex}"
        trace_id = f"trace_{uuid4().hex}"
        run = self._repo.create_run(
            AgentChatRunORM(
                run_id=run_id,
                session_id=row.session_id,
                agent_run_id=agent_run_id,
                trace_id=trace_id,
                status="running",
                metadata_json={},
            )
        )
        self._session.commit()
        yield _encode_sse(
            _stream_event_from_message(
                type_="message.appended",
                row=user_message,
                run_id=run.run_id,
                agent_run_id=agent_run_id,
                trace_id=trace_id,
            )
        )

        try:
            run_request = self._build_run_request(row, run, message=message)
            runtime = AgentRuntime(
                tools=[
                    build_get_run_context_tool(run_request.run_context),
                    build_search_web_tool(api_key=self._resolve_tavily_api_key()),
                ]
            )
            async for event in runtime.run_stream(run_request):
                display = self._persist_runtime_event(row.session_id, run.run_id, event)
                self._session.commit()
                yield _encode_sse(display)
            self._repo.update_run_status(run.run_id, status="completed")
            self._session.commit()
        except asyncio.CancelledError:
            with suppress(Exception):
                self._repo.update_run_status(run.run_id, status="aborted")
                self._session.commit()
            raise
        except Exception as exc:  # noqa: BLE001
            error_content = _error_content(exc)
            self._repo.update_run_status(run.run_id, status="failed", error_summary=error_content)
            failed = self._repo.append_message(
                session_id=row.session_id,
                run_id=run.run_id,
                role="assistant",
                kind="error",
                content=error_content,
                payload={"error": str(exc), "error_type": type(exc).__name__},
            )
            self._session.commit()
            yield _encode_sse(
                _stream_event_from_message(
                    type_="run.failed",
                    row=failed,
                    run_id=run.run_id,
                    agent_run_id=agent_run_id,
                    trace_id=trace_id,
                )
            )

    def _build_run_request(self, row: AgentChatSessionORM, run: AgentChatRunORM, *, message: str) -> AgentRunRequest:
        model = _model_from_config(
            encryption_key=self._encryption_key,
            trace_id=run.trace_id,
            timeout_seconds=60.0,
            session=self._session,
        )
        assets = build_agent_chat_assets(industry_id=row.industry_id, agent_id=row.agent_id)
        return AgentRunRequest(
            session_id=row.session_id,
            thread_id=row.thread_id,
            workspace_id=row.workspace_id,
            agent_run_id=run.agent_run_id,
            event_id=f"event_chat_{uuid4().hex}",
            industry_id=row.industry_id,
            trace_id=run.trace_id,
            agent_definition=assets.agent_definition,
            run_context=build_agent_chat_run_context(row, run, message=message),
            tool_profile=assets.tool_profile,
            runtime_policy=RuntimePolicy(model=model, max_subagent_tasks=1),
            input_message=message,
        )

    def _persist_runtime_event(self, session_id: str, run_id: str, event: AgentRunEvent) -> AgentChatStreamEvent:
        role, kind, content = _display_from_runtime_event(event)
        message = self._repo.append_message(
            session_id=session_id,
            run_id=run_id,
            role=role,
            kind=kind,
            content=content,
            payload=_json_payload(event.payload),
        )
        if event.type == AgentRunEventType.RUN_FAILED:
            self._repo.update_run_status(run_id, status="failed", error_summary=content)
        return _stream_event_from_message(
            type_=str(event.type),
            row=message,
            run_id=run_id,
            agent_run_id=event.agent_run_id,
            trace_id=event.trace_id,
        )

    def _resolve_tavily_api_key(self) -> str | None:
        try:
            return PluginConfigService(self._session, encryption_key=self._encryption_key).resolve_secret(
                plugin_id=TAVILY_PLUGIN_ID,
                path=TAVILY_API_KEY_PATH,
            )
        except PluginConfigServiceError:
            # Tavily key 缺失或解密失败只影响 search_web；不要让整个 Agent Chat run 失败。
            return None

    @staticmethod
    def _session_response(row: AgentChatSessionORM, messages: list) -> AgentChatSessionResponse:
        return AgentChatSessionResponse(
            session_id=row.session_id,
            thread_id=row.thread_id,
            workspace_id=row.workspace_id,
            industry_id=row.industry_id,
            agent_id=row.agent_id,
            title=row.title,
            status=row.status,
            messages=[_message_response(message) for message in messages],
            created_at=row.created_at,
            updated_at=row.updated_at,
        )


def _message_response(row) -> AgentChatMessageResponse:
    payload = dict(row.payload or {})
    return AgentChatMessageResponse(
        message_id=row.message_id,
        session_id=row.session_id,
        run_id=row.run_id,
        seq=row.seq,
        role=row.role,
        kind=row.kind,
        content=row.content,
        payload=payload,
        runtime_event=_runtime_event_from_payload(payload),
        created_at=row.created_at,
    )


def _stream_event_from_message(
    *,
    type_: str,
    row,
    run_id: str | None,
    agent_run_id: str | None,
    trace_id: str | None,
) -> AgentChatStreamEvent:
    payload = dict(row.payload or {})
    return AgentChatStreamEvent(
        event_id=row.message_id,
        type=type_,
        session_id=row.session_id,
        run_id=run_id,
        agent_run_id=agent_run_id,
        seq=row.seq,
        role=row.role,
        kind=row.kind,
        content=row.content,
        payload=payload,
        runtime_event=_runtime_event_from_payload(payload),
        trace_id=trace_id,
        created_at=row.created_at,
    )


def _display_from_runtime_event(event: AgentRunEvent) -> tuple[str, str, str]:
    runtime_event = _runtime_event_from_payload(_json_payload(event.payload))
    if runtime_event is not None:
        role = _role_from_runtime_event(runtime_event)
        kind = str(runtime_event.get("render", {}).get("content_kind") or _kind_from_runtime_event_type(str(runtime_event.get("event_type") or event.type)))
        content = _content_from_runtime_event(runtime_event)
        return role, kind, content

    if event.type == AgentRunEventType.MODEL_DELTA:
        return "assistant", "delta", event.content or ""
    if event.type == AgentRunEventType.MODEL_REASONING:
        return "assistant", "reasoning", event.content or json.dumps(event.payload, ensure_ascii=False, default=str)
    if event.type == AgentRunEventType.TODO_UPDATED:
        return "assistant", "todo", event.content or json.dumps(event.payload, ensure_ascii=False, default=str)
    if event.type in {AgentRunEventType.TOOL_STARTED, AgentRunEventType.TOOL_COMPLETED, AgentRunEventType.TOOL_FAILED}:
        return "tool", "tool", event.content or json.dumps(event.payload, ensure_ascii=False, default=str)
    if event.type in {AgentRunEventType.SUBAGENT_STARTED, AgentRunEventType.SUBAGENT_COMPLETED}:
        return "subagent", "subagent", event.content or json.dumps(event.payload, ensure_ascii=False, default=str)
    if event.type == AgentRunEventType.ARTIFACT_CREATED:
        return "assistant", "artifact", event.content or json.dumps(event.payload, ensure_ascii=False, default=str)
    if event.type == AgentRunEventType.INTERRUPT_REQUESTED:
        return "assistant", "interrupt", event.content or json.dumps(event.payload, ensure_ascii=False, default=str)
    if event.type == AgentRunEventType.RUN_OUTPUT:
        return "assistant", "final", event.content or ""
    if event.type == AgentRunEventType.RUN_FAILED:
        error = event.content or str(event.payload.get("error") or "Agent run failed.")
        return "assistant", "error", error
    if event.type == AgentRunEventType.RUNTIME_EVENT:
        return "assistant", "system_event", event.content or json.dumps(event.payload, ensure_ascii=False, default=str)
    return "assistant", "system_event", event.content or json.dumps(event.payload, ensure_ascii=False, default=str)


def _role_from_runtime_event(runtime_event: dict[str, object]) -> str:
    actor = runtime_event.get("actor")
    actor_type = actor.get("type") if isinstance(actor, dict) else None
    if actor_type == "tool":
        return "tool"
    if actor_type == "subagent":
        return "subagent"
    return "assistant"


def _kind_from_runtime_event_type(event_type: str) -> str:
    if event_type == "agent.message.final":
        return "final"
    if event_type == "agent.message.delta":
        return "delta"
    if event_type == "agent.reasoning.delta":
        return "reasoning"
    if event_type.startswith("tool."):
        return "tool"
    if event_type.startswith("subagent."):
        return "subagent"
    if event_type == "todo.updated":
        return "todo"
    if event_type == "artifact.created":
        return "artifact"
    if event_type == "interrupt.requested":
        return "interrupt"
    if event_type == "run.failed":
        return "error"
    return "system_event"


def _content_from_runtime_event(runtime_event: dict[str, object]) -> str:
    content = runtime_event.get("content")
    if isinstance(content, dict) and isinstance(content.get("text"), str):
        return content["text"]
    tool = runtime_event.get("tool")
    if isinstance(tool, dict):
        error = tool.get("error")
        if isinstance(error, dict) and isinstance(error.get("message"), str):
            return error["message"]
        if tool.get("output") is not None:
            return json.dumps(tool["output"], ensure_ascii=False, default=str)
    subagent = runtime_event.get("subagent")
    if isinstance(subagent, dict) and isinstance(subagent.get("output"), str):
        return subagent["output"]
    return ""


def _encode_sse(event: AgentChatStreamEvent) -> str:
    if event.runtime_event and event.runtime_event.get("schema_version") == "agent-runtime-event.v1":
        data = event.runtime_event
        event_type = str(event.runtime_event.get("event_type") or event.type)
        event_id = str(event.runtime_event.get("event_id") or event.event_id)
        return f"event: {event_type}\nid: {event_id}\ndata: {json.dumps(data, ensure_ascii=False, separators=(',', ':'))}\n\n"
    data = event.model_dump(mode="json")
    return f"event: {event.type}\nid: {event.event_id}\ndata: {json.dumps(data, ensure_ascii=False, separators=(',', ':'))}\n\n"


def _json_payload(payload: dict[str, object]) -> dict[str, object]:
    text = json.dumps(payload, ensure_ascii=False, default=str)
    return json.loads(text)


def _runtime_event_from_payload(payload: dict[str, object]) -> dict[str, object] | None:
    value = payload.get("runtime_event")
    return value if isinstance(value, dict) else None


def _error_content(exc: Exception) -> str:
    if isinstance(exc, ModelConfigServiceError):
        return f"{exc.code}: {exc.message}"
    message = str(exc)
    return f"{type(exc).__name__}: {message}" if message else type(exc).__name__


def _require_enabled_model(session: Session) -> tuple[ModelProviderORM, ModelProviderModelORM]:
    repository = ModelProviderRepository(session)
    binding = repository.get_preset_binding(ModelPresetKey.REASONING_TEXT)
    model = repository.get_provider_model(binding.primary_model_id) if binding and binding.primary_model_id else None
    if model is None:
        model = repository.find_global_default_model()
    if model is None:
        raise ServiceUnavailableError("No model configured for Agent Chat")
    provider = repository.get_provider(model.provider_id)
    if provider is None or not provider.enabled or not model.enabled:
        raise ServiceUnavailableError("Configured model is not usable for Agent Chat")
    if not provider.encrypted_api_key:
        raise ServiceUnavailableError("Model provider API key is missing")
    return provider, model


def _decrypt_api_key(encryption_key: str | None, provider: ModelProviderORM) -> str:
    try:
        return ModelConfigCrypto(encryption_key).decrypt(provider.encrypted_api_key or "")
    except ModelConfigCryptoError as exc:
        raise ServiceUnavailableError("Model provider API key cannot be decrypted") from exc


def _model_from_config(
    *,
    encryption_key: str | None,
    trace_id: str,
    timeout_seconds: float,
    session: Session,
) -> OpenAICompatibleChatModel:
    provider, model = _require_enabled_model(session)
    return OpenAICompatibleChatModel(
        api_key=_decrypt_api_key(encryption_key, provider),
        base_url=provider.base_url,
        model_name=model.model_name,
        request_id=trace_id,
        timeout_seconds=timeout_seconds,
    )
