import { FREELANCEHUNT_SKILLS, type SettingsPatch } from '@gighunter/core/schema'
import type { PublicSettings } from '../../api/hooks'
import { RunNowButton } from '../../components/RunNowButton'
import { Card } from '../../components/ui/Card'
import { Toggle } from '../../components/ui/Toggle'

export function FreelancehuntBlock({ settings, onPatch }: { settings: PublicSettings; onPatch: (p: SettingsPatch) => void }) {
  const f = settings.platforms.freelancehunt
  const selected = new Set(f.skillIds)
  const toggleSkill = (id: number) =>
    onPatch({ platforms: { freelancehunt: { skillIds: selected.has(id) ? f.skillIds.filter((s) => s !== id) : [...f.skillIds, id] } } })
  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">Freelancehunt</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Public projects, no token needed. Bids happen on{' '}
        <a className="underline" href="https://freelancehunt.com/projects" target="_blank" rel="noreferrer">freelancehunt.com</a>.
      </p>
      <Toggle label="Poll Freelancehunt" checked={f.enabled} onChange={(enabled) => onPatch({ platforms: { freelancehunt: { enabled } } })} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Skills</legend>
        <div className="flex flex-wrap gap-2">
          {FREELANCEHUNT_SKILLS.map((s) => {
            const on = selected.has(s.id)
            return (
              <button key={s.id} type="button" aria-pressed={on} onClick={() => toggleSkill(s.id)}
                className={`min-h-11 rounded-full border px-3 text-sm ${on ? 'border-brand bg-brand text-white' : 'border-slate-300 dark:border-slate-700'}`}>
                {s.name}
              </button>
            )
          })}
        </div>
        {f.skillIds.length === 0 && <p className="text-sm text-amber-700 dark:text-amber-400">Pick at least one skill — nothing is fetched without one.</p>}
      </fieldset>
      <RunNowButton />
    </Card>
  )
}
