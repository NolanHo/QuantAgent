import {
  InfoTag,
  LinkButton,
} from '@/shared/ui'

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
  return (
    <div className="grid gap-3 rounded-3xl border border-primary/25 bg-primary/5 p-4">
      <div className="grid gap-1">
        <p className="m-0 text-[12px] font-extrabold text-primary">处理建议</p>
        <h2 className="m-0 text-[26px] font-extrabold leading-tight text-foreground">{summary.recommendedAction}</h2>
      </div>
      <div className="grid gap-2 rounded-2xl bg-surface px-3 py-2">
        <p className="m-0 text-body-sm font-bold text-foreground">{summary.impactQuestion}</p>
        <p className="m-0 text-body-sm text-muted-strong">{summary.rationale}</p>
      </div>
      <div className="rounded-2xl bg-warning/10 px-3 py-2 text-body-sm font-bold text-warning">
        {summary.currentBlocker}
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
    <div className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <MetricPill label="建议推荐度" value={`${action.recommendationScore} / 100`} tone="strong" />
        <MetricPill label="分析置信度" value={`${action.analysisConfidence} / 100`} tone="strong" />
        <MetricPill label="风险等级" value={action.riskLevel ?? '待补充'} tone="risk" />
      </div>
      <div className="grid gap-2 rounded-3xl bg-canvas p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <InfoTag>{action.actionTarget}</InfoTag>
          <InfoTag>{action.riskDirection ?? '待补充'}</InfoTag>
          <InfoTag>{action.approvalStatus}</InfoTag>
          <InfoTag>{action.confirmationLevel ?? '暂无确认等级'}</InfoTag>
        </div>
        {action.expirationSummary ? (
          <p className="m-0 text-body-sm font-bold text-muted-strong">{action.expirationSummary}</p>
        ) : null}
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
            运行详情
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

export function InvestmentDecisionPanel({
  action,
  approvalId,
  decision,
  eventId,
  impact,
  runId,
}: {
  action: BestActionSummary
  approvalId: string | null
  decision: DecisionHeroSummary
  eventId: string
  impact: IndustryImpactSummary
  runId: string | null
}) {
  return (
    <div className="grid gap-4">
      <DecisionBrief summary={decision} />
      <BestActionCard action={action} approvalId={approvalId} eventId={eventId} runId={runId} />
      <div className="grid gap-3 rounded-3xl border border-hairline bg-surface/70 p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <MetricPill label="影响方向" value={impact.impactDirection} tone="strong" />
          <MetricPill label="影响强度" value={`${impact.impactStrength} / 100`} tone="strong" />
          <MetricPill label="影响窗口" value={impact.impactWindow} />
        </div>
        <div className="flex flex-wrap gap-2">
          {[...impact.industries, ...impact.affectedObjects].map((item) => (
            <InfoTag key={item}>{item}</InfoTag>
          ))}
        </div>
      </div>
    </div>
  )
}

export function EvidenceAndDiagnosticsPanel({
  eventId,
  evidence,
  runId,
}: {
  eventId: string
  evidence: EvidenceQualitySummary
  runId: string | null
}) {
  return (
    <div className="grid gap-4">
      <EvidenceSummaryPanel summary={evidence} />
      <div className="flex flex-wrap gap-2">
        {runId ? (
          <LinkButton to="/runtime/agents/$runId" params={{ runId }} variant="outline">
            运行详情
          </LinkButton>
        ) : (
          <LinkButton to="/runtime" variant="outline">运行态</LinkButton>
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
