import { createFileRoute } from '@tanstack/react-router'
import { useProfile, useSaveProfile } from '../api/hooks'
import { useToast } from '../components/Toast'
import { FormCardSkeleton, SkeletonPage } from '../components/ui/Skeleton'
import { ProfileForm } from '../features/profile/ProfileForm'
import { useT } from '../i18n'

export const Route = createFileRoute('/_app/profile')({ component: ProfilePage })

function ProfilePage() {
  const profile = useProfile()
  const save = useSaveProfile()
  const toast = useToast()
  const { t } = useT()
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t('profile.title')}</h1>
      {profile.isLoading ? (
        <SkeletonPage><FormCardSkeleton fields={3} /></SkeletonPage>
      ) : profile.error ? (
        <p className="text-red-600">{profile.error.message}</p>
      ) : (<>
        {profile.data === null && <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-100">{t('profile.startHere')}</p>}
        <ProfileForm key={profile.data?.updatedAt ?? 'new'} initial={profile.data ?? null} saving={save.isPending}
          onSubmit={(v) => save.mutateAsync(v).then(() => toast(t('profile.saved'), 'success')).catch((e) => toast(e.message, 'error'))} />
      </>)}
    </div>
  )
}
