import { ApprovalActionDialog } from '../dialogs/ApprovalActionDialog'
import { ApprovalWorkbenchToolbar } from '../filters/ApprovalWorkbenchToolbar'
import { useApprovalWorkbenchPage } from '../../hooks/use-approval-workbench-page'
import type { ApprovalWorkbenchSearch } from '../../types/approval-workbench.types'
import { ApprovalBatchActionPanel } from '../batch/ApprovalBatchActionPanel'
import { ApprovalDetailSummary } from '../detail/ApprovalDetailSummary'
import { ApprovalList } from '../list/ApprovalList'
import { PageLoading } from '../../../../app/components/PageLoading'
import { ApprovalQueueOverview } from '../overview/ApprovalQueueOverview'
import { ApprovalErrorState } from '../states/ApprovalErrorState'
import { ApprovalPageHeader } from '../shared/ApprovalPageHeader'

export function ApprovalWorkbenchPage({
  onUpdateSearch,
  search,
}: {
  onUpdateSearch: (patch: Partial<ApprovalWorkbenchSearch>) => void
  search: ApprovalWorkbenchSearch
}) {
  const page = useApprovalWorkbenchPage(search)

  function handleReset() {
    onUpdateSearch({
      confirmation: 'all',
      riskDirection: 'all',
      sort: 'recommendation',
      status: 'pending',
    })
  }

  if (page.listQuery.isLoading && page.items.length === 0) {
    return <PageLoading message="正在加载审批工作台..." />
  }

  return (
    <div className="grid gap-5">
      <ApprovalPageHeader
        title="审批工作台"
        description="默认按推荐度排序。批准仅表示人工确认。"
      />

      <ApprovalQueueOverview overview={page.overview} />

      <ApprovalWorkbenchToolbar onReset={handleReset} onUpdateSearch={onUpdateSearch} search={search} />

      {page.actions.actionFeedback ? (
        <ApprovalErrorState
          message={page.actions.actionFeedback.message}
          requestId={page.actions.actionFeedback.requestId}
          traceId={page.actions.actionFeedback.traceId}
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <ApprovalList
          items={page.items}
          selectedIds={page.selectedIds}
          onOpenApprove={(approval) => page.actions.openSingleAction('approve', approval)}
          onOpenReject={(approval) => page.actions.openSingleAction('reject', approval)}
          onOpenReanalysis={(approval) => page.actions.openSingleAction('request_reanalysis', approval)}
          onToggleSelected={page.toggleSelection}
        />

        <div className="grid gap-4 xl:sticky xl:top-0 xl:self-start">
          <ApprovalBatchActionPanel
            eligibility={page.batchEligibility}
            selectedCount={page.selectedIds.length}
          />

          {page.items[0] ? <ApprovalDetailSummary approval={page.items[0]} /> : null}
        </div>
      </div>

      {page.actions.activeAction ? (
        <ApprovalActionDialog
          approvalItems={page.actions.activeAction.items}
          confirmLabel={page.actions.activeAction.action === 'approve' ? '确认批准' : page.actions.activeAction.action === 'reject' ? '确认拒绝' : '提交重分析'}
          errorFeedback={page.actions.actionFeedback}
          isSubmitting={page.actions.actionMutation.isPending}
          onConfirm={page.actions.confirmActiveAction}
          state={page.actions.actionState}
          title={page.actions.actionTitle}
          tone={page.actions.activeAction.action === 'reject' ? 'danger' : 'default'}
          type={page.actions.activeAction.action}
        />
      ) : null}
    </div>
  )
}
