from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PluginConfigSnapshotResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    values: dict[str, str] = Field(default_factory=dict)
    masked_paths: list[str] = Field(default_factory=list)
    version_tag: str | None = None
    updated_at: str | None = None
    config_state: str
    missing_required: list[str] = Field(default_factory=list)


class PluginConfigValidateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    values: dict[str, Any] = Field(default_factory=dict)


class PluginConfigValidationIssueResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str
    message: str


class PluginConfigValidateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool
    issues: list[PluginConfigValidationIssueResponse] = Field(default_factory=list)


class PluginConfigUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    values: dict[str, Any] = Field(default_factory=dict)


class PluginConfigUpdateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    updated_at: str
    version_tag: str
