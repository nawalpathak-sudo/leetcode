import { AuthProvider } from './_components/AuthContext'
import StudentPortal from './_components/StudentPortalClient'

export const dynamic = 'force-dynamic'

export default function PortalPage() {
  return (
    <AuthProvider>
      <StudentPortal />
    </AuthProvider>
  )
}
