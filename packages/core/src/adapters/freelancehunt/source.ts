import type { Job } from '../../schema/index'
import type { FetchFn } from '../../notifier/index'
import { SourceError, type FetchRecentParams, type JobSource, type VerifyResult } from '../types'
import { NbuRates } from './fx'
import { normalizeFreelancehuntProject, type FreelancehuntProject } from './normalize'

interface ProjectsResponse { data?: FreelancehuntProject[]; links?: { next?: string } }

/** Cost/politeness guard: pages of 10 projects read per run. */
export const MAX_PAGES = 5

/** Freelancehunt public project list (no token). `query` is a comma-separated list of skill ids. */
export class FreelancehuntSource implements JobSource {
  readonly platform = 'freelancehunt' as const

  constructor(
    private readonly fetchFn: FetchFn = fetch,
    private readonly rates: NbuRates = new NbuRates(fetchFn),
    private readonly baseUrl = 'https://api.freelancehunt.com/v2',
  ) {}

  private async page(skillIds: string, n: number): Promise<ProjectsResponse> {
    const params = new URLSearchParams({ 'filter[skill_id]': skillIds, 'page[number]': String(n) })
    let res: Response
    try {
      res = await this.fetchFn(`${this.baseUrl}/projects?${params}`, { headers: { accept: 'application/json' } })
    } catch (e) {
      throw new SourceError(`freelancehunt: network error: ${(e as Error).message}`, 'network')
    }
    if (res.status === 429) {
      const retry = Number(res.headers.get('retry-after') ?? '60')
      throw new SourceError('freelancehunt: rate limited', 'rate_limited', Number.isFinite(retry) ? retry : 60)
    }
    if (!res.ok) throw new SourceError(`freelancehunt: HTTP ${res.status}`, `http_${res.status}`)
    return (await res.json()) as ProjectsResponse
  }

  async fetchRecent({ query, since }: FetchRecentParams): Promise<Job[]> {
    // The list is newest-first: stop at the first project older than `since`.
    const fresh: FreelancehuntProject[] = []
    for (let n = 1; n <= MAX_PAGES; n++) {
      const body = await this.page(query, n)
      const items = body.data ?? []
      const cut = items.findIndex((p) => new Date(p.attributes.published_at) < since)
      fresh.push(...(cut === -1 ? items : items.slice(0, cut)))
      if (cut !== -1 || !body.links?.next) break
    }
    const usdPer = new Map<string, number | undefined>()
    for (const cc of new Set(fresh.map((p) => p.attributes.budget?.currency).filter((c): c is string => Boolean(c)))) {
      usdPer.set(cc, await this.rates.usdPer(cc))
    }
    return fresh.map((p) => normalizeFreelancehuntProject(p, p.attributes.budget?.currency ? usdPer.get(p.attributes.budget.currency) : undefined))
  }

  async verifyToken(_: string): Promise<VerifyResult> {
    return { ok: false, error: 'not_needed' }
  }
}
