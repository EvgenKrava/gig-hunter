import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
import { createSources } from '@gighunter/core/adapters'
import { createAnthropicClient, createBedrockClient, parseLlmProvider, type CreateLlm } from '@gighunter/core/llm'
import { createLogger } from '@gighunter/core/logger'
import { TelegramClient } from '@gighunter/core/notifier'
import type { PipelineDeps } from '@gighunter/core/pipeline'
import { Secrets } from '@gighunter/core/secrets'
import { Store } from '@gighunter/core/store'

export type CoreDeps = Omit<PipelineDeps, 'appUrl'>

export function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required environment variable ${name}`)
  return v
}

/** LLM_PROVIDER picks the backend (default `anthropic`, called with each user's own key from their settings). */
export function llmFactory(region: string): CreateLlm {
  if (parseLlmProvider(process.env.LLM_PROVIDER) === 'bedrock') return (model) => createBedrockClient(model, region)
  return (_model, apiKey) => createAnthropicClient(apiKey)
}

export function buildSecrets(region: string): Secrets {
  return new Secrets(new SSMClient({ region }), process.env.SSM_PREFIX ?? '/gighunter')
}

export function buildCoreDeps(fn: string): CoreDeps {
  const region = process.env.AWS_REGION ?? 'us-east-1'
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), { marshallOptions: { removeUndefinedValues: true } })
  const secrets = buildSecrets(region)
  return {
    store: new Store(doc, env('TABLE_NAME')),
    secrets,
    sources: createSources(),
    createLlm: llmFactory(region),
    createTelegram: (token) => new TelegramClient(token),
    now: () => new Date(),
    log: createLogger({ fn }),
  }
}
