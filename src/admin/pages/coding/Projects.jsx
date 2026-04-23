import { lazy, Suspense } from 'react'
import { useOutletContext } from 'react-router-dom'

const AdminProjects = lazy(() => import('../../../components/AdminProjects'))

export default function Projects() {
  const { adminUser } = useOutletContext()

  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-ambient border-r-transparent" /></div>}>
      <AdminProjects adminUser={adminUser} />
    </Suspense>
  )
}
