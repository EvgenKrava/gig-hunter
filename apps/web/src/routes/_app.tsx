import { useEffect, useRef } from 'react'
import { createFileRoute, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { hasAccess, useAuthUser } from '../auth/useAuthUser'
import { AppShell } from '../components/AppShell'
import { FormCardSkeleton, Skeleton, SkeletonPage } from '../components/ui/Skeleton'

export const Route = createFileRoute('/_app')({ component: AppGuard })

function AppGuard() {
  const { user, isLoading } = useAuthUser()
  const { href } = useLocation()
  const navigate = useNavigate()
  // Signed out: remember where the user wanted to go (e.g. a job link tapped in Telegram) and bounce
  // via the landing page. Imperative and once-only on purpose — `<Navigate>` re-issues the navigation
  // on every re-render (props compared by reference), and this component re-renders while that
  // navigation is pending, so it spun the router forever and Safari killed the page.
  const bounced = useRef(false)
  useEffect(() => {
    if (user || isLoading || bounced.current) return
    bounced.current = true
    sessionStorage.setItem('returnTo', href)
    void navigate({ to: '/', replace: true })
  }, [user, isLoading, href, navigate])
  if (!user) {
    return (
      <AppShell>
        <SkeletonPage className="space-y-4">
          <Skeleton className="h-7 w-28" />
          <FormCardSkeleton fields={3} />
        </SkeletonPage>
      </AppShell>
    )
  }
  if (!hasAccess(user)) return <NoAccess email={user.email} />
  return (
    <AppShell user={user}>
      <Outlet />
    </AppShell>
  )
}

/** Signed in to Only Tools, but GigHunter is invite-only and this account has no gighunter-user role. */
export function NoAccess({ email }: { email: string }) {
  const { signOut } = useAuthUser()
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-4">
      <h1 className="text-2xl font-bold">GigHunter is invite-only</h1>
      <p className="text-slate-600 dark:text-slate-300">
        You are signed in as <b>{email}</b>, but this account has no access to GigHunter yet. Ask the Only Tools admin for an invite.
      </p>
      <div className="flex gap-3">
        <a className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-white" href="https://onlytools.click">Other Only Tools apps</a>
        <button className="min-h-11 rounded-lg border border-slate-300 px-4 dark:border-slate-700" onClick={signOut}>Sign out</button>
      </div>
    </main>
  )
}
