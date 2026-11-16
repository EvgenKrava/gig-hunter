# Freelancehunt Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poll Freelancehunt's public project API as a new, token-free job source that runs through the existing pre-filter → LLM score → Telegram pipeline.

**Architecture:** A `FreelancehuntSource` adapter (same `JobSource` interface as Freelancer) fetches `/v2/projects` filtered by skill ids, normalizes to `Job`, and prices non-USD budgets with NBU exchange rates. Settings gain `platforms.freelancehunt`; the pipeline stops requiring a secret for platforms that have none; the web Settings page gets a Freelancehunt card.

**Tech Stack:** TypeScript (bundler resolution, extensionless imports), Zod 4, Vitest, Hono (API), React + TanStack Query (web).

**Spec:** `docs/superpowers/specs/2026-11-16-freelancehunt-source-design.md`

## Global Constraints

- API base: `https://api.freelancehunt.com/v2`; list call `GET /projects?filter[skill_id]=<comma ids>&page[number]=<n>`; no auth header.
- At most 5 pages per `fetchRecent`; stop at the first project older than `since` or when `links.next` is absent.
- Default skill ids: `[28, 99, 175, 180, 169]`.
- FX source: `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json` (items `{ cc, rate }`, rate = UAH per 1 unit); cache 6 h.
- Platform id `freelancehunt`, display label `Freelancehunt`.
- No new AWS resources; no new dependencies.
- All files and commit messages in English.

## Review Focus

- NBU unreachable or currency missing from NBU → budget keeps no `rateToUsd`, fetch still succeeds (Task 1 + Task 2 tests).
- Project with `budget: null` → `Job.budget === null` (Task 2 test).
- Stored settings written before this change (no `platforms.freelancehunt`) → parse to defaults, platform off (Task 2 test).
- All skills unchecked → platform not polled, no request made (Task 3 test).
- Freelancehunt 429 / 5xx → `SourceError` with `rate_limited` / `http_<status>`, recorded per platform, run still finishes (Task 2 test; pipeline path already covered).

---

### Task 1: NBU exchange rates

**Files:**
- Create: `packages/core/src/adapters/freelancehunt/fx.ts`
- Test: `packages/core/src/adapters/freelancehunt/fx.test.ts`

**Interfaces:**
- Produces: `class NbuRates { constructor(fetchFn?: FetchFn, now?: () => Date, url?: string); usdPer(currency: string): Promise<number | undefined> }` — USD per 1 unit of `currency`; `USD` → 1 without a request; `UAH` → `1 / rate(USD)`; other → `rate(cc) / rate(USD)`; unknown currency or failed request → `undefined`.

- [ ] **Step 1: Write failing tests** — `usdPer('USD')` is 1 and makes no request; with NBU rows `USD 45.4274, EUR 50.222`: `usdPer('UAH') ≈ 0.022013`, `usdPer('EUR') ≈ 1.10554` (toBeCloseTo 5); two calls within 6 h make one request, a call after 6 h refetches; `usdPer('XYZ')` → undefined; fetch rejecting or HTTP 500 → undefined (no throw), and the next call retries.
- [ ] **Step 2: Run** `pnpm --filter @gighunter/core test fx` → FAIL (module missing).
- [ ] **Step 3: Implement** `NbuRates` in `fx.ts`; cache the parsed `Map<cc, rate>` with its fetch time; do not cache failures.
- [ ] **Step 4: Run** the same command → PASS.
- [ ] **Step 5: Commit** `feat(core): NBU exchange rates for Freelancehunt budgets`.

### Task 2: Platform, settings and Freelancehunt adapter

**Files:**
- Modify: `packages/core/src/schema/common.ts` (enum), `packages/core/src/schema/settings.ts`
- Create: `packages/core/src/adapters/freelancehunt/normalize.ts`, `source.ts`, `__fixtures__/projects.json` (4 projects recorded from the live API: UAH budget, EUR budget, `budget: null`, one older than `since`; with `links.next` set)
- Test: `packages/core/src/adapters/freelancehunt/source.test.ts`, `packages/core/src/schema/settings.test.ts` (create if absent)

**Interfaces:**
- Consumes: `NbuRates` (Task 1).
- Produces:
  - `PlatformSchema = z.enum(['freelancer', 'upwork', 'freelancehunt'])`.
  - `FREELANCEHUNT_SKILLS: { id: number; name: string }[]` — the 20 "Programming" skills (ids 1, 2, 13, 22, 24, 28, 57, 78, 86, 88, 99, 103, 124, 169, 175, 176, 180, 182, 185, 199 with their API names) plus 181 DevOps.
  - `FreelancehuntSettingsSchema = { enabled: boolean (false), skillIds: number[] (default [28, 99, 175, 180, 169], max 30) }` under `SettingsSchema.platforms.freelancehunt` with `.prefault({})`.
  - `SettingsPatchSchema.platforms.freelancehunt = strictObject({ enabled?: boolean, skillIds?: int[] (max 30) })`.
  - `normalizeFreelancehuntProject(p: FreelancehuntProject, usdPer?: number): Job` — mapping exactly as the spec's "Normalization" section.
  - `class FreelancehuntSource implements JobSource { platform = 'freelancehunt'; constructor(fetchFn?: FetchFn, rates?: NbuRates, baseUrl?: string) }` — `fetchRecent({ query, since })` where `query` is comma-separated skill ids; `verifyToken()` → `{ ok: false, error: 'not_needed' }`.

- [ ] **Step 1: Write failing tests**
  - settings: `SettingsSchema.parse({ updatedAt })` (no platforms key) → `platforms.freelancehunt` `{ enabled: false, skillIds: [28, 99, 175, 180, 169] }`; patch accepts `{ platforms: { freelancehunt: { skillIds: [28] } } }` and rejects unknown keys.
  - source: first request URL is `https://api.freelancehunt.com/v2/projects?filter%5Bskill_id%5D=28%2C99&page%5Bnumber%5D=1` with no `authorization` header; the fixture yields 3 jobs (the stale one dropped) and no second page is requested because a stale project was reached; UAH job → `{ platform: 'freelancehunt', externalId: '1664916', url: 'https://freelancehunt.com/project/…/1664916.html', budget: { min: 2000, max: 2000, currency: 'UAH', type: 'fixed', rateToUsd: <stub> }, skills include tag names, postedAt: '2026-11-16T08:35:39.000Z', client: { rating: 5, reviews: 25, paymentVerified: true } }`; `budget: null` project → `budget: null`; `safe_type: null` → `paymentVerified: false`; rates stub returning `undefined` → no `rateToUsd` key; with every project fresh and `links.next` present it stops after 5 pages; 429 → `SourceError` `rate_limited` with `retryAfterSec` from the header; 503 → `http_503`.
- [ ] **Step 2: Run** `pnpm --filter @gighunter/core test freelancehunt settings` → FAIL.
- [ ] **Step 3: Implement** the schema changes, `normalize.ts` and `source.ts`, mirroring `adapters/freelancer/source.ts` for error handling. Look up `usdPer` once per distinct currency per call.
- [ ] **Step 4: Run** the same command → PASS.
- [ ] **Step 5: Commit** `feat(core): Freelancehunt adapter and settings` (typecheck is green only after Task 3).

### Task 3: Wire it into registry, pipeline, labels and the API

**Files:**
- Modify: `packages/core/src/adapters/index.ts`, `packages/core/src/pipeline/runForUser.ts:23-26,93-100`, `packages/core/src/notifier/format.ts:38`, `apps/lambdas/src/api/routes/settings.ts:33`, `apps/lambdas/src/api/test-utils.ts:19`, `apps/web/src/features/jobs/MatchCard.tsx:8`
- Test: `packages/core/src/adapters/registry.test.ts`, `packages/core/src/pipeline/runForUser.test.ts`, `apps/lambdas/src/api/routes/settings.test.ts`, `packages/core/src/notifier/*.test.ts`

**Interfaces:**
- Consumes: Task 2 exports.
- Produces: `createSources()` includes `freelancehunt: new FreelancehuntSource(fetchFn, new NbuRates(fetchFn))`; `enabledPlatforms` adds `'freelancehunt'` when `enabled && skillIds.length > 0`; pipeline passes `query = skillIds.join(',')` and `token = ''` for platforms whose `PLATFORM_SECRET` is `null`.

- [ ] **Step 1: Write failing tests** — registry: freelancehunt on with skills → listed, on with `skillIds: []` → not listed, off → not listed; pipeline: a user with only freelancehunt enabled and no secrets gets `fetchRecent` called with `{ query: '28,99', token: '' }` and no `token_missing` error; settings route: `PATCH { platforms: { freelancehunt: { enabled: true, skillIds: [28] } } }` persists and keeps freelancer untouched; Telegram message for a freelancehunt match contains `Freelancehunt`.
- [ ] **Step 2: Run** `pnpm test` → the new tests FAIL.
- [ ] **Step 3: Implement** the wiring; labels `Freelancehunt` in `PLATFORM_LABEL` and `platformLabel`; `test-utils` gets a freelancehunt source mock.
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck` → PASS.
- [ ] **Step 5: Commit** `feat: poll Freelancehunt without a token`.

### Task 4: Web settings card

**Files:**
- Create: `apps/web/src/features/settings/FreelancehuntBlock.tsx`
- Modify: `apps/web/src/routes/_app.settings.tsx` (render after `FreelancerBlock`)
- Test: `apps/web/src/features/settings/settings.test.tsx`

**Interfaces:**
- Consumes: `FREELANCEHUNT_SKILLS`, `SettingsPatch` from `@gighunter/core/schema`; `onPatch` prop like `FreelancerBlock`.
- Produces: `FreelancehuntBlock({ settings, onPatch })`.

- [ ] **Step 1: Write failing tests** — card titled "Freelancehunt" shows a "Poll Freelancehunt" toggle; toggling sends `{ platforms: { freelancehunt: { enabled: true } } }`; tapping chip "Javascript and Typescript" when selected sends `skillIds` without 28; with no skill selected a hint "Pick at least one skill" is shown; no token input is rendered.
- [ ] **Step 2: Run** `pnpm --filter @gighunter/web test settings` → FAIL.
- [ ] **Step 3: Implement** the card with existing `Card`, `Toggle`, `RunNowButton`; skill chips are toggle buttons (44 px targets, `aria-pressed`), wrapping at 360 px; one line of copy: "Public projects, no token needed. Bids happen on freelancehunt.com."
- [ ] **Step 4: Run** the same command, then `pnpm --filter @gighunter/web typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(web): Freelancehunt settings card`.

### Task 5: Live probe

**Files:**
- Create: `scripts/freelancehunt-probe.ts`; Modify: root `package.json` (script `freelancehunt:probe`)

- [ ] **Step 1: Implement** a script that runs `FreelancehuntSource.fetchRecent` for the default skills and the last 24 h, then `preFilter` against the profile in `seed.local.json`, and prints one line per job: score-free verdict (`pass` / filter reason), budget with ≈USD, title.
- [ ] **Step 2: Run** `pnpm freelancehunt:probe` → prints ≥ 1 job, UAH budgets show a USD hint, exit 0.
- [ ] **Step 3: Commit** `chore(scripts): Freelancehunt probe`.
