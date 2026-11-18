import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { TextInput } from '../../components/ui/Inputs'
import { useT } from '../../i18n'

export function TokenInput({ label, placeholder, saveLabel, tokenSet, tokenHint, replaceable = false, onSave, onRemove }: {
  label: string; placeholder: string; saveLabel?: string; tokenSet: boolean; tokenHint?: string
  /** Offer “Replace” next to “Remove”, so a set token can be swapped without a gap. */
  replaceable?: boolean
  onSave: (token: string) => Promise<unknown>; onRemove: () => Promise<unknown>
}) {
  const [value, setValue] = useState('')
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [replacing, setReplacing] = useState(false)
  // The caller reports failures (toast); swallowing here keeps the typed value for a retry and avoids an unhandled rejection.
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); setValue(''); setReplacing(false) } catch { /* reported by the caller */ } finally { setBusy(false) } }
  if (tokenSet && !replacing) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm">{t('token.set', { label })} <span className="font-mono text-slate-500">···{tokenHint ?? '????'}</span></span>
        <div className="ml-auto flex gap-1">
          {replaceable && <Button variant="ghost" onClick={() => setReplacing(true)}>{t('token.replace')}</Button>}
          <Button variant="ghost" className="text-red-700" onClick={() => setConfirm(true)}>{t('token.remove')}</Button>
        </div>
        <ConfirmDialog open={confirm} title={t('token.removeTitle', { label })} body={t('token.removeBody')} confirmLabel={t('token.removeConfirm')} danger onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); void run(onRemove) }} />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <TextInput aria-label={label} className="mt-0 flex-1 font-mono" type="password" autoComplete="off" placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
      <div className="flex gap-2">
        <Button className="flex-1 sm:flex-none" onClick={() => run(() => onSave(value.trim()))} disabled={value.trim().length < 10} loading={busy}>{saveLabel ?? t('token.save')}</Button>
        {replacing && <Button variant="ghost" onClick={() => { setReplacing(false); setValue('') }}>{t('common.cancel')}</Button>}
      </div>
    </div>
  )
}
