import { useEffect, useRef, useState } from 'react'
import { FREELANCEHUNT_SKILLS, type SettingsPatch } from '@gighunter/core/schema'
import type { PublicSettings } from '../../api/hooks'
import { RunNowButton } from '../../components/RunNowButton'
import { Card } from '../../components/ui/Card'
import { Toggle } from '../../components/ui/Toggle'
import { useT } from '../../i18n'

/** Quick taps on several chips collapse into one PATCH carrying the final list. */
const SAVE_DELAY_MS = 400

export function FreelancehuntBlock({ settings, onPatch }: { settings: PublicSettings; onPatch: (p: SettingsPatch) => void }) {
  const f = settings.platforms.freelancehunt
  const { t, tRich } = useT()
  const [draft, setDraft] = useState(f.skillIds)
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; skillIds: number[] } | null>(null)
  const onPatchRef = useRef(onPatch)
  onPatchRef.current = onPatch

  const savedKey = f.skillIds.join(',')
  // Resync from the server unless a local change is still waiting to be saved.
  useEffect(() => { if (!pending.current) setDraft(f.skillIds) }, [savedKey])

  const flush = () => {
    const p = pending.current
    if (!p) return
    clearTimeout(p.timer)
    pending.current = null
    onPatchRef.current({ platforms: { freelancehunt: { skillIds: p.skillIds } } })
  }
  useEffect(() => flush, []) // save a pending change when the card unmounts

  const toggleSkill = (id: number) => {
    const next = draft.includes(id) ? draft.filter((s) => s !== id) : [...draft, id]
    setDraft(next)
    if (pending.current) clearTimeout(pending.current.timer)
    pending.current = { timer: setTimeout(flush, SAVE_DELAY_MS), skillIds: next }
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">Freelancehunt</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {tRich('fh.text', { link: <a className="underline" href="https://freelancehunt.com/projects" target="_blank" rel="noreferrer">freelancehunt.com</a> })}
      </p>
      <Toggle label={t('fh.poll')} checked={f.enabled} onChange={(enabled) => onPatch({ platforms: { freelancehunt: { enabled } } })} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('fh.skills')}</legend>
        <div className="flex flex-wrap gap-2">
          {FREELANCEHUNT_SKILLS.map((s) => {
            const on = draft.includes(s.id)
            return (
              <button key={s.id} type="button" aria-pressed={on} onClick={() => toggleSkill(s.id)}
                className={`min-h-11 rounded-full border px-3 text-sm ${on ? 'border-brand bg-brand text-white' : 'border-slate-300 dark:border-slate-700'}`}>
                {s.name}
              </button>
            )
          })}
        </div>
        {draft.length === 0 && <p className="text-sm text-amber-700 dark:text-amber-400">{t('fh.pick')}</p>}
      </fieldset>
      <RunNowButton />
    </Card>
  )
}
