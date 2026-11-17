import { describe, it, expect, vi, beforeEach } from 'vitest'
import { anthropicSdkClient, assertApiKey, ApiKeyError, createAnthropicClient, isApiKeyRejected, verifyApiKey } from './anthropic'

// The real SDK is replaced by a fake that records constructor options and requests; nothing goes over the network.
const sdk = vi.hoisted(() => {
  class APIError extends Error {}
  class AuthenticationError extends APIError {}
  class PermissionDeniedError extends APIError {}
  return { ctor: vi.fn(), create: vi.fn(), parse: vi.fn(), listModels: vi.fn(), APIError, AuthenticationError, PermissionDeniedError }
})
vi.mock('@anthropic-ai/sdk', () => ({
  default: class FakeAnthropic {
    static AuthenticationError = sdk.AuthenticationError
    static PermissionDeniedError = sdk.PermissionDeniedError
    messages = { create: sdk.create, parse: sdk.parse }
    models = { list: sdk.listModels }
    constructor(opts: unknown) {
      sdk.ctor(opts)
    }
  },
}))

const KEY = 'sk-ant-api03-test-abcd'
const PINNED = { apiKey: KEY, authToken: null, baseURL: 'https://api.anthropic.com' }

beforeEach(() => {
  sdk.ctor.mockClear()
  sdk.create.mockReset().mockResolvedValue({ content: [], usage: {}, stop_reason: 'end_turn' })
  sdk.parse.mockReset().mockResolvedValue({ parsed_output: { ok: true }, usage: {}, stop_reason: 'end_turn' })
  sdk.listModels.mockReset().mockResolvedValue({ data: [{ id: 'claude-haiku-5-5' }] })
})

describe('anthropicSdkClient', () => {
  it('passes the key with auth and endpoint pinned, ignoring ANTHROPIC_AUTH_TOKEN / ANTHROPIC_BASE_URL', () => {
    anthropicSdkClient(KEY)
    expect(sdk.ctor).toHaveBeenCalledWith(PINNED)
  })
})

describe('createAnthropicClient', () => {
  it('builds one SDK client for the given key', () => {
    createAnthropicClient(KEY)
    expect(sdk.ctor).toHaveBeenCalledTimes(1)
    expect(sdk.ctor).toHaveBeenCalledWith(PINNED)
  })

  it('forwards params unchanged except for mapping Bedrock model IDs to Claude API IDs', async () => {
    const client = createAnthropicClient(KEY)
    const params = { model: 'global.anthropic.claude-haiku-4-5-20251001-v1:0', max_tokens: 4096, messages: [{ role: 'user' as const, content: 'x' }] }
    await client.messages.create(params)
    expect(sdk.create).toHaveBeenCalledWith({ ...params, model: 'claude-haiku-4-5' })

    const out = await client.messages.parse<{ ok: boolean }>({ model: 'anthropic.claude-opus-5-5', output_config: { effort: 'low' } })
    expect(sdk.parse).toHaveBeenCalledWith({ model: 'claude-opus-5-5', output_config: { effort: 'low' } })
    expect(out.parsed_output).toEqual({ ok: true })
  })

  it.each([null, undefined, ''])('throws ApiKeyError without a key (%j) and builds no SDK client', (k) => {
    expect(() => createAnthropicClient(k)).toThrow(ApiKeyError)
    expect(sdk.ctor).not.toHaveBeenCalled()
  })

  it('surfaces SDK errors as-is', async () => {
    sdk.create.mockRejectedValueOnce(new Error('529 overloaded'))
    await expect(createAnthropicClient(KEY).messages.create({ model: 'claude-haiku-5-5', max_tokens: 1, messages: [] })).rejects.toThrow('529 overloaded')
  })
})

describe('verifyApiKey', () => {
  it('accepts a key the API takes, with one free models.list call', async () => {
    expect(await verifyApiKey(` ${KEY} `)).toEqual({ ok: true })
    expect(sdk.ctor).toHaveBeenCalledWith(PINNED)
    expect(sdk.listModels).toHaveBeenCalledWith({ limit: 1 })
  })
  it('rejects a key the API refuses, without echoing the key', async () => {
    sdk.listModels.mockRejectedValueOnce(new sdk.AuthenticationError('401 invalid x-api-key'))
    const out = await verifyApiKey(KEY)
    expect(out).toEqual({ ok: false, error: expect.stringMatching(/rejected/) })
    expect(JSON.stringify(out)).not.toContain(KEY)
  })
  it('rejects a key without API permission', async () => {
    sdk.listModels.mockRejectedValueOnce(new sdk.PermissionDeniedError('403'))
    expect(await verifyApiKey(KEY)).toEqual({ ok: false, error: expect.stringMatching(/not allowed/) })
  })
  it('rejects subscription tokens and non-keys without calling the API', async () => {
    expect(await verifyApiKey('sk-ant-oat01-abc')).toEqual({ ok: false, error: expect.stringMatching(/subscription/) })
    expect(await verifyApiKey('hello world')).toEqual({ ok: false, error: expect.stringMatching(/sk-ant-/) })
    expect(sdk.listModels).not.toHaveBeenCalled()
  })
  it('throws when the check itself fails (network, outage), since that says nothing about the key', async () => {
    sdk.listModels.mockRejectedValueOnce(new Error('ECONNRESET'))
    await expect(verifyApiKey(KEY)).rejects.toThrow('ECONNRESET')
  })
})

describe('isApiKeyRejected', () => {
  it('is true only for authentication and permission errors', () => {
    expect(isApiKeyRejected(new sdk.AuthenticationError('401'))).toBe(true)
    expect(isApiKeyRejected(new sdk.PermissionDeniedError('403'))).toBe(true)
    expect(isApiKeyRejected(new sdk.APIError('529'))).toBe(false)
    expect(isApiKeyRejected(new Error('x'))).toBe(false)
  })
})

describe('assertApiKey', () => {
  it('accepts a Console API key and trims it', () => {
    expect(assertApiKey(` ${KEY}\n`)).toBe(KEY)
  })
  it.each([null, undefined, '', '   '])('rejects a missing key (%j)', (k) => {
    expect(() => assertApiKey(k)).toThrow(/not set/)
  })
  it('rejects a Claude subscription OAuth token', () => {
    expect(() => assertApiKey('sk-ant-oat01-abc')).toThrow(/subscription/)
  })
  it('rejects something that is not an Anthropic key', () => {
    expect(() => assertApiKey('REPLACE_ME')).toThrow(/sk-ant-/)
  })
})
