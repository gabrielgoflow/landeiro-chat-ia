import { supabase } from '@/lib/supabase.js'

export class ChatMessageService {
  
  // Salvar mensagem no histórico estruturado
  static async saveMessage({
    chatId,
    threadId,
    messageId,
    sender,
    content,
    messageType = 'text',
    audioUrl = null,
    metadata = {}
  }) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert([
          {
            chat_id: chatId,
            thread_id: threadId,
            message_id: messageId,
            sender,
            content,
            message_type: messageType,
            audio_url: audioUrl,
            metadata
          }
        ])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error saving message:', error)
      return { data: null, error: error.message }
    }
  }

  // Buscar histórico de mensagens de um chat
  static async getChatMessages(chatId, limit = 100) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
        .limit(limit)

      if (error) throw error
      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error fetching chat messages:', error)
      return { data: [], error: error.message }
    }
  }

  // Buscar mensagens por thread_id (útil para sessões contínuas)
  static async getThreadMessages(threadId, limit = 100) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(limit)

      if (error) throw error
      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error fetching thread messages:', error)
      return { data: [], error: error.message }
    }
  }

  // Estatísticas de um chat
  static async getChatStats(chatId) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('sender, message_type, created_at')
        .eq('chat_id', chatId)

      if (error) throw error

      const stats = {
        totalMessages: data.length,
        userMessages: data.filter(m => m.sender === 'user').length,
        assistantMessages: data.filter(m => m.sender === 'assistant').length,
        audioMessages: data.filter(m => m.message_type === 'audio').length,
        textMessages: data.filter(m => m.message_type === 'text').length,
        firstMessage: data.length > 0 ? data[0].created_at : null,
        lastMessage: data.length > 0 ? data[data.length - 1].created_at : null
      }

      return { data: stats, error: null }
    } catch (error) {
      console.error('Error getting chat stats:', error)
      return { data: null, error: error.message }
    }
  }

  // Buscar overview completo usando a view
  static async getChatOverview(chatId) {
    try {
      const { data, error } = await supabase
        .from('v_chat_overview')
        .select('*')
        .eq('chat_id', chatId)
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error getting chat overview:', error)
      return { data: null, error: error.message }
    }
  }

  // Buscar sessões de um usuário usando a view
  static async getUserSessions(userId) {
    try {
      const { data, error } = await supabase
        .from('v_user_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('session_started', { ascending: false })

      if (error) throw error
      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error getting user sessions:', error)
      return { data: [], error: error.message }
    }
  }
}

export { ChatMessageService as chatMessageService }