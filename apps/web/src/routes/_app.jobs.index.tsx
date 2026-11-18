import { createFileRoute } from '@tanstack/react-router'
import { MatchStatusSchema } from '@gighunter/core/schema'
import { useMatches, useRuns } from '../api/hooks'
import { Button } from '../components/ui/Button'
import { SkeletonPage } from '../components/ui/Skeleton'
import { LastRun } from '../features/jobs/LastRun'
import { MatchCard, MatchCardSkeleton } from '../features/jobs/MatchCard'
import { StatusChips } from '../features/jobs/StatusChips'
import { useT } from '../i18n'

export const Route = createFileRoute('/_app/jobs/')({
  validateSearch: (s: Record<string, unknown>) => ({ status: MatchStatusSchema.catch('notified').parse(s.status) }),
  component: JobsPage,
})

const empty = { notified: 'jobs.empty.notified', pending: 'jobs.empty.pending', scored: 'jobs.empty.scored', filtered: 'jobs.empty.filtered' } as const

function JobsPage() {
  const { status } = Route.useSearch()
  const matches = useMatches(status)
  const runs = useRuns()
  const { t } = useT()
  const items = matches.data?.pages.flatMap((p) => p.items) ?? []
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t('jobs.title')}</h1>
        <LastRun runs={runs.data} />
      </div>
      <StatusChips current={status} />
      {matches.isLoading && <SkeletonPage className="space-y-3">{[0, 1, 2].map((i) => <MatchCardSkeleton key={i} />)}</SkeletonPage>}
      {matches.error && <p className="text-red-600">{matches.error.message}</p>}
      {!matches.isLoading && items.length === 0 && <p className="text-slate-500">{t(empty[status])}</p>}
      <div className="space-y-3">{items.map((m) => <MatchCard key={`${m.job.platform}#${m.job.externalId}`} match={m} />)}</div>
      {matches.hasNextPage && <Button variant="secondary" className="w-full" onClick={() => matches.fetchNextPage()} loading={matches.isFetchingNextPage}>{t('jobs.loadMore')}</Button>}
    </div>
  )
}
