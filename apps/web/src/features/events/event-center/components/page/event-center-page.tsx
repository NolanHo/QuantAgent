import {
  Chip,
} from '@heroui/react'
import { twMerge } from 'tailwind-merge'

import { EventScoreCard } from '@/features/event-scoring/components/EventScoreCard'
import { LinkButton } from '@/shared/ui'
import { formatRelativeMinutes } from '@/shared/utils'

import { PageSectionCard } from '@/features/mainflow/components/PageSectionCard'
import { SectionHeader } from '@/features/mainflow/components/SectionHeader'
import {
  InfoTag,
  PageHeader,
} from '@/features/mainflow/pages/shared'

import { useEventCenterPage } from '../../hooks/use-event-center-page'
import type {
  EventCenterFilterOption,
  EventCenterListItem,
  EventCenterMetric,
} from '../../types/event-center.types'

const activeChipClass = 'bg-primary/10 text-primary'
const mutedChipClass = 'bg-surface-soft text-muted-strong'

function EventCenterMetricGrid({ metrics }: { metrics: readonly EventCenterMetric[] }) {
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

function MockFilterBar({
  title,
  options,
}: {
  title: string
  options: readonly EventCenterFilterOption[]
}) {
  return (
    <div className="grid gap-2">
      <p className="m-0 text-[12px] font-bold text-muted">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip
            key={option.value}
            className={twMerge('text-body-sm font-bold', option.active ? activeChipClass : mutedChipClass)}
            size="sm"
            variant="soft"
          >
            {option.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}

function EventListRow({ item }: { item: EventCenterListItem }) {
  const { event } = item

  return (
    <article className="grid gap-3 rounded-3xl border border-hairline bg-surface p-4">
      <div className="grid gap-3 xl:grid-cols-[56px_minmax(0,1fr)_auto] xl:items-start">
        <div className="rounded-2xl bg-canvas px-3 py-2 text-center text-body-sm font-extrabold text-muted">
          {item.rankLabel}
        </div>
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <InfoTag>{item.analysisState}</InfoTag>
            <InfoTag>{event.impactDirection}</InfoTag>
            <InfoTag>{formatRelativeMinutes(event.publishedMinutesAgo)}</InfoTag>
          </div>
          <h3 className="m-0 text-title-sm font-extrabold leading-tight text-foreground">{event.title}</h3>
          <p className="m-0 text-body-sm leading-[1.55] text-muted">{event.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <LinkButton to="/events/$eventId" params={{ eventId: event.id }}>
            查看分析
          </LinkButton>
          <LinkButton to="/events/$eventId/audit" params={{ eventId: event.id }} variant="outline">
            审计
          </LinkButton>
        </div>
      </div>
      <div className="grid gap-2 border-t border-hairline pt-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.4fr)]">
        <div className="grid gap-1">
          <p className="m-0 text-[12px] font-bold text-muted">评分摘要</p>
          <p className="m-0 text-body-sm text-muted-strong">{item.scoreSummary}</p>
        </div>
        <div className="grid gap-1">
          <p className="m-0 text-[12px] font-bold text-muted">入选原因</p>
          <p className="m-0 text-body-sm text-muted-strong">{item.rowReason}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {event.industries.map((industry) => (
          <InfoTag key={industry}>{industry}</InfoTag>
        ))}
      </div>
    </article>
  )
}

export function EventsIndexPageContent() {
  const model = useEventCenterPage()

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="事件中心"
        title="高价值事件中心"
        description="从 Dashboard 进入后的事件浏览和筛选页；重点事件只提供查看分析入口，不在这里审批或执行。"
      />

      <EventCenterMetricGrid metrics={model.metrics} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
        <PageSectionCard>
          <SectionHeader
            eyebrow="今日重点事件"
            title="先看为什么值得进入分析页"
            description="重点区展示优先级、可信度、行业影响和入选原因，点击查看分析进入 `/events/:eventId`。"
          />
          <div className="grid gap-3 lg:grid-cols-2">
            {model.featuredEvents.map((event) => (
              <EventScoreCard key={event.id} event={event} />
            ))}
          </div>
        </PageSectionCard>

        <PageSectionCard>
          <SectionHeader
            eyebrow="筛选与排序"
            title="mock URL 条件入口"
            description="真实 search params / query 接入前，先固定筛选维度和排序语义，避免退回新闻流。"
          />
          <MockFilterBar title="筛选条件" options={model.filters} />
          <MockFilterBar title="排序方式" options={model.sortOptions} />
          <div className="rounded-2xl border border-dashed border-hairline-strong bg-surface p-3">
            <p className="m-0 text-body-sm text-muted">
              当前为 mock 页面：筛选芯片仅展示目标维度，后续真实 API ready 后再接 URL search params 和服务端状态。
            </p>
          </div>
        </PageSectionCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
        <PageSectionCard>
          <SectionHeader
            eyebrow="全量事件列表"
            title="每行都能完成初筛并进入详情"
            description="列表行拆开事件事实、评分摘要、行业标签和分析状态；点击整行动作进入分析页。"
          />
          <div className="grid gap-3">
            {model.listItems.map((item) => (
              <EventListRow key={item.event.id} item={item} />
            ))}
          </div>
        </PageSectionCard>

        <PageSectionCard>
          <SectionHeader
            eyebrow="轻量系统提醒"
            title="只提醒，不替代 Runtime"
            description="这些提醒帮助判断事件分析质量，但不参与事件高价值排序。"
          />
          {model.runtimeAlertEvents.length > 0 ? (
            <div className="grid gap-2">
              {model.runtimeAlertEvents.map((event) => (
                <EventScoreCard key={event.id} event={event} toDetail={false} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-hairline-strong bg-surface p-4">
              <p className="m-0 text-body-sm text-muted">
                当前没有可展示的系统提醒。
              </p>
            </div>
          )}
        </PageSectionCard>
      </section>
    </div>
  )
}
