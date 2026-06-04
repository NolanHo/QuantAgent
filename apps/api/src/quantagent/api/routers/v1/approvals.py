from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from quantagent.api.auth import (
    APPROVAL_APPROVE_CAPABILITY,
    APPROVAL_READ_CAPABILITY,
    CurrentActor,
    build_actor_audit_context,
    require_capability,
    require_csrf,
)
from quantagent.api.db import get_db_session
from quantagent.api.http.errors import BadRequestError, NotFoundError
from quantagent.api.http.responses import ApiResponse
from quantagent.api.schemas.approvals import (
    ApprovalActionRequest,
    ApprovalActionResponse,
    ApprovalDetailResponse,
    ApprovalListQueryParams,
    ApprovalListResponse,
)
from quantagent.api.services.approval_api import (
    body_intent_conflicts,
    get_approval_api_service,
    get_approval_event_publisher,
)
from quantagent.core.approval import ApprovalQueryNotFoundError


router = APIRouter(prefix="/approvals", tags=["approvals"])


@router.get("", response_model=ApiResponse[ApprovalListResponse], dependencies=[Depends(require_capability(APPROVAL_READ_CAPABILITY))])
def list_approvals(
    request: Request,
    status: str | None = Query(default=None),
    risk_level: str | None = Query(default=None),
    required_confirmation_level: str | None = Query(default=None),
    expires_before: datetime | None = Query(default=None),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    sort: str = Query(default="-updated_at"),
    session: Session = Depends(get_db_session),
) -> ApiResponse[ApprovalListResponse]:
    service = get_approval_api_service(session, event_publisher=get_approval_event_publisher(request))
    try:
        data = service.list_approvals(
            ApprovalListQueryParams(
                status=status,
                risk_level=risk_level,
                required_confirmation_level=required_confirmation_level,
                expires_before=expires_before,
                cursor=cursor,
                limit=limit,
                sort=sort,
            )
        )
    except ValueError as exc:
        raise BadRequestError("Invalid approval query", details={"reason": str(exc)}) from exc
    return ApiResponse.success(data)


@router.get("/{approval_id}", response_model=ApiResponse[ApprovalDetailResponse], dependencies=[Depends(require_capability(APPROVAL_READ_CAPABILITY))])
def get_approval(
    approval_id: str,
    request: Request,
    session: Session = Depends(get_db_session),
) -> ApiResponse[ApprovalDetailResponse]:
    service = get_approval_api_service(session, event_publisher=get_approval_event_publisher(request))
    try:
        return ApiResponse.success(service.get_detail(approval_id))
    except ApprovalQueryNotFoundError as exc:
        raise NotFoundError("Approval not found", details={"approval_id": exc.approval_id}) from exc


@router.post(
    "/{approval_id}/actions/approve",
    response_model=ApiResponse[ApprovalActionResponse],
    dependencies=[Depends(require_capability(APPROVAL_APPROVE_CAPABILITY))],
)
async def approve_approval(
    approval_id: str,
    body: ApprovalActionRequest,
    request: Request,
    actor: CurrentActor = Depends(require_csrf),
    session: Session = Depends(get_db_session),
) -> ApiResponse[ApprovalActionResponse]:
    return await _handle_action("approve", approval_id, body, request, actor, session)


@router.post(
    "/{approval_id}/actions/reject",
    response_model=ApiResponse[ApprovalActionResponse],
    dependencies=[Depends(require_capability(APPROVAL_APPROVE_CAPABILITY))],
)
async def reject_approval(
    approval_id: str,
    body: ApprovalActionRequest,
    request: Request,
    actor: CurrentActor = Depends(require_csrf),
    session: Session = Depends(get_db_session),
) -> ApiResponse[ApprovalActionResponse]:
    return await _handle_action("reject", approval_id, body, request, actor, session)


@router.post(
    "/{approval_id}/actions/request-reanalysis",
    response_model=ApiResponse[ApprovalActionResponse],
    dependencies=[Depends(require_capability(APPROVAL_APPROVE_CAPABILITY))],
)
async def request_reanalysis(
    approval_id: str,
    body: ApprovalActionRequest,
    request: Request,
    actor: CurrentActor = Depends(require_csrf),
    session: Session = Depends(get_db_session),
) -> ApiResponse[ApprovalActionResponse]:
    return await _handle_action("request-reanalysis", approval_id, body, request, actor, session)


async def _handle_action(
    action: str,
    approval_id: str,
    body: ApprovalActionRequest,
    request: Request,
    actor: CurrentActor,
    session: Session,
) -> ApiResponse[ApprovalActionResponse]:
    if body_intent_conflicts(action=action, body=body):
        raise BadRequestError("Approval action body intent conflicts with path action", details={"action": action})
    service = get_approval_api_service(session, event_publisher=get_approval_event_publisher(request))
    context = build_actor_audit_context(request, actor)
    try:
        data = await service.submit_action(approval_id=approval_id, action=action, body=body, context=context)
    except ApprovalQueryNotFoundError as exc:
        raise NotFoundError("Approval not found", details={"approval_id": exc.approval_id}) from exc
    return ApiResponse.success(data)
