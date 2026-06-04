from __future__ import annotations

import asyncio
import gzip
import json
import logging
import os
import sys
from pathlib import Path
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

# Ensure the plugin source directory is importable during tests.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from quantagent.plugin_sdk import PluginInvokeRequest, PluginRuntimeError
from quantagent.plugin_sdk.runtime import RuntimeContext
from quantagent.plugin_sdk.io import SourceFetchInput

from jina_source import JINA_READER_URL, JinaSourcePlugin


class JinaSourcePluginTestCase(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.plugin = JinaSourcePlugin()
        self.context = RuntimeContext(
            plugin_id=self.plugin.id,
            plugin_version="0.1.0",
            request_id="req-1",
            logger=logging.getLogger("test"),
            config={"url": "https://example.com/article"},
            metadata={"trace_id": "test-trace"},
        )
        await self.plugin.load(self.context)

    async def test_load_rejects_wrong_plugin_id(self) -> None:
        plugin = JinaSourcePlugin()
        with self.assertRaises(ValueError):
            await plugin.load(
                RuntimeContext(
                    plugin_id="wrong.id",
                    plugin_version="0.1.0",
                    request_id="req-2",
                    logger=logging.getLogger("test"),
                )
            )

    async def test_invoke_requires_start(self) -> None:
        request = PluginInvokeRequest(capability="source.fetch", request_id="req-3")
        with self.assertRaises(RuntimeError):
            await self.plugin.invoke(request)

    async def test_invoke_rejects_external_reader_disabled(self) -> None:
        plugin = JinaSourcePlugin()
        context = RuntimeContext(
            plugin_id=plugin.id,
            plugin_version="0.1.0",
            request_id="req-4",
            logger=logging.getLogger("test"),
            config={"url": "https://example.com/article", "allow_external_reader": False},
        )
        await plugin.load(context)
        await plugin.start()

        request = PluginInvokeRequest(capability="source.fetch", request_id="req-4")
        with self.assertRaises(PluginRuntimeError) as raised:
            await plugin.invoke(request)

        self.assertEqual(raised.exception.code, "PLUGIN_EXTERNAL_READER_NOT_ALLOWED")
        self.assertFalse(raised.exception.retryable)

    async def test_invoke_rejects_missing_api_key(self) -> None:
        plugin = JinaSourcePlugin()
        context = RuntimeContext(
            plugin_id=plugin.id,
            plugin_version="0.1.0",
            request_id="req-5",
            logger=logging.getLogger("test"),
            config={"url": "https://example.com/article"},
        )
        await plugin.load(context)
        await plugin.start()

        request = PluginInvokeRequest(capability="source.fetch", request_id="req-5")
        with self.assertRaises(PluginRuntimeError) as raised:
            await plugin.invoke(request)

        self.assertEqual(raised.exception.code, "PLUGIN_EXTERNAL_READER_API_KEY_MISSING")
        self.assertFalse(raised.exception.retryable)

    async def test_invoke_constructs_source_item_from_jina_response(self) -> None:
        await self.plugin.start()
        self.plugin._resolve_api_key = lambda config: "fake-key"
        self.plugin._call_jina_reader = lambda url, api_key, timeout: {
            "data": {
                "title": "Example article",
                "content": "This is the extracted content.",
                "author": "Author Name",
                "published_at": "2026-06-01T12:00:00Z",
                "html": "<p>Example</p>",
            }
        }

        request = PluginInvokeRequest(capability="source.fetch", request_id="req-6", input={"query": "test"})
        result = await self.plugin.invoke(request)

        self.assertEqual(result.output["items"][0]["title"], "Example article")
        self.assertEqual(result.output["items"][0]["content"], "This is the extracted content.")
        self.assertEqual(result.output["items"][0]["url"], "https://example.com/article")
        self.assertEqual(result.output["metadata"]["reader"], "jina")

    async def test_invalid_jina_payload_raises_runtime_error(self) -> None:
        await self.plugin.start()
        self.plugin._resolve_api_key = lambda config: "fake-key"
        self.plugin._call_jina_reader = lambda url, api_key, timeout: {"unexpected": "payload"}

        request = PluginInvokeRequest(capability="source.fetch", request_id="req-7")
        with self.assertRaises(PluginRuntimeError) as raised:
            await self.plugin.invoke(request)

        self.assertEqual(raised.exception.code, "PLUGIN_EXTERNAL_READER_FAILED")

    async def test_source_fetch_input_is_parsed_from_request_input(self) -> None:
        await self.plugin.start()
        self.plugin._resolve_api_key = lambda config: "fake-key"
        self.plugin._call_jina_reader = lambda url, api_key, timeout: {
            "data": {
                "title": "Example article",
                "text": "Extracted text content.",
            }
        }

        request_input = {"query": "history", "limit": 2, "metadata": {"source": "web"}}
        request = PluginInvokeRequest(capability="source.fetch", request_id="req-8", input=request_input)
        result = await self.plugin.invoke(request)

        self.assertEqual(result.output["items"][0]["content"], "Extracted text content.")
        self.assertEqual(result.output["metadata"]["request_metadata"], request_input["metadata"])

    async def test_resolve_api_key_prefers_runtime_metadata(self) -> None:
        self.assertEqual(self.plugin._resolve_api_key(self.context.config), None)

        plugin = JinaSourcePlugin()
        context = RuntimeContext(
            plugin_id=plugin.id,
            plugin_version="0.1.0",
            request_id="req-9",
            logger=logging.getLogger("test"),
            config={"url": "https://example.com/article"},
            metadata={"jina_api_key": "runtime-secret"},
        )
        await plugin.load(context)

        self.assertEqual(plugin._resolve_api_key(context.config), "runtime-secret")

    async def test_resolve_api_key_falls_back_to_environment(self) -> None:
        with patch.dict(os.environ, {"JINA_API_KEY": "env-secret"}, clear=False):
            self.assertEqual(self.plugin._resolve_api_key(self.context.config), "env-secret")

    async def test_call_jina_reader_handles_http_error(self) -> None:
        self._patch_urlopen_with_error(
            HTTPError(
                url=JINA_READER_URL,
                code=429,
                msg="Too Many Requests",
                hdrs=None,
                fp=self._BytesFile(b'{"error":"rate limited"}'),
            )
        )

        with self.assertRaises(PluginRuntimeError) as raised:
            self.plugin._call_jina_reader("https://example.com/article", "fake-key", 5)

        self.assertEqual(raised.exception.code, "PLUGIN_EXTERNAL_READER_FAILED")
        self.assertFalse(raised.exception.retryable)
        self.assertEqual(raised.exception.details["status_code"], 429)

    async def test_call_jina_reader_marks_server_http_error_retryable(self) -> None:
        self._patch_urlopen_with_error(
            HTTPError(
                url=JINA_READER_URL,
                code=503,
                msg="Service Unavailable",
                hdrs=None,
                fp=self._BytesFile(b'{"error":"temporary outage"}'),
            )
        )

        with self.assertRaises(PluginRuntimeError) as raised:
            self.plugin._call_jina_reader("https://example.com/article", "fake-key", 5)

        self.assertEqual(raised.exception.code, "PLUGIN_EXTERNAL_READER_FAILED")
        self.assertTrue(raised.exception.retryable)
        self.assertEqual(raised.exception.details["status_code"], 503)

    async def test_call_jina_reader_handles_url_error(self) -> None:
        self._patch_urlopen_with_error(URLError("timed out"))

        with self.assertRaises(PluginRuntimeError) as raised:
            self.plugin._call_jina_reader("https://example.com/article", "fake-key", 5)

        self.assertEqual(raised.exception.code, "PLUGIN_EXTERNAL_READER_FAILED")
        self.assertTrue(raised.exception.retryable)

    async def test_call_jina_reader_rejects_invalid_json(self) -> None:
        self._patch_urlopen_with_response(self._FakeResponse(b"not json"))

        with self.assertRaises(PluginRuntimeError) as raised:
            self.plugin._call_jina_reader("https://example.com/article", "fake-key", 5)

        self.assertEqual(raised.exception.code, "PLUGIN_EXTERNAL_READER_FAILED")
        self.assertIn("invalid JSON", raised.exception.message)

    async def test_call_jina_reader_supports_gzip_response(self) -> None:
        payload = json.dumps({"data": {"title": "Example", "content": "Body"}}).encode("utf-8")
        compressed = gzip.compress(payload)
        self._patch_urlopen_with_response(
            self._FakeResponse(compressed, headers={"Content-Encoding": "gzip"})
        )

        result = self.plugin._call_jina_reader("https://example.com/article", "fake-key", 5)

        self.assertEqual(result["data"]["title"], "Example")

    def _patch_urlopen_with_response(self, response) -> None:
        patcher = patch("jina_source.urlopen", return_value=response)
        self.addCleanup(patcher.stop)
        patcher.start()

    def _patch_urlopen_with_error(self, error: Exception) -> None:
        patcher = patch("jina_source.urlopen", side_effect=error)
        self.addCleanup(patcher.stop)
        patcher.start()

    class _FakeResponse:
        def __init__(self, body: bytes, headers: dict[str, str] | None = None) -> None:
            self._body = body
            self.headers = headers or {}

        def read(self) -> bytes:
            return self._body

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

    class _BytesFile:
        def __init__(self, body: bytes) -> None:
            self._body = body

        def read(self) -> bytes:
            return self._body

        def close(self) -> None:
            return None


if __name__ == "__main__":
    unittest.main()
