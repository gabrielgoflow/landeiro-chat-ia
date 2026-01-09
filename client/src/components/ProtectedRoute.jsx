import { useAuth } from '@/hooks/useAuth.jsx'
import { useLocation } from 'wouter'
import { useEffect, useState } from 'react'
import { auth } from '@/lib/supabase.js'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const [, setLocation] = useLocation()
  const [checkingStatus, setCheckingStatus] = useState(false)

  useEffect(() => {
    const checkUserStatus = async () => {
      if (loading) return
      
      if (!user) {
        setLocation('/login')
        return
      }

      // Verificar status do usuário
      setCheckingStatus(true)
      try {
        const statusResult = await auth.getUserStatus(user.id)
        if (statusResult.status === "inadimplente") {
          // Fazer logout se status for inadimplente
          await auth.signOut()
          setLocation('/login')
          return
        }
      } catch (error) {
        console.error("Error checking user status:", error)
      } finally {
        setCheckingStatus(false)
      }
    }

    checkUserStatus()
  }, [loading, user, setLocation])

  if (loading || checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect via useEffect
  }

  return children
}