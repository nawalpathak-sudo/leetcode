import { lazy, Suspense } from 'react'
import { useOutletContext } from 'react-router-dom'

const AmcatAssessments = lazy(() => import('../../../components/AdminPanel').then(m => ({ default: m.AmcatAssessments })))

export default function Amcat() {
  const { adminUser } = useOutletContext()

  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-ambient border-r-transparent" /></div>}>
      <AmcatAssessments adminUser={adminUser} />
    </Suspense>
  )
}
