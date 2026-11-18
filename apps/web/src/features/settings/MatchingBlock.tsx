import { useEffect, useState } from 'react'
import { KNOWN_MODELS, type SettingsPatch } from '@gighunter/core/schema'
import type { PublicSettings } from '../../api/hooks'
import { Card } from '../../components/ui/Card'
import { Field } from '../../components/ui/Field'
import { NumberInput, Select } from '../../components/ui/Inputs'
import { useT } from '../../i18n'

const withCurrent = (id: string) => (KNOWN_MODELS.some((m) => m.id === id) ? KNOWN_MODELS : [...KNOWN_MODELS, { id, label: id }])

export function MatchingBlock({ settings, onPatch }: { settings: PublicSettings; onPatch: (p: SettingsPatch) => void }) {
  const [threshold, setThreshold] = useState(settings.notifyThreshold)
  const [age, setAge] = useState<number | undefined>(settings.maxJobAgeHours)
  useEffect(() => setThreshold(settings.notifyThreshold), [settings.notifyThreshold])
  useEffect(() => setAge(settings.maxJobAgeHours), [settings.maxJobAgeHours])
  const { t } = useT()
  const commit = () => { if (threshold !== settings.notifyThreshold) onPatch({ notifyThreshold: threshold }) }
  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">{t('matching.title')}</h2>
      <Field label={t('matching.notify', { n: threshold })} hint={t('matching.notifyHint')}>
        <input type="range" min={0} max={100} step={5} value={threshold} aria-label={t('matching.notifyAria')} className="mt-2 w-full min-h-11 accent-brand" onChange={(e) => setThreshold(Number(e.target.value))} onPointerUp={commit} onKeyUp={commit} />
      </Field>
      <Field label={t('matching.age')}><NumberInput value={age} onChange={setAge} min={1} max={168} onBlur={() => age && age !== settings.maxJobAgeHours && onPatch({ maxJobAgeHours: age })} /></Field>
      <Field label={t('matching.model')} hint={t('matching.modelHint')}>
        <Select value={settings.model} onChange={(e) => onPatch({ model: e.target.value })}>{withCurrent(settings.model).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select>
      </Field>
      <Field label={t('matching.chatModel')} hint={t('matching.chatModelHint')}>
        <Select value={settings.chatModel} onChange={(e) => onPatch({ chatModel: e.target.value })}>{withCurrent(settings.chatModel).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select>
      </Field>
    </Card>
  )
}
