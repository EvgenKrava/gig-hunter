import { describe, it, expect, vi } from 'vitest'
import { FreelancehuntSource } from './source'
import { SourceError } from '../types'
import type { NbuRates } from './fx'
import fixture from './__fixtures__/projects.json'

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
const rates = (table: Record<string, number | undefined>) => ({ usdPer: vi.fn(async (cc: string) => table[cc]) }) as unknown as NbuRates
const since = new Date('2026-11-15T00:00:00Z')

describe('FreelancehuntSource.fetchRecent', () => {
  it('requests the skill-filtered project list without auth and stops at the first stale project', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(fixture))
    const jobs = await new FreelancehuntSource(fetchFn, rates({ UAH: 0.022, EUR: 1.1 })).fetchRecent({ query: '28,99', since, token: '' })
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0]!
    expect(String(url)).toBe('https://api.freelancehunt.com/v2/projects?filter%5Bskill_id%5D=28%2C99&page%5Bnumber%5D=1')
    expect(Object.keys(init?.headers ?? {}).map((k) => k.toLowerCase())).not.toContain('authorization')
    expect(jobs.map((j) => j.externalId)).toEqual(['1664916', '1664900', '1664830'])
  })

  it('normalizes a UAH project with employer reputation and tags', async () => {
    const [job] = await new FreelancehuntSource(vi.fn().mockResolvedValue(json(fixture)), rates({ UAH: 0.022 })).fetchRecent({ query: '28', since, token: '' })
    expect(job).toMatchObject({
      platform: 'freelancehunt',
      externalId: '1664916',
      url: 'https://freelancehunt.com/project/vprovadzhennya-funktsionalu-variantiv-tovaru-internet-magazini/1664916.html',
      title: 'Впровадження функціоналу варіантів товару в інтернет-магазині',
      budget: { min: 2000, max: 2000, currency: 'UAH', type: 'fixed', rateToUsd: 0.022 },
      skills: ['Web Programming', 'PHP', 'JoomShopping', 'Варіанти товару', 'Joomla 3.10'],
      postedAt: '2026-11-16T08:35:39.000Z',
      client: { rating: 5, reviews: 25, paymentVerified: true },
    })
    expect(job!.description).toMatch(/^ТЕХНІЧНЕ ЗАВДАННЯ/)
    expect(job!.language).toBeUndefined()
  })

  it('maps a missing budget to null and a project without Safe to paymentVerified false', async () => {
    const jobs = await new FreelancehuntSource(vi.fn().mockResolvedValue(json(fixture)), rates({ EUR: 1.1 })).fetchRecent({ query: '28', since, token: '' })
    expect(jobs[1]!.budget).toBeNull()
    expect(jobs[2]!.budget).toEqual({ min: 500, max: 500, currency: 'EUR', type: 'fixed', rateToUsd: 1.1 })
    expect(jobs[2]!.client?.paymentVerified).toBe(false)
  })

  it('leaves rateToUsd out when the rate is unknown', async () => {
    const [job] = await new FreelancehuntSource(vi.fn().mockResolvedValue(json(fixture)), rates({})).fetchRecent({ query: '28', since, token: '' })
    expect(job!.budget).toEqual({ min: 2000, max: 2000, currency: 'UAH', type: 'fixed' })
  })

  it('follows next links while everything is fresh, at most 5 pages', async () => {
    const fresh = { ...fixture.data[0]!, attributes: { ...fixture.data[0]!.attributes, published_at: '2026-11-16T10:00:00+02:00' } }
    const fetchFn = vi.fn().mockImplementation(async () => json({ data: [fresh], links: { next: 'https://api.freelancehunt.com/v2/projects?page[number]=2' } }))
    const jobs = await new FreelancehuntSource(fetchFn, rates({})).fetchRecent({ query: '28', since, token: '' })
    expect(fetchFn).toHaveBeenCalledTimes(5)
    expect(String(fetchFn.mock.calls[4]![0])).toContain('page%5Bnumber%5D=5')
    expect(jobs).toHaveLength(5)
  })

  it('stops when there is no next link', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ data: [], links: {} }))
    expect(await new FreelancehuntSource(fetchFn, rates({})).fetchRecent({ query: '28', since, token: '' })).toEqual([])
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('throws SourceError rate_limited with retryAfter on 429', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({}, 429, { 'retry-after': '30' }))
    const err = await new FreelancehuntSource(fetchFn, rates({})).fetchRecent({ query: '28', since, token: '' }).catch((e) => e)
    expect(err).toBeInstanceOf(SourceError)
    expect(err.code).toBe('rate_limited')
    expect(err.retryAfterSec).toBe(30)
  })

  it('throws SourceError http_<status> on other failures and network on fetch errors', async () => {
    const http = await new FreelancehuntSource(vi.fn().mockResolvedValue(json({}, 503)), rates({})).fetchRecent({ query: '28', since, token: '' }).catch((e) => e)
    expect(http.code).toBe('http_503')
    const net = await new FreelancehuntSource(vi.fn().mockRejectedValue(new Error('ECONNRESET')), rates({})).fetchRecent({ query: '28', since, token: '' }).catch((e) => e)
    expect(net.code).toBe('network')
  })
})

describe('FreelancehuntSource.verifyToken', () => {
  it('reports that no token is needed', async () => {
    expect(await new FreelancehuntSource(vi.fn(), rates({})).verifyToken('x')).toEqual({ ok: false, error: 'not_needed' })
  })
})
