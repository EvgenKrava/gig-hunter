import Anthropic from '@anthropic-ai/sdk'
import { canonicalModelId } from '../schema/index'
import { mapModelIds, type LlmClient } from './client'

/** Where the key comes from (env for local runs, SSM in Lambda). Called once; a failed lookup is retried on the next request. */
export type ApiKeySource = () => Promise<string | null>

export class ApiKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiKeyError'
  }
}

/** Accepts only Claude Console API keys; a Claude Pro/Max subscription token may not power a deployed app. */
export function assertApiKey(key: string | null | undefined): string {
  const k = key?.trim()
  if (!k) throw new ApiKeyError('Anthropic API key is not set')
  if (k.startsWith('sk-ant-oat')) {
    throw new ApiKeyError('This is a Claude subscription (OAuth) token, not an API key; create a key in the Claude Console')
  }
  if (!k.startsWith('sk-ant-')) throw new ApiKeyError('Anthropic API key is not set (the stored value is not an sk-ant- key)')
  return k
}

export const ANTHROPIC_API_URL = 'https://api.anthropic.com'

/**
 * The SDK client for a key. Auth and endpoint are pinned rather than read from the environment: developer shells often
 * carry ANTHROPIC_AUTH_TOKEN / ANTHROPIC_BASE_URL for other tools, and the key must go only to the Claude API.
 */
export function anthropicSdkClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, authToken: null, baseURL: ANTHROPIC_API_URL })
}

/**
 * Claude through the Claude API (no Bedrock). The key is fetched on the first request rather than at construction,
 * so building Lambda deps stays synchronous and a cold start that never calls Claude never reads the key.
 */
export function createAnthropicClient(getApiKey: ApiKeySource, newSdk: (apiKey: string) => unknown = anthropicSdkClient): LlmClient {
  let sdk: Promise<LlmClient> | undefined
  const ready = (): Promise<LlmClient> =>
    (sdk ??= getApiKey()
      .then((key) => newSdk(assertApiKey(key)) as LlmClient)
      .catch((e: unknown) => {
        sdk = undefined
        throw e
      }))
  const lazy: LlmClient = {
    messages: {
      create: async (params) => (await ready()).messages.create(params),
      parse: async <T>(params: Record<string, unknown>) => (await ready()).messages.parse<T>(params),
    },
  }
  return mapModelIds(lazy, canonicalModelId)
}
