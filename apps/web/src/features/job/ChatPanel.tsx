import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Markdown from 'react-markdown'
import { Copy, RotateCcw, SendHorizontal } from 'lucide-react'
import type { Chat, ChatMessage, MatchRef, QuickAction } from '@gighunter/core/schema'
import { useResetChat, useSendChat } from '../../api/hooks'
import { useToast } from '../../components/Toast'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Skeleton } from '../../components/ui/Skeleton'
import { useT } from '../../i18n'

export function ChatPanel({ matchRef, chat, quickActions }: { matchRef: MatchRef; chat: Chat | null; quickActions: QuickAction[] }) {
  const send = useSendChat(matchRef)
  const reset = useResetChat(matchRef)
  const toast = useToast()
  const { t } = useT()
  const [draft, setDraft] = useState('')
  const [pendingText, setPendingText] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const messages: ChatMessage[] = chat?.messages ?? []

  // The marker sits after the sticky composer, so bringing it into view lands the composer at its
  // resting spot with the latest reply visible above it; a marker before the composer would leave
  // the reply hidden under it. Nothing to reveal in an empty chat, so keep the job header in view.
  useEffect(() => {
    if (messages.length === 0 && !pendingText) return
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, pendingText])

  const submit = (text: string) => {
    const message = text.trim()
    if (!message || send.isPending) return
    setPendingText(message)
    setDraft('')
    setTruncated(false)
    send.mutate(message, {
      onSuccess: (r) => setTruncated(r.truncated),
      onError: (e) => { toast(e.message, 'error'); setDraft(message) },
      onSettled: () => setPendingText(null),
    })
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(draft) } }
  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => toast(t('common.copied'), 'success'))

  return (
    <section className="flex flex-col" aria-label={t('chat.title')}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('chat.title')}</h2>
        {messages.length > 0 && <Button variant="ghost" onClick={() => setConfirmReset(true)} aria-label={t('chat.reset')}><RotateCcw size={16} />{t('chat.reset')}</Button>}
      </div>
      <div className="space-y-3">
        {messages.length === 0 && !pendingText && <p className="text-sm text-slate-500">{t('chat.empty')}</p>}
        {messages.map((m, i) => <Bubble key={i} m={m} onCopy={m.role === 'assistant' ? () => copy(m.content) : undefined} />)}
        {pendingText && (<>
          <Bubble m={{ role: 'user', content: pendingText, at: '' }} />
          <p className="text-sm text-slate-500" role="status">{t('chat.thinking')}</p>
        </>)}
        {truncated && <p className="text-xs text-amber-700">{t('chat.truncated')}</p>}
      </div>
      {/* Sticks right on top of the bottom nav on phones (shared --bottom-nav height), on the viewport edge on desktop. */}
      <div className="sticky bottom-(--bottom-nav) z-30 -mx-4 mt-4 border-t border-slate-200 bg-white px-4 pb-2 pt-2 md:bottom-0 md:pb-[max(0.5rem,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-950">
        {quickActions.length > 0 && (
          // One swipeable row on phones — two wrapped rows plus the nav ate a third of the screen.
          <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            {quickActions.map((q) => <button key={q.label} type="button" disabled={send.isPending} onClick={() => submit(q.text)} className="min-h-11 shrink-0 rounded-full border border-slate-300 px-3 text-sm disabled:opacity-50 dark:border-slate-700">{q.label}</button>)}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} disabled={send.isPending} rows={1} placeholder={t('chat.placeholder')} enterKeyHint="send"
            className="max-h-40 min-h-11 flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-brand dark:border-slate-700 dark:bg-slate-950" />
          <Button onClick={() => submit(draft)} disabled={!draft.trim()} loading={send.isPending} aria-label={t('chat.send')}><SendHorizontal size={18} /></Button>
        </div>
      </div>
      <div ref={endRef} className="scroll-mb-(--bottom-nav) md:scroll-mb-0" />
      <ConfirmDialog open={confirmReset} title={t('chat.resetTitle')} body={t('chat.resetBody')} confirmLabel={t('chat.resetConfirm')} danger
        onCancel={() => setConfirmReset(false)} onConfirm={() => { setConfirmReset(false); reset.mutate(undefined, { onError: (e) => toast(e.message, 'error') }) }} />
    </section>
  )
}

function Bubble({ m, onCopy }: { m: ChatMessage; onCopy?: () => void }) {
  const mine = m.role === 'user'
  const { t } = useT()
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`relative max-w-[88%] rounded-2xl px-3.5 py-2.5 text-base ${mine ? 'bg-brand text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
        {mine ? <p className="whitespace-pre-wrap">{m.content}</p> : <div className="md"><Markdown>{m.content}</Markdown></div>}
        {onCopy && <button type="button" onClick={onCopy} aria-label={t('common.copy')} className="mt-1 inline-flex min-h-11 items-center gap-1 px-1 text-xs text-slate-500"><Copy size={12} />{t('common.copy')}</button>}
      </div>
    </div>
  )
}

export const ChatPanelSkeleton = () => (
  <div>
    <Skeleton className="mb-3 h-6 w-16" />
    <div className="space-y-3">
      <div className="flex justify-end"><Skeleton className="h-16 w-3/4 rounded-2xl" /></div>
      <div className="flex justify-start"><Skeleton className="h-28 w-5/6 rounded-2xl" /></div>
    </div>
    <div className="mt-4 flex gap-2">
      <Skeleton className="h-11 w-28 rounded-full" />
      <Skeleton className="h-11 w-28 rounded-full" />
    </div>
    <div className="mt-2 flex items-end gap-2">
      <Skeleton className="h-11 flex-1 rounded-lg" />
      <Skeleton className="h-11 w-12 rounded-lg" />
    </div>
  </div>
)
