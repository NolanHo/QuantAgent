from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from quantagent.api.auth import PLUGIN_CONFIGURE_CAPABILITY, CurrentActor, get_current_actor, require_capability, require_csrf
from quantagent.api.config.settings import Settings
from quantagent.api.db import get_db_session
from quantagent.api.http.errors import BadRequestError, NotFoundError
from quantagent.api.http.responses import ApiResponse
from quantagent.api.schemas.plugin_config_values import (
    PluginConfigSnapshotResponse,
    PluginConfigUpdateRequest,
    PluginConfigUpdateResponse,
    PluginConfigValidateRequest,
    PluginConfigValidateResponse,
)
from quantagent.api.schemas.plugin_detail import (
    PluginAuditViewResponse,
    PluginConfigViewResponse,
    PluginDependenciesViewResponse,
    PluginDetailResponse,
    PluginHealthViewResponse,
)
from quantagent.api.schemas.plugins import (
    PluginErrorResponse,
    PluginManifestResponse,
    PluginRecordResponse,
    PluginRescanResponse,
    PluginScanSummaryResponse,
    SourceBindingManifestResponse,
)
from quantagent.api.services.plugin_detail import PluginDetailApiService
from quantagent.api.services.plugin_config_values import PluginConfigValuesApiService
from quantagent.api.services.plugin_registry import find_repo_root, get_plugin_registry
from quantagent.core.registry import (
    PluginError,
    PluginManifest,
    PluginRecord,
    PluginRegistry,
    PluginScanSummary,
)


router = APIRouter(prefix="/plugins", tags=["plugins"])


@router.get("", response_model=ApiResponse[list[PluginRecordResponse]])
def list_plugins(request: Request) -> ApiResponse[list[PluginRecordResponse]]:
    """返回当前 Registry 视图中的插件列表。"""
    registry = get_plugin_registry(request)
    records = registry.list_plugins()
    return ApiResponse.success([_record_response(record) for record in records])


@router.get("/{plugin_id}", response_model=ApiResponse[PluginDetailResponse])
def get_plugin(
    plugin_id: str,
    request: Request,
    actor: CurrentActor = Depends(get_current_actor),
) -> ApiResponse[PluginDetailResponse]:
    """按插件 ID 返回结构化 detail 视图。"""
    detail = PluginDetailApiService(get_plugin_registry(request)).get_plugin_detail(plugin_id, actor)
    if detail is None:
        raise NotFoundError("Plugin not found", details={"plugin_id": plugin_id})
    detail = _overlay_detail_config_if_available(request, plugin_id, detail)
    return ApiResponse.success(detail)


@router.get("/{plugin_id}/config", response_model=ApiResponse[PluginConfigViewResponse])
def get_plugin_config(
    plugin_id: str,
    request: Request,
    actor: CurrentActor = Depends(get_current_actor),
) -> ApiResponse[PluginConfigViewResponse]:
    """返回插件 detail 的只读配置视图。"""
    config_view = PluginDetailApiService(get_plugin_registry(request)).get_plugin_config(plugin_id, actor)
    if config_view is None:
        raise NotFoundError("Plugin not found", details={"plugin_id": plugin_id})
    config_view = _overlay_config_view_if_available(request, plugin_id, config_view)
    return ApiResponse.success(config_view)


@router.get("/{plugin_id}/dependencies", response_model=ApiResponse[PluginDependenciesViewResponse])
def get_plugin_dependencies(
    plugin_id: str,
    request: Request,
    actor: CurrentActor = Depends(get_current_actor),
) -> ApiResponse[PluginDependenciesViewResponse]:
    """返回插件 detail 的依赖视图。"""
    dependencies_view = PluginDetailApiService(get_plugin_registry(request)).get_plugin_dependencies(plugin_id, actor)
    if dependencies_view is None:
        raise NotFoundError("Plugin not found", details={"plugin_id": plugin_id})
    return ApiResponse.success(dependencies_view)


@router.get("/{plugin_id}/health", response_model=ApiResponse[PluginHealthViewResponse])
def get_plugin_health(
    plugin_id: str,
    request: Request,
    actor: CurrentActor = Depends(get_current_actor),
) -> ApiResponse[PluginHealthViewResponse]:
    """返回插件中心 health 摘要。"""
    health_view = PluginDetailApiService(get_plugin_registry(request)).get_plugin_health(plugin_id, actor)
    if health_view is None:
        raise NotFoundError("Plugin not found", details={"plugin_id": plugin_id})
    return ApiResponse.success(health_view)


@router.get("/{plugin_id}/audit", response_model=ApiResponse[PluginAuditViewResponse])
def get_plugin_audit(
    plugin_id: str,
    request: Request,
    actor: CurrentActor = Depends(get_current_actor),
) -> ApiResponse[PluginAuditViewResponse]:
    """返回插件中心 audit 摘要。"""
    audit_view = PluginDetailApiService(get_plugin_registry(request)).get_plugin_audit(plugin_id, actor)
    if audit_view is None:
        raise NotFoundError("Plugin not found", details={"plugin_id": plugin_id})
    return ApiResponse.success(audit_view)


@router.get("/{plugin_id}/config-schema", response_model=ApiResponse[dict[str, Any]])
def get_plugin_config_schema(plugin_id: str, request: Request) -> ApiResponse[dict[str, Any]]:
    """返回插件 manifest 引用的配置 JSON Schema。"""
    registry = get_plugin_registry(request)
    record = _require_plugin(registry, plugin_id)
    if record.config_schema_path is None:
        raise BadRequestError(
            "Plugin config schema is not available",
            details={"plugin": _record_error_details(record)},
        )

    schema = registry.read_config_schema(plugin_id)
    if schema is None:
        raise BadRequestError(
            "Plugin config schema is not available",
            details={"plugin": _record_error_details(record)},
        )
    return ApiResponse.success(schema)


@router.get(
    "/{plugin_id}/config-values",
    response_model=ApiResponse[PluginConfigSnapshotResponse],
    dependencies=[Depends(require_capability(PLUGIN_CONFIGURE_CAPABILITY))],
)
def get_plugin_config_values(
    plugin_id: str,
    request: Request,
    session: Session = Depends(get_db_session),
) -> ApiResponse[PluginConfigSnapshotResponse]:
    """返回 schema-driven form 使用的真实配置值快照。"""
    return ApiResponse.success(_config_values_service(request, session).get_config_values(plugin_id))


@router.post(
    "/{plugin_id}/config:validate",
    response_model=ApiResponse[PluginConfigValidateResponse],
    dependencies=[Depends(require_capability(PLUGIN_CONFIGURE_CAPABILITY))],
)
def validate_plugin_config_values(
    plugin_id: str,
    payload: PluginConfigValidateRequest,
    request: Request,
    session: Session = Depends(get_db_session),
) -> ApiResponse[PluginConfigValidateResponse]:
    """校验配置草稿，不写入持久化配置。"""
    return ApiResponse.success(_config_values_service(request, session).validate_config(plugin_id, payload.values))


@router.put(
    "/{plugin_id}/config-values",
    response_model=ApiResponse[PluginConfigUpdateResponse],
    dependencies=[Depends(require_capability(PLUGIN_CONFIGURE_CAPABILITY))],
)
def update_plugin_config_values(
    plugin_id: str,
    payload: PluginConfigUpdateRequest,
    request: Request,
    session: Session = Depends(get_db_session),
    _actor: CurrentActor = Depends(require_csrf),
) -> ApiResponse[PluginConfigUpdateResponse]:
    """保存真实插件配置值；敏感字段由 core service 加密。"""
    result = _config_values_service(request, session).update_config(plugin_id, payload.values)
    session.commit()
    return ApiResponse.success(result)


@router.post("/actions/rescan", response_model=ApiResponse[PluginRescanResponse])
def rescan_plugins(
    request: Request,
    _actor: CurrentActor = Depends(require_csrf),
) -> ApiResponse[PluginRescanResponse]:
    """重新扫描插件目录；作为写动作，需要登录态和 CSRF。"""
    registry = get_plugin_registry(request)
    summary = registry.rescan()
    records = registry.list_plugins()
    return ApiResponse.success(
        PluginRescanResponse(
            summary=_summary_response(summary),
            plugins=[_record_response(record) for record in records],
        )
    )


def _require_plugin(registry: PluginRegistry, plugin_id: str) -> PluginRecord:
    """查询插件并把 core 的 None 结果映射成 API 层 404。"""
    record = registry.get_plugin(plugin_id)
    if record is None:
        raise NotFoundError("Plugin not found", details={"plugin_id": plugin_id})
    return record


def _config_values_service(request: Request, session: Session) -> PluginConfigValuesApiService:
    settings = getattr(request.app.state, "settings", None)
    encryption_key = settings.MODEL_CONFIG_ENCRYPTION_KEY if isinstance(settings, Settings) else None
    return PluginConfigValuesApiService(
        registry=get_plugin_registry(request),
        session=session,
        encryption_key=encryption_key,
    )


def _overlay_detail_config_if_available(
    request: Request,
    plugin_id: str,
    detail: PluginDetailResponse,
) -> PluginDetailResponse:
    session_factory = getattr(request.app.state, "db_session_factory", None)
    if session_factory is None:
        return detail
    session = session_factory()
    try:
        return _config_values_service(request, session).overlay_detail(plugin_id, detail)
    finally:
        session.close()


def _overlay_config_view_if_available(
    request: Request,
    plugin_id: str,
    view: PluginConfigViewResponse,
) -> PluginConfigViewResponse:
    session_factory = getattr(request.app.state, "db_session_factory", None)
    if session_factory is None:
        return view
    session = session_factory()
    try:
        return _config_values_service(request, session).overlay_config_view(plugin_id, view)
    finally:
        session.close()


def _record_response(record: PluginRecord) -> PluginRecordResponse:
    """把 core PluginRecord 转成 API 响应 DTO。"""
    # API DTO 是传输层契约，避免把 core dataclass 或本地绝对路径直接暴露出去。
    return PluginRecordResponse(
        id=record.id,
        source=record.source.value,
        path=_display_path(record.path),
        status=record.status.value,
        manifest=_manifest_response(record.manifest) if record.manifest is not None else None,
        last_error=_error_response(record.last_error) if record.last_error is not None else None,
    )


def _manifest_response(manifest: PluginManifest) -> PluginManifestResponse:
    return PluginManifestResponse(
        id=manifest.id,
        name=manifest.name,
        type=manifest.type.value,
        version=manifest.version,
        entrypoint=manifest.entrypoint,
        capabilities=list(manifest.capabilities),
        config_schema=manifest.config_schema,
        description=manifest.description,
        permissions=list(manifest.permissions),
        dependencies=dict(manifest.dependencies),
        source_bindings=[
            SourceBindingManifestResponse(
                source_plugin_id=item.source_plugin_id,
                required=item.required,
                config_template=item.config_template,
            )
            for item in manifest.source_bindings
        ],
    )


def _error_response(error: PluginError) -> PluginErrorResponse:
    return PluginErrorResponse(
        code=error.code,
        message=error.message,
        stage=error.stage,
        details=dict(error.details),
        retryable=error.retryable,
    )


def _summary_response(summary: PluginScanSummary) -> PluginScanSummaryResponse:
    return PluginScanSummaryResponse(
        total=summary.total,
        valid=summary.valid,
        invalid=summary.invalid,
        failed=summary.failed,
        sources=dict(summary.sources),
    )


def _record_error_details(record: PluginRecord) -> dict[str, Any]:
    details: dict[str, Any] = {
        "id": record.id,
        "status": record.status.value,
    }
    if record.last_error is not None:
        details["last_error"] = {
            "code": record.last_error.code,
            "stage": record.last_error.stage,
            "retryable": record.last_error.retryable,
        }
    return details


def _display_path(path: Path) -> str:
    repo_root = find_repo_root()
    try:
        return path.resolve().relative_to(repo_root).as_posix()
    except (OSError, RuntimeError, ValueError):
        return path.name
