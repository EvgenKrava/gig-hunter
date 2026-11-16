import { describe, it, expect } from 'vitest'
import { createSources, enabledPlatforms, UpworkSource } from './index'
import { defaultSettings } from '../schema/index'

describe('registry', () => {
  it('createSources returns one adapter per platform', () => {
    const s = createSources()
    expect(s.freelancer.platform).toBe('freelancer')
    expect(s.upwork).toBeInstanceOf(UpworkSource)
  })
  it('enabledPlatforms requires enabled + tokenSet', () => {
    const base = defaultSettings('2026-09-20T10:00:00.000Z')
    expect(enabledPlatforms(base)).toEqual([])
    const on = { ...base, platforms: { ...base.platforms, freelancer: { ...base.platforms.freelancer, enabled: true, tokenSet: true } } }
    expect(enabledPlatforms(on)).toEqual(['freelancer'])
    const noToken = { ...base, platforms: { ...base.platforms, freelancer: { ...base.platforms.freelancer, enabled: true } } }
    expect(enabledPlatforms(noToken)).toEqual([])
  })
  it('createSources includes the Freelancehunt adapter', () => {
    expect(createSources().freelancehunt.platform).toBe('freelancehunt')
  })
  it('enabledPlatforms lists freelancehunt only when enabled with at least one skill, no token needed', () => {
    const base = defaultSettings('2026-09-20T10:00:00.000Z')
    const fh = (enabled: boolean, skillIds: number[]) => ({ ...base, platforms: { ...base.platforms, freelancehunt: { enabled, skillIds } } })
    expect(enabledPlatforms(fh(true, [28]))).toEqual(['freelancehunt'])
    expect(enabledPlatforms(fh(true, []))).toEqual([])
    expect(enabledPlatforms(fh(false, [28]))).toEqual([])
  })
  it('upwork stub returns nothing and refuses tokens', async () => {
    const u = new UpworkSource()
    expect(await u.fetchRecent({ query: '', since: new Date(), token: '' })).toEqual([])
    expect(await u.verifyToken('x')).toEqual({ ok: false, error: 'not_implemented' })
  })
})
