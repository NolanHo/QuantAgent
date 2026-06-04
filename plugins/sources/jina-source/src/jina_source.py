from __future__ import annotations

import gzip
import json
import os
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from quantagent.plugin_sdk import BasePlugin, PluginInvokeRequest, PluginInvokeResult, PluginRuntimeError
from quantagent.plugin_sdk.io import (
    SourceFetchInput,
    SourceFetchResult,
    SourceItemDraft,
    dto_validation_error,
)

JINA_READER_URL = "https://r.jina.ai/"
_DEFAULT_UA = "QuantAgent Jina Reader/0.1"
_DEFAULT_TIMEOUT_SECONDS = 20


class JinaSourcePlugin(BasePlugin):
    id = "quantagent.official.source.jina"

    def __init__(self) -> None:
        super().__init__()
        self._started = False

    async def load(self, context) -> None:
        await super().load(context)
        if context.plugin_id != self.id:
            raise ValueError(
                f"runtime context plugin_id mismatch: {context.plugin_id}"
            )

    async def start(self) -> None:
        if self._context is None:
            raise RuntimeError("Plugin must be loaded before start.")
        self._started = True

    async def stop(self) -> None:
        self._started = False

    async def health_check(self):
        from quantagent.plugin_sdk import HealthCheckResult

        return HealthCheckResult(status="ok", details={"plugin_id": self.id})

    async def invoke(self, request: PluginInvokeRequest) -> PluginInvokeResult:
        if request.capability != "source.fetch":
            raise PluginRuntimeError(
                code="PLUGIN_CAPABILITY_NOT_IMPLEMENTED",
                message=f"Unsupported capability: {request.capability}",
                stage="invoke",
                details={"capability": request.capability},
            )

        if not self._started:
            raise RuntimeError("Plugin must be started before invoke.")

        config = self.context.config
        self._validate_config(config)

        if config.get("allow_external_reader") is False:
            raise PluginRuntimeError(
                code="PLUGIN_EXTERNAL_READER_NOT_ALLOWED",
                message="Platform policy denied external reader access.",
                stage="invoke",
                retryable=False,
            )

        api_key = self._resolve_api_key(config)
        if not api_key:
            raise PluginRuntimeError(
                code="PLUGIN_EXTERNAL_READER_API_KEY_MISSING",
                message=(
                    "Jina API key is required to call the external reader. "
                    "Provide it through the JINA_API_KEY environment variable "
                    "or secure runtime metadata."
                ),
                stage="invoke",
                retryable=False,
            )

        source_input = SourceFetchInput.from_mapping(request.input)
        url = config["url"]
        timeout = self._normalize_timeout(config.get("timeout_seconds"))

        jina_response = self._call_jina_reader(url, api_key, timeout)
        item = self._build_source_item(url, jina_response, source_input)

        result = SourceFetchResult(
            items=(item,),
            metadata={
                "reader": "jina",
                "source_url": url,
                "request_metadata": source_input.metadata,
                "context_metadata": self.context.metadata,
            },
        )
        return PluginInvokeResult(output=result.to_mapping())

    def _resolve_api_key(self, config: dict[str, Any]) -> str | None:
        metadata_key = self.context.metadata.get("jina_api_key")
        if metadata_key:
            return str(metadata_key)
        return os.environ.get("JINA_API_KEY")

    def _validate_config(self, config: dict[str, Any]) -> None:
        url = config.get("url")
        if not isinstance(url, str) or not url.strip():
            raise dto_validation_error(
                "Jina Reader config requires a non-empty url.",
                field_name="url",
            )

        timeout_seconds = config.get("timeout_seconds")
        if timeout_seconds is not None:
            if not isinstance(timeout_seconds, int) or timeout_seconds < 1:
                raise dto_validation_error(
                    "timeout_seconds must be a positive integer.",
                    field_name="timeout_seconds",
                )

    def _normalize_timeout(self, timeout: Any | None) -> int:
        if isinstance(timeout, int) and timeout > 0:
            return timeout
        return _DEFAULT_TIMEOUT_SECONDS

    def _call_jina_reader(self, url: str, api_key: str, timeout: int) -> dict[str, Any]:
        payload = json.dumps({"url": url}).encode("utf-8")
        request = Request(
            JINA_READER_URL,
            data=payload,
            headers={
                "User-Agent": _DEFAULT_UA,
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            method="POST",
        )

        try:
            with urlopen(request, timeout=timeout) as response:
                body = response.read()
                if response.headers.get("Content-Encoding") == "gzip":
                    body = gzip.decompress(body)
        except HTTPError as exc:
            body = exc.read() if hasattr(exc, "read") else b""
            message = body.decode("utf-8", errors="replace").strip()
            status_code = exc.code if isinstance(exc.code, int) else None
            raise PluginRuntimeError(
                code="PLUGIN_EXTERNAL_READER_FAILED",
                message=(
                    f"Jina Reader returned HTTP {exc.code}: {exc.reason}. "
                    f"{message}"
                ).strip(),
                stage="invoke",
                retryable=bool(status_code is not None and 500 <= status_code < 600),
                details={"status_code": exc.code},
            ) from exc
        except URLError as exc:
            raise PluginRuntimeError(
                code="PLUGIN_EXTERNAL_READER_FAILED",
                message=f"Jina Reader request failed: {exc.reason}",
                stage="invoke",
                retryable=True,
                details={"error_type": exc.__class__.__name__},
            ) from exc

        try:
            data = json.loads(body)
        except json.JSONDecodeError as exc:
            preview = body[:300].decode("utf-8", errors="replace")
            raise PluginRuntimeError(
                code="PLUGIN_EXTERNAL_READER_FAILED",
                message=(
                    "Jina Reader returned invalid JSON response."
                    f" Preview: {preview}"
                ),
                stage="invoke",
                retryable=False,
            ) from exc

        if not isinstance(data, dict):
            raise PluginRuntimeError(
                code="PLUGIN_EXTERNAL_READER_FAILED",
                message="Jina Reader response is not a valid JSON object.",
                stage="invoke",
                retryable=False,
            )
        return data

    def _build_source_item(
        self,
        url: str,
        jina_response: dict[str, Any],
        source_input: SourceFetchInput,
    ) -> SourceItemDraft:
        data = jina_response.get("data")
        if not isinstance(data, dict):
            raise PluginRuntimeError(
                code="PLUGIN_EXTERNAL_READER_FAILED",
                message="Jina Reader response missing expected data payload.",
                stage="invoke",
                retryable=False,
            )

        title = self._extract_string(data, "title") or url
        content = self._extract_content(data)
        if content is None:
            raise PluginRuntimeError(
                code="PLUGIN_EXTERNAL_READER_FAILED",
                message="Jina Reader response did not contain readable content.",
                stage="invoke",
                retryable=False,
            )

        author = self._extract_string(data, "author")
        published_at = self._extract_string(data, "published_at")
        if published_at is None:
            published_at = self._extract_string(data, "publishedAt")

        external_id = self._build_external_id(url)
        captured_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        metadata: dict[str, Any] = {
            "reader": "jina",
            "source_url": url,
            "content_format": self._guess_content_format(data),
            "request_metadata": source_input.metadata,
            "context_metadata": self.context.metadata,
        }

        return SourceItemDraft(
            external_id=external_id,
            url=url,
            title=title,
            content=content,
            author=author,
            published_at=published_at,
            captured_at=captured_at,
            raw_payload={"response": data},
            metadata=metadata,
        )

    def _build_external_id(self, url: str) -> str:
        import hashlib

        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()
        return f"jina_reader:{digest}"

    def _extract_string(self, data: dict[str, Any], key: str) -> str | None:
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        return None

    def _extract_content(self, data: dict[str, Any]) -> str | None:
        candidate = data.get("content")
        if candidate is not None:
            return self._normalize_text(candidate)

        candidate = data.get("text")
        if candidate is not None:
            return self._normalize_text(candidate)

        candidate = data.get("markdown")
        if candidate is not None:
            return self._normalize_text(candidate)

        return None

    def _guess_content_format(self, data: dict[str, Any]) -> str:
        if "markdown" in data:
            return "markdown"
        if "html" in data:
            return "html"
        return "text"

    def _normalize_text(self, value: Any) -> str | None:
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, list):
            segments = [self._normalize_text(item) for item in value]
            segments = [segment for segment in segments if segment]
            return "\n\n".join(segments) if segments else None
        if isinstance(value, dict):
            nested = self._normalize_text(value.get("content") or value.get("text") or value.get("markdown"))
            return nested
        return None


plugin = JinaSourcePlugin
