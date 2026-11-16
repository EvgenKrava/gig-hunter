// Live check of the Freelancehunt source: fetch recent projects for the chosen skills and run the
// deterministic pre-filter against a profile (no LLM, no writes, no token).
// pnpm freelancehunt:probe [--skills 28,99,175] [--since-hours 24] [--seed seed.local.json]
import { existsSync, readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { FreelancehuntSource } from '@gighunter/core/adapters'
import { preFilter } from '@gighunter/core/filter'
import { approxUsd, moneyRange } from '@gighunter/core/prompts'
import { DEFAULT_FREELANCEHUNT_SKILL_IDS, ProfileInputSchema } from '@gighunter/core/schema'

const { values } = parseArgs({
  options: {
    skills: { type: 'string', default: DEFAULT_FREELANCEHUNT_SKILL_IDS.join(',') },
    'since-hours': { type: 'string', default: '24' },
    seed: { type: 'string', default: 'seed.local.json' },
  },
})
const sinceHours = Number(values['since-hours'])
const since = new Date(Date.now() - sinceHours * 3_600_000)
const seedPath = values.seed!
const profile = existsSync(seedPath) ? ProfileInputSchema.parse(JSON.parse(readFileSync(seedPath, 'utf8')).profile) : null
if (!profile) console.log(`(no profile at ${seedPath} — showing jobs without the pre-filter)`)

const jobs = await new FreelancehuntSource().fetchRecent({ query: values.skills!, since, token: '' })
console.log(`${jobs.length} projects for skills ${values.skills} since ${since.toISOString()}`)
let pass = 0
for (const j of jobs) {
  const verdict = profile ? (preFilter(j, profile, { maxJobAgeHours: sinceHours }, new Date()) ?? 'pass') : '-'
  if (verdict === 'pass') pass++
  const b = j.budget ? `${moneyRange(j.budget.min, j.budget.max)} ${j.budget.currency}${approxUsd(j.budget)}` : 'no budget'
  console.log(`${verdict.padEnd(22)} | ${b.padEnd(28)} | ${j.title.slice(0, 70)} | ${j.url}`)
}
if (profile) console.log(`${pass}/${jobs.length} would go to the LLM`)
