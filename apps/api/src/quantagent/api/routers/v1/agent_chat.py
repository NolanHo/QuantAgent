from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from quantagent.api.config.settings import Settings
from quantagent.api.db import get_db_session
from quantagent.api.http.responses import ApiResponse
from quantagent.api.schemas.agent_chat import (
    AgentChatCreateSessionRequest,
    AgentChatSessionResponse,
    AgentChatStreamRequest,
)
from quantagent.api.services.agent_chat import AgentChatService


router = APIRouter(prefix="/agent-chat", tags=["agent-chat"])


def _service(request: Request, session: Session) -> AgentChatService:
    settings: Settings = request.app.state.settings
    return AgentChatService(session=session, encryption_key=settings.MODEL_CONFIG_ENCRYPTION_KEY)


@router.post("/sessions", response_model=ApiResponse[AgentChatSessionResponse])
def create_agent_chat_session(
    payload: AgentChatCreateSessionRequest,
    request: Request,
    session: Session = Depends(get_db_session),
) -> ApiResponse[AgentChatSessionResponse]:
    return ApiResponse.success(
        _service(request, session).create_session(
            industry_id=payload.industry_id,
            agent_id=payload.agent_id,
            debug_preset=payload.debug_preset,
            title=payload.title,
        )
    )


@router.get("/sessions/{session_id}", response_model=ApiResponse[AgentChatSessionResponse])
def get_agent_chat_session(
    session_id: str,
    request: Request,
    session: Session = Depends(get_db_session),
) -> ApiResponse[AgentChatSessionResponse]:
    return ApiResponse.success(_service(request, session).get_session(session_id))


@router.post(
    "/sessions/{session_id}/messages/stream",
    response_class=StreamingResponse,
    responses={
        200: {
            "description": "Server-sent Agent Chat stream.",
            "content": {"text/event-stream": {"schema": {"type": "string"}}},
        }
    },
)
def stream_agent_chat_message(
    session_id: str,
    payload: AgentChatStreamRequest,
    request: Request,
    session: Session = Depends(get_db_session),
) -> StreamingResponse:
    service = _service(request, session)
    service.ensure_session_exists(session_id)
    return StreamingResponse(
        service.stream_message(session_id=session_id, message=payload.message),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
