import {
  InfoTag,
  LinkButton,
} from '@/shared/ui'

import type {
  HealthAlert,
} from '@/features/mainflow/mock-data'

export function EventCenterAlertStrip({ alerts }: { alerts: readonly HealthAlert[] }) {
  if (alerts.length === 0) {
    return null
  }

  return (
    <section className="flex flex-col gap-2 rounded-3xl border border-amber-200/70 bg-amber-50/70 px-3 py-2.5 md:flex-row md:items-center">
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-[12px] font-extrabold text-amber-800">运行提醒</span>
        <InfoTag>{String(alerts.length).padStart(2, '0')}</InfoTag>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap gap-2">
        {alerts.slice(0, 2).map((alert) => (
          <div key={alert.id} className="flex min-w-0 items-center gap-2 rounded-2xl bg-surface px-3 py-1.5">
            <InfoTag>{alert.severity}</InfoTag>
            <span className="truncate text-body-sm font-bold text-foreground">{alert.title}</span>
          </div>
        ))}
      </div>
      <div className="shrink-0">
        {alerts[0]?.relatedRunId ? (
          <LinkButton to="/runtime/agents/$runId" params={{ runId: alerts[0].relatedRunId }} variant="outline">
            查看运行态
          </LinkButton>
        ) : (
          <LinkButton to="/runtime" variant="outline">
            查看运行态
          </LinkButton>
        )}
      </div>
    </section>
  )
}
