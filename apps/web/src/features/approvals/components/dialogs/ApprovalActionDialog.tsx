import { Button, Input, Modal, TextField, useOverlayState } from '@heroui/react'
import { useEffect, useState } from 'react'

import type { ApprovalActionFeedback, ApprovalActionType, ApprovalWorkbenchItem } from '../../types/approval-workbench.types'
import { maskApprovalTraceIdentifier, toSafeApprovalErrorMessage } from '../../utils/approval-error-display'
import { toActionCopy } from '../../utils/approval-formatters'

export function ApprovalActionDialog({
  approvalItems,
  confirmLabel,
  errorFeedback,
  isSubmitting = false,
  onConfirm,
  state,
  title,
  tone = 'default',
  type,
}: {
  approvalItems: readonly ApprovalWorkbenchItem[]
  confirmLabel: string
  errorFeedback?: ApprovalActionFeedback | null
  isSubmitting?: boolean
  onConfirm: (reason?: string) => void
  state: ReturnType<typeof useOverlayState>
  title: string
  tone?: 'default' | 'danger'
  type: ApprovalActionType
}) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!state.isOpen) {
      setReason('')
    }
  }, [state.isOpen])

  const needsReason = type === 'request_reanalysis'
  const confirmVariant = tone === 'danger' ? 'danger-soft' : 'primary'

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog className="w-full max-w-[min(32rem,calc(100vw-2rem))] overflow-hidden">
            <Modal.Header className="border-b border-hairline px-5 py-4">
              <Modal.Heading>{title}</Modal.Heading>
              <Modal.CloseTrigger aria-label="关闭" />
            </Modal.Header>
            <Modal.Body className="px-5 py-4">
              <div className="grid gap-3">
                <p className="m-0 text-sm text-muted-strong">{toActionCopy(type)}</p>
                <div className="rounded-lg border border-hairline bg-surface-soft px-3 py-3 text-[13px] text-muted">
                  <div>目标审批数：{approvalItems.length}</div>
                  <div>审批项：{approvalItems.map((item) => item.actionLabel).join('；')}</div>
                </div>
                {errorFeedback ? (
                  <div className="rounded-lg border border-trading-down/25 bg-trading-down/5 px-3 py-3 text-[12px] text-trading-down">
                    {toSafeApprovalErrorMessage(errorFeedback.message)} · request_id：
                    {maskApprovalTraceIdentifier(errorFeedback.requestId)} · trace_id：
                    {maskApprovalTraceIdentifier(errorFeedback.traceId)}
                  </div>
                ) : null}
                {needsReason ? (
                  <TextField value={reason} onChange={setReason}>
                    <Input
                      aria-label="重分析原因"
                      className="w-full"
                      placeholder="填写为什么需要重新分析，例如信源不足、时效变化或风险判断冲突"
                      variant="secondary"
                    />
                  </TextField>
                ) : null}
              </div>
            </Modal.Body>
            <Modal.Footer className="border-t border-hairline px-5 py-4">
              <Button isDisabled={isSubmitting} variant="outline" onPress={state.close}>
                取消
              </Button>
              <Button
                isDisabled={isSubmitting || (needsReason && !reason.trim())}
                variant={confirmVariant}
                onPress={() => onConfirm(reason.trim() || undefined)}
              >
                {isSubmitting ? '处理中...' : confirmLabel}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
