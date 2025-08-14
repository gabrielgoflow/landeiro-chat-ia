import { useEffect } from 'react'
import { useLocation } from 'wouter'
import { useAuth } from '@/hooks/useAuth.jsx'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const [, setLocation] = useLocation()

  useEffect(() => {
    if (!loading && !user) {
      setLocation('/login')
    }
  }, [user, loading, setLocation])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-robot text-white text-xl"></i>
          </div>
          <div className="flex items-center justify-center space-x-2">
            <i className="fas fa-spinner fa-spin text-primary"></i>
            <span className="text-gray-600">Carregando...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return children
}