import { supabase } from '@/lib/supabase.js'

export class SupabaseService {
  // Incrementar sessão de um chat existente (para "Iniciar Próxima Sessão")
  static async incrementChatSession(chatId) {
    try {
      // Buscar sessão atual do chat
      const { data: currentData, error: selectError } = await supabase
        .from('chat_threads')
        .select('sessao')
        .eq('chat_id', chatId)
        .single()

      if (selectError) throw selectError

      const nextSession = (currentData.sessao || 1) + 1

      // Atualizar para próxima sessão
      const { data, error } = await supabase
        .from('chat_threads')
        .update({ sessao: nextSession })
        .eq('chat_id', chatId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null, newSession: nextSession }
    } catch (error) {
      console.error('Error incrementing chat session:', error)
      return { data: null, error: error.message, newSession: null }
    }
  }

  // Criar relação entre chat interno e thread_id do OpenAI
  static async createChatThread(chatId, threadId, diagnostico, protocolo, sessao = 1) {
    try {
      const { data, error } = await supabase
        .from('chat_threads')
        .insert([
          {
            chat_id: chatId,
            thread_id: threadId,
            diagnostico,
            protocolo,
            sessao: sessao // Sempre começa com sessão 1 para novos chats
          }
        ])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error creating chat thread:', error)
      return { data: null, error: error.message }
    }
  }

  // Buscar thread_id do OpenAI por chat_id interno
  static async getThreadIdByChatId(chatId) {
    try {
      const { data, error } = await supabase
        .from('chat_threads')
        .select('thread_id, diagnostico, protocolo, sessao')
        .eq('chat_id', chatId)
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 = not found
      return { data, error: null }
    } catch (error) {
      console.error('Error getting thread ID:', error)
      return { data: null, error: error.message }
    }
  }

  // Criar relação entre user_id e chat_id do OpenAI
  static async createUserChat(userId, openaiChatId, chatThreadsId = null) {
    try {
      const { data, error } = await supabase
        .from('user_chats')
        .insert([
          {
            user_id: userId,
            chat_id: openaiChatId,
            chat_threads_id: chatThreadsId
          }
        ])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error creating user chat:', error)
      return { data: null, error: error.message }
    }
  }

  // Buscar chats do usuário
  static async getUserChats(userId) {
    try {
      const { data, error } = await supabase
        .from('user_chats')
        .select(`
          *,
          chat_threads (
            chat_id,
            thread_id,
            diagnostico,
            protocolo,
            sessao,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Transform data to flatten chat_threads info
      const transformedData = data?.map(userChat => ({
        ...userChat,
        chat_id: userChat.chat_threads?.chat_id || userChat.chat_id,
        thread_id: userChat.chat_threads?.thread_id,
        diagnostico: userChat.chat_threads?.diagnostico,
        protocolo: userChat.chat_threads?.protocolo,
        sessao: userChat.chat_threads?.sessao,
        created_at: userChat.chat_threads?.created_at || userChat.created_at
      })) || []
      
      return transformedData
    } catch (error) {
      console.error('Error getting user chats:', error)
      return []
    }
  }

  // Atualizar thread_id de um chat existente
  static async updateChatThread(chatId, threadId) {
    try {
      const { data, error } = await supabase
        .from('chat_threads')
        .update({ thread_id: threadId })
        .eq('chat_id', chatId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error updating chat thread:', error)
      return { data: null, error: error.message }
    }
  }

  // Deletar chat thread
  static async deleteChatThread(chatId) {
    try {
      const { error } = await supabase
        .from('chat_threads')
        .delete()
        .eq('chat_id', chatId)

      if (error) throw error
      return { error: null }
    } catch (error) {
      console.error('Error deleting chat thread:', error)
      return { error: error.message }
    }
  }

  // Deletar chat do usuário (e dados relacionados)
  static async deleteUserChat(userId, chatId) {
    try {
      // First delete the review if it exists
      await supabase
        .from('chat_reviews')
        .delete()
        .eq('chat_id', chatId)

      // Delete the user chat relationship
      const { error: userChatError } = await supabase
        .from('user_chats')
        .delete()
        .eq('user_id', userId)
        .eq('chat_id', chatId)

      if (userChatError) throw userChatError

      // Delete the chat thread (CASCADE will handle related data)
      const { error: chatThreadError } = await supabase
        .from('chat_threads')
        .delete()
        .eq('chat_id', chatId)

      if (chatThreadError) throw chatThreadError

      return { error: null }
    } catch (error) {
      console.error('Error deleting user chat:', error)
      throw error
    }
  }

  // Buscar chat_id do OpenAI por user_id
  static async getOpenAIChatByUser(userId) {
    try {
      const { data, error } = await supabase
        .from('user_chats')
        .select('chat_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error getting OpenAI chat:', error)
      return { data: null, error: error.message }
    }
  }

  // Verificar se tabelas existem (para debug)
  static async checkTablesExist() {
    try {
      const { data: chatThreads, error: error1 } = await supabase
        .from('chat_threads')
        .select('count', { count: 'exact' })
        .limit(1)

      const { data: userChats, error: error2 } = await supabase
        .from('user_chats')
        .select('count', { count: 'exact' })
        .limit(1)

      return {
        chatThreadsExists: !error1,
        userChatsExists: !error2,
        errors: { chatThreads: error1, userChats: error2 }
      }
    } catch (error) {
      console.error('Error checking tables:', error)
      return {
        chatThreadsExists: false,
        userChatsExists: false,
        errors: { general: error.message }
      }
    }
  }
}

export { SupabaseService as supabaseService }
export default SupabaseService