# 06. submit_action_plan、通知与 HITL 流程

## 核心结论

MainAgent 不直接面对通知、审批、broker 和监控这些底层工具。MainAgent 只提交 `ActionPlan`，由 `submit_action_plan` 统一编排：

```text
ActionPlan
  -> submit_action_plan
  -> Decision / ApprovalPolicyResolver
  -> Policy Gate
  -> Approval / Notification / Monitor / Broker dry-run or mock
  -> SubmitActionPlanResult
```

这样可以保证：

- 通知和审批不重复。
- 自动审批来自用户策略和 Policy Gate，不来自 MainAgent 自行判断。
- broker 操作和仓位变化只有一个入口。
- 用户最终收到的是“分析摘要 + 审批状态或操作结果”的一致消息。

## 为什么不用 notify_user / request_approval / request_broker_action

这些能力仍然存在，但不作为 MainAgent 直接可见工具：

| 底层能力 | 谁调用 | 原因 |
| --- | --- | --- |
| `notify_user` | `submit_action_plan` 或通知服务 | 避免 MainAgent 一边通知一边提交审批，造成重复消息 |
| `request_approval` | approval orchestration | 审批必须关联平台内部 `ActionRequest`、policy、过期策略和审计 |
| `request_broker_action` | action executor / broker adapter | broker 需要 Policy Gate、幂等、dry-run/mock 边界 |
| `request_monitoring` | monitor orchestration | 监控任务应从 `ActionPlan.monitoring_plan` 统一创建 |

MainAgent 的职责是提出结构化意图，不是编排平台状态机。

## submit_action_plan 内部流程

```text
SubmitActionPlanRequest
  -> validate ActionPlan schema
  -> build internal ActionRequest
  -> ApprovalPolicyResolver.resolve()
  -> mode branch
     - notify_only
     - approval_required
     - approval_with_timeout
     - execute_then_notify
     - manual_only
     - blocked
  -> Policy Gate when execution may happen
  -> ActionExecutor when allowed
  -> NotificationMessageBuilder
  -> SubmitActionPlanResult
```

### notify_only

用于普通分析摘要、无交易动作或只需提醒的监控状态。

```text
ActionPlan(intent=notify_only)
  -> notification.requested
  -> SubmitActionPlanResult(resolved_mode=notify_only)
```

### approval_required / approval_with_timeout

用于做多、做空、加仓、减仓、平仓、撤单等需要人类确认的动作。

```text
ActionPlan(intent=trade)
  -> ApprovalRequest
  -> notification.requested(审批提醒)
  -> ApprovalInput
  -> ApprovalEvaluation
  -> ApprovalDecision
  -> Policy Gate
  -> ActionExecutor / blocked
  -> notification.requested(结果通知)
```

### execute_then_notify

用于用户已配置自动审批，且动作满足低风险、高置信、低金额等策略条件。

```text
ActionPlan(intent=trade)
  -> ApprovalPolicyResolver(mode=execute_then_notify)
  -> Policy Gate
  -> ActionExecutor(dry-run/mock)
  -> notification.requested(操作结果)
  -> SubmitActionPlanResult(resolved_mode=execute_then_notify)
```

`execute_then_notify` 不是跳过风控。Policy Gate 不可用、拒绝或 broker mode 不允许时，不调用 executor。

### manual_only / blocked

高风险、真实执行、杠杆、做空、启用 broker 或策略禁止路径会进入 manual-only 或 blocked。

```text
ActionPlan
  -> ApprovalPolicyResolver(mode=manual_only or blocked)
  -> notification.requested(需要强确认 / 阻断说明)
  -> no executor
```

## 自动审批判断

自动审批只能由平台策略决定。MainAgent 可以在 `ActionPlan` 中提供 `confidence_score`、`risk_level`、`risk_flags`、`notional`、`stop_loss` 和证据引用，但不能直接设置“已批准”。

典型自动审批条件：

```text
auto_approve_enabled = true
confidence_score >= auto_approve_min_confidence
risk_level <= auto_approve_max_risk_level
notional <= auto_approve_max_notional
action_side not in user_policy.require_human_sides
broker_mode in {mock, dry_run}
Policy Gate = allowed
```

任一条件不满足，就进入 approval-required、manual-only 或 blocked。

## 通知策略

通知由 `submit_action_plan` 内部根据模式生成，保证每个行动只有一条主通知线程。

通知类型：

| 类型 | 触发 |
| --- | --- |
| 分析摘要通知 | `ActionPlan.intent=notify_only` |
| 审批待处理通知 | `resolved_mode=approval_required/approval_with_timeout/manual_only` |
| 自动操作结果通知 | `resolved_mode=execute_then_notify` 且 executor 已请求 |
| 阻断通知 | `resolved_mode=blocked` 或 Policy Gate denied |
| 监控通知 | monitoring task 创建、触发、停止或失败 |

通知内容必须来自 `ActionPlan.user_notification` 和 `SubmitActionPlanResult`，不能让通知插件自己解释交易逻辑。

### 去重与抑制

通知不是每条事件的默认结果。后续消息如果只是重复、转述或确认已经处理过的信息，MainAgent 应优先输出 `suggested_intent=record_only` 的 `IndustryAnalysis`，不生成 `ActionPlan`，也不调用 `submit_action_plan`。`record_only` 是非行动终态，只保存评分、证据、关联和审计摘要。

只有当本次仍需要发送摘要、更新已有通知线程、调整监控或提交交易计划时，才生成 `ActionPlan`，并在 `ActionPlan.user_notification.delivery_policy` 中表达 `send`、`suppress_duplicate` 或 `update_existing_thread`，最终由 `submit_action_plan` 结合审计记录决定。

通用抑制条件：

- `evaluate_thesis.event_relationship=duplicate/follow_up`。
- `prior_coverage.status=fully_covered`，且没有新的高重要性事实、冲突事实或风险升级。
- 近期已存在同一主题、同一标的或同一行动链路的主通知。
- 本次 `suggested_intent=record_only`，只需要保存评分、证据和审计摘要，不进入行动提交。

只有以下情况才考虑再次触达用户：

- 后续消息包含新的实质信息，例如指引修正、监管变化、重大反转或来源冲突。
- 之前行动需要调整，例如加仓、减仓、平仓、止盈止损参数变化。
- 之前没有通知成功，或用户策略要求所有高重要性事件都通知。

因此，通知和 HITL 不冲突：HITL 是授权流程，通知是触达结果。需要人工决策时一定会触发审批通知；不需要行动且已被覆盖的 follow-up 事件，可以只入库、评分、关联到原行动，不再次通知。

## 用户输入回流

外部渠道回复只能成为 `ApprovalInput`：

```text
notification.receive
  -> NotificationReceiveFact
  -> ApprovalInput
  -> ApprovalEvaluation
  -> ApprovalDecision
```

文本 “approve” 不直接等于批准。manual-only、高风险、做空、杠杆或真实执行场景需要更强确认渠道。

## MainAgent instructions 约束

行业 MainAgent 应包含：

- 不要直接调用通知、审批、broker 或监控底层工具。
- 需要行动时先生成 `ActionPlan`。
- 只调用 `submit_action_plan` 提交行动。
- 把用户可读摘要写入 `ActionPlan.user_notification`。
- 对后续消息先检查近期动作和通知；没有新增实质信息时，使用 `record_only`，不要生成 `ActionPlan` 或重复通知；仍需要更新通知线程时才使用 `suppress_duplicate`。
- 把止盈、止损、监控触发条件写入 `ActionPlan.risk_controls` 和 `monitoring_plan`。
- 不解释用户回复，不标记审批完成，不表达真实成交完成。

## 对 MainAgent 的简化

MainAgent 只需要回答四个问题：

1. 是否有足够证据提出行动。
2. 行动是什么，包括方向、数量、止盈止损和监控条件。
3. 这个行动的置信度、风险和证据引用是什么。
4. 用户应该收到什么摘要。

其他事情都交给 `submit_action_plan`。
