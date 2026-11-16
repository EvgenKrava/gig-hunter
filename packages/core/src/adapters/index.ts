import type { FetchFn } from '../notifier/index'
import type { Platform, Settings } from '../schema/index'
import { FreelancehuntSource } from './freelancehunt/source'
import { NbuRates } from './freelancehunt/fx'
import { FreelancerSource } from './freelancer/source'
import { UpworkSource } from './upwork/source'
import type { JobSource } from './types'

export * from './types'
export { FreelancerSource } from './freelancer/source'
export { normalizeFreelancerProject } from './freelancer/normalize'
export { FreelancehuntSource } from './freelancehunt/source'
export { normalizeFreelancehuntProject } from './freelancehunt/normalize'
export { NbuRates } from './freelancehunt/fx'
export { UpworkSource } from './upwork/source'

export function createSources(fetchFn: FetchFn = fetch): Record<Platform, JobSource> {
  return { freelancer: new FreelancerSource(fetchFn), upwork: new UpworkSource(), freelancehunt: new FreelancehuntSource(fetchFn, new NbuRates(fetchFn)) }
}

export function enabledPlatforms(settings: Settings): Platform[] {
  const out: Platform[] = []
  const f = settings.platforms.freelancer
  if (f.enabled && f.tokenSet) out.push('freelancer')
  const fh = settings.platforms.freelancehunt
  if (fh.enabled && fh.skillIds.length > 0) out.push('freelancehunt')
  return out
}
