from __future__ import annotations

import asyncio
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
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


def _record(plugin_id: str):
    records = RegistryScanner(
        official_root=REPO_ROOT / "plugins",
        runtime_root=REPO_ROOT / "runtime" / "plugins",
    ).scan()
    return {item.id: item for item in records}[plugin_id]


def test_runtime_can_load_official_jina_source_plugin():
    plugin, error = asyncio.run(
        PluginRuntimeService().load_plugin(
            _record("quantagent.official.source.jina"),
            request_id="req-jina-load",
            config={"url": "https://example.com/article"},
            metadata={"origin": "official-plugin-load-test"},
        )
    )

    assert error is None
    assert plugin is not None
    assert plugin.id == "quantagent.official.source.jina"


def test_runtime_can_load_official_twelve_data_source_plugin():
    plugin, error = asyncio.run(
        PluginRuntimeService().load_plugin(
            _record("quantagent.official.source.twelve_data"),
            request_id="req-twelve-load",
            config={"symbols": ["AAPL"], "twelve_data_api_key": "test-api-key"},
            metadata={"origin": "official-plugin-load-test"},
        )
    )

    assert error is None
    assert plugin is not None
    assert plugin.id == "quantagent.official.source.twelve_data"
