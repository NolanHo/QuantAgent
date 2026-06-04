from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

from quantagent.core.approval.evaluator import ApprovalRuleEvaluator
from quantagent.core.approval.models import (
    TERMINAL_REQUEST_STATUSES,
    ActionRequest,
    ApprovalAuditRecord,
    ApprovalDecision,
    ApprovalDecisionStatus,
    ApprovalEvaluation,
    ApprovalInput,
    ApprovalIntent,
    ApprovalMode,
    ApprovalRequest,
    ApprovalRequestStatus,
    ExecutionStatus,
    ExpirationAction,
    PolicyGateStatus,
)
from quantagent.core.approval.policies import ApprovalPolicyResolver
from quantagent.core.approval.ports import ActionExecutor, PolicyGate
from quantagent.core.approval.publishers import ApprovalEventPublisher
from quantagent.core.approval.repository import ApprovalRepository, InMemoryApprovalRepository


@dataclass(frozen=True)
class ApprovalServiceResult:
    approval: ApprovalRequest | None
    decision: ApprovalDecision | None = None
    evaluation: ApprovalEvaluation | None = None


class ApprovalOrchestrationService:
    def __init__(
        self,
        *,
        repository: ApprovalRepository | None = None,
        event_publisher: ApprovalEventPublisher,
        policy_resolver: ApprovalPolicyResolver | None = None,
        evaluator: ApprovalRuleEvaluator | None = None,
        policy_gate: PolicyGate | None = None,
        executor: ActionExecutor | None = None,
        id_factory: object | None = None,
    ) -> None:
        self._repository = repository or InMemoryApprovalRepository()
        self._event_publisher = event_publisher
        self._policy_resolver = policy_resolver or ApprovalPolicyResolver()
        self._evaluator = evaluator or ApprovalRuleEvaluator()
        self._policy_gate = policy_gate
        self._executor = executor
        self._id_factory = id_factory if callable(id_factory) else _default_id

    @property
    def repository(self) -> ApprovalRepository:
        return self._repository

    async def submit_action(self, action: ActionRequest) -> ApprovalServiceResult:
        self._repository.save_action_request(action)
        policy = self._policy_resolver.resolve(action)
        approval = _approval_from_action(action, policy, approval_id=self._id_factory("approval"))
        self._repository.save_approval_request(approval)

        if policy.mode == ApprovalMode.BLOCKED:
            blocked = approval.with_status(ApprovalRequestStatus.BLOCKED)
            self._repository.save_approval_request(blocked)
            decision = self._record_decision(
                ApprovalDecision(
                    approval_id=blocked.id,
                    action_request_id=action.id,
                    status=ApprovalDecisionStatus.BLOCKED,
                    policy_gate_status=PolicyGateStatus.NOT_REQUIRED,
                    execution_status=ExecutionStatus.NOT_REQUESTED,
                    reason_summary=policy.reason_summary,
                    correlation_id=action.correlation_id,
                )
            )
            self._record_decision_audit(
                approval=approval,
                final_approval=blocked,
                decision=decision,
                input_id=None,
                channel="system",
                actor_ref=None,
            )
            await self._event_publisher.publish_approval_completed(decision)
            return ApprovalServiceResult(approval=blocked, decision=decision)

        if policy.mode == ApprovalMode.NO_APPROVAL_NOTIFY_ONLY:
            await self._event_publisher.publish_notification_requested(
                approval,
                correlation_id=action.correlation_id,
                reason_summary=policy.reason_summary,
            )
            completed = approval.with_status(ApprovalRequestStatus.COMPLETED)
            self._repository.save_approval_request(completed)
            decision = self._record_decision(
                ApprovalDecision(
                    approval_id=completed.id,
                    action_request_id=action.id,
                    status=ApprovalDecisionStatus.NOT_REQUIRED,
                    policy_gate_status=PolicyGateStatus.NOT_REQUIRED,
                    execution_status=ExecutionStatus.NOT_REQUESTED,
                    reason_summary="Approval is not required; notification requested.",
                    correlation_id=action.correlation_id,
                )
            )
            self._record_decision_audit(
                approval=approval,
                final_approval=completed,
                decision=decision,
                input_id=None,
                channel="system",
                actor_ref=None,
            )
            await self._event_publisher.publish_approval_completed(decision)
            return ApprovalServiceResult(approval=completed, decision=decision)

        if policy.mode == ApprovalMode.EXECUTE_THEN_NOTIFY:
            decision = await self._execute_after_gate(
                approval,
                action,
                intent=ApprovalIntent.APPROVE,
                reason_summary="Pre-authorized execute-then-notify path requested execution.",
            )
            await self._event_publisher.publish_notification_requested(
                approval,
                correlation_id=action.correlation_id,
                reason_summary=policy.reason_summary,
            )
            completed = approval.with_status(_status_from_decision(decision))
            self._repository.save_approval_request(completed)
            self._record_decision_audit(
                approval=approval,
                final_approval=completed,
                decision=decision,
                input_id=None,
                channel="system",
                actor_ref=None,
            )
            await self._event_publisher.publish_approval_completed(decision)
            return ApprovalServiceResult(approval=completed, decision=decision)

        await self._event_publisher.publish_approval_requested(approval, correlation_id=action.correlation_id)
        await self._event_publisher.publish_notification_requested(
            approval,
            correlation_id=action.correlation_id,
            reason_summary=policy.reason_summary,
        )
        return ApprovalServiceResult(
            approval=approval,
            decision=ApprovalDecision(
                approval_id=approval.id,
                action_request_id=action.id,
                status=ApprovalDecisionStatus.PENDING,
                policy_gate_status=PolicyGateStatus.NOT_REQUIRED,
                execution_status=ExecutionStatus.NOT_REQUESTED,
                reason_summary="Approval request is pending human input.",
                correlation_id=action.correlation_id,
            ),
        )

    async def submit_input(self, user_input: ApprovalInput) -> ApprovalServiceResult:
        approval = self._repository.get_approval_request_for_update(user_input.approval_id)
        if approval is None:
            return ApprovalServiceResult(
                approval=None,
                decision=ApprovalDecision(
                    approval_id=user_input.approval_id,
                    action_request_id="unknown",
                    status=ApprovalDecisionStatus.BLOCKED,
                    policy_gate_status=PolicyGateStatus.NOT_REQUIRED,
                    execution_status=ExecutionStatus.NOT_REQUESTED,
                    reason_summary="Approval request was not found.",
                ),
            )

        existing_decision = self._repository.get_decision_by_input_id(user_input.id, approval_id=approval.id)
        if existing_decision is not None:
            return ApprovalServiceResult(
                approval=approval,
                decision=existing_decision,
                evaluation=self._repository.get_evaluation_by_input_id(user_input.id, approval_id=approval.id),
            )

        if approval.status in TERMINAL_REQUEST_STATUSES:
            # 幂等边界：终态后输入只能返回 ignored 摘要，不能覆盖最终 decision 或触发执行副作用。
            decision = ApprovalDecision(
                approval_id=approval.id,
                action_request_id=approval.action_request_id,
                status=ApprovalDecisionStatus.IGNORED,
                policy_gate_status=PolicyGateStatus.NOT_REQUIRED,
                execution_status=ExecutionStatus.NOT_REQUESTED,
                reason_summary="Approval is already terminal; input ignored.",
            )
            self._record_audit(
                approval=approval,
                action="input_ignored",
                before_status=approval.status,
                after_status=approval.status,
                reason_summary=decision.reason_summary,
                channel=user_input.channel,
                actor_ref=user_input.actor_ref,
                request_id=_request_id_from_input(user_input),
                record_refs={"input_id": user_input.id},
                payload_summary={"status": decision.status.value},
            )
            return ApprovalServiceResult(approval=approval, decision=decision)

        stored_input = self._repository.save_input(user_input)
        existing_evaluation = self._repository.get_evaluation_by_input_id(stored_input.id, approval_id=approval.id)
        if existing_evaluation is not None:
            existing_decision = self._repository.get_decision_by_input_id(stored_input.id, approval_id=approval.id)
            return ApprovalServiceResult(approval=approval, evaluation=existing_evaluation, decision=existing_decision)

        evaluation = self._evaluator.evaluate(approval, stored_input)
        self._repository.save_evaluation(evaluation)
        action = self._repository.get_action_request(approval.action_request_id)
        if action is None:
            request_id = _request_id_from_input(stored_input)
            decision = self._record_decision(
                ApprovalDecision(
                    approval_id=approval.id,
                    action_request_id=approval.action_request_id,
                    status=ApprovalDecisionStatus.BLOCKED,
                    intent=evaluation.interpreted_intent,
                    policy_gate_status=PolicyGateStatus.NOT_REQUIRED,
                    execution_status=ExecutionStatus.NOT_REQUESTED,
                    reason_summary="Original action request was not found.",
                    request_id=request_id,
                )
            )
            self._link_decision(stored_input.id, decision)
            final_approval = approval.with_status(_status_from_decision(decision))
            self._repository.save_approval_request(final_approval)
            self._record_decision_audit(
                approval=approval,
                final_approval=final_approval,
                decision=decision,
                input_id=stored_input.id,
                channel=stored_input.channel,
                actor_ref=stored_input.actor_ref,
                request_id=request_id,
            )
            await self._event_publisher.publish_approval_completed(decision)
            return ApprovalServiceResult(approval=final_approval, evaluation=evaluation, decision=decision)

        request_id = _request_id_from_input(stored_input)
        decision = await self._decision_from_evaluation(approval, action, evaluation, request_id=request_id)
        self._link_decision(stored_input.id, decision)
        final_approval = approval.with_status(_status_from_decision(decision))
        self._repository.save_approval_request(final_approval)
        self._record_decision_audit(
            approval=approval,
            final_approval=final_approval,
            decision=decision,
            input_id=stored_input.id,
            channel=stored_input.channel,
            actor_ref=stored_input.actor_ref,
            request_id=request_id,
        )
        await self._event_publisher.publish_approval_completed(decision)
        return ApprovalServiceResult(approval=final_approval, evaluation=evaluation, decision=decision)

    async def expire_approval(self, approval_id: str) -> ApprovalServiceResult:
        approval = self._repository.get_approval_request_for_update(approval_id)
        if approval is None:
            return ApprovalServiceResult(
                approval=None,
                decision=ApprovalDecision(
                    approval_id=approval_id,
                    action_request_id="unknown",
                    status=ApprovalDecisionStatus.BLOCKED,
                    policy_gate_status=PolicyGateStatus.NOT_REQUIRED,
                    execution_status=ExecutionStatus.NOT_REQUESTED,
                    reason_summary="Approval request was not found for expiration.",
                ),
            )
        action = self._repository.get_action_request(approval.action_request_id)
        if action is None:
            decision = self._record_decision(
                ApprovalDecision(
                    approval_id=approval.id,
                    action_request_id=approval.action_request_id,
                    status=ApprovalDecisionStatus.BLOCKED,
                    policy_gate_status=PolicyGateStatus.NOT_REQUIRED,
                    execution_status=ExecutionStatus.NOT_REQUESTED,
                    reason_summary="Original action request was not found for expiration.",
                )
            )
            final_approval = approval.with_status(_status_from_decision(decision))
            self._repository.save_approval_request(final_approval)
            self._record_decision_audit(
                approval=approval,
                final_approval=final_approval,
                decision=decision,
                input_id=None,
                channel="system",
                actor_ref=None,
            )
            await self._event_publisher.publish_approval_completed(decision)
            return ApprovalServiceResult(approval=final_approval, decision=decision)

        if approval.expiration_action == ExpirationAction.EXPIRE_APPROVE:
            decision = await self._execute_after_gate(
                approval,
                action,
                intent=ApprovalIntent.APPROVE,
                reason_summary="Approval expired with expire_approve action.",
            )
        elif approval.expiration_action == ExpirationAction.EXPIRE_NOTIFY_ONLY:
            await self._event_publisher.publish_notification_requested(
                approval,
                correlation_id=action.correlation_id,
                reason_summary="Approval expired; notification only.",
            )
            decision = self._record_decision(
                ApprovalDecision(
                    approval_id=approval.id,
                    action_request_id=approval.action_request_id,
                    status=ApprovalDecisionStatus.EXPIRED,
                    policy_gate_status=PolicyGateStatus.NOT_REQUIRED,
                    execution_status=ExecutionStatus.NOT_REQUESTED,
                    reason_summary="Approval expired; notification requested only.",
                    correlation_id=action.correlation_id,
                )
            )
        elif approval.expiration_action == ExpirationAction.EXPIRE_REANALYSIS:
            decision = self._record_decision(
                ApprovalDecision(
                    approval_id=approval.id,
                    action_request_id=approval.action_request_id,
                    status=ApprovalDecisionStatus.REANALYSIS_REQUESTED,
                    policy_gate_status=PolicyGateStatus.NOT_REQUIRED,
                    execution_status=ExecutionStatus.NOT_REQUESTED,
                    reason_summary="Approval expired; reanalysis requested.",
                    correlation_id=action.correlation_id,
                )
            )
        elif approval.expiration_action == ExpirationAction.ESCALATE:
            decision = self._record_decision(
                ApprovalDecision(
                    approval_id=approval.id,
                    action_request_id=approval.action_request_id,
                    status=ApprovalDecisionStatus.ESCALATED,
                    policy_gate_status=PolicyGateStatus.NOT_REQUIRED,
                    execution_status=ExecutionStatus.NOT_REQUESTED,
                    reason_summary="Approval expired; stronger confirmation required.",
                    correlation_id=action.correlation_id,
                )
            )
        else:
            decision = self._record_decision(
                ApprovalDecision(
                    approval_id=approval.id,
                    action_request_id=approval.action_request_id,
                    status=ApprovalDecisionStatus.REJECTED,
                    policy_gate_status=PolicyGateStatus.NOT_REQUIRED,
                    execution_status=ExecutionStatus.NOT_REQUESTED,
                    reason_summary="Approval expired and was rejected.",
                    correlation_id=action.correlation_id,
                )
            )

        final_approval = approval.with_status(_status_from_decision(decision, expired=True))
        self._repository.save_approval_request(final_approval)
        self._record_decision_audit(
            approval=approval,
            final_approval=final_approval,
            decision=decision,
            input_id=None,
            channel="system",
            actor_ref=None,
        )
        await self._event_publisher.publish_approval_completed(decision)
        return ApprovalServiceResult(approval=final_approval, decision=decision)

    async def _decision_from_evaluation(
        self,
        approval: ApprovalRequest,
        action: ActionRequest,
        evaluation: ApprovalEvaluation,
        *,
        request_id: str | None = None,
    ) -> ApprovalDecision:
        intent = evaluation.interpreted_intent
        if intent == ApprovalIntent.APPROVE:
            return await self._execute_after_gate(
                approval,
                action,
                intent=intent,
                reason_summary=evaluation.reason_summary,
                request_id=request_id,
            )
        if intent == ApprovalIntent.REJECT:
            return self._record_decision(
                ApprovalDecision(
                    approval_id=approval.id,
                    action_request_id=approval.action_request_id,
                    status=ApprovalDecisionStatus.REJECTED,
                    intent=intent,
                    policy_gate_status=PolicyGateStatus.NOT_REQUIRED,
                    execution_status=ExecutionStatus.NOT_REQUESTED,
                    reason_summary=evaluation.reason_summary,
                    correlation_id=action.correlation_id,
                    request_id=request_id,
                )
            )
        if intent == ApprovalIntent.REQUEST_REANALYSIS:
            return self._record_decision(
                ApprovalDecision(
                    approval_id=approval.id,
                    action_request_id=approval.action_request_id,
                    status=ApprovalDecisionStatus.REANALYSIS_REQUESTED,
                    intent=intent,
                    policy_gate_status=PolicyGateStatus.NOT_REQUIRED,
                    execution_status=ExecutionStatus.NOT_REQUESTED,
                    reason_summary=evaluation.reason_summary,
                    correlation_id=action.correlation_id,
                    request_id=request_id,
                )
            )
        return self._record_decision(
            ApprovalDecision(
                approval_id=approval.id,
                action_request_id=approval.action_request_id,
                status=ApprovalDecisionStatus.ESCALATED,
                intent=intent,
                policy_gate_status=PolicyGateStatus.NOT_REQUIRED,
                execution_status=ExecutionStatus.NOT_REQUESTED,
                reason_summary=evaluation.reason_summary,
                correlation_id=action.correlation_id,
                request_id=request_id,
            )
        )

    async def _execute_after_gate(
        self,
        approval: ApprovalRequest,
        action: ActionRequest,
        *,
        intent: ApprovalIntent,
        reason_summary: str,
        request_id: str | None = None,
    ) -> ApprovalDecision:
        if self._policy_gate is None:
            # Policy Gate 是执行前强制边界；未注入时保守阻断，避免测试 fake 以外路径误执行。
            return self._record_decision(
                ApprovalDecision(
                    approval_id=approval.id,
                    action_request_id=action.id,
                    status=ApprovalDecisionStatus.POLICY_GATE_FAILED,
                    intent=intent,
                    policy_gate_status=PolicyGateStatus.UNAVAILABLE,
                    execution_status=ExecutionStatus.NOT_REQUESTED,
                    reason_summary="Policy Gate is unavailable; execution was blocked.",
                    correlation_id=action.correlation_id,
                    request_id=request_id,
                )
            )

        try:
            gate_result = await self._policy_gate.evaluate(action=action, approval=approval)
        except Exception:
            return self._record_decision(
                ApprovalDecision(
                    approval_id=approval.id,
                    action_request_id=action.id,
                    status=ApprovalDecisionStatus.POLICY_GATE_FAILED,
                    intent=intent,
                    policy_gate_status=PolicyGateStatus.FAILED,
                    execution_status=ExecutionStatus.NOT_REQUESTED,
                    reason_summary="Policy Gate failed; execution was blocked.",
                    correlation_id=action.correlation_id,
                    request_id=request_id,
                )
            )

        if not gate_result.allowed:
            return self._record_decision(
                ApprovalDecision(
                    approval_id=approval.id,
                    action_request_id=action.id,
                    status=ApprovalDecisionStatus.POLICY_BLOCKED,
                    intent=intent,
                    policy_gate_status=PolicyGateStatus.DENIED,
                    execution_status=ExecutionStatus.NOT_REQUESTED,
                    reason_summary=gate_result.reason_summary,
                    correlation_id=action.correlation_id,
                    request_id=request_id,
                )
            )

        if self._executor is None:
            return self._record_decision(
                ApprovalDecision(
                    approval_id=approval.id,
                    action_request_id=action.id,
                    status=ApprovalDecisionStatus.EXECUTION_FAILED,
                    intent=intent,
                    policy_gate_status=PolicyGateStatus.ALLOWED,
                    execution_status=ExecutionStatus.REQUEST_FAILED,
                    reason_summary="Action executor is unavailable after Policy Gate allowed.",
                    correlation_id=action.correlation_id,
                    request_id=request_id,
                )
            )

        try:
            execution_result = await self._executor.execute(action=action, approval=approval)
            execution_status = ExecutionStatus(execution_result.execution_status)
            status = ApprovalDecisionStatus.EXECUTION_REQUESTED
            final_reason = execution_result.reason_summary
        except Exception:
            execution_status = ExecutionStatus.REQUEST_FAILED
            status = ApprovalDecisionStatus.EXECUTION_FAILED
            final_reason = "Action executor failed before any real broker execution was represented."

        return self._record_decision(
            ApprovalDecision(
                approval_id=approval.id,
                action_request_id=action.id,
                status=status,
                intent=intent,
                policy_gate_status=PolicyGateStatus.ALLOWED,
                execution_status=execution_status,
                reason_summary=final_reason or reason_summary,
                correlation_id=action.correlation_id,
                request_id=request_id,
            )
        )

    def _record_decision(self, decision: ApprovalDecision) -> ApprovalDecision:
        self._repository.save_decision(decision)
        return decision

    def _link_decision(self, input_id: str, decision: ApprovalDecision) -> None:
        self._repository.link_decision_to_input(input_id, decision)

    def _record_decision_audit(
        self,
        *,
        approval: ApprovalRequest,
        final_approval: ApprovalRequest,
        decision: ApprovalDecision,
        input_id: str | None,
        channel: str | None,
        actor_ref: str | None,
        request_id: str | None = None,
    ) -> None:
        self._record_audit(
            approval=approval,
            action=f"decision.{decision.status.value}",
            before_status=approval.status,
            after_status=final_approval.status,
            reason_summary=decision.reason_summary,
            channel=channel,
            actor_ref=actor_ref,
            request_id=request_id,
            record_refs={
                "input_id": input_id,
                "action_request_id": decision.action_request_id,
            },
            payload_summary={
                "decision_status": decision.status.value,
                "intent": decision.intent.value if decision.intent else None,
                "policy_gate_status": decision.policy_gate_status.value,
                "execution_status": decision.execution_status.value,
            },
        )

    def _record_audit(
        self,
        *,
        approval: ApprovalRequest,
        action: str,
        before_status: ApprovalRequestStatus | None,
        after_status: ApprovalRequestStatus | None,
        reason_summary: str,
        channel: str | None,
        actor_ref: str | None,
        request_id: str | None = None,
        record_refs: dict[str, object],
        payload_summary: dict[str, object],
    ) -> None:
        actor_type, actor_id = _split_actor_ref(actor_ref)
        self._repository.save_audit_record(
            ApprovalAuditRecord(
                record_id=self._id_factory("approval_audit"),
                approval_id=approval.id,
                actor_id=actor_id,
                actor_type=actor_type,
                action=action,
                resource_id=approval.id,
                before_status=before_status,
                after_status=after_status,
                request_id=request_id,
                channel=channel,
                reason_summary=reason_summary,
                record_refs=record_refs,
                payload_summary=payload_summary,
            )
        )


def _approval_from_action(action: ActionRequest, policy: object, *, approval_id: str) -> ApprovalRequest:
    return ApprovalRequest(
        id=approval_id,
        action_request_id=action.id,
        target_type=action.target_type,
        target_id=action.target_id,
        action_type=action.action_type,
        action_side=action.action_side,
        risk_level=_risk_level(action),
        urgency=action.urgency,
        summary=_summary(action),
        proposed_payload=action.proposed_payload,
        required_confirmation_level=policy.required_confirmation_level,
        expires_at=policy.expires_at,
        expiration_action=policy.expiration_action,
        policy_source=policy.policy_source,
        status=ApprovalRequestStatus.PENDING,
        allowed_channels=policy.allowed_channels,
    )


def _risk_level(action: ActionRequest) -> str:
    if "high_risk" in action.risk_flags or action.action_side == "increase_risk":
        return "high"
    if action.action_side == "reduce_risk":
        return "medium"
    return "low"


def _summary(action: ActionRequest) -> str:
    return f"{action.action_type} {action.action_side} for {action.target_type}:{action.target_id}"


def _status_from_decision(decision: ApprovalDecision, *, expired: bool = False) -> ApprovalRequestStatus:
    if expired:
        if decision.status == ApprovalDecisionStatus.EXECUTION_REQUESTED:
            return ApprovalRequestStatus.COMPLETED
        if decision.status == ApprovalDecisionStatus.ESCALATED:
            return ApprovalRequestStatus.ESCALATED
        return ApprovalRequestStatus.EXPIRED
    if decision.status in {
        ApprovalDecisionStatus.EXECUTION_REQUESTED,
        ApprovalDecisionStatus.EXECUTION_FAILED,
        ApprovalDecisionStatus.NOT_REQUIRED,
        ApprovalDecisionStatus.REJECTED,
        ApprovalDecisionStatus.REANALYSIS_REQUESTED,
    }:
        return ApprovalRequestStatus.COMPLETED
    if decision.status in {ApprovalDecisionStatus.POLICY_BLOCKED, ApprovalDecisionStatus.POLICY_GATE_FAILED}:
        return ApprovalRequestStatus.BLOCKED
    if decision.status == ApprovalDecisionStatus.ESCALATED:
        return ApprovalRequestStatus.ESCALATED
    if decision.status == ApprovalDecisionStatus.BLOCKED:
        return ApprovalRequestStatus.BLOCKED
    return ApprovalRequestStatus.COMPLETED


def _default_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


def _split_actor_ref(actor_ref: str | None) -> tuple[str | None, str | None]:
    if actor_ref is None:
        return None, None
    actor_type, separator, actor_id = actor_ref.partition(":")
    if not separator:
        return None, actor_ref
    return actor_type or None, actor_id or None


def _request_id_from_input(user_input: ApprovalInput) -> str | None:
    request_id = user_input.structured_payload.get("request_id")
    return request_id if isinstance(request_id, str) and request_id.strip() else None
