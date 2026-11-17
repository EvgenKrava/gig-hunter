import AnthropicBedrock, { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk'
import type Anthropic from '@anthropic-ai/sdk'
import type { Usage } from '../schema/index'

export type CreateParams = Anthropic.MessageCreateParamsNonStreaming

export interface ParsedResponse<T> {
  parsed_output: T | null
  usage: Anthropic.Usage
  stop_reason: string | null
}

/** The slice of the Anthropic client surface this codebase uses; the direct and both Bedrock clients satisfy it at runtime. */
export interface LlmClient {
  messages: {
    create(params: CreateParams): Promise<Anthropic.Message>
    parse<T>(params: Record<string, unknown>): Promise<ParsedResponse<T>>
  }
}

/** Which backend serves Claude. `anthropic` (the Claude API with a Console API key) is the default. */
export type LlmProvider = 'anthropic' | 'bedrock'

export function parseLlmProvider(value: string | undefined): LlmProvider {
  if (!value) return 'anthropic'
  if (value === 'anthropic' || value === 'bedrock') return value
  throw new Error(`Unknown LLM_PROVIDER "${value}" (expected "anthropic" or "bedrock")`)
}

/** Rewrites `model` on every request, so callers pass the model ID from settings whatever the backend. */
export function mapModelIds(client: LlmClient, toBackendId: (id: string) => string): LlmClient {
  return {
    messages: {
      create: (params) => client.messages.create({ ...params, model: toBackendId(params.model) }),
      parse: <T>(params: Record<string, unknown>) => client.messages.parse<T>({ ...params, model: toBackendId(String(params.model)) }),
    },
  }
}

// Models served by the Messages-API Bedrock endpoint (Mantle). Everything else is the legacy InvokeModel stack.
// Sonnet 5.5 and Haiku 5.5 are InvokeModel-only in us-east-1 (Mantle answers 404), hence the `(?!-5)`.
const MANTLE_PATTERNS = [/claude-opus-4-7/, /claude-opus-4-8/, /claude-opus-5/, /claude-sonnet-5(?!-5)/, /claude-fable/, /claude-mythos/]

export function usesMantle(modelId: string): boolean {
  return MANTLE_PATTERNS.some((re) => re.test(modelId))
}

/** Adaptive thinking exists from the 4.6 generation on; Haiku 4.5 / Sonnet 4.5 / Opus 4.5 do not take it. Takes either ID form. */
export function supportsAdaptiveThinking(modelId: string): boolean {
  return usesMantle(modelId) || /claude-(opus|sonnet)-4-6|claude-(sonnet|haiku)-5-5/.test(modelId)
}

// Bedrock IDs for the models in KNOWN_MODELS that are not plain `anthropic.<id>` (cross-region profiles, version suffixes).
const BEDROCK_IDS: Record<string, string> = {
  'claude-haiku-4-5': 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
  'claude-haiku-5-5': 'global.anthropic.claude-haiku-5-5',
  'claude-sonnet-4-6': 'global.anthropic.claude-sonnet-4-6',
  'claude-sonnet-5-5': 'global.anthropic.claude-sonnet-5-5',
  'claude-opus-4-6': 'global.anthropic.claude-opus-4-6-v1',
}

/** Claude API model ID → Bedrock model ID. IDs already in Bedrock form pass through. */
export function toBedrockModelId(id: string): string {
  if (id.includes('anthropic.')) return id
  return BEDROCK_IDS[id] ?? `anthropic.${id}`
}

export function createBedrockClient(modelId: string, region = process.env.AWS_REGION ?? 'us-east-1'): LlmClient {
  return mapModelIds(bedrockSdkClient(toBedrockModelId(modelId), region) as unknown as LlmClient, toBedrockModelId)
}

/** The raw Bedrock SDK client for a Bedrock model ID; exported for tests. */
export function bedrockSdkClient(bedrockModelId: string, region: string): AnthropicBedrock | AnthropicBedrockMantle {
  // GigHunter authenticates with the Lambda role (SigV4), never a bearer token, even when AWS_BEARER_TOKEN_BEDROCK /
  // ANTHROPIC_AUTH_TOKEN are set in the environment (developer shells often have them). The two clients need different
  // tricks to skip the env lookup:
  // - Legacy: a null apiKey does it. The SDK's ClientOptions type only admits `string | undefined`, but `undefined`
  //   re-enables the env lookup, so the runtime-honoured `null` is passed through a cast.
  // - Mantle: treats null as unset and reads AWS_BEARER_TOKEN_BEDROCK in its constructor, so the var is hidden for that call.
  return usesMantle(bedrockModelId)
    ? withoutEnv('AWS_BEARER_TOKEN_BEDROCK', () => new AnthropicBedrockMantle({ awsRegion: region }))
    : new AnthropicBedrock({ awsRegion: region, apiKey: null as unknown as string })
}

function withoutEnv<T>(name: string, make: () => T): T {
  const saved = process.env[name]
  delete process.env[name]
  try {
    return make()
  } finally {
    if (saved !== undefined) process.env[name] = saved
  }
}

export function usageFrom(u: Anthropic.Usage): Usage {
  return {
    inputTokens: u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
    outputTokens: u.output_tokens,
  }
}
