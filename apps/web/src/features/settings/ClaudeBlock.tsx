import { useRemoveToken, useSaveToken, type PublicSettings } from '../../api/hooks'
import { useToast } from '../../components/Toast'
import { Card } from '../../components/ui/Card'
import { Details } from '../../components/ui/Details'
import { TokenInput } from './TokenInput'
import { useT } from '../../i18n'

/** The user's own Claude API key. Write-only: the API returns only whether it is set, its last 4 characters and when. */
export function ClaudeBlock({ settings }: { settings: PublicSettings }) {
  const save = useSaveToken('anthropic'); const remove = useRemoveToken('anthropic')
  const toast = useToast()
  const { t, tRich, locale } = useT()
  // `?? { keySet: false }`: an API deployed before this card returns settings without the field.
  const a = settings.anthropic ?? { keySet: false }
  const wrap = <T,>(p: Promise<T>) => p.then((r) => { toast(t('common.saved'), 'success'); return r }).catch((e) => { toast(e.message, 'error'); throw e })
  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">{t('claude.title')}</h2>
      <p className="text-sm text-slate-600">{t('claude.text')}</p>
      <Details summary={t('claude.how')}>
        <ol className="list-decimal space-y-1 pl-4">
          <li>{tRich('claude.step1', { link: <a className="underline" href="https://platform.claude.com/" target="_blank" rel="noreferrer">{t('claude.console')}</a> })}</li>
          <li>{t('claude.step2')}</li>
          <li>{t('claude.step3')}</li>
        </ol>
        <p className="mt-2">{t('claude.subscription')}</p>
      </Details>
      <TokenInput label={t('claude.title')} placeholder="sk-ant-api03-…" saveLabel={t('claude.saveKey')} tokenSet={a.keySet} tokenHint={a.keyHint} replaceable
        onSave={(key) => wrap(save.mutateAsync(key))} onRemove={() => wrap(remove.mutateAsync())} />
      {a.keySet && a.keyUpdatedAt && <p className="text-xs text-slate-500">{t('claude.savedAt', { when: new Date(a.keyUpdatedAt).toLocaleString(locale) })}</p>}
      {!a.keySet && settings.active && <p className="text-sm text-amber-700" role="status">{t('claude.paused')}</p>}
    </Card>
  )
}
