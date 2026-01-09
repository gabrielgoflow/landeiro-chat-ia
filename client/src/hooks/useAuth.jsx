import { useState, useEffect, createContext, useContext } from 'react'
import { auth } from '@/lib/supabase.js'

const AuthContext = createContext({
  user: null,
  loading: true,
  signUp: async () => ({ data: null, error: null }),
  signIn: async () => ({ data: null, error: null }),
  signOut: async () => ({ error: null })
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    auth.getCurrentUser()
      .then(async (result) => {
        const user = result?.data?.user || null
        // Verificar status se usuário estiver logado
        if (user?.id) {
          try {
            const statusResult = await auth.getUserStatus(user.id)
            if (statusResult.status === "inadimplente") {
              // Fazer logout se status for inadimplente
              await auth.signOut()
              setUser(null)
              setLoading(false)
              return
            }
          } catch (error) {
            console.error("Error checking user status:", error)
          }
        }
        setUser(user)
        setLoading(false)
      })
      .catch((error) => {
        console.error("Error getting current user:", error)
        setUser(null)
        setLoading(false)
      })

    // Listen to auth changes
    const authStateChange = auth.onAuthStateChange(async (event, session) => {
      // Verificar status quando houver mudança de autenticação
      if (session?.user?.id) {
        try {
          const statusResult = await auth.getUserStatus(session.user.id)
          if (statusResult.status === "inadimplente") {
            // Fazer logout se status for inadimplente
            await auth.signOut()
            setUser(null)
            setLoading(false)
            return
          }
        } catch (error) {
          console.error("Error checking user status:", error)
        }
      }
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const subscription = authStateChange?.data?.subscription

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [])

  const signUp = async (email, password) => {
    setLoading(true)
    try {
      const { data, error } = await auth.signUp(email, password)
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email, password) => {
    setLoading(true)
    try {
      const { data, error } = await auth.signIn(email, password)
      if (error) throw error
      
      // Verificar status do usuário após login bem-sucedido
      if (data?.user?.id) {
        const statusResult = await auth.getUserStatus(data.user.id)
        if (statusResult.status === "inadimplente") {
          // Fazer logout imediatamente
          await auth.signOut()
          return {
            data: null,
            error: {
              message: "Seu acesso foi bloqueado devido ao status de inadimplência. Entre em contato com o administrador para regularizar sua situação."
            }
          }
        }
      }
      
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      const { error } = await auth.signOut()
      if (error) throw error
      return { error: null }
    } catch (error) {
      return { error }
    } finally {
      setLoading(false)
    }
  }

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signOut
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context || typeof context.signIn !== 'function') {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}