from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from quantagent.core.event_intake.context import ContentCompleteness, EnrichmentStatus
from quantagent.plugin_sdk.io import JsonObject, freeze_json_mapping

EVENT_INTAKE_DECISION_SCHEMA_VERSION_V1 = "event_intake_decision.v1"
EVENT_INTAKE_DECISION_SCHEMA_VERSION_V2 = "event_intake_decision.v2"
EVENT_INTAKE_DECISION_SCHEMA_VERSION = EVENT_INTAKE_DECISION_SCHEMA_VERSION_V2


class EventIntakeValidationError(ValueError):
    def __init__(self, message: str, *, reason_code: str = "EVENT_INTAKE_VALIDATION_FAILED") -> None:
        super().__init__(message)
        self.reason_code = reason_code


class IntakeDecision(StrEnum):
    DISCARD = "discard"
    ROUTE = "route"
    REVIEW = "review"


class DiscardReason(StrEnum):
    SPAM = "spam"
    IRRELEVANT = "irrelevant"
    DUPLICATE_HINT = "duplicate_hint"
    LOW_INFORMATION = "low_information"
    UNSUPPORTED_LANGUAGE = "unsupported_language"
    MALFORMED = "malformed"
    NOT_DISCARDED = "not_discarded"


class RelevanceRelationship(StrEnum):
    DIRECT = "direct"
    INDIRECT = "indirect"
    CONTEXTUAL = "contextual"
    NONE = "none"


class RoutingPriority(StrEnum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


ROUTING_SCORE_WEIGHTS: dict[str, float] = {
    "source_quality": 0.16,
    "information_freshness": 0.16,
    "entity_specificity": 0.14,
    "market_materiality": 0.24,
    "industry_relevance": 0.14,
    "actionability_urgency": 0.16,
}


@dataclass(frozen=True)
class QualityAssessmentV1:
    is_spam: bool
    noise_flags: tuple[str, ...]
    content_completeness: ContentCompleteness
    enrichment_status: EnrichmentStatus
    confidence: float
    reason_summary: str | None = None
    risk_flags: tuple[str, ...] = field(default_factory=tuple)

    def to_mapping(self) -> dict[str, object]:
        return {
            "is_spam": self.is_spam,
            "noise_flags": list(self.noise_flags),
            "content_completeness": self.content_completeness.value,
            "enrichment_status": self.enrichment_status.value,
            "confidence": self.confidence,
            "reason_summary": self.reason_summary,
            "risk_flags": list(self.risk_flags),
        }


@dataclass(frozen=True)
class IndustryRelevanceV1:
    industry_id: str
    relationship: RelevanceRelationship
    relevance_score: float
    reason_summary: str

    def to_mapping(self) -> dict[str, object]:
        return {
            "industry_id": self.industry_id,
            "relationship": self.relationship.value,
            "relevance_score": self.relevance_score,
            "reason_summary": self.reason_summary,
        }


@dataclass(frozen=True)
class RoutingScoreBreakdownV1:
    source_quality: float
    information_freshness: float
    entity_specificity: float
    market_materiality: float
    industry_relevance: float
    actionability_urgency: float
    reason_summary: str | None = None

    @property
    def weighted_event_score(self) -> float:
        # 路由总分由后端按固定权重计算，避免模型直接输出一个桶化分数。
        total = (
            self.source_quality * ROUTING_SCORE_WEIGHTS["source_quality"]
            + self.information_freshness * ROUTING_SCORE_WEIGHTS["information_freshness"]
            + self.entity_specificity * ROUTING_SCORE_WEIGHTS["entity_specificity"]
            + self.market_materiality * ROUTING_SCORE_WEIGHTS["market_materiality"]
            + self.industry_relevance * ROUTING_SCORE_WEIGHTS["industry_relevance"]
            + self.actionability_urgency * ROUTING_SCORE_WEIGHTS["actionability_urgency"]
        )
        return round(total, 4)

    def to_mapping(self) -> dict[str, object]:
        return {
            "source_quality": self.source_quality,
            "information_freshness": self.information_freshness,
            "entity_specificity": self.entity_specificity,
            "market_materiality": self.market_materiality,
            "industry_relevance": self.industry_relevance,
            "actionability_urgency": self.actionability_urgency,
            "weights": dict(ROUTING_SCORE_WEIGHTS),
            "weighted_event_score": self.weighted_event_score,
            "reason_summary": self.reason_summary,
        }


@dataclass(frozen=True)
class StructuredNewsV1:
    canonical_title: str | None
    short_summary: str | None
    bullet_summary: tuple[str, ...] = field(default_factory=tuple)
    event_type: str | None = None
    event_type_label: str | None = None
    tags: tuple[dict[str, object], ...] = field(default_factory=tuple)
    entities: tuple[str, ...] = field(default_factory=tuple)
    companies: tuple[str, ...] = field(default_factory=tuple)
    tickers: tuple[str, ...] = field(default_factory=tuple)
    technologies: tuple[str, ...] = field(default_factory=tuple)
    products: tuple[str, ...] = field(default_factory=tuple)
    locations: tuple[str, ...] = field(default_factory=tuple)
    numbers: tuple[str, ...] = field(default_factory=tuple)
    time_horizon: str | None = None
    source_facts: tuple[str, ...] = field(default_factory=tuple)
    uncertainties: tuple[str, ...] = field(default_factory=tuple)

    def to_mapping(self) -> dict[str, object]:
        return {
            "canonical_title": self.canonical_title,
            "short_summary": self.short_summary,
            "bullet_summary": list(self.bullet_summary),
            "event_type": self.event_type,
            "event_type_label": self.event_type_label,
            "tags": [dict(item) for item in self.tags],
            "entities": list(self.entities),
            "companies": list(self.companies),
            "tickers": list(self.tickers),
            "technologies": list(self.technologies),
            "products": list(self.products),
            "locations": list(self.locations),
            "numbers": list(self.numbers),
            "time_horizon": self.time_horizon,
            "source_facts": list(self.source_facts),
            "uncertainties": list(self.uncertainties),
        }


@dataclass(frozen=True)
class RoutingOutcomeV1:
    target_industries: tuple[str, ...]
    target_topics: tuple[str, ...] = field(default_factory=tuple)
    priority: RoutingPriority = RoutingPriority.NORMAL
    event_score: float | None = None
    score_breakdown: RoutingScoreBreakdownV1 | None = None
    requires_deep_analysis: bool = False
    requires_human_review: bool = False
    dedupe_key_hint: str | None = None
    reason_summary: str | None = None
    next_step_hint: str | None = None

    def to_mapping(self) -> dict[str, object]:
        return {
            "target_industries": list(self.target_industries),
            "target_topics": list(self.target_topics),
            "priority": self.priority.value,
            "event_score": self.event_score,
            "score_breakdown": self.score_breakdown.to_mapping() if self.score_breakdown else None,
            "requires_deep_analysis": self.requires_deep_analysis,
            "requires_human_review": self.requires_human_review,
            "dedupe_key_hint": self.dedupe_key_hint,
            "reason_summary": self.reason_summary,
            "next_step_hint": self.next_step_hint,
        }


@dataclass(frozen=True)
class AuditSummaryV1:
    reason_summary: str
    evidence_field_refs: tuple[str, ...]
    schema_validation_status: str
    failure_code: str | None = None
    safe_error_summary: str | None = None
    source_language: str | None = None
    output_language: str | None = None

    def to_mapping(self) -> dict[str, object]:
        return {
            "reason_summary": self.reason_summary,
            "evidence_field_refs": list(self.evidence_field_refs),
            "schema_validation_status": self.schema_validation_status,
            "failure_code": self.failure_code,
            "safe_error_summary": self.safe_error_summary,
            "source_language": self.source_language,
            "output_language": self.output_language,
        }


@dataclass(frozen=True)
class EventIntakeDecisionV1:
    trace: JsonObject
    decision: IntakeDecision
    discard_reason: DiscardReason
    quality: QualityAssessmentV1
    industry_relevance: tuple[IndustryRelevanceV1, ...]
    structured_news: StructuredNewsV1
    routing: RoutingOutcomeV1
    audit: AuditSummaryV1
    schema_version: str = EVENT_INTAKE_DECISION_SCHEMA_VERSION

    def __post_init__(self) -> None:
        object.__setattr__(self, "trace", freeze_json_mapping(self.trace, stage="publish"))
        self.validate_consistency()

    @classmethod
    def from_mapping(
        cls,
        payload: Mapping[str, Any],
        *,
        trace: Mapping[str, Any],
        context_content_completeness: ContentCompleteness | None = None,
        context_enrichment_status: EnrichmentStatus | None = None,
        review_confidence_threshold: float = 0.58,
    ) -> EventIntakeDecisionV1:
        if not isinstance(payload, Mapping):
            raise EventIntakeValidationError("Model output must be a JSON object.")
        schema_version = payload.get("schema_version")
        if schema_version not in {EVENT_INTAKE_DECISION_SCHEMA_VERSION_V1, EVENT_INTAKE_DECISION_SCHEMA_VERSION_V2}:
            raise EventIntakeValidationError("Model output schema_version is invalid.", reason_code="EVENT_INTAKE_SCHEMA_VERSION_INVALID")

        decision = _enum_value(IntakeDecision, payload.get("decision"), "decision")
        discard_reason = _parse_discard_reason(payload.get("discard_reason"), decision=decision)
        quality_payload = _mapping(payload.get("quality"), "quality")
        quality = QualityAssessmentV1(
            is_spam=_bool(quality_payload.get("is_spam"), "quality.is_spam"),
            noise_flags=_string_tuple(quality_payload.get("noise_flags"), "quality.noise_flags"),
            content_completeness=context_content_completeness
            or _enum_value(
                ContentCompleteness,
                quality_payload.get("content_completeness", ContentCompleteness.UNKNOWN.value),
                "quality.content_completeness",
            ),
            enrichment_status=context_enrichment_status
            or _enum_value(
                EnrichmentStatus,
                quality_payload.get("enrichment_status", EnrichmentStatus.UNKNOWN.value),
                "quality.enrichment_status",
            ),
            confidence=_score(quality_payload.get("confidence"), "quality.confidence"),
            reason_summary=_optional_string(quality_payload.get("reason_summary")),
            risk_flags=_string_tuple(quality_payload.get("risk_flags"), "quality.risk_flags"),
        )
        relevance_payloads = payload.get("industry_relevance", ())
        if not isinstance(relevance_payloads, tuple | list):
            raise EventIntakeValidationError("industry_relevance must be an array.")
        relevance = tuple(_parse_relevance(item) for item in relevance_payloads)
        structured_news = _parse_structured_news(_mapping(payload.get("structured_news"), "structured_news"))
        routing = _parse_routing(_mapping(payload.get("routing"), "routing"))
        audit = _parse_audit(_mapping(payload.get("audit"), "audit"))

        decision_model = cls(
            trace=trace,
            decision=decision,
            discard_reason=discard_reason,
            quality=quality,
            industry_relevance=relevance,
            structured_news=structured_news,
            routing=routing,
            audit=audit,
            schema_version=schema_version,
        )
        decision_model.validate_consistency(review_confidence_threshold=review_confidence_threshold)
        return decision_model

    def validate_consistency(self, *, review_confidence_threshold: float = 0.58) -> None:
        if self.decision == IntakeDecision.DISCARD:
            if self.discard_reason == DiscardReason.NOT_DISCARDED:
                raise EventIntakeValidationError("discard decision must include a concrete discard_reason.")
            if self.routing.requires_deep_analysis:
                raise EventIntakeValidationError("discard decision must not require deep analysis.")
        if self.decision != IntakeDecision.DISCARD and self.discard_reason != DiscardReason.NOT_DISCARDED:
            raise EventIntakeValidationError("route or review decision must use not_discarded discard_reason.")
        if self.decision == IntakeDecision.ROUTE:
            if not self.routing.target_industries:
                raise EventIntakeValidationError("route decision must include target_industries.")
            if self.schema_version == EVENT_INTAKE_DECISION_SCHEMA_VERSION_V2 and self.routing.event_score is None:
                raise EventIntakeValidationError("v2 route decision must include routing.event_score.")
            if self.schema_version == EVENT_INTAKE_DECISION_SCHEMA_VERSION_V2 and self.routing.score_breakdown is None:
                raise EventIntakeValidationError("v2 route decision must include routing.score_breakdown.")
            if not any(
                item.relationship
                in (RelevanceRelationship.DIRECT, RelevanceRelationship.INDIRECT, RelevanceRelationship.CONTEXTUAL)
                for item in self.industry_relevance
            ):
                raise EventIntakeValidationError("route decision must include a relevant industry relationship.")
        if self.decision == IntakeDecision.REVIEW:
            if not self.routing.requires_human_review and self.quality.confidence >= review_confidence_threshold:
                raise EventIntakeValidationError("review decision must express human review need or low confidence.")

    def to_mapping(self) -> JsonObject:
        return freeze_json_mapping(
            {
                "schema_version": self.schema_version,
                "trace": dict(self.trace),
                "decision": self.decision.value,
                "discard_reason": self.discard_reason.value,
                "quality": self.quality.to_mapping(),
                "industry_relevance": [item.to_mapping() for item in self.industry_relevance],
                "structured_news": self.structured_news.to_mapping(),
                "routing": self.routing.to_mapping(),
                "audit": self.audit.to_mapping(),
            },
            stage="publish",
        )


def build_review_decision(
    *,
    trace: Mapping[str, Any],
    reason_summary: str,
    failure_code: str,
    content_completeness: ContentCompleteness,
    enrichment_status: EnrichmentStatus,
    confidence: float = 0.0,
    safe_error_summary: str | None = None,
) -> EventIntakeDecisionV1:
    return EventIntakeDecisionV1(
        trace=trace,
        decision=IntakeDecision.REVIEW,
        discard_reason=DiscardReason.NOT_DISCARDED,
        quality=QualityAssessmentV1(
            is_spam=False,
            noise_flags=(failure_code,),
            content_completeness=content_completeness,
            enrichment_status=enrichment_status,
            confidence=confidence,
        ),
        industry_relevance=(),
        structured_news=StructuredNewsV1(
            canonical_title=None,
            short_summary=None,
            uncertainties=(reason_summary,),
        ),
        routing=RoutingOutcomeV1(
            target_industries=(),
            target_topics=(),
            priority=RoutingPriority.LOW,
            requires_deep_analysis=False,
            requires_human_review=True,
        ),
        audit=AuditSummaryV1(
            reason_summary=reason_summary,
            evidence_field_refs=("trace", "article", "source"),
            schema_validation_status="failed",
            failure_code=failure_code,
            safe_error_summary=safe_error_summary,
        ),
    )


def build_discard_decision(
    *,
    trace: Mapping[str, Any],
    reason: DiscardReason,
    reason_summary: str,
    content_completeness: ContentCompleteness,
    enrichment_status: EnrichmentStatus,
) -> EventIntakeDecisionV1:
    return EventIntakeDecisionV1(
        trace=trace,
        decision=IntakeDecision.DISCARD,
        discard_reason=reason,
        quality=QualityAssessmentV1(
            is_spam=reason == DiscardReason.SPAM,
            noise_flags=(reason.value,),
            content_completeness=content_completeness,
            enrichment_status=enrichment_status,
            confidence=1.0,
        ),
        industry_relevance=(),
        structured_news=StructuredNewsV1(
            canonical_title=None,
            short_summary=reason_summary,
            uncertainties=(),
        ),
        routing=RoutingOutcomeV1(
            target_industries=(),
            target_topics=(),
            priority=RoutingPriority.LOW,
            requires_deep_analysis=False,
            requires_human_review=False,
        ),
        audit=AuditSummaryV1(
            reason_summary=reason_summary,
            evidence_field_refs=("article", "source"),
            schema_validation_status="valid",
            failure_code=None,
        ),
    )


def _parse_relevance(value: object) -> IndustryRelevanceV1:
    payload = _mapping(value, "industry_relevance[]")
    return IndustryRelevanceV1(
        industry_id=_required_string(payload.get("industry_id"), "industry_relevance[].industry_id"),
        relationship=_enum_value(RelevanceRelationship, payload.get("relationship"), "industry_relevance[].relationship"),
        relevance_score=_score(payload.get("relevance_score"), "industry_relevance[].relevance_score"),
        reason_summary=_required_string(payload.get("reason_summary"), "industry_relevance[].reason_summary"),
    )


def _parse_structured_news(payload: Mapping[str, Any]) -> StructuredNewsV1:
    return StructuredNewsV1(
        canonical_title=_optional_string(payload.get("canonical_title")),
        short_summary=_optional_string(payload.get("short_summary")),
        bullet_summary=_string_tuple(payload.get("bullet_summary"), "structured_news.bullet_summary"),
        event_type=_optional_string(payload.get("event_type")),
        event_type_label=_optional_string(payload.get("event_type_label")),
        tags=_tag_tuple(payload.get("tags")),
        entities=_string_tuple(payload.get("entities"), "structured_news.entities"),
        companies=_string_tuple(payload.get("companies"), "structured_news.companies"),
        tickers=_string_tuple(payload.get("tickers"), "structured_news.tickers"),
        technologies=_string_tuple(payload.get("technologies"), "structured_news.technologies"),
        products=_string_tuple(payload.get("products"), "structured_news.products"),
        locations=_string_tuple(payload.get("locations"), "structured_news.locations"),
        numbers=_string_tuple(payload.get("numbers"), "structured_news.numbers"),
        time_horizon=_optional_string(payload.get("time_horizon")),
        source_facts=_string_tuple(payload.get("source_facts"), "structured_news.source_facts"),
        uncertainties=_string_tuple(payload.get("uncertainties"), "structured_news.uncertainties"),
    )


def _parse_routing(payload: Mapping[str, Any]) -> RoutingOutcomeV1:
    score_breakdown = _parse_score_breakdown(payload.get("score_breakdown"))
    return RoutingOutcomeV1(
        target_industries=_string_tuple(payload.get("target_industries"), "routing.target_industries"),
        target_topics=_string_tuple(payload.get("target_topics"), "routing.target_topics"),
        priority=_enum_value(RoutingPriority, payload.get("priority", RoutingPriority.NORMAL.value), "routing.priority"),
        event_score=_routing_event_score(payload.get("event_score"), score_breakdown),
        score_breakdown=score_breakdown,
        requires_deep_analysis=_bool(payload.get("requires_deep_analysis"), "routing.requires_deep_analysis"),
        requires_human_review=_bool(payload.get("requires_human_review"), "routing.requires_human_review"),
        dedupe_key_hint=_optional_string(payload.get("dedupe_key_hint")),
        reason_summary=_optional_string(payload.get("reason_summary")),
        next_step_hint=_optional_string(payload.get("next_step_hint")),
    )


def _parse_score_breakdown(value: object) -> RoutingScoreBreakdownV1 | None:
    if value is None:
        return None
    payload = _mapping(value, "routing.score_breakdown")
    return RoutingScoreBreakdownV1(
        source_quality=_score(payload.get("source_quality"), "routing.score_breakdown.source_quality"),
        information_freshness=_score(payload.get("information_freshness"), "routing.score_breakdown.information_freshness"),
        entity_specificity=_score(payload.get("entity_specificity"), "routing.score_breakdown.entity_specificity"),
        market_materiality=_score(payload.get("market_materiality"), "routing.score_breakdown.market_materiality"),
        industry_relevance=_score(payload.get("industry_relevance"), "routing.score_breakdown.industry_relevance"),
        actionability_urgency=_score(payload.get("actionability_urgency"), "routing.score_breakdown.actionability_urgency"),
        reason_summary=_optional_string(payload.get("reason_summary")),
    )


def _routing_event_score(value: object, score_breakdown: RoutingScoreBreakdownV1 | None) -> float | None:
    if score_breakdown is not None:
        return score_breakdown.weighted_event_score
    return _optional_score(value, "routing.event_score")


def _parse_audit(payload: Mapping[str, Any]) -> AuditSummaryV1:
    return AuditSummaryV1(
        reason_summary=_required_string(payload.get("reason_summary"), "audit.reason_summary"),
        evidence_field_refs=_string_tuple(payload.get("evidence_field_refs"), "audit.evidence_field_refs"),
        schema_validation_status=_required_string(payload.get("schema_validation_status"), "audit.schema_validation_status"),
        failure_code=_optional_string(payload.get("failure_code")),
        safe_error_summary=_optional_string(payload.get("safe_error_summary")),
        source_language=_optional_string(payload.get("source_language")),
        output_language=_optional_string(payload.get("output_language")),
    )


def _tag_tuple(value: object) -> tuple[dict[str, object], ...]:
    if value is None:
        return ()
    if not isinstance(value, tuple | list):
        raise EventIntakeValidationError("structured_news.tags must be an array.")
    result: list[dict[str, object]] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            result.append({"code": item.strip(), "label": item.strip()})
            continue
        if not isinstance(item, Mapping):
            raise EventIntakeValidationError("structured_news.tags contains unsupported item.")
        code = _optional_string(item.get("code"))
        label = _optional_string(item.get("label"))
        if code or label:
            result.append({"code": code or label, "label": label or code})
    return tuple(result)


def _mapping(value: object, field_name: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise EventIntakeValidationError(f"{field_name} must be an object.")
    return value


def _enum_value(enum_type: type[StrEnum], value: object, field_name: str):
    if not isinstance(value, str):
        raise EventIntakeValidationError(f"{field_name} must be a string.")
    try:
        return enum_type(value)
    except ValueError as exc:
        raise EventIntakeValidationError(f"{field_name} has unsupported value.") from exc


def _parse_discard_reason(value: object, *, decision: IntakeDecision) -> DiscardReason:
    if isinstance(value, str):
        normalized = value.strip().lower().replace("-", "_").replace(" ", "_")
    elif value is None:
        normalized = ""
    else:
        raise EventIntakeValidationError("discard_reason must be a string.")

    if normalized:
        try:
            return DiscardReason(normalized)
        except ValueError:
            pass

    # Router/review 输出经常把“没有丢弃原因”写成 null、none 或自然语言。
    # 这些不是业务分歧，按协议归一化，避免可用路由因为轻微格式错误被打入待复核。
    if decision in (IntakeDecision.ROUTE, IntakeDecision.REVIEW) and normalized in {
        "",
        "none",
        "null",
        "n/a",
        "na",
        "not_discard",
        "not_discarded",
        "not_applicable",
        "not_relevant",
        "no_discard",
    }:
        return DiscardReason.NOT_DISCARDED

    raise EventIntakeValidationError("discard_reason has unsupported value.")


def _bool(value: object, field_name: str) -> bool:
    if isinstance(value, bool):
        return value
    raise EventIntakeValidationError(f"{field_name} must be a boolean.")


def _score(value: object, field_name: str) -> float:
    if isinstance(value, int | float) and not isinstance(value, bool):
        score = float(value)
        if 0 <= score <= 1:
            return score
    raise EventIntakeValidationError(f"{field_name} must be a number between 0 and 1.")


def _optional_score(value: object, field_name: str) -> float | None:
    if value is None:
        return None
    return _score(value, field_name)


def _required_string(value: object, field_name: str) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    raise EventIntakeValidationError(f"{field_name} must be a non-empty string.")


def _optional_string(value: object) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _string_tuple(value: object, field_name: str) -> tuple[str, ...]:
    if value is None:
        return ()
    if not isinstance(value, tuple | list):
        raise EventIntakeValidationError(f"{field_name} must be an array.")
    result: list[str] = []
    for item in value:
        if not isinstance(item, str):
            raise EventIntakeValidationError(f"{field_name} contains a non-string item.")
        if item.strip():
            result.append(item.strip())
    return tuple(result)
