import { Card } from '@heroui/react'
import type { ReactNode } from 'react'

import type { ApprovalActionPlanSummary } from '../../types/approval-workbench.types'
import { formatRiskDirectionLabel } from '../../utils/approval-formatters'

export function ApprovalActionPlanCard({ actionPlan }: { actionPlan: ApprovalActionPlanSummary | null }) {
  if (!actionPlan) {
    return (
      <Card className="border border-hairline bg-canvas">
        <div className="grid gap-2 p-4">
          <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.04em] text-info">交易计划</p>
          <h2 className="m-0 text-title-sm font-bold text-ink">暂无结构化交易计划</h2>
          <p className="m-0 text-body-sm text-muted">当前审批没有可展示的脱敏 ActionPlan 摘要。</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="border border-hairline bg-canvas">
      <div className="grid gap-4 p-4">
        <div className="grid gap-1">
          <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.04em] text-info">交易计划</p>
          <h2 className="m-0 text-title-sm font-bold text-ink">{actionPlan.summary || 'ActionPlan 摘要'}</h2>
          <p className="m-0 text-body-sm text-muted">
            {actionPlan.intent || 'trade'} · {actionPlan.intendedAction || '未标明动作'} ·{' '}
            {formatRiskDirectionLabel(actionPlan.actionSide)}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <InfoLine label="标的" value={actionPlan.targetSymbols.join(', ') || '未提供'} />
          <InfoLine label="Broker 模式" value={actionPlan.brokerMode || '未提供'} />
          <InfoLine label="产物 ID" value={actionPlan.artifactId || '未提供'} />
          <InfoLine label="幂等键" value={actionPlan.idempotencyKey || '未提供'} />
        </div>

        {actionPlan.orders.length > 0 ? (
          <div className="grid gap-2">
            <h3 className="m-0 text-body-sm font-bold text-ink">订单明细</h3>
            <div className="overflow-hidden rounded-lg border border-hairline">
              <table className="w-full border-collapse text-left text-body-sm">
                <thead className="bg-surface-soft text-[11px] uppercase tracking-[0.04em] text-muted">
                  <tr>
                    <th className="px-3 py-2">标的</th>
                    <th className="px-3 py-2">方向</th>
                    <th className="px-3 py-2">金额</th>
                    <th className="px-3 py-2">组合占比</th>
                    <th className="px-3 py-2">类型</th>
                  </tr>
                </thead>
                <tbody>
                  {actionPlan.orders.map((order, index) => (
                    <tr key={`${order.symbol}-${index}`} className="border-t border-hairline text-muted-strong">
                      <td className="px-3 py-2 font-semibold text-ink">{order.symbol || '未知'}</td>
                      <td className="px-3 py-2">{[order.side, order.orderIntent].filter(Boolean).join(' / ') || '未知'}</td>
                      <td className="px-3 py-2">{formatMoney(order.notionalUsd)}</td>
                      <td className="px-3 py-2">{formatPct(order.portfolioPct, false)}</td>
                      <td className="px-3 py-2">{[order.orderType, order.timeInForce].filter(Boolean).join(' · ') || '未知'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <Section title="风控">
            <InfoLine label="止损" value={formatPct(actionPlan.riskControls.stopLossPct, true)} />
            <InfoLine label="止盈" value={formatPct(actionPlan.riskControls.takeProfitPct, true)} />
            <BulletList items={actionPlan.riskControls.invalidationConditions} empty="未提供失效条件" />
          </Section>
          <Section title="监控与通知">
            <InfoLine label="监控周期" value={actionPlan.monitoringPlan.duration || '未提供'} />
            <InfoLine label="监控主题" value={actionPlan.monitoringPlan.watchTopics.join(', ') || '未提供'} />
            <InfoLine label="通知策略" value={actionPlan.userNotification.deliveryPolicy || '未提供'} />
            {actionPlan.userNotification.title || actionPlan.userNotification.summary ? (
              <p className="m-0 text-body-sm text-muted">
                {[actionPlan.userNotification.title, actionPlan.userNotification.summary].filter(Boolean).join('：')}
              </p>
            ) : null}
          </Section>
        </div>

        <Section title="执行约束">
          <BulletList items={actionPlan.constraints} empty="未提供额外约束" />
        </Section>
      </div>
    </Card>
  )
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="grid content-start gap-2 rounded-lg border border-hairline bg-surface-soft/45 p-3">
      <h3 className="m-0 text-body-sm font-bold text-ink">{title}</h3>
      {children}
    </section>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="m-0 text-body-sm text-muted">
      <span className="font-semibold text-muted-strong">{label}：</span>
      {value}
    </p>
  )
}

function BulletList({ empty, items }: { empty: string; items: string[] }) {
  if (items.length === 0) {
    return <p className="m-0 text-body-sm text-muted">{empty}</p>
  }
  return (
    <ul className="m-0 grid gap-1 pl-4 text-body-sm text-muted">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function formatMoney(value: number | null) {
  if (value === null) return '未知'
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function formatPct(value: number | null, alreadyPercent: boolean) {
  if (value === null) return '未知'
  const rendered = alreadyPercent ? value : value * 100
  return `${rendered.toFixed(2)}%`
}
