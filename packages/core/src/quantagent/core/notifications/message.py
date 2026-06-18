from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from quantagent.core.events.codec import sanitize_string

_FALLBACK_VALUE = "unknown"
_APPROVALS_PATH = "/approvals"

_ACTION_TYPE_LABELS = {
    "execute_order": "提交 dry-run/mock 订单计划",
    "adjust_strategy": "调整策略参数",
    "notify": "仅发送通知",
    "monitor": "创建监控",
    "rebalance": "再平衡建议",
}

_RISK_DIRECTION_LABELS = {
    "increase_risk": "增加风险敞口",
    "decrease_risk": "降低风险敞口",
    "neutral": "中性/不改变风险敞口",
}

_CONFIRMATION_LABELS = {
    "informational": "仅通知，不需要人工确认",
    "soft_confirm": "普通人工确认",
    "strong_confirm": "强确认",
    "link_confirm": "需要在 Web 审批页确认",
    "manual_only": "只能人工处理",
}

_EXPIRATION_ACTION_LABELS = {
    "expire_reject": "到期后自动拒绝",
    "expire_approve": "到期后按策略批准",
    "expire_notify_only": "到期后仅通知",
    "expire_reanalysis": "到期后请求重新分析",
    "escalate": "到期后升级处理",
}


def build_discord_approval_notification_text(payload: Mapping[str, Any]) -> str:
    approval_id = _required_text(payload, "approval_id")
    action_request_id = _optional_text(payload.get("action_request_id"))
    summary = _optional_text(payload.get("summary")) or "有新的 QuantAgent 行动需要处理。"
    risk_direction = _optional_text(payload.get("risk_direction")) or _optional_text(payload.get("action_side")) or _FALLBACK_VALUE
    confirmation = _optional_text(payload.get("required_confirmation_level")) or _FALLBACK_VALUE
    expires_at = _optional_text(payload.get("expires_at"))
    expiration_action = _optional_text(payload.get("expiration_action"))
    reason_summary = _optional_text(payload.get("reason_summary"))
    safe_context = payload.get("safe_context")
    if not isinstance(safe_context, Mapping):
        safe_context = {}

    target_type = _optional_text(safe_context.get("target_type"))
    target_id = _optional_text(safe_context.get("target_id"))
    action_type = _optional_text(safe_context.get("action_type")) or _optional_text(payload.get("action_type"))
    urgency = _optional_text(safe_context.get("urgency"))
    risk_level = _optional_text(safe_context.get("risk_level"))
    action_plan_summary = safe_context.get("action_plan_summary")
    if not isinstance(action_plan_summary, Mapping):
        action_plan_summary = {}

    lines = [
        "QuantAgent 行动审批提醒",
        "",
        "有一条 Agent 生成的行动计划需要你在 Web 审批工作台处理。Discord 本轮只负责通知，不作为审批入口。",
        "",
        "审批信息",
        f"- 审批 ID：{approval_id}",
    ]
    if action_request_id:
        lines.append(f"- 行动请求 ID：{action_request_id}")
    if target_type or target_id:
        lines.append(f"- 目标对象：{_target_label(target_type, target_id)}")
    lines.extend(
        [
            f"- 建议动作：{_label(action_type, _ACTION_TYPE_LABELS)}",
            f"- 风险方向：{_label(risk_direction, _RISK_DIRECTION_LABELS)}",
            f"- 风险等级：{risk_level or _FALLBACK_VALUE}",
            f"- 紧急程度：{urgency or _FALLBACK_VALUE}",
            f"- 确认等级：{_label(confirmation, _CONFIRMATION_LABELS)}",
        ]
    )
    if expires_at:
        lines.append(f"- 过期时间：{expires_at}")
    if expiration_action:
        lines.append(f"- 过期策略：{_label(expiration_action, _EXPIRATION_ACTION_LABELS)}")

    lines.extend(
        [
            "",
            "行动摘要",
            summary,
        ]
    )
    if reason_summary:
        lines.extend(["", "触发原因", reason_summary])
    plan_lines = _action_plan_lines(action_plan_summary)
    if plan_lines:
        lines.extend(["", "交易计划详情", *plan_lines])
    lines.extend(
        [
            "",
            "处理方式",
            f"- 请打开 QuantAgent Web 控制台：{_APPROVALS_PATH}",
            f"- 建议直达审批详情：{_APPROVALS_PATH}/{approval_id}",
            "- 可选操作：批准、拒绝、请求重新分析。",
            "- 注意：Discord 回复不会完成审批；真实执行仍受 dry-run/mock、Policy Gate 和人工审批结果约束。",
        ]
    )
    return "\n".join(lines)


def _required_text(payload: Mapping[str, Any], field_name: str) -> str:
    value = _optional_text(payload.get(field_name))
    if value is None:
        raise ValueError(f"{field_name} must be a non-empty string.")
    return value


def _optional_text(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    stripped = sanitize_string(value).strip()
    return stripped or None


def _label(value: str | None, labels: Mapping[str, str]) -> str:
    if value is None:
        return _FALLBACK_VALUE
    label = labels.get(value)
    if label is None:
        return value
    return f"{label}（{value}）"


def _target_label(target_type: str | None, target_id: str | None) -> str:
    if target_type and target_id:
        return f"{target_type}:{target_id}"
    return target_id or target_type or _FALLBACK_VALUE


def _action_plan_lines(action_plan_summary: Mapping[str, Any]) -> list[str]:
    lines: list[str] = []
    plan_summary = _optional_text(action_plan_summary.get("summary"))
    intended_action = _optional_text(action_plan_summary.get("intended_action"))
    action_side = _optional_text(action_plan_summary.get("action_side"))
    target_symbols = _text_list(action_plan_summary.get("target_symbols"))
    if plan_summary:
        lines.append(f"- 计划摘要：{plan_summary}")
    if intended_action:
        lines.append(f"- 计划动作：{intended_action}")
    if action_side:
        lines.append(f"- 计划方向：{_label(action_side, _RISK_DIRECTION_LABELS)}")
    if target_symbols:
        lines.append(f"- 标的列表：{', '.join(target_symbols)}")

    for index, order in enumerate(_mapping_list(action_plan_summary.get("orders")), start=1):
        symbol = _optional_text(order.get("symbol")) or _FALLBACK_VALUE
        side = _optional_text(order.get("side")) or _FALLBACK_VALUE
        order_intent = _optional_text(order.get("order_intent")) or _FALLBACK_VALUE
        notional = _money_value(order.get("notional_usd"))
        portfolio_pct = _pct_value(order.get("portfolio_pct"))
        order_type = _optional_text(order.get("order_type")) or _FALLBACK_VALUE
        time_in_force = _optional_text(order.get("time_in_force")) or _FALLBACK_VALUE
        lines.append(
            f"- 订单 {index}：{symbol} {side}/{order_intent}，金额 {notional}，组合占比 {portfolio_pct}，"
            f"{order_type}，有效期 {time_in_force}"
        )

    risk_controls = action_plan_summary.get("risk_controls")
    if isinstance(risk_controls, Mapping):
        stop_loss = _pct_value(risk_controls.get("stop_loss_pct"), already_percent=True)
        take_profit = _pct_value(risk_controls.get("take_profit_pct"), already_percent=True)
        if stop_loss != _FALLBACK_VALUE or take_profit != _FALLBACK_VALUE:
            lines.append(f"- 风控：止损 {stop_loss}，止盈 {take_profit}")
        invalidation_conditions = _text_list(risk_controls.get("invalidation_conditions"))
        if invalidation_conditions:
            lines.append("- 失效条件：" + "；".join(invalidation_conditions[:4]))

    monitoring_plan = action_plan_summary.get("monitoring_plan")
    if isinstance(monitoring_plan, Mapping):
        watch_topics = _text_list(monitoring_plan.get("watch_topics"))
        duration = _optional_text(monitoring_plan.get("duration"))
        if watch_topics or duration:
            lines.append(f"- 监控：{', '.join(watch_topics) or _FALLBACK_VALUE}，周期 {duration or _FALLBACK_VALUE}")

    user_notification = action_plan_summary.get("user_notification")
    if isinstance(user_notification, Mapping):
        title = _optional_text(user_notification.get("title"))
        notification_summary = _optional_text(user_notification.get("summary"))
        if title or notification_summary:
            lines.append(f"- 用户通知：{title or _FALLBACK_VALUE}；{notification_summary or _FALLBACK_VALUE}")

    constraints = _text_list(action_plan_summary.get("constraints"))
    if constraints:
        lines.append("- 约束：" + "；".join(constraints[:4]))
    return lines


def _text_list(value: Any) -> list[str]:
    if not isinstance(value, list | tuple):
        return []
    items: list[str] = []
    for item in value:
        text = _optional_text(item)
        if text:
            items.append(text)
    return items


def _mapping_list(value: Any) -> list[Mapping[str, Any]]:
    if not isinstance(value, list | tuple):
        return []
    return [item for item in value if isinstance(item, Mapping)]


def _money_value(value: Any) -> str:
    if isinstance(value, int | float):
        return f"${value:,.0f}"
    return _optional_text(value) or _FALLBACK_VALUE


def _pct_value(value: Any, *, already_percent: bool = False) -> str:
    if isinstance(value, int | float):
        rendered = value if already_percent else value * 100
        return f"{rendered:.2f}%"
    return _optional_text(value) or _FALLBACK_VALUE
