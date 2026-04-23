import { lazy, Suspense } from 'react'
import { useOutletContext } from 'react-router-dom'

const AdminPanel = lazy(() => import('../../../components/AdminPanel'))

export default function Students() {
  const { adminUser, platforms } = useOutletContext()

  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-ambient border-r-transparent" /></div>}>
      <AdminPanel platforms={platforms} adminUser={adminUser} />
    </Suspense>
  )
}
