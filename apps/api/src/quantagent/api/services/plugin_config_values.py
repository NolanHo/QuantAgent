from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from quantagent.api.http.errors import BadRequestError, NotFoundError, ServiceUnavailableError
from quantagent.api.schemas.plugin_config_values import (
    PluginConfigSnapshotResponse,
    PluginConfigUpdateResponse,
    PluginConfigValidateResponse,
    PluginConfigValidationIssueResponse,
)
from quantagent.api.schemas.plugin_detail import (
    PluginConfigEntryResponse,
    PluginConfigSummaryResponse,
    PluginConfigViewResponse,
    PluginDetailResponse,
)
from quantagent.core.plugin_config import (
    PluginConfigService,
    PluginConfigServiceError,
    PluginConfigSnapshotResult,
    PluginConfigUpdateResult,
    PluginConfigValidationResult,
)
from quantagent.core.registry import PluginRecord, PluginRegistry


class PluginConfigValuesApiService:
    """API 私有编排层：连接 Registry schema、core 配置服务和传输层 DTO。"""

    def __init__(self, *, registry: PluginRegistry, session: Session, encryption_key: str | None = None) -> None:
        self._registry = registry
        self._service = PluginConfigService(session, encryption_key=encryption_key)

    def get_config_values(self, plugin_id: str) -> PluginConfigSnapshotResponse:
        schema = self._require_schema(plugin_id)
        return _snapshot_response(self._service.get_snapshot(plugin_id=plugin_id, schema=schema))

    def overlay_detail(self, plugin_id: str, detail: PluginDetailResponse) -> PluginDetailResponse:
        schema = self._require_schema(plugin_id)
        snapshot = self._service.get_snapshot(plugin_id=plugin_id, schema=schema)
        detail.config_summary = _overlay_summary(detail.config_summary, snapshot)
        detail.overview.active_config_state = detail.config_summary.config_state
        return detail

    def overlay_config_view(self, plugin_id: str, view: PluginConfigViewResponse) -> PluginConfigViewResponse:
        schema = self._require_schema(plugin_id)
        snapshot = self._service.get_snapshot(plugin_id=plugin_id, schema=schema)
        return _overlay_config_view(view, snapshot)

    def validate_config(self, plugin_id: str, values: dict[str, Any]) -> PluginConfigValidateResponse:
        schema = self._require_schema(plugin_id)
        return _validation_response(self._service.validate(schema=schema, values=values))

    def update_config(self, plugin_id: str, values: dict[str, Any]) -> PluginConfigUpdateResponse:
        schema = self._require_schema(plugin_id)
        try:
            result = self._service.save(plugin_id=plugin_id, schema=schema, values=values)
        except PluginConfigServiceError as exc:
            raise _api_error(exc) from exc
        return _update_response(result)

    def resolve_secret(self, *, plugin_id: str, path: str) -> str | None:
        try:
            return self._service.resolve_secret(plugin_id=plugin_id, path=path)
        except PluginConfigServiceError as exc:
            if exc.code == "PLUGIN_CONFIG_DECRYPT_FAILED":
                return None
            raise

    def _require_schema(self, plugin_id: str) -> dict[str, Any]:
        record = self._require_plugin(plugin_id)
        if record.config_schema_path is None:
            raise BadRequestError("Plugin config schema is not available", details={"plugin": _record_details(record)})
        schema = self._registry.read_config_schema(plugin_id)
        if not isinstance(schema, dict):
            raise BadRequestError("Plugin config schema is not available", details={"plugin": _record_details(record)})
        return schema

    def _require_plugin(self, plugin_id: str) -> PluginRecord:
        record = self._registry.get_plugin(plugin_id)
        if record is None:
            raise NotFoundError("Plugin not found", details={"plugin_id": plugin_id})
        return record


def _snapshot_response(result: PluginConfigSnapshotResult) -> PluginConfigSnapshotResponse:
    return PluginConfigSnapshotResponse(
        values=result.values,
        masked_paths=result.masked_paths,
        version_tag=result.version_tag,
        updated_at=result.updated_at.isoformat() if result.updated_at else None,
        config_state=result.config_state,
        missing_required=result.missing_required,
    )


def _overlay_summary(
    summary: PluginConfigSummaryResponse,
    snapshot: PluginConfigSnapshotResult,
) -> PluginConfigSummaryResponse:
    summary.config_state = snapshot.config_state  # type: ignore[assignment]
    summary.missing_required_count = len(snapshot.missing_required)
    summary.masked_sensitive_count = len(snapshot.masked_paths)
    summary.last_updated_at = snapshot.updated_at.isoformat() if snapshot.updated_at else None
    summary.last_validated_at = snapshot.updated_at.isoformat() if snapshot.updated_at else None
    return summary


def _overlay_config_view(
    view: PluginConfigViewResponse,
    snapshot: PluginConfigSnapshotResult,
) -> PluginConfigViewResponse:
    view.config_state = snapshot.config_state  # type: ignore[assignment]
    view.last_updated_at = snapshot.updated_at.isoformat() if snapshot.updated_at else None
    view.last_validated_at = snapshot.updated_at.isoformat() if snapshot.updated_at else None
    masked = set(snapshot.masked_paths)
    next_entries: list[PluginConfigEntryResponse] = []
    for entry in view.entries:
        if entry.key in masked:
            next_entries.append(
                entry.model_copy(update={"display_mode": "masked", "display_value": "********", "is_overridden": True})
            )
            continue
        value = snapshot.values.get(entry.key)
        if value:
            next_entries.append(entry.model_copy(update={"display_mode": "plain", "display_value": value, "is_overridden": True}))
            continue
        next_entries.append(entry)
    view.entries = next_entries
    return view


def _validation_response(result: PluginConfigValidationResult) -> PluginConfigValidateResponse:
    return PluginConfigValidateResponse(
        ok=result.ok,
        issues=[PluginConfigValidationIssueResponse(path=item.path, message=item.message) for item in result.issues],
    )


def _update_response(result: PluginConfigUpdateResult) -> PluginConfigUpdateResponse:
    return PluginConfigUpdateResponse(updated_at=result.updated_at.isoformat(), version_tag=result.version_tag)


def _api_error(error: PluginConfigServiceError):
    details = dict(error.safe_details)
    details["code"] = error.code
    if error.retryable or error.code in {"PLUGIN_CONFIG_ENCRYPTION_UNAVAILABLE", "PLUGIN_CONFIG_DECRYPT_FAILED"}:
        return ServiceUnavailableError("Plugin config service unavailable", details=details)
    return BadRequestError("Plugin config request is invalid", details=details)


def _record_details(record: PluginRecord) -> dict[str, Any]:
    details: dict[str, Any] = {"id": record.id, "status": record.status.value}
    if record.last_error is not None:
        details["last_error"] = {
            "code": record.last_error.code,
            "stage": record.last_error.stage,
            "retryable": record.last_error.retryable,
        }
    return details
