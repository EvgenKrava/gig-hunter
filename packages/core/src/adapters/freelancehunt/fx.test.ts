import { describe, it, expect, vi } from 'vitest'
import { NbuRates } from './fx'

const NBU = [
  { r030: 840, txt: 'Долар США', rate: 45.4274, cc: 'USD', exchangedate: '16.11.2026' },
  { r030: 978, txt: 'Євро', rate: 50.222, cc: 'EUR', exchangedate: '16.11.2026' },
]
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('NbuRates.usdPer', () => {
  it('returns 1 for USD without a request', async () => {
    const fetchFn = vi.fn()
    expect(await new NbuRates(fetchFn).usdPer('USD')).toBe(1)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('converts UAH and cross currencies through the USD rate', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(NBU))
    const rates = new NbuRates(fetchFn)
    expect(await rates.usdPer('UAH')).toBeCloseTo(0.022013, 5)
    expect(await rates.usdPer('eur')).toBeCloseTo(1.10554, 5)
    expect(String(fetchFn.mock.calls[0]![0])).toBe('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json')
  })

  it('caches rates for 6 hours, then refetches', async () => {
    const fetchFn = vi.fn().mockImplementation(async () => json(NBU))
    let now = new Date('2026-11-16T10:00:00Z')
    const rates = new NbuRates(fetchFn, () => now)
    await rates.usdPer('UAH')
    now = new Date('2026-11-16T15:59:00Z')
    await rates.usdPer('EUR')
    expect(fetchFn).toHaveBeenCalledTimes(1)
    now = new Date('2026-11-16T16:01:00Z')
    await rates.usdPer('UAH')
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('returns undefined for a currency NBU does not list', async () => {
    const rates = new NbuRates(vi.fn().mockResolvedValue(json(NBU)))
    expect(await rates.usdPer('XYZ')).toBeUndefined()
  })

  it('returns undefined on network or HTTP failure and retries only after 15 minutes', async () => {
    const fetchFn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(json({ error: 'down' }, 500))
      .mockResolvedValueOnce(json(NBU))
    let now = new Date('2026-11-16T10:00:00Z')
    const rates = new NbuRates(fetchFn, () => now)
    expect(await rates.usdPer('UAH')).toBeUndefined()
    now = new Date('2026-11-16T10:14:00Z')
    expect(await rates.usdPer('UAH')).toBeUndefined()
    expect(fetchFn).toHaveBeenCalledTimes(1)
    now = new Date('2026-11-16T10:16:00Z')
    expect(await rates.usdPer('UAH')).toBeUndefined()
    now = new Date('2026-11-16T10:32:00Z')
    expect(await rates.usdPer('UAH')).toBeCloseTo(0.022013, 5)
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })

  it('bounds the NBU request with an abort signal so a stalled host cannot hang the poller', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(NBU))
    await new NbuRates(fetchFn).usdPer('UAH')
    expect(fetchFn.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal)
  })
})
