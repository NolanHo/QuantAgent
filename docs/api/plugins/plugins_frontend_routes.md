# QuantAgent Plugins API 前端对接说明

本文整理当前前端需要直接对接的插件管理接口，用于插件列表、单插件详情、配置视图、依赖视图、健康视图、审计视图、配置 Schema 查看和插件目录重扫。

## 基本信息

- Base Path: `/api/v1/plugins`
- 路由标签：`plugins`
- 响应格式统一为 `code/data/msg/error`
- 所有接口都需要有效登录态 Cookie
- 写操作 `POST /actions/rescan` 需要额外携带 `X-CSRF-Token`

## 为什么需要前端对接

- 这些路由已经作为 `protected` API 注册到 `/api/v1`
- 返回的数据是插件注册表的前端可展示视图，而不是后端内部对象
- `rescan` 明确是管理台触发的运维/管理动作

因此，`plugins` 应视为前端插件管理页直接消费的 HTTP API。

## 统一响应格式

成功响应示例：

```json
{
  "code": 0,
  "data": [],
  "msg": "ok",
  "error": null
}
```

错误响应示例：

```json
{
  "code": 40000,
  "data": null,
  "msg": "Plugin config schema is not available",
  "error": {
    "code": "BAD_REQUEST",
    "request_id": "req-456",
    "trace_id": null,
    "details": {
      "plugin": {
        "id": "quantagent.official.example",
        "status": "invalid"
      }
    },
    "retryable": false
  }
}
```

## 路由总览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/` | 获取当前 Registry 中的插件列表 |
| GET | `/{plugin_id}` | 获取单个插件详情聚合视图 |
| GET | `/{plugin_id}/config` | 获取插件配置只读视图 |
| GET | `/{plugin_id}/dependencies` | 获取插件依赖视图 |
| GET | `/{plugin_id}/health` | 获取插件健康视图 |
| GET | `/{plugin_id}/audit` | 获取插件审计视图 |
| GET | `/{plugin_id}/config-schema` | 获取插件配置 JSON Schema |
| POST | `/actions/rescan` | 重新扫描官方插件目录和运行时插件目录 |

## 鉴权规则

- 全部接口都需要有效 session Cookie
- 只读接口不需要 `X-CSRF-Token`
- `POST /actions/rescan` 需要 `X-CSRF-Token`
- 当前路由代码没有额外 capability 校验，前端可以基于 `/api/v1/me` 的 `capabilities` 做 UI 控制，但后端当前只强制 session 和 CSRF

## 详细说明

### 1. `GET /api/v1/plugins`

用途：获取插件列表，用于插件管理页表格、状态总览和来源区分。

成功返回 `data` 示例：

```json
[
  {
    "id": "quantagent.official.source.placeholder",
    "source": "official",
    "path": "plugins/sources/placeholder-source",
    "status": "valid",
    "manifest": {
      "id": "quantagent.official.source.placeholder",
      "name": "Placeholder Source",
      "type": "source",
      "version": "0.1.0",
      "entrypoint": "placeholder_source:plugin",
      "capabilities": [
        "source.fetch"
      ],
      "config_schema": "config.schema.json",
      "description": "Placeholder source plugin.",
      "permissions": [],
      "dependencies": {},
      "source_bindings": []
    },
    "last_error": null
  }
]
```

字段说明：

- `source`: 当前支持 `official`、`runtime`
- `status`: 当前支持 `discovered`、`valid`、`invalid`、`enabled`、`disabled`、`failed`
- `path`: 返回相对仓库根的展示路径，不暴露本地绝对路径
- `manifest`: 解析成功时存在
- `last_error`: 插件异常或失效时可用于前端错误展示

### 2. `GET /api/v1/plugins/{plugin_id}`

用途：查看单个插件详情聚合视图，适合插件详情页首屏。

成功返回 `data` 主要包含：

- `overview`: 插件基础信息、状态、配置状态和错误摘要。
- `config_summary`: 配置摘要、缺失项数量、敏感字段数量和 reload 状态。
- `dependency_summary`: 依赖摘要。
- `capabilities`: 声明能力、风险等级、是否需要 Policy Gate / Approval。
- `health_summary`: 健康摘要和最近 runtime failure ref。
- `audit_summary`: 最近变更摘要。
- `ops_summary`: 可操作状态和 action blockers。
- `allowed_actions`: 前端按钮状态提示。
- `related_resources`: config / dependencies / health / audit / config_schema 路径。

错误约定：

- 插件不存在时返回 `404`

### 3. `GET /api/v1/plugins/{plugin_id}/config`

用途：查看插件配置只读视图，用于配置 tab。

成功返回 `data` 主要包含：

- `availability`: 当前配置视图是否可用。
- `schema`: schema 标题、版本和引用。
- `config_state`: `valid`、`invalid`、`missing_required`、`not_configured` 或 `unavailable`。
- `entries`: 配置项展示值；敏感字段只返回 masked / reference / unset，不返回 secret 原文。
- `reload_required`: 配置变更后是否需要 reload。

### 4. `GET /api/v1/plugins/{plugin_id}/dependencies`

用途：查看插件依赖视图。

成功返回 `data` 主要包含：

- `plugin_dependencies`
- `python_dependencies`
- `system_dependencies`
- `reverse_dependencies`

每条依赖包含 `name`、`kind`、`required`、`resolved_state`、`blocked_reason` 和 `version_range`。

### 5. `GET /api/v1/plugins/{plugin_id}/health`

用途：查看插件健康视图。

成功返回 `data` 主要包含：

- `availability`
- `status`
- `last_check_at`
- `degraded_reason`
- `last_error_summary`
- `runtime_error_refs`
- `recent_usage_summary`
- `health_checks`

### 6. `GET /api/v1/plugins/{plugin_id}/audit`

用途：查看插件审计摘要。

成功返回 `data.entries` 中每条记录包含：

- `audit_id`
- `action`
- `actor`
- `result`
- `occurred_at`
- `safe_details`

### 7. `GET /api/v1/plugins/{plugin_id}/config-schema`

用途：拉取插件配置 JSON Schema，用于前端动态生成配置表单或展示配置约束。

成功返回 `data` 示例：

```json
{
  "type": "object",
  "properties": {
    "endpoint": {
      "type": "string"
    }
  },
  "required": [
    "endpoint"
  ]
}
```

错误约定：

- 插件不存在时返回 `404`
- 插件没有配置 schema，或 schema 当前不可读取时返回 `400`

前端注意：

- 当前返回的是原始 JSON Schema 对象，不再包额外 schema DTO
- 如果插件状态异常，即使插件存在，也可能拿不到 schema

### 8. `POST /api/v1/plugins/actions/rescan`

用途：用户在管理台手动触发插件目录重扫，刷新插件注册表视图。

请求头：

- `X-CSRF-Token: <csrf_token>`

请求体：

- 无

成功返回 `data` 示例：

```json
{
  "summary": {
    "total": 3,
    "valid": 2,
    "invalid": 1,
    "failed": 0,
    "sources": {
      "official": 2,
      "runtime": 1
    }
  },
  "plugins": [
    {
      "id": "quantagent.official.source.placeholder",
      "source": "official",
      "path": "plugins/sources/placeholder-source",
      "status": "valid",
      "manifest": {
        "id": "quantagent.official.source.placeholder",
        "name": "Placeholder Source",
        "type": "source",
        "version": "0.1.0",
        "entrypoint": "placeholder_source:plugin",
        "capabilities": [],
        "config_schema": "config.schema.json",
        "description": "Placeholder source plugin.",
        "permissions": [],
        "dependencies": {},
        "source_bindings": []
      },
      "last_error": null
    }
  ]
}
```

前端用途：

- 用 `summary` 更新统计卡片
- 用 `plugins` 直接覆盖当前插件列表缓存
- 可在按钮触发后显示“扫描中/已刷新”的状态反馈

## 常见错误

| HTTP 状态码 | `code` | 场景 |
| --- | --- | --- |
| 400 | `40000` | 请求插件存在但缺少 config schema，或 schema 不可用 |
| 401 | `40100` | 未登录或登录态失效 |
| 403 | `40300` | `rescan` 缺少或携带了错误的 `X-CSRF-Token` |
| 404 | `40400` | `plugin_id` 不存在 |

## 前端接入建议

1. 插件管理页初始化时先拉 `GET /plugins`，不要假设前端本地插件目录就是最终真源。
2. 展示插件错误状态时优先使用 `last_error.code`、`last_error.message`、`last_error.stage`。
3. 需要动态渲染配置表单时，再按需请求 `/{plugin_id}/config-schema`，避免列表页首屏拉太多 schema。
4. 执行 `rescan` 后，用响应里的完整 `plugins` 列表直接覆盖缓存，避免再额外补一次列表请求。
5. `path` 只用于展示和定位，不要在前端把它当成可执行文件系统路径。

## 示例请求

获取插件列表：

```bash
curl -i \
  http://127.0.0.1:8000/api/v1/plugins \
  --cookie "quantagent_session=..."
```

重新扫描插件目录：

```bash
curl -i \
  -X POST http://127.0.0.1:8000/api/v1/plugins/actions/rescan \
  -H 'X-CSRF-Token: <csrf-token>' \
  --cookie "quantagent_session=..."
```
