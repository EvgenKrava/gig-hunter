import { describe, it, expect } from 'vitest'
import {
  ProfileInputSchema, SettingsSchema, SettingsPatchSchema, defaultSettings, DEFAULT_MODEL, KNOWN_MODELS, canonicalModelId,
  PromptsPatchSchema, JobSchema, MatchSchema, ScoreResultSchema, FREELANCEHUNT_SKILLS,
} from './index'

const now = '2026-09-20T10:00:00.000Z'

describe('ProfileInputSchema', () => {
  it('accepts a minimal valid profile', () => {
    const r = ProfileInputSchema.safeParse({
      displayName: 'Yev', skills: [{ name: 'TypeScript', level: 'expert' }],
      budget: { min: 50, max: 500, currency: 'USD' }, maxHours: 6, languages: ['en'], stopWords: [], freeText: '',
    })
    expect(r.success).toBe(true)
  })
  it('rejects budget max < min', () => {
    const r = ProfileInputSchema.safeParse({
      displayName: 'Yev', skills: [], budget: { min: 500, max: 50, currency: 'USD' }, maxHours: 6, languages: ['en'], stopWords: [], freeText: '',
    })
    expect(r.success).toBe(false)
  })
})

describe('SettingsSchema', () => {
  it('defaultSettings fills every default', () => {
    const s = defaultSettings(now)
    expect(s).toMatchObject({
      active: false, notifyThreshold: 70, maxJobAgeHours: 24, model: DEFAULT_MODEL, chatModel: DEFAULT_MODEL,
      telegram: { tokenSet: false }, platforms: { freelancer: { enabled: false, query: '', tokenSet: false }, upwork: { enabled: false } }, updatedAt: now,
    })
  })
  it('parses a partial stored item into a full Settings', () => {
    const s = SettingsSchema.parse({ active: true, updatedAt: now })
    expect(s.notifyThreshold).toBe(70)
    expect(s.platforms.freelancer.query).toBe('')
  })
  it('patch rejects unknown keys and out-of-range threshold', () => {
    expect(SettingsPatchSchema.safeParse({ notifyThreshold: 101 }).success).toBe(false)
    expect(SettingsPatchSchema.safeParse({ telegram: { webhookSecret: 'x' } }).success).toBe(false)
    expect(SettingsPatchSchema.safeParse({ telegram: { chatId: '-100123' }, platforms: { freelancer: { enabled: true, query: 'react' } } }).success).toBe(true)
  })
  it('stored settings without freelancehunt get it switched off with the default skills', () => {
    const s = SettingsSchema.parse({ updatedAt: now })
    expect(s.platforms.freelancehunt).toEqual({ enabled: false, skillIds: [28, 99, 175, 180, 169] })
  })
  it('patch accepts freelancehunt enabled/skillIds and rejects unknown keys', () => {
    expect(SettingsPatchSchema.safeParse({ platforms: { freelancehunt: { skillIds: [28] } } }).success).toBe(true)
    expect(SettingsPatchSchema.safeParse({ platforms: { freelancehunt: { enabled: true } } }).success).toBe(true)
    expect(SettingsPatchSchema.safeParse({ platforms: { freelancehunt: { token: 'x' } } }).success).toBe(false)
    expect(SettingsPatchSchema.safeParse({ platforms: { freelancehunt: { skillIds: [1.5] } } }).success).toBe(false)
  })
  it('defaults to Claude Haiku 5.5', () => {
    expect(DEFAULT_MODEL).toBe('claude-haiku-4-5')
    expect(KNOWN_MODELS.map((m) => m.id)).toContain(DEFAULT_MODEL)
  })
  it('normalizes model IDs saved in Bedrock form when reading stored settings and patches', () => {
    const s = SettingsSchema.parse({ updatedAt: now, model: 'global.anthropic.claude-haiku-4-5-20251001-v1:0', chatModel: 'anthropic.claude-opus-5-5' })
    expect(s.model).toBe('claude-haiku-4-5')
    expect(s.chatModel).toBe('claude-opus-5-5')
    expect(SettingsPatchSchema.parse({ model: 'global.anthropic.claude-opus-4-6-v1' })).toEqual({ model: 'claude-opus-4-6' })
  })
  it.each([
    ['global.anthropic.claude-haiku-4-5-20251001-v1:0', 'claude-haiku-4-5'],
    ['global.anthropic.claude-haiku-5-5', 'claude-haiku-5-5'],
    ['global.anthropic.claude-sonnet-4-6', 'claude-sonnet-4-6'],
    ['global.anthropic.claude-sonnet-5-5', 'claude-sonnet-5-5'],
    ['global.anthropic.claude-opus-4-6-v1', 'claude-opus-4-6'],
    ['us.anthropic.claude-sonnet-4-6', 'claude-sonnet-4-6'],
    ['anthropic.claude-sonnet-5', 'claude-sonnet-5'],
    ['claude-haiku-5-5', 'claude-haiku-5-5'],
    ['claude-haiku-4-5-20251001', 'claude-haiku-4-5'],
    // An unknown dated snapshot keeps its date: the bare name may not be an alias.
    ['claude-sonnet-4-5-20250929', 'claude-sonnet-4-5-20250929'],
  ])('canonicalModelId(%s) → %s', (id, canonical) => {
    expect(canonicalModelId(id)).toBe(canonical)
  })
  it('FREELANCEHUNT_SKILLS lists unique ids including the defaults', () => {
    const ids = FREELANCEHUNT_SKILLS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of [28, 99, 175, 180, 169, 181]) expect(ids).toContain(id)
  })
})

describe('PromptsPatchSchema', () => {
  it('allows null to reset and limits quick actions to 8 unique labels', () => {
    expect(PromptsPatchSchema.safeParse({ scoring: null }).success).toBe(true)
    const nine = Array.from({ length: 9 }, (_, i) => ({ label: `a${i}`, text: 't' }))
    expect(PromptsPatchSchema.safeParse({ quickActions: nine }).success).toBe(false)
    const dup = [{ label: 'a', text: 't' }, { label: 'a', text: 'u' }]
    expect(PromptsPatchSchema.safeParse({ quickActions: dup }).success).toBe(false)
  })
})

describe('JobSchema / MatchSchema / ScoreResultSchema', () => {
  const job = {
    platform: 'freelancer', externalId: '123', url: 'https://www.freelancer.com/projects/x', title: 'T', description: 'D',
    budget: { min: 100, max: 200, currency: 'USD', type: 'fixed' }, skills: ['react'], postedAt: now,
  }
  it('accepts a job with null budget', () => {
    expect(JobSchema.safeParse({ ...job, budget: null }).success).toBe(true)
  })
  it('score must be an int in 0..100 and risks ≤ 4', () => {
    expect(ScoreResultSchema.safeParse({ score: 82, reasoning: 'ok', estimatedHours: 3, risks: [] }).success).toBe(true)
    expect(ScoreResultSchema.safeParse({ score: 101, reasoning: 'ok', estimatedHours: 3, risks: [] }).success).toBe(false)
    expect(ScoreResultSchema.safeParse({ score: 10, reasoning: 'ok', estimatedHours: 3, risks: ['a', 'b', 'c', 'd', 'e'] }).success).toBe(false)
  })
  it('match requires status and ttl', () => {
    expect(MatchSchema.safeParse({ job, status: 'pending', createdAt: now, ttl: 1 }).success).toBe(true)
    expect(MatchSchema.safeParse({ job, status: 'sent', createdAt: now, ttl: 1 }).success).toBe(false)
  })
})
