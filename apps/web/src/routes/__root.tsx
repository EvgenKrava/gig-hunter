import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { AppConfig } from '../config'
import { useT } from '../i18n'

function NotFound() {
  const { t } = useT()
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">{t('notFound.title')}</h1>
      <a className="text-brand underline" href="/">{t('notFound.back')}</a>
    </main>
  )
}

export const Route = createRootRouteWithContext<{ config: AppConfig }>()({
  component: () => <Outlet />,
  notFoundComponent: NotFound,
})
