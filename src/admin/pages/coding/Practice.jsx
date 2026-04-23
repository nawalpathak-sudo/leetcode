import { lazy, Suspense } from 'react'

const PracticeAdmin = lazy(() => import('../../../components/PracticeAdmin'))

export default function Practice() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-ambient border-r-transparent" /></div>}>
      <PracticeAdmin />
    </Suspense>
  )
}
