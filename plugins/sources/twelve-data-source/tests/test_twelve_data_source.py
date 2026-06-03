from __future__ import annotations

import asyncio
import gzip
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import pytest


REPO_ROOT = Path(__file__).resolve().parents[4]
_SRC_ROOTS = [
    str(REPO_ROOT / "packages" / "core" / "src"),
    str(REPO_ROOT / "packages" / "plugin-sdk" / "src"),
]
for src_root_str in reversed(_SRC_ROOTS):
    if src_root_str in sys.path:
        sys.path.remove(src_root_str)
    sys.path.insert(0, src_root_str)

from quantagent.core.registry import RegistryScanner
from quantagent.core.runtime import PluginRuntimeService
from quantagent.core.registry.service import PluginRegistry
from quantagent.core.scheduling import (
    FrozenSchedulingClock,
    InMemoryPluginRunRepository,
    PluginSchedulingService,
    PluginTriggerRequest,
    PluginTriggerType,
)
from quantagent.core.source_binding import EffectiveSourceConfigComposer, SecretValueRef, SourceBindingTemplate
from quantagent.plugin_sdk import HealthCheckResult, PluginInvokeRequest, SourceFetchResult


PLUGIN_ID = "quantagent.official.source.twelve_data"

SINGLE_QUOTE_FIXTURE = {
    "symbol": "AAPL",
    "close": "185.64",
    "high": "186.10",
    "low": "184.20",
    "volume": "23456789",
    "currency": "USD",
    "exchange": "NASDAQ",
    "datetime": "2026-05-31 16:00:00",
}

BATCH_QUOTE_FIXTURE = {
    "AAPL": {
        "symbol": "AAPL",
        "close": "185.64",
        "currency": "USD",
        "exchange": "NASDAQ",
        "datetime": "2026-05-31 16:00:00",
    },
    "MSFT": {
        "symbol": "MSFT",
        "close": "420.30",
        "price": "420.30",
        "currency": "USD",
        "exchange": "NASDAQ",
        "timestamp": "1748736000",
    },
}


def _plugin_record():
    records = RegistryScanner(
        official_root=REPO_ROOT / "plugins",
        runtime_root=REPO_ROOT / "runtime" / "plugins",
    ).scan()
    return {item.id: item for item in records}[PLUGIN_ID]


def _valid_config(api_key: str = "test-api-key", symbols: list[str] | None = None, market: str | None = None) -> dict:
    payload = {
        "symbols": ["AAPL"] if symbols is None else symbols,
        "twelve_data_api_key": api_key,
    }
    if market is not None:
        payload["market"] = market
    return payload


def _load_plugin(config: dict | None = None):
    plugin, error = asyncio.run(
        PluginRuntimeService().load_plugin(
            _plugin_record(),
            request_id="req-twelve-load",
            config=config or _valid_config(),
            metadata={"origin": "twelve-data-plugin-test"},
        )
    )
    assert error is None
    assert plugin is not None
    return plugin


def _started_plugin(config: dict | None = None):
    plugin = _load_plugin(config=config)
    start_error = asyncio.run(PluginRuntimeService().start_plugin(plugin))
    assert start_error is None
    return plugin


def _stop_plugin(plugin) -> None:
    stop_error = asyncio.run(PluginRuntimeService().stop_plugin(plugin, plugin_id=PLUGIN_ID))
    assert stop_error is None


def _mock_response(body: bytes, headers: dict | None = None):
    if headers is None:
        headers = {}

    class _FakeResponse:
        def __init__(self):
            self.headers = headers

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def read(self):
            return body

    return _FakeResponse()


class _StaticScanner:
    def __init__(self, records) -> None:
        self._records = records

    def scan(self):
        return list(self._records)


class TestLifecycle:
    def test_runtime_loads_manifest_entrypoint(self):
        plugin = _load_plugin()
        try:
            assert type(plugin).__name__ == "TwelveDataSourcePlugin"
            assert plugin.id == PLUGIN_ID
        finally:
            _stop_plugin(plugin)

    def test_load_rejects_mismatched_plugin_id(self):
        plugin = _load_plugin()
        try:
            with pytest.raises(ValueError, match="plugin_id mismatch"):
                asyncio.run(
                    plugin.load(
                        plugin.context.__class__(
                            plugin_id="wrong.id",
                            plugin_version="0.2.0",
                            request_id="req-mismatch",
                            logger=plugin.context.logger,
                            config=_valid_config(),
                        )
                    )
                )
        finally:
            _stop_plugin(plugin)

    def test_invoke_requires_start(self):
        plugin = _load_plugin()
        try:
            with pytest.raises(RuntimeError, match="started before invoke"):
                asyncio.run(
                    plugin.invoke(
                        PluginInvokeRequest(capability="source.fetch", request_id="req-not-started")
                    )
                )
        finally:
            _stop_plugin(plugin)

    def test_health_check_returns_sdk_result(self):
        plugin = _started_plugin()
        try:
            result = asyncio.run(plugin.health_check())
            assert isinstance(result, HealthCheckResult)
            assert result.status == "ok"
            assert result.details["plugin_id"] == PLUGIN_ID
            assert result.details["started"] is True
        finally:
            _stop_plugin(plugin)


class TestConfigValidation:
    def test_missing_symbols_raises(self):
        plugin = _started_plugin(config={"twelve_data_api_key": "k"})
        try:
            with pytest.raises(ValueError, match="non-empty symbols"):
                asyncio.run(
                    plugin.invoke(
                        PluginInvokeRequest(capability="source.fetch", request_id="req-missing-symbols")
                    )
                )
        finally:
            _stop_plugin(plugin)

    def test_empty_symbols_raises(self):
        plugin = _started_plugin(config=_valid_config(symbols=[]))
        try:
            with pytest.raises(ValueError, match="non-empty symbols"):
                asyncio.run(
                    plugin.invoke(
                        PluginInvokeRequest(capability="source.fetch", request_id="req-empty-symbols")
                    )
                )
        finally:
            _stop_plugin(plugin)

    def test_symbol_must_be_non_empty_string(self):
        plugin = _started_plugin(config=_valid_config(symbols=["AAPL", "  "]))
        try:
            with pytest.raises(ValueError, match="non-empty strings"):
                asyncio.run(
                    plugin.invoke(
                        PluginInvokeRequest(capability="source.fetch", request_id="req-bad-symbol")
                    )
                )
        finally:
            _stop_plugin(plugin)

    def test_missing_api_key_raises(self):
        plugin = _started_plugin(config={"symbols": ["AAPL"]})
        try:
            with pytest.raises(ValueError, match="resolved Twelve Data API key"):
                asyncio.run(
                    plugin.invoke(
                        PluginInvokeRequest(capability="source.fetch", request_id="req-missing-api-key")
                    )
                )
        finally:
            _stop_plugin(plugin)

    def test_timeout_seconds_must_be_between_1_and_30(self):
        plugin = _started_plugin(config=_valid_config() | {"timeout_seconds": 31})
        try:
            with pytest.raises(ValueError, match="timeout_seconds"):
                asyncio.run(
                    plugin.invoke(
                        PluginInvokeRequest(capability="source.fetch", request_id="req-bad-timeout")
                    )
                )
        finally:
            _stop_plugin(plugin)


class TestFetchSuccess:
    def test_single_symbol_returns_one_item(self):
        plugin = _started_plugin()
        try:
            with patch.object(
                type(plugin),
                "opener",
                return_value=_mock_response(json.dumps(SINGLE_QUOTE_FIXTURE).encode("utf-8")),
            ):
                result = asyncio.run(
                    plugin.invoke(
                        PluginInvokeRequest(capability="source.fetch", request_id="req-single")
                    )
                )
            output = SourceFetchResult.from_mapping(result.output)
            assert len(output.items) == 1
            item = output.items[0]
            assert item.external_id == "twelve_data:AAPL:2026-05-31 16:00:00"
            assert item.title == "AAPL @ 185.64"
            assert item.metadata["plugin_id"] == PLUGIN_ID
            assert item.metadata["price"] == 185.64
            assert output.metadata["source"] == "twelve_data"
        finally:
            _stop_plugin(plugin)

    def test_batch_symbols_returns_multiple_items(self):
        plugin = _started_plugin(config=_valid_config(symbols=["AAPL", "MSFT"]))
        try:
            with patch.object(
                type(plugin),
                "opener",
                return_value=_mock_response(json.dumps(BATCH_QUOTE_FIXTURE).encode("utf-8")),
            ):
                result = asyncio.run(
                    plugin.invoke(
                        PluginInvokeRequest(capability="source.fetch", request_id="req-batch")
                    )
                )
            output = SourceFetchResult.from_mapping(result.output)
            assert {item.metadata["symbol"] for item in output.items} == {"AAPL", "MSFT"}
        finally:
            _stop_plugin(plugin)

    def test_market_from_request_overrides_config(self):
        plugin = _started_plugin(config=_valid_config(market="NYSE"))
        try:
            with patch.object(
                type(plugin),
                "opener",
                return_value=_mock_response(json.dumps(SINGLE_QUOTE_FIXTURE).encode("utf-8")),
            ):
                result = asyncio.run(
                    plugin.invoke(
                        PluginInvokeRequest(
                            capability="source.fetch",
                            request_id="req-market-override",
                            input={"market": "HKEX"},
                        )
                    )
                )
            output = SourceFetchResult.from_mapping(result.output)
            assert output.items[0].metadata["market"] == "HKEX"
        finally:
            _stop_plugin(plugin)

    def test_request_input_can_override_symbols(self):
        plugin = _started_plugin(config=_valid_config(symbols=["AAPL"]))
        try:
            with patch.object(
                type(plugin),
                "opener",
                return_value=_mock_response(json.dumps(BATCH_QUOTE_FIXTURE).encode("utf-8")),
            ):
                result = asyncio.run(
                    plugin.invoke(
                        PluginInvokeRequest(
                            capability="source.fetch",
                            request_id="req-request-symbols",
                            input={"symbols": ["AAPL", "MSFT"]},
                        )
                    )
                )
            output = SourceFetchResult.from_mapping(result.output)
            assert len(output.items) == 2
        finally:
            _stop_plugin(plugin)

    def test_runtime_resolved_secret_can_arrive_via_secret_ref_field(self):
        plugin = _started_plugin(
            config={
                "symbols": ["AAPL"],
                "twelve_data_api_key_ref": "runtime-resolved-secret",
            }
        )
        try:
            with patch.object(
                type(plugin),
                "opener",
                return_value=_mock_response(json.dumps(SINGLE_QUOTE_FIXTURE).encode("utf-8")),
            ):
                result = asyncio.run(
                    plugin.invoke(
                        PluginInvokeRequest(capability="source.fetch", request_id="req-secret-ref-runtime")
                    )
                )
            output = SourceFetchResult.from_mapping(result.output)
            assert output.items[0].metadata["symbol"] == "AAPL"
        finally:
            _stop_plugin(plugin)

    def test_url_encode_symbols(self):
        plugin = _started_plugin(config=_valid_config(symbols=["BRK B", "AAPL"]))
        try:
            with patch.object(
                type(plugin),
                "opener",
                return_value=_mock_response(json.dumps(BATCH_QUOTE_FIXTURE).encode("utf-8")),
            ) as mock_urlopen:
                asyncio.run(
                    plugin.invoke(
                        PluginInvokeRequest(capability="source.fetch", request_id="req-encode")
                    )
                )
            request_obj = mock_urlopen.call_args[0][0]
            url_str = request_obj.get_full_url() if hasattr(request_obj, "get_full_url") else str(request_obj)
            assert "BRK B" not in url_str
            assert "BRK%20B" in url_str
        finally:
            _stop_plugin(plugin)

    def test_gzip_response_decompressed(self):
        plugin = _started_plugin()
        try:
            compressed = gzip.compress(json.dumps(SINGLE_QUOTE_FIXTURE).encode("utf-8"))
            with patch.object(
                type(plugin),
                "opener",
                return_value=_mock_response(compressed, {"Content-Encoding": "gzip"}),
            ):
                result = asyncio.run(
                    plugin.invoke(
                        PluginInvokeRequest(capability="source.fetch", request_id="req-gzip")
                    )
                )
            output = SourceFetchResult.from_mapping(result.output)
            assert output.items[0].metadata["price"] == 185.64
        finally:
            _stop_plugin(plugin)

    def test_single_symbol_with_status_ok_not_misidentified_as_error(self):
        plugin = _started_plugin()
        try:
            payload = {
                "symbol": "AAPL",
                "status": "ok",
                "close": "185.64",
                "datetime": "2026-05-31",
            }
            with patch.object(
                type(plugin),
                "opener",
                return_value=_mock_response(json.dumps(payload).encode("utf-8")),
            ):
                result = asyncio.run(
                    plugin.invoke(
                        PluginInvokeRequest(capability="source.fetch", request_id="req-status-ok")
                    )
                )
            output = SourceFetchResult.from_mapping(result.output)
            assert output.items[0].metadata["symbol"] == "AAPL"
        finally:
            _stop_plugin(plugin)

    def test_accept_json_header_sent(self):
        plugin = _started_plugin()
        try:
            with patch.object(
                type(plugin),
                "opener",
                return_value=_mock_response(json.dumps(SINGLE_QUOTE_FIXTURE).encode("utf-8")),
            ) as mock_urlopen:
                asyncio.run(
                    plugin.invoke(
                        PluginInvokeRequest(capability="source.fetch", request_id="req-headers")
                    )
                )
            request_obj = mock_urlopen.call_args[0][0]
            headers = dict(request_obj.headers) if hasattr(request_obj, "headers") else {}
            assert headers.get("Accept") == "application/json"
        finally:
            _stop_plugin(plugin)


class TestFetchApiErrors:
    def test_http_error(self):
        from urllib.error import HTTPError

        plugin = _started_plugin()
        try:
            with patch.object(
                type(plugin),
                "opener",
                side_effect=HTTPError(
                    "https://api.twelvedata.com/quote", 429, "Too Many Requests", {}, None
                ),
            ):
                with pytest.raises(RuntimeError, match="failed after 3 attempts"):
                    asyncio.run(
                        plugin.invoke(
                            PluginInvokeRequest(capability="source.fetch", request_id="req-http-error")
                        )
                    )
        finally:
            _stop_plugin(plugin)

    def test_urllib_error_retries_then_fails(self):
        from urllib.error import URLError

        plugin = _started_plugin()
        try:
            with patch.object(
                type(plugin),
                "opener",
                side_effect=URLError("connection refused"),
            ):
                with pytest.raises(RuntimeError, match="failed after 3 attempts"):
                    asyncio.run(
                        plugin.invoke(
                            PluginInvokeRequest(capability="source.fetch", request_id="req-url-error")
                        )
                    )
        finally:
            _stop_plugin(plugin)

    def test_retry_succeeds_on_second_attempt(self):
        from urllib.error import URLError

        plugin = _started_plugin()
        try:
            with patch.object(
                type(plugin),
                "opener",
                side_effect=[
                    URLError("connection refused"),
                    _mock_response(json.dumps(SINGLE_QUOTE_FIXTURE).encode("utf-8")),
                ],
            ):
                result = asyncio.run(
                    plugin.invoke(
                        PluginInvokeRequest(capability="source.fetch", request_id="req-retry-success")
                    )
                )
            output = SourceFetchResult.from_mapping(result.output)
            assert len(output.items) == 1
        finally:
            _stop_plugin(plugin)

    def test_retry_respects_retry_after_429(self):
        from urllib.error import HTTPError

        plugin = _started_plugin()
        sleep_delays: list[float] = []

        async def _fake_sleep(delay: float) -> None:
            sleep_delays.append(delay)

        try:
            with patch.object(
                type(plugin),
                "opener",
                side_effect=HTTPError(
                    "https://api.twelvedata.com/quote", 429, "Too Many Requests", {"Retry-After": "3"}, None
                ),
            ), patch("asyncio.sleep", side_effect=_fake_sleep):
                with pytest.raises(RuntimeError):
                    asyncio.run(
                        plugin.invoke(
                            PluginInvokeRequest(capability="source.fetch", request_id="req-retry-after")
                        )
                    )
                assert sleep_delays[:2] == [3.0, 3.0]
        finally:
            _stop_plugin(plugin)

    def test_api_status_error_response(self):
        plugin = _started_plugin()
        try:
            payload = {"status": "error", "code": 400, "message": "Invalid API key"}
            with patch.object(
                type(plugin),
                "opener",
                return_value=_mock_response(json.dumps(payload).encode("utf-8")),
            ):
                with pytest.raises(RuntimeError, match="Invalid API key"):
                    asyncio.run(
                        plugin.invoke(
                            PluginInvokeRequest(capability="source.fetch", request_id="req-api-error")
                        )
                    )
        finally:
            _stop_plugin(plugin)

    def test_partial_symbol_error_still_returns_valid_items(self):
        plugin = _started_plugin(config=_valid_config(symbols=["AAPL", "MSFT"]))
        try:
            payload = {
                "AAPL": {"symbol": "AAPL", "close": "185.64", "datetime": "2026-05-31"},
                "MSFT": {"status": "error", "message": "symbol not found"},
            }
            with patch.object(
                type(plugin),
                "opener",
                return_value=_mock_response(json.dumps(payload).encode("utf-8")),
            ):
                result = asyncio.run(
                    plugin.invoke(
                        PluginInvokeRequest(capability="source.fetch", request_id="req-partial-error")
                    )
                )
            output = SourceFetchResult.from_mapping(result.output)
            assert len(output.items) == 1
            assert output.items[0].metadata["symbol"] == "AAPL"
        finally:
            _stop_plugin(plugin)

    def test_non_json_response_raises_with_preview(self):
        plugin = _started_plugin()
        try:
            html_body = b"<html><body>502 Bad Gateway</body></html>"
            with patch.object(
                type(plugin),
                "opener",
                return_value=_mock_response(html_body),
            ):
                with pytest.raises(RuntimeError, match="non-JSON response"):
                    asyncio.run(
                        plugin.invoke(
                            PluginInvokeRequest(capability="source.fetch", request_id="req-non-json")
                        )
                    )
        finally:
            _stop_plugin(plugin)

    def test_http_4xx_non_retryable_fails_immediately(self):
        from urllib.error import HTTPError

        plugin = _started_plugin()
        try:
            with patch.object(
                type(plugin),
                "opener",
                side_effect=HTTPError(
                    "https://api.twelvedata.com/quote", 403, "Forbidden", {}, None
                ),
            ):
                with pytest.raises(RuntimeError, match="HTTP 403"):
                    asyncio.run(
                        plugin.invoke(
                            PluginInvokeRequest(capability="source.fetch", request_id="req-http-403")
                        )
                )
        finally:
            _stop_plugin(plugin)


class TestSchedulerIntegration:
    def test_scheduler_resolves_env_secret_ref_and_invokes_plugin(self):
        class _PatchedRuntime(PluginRuntimeService):
            def _load_plugin_module(self, module_name: str, *, plugin_path=None):
                module = super()._load_plugin_module(module_name, plugin_path=plugin_path)
                module.TwelveDataSourcePlugin.opener = staticmethod(  # type: ignore[attr-defined]
                    lambda request, timeout=10: _mock_response(
                        json.dumps(SINGLE_QUOTE_FIXTURE).encode("utf-8")
                    )
                )
                return module

        record = _plugin_record()
        scheduler = PluginSchedulingService(
            registry=PluginRegistry(_StaticScanner([record])),
            runtime=_PatchedRuntime(),
            repository=InMemoryPluginRunRepository(),
            clock=FrozenSchedulingClock(datetime(2026, 6, 3, 8, 0, tzinfo=timezone.utc)),
        )
        snapshot = EffectiveSourceConfigComposer().compose(
            template=SourceBindingTemplate(
                source_plugin_id=PLUGIN_ID,
                required=True,
                config_override={
                    "symbols": ["AAPL"],
                    "twelve_data_api_key_ref": SecretValueRef(
                        secret_ref="env://TWELVE_DATA_TEST_API_KEY"
                    ).to_mapping(),
                },
            ),
            plugin_schema=json.loads(
                (REPO_ROOT / "plugins" / "sources" / "twelve-data-source" / "config.schema.json").read_text(
                    encoding="utf-8"
                )
            ),
        )
        env_name = "TWELVE_DATA_TEST_API_KEY"
        old_value = os.environ.get(env_name)
        os.environ[env_name] = "resolved-at-runtime"
        try:
            run = asyncio.run(
                scheduler.trigger(
                    PluginTriggerRequest(
                        plugin_id=PLUGIN_ID,
                        capability="source.fetch",
                        request_id="req-scheduler-secret",
                        trigger_type=PluginTriggerType.MANUAL,
                        effective_config=snapshot.to_mapping(),
                    )
                )
            )
        finally:
            if old_value is None:
                os.environ.pop(env_name, None)
            else:
                os.environ[env_name] = old_value

        assert run.status.value == "succeeded"
        assert run.output_summary["metadata"]["source"] == "twelve_data"
