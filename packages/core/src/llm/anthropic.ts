import Anthropic from '@anthropic-ai/sdk'
import { canonicalModelId } from '../schema/index'
import { mapModelIds, type LlmClient } from './client'

export class ApiKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiKeyError'
  }
}

/** Accepts only Claude Console API keys; a Claude Pro/Max subscription token may not power a deployed app. */
export function assertApiKey(key: string | null | undefined): string {
  const k = key?.trim()
  if (!k) throw new ApiKeyError('Claude API key is not set')
  if (k.startsWith('sk-ant-oat')) {
    throw new ApiKeyError('this is a Claude subscription (Pro/Max) token, not an API key; create an API key in the Claude Console')
  }
  if (!k.startsWith('sk-ant-')) throw new ApiKeyError('this does not look like a Claude API key (they start with sk-ant-)')
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

type NewSdk = (apiKey: string) => Anthropic

/** Claude through the Claude API (no Bedrock) with the user's own key. Throws ApiKeyError when the key is missing or unusable. */
export function createAnthropicClient(apiKey: string | null | undefined, newSdk: NewSdk = anthropicSdkClient): LlmClient {
  return mapModelIds(newSdk(assertApiKey(apiKey)) as unknown as LlmClient, canonicalModelId)
}

export type ApiKeyCheck = { ok: true } | { ok: false; error: string }

/**
 * Checks a key before it is saved with a free call (list one model). A rejected key is `{ ok: false }`; anything else
 * (network, rate limit, Anthropic outage) throws, since it says nothing about the key. Messages never include the key.
 */
export async function verifyApiKey(apiKey: string, newSdk: NewSdk = anthropicSdkClient): Promise<ApiKeyCheck> {
  let key: string
  try {
    key = assertApiKey(apiKey)
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  try {
    await newSdk(key).models.list({ limit: 1 })
    return { ok: true }
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, error: 'Anthropic rejected the key (wrong, disabled or deleted)' }
    if (e instanceof Anthropic.PermissionDeniedError) return { ok: false, error: 'the key is not allowed to call the Claude API' }
    throw e
  }
}

/** True when the Claude API refused the request because of the key itself; retrying with the same key is pointless. */
export function isApiKeyRejected(e: unknown): boolean {
  return e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError
}
