import { z } from 'zod'
import { IsoDate } from './common'

// Haiku 5.5 is the intended default, but as of 2026-10-16 Bedrock answers it (and every 5.x model) with
// 403 "not available for this account" — switch once AWS grants the account access.
export const DEFAULT_MODEL = 'global.anthropic.claude-haiku-4-5-20251001-v1:0'

export const KNOWN_MODELS: { id: string; label: string }[] = [
  { id: DEFAULT_MODEL, label: 'Claude Haiku 4.5 (fast, cheapest)' },
  { id: 'global.anthropic.claude-haiku-5-5', label: 'Claude Haiku 5.5' },
  { id: 'global.anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'global.anthropic.claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
  { id: 'global.anthropic.claude-opus-4-6-v1', label: 'Claude Opus 4.6' },
  { id: 'anthropic.claude-opus-5-5', label: 'Claude Opus 5.5' },
]

export const TelegramSettingsSchema = z.object({
  tokenSet: z.boolean().default(false),
  tokenHint: z.string().optional(),
  botUsername: z.string().optional(),
  webhookSecret: z.string().optional(),
  chatId: z.string().optional(),
  chatTitle: z.string().optional(),
})

export const FreelancerSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  query: z.string().max(200).default(''),
  tokenSet: z.boolean().default(false),
  tokenHint: z.string().optional(),
  connectedAs: z.string().optional(),
})

/** Freelancehunt "Programming" skills (ids from GET /v2/skills, 2026-11-16) plus DevOps. */
export const FREELANCEHUNT_SKILLS: { id: number; name: string }[] = [
  { id: 28, name: 'Javascript and Typescript' },
  { id: 99, name: 'Web Programming' },
  { id: 175, name: 'AI & Machine Learning' },
  { id: 180, name: 'Bot Development' },
  { id: 169, name: 'Data Parsing' },
  { id: 181, name: 'DevOps' },
  { id: 86, name: 'Databases & SQL' },
  { id: 57, name: 'Testing & QA' },
  { id: 124, name: 'HTML & CSS' },
  { id: 22, name: 'Python' },
  { id: 1, name: 'PHP' },
  { id: 13, name: 'Java' },
  { id: 24, name: 'C#' },
  { id: 2, name: 'C & C++' },
  { id: 103, name: 'Desktop Apps' },
  { id: 78, name: 'Content Management Systems' },
  { id: 199, name: 'BI & Data Analytics' },
  { id: 182, name: 'Cryptocurrency & Blockchain' },
  { id: 176, name: 'Embedded Systems & Microcontrollers' },
  { id: 88, name: 'Gaming Apps' },
  { id: 185, name: 'AR & VR Development' },
]
export const DEFAULT_FREELANCEHUNT_SKILL_IDS = [28, 99, 175, 180, 169] as const

const SkillIdsSchema = z.array(z.number().int().positive()).max(30)

/** Public project list — no token. Polled when enabled and at least one skill is chosen. */
export const FreelancehuntSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  skillIds: SkillIdsSchema.default(() => [...DEFAULT_FREELANCEHUNT_SKILL_IDS]),
})

/** Scheduler ticks every 15 min; a user is polled only when this many minutes have passed since lastPolledAt. */
export const POLL_INTERVAL_OPTIONS = [15, 30, 60, 120, 240, 720, 1440] as const

export const SettingsSchema = z.object({
  active: z.boolean().default(false),
  pollIntervalMinutes: z.number().int().min(15).max(1440).default(15),
  lastPolledAt: IsoDate.optional(),
  notifyThreshold: z.number().int().min(0).max(100).default(70),
  maxJobAgeHours: z.number().int().min(1).max(168).default(24),
  model: z.string().min(1).default(DEFAULT_MODEL),
  chatModel: z.string().min(1).default(DEFAULT_MODEL),
  telegram: TelegramSettingsSchema.prefault({}),
  platforms: z
    .object({
      freelancer: FreelancerSettingsSchema.prefault({}),
      upwork: z.object({ enabled: z.literal(false).default(false) }).prefault({}),
      freelancehunt: FreelancehuntSettingsSchema.prefault({}),
    })
    .prefault({}),
  updatedAt: IsoDate,
})
export type Settings = z.infer<typeof SettingsSchema>

export const SettingsPatchSchema = z.strictObject({
  active: z.boolean().optional(),
  pollIntervalMinutes: z.number().int().min(15).max(1440).optional(),
  notifyThreshold: z.number().int().min(0).max(100).optional(),
  maxJobAgeHours: z.number().int().min(1).max(168).optional(),
  model: z.string().min(1).max(120).optional(),
  chatModel: z.string().min(1).max(120).optional(),
  platforms: z
    .strictObject({
      freelancer: z.strictObject({ enabled: z.boolean().optional(), query: z.string().max(200).optional() }).optional(),
      freelancehunt: z.strictObject({ enabled: z.boolean().optional(), skillIds: SkillIdsSchema.optional() }).optional(),
    })
    .optional(),
  telegram: z.strictObject({ chatId: z.string().max(64).optional() }).optional(),
})
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>

export function defaultSettings(now: string): Settings {
  return SettingsSchema.parse({ updatedAt: now })
}
