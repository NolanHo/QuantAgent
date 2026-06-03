import type { EventScoreLevel } from '../types/event-scoring.types'

export interface EventScoreTone {
  label: string
  panelClass: string
  scoreClass: string
  tagClass: string
}

export const scoreNeutralTone: Pick<EventScoreTone, 'panelClass' | 'scoreClass' | 'tagClass'> = {
  panelClass: 'border border-[var(--qa-score-neutral-border)] bg-[var(--qa-score-neutral-panel)]',
  scoreClass: 'border border-[var(--qa-score-neutral-border)] bg-[var(--qa-score-neutral-bg)] text-[var(--qa-score-neutral-fg)]',
  tagClass: 'border border-[var(--qa-score-neutral-border)] bg-[var(--qa-score-neutral-bg)] text-[var(--qa-score-neutral-fg)]',
}

const scoreToneTokens = {
  pinkStrong: {
    panelClass: 'border border-[var(--qa-score-pink-border)] bg-[var(--qa-score-pink-panel)]',
    scoreClass: 'bg-[var(--qa-score-pink-strong)] text-[var(--qa-score-pink-on-strong)] shadow-[0_10px_24px_rgb(190_24_93/0.18)]',
    tagClass: 'bg-[var(--qa-score-pink-strong)] text-[var(--qa-score-pink-on-strong)] shadow-[0_10px_24px_rgb(190_24_93/0.18)]',
  },
  pinkSoft: {
    panelClass: 'border border-[var(--qa-score-pink-border)] bg-[var(--qa-score-pink-panel)]',
    scoreClass: 'border border-[var(--qa-score-pink-border)] bg-[var(--qa-score-pink-bg)] text-[var(--qa-score-pink-fg)]',
    tagClass: 'border border-[var(--qa-score-pink-border)] bg-[var(--qa-score-pink-bg)] text-[var(--qa-score-pink-fg)]',
  },
  amberStrong: {
    panelClass: 'border border-[var(--qa-score-amber-border)] bg-[var(--qa-score-amber-panel)]',
    scoreClass: 'bg-[var(--qa-score-amber-strong)] text-[var(--qa-score-on-strong)] shadow-[0_10px_24px_rgb(180_98_0/0.18)]',
    tagClass: 'bg-[var(--qa-score-amber-strong)] text-[var(--qa-score-on-strong)] shadow-[0_10px_24px_rgb(180_98_0/0.18)]',
  },
  amberSoft: {
    panelClass: 'border border-[var(--qa-score-amber-border)] bg-[var(--qa-score-amber-panel)]',
    scoreClass: 'border border-[var(--qa-score-amber-border)] bg-[var(--qa-score-amber-bg)] text-[var(--qa-score-amber-fg)]',
    tagClass: 'border border-[var(--qa-score-amber-border)] bg-[var(--qa-score-amber-bg)] text-[var(--qa-score-amber-fg)]',
  },
  tealStrong: {
    panelClass: 'border border-[var(--qa-score-teal-border)] bg-[var(--qa-score-teal-panel)]',
    scoreClass: 'bg-[var(--qa-score-teal-strong)] text-[var(--qa-score-on-strong)] shadow-[0_10px_24px_rgb(13_148_136/0.16)]',
    tagClass: 'bg-[var(--qa-score-teal-strong)] text-[var(--qa-score-on-strong)] shadow-[0_10px_24px_rgb(13_148_136/0.16)]',
  },
  tealSoft: {
    panelClass: 'border border-[var(--qa-score-teal-border)] bg-[var(--qa-score-teal-panel)]',
    scoreClass: 'border border-[var(--qa-score-teal-border)] bg-[var(--qa-score-teal-bg)] text-[var(--qa-score-teal-fg)]',
    tagClass: 'border border-[var(--qa-score-teal-border)] bg-[var(--qa-score-teal-bg)] text-[var(--qa-score-teal-fg)]',
  },
  blueGraySoft: {
    panelClass: 'border border-[var(--qa-score-bluegray-border)] bg-[var(--qa-score-bluegray-panel)]',
    scoreClass: 'border border-[var(--qa-score-bluegray-border)] bg-[var(--qa-score-bluegray-bg)] text-[var(--qa-score-bluegray-fg)]',
    tagClass: 'border border-[var(--qa-score-bluegray-border)] bg-[var(--qa-score-bluegray-bg)] text-[var(--qa-score-bluegray-fg)]',
  },
  roseSoft: {
    panelClass: 'border border-[var(--qa-score-rose-border)] bg-[var(--qa-score-rose-panel)]',
    scoreClass: 'border border-[var(--qa-score-rose-border)] bg-[var(--qa-score-rose-bg)] text-[var(--qa-score-rose-fg)]',
    tagClass: 'border border-[var(--qa-score-rose-border)] bg-[var(--qa-score-rose-bg)] text-[var(--qa-score-rose-fg)]',
  },
}

export function getPriorityTone(priorityBand: EventScoreLevel, score: number): EventScoreTone {
  if (priorityBand === 'S') {
    return {
      label: '重点',
      ...scoreToneTokens.pinkStrong,
    }
  }

  if (priorityBand === 'A' || score >= 70) {
    return {
      label: '关注',
      ...scoreToneTokens.pinkSoft,
    }
  }

  if (priorityBand === 'B') {
    return {
      label: '观察',
      ...scoreToneTokens.blueGraySoft,
    }
  }

    return {
      label: '记录',
      ...scoreNeutralTone,
    }
}

export function getReliabilityTone(score: number): EventScoreTone {
  if (score < 60) {
    return {
      label: '低分记录',
      ...scoreNeutralTone,
    }
  }

  if (score >= 90) {
    return {
      label: '极高可信',
      ...scoreToneTokens.tealStrong,
    }
  }

  if (score >= 80) {
    return {
      label: '高可信',
      ...scoreToneTokens.tealSoft,
    }
  }

  if (score >= 70) {
    return {
      label: '中等可信',
      ...scoreToneTokens.blueGraySoft,
    }
  }

  return {
    label: '待增强',
    ...scoreToneTokens.amberSoft,
  }
}

export function getImpactTone(score: number): EventScoreTone {
  if (score < 60) {
    return {
      label: '低分记录',
      ...scoreNeutralTone,
    }
  }

  if (score >= 90) {
    return {
      label: '极强影响',
      ...scoreToneTokens.roseSoft,
    }
  }

  if (score >= 80) {
    return {
      label: '高影响',
      ...scoreToneTokens.amberSoft,
    }
  }

  if (score >= 70) {
    return {
      label: '中高影响',
      ...scoreToneTokens.blueGraySoft,
    }
  }

    return {
      label: '中等影响',
      ...scoreNeutralTone,
    }
}

export function getRecommendationTone(score: number): EventScoreTone {
  if (score < 60) {
    return {
      label: '低分记录',
      ...scoreNeutralTone,
    }
  }

  if (score >= 90) {
    return {
      label: 'S 级建议',
      ...scoreToneTokens.amberStrong,
    }
  }

  if (score >= 80) {
    return {
      label: 'A 级关注',
      ...scoreToneTokens.amberSoft,
    }
  }

  if (score >= 70) {
    return {
      label: 'B 级复核',
      ...scoreToneTokens.blueGraySoft,
    }
  }

  return {
    label: 'C 级记录',
    ...scoreNeutralTone,
  }
}
