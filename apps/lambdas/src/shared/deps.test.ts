import { describe, it, expect, afterEach } from 'vitest'
import { ApiKeyError } from '@gighunter/core/llm'
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
  it('defaults to the Claude API and needs the user key', () => {
    delete process.env.LLM_PROVIDER
    const createLlm = llmFactory('us-east-1')
    expect(() => createLlm('claude-haiku-5-5', null)).toThrow(ApiKeyError)
    expect(() => createLlm('claude-haiku-5-5', 'sk-ant-oat01-x')).toThrow(/subscription/)
    expect(typeof createLlm('claude-haiku-5-5', 'sk-ant-api03-x').messages.parse).toBe('function')
  })
  it('ignores ANTHROPIC_API_KEY in the environment: only the user key counts', () => {
    delete process.env.LLM_PROVIDER
    process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-operator'
    expect(() => llmFactory('us-east-1')('claude-haiku-5-5', null)).toThrow(ApiKeyError)
  })
  it('LLM_PROVIDER=bedrock needs no user key', () => {
    process.env.LLM_PROVIDER = 'bedrock'
    expect(typeof llmFactory('us-east-1')('claude-haiku-4-5', null).messages.create).toBe('function')
  })
  it('rejects an unknown LLM_PROVIDER at startup', () => {
    process.env.LLM_PROVIDER = 'gemini'
    expect(() => llmFactory('us-east-1')).toThrow(/LLM_PROVIDER/)
  })
})
