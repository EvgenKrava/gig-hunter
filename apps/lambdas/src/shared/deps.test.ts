import { describe, it, expect, vi, afterEach } from 'vitest'
import { ApiKeyError } from '@gighunter/core/llm'
import type { Secrets } from '@gighunter/core/secrets'
import { env, buildCoreDeps, llmFactory } from './deps'

const savedEnv = { ...process.env }
afterEach(() => {
  process.env = { ...savedEnv }
})

describe('deps', () => {
  it('env throws on missing variables', () => {
    delete process.env.NOPE_X
    expect(() => env('NOPE_X')).toThrow(/NOPE_X/)
  })
  it('buildCoreDeps wires store/secrets/sources/factories from env', () => {
    process.env.TABLE_NAME = 'tbl'
    process.env.AWS_REGION = 'us-east-1'
    const deps = buildCoreDeps('test')
    expect(deps.store).toBeDefined()
    expect(deps.secrets.userParamName('u', 'freelancer/token')).toBe('/gighunter/users/u/freelancer/token')
    expect(deps.sources.freelancer.platform).toBe('freelancer')
    expect(typeof deps.createLlm).toBe('function')
    expect(typeof deps.createTelegram).toBe('function')
    expect(deps.now()).toBeInstanceOf(Date)
  })
})

describe('llmFactory', () => {
  const fakeSecrets = (key: string | null) => ({ getAnthropicApiKey: vi.fn().mockResolvedValue(key) }) as unknown as Secrets & { getAnthropicApiKey: ReturnType<typeof vi.fn> }
  const call = (create: ReturnType<ReturnType<typeof llmFactory>>) =>
    create.messages.create({ model: 'claude-haiku-5-5', max_tokens: 1, messages: [{ role: 'user', content: 'x' }] })

  it('defaults to the Claude API and shares one client across models', () => {
    delete process.env.LLM_PROVIDER
    const createLlm = llmFactory(fakeSecrets(null), 'us-east-1')
    expect(createLlm('claude-haiku-5-5')).toBe(createLlm('claude-opus-5-5'))
  })
  it('reads the key from SSM when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env.LLM_PROVIDER
    delete process.env.ANTHROPIC_API_KEY
    const secrets = fakeSecrets(null)
    await expect(call(llmFactory(secrets, 'us-east-1')('claude-haiku-5-5'))).rejects.toBeInstanceOf(ApiKeyError)
    expect(secrets.getAnthropicApiKey).toHaveBeenCalledTimes(1)
  })
  it('prefers ANTHROPIC_API_KEY over SSM (and still refuses subscription tokens)', async () => {
    delete process.env.LLM_PROVIDER
    process.env.ANTHROPIC_API_KEY = 'sk-ant-oat01-x'
    const secrets = fakeSecrets('sk-ant-api03-from-ssm')
    await expect(call(llmFactory(secrets, 'us-east-1')('claude-haiku-5-5'))).rejects.toThrow(/subscription/)
    expect(secrets.getAnthropicApiKey).not.toHaveBeenCalled()
  })
  it('LLM_PROVIDER=bedrock builds a Bedrock client per model and never reads the key', () => {
    process.env.LLM_PROVIDER = 'bedrock'
    const secrets = fakeSecrets(null)
    const createLlm = llmFactory(secrets, 'us-east-1')
    expect(createLlm('claude-haiku-5-5')).not.toBe(createLlm('claude-haiku-5-5'))
    expect(secrets.getAnthropicApiKey).not.toHaveBeenCalled()
  })
  it('rejects an unknown LLM_PROVIDER at startup', () => {
    process.env.LLM_PROVIDER = 'gemini'
    expect(() => llmFactory(fakeSecrets(null), 'us-east-1')).toThrow(/LLM_PROVIDER/)
  })
})
