import { describe, it, expect, vi, beforeEach } from 'vitest'
import { anthropicSdkClient, assertApiKey, ApiKeyError, createAnthropicClient } from './anthropic'

// The real SDK is replaced by a fake that records constructor options and requests; nothing goes over the network.
const sdk = vi.hoisted(() => ({ ctor: vi.fn(), create: vi.fn(), parse: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class FakeAnthropic {
    messages = { create: sdk.create, parse: sdk.parse }
    constructor(opts: unknown) {
      sdk.ctor(opts)
    }
  },
}))

const KEY = 'sk-ant-api03-test'

beforeEach(() => {
  sdk.ctor.mockClear()
  sdk.create.mockReset().mockResolvedValue({ content: [], usage: {}, stop_reason: 'end_turn' })
  sdk.parse.mockReset().mockResolvedValue({ parsed_output: { ok: true }, usage: {}, stop_reason: 'end_turn' })
})

describe('anthropicSdkClient', () => {
  it('passes the key with auth and endpoint pinned, ignoring ANTHROPIC_AUTH_TOKEN / ANTHROPIC_BASE_URL', () => {
    anthropicSdkClient(KEY)
    expect(sdk.ctor).toHaveBeenCalledWith({ apiKey: KEY, authToken: null, baseURL: 'https://api.anthropic.com' })
  })
})

describe('createAnthropicClient', () => {
  it('reads the key lazily, once, and reuses one SDK client', async () => {
    const getKey = vi.fn().mockResolvedValue(KEY)
    const client = createAnthropicClient(getKey)
    expect(getKey).not.toHaveBeenCalled()

    await client.messages.create({ model: 'claude-haiku-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] })
    await client.messages.parse({ model: 'claude-haiku-5-5', max_tokens: 10, messages: [] })

    expect(getKey).toHaveBeenCalledTimes(1)
    expect(sdk.ctor).toHaveBeenCalledTimes(1)
    expect(sdk.ctor).toHaveBeenCalledWith({ apiKey: KEY, authToken: null, baseURL: 'https://api.anthropic.com' })
  })

  it('forwards params unchanged except for mapping Bedrock model IDs to Claude API IDs', async () => {
    const client = createAnthropicClient(async () => KEY)
    const params = { model: 'global.anthropic.claude-haiku-4-5-20251001-v1:0', max_tokens: 4096, messages: [{ role: 'user' as const, content: 'x' }] }
    await client.messages.create(params)
    expect(sdk.create).toHaveBeenCalledWith({ ...params, model: 'claude-haiku-4-5' })

    const out = await client.messages.parse<{ ok: boolean }>({ model: 'anthropic.claude-opus-5-5', output_config: { effort: 'low' } })
    expect(sdk.parse).toHaveBeenCalledWith({ model: 'claude-opus-5-5', output_config: { effort: 'low' } })
    expect(out.parsed_output).toEqual({ ok: true })
  })

  it('fails with ApiKeyError when no key is stored, and looks it up again on the next request', async () => {
    const getKey = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(KEY)
    const client = createAnthropicClient(getKey)
    await expect(client.messages.create({ model: 'claude-haiku-5-5', max_tokens: 1, messages: [] })).rejects.toBeInstanceOf(ApiKeyError)
    expect(sdk.create).not.toHaveBeenCalled()

    await client.messages.create({ model: 'claude-haiku-5-5', max_tokens: 1, messages: [] })
    expect(getKey).toHaveBeenCalledTimes(2)
    expect(sdk.create).toHaveBeenCalledTimes(1)
  })

  it('surfaces SDK errors as-is', async () => {
    sdk.create.mockRejectedValueOnce(new Error('529 overloaded'))
    const client = createAnthropicClient(async () => KEY)
    await expect(client.messages.create({ model: 'claude-haiku-5-5', max_tokens: 1, messages: [] })).rejects.toThrow('529 overloaded')
  })
})

describe('assertApiKey', () => {
  it('accepts a Console API key and trims it', () => {
    expect(assertApiKey(` ${KEY}\n`)).toBe(KEY)
  })
  it.each([null, undefined, '', '   ', 'unset', 'REPLACE_ME'])('rejects a missing or placeholder key (%j)', (k) => {
    expect(() => assertApiKey(k)).toThrow(/not set/)
  })
  it('rejects a Claude subscription OAuth token', () => {
    expect(() => assertApiKey('sk-ant-oat01-abc')).toThrow(/subscription/)
  })
})
