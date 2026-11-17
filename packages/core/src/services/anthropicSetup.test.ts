import { describe, it, expect, vi } from 'vitest'
import { connectAnthropic, disconnectAnthropic } from './anthropicSetup'
import { defaultSettings } from '../schema/index'
import type { Store } from '../store/index'
import type { Secrets } from '../secrets/index'

const nowIso = '2026-11-17T10:00:00.000Z'
const now = () => new Date(nowIso)
const KEY = 'sk-ant-api03-secret-value-wxyz'

function makeDeps(verify: () => Promise<unknown>) {
  const store = { getSettings: vi.fn().mockResolvedValue(defaultSettings(nowIso)), putSettings: vi.fn() } as unknown as Store
  const secrets = { putUserSecret: vi.fn(), deleteUserSecret: vi.fn() } as unknown as Secrets
  const verifyLlmKey = vi.fn().mockImplementation(verify)
  return { deps: { store, secrets, verifyLlmKey, now }, store, secrets, verifyLlmKey }
}

describe('connectAnthropic', () => {
  it('verifies, stores the trimmed key in SSM and records only set / last 4 / when', async () => {
    const { deps, secrets, store, verifyLlmKey } = makeDeps(async () => ({ ok: true }))
    const s = await connectAnthropic(deps, 'u1', `  ${KEY}\n`)
    expect(verifyLlmKey).toHaveBeenCalledWith(KEY)
    expect(secrets.putUserSecret).toHaveBeenCalledWith('u1', 'anthropic/api-key', KEY)
    expect(s.anthropic).toEqual({ keySet: true, keyHint: 'wxyz', keyUpdatedAt: nowIso })
    expect(JSON.stringify(s)).not.toContain(KEY)
    expect(store.putSettings).toHaveBeenCalledWith('u1', s)
  })
  it('rejects a key Anthropic refuses with 400 and stores nothing', async () => {
    const { deps, secrets, store } = makeDeps(async () => ({ ok: false, error: 'Anthropic rejected the key' }))
    const err = await connectAnthropic(deps, 'u1', KEY).catch((e: unknown) => e)
    expect(err).toMatchObject({ status: 400, code: 'invalid_key', message: expect.stringContaining('Anthropic rejected the key') })
    expect((err as Error).message).not.toContain(KEY)
    expect(secrets.putUserSecret).not.toHaveBeenCalled()
    expect(store.putSettings).not.toHaveBeenCalled()
  })
  it('502 when the key could not be checked, without leaking the underlying error', async () => {
    const { deps, secrets } = makeDeps(async () => { throw new Error(`fetch failed for ${KEY}`) })
    const err = await connectAnthropic(deps, 'u1', KEY).catch((e: unknown) => e)
    expect(err).toMatchObject({ status: 502, code: 'verify_failed' })
    expect((err as Error).message).not.toContain(KEY)
    expect(secrets.putUserSecret).not.toHaveBeenCalled()
  })
})

describe('disconnectAnthropic', () => {
  it('deletes the key from SSM and clears the hint', async () => {
    const { deps, secrets } = makeDeps(async () => ({ ok: true }))
    const s = await disconnectAnthropic(deps, 'u1')
    expect(secrets.deleteUserSecret).toHaveBeenCalledWith('u1', 'anthropic/api-key')
    expect(s.anthropic).toEqual({ keySet: false })
  })
})
