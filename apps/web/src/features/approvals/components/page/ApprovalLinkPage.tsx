import { Button, Card, Chip } from '@heroui/react'

import { PageLoading } from '../../../../app/components/PageLoading'
import { useApprovalLinkContextQuery } from '../../queries/use-approval-link-context'
import { formatConfirmationLabel, formatExpirationActionLabel, formatRiskDirectionLabel } from '../../utils/approval-formatters'
import { ApprovalPageHeader } from '../shared/ApprovalPageHeader'
import { ApprovalLinkButton } from '../shared/ApprovalLinkButton'

function maskToken(token: string) {
  if (token.length <= 8) {
    return '•'.repeat(token.length)
  }
  return `${token.slice(0, 4)}••••${token.slice(-4)}`
}

function getStatusTone(status: ApprovalLinkStatus) {
  if (status === 'valid') return 'success'
  if (status === 'near_expiry' || status === 'permission_mismatch') return 'warning'
  if (status === 'expired' || status === 'invalid') return 'danger'
  return 'default'
}

function getStatusLabel(status: ApprovalLinkStatus) {
  if (status === 'valid') return '可用'
  if (status === 'near_expiry') return '即将过期'
  if (status === 'expired') return '已过期'
  if (status === 'used') return '已使用'
  if (status === 'invalid') return '无效'
  return '需要更强确认'
}

function LinkStateCard({
  title,
  description,
  actionLabel,
}: {
  title: string
  description: string
  actionLabel: string
}) {
  return (
    <section className="rounded-[20px] border border-hairline bg-canvas p-5 shadow-sm">
      <div className="grid gap-3">
        <div className="grid gap-1">
          <h1 className="m-0 text-title-sm font-bold text-ink">{title}</h1>
          <p className="m-0 text-body-sm text-muted">{description}</p>
        </div>
        <ApprovalLinkButton to="/login" variant="outline">
          {actionLabel}
        </ApprovalLinkButton>
      </div>
    </section>
  )
}

function ContextFact({
  label,
  value,
  emphasis = false,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div className="grid gap-1 rounded-2xl border border-hairline bg-canvas px-4 py-3">
      <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted">
        {label}
      </p>
      <p className={emphasis ? 'm-0 text-body-md font-semibold text-ink' : 'm-0 text-body-sm text-muted-strong'}>
        {value}
      </p>
    </div>
  )
}

type ApprovalLinkStatus = ReturnType<typeof useApprovalLinkContextQuery>['data'] extends infer T
  ? T extends { status: infer S }
    ? S
    : never
  : never

export function ApprovalLinkPage({ token }: { token: string }) {
  const contextQuery = useApprovalLinkContextQuery(token)
  const context = contextQuery.data

  if (contextQuery.isError) {
    return (
      <LinkStateCard
        actionLabel="返回登录"
        description="请稍后重试，或返回登录后从审批工作台打开对应审批。"
        title="授权上下文加载失败"
      />
    )
  }

  if (contextQuery.isLoading) {
    return <PageLoading message="正在加载授权上下文..." />
  }

  if (!context) {
    return (
      <LinkStateCard
        actionLabel="返回登录"
        description="未找到可展示的最小授权上下文，请登录后从审批工作台继续处理。"
        title="授权链接不可用"
      />
    )
  }

  const canOpenContext = context.approvalId !== 'unknown' && context.eventId !== 'unknown'
  const restrictedActionReason =
    context.disabledReason ?? '一次性授权页首版只展示最小上下文；真实批准/拒绝需要回到后台审批详情完成。'

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_28%),linear-gradient(180deg,rgb(248,250,252),rgb(241,245,249))] px-lg py-xl sm:px-xl">
      <div className="mx-auto grid w-full max-w-[1120px] gap-5">
        <div className="grid justify-items-center text-center">
          <div className="grid w-full max-w-[640px] gap-3 rounded-[24px] border border-white/70 bg-white/78 px-5 py-5 shadow-sm backdrop-blur sm:px-6">
            <ApprovalPageHeader
              align="center"
              size="hero"
              title="一次性授权确认"
              description="只展示链接确认必需的信息。实际审批动作仍在后台完成。"
            />

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Chip color={getStatusTone(context.status)} size="sm" variant="soft">
                {getStatusLabel(context.status)}
              </Chip>
              <Chip size="sm" variant="soft">
                {formatConfirmationLabel(context.confirmationLevel)}
              </Chip>
              <Chip size="sm" variant="soft">
                {context.expiresInLabel}
              </Chip>
            </div>
          </div>
        </div>

        <Card className="overflow-hidden border border-hairline bg-canvas shadow-sm">
          <div className="grid gap-6 bg-[linear-gradient(135deg,rgba(59,130,246,0.08),rgba(14,203,129,0.06))] p-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)]">
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Chip size="sm" variant="soft">
                  风险方向：{formatRiskDirectionLabel(context.riskDirection)}
                </Chip>
                <Chip size="sm" variant="soft">
                  风险等级：{context.riskLevel}
                </Chip>
                <Chip size="sm" variant="soft">
                  到期策略：{formatExpirationActionLabel(context.expirationAction)}
                </Chip>
              </div>

              <div className="grid gap-2">
                <h2 className="m-0 text-title-lg font-bold text-ink">{context.actionLabel}</h2>
                <p className="m-0 max-w-[62ch] text-body-sm leading-6 text-muted">
                  {context.eventTitle}
                </p>
                <p className="m-0 max-w-[62ch] text-body-sm leading-6 text-muted">
                  当前入口只保留最小上下文，不在这里直接执行后台审批动作。
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-[20px] border border-white/70 bg-white/80 p-4 backdrop-blur">
              <ContextFact emphasis label="Token 摘要" value={maskToken(token)} />
              <ContextFact emphasis label="剩余时间" value={context.expiresInLabel} />
              <ContextFact label="审计请求" value={context.requestId} />
            </div>
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Card className="border border-hairline bg-canvas shadow-sm">
            <div className="grid gap-4 p-5">
              <div className="grid gap-1">
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.08em] text-info">
                  确认信息
                </p>
                <h2 className="m-0 text-title-sm font-bold text-ink">只保留做判断必须看到的内容</h2>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <ContextFact emphasis label="审批项" value={context.actionLabel} />
                <ContextFact emphasis label="关联事件" value={context.eventTitle} />
                <ContextFact label="风险方向" value={formatRiskDirectionLabel(context.riskDirection)} />
                <ContextFact label="风险等级" value={context.riskLevel} />
                <ContextFact label="确认等级" value={formatConfirmationLabel(context.confirmationLevel)} />
                <ContextFact label="到期策略" value={formatExpirationActionLabel(context.expirationAction)} />
              </div>

              <div className="rounded-2xl border border-hairline bg-surface-soft px-4 py-4">
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted">
                  触发摘要
                </p>
                <p className="mt-2 mb-0 text-body-sm leading-6 text-muted-strong">
                  {context.triggerSummary}
                </p>
              </div>
            </div>
          </Card>

          <div className="grid gap-4">
            <Card className="border border-warning/25 bg-warning/5 shadow-sm">
              <div className="grid gap-4 p-5">
                <div className="grid gap-1">
                  <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.08em] text-warning">
                    动作受限
                  </p>
                  <h2 className="m-0 text-title-sm font-bold text-ink">公开授权页不直接执行批准或拒绝</h2>
                </div>

                <div className="grid gap-2 rounded-2xl border border-warning/20 bg-canvas/80 px-4 py-4 text-body-sm leading-6 text-muted">
                  <p className="m-0">{restrictedActionReason}</p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button isDisabled size="sm" variant="primary">
                    受限批准
                  </Button>
                  <Button isDisabled size="sm" variant="danger-soft">
                    受限拒绝
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="border border-hairline bg-canvas shadow-sm">
              <div className="grid gap-4 p-5">
                <div className="grid gap-1">
                  <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.08em] text-info">
                    下一步
                  </p>
                  <h2 className="m-0 text-title-sm font-bold text-ink">回到受控入口继续处理</h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  {canOpenContext ? (
                    <>
                      <ApprovalLinkButton to="/approvals/$approvalId" params={{ approvalId: context.approvalId }} variant="primary">
                        打开后台审批详情
                      </ApprovalLinkButton>
                      <ApprovalLinkButton to="/events/$eventId" params={{ eventId: context.eventId }} variant="outline">
                        查看关联事件
                      </ApprovalLinkButton>
                    </>
                  ) : (
                    <ApprovalLinkButton to="/login" variant="primary">
                      返回登录
                    </ApprovalLinkButton>
                  )}

                  <ApprovalLinkButton to="/approvals" variant="outline">
                    返回审批工作台
                  </ApprovalLinkButton>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
