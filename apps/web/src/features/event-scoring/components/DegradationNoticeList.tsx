import { Chip } from '@heroui/react'

import type { EventDegradationNotice } from '../types/event-scoring.types'
import { formatDegradationTone } from '../utils/event-scoring-labels'

function getToneClass(tone: ReturnType<typeof formatDegradationTone>) {
  switch (tone) {
    case 'danger':
      return 'bg-[rgb(220_38_38_/_0.08)] text-[rgb(153_27_27)]'
    case 'warning':
      return 'bg-[rgb(245_158_11_/_0.12)] text-[rgb(146_64_14)]'
    case 'muted':
      return 'bg-[rgb(100_116_139_/_0.12)] text-[rgb(51_65_85)]'
    case 'neutral':
    default:
      return 'bg-[rgb(15_23_42_/_0.06)] text-muted-strong'
  }
}

export function DegradationNoticeList({
  notices,
}: {
  notices: readonly EventDegradationNotice[]
}) {
  if (notices.length === 0) {
    return null
  }

  return (
    <div className="grid gap-2 rounded-lg border border-dashed border-hairline-strong bg-surface-soft/70 p-3">
      {notices.map((notice) => {
        const tone = formatDegradationTone(notice.kind)

        return (
          <div key={`${notice.kind}-${notice.title}`} className="grid gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Chip className={`text-[10px] font-bold ${getToneClass(tone)}`} size="sm" variant="soft">
                {notice.title}
              </Chip>
              {notice.traceId ? (
                <span className="text-[11px] font-bold text-muted">
                  trace_id: {notice.traceId}
                </span>
              ) : null}
              {notice.requestId ? (
                <span className="text-[11px] font-bold text-muted">
                  request_id: {notice.requestId}
                </span>
              ) : null}
            </div>
            <p className="m-0 text-[11px] leading-[1.5] text-muted-strong">
              {notice.summary}
            </p>
          </div>
        )
      })}
    </div>
  )
}
