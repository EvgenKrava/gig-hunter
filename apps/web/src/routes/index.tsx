import { useEffect, useRef } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Radar } from 'lucide-react'
import { useAuthUser } from '../auth/useAuthUser'
import { useT } from '../i18n'

export const Route = createFileRoute('/')({ component: Landing })

/**
 * gighunter.onlytools.click opens the app itself: Only Tools has one landing (onlytools.click), so
 * signed-out visitors go straight to the shared sign-in and signed-in ones to their jobs.
 */
export function Landing() {
  const { user, isLoading, error, signIn } = useAuthUser()
  const navigate = useNavigate()
  const { t } = useT()
  const started = useRef(false)
  useEffect(() => {
    if (isLoading || started.current) return
    if (user) {
      started.current = true
      void navigate({ to: '/jobs', search: { status: 'notified' }, replace: true })
    } else if (!error) {
      started.current = true
      const returnTo = sessionStorage.getItem('returnTo') ?? '/jobs'
      sessionStorage.removeItem('returnTo')
      signIn(returnTo)
    }
  }, [user, isLoading, error, signIn, navigate])
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <Radar className="text-brand" size={32} />
      <p className="text-slate-600 dark:text-slate-300">{error ? t('landing.failed') : t('landing.opening')}</p>
      {error && <button className="min-h-11 rounded-lg bg-brand px-4 text-white" onClick={() => signIn('/jobs')}>{t('landing.signIn')}</button>}
      <a className="text-sm underline text-slate-500" href="https://onlytools.click">Only Tools</a>
    </main>
  )
}
