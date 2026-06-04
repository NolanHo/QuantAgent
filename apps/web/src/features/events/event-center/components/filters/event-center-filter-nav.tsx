import {
  ListBox,
  Select,
} from '@heroui/react'

import type {
  EventCenterFilterGroup,
  EventCenterFilterOption,
} from '../../types/event-center.types'

export function EventCenterFilterNav({
  groups,
  onFilterChange,
  onSortChange,
  sortOptions,
}: {
  groups: readonly EventCenterFilterGroup[]
  onFilterChange: (groupKey: string, value: string) => void
  onSortChange: (value: string) => void
  sortOptions: readonly EventCenterFilterOption[]
}) {
  return (
    <div className="rounded-3xl border border-hairline bg-surface/95 p-3 shadow-soft">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {groups.map((group) => (
            <FilterPicker
              key={group.key}
              group={group}
              onSelect={(value) => {
                onFilterChange(group.key, value)
              }}
            />
          ))}
        </div>
        <div className="lg:w-[220px]">
          <OptionPicker
            ariaLabel="选择事件排序方式"
            label="排序"
            onSelect={onSortChange}
            options={sortOptions}
          />
        </div>
      </div>
    </div>
  )
}

function FilterPicker({
  group,
  onSelect,
}: {
  group: EventCenterFilterGroup
  onSelect: (value: string) => void
}) {
  return (
    <OptionPicker
      ariaLabel={`选择${group.label}`}
      label={group.label}
      onSelect={onSelect}
      options={group.options}
    />
  )
}

function OptionPicker({
  ariaLabel,
  label,
  onSelect,
  options,
}: {
  ariaLabel: string
  label: string
  onSelect: (value: string) => void
  options: readonly EventCenterFilterOption[]
}) {
  const selectedOption = options.find((option) => option.active) ?? options[0]

  return (
    <Select
      aria-label={ariaLabel}
      selectedKey={selectedOption?.value ?? null}
      onSelectionChange={(key) => {
        const nextValue = key === null ? selectedOption?.value : String(key)

        if (nextValue) {
          onSelect(nextValue)
        }
      }}
    >
      <Select.Trigger className="h-auto min-h-14 w-full rounded-2xl border-hairline bg-canvas px-3 py-2 shadow-none">
        <Select.Value>
          <div className="grid min-w-0 gap-0.5 text-left">
            <span className="text-[11px] font-bold text-muted">{label}</span>
            <span className="truncate text-[13px] font-bold text-foreground">
              {selectedOption?.label ?? '请选择'}
            </span>
          </div>
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox aria-label={ariaLabel} className="max-h-80 overflow-y-auto">
          {options.map((option) => (
            <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
              <div className="py-1 text-[13px] font-bold text-foreground">{option.label}</div>
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}
