# QuantAgent Source Bindings API 前端对接说明

本文整理当前前端需要直接对接的 SourceBinding 接口，用于数据源绑定列表、详情、关联运行记录和手动控制动作。

## 基本信息

- Base Path: `/api/v1/source-bindings`
- 路由标签：`source-bindings`
- 响应格式统一为 `code/data/msg/error`
- 全部接口都需要有效登录态 Cookie
- 查询接口需要 `source_binding.read`
- 控制动作需要 `source_binding.control` 和 `X-CSRF-Token`

## 路由总览

| 方法 | 路径 | Capability | CSRF | 说明 |
| --- | --- | --- | --- | --- |
| GET | `/` | `source_binding.read` | 否 | SourceBinding 列表 |
| GET | `/{binding_id}` | `source_binding.read` | 否 | SourceBinding 详情 |
| GET | `/{binding_id}/scheduler-runs` | `source_binding.read` | 否 | 绑定关联的 scheduler runs |
| POST | `/{binding_id}/actions/pause` | `source_binding.control` | 是 | 暂停绑定 |
| POST | `/{binding_id}/actions/resume` | `source_binding.control` | 是 | 恢复绑定 |
| POST | `/{binding_id}/actions/run-now` | `source_binding.control` | 是 | 立即触发一次运行 |

## 详细说明

### 1. `GET /api/v1/source-bindings`

查询参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `owner_type` | string | 按 owner 类型筛选 |
| `owner_id` | string | 按 owner ID 筛选 |
| `source_plugin_id` | string | 按 source 插件 ID 筛选 |
| `status` | string | `active`、`paused` 或 `disabled` |
| `cursor` | string | 游标分页 |
| `limit` | integer | 默认 50，范围 1-200 |

成功返回 `data.items[]` 主要包含：

- `id`
- `source_plugin_id`
- `owner_type`
- `owner_id`
- `status`
- `blocked_reason`
- `schedule_summary`
- `last_run_ref`
- `next_run_at`
- `health_summary`
- `allowed_actions`

### 2. `GET /api/v1/source-bindings/{binding_id}`

用途：获取绑定详情。

详情在 summary 基础上增加：

- `effective_config_summary`
- `config_version`
- `config_validation_status`
- `rate_limit_policy_summary`
- `retry_policy_summary`
- `last_error_summary`
- `audit_refs`
- `recent_run_refs`

安全边界：

- `effective_config_summary.secret_fields_masked` 标识被遮盖的敏感字段。
- 响应不返回 secret、token、真实 webhook 或私有策略原文。

### 3. `GET /api/v1/source-bindings/{binding_id}/scheduler-runs`

查询参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `status` | string | `queued`、`running`、`succeeded`、`failed`、`timeout`、`cancelled` |
| `trigger_mode` | string | 触发模式 |
| `started_after` | datetime | 开始时间下界 |
| `started_before` | datetime | 开始时间上界 |
| `cursor` | string | 游标分页 |
| `limit` | integer | 默认 50，范围 1-200 |

返回使用 runtime 列表结构：

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

### 4. 控制动作

`pause` / `resume` 成功返回：

```json
{
  "binding_id": "binding-1",
  "target_state": "paused",
  "already_in_target_state": false,
  "accepted_at": "2026-06-04T00:00:00Z",
  "audit_ref": "audit-binding-1"
}
```

`run-now` 成功返回：

```json
{
  "binding_id": "binding-1",
  "accepted_at": "2026-06-04T00:00:00Z",
  "request_id": "req-run-now",
  "requested_run_ref": "run-1",
  "audit_ref": "audit-run-now-1"
}
```

前端注意：

- action 成功只表示请求被接收，不代表插件运行已完成。
- action 后应重新拉取 binding detail 或 scheduler runs。
- `409 SOURCE_BINDING_STATE_INVALID` 表示当前状态不允许该动作。

## 常见错误

| HTTP 状态码 | `code` | 场景 |
| --- | --- | --- |
| 400 | `40000` | 查询参数非法 |
| 401 | `40100` | 未登录或登录态失效 |
| 403 | `40300` | 缺少 capability 或 CSRF token 无效 |
| 404 | `40400` | `binding_id` 不存在 |
| 409 | `40910` | 当前状态不允许执行 action |
| 503 | `50300` | 数据库 session 不可用 |
