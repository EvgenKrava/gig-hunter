import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { SettingsPatch } from '@gighunter/core/schema'
import { useRemoveToken, useSaveToken, type PublicSettings } from '../../api/hooks'
import { useToast } from '../../components/Toast'
import { RunNowButton } from '../../components/RunNowButton'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Details } from '../../components/ui/Details'
import { Field } from '../../components/ui/Field'
import { TextInput } from '../../components/ui/Inputs'
import { Toggle } from '../../components/ui/Toggle'
import { TokenInput } from './TokenInput'
import { useT } from '../../i18n'

export function FreelancerBlock({ settings, onPatch }: { settings: PublicSettings; onPatch: (p: SettingsPatch) => void }) {
  const save = useSaveToken('freelancer'); const remove = useRemoveToken('freelancer')
  const toast = useToast()
  const { t, tRich } = useT()
  const f = settings.platforms.freelancer
  const [query, setQuery] = useState(f.query)
  const submittedRef = useRef(f.query)
  useEffect(() => { setQuery(f.query); submittedRef.current = f.query }, [f.query])
  const wrap = <T,>(p: Promise<T>) => p.then((r) => { toast(t('common.saved'), 'success'); return r }).catch((e) => { toast(e.message, 'error'); throw e })
  const saveQuery = () => {
    if (query === submittedRef.current) return
    submittedRef.current = query
    onPatch({ platforms: { freelancer: { query } } })
  }
  const onQueryKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); saveQuery() } }
  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">Freelancer.com</h2>
      <Details summary={t('fl.how')}>
        <ol className="list-decimal space-y-1 pl-4">
          <li>{tRich('fl.step1', { link: <a className="underline" href="https://www.freelancer.com/developers" target="_blank" rel="noreferrer">freelancer.com/developers</a> })}</li>
          <li>{t('fl.step2')}</li>
          <li>{t('fl.step3')}</li>
        </ol>
      </Details>
      <TokenInput label={t('fl.token')} placeholder="oauth token" tokenSet={f.tokenSet} tokenHint={f.tokenHint}
        onSave={(token) => wrap(save.mutateAsync(token))} onRemove={() => wrap(remove.mutateAsync())} />
      {f.tokenSet && (
        <div className="space-y-3 text-sm">
          <p>{t('fl.connected', { name: f.connectedAs ?? '' })}</p>
          <Toggle label={t('fl.poll')} checked={f.enabled} onChange={(enabled) => onPatch({ platforms: { freelancer: { enabled } } })} />
          <Field label={t('fl.query')} hint={t('fl.queryHint')}>
            <TextInput value={query} onChange={(e) => setQuery(e.target.value)} onBlur={saveQuery} onKeyDown={onQueryKey} enterKeyHint="go" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={query === f.query} onClick={saveQuery}>{t('fl.saveQuery')}</Button>
            <RunNowButton />
          </div>
        </div>
      )}
    </Card>
  )
}
