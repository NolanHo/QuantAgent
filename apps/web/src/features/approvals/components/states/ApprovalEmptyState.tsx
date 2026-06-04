import { PageEmpty } from '../../../../app/components/PageEmpty'
import { ApprovalLinkButton } from '../shared/ApprovalLinkButton'

export function ApprovalEmptyState() {
  return (
    <PageEmpty
      title="当前筛选条件下没有审批项"
      description="审批工作台保持独立上下文，但当队列为空时，用户仍然可以回到 Dashboard 或事件中心继续复核建议。"
      cta={(
        <div className="flex flex-wrap gap-2">
          <ApprovalLinkButton to="/" variant="outline">
            返回 Dashboard
          </ApprovalLinkButton>
          <ApprovalLinkButton to="/events">
            前往事件中心
          </ApprovalLinkButton>
        </div>
      )}
    />
  )
}
