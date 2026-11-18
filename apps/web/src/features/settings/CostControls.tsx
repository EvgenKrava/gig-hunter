import { POLL_INTERVAL_OPTIONS, type SettingsPatch } from '@gighunter/core/schema'
import type { PublicSettings } from '../../api/hooks'
import { Card } from '../../components/ui/Card'
import { Field } from '../../components/ui/Field'
import { Select } from '../../components/ui/Inputs'
import { Toggle } from '../../components/ui/Toggle'
import { t, useT } from '../../i18n'

const label = (m: number) => (m < 60 ? t('search.everyMin', { n: m }) : m === 60 ? t('search.everyHour') : m < 1440 ? t('search.everyHours', { n: m / 60 }) : t('search.daily'))

export function CostControls({ settings, onPatch }: { settings: PublicSettings; onPatch: (p: SettingsPatch) => void }) {
  const { locale } = useT()
  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">{t('search.title')}</h2>
      <Toggle label={settings.active ? t('search.on') : t('search.off')} checked={settings.active} onChange={(active) => onPatch({ active })} />
      <Field label={t('search.poll')} hint={t('search.pollHint')}>
        <Select value={settings.pollIntervalMinutes} onChange={(e) => onPatch({ pollIntervalMinutes: Number(e.target.value) })}>
          {POLL_INTERVAL_OPTIONS.map((m) => <option key={m} value={m}>{label(m)}</option>)}
        </Select>
      </Field>
      {settings.lastPolledAt && <p className="text-xs text-slate-500">{t('search.lastPolled', { when: new Date(settings.lastPolledAt).toLocaleString(locale) })}</p>}
    </Card>
  )
}
