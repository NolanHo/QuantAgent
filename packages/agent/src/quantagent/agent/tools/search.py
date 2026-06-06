from __future__ import annotations

import asyncio
import json
import os
import urllib.error
import urllib.request
from typing import Any
from uuid import uuid4

from quantagent.agent.runtime.context import ToolRuntimeContext
from quantagent.agent.tools.adapter import PlatformTool
from quantagent.agent.tools.profiles import ToolBinding
from quantagent.agent.tools.schemas import SearchWebInput


SEARCH_WEB_TOOL_ID = "quantagent.official.source.tavily.search_web"


def build_search_web_tool(*, api_key: str | None = None, timeout_seconds: float = 10.0) -> PlatformTool[SearchWebInput]:
    async def _search_web(input_data: SearchWebInput, runtime_context: ToolRuntimeContext) -> dict[str, Any]:
        resolved_key = api_key or os.environ.get("TAVILY_API_KEY")
        if not resolved_key:
            raise RuntimeError("未配置 TAVILY_API_KEY；本次 run 无法使用 search_web，但这属于可恢复的信息缺口。")

        payload = _request_payload(input_data, resolved_key)
        raw = await asyncio.to_thread(_post_json, "https://api.tavily.com/search", payload, timeout_seconds=timeout_seconds)
        results = [_normalize_result(item, index) for index, item in enumerate(raw.get("results", []))]
        return {
            "ok": True,
            "search_id": f"search_{uuid4().hex}",
            "agent_run_id": runtime_context.agent_run_id,
            "event_id": runtime_context.event_id,
            "query": input_data.query,
            "answer_summary": raw.get("answer") if isinstance(raw.get("answer"), str) else None,
            "results": results,
            "result_count": len(results),
            "artifact_id": None,
            "dedupe_summary": "MVP Agent Chat 尚未配置 run 级去重 ledger。",
            "summary": f"Tavily 针对查询返回 {len(results)} 条结果：{input_data.query}",
        }

    return PlatformTool(
        binding=ToolBinding(
            tool_id=SEARCH_WEB_TOOL_ID,
            name="search_web",
            description=(
                "使用 Tavily 检索公开网页证据，包括市场预期、第一手来源、新闻、盘前/盘后反应或冲突信息。"
                "需要覆盖多个问题时，优先拆成多个窄查询。"
            ),
        ),
        input_model=SearchWebInput,
        callable=_search_web,
    )


def _request_payload(input_data: SearchWebInput, api_key: str) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "api_key": api_key,
        "query": input_data.query,
        "max_results": input_data.max_results or 5,
        "search_depth": "basic",
        "include_answer": input_data.include_answer,
        "include_raw_content": input_data.include_raw_content,
    }
    if input_data.topic != "general":
        payload["topic"] = input_data.topic
    if input_data.domains_allowlist:
        payload["include_domains"] = input_data.domains_allowlist
    if input_data.domains_blocklist:
        payload["exclude_domains"] = input_data.domains_blocklist
    return payload


def _post_json(url: str, payload: dict[str, Any], *, timeout_seconds: float) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Tavily HTTP 错误：{exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Tavily 网络错误：{exc.reason}") from exc
    except TimeoutError as exc:
        raise RuntimeError(f"Tavily 请求超时：{timeout_seconds}s") from exc

    parsed = json.loads(body)
    if not isinstance(parsed, dict):
        raise RuntimeError("Tavily 返回了非对象响应。")
    return parsed


def _normalize_result(item: Any, index: int) -> dict[str, Any]:
    if not isinstance(item, dict):
        return {
            "result_id": f"result_{index + 1}",
            "title": "未命名结果",
            "url": "",
            "source": None,
            "published_at": None,
            "snippet": str(item),
            "score": None,
        }
    url = str(item.get("url") or "")
    return {
        "result_id": f"result_{index + 1}",
        "title": str(item.get("title") or "未命名结果"),
        "url": url,
        "source": _hostname(url),
        "published_at": item.get("published_date") if isinstance(item.get("published_date"), str) else None,
        "snippet": str(item.get("content") or item.get("snippet") or ""),
        "score": item.get("score") if isinstance(item.get("score"), int | float) else None,
    }


def _hostname(url: str) -> str | None:
    if not url:
        return None
    return url.split("/")[2] if "://" in url and len(url.split("/")) > 2 else url
