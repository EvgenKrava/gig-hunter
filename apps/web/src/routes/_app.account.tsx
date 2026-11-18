import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import { useDeleteAccount } from '../api/hooks'
import { useAuthUser } from '../auth/useAuthUser'
import { useToast } from '../components/Toast'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { useT } from '../i18n'

export const Route = createFileRoute('/_app/account')({ component: AccountPage })

function AccountPage() {
  const { user, signOut } = useAuthUser()
  const del = useDeleteAccount()
  const toast = useToast()
  const [confirm, setConfirm] = useState(false)
  const { t, tRich } = useT()
  const onDelete = () => {
    setConfirm(false)
    // Success ends with the normal sign-out: the Cognito user is gone, but the hosted-UI session cookie is
    // not, and leaving it would make the next "Sign in with Google" trip over a user that no longer exists.
    del.mutate(undefined, { onSuccess: () => signOut(), onError: (e) => toast(t('account.deleteFailed', { error: e.message }), 'error') })
  }
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t('account.title')}</h1>
      <Card className="space-y-3">
        <h2 className="font-semibold">{t('account.signIn')}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">{tRich('account.signedInAs', { email: <span className="font-medium text-slate-900 dark:text-slate-100">{user?.email}</span> })}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t('account.signInText')}</p>
        <a className="inline-flex min-h-11 items-center gap-1.5 text-sm text-brand underline" href="https://onlytools.click" target="_blank" rel="noreferrer">{t('account.manage')} <ExternalLink size={14} /></a>
      </Card>
      <Card className="space-y-3 border-red-200 dark:border-red-900/60">
        <h2 className="font-semibold text-red-700 dark:text-red-400">{t('account.danger')}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t('account.dangerText')}</p>
        <Button variant="danger" loading={del.isPending} onClick={() => setConfirm(true)}>{t('account.delete')}</Button>
      </Card>
      <ConfirmDialog open={confirm} title={t('account.deleteTitle')} body={t('account.deleteBody')} confirmLabel={t('account.deleteConfirm')} danger onCancel={() => setConfirm(false)} onConfirm={onDelete} />
    </div>
  )
}
