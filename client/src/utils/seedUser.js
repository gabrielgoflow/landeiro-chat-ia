import { auth } from '@/lib/supabase.js'

// Script para criar usuário admin
export async function createAdminUser() {
  const adminEmail = 'admin@goflow.digital'
  const adminPassword = '!@#GOflow2700'

  try {
    console.log('Criando usuário admin...')
    
    const { data, error } = await auth.signUp(adminEmail, adminPassword)
    
    if (error) {
      console.error('Erro ao criar usuário admin:', error.message)
      return { success: false, error: error.message }
    }

    console.log('Usuário admin criado com sucesso:', data)
    return { success: true, user: data.user }
    
  } catch (err) {
    console.error('Erro inesperado:', err)
    return { success: false, error: err.message }
  }
}

// Execute apenas se for chamado diretamente
if (typeof window !== 'undefined' && window.createAdminUser) {
  window.createAdminUser = createAdminUser
}