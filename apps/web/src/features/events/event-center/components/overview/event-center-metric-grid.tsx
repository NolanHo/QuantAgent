import type { EventCenterMetric } from '../../types/event-center.types'

export function EventCenterMetricGrid({ metrics }: { metrics: readonly EventCenterMetric[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-3xl border border-hairline bg-surface p-4">
          <p className="m-0 text-[12px] font-bold text-muted">{metric.label}</p>
          <p className="m-0 mt-2 text-[30px] font-extrabold leading-none text-foreground">{metric.value}</p>
          <p className="m-0 mt-2 text-body-sm text-muted">{metric.description}</p>
        </div>
      ))}
    </div>
  )
}
