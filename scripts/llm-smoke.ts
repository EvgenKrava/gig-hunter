// Live check of the LLM backend the Lambdas use: one chat turn and one structured-output scoring call.
// Key: ANTHROPIC_API_KEY from the environment, else the SSM parameter (AWS_PROFILE=yevhenii). Costs a fraction of a cent.
// pnpm llm:smoke [--model claude-haiku-5-5]
import { parseArgs } from 'node:util'
import { buildSecrets, llmFactory } from '@gighunter/lambdas/deps'
import { runChatTurn } from '@gighunter/core/chat'
import { APP_CONTEXT, SAMPLE_JOB } from '@gighunter/core/prompts'
import { DEFAULT_MODEL } from '@gighunter/core/schema'
import { scoreJob } from '@gighunter/core/scorer'

const { values } = parseArgs({ options: { model: { type: 'string', default: DEFAULT_MODEL } } })
const model = values.model!
const region = process.env.AWS_REGION ?? 'us-east-1'
const client = llmFactory(buildSecrets(region), region)(model)

console.log(`provider=${process.env.LLM_PROVIDER || 'anthropic'} model=${model}`)

const chat = await runChatTurn({ client, model, systemPrompt: 'Answer in one short sentence.', history: [], userMessage: 'Say hello to GigHunter.' })
console.log('chat:', JSON.stringify(chat))

const scored = await scoreJob({
  client,
  model,
  systemPrompt: `${APP_CONTEXT}\n\nScore how well the job fits a TypeScript/React/AWS developer.`,
  job: SAMPLE_JOB,
})
console.log('score:', JSON.stringify(scored))
