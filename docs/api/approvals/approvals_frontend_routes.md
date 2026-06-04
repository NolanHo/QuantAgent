# QuantAgent Approvals API 前端对接说明

本文整理当前前端需要直接对接的 Approval V1 接口，用于审批工作台、审批详情页和人工确认动作。

## 基本信息

- Base Path: `/api/v1/approvals`
- 路由标签：`approvals`
- 响应格式统一为 `code/data/msg/error`
- 全部接口都需要有效登录态 Cookie
- 读接口需要 `approval.read`
- action 写接口需要 `approval.approve` 和 `X-CSRF-Token`
- REST、数据库和 approval scoped audit records 是审批状态恢复真源；实时消息只作为状态变化提醒

## 路由总览

| 方法 | 路径 | Capability | CSRF | 说明 |
| --- | --- | --- | --- | --- |
| GET | `/` | `approval.read` | 否 | 查询 Approval 队列 |
| GET | `/{approval_id}` | `approval.read` | 否 | 查询单条 Approval 详情和 history |
| POST | `/{approval_id}/actions/approve` | `approval.approve` | 是 | 提交 approve 输入 |
| POST | `/{approval_id}/actions/reject` | `approval.approve` | 是 | 提交 reject 输入 |
| POST | `/{approval_id}/actions/request-reanalysis` | `approval.approve` | 是 | 提交 request reanalysis 输入 |

## 状态与安全语义

- `ApprovalRequest.status` 表达审批请求当前状态，例如 `pending`、`completed`、`expired`、`escalated`、`blocked`。
- `ApprovalDecision.status` 表达本次审批决策摘要，例如 `rejected`、`reanalysis_requested`、`policy_gate_failed`、`execution_requested`。
- 前端点击 approve 只代表用户提交批准意图；后端仍必须经过 evaluator 和 Policy Gate。
- approve 响应不得被展示成真实交易成功、真实 broker 成交或 live trading 完成。
- `request-reanalysis` V1 只记录人工意图和 decision，不触发新的 Agent run、worker、scheduler 或重分析任务。
- 终态 approval 的后续输入不会覆盖最终 decision；API 会返回稳定 envelope，并通过 `ignored` 标记表达输入被忽略。

## 统一响应格式

成功响应示例：

```json
{
  "code": 0,
  "data": {},
  "msg": "ok",
  "error": null
}
```

错误响应示例：

```json
{
  "code": 40400,
  "data": null,
  "msg": "Approval not found",
  "error": {
    "code": "NOT_FOUND",
    "request_id": "req-approval",
    "trace_id": null,
    "details": {
      "approval_id": "approval-missing"
    },
    "retryable": false
  }
}
```

## 详细说明

### 1. `GET /api/v1/approvals`

用途：拉取审批队列，用于 `/approvals` 工作台。

查询参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `status` | string | 按当前状态筛选，例如 `pending` |
| `risk_level` | string | 按风险等级筛选 |
| `required_confirmation_level` | string | 按确认等级筛选 |
| `expires_before` | datetime | 查询指定时间前到期的审批 |
| `cursor` | string | 游标分页 |
| `limit` | integer | 默认 50，范围 1-200 |
| `sort` | string | 默认 `-updated_at` |

成功返回 `data` 示例：

```json
{
  "items": [
    {
      "id": "approval-1",
      "status": "pending",
      "target_type": "strategy",
      "target_id": "strategy-1",
      "action_type": "adjust_strategy",
      "action_side": "increase_risk",
      "risk_level": "high",
      "urgency": "normal",
      "summary": "adjust_strategy increase_risk for strategy:strategy-1",
      "required_confirmation_level": "soft_confirm",
      "expires_at": null,
      "expiration_action": "expire_reject",
      "created_at": "2026-06-04T00:00:00+00:00",
      "updated_at": "2026-06-04T00:00:00+00:00",
      "latest_decision_summary": null,
      "allowed_actions": [
        "approve",
        "reject",
        "request-reanalysis"
      ]
    }
  ],
  "next_cursor": null
}
```

前端注意：

- `allowed_actions` 为空时，不应展示可点击 action。
- `latest_decision_summary` 只表达最新审批决策摘要，不表达真实交易结果。
- 列表结果来自持久化 repository，不是 harness 或 mock fixture。

### 2. `GET /api/v1/approvals/{approval_id}`

用途：拉取单条审批详情，用于审批详情页。

成功返回在 summary 基础上增加：

```json
{
  "id": "approval-1",
  "status": "completed",
  "action_request_summary": {
    "id": "action-1",
    "action_type": "adjust_strategy",
    "target_type": "strategy",
    "target_id": "strategy-1",
    "proposed_payload_summary": {
      "summary": "masked"
    }
  },
  "allowed_channels": [
    "web"
  ],
  "policy_source": "system_default",
  "inputs": [
    {
      "id": "input-1",
      "approval_id": "approval-1",
      "channel": "web",
      "actor_ref": "local_single_user:local_admin",
      "raw_text": "reject via UI",
      "structured_payload": {
        "intent": "reject",
        "request_id": "req-approval-action"
      }
    }
  ],
  "evaluations": [
    {
      "approval_id": "approval-1",
      "input_id": "input-1",
      "interpreted_intent": "reject",
      "confidence": 1.0,
      "reason_summary": "Rejected by structured intent."
    }
  ],
  "decisions": [
    {
      "approval_id": "approval-1",
      "status": "rejected",
      "intent": "reject",
      "policy_gate_status": "not_required",
      "execution_status": "not_requested",
      "reason_summary": "Rejected by structured intent."
    }
  ],
  "audit_refs": [
    {
      "record_id": "audit-1",
      "action": "decision.rejected",
      "request_id": "req-approval-action"
    }
  ]
}
```

前端注意：

- `action_request_summary`、history 和 audit refs 都是脱敏摘要。
- 不要假设 detail 会返回完整 prompt、私有策略、secret、broker credential 或完整 proposed payload。
- 前端恢复详情页状态时应以本接口为真源，不以实时消息或 notification 回执为真源。

### 3. `POST /api/v1/approvals/{approval_id}/actions/approve`

用途：提交批准意图。

请求头：

- `X-CSRF-Token: <csrf_token>`
- 可选 `X-Request-ID: <request_id>`

请求体：

```json
{
  "input_id": "input-web-approve-1",
  "channel": "web",
  "reason": "approve after review",
  "structured_payload": {
    "ui_source": "approval-detail"
  }
}
```

成功返回 `data`：

```json
{
  "approval": {
    "id": "approval-1",
    "status": "blocked",
    "allowed_actions": []
  },
  "decision": {
    "status": "policy_gate_failed",
    "intent": "approve",
    "policy_gate_status": "unavailable",
    "execution_status": "not_requested",
    "reason_summary": "Policy Gate is unavailable; execution was blocked."
  },
  "evaluation": {
    "interpreted_intent": "approve",
    "confidence": 1.0
  },
  "ignored": false
}
```

说明：

- path action 是 intent 真源，后端会写入 `structured_payload.intent=approve`。
- 如果 Policy Gate 未注入、拒绝或失败，approve 会被阻断，不会调用 executor。
- 有 executor 的安全 dry-run / mock 请求也只能通过 `execution_status` 表达请求摘要，不表示真实 broker 成功。

### 4. `POST /api/v1/approvals/{approval_id}/actions/reject`

用途：提交拒绝意图。

请求体：

```json
{
  "input_id": "input-web-reject-1",
  "channel": "web",
  "reason": "risk too high"
}
```

成功返回重点字段：

```json
{
  "decision": {
    "status": "rejected",
    "intent": "reject",
    "policy_gate_status": "not_required",
    "execution_status": "not_requested"
  },
  "ignored": false
}
```

说明：

- reject 不调用 Policy Gate 或 executor。
- approval 当前状态会收敛到 terminal state，通常为 `completed`。

### 5. `POST /api/v1/approvals/{approval_id}/actions/request-reanalysis`

用途：提交重分析意图。

请求体：

```json
{
  "input_id": "input-web-reanalysis-1",
  "channel": "web",
  "comment": "please re-check with newer evidence"
}
```

成功返回重点字段：

```json
{
  "decision": {
    "status": "reanalysis_requested",
    "intent": "request_reanalysis",
    "policy_gate_status": "not_required",
    "execution_status": "not_requested"
  },
  "ignored": false
}
```

说明：

- path 中使用 `request-reanalysis`，domain intent 使用 `request_reanalysis`。
- V1 只记录意图，不创建 Agent run，不触发 worker / scheduler。

## Body intent 冲突

客户端不得通过 body 覆盖 path action。以下请求会返回 `400`，且不会写入 input / evaluation / decision / audit：

```json
{
  "input_id": "input-conflict",
  "channel": "web",
  "structured_payload": {
    "intent": "reject"
  }
}
```

如果路径是 `/actions/approve`，body 里的 `intent=reject` 会被视为冲突。

## 常见错误

| HTTP 状态码 | `code` | 场景 |
| --- | --- | --- |
| 400 | `40000` | body intent 与 path action 冲突，或查询参数非法 |
| 401 | `40100` | 未登录或登录态失效 |
| 403 | `40300` | 缺少 capability 或 CSRF token 无效 |
| 404 | `40400` | `approval_id` 不存在 |
| 422 | `42200` | 请求体或查询参数格式校验失败 |
| 503 | `50300` | 数据库 session 不可用 |

## 前端接入建议

1. 页面初始化时先用 `/api/v1/me` 获取 `capabilities` 和 `csrf_token`。
2. 没有 `approval.read` 时不要进入审批工作台或详情页。
3. 没有 `approval.approve` 时禁用 approve / reject / request-reanalysis 按钮。
4. action 成功后重新拉取 `GET /approvals/{approval_id}`，不要只依赖 action response 更新本地状态。
5. 终态或 `allowed_actions=[]` 时禁用所有 action 按钮。
6. 展示 approve 结果时区分“批准意图已记录 / Policy Gate 已阻断 / dry-run 请求已发出”，不要写成“交易成功”。

## 示例请求

查询审批队列：

```bash
curl -i \
  'http://127.0.0.1:8000/api/v1/approvals?status=pending&limit=20' \
  --cookie "quantagent_session=..."
```

拒绝审批：

```bash
curl -i \
  -X POST http://127.0.0.1:8000/api/v1/approvals/approval-1/actions/reject \
  -H 'Content-Type: application/json' \
  -H 'X-CSRF-Token: <csrf-token>' \
  --cookie "quantagent_session=..." \
  -d '{"input_id":"input-web-reject-1","channel":"web","reason":"risk too high"}'
```
