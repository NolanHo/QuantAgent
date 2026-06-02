import { LinkButton } from '@/shared/ui'

import {
  DetailFacts,
  InfoTag,
} from '@/features/mainflow/pages/shared'

import type {
  BestActionSummary,
  DecisionHeroSummary,
  EvidenceQualitySummary,
  IndustryImpactSummary,
} from '../../types/event-detail.types'

function MetricPill({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'strong' | 'risk'
}) {
  const toneClass = {
    default: 'border-hairline bg-surface text-muted-strong',
    strong: 'border-primary/35 bg-primary/10 text-primary',
    risk: 'border-warning/30 bg-warning/10 text-warning',
  }[tone]

  return (
    <div className={`rounded-2xl border px-3 py-2 ${toneClass}`}>
      <p className="m-0 text-[11px] font-bold uppercase tracking-[0.16em] opacity-75">{label}</p>
      <p className="m-0 mt-1 text-body-sm font-extrabold">{value}</p>
    </div>
  )
}

export function DecisionBrief({ summary }: { summary: DecisionHeroSummary }) {
  const items = [
    ['影响什么', summary.impactQuestion],
    ['系统建议什么', summary.recommendedAction],
    ['为什么建议', summary.rationale],
    ['当前卡点', summary.currentBlocker],
  ] as const

  return (
    <div className="grid gap-3">
      {items.map(([label, text], index) => (
        <div key={label} className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 rounded-2xl border border-hairline bg-surface/70 p-3">
          <span className="grid size-[34px] place-items-center rounded-full bg-canvas text-[12px] font-extrabold text-muted">
            {index + 1}
          </span>
          <div className="grid gap-1">
            <p className="m-0 text-[12px] font-bold text-muted">{label}</p>
            <p className="m-0 text-body-sm font-semibold text-foreground">{text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function IndustryImpactPanel({ summary }: { summary: IndustryImpactSummary }) {
  return (
    <div className="grid gap-4 rounded-3xl border border-hairline bg-surface/50 p-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <MetricPill label="影响方向" value={summary.impactDirection} tone="strong" />
        <MetricPill label="影响强度" value={`${summary.impactStrength} / 100`} tone="strong" />
        <MetricPill label="影响窗口" value={summary.impactWindow} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <p className="m-0 text-[12px] font-bold text-muted">影响行业 / 对象</p>
          <div className="flex flex-wrap gap-2">
            {[...summary.industries, ...summary.affectedObjects].map((item) => (
              <InfoTag key={item}>{item}</InfoTag>
            ))}
          </div>
        </div>
        <div className="grid gap-2">
          <p className="m-0 text-[12px] font-bold text-muted">风险点</p>
          <ul className="m-0 grid list-none gap-2 p-0">
            {summary.riskPoints.map((item) => (
              <li key={item} className="rounded-2xl bg-canvas px-3 py-2 text-body-sm text-muted">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-hairline bg-canvas p-3">
          <p className="m-0 text-[12px] font-bold text-muted">共识</p>
          <p className="m-0 mt-1 text-body-sm text-muted-strong">{summary.consensusSummary}</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-canvas p-3">
          <p className="m-0 text-[12px] font-bold text-muted">分歧</p>
          <p className="m-0 mt-1 text-body-sm text-muted-strong">{summary.divergenceSummary}</p>
        </div>
      </div>
    </div>
  )
}

export function BestActionCard({
  action,
  approvalId,
  eventId,
  runId,
}: {
  action: BestActionSummary
  approvalId: string | null
  eventId: string
  runId: string | null
}) {
  return (
    <div className="grid gap-4 rounded-3xl border border-primary/30 bg-primary/10 p-4">
      <div className="grid gap-2">
        <p className="m-0 text-[12px] font-extrabold uppercase tracking-[0.18em] text-primary">
          单个最佳动作
        </p>
        <h2 className="m-0 text-[22px] font-extrabold leading-tight text-foreground">{action.actionTitle}</h2>
        <p className="m-0 text-body-sm text-muted">{action.triggerSummary}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <MetricPill label="建议推荐度" value={`${action.recommendationScore} / 100`} tone="strong" />
        <MetricPill label="分析置信度" value={`${action.analysisConfidence} / 100`} tone="strong" />
        <MetricPill label="风险等级" value={action.riskLevel ?? '待补充'} tone="risk" />
      </div>
      <DetailFacts
        rows={[
          `动作对象：${action.actionTarget}`,
          `逻辑理由：${action.rationale}`,
          `风险方向：${action.riskDirection ?? '待补充'}`,
          `审批状态：${action.approvalStatus}`,
          `确认等级：${action.confirmationLevel ?? '暂无'}`,
          `到期策略：${action.expirationSummary ?? '暂无'}`,
        ]}
      />
      <div className="rounded-2xl border border-hairline bg-canvas p-3">
        <p className="m-0 text-[12px] font-bold text-muted">风控边界</p>
        <p className="m-0 mt-1 text-body-sm text-muted-strong">
          评分只解释建议质量，不代表执行许可；详情页只提供进入审批或运行摘要的入口。
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {approvalId ? (
          <LinkButton to="/approvals/$approvalId" params={{ approvalId }}>
            进入审批
          </LinkButton>
        ) : (
          <InfoTag>当前事件暂无关联审批</InfoTag>
        )}
        {runId ? (
          <LinkButton to="/runtime/agents/$runId" params={{ runId }} variant="outline">
            查看运行摘要
          </LinkButton>
        ) : (
          <LinkButton to="/runtime" variant="outline">查看运行态</LinkButton>
        )}
        <LinkButton to="/events/$eventId/audit" params={{ eventId }} variant="outline">
          审计时间线
        </LinkButton>
      </div>
    </div>
  )
}

export function EvidenceSummaryPanel({ summary }: { summary: EvidenceQualitySummary }) {
  const items = [
    ['支持观点', summary.support],
    ['反方观点', summary.opposition],
    ['证据质量', summary.evidenceQuality],
    ['数据缺口', summary.dataGap],
    ['验证状态', summary.verificationNote],
  ] as const

  return (
    <ul className="m-0 grid list-none gap-3 p-0">
      {items.map(([label, text]) => (
        <li key={label} className="grid gap-1.5 border-l-2 border-hairline-strong pl-3.5">
          <p className="m-0 text-[12px] font-bold text-muted">{label}</p>
          <p className="m-0 text-body-sm text-muted">{text}</p>
        </li>
      ))}
    </ul>
  )
}
