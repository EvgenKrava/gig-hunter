import { describe, it, expect, afterEach, vi } from 'vitest'
import { bedrockSdkClient, createBedrockClient, mapModelIds, toBedrockModelId, parseLlmProvider, usesMantle, supportsAdaptiveThinking, usageFrom, type LlmClient } from './client'

describe('bedrockSdkClient', () => {
  const saved = process.env.AWS_BEARER_TOKEN_BEDROCK
  afterEach(() => {
    if (saved === undefined) delete process.env.AWS_BEARER_TOKEN_BEDROCK
    else process.env.AWS_BEARER_TOKEN_BEDROCK = saved
  })

  it.each(['anthropic.claude-opus-5-5', 'global.anthropic.claude-haiku-4-5-20251001-v1:0'])(
    '%s ignores AWS_BEARER_TOKEN_BEDROCK and keeps the env var intact',
    (id) => {
      process.env.AWS_BEARER_TOKEN_BEDROCK = 'stale-token'
      const client = bedrockSdkClient(id, 'us-east-1') as unknown as { apiKey: string | null; authToken: string | null }
      expect(client.apiKey).toBeNull()
      expect(client.authToken).toBeNull()
      expect(process.env.AWS_BEARER_TOKEN_BEDROCK).toBe('stale-token')
    },
  )
})

describe('mapModelIds', () => {
  it('rewrites the model on create and parse and leaves the rest alone', async () => {
    const create = vi.fn().mockResolvedValue({})
    const parse = vi.fn().mockResolvedValue({})
    const client = mapModelIds({ messages: { create, parse } } as unknown as LlmClient, toBedrockModelId)
    await client.messages.create({ model: 'claude-haiku-5-5', max_tokens: 5, messages: [] })
    await client.messages.parse({ model: 'claude-opus-5-5', output_config: { effort: 'low' } })
    expect(create).toHaveBeenCalledWith({ model: 'global.anthropic.claude-haiku-5-5', max_tokens: 5, messages: [] })
    expect(parse).toHaveBeenCalledWith({ model: 'anthropic.claude-opus-5-5', output_config: { effort: 'low' } })
  })
  it('createBedrockClient builds a client for a Claude API model ID', () => {
    expect(typeof createBedrockClient('claude-haiku-5-5', 'us-east-1').messages.parse).toBe('function')
  })
})

describe('toBedrockModelId', () => {
  it.each([
    ['claude-haiku-4-5', 'global.anthropic.claude-haiku-4-5-20251001-v1:0'],
    ['claude-haiku-5-5', 'global.anthropic.claude-haiku-5-5'],
    ['claude-sonnet-4-6', 'global.anthropic.claude-sonnet-4-6'],
    ['claude-sonnet-5-5', 'global.anthropic.claude-sonnet-5-5'],
    ['claude-opus-4-6', 'global.anthropic.claude-opus-4-6-v1'],
    ['claude-opus-5-5', 'anthropic.claude-opus-5-5'],
    ['claude-sonnet-5', 'anthropic.claude-sonnet-5'],
    ['global.anthropic.claude-haiku-4-5-20251001-v1:0', 'global.anthropic.claude-haiku-4-5-20251001-v1:0'],
  ])('%s → %s', (id, bedrock) => {
    expect(toBedrockModelId(id)).toBe(bedrock)
  })
})

describe('parseLlmProvider', () => {
  it('defaults to anthropic and accepts both backends', () => {
    expect(parseLlmProvider(undefined)).toBe('anthropic')
    expect(parseLlmProvider('')).toBe('anthropic')
    expect(parseLlmProvider('anthropic')).toBe('anthropic')
    expect(parseLlmProvider('bedrock')).toBe('bedrock')
  })
  it('rejects anything else', () => {
    expect(() => parseLlmProvider('openai')).toThrow(/LLM_PROVIDER/)
  })
})

describe('model routing', () => {
  it.each([
    ['global.anthropic.claude-haiku-4-5-20251001-v1:0', false, false],
    ['global.anthropic.claude-sonnet-4-6', false, true],
    ['global.anthropic.claude-opus-4-6-v1', false, true],
    ['anthropic.claude-sonnet-5', true, true],
    ['anthropic.claude-opus-5', true, true],
    ['anthropic.claude-opus-4-7', true, true],
    ['global.anthropic.claude-haiku-5-5', false, true],
    ['global.anthropic.claude-sonnet-5-5', false, true],
    ['anthropic.claude-opus-5-5', true, true],
    ['claude-haiku-4-5', false, false],
    ['claude-haiku-5-5', false, true],
    ['claude-sonnet-4-6', false, true],
    ['claude-opus-5-5', true, true],
  ])('%s → mantle=%s adaptive=%s', (id, mantle, adaptive) => {
    expect(usesMantle(id)).toBe(mantle)
    expect(supportsAdaptiveThinking(id)).toBe(adaptive)
  })
})

describe('usageFrom', () => {
  it('sums all input token kinds', () => {
    expect(usageFrom({ input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 20 } as never))
      .toEqual({ inputTokens: 130, outputTokens: 5 })
    expect(usageFrom({ input_tokens: 10, output_tokens: 5, cache_read_input_tokens: null, cache_creation_input_tokens: null } as never))
      .toEqual({ inputTokens: 10, outputTokens: 5 })
  })
})
