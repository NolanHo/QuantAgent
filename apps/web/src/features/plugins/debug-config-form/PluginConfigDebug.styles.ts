import type { CSSProperties } from 'react'

import type { PluginConfigSupportLevel } from './types'

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

export const cardStyle: CSSProperties = {
  border: '1px solid var(--qa-color-border-subtle)',
  borderRadius: 'var(--qa-radius-xl)',
  background: 'var(--qa-color-surface)',
  padding: '18px',
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

export const labelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '14px',
  fontWeight: 700,
  color: 'var(--qa-color-text-strong)',
}

export const inputStyle: CSSProperties = {
  minHeight: '42px',
  border: '1px solid var(--qa-color-border-strong)',
  borderRadius: 'var(--qa-radius-lg)',
  padding: '10px 12px',
  background: 'var(--qa-color-background)',
  color: 'var(--qa-color-text-strong)',
}

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: '122px',
  resize: 'vertical',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: '13px',
}

export const badgeBaseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 700,
}

export const buttonRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  marginTop: 'var(--qa-spacing-lg)',
}

export const primaryButtonStyle: CSSProperties = {
  minHeight: '40px',
  border: '1px solid var(--qa-color-primary)',
  borderRadius: 'var(--qa-radius-lg)',
  background: 'var(--qa-color-primary)',
  color: 'var(--qa-color-on-primary)',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 700,
  padding: '0 16px',
}

export const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: 'var(--qa-color-surface)',
  border: '1px solid var(--qa-color-border-strong)',
  color: 'var(--qa-color-text-strong)',
}

export const asideListStyle: CSSProperties = {
  display: 'grid',
  gap: '12px',
  marginTop: 'var(--qa-spacing-lg)',
}

export function supportBadgeStyle(level: PluginConfigSupportLevel): CSSProperties {
  if (level === 'supported') {
    return {
      ...badgeBaseStyle,
      background: 'rgba(17, 135, 90, 0.12)',
      color: 'rgb(17, 135, 90)',
    }
  }

  if (level === 'degraded') {
    return {
      ...badgeBaseStyle,
      background: 'rgba(184, 98, 0, 0.12)',
      color: 'rgb(164, 87, 0)',
    }
  }

  return {
    ...badgeBaseStyle,
    background: 'rgba(175, 52, 45, 0.12)',
    color: 'rgb(161, 43, 37)',
  }
}
