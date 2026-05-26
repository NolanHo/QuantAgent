import type { CSSProperties } from 'react'

import type { PluginConfigSupportLevel } from '../types'

export const panelGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
  marginTop: 'var(--qa-spacing-lg)',
}

export const formGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.65fr) minmax(280px, 0.95fr)',
  gap: '20px',
  alignItems: 'start',
  marginTop: 'var(--qa-spacing-xl)',
}

export const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 700,
}

export const fieldStackStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  marginTop: 'var(--qa-spacing-lg)',
}

export const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
}

export const arrayListStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
}

export const arrayItemRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: '10px',
  alignItems: 'center',
}

export const textareaStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: '13px',
  minHeight: '122px',
  resize: 'vertical',
}

export const buttonRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  marginTop: 'var(--qa-spacing-lg)',
}

export const asideListStyle: CSSProperties = {
  display: 'grid',
  gap: '12px',
  marginTop: 'var(--qa-spacing-lg)',
}

export function supportBadgeColor(level: PluginConfigSupportLevel): 'success' | 'warning' | 'danger' {
  if (level === 'supported') {
    return 'success'
  }

  if (level === 'degraded') {
    return 'warning'
  }

  return 'danger'
}
