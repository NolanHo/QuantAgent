from __future__ import annotations

import asyncio
import gzip
import json
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from quantagent.plugin_sdk import (
    BasePlugin,
    HealthCheckResult,
    PluginInvokeRequest,
    PluginInvokeResult,
    PluginRuntimeError,
    SourceFetchInput,
    SourceFetchResult,
    SourceItemDraft,
)

TWELVE_DATA_QUOTE_URL = "https://api.twelvedata.com/quote"
_DEFAULT_UA = "QuantAgent Twelve Data Source/0.2"
_DEFAULT_TIMEOUT_SECONDS = 10
_RETRYABLE_STATUSES = frozenset({429, 500, 502, 503, 504})


def _retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    backoff_factor: float = 2.0,
) -> Callable[[Callable[..., Awaitable[Any]]], Callable[..., Awaitable[Any]]]:
    """Exponential backoff retry for HTTP 429 / 5xx / URLError."""

    def decorator(func: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
        async def wrapper(self, *args, **kwargs) -> Any:  # noqa: ANN401
            last_error: Exception | None = None
            delay = base_delay
            for attempt in range(1, max_attempts + 1):
                try:
                    return await func(self, *args, **kwargs)
                except RuntimeError as exc:
                    cause = exc.__cause__
                    if not isinstance(cause, (HTTPError, URLError)):
                        raise
                    if isinstance(cause, HTTPError) and cause.code == 429:
                        retry_after = cause.headers.get("Retry-After") if hasattr(cause, "headers") else None  # type: ignore[union-attr]
                        if retry_after is not None:
                            try:
                                delay = float(retry_after)
                            except (TypeError, ValueError):
                                pass
                    if isinstance(cause, HTTPError) and cause.code not in _RETRYABLE_STATUSES:
                        raise
                    last_error = exc
                if attempt < max_attempts:
                    await asyncio.sleep(delay)
                    delay = min(delay * backoff_factor, 30.0)
            raise RuntimeError(
                f"Twelve Data API request failed after {max_attempts} attempts"
            ) from last_error

        return wrapper

    return decorator


class TwelveDataSourcePlugin(BasePlugin):
    id = "quantagent.official.source.twelve_data"
    opener = staticmethod(urlopen)

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
            raise RuntimeError("Twelve Data source must be loaded before start.")
        self._started = True

    async def stop(self) -> None:
        self._started = False

    async def health_check(self) -> HealthCheckResult:
        return HealthCheckResult(
            status="ok",
            details={"plugin_id": self.id, "started": self._started},
        )

    async def invoke(self, request: PluginInvokeRequest) -> PluginInvokeResult:
        if request.capability != "source.fetch":
            raise PluginRuntimeError(
                code="PLUGIN_CAPABILITY_NOT_IMPLEMENTED",
                message="Twelve Data source only implements source.fetch.",
                stage="invoke",
                details={"capability": request.capability},
            )
        if not self._started:
            raise RuntimeError("Twelve Data source must be started before invoke.")

        source_input = SourceFetchInput.from_mapping(request.input)
        effective_config = self._merge_effective_config(self.context.config, request.input)
        self._validate_config(effective_config)

        api_key = self._extract_runtime_api_key(effective_config)
        if not isinstance(api_key, str) or not api_key.strip():
            raise ValueError(
                "A resolved Twelve Data API key must be present in runtime config. "
                "Use a secret reference in twelve_data_api_key_ref and let the "
                "platform resolve it before invoke."
            )

        symbols = [symbol.strip() for symbol in effective_config["symbols"]]
        timeout = self._normalize_timeout(effective_config.get("timeout_seconds"))
        market = effective_config.get("market")

        encoded = ",".join(quote(symbol, safe="") for symbol in symbols)
        url = f"{TWELVE_DATA_QUOTE_URL}?symbol={encoded}&apikey={api_key.strip()}"

        response_body = await self._call_api(url, timeout)
        raw_data = self._parse_json(response_body)
        result = self._build_fetch_result(raw_data, symbols, market, source_input)
        return PluginInvokeResult(output=result.to_mapping())

    @staticmethod
    def _merge_effective_config(
        context_config: dict[str, Any],
        request_input: dict[str, Any],
    ) -> dict[str, Any]:
        # 平台调度会在 request.input 中覆盖本次 source.fetch 的动态参数。
        return {**context_config, **request_input}

    @staticmethod
    def _normalize_timeout(timeout: Any | None) -> int:
        if isinstance(timeout, int) and timeout > 0:
            return timeout
        return _DEFAULT_TIMEOUT_SECONDS

    @staticmethod
    def _extract_runtime_api_key(config: dict[str, Any]) -> Any:
        # 兼容当前 scheduler 的 runtime secret 解引用行为：secret_ref 字段名保持不变，
        # 同时允许宿主直接注入 canonical runtime key，避免插件绑死单一路径。
        runtime_value = config.get("twelve_data_api_key")
        if runtime_value is not None:
            return runtime_value
        return config.get("twelve_data_api_key_ref")

    @_retry(max_attempts=3, base_delay=1.0, backoff_factor=2.0)
    async def _call_api(self, url: str, timeout: int) -> bytes:
        headers = {
            "User-Agent": _DEFAULT_UA,
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
        }
        request = Request(url, headers=headers)
        return await asyncio.to_thread(self._read_response, request, timeout)

    def _read_response(self, request: Request, timeout: int) -> bytes:
        try:
            with self.opener(request, timeout=timeout) as response:
                body = response.read()
                if response.headers.get("Content-Encoding") == "gzip":
                    body = gzip.decompress(body)
        except HTTPError as exc:
            msg = f"Twelve Data API returned HTTP {exc.code}: {exc.reason}"
            raise RuntimeError(msg) from exc
        except URLError as exc:
            raise RuntimeError(
                f"Twelve Data API request failed: {exc.reason}"
            ) from exc
        return body

    @staticmethod
    def _parse_json(raw: bytes) -> dict[str, Any]:
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            preview = raw[:200].decode("utf-8", errors="replace")
            raise RuntimeError(
                f"Twelve Data returned non-JSON response (first 200 chars): {preview}"
            ) from exc
        if not isinstance(parsed, dict):
            raise RuntimeError("Twelve Data response must be a JSON object.")
        return parsed

    def _build_fetch_result(
        self,
        raw_data: dict[str, Any],
        symbols: list[str],
        market: str | None,
        source_input: SourceFetchInput,
    ) -> SourceFetchResult:
        # API-level error: {"status":"error","code":400,...}
        if raw_data.get("status") == "error":
            self._handle_api_error(raw_data)
            return SourceFetchResult()  # pragma: no cover

        if len(symbols) == 1:
            by_symbol = {symbols[0]: raw_data}
        else:
            by_symbol = raw_data

        items: list[SourceItemDraft] = []
        for symbol in symbols:
            symbol_data = by_symbol.get(symbol)
            if symbol_data is None:
                continue
            if not isinstance(symbol_data, dict):
                raise RuntimeError(f"Twelve Data response for {symbol} must be a JSON object.")
            if symbol_data.get("status") == "error":
                continue
            items.append(self._symbol_to_item(symbol, symbol_data, market))

        if not items:
            raise RuntimeError(
                "Twelve Data returned no usable quote data for the requested symbols."
            )

        return SourceFetchResult(
            items=tuple(items),
            metadata={
                "source": "twelve_data",
                "requested_symbols": tuple(symbols),
                "request_query": source_input.query,
                "request_metadata": source_input.metadata,
            },
        )

    def _symbol_to_item(
        self,
        symbol: str,
        data: dict[str, Any],
        market: str | None,
    ) -> SourceItemDraft:
        price = self._extract_price(data, symbol)
        quote_timestamp = self._extract_timestamp(data)
        currency = data.get("currency")
        resolved_market = market or data.get("exchange") or data.get("market")
        captured_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        return SourceItemDraft(
            external_id=f"twelve_data:{symbol}:{quote_timestamp}",
            title=f"{symbol} @ {price}",
            content=json.dumps(data, ensure_ascii=False),
            captured_at=captured_at,
            raw_payload={
                "source_plugin_id": self.id,
                "source_type": "market_quote",
                "symbol": symbol,
                "response": data,
            },
            metadata={
                "provider": "twelve_data",
                "plugin_id": self.id,
                "source_plugin_id": self.id,
                "source_type": "market_quote",
                "symbol": symbol,
                "price": price,
                "currency": currency,
                "market": resolved_market,
                "quote_timestamp": quote_timestamp,
            },
        )

    @staticmethod
    def _extract_price(data: dict[str, Any], symbol: str) -> float:
        for key in ("close", "price", "last"):
            val = data.get(key)
            if val is not None:
                try:
                    return float(val)
                except (TypeError, ValueError):
                    pass
        hint = f"available fields: {sorted(data.keys())}" if data else "response is empty"
        raise ValueError(
            f"Twelve Data response for {symbol} missing required price field "
            f"(tried: close, price, last; {hint})."
        )

    @staticmethod
    def _extract_timestamp(data: dict[str, Any]) -> str:
        for key in ("timestamp", "datetime"):
            val = data.get(key)
            if val:
                return str(val)
        server_time = data.get("server_time")
        if server_time:
            return str(server_time)
        raise ValueError(
            "Twelve Data response missing timestamp field (tried: timestamp, datetime)"
            "; cannot construct external_id."
        )

    @staticmethod
    def _handle_api_error(raw_data: dict[str, Any]) -> None:
        status = raw_data.get("status")
        code = raw_data.get("code")
        message = raw_data.get("message", "unknown error")
        raise RuntimeError(
            f"Twelve Data API error (status={status}, code={code}): {message}"
        )

    @staticmethod
    def _validate_config(config: dict[str, Any]) -> None:
        symbols = config.get("symbols")
        if not isinstance(symbols, list | tuple) or not symbols:
            raise ValueError(
                "Twelve Data source config requires a non-empty symbols list."
            )
        if any(not isinstance(symbol, str) or not symbol.strip() for symbol in symbols):
            raise ValueError("Twelve Data source symbols must be non-empty strings.")
        timeout_seconds = config.get("timeout_seconds")
        if timeout_seconds is not None and (
            not isinstance(timeout_seconds, int)
            or isinstance(timeout_seconds, bool)
            or timeout_seconds < 1
            or timeout_seconds > 30
        ):
            raise ValueError("timeout_seconds must be an integer between 1 and 30.")
        market = config.get("market")
        if market is not None and (not isinstance(market, str) or not market.strip()):
            raise ValueError("market must be a non-empty string when provided.")


plugin = TwelveDataSourcePlugin
