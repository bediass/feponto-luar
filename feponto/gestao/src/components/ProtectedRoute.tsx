import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Carregando } from './ui'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Carregando />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return <>{children}</>
}
