# Freelancehunt as a job source — design

Status: approved 2026-11-16 (short design for a small change).

## Intent

The owner's Freelancer.com account was blocked: GigHunter still finds and pushes good matches,
but they cannot be applied to. The goal is a free platform the owner *can* apply on, fed through
the same pipeline (fetch → dedup → pre-filter → LLM score → Telegram), so a few small evening
gigs can still land even if volume is low.

## Goals / non-goals

- Goal: poll Freelancehunt (freelancehunt.com, Ukrainian marketplace) for new projects in chosen
  skill categories and score them exactly like Freelancer.com jobs.
- Goal: budgets in UAH/EUR/PLN are converted to USD so the budget pre-filter works.
- Non-goal: placing bids through the API, Freelancehunt account linking, private projects.
- Non-goal: removing Freelancer.com — the owner just switches it off in Settings.
- Anti-goal: new AWS resources or recurring cost.

## Approaches considered

| Approach | Trade-off | Verdict |
|---|---|---|
| **Freelancehunt public API** (`GET /v2/projects`) | Same marketplace model as Freelancer (budget, skills, employer reputation); works without a token and is not behind Cloudflare; ~55 active IT projects, ~5–10 new/day; very competitive (median ~90 bids), small UAH budgets, 9% fee | **Picked** |
| GitHub / Algora bounties (`label:"💎 Bounty"`) | Free, USD, ~580 open; but saturated by AI PRs (8–158 PRs per bounty within hours) and pay only on merge — a different flow | Rejected as primary |
| HN "Freelancer? Seeking freelancer?" / Reddit r/forhire | Tiny volume / Reddit returns 403 without an approved OAuth app | Rejected |
| Remotive, RemoteOK, Upwork, PeoplePerHour, Guru, Contra | Full-time roles / paid Connects + gated API / no public API (scraping breaks ToS) | Rejected |

## Design

- **Platform** `freelancehunt` added to `PlatformSchema`; adapter `FreelancehuntSource` in
  `packages/core/src/adapters/freelancehunt/`.
- **Fetch**: `GET https://api.freelancehunt.com/v2/projects?filter[skill_id]=<ids>&page[number]=N`.
  The list is newest-first; walk pages until a project is older than `since` or there is no
  `next` link, at most 5 pages (≤ 50 projects) per run. No token: the endpoint is public.
  The API ignores free-text queries, so filtering is by skill id only; the pre-filter and LLM do the rest.
- **Settings**: `platforms.freelancehunt = { enabled: false, skillIds: [28, 99, 175, 180, 169] }`
  (JS/TS, Web Programming, AI & ML, Bot Development, Data Parsing). Enabled when `enabled` and at
  least one skill is chosen — no token needed. The pipeline treats a platform without a secret as
  token-free instead of `token_missing`.
- **Web**: a "Freelancehunt" settings card with an on/off toggle and skill chips from a curated
  list of Freelancehunt "Programming" skills; job cards and Telegram messages label it "Freelancehunt".
- **FX**: rates from the National Bank of Ukraine (`bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json`,
  free, no key) give `rateToUsd` for UAH and other currencies; cached in memory for 6 h. If the call
  fails, budgets keep no rate and the LLM judges them (existing behaviour).

## Normalization (builder's calls)

- `url` = `links.self.web`; `postedAt` = `published_at` as UTC ISO.
- `budget` = `{ min: amount, max: amount, currency, type: 'fixed' }` (Freelancehunt gives one amount);
  no budget → `null`.
- `skills` = skill names + tag names (tags carry the concrete tech, e.g. "JoomShopping").
- `client.rating` = `employer.average_grade / 2` (0–10 → the profile's 0–5 scale);
  `client.reviews` = positive + negative reviews; `client.paymentVerified` = project uses
  Safe (escrow), i.e. `safe_type` is not null.
- `language` is left unset (not reported); many projects are in Ukrainian or Russian and the LLM reads them.

## Left to the builder

Exact UI copy, chip layout, test fixtures (recorded from the live API on 2026-11-16).
