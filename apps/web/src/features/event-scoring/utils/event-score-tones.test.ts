import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  getImpactTone,
  getPriorityTone,
  getRecommendationTone,
  getReliabilityTone,
} from './event-score-tones'

const forbiddenThemeSemantics = [
  'primary',
  'secondary',
  'success',
  'danger',
  'warning',
  'info',
  'trading-up',
  'trading-down',
]

function expectIsolatedScoreTone(tone: ReturnType<typeof getRecommendationTone>) {
  const joinedClasses = [
    tone.panelClass,
    tone.scoreClass,
    tone.tagClass,
  ].join(' ')

  expect(joinedClasses).toContain('--qa-score-')

  for (const semantic of forbiddenThemeSemantics) {
    expect(joinedClasses).not.toContain(semantic)
  }
}

describe('event score tones', () => {
  it('uses isolated score tokens for priority instead of brand semantics', () => {
    expect(getPriorityTone('S', 91).label).toBe('重点')
    expect(getPriorityTone('S', 91).scoreClass).toContain('--qa-score-pink-strong')
    expect(getPriorityTone('A', 74).label).toBe('关注')
    expect(getPriorityTone('A', 74).scoreClass).toContain('--qa-score-pink-bg')
    expectIsolatedScoreTone(getPriorityTone('S', 91))
  })

  it('uses one neutral tone for scores below 60', () => {
    expect(getReliabilityTone(58).label).toBe('低分记录')
    expect(getReliabilityTone(42).scoreClass).toBe(getReliabilityTone(58).scoreClass)
    expect(getReliabilityTone(42).panelClass).toBe(getReliabilityTone(58).panelClass)
    expect(getReliabilityTone(42).tagClass).toBe(getReliabilityTone(58).tagClass)
    expect(getImpactTone(45).scoreClass).toBe(getReliabilityTone(58).scoreClass)
    expect(getImpactTone(45).panelClass).toBe(getReliabilityTone(58).panelClass)
    expect(getImpactTone(45).tagClass).toBe(getReliabilityTone(58).tagClass)
    expect(getRecommendationTone(58).scoreClass).toBe(getReliabilityTone(58).scoreClass)
    expect(getRecommendationTone(58).panelClass).toBe(getReliabilityTone(58).panelClass)
    expect(getRecommendationTone(58).tagClass).toBe(getReliabilityTone(58).tagClass)
  })

  it('uses score-specific reliable gradients above 60', () => {
    expect(getReliabilityTone(84).label).toBe('高可信')
    expect(getReliabilityTone(84).scoreClass).toContain('--qa-score-teal-bg')
    expect(getReliabilityTone(92).label).toBe('极高可信')
    expect(getReliabilityTone(72).scoreClass).toContain('--qa-score-bluegray-bg')
    expectIsolatedScoreTone(getReliabilityTone(92))
  })

  it('only uses score-specific rose for extreme impact scores', () => {
    expect(getImpactTone(95).label).toBe('极强影响')
    expect(getImpactTone(95).scoreClass).toContain('--qa-score-rose-bg')
    expect(getImpactTone(89).label).toBe('高影响')
    expect(getImpactTone(89).scoreClass).not.toContain('--qa-score-rose-bg')
    expect(getImpactTone(73).scoreClass).toContain('--qa-score-bluegray-bg')
    expectIsolatedScoreTone(getImpactTone(95))
  })

  it('keeps recommendation tone separate from raw priority band', () => {
    expect(getRecommendationTone(93).label).toBe('S 级建议')
    expect(getRecommendationTone(83).label).toBe('A 级关注')
    expect(getRecommendationTone(72).label).toBe('B 级复核')
    expectIsolatedScoreTone(getRecommendationTone(93))
  })
})
