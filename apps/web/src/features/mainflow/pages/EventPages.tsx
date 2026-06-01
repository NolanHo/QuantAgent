import { approvalsQueue, featuredEvents, healthAlerts, runtimeAgentRuns } from '../mock-data'
import { EventCard } from '../components/EventCard'
import { LinkButton } from '../components/LinkButton'
import { PageSectionCard } from '../components/PageSectionCard'
import { SectionHeader } from '../components/SectionHeader'
import { DetailFacts, InfoTag, PageHeader } from './shared'

export function EventsIndexPageContent() {
  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="事件中心"
        title="高价值事件中心"
        description="从 Dashboard 进入后的事件浏览和筛选页。这里承接重点事件扩展与全量浏览，不承担审批或运行态排障。"
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <PageSectionCard>
          <SectionHeader
            eyebrow="筛选与排序"
            title="筛选条件进入 URL search params"
            description="时间范围、行业、事件可信度、分析状态、来源类型和排序方式都需要可恢复；本轮先用结构化占位表达入口。"
          />
          <div className="flex flex-wrap gap-2">
            {['时间范围', '行业', '事件可信度', '分析状态', '来源类型', '最新 + 高价值混合'].map((item) => (
              <InfoTag key={item}>{item}</InfoTag>
            ))}
          </div>
        </PageSectionCard>

        <PageSectionCard>
          <SectionHeader
            eyebrow="轻量系统提醒"
            title="只提醒，不替代 Runtime"
            description="只放影响当前浏览判断质量的异常，详细排障仍回到 Runtime。"
          />
          <div className="grid gap-3">
            {healthAlerts.map((alert) => (
              <article key={alert.id} className="grid gap-1.5 rounded-lg border border-hairline bg-surface-soft p-3">
                <div className="flex flex-wrap gap-2">
                  <InfoTag>{alert.severity}</InfoTag>
                </div>
                <p className="m-0 text-title-sm font-bold text-ink">{alert.title}</p>
                <p className="m-0 text-body-sm text-muted">{alert.summary}</p>
                <div className="flex flex-wrap gap-2">
                  <LinkButton to="/runtime" variant="outline">进入运行态</LinkButton>
                </div>
              </article>
            ))}
          </div>
        </PageSectionCard>
      </section>

      <PageSectionCard>
        <SectionHeader
          eyebrow="重点事件与列表"
          title="重点事件区与完整列表并存"
          description="重点区解释为什么值得先看，事件卡片负责稳定进入详情页和审计页。"
        />
        <div className="grid gap-3">
          {featuredEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </PageSectionCard>
    </div>
  )
}

export function EventDetailPageContent({ eventId }: { eventId: string }) {
  const event = featuredEvents.find((item) => item.id === eventId) ?? featuredEvents[0]!
  const relatedApproval = approvalsQueue.find((item) => item.eventId === event.id) ?? null
  const relatedRun = runtimeAgentRuns.find((item) => item.eventId === event.id) ?? null

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="事件详情 / 决策"
        title={event.title}
        description="事件事实、行业影响分析和最佳动作建议必须分区展示；本页不直接批准或执行高风险动作。"
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)]">
        <PageSectionCard>
          <SectionHeader
            eyebrow="事件事实"
            title="左栏优先给事实与验证状态"
            description="事实区回答这件事是什么、来自哪里、目前有多可信。"
          />
          <DetailFacts
            rows={[
              `来源：${event.source}`,
              `发布时间：${event.publishedAt}`,
              `当前状态：${event.status}`,
              `事件可信度：${event.credibility}`,
              `行业影响强度：${event.impactStrength}`,
              `时效性：${event.timeliness}`,
              `入选原因：${event.reason}`,
              `事实摘要：${event.summary}`,
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <LinkButton to="/events" variant="outline">返回事件中心</LinkButton>
            <LinkButton to="/events/$eventId/audit" params={{ eventId: event.id }} variant="outline">
              审计时间线
            </LinkButton>
          </div>
        </PageSectionCard>

        <PageSectionCard>
          <SectionHeader
            eyebrow="行业影响与最佳动作"
            title="右栏首屏优先展示分析和动作"
            description="首版只展示一个最佳动作，不做多候选动作比较。审批或重分析都从这里继续进入。"
          />
          <DetailFacts
            rows={[
              `影响行业：${event.industries.join(' / ')}`,
              `影响方向：${event.actionHint}`,
              `最佳动作：${event.actionHint}`,
              `建议说明：${event.reason}`,
              relatedApproval ? `审批状态：已生成 ${relatedApproval.confirmationLevel}` : '审批状态：当前暂无 ApprovalRequest',
            ]}
          />
          <div className="flex flex-wrap gap-2">
            {relatedApproval ? (
              <LinkButton to="/approvals/$approvalId" params={{ approvalId: relatedApproval.id }}>
                进入审批
              </LinkButton>
            ) : (
              <InfoTag>当前事件暂无关联审批</InfoTag>
            )}
            {relatedRun ? (
              <LinkButton to="/runtime/agents/$runId" params={{ runId: relatedRun.id }} variant="outline">
                查看运行摘要
              </LinkButton>
            ) : (
              <LinkButton to="/runtime" variant="outline">查看运行态</LinkButton>
            )}
          </div>
        </PageSectionCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <PageSectionCard>
          <SectionHeader
            eyebrow="支持 / 反方观点"
            title="只展示结构化摘要"
            description="不展示完整 chain-of-thought，只保留支持观点、反方观点、证据质量和数据缺口。"
          />
          <ul className="m-0 grid list-none gap-3 p-0">
            {[
              ['支持观点', '出口限制升级直接压缩设备链和上游材料未来两个季度的资本开支预期。'],
              ['反方观点', '若后续出现政策缓释或国产替代提速，板块回撤可能快于预期修复。'],
              ['证据质量', '当前为双信源校验，仍缺监管层二次确认。'],
              ['数据缺口', '还缺少二级供应链价格与跨行业对冲信号。'],
            ].map(([label, text]) => (
              <li key={label} className="grid gap-1.5 border-l-2 border-hairline-strong pl-3.5">
                <p className="m-0 text-[12px] font-bold text-muted">{label}</p>
                <p className="m-0 text-body-sm text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </PageSectionCard>

        <PageSectionCard>
          <SectionHeader
            eyebrow="运行摘要"
            title="把深层排障入口留给 Runtime"
            description="详情页只给结构化摘要和链路入口，不替代运行态诊断界面。"
          />
          <DetailFacts
            rows={[
              `关联 Agent Run：${relatedRun?.id ?? '暂无'}`,
              `最近分析状态：${relatedRun?.status ?? event.status}`,
              `provider_policy：${relatedRun?.providerPolicy ?? '待补充'}`,
              `trace_id：${relatedRun?.traceId ?? '待补充'}`,
            ]}
          />
          <div className="flex flex-wrap gap-2">
            {relatedRun ? (
              <LinkButton to="/runtime/agents/$runId" params={{ runId: relatedRun.id }} variant="outline">
                查看 Agent Run 详情
              </LinkButton>
            ) : null}
            <LinkButton to="/runtime" variant="outline">打开 Runtime</LinkButton>
          </div>
        </PageSectionCard>
      </section>
    </div>
  )
}

export function EventAuditPageContent({ eventId }: { eventId: string }) {
  const event = featuredEvents.find((item) => item.id === eventId) ?? featuredEvents[0]!
  const relatedApproval = approvalsQueue.find((item) => item.eventId === event.id) ?? null
  const relatedRun = runtimeAgentRuns.find((item) => item.eventId === event.id) ?? null

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="事件级审计"
        title="事件时间线"
        description="按事件回放建议生成、重分析和人工动作。这里只做时间线骨架，不发明新的审计 contract。"
      />

      <PageSectionCard>
        <SectionHeader
          eyebrow="当前事件摘要"
          title={event.title}
          description="时间线围绕事件而不是围绕全局日志组织，让用户能顺着主线回放建议如何变成现在这样。"
        />
        <DetailFacts
          rows={[
            `事件可信度：${event.credibility}`,
            `行业影响强度：${event.impactStrength}`,
            `当前状态：${event.status}`,
            `关联审批：${relatedApproval?.id ?? '暂无'}`,
            `关联运行：${relatedRun?.id ?? '暂无'}`,
          ]}
        />
      </PageSectionCard>

      <PageSectionCard>
        <SectionHeader
          eyebrow="时间线节点"
          title={`事件 ${event.id} 的关键节点`}
          description="建议变更节点、重分析节点和人工动作节点都需要能跳回相关详情页。"
        />
        <div className="grid gap-3">
          {[
            ['10:24 · event.state_changed', 'Source 插件捕获事件并进入路由阶段。'],
            ['10:31 · industry.analysis.completed', '行业影响分析输出结构化摘要并生成最佳动作候选。'],
            ['10:36 · approval.requested', '高风险建议进入人工确认链路，等待 strong_confirm。'],
            ['10:42 · reanalysis.requested', '因工具超时触发补充验证和重分析请求。'],
          ].map(([title, copy]) => (
            <article key={title} className="grid gap-1.5 border-l-2 border-hairline-strong pl-3.5">
              <p className="m-0 text-[12px] font-bold text-muted">{title}</p>
              <p className="m-0 text-body-sm text-muted">{copy}</p>
            </article>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {relatedRun ? (
            <LinkButton to="/runtime/agents/$runId" params={{ runId: relatedRun.id }} variant="outline">
              查看运行详情
            </LinkButton>
          ) : null}
          {relatedApproval ? (
            <LinkButton to="/approvals/$approvalId" params={{ approvalId: relatedApproval.id }} variant="outline">
              查看审批详情
            </LinkButton>
          ) : null}
        </div>
      </PageSectionCard>
    </div>
  )
}
