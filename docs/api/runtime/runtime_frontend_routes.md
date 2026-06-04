# QuantAgent Runtime API 前端对接说明

本文整理当前前端需要直接对接的 runtime / events 只读接口，用于运行态总览、错误列表、Agent run、Tool invocation、Scheduler run、RawEvent 和新闻审计时间线。

## 基本信息

- Base Path: `/api/v1`
- 路由标签：`runtime`
- 响应格式统一为 `code/data/msg/error`
- 全部接口都需要有效登录态 Cookie
- 当前 runtime 只读接口不需要 `X-CSRF-Token`
- runtime inspect 类接口用于管理台恢复状态；WebSocket / realtime 后续只作为状态变化提醒

## 路由总览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/runtime/health` | Runtime 健康摘要 |
| GET | `/runtime/audit/news` | 新闻事件审计时间线列表 |
| GET | `/runtime/errors` | Runtime error 列表 |
| GET | `/runtime/errors/{error_id}` | Runtime error 详情 |
| GET | `/agents/runs` | Agent run 列表 |
| GET | `/agents/runs/{run_id}` | Agent run 详情 |
| GET | `/tools/invocations` | Tool invocation 列表 |
| GET | `/tools/invocations/{invocation_id}` | Tool invocation 详情 |
| GET | `/scheduler-runs` | Scheduler run 列表 |
| GET | `/scheduler-runs/{run_id}` | Scheduler run 详情 |
| GET | `/raw-events` | Raw event 列表 |
| GET | `/raw-events/{raw_event_id}` | Raw event 详情 |

## 列表响应结构

Agent runs、tool invocations、scheduler runs 等 runtime inspect 列表使用统一结构：

```json
{
  "items": [],
  "meta": {
    "state": "empty",
    "page": {
      "page": 1,
      "page_size": 50,
      "returned": 0,
      "cursor": null,
      "next_cursor": null
    },
    "unavailable": null
  }
}
```

`state` 可为：

- `ready`
- `empty`
- `unavailable`

## `GET /api/v1/runtime/health`

成功返回 `data` 主要包含：

- `active_agent_run_count`
- `recent_failed_agent_run_count`
- `recent_failed_tool_invocation_count`
- `runtime_error_severity_summary`
- `backend_status`
- `websocket_status_hint`
- `partial_status`
- `unavailable_resources`
- `generated_at`

## Agent Runs

`GET /api/v1/agents/runs` 和 `GET /api/v1/agents/runs/{run_id}` 用于展示 Agent 运行历史。

summary 主要字段：

- `run_id`
- `event_id`
- `trace_id`
- `correlation_id`
- `run_type`
- `status`
- `provider_policy`
- `model_used`
- `token_usage_summary`
- `cost_estimate_summary`
- `started_at`
- `ended_at`
- `duration_ms`
- `error_summary`

detail 额外包含 `input_summary`、`output_summary`、`related_tool_invocation_refs` 和 `scheduler_run_ref`。

## Tool Invocations

`GET /api/v1/tools/invocations` 和 `GET /api/v1/tools/invocations/{invocation_id}` 用于展示工具调用历史。

summary 主要字段：

- `invocation_id`
- `agent_run_id`
- `event_id`
- `trace_id`
- `tool_id`
- `plugin_id`
- `risk_level`
- `status`
- `retry_count`
- `started_at`
- `ended_at`
- `duration_ms`
- `error_summary`

detail 额外包含 `input_summary`、`output_summary` 和 `approval_ref`。

## Scheduler Runs

`GET /api/v1/scheduler-runs` 和 `GET /api/v1/scheduler-runs/{run_id}` 用于展示调度运行历史。

summary 主要字段：

- `run_id`
- `binding_id`
- `plugin_id`
- `request_id`
- `trigger_type`
- `status`
- `started_at`
- `ended_at`
- `duration_ms`
- `error_summary`

detail 额外包含 `event_ref` 和 `captured_count_summary`。

## Runtime Errors

`GET /api/v1/runtime/errors` 和 `GET /api/v1/runtime/errors/{error_id}` 用于展示运行时错误。

summary 主要字段：

- `error_id`
- `component`
- `severity`
- `status`
- `error_code`
- `error_message_summary`
- `provider`
- `provider_policy`
- `trace_id`
- `event_id`
- `plugin_id`
- `created_at`

detail 额外包含 `details_summary` 和 `related_refs`。

## Raw Events

`GET /api/v1/raw-events` 查询参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `source_plugin_id` | string | 按 source 插件筛选 |
| `external_id` | string | 按外部 ID 筛选 |
| `canonical_url` | string | 按 canonical URL 筛选 |
| `cursor` | string | 游标分页 |
| `limit` | integer | 默认 50，范围 1-200 |

summary 包含 `raw_event_id`、source、标题、作者、发布时间、首次/最后捕获时间、去重信息、预览和 metadata summary。

detail 额外包含 `content`、`metadata` 和 `raw_payload`。前端不应把 `raw_payload` 当作稳定跨端契约，展示时需要做好缺字段兼容。

## Runtime Audit News

`GET /api/v1/runtime/audit/news` 用于新闻事件审计时间线。

返回 item 主要包含：

- `raw_event_id`
- 新闻摘要字段：`title`、`canonical_url`、`url_host`、`source_plugin_id`、`author`、`published_at`、`content_preview`
- `status` 和 `current_stage`
- `trace`
- `timeline`
- `agent_stages`
- `safe_details`

该接口用于 audit timeline 展示，不是 Agent / Approval / Broker 的唯一状态真源。

## 常见错误

| HTTP 状态码 | `code` | 场景 |
| --- | --- | --- |
| 400 | `40000` | 查询参数非法 |
| 401 | `40100` | 未登录或登录态失效 |
| 404 | `40400` | 详情资源不存在 |
| 503 | `50300` | 数据库 session 不可用或运行态查询暂不可用 |
