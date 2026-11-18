import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import type { QuickAction } from '@gighunter/core/schema'
import { usePreviewPrompt, usePrompts, useSavePrompts } from '../../api/hooks'
import { useToast } from '../../components/Toast'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Details } from '../../components/ui/Details'
import { FormCardSkeleton, SkeletonPage } from '../../components/ui/Skeleton'
import { Textarea, TextInput } from '../../components/ui/Inputs'
import { useT } from '../../i18n'

export function PromptsBlock() {
  const q = usePrompts()
  const { t, tRich } = useT()
  if (q.isLoading || !q.data) return q.error ? <Card><p className="text-red-600">{q.error.message}</p></Card> : <SkeletonPage><FormCardSkeleton fields={2} /></SkeletonPage>
  const { defaults, overrides, placeholders } = q.data
  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{t('prompts.title')}</h2>
        <p className="text-sm text-slate-500">{tRich('prompts.placeholders', { list: placeholders.map((p) => <code key={p} className="mr-1 rounded bg-slate-100 px-1 dark:bg-slate-800">{p}</code>) })}</p>
      </div>
      <PromptEditor kind="scoring" label={t('prompts.scoring')} defaultText={defaults.scoring} override={overrides.scoring} />
      <PromptEditor kind="chat" label={t('prompts.chat')} defaultText={defaults.chat} override={overrides.chat} />
      <QuickActionsEditor defaults={defaults.quickActions} override={overrides.quickActions} />
    </Card>
  )
}

function PromptEditor({ kind, label, defaultText, override }: { kind: 'scoring' | 'chat'; label: string; defaultText: string; override?: string }) {
  const save = useSavePrompts(); const preview = usePreviewPrompt(); const toast = useToast()
  const { t } = useT()
  const [text, setText] = useState(override ?? defaultText)
  const [rendered, setRendered] = useState<string | null>(null)
  useEffect(() => { setText(override ?? defaultText) }, [override, defaultText])
  const dirty = text !== (override ?? defaultText)
  const ok = () => toast(t('common.saved'), 'success'); const fail = (e: Error) => toast(e.message, 'error')
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2"><h3 className="font-medium">{label}</h3>{override && <span className="rounded bg-indigo-100 px-2 text-xs text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">{t('common.customized')}</span>}</div>
      <Textarea aria-label={label} value={text} onChange={(e) => setText(e.target.value)} rows={10} maxLength={8000} className="font-mono" />
      <div className="flex flex-wrap gap-2">
        <Button disabled={!dirty || !text.trim()} loading={save.isPending} onClick={() => save.mutate(kind === 'scoring' ? { scoring: text } : { chat: text }, { onSuccess: ok, onError: fail })}>{t('common.save')}</Button>
        <Button variant="secondary" loading={preview.isPending} onClick={() => preview.mutate({ kind, template: text }, { onSuccess: (r) => setRendered(r.rendered), onError: fail })}>{t('prompts.preview')}</Button>
        {override && <Button variant="ghost" onClick={() => save.mutate(kind === 'scoring' ? { scoring: null } : { chat: null }, { onSuccess: ok, onError: fail })}>{t('common.resetDefault')}</Button>}
      </div>
      {rendered !== null && <Details summary={t('prompts.rendered')} defaultOpen><pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs">{rendered}</pre></Details>}
    </div>
  )
}

let seq = 0
const nextId = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : String(++seq))
type QuickActionRow = QuickAction & { id: string }
const withIds = (items: QuickAction[]): QuickActionRow[] => items.map((a) => ({ ...a, id: nextId() }))

function QuickActionsEditor({ defaults, override }: { defaults: QuickAction[]; override?: QuickAction[] }) {
  const save = useSavePrompts(); const toast = useToast()
  const { t } = useT()
  // Assign ids once per distinct server snapshot (not on every effect fire, which always runs once on
  // mount) — otherwise the mount-time resync below would regenerate ids for the same data, changing every
  // row's `key` right after the initial paint and detaching the just-rendered DOM nodes from the document.
  const serverItems = useMemo(() => withIds(override ?? defaults), [override, defaults])
  const [items, setItems] = useState<QuickActionRow[]>(serverItems)
  useEffect(() => { setItems(serverItems) }, [serverItems])
  const update = (i: number, patch: Partial<QuickAction>) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= items.length) return; const next = [...items]; const tmp = next[i]!; next[i] = next[j]!; next[j] = tmp; setItems(next) }
  const ok = () => toast(t('common.saved'), 'success'); const fail = (e: Error) => toast(e.message, 'error')
  const valid = items.length >= 1 && items.every((a) => a.label.trim() && a.text.trim()) && new Set(items.map((a) => a.label.trim())).size === items.length
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2"><h3 className="font-medium">{t('prompts.quick')}</h3>{override && <span className="rounded bg-indigo-100 px-2 text-xs text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">{t('common.customized')}</span>}</div>
      <p className="text-sm text-slate-500">{t('prompts.quickHint')}</p>
      <ul className="space-y-3">
        {items.map((a, i) => (
          <li key={a.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1"><TextInput aria-label={t('prompts.actionLabel', { n: i + 1 })} className="mt-0" placeholder={t('prompts.label')} maxLength={40} value={a.label} onChange={(e) => update(i, { label: e.target.value })} /></div>
              <button type="button" aria-label={t('prompts.up')} className="grid h-11 w-11 place-items-center text-slate-500" onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
              <button type="button" aria-label={t('prompts.down')} className="grid h-11 w-11 place-items-center text-slate-500" onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
              <button type="button" aria-label={t('prompts.removeAction')} className="grid h-11 w-11 place-items-center text-red-600" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
            </div>
            <Textarea aria-label={t('prompts.actionText', { n: i + 1 })} className="mt-2 min-h-16" placeholder={t('prompts.message')} maxLength={2000} value={a.text} onChange={(e) => update(i, { text: e.target.value })} />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={items.length >= 8} onClick={() => setItems([...items, { id: nextId(), label: '', text: '' }])}>{t('prompts.add')}</Button>
        <Button disabled={!valid} loading={save.isPending} onClick={() => save.mutate({ quickActions: items.map(({ label, text }) => ({ label: label.trim(), text: text.trim() })) }, { onSuccess: ok, onError: fail })}>{t('prompts.saveActions')}</Button>
        {override && <Button variant="ghost" onClick={() => save.mutate({ quickActions: null }, { onSuccess: ok, onError: fail })}>{t('common.resetDefault')}</Button>}
      </div>
    </div>
  )
}
