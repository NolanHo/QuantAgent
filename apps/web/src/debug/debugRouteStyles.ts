import type { CSSProperties } from 'react'

export const debugPanelGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
  marginTop: 'var(--qa-spacing-lg)',
}

export const actionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  marginTop: 'var(--qa-spacing-lg)',
}

export const secondaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '40px',
  padding: '0 16px',
  border: '1px solid var(--qa-color-border-strong)',
  borderRadius: 'var(--qa-radius-lg)',
  background: 'var(--qa-color-surface)',
  color: 'var(--qa-color-text-strong)',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
}

export const primaryButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  border: '1px solid var(--qa-color-primary)',
  background: 'var(--qa-color-primary)',
  color: 'var(--qa-color-on-primary)',
}
