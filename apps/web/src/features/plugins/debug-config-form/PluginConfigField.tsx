import type { JSX } from 'react'
import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from '@heroui/react'

import {
  arrayItemRowStyle,
  arrayListStyle,
  fieldStyle,
  textareaStyle,
} from './PluginConfigDebug.styles'
import {
  fieldConstraintCopies,
  joinArrayDraftValue,
  splitArrayDraftItems,
  splitArrayPreview,
} from './plugin-config-debug-model'
import type { PluginConfigFieldDefinition } from './types'

type PluginConfigFieldProps = {
  definition: PluginConfigFieldDefinition
  issue?: string
  onChange: (path: string, nextValue: string) => void
  value: string
}

type FieldOption = {
  id: string
  label: string
}

function renderSelectInput({
  definition,
  onChange,
  options,
  value,
}: Omit<PluginConfigFieldProps, 'issue'> & { options: FieldOption[] }): JSX.Element {
  return (
    <Select<FieldOption>
      aria-label={definition.label}
      fullWidth
      onSelectionChange={(key) => {
        onChange(definition.path, key === null ? '' : String(key))
      }}
      selectedKey={value || null}
      variant="primary"
    >
      <Select.Trigger>
        <Select.Value>{value || '请选择'}</Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox<FieldOption> items={options}>
          {(option) => <ListBox.Item id={option.id}>{option.label}</ListBox.Item>}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

function renderFieldInput({
  definition,
  onChange,
  value,
}: Omit<PluginConfigFieldProps, 'issue'>): JSX.Element {
  if (definition.type === 'record' || definition.type === 'union' || (definition.type === 'array' && definition.support === 'degraded')) {
    return (
      <TextArea
        aria-label={definition.label}
        fullWidth
        onChange={(event) => {
          onChange(definition.path, event.target.value)
        }}
        placeholder={definition.placeholder ?? definition.examples?.[0] ?? ''}
        style={textareaStyle}
        value={value}
        variant="primary"
      />
    )
  }

  if (definition.type === 'boolean') {
    return renderSelectInput({
      definition,
      onChange,
      value,
      options: [
        { id: 'true', label: 'true' },
        { id: 'false', label: 'false' },
      ],
    })
  }

  if (definition.enumValues && definition.enumValues.length > 0) {
    return renderSelectInput({
      definition,
      onChange,
      value,
      options: definition.enumValues.map((option) => ({ id: option, label: option })),
    })
  }

  if (definition.type === 'array' && definition.support === 'supported') {
    const items = splitArrayDraftItems(value)

    return (
      <div style={arrayListStyle}>
        {items.map((itemValue, index) => (
          <div key={`${definition.path}-${index}`} style={arrayItemRowStyle}>
            <Input
              aria-label={`${definition.label} 第 ${index + 1} 项`}
              aria-labelledby={undefined}
              fullWidth
              onChange={(event) => {
                const nextItems = [...items]
                nextItems[index] = event.target.value
                onChange(definition.path, joinArrayDraftValue(nextItems))
              }}
              placeholder={definition.placeholder ?? definition.examples?.[0] ?? `请输入第 ${index + 1} 项`}
              type="text"
              value={itemValue}
              variant="primary"
            />
            <Button
              aria-label={`移除 ${definition.label} 第 ${index + 1} 项`}
              onPress={() => {
                const nextItems = items.filter((_, itemIndex) => itemIndex !== index)
                onChange(definition.path, joinArrayDraftValue(nextItems))
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              删除
            </Button>
          </div>
        ))}
        <Button
          aria-label={`添加 ${definition.label} 项`}
          onPress={() => {
            onChange(definition.path, joinArrayDraftValue([...items, '']))
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          添加一项
        </Button>
      </div>
    )
  }

  return (
    <Input
      autoComplete={definition.sensitive ? 'new-password' : undefined}
      aria-label={definition.label}
      fullWidth
      onChange={(event) => {
        onChange(definition.path, event.target.value)
      }}
      placeholder={definition.placeholder ?? definition.examples?.[0] ?? ''}
      type={definition.sensitive ? 'password' : 'text'}
      value={value}
      variant="primary"
    />
  )
}

export function PluginConfigField({
  definition,
  issue,
  onChange,
  value,
}: PluginConfigFieldProps) {
  const constraintCopies = fieldConstraintCopies(definition)
  const requirementCopy = definition.required && value.trim().length > 0 ? null : definition.required ? '必填' : '可选'
  const requirementColor =
    requirementCopy === '必填' ? 'rgb(161, 43, 37)' : 'var(--qa-color-primary)'
  const fieldMeta = (
    <>
      <Label>
        {definition.label}
      </Label>
      <Description>
        {definition.description}
      </Description>
      {requirementCopy ? (
        <span style={{ fontSize: '13px' }}>
          <strong style={{ color: requirementColor }}>{requirementCopy}</strong>
        </span>
      ) : null}
      {constraintCopies.length > 0 ? (
        <span style={{ color: 'var(--qa-color-text-subtle)', fontSize: '13px' }}>
          {constraintCopies.join(' · ')}
        </span>
      ) : null}
    </>
  )
  const fieldNotes = (
    <>
      {definition.type === 'array' && definition.support === 'supported' && value ? (
        <span style={{ color: 'var(--qa-color-text-subtle)', fontSize: '13px' }}>
          当前数组项：{splitArrayPreview(value).join(' / ')}
        </span>
      ) : null}
      {definition.supportNote ? (
        <span style={{ color: 'var(--qa-color-text-subtle)', fontSize: '13px' }}>
          {definition.supportNote}
        </span>
      ) : null}
      {issue ? (
        <FieldError style={{ color: 'rgb(161, 43, 37)', fontSize: '13px', fontWeight: 700 }}>
          {issue}
        </FieldError>
      ) : null}
    </>
  )

  if (definition.type === 'array' && definition.support === 'supported') {
    return (
      <div style={fieldStyle}>
        {fieldMeta}
        {renderFieldInput({ definition, value, onChange })}
        {fieldNotes}
      </div>
    )
  }

  return (
    <TextField style={fieldStyle} isInvalid={Boolean(issue)} isRequired={definition.required}>
      {fieldMeta}
      {renderFieldInput({ definition, value, onChange })}
      {fieldNotes}
    </TextField>
  )
}
