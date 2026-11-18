import { Play } from 'lucide-react'
import { useRunNow } from '../api/hooks'
import { useToast } from './Toast'
import { Button } from './ui/Button'
import { useT } from '../i18n'

export function RunNowButton() {
  const run = useRunNow()
  const toast = useToast()
  const { t } = useT()
  const onClick = () => run.mutate(undefined, { onSuccess: () => toast(t('run.queued'), 'success'), onError: (e) => toast(e.message, 'error') })
  return (
    <Button variant="secondary" onClick={onClick} loading={run.isPending} aria-label={t('run.nowAria')} title={t('run.nowAria')}>
      <Play size={16} />{t('run.now')}
    </Button>
  )
}
