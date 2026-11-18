import { approxUsd, budgetAmount } from '@gighunter/core/prompts'
import type { Job, MatchStatus, Verdict } from '@gighunter/core/schema'
import { t } from '../i18n'

export type BadgeTone = 'green' | 'amber' | 'red' | 'slate' | 'brand'

export function timeAgo(iso: string, now = new Date()): string {
  const s = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000))
  if (s < 60) return t('time.justNow')
  const m = Math.floor(s / 60)
  if (m < 60) return t('time.m', { n: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('time.h', { n: h })
  return t('time.d', { n: Math.floor(h / 24) })
}

export function budgetLabel(b: Job['budget']): string {
  if (!b) return t('budget.na')
  const range = budgetAmount(b)
  return (b.type === 'hourly' ? t('budget.hourly', { range, currency: b.currency }) : t('budget.fixed', { range, currency: b.currency })) + approxUsd(b)
}

export const verdictTone = (v?: Verdict): BadgeTone => (v === 'strong' ? 'green' : v === 'maybe' ? 'amber' : v === 'no' ? 'red' : 'slate')

export const statusLabel = (s: MatchStatus): string => t(`status.${s}`)
