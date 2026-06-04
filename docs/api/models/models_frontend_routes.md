# QuantAgent Models API 前端对接说明

本文整理当前前端需要直接对接的模型配置接口，用于 provider 管理、provider model 管理、preset 绑定和连接测试。

## 基本信息

- Base Path: `/api/v1/models`
- 路由标签：`models`
- 响应格式统一为 `code/data/msg/error`
- 全部接口都需要有效登录态 Cookie
- 全部接口需要 `secret.manage`
- 写操作需要 `X-CSRF-Token`
- API 响应只返回 `masked_key` / `key_status`，不返回 API key 原文

## 路由总览

| 方法 | 路径 | CSRF | 说明 |
| --- | --- | --- | --- |
| GET | `/providers` | 否 | Provider 列表 |
| POST | `/providers` | 是 | 创建 provider |
| GET | `/providers/{provider_id}` | 否 | Provider 详情 |
| PUT | `/providers/{provider_id}` | 是 | 更新 provider |
| DELETE | `/providers/{provider_id}` | 是 | 删除 provider |
| POST | `/providers/{provider_id}/actions/set-default` | 是 | 设置默认 provider |
| POST | `/providers/{provider_id}/actions/test-connection` | 是 | 测试连接并记录 invocation |
| GET | `/providers/{provider_id}/remote-models` | 否 | 查询远端模型列表 |
| POST | `/providers/{provider_id}/models` | 是 | 创建 provider model |
| PUT | `/providers/{provider_id}/models/{model_id}` | 是 | 更新 provider model |
| DELETE | `/providers/{provider_id}/models/{model_id}` | 是 | 删除 provider model |
| GET | `/presets` | 否 | 查询 preset 绑定 |
| PUT | `/presets/{preset_key}` | 是 | 更新 preset 绑定 |
| GET | `/invocations` | 否 | 查询模型调用记录 |

## Provider 字段

Provider summary 主要包含：

- `id`
- `provider_type`: 当前为 `openai_compatible`
- `name`
- `base_url`
- `enabled`
- `is_default`
- `status`: `configured`、`missing_key`、`disabled`、`failed`
- `key_status`: `configured` 或 `missing`
- `masked_key`
- `last_error`
- `model_count`
- `updated_at`

Provider detail 在 summary 基础上增加 `models`。

## 请求体

创建 provider：

```json
{
  "provider_type": "openai_compatible",
  "name": "OpenAI Compatible",
  "base_url": "https://api.example.com/v1",
  "api_key": "sk-redacted",
  "enabled": true,
  "is_default": false
}
```

更新 provider：

```json
{
  "provider_type": "openai_compatible",
  "name": "OpenAI Compatible",
  "base_url": "https://api.example.com/v1",
  "api_key": "sk-redacted-or-null",
  "enabled": true
}
```

创建 / 更新 provider model：

```json
{
  "model_name": "gpt-4.1-mini",
  "enabled": true,
  "supports_vision": false,
  "is_global_default": false
}
```

更新 preset：

```json
{
  "primary_model_id": 1,
  "fallback_model_id": 2
}
```

## Preset

`preset_key` 当前支持：

- `global_default`
- `economy_text`
- `general_text`
- `reasoning_text`
- `multimodal`

Preset response 包含 `title`、`description`、`primary_model`、`fallback_model`、`status` 和 `validation_message`。

## Invocation

`GET /api/v1/models/invocations` 查询参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `limit` | integer | 默认 20，服务端限制在 1-100 |
| `provider_id` | integer | 按 provider 筛选 |
| `preset_key` | string | 按 preset 筛选 |

返回字段包括 provider、model、preset、status、token_usage、error_summary、request_id、trace_id、agent_run_id 和 created_at。

## 常见错误

| HTTP 状态码 | `code` | 场景 |
| --- | --- | --- |
| 400 | `40000` | provider / preset / model 配置非法 |
| 401 | `40100` | 未登录或登录态失效 |
| 403 | `40300` | 缺少 `secret.manage` 或 CSRF token 无效 |
| 404 | `40400` | provider 或 model 不存在 |
| 503 | `50300` | 数据库 session 不可用，或加密 key 缺失导致配置能力不可用 |

## 前端接入建议

1. API key 只在创建 / 更新时提交，响应不回显原文。
2. 展示 provider 时使用 `key_status` 和 `masked_key`。
3. `test-connection` 是写操作，需要 CSRF，并可能产生 invocation 记录。
4. 更新 provider / model / preset 后重新拉取 provider detail 或 preset 列表。
