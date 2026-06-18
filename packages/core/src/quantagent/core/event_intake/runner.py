from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Protocol

from quantagent.core.event_intake.context import ContentCompleteness, EnrichmentStatus, IndustryEventContextV1
from quantagent.core.event_intake.decision import (
    EVENT_INTAKE_DECISION_SCHEMA_VERSION,
    DiscardReason,
    EventIntakeDecisionV1,
    EventIntakeValidationError,
    build_discard_decision,
    build_review_decision,
)
from quantagent.core.model_config import ModelConfigServiceError
from quantagent.plugin_sdk.io import JsonObject, freeze_json_mapping


@dataclass(frozen=True)
class StructuredModelInvocation:
    output: JsonObject
    metadata: JsonObject = field(default_factory=dict)

    def __post_init__(self) -> None:
        object.__setattr__(self, "output", freeze_json_mapping(self.output, stage="provider_output"))
        object.__setattr__(self, "metadata", freeze_json_mapping(self.metadata, stage="provider_metadata"))


@dataclass(frozen=True)
class StructuredModelRepairRequest:
    attempt_index: int
    validation_error: str
    previous_output: JsonObject

    def __post_init__(self) -> None:
        object.__setattr__(self, "previous_output", freeze_json_mapping(self.previous_output, stage="repair_previous_output"))


class StructuredModelInvoker(Protocol):
    async def invoke(
        self,
        *,
        context: IndustryEventContextV1,
        output_schema: str,
        repair: StructuredModelRepairRequest | None = None,
    ) -> StructuredModelInvocation: ...


@dataclass(frozen=True)
class EventIntakeRunResult:
    context: IndustryEventContextV1
    decision: EventIntakeDecisionV1
    provider_invocation_count: int
    invocation_metadata: JsonObject = field(default_factory=dict)

    def __post_init__(self) -> None:
        object.__setattr__(self, "invocation_metadata", freeze_json_mapping(self.invocation_metadata, stage="publish"))


class SingleCallEventIntakeRunner:
    _repair_attempts: int = 3

    def __init__(
        self,
        *,
        invoker: StructuredModelInvoker,
        supported_languages: Sequence[str] = ("en", "zh", "zh-cn", "zh-tw", "ja", "ko", "unknown", ""),
    ) -> None:
        self._invoker = invoker
        self._supported_languages = frozenset(item.lower() for item in supported_languages)

    async def run(self, context: IndustryEventContextV1) -> EventIntakeRunResult:
        context_mapping = context.to_mapping()
        trace = context_mapping["trace"]
        if not isinstance(trace, Mapping):
            raise EventIntakeValidationError("context trace must be an object.")

        deterministic_decision = self._deterministic_precheck(context=context, trace=trace)
        if deterministic_decision is not None:
            return EventIntakeRunResult(
                context=context,
                decision=deterministic_decision,
                provider_invocation_count=0,
                invocation_metadata={"status": "skipped_precheck"},
            )

        attempts: list[StructuredModelInvocation] = []
        last_schema_error: EventIntakeValidationError | None = None
        for attempt_index in range(self._repair_attempts):
            try:
                invocation = await self._invoker.invoke(
                    context=context,
                    output_schema=EVENT_INTAKE_DECISION_SCHEMA_VERSION,
                    repair=_repair_request(attempt_index=attempt_index, attempts=attempts, error=last_schema_error),
                )
            except Exception as exc:
                failure = _model_invocation_failure(exc)
                decision = build_review_decision(
                    trace=trace,
                    reason_summary=failure.reason_summary,
                    failure_code=failure.failure_code,
                    content_completeness=context.article.content_completeness,
                    enrichment_status=context.source.enrichment_status,
                    safe_error_summary=failure.safe_error_summary,
                )
                return EventIntakeRunResult(
                    context=context,
                    decision=decision,
                    provider_invocation_count=attempt_index + 1,
                    invocation_metadata={
                        **failure.invocation_metadata,
                        "attempt_count": attempt_index + 1,
                    },
                )

            attempts.append(invocation)
            try:
                decision = EventIntakeDecisionV1.from_mapping(
                    invocation.output,
                    trace=trace,
                    context_content_completeness=context.article.content_completeness,
                    context_enrichment_status=context.source.enrichment_status,
                    review_confidence_threshold=context.routing_policy.review_confidence_threshold,
                )
            except EventIntakeValidationError as exc:
                last_schema_error = exc
                if attempt_index + 1 < self._repair_attempts:
                    continue
                decision = build_review_decision(
                    trace=trace,
                    reason_summary="结构化模型输出连续 3 次未通过 Router Agent schema 校验，已降级为待复核。",
                    failure_code=exc.reason_code,
                    content_completeness=context.article.content_completeness,
                    enrichment_status=context.source.enrichment_status,
                    safe_error_summary=str(exc),
                )
                return EventIntakeRunResult(
                    context=context,
                    decision=decision,
                    provider_invocation_count=attempt_index + 1,
                    invocation_metadata={
                        "status": "schema_validation_failed",
                        "error_code": exc.reason_code,
                        "attempt_count": attempt_index + 1,
                        "provider_metadata_chain": [dict(item.metadata) for item in attempts],
                        "repair_error": {
                            "reason_code": exc.reason_code,
                            "message": str(exc),
                        },
                    },
                )

            return EventIntakeRunResult(
                context=context,
                decision=decision,
                provider_invocation_count=attempt_index + 1,
                invocation_metadata={
                    "status": "succeeded",
                    "attempt_count": attempt_index + 1,
                    "provider_metadata": dict(invocation.metadata),
                },
            )

        if last_schema_error is not None:
            decision = build_review_decision(
                trace=trace,
                reason_summary="结构化模型输出连续 3 次未通过 Router Agent schema 校验，已降级为待复核。",
                failure_code=last_schema_error.reason_code,
                content_completeness=context.article.content_completeness,
                enrichment_status=context.source.enrichment_status,
                safe_error_summary=str(last_schema_error),
            )
            return EventIntakeRunResult(
                context=context,
                decision=decision,
                provider_invocation_count=len(attempts),
                invocation_metadata={
                    "status": "schema_validation_failed",
                    "error_code": last_schema_error.reason_code,
                    "attempt_count": len(attempts),
                    "provider_metadata_chain": [dict(item.metadata) for item in attempts],
                    "repair_error": {
                        "reason_code": last_schema_error.reason_code,
                        "message": str(last_schema_error),
                    },
                },
            )

        raise RuntimeError("Event intake runner exhausted attempts without producing a decision.")

    def _deterministic_precheck(
        self,
        *,
        context: IndustryEventContextV1,
        trace: Mapping[str, object],
    ) -> EventIntakeDecisionV1 | None:
        language = (context.source.language or "unknown").lower()
        if language not in self._supported_languages:
            return build_discard_decision(
                trace=trace,
                reason=DiscardReason.UNSUPPORTED_LANGUAGE,
                reason_summary="文章语言不在当前 Router Agent 支持范围内，已按规则丢弃。",
                content_completeness=context.article.content_completeness,
                enrichment_status=context.source.enrichment_status,
            )
        has_any_content = any(
            (
                context.article.title,
                context.article.rss_summary,
                context.article.body_excerpt,
                context.source.url,
            )
        )
        if not has_any_content:
            return build_discard_decision(
                trace=trace,
                reason=DiscardReason.MALFORMED,
                reason_summary="新闻缺少可用标题、URL、摘要或正文片段，无法进行有效路由。",
                content_completeness=ContentCompleteness.UNKNOWN,
                enrichment_status=context.source.enrichment_status or EnrichmentStatus.UNKNOWN,
            )
        return None


class ReviewOnlyStructuredModelInvoker:
    async def invoke(
        self,
        *,
        context: IndustryEventContextV1,
        output_schema: str,
        repair: StructuredModelRepairRequest | None = None,
    ) -> StructuredModelInvocation:
        return StructuredModelInvocation(
            output={
                "schema_version": output_schema,
                "decision": "review",
                "discard_reason": "not_discarded",
                "quality": {
                    "is_spam": False,
                    "noise_flags": ("provider_not_configured",),
                    "content_completeness": context.article.content_completeness.value,
                    "enrichment_status": context.source.enrichment_status.value,
                    "confidence": 0.0,
                },
                "industry_relevance": (),
                "structured_news": {
                    "canonical_title": context.article.title,
                    "short_summary": "当前未配置 Router Agent 模型服务，该新闻保留为待复核。",
                    "bullet_summary": (),
                    "event_type": "provider_not_configured",
                    "entities": (),
                    "companies": (),
                    "tickers": (),
                    "technologies": (),
                    "products": (),
                    "locations": (),
                    "numbers": (),
                    "time_horizon": None,
                    "source_facts": (),
                    "uncertainties": ("provider_not_configured",),
                },
                "routing": {
                    "target_industries": (),
                    "target_topics": (),
                    "priority": "low",
                    "requires_deep_analysis": False,
                    "requires_human_review": True,
                    "dedupe_key_hint": context.source.url,
                },
                "audit": {
                    "reason_summary": "worker 未配置结构化模型 provider，Router Agent 无法完成自动路由。",
                    "evidence_field_refs": ("trace", "source.url", "article.title"),
                    "schema_validation_status": "valid",
                    "failure_code": "PROVIDER_NOT_CONFIGURED",
                    "safe_error_summary": None,
                },
            },
            metadata={"status": "provider_not_configured", "model": "review-only"},
        )


@dataclass(frozen=True)
class _ModelInvocationFailure:
    failure_code: str
    reason_summary: str
    safe_error_summary: str
    invocation_metadata: JsonObject


def _model_invocation_failure(exc: Exception) -> _ModelInvocationFailure:
    if isinstance(exc, ModelConfigServiceError):
        return _model_config_failure(exc)
    return _ModelInvocationFailure(
        failure_code="PROVIDER_UNAVAILABLE",
        reason_summary="结构化模型调用异常，Router Agent 将该新闻保留为待复核。",
        safe_error_summary=exc.__class__.__name__,
        invocation_metadata={
            "status": "provider_failed",
            "error_type": exc.__class__.__name__,
            "error_code": "PROVIDER_UNAVAILABLE",
        },
    )


def _model_config_failure(exc: ModelConfigServiceError) -> _ModelInvocationFailure:
    reason_summary = _model_config_reason_summary(exc.code)
    safe_details = _json_safe_string_map(exc.safe_details)
    metadata: dict[str, object] = {
        "status": "provider_failed",
        "error_type": exc.__class__.__name__,
        "error_code": exc.code,
        "retryable": exc.retryable,
        "safe_details": safe_details,
    }
    return _ModelInvocationFailure(
        failure_code=exc.code,
        reason_summary=reason_summary,
        safe_error_summary=_safe_error_summary(exc),
        invocation_metadata=metadata,
    )


def _model_config_reason_summary(error_code: str) -> str:
    if error_code == "MODEL_PROVIDER_RESPONSE_INVALID":
        return "模型返回内容无法解析为 Router Agent 需要的结构化 JSON，已保留待复核。"
    if error_code in {"MODEL_PROVIDER_KEY_MISSING", "MODEL_PROVIDER_DECRYPT_FAILED", "MODEL_CONFIG_ENCRYPTION_UNAVAILABLE"}:
        return "Router Agent 模型配置不可用，已将该新闻保留为待复核。"
    if error_code in {"MODEL_PROVIDER_HTTP_ERROR", "MODEL_PROVIDER_UNREACHABLE", "MODEL_PROVIDER_TIMEOUT"}:
        return "Router Agent 模型调用失败，已将该新闻保留为待复核。"
    if error_code.startswith("MODEL_"):
        return "Router Agent 模型服务未能完成结构化路由，已将该新闻保留为待复核。"
    return "结构化模型调用异常，Router Agent 将该新闻保留为待复核。"


def _safe_error_summary(exc: ModelConfigServiceError) -> str:
    message = exc.message.strip()
    if message:
        return f"{exc.code}: {message}"
    return exc.code


def _json_safe_string_map(value: Mapping[str, object]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, item in value.items():
        if isinstance(item, str | int | float | bool) or item is None:
            result[str(key)] = item
        else:
            result[str(key)] = str(item)
    return result


class FakeStructuredModelInvoker:
    def __init__(
        self,
        outputs: Sequence[Mapping[str, object]] | Callable[[IndustryEventContextV1], Mapping[str, object]],
    ) -> None:
        self._outputs = outputs
        self.invocations: list[IndustryEventContextV1] = []

    @property
    def invocation_count(self) -> int:
        return len(self.invocations)

    async def invoke(
        self,
        *,
        context: IndustryEventContextV1,
        output_schema: str,
        repair: StructuredModelRepairRequest | None = None,
    ) -> StructuredModelInvocation:
        self.invocations.append(context)
        if callable(self._outputs):
            output = self._outputs(context)
        else:
            index = min(len(self.invocations) - 1, len(self._outputs) - 1)
            output = self._outputs[index]
        return StructuredModelInvocation(
            output=output,
            metadata={
                "fake_invocation_index": len(self.invocations) - 1,
                "output_schema": output_schema,
                "repair_attempt": repair.attempt_index if repair else None,
                "repair_error": repair.validation_error if repair else None,
            },
        )


def _repair_request(
    *,
    attempt_index: int,
    attempts: Sequence[StructuredModelInvocation],
    error: EventIntakeValidationError | None,
) -> StructuredModelRepairRequest | None:
    if attempt_index == 0 or not attempts or error is None:
        return None
    return StructuredModelRepairRequest(
        attempt_index=attempt_index + 1,
        validation_error=str(error),
        previous_output=dict(attempts[-1].output),
    )
