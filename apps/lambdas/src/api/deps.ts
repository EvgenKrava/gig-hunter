import type { ApiKeyCheck } from '@gighunter/core/llm'
import type { CoreDeps } from '../shared/deps'

export interface ApiDeps extends CoreDeps {
  apiBaseUrl: string
  /** Checks a user's Claude API key against the Claude API before it is saved. */
  verifyLlmKey: (apiKey: string) => Promise<ApiKeyCheck>
  invokePoller: (userId: string) => Promise<void>
  /** Deletes the Cognito user; resolves when the user is already gone. */
  deleteIdentity: (userId: string) => Promise<void>
}
