import type { JSX } from 'react'

import {
  arrayItemRowStyle,
  arrayListStyle,
  fieldStyle,
  inputStyle,
  labelStyle,
  secondaryButtonStyle,
  textareaStyle,
} from './PluginConfigDebug.styles'
import {
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

function renderFieldInput({
  definition,
  onChange,
  value,
}: Omit<PluginConfigFieldProps, 'issue'>): JSX.Element {
  if (definition.type === 'record' || definition.type === 'union' || (definition.type === 'array' && definition.support === 'degraded')) {
    return (
      <textarea
        aria-label={definition.label}
        onChange={(event) => {
          onChange(definition.path, event.target.value)
        }}
        placeholder={definition.placeholder ?? definition.examples?.[0] ?? ''}
        style={textareaStyle}
        value={value}
      />
    )
  }

  if (definition.type === 'boolean') {
    return (
      <select
        aria-label={definition.label}
        onChange={(event) => {
          onChange(definition.path, event.target.value)
        }}
        style={inputStyle}
        value={value}
      >
        <option value="">请选择</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    )
  }

  if (definition.enumValues && definition.enumValues.length > 0) {
    return (
      <select
        aria-label={definition.label}
        onChange={(event) => {
          onChange(definition.path, event.target.value)
        }}
        style={inputStyle}
        value={value}
      >
        <option value="">请选择</option>
        {definition.enumValues.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }

  if (definition.type === 'array' && definition.support === 'supported') {
    const items = splitArrayDraftItems(value)

    return (
      <div style={arrayListStyle}>
        {items.map((itemValue, index) => (
          <div key={`${definition.path}-${index}`} style={arrayItemRowStyle}>
            <input
              aria-label={`${definition.label} 第 ${index + 1} 项`}
              onChange={(event) => {
                const nextItems = [...items]
                nextItems[index] = event.target.value
                onChange(definition.path, joinArrayDraftValue(nextItems))
              }}
              placeholder={definition.placeholder ?? definition.examples?.[0] ?? `请输入第 ${index + 1} 项`}
              style={inputStyle}
              type="text"
              value={itemValue}
            />
            <button
              aria-label={`移除 ${definition.label} 第 ${index + 1} 项`}
              onClick={() => {
                const nextItems = items.filter((_, itemIndex) => itemIndex !== index)
                onChange(definition.path, joinArrayDraftValue(nextItems))
              }}
              style={secondaryButtonStyle}
              type="button"
            >
              删除
            </button>
          </div>
        ))}
        <button
          aria-label={`添加 ${definition.label} 项`}
          onClick={() => {
            onChange(definition.path, joinArrayDraftValue([...items, '']))
          }}
          style={secondaryButtonStyle}
          type="button"
        >
          添加一项
        </button>
      </div>
    )
  }

  return (
    <input
      autoComplete={definition.sensitive ? 'new-password' : undefined}
      aria-label={definition.label}
      onChange={(event) => {
        onChange(definition.path, event.target.value)
      }}
      placeholder={definition.placeholder ?? definition.examples?.[0] ?? ''}
      style={inputStyle}
      type={definition.sensitive ? 'password' : 'text'}
      value={value}
    />
  )
}

export function PluginConfigField({
  definition,
  issue,
  onChange,
  value,
}: PluginConfigFieldProps) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>
        {definition.label}
      </span>
      <span style={{ color: 'var(--qa-color-text-subtle)', fontSize: '13px' }}>
        {definition.description}
      </span>
      {renderFieldInput({ definition, value, onChange })}
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
        <span style={{ color: 'rgb(161, 43, 37)', fontSize: '13px', fontWeight: 700 }}>
          {issue}
        </span>
      ) : null}
    </label>
  )
}
