// Live check of the LLM backend the Lambdas use: key check, one chat turn and one structured-output scoring call.
// The key is the one a user would save in Settings, taken from ANTHROPIC_API_KEY. Costs a fraction of a cent.
// pnpm llm:smoke [--model claude-haiku-5-5]
import { parseArgs } from 'node:util'
import { llmFactory } from '@gighunter/lambdas/deps'
import { verifyApiKey } from '@gighunter/core/llm'
import { runChatTurn } from '@gighunter/core/chat'
import { APP_CONTEXT, SAMPLE_JOB } from '@gighunter/core/prompts'
import { DEFAULT_MODEL } from '@gighunter/core/schema'
import { scoreJob } from '@gighunter/core/scorer'

const { values } = parseArgs({ options: { model: { type: 'string', default: DEFAULT_MODEL } } })
const model = values.model!
const region = process.env.AWS_REGION ?? 'us-east-1'
const apiKey = process.env.ANTHROPIC_API_KEY ?? null
const client = llmFactory(region)(model, apiKey)

console.log(`provider=${process.env.LLM_PROVIDER || 'anthropic'} model=${model}`)
if (apiKey) console.log('key check:', JSON.stringify(await verifyApiKey(apiKey)))

const chat = await runChatTurn({ client, model, systemPrompt: 'Answer in one short sentence.', history: [], userMessage: 'Say hello to GigHunter.' })
console.log('chat:', JSON.stringify(chat))

const scored = await scoreJob({
  client,
  model,
  systemPrompt: `${APP_CONTEXT}\n\nScore how well the job fits a TypeScript/React/AWS developer.`,
  job: SAMPLE_JOB,
})
console.log('score:', JSON.stringify(scored))
