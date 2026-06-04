from __future__ import annotations

from collections.abc import Awaitable, Callable
from uuid import uuid4

from fastapi import Request
from sqlalchemy.orm import Session

from quantagent.api.auth import ActorAuditContext
from quantagent.api.schemas.approvals import (
    ApprovalActionRequest,
    ApprovalActionResponse,
    ApprovalDecisionSummaryResponse,
    ApprovalDetailResponse,
    ApprovalListQueryParams,
    ApprovalListResponse,
    ApprovalSummaryResponse,
)
from quantagent.core.approval import (
    ApprovalEventPublisher,
    ApprovalInput,
    ApprovalListQuery,
    ApprovalOrchestrationService,
    ApprovalQueryNotFoundError,
    ApprovalQueryService,
    ApprovalServiceResult,
)
from quantagent.core.approval.query_service import (
    ApprovalDecisionSummaryView,
    ApprovalDetailView,
    ApprovalSummaryView,
)
from quantagent.core.db.repositories.approval_repository import SQLAlchemyApprovalRepository
from quantagent.core.events import InMemoryEventBus


def get_approval_api_service(
    session: Session,
    *,
    event_publisher: ApprovalEventPublisher,
) -> ApprovalApiService:
    repository = SQLAlchemyApprovalRepository(session)
    deferred_event_publisher = _DeferredApprovalEventPublisher(event_publisher)
    return ApprovalApiService(
        query_service=ApprovalQueryService(repository),
        action_service=ApprovalOrchestrationService(
            repository=repository,
            event_publisher=deferred_event_publisher,
        ),
        commit=session.commit,
        event_publisher=deferred_event_publisher,
    )


def get_approval_event_publisher(request: Request) -> ApprovalEventPublisher:
    publisher = getattr(request.app.state, "approval_event_publisher", None)
    if publisher is not None:
        return publisher
    bus = getattr(request.app.state, "approval_event_bus", None)
    if bus is None:
        bus = InMemoryEventBus()
        request.app.state.approval_event_bus = bus
    publisher = ApprovalEventPublisher(bus)
    request.app.state.approval_event_publisher = publisher
    return publisher


class _DeferredApprovalEventPublisher:
    def __init__(self, publisher: ApprovalEventPublisher) -> None:
        self._publisher = publisher
        self._pending: list[Callable[[], Awaitable[object]]] = []

    async def publish_approval_requested(self, *args: object, **kwargs: object) -> None:
        self._pending.append(lambda: self._publisher.publish_approval_requested(*args, **kwargs))

    async def publish_notification_requested(self, *args: object, **kwargs: object) -> None:
        self._pending.append(lambda: self._publisher.publish_notification_requested(*args, **kwargs))

    async def publish_approval_completed(self, *args: object, **kwargs: object) -> None:
        self._pending.append(lambda: self._publisher.publish_approval_completed(*args, **kwargs))

    async def flush(self) -> None:
        pending = self._pending
        self._pending = []
        for publish in pending:
            await publish()


class ApprovalApiService:
    def __init__(
        self,
        *,
        query_service: ApprovalQueryService,
        action_service: ApprovalOrchestrationService,
        commit: Callable[[], None],
        event_publisher: _DeferredApprovalEventPublisher,
    ) -> None:
        self._query_service = query_service
        self._action_service = action_service
        self._commit = commit
        self._event_publisher = event_publisher

    def list_approvals(self, query: ApprovalListQueryParams) -> ApprovalListResponse:
        page = self._query_service.list_approvals(
            ApprovalListQuery(
                status=query.status,
                risk_level=query.risk_level,
                required_confirmation_level=query.required_confirmation_level,
                expires_before=query.expires_before,
                cursor=query.cursor,
                limit=query.limit,
                sort=query.sort,
            )
        )
        return ApprovalListResponse(
            items=[_summary_response(item) for item in page.items],
            next_cursor=page.next_cursor,
        )

    def get_detail(self, approval_id: str) -> ApprovalDetailResponse:
        return _detail_response(self._query_service.get_detail(approval_id))

    async def submit_action(
        self,
        *,
        approval_id: str,
        action: str,
        body: ApprovalActionRequest,
        context: ActorAuditContext,
    ) -> ApprovalActionResponse:
        structured_payload = dict(body.structured_payload)
        structured_payload["intent"] = _intent_from_path_action(action)
        structured_payload["request_id"] = context.request_id
        comment = body.reason or body.comment
        result = await self._action_service.submit_input(
            ApprovalInput(
                id=body.input_id or f"approval_input_{uuid4().hex}",
                approval_id=approval_id,
                channel=body.channel,
                actor_ref=f"{context.actor_type}:{context.actor_id}",
                raw_text=comment,
                structured_payload=structured_payload,
            )
        )
        if result.approval is None:
            raise ApprovalQueryNotFoundError(approval_id)
        # 事务边界：数据库写入与审计先提交，状态通知只在提交成功后发布。
        self._commit()
        await self._event_publisher.flush()
        return _action_response(result)


def _intent_from_path_action(action: str) -> str:
    if action == "approve":
        return "approve"
    if action == "reject":
        return "reject"
    if action == "request-reanalysis":
        return "request_reanalysis"
    raise ValueError(f"unknown approval action: {action}")


def body_intent_conflicts(*, action: str, body: ApprovalActionRequest) -> bool:
    intent = body.structured_payload.get("intent")
    return isinstance(intent, str) and intent != _intent_from_path_action(action)


def _summary_response(item: ApprovalSummaryView) -> ApprovalSummaryResponse:
    return ApprovalSummaryResponse(
        id=item.id,
        status=item.status,
        target_type=item.target_type,
        target_id=item.target_id,
        action_type=item.action_type,
        action_side=item.action_side,
        risk_level=item.risk_level,
        urgency=item.urgency,
        summary=item.summary,
        required_confirmation_level=item.required_confirmation_level,
        expires_at=item.expires_at,
        expiration_action=item.expiration_action,
        created_at=item.created_at,
        updated_at=item.updated_at,
        latest_decision_summary=_decision_summary_response(item.latest_decision_summary),
        allowed_actions=list(item.allowed_actions),
    )


def _detail_response(item: ApprovalDetailView) -> ApprovalDetailResponse:
    summary = _summary_response(item.summary)
    return ApprovalDetailResponse(
        **summary.model_dump(),
        action_request_summary=dict(item.action_request_summary),
        allowed_channels=list(item.allowed_channels),
        policy_source=item.policy_source,
        inputs=[dict(value) for value in item.inputs],
        evaluations=[dict(value) for value in item.evaluations],
        decisions=[dict(value) for value in item.decisions],
        audit_refs=[dict(value) for value in item.audit_refs],
    )


def _decision_summary_response(item: ApprovalDecisionSummaryView | None) -> ApprovalDecisionSummaryResponse | None:
    if item is None:
        return None
    return ApprovalDecisionSummaryResponse(
        status=item.status,
        intent=item.intent,
        reason_summary=item.reason_summary,
        policy_gate_status=item.policy_gate_status,
        execution_status=item.execution_status,
    )


def _action_response(result: ApprovalServiceResult) -> ApprovalActionResponse:
    approval_summary = None
    if result.approval is not None:
        approval_summary = ApprovalSummaryResponse(
            id=result.approval.id,
            status=result.approval.status.value,
            target_type=result.approval.target_type,
            target_id=result.approval.target_id,
            action_type=result.approval.action_type,
            action_side=result.approval.action_side,
            risk_level=result.approval.risk_level,
            urgency=result.approval.urgency,
            summary=result.approval.summary,
            required_confirmation_level=result.approval.required_confirmation_level.value,
            expires_at=result.approval.expires_at,
            expiration_action=result.approval.expiration_action.value,
            created_at=result.approval.created_at,
            updated_at=result.approval.updated_at,
            latest_decision_summary=None,
            allowed_actions=[] if result.approval.status.value != "pending" else ["approve", "reject", "request-reanalysis"],
        )
    decision = None
    if result.decision is not None:
        decision = ApprovalDecisionSummaryResponse(
            status=result.decision.status.value,
            intent=result.decision.intent.value if result.decision.intent else None,
            reason_summary=result.decision.reason_summary,
            policy_gate_status=result.decision.policy_gate_status.value,
            execution_status=result.decision.execution_status.value,
        )
    return ApprovalActionResponse(
        approval=approval_summary,
        decision=decision,
        evaluation=result.evaluation.to_mapping() if result.evaluation else None,
        ignored=bool(result.decision and result.decision.status.value == "ignored"),
    )
