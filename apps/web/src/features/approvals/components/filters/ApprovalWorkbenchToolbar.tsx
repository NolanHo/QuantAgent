import { Button, ListBox, Select } from '@heroui/react'

import type {
  ApprovalConfirmationLevel,
  ApprovalRiskDirection,
  ApprovalSortMode,
  ApprovalStatus,
  ApprovalWorkbenchSearch,
} from '../../types/approval-workbench.types'

const sortOptions: Array<{ label: string; value: ApprovalSortMode }> = [
  { label: '推荐度优先', value: 'recommendation' },
  { label: '即将过期优先', value: 'expires_soon' },
  { label: '风险最高优先', value: 'highest_risk' },
  { label: '最新创建优先', value: 'latest' },
]

const statusOptions: Array<{ label: string; value: ApprovalStatus | 'all' }> = [
  { label: '待处理', value: 'pending' },
  { label: '全部状态', value: 'all' },
  { label: '已批准', value: 'approved' },
  { label: '已拒绝', value: 'rejected' },
  { label: '已过期', value: 'expired' },
  { label: '已请求重分析', value: 'reanalysis_requested' },
]

const directionOptions: Array<{ label: string; value: ApprovalRiskDirection | 'all' }> = [
  { label: '全部风险方向', value: 'all' },
  { label: '增加风险', value: 'increase_risk' },
  { label: '降低风险', value: 'reduce_risk' },
  { label: '中性', value: 'neutral' },
]

const confirmationOptions: Array<{ label: string; value: ApprovalConfirmationLevel | 'all' }> = [
  { label: '全部确认等级', value: 'all' },
  { label: '强确认', value: 'strong_confirm' },
  { label: '链接确认', value: 'link_confirm' },
  { label: '仅人工', value: 'manual_only' },
]

export function ApprovalWorkbenchToolbar({
  onReset,
  onUpdateSearch,
  search,
}: {
  onReset: () => void
  onUpdateSearch: (patch: Partial<ApprovalWorkbenchSearch>) => void
  search: ApprovalWorkbenchSearch
}) {
  return (
    <section className="rounded-xl border border-hairline bg-canvas p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid gap-2">
          <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.04em] text-info">
            筛选与排序
          </p>
          <h2 className="m-0 text-title-sm font-bold text-ink">
            默认按 AI 推荐度优先，必要时切到即将过期或高风险视角
          </h2>
        </div>

        <Button size="sm" type="button" variant="outline" onPress={onReset}>
          恢复默认筛选
        </Button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <FilterSelect
          ariaLabel="审批状态"
          items={statusOptions}
          onChange={(value) => onUpdateSearch({ status: value as ApprovalWorkbenchSearch['status'] })}
          selectedKey={search.status ?? 'pending'}
        />
        <FilterSelect
          ariaLabel="风险方向"
          items={directionOptions}
          onChange={(value) => onUpdateSearch({ riskDirection: value as ApprovalWorkbenchSearch['riskDirection'] })}
          selectedKey={search.riskDirection ?? 'all'}
        />
        <FilterSelect
          ariaLabel="确认等级"
          items={confirmationOptions}
          onChange={(value) => onUpdateSearch({ confirmation: value as ApprovalWorkbenchSearch['confirmation'] })}
          selectedKey={search.confirmation ?? 'all'}
        />
        <FilterSelect
          ariaLabel="排序方式"
          items={sortOptions}
          onChange={(value) => onUpdateSearch({ sort: value as ApprovalWorkbenchSearch['sort'] })}
          selectedKey={search.sort ?? 'recommendation'}
        />
      </div>

      <div className="mt-3 rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-[12px] text-muted">
        批量处理默认不会纳入 `manual_only`、已过期或即将自动过期的审批项；批准始终只代表人工确认，不代表真实执行完成。
      </div>
    </section>
  )
}

function FilterSelect({
  ariaLabel,
  items,
  onChange,
  selectedKey,
}: {
  ariaLabel: string
  items: ReadonlyArray<{ label: string; value: string }>
  onChange: (value: string) => void
  selectedKey: string
}) {
  const selectedItem = items.find((item) => item.value === selectedKey) ?? items[0]

  return (
    <div className="grid gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-normal text-muted">{ariaLabel}</span>
      <Select
        aria-label={ariaLabel}
        selectedKey={selectedKey}
        onSelectionChange={(key) => {
          if (key !== null) {
            onChange(String(key))
          }
        }}
      >
        <Select.Trigger className="w-full">
          <Select.Value>{selectedItem?.label ?? '请选择'}</Select.Value>
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox aria-label={ariaLabel} className="max-h-80 overflow-y-auto">
            {items.map((item) => (
              <ListBox.Item key={item.value} id={item.value} textValue={item.label}>
                <div className="py-1 text-[13px] text-ink">{item.label}</div>
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  )
}
