import { useEffect, useState } from 'react'
import type { SettingsPatch } from '@gighunter/core/schema'
import { useRemoveToken, useSaveToken, useTelegramTest, type PublicSettings } from '../../api/hooks'
import { useToast } from '../../components/Toast'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Details } from '../../components/ui/Details'
import { TextInput } from '../../components/ui/Inputs'
import { TokenInput } from './TokenInput'
import { useT } from '../../i18n'

export function TelegramBlock({ settings, onPatch }: { settings: PublicSettings; onPatch: (p: SettingsPatch) => void }) {
  const save = useSaveToken('telegram'); const remove = useRemoveToken('telegram'); const test = useTelegramTest()
  const toast = useToast()
  const { t, tRich } = useT()
  const tg = settings.telegram
  const [chatId, setChatId] = useState(tg.chatId ?? '')
  useEffect(() => setChatId(tg.chatId ?? ''), [tg.chatId])
  const wrap = <T,>(p: Promise<T>) => p.then((r) => { toast(t('common.saved'), 'success'); return r }).catch((e) => { toast(e.message, 'error'); throw e })
  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">Telegram</h2>
      <Details summary={t('tg.how')}>
        <ol className="list-decimal space-y-1 pl-4">
          <li>{tRich('tg.step1', { link: <a className="underline" href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a> })}</li>
          <li>{t('tg.step2')}</li>
          <li>{t('tg.step3')}</li>
          <li>{t('tg.step4')}</li>
        </ol>
      </Details>
      <TokenInput label={t('tg.token')} placeholder="123456789:AAExample…" tokenSet={tg.tokenSet} tokenHint={tg.tokenHint}
        onSave={(token) => wrap(save.mutateAsync(token))} onRemove={() => wrap(remove.mutateAsync())} />
      {tg.tokenSet && (
        <div className="space-y-2 text-sm">
          <p>{tRich('tg.status', { bot: <span className="font-medium">@{tg.botUsername}</span> })} {tg.chatId ? <span className="font-medium">{tg.chatTitle ?? tg.chatId} ✓</span> : <span className="text-amber-700">{t('tg.waiting')}</span>}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!tg.chatId} loading={test.isPending} onClick={() => test.mutate(undefined, { onSuccess: () => toast(t('tg.testSent'), 'success'), onError: (e) => toast(e.message, 'error') })}>{t('tg.test')}</Button>
          </div>
          <Details summary={t('tg.manual')}>
            <div className="flex gap-2">
              <TextInput aria-label={t('tg.chatId')} className="mt-0" inputMode="numeric" placeholder="-1001234567890" value={chatId} onChange={(e) => setChatId(e.target.value)} />
              <Button variant="secondary" onClick={() => onPatch({ telegram: { chatId: chatId.trim() } })} disabled={!chatId.trim()}>{t('common.save')}</Button>
            </div>
          </Details>
        </div>
      )}
    </Card>
  )
}
