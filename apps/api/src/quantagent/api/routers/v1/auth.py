from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response

from quantagent.api.auth import (
    ALL_CAPABILITIES,
    LOCAL_ACTOR_TYPE,
    LOCAL_ADMIN_ACTOR_ID,
    CurrentActor,
    authenticate_admin_password,
    clear_session_cookie,
    development_bypass_actor,
    issue_session,
    refresh_session,
    require_csrf,
    resolve_auth_state,
    session_cookie_max_age,
    set_session_cookie,
    upgrade_v1_session,
)
from quantagent.api.auth.session import SESSION_V1
from quantagent.api.http.errors import UnauthorizedError
from quantagent.api.http.responses import ApiResponse
from quantagent.api.schemas.auth import (
    AuthenticatedActorResponse,
    LoginRequest,
    LogoutResponse,
    RefreshSessionResponse,
)


public_router = APIRouter(tags=["auth"])
protected_router = APIRouter(tags=["auth"])


def _actor_response(actor: CurrentActor) -> AuthenticatedActorResponse:
    """把内部 actor 快照转换成对外 DTO，避免响应中混入 session 原文。"""
    return AuthenticatedActorResponse(
        actor_id=actor.actor_id,
        actor_type=actor.actor_type,
        capabilities=sorted(actor.capabilities),
        csrf_token=actor.csrf_token,
    )


def _refresh_response(
    actor: CurrentActor,
    *,
    expires_at: int | None,
    max_expires_at: int | None,
) -> RefreshSessionResponse:
    return RefreshSessionResponse(
        actor_id=actor.actor_id,
        actor_type=actor.actor_type,
        capabilities=sorted(actor.capabilities),
        csrf_token=actor.csrf_token,
        expires_at=expires_at,
        max_expires_at=max_expires_at,
    )


@public_router.post("/auth/login", response_model=ApiResponse[AuthenticatedActorResponse])
def login(payload: LoginRequest, response: Response, request: Request) -> ApiResponse[AuthenticatedActorResponse]:
    app_settings = request.app.state.settings

    if not app_settings.AUTH_ENABLED:
        clear_session_cookie(response, app_settings)
        return ApiResponse.success(_actor_response(development_bypass_actor()))

    authenticate_admin_password(payload.password, app_settings)
    issued_session = issue_session(LOCAL_ADMIN_ACTOR_ID, app_settings)
    set_session_cookie(
        response,
        issued_session.value,
        app_settings,
        max_age=session_cookie_max_age(issued_session.data.expires_at),
    )
    return ApiResponse.success(
        AuthenticatedActorResponse(
            actor_id=LOCAL_ADMIN_ACTOR_ID,
            actor_type=LOCAL_ACTOR_TYPE,
            capabilities=sorted(ALL_CAPABILITIES),
            csrf_token=issued_session.data.csrf_token,
        )
    )


@protected_router.post("/auth/logout", response_model=ApiResponse[LogoutResponse])
def logout(
    response: Response,
    request: Request,
    _actor: CurrentActor = Depends(require_csrf),
) -> ApiResponse[LogoutResponse]:
    clear_session_cookie(response, request.app.state.settings)
    return ApiResponse.success(LogoutResponse(cleared=True))


@protected_router.post("/auth/refresh", response_model=ApiResponse[RefreshSessionResponse])
def refresh(
    response: Response,
    request: Request,
    _actor: CurrentActor = Depends(require_csrf),
) -> ApiResponse[RefreshSessionResponse]:
    auth_state = resolve_auth_state(request)

    if auth_state.session is None:
        raise UnauthorizedError()

    session = auth_state.session
    actor = auth_state.actor
    refreshed_session = refresh_session(session, request.app.state.settings)
    if refreshed_session is not None:
        set_session_cookie(
            response,
            refreshed_session.value,
            request.app.state.settings,
            max_age=session_cookie_max_age(refreshed_session.data.expires_at),
        )
        actor = CurrentActor(
            actor_id=refreshed_session.data.subject,
            actor_type=refreshed_session.data.actor_type,
            capabilities=refreshed_session.data.capabilities,
            csrf_token=refreshed_session.data.csrf_token,
            auth_mode="session",
        )
        session = refreshed_session.data

    return ApiResponse.success(
        _refresh_response(actor, expires_at=session.expires_at, max_expires_at=session.max_expires_at)
    )


@protected_router.get("/me", response_model=ApiResponse[AuthenticatedActorResponse])
def me(response: Response, request: Request) -> ApiResponse[AuthenticatedActorResponse]:
    auth_state = resolve_auth_state(request)

    if auth_state.session is not None and auth_state.session.version == SESSION_V1:
        upgraded_session = upgrade_v1_session(auth_state.session, request.app.state.settings)
        set_session_cookie(
            response,
            upgraded_session.value,
            request.app.state.settings,
            max_age=session_cookie_max_age(upgraded_session.data.expires_at),
        )
        actor = CurrentActor(
            actor_id=upgraded_session.data.subject,
            actor_type=upgraded_session.data.actor_type,
            capabilities=upgraded_session.data.capabilities,
            csrf_token=upgraded_session.data.csrf_token,
            auth_mode="session",
        )
        return ApiResponse.success(_actor_response(actor))

    return ApiResponse.success(_actor_response(auth_state.actor))
