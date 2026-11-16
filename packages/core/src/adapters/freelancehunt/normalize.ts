import { JobSchema, type Job } from '../../schema/index'

export interface FreelancehuntEmployer {
  average_grade?: number | null
  positive_reviews?: number | null
  negative_reviews?: number | null
}

export interface FreelancehuntProject {
  id: number
  links?: { self?: { web?: string } }
  attributes: {
    name: string
    description?: string | null
    skills?: { name: string }[]
    tags?: { name: string }[]
    budget?: { amount?: number | null; currency?: string | null } | null
    safe_type?: string | null
    employer?: FreelancehuntEmployer | null
    published_at: string
  }
}

/** Documented Safe (escrow) variants; `null` means direct payment. Other values seen live ("person", "company") are undocumented. */
const SAFE_TYPES = new Set(['employer', 'developer', 'split', 'employer_cashless'])

/** true for Safe, false for direct payment, undefined (unknown → the LLM judges) for undocumented values. */
function paymentVerified(safeType: string | null | undefined): boolean | undefined {
  if (safeType === null) return false
  return safeType && SAFE_TYPES.has(safeType) ? true : undefined
}

/**
 * Freelancehunt gives one budget amount, used as both bounds. Safe (escrow) stands in for
 * "payment verified". Grades are 0–10, halved to 0–5.
 * `usdPer` is USD per 1 unit of the budget currency, when known.
 */
export function normalizeFreelancehuntProject(p: FreelancehuntProject, usdPer?: number): Job {
  const a = p.attributes
  const amount = a.budget?.amount
  const budget =
    typeof amount === 'number' && a.budget?.currency
      ? { min: amount, max: amount, currency: a.budget.currency, type: 'fixed' as const, ...(usdPer && usdPer > 0 ? { rateToUsd: usdPer } : {}) }
      : null
  const e = a.employer
  const reviews = e ? (e.positive_reviews ?? 0) + (e.negative_reviews ?? 0) : undefined
  const verified = paymentVerified(a.safe_type)
  return JobSchema.parse({
    platform: 'freelancehunt',
    externalId: String(p.id),
    url: p.links?.self?.web ?? `https://freelancehunt.com/project/${p.id}.html`,
    title: a.name,
    description: a.description ?? '',
    budget,
    skills: [...(a.skills ?? []), ...(a.tags ?? [])].map((s) => s.name),
    postedAt: new Date(a.published_at).toISOString(),
    client: {
      ...(typeof e?.average_grade === 'number' ? { rating: e.average_grade / 2 } : {}),
      ...(reviews !== undefined ? { reviews } : {}),
      ...(verified !== undefined ? { paymentVerified: verified } : {}),
    },
  })
}
