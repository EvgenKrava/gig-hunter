import type { FetchFn } from '../../notifier/index'

const NBU_URL = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json'
const TTL_MS = 6 * 3_600_000

interface NbuRow { cc?: string; rate?: number }

/**
 * Official National Bank of Ukraine rates (UAH per 1 unit of each currency), free and keyless.
 * Used to price Freelancehunt budgets in USD. Failures are not cached and yield `undefined`,
 * so the budget simply goes to the LLM without a USD hint.
 */
export class NbuRates {
  private cache: { at: number; uahPer: Map<string, number> } | null = null

  constructor(
    private readonly fetchFn: FetchFn = fetch,
    private readonly now: () => Date = () => new Date(),
    private readonly url = NBU_URL,
  ) {}

  /** USD per 1 unit of `currency`, or undefined when unknown. */
  async usdPer(currency: string): Promise<number | undefined> {
    const cc = currency.toUpperCase()
    if (cc === 'USD') return 1
    const uahPer = await this.load()
    const usd = uahPer?.get('USD')
    if (!uahPer || !usd) return undefined
    if (cc === 'UAH') return 1 / usd
    const rate = uahPer.get(cc)
    return rate ? rate / usd : undefined
  }

  private async load(): Promise<Map<string, number> | null> {
    const t = this.now().getTime()
    if (this.cache && t - this.cache.at < TTL_MS) return this.cache.uahPer
    try {
      const res = await this.fetchFn(this.url, { headers: { accept: 'application/json' } })
      if (!res.ok) return null
      const rows = (await res.json()) as NbuRow[]
      const uahPer = new Map<string, number>()
      for (const r of Array.isArray(rows) ? rows : []) if (r.cc && typeof r.rate === 'number' && r.rate > 0) uahPer.set(r.cc.toUpperCase(), r.rate)
      if (!uahPer.size) return null
      this.cache = { at: t, uahPer }
      return uahPer
    } catch {
      return null
    }
  }
}
