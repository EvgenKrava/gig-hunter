import type { ApiKeyCheck } from '../llm/index'
import { defaultSettings, type Settings } from '../schema/index'
import type { Secrets } from '../secrets/index'
import type { Store } from '../store/index'
import { ServiceError } from './errors'

export interface AnthropicSetupDeps {
  store: Store
  secrets: Secrets
  /** Checks a key against the Claude API; throws when the check itself could not run. */
  verifyLlmKey: (apiKey: string) => Promise<ApiKeyCheck>
  now: () => Date
}

/** Saves the user's own Claude API key after Anthropic accepts it. The key goes only to SSM; settings keep a hint. */
export async function connectAnthropic(deps: AnthropicSetupDeps, userId: string, rawKey: string): Promise<Settings> {
  const apiKey = rawKey.trim()
  let check: ApiKeyCheck
  try {
    check = await deps.verifyLlmKey(apiKey)
  } catch {
    throw new ServiceError('Could not reach Anthropic to check the key. Try again in a minute.', 502, 'verify_failed')
  }
  if (!check.ok) throw new ServiceError(`Claude API key not saved: ${check.error}`, 400, 'invalid_key')
  await deps.secrets.putUserSecret(userId, 'anthropic/api-key', apiKey)
  const nowIso = deps.now().toISOString()
  const settings = (await deps.store.getSettings(userId)) ?? defaultSettings(nowIso)
  settings.anthropic = { keySet: true, keyHint: apiKey.slice(-4), keyUpdatedAt: nowIso }
  settings.updatedAt = nowIso
  await deps.store.putSettings(userId, settings)
  return settings
}

export async function disconnectAnthropic(deps: Omit<AnthropicSetupDeps, 'verifyLlmKey'>, userId: string): Promise<Settings> {
  await deps.secrets.deleteUserSecret(userId, 'anthropic/api-key')
  const nowIso = deps.now().toISOString()
  const settings = (await deps.store.getSettings(userId)) ?? defaultSettings(nowIso)
  settings.anthropic = { keySet: false }
  settings.updatedAt = nowIso
  await deps.store.putSettings(userId, settings)
  return settings
}
