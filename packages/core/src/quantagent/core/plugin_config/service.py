from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from quantagent.core.db.models.plugin_config import PluginConfigORM
from quantagent.core.db.repositories.plugin_config_repository import PluginConfigRepository
from quantagent.core.model_config import ModelConfigCrypto, ModelConfigCryptoError


MASKED_SECRET_VALUE = "********"
_SENSITIVE_TOKENS = ("secret", "token", "password", "webhook", "api_key", "apikey", "private_key")


class PluginConfigServiceError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        code: str,
        safe_details: dict[str, Any] | None = None,
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.safe_details = safe_details or {}
        self.retryable = retryable


@dataclass(frozen=True)
class PluginConfigIssue:
    path: str
    message: str


@dataclass(frozen=True)
class PluginConfigValidationResult:
    ok: bool
    issues: list[PluginConfigIssue]


@dataclass(frozen=True)
class PluginConfigSnapshotResult:
    plugin_id: str
    values: dict[str, str]
    masked_paths: list[str]
    version_tag: str | None
    updated_at: datetime | None
    config_state: str
    missing_required: list[str]


@dataclass(frozen=True)
class PluginConfigUpdateResult:
    plugin_id: str
    updated_at: datetime
    version_tag: str


class PluginConfigService:
    def __init__(self, session: Session, *, encryption_key: str | None = None) -> None:
        self._session = session
        self._repo = PluginConfigRepository(session)
        self._encryption_key = encryption_key

    def get_snapshot(self, *, plugin_id: str, schema: Mapping[str, Any]) -> PluginConfigSnapshotResult:
        row = self._repo.get(plugin_id)
        if row is None:
            required = _required_paths(schema)
            defaults = _default_value_map(schema)
            return PluginConfigSnapshotResult(
                plugin_id=plugin_id,
                values=defaults,
                masked_paths=[],
                version_tag=None,
                updated_at=None,
                config_state="missing_required" if required else "not_configured",
                missing_required=required,
            )

        values = _stringify_values(dict(row.values or {}), schema)
        masked_paths = [path for path in row.masked_paths or [] if isinstance(path, str)]
        for path in masked_paths:
            values[path] = MASKED_SECRET_VALUE
        missing = _missing_required_paths(schema, values, masked_paths)
        return PluginConfigSnapshotResult(
            plugin_id=plugin_id,
            values=values,
            masked_paths=masked_paths,
            version_tag=row.version_tag,
            updated_at=row.updated_at,
            config_state="valid" if not missing else "missing_required",
            missing_required=missing,
        )

    def validate(self, *, schema: Mapping[str, Any], values: Mapping[str, Any]) -> PluginConfigValidationResult:
        issues = _validate_values(schema, values, existing_masked_paths=[])
        return PluginConfigValidationResult(ok=not issues, issues=issues)

    def save(self, *, plugin_id: str, schema: Mapping[str, Any], values: Mapping[str, Any]) -> PluginConfigUpdateResult:
        existing = self._repo.get(plugin_id)
        existing_masked_paths = [path for path in (existing.masked_paths if existing else []) if isinstance(path, str)]
        issues = _validate_values(schema, values, existing_masked_paths=existing_masked_paths)
        if issues:
            raise PluginConfigServiceError(
                "Plugin config validation failed",
                code="PLUGIN_CONFIG_VALIDATION_FAILED",
                safe_details={"issues": [issue.__dict__ for issue in issues]},
            )

        sanitized_values: dict[str, object] = {}
        encrypted_values: dict[str, object] = dict(existing.encrypted_values or {}) if existing else {}
        masked_paths: list[str] = []
        crypto = None
        for path, field_schema in _schema_fields(schema).items():
            if _is_sensitive(path, field_schema):
                raw_value = values.get(path)
                if raw_value == MASKED_SECRET_VALUE and path in encrypted_values:
                    masked_paths.append(path)
                    continue
                text = _clean_string(raw_value)
                if not text:
                    continue
                crypto = crypto or self._crypto()
                encrypted_values[path] = crypto.encrypt(text)
                masked_paths.append(path)
                continue
            if path in values:
                sanitized_values[path] = _coerce_value(values[path], field_schema, path=path)

        required_missing = _missing_required_paths(schema, _stringify_values(sanitized_values, schema), masked_paths)
        if required_missing:
            raise PluginConfigServiceError(
                "Plugin config required fields are missing",
                code="PLUGIN_CONFIG_MISSING_REQUIRED",
                safe_details={"missing_required": required_missing},
            )

        now = datetime.now(UTC)
        if existing is None:
            row = PluginConfigORM(
                plugin_id=plugin_id,
                values=sanitized_values,
                encrypted_values=encrypted_values,
                masked_paths=sorted(set(masked_paths)),
                version_tag=_version_tag(now),
                updated_at=now,
                created_at=now,
            )
        else:
            row = existing
            row.values = sanitized_values
            row.encrypted_values = encrypted_values
            row.masked_paths = sorted(set(masked_paths))
            row.version_tag = _version_tag(now)
            row.updated_at = now
            row.last_error = None
        self._repo.save(row)
        return PluginConfigUpdateResult(plugin_id=plugin_id, updated_at=row.updated_at, version_tag=row.version_tag)

    def resolve_secret(self, *, plugin_id: str, path: str) -> str | None:
        row = self._repo.get(plugin_id)
        if row is None:
            return None
        encrypted = (row.encrypted_values or {}).get(path)
        if not isinstance(encrypted, str) or not encrypted:
            return None
        try:
            return self._crypto().decrypt(encrypted)
        except ModelConfigCryptoError as exc:
            raise PluginConfigServiceError(
                "Plugin config secret cannot be decrypted",
                code="PLUGIN_CONFIG_DECRYPT_FAILED",
                safe_details={"plugin_id": plugin_id, "path": path},
                retryable=True,
            ) from exc

    def _crypto(self) -> ModelConfigCrypto:
        try:
            return ModelConfigCrypto(self._encryption_key)
        except ModelConfigCryptoError as exc:
            raise PluginConfigServiceError(
                "Plugin config encryption is not configured",
                code="PLUGIN_CONFIG_ENCRYPTION_UNAVAILABLE",
                retryable=True,
            ) from exc


def _schema_fields(schema: Mapping[str, Any]) -> dict[str, Mapping[str, Any]]:
    properties = schema.get("properties")
    if not isinstance(properties, Mapping):
        return {}
    return {key: value for key, value in properties.items() if isinstance(key, str) and isinstance(value, Mapping)}


def _required_paths(schema: Mapping[str, Any]) -> list[str]:
    required = schema.get("required")
    if not isinstance(required, list):
        return []
    fields = _schema_fields(schema)
    return [item for item in required if isinstance(item, str) and item in fields]


def _missing_required_paths(schema: Mapping[str, Any], values: Mapping[str, str], masked_paths: list[str]) -> list[str]:
    masked = set(masked_paths)
    missing: list[str] = []
    for path in _required_paths(schema):
        if path in masked:
            continue
        if not _clean_string(values.get(path)):
            missing.append(path)
    return missing


def _default_value_map(schema: Mapping[str, Any]) -> dict[str, str]:
    values: dict[str, str] = {}
    for path, field_schema in _schema_fields(schema).items():
        if "default" in field_schema:
            values[path] = _stringify(field_schema["default"])
    return values


def _stringify_values(values: Mapping[str, Any], schema: Mapping[str, Any]) -> dict[str, str]:
    output = _default_value_map(schema)
    for path, value in values.items():
        if isinstance(path, str):
            output[path] = _stringify(value)
    return output


def _validate_values(
    schema: Mapping[str, Any],
    values: Mapping[str, Any],
    *,
    existing_masked_paths: list[str],
) -> list[PluginConfigIssue]:
    issues: list[PluginConfigIssue] = []
    fields = _schema_fields(schema)
    unknown = sorted(key for key in values if key not in fields)
    for path in unknown:
        issues.append(PluginConfigIssue(path=str(path), message="未知配置字段。"))
    for path, field_schema in fields.items():
        raw_value = values.get(path)
        if _is_sensitive(path, field_schema) and raw_value == MASKED_SECRET_VALUE and path in existing_masked_paths:
            continue
        if path in _required_paths(schema) and not _clean_string(raw_value):
            issues.append(PluginConfigIssue(path=path, message="该字段为必填。"))
            continue
        if not _clean_string(raw_value):
            continue
        try:
            coerced = _coerce_value(raw_value, field_schema, path=path)
        except ValueError as exc:
            issues.append(PluginConfigIssue(path=path, message=str(exc)))
            continue
        enum_values = field_schema.get("enum")
        if isinstance(enum_values, list) and coerced not in enum_values:
            issues.append(PluginConfigIssue(path=path, message="该字段必须使用允许的选项。"))
    return issues


def _coerce_value(value: Any, field_schema: Mapping[str, Any], *, path: str) -> object:
    field_type = field_schema.get("type")
    if isinstance(field_type, list):
        field_type = next((item for item in field_type if item != "null"), "string")
    if field_type == "integer":
        try:
            coerced = int(str(value))
        except (TypeError, ValueError) as exc:
            raise ValueError("该字段需要整数。") from exc
        _validate_number_constraints(coerced, field_schema)
        return coerced
    if field_type == "number":
        try:
            coerced = float(str(value))
        except (TypeError, ValueError) as exc:
            raise ValueError("该字段需要数字。") from exc
        _validate_number_constraints(coerced, field_schema)
        return coerced
    if field_type == "boolean":
        if isinstance(value, bool):
            return value
        normalized = str(value).strip().lower()
        if normalized in {"true", "1", "yes"}:
            return True
        if normalized in {"false", "0", "no"}:
            return False
        raise ValueError("该字段需要布尔值。")
    if field_type not in {"string", None}:
        raise ValueError(f"暂不支持字段类型：{field_type}")
    text = _clean_string(value)
    min_length = field_schema.get("minLength")
    if isinstance(min_length, int) and len(text) < min_length:
        raise ValueError(f"该字段长度不能小于 {min_length}。")
    return text


def _validate_number_constraints(value: int | float, field_schema: Mapping[str, Any]) -> None:
    minimum = field_schema.get("minimum")
    if isinstance(minimum, int | float) and value < minimum:
        raise ValueError(f"该字段不能小于 {minimum}。")
    exclusive_minimum = field_schema.get("exclusiveMinimum")
    if isinstance(exclusive_minimum, int | float) and value <= exclusive_minimum:
        raise ValueError(f"该字段必须大于 {exclusive_minimum}。")
    maximum = field_schema.get("maximum")
    if isinstance(maximum, int | float) and value > maximum:
        raise ValueError(f"该字段不能大于 {maximum}。")


def _is_sensitive(path: str, field_schema: Mapping[str, Any]) -> bool:
    if field_schema.get("sensitive") is True:
        return True
    normalized = path.lower()
    return any(token in normalized for token in _SENSITIVE_TOKENS)


def _clean_string(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _version_tag(now: datetime) -> str:
    return f"plugin-config-{int(now.timestamp() * 1000)}"
