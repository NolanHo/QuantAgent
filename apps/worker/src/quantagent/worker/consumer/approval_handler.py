from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass

from quantagent.core.approval import ActionRequestedHandler, ApprovalEventPublisher, ApprovalInputReceivedHandler, ApprovalOrchestrationService
from quantagent.core.db.repositories.approval_repository import SQLAlchemyApprovalRepository
from quantagent.core.events import EventBusPublisher, EventEnvelope

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ApprovalProcessingScope:
    handler: ActionRequestedHandler | ApprovalInputReceivedHandler
    commit: Callable[[], None]
    rollback: Callable[[], None]
    close: Callable[[], None]


class WorkerApprovalEventHandler:
    def __init__(
        self,
        *,
        session_factory: Callable[[], object],
        publisher: EventBusPublisher,
    ) -> None:
        self._session_factory = session_factory
        self._publisher = publisher

    async def handle_action_requested(self, envelope: EventEnvelope) -> None:
        scope = self._create_scope(ActionRequestedHandler)
        await self._handle(scope, envelope)

    async def handle_approval_input_received(self, envelope: EventEnvelope) -> None:
        scope = self._create_scope(ApprovalInputReceivedHandler)
        await self._handle(scope, envelope)

    def _create_scope(self, handler_cls):
        session = self._session_factory()
        repository = SQLAlchemyApprovalRepository(session)
        service = ApprovalOrchestrationService(
            repository=repository,
            event_publisher=ApprovalEventPublisher(self._publisher),
        )
        return ApprovalProcessingScope(
            handler=handler_cls(service),
            commit=session.commit,
            rollback=session.rollback,
            close=session.close,
        )

    async def _handle(self, scope: ApprovalProcessingScope, envelope: EventEnvelope) -> None:
        try:
            await scope.handler.handle(envelope)
            scope.commit()
        except Exception:
            scope.rollback()
            logger.exception("Worker approval handler failed: topic=%s message_id=%s", envelope.topic, envelope.id)
            raise
        finally:
            scope.close()
