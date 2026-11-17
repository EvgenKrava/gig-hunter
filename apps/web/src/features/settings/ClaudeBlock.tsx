import { useRemoveToken, useSaveToken, type PublicSettings } from '../../api/hooks'
import { useToast } from '../../components/Toast'
import { Card } from '../../components/ui/Card'
import { Details } from '../../components/ui/Details'
import { TokenInput } from './TokenInput'

/** The user's own Claude API key. Write-only: the API returns only whether it is set, its last 4 characters and when. */
export function ClaudeBlock({ settings }: { settings: PublicSettings }) {
  const save = useSaveToken('anthropic'); const remove = useRemoveToken('anthropic')
  const toast = useToast()
  // `?? { keySet: false }`: an API deployed before this card returns settings without the field.
  const a = settings.anthropic ?? { keySet: false }
  const wrap = <T,>(p: Promise<T>) => p.then((r) => { toast('Saved', 'success'); return r }).catch((e) => { toast(e.message, 'error'); throw e })
  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">Claude API key</h2>
      <p className="text-sm text-slate-600">Jobs are scored and replies drafted by Claude with your own key, billed to your Anthropic account. On Claude Haiku 5.5 a job costs a fraction of a cent.</p>
      <Details summary="How to get an API key">
        <ol className="list-decimal space-y-1 pl-4">
          <li>Sign in to the <a className="underline" href="https://platform.claude.com/" target="_blank" rel="noreferrer">Claude Console</a> → Settings → API keys → Create key.</li>
          <li>Add credits under Billing.</li>
          <li>Paste the key below. We check it with Anthropic before saving and never show it again.</li>
        </ol>
        <p className="mt-2">A Claude Pro or Max subscription can’t be used here: its tokens work only in Claude’s own apps.</p>
      </Details>
      <TokenInput label="Claude API key" placeholder="sk-ant-api03-…" saveLabel="Save key" tokenSet={a.keySet} tokenHint={a.keyHint} replaceable
        onSave={(key) => wrap(save.mutateAsync(key))} onRemove={() => wrap(remove.mutateAsync())} />
      {a.keySet && a.keyUpdatedAt && <p className="text-xs text-slate-500">Saved {new Date(a.keyUpdatedAt).toLocaleString()}</p>}
      {!a.keySet && settings.active && <p className="text-sm text-amber-700" role="status">Job scoring is paused until you add a key.</p>}
    </Card>
  )
}
